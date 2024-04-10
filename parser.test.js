import parser from './parser.js'

test('empty inputs', () => {
  expect(parser()).toMatchInlineSnapshot('[]')
  expect(parser(null)).toMatchInlineSnapshot('[]')
  expect(parser(' \r \n \t \f \v ')).toMatchInlineSnapshot('[]')
})

test('basics', () => {
  const results = parser(`
    GET https://jsonplaceholder.typicode.com/todos/1
  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})

test('with a single header', () => {
  const results = parser(`
    GET https://jsonplaceholder.typicode.com/todos/1
    content-type: application/json
  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "headers": [
      [
        "content-type",
        "application/json",
      ],
    ],
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})

test('with many headers', () => {
  const results = parser(`
    GET https://jsonplaceholder.typicode.com/todos/1
    content-type: application/json
    x-foo: bar
  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "headers": [
      [
        "content-type",
        "application/json",
      ],
      [
        "x-foo",
        "bar",
      ],
    ],
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})

test('with duplicated headers', () => {
  const results = parser(`
    GET https://jsonplaceholder.typicode.com/todos/1
    content-type: application/json
    x-foo: bar
    x-foo: baz
  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "headers": [
      [
        "content-type",
        "application/json",
      ],
      [
        "x-foo",
        "bar",
      ],
      [
        "x-foo",
        "baz",
      ],
    ],
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})

test('many requests', () => {
  const results = parser(`
    GET https://jsonplaceholder.typicode.com/todos/1
    ###
    POST https://jsonplaceholder.typicode.com/todos/1
    {}
    ###
    PATCH https://jsonplaceholder.typicode.com/todos/1
    x-foo: bar
    {}
  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
  {
    "body": "{}",
    "method": "POST",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
  {
    "body": "{}",
    "headers": [
      [
        "x-foo",
        "bar",
      ],
    ],
    "method": "PATCH",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})

test('body is trimmed only at the ends', () => {
  const results = parser(`
    GET https://jsonplaceholder.typicode.com/todos/1
    x-foo: bar

    \r \n \t \f \v

    \r \n \t \f \v foo     bar \r \n \t \f \v

    \r \n \t \f \v

  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "body": "foo     bar",
    "headers": [
      [
        "x-foo",
        "bar",
      ],
    ],
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})
