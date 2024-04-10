export default source => {
  const lines = source?.split?.(/[\r\n]+/g) ?? []
  return requests(lines)
}

function skip(lines) {
  while (
    lines.length &&
    (/^\s*$/.test(lines[0]) || /^\s*#(?!#).*$/.test(lines[0]))
  ) {
    lines.shift()
  }
}

function parseHeaders(lines) {
  const headers = []
  const regex = /^\s*([\w-]+)\s*:(.*)$/
  skip(lines)
  while (lines.length && regex.test(lines[0])) {
    const [, key, value] = regex.exec(lines.shift())
    headers.push([key.trim(), value.trim()])
    skip(lines)
  }
  return headers.length ? headers : undefined
}

function parseBody(lines) {
  const fragment = []
  const separator = /^\s*###\s*$/
  skip(lines)
  while (lines.length && !separator.test(lines[0])) {
    fragment.push(lines.shift())
  }
  if (lines.length) {
    lines.shift()
  }
  const body = fragment.join('\n').trim()
  return body ? body : undefined
}

function requests(lines) {
  const requests = []

  do {
    skip(lines)

    if (lines.length === 0) {
      break
    }

    console.log(lines[0])

    const methodAndUrlRegex = /^\s*([A-Z]+)\s+(.*)$/

    if (!methodAndUrlRegex.test(lines[0])) {
      throw new Error(`method + url expected but found: ${lines[0].trim()}`)
    }

    const [, method, url] = methodAndUrlRegex.exec(lines.shift())

    const headers = parseHeaders(lines)

    const body = parseBody(lines)

    requests.push({
      method,
      url,
      ...(headers ? { headers } : {}),
      ...(body ? { body } : {})
    })
  } while (lines.length)

  return requests
}
