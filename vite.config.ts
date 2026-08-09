/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // D003: minimal shared Vitest setup (guarded matchMedia polyfill only --
  // see src/test-setup.ts). The `/// <reference types="vitest/config" />`
  // triple-slash directive above is the one mechanical typing change the
  // `test` key below requires so `defineConfig`'s config type recognizes it.
  test: {
    setupFiles: ['./src/test-setup.ts'],
    // Pin the two Supabase env vars blank for the unit suite.
    //
    // Vitest loads `.env` the same way the dev server does, so before this the
    // suite silently depended on the developer NOT having one — and
    // `.env.example` tells every developer to create exactly that file. Seven
    // tests assert the app "fails safely when no Supabase is configured"
    // (AppShell, CoachHome, ParentHome, LiveConsole, LiveConsole.endMeeting);
    // with any `.env` present those tests fail, on a real Supabase project
    // they would also start reaching the network from a unit test.
    //
    // Tests that need the configured case set it explicitly with `vi.stubEnv`
    // (see `src/lib/supabase/client.test.ts`), which still overrides this.
    env: {
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_ANON_KEY: '',
    },
    // supabase/functions/** are Deno-runtime Edge Functions with their own
    // *.test.ts files (Deno.test(...), run separately via `deno test`) --
    // exclude them from vitest's default discovery, same reasoning as the
    // eslint.config.js exclusion added alongside this (CI break #4).
    // `.claude/worktrees/**` holds isolated subagent checkouts of this same
    // repo (one full copy per concurrently-running worker). `.gitignore`
    // covers them, but vitest does not read `.gitignore` -- without this
    // entry the suite collects every worktree's copy of every test file and
    // reports a doubled/tripled count against in-flight sibling code, which
    // makes the "1414 / 61 files" baseline every task packet gates on
    // meaningless. Excluded here rather than in each packet because no
    // worker is allowed to edit this file.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/**',
      // `*.throwaway.*` files are short-lived measurement rigs and probes that
      // tasks create, measure with, and delete (`.gitignore` already makes them
      // uncommittable). Vitest would otherwise collect a probe that happens to
      // be named `*.throwaway.test.tsx` mid-flight, changing the suite's file
      // and test counts -- and every task packet gates pass/fail on that exact
      // count, so a transient probe can make a real baseline look broken.
      '**/*.throwaway.*',
      'supabase/functions/**',
      // Playwright suites and their harness. Vitest would otherwise collect
      // `tests/e2e-personas/*.spec.ts`, which import `playwright/test` and
      // cannot run under vitest at all.
      'tests/e2e/**',
      'tests/e2e-personas/**',
      'tests/e2e-harness/**',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // T003 / DES-07: `src/theme/theme.css` is the prebuilt, static cascade
        // layer stylesheet (no runtime style injection). Emit it under its own
        // stable, un-hashed name so `npm run build` always produces a
        // recognizable `theme.css` build artifact instead of a content-hashed
        // asset name shared with unrelated bundled CSS.
        assetFileNames: (assetInfo) => {
          // Vite bundles all statically-imported CSS in the module graph
          // (including `src/theme/theme.css` and its `@import`s) into one
          // stylesheet per JS entry chunk, so the asset's reported `name`
          // reflects the entry chunk (e.g. "index"), not the source file
          // basename. This app has exactly one CSS entry point — the cascade
          // layer stylesheet imported by `src/main.tsx` — so route every
          // generated `.css` asset to a stable `theme.css` build artifact
          // (NFR-08 / DES-07: a real, deterministic static CSS file).
          const name = assetInfo.names?.[0] ?? assetInfo.name;
          if (name?.endsWith('.css')) {
            return 'assets/theme.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
