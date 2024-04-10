export default source => parseRequests(source)

function skip(source) {
  while (
    !source.eof &&
    (/^\s*$/.test(source.currentLine) ||
      /^\s*#(?!#).*$/.test(source.currentLine) ||
      /^\s*\/\/.*$/.test(source.currentLine))
  ) {
    source.consumeLine()
  }
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

      return lines.shift()
    }
  }
}

function parseEndpoint(source) {
  const methodAndUrlRegex = /^\s*([A-Z]+)\s+([^\r\n]*)$/

  if (!methodAndUrlRegex.test(source.currentLine)) {
    throw new Error(
      `(line: ${source.cursor}) method + url expected but found: ${source.currentLine}`
    )
  }

  const [, method, url] = methodAndUrlRegex.exec(source.consumeLine())

  return { method, url }
}

function parseVariables(source) {
  let flag = false
  const variables = {}
  const regex = /^\s*@([a-z_][\w]+)=(.*)$/i
  skip(source)
  while (!source.eof && regex.test(source.currentLine)) {
    const [, key, value] = regex.exec(source.consumeLine())
    variables[key.trim()] = value.trim()
    flag = true
    skip(source)
  }
  return flag ? variables : undefined
}

function parseRequests(sourceText) {
  const source = makeSource(sourceText)

  const requests = []

  do {
    skip(source)

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
      ...(variables ? { variables } : {})
    })
  } while (!source.eof)

  return requests
}
