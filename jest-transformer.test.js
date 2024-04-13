import { existsSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, jest } from '@jest/globals'
import { Headers } from 'node-fetch'
import * as td from 'testdouble'
import transformer, { makeInterpolate, test } from './jest-transformer.js'

describe('makeInterpolate', () => {
  it('nothing to do', () => {
    expect(makeInterpolate()(' ')).toMatchInlineSnapshot(`" "`)
    expect(makeInterpolate()('')).toMatchInlineSnapshot(`""`)
    expect(makeInterpolate()()).toMatchInlineSnapshot(`"undefined"`)
    expect(makeInterpolate()(null)).toMatchInlineSnapshot(`"null"`)
    expect(makeInterpolate()(undefined)).toMatchInlineSnapshot(`"undefined"`)
  })

  it('variable not defined', () => {
    expect(() => makeInterpolate()(' {{foo}} ')).toThrow(
      'variable not found: foo'
    )
  })

  it('environment variables', () => {
    expect(
      makeInterpolate({
        env: { HostAddress: 'foo' }
      })(' {{HostAddress}} ')
    ).toMatchInlineSnapshot(`" foo "`)
  })

  it('global variables can only makeInterpolate with other global variables', () => {
    expect(() =>
      makeInterpolate({
        globalVariables: {
          foo: { global: true, value: '{{bar}}' }
        },
        variables: {
          bar: { global: false, value: 'baz' }
        }
      })(' {{foo}} ')
    ).toThrow('variable not found on global scope: bar')

    expect(
      makeInterpolate({
        globalVariables: {
          foo: { global: true, value: '{{bar}}' },
          bar: { global: false, value: 'baz' }
        }
      })(' {{foo}} ')
    ).toMatchInlineSnapshot(`" baz "`)
  })

  it('local variables sees global variables', () => {
    expect(
      makeInterpolate({
        globalVariables: {
          foo: { global: true, value: 'foo' }
        },
        variables: {
          bar: { global: false, value: '{{foo}}' }
        }
      })(' {{bar}} ')
    ).toMatchInlineSnapshot(`" foo "`)
  })

  it('regular variables overrides the environment ones', () => {
    expect(
      makeInterpolate({
        env: { HostAddress: 'foo' },
        variables: { HostAddress: { value: 'bar' } }
      })(' {{HostAddress}} ')
    ).toMatchInlineSnapshot(`" bar "`)
  })

  it('$processEnv', () => {
    process.env.FOO = 'bar'
    expect(makeInterpolate()(' {{$processEnv FOO}} ')).toMatchInlineSnapshot(
      `" bar "`
    )
  })

  it('$randomInt', () => {
    testCase()
    testCase(-10, -1)
    testCase(0, 0)
    testCase(0, 1)
    testCase(10, 20)

    function testCase(min = '', max = '') {
      const value = makeInterpolate()(`{{$randomInt ${min} ${max}}}`)
      const number = Number(value)
      expect(number).toBeGreaterThanOrEqual(
        Number(min || `${Number.MIN_SAFE_INTEGER}`)
      )
      expect(number).toBeLessThanOrEqual(
        Number(max || `${Number.MAX_SAFE_INTEGER}`)
      )
    }
  })

  it('$guid', () => {
    expect(makeInterpolate()('{{$guid}}')).toMatch(
      /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/
    )
  })

  describe('date related', () => {
    beforeAll(() => {
      jest.useFakeTimers()
      jest.setSystemTime(new Date(2020, 3, 1))
    })

    afterAll(() => {
      jest.useRealTimers()
    })

    it('$datetime', () => {
      expect(
        makeInterpolate()(`
        GET https://httpbin.org/headers
        x-custom: {{$datetime "dd-MM-yyyy"}}
        x-iso8601: {{$datetime iso8601}}
        x-rfc1123: {{$datetime rfc1123}}
      `)
      ).toMatchInlineSnapshot(`
"
        GET https://httpbin.org/headers
        x-custom: 01-04-2020
        x-iso8601: 2020-04-01T00:00:00-03:00
        x-rfc1123: Wed, 01 Apr 2020 03:00:00 GMT
      "
`)
    })

    it('$datetime with offsets', () => {
      expect(
        makeInterpolate()(`
        GET https://httpbin.org/headers
        x-custom: {{$datetime "dd-MM-yyyy" 1 d}}
        x-iso8601: {{$datetime iso8601 7 d}}
        x-rfc1123: {{$datetime rfc1123 1 w}}
      `)
      ).toMatchInlineSnapshot(`
"
        GET https://httpbin.org/headers
        x-custom: 02-04-2020
        x-iso8601: 2020-04-08T00:00:00-03:00
        x-rfc1123: Wed, 08 Apr 2020 03:00:00 GMT
      "
`)
    })
  })

  it('variables', () => {
    expect(
      makeInterpolate({
        variables: {
          bar: { value: 'baz' },
          foo: { value: '{{bar}}' }
        }
      })(' {{foo}} {{bar}} ')
    ).toMatchInlineSnapshot(`" baz baz "`)
  })

  it('variables - no direct cycles', () => {
    expect(() =>
      makeInterpolate({
        variables: {
          self: { value: 'self = {{self}}' }
        }
      })(' {{self}} ')
    ).toThrow('variable cycle found: self -> self')
  })

  it('variables - no distant cycles', () => {
    expect(() =>
      makeInterpolate({
        variables: {
          foo: { value: '{{bar}}' },
          bar: { value: '{{baz}}' },
          baz: { value: '{{foo}}' }
        }
      })(' {{foo}} ')
    ).toThrow('variable cycle found: foo -> bar -> baz -> foo')
  })

  it('unknown function', () => {
    expect(() => makeInterpolate()(' {{$foo}} ')).toThrow(
      'not implemented: $foo'
    )
  })
})

