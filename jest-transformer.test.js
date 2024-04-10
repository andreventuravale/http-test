import { existsSync, readFileSync } from 'node:fs'
import { Headers } from 'node-fetch'
import * as td from 'testdouble'
import transformer, { interpolate, test } from './jest-transformer.js'

describe('interpolate', () => {
  it('nothing to do', () => {
    expect(interpolate(' ')).toMatchInlineSnapshot(`" "`)
    expect(interpolate('')).toMatchInlineSnapshot(`""`)
    expect(interpolate()).toMatchInlineSnapshot(`""`)
    expect(interpolate(null)).toMatchInlineSnapshot(`""`)
    expect(interpolate(undefined)).toMatchInlineSnapshot(`""`)
  })

  it('environment variables', () => {
    expect(
      interpolate(' {{HostAddress}} ', {
        env: { HostAddress: 'foo' }
      })
    ).toMatchInlineSnapshot(`" foo "`)
  })

  it('$processEnv', () => {
    process.env.FOO = 'bar'
    expect(interpolate(' {{$processEnv FOO}} ')).toMatchInlineSnapshot(
      `" bar "`
    )
  })

  it('$randomInt', () => {
    testCase(-10, -1)
    testCase(0, 0)
    testCase(0, 1)
    testCase(10, 20)

    function testCase(min, max) {
      const number = Number(interpolate(`{{$randomInt ${min} ${max}}}`))
      expect(number).toBeGreaterThanOrEqual(min)
      expect(number).toBeLessThanOrEqual(max)
    }
  })

  it('$randomInt - invalid values', () => {
    expect(() => interpolate('{{$randomInt a}}')).toThrow(
      '"a" is not a integer number'
    )
    expect(() => interpolate('{{$randomInt 1 b}}')).toThrow(
      '"b" is not a integer number'
    )
  })

  it('variables', () => {
    expect(
      interpolate(' {{foo}} {{bar}} ', {
        variables: {
          bar: 'baz',
          foo: '{{bar}}'
        }
      })
    ).toMatchInlineSnapshot(`" baz baz "`)
  })

  it('variables - no direct cycles', () => {
    expect(() =>
      interpolate(' {{self}} ', {
        variables: {
          self: 'self = {{self}}'
        }
      })
    ).toThrow('variable cycle found: self -> self')
  })

  it('variables - no distant cycles', () => {
    expect(() =>
      interpolate(' {{foo}} ', {
        variables: {
          foo: '{{bar}}',
          bar: '{{baz}}',
          baz: '{{foo}}'
        }
      })
    ).toThrow('variable cycle found: foo -> bar -> baz -> foo')
  })

  it('unknown function', () => {
    expect(() => interpolate(' {{$foo}} ')).toThrow('not implemented: $foo')
  })
})

describe('process', () => {
  it('uses the test name if present', () => {
    expect(
      transformer.process(`
      // @name foo bar
      GET https://foo/bar
    `)
    ).toStrictEqual({
      code: expect.stringContaining(` test(\"foo bar\",`)
    })
  })

  it('process without variables from an environment variables file', () => {
    expect(transformer.process('GET https://foo/bar')).toStrictEqual({
      code: expect.stringContaining(` test(\"GET https://foo/bar\",`)
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
      code: expect.stringContaining('https://localhost:44320')
    })
  })
})

describe('test', () => {
  it.only('GET text', async () => {
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

  it.only('HEAD text', async () => {
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

  it.only('POST', async () => {
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
    expect(
      await test({
        request: {
          method: 'POST',
          url: 'https://jsonplaceholder.typicode.com/todos/1'
        }
      })
    ).toStrictEqual({
      request: {
        method: 'POST',
        url: 'https://jsonplaceholder.typicode.com/todos/1'
      },
      response: expect.any(Object)
    })
  })
})
