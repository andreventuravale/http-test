
## Http files for Node.js

> @see https://github.com/dotnet/AspNetCore.Docs/blob/main/aspnetcore/test/http-files.md

## Usage

It exports a jest transformer.

Example:

```javascript
// jest.config.js

export default {
  moduleFileExtensions: [ ... others omitted ..., 'http'],
  testMatch: [ ... others omitted ..., '**/*.http'],
  transform: {
    ... others omitted ...,
    '\\.http$': 'jest-dot-http-files'
  }
}

```

## Additions to the original spec

#### The @only request variable

Runs only that particular test

#### The @skip request variable

Skips a test
