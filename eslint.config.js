import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  // supabase/functions/** are Deno-runtime Edge Functions, not part of the
  // Vite/React project this config targets -- they use the Deno global and
  // are linted/typechecked separately via `deno lint`/`deno check` (see
  // T017's worker verification). Linting them here with browser globals
  // produces false no-undef errors on every `Deno.*` reference.
  // `.claude` also holds isolated subagent worktrees -- full checkouts of
  // this repo. eslint does not read `.gitignore` either, so without this
  // `npx eslint .` lints every worker's in-flight copy alongside the real
  // tree (see the matching note in `vite.config.ts`).
  { ignores: ['dist', 'node_modules', '.claude', 'supabase/functions/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  eslintConfigPrettier,
];
