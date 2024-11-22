/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transformIgnorePatterns: [
        'node_modules/(?!(node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)/)'
    ],
    testMatch: [
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    verbose: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    testEnvironmentOptions: {
        url: 'http://localhost'
    },
    moduleDirectories: [
        'node_modules'
    ],
    rootDir: '.',
    roots: [
        '<rootDir>/server'
    ],
    // Ensure proper handling of dynamic imports
    resolver: undefined,
    // Disable automatic mocking
    automock: false,
    // Allow for async operations
    setupFilesAfterEnv: []
};
