import parser from './parser.js'

test('invalid inputs', () => {
  expect(() => parser('foo bar')).toThrow(
    '(line: 1) method + url expected but found: foo bar'
  )
})

test('invalid inputs ignoring comments and whitespace', () => {
  expect(() =>
    parser(`

    \r \n \t \f \v

    \r \n \t \f \v # foo \r \n \t \f \v

    \r \n \t \f \v

    GET https://jsonplaceholder.typicode.com/todos/1

    ###

    foo bar
  `)
  ).toThrow('(line: 15) method + url expected but found: foo bar')
})

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
    "method": undefined,
    "url": undefined,
  },
]
`)
})

test('white space and comments are ignored', () => {
  const results = parser(`

    \r \n \t \f \v

    \r \n \t \f \v # foo \r \n \t \f \v

    \r \n \t \f \v

    GET https://jsonplaceholder.typicode.com/todos/1

    \r \n \t \f \v

    \r \n \t \f \v #  bar \r \n \t \f \v

    \r \n \t \f \v

    POST https://jsonplaceholder.typicode.com/todos/1

    \r \n \t \f \v

    \r \n \t \f \v #   baz \r \n \t \f \v

    \r \n \t \f \v

  `)

  expect(results).toMatchInlineSnapshot(`
[
  {
    "body": "POST https://jsonplaceholder.typicode.com/todos/1
    
 
 	  
    
 
 	   #   baz",
    "method": undefined,
    "url": undefined,
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
    "method": undefined,
    "url": undefined,
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
    "method": undefined,
    "url": undefined,
  },
]
`)
})

test('headers are trimmed at both ends ( keys and values )', () => {
  const results = parser(`
    GET https://jsonplaceholder.typicode.com/todos/1

    \t \f \v content-type \t \f \v : \t \f \v application/json \t \f \v

    \t \f \v x-foo \t \f \v : \t \f \v bar \t \f \v
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
    "method": undefined,
    "url": undefined,
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
    "method": undefined,
    "url": undefined,
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
    "method": undefined,
    "url": undefined,
  },
  {
    "body": "{}",
    "method": undefined,
    "url": undefined,
  },
  {
    "body": "{}",
    "headers": [
      [
        "x-foo",
        "bar",
      ],
    ],
    "method": undefined,
    "url": undefined,
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
    "method": undefined,
    "url": undefined,
  },
]
`)
})