describe('process', () => {
  it('name meta variable', () => {
    expect(
      transformer.process(`
      // @name              foo bar
      GET https://foo/bar
    `)
    ).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(` test(\"foo bar\",`)
    }))
  })

  it('skip meta variable', () => {
    expect(
      transformer.process(`
      // @name foo bar
      // @skip
      GET https://foo/bar
    `)
    ).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(` test.skip(\"foo bar\",`)
    }))
  })

  it('only meta variable', () => {
    expect(
      transformer.process(`
      // @name foo bar
      // @only
      GET https://foo/bar
    `)
    ).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(` test.only(\"foo bar\",`)
    }))
  })

  it('process without variables from an environment variables file', () => {
    expect(transformer.process('GET https://foo/bar')).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(` test(\"GET https://foo/bar\",`)
    }))
  })

  it('process with local and global variables', () => {
    const result = transformer.process(`
      @@domain=foo
      @@port=3000
      @@host={{domain}}:{{port}}

      @endpoint=https://{{host}}/bar
      GET {{endpoint}}

      ###

      @endpoint=https://{{host}}/baz
      GET {{endpoint}}
    `)

    expect(result).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(' test("GET https://foo:3000/baz",')
    }))

    expect(result).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(' test("GET https://foo:3000/bar",')
    }))
  })

  it('global variables are hoisted', () => {
    const result = transformer.process(`
      @endpoint=https://{{host}}/bar
      GET {{endpoint}}

      ###

      @endpoint=https://{{host}}/baz
      GET {{endpoint}}

      ###

      @@domain=foo
      @@port=3000
      @@host={{domain}}:{{port}}
    `)

    expect(result).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(' test("GET https://foo:3000/baz",')
    }))

    expect(result).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(' test("GET https://foo:3000/bar",')
    }))

    expect(Array.from(result.code.matchAll(/ test\("/g))).toHaveLength(2)
  })

  it('process interpolates headers', () => {
    const result = transformer.process(`
      @@domain=foo
      @@port=3000
      @@host={{domain}}:{{port}}

      @endpoint=https://{{host}}/bar
      GET {{endpoint}}
      x-origin: {{host}}
    `)

    expect(result.code).toMatch(/"x-origin",\s*"foo:3000"/)
  })

  it('process with variables from an environment variables file', () => {
    expect(existsSync('./tests/http-client.env.json')).toStrictEqual(true)

    expect(
      JSON.parse(readFileSync('./tests/http-client.env.json', 'utf-8'))
    ).toMatchInlineSnapshot(`
{
  "dev": {
    "HostAddress": "https://localhost:44320",
  },
  "remote": {
    "HostAddress": "https://contoso.com",
  },
}
`)

    process.env.NODE_ENV = 'dev'

    expect(
      transformer.process('GET {{HostAddress}}', './tests/sample.http')
    ).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(' test("GET https://localhost:44320')
    }))
  })

  it('process with variables from an environment variables file combined with a user-specific file', () => {
    expect(
      existsSync('./tests/user-specific-env-file/http-client.env.json')
    ).toStrictEqual(true)

    expect(
      existsSync('./tests/user-specific-env-file/http-client.env.json.user')
    ).toStrictEqual(true)

    expect(
      JSON.parse(
        readFileSync(
          './tests/user-specific-env-file/http-client.env.json',
          'utf-8'
        )
      )
    ).toMatchInlineSnapshot(`
{
  "dev": {
    "Domain": "localhost",
    "Port": 44320,
  },
}
`)

    expect(
      JSON.parse(
        readFileSync(
          './tests/user-specific-env-file/http-client.env.json.user',
          'utf-8'
        )
      )
    ).toMatchInlineSnapshot(`
{
  "dev": {
    "Domain": "127.0.0.1",
  },
}
`)

    process.env.NODE_ENV = 'dev'

    expect(
      transformer.process(
        'GET https://{{Domain}}:{{Port}}',
        './tests/user-specific-env-file/sample.http'
      )
    ).toStrictEqual(expect.objectContaining({
      code: expect.stringContaining(' test("GET https://127.0.0.1:44320')
    }))
  })
})

