
## Jest transformer for .http files

### Literature and references

#### About jest transformers

https://jestjs.io/docs/code-transformation

#### About HTTP Files

- https://github.com/dotnet/AspNetCore.Docs/blob/main/aspnetcore/test/http-files.md
- https://marketplace.visualstudio.com/items?itemName=humao.rest-client
- https://www.jetbrains.com/help/idea/exploring-http-syntax.html

## Usage

Install the npm package as dev dependency: **jest-dot-http-files**

It works by exporting a jest transformer. Here is a simplified way to use it:

```javascript
// jest.config.js

export default {
  moduleFileExtensions: ['http'],
  testMatch: ['**/*.http'],
  transform: {
    '\\.http$': 'jest-dot-http-files/transformer'
  }
}

```

## Deviations from the existing literature

### Global variables

Variables starting with **@@** are held in the global scope, meaning they are available to all requests.

### Meta variables

> Meta variables are defined in the request scope within comments, similarly to jsdoc.

#### The @title meta variable

Overrides the test title. This variable is optional.

```http
# @title My meaningful test title.
GET http://foo/bar
```

#### The @name meta variable

Used to name a request. Named requests can be used in interpolations. This variable is optional.

```http
# @name foo
GET http://foo/bar
```

Accessing the named request:

```http
GET http://foo/{{foo.$.response.body.id}}
```

#### The @only meta variable

Meaning: runs only this request.

```http
# @only
GET http://foo/bar
```

#### The @skip meta variable

Meaning: don't run this request.

```http
# @skip
GET http://foo/bar
```

## Functions

> Functions are used within interpolations `{{...}}`.

#### The $guid function

Generates a random v4 UUID.

#### The $uuid function

Alias to $guid.

#### The $randomInt function

Generates a random integer number between min and max.

```http
GET http://foo/{{$randomInt 10 20}}
```

#### The $datetime function

Generates a date/time string: `{{$datetime <format> [offset unit]}}`

Format:
  - rfc1123:
  - iso8601:
  - or a custom format, e.g: "dd-MM-yyyy"

Offset unit:

- y = Year
- M = Month
- w = Week
- d = Day
- h = Hour
- m = Minute
- s = Second

Example:

```http
# adds one year to current date
GET http://foo/{{$datetime iso8601 1 y}}
```

## A note on "assertions"

Assertions are made using jest snapshots.

### The @ignoreHeaders meta variable

A regex pattern string.

Use it to specify what headers (both request and response) to ignore for snapshot assertion. The "age" and "date" headers are always ignored.

```http
# @ignoreHeaders ^(x-request-id|x-vendor-.*)
GET http://foo/bar
```

### The @ignore meta variable

Use it to specify what json-paths to ignore for snapshot assertion. The json-path is related to the named-request's request/response.

This variable is accumulative and forms a list, meaning you can ignore more than one path per request.

```http
# @ignore $.response.body.id
# @ignore $.response.body.completed
GET http://foo/bar
```

#### The @expect meta variable

Asserts a json-path against a constant. The json-path is related to the named-request's request/response.

This variable is accumulative and forms a list, meaning you can have many assertions.

```http
# @expect $.response.status 200
# @expect $.response.statusText "OK"
GET http://foo/bar
```

#### The @status meta variable

Alias to `@expect $.response.status <statusCode>` and ( optionally ) `@expect $.response.statusText "<statusText>"`

```http
# @status 200 "OK"
GET http://foo/bar
```

or the status code only

```http
# @status 200
GET http://foo/bar
```

#### The @throws meta variable

```http
# @throws
GET http://foo/bar
```

or with a regex pattern

```http
# @throws .*error.*
GET http://foo/bar
```

Expects the request to throw an error.

This is helpful to test negative cases, for example:

```http
# @titles Tests that the response is not 500
# @status 500
# @throws
GET http://foo/bar
```

---

### See also

- Language support for vscode:
  - Repository: https://github.com/andreventuravale/vscode-dot-http-files
  - Marketplace: https://marketplace.visualstudio.com/items?itemName=AndreValeOutlook.vscode-dot-http-files
