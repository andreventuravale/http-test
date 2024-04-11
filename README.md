
## Jest transformer for .http files

> @see https://github.com/dotnet/AspNetCore.Docs/blob/main/aspnetcore/test/http-files.md

## Usage

Install the npm package ( in dev mode ): **jest-dot-http-files**

Install the peer-dependencies ( in dev mode if you aren't using them already ):

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

#### The @name request variable

Used as test title if present. This variable is optional.

```http
@name foo bar
GET http://foo/bar
```

#### The @only request variable

Runs only that particular test.

```http
@only
GET http://foo/bar
```

#### The @skip request variable

Skips a test.

```http
@skip
GET http://foo/bar
```

#### The @guid function

Generates a random v4 UUID.

#### The $datetime and $localDatetime functions

The **$datetime** and **$localDatetime** might not fully represent the .NET reference implementation.

## A note on "assertions"

Assertions are made using jest snapshots.

#### The @ignoreHeaders request variable

A regex pattern string.

Use it to specify what response headers to ignore for snapshot assertion. The "age" and "date" headers are always ignored.

```http
@ignoreHeaders ^(x-request-id|x-vendor-.*)
GET http://foo/bar
```
