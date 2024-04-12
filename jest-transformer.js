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

export function interpolate(text, { env = {}, variables = {} } = {}) {
  const context = { env, variables }

  function visit(text, path) {
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

        const value = variables[id]?.value ?? env[id]

        segments.push(visit(value, [...path, id]))
      }

      segments.push(start.slice(endIndex + 2))
    }

    return segments.join('')
  }

  return visit(text, [])
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
      request.meta?.ignoreHeaders && new RegExp(request.meta.ignoreHeaders)
  } catch (e) {
    console.error(e)

    throw e
  }

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

    return {
      code: `
      ${requests
        .map(request => {
          const variables = request.variables

          const url = interpolate(request.url, { env, variables })

          const title = request.meta?.name?.value ?? `${request.method} ${url}`

          return `
            /**
             * ${filename}
             */
            test${
              request.meta?.only ? '.only' : request.meta?.skip ? '.skip' : ''
            }(${JSON.stringify(title)}, async () => {
              const outcome = await (${test.toString()})(${JSON.stringify(
                { env, request: { ...request, url } },
                null,
                2
              )})

              expect(outcome).toMatchSnapshot()
            })
          `
        })
        .join('')}
        `
    }
  }
}
