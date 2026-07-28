// @vitest-environment jsdom
/**
 * Runtime smoke test for T002a.
 *
 * T002 verified the Astryx theme setup with typecheck/build/contrast checks
 * only, never a real render. `@astryxdesign/core`'s `Theme` provider calls
 * React's `use()` hook internally, which does not exist on React 18 and
 * throws a TypeError at first render. This test performs an actual DOM
 * render of the app root so that failure mode is exercised and can't
 * silently regress.
 *
 * D003: `App` now owns the `Theme` provider internally per NAV-01 (T006), so
 * the old outer `<Theme>` wrapper here double-wrapped Theme and no longer
 * represented the real app root. Restructured to render `<App />` directly.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('Theme runtime smoke check', () => {
  it('renders the app root without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      expect(() => {
        act(() => {
          root.render(<App />);
        });
      }).not.toThrow();

      expect(container.textContent?.trim()).toBeTruthy();
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
