import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
