// @vitest-environment jsdom
/**
 * T123: tests for `AppShell.tsx` -- specifically this task's own edit (the
 * new `<KpiStrip />` mount point) PLUS a regression proof that the
 * pre-existing chromeless-branch / `SeasonProvider`-mounting structure
 * (T115-verified) is left completely intact.
 *
 * No dedicated test file existed for `AppShell.tsx` before this task
 * (confirmed: no `AppShell.test.tsx` anywhere in `src/app/` prior to this
 * change) -- this file is new, not a rewrite of an existing suite. Same raw
 * `createRoot`/`act` + `MemoryRouter` + `AuthProvider`/`LoginAs` harness
 * `CoachHome.test.tsx`/`SeasonProvider.test.tsx` already establish.
 *
 * `AppShell.tsx` has no injectable seam of its own for `loadActiveSeason`/
 * `loadKpiStripData` (it always mounts the real `<SeasonProvider>` and the
 * real-default `<KpiStrip />`) -- in this jsdom test environment with no
 * `.env` configured, `getSupabaseClient()` throws `SupabaseNotConfiguredError`
 * (`../lib/supabase/client.ts`), which every loader in this codebase
 * normalizes into a rejected `SupabaseLoaderError` rather than a raw crash
 * (same disclosed, already-established test-environment behavior
 * `../test-utils/authHarness.tsx`'s own module doc describes for its outer
 * bare `<AuthProvider>`). This is used deliberately below: rendering the
 * normal (non-chromeless) branch as a logged-in coach and asserting the
 * resulting `useActiveSeason()` `'error'` Banner appears INSIDE the shell's
 * `role="main"` content region proves `<KpiStrip />` is genuinely mounted,
 * executing, and rendering real content in the shell's own main-content
 * region -- not merely present in source but silently inert. Note: the
 * installed `@astryxdesign/core@0.1.6` `AppShell` renders its main-content
 * region as a `<div role="main" id="astryx-app-shell-main">`
 * (`node_modules/@astryxdesign/core/src/AppShell/AppShell.tsx` ->
 * `LayoutContent`, verified directly against the shipped source), NOT a
 * literal HTML `<main>` element despite `astryx-api.md`'s own "AppShell"
 * Props table prose ("Main content area, rendered inside a <main>
 * element") -- this file queries `[role="main"]`, not `main`, for that
 * reason (a `container.querySelector('main')` would always return `null`
 * against the real installed component).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from './guards';
import { LoginAs } from '../test-utils/authHarness';
import { routePaths } from './router';
import { AppShell } from './AppShell';

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
  });
}

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };

const PAGE_MARKER_TEXT = 'T123 AppShell test page marker';

function renderAt(path: string, user: AuthUser | null): void {
  const page = <div data-testid="page-marker">{PAGE_MARKER_TEXT}</div>;
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          {user === null ? (
            <AppShell>{page}</AppShell>
          ) : (
            <LoginAs user={user}>
              <AppShell>{page}</AppShell>
            </LoginAs>
          )}
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

describe('<AppShell /> (T006 chrome wrapper; T123 KpiStrip mount point)', () => {
  // -------------------------------------------------------------------
  // Regression: chromeless branch (T115-verified structure) unchanged.
  // -------------------------------------------------------------------
  it('renders /login chromeless -- children only, no TopNav/SideNav chrome, no KpiStrip content', () => {
    renderAt(routePaths.login, null);
    expect(container.textContent).toContain(PAGE_MARKER_TEXT);
    // No Astryx AppShell chrome landmark, no VOLT wordmark (TopNav), no
    // `role="main"` wrapper -- this branch returns `children` completely
    // unwrapped.
    expect(container.querySelector('[role="main"]')).toBeNull();
    expect(container.textContent).not.toContain('VOLT');
  });

  it('renders /accept-invite chromeless too', () => {
    renderAt(routePaths.acceptInvite, null);
    expect(container.textContent).toContain(PAGE_MARKER_TEXT);
    expect(container.querySelector('[role="main"]')).toBeNull();
  });

  // -------------------------------------------------------------------
  // Normal branch: TopNav/SideNav chrome present, SeasonProvider mounted,
  // <KpiStrip /> mounted inside the shell's `role="main"` content region,
  // BEFORE the page's own children.
  // -------------------------------------------------------------------
  it('renders normal routes wrapped in the Astryx chrome (TopNav/SideNav), with page content inside the shell\'s role="main" region', async () => {
    renderAt(routePaths.dashboard, COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('VOLT'); // TopNav wordmark
    const main = container.querySelector('[role="main"]');
    expect(main).not.toBeNull();
    expect(main?.textContent).toContain(PAGE_MARKER_TEXT);
  });

  it('mounts <KpiStrip /> inside the shell\'s role="main" region, positioned BEFORE the page marker (real content, not silently inert)', async () => {
    renderAt(routePaths.dashboard, COACH_USER);
    await flushMicrotasks();
    const main = container.querySelector('[role="main"]');
    expect(main).not.toBeNull();
    // KpiStrip's own useActiveSeason() 'error' Banner (SupabaseNotConfiguredError
    // in this unconfigured test environment -- module doc above) proves the
    // component is genuinely mounted and rendering, not merely present in
    // source. It must appear BEFORE the page marker in DOM order, matching
    // `AppShell.tsx`'s own `<KpiStrip />{children}` JSX order.
    const html = main!.innerHTML;
    const kpiErrorIndex = html.indexOf("Couldn't load the active season");
    const markerIndex = html.indexOf(PAGE_MARKER_TEXT);
    expect(kpiErrorIndex).toBeGreaterThan(-1);
    expect(markerIndex).toBeGreaterThan(-1);
    expect(kpiErrorIndex).toBeLessThan(markerIndex);
  });

  it('never renders KpiStrip content for a non-staff (or not-yet-resolved) session on a normal route', async () => {
    renderAt(routePaths.dashboard, null);
    await flushMicrotasks();
    const main = container.querySelector('[role="main"]');
    expect(main).not.toBeNull();
    expect(main?.textContent).not.toContain("Couldn't load the active season");
    expect(main?.textContent).toContain(PAGE_MARKER_TEXT);
  });
});
