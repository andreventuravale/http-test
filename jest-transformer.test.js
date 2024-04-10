import { interpolate } from './jest-transformer.js'

test('interpolation', () => {
  expect(interpolate(' ')).toMatchInlineSnapshot(`" "`)
  expect(interpolate('')).toMatchInlineSnapshot(`""`)
  expect(interpolate()).toMatchInlineSnapshot(`""`)
  expect(interpolate(null)).toMatchInlineSnapshot(`""`)
  expect(interpolate(undefined)).toMatchInlineSnapshot(`""`)
  process.env.FOO = 'bar'
  expect(interpolate(' {{$processEnv FOO}} ')).toMatchInlineSnapshot(`" bar "`)
})
