// @vitest-environment jsdom
/**
 * T029: tests for `SeasonSettings.tsx`. T091 (ED-1 Packet P4) UPDATE: adds
 * coverage for the now-real `loadData`/`onCreateSeason`/`onUpdateSeason`/
 * `onSetActiveSeason` defaults (`../../lib/supabase/loaders/seasons.ts`) and
 * for `useActiveSeason().refresh()` being called after a successful
 * activate -- every render-level test below now also wraps in a scoped fake
 * `<SeasonProvider>` (module doc below), since `SeasonSettings` calls
 * `useActiveSeason()` unconditionally now.
 *
 * Per this task's Allowed Files ("A colocated `SeasonSettings.test.tsx` is
 * acceptable per established precedent") this is a deliberate, disclosed
 * addition, the same class of addition `StudentsTab.test.tsx`/T022,
 * `ScheduleMeetingsDialog.test.tsx`/T031, and `AdminToggles.test.tsx`/T028
 * already made in this same batch -- existing specifically to produce the
 * packet's own "Required Worker Output" proof requirements:
 *
 *   1. Real proof of the AlertDialog-confirmed active-season switch (module
 *      doc #1 in `SeasonSettings.tsx`): the real `AlertDialog` opens with the
 *      correct deactivate-old/activate-new copy, and confirming it calls the
 *      injectable `onSetActiveSeason` with the correct single atomic
 *      payload, then flips exactly one row's "Active" state in the real
 *      rendered `Table` (never zero, never two).
 *   2. Real proof of client-side start-before-end date-range validation
 *      (module doc #4): both the pure `validateSeasonDateRange` function and
 *      a render-level proof that a picked-but-invalid range disables the
 *      form's confirm button and shows a real `DateRangeInput` `status`
 *      error.
 *   3. Real proof of the admin-only `RequireRole` gate (module doc #6): an
 *      unauthenticated/non-admin viewer is redirected away, only an `admin`
 *      sees the page.
 *   4. Real proof of the create/edit reusable-form decision (module doc #3):
 *      the SAME dialog pre-fills for edit and starts blank for create.
 *   5. T091: real proof `useActiveSeason().refresh()` is called exactly once
 *      after a successful activate (never on failure), and real proof of
 *      `../../lib/supabase/loaders/seasons.ts`'s `makeLoadSeasons`/
 *      `makeCreateSeason`/`makeUpdateSeason` against a stubbed
 *      `SupabaseClient` (same DI pattern `InvitesTab.test.tsx`/T087 already
 *      established for `loaders/invites.ts`, which likewise has no dedicated
 *      test file of its own).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file in this batch already established:
 *   - `AdminToggles.test.tsx`/T028's own `AuthProvider` + `LoginAs`
 *     role-login harness (needed here too, since `SeasonSettings` nests
 *     `RequireRole`, which reads `useAuth()`), including its
 *     render-in-`useEffect`-not-render-phase timing fix
 *     (`LiveConsole.test.tsx`/T033's own documented reason: a render-phase
 *     `login()` call would let `RequireRole` observe one `user === null`
 *     render and permanently `<Navigate>` away before the corrected
 *     re-render ever runs).
 *   - `StudentsTab.test.tsx`/T022's own scoped `MoreMenu` helpers
 *     (`openMoreMenuFor`/`menuItemTexts`/`clickMenuItem`) -- necessarily
 *     reimplemented locally since `StudentsTab.test.tsx` is a forbidden file
 *     for this task (roster/** is read-only reference only).
 *   - `ScheduleMeetingsDialog.test.tsx`/T031's own `getFieldControl` /
 *     `setNativeInputValue` helpers (Astryx `Field` renders a real
 *     `<label htmlFor={id}>` for every labeled input) and its real
 *     `DateRangeInput` popover + `presets` quick-pick interaction path.
 *   - `MeetingsList.test.tsx`/T030's originally-established
 *     `HTMLDialogElement.showModal` jsdom polyfill (this repo's installed
 *     jsdom does not implement it), needed here for BOTH `Dialog` (the
 *     create/edit form) and `AlertDialog` (the active-season switch).
 *
 * T091: `renderSeasonSettings` below additionally wraps every render in a
 * scoped fake `<SeasonProvider loadActiveSeason={...}>` (same "nearest
 * ancestor context wins" trick `../../test-utils/authHarness.tsx`'s own
 * `LoginAs` already uses for `AuthProvider`) -- `src/test-utils/**` is a
 * forbidden/read-only directory for this task, so this fake is defined
 * locally here rather than extracted to a shared harness file (the same
 * "necessarily reimplemented locally" posture this file's own module doc
 * already applies to `StudentsTab.test.tsx`'s `MoreMenu` helpers above).
 * Defaults to an immediately-resolving `'none'` season (no test in this file
 * depends on a specific `useActiveSeason()`-resolved value except the
 * dedicated "refresh" describe block below, which overrides it explicitly).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import {
  makeCreateSeason,
  makeLoadSeasons,
  makeUpdateSeason,
} from '../../lib/supabase/loaders/seasons';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import {
  buildCreateSeasonPayload,
  buildUpdateSeasonPayload,
  computeActivateConfirmCopy,
  computeCurrentSchoolYearRange,
  computeSeasonFormConfirmLabel,
  isSeasonFormValid,
  SeasonSettings,
  validateSeasonDateRange,
  withActiveSeason,
  type LoadSeasonsFn,
  type SeasonFormValues,
  type SeasonRow,
} from './SeasonSettings';

/** T091: never resolves a ready season -- the harness default (module doc
 * above); tests that care about a specific `useActiveSeason()` value pass
 * their own `loadActiveSeason` override to `renderSeasonSettings`. */
