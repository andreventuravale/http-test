export default source => parseRequests(source)

function makeSource(text) {
  const lines = text?.split?.(/[\r\n]+/g) ?? []

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
    const meta = skip(source)

    if (source.eof) {
      break
    }

    const variables = parseVariables(source)

    const { method, url } = parseEndpoint(source)

    const headers = parseHeaders(source)

    const body = parseBody(source)

    requests.push({
      method,
      url,
      ...(headers ? { headers } : {}),
      ...(body ? { body } : {}),
      ...(variables ? { variables: Object.fromEntries(variables) } : {}),
      ...(meta ? { meta } : {})
    })
  } while (!source.eof)

  return requests
}

function parseVariables(source, separatorRegexPattern = '=') {
  const variables = []

  const regex = new RegExp(
    `^\\s*@([a-z_][\\w]+)(?:${separatorRegexPattern}(.*))?$`,
    'i'
  )

  skip(source)

  while (!source.eof && regex.test(source.currentLine)) {
    const [, key, value = ''] = regex.exec(source.consumeLine())

    variables.push([key.trim(), value.trim() || true])

    skip(source)
  }

  return variables.length ? variables : undefined
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
    const variables = parseVariables(
      makeSource(
        line.slice(line.indexOf(commentLookahead) + commentLookahead.length)
      ),
      '\\s+'
    )

    meta = meta.concat(variables ?? [])
  }
}
