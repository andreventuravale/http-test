#!/usr/bin/env -S node --no-warnings
import { globby } from 'globby'
import fetch from 'node-fetch'
import { readFile } from 'node:fs/promises'
import parse from './parser.js'
import { inspect } from 'node:util'

const files = await globby(['**/*.http'], {
  cwd: process.pwd
})

for (const file of files) {
  const content = await readFile(file, 'utf-8')

  const requests = await parse(content)

  for (const request of requests) {
    const url = interpolate(request.url)

    console.log(request.method, url)

    const response = await fetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })

    console.log(response.status, response.statusText)
    console.log('Headers:')
    console.table(Array.from(response.headers).map(([k, v]) => ({ name: k, value: v })), ['name', 'value'])
    const ct = response.headers.get('content-type')
    if (ct.startsWith('text/')) {
      console.log(await response.text())
    } else if (ct.indexOf('json') > -1) {
      console.log(inspect(await response.json(), false, null, true))
    } else {
      console.log(Buffer.from(await response.arrayBuffer()).toString('hex'))
    }

    console.log()
  }
}

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
