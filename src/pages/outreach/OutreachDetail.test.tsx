// @vitest-environment jsdom
/**
 * T041: tests for `OutreachDetail.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `OutreachList.test.tsx`/T038,
 * `RsvpControl.test.tsx`/T040, `LiveConsole.test.tsx`/T033 already
 * established) -- it exists to produce this task's own packet's "Required
 * Worker Output" proof requirements:
 *
 *   1. The invalid-ID DES-12 error state reveals NOTHING else (no
 *      MetadataList, no signup lists, no other event data anywhere in the
 *      container).
 *   2. The "Copy link" `Toast` fires the literal "Link copied" text and the
 *      constructed URL is correct -- honestly NOT asserting a real
 *      clipboard read-back (see module doc #6 of the component file).
 *   3. Per-session Going/Maybe/Can't go/No response grouping is correct,
 *      including the team-scoped roster diff (an out-of-scope student never
 *      appears at all, not even in "No response").
 *   4. MetadataList when/where/scope/creator content, the plain
 *      URL-encoded Google Maps link, and the Edit/Cancel MoreMenu stubs.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern every sibling test file in this batch already established, plus
 * `LiveConsole.test.tsx`'s own `MemoryRouter`/`Routes`/`Route` wrapper
 * (needed here too, since this component reads `useParams()`, which only
 * resolves against an actually-matched route).
 *
 * -----------------------------------------------------------------------
 * T117 (PRD v2 UXP-01) UPDATE: adds coverage for the new staff-only
 * `<AttendancePanel>` wiring (component module doc #11) -- role gating
 * (no user / student never see it, coach/admin do) plus an end-to-end
 * data-threading proof (`roster`/`sessions`/`teams`/`currentUserProfileId`
 * genuinely reach the panel) via a module-level `vi.mock` of
 * `../../lib/supabase/loaders/attendance` (same `importOriginal` partial-
 * mock pattern `StudentsTab.test.tsx` already established for
 * `invokeEdgeFunction`) -- `AttendancePanel.tsx`'s OWN test file
 * (`AttendancePanel.test.tsx`) is the authority for that component's
 * internal toggle/hours-edit/un-mark behavior, not duplicated here.
 *
 * -----------------------------------------------------------------------
 * T127 (PRD v2 UXP-07) UPDATE: adds coverage for the new staff-only
 * "Mark event complete" `MoreMenu` item + `<MarkEventCompleteDialog>` wiring
 * (component module doc #12) -- role gating (no user / student never see
 * the item, coach/admin do), and an end-to-end proof that confirming the
 * dialog drives the real `markDayComplete` mutation once per remaining
 * session and reloads this page's own data. Same `importOriginal`
 * partial-mock pattern the `attendance` loader mock above already
 * established, applied here to `../../lib/supabase/loaders/outreach`'s own
 * `markDayComplete` export (the exact shared mutation
 * `MarkEventCompleteDialog.tsx`'s own module doc #1 documents driving) --
 * `MarkEventCompleteDialog.test.tsx` is the authority for that component's
 * own internal partial-failure/summary behavior, not duplicated here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import {
  makeCancelOutreachEvent,
  makeLoadOutreachDetail,
  markDayComplete,
} from '../../lib/supabase/loaders/outreach';
import { loadAttendanceForSessions, upsertAttendance } from '../../lib/supabase/loaders/attendance';
import {
  buildGoogleMapsUrl,
  buildInitialOutreachEvent,
  buildOutreachDetailUrl,
  copyTextToClipboard,
  defaultLoadOutreachDetail,
  deriveExpectedStudentIds,
  formatChicagoWallTime,
  formatScopeLabel,
  groupSessionSignups,
  OutreachDetail,
  resolveCreatorName,
  resolveEventRoster,
  type OutreachDetailData,
  type OutreachDetailSession,
  type RosterStudent,
  type RsvpRow,
  type TeamOption,
} from './OutreachDetail';

// T117 (module doc above) -- partial mock so the new `<AttendancePanel>`
// (rendered with no override props from `OutreachDetail.tsx` -- it has none
// to give it, by design) never hits a real, unconfigured Supabase client in
// this test environment. T121 item (c) fix: `resolveUnmarkAction` does not
// exist in `../../lib/supabase/loaders/attendance.ts` (grep-confirmed --
// that file's only exported pure decision function is
// `resolveAttendanceWriteMethod`); the stale reference to it here has been
// removed. Pure decision functions (`resolveAttendanceWriteMethod`) are kept
// REAL via `importOriginal` -- only the three IO functions are replaced. Same
// `importOriginal` partial-mock + `vi.mocked(...)` convention
// `StudentsTab.test.tsx` already established for `invokeEdgeFunction`.
vi.mock('../../lib/supabase/loaders/attendance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/attendance')>();
  return {
    ...actual,
    loadAttendanceForSessions: vi.fn(async () => []),
    upsertAttendance: vi.fn(),
    removeAttendance: vi.fn(),
  };
});

const mockedLoadAttendanceForSessions = vi.mocked(loadAttendanceForSessions);
const mockedUpsertAttendance = vi.mocked(upsertAttendance);

// T127 (module doc above) -- same `importOriginal` partial-mock convention,
// applied here so `<MarkEventCompleteDialog>`'s own default
// `onMarkSessionComplete` (baked to `markDayComplete` at that file's own
// import time, module doc #12) never hits a real, unconfigured Supabase
// client in this test environment. Every other real export of this module
// (`loadOutreachDetail`, `makeLoadOutreachDetail`, `cancelOutreachEvent`,
// `makeCancelOutreachEvent`, `saveOutreachEvent`, etc.) stays real -- this
// file's own pre-existing tests always pass explicit `loadData`/
// `onSaveEvent`/`onCancelEvent` props anyway, so only `markDayComplete`
// (which `OutreachDetail.tsx` never overrides, by design -- module doc #12)
// needs mocking.
vi.mock('../../lib/supabase/loaders/outreach', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/outreach')>();
  return {
    ...actual,
    markDayComplete: vi.fn(async () => {}),
  };
});

const mockedMarkDayComplete = vi.mocked(markDayComplete);

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog`/`AlertDialog` render a native `<dialog>` and call
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `MeetingsList.test.tsx` (T096)
// already hit and locally polyfilled; this is the first time THIS file
// renders a real `Dialog`/`AlertDialog` (`OutreachEventDialog`/T101's own
// cancel confirmation), so the same local override is needed here too.
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
// Render harness -- mirrors LiveConsole.test.tsx / RsvpControl.test.tsx.
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
  // T117 -- clears call history only (not the mock factory's own default
  // "resolves []" implementation) between tests that share this
  // module-level mock.
  mockedLoadAttendanceForSessions.mockClear();
  mockedUpsertAttendance.mockClear();
  // T127 -- same clear-only convention; individual tests that need a
  // rejection use `mockRejectedValueOnce`/`mockResolvedValueOnce`, which
  // `mockClear` (not `mockReset`) leaves the default resolved-undefined
  // implementation intact for.
  mockedMarkDayComplete.mockClear();
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

// T117 (PRD v2 UXP-01): `OutreachDetail` now calls `useAuth()`
// unconditionally (component module doc #11), so every render needs a real
// `<AuthProvider>` ancestor -- same harness update `OutreachList.test.tsx`'s
// own T101 wiring already made for this identical reason.
// `user = null` (the default) intentionally renders NO `<LoginAs>` at all --
// every PRE-EXISTING test below calls `renderDetail` without a `user`
// override, so they keep observing the exact same "no attendance panel,
// nothing role-gated" render this page produced before this task (T117's
// own new tests, further below, explicitly pass a `coach`/`admin`/`student`
// `AuthUser` to exercise the new gating).
const COACH_USER: AuthUser = { id: 'profile-coach-1', email: 'coach@example.com', role: 'coach' };
const ADMIN_USER: AuthUser = { id: 'profile-admin-1', email: 'admin@example.com', role: 'admin' };
const STUDENT_USER: AuthUser = {
  id: 'profile-student-1',
  email: 'student@example.com',
  role: 'student',
};

/** Renders `<OutreachDetail />` inside a real matched `/outreach/:eventId`
 * route so `useParams()` resolves, mirroring `LiveConsole.test.tsx`'s own
 * `renderBody` helper. */
