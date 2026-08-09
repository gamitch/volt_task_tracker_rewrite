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
  // `dist-e2e` is the persona harness's own build output (a second Vite
  // outDir, kept separate from `dist` so the two Playwright suites cannot
  // serve each other's bundle). eslint does not read `.gitignore`, so it needs
  // naming here alongside `dist` or `npm run lint` reports hundreds of
  // `no-undef` errors against minified vendor code.
  { ignores: ['dist', 'dist-e2e', 'node_modules', '.claude', 'supabase/functions/**'] },
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
  // `scripts/**/*.mjs` are Node CLI utilities (setup/diagnostic tooling), not
  // part of the browser bundle. They legitimately use `console` and `process`,
  // which `js.configs.recommended`'s `no-undef` reports as errors without Node
  // globals declared -- and `eslint .` gating on 0 errors means that would
  // break the gate rather than merely warn.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  // `tests/e2e-harness/**/*.mjs` is the local Supabase-compatible API shim
  // (auth + PostgREST + storage + Edge Functions) that lets the real browser
  // bundle run against a real Postgres cluster in this sandbox. Same
  // situation as `scripts/**/*.mjs` above: Node CLI/server code, not part of
  // the browser bundle, legitimately using `process`/`console`/`Buffer`.
  {
    files: ['tests/e2e-harness/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
];
