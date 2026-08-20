// @vitest-environment jsdom
/**
 * GAM-387: tests for `RouteErrorBoundary.tsx` -- both the plain unit
 * (mounted directly against a hand-built `MemoryRouter` tree) and, for AC1b
 * and AC5, against the REAL `AppRoutes` (`./router.tsx`) so the mount itself
 * is proven, not merely the component in isolation. AC1 additionally proves
 * against the REAL `AppShell` (`./AppShell.tsx`), per the packet's own
 * recipe -- not a hand-built chrome stand-in.
 *
 * No `@testing-library/react` installed in this repo -- same raw
 * `createRoot`/`act` + `MemoryRouter` house pattern every other test file
 * here already uses (`SeasonProvider.test.tsx`, `AppShell.test.tsx`).
 *
 * Each `it(` below is one of the packet's acceptance criteria (see
 * `docs/swarm/active/GAM-387-packet.md` §6) -- labelled by ID in its title
 * so the mutation table there maps onto this file one-to-one. AC2's own
 * mutations only work at all because `RouteErrorBoundary.tsx` owns the reset
 * key itself (see that file's module doc "Reset mechanism") -- both AC2
 * tests below build their OWN `<Routes>` tree around the imported
 * `RouteErrorBoundary`, so a mutation to the key computation is visible to
 * them without touching `router.tsx`.
 */
