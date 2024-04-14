import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { add, format, formatISO, formatRFC7231 } from 'date-fns'
import jp from 'jsonpath'
import { isFinite as _isFinite, get, isInteger, merge } from 'lodash-es'
import parse from './parser.js'

const assertInteger = something => {
  let value = something

  if (value.startsWith('-')) {
    value = value.slice(1)
  }

  const coerced = Number(value)

  if (!isInteger(coerced) || !_isFinite(coerced)) {
    throw new Error(`"${value}" is not a integer number`)
  }
}

export const evaluate = id => {
  const [fn, ...args] = id.slice(1).split(' ')

  switch (fn) {
    case 'datetime':
      return formatDatetime(new Date(), args.join(' '))

    case 'guid':
      return randomUUID()

    case 'processEnv':
      return processEnv()

    case 'randomInt':
      return randomInt()

    default:
      throw new Error(`not implemented: $${fn}`)
  }

  function formatDatetime(date, expr) {
    const [_, dateFormat, offset, offsetUnit] = expr.match(
      `^(iso8601|rfc1123|"[^"]+"|'[^']+')(?:\\s+(\\d+)\\s+(\\w+))?$`
    )

    let finalDate = date

    if (offset && offsetUnit) {
      const unitLookup = {
        y: 'years',
        M: 'months',
        w: 'weeks',
        d: 'days',
        h: 'hours',
        m: 'minutes',
        s: 'seconds'
      }

      finalDate = add(finalDate, { [unitLookup[offsetUnit]]: Number(offset) })
    }

    const lookup = {
      iso8601: date => formatISO(date),
      rfc1123: date => formatRFC7231(date)
    }

    if (dateFormat in lookup) return lookup[dateFormat](finalDate)

    return format(finalDate, JSON.parse(dateFormat))
  }

  function processEnv() {
    return process.env[args[0]]
  }

  function randomInt() {
    let [min, max] = args
    min ||= `${Number.MIN_SAFE_INTEGER}`
    max ||= `${Number.MAX_SAFE_INTEGER}`
    assertInteger(min)
    assertInteger(max)
    min = Number(min)
    max = Number(max)
    const delta = Number(max) - Number(min)
    const random = Math.trunc(delta * Math.random())
    return min + random
  }
}

export const makeInterpolate = ({
  env = {},
  globalVariables = {},
  requests = {},
  variables = {}
} = {}) => {
  const envVariables = Object.fromEntries(
    Object.entries(env).map(([name, value]) => [name, { global: true, value }])
  )

  return text => {
    const context = { env: envVariables, variables }

    function visit(text, path, { isGlobal = false } = {}) {
      const brokenAtStart = String(text)?.split('{{') ?? []

      const segments = [brokenAtStart.shift()]

      for (const start of brokenAtStart) {
        const endIndex = start.indexOf('}}')

        const id = start.slice(0, endIndex)

        if (id[0] === '$') {
          segments.push(evaluate(id, context))
        } else {
          if (path.includes(id)) {
            throw new Error(
              `variable cycle found: ${path.concat([id]).join(' -> ')}`
            )
          }

          if (isGlobal && !(id in globalVariables) && !(id in envVariables)) {
            throw new Error(`variable not found on global scope: ${id}`)
          }

          const [maybeRequestId] = id.split('.')

          if (
            !(id in envVariables) &&
            !(id in globalVariables) &&
            !(maybeRequestId in requests) &&
            !(id in variables)
          )
            throw new Error(`variable not found: ${id}`)

          let variable

          if (maybeRequestId in requests) {
            const expr = id.split('.').slice(1).join('.')

            const path = expr.slice(0, expr.indexOf('$') - 1)

            const jsonPath = expr.slice(expr.indexOf('$'))

            const value = jp.query(
              get(requests[maybeRequestId], path, {}),
              jsonPath
            )

            variable = { global: true, value }
          }

          variable =
            variable ??
            (!isGlobal && id in variables
              ? variables[id]
              : id in globalVariables
                ? globalVariables[id]
                : envVariables[id])

          variable.value = visit(variable.value, [...path, id], {
            isGlobal: id in globalVariables && !(id in variables)
          })

          segments.push(variable.value)
        }

        segments.push(start.slice(endIndex + 2))
      }

      return segments.join('')
    }

    return visit(text, [])
  }
}

