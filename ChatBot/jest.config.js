export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    moduleFileExtensions: ['js', 'json'],
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    verbose: true,
    testMatch: [
        '**/tests/**/*.js',
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    // Handle ES modules
    transformIgnorePatterns: [],
    // Automatically clear mock calls and instances between every test
    clearMocks: true,
    // Indicates whether the coverage information should be collected while executing the test
    collectCoverageFrom: [
        'server/**/*.js',
        '!server/config/**',
        '!**/node_modules/**',
        '!**/vendor/**'
    ],
    // The directory where Jest should output its coverage files
    coverageThreshold: {
        global: {
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0
        }
    },
    // A list of reporter names that Jest uses when writing coverage reports
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '/coverage/'
    ]
};
