import parser from './parser.js'

test('results', () => {
  const results = parser(`
    # test
    GET https://jsonplaceholder.typicode.com/todos/1
    content-type: application/json    
  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "headers": [
      [
        "content-type",
        "application/json    ",
      ],
    ],
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})
