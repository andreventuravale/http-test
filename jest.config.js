
export default {
  moduleFileExtensions: ['js', 'http'],
  setupFiles: ["jest.setup.js"],
  testMatch: ['**/*.http', '**/*.test.js'],
  transform: {
    '\\.http$': './jest-transformer.js'
  }
}
