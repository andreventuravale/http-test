import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { isFinite as _isFinite, isInteger } from 'lodash-es'
import fetch from 'node-fetch'
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
  const [fn, ...args] = id.slice(1).split(/\s+/)

  switch (fn) {
    case 'processEnv':
      return processEnv()
    case 'randomInt':
      return randomInt()
    default:
      throw new Error(`not implemented: $${fn}`)
  }

  function processEnv() {
    return process.env[args[0]]
  }

  function randomInt() {
    let [min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER] = args
    assertInteger(min)
    assertInteger(max)
    min = Number(min)
    max = Number(max)
    const delta = Number(max) - Number(min)
    const rnd = Math.trunc(delta * Math.random())
    return min + rnd
  }
}

export function interpolate(text, { env = {}, variables = {} } = {}) {
  const context = { env, variables }

  function visit(text, path) {
    const brokenAtStart = text?.split('{{') ?? []

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

        const value = variables[id] ?? env[id]

        segments.push(visit(value, [...path, id]))
      }

      segments.push(start.slice(endIndex + 2))
    }

    return segments.join('')
  }

  return visit(text, [])
}

export async function test({ request }) {
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
    responseBody = Buffer.from(await fetchResponse.arrayBuffer()).toString(
      'hex'
    )
  }

  const response = {
    headers: Array.from(fetchResponse.headers),
    body: responseBody
  }

  const ignoreHeader = ['age', 'date', ...(request.meta?.ignoreHeader ?? [])]

  for (const header of response.headers) {
    if (ignoreHeader.includes(header[0])) {
      header[1] = expect.anything()
    }
  }

  return { request, response }
}

export default {
  process: (src, filename) => {
    const requests = parse(src)

    const envPath = join(
      dirname(filename ?? 'a1c63c96-ad67-4546-8a78-66b9805f10e2/file.http'),
      'http-client.env.json'
    )

    const envs = existsSync(envPath)
      ? JSON.parse(readFileSync(envPath, 'utf-8'))
      : {}

    const env = envs[process.env.NODE_ENV]

    return {
      code: `
      ${requests
        .map(request => {
          const variables = request.variables

          const url = interpolate(request.url, { env, variables })

          const title = request.meta?.name?.[0] ?? `${request.method} ${url}`

          return `
            /**
             * ${filename}
             */
            test(${JSON.stringify(title)}, async () => {
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
