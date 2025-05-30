module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    testMatch: ['**/tests/**/*.test.ts', '**/integration-tests/**/*.test.ts'],
    moduleNameMapper: {
        '^@common/(.*)$': '<rootDir>/common/$1',
        '^@src/(.*)$': '<rootDir>/src/$1',
        '^@integration-tests/(.*)$': '<rootDir>/integration-tests/$1'
    },
    modulePaths: ['<rootDir>'],
    coverageDirectory: '../coverage',
    moduleFileExtensions: ['js', 'json', 'ts'],
    transform: {
        '^.+\\.tsx?$': 'ts-jest'
    },
    collectCoverageFrom: ['**/*.(t|j)s'],
};