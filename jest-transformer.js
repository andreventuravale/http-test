import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { add, format, formatISO, formatRFC7231 } from 'date-fns'
import { isFinite as _isFinite, isInteger, merge } from 'lodash-es'
import parse from './parser.js'

function assertInteger(something) {
  let value = something

  if (value.startsWith('-')) {
    value = value.slice(1)
  }

  const coerced = Number(value)

  if (!isInteger(coerced) || !_isFinite(coerced)) {
    throw new Error(`"${value}" is not a integer number`)
  }
}

export function evaluate(id) {
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

          if (
            !isGlobal &&
            !(id in variables) &&
            !(id in globalVariables) &&
            !(id in envVariables)
          ) {
            throw new Error(`variable not found: ${id}`)
          }

          const variable =
            !isGlobal && id in variables
              ? variables[id]
              : id in globalVariables
                ? globalVariables[id]
                : envVariables[id]

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

export async function test({ request }, { fetch } = {}) {
  fetch = fetch ?? (await import('node-fetch')).default

  const fetchResponse = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: request.body })
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

  return { request, response }
}

export default {
  process: (src, filename) => {
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
      ${requests
        .filter(request => request.url)
        .map(request => {
          const variables = request.variables

          const interpolate = makeInterpolate({
            env,
            globalVariables,
            variables
          })

          const url = interpolate(request.url)

          const title = request.meta?.name?.value ?? `${request.method} ${url}`

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
                  request: {
                    meta: request.meta,
                    method: request.method,
                    url,
                    headers: request.headers?.map(([k, v]) => [
                      k,
                      interpolate(v)
                    ]),
                    body: request.body
                  }
                },
                null,
                2
              )})

              expect(outcome).toMatchSnapshot()
            })
          `
        })
        .join('')}
      `

    return {
      code
    }
  }
}
