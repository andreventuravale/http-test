import { interpolate } from './jest-transformer.js'

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
    interpolate(' {{HostAddress}} ', { env: { HostAddress: 'foo' } })
  ).toMatchInlineSnapshot(`" foo "`)
})
