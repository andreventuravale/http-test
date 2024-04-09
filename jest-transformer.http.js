#!/usr/bin/env -S node --no-warnings
import { randomUUID } from 'crypto'
import fetch from 'node-fetch'
import parse from './parser.js'

function interpolate(text) {
  const brokenAtStart = text.split('{{')
  let variables = []
  let spans = [brokenAtStart.shift()]
  for (const start of brokenAtStart) {
    const endIndex = start.indexOf('}}')
    const id = start.slice(0, endIndex)
    variables.push(id)
    if (id[0] === '$') {
      spans.push(evaluate(id))
    }
    spans.push(start.slice(endIndex + 2))
  }
  return spans.join('')
}

function evaluate(id) {
  const [fn, ...args] = id.slice(1).split(/\s+/)
  switch (fn) {
    case 'processEnv': {
      return process.env[args[0]]
    }
    default:
      throw new Error(`not implemented: ${fn}`)
  }
}

async function test({ request, url }) {
  const response = await fetch(url, {
    method: request.method,
    headers: request.headers,
    ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: request.body })
  })

  let body

  const contentType = response.headers.get('content-type')

  if (contentType.startsWith('text/')) {
    body = await response.text()
  } else if (contentType.indexOf('json') > -1) {
    body = await response.json()
  } else {
    body = Buffer.from(await response.arrayBuffer()).toString('hex')
  }

  return {
    method: request.method,
    url,
    headers: Array.from(response.headers),
    body
  }
}

export default {
  getCacheKey(...args) {
    // console.log(args)

    return randomUUID()
  },

  process: (src, filename) => {
    const requests = parse(src)

    return {
      code: `
      ${requests.map((request) => {
        const url = interpolate(request.url)

        return `
          /**
           * ${filename}
           */
          test('${request.method} ${url}', async () => {
            const outcome = await (${test.toString()})(${JSON.stringify({ request, url }, null, 2)})

            expect(outcome).toMatchSnapshot()
          })
        `
      }).join('')
        }
    `
    }
  }
}