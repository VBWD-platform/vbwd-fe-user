module.exports = {
  root: true,
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:vue/vue3-recommended'
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/ban-types': 'off',
    'no-unused-vars': 'off',
    'vue/multi-word-component-names': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }]
  },
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  ignorePatterns: ['node_modules/', 'dist/', 'vbwd-fe-core/', 'vue/tests/e2e/']
};