describe('test', () => {
  it('ignore some headers', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'GET' }))
    ).thenResolve({
      headers: new Headers({
        age: new Date().toISOString(),
        'content-type': 'text/',
        date: new Date().toISOString(),
        'x-foo': 'bar'
      }),
      text: async () => 'foo'
    })

    expect(
      await test(
        {
          request: {
            meta: {
              ignoreHeaders: { value: '^x-.*' }
            },
            method: 'GET',
            url: 'http://foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "meta": {
      "ignoreHeaders": {
        "value": "^x-.*",
      },
    },
    "method": "GET",
    "url": "http://foo",
  },
  "response": {
    "body": "foo",
    "headers": [
      [
        "age",
        Anything,
      ],
      [
        "content-type",
        "text/",
      ],
      [
        "date",
        Anything,
      ],
      [
        "x-foo",
        Anything,
      ],
    ],
  },
}
`)
  })

  it('text', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'GET' }))
    ).thenResolve({
      headers: new Headers({
        'content-type': 'text/'
      }),
      text: async () => 'foo'
    })

    expect(
      await test(
        {
          request: {
            method: 'GET',
            url: 'http://foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "method": "GET",
    "url": "http://foo",
  },
  "response": {
    "body": "foo",
    "headers": [
      [
        "content-type",
        "text/",
      ],
    ],
  },
}
`)
  })

  it('json', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'GET' }))
    ).thenResolve({
      headers: new Headers({
        'content-type': 'something/that-contains-json'
      }),
      text: async () => JSON.stringify({ foo: 'bar' })
    })

    expect(
      await test(
        {
          request: {
            method: 'GET',
            url: 'http://foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "method": "GET",
    "url": "http://foo",
  },
  "response": {
    "body": {
      "foo": "bar",
    },
    "headers": [
      [
        "content-type",
        "something/that-contains-json",
      ],
    ],
  },
}
`)
  })

  it('json - no content', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'GET' }))
    ).thenResolve({
      headers: new Headers({
        'content-type': 'something/that-contains-json'
      }),
      text: async () => ''
    })

    expect(
      await test(
        {
          request: {
            method: 'GET',
            url: 'http://foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "method": "GET",
    "url": "http://foo",
  },
  "response": {
    "body": null,
    "headers": [
      [
        "content-type",
        "something/that-contains-json",
      ],
    ],
  },
}
`)
  })

  it('binary', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'GET' }))
    ).thenResolve({
      headers: new Headers({
        'content-type': 'something/else'
      }),
      buffer: async () => Buffer.from('the lazy fox jumped over the brown dog')
    })

    expect(
      await test(
        {
          request: {
            method: 'GET',
            url: 'http://foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "method": "GET",
    "url": "http://foo",
  },
  "response": {
    "body": "746865206c617a7920666f78206a756d706564206f766572207468652062726f776e20646f67",
    "headers": [
      [
        "content-type",
        "something/else",
      ],
    ],
  },
}
`)
  })

  it('HEAD', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'HEAD' }))
    ).thenResolve({
      headers: new Headers({
        'content-type': 'text/'
      }),
      text: async () => 'foo'
    })

    expect(
      await test(
        {
          request: {
            method: 'HEAD',
            url: 'http://foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "method": "HEAD",
    "url": "http://foo",
  },
  "response": {
    "body": "foo",
    "headers": [
      [
        "content-type",
        "text/",
      ],
    ],
  },
}
`)
  })

  it('POST', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'POST' }))
    ).thenResolve({
      headers: new Headers({
        'content-type': 'text/'
      }),
      text: async () => 'foo'
    })

    expect(
      await test(
        {
          request: {
            method: 'POST',
            url: 'http://foo',
            body: 'foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "body": "foo",
    "method": "POST",
    "url": "http://foo",
  },
  "response": {
    "body": "foo",
    "headers": [
      [
        "content-type",
        "text/",
      ],
    ],
  },
}
`)
  })

  it('POST without body', async () => {
    const fetch = td.func('fetch')

    td.when(
      await fetch('http://foo', td.matchers.contains({ method: 'POST' }))
    ).thenResolve({
      headers: new Headers({
        'content-type': 'text/'
      }),
      text: async () => 'foo'
    })

    expect(
      await test(
        {
          request: {
            method: 'POST',
            url: 'http://foo'
          }
        },
        { fetch }
      )
    ).toMatchInlineSnapshot(`
{
  "request": {
    "method": "POST",
    "url": "http://foo",
  },
  "response": {
    "body": "foo",
    "headers": [
      [
        "content-type",
        "text/",
      ],
    ],
  },
}
`)
  })
})
