export default source => {
  const lines = source.split(/[\r\n]+/g)
  return requests(lines)
}

function skipWs(lines) {
  while (lines.length && /^\s*$/.test(lines[0])) {
    lines.shift()
  }
}

function skipComments(lines) {
  while (lines.length && /^\s*#.*$/.test(lines[0])) {
    lines.shift()
  }
}

function parseHeaders(lines) {
  const headers = []
  const regex = /^\s*([\w-]+)\s*:\s+(.*)\s*$/
  while (lines.length && regex.test(lines[0])) {
    const [, key, value] = regex.exec(lines.shift())
    headers.push([key, value])
  }
  return headers.length ? headers : undefined
}

function parseBody(lines) {
  const fragment = []
  const separator = /^\s*###\s*$/
  while (lines.length && !separator.test(lines[0])) {
    fragment.push(lines.shift())
  }
  const body = fragment.join('\n').trim()
  return body ? body : undefined
}

function requests(lines) {
  const requests = []

  do {
    skipWs(lines)

    skipComments(lines)

    const methodAndUrlRegex = /^\s*([A-Z]+)\s+(.*)$/

    if (!methodAndUrlRegex.test(lines[0])) {
      throw new Error(`method + url expected but found: ${lines[0]}`)
    }

    const [, method, url] = methodAndUrlRegex.exec(lines.shift())

    const body = parseBody(lines)

    const headers = parseHeaders(lines)

    requests.push({
      method,
      url,
      ...(headers ? { headers } : {}),
      ...(body ? { body } : {})
    })
  } while (lines.length)

  return requests
}
