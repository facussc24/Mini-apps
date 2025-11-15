module.exports = {
    testEnvironment: 'jest-environment-jsdom',
    testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
    globals: {
      TextEncoder: require('util').TextEncoder,
      TextDecoder: require('util').TextDecoder,
    },
  };