const NEVER_ACTIVE_SEASON: LoadActiveSeasonFn = async () => null;

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog`/`AlertDialog` render a native `<dialog>` and call
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same guarded, test-file-local polyfill
// `MeetingsList.test.tsx`/`StudentsTab.test.tsx`/`ScheduleMeetingsDialog
// .test.tsx` already established.
// ---------------------------------------------------------------------------
if (
  typeof HTMLDialogElement !== 'undefined' &&
  typeof HTMLDialogElement.prototype.showModal !== 'function'
) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.removeAttribute('open');
  };
}

// ---------------------------------------------------------------------------
// Render harness -- mirrors AdminToggles.test.tsx / LiveConsole.test.tsx.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };

// `LoginAsDeferred` (imported above, aliased to `LoginAs`) logs in via
// `useEffect` (not render-phase) and withholds `children` until login has
// actually taken effect -- avoids `RequireRole` observing one
// `user === null` render and permanently `<Navigate>`-ing away before login
// lands (`LiveConsole.test.tsx`/T033's own documented reasoning). T073b1
// extracted it into `src/test-utils/authHarness.tsx`.

function renderSeasonSettings(
  user: AuthUser | null,
  props: Parameters<typeof SeasonSettings>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = NEVER_ACTIVE_SEASON,
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/settings/season']}>
        <AuthProvider>
          <SeasonProvider loadActiveSeason={loadActiveSeason}>
            <Routes>
              <Route
                path="/settings/season"
                element={
                  user === null ? (
                    <SeasonSettings {...props} />
                  ) : (
                    <LoginAs user={user}>
                      <SeasonSettings {...props} />
                    </LoginAs>
                  )
                }
              />
              <Route path="/" element={<div data-testid="redirected-home" />} />
            </Routes>
          </SeasonProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Astryx `Field` renders a real `<label htmlFor={id}>` for every labeled
 * input (`ScheduleMeetingsDialog.test.tsx`/T031's own verified helper). */
function getFieldControl(labelText: string): HTMLElement {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((el) => el.textContent?.trim().startsWith(labelText));
  if (!label) {
    throw new Error(
      `No label found for "${labelText}". Labels present: ${labels.map((l) => l.textContent).join(' | ')}`,
    );
  }
  const forId = label.getAttribute('for');
  if (!forId) throw new Error(`Label "${labelText}" has no htmlFor`);
  const control = document.getElementById(forId);
  if (!control) throw new Error(`No control found for id "${forId}"`);
  return control;
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickButtonWithText(text: string): void {
  const button = findButtonByText(text);
  expect(button, `expected a <button> with text "${text}"`).toBeTruthy();
  clickButton(button as HTMLButtonElement);
}

/** Scoped `MoreMenu` helper -- `StudentsTab.test.tsx`/T022's own documented
 * jsdom finding: `MoreMenu` renders every row's item list into the DOM
 * unconditionally (native `popover="auto"` semantics), scoped only by the
 * trigger's own `aria-controls`. Necessarily reimplemented locally
 * (`StudentsTab.test.tsx` is a forbidden/read-only file for this task). */
function openMoreMenuFor(name: string): HTMLElement {
  const trigger = document.querySelector(`button[aria-label="Actions for ${name}"]`);
  expect(trigger, `expected a MoreMenu trigger for "${name}"`).toBeTruthy();
  clickButton(trigger as HTMLButtonElement);
  const menuId = trigger?.getAttribute('aria-controls') ?? null;
  const menu = menuId ? document.getElementById(menuId) : null;
  expect(menu, `expected a scoped menu element for "${name}"`).toBeTruthy();
  return menu as HTMLElement;
}

function menuItemTexts(menu: HTMLElement): string[] {
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function clickMenuItem(menu: HTMLElement, text: string): void {
  const item = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
    (el) => el.textContent?.trim() === text,
  );
  expect(item, `expected a menu item "${text}" within the scoped menu`).toBeTruthy();
  act(() => {
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

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

// ---------------------------------------------------------------------------
// Fixture data for render tests.
// ---------------------------------------------------------------------------

const TEST_SEASONS: SeasonRow[] = [
  {
    id: 'season-2025-2026',
    name: '2025-2026 Season',
    startsOn: '2025-08-01',
    endsOn: '2026-06-30',
    defaultGoalHours: 100,
    isActive: true,
  },
  {
    id: 'season-2024-2025',
    name: '2024-2025 Season',
    startsOn: '2024-08-01',
    endsOn: '2025-06-30',
    defaultGoalHours: 90,
    isActive: false,
  },
];

const testLoadData: LoadSeasonsFn = () => Promise.resolve(TEST_SEASONS.map((row) => ({ ...row })));

// ---------------------------------------------------------------------------
// Pure functions -- module docs #1/#3/#4.
// ---------------------------------------------------------------------------

describe('validateSeasonDateRange (module doc #4)', () => {
  it('is true only when start is strictly before end', () => {
    expect(validateSeasonDateRange({ start: '2025-08-01', end: '2026-06-30' })).toBe(true);
  });

  it('is false for a same-day range ("before," not "on or before")', () => {
    expect(validateSeasonDateRange({ start: '2025-08-01', end: '2025-08-01' })).toBe(false);
  });

  it('is false for an inverted range (end before start)', () => {
    expect(validateSeasonDateRange({ start: '2026-06-30', end: '2025-08-01' })).toBe(false);
  });

  it('is false for null (no range picked yet)', () => {
    expect(validateSeasonDateRange(null)).toBe(false);
  });
});

describe('isSeasonFormValid / buildCreateSeasonPayload / buildUpdateSeasonPayload', () => {
  const validValues: SeasonFormValues = {
    name: '2026-2027 Season',
    dateRange: { start: '2026-08-01', end: '2027-06-30' },
    defaultGoalHours: 100,
  };

  it('is valid with a non-empty trimmed name, a valid range, and a non-negative goal', () => {
    expect(isSeasonFormValid(validValues)).toBe(true);
    expect(buildCreateSeasonPayload(validValues)).toEqual({
      name: '2026-2027 Season',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      defaultGoalHours: 100,
    });
  });

  it('is invalid with a blank/whitespace-only name', () => {
    const values = { ...validValues, name: '   ' };
    expect(isSeasonFormValid(values)).toBe(false);
    expect(buildCreateSeasonPayload(values)).toBeNull();
  });

  it('is invalid with an invalid (same-day) date range', () => {
    const values: SeasonFormValues = {
      ...validValues,
      dateRange: { start: '2026-08-01', end: '2026-08-01' },
    };
    expect(isSeasonFormValid(values)).toBe(false);
    expect(buildCreateSeasonPayload(values)).toBeNull();
  });

  it('is invalid with a null goal-hours value', () => {
    const values = { ...validValues, defaultGoalHours: null };
    expect(isSeasonFormValid(values)).toBe(false);
    expect(buildCreateSeasonPayload(values)).toBeNull();
  });

  it('buildUpdateSeasonPayload includes the id and returns null when invalid', () => {
    expect(buildUpdateSeasonPayload('season-x', validValues)).toEqual({
      id: 'season-x',
      name: '2026-2027 Season',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      defaultGoalHours: 100,
    });
    expect(buildUpdateSeasonPayload('season-x', { ...validValues, name: '' })).toBeNull();
  });
});

describe('computeSeasonFormConfirmLabel (module doc #3)', () => {
  it('is "Create season" for create mode and "Save changes" for edit mode', () => {
    expect(computeSeasonFormConfirmLabel('create')).toBe('Create season');
    expect(computeSeasonFormConfirmLabel('edit')).toBe('Save changes');
  });
});

describe('withActiveSeason (module doc #1 -- mirrors seasons_single_active_idx)', () => {
  it('flips exactly one row active and every other row inactive, never removing a row', () => {
    const result = withActiveSeason(TEST_SEASONS, 'season-2024-2025');
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === 'season-2024-2025')?.isActive).toBe(true);
    expect(result.find((r) => r.id === 'season-2025-2026')?.isActive).toBe(false);
    // Exactly one active row -- mirrors the DB partial unique index's own invariant.
    expect(result.filter((r) => r.isActive)).toHaveLength(1);
  });
});

describe('computeActivateConfirmCopy (module doc #1)', () => {
  it('names both the outgoing and incoming season when one is already active', () => {
    const copy = computeActivateConfirmCopy(TEST_SEASONS[0], TEST_SEASONS[1]);
    expect(copy.title).toContain('2024-2025 Season');
    expect(copy.description).toContain('2025-2026 Season');
    expect(copy.description).toContain('deactivated');
    expect(copy.description).toContain('2024-2025 Season');
  });

  it('has a "no other season is active" variant when nothing is currently active', () => {
    const copy = computeActivateConfirmCopy(null, TEST_SEASONS[1]);
    expect(copy.description).toContain('No other season is currently active');
  });
});

describe('computeCurrentSchoolYearRange (module doc #2 -- real DateRangeInput preset math)', () => {
  it('computes Aug 1 -> Jun 30 of the correct school year for today', () => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const startYear = currentMonth >= 8 ? currentYear : currentYear - 1;
    const endYear = startYear + 1;
    expect(computeCurrentSchoolYearRange()).toEqual({
      start: `${startYear}-08-01`,
      end: `${endYear}-06-30`,
    });
  });
});

// ---------------------------------------------------------------------------
// Admin-only RequireRole gate (module doc #6).
// ---------------------------------------------------------------------------

describe('<SeasonSettings /> admin-only gate', () => {
  // T073b2: `RequireRole` (`guards.tsx`) no longer redirects a role-denied
  // (or unauthenticated) viewer to "/" -- it renders a screen in place
  // instead (a real, disclosed behavior change; see that file's own module
  // doc). Both tests below still flush microtasks first -- auth resolution
  // (even the real default `authModule`'s own fail-safe-to-anonymous path
  // for the unauthenticated case, or the fake `authModule` `LoginAs`
  // injects for the coach case) is genuinely async, so `RequireRole`
  // renders nothing (`isLoading`) until that resolves.
  //
  // T078: T076 (Passed) subsequently corrected `RequireRole`'s role-mismatch
  // branch to render `AccessDeniedPage`, not `NoAccessPage` -- `NoAccessPage`
  // is for AUTH-04's distinct no-profile case, and both tests below now
  // assert `AccessDeniedPage`'s own real `EmptyState` title instead of the
  // stale `NoAccessPage` copy they originally targeted.
  //
  // The "unauthenticated viewer" test immediately below is a special case
  // worth flagging explicitly (not silently papering over). `renderSeason
  // Settings(null, ...)` renders `<SeasonSettings />` directly under a real
  // `<AuthProvider>` with NO wrapping `<RequireAuth>` -- unlike the real
  // app's router, where `/settings` is always wrapped in `<RequireAuth>`
  // (see `router.tsx`), so `SeasonSettings`'s own internal
  // `RequireRole(['admin'])` (its own module doc #6) never actually
  // observes `user === null` in production: `RequireAuth` would already
  // have redirected a genuinely unauthenticated visitor to `/login` first.
  // So this test exercises `RequireRole`'s own documented defensive
  // fallback for being used STANDALONE with no authenticated user
  // (`guards.tsx`'s own module doc: "it still degrades safely... if used
  // standalone with no authenticated user") -- a scenario that cannot occur
  // in the real running app. This matters because `AccessDeniedPage`'s real
  // description text ("You're signed in and your account is fine...") would
  // be factually WRONG for a genuinely unauthenticated visitor (there is no
  // session at all in that case). To avoid asserting on copy known to be
  // inaccurate for this one contrived, non-production-reachable path, this
  // test -- like the other three role-guard tests in this file/
  // `LiveConsole.test.tsx`/`ParentsTab.test.tsx` -- only asserts
  // `AccessDeniedPage`'s TITLE ("This page isn't part of your role"), never
  // its description; the title makes no claim about session state, so it
  // stays accurate even for this edge case.
  it('renders AccessDeniedPage for an unauthenticated viewer (RequireRole standalone fallback), not a redirect', async () => {
    renderSeasonSettings(null, { loadData: testLoadData });
    await flushMicrotasks();
    expect(document.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Season settings');
  });

  it('renders AccessDeniedPage for a non-admin (coach) viewer, not a redirect', async () => {
    renderSeasonSettings(COACH_USER, { loadData: testLoadData });
    await flushMicrotasks();
    expect(document.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Season settings');
  });

  it('renders the real page for an admin viewer', async () => {
    renderSeasonSettings(ADMIN_USER, { loadData: testLoadData });
    await flushMicrotasks();
    expect(container.textContent).toContain('Season settings');
    expect(container.textContent).toContain('2025-2026 Season');
  });
});

// ---------------------------------------------------------------------------
// DES-12 states + populated table proof.
// ---------------------------------------------------------------------------

describe('<SeasonSettings /> DES-12 states', () => {
  it('shows a loading Skeleton (T081: table has predictable dimensions) before data resolves', async () => {
    renderSeasonSettings(ADMIN_USER, { loadData: () => new Promise(() => {}) });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated, admin-gated body (and its own DES-12
    // loading state) mounts. See `src/test-utils/authHarness.tsx`'s module
    // doc.
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading seasons');
  });

  it('shows an error banner when loadData rejects', async () => {
    renderSeasonSettings(ADMIN_USER, { loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load seasons");
  });

  it('shows an empty state with a real "Create season" action when there are no seasons', async () => {
    renderSeasonSettings(ADMIN_USER, { loadData: () => Promise.resolve([]) });
    await flushMicrotasks();
    expect(container.textContent).toContain('No seasons yet');
    expect(findButtonByText('Create season')).toBeDefined();
  });

  it('renders both seasons with exactly one "Active" badge', async () => {
    renderSeasonSettings(ADMIN_USER, { loadData: testLoadData });
    await flushMicrotasks();
    expect(container.textContent).toContain('2025-2026 Season');
    expect(container.textContent).toContain('2024-2025 Season');
    expect(container.textContent).toContain('2025-08-01 to 2026-06-30');
    expect(container.textContent).toContain('90 hrs');

    // Exactly one row's MoreMenu omits "Set active" (the currently-active one).
    const activeMenu = openMoreMenuFor('2025-2026 Season');
    expect(menuItemTexts(activeMenu)).not.toContain('Set active');
    const inactiveMenu = openMoreMenuFor('2024-2025 Season');
    expect(menuItemTexts(inactiveMenu)).toContain('Set active');
  });
});

// ---------------------------------------------------------------------------
// AlertDialog-confirmed active-season switch (module doc #1) -- the packet's
// central required proof.
// ---------------------------------------------------------------------------

describe('<SeasonSettings /> Set active season (AlertDialog, module doc #1)', () => {
  it('opens a real AlertDialog naming both seasons, and confirming calls onSetActiveSeason with the single atomic payload, flipping exactly one row', async () => {
    const onSetActiveSeason = vi.fn().mockResolvedValue(undefined);
    renderSeasonSettings(ADMIN_USER, { loadData: testLoadData, onSetActiveSeason });
    await flushMicrotasks();

    const menu = openMoreMenuFor('2024-2025 Season');
    clickMenuItem(menu, 'Set active');

    // Real AlertDialog open, naming BOTH the outgoing and incoming seasons --
    // never a generic "Are you sure?".
    expect(document.body.textContent).toContain('Set "2024-2025 Season" as the active season?');
    expect(document.body.textContent).toContain('2025-2026 Season');
    expect(document.body.textContent).toContain('deactivated');

    // Not called until the AlertDialog's own action button is clicked.
    expect(onSetActiveSeason).not.toHaveBeenCalled();

    // The AlertDialog's own action <button>, not the menuitem <div> (StudentsTab
    // .test.tsx/T022's own established distinction, reimplemented locally).
    clickButtonWithText('Set active');
    await flushMicrotasks();

    // ONE payload naming both seasons -- the atomicity contract (module doc #1).
    expect(onSetActiveSeason).toHaveBeenCalledTimes(1);
    expect(onSetActiveSeason).toHaveBeenCalledWith({
      activateSeasonId: 'season-2024-2025',
      deactivateSeasonId: 'season-2025-2026',
    });

    // Exactly one row is active afterward, and it swapped correctly.
    const nowActiveMenu = openMoreMenuFor('2024-2025 Season');
    expect(menuItemTexts(nowActiveMenu)).not.toContain('Set active');
    const nowInactiveMenu = openMoreMenuFor('2025-2026 Season');
    expect(menuItemTexts(nowInactiveMenu)).toContain('Set active');
  });

  it('shows the "no other season active" copy when activating the first-ever season', async () => {
    const onSetActiveSeason = vi.fn().mockResolvedValue(undefined);
    const oneInactiveSeason: SeasonRow[] = [
      {
        id: 'season-only',
        name: 'Only Season',
        startsOn: '2026-08-01',
        endsOn: '2027-06-30',
        defaultGoalHours: 100,
        isActive: false,
      },
    ];
    renderSeasonSettings(ADMIN_USER, {
      loadData: () => Promise.resolve(oneInactiveSeason),
      onSetActiveSeason,
    });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Only Season'), 'Set active');
    expect(document.body.textContent).toContain('No other season is currently active');

    clickButtonWithText('Set active');
    await flushMicrotasks();
    expect(onSetActiveSeason).toHaveBeenCalledWith({
      activateSeasonId: 'season-only',
      deactivateSeasonId: null,
    });
  });

  it('shows an error banner and leaves state unchanged when onSetActiveSeason rejects', async () => {
    const onSetActiveSeason = vi.fn().mockRejectedValue(new Error('network down'));
    renderSeasonSettings(ADMIN_USER, { loadData: testLoadData, onSetActiveSeason });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('2024-2025 Season'), 'Set active');
    clickButtonWithText('Set active');
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't switch the active season");
    expect(container.textContent).toContain('network down');

    // Unchanged: the original active season is still the only active one.
    const stillInactiveMenu = openMoreMenuFor('2024-2025 Season');
    expect(menuItemTexts(stillInactiveMenu)).toContain('Set active');
  });

  // ---------------------------------------------------------------------------
  // T091 module doc #9: `useActiveSeason().refresh()` on success only.
  // ---------------------------------------------------------------------------
  it('T091: calls useActiveSeason().refresh() exactly once after a successful activate', async () => {
    const onSetActiveSeason = vi.fn().mockResolvedValue(undefined);
    const loadActiveSeason = vi.fn<LoadActiveSeasonFn>(async () => null);
    renderSeasonSettings(
      ADMIN_USER,
      { loadData: testLoadData, onSetActiveSeason },
      loadActiveSeason,
    );
    await flushMicrotasks();
    // One call already happened on mount (SeasonProvider's own initial fetch).
    expect(loadActiveSeason).toHaveBeenCalledTimes(1);

    clickMenuItem(openMoreMenuFor('2024-2025 Season'), 'Set active');
    clickButtonWithText('Set active');
    await flushMicrotasks();

    // refresh() re-runs SeasonProvider's own loadActiveSeason effect --
    // a second call proves refresh() was actually invoked, not just that the
    // activate succeeded.
    expect(loadActiveSeason).toHaveBeenCalledTimes(2);
  });

  it('T091: does NOT call useActiveSeason().refresh() when onSetActiveSeason rejects', async () => {
    const onSetActiveSeason = vi.fn().mockRejectedValue(new Error('network down'));
    const loadActiveSeason = vi.fn<LoadActiveSeasonFn>(async () => null);
    renderSeasonSettings(
      ADMIN_USER,
      { loadData: testLoadData, onSetActiveSeason },
      loadActiveSeason,
    );
    await flushMicrotasks();
    expect(loadActiveSeason).toHaveBeenCalledTimes(1);

    clickMenuItem(openMoreMenuFor('2024-2025 Season'), 'Set active');
    clickButtonWithText('Set active');
    await flushMicrotasks();

    // Still just the one mount-time call -- failure must not force a refresh
    // (module doc #9's own disclosed reasoning).
    expect(loadActiveSeason).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Create/edit reusable form (module doc #3) + date-range validation
// (module doc #4) render-level proof.
// ---------------------------------------------------------------------------

describe('<SeasonSettings /> Create season (module docs #2/#3/#4)', () => {
  it('disables "Create season" until name + a valid date range are set, then submits the correct payload', async () => {
    // T091: `onCreateSeason` now resolves the CREATED row (with a real
    // DB-generated id), not `void` -- mirrors what `createSeason`
    // (`../../lib/supabase/loaders/seasons.ts`) actually returns.
    const onCreateSeason = vi.fn().mockImplementation(async (payload: unknown) => ({
      id: 'season-db-generated-id',
      ...(payload as Record<string, unknown>),
      isActive: false,
    }));
    renderSeasonSettings(ADMIN_USER, { loadData: testLoadData, onCreateSeason });
    await flushMicrotasks();

    clickButtonWithText('Create season');
    // Real dialog rendered, not just the page header button re-checked.
    expect(getFieldControl('Season name')).toBeTruthy();

    // Two "Create season" buttons now exist (page header + dialog footer) --
    // `Dialog` renders a real native `<dialog>` element, so scope every
    // subsequent confirm-button lookup to inside it. Without this scoping,
    // the page header's own (never-disabled) "Create season" button would
    // be indistinguishable by label alone once the dialog's own confirm
    // button becomes enabled too.
    const dialogEl = document.querySelector('dialog');
    expect(dialogEl, 'expected a real <dialog> element').toBeTruthy();
    function findDialogConfirmButton(isDisabled: boolean): HTMLButtonElement | undefined {
      return Array.from(dialogEl!.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim() === 'Create season' && btn.disabled === isDisabled,
      );
    }

    expect(findDialogConfirmButton(true), 'expected a disabled dialog confirm button').toBeTruthy();

    const nameInput = getFieldControl('Season name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, '2026-2027 Season');
    });

    // Name alone (no date range yet) still leaves it disabled.
    expect(findDialogConfirmButton(true), 'still disabled with no date range').toBeTruthy();

    // Open the real DateRangeInput popover and use its documented `presets`
    // quick-pick ("Current school year", this file's own preset) -- the same
    // interaction path a real admin performs.
    const rangeTrigger = getFieldControl('Season dates') as HTMLButtonElement;
    clickButton(rangeTrigger);
    const presetButton = findButtonByText('Current school year');
    expect(presetButton).toBeDefined();
    clickButton(presetButton as HTMLButtonElement);

    const confirmButton = findDialogConfirmButton(false);
    expect(confirmButton, 'expected an enabled dialog confirm button').toBeTruthy();

    const expectedRange = computeCurrentSchoolYearRange();

    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(onCreateSeason).toHaveBeenCalledTimes(1);
    expect(onCreateSeason).toHaveBeenCalledWith({
      name: '2026-2027 Season',
      startsOn: expectedRange.start,
      endsOn: expectedRange.end,
      defaultGoalHours: 100,
    });

    // The new row shows up in the real table after the dialog closes, using
    // the real DB-generated id `onCreateSeason` returned (T091) -- proven
    // via the row's "Set active"/"Edit" menu still resolving correctly for
    // it, not just its visible name text.
    expect(container.textContent).toContain('2026-2027 Season');
    const newRowMenu = openMoreMenuFor('2026-2027 Season');
    expect(menuItemTexts(newRowMenu)).toContain('Set active');
  });

  it('T091: uses the real onCreateSeason-returned id, never the old client-side "season-local-" placeholder', async () => {
    const onCreateSeason = vi.fn().mockResolvedValue({
      id: 'season-real-db-id-123',
      name: 'Brand New Season',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      defaultGoalHours: 100,
      isActive: false,
    });
    renderSeasonSettings(ADMIN_USER, { loadData: () => Promise.resolve([]), onCreateSeason });
    await flushMicrotasks();

    clickButtonWithText('Create season');
    const nameInput = getFieldControl('Season name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(nameInput, 'Brand New Season');
    });
    const rangeTrigger = getFieldControl('Season dates') as HTMLButtonElement;
    clickButton(rangeTrigger);
    clickButton(findButtonByText('Current school year') as HTMLButtonElement);
    const dialogEl = document.querySelector('dialog');
    const confirmButton = Array.from(dialogEl!.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Create season' && !btn.disabled,
    );
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Brand New Season');
    // No stand-in local id was ever generated for this real create.
    expect(container.innerHTML).not.toContain('season-local-');
  });
});

describe('<SeasonSettings /> Edit season (module doc #3 -- same reusable form, pre-filled)', () => {
  it('pre-fills the existing values and submits an update payload with the row id', async () => {
    const onUpdateSeason = vi.fn().mockResolvedValue(undefined);
    renderSeasonSettings(ADMIN_USER, { loadData: testLoadData, onUpdateSeason });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('2024-2025 Season'), 'Edit');
    expect(document.body.textContent).toContain('Edit season');

    const nameInput = getFieldControl('Season name') as HTMLInputElement;
    expect(nameInput.value).toBe('2024-2025 Season');

    // Already valid (pre-filled with a real, valid range) -- the "Save
    // changes" confirm button starts enabled, unlike create mode.
    const confirmButton = findButtonByText('Save changes');
    expect(confirmButton).toBeDefined();
    expect(confirmButton?.disabled).toBe(false);

    act(() => {
      setNativeInputValue(nameInput, 'Renamed Season');
    });

    clickButtonWithText('Save changes');
    await flushMicrotasks();

    expect(onUpdateSeason).toHaveBeenCalledTimes(1);
    expect(onUpdateSeason).toHaveBeenCalledWith({
      id: 'season-2024-2025',
      name: 'Renamed Season',
      startsOn: '2024-08-01',
      endsOn: '2025-06-30',
      defaultGoalHours: 90,
    });

    expect(container.textContent).toContain('Renamed Season');
    expect(container.textContent).not.toContain('2024-2025 Season');
  });
});

// ---------------------------------------------------------------------------
// T091 (ED-1 Packet P4): real `loadData`/`onCreateSeason`/`onUpdateSeason`
// seams -- `../../lib/supabase/loaders/seasons.ts`'s `makeLoadSeasons`/
// `makeCreateSeason`/`makeUpdateSeason`. Stubbed `SupabaseClient` only, same
// DI pattern as `InvitesTab.test.tsx`'s own loader-level tests (that module
// likewise has no dedicated test file of its own). `makeSetActiveSeason`'s
// own two-step-mutation tests (including the Trap #1 failure-midway
// scenario) live in `SeasonProvider.test.tsx` per the worker packet's own
// explicit instruction, not duplicated here.
// ---------------------------------------------------------------------------

function makeFakeSelectOrderClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  selectSpy: ReturnType<typeof vi.fn>;
  orderSpy: ReturnType<typeof vi.fn>;
} {
  const orderSpy = vi.fn().mockResolvedValue(result);
  const selectSpy = vi.fn(() => ({ order: orderSpy }));
  const fromSpy = vi.fn(() => ({ select: selectSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, selectSpy, orderSpy };
}

describe('makeLoadSeasons (T091 real load)', () => {
  it('queries seasons ordered by starts_on desc and maps snake_case DB rows to the local camelCase SeasonRow (dropping created_at)', async () => {
    const dbRows = [
      {
        id: 'season-db-1',
        name: '2025-2026 Season',
        starts_on: '2025-08-01',
        ends_on: '2026-06-30',
        default_goal_hours: 100,
        is_active: true,
        created_at: '2025-07-01T00:00:00.000Z',
      },
    ];
    const { client, fromSpy, selectSpy, orderSpy } = makeFakeSelectOrderClient({
      data: dbRows,
      error: null,
    });
    const load = makeLoadSeasons(() => client);

    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    expect(selectSpy).toHaveBeenCalledWith('*');
    expect(orderSpy).toHaveBeenCalledWith('starts_on', { ascending: false });
    // created_at is deliberately dropped (Trap #3 decision) -- everything
    // else is a 1:1 camelCase rename; the mapped row has no `createdAt` key.
    expect(result).toEqual([
      {
        id: 'season-db-1',
        name: '2025-2026 Season',
        startsOn: '2025-08-01',
        endsOn: '2026-06-30',
        defaultGoalHours: 100,
        isActive: true,
      },
    ]);
    expect(Object.keys(result[0])).not.toContain('createdAt');
  });

  it('bridges the "no rows" (data: null, error: null) case to an empty array, not a crash', async () => {
    const { client } = makeFakeSelectOrderClient({ data: null, error: null });
    const load = makeLoadSeasons(() => client);

    expect(await load()).toEqual([]);
  });

  it('rejects with the real SupabaseLoaderError on a genuine query error -- no fixture fallback', async () => {
    const { client } = makeFakeSelectOrderClient({
      data: null,
      error: { message: 'permission denied for table seasons', code: '42501' },
    });
    const load = makeLoadSeasons(() => client);

    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('seasons').insert({...}).select().single()`. */
function makeFakeInsertClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  insertSpy: ReturnType<typeof vi.fn>;
  selectSpy: ReturnType<typeof vi.fn>;
  singleSpy: ReturnType<typeof vi.fn>;
} {
  const singleSpy = vi.fn().mockResolvedValue(result);
  const selectSpy = vi.fn(() => ({ single: singleSpy }));
  const insertSpy = vi.fn(() => ({ select: selectSpy }));
  const fromSpy = vi.fn(() => ({ insert: insertSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, insertSpy, selectSpy, singleSpy };
}

describe('makeCreateSeason (T091 real create)', () => {
  it('inserts with is_active: false always, and returns the created row with its real id', async () => {
    const createdDbRow = {
      id: 'season-real-id',
      name: '2026-2027 Season',
      starts_on: '2026-08-01',
      ends_on: '2027-06-30',
      default_goal_hours: 100,
      is_active: false,
      created_at: '2026-07-01T00:00:00.000Z',
    };
    const { client, fromSpy, insertSpy } = makeFakeInsertClient({
      data: createdDbRow,
      error: null,
    });
    const create = makeCreateSeason(() => client);

    const result = await create({
      name: '2026-2027 Season',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      defaultGoalHours: 100,
    });

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    expect(insertSpy).toHaveBeenCalledWith({
      name: '2026-2027 Season',
      starts_on: '2026-08-01',
      ends_on: '2027-06-30',
      default_goal_hours: 100,
      is_active: false,
    });
    expect(result).toEqual({
      id: 'season-real-id',
      name: '2026-2027 Season',
      startsOn: '2026-08-01',
      endsOn: '2027-06-30',
      defaultGoalHours: 100,
      isActive: false,
    });
  });

  it('rejects with the real SupabaseLoaderError on a genuine insert error', async () => {
    const { client } = makeFakeInsertClient({
      data: null,
      error: { message: 'permission denied for table seasons', code: '42501' },
    });
    const create = makeCreateSeason(() => client);

    await expect(
      create({ name: 'X', startsOn: '2026-08-01', endsOn: '2027-06-30', defaultGoalHours: 100 }),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('seasons').update({...}).eq('id', ...)`. */
function makeFakeUpdateClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  updateSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
} {
  const eqSpy = vi.fn().mockResolvedValue(result);
  const updateSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ update: updateSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, updateSpy, eqSpy };
}

describe('makeUpdateSeason (T091 real update)', () => {
  it('updates name/dates/defaultGoalHours only -- never touches is_active', async () => {
    const { client, fromSpy, updateSpy, eqSpy } = makeFakeUpdateClient({ data: null, error: null });
    const update = makeUpdateSeason(() => client);

    await update({
      id: 'season-2024-2025',
      name: 'Renamed Season',
      startsOn: '2024-08-01',
      endsOn: '2025-06-30',
      defaultGoalHours: 90,
    });

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    expect(updateSpy).toHaveBeenCalledWith({
      name: 'Renamed Season',
      starts_on: '2024-08-01',
      ends_on: '2025-06-30',
      default_goal_hours: 90,
    });
    // Deliberately no is_active key anywhere in the update payload.
    expect(Object.keys(updateSpy.mock.calls[0][0])).not.toContain('is_active');
    expect(eqSpy).toHaveBeenCalledWith('id', 'season-2024-2025');
  });

  it('rejects with the real SupabaseLoaderError on a genuine update error', async () => {
    const { client } = makeFakeUpdateClient({
      data: null,
      error: { message: 'permission denied for table seasons', code: '42501' },
    });
    const update = makeUpdateSeason(() => client);

    await expect(
      update({
        id: 'season-x',
        name: 'X',
        startsOn: '2026-08-01',
        endsOn: '2027-06-30',
        defaultGoalHours: 100,
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
