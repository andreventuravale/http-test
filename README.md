
## Jest transformer for .http files

> @see https://github.com/dotnet/AspNetCore.Docs/blob/main/aspnetcore/test/http-files.md

## Usage

Install the npm package ( in dev mode ): **jest-dot-http-files**

Install the peer-dependencies ( in dev mode if you aren't using them already ):

- **date-fns**
- **jsonpath**
- **lodash-es**
- **node-fetch**

It works by exporting a jest transformer.

Here is a simplified way to use it:

```javascript
// jest.config.js

export default {
  moduleFileExtensions: ['http'],
  testMatch: ['**/*.http'],
  transform: {
    '\\.http$': 'jest-dot-http-files'
  }
}

```

## Deviations from the original spec

### Global variables

Variables starting with @@ are held in the global scope, whether variables starting with a single @ are held in the request scope.

### Meta variables

#### The @title meta variable

Used as test title if present. This variable is optional.

```http
# @title foo
GET http://foo/bar
```

#### The @name meta variable

Used to name a request. Named requests can be used in interpolations. This variable is optional.

```http
# @name foo
GET http://foo/bar
```

#### The @only meta variable

Runs only that particular test. This variable is optional.

```http
# @only
GET http://foo/bar
```

#### The @skip meta variable

Skips a test. This variable is optional.

```http
# @skip
GET http://foo/bar
```

### Functions

#### The $guid function

Generates a random v4 UUID.

#### The $datetime function

The **$datetime** might not fully represent the reference implementation.

Additionally, it supports offsets at the end, for instance:

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

#### Not supported/implemented

- The **$localDatetime** function.
- Specific HTTP versions

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
# @expect statusText OK
GET http://foo/bar
```
