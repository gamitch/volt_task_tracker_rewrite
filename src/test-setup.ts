/**
 * D003: shared Vitest setup file, wired via `vite.config.ts`'s
 * `test.setupFiles`.
 *
 * This installs a minimal, GUARDED `window.matchMedia` polyfill for jsdom
 * test environments that don't implement it. "Guarded" means the assignment
 * only happens if `window.matchMedia` is not already defined -- so a real
 * browser/CI environment that already provides a real `matchMedia` is never
 * clobbered.
 *
 * This file is intentionally narrow -- a single guarded polyfill, not a
 * general mock dumping ground. Do not add other global mocks here.
 */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
