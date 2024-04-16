
## Jest transformer for .http files

### Literature and references

#### About jest transformers

https://jestjs.io/docs/code-transformation

#### About HTTP Files

- https://github.com/dotnet/AspNetCore.Docs/blob/main/aspnetcore/test/http-files.md
- https://marketplace.visualstudio.com/items?itemName=humao.rest-client
- https://www.jetbrains.com/help/idea/exploring-http-syntax.html#http_request_names

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
GET http://foo/{{foo.response.body.$.id}}
```

#### The @only meta variable

Meaninig: runs only this request.

```http
# @only
GET http://foo/bar
```

#### The @skip meta variable

Meaninig: don't run this request.

```http
# @skip
GET http://foo/bar
```

## Functions

> Functions are used within interpolations `{{...}}`.

#### The $guid function

Generates a random v4 UUID.

#### The $datetime function


```http
# "1 y" means to add one year to the current date
GET http://foo/{{$datetime iso8601 1 y}}
```
Offset unit:

- y = Year
- M = Month
- w = Week
- d = Day
- h = Hour
- m = Minute
- s = Second

## A note on "assertions"

Assertions are made using jest snapshots.

### The @ignoreHeaders meta variable

A regex pattern string.

Use it to specify what response headers to ignore for snapshot assertion. The "age" and "date" headers are always ignored.

```http
@ignoreHeaders ^(x-request-id|x-vendor-.*)
GET http://foo/bar
```

#### The @expect meta variable

Asserts a expression against a constant. The expression is related to the response.

This variable is accumulative and forms a list, meaning it doesn't override the previous value.

```http
# @expect status 200
# @expect statusText "OK"
GET http://foo/bar
```
