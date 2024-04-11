
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

## Additions to the original spec

#### The @name request variable

Used as test title if present. This variable is optional.

```
@name foo bar
GET http://foo/bar
```

#### The @only request variable

Runs only that particular test

```
@only
GET http://foo/bar
```

#### The @skip request variable

Skips a test

```
@skip
GET http://foo/bar
```

## A note on "assertions"

Assertions are made using jest snapshots.

#### The @ignoreHeaders request variable

List delimited by spaces.

Use it to specify what response headers to ignore for snapshot assertion. The "age" and "date" headers are always ignored.

```
@ignoreHeaders x-foo x-bar
GET http://foo/bar
```