export const test = async (
  { request },
  { env, fetch, globalVariables, requests } = {}
) => {
  fetch = fetch ?? (await import('node-fetch')).default

  const interpolate = makeInterpolate({
    env,
    globalVariables,
    requests,
    variables: request.variables
  })

  const url = interpolate(request.url)

  const headers = request.headers?.map(([k, v]) => [k, interpolate(v)])

  const body = interpolate(request.body)

  const fetchResponse = await fetch(url, {
    method: request.method,
    headers,
    ...(['GET', 'HEAD'].includes(request.method) ? {} : { body })
  })

  let responseBody

  const contentType = fetchResponse.headers.get('content-type')

  if (contentType.startsWith('text/')) {
    responseBody = await fetchResponse.text()
  } else if (contentType.indexOf('json') > -1) {
    const jsonText = await fetchResponse.text()

    responseBody = JSON.parse(jsonText || 'null')
  } else {
    responseBody = (await fetchResponse.buffer()).toString('hex')
  }

  const response = {
    headers: Array.from(fetchResponse.headers),
    body: responseBody
  }

  const ignoreHeaders = ['age', 'date']

  let ignoreHeadersRegex

  try {
    ignoreHeadersRegex =
      request.meta?.ignoreHeaders?.value &&
      new RegExp(request.meta.ignoreHeaders?.value)
  } catch (e) {
    console.error(e)

    throw e
  }

  response.headers = response.headers.map(([k, v]) => [k, v])

  for (const header of response.headers) {
    if (
      ignoreHeaders.includes(header[0]) ||
      ignoreHeadersRegex?.test(header[0])
    ) {
      header[1] = expect.anything()
    }
  }

  const modifiedRequest = {
    ...request
  }

  modifiedRequest.url = url
  modifiedRequest.headers = headers
  if (body) modifiedRequest.body = body

  const outcome = {
    request: modifiedRequest,
    response
  }

  if (request.meta?.name?.value) {
    requests[request.meta.name.value] = outcome
  }

  return outcome
}

export default {
  process: (src, filename = '') => {
    const requests = parse(src)

    let envs = {}

    if (filename) {
      const envPath = join(dirname(filename), 'http-client.env.json')

      const userEnvPath = join(dirname(filename), 'http-client.env.json.user')

      envs = merge(
        envs,
        existsSync(envPath) ? JSON.parse(readFileSync(envPath, 'utf-8')) : {},
        existsSync(userEnvPath)
          ? JSON.parse(readFileSync(userEnvPath, 'utf-8'))
          : {}
      )
    }

    const env = envs[process.env.NODE_ENV]

    const globalVariables = Object.fromEntries(
      requests.flatMap(({ variables = {} }) =>
        Object.entries(variables).filter(([, { global }]) => global)
      )
    )

    const code = `
      const { randomUUID } = require('node:crypto')

      describe(${JSON.stringify(filename)}, () => {
        // TODO: immerjs as peer dep to freeze stuff

        const env = ${JSON.stringify(env, null, 2)}

        const globalVariables = ${JSON.stringify(globalVariables, null, 2)}

        let requests

        let get

        let jp

        beforeAll(async () => {
          get = (await import('lodash-es')).get

          jp = (await import('jsonpath')).default

          requests = {}
        })

        const assertInteger = ${assertInteger.toString()}

        const evaluate = ${evaluate.toString()}

        const makeInterpolate = ${makeInterpolate.toString()}

        ${requests
          .filter(request => request.url)
          .map(request => {
            const interpolate = makeInterpolate({
              env,
              globalVariables,
              variables: request.variables
            })

            const title =
              request.meta?.title?.value ??
              `${request.method} ${interpolate(request.url)}`

            return `
              /**
               * ${filename}
               */
              test${
                request.meta?.only?.value
                  ? '.only'
                  : request.meta?.skip?.value
                    ? '.skip'
                    : ''
              }(${JSON.stringify(title)}, async () => {
                const outcome = await (${test.toString()})(${JSON.stringify(
                  {
                    env,
                    request
                  },
                  null,
                  2
                )}, { env, globalVariables, requests })

                expect(outcome).toMatchSnapshot()
              })
            `
          })
          .join('')}
      })
    `

    return {
      geCacheKey: (text, path, { configString }) => {
        return createHash('sha1')
          .update(text)
          .update(path)
          .update(configString)
          .digest('hex')
      },
      code
    }
  }
}
