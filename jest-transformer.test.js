import { interpolate } from './jest-transformer.js'

test('interpolation', () => {
  expect(interpolate(' ')).toMatchInlineSnapshot(`" "`)
  expect(interpolate('')).toMatchInlineSnapshot(`""`)
  expect(interpolate()).toMatchInlineSnapshot(`""`)
  expect(interpolate(null)).toMatchInlineSnapshot(`""`)
  expect(interpolate(undefined)).toMatchInlineSnapshot(`""`)
})
