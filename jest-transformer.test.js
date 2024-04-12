import { existsSync, readFileSync } from 'node:fs'
import { afterAll, beforeAll, jest } from '@jest/globals'
import { Headers } from 'node-fetch'
import * as td from 'testdouble'
import transformer, { interpolate, test } from './jest-transformer.js'

describe('interpolate', () => {
  it('nothing to do', () => {
    expect(interpolate(' ')).toMatchInlineSnapshot(`" "`)
    expect(interpolate('')).toMatchInlineSnapshot(`""`)
    expect(interpolate()).toMatchInlineSnapshot(`"undefined"`)
    expect(interpolate(null)).toMatchInlineSnapshot(`"null"`)
    expect(interpolate(undefined)).toMatchInlineSnapshot(`"undefined"`)
  })

  it('environment variables', () => {
    expect(
      interpolate(' {{HostAddress}} ', {
        env: { HostAddress: 'foo' }
      })
    ).toMatchInlineSnapshot(`" foo "`)
  })

  it('global variables can only interpolate with other global variables', () => {
    expect(
      interpolate(' {{foo}} ', {
        globalVariables: {
          foo: { global: true, value: '{{bar}}' }
        },
        variables: {
          bar: { global: false, value: 'baz' }
        }
      })
    ).toMatchInlineSnapshot(`" undefined "`)

    expect(
      interpolate(' {{foo}} ', {
        globalVariables: {
          foo: { global: true, value: '{{bar}}' },
          bar: { global: false, value: 'baz' }
        }
      })
    ).toMatchInlineSnapshot(`" baz "`)
  })

  it('local variables sees global variables', () => {
    expect(
      interpolate(' {{bar}} ', {
        globalVariables: {
          foo: { global: true, value: 'foo' }
        },
        variables: {
          bar: { global: false, value: '{{foo}}' }
        }
      })
    ).toMatchInlineSnapshot(`" foo "`)
  })

  it('regular variables overrides the environment ones', () => {
    expect(
      interpolate(' {{HostAddress}} ', {
        env: { HostAddress: 'foo' },
        variables: { HostAddress: { value: 'bar' } }
      })
    ).toMatchInlineSnapshot(`" bar "`)
  })

  it('$processEnv', () => {
    process.env.FOO = 'bar'
    expect(interpolate(' {{$processEnv FOO}} ')).toMatchInlineSnapshot(
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
      const value = interpolate(`{{$randomInt ${min} ${max}}}`)
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
    expect(interpolate('{{$guid}}')).toMatch(
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
        interpolate(`
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
        interpolate(`
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
      interpolate(' {{foo}} {{bar}} ', {
        variables: {
          bar: { value: 'baz' },
          foo: { value: '{{bar}}' }
        }
      })
    ).toMatchInlineSnapshot(`" baz baz "`)
  })

  it('variables - no direct cycles', () => {
    expect(() =>
      interpolate(' {{self}} ', {
        variables: {
          self: { value: 'self = {{self}}' }
        }
      })
    ).toThrow('variable cycle found: self -> self')
  })

  it('variables - no distant cycles', () => {
    expect(() =>
      interpolate(' {{foo}} ', {
        variables: {
          foo: { value: '{{bar}}' },
          bar: { value: '{{baz}}' },
          baz: { value: '{{foo}}' }
        }
      })
    ).toThrow('variable cycle found: foo -> bar -> baz -> foo')
  })

  it('unknown function', () => {
    expect(() => interpolate(' {{$foo}} ')).toThrow('not implemented: $foo')
  })
})

describe('process', () => {
  it('name request variable', () => {
    expect(
      transformer.process(`
      // @name              foo bar
      GET https://foo/bar
    `)
    ).toStrictEqual({
      code: expect.stringContaining(` test(\"foo bar\",`)
    })
  })

  it('skip request variable', () => {
    expect(
      transformer.process(`
      // @name foo bar
      // @skip
      GET https://foo/bar
    `)
    ).toStrictEqual({
      code: expect.stringContaining(` test.skip(\"foo bar\",`)
    })
  })

  it('only request variable', () => {
    expect(
      transformer.process(`
      // @name foo bar
      // @only
      GET https://foo/bar
    `)
    ).toStrictEqual({
      code: expect.stringContaining(` test.only(\"foo bar\",`)
    })
  })

  it('process without variables from an environment variables file', () => {
    expect(transformer.process('GET https://foo/bar')).toStrictEqual({
      code: expect.stringContaining(` test(\"GET https://foo/bar\",`)
    })
  })

  it('process with local and global variables ', () => {
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

    expect(result).toStrictEqual({
      code: expect.stringContaining(' test("GET https://foo:3000/baz",')
    })

    expect(result).toStrictEqual({
      code: expect.stringContaining(' test("GET https://foo:3000/bar",')
    })
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
    ).toStrictEqual({
      code: expect.stringContaining(' test("GET https://localhost:44320')
    })
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
    ).toStrictEqual({
      code: expect.stringContaining(' test("GET https://127.0.0.1:44320')
    })
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
              ignoreHeaders: 'x-.*'
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
      "ignoreHeaders": "x-.*",
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
