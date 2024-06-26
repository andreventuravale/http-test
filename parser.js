const {
  lodashEs: { merge, trim }
} = await import('./dependencies.js')

const defaultOptions = {
  meta: {
    expect: { list: true, parse: parseExpect },
    status: { parse: parseStatus },
    ignore: { list: true }
  }
}

function parseExpect({ value }) {
  const pivot = value.indexOf(' ')

  return [value.slice(0, pivot).trim(), JSON.parse(value.slice(pivot).trim())]
}

function parseStatus({ value, ...rest }) {
  const pivot = value.indexOf(' ')

  const code = JSON.parse(
    value.slice(0, pivot < 0 ? value.length : pivot).trim()
  )

  const text = pivot < 0 ? '' : value.slice(pivot + 1).trim()

  return {
    ...rest,
    value: [code, text.length ? JSON.parse(text) : undefined]
  }
}

export const makeParser = (options = {}) => {
  const unifiedOptions = merge(options, defaultOptions)

  return {
    parse
  }

  function isSeparator(source) {
    return /^\s*###\s*$/.test(source.currentLine)
  }

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

  function parse(sourceText) {
    return parseRequests(sourceText)
  }

  function parseBody(source) {
    const fragment = []

    skip(source)

    while (!source.eof && !isSeparator(source)) {
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

    const consumePartial = variables => {
      const partial = {
        ...(variables ? { variables: Object.fromEntries(variables) } : {})
      }

      Object.keys(partial).length && requests.push(partial)
    }

    do {
      const { meta, variables } = parseVariables(source)

      if (source.eof) {
        consumePartial(variables)

        break
      }

      skip(source)

      if (isSeparator(source)) {
        source.consumeLine()

        consumePartial(variables)

        continue
      }

      const { method, url } = parseEndpoint(source)

      const headers = parseHeaders(source)

      let body = parseBody(source)

      const contentType = headers?.find(([k]) => /^content-type$/i.test(k))?.[1]

      if (body && /json/i.test(contentType)) {
        body = JSON.parse(body)
      }

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

    setMeta(source, meta)

    while (!source.eof && regex.test(source.currentLine)) {
      const [, key, value = ''] = regex.exec(source.consumeLine())

      variables.push([
        trim(key.trim(), '@'),
        {
          value: value.trim() || true,
          global: key.startsWith('@@')
        }
      ])

      setMeta(source, meta)
    }

    if (meta?.name?.value && !meta.name.value.match(/^[_a-z][_a-z0-9]*$/i)) {
      throw new Error(
        `(line: ${source.cursor}) invalid request name: ${meta.name.value}`
      )
    }

    return {
      meta,
      ...(variables.length ? { variables } : {})
    }
  }

  function setMeta(source, meta) {
    for (const [name, variable] of skip(source) ?? []) {
      const { list, parse } = unifiedOptions.meta?.[name] ?? {}

      switch (list) {
        case true:
          {
            meta[name] ??= {
              global: false,
              value: []
            }

            meta[name].value.push(parse?.(variable) ?? variable)
          }
          break

        default: {
          meta[name] = parse?.(variable) ?? variable
        }
      }
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

    return meta.length ? meta : undefined

    function fillMeta(line, commentLookahead) {
      const { variables = [] } = parseVariables(
        makeSource(
          line.slice(line.indexOf(commentLookahead) + commentLookahead.length)
        ),
        '\\s+'
      )

      meta = meta.concat(variables)
    }
  }
}

export default (sourceText, finalOptions) =>
  makeParser(finalOptions).parse(sourceText)
