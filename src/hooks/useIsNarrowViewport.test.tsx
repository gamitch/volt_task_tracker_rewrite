// @vitest-environment jsdom
/**
 * T132: tests for `useIsNarrowViewport` (extracted from
 * `src/pages/outreach/OutreachList.tsx`).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- this test uses the same raw `createRoot`/`act` probe-
 * component pattern already established by `CheckinResult.test.tsx:470-513`
 * (and `src/theme/theme.smoke.test.tsx`) rather than a `renderHook`-style
 * helper, since adding one would require a new dependency (constitution
 * item 9).
 *
 * WHAT THIS CAN AND CANNOT PROVE: `src/test-setup.ts:14-25` installs a
 * GUARDED `matchMedia` polyfill for jsdom whose `matches` is hardcoded
 * `false`, and jsdom itself evaluates no media queries at all. So no test
 * here can assert "a 768px viewport behaves narrow" against a real layout --
 * that would be a tautology if built by stubbing `matches` directly and
 * asserting the hook echoes it back. What CAN be proven, and is proven
 * below, is that the hook asks `window.matchMedia` for the correct QUERY
 * STRING at the 767/768/769px boundary: the stub below re-implements the
 * actual `(max-width: N)` semantics by parsing the query, so `matches` is
 * only `true` when the parsed breakpoint is >= the probed width -- a real
 * (if minimal) evaluator, not a canned answer.
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NARROW_VIEWPORT_QUERY,
  getIsNarrowViewport,
  useIsNarrowViewport,
} from './useIsNarrowViewport';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/**
 * A real (small) `(max-width: Npx)` evaluator against a stubbed viewport
 * width -- NOT a stub that hands back a canned `matches` value. Only
 * supports the one shape this hook's query uses; that is deliberate (this
 * is a query PARSER for the test, not a general matchMedia polyfill).
 */
function stubMatchMediaAtViewportWidth(viewportWidthPx: number): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => {
      const parsed = /^\(max-width: (\d+)px\)$/.exec(query);
      if (parsed === null) {
        throw new Error(`stubMatchMediaAtViewportWidth: unsupported query shape: ${query}`);
      }
      const maxWidthPx = Number(parsed[1]);
      return {
        matches: viewportWidthPx <= maxWidthPx,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      };
    }),
  );
}

function Probe(): ReactNode {
  const isNarrow = useIsNarrowViewport();
  return <div data-testid="probe">{isNarrow ? 'narrow' : 'wide'}</div>;
}

function renderProbe(): void {
  act(() => {
    root.render(<Probe />);
  });
}

describe('NARROW_VIEWPORT_QUERY', () => {
  it('is the 767px breakpoint the whole hook is pinned to', () => {
    expect(NARROW_VIEWPORT_QUERY).toBe('(max-width: 767px)');
  });
});

describe('getIsNarrowViewport / useIsNarrowViewport -- query-string pinning at the 767/768/769 boundary', () => {
  it('a 767px viewport (at the pinned breakpoint) reads narrow', () => {
    stubMatchMediaAtViewportWidth(767);
    expect(getIsNarrowViewport()).toBe(true);
    renderProbe();
    expect(container.textContent).toBe('narrow');
  });

  it('a 768px viewport (one above the pinned breakpoint) reads wide', () => {
    stubMatchMediaAtViewportWidth(768);
    expect(getIsNarrowViewport()).toBe(false);
    renderProbe();
    expect(container.textContent).toBe('wide');
  });

  it('a 769px viewport (two above the pinned breakpoint) reads wide', () => {
    stubMatchMediaAtViewportWidth(769);
    expect(getIsNarrowViewport()).toBe(false);
    renderProbe();
    expect(container.textContent).toBe('wide');
  });
});

describe('useIsNarrowViewport -- subscription behaviour', () => {
  it('subscribes via addEventListener and reacts to a later "change" event, not just the initial read', () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | undefined;
    const addEventListener = vi.fn(
      (_type: string, handler: (event: MediaQueryListEvent) => void) => {
        changeHandler = handler;
      },
    );
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener,
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    renderProbe();
    expect(container.textContent).toBe('wide');
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent);
    });
    expect(container.textContent).toBe('narrow');
  });

  it('unsubscribes (removeEventListener) on unmount', () => {
    const removeEventListener = vi.fn();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    // A dedicated, LOCAL root for this one test -- `afterEach` already
    // unmounts the shared `root` created in `beforeEach`, so unmounting that
    // one a second time here would be a real double-unmount, not a
    // deliberate one.
    const localContainer = document.createElement('div');
    document.body.appendChild(localContainer);
    const localRoot = createRoot(localContainer);
    act(() => {
      localRoot.render(<Probe />);
    });
    act(() => {
      localRoot.unmount();
    });
    localContainer.remove();

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
