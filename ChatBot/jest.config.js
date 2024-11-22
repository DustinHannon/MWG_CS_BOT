/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    transform: {
        '^.+\\.js$': ['babel-jest', { rootMode: 'upward' }]
    },
    moduleFileExtensions: ['js', 'json'],
    verbose: true,
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    transformIgnorePatterns: [
        '/node_modules/(?!node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/'
    ],
    clearMocks: true,
    testEnvironmentOptions: {
        url: 'http://localhost'
    },
    setupFiles: [],
    globals: {
        'NODE_ENV': 'test'
    }
};
