import parse from './parser.js'

test('invalid inputs', () => {
  expect(() => parse('foo bar')).toThrow(
    '(line: 1) method + url expected but found: foo bar'
  )
})

test('invalid inputs ignoring comments and whitespace', () => {
  expect(() =>
    parse(`

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
  expect(parse()).toMatchInlineSnapshot('[]')
  expect(parse(null)).toMatchInlineSnapshot('[]')
  expect(parse(' \r \n \t \f \v ')).toMatchInlineSnapshot('[]')
})

test('basics', () => {
  const requests = parse(`
    GET https://jsonplaceholder.typicode.com/todos/1
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})

test('variables', () => {
  const requests = parse(`
    @hostname=localhost
    @port=3000
    @host={{hostname}}:{{port}}
    GET https://{{host}}/todos/1
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "https://{{host}}/todos/1",
    "variables": {
      "host": "{{hostname}}:{{port}}",
      "hostname": "localhost",
      "port": "3000",
    },
  },
]
`)
})

test('white space and comments are ignored', () => {
  const requests = parse(`

    \r \n \t \f \v

    \r \n \t \f \v # foo \r \n \t \f \v

    \r \n \t \f \v

    GET https://jsonplaceholder.typicode.com/todos/1

    \r \n \t \f \v

    \r \n \t \f \v //  bar \r \n \t \f \v

    \r \n \t \f \v

    POST https://jsonplaceholder.typicode.com/todos/1

    \r \n \t \f \v

    \r \n \t \f \v #   baz \r \n \t \f \v

    \r \n \t \f \v

  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "body": "POST https://jsonplaceholder.typicode.com/todos/1
    
 
 	  
    
 
 	   #   baz",
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})

test('with a single header', () => {
  const requests = parse(`
    GET https://jsonplaceholder.typicode.com/todos/1
    content-type: application/json
  `)

  expect(requests).toMatchInlineSnapshot(`
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
  const requests = parse(`
    GET https://jsonplaceholder.typicode.com/todos/1
    content-type: application/json
    x-foo: bar
  `)

  expect(requests).toMatchInlineSnapshot(`
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

test('headers are trimmed at both ends ( keys and values )', () => {
  const requests = parse(`
    GET https://jsonplaceholder.typicode.com/todos/1

    \t \f \v content-type \t \f \v : \t \f \v application/json \t \f \v

    \t \f \v x-foo \t \f \v : \t \f \v bar \t \f \v
  `)

  expect(requests).toMatchInlineSnapshot(`
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
  const requests = parse(`
    GET https://jsonplaceholder.typicode.com/todos/1
    content-type: application/json
    x-foo: bar
    x-foo: baz
  `)

  expect(requests).toMatchInlineSnapshot(`
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
  const requests = parse(`
    GET https://jsonplaceholder.typicode.com/todos/1
    ###
    POST https://jsonplaceholder.typicode.com/todos/1
    {}
    ###
    PATCH https://jsonplaceholder.typicode.com/todos/1
    x-foo: bar
    {}
  `)

  expect(requests).toMatchInlineSnapshot(`
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
  const requests = parse(`
    GET https://jsonplaceholder.typicode.com/todos/1
    x-foo: bar

    \r \n \t \f \v

    \r \n \t \f \v foo     bar \r \n \t \f \v

    \r \n \t \f \v

  `)

  expect(requests).toMatchInlineSnapshot(`
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
