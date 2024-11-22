/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    extensionsToTreatAsEsm: ['.js'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transform: {
        '^.+\\.js$': ['babel-jest', { configFile: './babel.config.cjs' }]
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
    restoreMocks: true
};
