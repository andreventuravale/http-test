export default {
  moduleFileExtensions: ['js', 'http'],
  testMatch: ['**/*.http', '**/*.test.js'],
  transform: {
    '\\.http$': './transformer.js'
  }
}
