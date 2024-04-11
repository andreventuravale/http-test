export default {
  moduleFileExtensions: ['js', 'http'],
  testMatch: ['**/*.http', '**/*.test.js'],
  transform: {
    '\\.http$': './jest-transformer.js'
  }
}
