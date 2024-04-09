
export default (inputText) => {
  const lines = inputText.split(/[\r\n]+/g)
  return requests(lines)
}

function ws(lines) {
  while (lines.length && /^\s*$/.test(lines[0])) {
    lines.shift()
  }
}

function comments(lines) {
  while (lines.length && /^\s*#.*$/.test(lines[0])) {
    lines.shift()
  }
}

function headers(lines) {
  const list = []
  const regex = /^\s*([\w-]+)\s*:\s+(.*)\s*$/
  while (lines.length && regex.test(lines[0])) {
    const [, key, value] = regex.exec(lines.shift())
    list.push([key, value])
  }
  return list
}

function body(lines) {
  const fragment = []
  const separator = /^\s*###\s*$/
  while (lines.length && !separator.test(lines[0])) {
    fragment.push(lines.shift())
  }
  return fragment.join('\n').trim()
}

function requests(lines) {
  const requests = []

  do {
    ws(lines)

    comments(lines)

    const methodAndUrlRegex = /^\s*([A-Z]+)\s+(.*)$/

    if (!methodAndUrlRegex.test(lines[0])) {
      throw new Error(`method + url expected but found: ${lines[0]}`)
    }

    const [, method, url] = methodAndUrlRegex.exec(lines.shift())

    requests.push({ method, url, headers: headers(lines), body: body(lines) })
  } while (lines.length)

  return requests
}