function renderDetail(
  eventId: string,
  props: Parameters<typeof OutreachDetail>[0] = {},
  user: AuthUser | null = null,
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[`/outreach/${eventId}`]}>
        <AuthProvider>
          {user === null ? (
            <Routes>
              <Route path="/outreach/:eventId" element={<OutreachDetail {...props} />} />
            </Routes>
          ) : (
            <LoginAs user={user}>
              <Routes>
                <Route path="/outreach/:eventId" element={<OutreachDetail {...props} />} />
              </Routes>
            </LoginAs>
          )}
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

// ---------------------------------------------------------------------------
// 1. NAV-08/DES-12 -- invalid/inaccessible id reveals NOTHING.
// ---------------------------------------------------------------------------

describe('DES-12 "not found" state (NAV-08 -- reveal nothing)', () => {
  it('renders only the generic EmptyState, no event data anywhere', async () => {
    renderDetail('event-does-not-exist', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).toContain("This outreach event isn't available");
    expect(container.textContent).toContain(
      'It may have been removed, or you may not have access to it.',
    );

    // Nothing about the real fixture event(s) ever leaks into this render.
    expect(container.textContent).not.toContain('Community Food Bank Sort');
    expect(container.textContent).not.toContain('Riverside Food Bank');
    expect(container.textContent).not.toContain('100 Riverside Dr');
    expect(container.textContent).not.toContain('Amara Chen');
    expect(container.textContent).not.toContain('Jordan Owens');
    expect(container.textContent).not.toContain('Signups');
    expect(container.textContent).not.toContain('Going');
    expect(container.textContent).not.toContain('No response');
    expect(container.textContent).not.toContain('Event details');
    expect(container.textContent).not.toContain('Copy link');

    // No MetadataList/List DOM structure rendered at all in this state.
    expect(container.querySelector('dl')).toBeNull();
  });

  it('a genuinely rejected loadData (network failure) gets its own, separate error Banner -- never the same copy as "not found"', async () => {
    renderDetail('event-food-bank-sort', {
      loadData: () => Promise.reject(new Error('network down')),
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load this event");
    expect(container.textContent).not.toContain("isn't available");
  });

  it('loading state renders a Skeleton (T081: detail-page shape is predictable) before the load resolves', () => {
    renderDetail('event-food-bank-sort', {
      loadData: () => new Promise<OutreachDetailData | null>(() => {}),
    });
    expect(container.textContent).toContain('Loading event');
  });
});

// ---------------------------------------------------------------------------
// 2. Per-session Going/Maybe/Can't go/No response grouping -- the central
//    trap: "No response" diffed from the roster, never a fabricated status.
// ---------------------------------------------------------------------------

describe('groupSessionSignups -- roster-diff derivation, not a stored status', () => {
  const ROSTER: RosterStudent[] = [
    { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens' },
    { id: 's-2', name: 'Marcus Bello', teamId: 'team-ravens' },
    { id: 's-3', name: 'Nina Ortiz', teamId: 'team-ravens' },
  ];

  const RSVPS: RsvpRow[] = [
    {
      id: 'r-1',
      sessionId: 'session-1',
      studentId: 's-1',
      status: 'going',
      respondedBy: 's-1',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'r-2',
      sessionId: 'session-1',
      studentId: 's-2',
      status: 'declined',
      respondedBy: 's-2',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    // s-3 has no rsvp row at all for session-1.
  ];

  it('"declined" is a real answer (Can\'t go), distinct from no row at all (No response)', () => {
    const groups = groupSessionSignups('session-1', ROSTER, RSVPS);
    expect(groups.going.map((s) => s.id)).toEqual(['s-1']);
    expect(groups.maybe).toEqual([]);
    expect(groups.cantGo.map((s) => s.id)).toEqual(['s-2']);
    expect(groups.noResponse.map((s) => s.id)).toEqual(['s-3']);
  });

  it('a session with zero rsvp rows puts the entire roster in "No response"', () => {
    const groups = groupSessionSignups('session-with-no-rsvps', ROSTER, RSVPS);
    expect(groups.going).toEqual([]);
    expect(groups.maybe).toEqual([]);
    expect(groups.cantGo).toEqual([]);
    expect(groups.noResponse.map((s) => s.id)).toEqual(['s-1', 's-2', 's-3']);
  });
});

describe('resolveEventRoster -- events.team_ids NULL/array semantics', () => {
  const STUDENTS: RosterStudent[] = [
    { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens' },
    { id: 's-2', name: 'Sofia Delgado', teamId: 'team-titans' },
  ];

  it('team_ids === null resolves to every student (all teams)', () => {
    const roster = resolveEventRoster(
      {
        id: 'e-1',
        seasonId: 's',
        type: 'outreach',
        title: 't',
        description: '',
        locationName: '',
        address: '',
        teamIds: null,
        createdBy: null,
        countsParticipation: false,
        countsVolunteerHours: true,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
      },
      STUDENTS,
    );
    expect(roster.map((s) => s.id)).toEqual(['s-1', 's-2']);
  });

  it('a team-scoped event excludes out-of-scope students entirely', () => {
    const roster = resolveEventRoster(
      {
        id: 'e-1',
        seasonId: 's',
        type: 'outreach',
        title: 't',
        description: '',
        locationName: '',
        address: '',
        teamIds: ['team-ravens'],
        createdBy: null,
        countsParticipation: false,
        countsVolunteerHours: true,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
      },
      STUDENTS,
    );
    expect(roster.map((s) => s.id)).toEqual(['s-1']);
  });
});

// ---------------------------------------------------------------------------
// 3. Rendered proof: real fixture event, per-session grouping + team-scoped
//    roster exclusion.
// ---------------------------------------------------------------------------

describe('<OutreachDetail /> populated render -- per-session grouping (all-teams event)', () => {
  it('groups session-food-bank-day1 into all four buckets correctly', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    // Two sessions -> two independently-labeled SessionSignupList blocks
    // (module doc #4's per-session, not per-event, decision).
    expect(container.textContent).toContain('Aug 2');
    expect(container.textContent).toContain('Aug 9');

    expect(container.textContent).toContain('Amara Chen');
    expect(container.textContent).toContain('Marcus Bello');
    expect(container.textContent).toContain('Sofia Delgado');
    expect(container.textContent).toContain('Nina Ortiz');
    expect(container.textContent).toContain('Ravi Kapoor');

    // Bucket counts for session-food-bank-day1 specifically.
    expect(container.textContent).toContain('Going (1)');
    expect(container.textContent).toContain('Maybe (1)');
    expect(container.textContent).toContain("Can't go (1)");
    // Two sessions each have a "No response (N)" bucket; day1's is (2).
    expect(container.textContent).toContain('No response (2)');
    // day2's own No-response bucket (Amara/Marcus/Sofia unanswered) is (3).
    expect(container.textContent).toContain('No response (3)');
  });
});

describe('<OutreachDetail /> populated render -- team-scoped roster exclusion', () => {
  it('a Titans student never appears anywhere on a Ravens-only-scoped event page', async () => {
    renderDetail('event-park-cleanup', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).toContain('Amara Chen'); // Ravens, going
    expect(container.textContent).toContain('Nina Ortiz'); // Ravens, declined -> Can't go
    expect(container.textContent).toContain('Marcus Bello'); // Ravens, no rsvp -> No response
    expect(container.textContent).toContain('No response (1)');

    // Sofia Delgado / Ravi Kapoor are Titans -- entirely outside this
    // event's team-scoped roster, so they must not appear at all, not even
    // as "No response" entries.
    expect(container.textContent).not.toContain('Sofia Delgado');
    expect(container.textContent).not.toContain('Ravi Kapoor');
  });
});

// ---------------------------------------------------------------------------
// 4. MetadataList when/where/scope/creator.
// ---------------------------------------------------------------------------

describe('<OutreachDetail /> MetadataList content', () => {
  it('shows when/where/scope/creator for the all-teams fixture event', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).toContain('When');
    expect(container.textContent).toContain('Where');
    expect(container.textContent).toContain('Riverside Food Bank');
    expect(container.textContent).toContain('100 Riverside Dr, Suite #4');
    expect(container.textContent).toContain('Scope');
    expect(container.textContent).toContain('All teams');
    expect(container.textContent).toContain('Created by');
    expect(container.textContent).toContain('Jordan Owens');
  });

  it('team-scoped "Scope" shows the real team name, not raw ids', async () => {
    renderDetail('event-park-cleanup', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();
    expect(container.textContent).toContain('Ravens');
  });

  it('a null created_by falls back to "Unknown creator", never a blank render', async () => {
    renderDetail('event-park-cleanup', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();
    expect(container.textContent).toContain('Unknown creator');
  });

  it('resolveCreatorName / formatScopeLabel pure-function proof', () => {
    const TEAMS: TeamOption[] = [{ id: 'team-ravens', name: 'Ravens' }];
    expect(formatScopeLabel(null, TEAMS)).toBe('All teams');
    expect(formatScopeLabel(['team-ravens'], TEAMS)).toBe('Ravens');
    expect(formatScopeLabel(['team-unknown'], TEAMS)).toBe('No teams');
    expect(resolveCreatorName(null, [])).toBe('Unknown creator');
    expect(resolveCreatorName('profile-x', [{ id: 'profile-x', name: 'Jordan Owens' }])).toBe(
      'Jordan Owens',
    );
    expect(resolveCreatorName('profile-missing', [])).toBe('Unknown creator');
  });
});

// ---------------------------------------------------------------------------
// 5. Plain, URL-encoded Google Maps link (module doc #6).
// ---------------------------------------------------------------------------

describe('buildGoogleMapsUrl -- plain URL, correctly encoded', () => {
  it('matches the well-known plain Google Maps search URL pattern', () => {
    const url = buildGoogleMapsUrl('100 Riverside Dr, Suite #4');
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=100%20Riverside%20Dr%2C%20Suite%20%234',
    );
    // No raw spaces/commas/"#" leak through unescaped.
    expect(url).not.toMatch(/[ ,#]/);
  });

  it('the rendered "Open in Google Maps" link href is exactly this URL', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    // `isExternalLink` appends a visually-hidden "(opens in new tab)" span
    // (`node_modules/@astryxdesign/core/src/Link/Link.tsx`'s own
    // `VisuallyHidden` usage) to the anchor's `textContent`, so this checks
    // `.includes(...)` rather than an exact match against the visible label.
    const mapLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Open in Google Maps'),
    );
    expect(mapLink).toBeTruthy();
    expect(mapLink?.getAttribute('href')).toBe(buildGoogleMapsUrl('100 Riverside Dr, Suite #4'));
    // Plain URL -- not an embedded map/iframe/SDK integration.
    expect(container.querySelector('iframe')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. NAV-08 "Copy link" -- Toast "Link copied", correct constructed URL,
//    disclosed clipboard-API limitation (module doc #6).
// ---------------------------------------------------------------------------

describe('buildOutreachDetailUrl -- the real, constructible per-event URL', () => {
  it('interpolates the real event id into the real /outreach/:eventId route', () => {
    expect(buildOutreachDetailUrl('event-food-bank-sort', 'https://volt.example.com')).toBe(
      'https://volt.example.com/outreach/event-food-bank-sort',
    );
  });
});

describe('"Copy link" action', () => {
  it('fires the literal "Link copied" Toast text and calls the clipboard API with the correct URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Link copied');

    const copyButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Copy link',
    );
    expect(copyButton).toBeTruthy();
    act(() => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Link copied');
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/outreach/event-food-bank-sort`,
    );

    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copyTextToClipboard is honestly a no-op (never throws) when navigator.clipboard is unavailable -- the disclosed test-environment limitation', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    await expect(copyTextToClipboard('https://example.com/outreach/x')).resolves.toBeUndefined();

    if (originalDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});

// ---------------------------------------------------------------------------
// 7. T101 (ED-1 Packet P10): Edit/Cancel are now REAL, not stubs.
// ---------------------------------------------------------------------------

function findMoreMenuButton(): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((btn) =>
    btn.getAttribute('aria-label')?.startsWith('Actions for Community Food Bank Sort'),
  );
}

function clickMenuItem(label: string): void {
  const item = Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
    (el) => el.textContent?.trim() === label,
  );
  expect(item).toBeTruthy();
  act(() => {
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('Edit -- real OutreachEventDialog wiring (Trap #5)', () => {
  it('opens the real OutreachEventDialog in EDIT mode, pre-filled from the fetched event', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    clickMenuItem('Edit');

    // The real dialog's own DialogHeader title, in EDIT mode (not "New
    // outreach event") -- proves this is genuinely the same T039 dialog,
    // not the old stub Banner ("Edit dialog not built yet" must never
    // appear anywhere anymore).
    expect(document.body.textContent).toContain('Edit outreach event');
    expect(document.body.textContent).not.toContain('Edit dialog not built yet');
    // Pre-filled from the real fetched event.
    const titleInput = document.querySelector('input[value="Community Food Bank Sort"]');
    expect(titleInput).toBeTruthy();
  });

  it('submitting the real edit dialog calls the injected onSaveEvent with the existing event id and reloads the page', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    let loadCount = 0;
    async function countingLoadData(eventId: string): Promise<OutreachDetailData | null> {
      loadCount += 1;
      return defaultLoadOutreachDetail(eventId);
    }

    renderDetail('event-food-bank-sort', { loadData: countingLoadData, onSaveEvent });
    await flushMicrotasks();
    expect(loadCount).toBe(1);

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    clickMenuItem('Edit');

    const saveButton = Array.from(document.querySelectorAll('button')).find((btn) =>
      btn.textContent?.trim().startsWith('Save changes'),
    );
    expect(saveButton).toBeTruthy();
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(onSaveEvent).toHaveBeenCalledTimes(1);
    expect(onSaveEvent.mock.calls[0][0]).toMatchObject({
      event: { id: 'event-food-bank-sort', title: 'Community Food Bank Sort' },
    });
    expect(loadCount).toBe(2); // real reload, not a client-side merge
    expect(container.textContent).toContain('Event updated');
  });
});

describe('Cancel event -- real, event-level mutation (Trap #4)', () => {
  it('opens a real AlertDialog, then calls the injected onCancelEvent and optimistically flips scheduled sessions to canceled', async () => {
    const onCancelEvent = vi.fn().mockResolvedValue(undefined);
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail, onCancelEvent });
    await flushMicrotasks();

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    clickMenuItem('Cancel event');

    // Real DES-11 AlertDialog confirmation, not an immediate mutation.
    expect(document.body.textContent).toContain('Cancel "Community Food Bank Sort"?');
    expect(onCancelEvent).not.toHaveBeenCalled();

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel event' && btn !== findMoreMenuButton(),
    );
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(onCancelEvent).toHaveBeenCalledWith('event-food-bank-sort');
    expect(container.textContent).toContain('Event canceled');
    // Both of this event's scheduled sessions are now shown as canceled
    // (optimistic flip -- module doc #10).
    expect(container.textContent).toContain('— canceled');
    // Old stub copy must never appear anymore.
    expect(container.textContent).not.toContain('Cancel action not built yet');
  });

  it('rolls back the optimistic flip and shows an error Banner when the mutation rejects', async () => {
    const onCancelEvent = vi.fn().mockRejectedValue(new Error('network down'));
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail, onCancelEvent });
    await flushMicrotasks();

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    clickMenuItem('Cancel event');

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel event' && btn !== findMoreMenuButton(),
    );
    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't cancel event");
    // Rolled back -- sessions are still scheduled, not shown as canceled.
    expect(container.textContent).not.toContain('— canceled');
  });
});

// ---------------------------------------------------------------------------
// T101 (ED-1 Packet P10): pure-function + loader-level tests.
// ---------------------------------------------------------------------------

describe('formatChicagoWallTime', () => {
  it('converts a UTC ISO datetime to zero-padded HH:MM Chicago wall-clock time', () => {
    // 2026-08-02T14:00:00.000Z = 9:00 AM America/Chicago (CDT, UTC-5).
    expect(formatChicagoWallTime('2026-08-02T14:00:00.000Z')).toBe('09:00');
    expect(formatChicagoWallTime('2026-08-02T17:00:00.000Z')).toBe('12:00');
  });
});

describe('buildInitialOutreachEvent (Trap #5)', () => {
  it("reshapes a real fetched OutreachDetailEvent/sessions pair into OutreachEventDialog.tsx's own ExistingOutreachEvent shape", () => {
    const initial = buildInitialOutreachEvent(
      {
        id: 'event-1',
        seasonId: 'season-1',
        type: 'outreach',
        title: 'Food Bank Sort',
        description: 'desc',
        locationName: 'Loc',
        address: 'Addr',
        teamIds: ['team-ravens'],
        createdBy: null,
        countsParticipation: false,
        countsVolunteerHours: true,
        adultVolunteersCount: 4,
        adultVolunteerHours: 12,
      },
      [
        {
          id: 'session-1',
          eventId: 'event-1',
          sessionDate: '2026-08-02',
          startsAt: '2026-08-02T14:00:00.000Z',
          endsAt: '2026-08-02T17:00:00.000Z',
          status: 'scheduled',
          peopleReached: null,
          notes: '',
        },
      ],
      // T121 item (b) -- a real `going` rsvp for session-1 (student-going)
      // and a `declined` one (student-declined, must NOT appear in
      // `expectedStudentIds`) -- proves the new prefill derivation.
      [
        {
          id: 'rsvp-1',
          sessionId: 'session-1',
          studentId: 'student-going',
          status: 'going',
          respondedBy: 'student-going',
          updatedAt: '',
          createdAt: '',
        },
        {
          id: 'rsvp-2',
          sessionId: 'session-1',
          studentId: 'student-declined',
          status: 'declined',
          respondedBy: 'student-declined',
          updatedAt: '',
          createdAt: '',
        },
      ],
    );
    expect(initial).toMatchObject({
      id: 'event-1',
      title: 'Food Bank Sort',
      type: 'outreach',
      countsParticipation: false,
      countsVolunteerHours: true,
      teamIds: ['team-ravens'],
      adultVolunteersCount: 4,
      adultVolunteerHours: 12,
      shareToCalendarFeed: true,
      sessions: [
        { sessionDate: '2026-08-02', startTime: '09:00', endTime: '12:00', peopleReached: null },
      ],
    });
    // T121 item (b) -- prefilled from real `going` RSVPs only.
    expect(initial.expectedStudentIds).toEqual(['student-going']);
  });

  it('collapses a non-competition type to "outreach" -- the dialog\'s own type Selector has no other option', () => {
    const initial = buildInitialOutreachEvent(
      {
        id: 'event-1',
        seasonId: 'season-1',
        type: 'competition',
        title: 'T',
        description: '',
        locationName: '',
        address: '',
        teamIds: null,
        createdBy: null,
        countsParticipation: false,
        countsVolunteerHours: false,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
      },
      [],
      [],
    );
    expect(initial.type).toBe('competition');
    expect(initial.expectedStudentIds).toEqual([]);
  });
});

describe('deriveExpectedStudentIds (T121 item (b))', () => {
  it('returns distinct student ids with a going RSVP on any of the given sessions, never declined/maybe', () => {
    const sessions: OutreachDetailSession[] = [
      {
        id: 'session-1',
        eventId: 'event-1',
        sessionDate: '2026-08-02',
        startsAt: '2026-08-02T14:00:00.000Z',
        endsAt: '2026-08-02T17:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
        notes: '',
      },
      {
        id: 'session-2',
        eventId: 'event-1',
        sessionDate: '2026-08-09',
        startsAt: '2026-08-09T14:00:00.000Z',
        endsAt: '2026-08-09T17:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
        notes: '',
      },
    ];
    const rsvps: RsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'session-1',
        studentId: 'stu-a',
        status: 'going',
        respondedBy: 'stu-a',
        updatedAt: '',
        createdAt: '',
      },
      {
        id: 'r2',
        sessionId: 'session-2',
        studentId: 'stu-a',
        status: 'going',
        respondedBy: 'stu-a',
        updatedAt: '',
        createdAt: '',
      },
      {
        id: 'r3',
        sessionId: 'session-1',
        studentId: 'stu-b',
        status: 'maybe',
        respondedBy: 'stu-b',
        updatedAt: '',
        createdAt: '',
      },
      {
        id: 'r4',
        sessionId: 'session-2',
        studentId: 'stu-c',
        status: 'declined',
        respondedBy: 'stu-c',
        updatedAt: '',
        createdAt: '',
      },
    ];
    // stu-a appears once (deduped across two sessions); stu-b/stu-c excluded.
    expect(deriveExpectedStudentIds(sessions, rsvps)).toEqual(['stu-a']);
  });
});

describe('loadOutreachDetail (T101 real load)', () => {
  it('resolves null (not found/inaccessible) when the event maybeSingle finds no row -- RLS-honest per module doc #5', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const load = makeLoadOutreachDetail(() => client);
    const result = await load('event-nope');
    expect(result).toBeNull();
  });

  it('fetches event/sessions/rsvps/students/teams/profile and reshapes them into OutreachDetailData', async () => {
    const eventMaybeSingleSpy = vi.fn().mockResolvedValue({
      data: {
        id: 'event-1',
        season_id: 'season-1',
        type: 'outreach',
        title: 'Food Bank',
        description: '',
        location_name: 'X',
        address: '',
        team_ids: null,
        counts_participation: false,
        counts_volunteer_hours: true,
        adult_volunteers_count: 0,
        adult_volunteer_hours: 0,
        created_by: 'profile-1',
      },
      error: null,
    });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'session-1',
          event_id: 'event-1',
          session_date: '2026-08-01',
          starts_at: '2026-08-01T14:00:00.000Z',
          ends_at: '2026-08-01T16:00:00.000Z',
          status: 'scheduled',
          people_reached: null,
          notes: '',
        },
      ],
      error: null,
    });
    const rsvpsInSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const studentsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const teamsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const profileMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'profile-1', display_name: 'Jordan Owens' }, error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventMaybeSingleSpy })) })),
        };
      }
      if (table === 'event_sessions')
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: sessionsOrderSpy })) })) };
      if (table === 'rsvps') return { select: vi.fn(() => ({ in: rsvpsInSpy })) };
      if (table === 'students') return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      if (table === 'teams') return { select: vi.fn(() => ({ order: teamsOrderSpy })) };
      if (table === 'profiles') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: profileMaybeSingleSpy })) })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadOutreachDetail(() => client);
    const result = await load('event-1');

    expect(result).not.toBeNull();
    expect(result?.event.title).toBe('Food Bank');
    expect(result?.sessions).toHaveLength(1);
    expect(result?.profiles).toEqual([{ id: 'profile-1', name: 'Jordan Owens' }]);
  });
});

describe('cancelOutreachEvent (T101, Trap #4 real mutation)', () => {
  it('flips only currently-scheduled sessions for the event to canceled', async () => {
    const secondEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const firstEqSpy = vi.fn(() => ({ eq: secondEqSpy }));
    const updateSpy = vi.fn(() => ({ eq: firstEqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const cancel = makeCancelOutreachEvent(() => client);
    await cancel('event-99');

    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(updateSpy).toHaveBeenCalledWith({ status: 'canceled' });
    expect(firstEqSpy).toHaveBeenCalledWith('event_id', 'event-99');
    expect(secondEqSpy).toHaveBeenCalledWith('status', 'scheduled');
  });
});

// ---------------------------------------------------------------------------
// T117 (PRD v2 UXP-01): staff-only `<AttendancePanel>` role gating + wiring.
// ---------------------------------------------------------------------------

/** Locates a labeled input via Astryx `Field`'s real `<label htmlFor>` --
 * same helper `MarkDayCompleteDialog.test.tsx`/`AttendancePanel.test.tsx`
 * already established. */
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

describe('<AttendancePanel> role gating (Known Context/Traps #5)', () => {
  it('renders no "Attendance" section at all for an unauthenticated viewer', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, null);
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Attendance');
    expect(mockedLoadAttendanceForSessions).not.toHaveBeenCalled();
  });

  it('renders no "Attendance" section for a signed-in student -- page unchanged for non-staff', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, STUDENT_USER);
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Attendance');
    // Signups section (unchanged, present for every viewer) still renders.
    expect(container.textContent).toContain('Signups');
  });

  it('renders the "Attendance" section for a signed-in coach', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, COACH_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain('Attendance');
  });

  it('renders the "Attendance" section for a signed-in admin too', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, ADMIN_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain('Attendance');
  });
});

describe('<AttendancePanel> data threading (roster/sessions/teams/currentUserProfileId genuinely reach the panel)', () => {
  it('renders the real fetched roster (grouped by team chips) inside the panel, and attributes a write to the real signed-in coach', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, COACH_USER);
    await flushMicrotasks();

    // `event-food-bank-sort`'s fixture is all-teams (`teamIds: null`) --
    // every fixture student's real name reaches the panel (module doc #11:
    // `roster`/`teams` passed straight through, no reshaping).
    expect(mockedLoadAttendanceForSessions).toHaveBeenCalled();
    expect(container.textContent).toContain('Amara Chen');
    expect(container.textContent).toContain('Ravens');
    expect(container.textContent).toContain('Titans');

    // Checking a student writes `recordedBy` as the REAL signed-in coach's
    // `user.id` (module doc #11's `profiles.id === auth.users.id` proof),
    // not a hardcoded placeholder.
    const amaraCheckbox = getFieldControl('Amara Chen') as HTMLInputElement;
    act(() => {
      amaraCheckbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(mockedUpsertAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ recordedBy: COACH_USER.id, method: 'coach' }),
    );
  });
});

// ---------------------------------------------------------------------------
// T127 (PRD v2 UXP-07): "Mark event complete" staff-only trigger + real
// per-session mutation reuse (component module doc #12).
// ---------------------------------------------------------------------------

function findMarkEventCompleteMenuItem(): Element | undefined {
  return Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
    (el) => el.textContent?.trim() === 'Mark event complete',
  );
}

describe('"Mark event complete" MoreMenu item -- staff-only (packet Objective)', () => {
  it('is absent for an unauthenticated viewer', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, null);
    await flushMicrotasks();
    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(findMarkEventCompleteMenuItem()).toBeUndefined();
  });

  it('is absent for a signed-in student -- page unchanged for non-staff', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, STUDENT_USER);
    await flushMicrotasks();
    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(findMarkEventCompleteMenuItem()).toBeUndefined();
    // Edit/Cancel event -- unaffected by this task -- still present.
    expect(
      Array.from(document.querySelectorAll('[role="menuitem"], button')).some(
        (el) => el.textContent?.trim() === 'Edit',
      ),
    ).toBe(true);
  });

  it('is present, and opens the real MarkEventCompleteDialog, for a signed-in coach', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, COACH_USER);
    await flushMicrotasks();
    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const item = findMarkEventCompleteMenuItem();
    expect(item).toBeTruthy();
    act(() => {
      item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Real dialog title + both real fixture sessions' dates (module doc
    // #12: `sessions` passed straight through, no reshaping).
    expect(container.textContent).toContain('Mark event complete');
    expect(container.textContent).toContain('Aug 2');
    expect(container.textContent).toContain('Aug 9');
    expect(container.textContent).toContain('Mark 2 sessions complete');
  });

  it('is present for a signed-in admin too', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, ADMIN_USER);
    await flushMicrotasks();
    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(findMarkEventCompleteMenuItem()).toBeTruthy();
  });
});

describe('"Mark event complete" confirm -> real markDayComplete mutation + page reload (module doc #12)', () => {
  it('calls the real markDayComplete mutation once per remaining session and reloads this page’s own data', async () => {
    mockedMarkDayComplete.mockResolvedValue(undefined);
    let loadCount = 0;
    async function countingLoadData(eventId: string): Promise<OutreachDetailData | null> {
      loadCount += 1;
      return defaultLoadOutreachDetail(eventId);
    }

    renderDetail('event-food-bank-sort', { loadData: countingLoadData }, COACH_USER);
    await flushMicrotasks();
    expect(loadCount).toBe(1);

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      findMarkEventCompleteMenuItem()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Mark 2 sessions complete',
    );
    expect(confirmButton).toBeTruthy();
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    await flushMicrotasks();

    // Both of event-food-bank-sort's real scheduled sessions -- never a
    // parallel/re-derived mutation (module doc #12 / that dialog's own
    // module doc #1).
    expect(mockedMarkDayComplete).toHaveBeenCalledTimes(2);
    const calledSessionIds = mockedMarkDayComplete.mock.calls.map((call) => call[0].sessionId);
    expect(calledSessionIds).toEqual(['session-food-bank-day1', 'session-food-bank-day2']);
    expect(
      mockedMarkDayComplete.mock.calls.every((call) => call[0].recordedBy === COACH_USER.id),
    ).toBe(true);

    // Real refetch (partial-failure-honesty seam, module doc #12), not a
    // client-only optimistic guess -- `loadData` was called again.
    expect(loadCount).toBe(2);
    expect(container.textContent).toContain('Event marked complete');
  });

  it('reports a partial failure honestly when one session’s write rejects, without blocking the other', async () => {
    mockedMarkDayComplete.mockImplementation(async (payload) => {
      if (payload.sessionId === 'session-food-bank-day2') {
        throw new Error('RLS denied this write');
      }
    });

    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, COACH_USER);
    await flushMicrotasks();

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    act(() => {
      findMarkEventCompleteMenuItem()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const confirmButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Mark 2 sessions complete',
    );
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(mockedMarkDayComplete).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Done — marked complete');
    expect(container.textContent).toContain('Failed — RLS denied this write');
    expect(container.textContent).toContain("Some sessions couldn't be marked complete");
  });
});
