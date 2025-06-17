// jest.config.js
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: [
        '**/tests/**/*.test.ts',
        '**/integration-tests/**/*.test.ts',
        '**/src/**/*.test.ts',
    ],
    moduleNameMapper: {
        '^@src/(.*)$': '<rootDir>/src/$1',

    },
    coverageDirectory: './coverage',
    moduleFileExtensions: ['js', 'json', 'ts', 'tsx'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest'
    },
    collectCoverageFrom: [
        'src/**/*.{ts,js}',
        '!src/**/*.test.{ts,js}',
        '!src/**/index.{ts,js}'
    ],
    roots: [
        "<rootDir>/src",
        "<rootDir>/tests",
        "<rootDir>/integration-tests"
    ]
};