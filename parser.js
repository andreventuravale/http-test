import { trim } from 'lodash-es'

export default sourceText => parseRequests(sourceText)

function makeSource(sourceText) {
  const lines = sourceText?.split?.(/[\r\n]+/g) ?? []

  let cursor = 1

  return {
    get currentLine() {
      return lines[0]?.trim()
    },

    get cursor() {
      return cursor
    },

    get eof() {
      return lines.length === 0
    },

    consumeLine() {
      cursor++

      return lines.shift().trim()
    }
  }
}

function parseBody(source) {
  const fragment = []

  const separator = /^\s*###\s*$/

  skip(source)

  while (!source.eof && !separator.test(source.currentLine)) {
    fragment.push(source.consumeLine())
  }

  if (!source.eof) {
    source.consumeLine()
  }

  const body = fragment.join('\n').trim()

  return body ? body : undefined
}

function parseEndpoint(source) {
  const regex = /^\s*([A-Z]+)\s+([^\r\n]*)$/

  if (!regex.test(source.currentLine)) {
    throw new Error(
      `(line: ${source.cursor}) method + url expected but found: ${source.currentLine}`
    )
  }

  const [, method, url] = regex.exec(source.consumeLine())

  return { method, url }
}

function parseHeaders(source) {
  const headers = []

  const regex = /^\s*([\w-]+)\s*:(.*)$/

  skip(source)

  while (!source.eof && regex.test(source.currentLine)) {
    const [, key, value] = regex.exec(source.consumeLine())

    headers.push([key.trim(), value.trim()])

    skip(source)
  }

  return headers.length ? headers : undefined
}

function parseRequests(sourceText) {
  const source = makeSource(sourceText)

  const requests = []

  do {
    const { meta, variables } = parseVariables(source)

    if (source.eof) {
      const partial = {
        ...(variables ? { variables: Object.fromEntries(variables) } : {}),
        ...(Object.keys(meta).length ? { meta } : {})
      }

      Object.keys(partial).length && requests.push(partial)

      break
    }

    const { method, url } = parseEndpoint(source)

    const headers = parseHeaders(source)

    const body = parseBody(source)

    requests.push({
      method,
      url,
      ...(headers ? { headers } : {}),
      ...(body ? { body } : {}),
      ...(variables ? { variables: Object.fromEntries(variables) } : {}),
      ...(Object.keys(meta).length ? { meta } : {})
    })
  } while (!source.eof)

  return requests
}

function parseVariables(source, separatorRegexPattern = '=') {
  const meta = {}

  const variables = []

  const regex = new RegExp(
    `^\\s*(@@?[a-z_][\\w]+)(?:${separatorRegexPattern}(.*))?$`,
    'i'
  )

  Object.assign(meta, skip(source))

  while (!source.eof && regex.test(source.currentLine)) {
    const [, key, value = ''] = regex.exec(source.consumeLine())

    variables.push([
      trim(key.trim(), '@'),
      {
        value: value.trim() || true,
        global: key.startsWith('@@')
      }
    ])

    Object.assign(meta, skip(source))
  }

  return {
    meta,
    ...(variables.length ? { variables } : {})
  }
}

function skip(source) {
  let meta = []

  while (!source.eof) {
    if (/^\s*$/.test(source.currentLine)) {
      source.consumeLine()
    } else if (/^\s*#(?!#).*$/.test(source.currentLine)) {
      fillMeta(source.consumeLine(), '#')
    } else if (/^\s*\/\/.*$/.test(source.currentLine)) {
      fillMeta(source.consumeLine(), '//')
    } else {
      break
    }
  }

  return meta.length ? Object.fromEntries(meta) : undefined

  function fillMeta(line, commentLookahead) {
    const { variables } = parseVariables(
      makeSource(
        line.slice(line.indexOf(commentLookahead) + commentLookahead.length)
      ),
      '\\s+'
    )

    meta = meta.concat(variables ?? [])
  }
}
