module.exports = {
    env: {
        node: true,
        es2021: true,
        mocha: true
    },
    plugins: [
        'security' // This makes the rules available
    ],
    extends: [
        'eslint:recommended',
        'prettier'
    ],
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
    },
    rules: {
        // Best Practices
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        'prefer-const': 'error',
        'no-var': 'error',
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],

        // Security
        'security/detect-object-injection': 'warn',
        'security/detect-non-literal-regexp': 'warn',

        // Style
        'indent': 'off',
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],

        // Async
        'no-async-promise-executor': 'error',
        'require-await': 'error'
    }
};