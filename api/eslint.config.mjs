// eslint.config.js
import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import security from 'eslint-plugin-security';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'jest.config.js', 'tests/**/*'],
  },
  js.configs.recommended,
  // Configuration for production TypeScript files with strict project requirements
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        NodeJS: 'readonly',
        fetch: 'readonly',
        Express: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      security,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'security/detect-object-injection': 'off',
    },
  },
  // Configuration for test files without TypeScript project requirements
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', 'tests/**/*'],
    languageOptions: {
      parser,
      parserOptions: {
        sourceType: 'module',
        // No project requirement for test files
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        setTimeout: 'readonly',
        NodeJS: 'readonly',
        // Jest globals
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      security,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'security/detect-object-injection': 'off',
      // Relax some rules for test files
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];