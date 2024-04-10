import { existsSync, readFileSync } from 'node:fs'
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
    process.env.FOO = 'bar'
    expect(
      interpolate(' {{HostAddress}} ', {
        env: { test: { HostAddress: 'foo' } }
      })
    ).toMatchInlineSnapshot(`" foo "`)
  })

  it('$processEnv', () => {
    process.env.FOO = 'bar'
    expect(interpolate(' {{$processEnv FOO}} ')).toMatchInlineSnapshot(
      `" bar "`
    )
  })

  it('unknown function', () => {
    expect(() => interpolate(' {{$foo}} ')).toThrow('not implemented: $foo')
  })
})

describe('process', () => {
  it('process without variables from an environment variables file', () => {
    expect(transformer.process('GET https://foo/bar')).toStrictEqual({
      code: expect.stringContaining(` test('GET https://foo/bar',`)
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
  it('GET', async () => {
    expect(
      await test({
        request: {
          method: 'GET',
          url: 'https://jsonplaceholder.typicode.com/todos/1'
        }
      })
    ).toStrictEqual({
      request: {
        method: 'GET',
        url: 'https://jsonplaceholder.typicode.com/todos/1'
      },
      response: expect.any(Object)
    })
  })

  it('HEAD', async () => {
    expect(
      await test({
        request: {
          method: 'HEAD',
          url: 'https://jsonplaceholder.typicode.com/todos/1'
        }
      })
    ).toStrictEqual({
      request: {
        method: 'HEAD',
        url: 'https://jsonplaceholder.typicode.com/todos/1'
      },
      response: expect.any(Object)
    })
  })

  it('POST', async () => {
    expect(
      await test({
        request: {
          method: 'POST',
          url: 'https://jsonplaceholder.typicode.com/todos/1',
          body: JSON.stringify({
            title: 'foo',
            body: 'bar',
            userId: 1
          })
        }
      })
    ).toStrictEqual({
      request: {
        body: '{"title":"foo","body":"bar","userId":1}',
        method: 'POST',
        url: 'https://jsonplaceholder.typicode.com/todos/1'
      },
      response: expect.any(Object)
    })
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