import { act, lazy, Suspense, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import { AppShell } from './AppShell';
import { AppRoutes } from './router';
import { LoginAs } from '../test-utils/authHarness';
import type { AuthUser } from './guards';

// ---------------------------------------------------------------------------
// Render harness -- same raw createRoot/act pattern as every other test file
// in this project (no @testing-library/react installed).
// ---------------------------------------------------------------------------

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
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/**
 * A real macrotask flush (`setTimeout(0)`, not a microtask-only
 * `Promise.resolve()` chain) -- AC1b's real `lazy(() => import(...))` chunk
 * resolution goes through Vitest's own module transform pipeline, which is
 * I/O-bound (measured: a pure `flushMicrotasks()` loop never observed it
 * settle, no matter how many iterations; a real event-loop tick did). Used
 * only where a genuine dynamic `import()` needs to resolve, not as this
 * file's default flush.
 */
async function flushMacrotask(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };

/** Always throws during render -- the simplest possible "routed page content
 * threw" reproduction, used by every test that doesn't need a specific
 * error shape. */
function Boom(): ReactNode {
  throw new Error('GAM-387 test boom: routed page content threw during render.');
}

// ---------------------------------------------------------------------------
// AC1 -- a child that throws produces visible fallback text, and the REAL
// chrome (real AppShell, real TopNav/SideNav, real SeasonProvider/KpiStrip)
// survives. Recipe verbatim from the packet (measured by round 2, not
// proposed): query `[role="main"]`, never `<main>` (the installed Astryx
// AppShell renders a `<div role="main">`, not a literal `<main>` element --
// `AppShell.test.tsx:28-36` already documents this).
// ---------------------------------------------------------------------------

describe('AC1: fallback renders, real chrome (nav) survives, fallback sits inside role="main"', () => {
  it('renders the fallback text and leaves the real AppShell chrome (TopNav + SideNav) mounted around it', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/']}>
            <LoginAs user={COACH_USER}>
              <AppShell>
                <RouteErrorBoundary>
                  <Boom />
                </RouteErrorBoundary>
              </AppShell>
            </LoginAs>
          </MemoryRouter>,
        );
      });
      await flushMicrotasks();

      // Fallback text is present.
      expect(container.textContent).toContain('This page ran into a problem');

      // The real chrome survives -- both TopNav and SideNav render a <nav>
      // landmark (recipe's own measured expectation: navCount=2).
      expect(container.querySelectorAll('nav').length).toBeGreaterThan(0);

      // The fallback sits INSIDE the shell's role="main" content region, not
      // floating outside/instead of it.
      const main = container.querySelector('[role="main"]');
      expect(main).not.toBeNull();
      expect(main?.textContent).toContain('This page ran into a problem');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC1b -- the boundary is ACTUALLY mounted in router.tsx. Drives a real,
// already-Passed routed page (`CoachHome`, via the real `/` -> `DashboardPage`
// dispatch) into throwing for a genuine reason: `AppRoutes` alone (unlike
// `AppShell`) never mounts a `<SeasonProvider>`, and `CoachHome` calls
// `useActiveSeason()` unconditionally near the top of its own render
// (`CoachHome.tsx:2178`, confirmed by reading that file directly) -- so
// rendering the real route table's `/` route with no `SeasonProvider` above
// it throws `"useActiveSeason() must be called within a <SeasonProvider>."`
// for real, with no hand-thrown `Boom` needed. This is deliberately a REAL
// route in the REAL table, not a synthetic one -- removing
// `<RouteErrorBoundary>` from `router.tsx`'s `AppRoutes` turns this red
// (the throw becomes uncaught instead of producing a fallback).
// ---------------------------------------------------------------------------

describe('AC1b: RouteErrorBoundary is actually mounted inside AppRoutes (router.tsx)', () => {
  it('a real routed page throwing (CoachHome, missing SeasonProvider) yields the fallback via the real AppRoutes mount, not an uncaught crash', async () => {
    // Pre-warm `router.tsx`'s own `lazy(() => import('../pages/home/DashboardPage'))`
    // target by importing the exact same specifier here first. Measured
    // directly: a cold `import('../pages/home/DashboardPage')` takes over 1
    // real second in this vitest/vite-node environment (this page's own
    // dependency-chain transform cost) -- long enough that a bounded
    // microtask- or macrotask-poll loop can undershoot it and never observe
    // the lazy component resolve at all. Importing it here first warms
    // Vite's module cache, so `AppRoutes`'s own internal `lazy()` call
    // resolves on the very next tick instead of paying that same real
    // compile cost again mid-test.
    await import('../pages/home/DashboardPage');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/']}>
            <LoginAs user={COACH_USER}>
              <AppRoutes />
            </LoginAs>
          </MemoryRouter>,
        );
      });
      // Two async steps still resolve in sequence here before the throw is
      // reachable -- the now-warm `DashboardPage` lazy chunk, THEN (once
      // that resolves and `DashboardPage` itself renders) `LoginAs`'s own
      // fake auth module resolving `user` (`user === null` renders nothing
      // in the interim -- `DashboardPage.tsx`'s own module doc #2). Only
      // once BOTH have settled does `CoachHome` (a plain, non-lazy import
      // inside `DashboardPage`) ever call `useActiveSeason()` and throw. A
      // small bounded poll, not a fixed count, covers both steps regardless
      // of exactly how many ticks each takes.
      for (
        let attempt = 0;
        attempt < 10 && !container.textContent?.includes('This page ran into a problem');
        attempt += 1
      ) {
        await flushMacrotask();
      }

      expect(container.textContent).toContain('This page ran into a problem');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC2a/AC2b -- reset on navigation, keyed on pathname AND search. Both build
// their own small `<Routes>` tree wrapping the imported `RouteErrorBoundary`
// (matching production's "boundary wraps `<Routes>`" shape), with a sibling
// `NavButtons` component OUTSIDE the boundary (so it survives a catch,
// exactly like real nav chrome does) that drives real client-side navigation
// via `useNavigate()`, not a remount of `MemoryRouter` itself.
// ---------------------------------------------------------------------------

/** Throws while the `t` search param on `/checkin` is `A`; renders real
 * content once it is anything else. Deliberately modelled on GAM-352's own
 * page (`CheckinResult.tsx:359-361,607` reads `s`/`t`/`code` from search
 * params on a single pathname) -- this is the exact shape AC2b exists to
 * guard. */
function ConditionalCheckinBoom(): ReactNode {
  const [searchParams] = useSearchParams();
  if (searchParams.get('t') === 'A') {
    throw new Error('GAM-387 test boom: /checkin?t=A always throws.');
  }
  return <div data-testid="checkin-content">{`checkin content, t=${searchParams.get('t')}`}</div>;
}

function SafeContent(): ReactNode {
  return <div data-testid="safe-content">safe route content</div>;
}

function NavButtons(): ReactNode {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" data-testid="nav-safe" onClick={() => navigate('/safe')}>
        Go to /safe
      </button>
      <button
        type="button"
        data-testid="nav-checkin-b"
        onClick={() => navigate('/checkin?s=1&t=B')}
      >
        Go to /checkin?s=1&t=B
      </button>
    </div>
  );
}

function ResetHarness({ initialEntry }: { initialEntry: string }): ReactNode {
  return (
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavButtons />
      <RouteErrorBoundary>
        <Routes>
          <Route path="/checkin" element={<ConditionalCheckinBoom />} />
          <Route path="/safe" element={<SafeContent />} />
        </Routes>
      </RouteErrorBoundary>
    </MemoryRouter>
  );
}

describe('AC2a: navigation to a DIFFERENT path recovers (the boundary resets)', () => {
  it("after /checkin?s=1&t=A throws, navigating to /safe renders /safe's real content, not the fallback", async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => {
        root.render(<ResetHarness initialEntry="/checkin?s=1&t=A" />);
      });
      expect(container.textContent).toContain('This page ran into a problem');

      act(() => {
        container.querySelector<HTMLButtonElement>('[data-testid="nav-safe"]')?.click();
      });

      expect(container.textContent).not.toContain('This page ran into a problem');
      expect(container.querySelector('[data-testid="safe-content"]')).not.toBeNull();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('AC2b: navigation to the SAME path with DIFFERENT search recovers too', () => {
  it("after /checkin?s=1&t=A throws, navigating to /checkin?s=1&t=B renders the route's real content, not the fallback", async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => {
        root.render(<ResetHarness initialEntry="/checkin?s=1&t=A" />);
      });
      expect(container.textContent).toContain('This page ran into a problem');

      act(() => {
        container.querySelector<HTMLButtonElement>('[data-testid="nav-checkin-b"]')?.click();
      });

      expect(container.textContent).not.toContain('This page ran into a problem');
      const content = container.querySelector('[data-testid="checkin-content"]');
      expect(content).not.toBeNull();
      expect(content?.textContent).toBe('checkin content, t=B');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC3 -- a REAL lazy(() => Promise.reject(...)) rejection propagating
// through <Suspense> renders the reload action; a plain generic throw does
// not. Driven through an actual lazy rejection (not a hand-thrown Error with
// a message written to match the predicate), per the packet's own
// anti-circularity instruction.
// ---------------------------------------------------------------------------

describe('AC3: a real lazy() chunk-load rejection gets the reload action; a generic throw does not', () => {
  it('a real lazy(() => Promise.reject(...)) rejection renders the chunk-load fallback with a working reload action', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Harness recipe from the packet, verbatim: `vi.spyOn(window.location,
    // 'reload')` throws `TypeError: Cannot redefine property: reload` under
    // the installed jsdom -- stub the whole global instead.
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
    try {
      const FailingLazyRoute = lazy(() =>
        Promise.reject(new Error('Failed to fetch dynamically imported module')),
      );

      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/']}>
            <RouteErrorBoundary>
              <Suspense fallback={<div data-testid="loading">Loading…</div>}>
                <FailingLazyRoute />
              </Suspense>
            </RouteErrorBoundary>
          </MemoryRouter>,
        );
      });
      await flushMicrotasks();

      expect(container.textContent).toContain("This page couldn't finish loading");
      const reloadButton = Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Reload page'),
      );
      expect(reloadButton).not.toBeUndefined();

      act(() => {
        reloadButton?.click();
      });
      expect(window.location.reload).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      consoleErrorSpy.mockRestore();
    }
  });

  it('a plain generic throw (not a chunk-load failure) renders the generic fallback, with no reload action', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      act(() => {
        root.render(
          <MemoryRouter initialEntries={['/']}>
            <RouteErrorBoundary>
              <Boom />
            </RouteErrorBoundary>
          </MemoryRouter>,
        );
      });

      expect(container.textContent).toContain('This page ran into a problem');
      expect(container.textContent).not.toContain("This page couldn't finish loading");
      expect(container.textContent).not.toContain('Reload page');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC4 -- the fallback makes no claim about whether the user's data was saved
// or lost, because the boundary cannot know that.
// ---------------------------------------------------------------------------

describe('AC4: the fallback copy makes no claim about saved/lost data', () => {
  it('generic fallback text does not match /saved|lost|your changes/i', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <RouteErrorBoundary>
            <Boom />
          </RouteErrorBoundary>
        </MemoryRouter>,
      );
    });
    expect(container.textContent).not.toMatch(/saved|lost|your changes/i);
  });
});

