
## Http files for Node.js

> @see https://github.com/dotnet/AspNetCore.Docs/blob/main/aspnetcore/test/http-files.md

## Usage

It exports a jest transformer.

Example:

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

#### The @ignoreHeaders request variable

String delimited by comma or spaces.
Use it to specify what response headers to ignore for snapshot assertion. The "age" and "date" headers are always ignored.

```
@ignoreHeaders x-foo x-bar
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

