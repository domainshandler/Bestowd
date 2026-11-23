// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

/** Lint rules for the TypeScript apps and packages. Formatting is left to Prettier. */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.turbo/**', 'apps/mobile/**', '**/*.config.{js,mjs,ts}', 'apps/api/prisma/**'] },
  js.configs.recommended,

  // Source files: type-aware rules (they use each package's tsconfig).
  {
    files: ['apps/api/src/**/*.ts', 'apps/web/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      // Promises must be awaited, returned or explicitly discarded with `void`.
      '@typescript-eslint/no-floating-promises': 'error',
      // Allow async handlers on JSX props like onClick, and on Fastify route options like preHandler
      // (Fastify accepts async hooks, but its types also list the callback form, which this rule checks against).
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false, properties: false } }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Fastify plugins and test mocks are async by contract, with or without an await inside.
      '@typescript-eslint/require-await': 'off',
      eqeqeq: ['error', 'smart'],
      // Use the request logger in routes; console.info/warn/error are for the background jobs.
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      // Keep files and functions a reviewable size.
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      // The largest today are about 260 lines (route registrations, big forms); this stops them growing further.
      'max-lines-per-function': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },

  // Tests: the API's tests sit outside its tsconfig, so they get the rules that don't need types.
  {
    files: ['apps/api/tests/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'apps/web/src/test-*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'max-lines-per-function': 'off',
      'max-lines': 'off',
    },
  },

  // The website: React hook rules and accessibility.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [jsxA11y.flatConfigs.recommended],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  { files: ['apps/api/**/*.ts', 'packages/**/*.ts'], languageOptions: { globals: globals.node } },

  prettier,
)