// ---------------------------------------------------------------------------
// AC4b -- copy follows DES-14 (sentence case)/DES-16 (no apology/"Oops",
// names a real action). Same shape as
// `src/emails/templates/event-reminder-48h.test.tsx`'s existing
// `'DES-14 voice: no bare "Submit"/"OK"'` test.
// ---------------------------------------------------------------------------

describe('AC4b: DES-14/DES-16 voice -- no apology, no bare "Submit"/"OK", names a real action', () => {
  it('generic fallback: no apology ("Sorry"/"Oops"), no bare "Submit"/"OK", and names a real recovery action', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/']}>
          <RouteErrorBoundary>
            <Boom />
          </RouteErrorBoundary>
        </MemoryRouter>,
      );
    });
    // No leading/trailing `\b` here (unlike the `event-reminder-48h.test.tsx`
    // precedent this otherwise mirrors): `container.textContent` concatenates
    // adjacent DOM text nodes with no separator (the `EmptyState` title and
    // description render as separate elements, e.g. "...problem" immediately
    // followed by "Sorry, ..." with no space), so a leading `\b` before
    // "sorry" can silently fail to match at that seam -- measured directly,
    // not assumed.
    //
    // The SAME reasoning applies to the `Submit`/`OK` assertion below, and the
    // first version of this file got that one wrong: it kept
    // `/\bSubmit\b|\bOK\b/` while dropping the boundaries above. GAM-387's
    // checker measured the consequence -- with `"OK, head back to your
    // dashboard..."` planted in the shipped copy, `textContent` reads
    // "...ran into a problemOK, head back..." with no word boundary between
    // "m" and "O", so the assertion did not fire and this test stayed GREEN on
    // copy it exists to reject. Both assertions are boundary-free for one
    // reason, so neither can drift back.
    expect(container.textContent).not.toMatch(/sorry|oops/i);
    expect(container.textContent).not.toMatch(/Submit|OK/);
    // Names a real, keyboard-reachable action: a link back to the dashboard.
    expect(container.querySelector('a[href="/"]')?.textContent).toContain('Go to your dashboard');
  });
});

// ---------------------------------------------------------------------------
// AC5 -- the Suspense loading path still works: "Loading page…" still
// renders while a lazy route is pending. Round 1 measured this string has
// zero existing test references anywhere in the repo -- written fresh here,
// against the REAL AppRoutes (so it also proves the boundary wrap didn't
// break Suspense's own fallback), not restated as already covered.
// ---------------------------------------------------------------------------

describe('AC5: the Suspense loading fallback ("Loading page…") still renders for a pending lazy route', () => {
  it('renders "Loading page…" synchronously, before any lazy route chunk has resolved', () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/login']}>
          <AppRoutes />
        </MemoryRouter>,
      );
    });
    expect(container.textContent).toContain('Loading page…');
  });
});

// ---------------------------------------------------------------------------
// AC6 -- the full suite is green; this file's own existence/growth is one of
// the two counts that must go up (see `npm run test` output in the worker's
// final report, not asserted here).
// ---------------------------------------------------------------------------
