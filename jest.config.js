export default {
  moduleFileExtensions: ['js', 'http'],
  testMatch: ['**/*.http'],
  transform: {
    "\\.http$": "./jest-transformer.http.js"
  }
}