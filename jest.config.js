export default {
  testMatch: ['**/*.http'],
  transform: {
    "\\.http$": "./jest-transformer.http.js",
  } 
}
