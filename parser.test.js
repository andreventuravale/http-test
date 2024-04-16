import parse from './parser.js'

test('invalid inputs', () => {
  expect(() => parse('foo bar')).toThrow(
    '(line: 1) method + url expected but found: foo bar'
  )
})

test('invalid inputs ignoring comments and whitespace', () => {
  expect(() =>
    parse(`

    \r \n \t

    \r \n \t # foo \r \n \t

    \r \n \t

    GET https://jsonplaceholder.typicode.com/todos/1

    ###

    foo bar
  `)
  ).toThrow('(line: 15) method + url expected but found: foo bar')
})

test('empty inputs', () => {
  expect(parse()).toMatchInlineSnapshot('[]')
  expect(parse(null)).toMatchInlineSnapshot('[]')
  expect(parse(' \r \n \t ')).toMatchInlineSnapshot('[]')
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
      "host": {
        "global": false,
        "value": "{{hostname}}:{{port}}",
      },
      "hostname": {
        "global": false,
        "value": "localhost",
      },
      "port": {
        "global": false,
        "value": "3000",
      },
    },
  },
]
`)
})

test('global variables', () => {
  const requests = parse(`
    @@hostname=localhost
    @@port=3000
    @@host={{hostname}}:{{port}}

    @endpoint=https://{{host}}/todos/1
    GET {{endpoint}}
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "{{endpoint}}",
    "variables": {
      "endpoint": {
        "global": false,
        "value": "https://{{host}}/todos/1",
      },
      "host": {
        "global": true,
        "value": "{{hostname}}:{{port}}",
      },
      "hostname": {
        "global": true,
        "value": "localhost",
      },
      "port": {
        "global": true,
        "value": "3000",
      },
    },
  },
]
`)
})

test('separator within empty ( only comments or whitespace )', () => {
  const requests = parse(`
    ###

    ###

    ###

    @endpoint=https://{{host}}/todos/1
    GET {{endpoint}}
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "{{endpoint}}",
    "variables": {
      "endpoint": {
        "global": false,
        "value": "https://{{host}}/todos/1",
      },
    },
  },
]
`)
})

test('global variables ( with request separator )', () => {
  const requests = parse(`
    @@hostname=localhost
    @@port=3000
    @@host={{hostname}}:{{port}}

    ###

    @endpoint=https://{{host}}/todos/1
    GET {{endpoint}}
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "variables": {
      "host": {
        "global": true,
        "value": "{{hostname}}:{{port}}",
      },
      "hostname": {
        "global": true,
        "value": "localhost",
      },
      "port": {
        "global": true,
        "value": "3000",
      },
    },
  },
  {
    "method": "GET",
    "url": "{{endpoint}}",
    "variables": {
      "endpoint": {
        "global": false,
        "value": "https://{{host}}/todos/1",
      },
    },
  },
]
`)
})

test('global variables across requests', () => {
  const requests = parse(`
    @@hostname=localhost
    @@port=3000

    @endpoint=https://{{host}}/todos/1
    GET {{endpoint}}

    ###

    @@host={{hostname}}:{{port}}

    @endpoint=https://{{host}}/todos/1
    GET {{endpoint}}
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "{{endpoint}}",
    "variables": {
      "endpoint": {
        "global": false,
        "value": "https://{{host}}/todos/1",
      },
      "hostname": {
        "global": true,
        "value": "localhost",
      },
      "port": {
        "global": true,
        "value": "3000",
      },
    },
  },
  {
    "method": "GET",
    "url": "{{endpoint}}",
    "variables": {
      "endpoint": {
        "global": false,
        "value": "https://{{host}}/todos/1",
      },
      "host": {
        "global": true,
        "value": "{{hostname}}:{{port}}",
      },
    },
  },
]
`)
})

test('per-request meta', () => {
  const requests = parse(`   
    @@host=https://jsonplaceholder.typicode.com
    @@dash={{$guid}}
    
    # @name sample1
    # @ignoreHeaders .*
    GET {{host}}/todos/1?_={{dash}}
    content-type: application/json
    
    ###
    
    # @name sample2
    # @ignoreHeaders .*
    GET {{host}}/todos/2?_={{dash}}
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
    "meta": {
      "ignoreHeaders": {
        "global": false,
        "value": ".*",
      },
      "name": {
        "global": false,
        "value": "sample1",
      },
    },
    "method": "GET",
    "url": "{{host}}/todos/1?_={{dash}}",
    "variables": {
      "dash": {
        "global": true,
        "value": "{{$guid}}",
      },
      "host": {
        "global": true,
        "value": "https://jsonplaceholder.typicode.com",
      },
    },
  },
  {
    "headers": [
      [
        "content-type",
        "application/json",
      ],
    ],
    "meta": {
      "ignoreHeaders": {
        "global": false,
        "value": ".*",
      },
      "name": {
        "global": false,
        "value": "sample2",
      },
    },
    "method": "GET",
    "url": "{{host}}/todos/2?_={{dash}}",
  },
]
`)
})

test('the "expect" request meta is accumulative ( forms a list )', () => {
  const requests = parse(`   
    # @name sample1
    # @expect $.response.status 200
    # @expect $.response.statusText "OK"
    GET http://foo
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
    "meta": {
      "expect": {
        "global": false,
        "value": [
          [
            "$.response.status",
            200,
          ],
          [
            "$.response.statusText",
            "OK",
          ],
        ],
      },
      "name": {
        "global": false,
        "value": "sample1",
      },
    },
    "method": "GET",
    "url": "http://foo",
  },
]
`)
})

test('The @status meta', () => {
  const requests = parse(`   
    # @name sample1
    # @status 200 "OK"
    GET http://foo
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
    "meta": {
      "name": {
        "global": false,
        "value": "sample1",
      },
      "status": {
        "global": false,
        "value": [
          200,
          "OK",
        ],
      },
    },
    "method": "GET",
    "url": "http://foo",
  },
]
`)
})

test('The @status meta ( code only )', () => {
  const requests = parse(`   
    # @name sample1
    # @status 200
    GET http://foo
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
    "meta": {
      "name": {
        "global": false,
        "value": "sample1",
      },
      "status": {
        "global": false,
        "value": [
          200,
          undefined,
        ],
      },
    },
    "method": "GET",
    "url": "http://foo",
  },
]
`)
})

test('the "ignore" request meta is accumulative ( forms a list )', () => {
  const requests = parse(`   
    # @name sample1
    # @ignore $.response.status
    # @ignore $.response.statusText
    GET http://foo
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
    "meta": {
      "ignore": {
        "global": false,
        "value": [
          {
            "global": false,
            "value": "$.response.status",
          },
          {
            "global": false,
            "value": "$.response.statusText",
          },
        ],
      },
      "name": {
        "global": false,
        "value": "sample1",
      },
    },
    "method": "GET",
    "url": "http://foo",
  },
]
`)
})

test('global variables at the bottom', () => {
  const requests = parse(`
    @@hostname=localhost
    @@port=3000

    @endpoint=https://{{host}}/todos/1
    GET {{endpoint}}

    ###

    @endpoint=https://{{host}}/todos/1
    GET {{endpoint}}

    ###

    @@host={{hostname}}:{{port}}
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "{{endpoint}}",
    "variables": {
      "endpoint": {
        "global": false,
        "value": "https://{{host}}/todos/1",
      },
      "hostname": {
        "global": true,
        "value": "localhost",
      },
      "port": {
        "global": true,
        "value": "3000",
      },
    },
  },
  {
    "method": "GET",
    "url": "{{endpoint}}",
    "variables": {
      "endpoint": {
        "global": false,
        "value": "https://{{host}}/todos/1",
      },
    },
  },
  {
    "variables": {
      "host": {
        "global": true,
        "value": "{{hostname}}:{{port}}",
      },
    },
  },
]
`)
})

it('valueless meta variables are treated as booleans', () => {
  const requests = parse(`
    # @only
    # @skip
    GET https://{{host}}/todos/1
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "meta": {
      "only": {
        "global": false,
        "value": true,
      },
      "skip": {
        "global": false,
        "value": true,
      },
    },
    "method": "GET",
    "url": "https://{{host}}/todos/1",
  },
]
`)
})

test('white space and comments are ignored', () => {
  const requests = parse(`

    \r \n \t

    \r \n \t # foo \r \n \t

    \r \n \t

    GET https://jsonplaceholder.typicode.com/todos/1

    \r \n \t

    \r \n \t #  foo \r \n \t

    \r \n \t

    ###

    \r \n \t

    \r \n \t // bar \r \n \t

    \r \n \t

    POST https://jsonplaceholder.typicode.com/todos/1

    \r \n \t

    \r \n \t //  bar \r \n \t

    \r \n \t

  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
  {
    "method": "POST",
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

    \t content-type \t : \t application/json \t

    \t x-foo \t : \t bar \t
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

    \r \n \t

    \r \n \t foo     bar \r \n \t

    \r \n \t

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

test('named requests', () => {
  const requests = parse(`
    // @name foo
    GET https://jsonplaceholder.typicode.com/todos/1
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "meta": {
      "name": {
        "global": false,
        "value": "foo",
      },
    },
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)

  expect(() => {
    const requests = parse(`
  // @name foo bar
  GET https://jsonplaceholder.typicode.com/todos/1
`)
  }).toThrow('(line: 3) invalid request name: foo bar')
})

test('request meta', () => {
  const requests = parse(`
    // @foo bar
    // @foo baz
    // @qux waldo
    GET https://jsonplaceholder.typicode.com/todos/1
  `)

  expect(requests).toMatchInlineSnapshot(`
[
  {
    "meta": {
      "foo": {
        "global": false,
        "value": "baz",
      },
      "qux": {
        "global": false,
        "value": "waldo",
      },
    },
    "method": "GET",
    "url": "https://jsonplaceholder.typicode.com/todos/1",
  },
]
`)
})
