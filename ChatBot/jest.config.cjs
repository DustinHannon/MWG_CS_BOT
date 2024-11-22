/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    transformIgnorePatterns: [
        '/node_modules/'
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
    }
};
