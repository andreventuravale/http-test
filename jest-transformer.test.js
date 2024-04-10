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
    expect(transformer.process('GET https://foo/bar')).toEqual({
      code: expect.stringContaining(` test('GET https://foo/bar',`)
    })
  })

  it('process with variables from an environment variables file', () => {
    expect(existsSync('./tests/http-client.env.json')).toEqual(true)

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
    ).toEqual({
      code: expect.stringContaining('https://localhost:44320')
    })
  })
})

describe('test', () => {
  it('test', async () => {
    expect(await test({
  request: {
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/todos/1'
  }


})).toMatchInlineSnapshot(`
{
  "request": {
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
  "response": {
    "body": {
      "completed": false,
      "id": 1,
      "title": "delectus aut autem",
      "userId": 1,
    },
    "headers": [
      [
        "access-control-allow-credentials",
        "true",
      ],
      [
        "age",
        "19360",
      ],
      [
        "alt-svc",
        "h3=":443"; ma=86400",
      ],
      [
        "cache-control",
        "max-age=43200",
      ],
      [
        "cf-cache-status",
        "HIT",
      ],
      [
        "cf-ray",
        "872434648806b3b6-MIA",
      ],
      [
        "connection",
        "keep-alive",
      ],
      [
        "content-encoding",
        "br",
      ],
      [
        "content-type",
        "application/json; charset=utf-8",
      ],
      [
        "date",
        "Wed, 10 Apr 2024 16:44:58 GMT",
      ],
      [
        "etag",
        "W/"53-hfEnumeNh6YirfjyjaujcOPPT+s"",
      ],
      [
        "expires",
        "-1",
      ],
      [
        "nel",
        "{"report_to":"heroku-nel","max_age":3600,"success_fraction":0.005,"failure_fraction":0.05,"response_headers":["Via"]}",
      ],
      [
        "pragma",
        "no-cache",
      ],
      [
        "report-to",
        "{"group":"heroku-nel","max_age":3600,"endpoints":[{"url":"https://nel.heroku.com/reports?ts=1710266343&sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d&s=9prrD19AHq6aUZkKfuUlUyUVjun1QShk6YUtAdGQ%2BRE%3D"}]}",
      ],
      [
        "reporting-endpoints",
        "heroku-nel=https://nel.heroku.com/reports?ts=1710266343&sid=e11707d5-02a7-43ef-b45e-2cf4d2036f7d&s=9prrD19AHq6aUZkKfuUlUyUVjun1QShk6YUtAdGQ%2BRE%3D",
      ],
      [
        "server",
        "cloudflare",
      ],
      [
        "transfer-encoding",
        "chunked",
      ],
      [
        "vary",
        "Origin, Accept-Encoding",
      ],
      [
        "via",
        "1.1 vegur",
      ],
      [
        "x-content-type-options",
        "nosniff",
      ],
      [
        "x-powered-by",
        "Express",
      ],
      [
        "x-ratelimit-limit",
        "1000",
      ],
      [
        "x-ratelimit-remaining",
        "999",
      ],
      [
        "x-ratelimit-reset",
        "1710266364",
      ],
    ],
  },
}
`)
  })
})
