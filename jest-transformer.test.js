import transformer, { interpolate } from './jest-transformer.js'

test('process', () => {
  process.env.NODE_ENV = 'dev'
  expect(
    transformer.process('GET {{HostAddress}}', './tests/sample.http')
  ).toEqual({
    code: expect.stringContaining('https://localhost:44320')
  })
})

test('nothing to do', () => {
  expect(interpolate(' ')).toMatchInlineSnapshot(`" "`)
  expect(interpolate('')).toMatchInlineSnapshot(`""`)
  expect(interpolate()).toMatchInlineSnapshot(`""`)
  expect(interpolate(null)).toMatchInlineSnapshot(`""`)
  expect(interpolate(undefined)).toMatchInlineSnapshot(`""`)
})

test('process environment variables', () => {
  process.env.FOO = 'bar'
  expect(interpolate(' {{$processEnv FOO}} ')).toMatchInlineSnapshot(`" bar "`)
})

test('environment variables', () => {
  process.env.FOO = 'bar'
  expect(
    interpolate(' {{HostAddress}} ', { env: { test: { HostAddress: 'foo' } } })
  ).toMatchInlineSnapshot(`"  "`)
})
