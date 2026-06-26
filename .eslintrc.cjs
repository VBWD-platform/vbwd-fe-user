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
  overrides: [
    {
      // bin/ holds operator CLI scripts and Playwright/screenshot drivers — console output
      // and try{}catch{}-as-best-effort cleanup are the intended idioms. The same applies
      // to plugin e2e screenshot drivers under tests/e2e/.
      files: ['bin/**/*.mjs', 'bin/**/*.js', '**/tests/e2e/*.mjs', '**/tests/e2e/*.js'],
      rules: {
        'no-console': 'off',
        'no-empty': 'off'
      }
    }
  ],
  ignorePatterns: ['node_modules/', 'dist/', 'vbwd-fe-core/', 'vue/tests/e2e/']
};
