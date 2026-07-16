// @vitest-environment jsdom
/**
 * Runtime smoke test for T002a.
 *
 * T002 verified the Astryx theme setup with typecheck/build/contrast checks
 * only, never a real render. `@astryxdesign/core`'s `Theme` provider calls
 * React's `use()` hook internally, which does not exist on React 18 and
 * throws a TypeError at first render. This test performs an actual DOM
 * render of the app root wrapped in the Astryx `Theme` provider so that
 * failure mode is exercised and can't silently regress.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Theme } from '@astryxdesign/core';
import App from '../App';
import { voltTheme } from './volt';

describe('Theme runtime smoke check', () => {
  it('renders the app root inside the Astryx Theme provider without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      expect(() => {
        act(() => {
          root.render(
            <Theme theme={voltTheme}>
              <App />
            </Theme>,
          );
        });
      }).not.toThrow();

      expect(container.querySelector('h1')?.textContent).toBe('VOLT Team Portal');
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
