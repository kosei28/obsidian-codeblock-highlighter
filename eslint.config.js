import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import gitignore from 'eslint-config-flat-gitignore';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default defineConfig([
  ...obsidianmd.configs.recommended,
  gitignore(),
  { ignores: ['**/*.js'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: './tsconfig.json' },
    },
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ['scripts/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'import/no-nodejs-modules': 'off',
    },
  },
]);
