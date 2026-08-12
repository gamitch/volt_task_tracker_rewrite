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
  submitRsvpChange,
} from '../../lib/supabase/loaders/outreach';
import {
  loadAttendanceForSessions,
  upsertAttendance,
  type AttendanceRow,
} from '../../lib/supabase/loaders/attendance';
import {
  buildGoogleMapsUrl,
  buildInitialOutreachEvent,
  buildOutreachDetailUrl,
  copyTextToClipboard,
  defaultLoadOutreachDetail,
  deriveExpectedStudentIds,
  formatChicagoWallTime,
  formatScopeLabel,
  formatSessionDateOnly,
  // T306 -- the new attendance-vs-RSVP trigger/bucketing pure functions,
  // same "exported, own describe block" convention `groupSessionSignups`
  // itself already established.
  groupSessionAttendance,
  groupSessionSignups,
  hasRecordedAttendance,
  isSessionMarkDayCompleteEligible,
  OutreachDetail,
  resolveCreatorName,
  resolveEventRoster,
  resolveOwnRosterStudent,
  resolveParentLinkedRosterStudents,
  type LoadOutreachDetailFn,
  type OutreachDetailData,
  type OutreachDetailSession,
  type RosterStudent,
  type RsvpRow,
  type TeamOption,
} from './OutreachDetail';
// T157: `GuardianLinkRow` is reused from `ParentRsvp.tsx`'s own export, the
// same type `OutreachDetail.tsx` and `loaders/outreach.ts` now both use --
// this test constructs the exact rows the real loader would resolve.
import { resolveRsvpResponderAttribution, type GuardianLinkRow } from './ParentRsvp';

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
//
// T157 UPDATE: `submitRsvpChange` joins `markDayComplete` in this factory, for
// the identical reason. `<ParentRsvp>` (mounted by this page for the first
// time in T157) bakes the real `submitRsvpChange` in as its own default
// `onRsvpChange` at import time (`ParentRsvp.tsx` module doc #7), and
// `OutreachDetail.tsx` deliberately does NOT give it an override prop (that
// page's module doc #13) -- so the only seam at which this test can observe
// the write, or stop it reaching a real unconfigured Supabase client, is this
// module mock. This is a real edit to shared test infrastructure, not just an
// added test.
vi.mock('../../lib/supabase/loaders/outreach', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/outreach')>();
  return {
    ...actual,
    markDayComplete: vi.fn(async () => {}),
    submitRsvpChange: vi.fn(async () => {}),
  };
});

const mockedMarkDayComplete = vi.mocked(markDayComplete);
// T157 -- `SubmitRsvpChangeFn` resolves `Promise<void>` (`outreach.ts ::
// SubmitRsvpChangeFn`), so the mock resolves undefined rather than a synthetic
// `RsvpRow`; `<ParentRsvp>` ignores the resolved value entirely and builds its
// own optimistic row.
const mockedSubmitRsvpChange = vi.mocked(submitRsvpChange);

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
  // T157 -- same clear-only convention.
  mockedSubmitRsvpChange.mockClear();
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
// T157 (OUT-06) -- a real `parent`-role viewer, mirroring the three fixtures
// above. `AuthUser.id` IS this parent's own `profiles.id`
// (`OutreachDetail.tsx` module doc #11), which is exactly what
// `guardian_links.parent_profile_id` and `rsvps.responded_by` hold.
const PARENT_USER: AuthUser = {
  id: 'profile-parent-1',
  email: 'parent@example.com',
  role: 'parent',
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
  // T157: `profileId` is required on `RosterStudent` now. This describe block
  // exercises signup-bucket grouping only -- it never touches `ParentRsvp`
  // attribution -- so the value is immaterial here and `null` (the real
  // "student has no account yet" case) is used deliberately rather than an
  // invented id.
  const ROSTER: RosterStudent[] = [
    { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens', profileId: null },
    { id: 's-2', name: 'Marcus Bello', teamId: 'team-ravens', profileId: null },
    { id: 's-3', name: 'Nina Ortiz', teamId: 'team-ravens', profileId: null },
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

// ---------------------------------------------------------------------------
// T306 -- attendance-side counterpart of groupSessionSignups, plus the
// trigger. Pure-function level, mirroring the describe block immediately
// above (this task's packet §7: "put the bucketing criteria [C3/C4/C5] at
// pure-function level").
// ---------------------------------------------------------------------------

describe('groupSessionAttendance -- attendance-side counterpart of groupSessionSignups (T306)', () => {
  const ROSTER: RosterStudent[] = [
    { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens', profileId: null },
    { id: 's-2', name: 'Marcus Bello', teamId: 'team-ravens', profileId: null },
    { id: 's-3', name: 'Nina Ortiz', teamId: 'team-ravens', profileId: null },
    { id: 's-4', name: 'Ravi Kapoor', teamId: 'team-ravens', profileId: null },
    { id: 's-5', name: 'Sofia Delgado', teamId: 'team-ravens', profileId: null },
  ];

  function buildRow(overrides: Pick<AttendanceRow, 'id' | 'studentId' | 'status'>): AttendanceRow {
    return {
      sessionId: 'session-1',
      checkInAt: null,
      checkOutAt: null,
      hoursOverride: null,
      method: 'coach',
      recordedBy: 'profile-coach-1',
      updatedAt: '2026-08-02T00:00:00.000Z',
      createdAt: '2026-08-02T00:00:00.000Z',
      ...overrides,
    };
  }

  // s-5 deliberately has no row at all for session-1 -- the "No record" proof.
  const ROWS: AttendanceRow[] = [
    buildRow({ id: 'a-1', studentId: 's-1', status: 'present' }),
    buildRow({ id: 'a-2', studentId: 's-2', status: 'late' }),
    buildRow({ id: 'a-3', studentId: 's-3', status: 'excused' }),
    buildRow({ id: 'a-4', studentId: 's-4', status: 'absent' }),
  ];

  it('C3: "present" and "late" both land in Attended', () => {
    const groups = groupSessionAttendance('session-1', ROSTER, ROWS);
    expect(groups.attended.map((s) => s.id).sort()).toEqual(['s-1', 's-2']);
  });

  it('C4: "excused" and "absent" land in their own buckets, never in Attended', () => {
    const groups = groupSessionAttendance('session-1', ROSTER, ROWS);
    expect(groups.excused.map((s) => s.id)).toEqual(['s-3']);
    expect(groups.absent.map((s) => s.id)).toEqual(['s-4']);
    expect(groups.attended.map((s) => s.id)).not.toContain('s-3');
    expect(groups.attended.map((s) => s.id)).not.toContain('s-4');
  });

  it('C5: a roster student with no attendance row at all lands in "No record", diffed from the roster', () => {
    const groups = groupSessionAttendance('session-1', ROSTER, ROWS);
    expect(groups.noRecord.map((s) => s.id)).toEqual(['s-5']);
  });

  it('a session with zero attendance rows puts the entire roster in "No record"', () => {
    const groups = groupSessionAttendance('session-with-no-attendance', ROSTER, ROWS);
    expect(groups.attended).toEqual([]);
    expect(groups.excused).toEqual([]);
    expect(groups.absent).toEqual([]);
    expect(groups.noRecord.map((s) => s.id)).toEqual(['s-1', 's-2', 's-3', 's-4', 's-5']);
  });
});

describe('hasRecordedAttendance -- the T306 trigger, deliberately per-session not per-event', () => {
  const ROWS: AttendanceRow[] = [
    {
      id: 'a-1',
      sessionId: 'session-1',
      studentId: 's-1',
      status: 'present',
      checkInAt: null,
      checkOutAt: null,
      hoursOverride: null,
      method: 'coach',
      recordedBy: 'profile-coach-1',
      updatedAt: '2026-08-02T00:00:00.000Z',
      createdAt: '2026-08-02T00:00:00.000Z',
    },
  ];

  it('false for a session with zero recorded rows', () => {
    expect(hasRecordedAttendance('session-with-no-rows', ROWS)).toBe(false);
  });

  it('true the instant at least one row exists for that session', () => {
    expect(hasRecordedAttendance('session-1', ROWS)).toBe(true);
  });

  it("is scoped to the session id -- a row for a DIFFERENT session never flips this session's trigger", () => {
    expect(hasRecordedAttendance('session-2', ROWS)).toBe(false);
  });
});

describe('resolveEventRoster -- events.team_ids NULL/array semantics', () => {
  // T157: `profileId` required; immaterial to team-scope resolution (see the
  // note on the `groupSessionSignups` roster above).
  const STUDENTS: RosterStudent[] = [
    { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens', profileId: null },
    { id: 's-2', name: 'Sofia Delgado', teamId: 'team-titans', profileId: null },
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
// T306 -- the attendance-vs-RSVP trigger, rendered end to end. Every test
// below uses `event-park-cleanup` deliberately: its ONE session
// (`session-park-cleanup`) is the ONLY session on the page, so a global
// `container.textContent` assertion can never be contaminated by a SECOND,
// unrelated session's own bucket labels the way `event-food-bank-sort`'s two
// sessions could -- this is exactly the "paired absence proof" packet §6
// requires for C2.
//
// Each test overrides the new `loadAttendance` prop directly (module doc
// #16(b)'s own injectable-prop convention) rather than touching the shared
// `mockedLoadAttendanceForSessions` module mock -- fully isolated per test,
// same posture this file's own `loadRoster`/`loadGuardianLinksForParent`
// prop overrides already use elsewhere.
// ---------------------------------------------------------------------------

function buildParkCleanupAttendanceRow(
  overrides: Pick<AttendanceRow, 'id' | 'studentId' | 'status'>,
): AttendanceRow {
  return {
    sessionId: 'session-park-cleanup',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
    method: 'coach',
    recordedBy: 'profile-coach-owens',
    updatedAt: '2026-07-26T15:30:00.000Z',
    createdAt: '2026-07-26T15:30:00.000Z',
    ...overrides,
  };
}

describe('T306 C1: no recorded attendance renders the RSVP buckets, unchanged', () => {
  it("shows Going/Can't go/No response, and no attendance-bucket labels at all", async () => {
    renderDetail(
      'event-park-cleanup',
      {
        loadData: defaultLoadOutreachDetail,
        loadAttendance: async () => [],
      },
      COACH_USER,
    );
    await flushMicrotasks();

    expect(container.textContent).toContain('Who said they were coming');
    expect(container.textContent).toContain('Going (1)');
    expect(container.textContent).toContain("Can't go (1)");
    expect(container.textContent).toContain('No response (1)');

    expect(container.textContent).not.toContain('Who actually came');
    expect(container.textContent).not.toContain('Attended');
    expect(container.textContent).not.toContain('Excused');
    expect(container.textContent).not.toContain('No record');
  });
});

describe('T306 C2: >=1 recorded attendance row switches to the attendance buckets, RSVP buckets gone', () => {
  it("shows Attended (and the other attendance labels), never Going/Maybe/Can't go/No response", async () => {
    renderDetail(
      'event-park-cleanup',
      {
        loadData: defaultLoadOutreachDetail,
        loadAttendance: async () => [
          buildParkCleanupAttendanceRow({
            id: 'att-1',
            studentId: 'student-amara-chen',
            status: 'present',
          }),
        ],
      },
      COACH_USER,
    );
    await flushMicrotasks();

    // Paired proof (packet §6): an attendance label is present AND every
    // RSVP label is absent, in the SAME test -- an absence-only check would
    // pass even if this section had rendered nothing at all.
    expect(container.textContent).toContain('Who actually came');
    expect(container.textContent).toContain('Attended (1)');
    expect(container.textContent).toContain('No record (2)'); // Marcus, Nina -- no row.
    expect(container.textContent).not.toContain('Who said they were coming');
    expect(container.textContent).not.toContain('Going');
    expect(container.textContent).not.toContain('Maybe');
    expect(container.textContent).not.toContain("Can't go");
    expect(container.textContent).not.toContain('No response');
  });
});

describe('T306 C6: the trigger ignores session.status -- a SCHEDULED session with attendance rows still shows attendance', () => {
  it('session-park-cleanup is genuinely still "scheduled" (not completed) and still shows Attended', async () => {
    renderDetail(
      'event-park-cleanup',
      {
        loadData: defaultLoadOutreachDetail,
        loadAttendance: async () => [
          buildParkCleanupAttendanceRow({
            id: 'att-1',
            studentId: 'student-amara-chen',
            status: 'present',
          }),
        ],
      },
      COACH_USER,
    );
    await flushMicrotasks();

    // `session-park-cleanup`'s own fixture `status` is 'scheduled' (module
    // doc #1's `FIXTURE_SESSIONS`) -- the coach has NOT run "Mark day
    // complete" yet, matching the owner's own account of recording
    // attendance mid-workflow, while the session is still 'scheduled'.
    expect(container.textContent).toContain('Attended (1)');
    expect(container.textContent).not.toContain('Who said they were coming');
  });
});

describe('T306 C7: the trigger ignores the date -- a session dated TODAY with attendance rows still shows attendance', () => {
  it("a session whose sessionDate is literally today still shows Attended, matching the owner's own same-day workflow", async () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const loadTodaysSession: LoadOutreachDetailFn = async (eventId) => {
      const result = await defaultLoadOutreachDetail(eventId);
      if (result === null) return null;
      return {
        ...result,
        sessions: result.sessions.map((session) =>
          session.id === 'session-park-cleanup' ? { ...session, sessionDate: todayIso } : session,
        ),
      };
    };

    renderDetail(
      'event-park-cleanup',
      {
        loadData: loadTodaysSession,
        loadAttendance: async () => [
          buildParkCleanupAttendanceRow({
            id: 'att-1',
            studentId: 'student-amara-chen',
            status: 'present',
          }),
        ],
      },
      COACH_USER,
    );
    await flushMicrotasks();

    expect(container.textContent).toContain('Attended (1)');
    expect(container.textContent).not.toContain('Who said they were coming');
  });
});

describe('T306 C8: a FAILED attendance load falls back to the RSVP buckets, no error banner, nothing blocked', () => {
  it('a rejected loadAttendance still renders the page normally, RSVP buckets stand', async () => {
    renderDetail(
      'event-park-cleanup',
      {
        loadData: defaultLoadOutreachDetail,
        loadAttendance: async () => {
          throw new Error('network down');
        },
      },
      COACH_USER,
    );
    await flushMicrotasks();

    // Fallback: exactly today's RSVP buckets, same as C1.
    expect(container.textContent).toContain('Who said they were coming');
    expect(container.textContent).toContain('Going (1)');
    expect(container.textContent).toContain("Can't go (1)");
    expect(container.textContent).toContain('No response (1)');
    // Nothing blocked -- the rest of the page still renders normally.
    expect(container.textContent).toContain('Riverside Park');
    // No error surface for this failed load -- this is a DISPLAY surface
    // (module doc #16(c)), degrading silently like
    // `MarkDayCompleteDialog.tsx`, never like `MarkEventCompleteDialog.tsx`
    // (a WRITE path, which must abort instead).
    expect(container.textContent).not.toContain('Attended');
    expect(container.textContent).not.toContain("Couldn't load attendance");
  });
});

describe('T306 C9: no rsvps write occurs on any path this task touches', () => {
  it('switching to the attendance buckets never calls the real rsvps write seam', async () => {
    renderDetail(
      'event-park-cleanup',
      {
        loadData: defaultLoadOutreachDetail,
        loadAttendance: async () => [
          buildParkCleanupAttendanceRow({
            id: 'att-1',
            studentId: 'student-amara-chen',
            status: 'present',
          }),
        ],
      },
      COACH_USER,
    );
    await flushMicrotasks();

    expect(container.textContent).toContain('Attended (1)'); // the switch genuinely happened.
    expect(mockedSubmitRsvpChange).not.toHaveBeenCalled();
  });
});

describe('T306 C10: the attendance view is STAFF-ONLY, and non-staff never fires the load', () => {
  // ORCHESTRATOR-ADDED after the worker reported a pre-existing assertion
  // failing. That assertion was RIGHT and the packet was wrong: it never
  // specified a staff gate.
  //
  // `attendance`'s RLS is `staff_all` plus `own_or_linked_read`
  // (`20260717000002_rls.sql:226-232`), so a student or parent can read only
  // their OWN rows. Ungated, `groupSessionAttendance` would diff the roster
  // against that partial set and render every teammate under "No record" --
  // a FALSE statement about a factual record, and worse than the RSVP intent
  // it replaces. `<SessionSignupList>` is NOT staff-gated (it renders for
  // every viewer at its call site), so the gate has to live on the load.
  it('a STUDENT viewer keeps the RSVP buckets and the attendance loader is never called', async () => {
    const loadAttendance = vi.fn(async () => [
      buildParkCleanupAttendanceRow({
        id: 'att-1',
        studentId: 'student-amara-chen',
        status: 'present',
      }),
    ]);

    renderDetail(
      'event-park-cleanup',
      { loadData: defaultLoadOutreachDetail, loadAttendance },
      STUDENT_USER,
    );
    await flushMicrotasks();

    // Paired, per packet §6: prove the section actually rendered before
    // asserting anything is absent from it.
    expect(container.textContent).toContain('Who said they were coming');
    expect(container.textContent).toContain('No response');
    expect(container.textContent).not.toContain('Who actually came');
    expect(container.textContent).not.toContain('Attended (');

    // The load must not fire at all -- not merely be ignored. T307's own
    // verification-log entry records the concern that an ungated load fires
    // an `attendance` SELECT for every signed-in viewer of this page.
    expect(loadAttendance).not.toHaveBeenCalled();
  });

  it('a COACH viewer on the same event DOES get the attendance view -- proof the gate is the role, not the fixture', async () => {
    const loadAttendance = vi.fn(async () => [
      buildParkCleanupAttendanceRow({
        id: 'att-1',
        studentId: 'student-amara-chen',
        status: 'present',
      }),
    ]);

    renderDetail(
      'event-park-cleanup',
      { loadData: defaultLoadOutreachDetail, loadAttendance },
      COACH_USER,
    );
    await flushMicrotasks();

    expect(loadAttendance).toHaveBeenCalled();
    expect(container.textContent).toContain('Who actually came');
    expect(container.textContent).toContain('Attended (1)');
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
    // T143 -- `color` required. GAM-305 -- `archived` required.
    const TEAMS: TeamOption[] = [
      { id: 'team-ravens', name: 'Ravens', color: 'blue', archived: false },
    ];
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

describe('T323 (audit LIVE-015) -- event-management actions are staff-only', () => {
  it('a PARENT viewer is offered no Edit and no Cancel event action', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, PARENT_USER);
    await flushMicrotasks();

    // Paired, not absence-only: the page itself must have rendered for this
    // student's event, otherwise "no Edit" would pass on a blank screen.
    expect(container.textContent).toContain('Community Food Bank Sort');

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Scoped to the menu's own items, NOT the whole document: the cancel
    // AlertDialog carries actionLabel="Cancel event" (OutreachDetail.tsx:2229)
    // and is in the DOM regardless of role, so a document-wide scan matches
    // it and passes for the wrong reason.
    const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(items).not.toContain('Edit');
    expect(items).not.toContain('Cancel event');
    expect(items).not.toContain('Mark event complete');
  });

  it('a STAFF viewer still gets all three -- the gate is role-based, not a blanket removal', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Community Food Bank Sort');

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(items).toContain('Edit');
    expect(items).toContain('Cancel event');
    expect(items).toContain('Mark event complete');
  });
});

describe('Edit -- real OutreachEventDialog wiring (Trap #5)', () => {
  it('opens the real OutreachEventDialog in EDIT mode, pre-filled from the fetched event', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail }, ADMIN_USER);
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

    renderDetail('event-food-bank-sort', { loadData: countingLoadData, onSaveEvent }, ADMIN_USER);
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
    renderDetail(
      'event-food-bank-sort',
      { loadData: defaultLoadOutreachDetail, onCancelEvent },
      ADMIN_USER,
    );
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
    renderDetail(
      'event-food-bank-sort',
      { loadData: defaultLoadOutreachDetail, onCancelEvent },
      ADMIN_USER,
    );
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
    // T323 (audit LIVE-015) -- INVERTED. This assertion previously read
    // `.toBe(true)` with the comment "Edit/Cancel event -- unaffected by
    // this task -- still present", which pinned the defect as correct
    // behaviour: a student really was offered Edit. Every item in this menu
    // is an event-management action and every one is staff-only, so a
    // non-staff viewer must see NONE of them.
    expect(
      Array.from(document.querySelectorAll('[role="menuitem"]')).some(
        (el) => el.textContent?.trim() === 'Edit',
      ),
    ).toBe(false);
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
    // T307 -- this dialog now loads recorded attendance on open (module doc
    // #6) and disables confirm until that settles; this file's shared
    // `loadAttendanceForSessions` mock (`:110-118`) resolves `[]`, so one
    // flush is enough. New line, not a regression -- the packet's own §8
    // measured this exact fix.
    await flushMicrotasks();

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
    // T307 -- see the twin comment above; this dialog's load must settle
    // before the confirm button is enabled.
    await flushMicrotasks();
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

// ---------------------------------------------------------------------------
// T147: the outreach/meetings team picker shows fixture teams to real users.
// This page's own `<OutreachEventDialog>` (edit mode) now gets `teams` from
// this page's real `detailData.teams` instead of that dialog's own
// `DEFAULT_TEAMS` fixture (`'team-ravens'`/`'team-titans'`, non-uuid strings
// that fail the real `events.team_ids uuid[]` insert -- the report that
// blocked meeting creation outright, packet root-cause section).
//
// Assertion mechanism (packet "The assertion mechanism" section) -- UUID
// shape on the SUBMITTED payload, never a name-based assertion: two earlier
// revisions of this packet tried name-based assertions and both failed for
// structural reasons specific to this codebase's fixtures (name collisions
// with `DEFAULT_TEAMS`'s own "Ravens"/"Titans", and this page's own
// `formatScopeLabel` rendering the loader's team names directly into the
// page body). A UUID-shape assertion on the payload discriminates
// correctly regardless of what names are used.
//
// Trap (packet "The single most important thing to understand"):
// `OutreachEventDialog.tsx`'s own `resetForm` seeds `selectedTeamIds` from
// `initialEvent.teamIds ?? allTeamIds` -- FROM THE EVENT, not from the
// `teams` prop. An edit-mode fixture event already scoped to a team (e.g.
// `teamIds: ['team-ravens']`) would submit that same array back verbatim
// via `resolveTeamScope`, byte-identical whether or not this page's own
// `teams` prop fix is present -- NOT a valid discrimination proof. The
// event injected below deliberately sets `teamIds: null` so the dialog's
// seed falls through to `allTeamIds`, which IS derived from the `teams`
// prop under test here.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('T147: OutreachEventDialog (edit mode) submits real team UUIDs, not DEFAULT_TEAMS fixture strings', () => {
  // UUID-shaped ids matching what the real `teams` table actually produces
  // (`teams.id uuid primary key`); fabricated names (constitution item 6) --
  // never asserted on, so no naming trap to avoid here.
  const REAL_TEAMS: TeamOption[] = [
    {
      id: 'c2222222-2222-4222-8222-222222222222',
      name: 'Nimbus Ninjas',
      color: 'blue',
      archived: false,
    },
    {
      id: 'c3333333-3333-4333-8333-333333333333',
      name: 'Solar Sentinels',
      color: 'green',
      archived: false,
    },
  ];

  async function loadDataWithRealTeams(eventId: string): Promise<OutreachDetailData | null> {
    return {
      event: {
        id: eventId,
        seasonId: 'season-1',
        type: 'outreach',
        title: 'Food Bank Sort',
        description: '',
        locationName: 'Riverside Food Bank',
        address: '100 Riverside Dr',
        // Recipe (packet "Recipe, all three call sites" step 1): `null` here
        // is what makes `OutreachEventDialog.tsx:1051`'s
        // `initialEvent.teamIds ?? allTeamIds` fall through to `allTeamIds`,
        // which is derived from the `teams` prop this test is proving.
        teamIds: null,
        createdBy: null,
        countsParticipation: false,
        countsVolunteerHours: true,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
      },
      sessions: [
        {
          id: 'session-1',
          eventId,
          sessionDate: '2026-08-02',
          startsAt: '2026-08-02T14:00:00.000Z',
          endsAt: '2026-08-02T17:00:00.000Z',
          status: 'scheduled',
          peopleReached: null,
          notes: '',
        },
      ],
      rsvps: [],
      students: [],
      teams: REAL_TEAMS,
      profiles: [],
    };
  }

  /** Opens the "Team scope" `MultiSelector` and deselects the LAST option in
   * its own listbox -- positional, not by label text (packet "Two traps in
   * step 2" section): with the fix reverted the injected labels
   * ("Nimbus Ninjas"/"Solar Sentinels") are absent (the dialog falls back to
   * `DEFAULT_TEAMS`'s "Ravens"/"Titans"), so a label lookup would die with a
   * harness-shaped failure instead of the UUID mismatch this test exists to
   * prove. Scoped to the MultiSelector's OWN listbox (via the trigger's
   * `aria-controls`), not the whole document -- a second, unrelated
   * `role="option"` group exists on this page (the dialog's own Event type
   * `Selector`). The last option is never the `hasSelectAll` pseudo-option,
   * which that component places FIRST. */
  function deselectLastTeamOption(): void {
    const trigger = getFieldControl('Team scope');
    act(() => {
      trigger.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const listboxId = trigger.getAttribute('aria-controls');
    expect(listboxId).toBeTruthy();
    const listbox = document.getElementById(listboxId ?? '');
    expect(listbox).toBeTruthy();
    const options = Array.from(listbox?.querySelectorAll('[role="option"]') ?? []);
    expect(options.length).toBeGreaterThan(0);
    const lastOption = options[options.length - 1];
    act(() => {
      lastOption.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  it('deselecting one team submits a teamIds array of real UUIDs from the teams prop, never the fixture strings', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    renderDetail('event-1', { loadData: loadDataWithRealTeams, onSaveEvent }, ADMIN_USER);
    await flushMicrotasks();

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    clickMenuItem('Edit');
    expect(document.body.textContent).toContain('Edit outreach event');

    deselectLastTeamOption();

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
    const submittedTeamIds = onSaveEvent.mock.calls[0][0].event.teamIds as string[] | null;
    expect(submittedTeamIds).not.toBeNull();
    expect(submittedTeamIds).not.toEqual([]);
    for (const id of submittedTeamIds ?? []) {
      expect(id).toMatch(UUID_RE);
    }
  });
});

// ---------------------------------------------------------------------------
// T147 Part A2: the "Expected attendees" roster fetch has the same defect
// class this task exists to close for teams -- a rejected `loadRoster()`
// used to leave `eventDialogRoster` at its initial `undefined`, so
// `OutreachEventDialog`'s own `students` prop default (`DEFAULT_STUDENTS`)
// silently took over, presenting four fabricated minors' names ("Riley
// Chen", "Jordan Blake", "Sam Okafor", "Casey Nguyen") as the live roster
// with no indication anything failed. Ported from `OutreachList.tsx`'s own
// CHECKER FIX (rework of T121, NIT #6) -- the identical `RosterLoadState`
// shape, applied here for the first time (the old justification for leaving
// this page on the soft-fail path, "T121 already fixed it", was true for
// `OutreachList.tsx` only).
// ---------------------------------------------------------------------------

describe("T147 Part A2: a roster-load FAILURE surfaces an honest page-side notice and passes a real empty array, never the dialog's own DEFAULT_STUDENTS fixture", () => {
  it("a rejected loadRoster shows an error Banner with Retry, and the edit dialog's checklist never falls back to fabricated fixture students", async () => {
    const loadRoster = vi.fn().mockRejectedValue(new Error('boom'));
    renderDetail(
      'event-food-bank-sort',
      { loadData: defaultLoadOutreachDetail, loadRoster },
      COACH_USER,
    );
    await flushMicrotasks();
    expect(loadRoster).toHaveBeenCalledTimes(1);

    // Honest, page-side DES-12 error notice -- visible even before the
    // dialog is opened, same shape `OutreachList.tsx`'s own roster-failure
    // notice already established.
    expect(container.textContent).toContain("Couldn't load the student roster");
    expect(container.textContent).toContain('Retry');

    act(() => {
      findMoreMenuButton()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    clickMenuItem('Edit');

    // Never the dialog's own fixture fallback names -- a real, honest empty
    // roster instead.
    expect(document.body.textContent).not.toContain('Riley Chen');
    expect(document.body.textContent).not.toContain('Jordan Blake');
    expect(document.body.textContent).not.toContain('Sam Okafor');
    expect(document.body.textContent).not.toContain('Casey Nguyen');
    expect(document.body.textContent).toContain('Expected attendees (0 of 0)');
  });

  it('Retry re-runs loadRoster and clears the error notice on success', async () => {
    const loadRoster = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([
        { id: 'stu-jamie', name: 'Jamie Rivera', teamId: 'team-ravens', isActive: true },
      ]);
    renderDetail(
      'event-food-bank-sort',
      { loadData: defaultLoadOutreachDetail, loadRoster },
      COACH_USER,
    );
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load the student roster");

    const retryButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Retry',
    );
    expect(retryButton).toBeTruthy();
    act(() => {
      retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(loadRoster).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Couldn't load the student roster");
  });
});

// ---------------------------------------------------------------------------
// T157 (OUT-06, PRD line 297): `<ParentRsvp>` mounted on this page for the
// first time -- component module doc #13.
//
// `ParentRsvp.tsx` has been finished and fully tested since T043 with ZERO
// production importers. Every criterion below therefore lives HERE, never in
// `ParentRsvp.test.tsx`: a proof satisfiable from that component's own test
// file reproduces the exact blind spot this task exists to close (a correct,
// tested, unreachable component). `ParentRsvp.test.tsx` remains the authority
// for that component's INTERNAL status-mapping/attribution/lock behavior --
// none of it is duplicated here. What is proven here is reachability and real
// data threading.
//
// Clock determinism (component module doc #13(g)): every test below that
// renders an editable control pins `nowFn`. Without it these assertions would
// go permanently red on 2026-08-02 purely from wall-clock advancing past
// `session-food-bank-day1`'s start, and would be reported as a regression
// rather than as tests that were never deterministic.
// ---------------------------------------------------------------------------

/**
 * The pinned instant. Chosen to sit strictly AFTER `session-park-cleanup`'s
 * start (`2026-07-26T15:00:00.000Z`, so that fixture session stays
 * deterministically locked) and strictly BEFORE both food-bank sessions'
 * starts (`2026-08-02T14:00:00.000Z` / `2026-08-09T14:00:00.000Z`, so the
 * parent fixture sessions below are deterministically editable) -- forever,
 * independent of when this suite actually runs.
 */
const PINNED_NOW_ISO = '2026-07-30T12:00:00.000Z';
const pinnedNowFn = (): Date => new Date(PINNED_NOW_ISO);

const PARENT_EVENT_ID = 'event-parent-food-bank';

// Fabricated names/ids (constitution item 6), same register as this file's
// existing fixtures. Note the two deliberately DIFFERENT id spaces
// (`ParentRsvp.tsx` module doc #3): `id` is a `students.id`, `profileId` is
// that student's own `profiles.id`. Comparing across them is always a
// type-confused false negative, so the prefixes make the distinction visible.
const LINKED_STUDENT: RosterStudent = {
  id: 'student-amara-chen',
  name: 'Amara Chen',
  teamId: 'team-ravens',
  profileId: 'profile-amara-chen',
};
const UNLINKED_TEAMMATE: RosterStudent = {
  id: 'student-marcus-bello',
  name: 'Marcus Bello',
  teamId: 'team-ravens',
  profileId: 'profile-marcus-bello',
};
/** Deliberately a Titan, while the fixture event below is Ravens-scoped: this
 * parent IS linked to this student, but the student is filtered out by
 * `resolveEventRoster` before `resolveParentLinkedRosterStudents` ever runs.
 * That composition order is what the team-scope criterion proves. */
const OUT_OF_SCOPE_LINKED_STUDENT: RosterStudent = {
  id: 'student-sofia-delgado',
  name: 'Sofia Delgado',
  teamId: 'team-titans',
  profileId: 'profile-sofia-delgado',
};

/** What the real `loadGuardianLinksForParent` resolves for `PARENT_USER`.
 * `relationship` is a real, fabricated value -- PRD line 297's own literal
 * "Mom signed you up" example. */
const PARENT_GUARDIAN_LINKS: readonly GuardianLinkRow[] = [
  {
    id: 'link-amara',
    parentProfileId: PARENT_USER.id,
    studentId: LINKED_STUDENT.id,
    relationship: 'Mom',
  },
  {
    id: 'link-sofia',
    parentProfileId: PARENT_USER.id,
    studentId: OUT_OF_SCOPE_LINKED_STUDENT.id,
    relationship: 'Mom',
  },
];

const PARENT_SESSIONS: readonly OutreachDetailSession[] = [
  {
    id: 'session-parent-day1',
    eventId: PARENT_EVENT_ID,
    sessionDate: '2026-08-02',
    startsAt: '2026-08-02T14:00:00.000Z', // after PINNED_NOW_ISO -> editable
    endsAt: '2026-08-02T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
  // A SECOND session, deliberately: a one-session fixture could not detect a
  // heading that carries the student name but not the session date, because
  // there would be nothing to collide with.
  {
    id: 'session-parent-day2',
    eventId: PARENT_EVENT_ID,
    sessionDate: '2026-08-09',
    startsAt: '2026-08-09T14:00:00.000Z',
    endsAt: '2026-08-09T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
];

/** The date halves of the per-instance headings, as this page's own
 * `formatSessionDateOnly` renders them in America/Chicago (NFR-09). */
const DAY1_DATE_LABEL = 'Sun, Aug 2';
const DAY2_DATE_LABEL = 'Sun, Aug 9';

function makeParentLoadData(rsvps: readonly RsvpRow[] = []) {
  return async function loadParentDetail(eventId: string): Promise<OutreachDetailData | null> {
    return {
      event: {
        id: eventId,
        seasonId: 'season-1',
        type: 'outreach',
        title: 'Community Food Bank Sort',
        description: '',
        locationName: 'Riverside Food Bank',
        address: '100 Riverside Dr',
        // Ravens-only -- makes `OUT_OF_SCOPE_LINKED_STUDENT` genuinely
        // out-of-scope for this event.
        teamIds: ['team-ravens'],
        createdBy: null,
        countsParticipation: false,
        countsVolunteerHours: true,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
      },
      sessions: PARENT_SESSIONS,
      rsvps,
      students: [LINKED_STUDENT, UNLINKED_TEAMMATE, OUT_OF_SCOPE_LINKED_STUDENT],
      teams: [
        { id: 'team-ravens', name: 'Ravens', color: 'blue', archived: false },
        { id: 'team-titans', name: 'Titans', color: 'green', archived: false },
      ],
      profiles: [],
    };
  };
}

/**
 * Renders this page as a parent with a pinned clock and a stubbed
 * guardian-links loader.
 *
 * `loadRoster` is stubbed to resolve `[]` on purpose: left at its real default
 * it rejects in this environment (no configured Supabase client), which
 * renders this page's unrelated T147 roster-failure `Banner` -- whose own
 * "Retry" button would otherwise collide with the guardian-links Retry locator
 * the error-state criterion uses. Stubbing it keeps each criterion measuring
 * only its own subject.
 */
function renderParentDetail(
  props: Parameters<typeof OutreachDetail>[0] = {},
  user: AuthUser | null = PARENT_USER,
): void {
  renderDetail(
    PARENT_EVENT_ID,
    {
      loadData: makeParentLoadData(),
      loadRoster: async () => [],
      loadGuardianLinksForParent: async () => PARENT_GUARDIAN_LINKS,
      nowFn: pinnedNowFn,
      ...props,
    },
    user,
  );
}

/**
 * Locates one `<ParentRsvp>` instance by its page-owned `Heading level={4}`,
 * then scopes into that heading's own `VStack` sibling subtree.
 *
 * Why not `[role="radiogroup"]` directly: `SegmentedControl` emits its `label`
 * as an `aria-label`, never as `textContent`, and `ParentRsvp`'s own
 * `controlLabel` carries the event title and session date but NOT the
 * student's name -- so two linked students in one session produce two
 * radiogroups with byte-identical accessible names. The page-owned heading
 * carries BOTH name and date, so it is the only locator on this page that
 * uniquely identifies a (session x student) instance. It is also the item-15
 * accessibility requirement, not markup added for tests.
 */
function parentRsvpHeading(studentName: string, dateLabel: string): HTMLElement | undefined {
  const expected = `Your RSVP for ${studentName} — ${dateLabel}`;
  return Array.from(container.querySelectorAll('h4')).find((h) => h.textContent === expected) as
    HTMLElement | undefined;
}

function parentRsvpBlock(studentName: string, dateLabel: string): HTMLElement {
  const heading = parentRsvpHeading(studentName, dateLabel);
  if (!heading) {
    const present = Array.from(container.querySelectorAll('h4')).map((h) => h.textContent);
    throw new Error(
      `No "Your RSVP for ${studentName} — ${dateLabel}" heading. h4s present: ${present.join(' | ')}`,
    );
  }
  const block = heading.parentElement;
  if (!block) throw new Error('Heading has no parent element');
  return block as HTMLElement;
}

function parentRsvpControlIn(studentName: string, dateLabel: string): Element | null {
  return parentRsvpBlock(studentName, dateLabel).querySelector('[role="radiogroup"]');
}

/** Every `<ParentRsvp>` control on the page, located by the component's own
 * `controlLabel` template as an `aria-label` -- independent of this page's
 * headings, so a "renders nothing for this role" assertion cannot be satisfied
 * merely by the heading being absent. */
function allParentRsvpControls(): Element[] {
  return Array.from(
    container.querySelectorAll('[role="radiogroup"][aria-label^="RSVP on behalf of your student"]'),
  );
}

function allParentRsvpHeadings(): Element[] {
  return Array.from(container.querySelectorAll('h4')).filter((h) =>
    h.textContent?.startsWith('Your RSVP for'),
  );
}

// --- Criterion 2a: the authorization predicate itself, as a pure function ---
// Same shape as this file's own `groupSessionSignups`/`resolveEventRoster`
// describe blocks: constructed inputs, direct call, assert the output ids.

describe('resolveParentLinkedRosterStudents (T157) -- cross-family + roster-membership', () => {
  const THIRD_STUDENT: RosterStudent = {
    id: 'student-nina-ortiz',
    name: 'Nina Ortiz',
    teamId: 'team-ravens',
    profileId: 'profile-nina-ortiz',
  };
  const ROSTER: readonly RosterStudent[] = [LINKED_STUDENT, UNLINKED_TEAMMATE, THIRD_STUDENT];

  it('returns exactly the one roster student this parent is actually linked to', () => {
    const result = resolveParentLinkedRosterStudents(
      ROSTER,
      [
        {
          id: 'link-1',
          parentProfileId: PARENT_USER.id,
          studentId: LINKED_STUDENT.id,
          relationship: 'Mom',
        },
      ],
      PARENT_USER.id,
    );
    // Exact-array comparison, not `toContain`: a `.filter` that wrongly lets
    // the other two students through still "contains" the right one.
    expect(result).toEqual([LINKED_STUDENT]);
  });

  it('excludes a link row for the right student that belongs to a DIFFERENT parent', () => {
    // The `own_read` RLS policy on `guardian_links` is a disjunction
    // (`parent_profile_id = auth.uid() OR student_id in (select
    // my_student_ids())`), so a co-guardian's row for the same student is
    // readable and can reach this function. It must not grant this viewer a
    // control. This case is the ONLY one that fails if the
    // `link.parentProfileId === parentProfileId` predicate is dropped -- the
    // case above has a single matching link and would stay green.
    const result = resolveParentLinkedRosterStudents(
      ROSTER,
      [
        {
          id: 'link-other-parent',
          parentProfileId: 'profile-some-other-parent',
          studentId: LINKED_STUDENT.id,
          relationship: 'Dad',
        },
      ],
      PARENT_USER.id,
    );
    expect(result).toEqual([]);
  });

  it('returns nothing when the parent has no guardian links at all', () => {
    expect(resolveParentLinkedRosterStudents(ROSTER, [], PARENT_USER.id)).toEqual([]);
  });
});

// --- Criterion 1: reachability -- the central proof ---

describe('T157 reachability: a parent sees a real <ParentRsvp> control on this page', () => {
  it('renders one control per (session x linked student), each with its own dated heading', async () => {
    renderParentDetail();
    await flushMicrotasks();

    // The linked student gets a control on BOTH sessions -- an RSVP is a
    // per-session fact (component module doc #4/#13(d)), not a per-event one.
    expect(parentRsvpControlIn('Amara Chen', DAY1_DATE_LABEL)).toBeTruthy();
    expect(parentRsvpControlIn('Amara Chen', DAY2_DATE_LABEL)).toBeTruthy();

    // The two headings are genuinely distinct -- a name-only heading would
    // render the same text twice and let a locator silently take the first.
    expect(allParentRsvpHeadings().map((h) => h.textContent)).toEqual([
      `Your RSVP for Amara Chen — ${DAY1_DATE_LABEL}`,
      `Your RSVP for Amara Chen — ${DAY2_DATE_LABEL}`,
    ]);

    // It really is `ParentRsvp`'s own control, identified by that component's
    // own `controlLabel` template, carrying the real event title.
    expect(allParentRsvpControls()).toHaveLength(2);
    expect(allParentRsvpControls()[0].getAttribute('aria-label')).toBe(
      `RSVP on behalf of your student for Community Food Bank Sort on ${DAY1_DATE_LABEL}`,
    );
    // The control is genuinely usable, not rendered locked (pinned clock).
    expect(container.textContent).toContain(
      "You can change this on your student's behalf until the event starts.",
    );
  });
});

// --- Criteria 2b / 2c: rendered authorization proofs ---

describe('T157 authorization: which students actually get a control', () => {
  it('2b -- a roster teammate this parent is NOT linked to gets no control', async () => {
    renderParentDetail();
    await flushMicrotasks();

    // Marcus Bello is on the same team, in the same roster, on the same
    // sessions -- and is not this parent's child.
    expect(parentRsvpHeading('Marcus Bello', DAY1_DATE_LABEL)).toBeUndefined();
    expect(parentRsvpHeading('Marcus Bello', DAY2_DATE_LABEL)).toBeUndefined();
    // He is still on the page, in the signup buckets -- this is a control
    // gate, not a visibility gate.
    expect(container.textContent).toContain('Marcus Bello');
    expect(allParentRsvpHeadings()).toHaveLength(2); // Amara x 2 sessions only
  });

  it("2c -- a linked student outside this event's team scope gets no control", async () => {
    renderParentDetail();
    await flushMicrotasks();

    // Sofia Delgado IS in `PARENT_GUARDIAN_LINKS`, but she is a Titan and this
    // event is Ravens-scoped, so `resolveEventRoster` already removed her
    // before `resolveParentLinkedRosterStudents` ran. Composing against the
    // full `students` array instead of the team-scoped `roster` would wrongly
    // hand her a control.
    expect(parentRsvpHeading('Sofia Delgado', DAY1_DATE_LABEL)).toBeUndefined();
    expect(parentRsvpHeading('Sofia Delgado', DAY2_DATE_LABEL)).toBeUndefined();
    expect(container.textContent).not.toContain('Sofia Delgado');
    expect(allParentRsvpControls()).toHaveLength(2);
  });
});

// --- Criterion 3: negative space, role gating (not a mutation criterion) ---

describe('T157 <ParentRsvp> role gating', () => {
  it('an unauthenticated viewer gets no control and never triggers the guardian-links query', async () => {
    const loadGuardianLinksForParent = vi.fn(async () => PARENT_GUARDIAN_LINKS);
    renderParentDetail({ loadGuardianLinksForParent }, null);
    await flushMicrotasks();

    expect(allParentRsvpControls()).toHaveLength(0);
    expect(allParentRsvpHeadings()).toHaveLength(0);
    expect(loadGuardianLinksForParent).not.toHaveBeenCalled();
  });

  it('a signed-in student gets no control and never triggers the query', async () => {
    const loadGuardianLinksForParent = vi.fn(async () => PARENT_GUARDIAN_LINKS);
    renderParentDetail({ loadGuardianLinksForParent }, STUDENT_USER);
    await flushMicrotasks();

    expect(allParentRsvpControls()).toHaveLength(0);
    expect(allParentRsvpHeadings()).toHaveLength(0);
    expect(loadGuardianLinksForParent).not.toHaveBeenCalled();
    // The rest of the page is unchanged for a non-parent viewer.
    expect(container.textContent).toContain('Signups');
  });

  it('a signed-in coach gets no control and never triggers the query', async () => {
    const loadGuardianLinksForParent = vi.fn(async () => PARENT_GUARDIAN_LINKS);
    renderParentDetail({ loadGuardianLinksForParent }, COACH_USER);
    await flushMicrotasks();

    expect(allParentRsvpControls()).toHaveLength(0);
    expect(allParentRsvpHeadings()).toHaveLength(0);
    expect(loadGuardianLinksForParent).not.toHaveBeenCalled();
  });

  it('a signed-in admin gets no control and never triggers the query', async () => {
    const loadGuardianLinksForParent = vi.fn(async () => PARENT_GUARDIAN_LINKS);
    renderParentDetail({ loadGuardianLinksForParent }, ADMIN_USER);
    await flushMicrotasks();

    expect(allParentRsvpControls()).toHaveLength(0);
    expect(allParentRsvpHeadings()).toHaveLength(0);
    expect(loadGuardianLinksForParent).not.toHaveBeenCalled();
  });

  it('the parent viewer DOES trigger it, with their own real profiles.id', async () => {
    const loadGuardianLinksForParent = vi.fn(async () => PARENT_GUARDIAN_LINKS);
    renderParentDetail({ loadGuardianLinksForParent });
    await flushMicrotasks();

    expect(loadGuardianLinksForParent).toHaveBeenCalledWith(PARENT_USER.id);
  });
});

// --- Criterion 4: real `currentUserProfileId` threading ---

describe('T157 data threading: currentUserProfileId reaches the real mutation', () => {
  it('clicking a segment writes responded_by as the signed-in parent, not the placeholder', async () => {
    renderParentDetail();
    await flushMicrotasks();

    const goingButton = parentRsvpBlock('Amara Chen', DAY1_DATE_LABEL).querySelector(
      '[role="radiogroup"] button[data-value="going"]',
    );
    expect(goingButton).toBeTruthy();
    await act(async () => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flushMicrotasks();

    // The real shared `rsvps` upsert (`ParentRsvp`'s own baked-in default --
    // this page deliberately gives it no override prop), reached with the real
    // signed-in parent's `profiles.id`. With `currentUserProfileId` omitted at
    // the call site this records `PLACEHOLDER_CURRENT_PARENT_PROFILE_ID`
    // instead: a plausible-looking write attributed to nobody real.
    expect(mockedSubmitRsvpChange).toHaveBeenCalledTimes(1);
    expect(mockedSubmitRsvpChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-parent-day1',
        studentId: LINKED_STUDENT.id,
        status: 'going',
        respondedBy: PARENT_USER.id,
      }),
    );
  });
});

// --- Criterion 5: real `studentProfileId` threading ---

describe('T157 data threading: studentProfileId prevents self-answer misattribution', () => {
  it('a student\'s own RSVP shows NO attribution line, not "someone else recorded this"', async () => {
    // `respondedBy` is the STUDENT's own `profiles.id` -- a self-answered RSVP
    // (`ParentRsvp.tsx` module doc #2(b)). Note it is deliberately NOT
    // `LINKED_STUDENT.id`: that is a `students.id`, a different id space, and
    // comparing across the two is always a false negative.
    const selfAnswered: RsvpRow[] = [
      {
        id: 'rsvp-self',
        sessionId: 'session-parent-day1',
        studentId: LINKED_STUDENT.id,
        status: 'going',
        respondedBy: LINKED_STUDENT.profileId as string,
        updatedAt: '2026-07-20T09:00:00.000Z',
        createdAt: '2026-07-20T09:00:00.000Z',
      },
    ];
    renderParentDetail({ loadData: makeParentLoadData(selfAnswered) });
    await flushMicrotasks();

    const block = parentRsvpBlock('Amara Chen', DAY1_DATE_LABEL);
    // The row really did reach the control...
    expect(block.textContent).toContain('Current response: Sign up');
    // ...and resolved to `kind: 'self'`, which renders no attribution at all.
    // With `studentProfileId` wrongly `null`, attribution falls through
    // `guardianLinks` (no match -- the responder is the student, not a
    // guardian) and lands on `'unrecognized'`, wrongly telling this parent
    // that a stranger answered for their child.
    expect(block.textContent).not.toContain(
      "Someone else recorded this response on your student's behalf",
    );
    expect(block.textContent).not.toContain('signed you up');
  });
});

// --- Criterion 6: real `guardianLinks` threading ---

describe('T157 data threading: guardianLinks produces the real relationship label', () => {
  it('a parent-set RSVP renders "Mom signed you up" from the fetched relationship text', async () => {
    const parentAnswered: RsvpRow[] = [
      {
        id: 'rsvp-by-parent',
        sessionId: 'session-parent-day1',
        studentId: LINKED_STUDENT.id,
        status: 'maybe',
        respondedBy: PARENT_USER.id,
        updatedAt: '2026-07-20T09:00:00.000Z',
        createdAt: '2026-07-20T09:00:00.000Z',
      },
    ];
    renderParentDetail({ loadData: makeParentLoadData(parentAnswered) });
    await flushMicrotasks();

    const block = parentRsvpBlock('Amara Chen', DAY1_DATE_LABEL);
    // PRD line 297's literal example, built from the real
    // `guardian_links.relationship` text -- not a hardcoded 'Mom'. Passing
    // `[]` for `guardianLinks` instead drops this to the generic
    // "Someone else recorded..." line.
    expect(block.textContent).toContain('Mom signed you up');
    expect(block.textContent).not.toContain(
      "Someone else recorded this response on your student's behalf",
    );
  });
});

// --- Criterion 8: loading state (behavioral, not a mutation criterion) ---

describe('T157 DES-12 loading state for the "Your RSVP" region', () => {
  it('a parent sees a real loading announcement, and no control, while the fetch is in flight', async () => {
    renderParentDetail({
      loadGuardianLinksForParent: () => new Promise<readonly GuardianLinkRow[]>(() => {}),
    });
    await flushMicrotasks();

    // A parent's first paint is `loading`, never `idle` -- `idle` renders
    // nothing, which would make this assertion pass against an unrendered
    // state.
    const busy = container.querySelector('[aria-busy="true"]');
    expect(busy).toBeTruthy();
    expect(busy?.querySelector('[role="status"]')?.textContent).toContain(
      'Loading your RSVP options',
    );
    expect(allParentRsvpControls()).toHaveLength(0);
    expect(allParentRsvpHeadings()).toHaveLength(0);
    // The rest of the page is not blocked by this region's own load.
    expect(container.textContent).toContain('Signups');
    expect(container.textContent).toContain('Amara Chen');
  });
});

// --- Criterion 9: error + Retry state ---

describe('T157 DES-12 error state for the "Your RSVP" region', () => {
  it('a rejected fetch shows an honest Banner whose Retry really re-fetches and recovers', async () => {
    const loadGuardianLinksForParent = vi
      .fn<(parentProfileId: string) => Promise<readonly GuardianLinkRow[]>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(PARENT_GUARDIAN_LINKS);

    renderParentDetail({ loadGuardianLinksForParent });
    await flushMicrotasks();

    expect(loadGuardianLinksForParent).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Couldn't load your linked students");
    // Never a silent fallback to a fixture or an assumed linkage.
    expect(allParentRsvpControls()).toHaveLength(0);

    const retryButtons = Array.from(container.querySelectorAll('button')).filter(
      (btn) => btn.textContent?.trim() === 'Retry',
    );
    expect(retryButtons).toHaveLength(1);
    act(() => {
      retryButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(loadGuardianLinksForParent).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Couldn't load your linked students");
    expect(parentRsvpControlIn('Amara Chen', DAY1_DATE_LABEL)).toBeTruthy();
  });
});

// --- Criterion 10: ready-but-empty (the deliberate no-empty-state choice) ---

describe('T157 DES-12 empty state: a parent with zero linked students', () => {
  it('sees no "Your RSVP" section at all, and no stray loading or error UI', async () => {
    renderParentDetail({ loadGuardianLinksForParent: async () => [] });
    await flushMicrotasks();

    // Deliberate and tested, not an oversight: there is nothing for this
    // viewer to RSVP for, so no section and no dedicated empty-state copy is
    // rendered. A zero-length `ready` IS the empty state here, matching this
    // file's own already-shipped `RosterLoadState` mapping of DES-12.
    expect(allParentRsvpHeadings()).toHaveLength(0);
    expect(allParentRsvpControls()).toHaveLength(0);
    expect(container.textContent).not.toContain('Your RSVP');
    // The load genuinely completed -- neither state is left behind.
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(container.textContent).not.toContain("Couldn't load your linked students");
    // Nothing else on the page is disturbed.
    expect(container.textContent).toContain('Signups');
    expect(container.textContent).toContain('Amara Chen');
    expect(container.textContent).toContain('Marcus Bello');
  });
});

// ---------------------------------------------------------------------------
// T169 (OutreachDetail half): the STUDENT's own self-service `RsvpControl`
// (component module doc #14). Every criterion below lives here, never in
// `RsvpControl.test.tsx` -- a criterion satisfiable from that component's own
// test file would reproduce the exact "green suite, unreachable feature"
// blind spot this task exists to close.
//
// Fixture-trap note (packet §6): the existing `STUDENT_USER` fixture
// (`id: 'profile-student-1'`) deliberately never matches any roster row
// anywhere in this file (including `ParentRsvp`'s own `LINKED_STUDENT`-family
// ids) -- that is good for the negative-space criteria below, but means a
// NEW, dedicated, self-contained student fixture set is required for the
// positive-path criteria. `STUDENT_USER`/its id is never reused here.
// ---------------------------------------------------------------------------

const STUDENT_SELF_EVENT_ID = 'event-student-self-service';
const STUDENT_SELF_EVENT_TITLE = 'Downtown Shelter Meal Prep';

// Fabricated names (constitution item 6), deliberately distinct from every
// other fixture name in this file / `ParentRsvp`'s own fixtures.
/** The signed-in student's OWN roster row -- `profileId` matches
 * `SELF_STUDENT_USER.id` below, per module doc #11's `AuthUser.id ===
 * profiles.id` proof. */
const OWN_STUDENT_ROSTER_ROW: RosterStudent = {
  id: 'student-devon-osei',
  name: 'Devon Osei',
  teamId: 'team-ravens',
  profileId: 'profile-devon-osei',
};
const SELF_STUDENT_USER: AuthUser = {
  id: 'profile-devon-osei', // matches OWN_STUDENT_ROSTER_ROW.profileId
  email: 'devon@example.com',
  role: 'student',
};

/** A second roster row on the SAME team/session as `OWN_STUDENT_ROSTER_ROW`,
 * whose `profileId` never matches the signed-in student -- criterion 3's
 * self-vs-cross-student proof (this student must never get a control, and a
 * click on the viewer's own control must never write this student's id). */
const OTHER_STUDENT_ROSTER_ROW: RosterStudent = {
  id: 'student-priya-nandan',
  name: 'Priya Nandan',
  teamId: 'team-ravens',
  profileId: 'profile-priya-nandan',
};

/** Deliberately a Titan, while the fixture event used with it is Ravens-
 * scoped -- criterion 4's team-scope composition-order proof (same shape as
 * T157's own `OUT_OF_SCOPE_LINKED_STUDENT`). Same `profileId` as
 * `OWN_STUDENT_ROSTER_ROW` (it IS the signed-in student's own record, just
 * for a team outside this event's scope), deliberately different `id` so a
 * wrongly-rendered control is unambiguously identifiable if this regresses. */
const OUT_OF_SCOPE_SELF_STUDENT_ROW: RosterStudent = {
  id: 'student-devon-osei-titans-record',
  name: 'Devon Osei',
  teamId: 'team-titans',
  profileId: 'profile-devon-osei',
};

// Criterion 5's positive control: each of these three roster rows'
// `profileId` DELIBERATELY equals a non-student viewer's own `AuthUser.id`
// below, proving an absent self-RSVP control for that viewer is really
// role-gating, not just "this viewer happens to have no roster match anyway"
// (T170's own BLOCKER-1 lesson).
const COACH_MATCHED_ROSTER_ROW: RosterStudent = {
  id: 'student-jules-ferreira',
  name: 'Jules Ferreira',
  teamId: 'team-ravens',
  profileId: COACH_USER.id,
};
const ADMIN_MATCHED_ROSTER_ROW: RosterStudent = {
  id: 'student-kai-whitmore',
  name: 'Kai Whitmore',
  teamId: 'team-ravens',
  profileId: ADMIN_USER.id,
};
const PARENT_MATCHED_ROSTER_ROW: RosterStudent = {
  id: 'student-sana-iyer',
  name: 'Sana Iyer',
  teamId: 'team-ravens',
  profileId: PARENT_USER.id,
};

/** Two sessions, deliberately on different calendar dates (§5e's own
 * disclosed same-day-collision hazard) -- one strictly after `pinnedNowFn`
 * (editable), one strictly before it (locked). Reuses the SAME
 * `PINNED_NOW_ISO`/`pinnedNowFn` this file's own `ParentRsvp` fixtures
 * already established above, rather than inventing a second pinned instant
 * for no reason. */
const STUDENT_SELF_SESSIONS: readonly OutreachDetailSession[] = [
  {
    id: 'session-student-self-day1',
    eventId: STUDENT_SELF_EVENT_ID,
    sessionDate: '2026-08-02',
    startsAt: '2026-08-02T14:00:00.000Z', // after PINNED_NOW_ISO -> editable
    endsAt: '2026-08-02T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
  {
    id: 'session-student-self-day2',
    eventId: STUDENT_SELF_EVENT_ID,
    sessionDate: '2026-07-19',
    startsAt: '2026-07-19T14:00:00.000Z', // before PINNED_NOW_ISO -> locked
    endsAt: '2026-07-19T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
];

function makeStudentSelfLoadData(
  overrides: {
    students?: readonly RosterStudent[];
    teamIds?: string[] | null;
    sessions?: readonly OutreachDetailSession[];
    rsvps?: readonly RsvpRow[];
  } = {},
) {
  const {
    students = [OWN_STUDENT_ROSTER_ROW, OTHER_STUDENT_ROSTER_ROW],
    teamIds = null,
    sessions = STUDENT_SELF_SESSIONS,
    rsvps = [],
  } = overrides;
  return async function loadStudentSelfDetail(eventId: string): Promise<OutreachDetailData | null> {
    return {
      event: {
        id: eventId,
        seasonId: 'season-1',
        type: 'outreach',
        title: STUDENT_SELF_EVENT_TITLE,
        description: '',
        locationName: 'Downtown Shelter',
        address: '400 Elm St',
        teamIds,
        createdBy: null,
        countsParticipation: false,
        countsVolunteerHours: true,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
      },
      sessions,
      rsvps,
      students,
      teams: [
        { id: 'team-ravens', name: 'Ravens', color: 'blue', archived: false },
        { id: 'team-titans', name: 'Titans', color: 'green', archived: false },
      ],
      profiles: [],
    };
  };
}

/**
 * Renders this page as a student, with a pinned clock and `loadRoster`
 * stubbed. Same reasoning as this file's own `renderParentDetail` precedent
 * (packet's own required-stub note, §6/criterion 8): left at its real
 * default, `loadRoster` rejects in this environment (no configured Supabase
 * client) and renders the unrelated T147 roster-failure `Banner` instead of
 * the state these criteria actually test. `loadGuardianLinksForParent` is
 * also stubbed so a role-gating test that renders as `PARENT_USER` never
 * reaches a real, unconfigured Supabase client either.
 */
function renderStudentSelfDetail(
  props: Parameters<typeof OutreachDetail>[0] = {},
  user: AuthUser | null = SELF_STUDENT_USER,
): void {
  renderDetail(
    STUDENT_SELF_EVENT_ID,
    {
      loadData: makeStudentSelfLoadData(),
      loadRoster: async () => [],
      loadGuardianLinksForParent: async () => [],
      nowFn: pinnedNowFn,
      ...props,
    },
    user,
  );
}

/** Locates a single self-RSVP control by `RsvpControl`'s own `controlLabel`
 * `aria-label` (§5e's locator -- no page-owned heading needed here, unlike
 * `<ParentRsvp>`'s, since a student never sees another student's control). */
function studentSelfRsvpControl(
  session: OutreachDetailSession,
  eventTitle: string = STUDENT_SELF_EVENT_TITLE,
): Element | null {
  const label = `Your RSVP for ${eventTitle} on ${formatSessionDateOnly(session)}`;
  return container.querySelector(`[role="radiogroup"][aria-label="${label}"]`);
}

/** Every self-RSVP control on the page, independent of any particular
 * session -- used by the negative-space/role-gating criteria. */
function allStudentSelfRsvpControls(): Element[] {
  return Array.from(container.querySelectorAll('[role="radiogroup"][aria-label^="Your RSVP for"]'));
}

// --- Criterion 2: `resolveOwnRosterStudent` -- direct unit describe block ---

describe('resolveOwnRosterStudent (T169) -- self-to-self, not cross-person', () => {
  const THIRD_ROSTER_ROW: RosterStudent = {
    id: 'student-third-teammate',
    name: 'Third Teammate',
    teamId: 'team-ravens',
    profileId: 'profile-third-teammate',
  };
  const ROSTER: readonly RosterStudent[] = [
    OWN_STUDENT_ROSTER_ROW,
    OTHER_STUDENT_ROSTER_ROW,
    THIRD_ROSTER_ROW,
  ];

  it('returns the one roster row whose profileId matches the signed-in student, among 3+', () => {
    expect(resolveOwnRosterStudent(ROSTER, OWN_STUDENT_ROSTER_ROW.profileId as string)).toEqual(
      OWN_STUDENT_ROSTER_ROW,
    );
  });

  it('returns null when no roster row matches at all', () => {
    expect(resolveOwnRosterStudent(ROSTER, 'profile-nobody-on-this-roster')).toBeNull();
  });

  it('excludes a near-miss -- a similar-but-not-equal profileId does not match', () => {
    // Differs from the real `profile-devon-osei` only by a suffix --
    // exercises a strict `===` predicate, not a substring/prefix match that
    // would wrongly succeed.
    expect(resolveOwnRosterStudent(ROSTER, 'profile-devon-osei-jr')).toBeNull();
  });
});

// --- Criterion 1: reachability -- the central proof ---

describe('T169 reachability: a student sees a real <RsvpControl> for each session', () => {
  it("renders a real, labeled RsvpControl for each session, for the viewer's own roster row", async () => {
    renderStudentSelfDetail();
    await flushMicrotasks();

    const day1Control = studentSelfRsvpControl(STUDENT_SELF_SESSIONS[0]);
    const day2Control = studentSelfRsvpControl(STUDENT_SELF_SESSIONS[1]);
    expect(day1Control).toBeTruthy();
    expect(day2Control).toBeTruthy();
    expect(day1Control).not.toBe(day2Control);
  });
});

// --- Criterion 3: integration -- self-only, not cross-student ---

describe('T169 integration: self-only, not cross-student (the real rsvps.student_id proof)', () => {
  it('renders exactly one self-RSVP control per session, and writes only the viewer’s own roster id', async () => {
    renderStudentSelfDetail();
    await flushMicrotasks();

    // Count equals session count, not double -- a student never gets a
    // control for the OTHER roster student sharing this session.
    expect(allStudentSelfRsvpControls()).toHaveLength(STUDENT_SELF_SESSIONS.length);

    const day1Control = studentSelfRsvpControl(STUDENT_SELF_SESSIONS[0]);
    const goingButton = day1Control?.querySelector('button[data-value="going"]');
    expect(goingButton).toBeTruthy();
    await act(async () => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flushMicrotasks();

    // `RsvpControl` emits no `studentId` into the DOM -- the spy's own call
    // arguments are the only way to observe which student the control
    // actually targets.
    expect(mockedSubmitRsvpChange).toHaveBeenCalledTimes(1);
    expect(mockedSubmitRsvpChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: STUDENT_SELF_SESSIONS[0].id,
        studentId: OWN_STUDENT_ROSTER_ROW.id,
        status: 'going',
        respondedBy: SELF_STUDENT_USER.id,
      }),
    );
  });
});

// --- Criterion 4: team-scope composition order ---

describe('T169 team-scope composition: the self-to-self predicate composes over the ALREADY team-scoped roster', () => {
  it("a self roster row outside this event's team scope gets no control anywhere on the page", async () => {
    renderStudentSelfDetail({
      loadData: makeStudentSelfLoadData({
        students: [OUT_OF_SCOPE_SELF_STUDENT_ROW, OTHER_STUDENT_ROSTER_ROW],
        teamIds: ['team-ravens'], // event scoped to Ravens; Devon's row here is Titans
      }),
    });
    await flushMicrotasks();

    expect(allStudentSelfRsvpControls()).toHaveLength(0);
    // Not a visibility gate -- the rest of the page is unaffected.
    expect(container.textContent).toContain('Signups');
  });
});

// --- Criterion 5: role gating, paired with a positive control ---

describe('T169 role gating, paired with a positive control (per T170’s BLOCKER-1 lesson)', () => {
  it('an unauthenticated viewer sees no self-RSVP control; the rest of the page still renders', async () => {
    renderStudentSelfDetail({}, null);
    await flushMicrotasks();

    expect(allStudentSelfRsvpControls()).toHaveLength(0);
    // Positive-control precondition is waived for this case (no viewer id to
    // match) -- assert the page's other expected content instead.
    expect(container.textContent).toContain('Signups');
    expect(container.textContent).toContain(STUDENT_SELF_EVENT_TITLE);
  });

  it('a signed-in coach with a genuinely matching roster row still sees no control -- but does see the Attendance panel', async () => {
    renderStudentSelfDetail(
      {
        loadData: makeStudentSelfLoadData({
          students: [COACH_MATCHED_ROSTER_ROW, OTHER_STUDENT_ROSTER_ROW],
        }),
      },
      COACH_USER,
    );
    await flushMicrotasks();

    expect(allStudentSelfRsvpControls()).toHaveLength(0);
    expect(container.textContent).toContain('Attendance');
  });

  it('a signed-in admin with a genuinely matching roster row still sees no control -- but does see the Attendance panel', async () => {
    renderStudentSelfDetail(
      {
        loadData: makeStudentSelfLoadData({
          students: [ADMIN_MATCHED_ROSTER_ROW, OTHER_STUDENT_ROSTER_ROW],
        }),
      },
      ADMIN_USER,
    );
    await flushMicrotasks();

    expect(allStudentSelfRsvpControls()).toHaveLength(0);
    expect(container.textContent).toContain('Attendance');
  });

  it('a signed-in parent with a genuinely matching roster row still sees no self-RSVP control -- but does see their own ParentRsvp control', async () => {
    renderStudentSelfDetail(
      {
        loadData: makeStudentSelfLoadData({
          students: [PARENT_MATCHED_ROSTER_ROW, OTHER_STUDENT_ROSTER_ROW],
        }),
        loadGuardianLinksForParent: async () => [
          {
            id: 'link-sana',
            parentProfileId: PARENT_USER.id,
            studentId: PARENT_MATCHED_ROSTER_ROW.id,
            relationship: 'Guardian',
          },
        ],
      },
      PARENT_USER,
    );
    await flushMicrotasks();

    expect(allStudentSelfRsvpControls()).toHaveLength(0);
    // (b) positive control: the parent's OWN `<ParentRsvp>` control genuinely
    // rendered, proving the page did not simply fail to render for this
    // fixture -- distinct aria-label prefix, cannot collide with the
    // self-RSVP locator above.
    expect(
      container.querySelector('[role="radiogroup"][aria-label^="RSVP on behalf of your student"]'),
    ).toBeTruthy();
  });
});

// --- Criterion 6: real currentUserProfileId threading ---

describe('T169 data threading: currentUserProfileId reaches the real mutation, not the disclosed placeholder', () => {
  it('clicking a segment writes responded_by as the signed-in student', async () => {
    renderStudentSelfDetail();
    await flushMicrotasks();

    const day1Control = studentSelfRsvpControl(STUDENT_SELF_SESSIONS[0]);
    const maybeButton = day1Control?.querySelector('button[data-value="maybe"]');
    expect(maybeButton).toBeTruthy();
    await act(async () => {
      maybeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(mockedSubmitRsvpChange).toHaveBeenCalledWith(
      expect.objectContaining({
        respondedBy: SELF_STUDENT_USER.id,
        studentId: OWN_STUDENT_ROSTER_ROW.id,
      }),
    );
  });
});

// --- Criterion 7: clock seam wired ---

/**
 * A dedicated, deliberately EXTREME pinned instant for this criterion --
 * distinct from `PINNED_NOW_ISO` above. Chosen so the pinned clock genuinely
 * DISAGREES with the real system clock (this repo's actual `now` is firmly
 * past 2020, and always will be), which is what makes dropping `now={nowFn}`
 * from the call site an OBSERVABLE, not vacuous, mutation: before the
 * mutation, `CLOCK_SEAM_EDITABLE_SESSION` renders editable (the pinned clock
 * says "not yet started"); after the mutation (the real system clock takes
 * over), it renders locked (the real clock says it started years ago).
 */
const CLOCK_SEAM_PINNED_NOW_ISO = '2020-01-01T00:00:00.000Z';
const clockSeamPinnedNowFn = (): Date => new Date(CLOCK_SEAM_PINNED_NOW_ISO);

const CLOCK_SEAM_EDITABLE_SESSION: OutreachDetailSession = {
  id: 'session-clock-seam-editable',
  eventId: STUDENT_SELF_EVENT_ID,
  sessionDate: '2020-01-02',
  startsAt: '2020-01-02T00:00:00.000Z', // after CLOCK_SEAM_PINNED_NOW_ISO -> editable under the pinned clock
  endsAt: '2020-01-02T03:00:00.000Z',
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};
const CLOCK_SEAM_LOCKED_SESSION: OutreachDetailSession = {
  id: 'session-clock-seam-locked',
  eventId: STUDENT_SELF_EVENT_ID,
  sessionDate: '2019-12-30',
  startsAt: '2019-12-30T00:00:00.000Z', // before CLOCK_SEAM_PINNED_NOW_ISO -> locked
  endsAt: '2019-12-30T03:00:00.000Z',
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};

describe('T169 clock seam: now={nowFn} is genuinely wired to the self-service control', () => {
  it('a session pinned strictly before its start is editable; one pinned strictly after its start is locked', async () => {
    renderStudentSelfDetail({
      loadData: makeStudentSelfLoadData({
        sessions: [CLOCK_SEAM_EDITABLE_SESSION, CLOCK_SEAM_LOCKED_SESSION],
      }),
      nowFn: clockSeamPinnedNowFn,
    });
    await flushMicrotasks();

    const editableControl = studentSelfRsvpControl(CLOCK_SEAM_EDITABLE_SESSION);
    const lockedControl = studentSelfRsvpControl(CLOCK_SEAM_LOCKED_SESSION);
    expect(
      editableControl?.querySelector('button[data-value="going"]')?.getAttribute('aria-disabled'),
    ).not.toBe('true');
    expect(
      lockedControl?.querySelector('button[data-value="going"]')?.getAttribute('aria-disabled'),
    ).toBe('true');
  });
});

// --- Criterion 8: empty case (§5g) ---

describe('T169 empty case (§5g): a student viewer whose own roster row does not exist for this event', () => {
  it('sees no self-RSVP control or section anywhere, and the rest of the page renders undisturbed', async () => {
    renderStudentSelfDetail({
      loadData: makeStudentSelfLoadData({
        students: [OTHER_STUDENT_ROSTER_ROW], // no roster row's profileId matches SELF_STUDENT_USER.id
      }),
    });
    await flushMicrotasks();

    expect(allStudentSelfRsvpControls()).toHaveLength(0);
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(container.textContent).not.toContain("Couldn't load");
    // Nothing else on the page is disturbed.
    expect(container.textContent).toContain('Signups');
    expect(container.textContent).toContain(OTHER_STUDENT_ROSTER_ROW.name);
  });
});

// ---------------------------------------------------------------------------
// T179 (OUT-05, `docs/swarm/VOLT_Portal_PRD.md:318`): the per-session "Mark
// day complete" trigger + dialog (component module doc #15). Criteria A1-A4
// live in `MarkDayCompleteDialog.test.tsx`/`MarkEventCompleteDialog.test.tsx`
// (the props are required there); B1-B7 live here, since they are about THIS
// page's wiring, not that dialog's own internal behavior (which
// `MarkDayCompleteDialog.test.tsx` already covers and is not duplicated).
// ---------------------------------------------------------------------------

describe('isSessionMarkDayCompleteEligible (T179, module doc #15(c) -- OUT-05 gates on session DATE, not startsAt)', () => {
  const BASE: OutreachDetailSession = {
    id: 'session-eligibility-base',
    eventId: 'event-eligibility-base',
    sessionDate: '2026-08-03',
    startsAt: '2026-08-03T14:00:00.000Z', // 9:00 AM America/Chicago
    endsAt: '2026-08-03T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  };

  it('is eligible once the Chicago date reaches the session date, even BEFORE startsAt (the session’s own morning)', () => {
    // 8:00 AM America/Chicago on the session's own date -- strictly before
    // `startsAt` (9:00 AM Chicago), but ON the date OUT-05 gates on.
    const eightAmChicago = new Date('2026-08-03T13:00:00.000Z');
    expect(isSessionMarkDayCompleteEligible(BASE, eightAmChicago)).toBe(true);
  });

  it('is NOT eligible the calendar day before the session date', () => {
    const dayBeforeChicago = new Date('2026-08-02T23:00:00.000Z'); // still Aug 2 in Chicago (CDT, UTC-5)
    expect(isSessionMarkDayCompleteEligible(BASE, dayBeforeChicago)).toBe(false);
  });

  it('is NOT eligible for a completed session, regardless of the clock', () => {
    const farFuture = new Date('2030-01-01T00:00:00.000Z');
    expect(isSessionMarkDayCompleteEligible({ ...BASE, status: 'completed' }, farFuture)).toBe(
      false,
    );
  });

  it('is NOT eligible for a canceled session, regardless of the clock', () => {
    const farFuture = new Date('2030-01-01T00:00:00.000Z');
    expect(isSessionMarkDayCompleteEligible({ ...BASE, status: 'canceled' }, farFuture)).toBe(
      false,
    );
  });

  // T179 follow-up round (checker MINOR #1): every instant used above is one
  // where Chicago and UTC agree on the calendar date -- including the
  // "still Aug 2 in Chicago" case just above, which is Aug 2 in UTC too.
  // Mutating `CHICAGO_TIME_ZONE` -> `'UTC'` inside `formatChicagoDateOnly`
  // left the whole suite green. These two cases pin instants where the two
  // zones DISAGREE on the date, so that mutation reddens here.
  it('is NOT eligible when it is already the session date in UTC but still the day before in Chicago (CDT)', () => {
    // 2026-08-04T02:00:00.000Z is 9:00 PM on 2026-08-03 in America/Chicago
    // (CDT, UTC-5) but is already 2026-08-04 in UTC.
    const stillAug3InChicago = new Date('2026-08-04T02:00:00.000Z');
    expect(
      isSessionMarkDayCompleteEligible({ ...BASE, sessionDate: '2026-08-04' }, stillAug3InChicago),
    ).toBe(false);
  });

  it('is NOT eligible when it is already the session date in UTC but still the day before in Chicago (CST, winter offset)', () => {
    // 2026-01-05T05:30:00.000Z is 11:30 PM on 2026-01-04 in America/Chicago
    // (CST, UTC-6 -- a different offset than the CDT case above) but is
    // already 2026-01-05 in UTC.
    const stillJan4InChicago = new Date('2026-01-05T05:30:00.000Z');
    expect(
      isSessionMarkDayCompleteEligible({ ...BASE, sessionDate: '2026-01-05' }, stillJan4InChicago),
    ).toBe(false);
  });
});

const MARK_DAY_EVENT_ID = 'event-riverside-trail-build';

/** T179 (Trap 11) -- deliberately DISTINCT from `FIXTURE_STUDENTS`
 * (`OutreachDetail.tsx:683-714`'s own "Amara Chen"/"Marcus Bello"/
 * "Nina Ortiz"/"Sofia Delgado"/"Ravi Kapoor", reached via
 * `defaultLoadOutreachDetail` -- the loader EVERY OTHER test in this file
 * uses). This task's own premise gate measured that a test asserting "the
 * dialog shows no fixture names" against the default loader passes for a
 * reason that has nothing to do with the wiring under test
 * (`[true, true, true, true]` -- all four `DEFAULT_ROSTER` names are also
 * `FIXTURE_STUDENTS` names). Using a genuinely different roster here means
 * B4's positive assertion (below) can only pass if this page's own real
 * roster actually reached the dialog. */
const MDC_ROSTER: readonly RosterStudent[] = [
  {
    id: 'student-priya-shah',
    name: 'Priya Shah',
    teamId: 'team-comets',
    profileId: 'profile-priya-shah',
  },
  {
    id: 'student-devon-osei',
    name: 'Devon Osei',
    teamId: 'team-comets',
    profileId: 'profile-devon-osei',
  },
];

const MDC_SESSION_1: OutreachDetailSession = {
  id: 'session-mdc-1',
  eventId: MARK_DAY_EVENT_ID,
  sessionDate: '2026-08-03',
  startsAt: '2026-08-03T14:00:00.000Z',
  endsAt: '2026-08-03T17:00:00.000Z',
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};
const MDC_SESSION_2: OutreachDetailSession = {
  id: 'session-mdc-2',
  eventId: MARK_DAY_EVENT_ID,
  sessionDate: '2026-08-04',
  startsAt: '2026-08-04T14:00:00.000Z',
  endsAt: '2026-08-04T17:00:00.000Z',
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};
const MDC_SESSION_3: OutreachDetailSession = {
  id: 'session-mdc-3',
  eventId: MARK_DAY_EVENT_ID,
  sessionDate: '2026-08-05',
  startsAt: '2026-08-05T14:00:00.000Z',
  endsAt: '2026-08-05T17:00:00.000Z',
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};

/** Strictly on/after all three `MDC_SESSION_*` dates, so every session is
 * date-eligible under this pinned clock -- the stable baseline B1/B3/B4/B5/B6
 * need. B2 (eligibility itself) pins its own, separate clocks per case. */
const MDC_NOW_ISO = '2026-08-06T12:00:00.000Z';
const mdcNowFn = (): Date => new Date(MDC_NOW_ISO);

function makeMarkDayCompleteLoadData(
  overrides: Partial<OutreachDetailData> = {},
): LoadOutreachDetailFn {
  return async () => ({
    event: {
      id: MARK_DAY_EVENT_ID,
      seasonId: 'season-1',
      type: 'outreach',
      title: 'Riverside Trail Build',
      description: '',
      locationName: 'Riverside Trail',
      address: '200 Trail Rd',
      teamIds: null,
      createdBy: null,
      countsParticipation: false,
      countsVolunteerHours: true,
      adultVolunteersCount: 0,
      adultVolunteerHours: 0,
    },
    sessions: [MDC_SESSION_1, MDC_SESSION_2, MDC_SESSION_3],
    rsvps: [],
    students: MDC_ROSTER,
    teams: [{ id: 'team-comets', name: 'Comets', color: 'purple', archived: false }],
    profiles: [],
    ...overrides,
  });
}

/** `loadRoster` is stubbed to `[]` -- same reasoning `renderParentDetail`
 * above already documents: left at its real default it rejects in this
 * environment (no configured Supabase client), which would render this
 * page's own unrelated T147 roster-failure Banner. Stubbing it also means
 * `eventDialogRoster` (`OutreachEventDialog`'s OWN, unrelated checklist
 * roster, module doc #10) is a real, empty array -- deliberately NOT
 * `MDC_ROSTER` -- so B4's mutation (passing `eventDialogRoster` instead of
 * `roster` at the `MarkDayCompleteDialog` call site) is genuinely
 * observable: it would render an EMPTY checklist, not a differently-named
 * one. */
function renderMarkDayCompleteDetail(
  props: Parameters<typeof OutreachDetail>[0] = {},
  user: AuthUser | null = COACH_USER,
): void {
  renderDetail(
    MARK_DAY_EVENT_ID,
    {
      loadData: makeMarkDayCompleteLoadData(),
      loadRoster: async () => [],
      nowFn: mdcNowFn,
      ...props,
    },
    user,
  );
}

/** Every "Mark day complete" trigger currently in the DOM, located by
 * `aria-label` STARTING WITH the literal (Trap 9/B1/item 15) -- never exact
 * `textContent`, which is the SAME literal string across every trigger by
 * design (module doc #15(d), Astryx `Button`'s `label`/`children` split). */
function findMarkDayCompleteTriggers(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button')).filter((btn) =>
    (btn.getAttribute('aria-label') ?? '').startsWith('Mark day complete'),
  );
}

/** The one `<dialog>` whose own text starts with "Mark day complete" (Trap
 * 10) -- this page ALSO mounts `MarkEventCompleteDialog` ("Mark event
 * complete"…), `OutreachEventDialog`, and `AlertDialog`, all present in the
 * DOM whether open or not. A bare `container.querySelector('dialog')`
 * returns the FIRST of the four, which this task's own premise gate measured
 * is the wrong one. */
function findMarkDayCompleteDialogElement(): Element | undefined {
  return Array.from(container.querySelectorAll('dialog')).find((d) =>
    d.textContent?.trim().startsWith('Mark day complete'),
  );
}

function findMarkDayCompleteConfirmButton(): HTMLButtonElement | undefined {
  return Array.from(findMarkDayCompleteDialogElement()?.querySelectorAll('button') ?? []).find(
    (btn) => btn.textContent?.trim().startsWith('Mark complete'),
  );
}

describe('"Mark day complete" per-session trigger -- staff-only, distinct accessible names (B1)', () => {
  it('shows one trigger per session for a coach, with THREE DISTINCT accessible names (Trap 9)', async () => {
    renderMarkDayCompleteDetail();
    await flushMicrotasks();

    const triggers = findMarkDayCompleteTriggers();
    expect(triggers).toHaveLength(3);
    const accessibleNames = triggers.map((btn) => btn.getAttribute('aria-label'));
    expect(new Set(accessibleNames).size).toBe(3);
    // Visible text stays the SAME literal "Mark day complete" for every
    // trigger -- only the accessible name carries the disambiguating date.
    for (const trigger of triggers) {
      expect(trigger.textContent?.trim()).toBe('Mark day complete');
    }
  });

  it('shows one trigger per session for a signed-in admin too', async () => {
    renderMarkDayCompleteDetail({}, ADMIN_USER);
    await flushMicrotasks();
    expect(findMarkDayCompleteTriggers()).toHaveLength(3);
  });

  it('is absent for a signed-in parent -- Signups still renders (absence is not a failed load)', async () => {
    renderMarkDayCompleteDetail({ loadGuardianLinksForParent: async () => [] }, PARENT_USER);
    await flushMicrotasks();
    expect(findMarkDayCompleteTriggers()).toHaveLength(0);
    expect(container.textContent).toContain('Signups');
  });

  it('is absent for a signed-in student -- Signups still renders', async () => {
    renderMarkDayCompleteDetail({}, STUDENT_USER);
    await flushMicrotasks();
    expect(findMarkDayCompleteTriggers()).toHaveLength(0);
    expect(container.textContent).toContain('Signups');
  });

  it('is absent for a signed-out visitor -- Signups still renders', async () => {
    renderMarkDayCompleteDetail({}, null);
    await flushMicrotasks();
    expect(findMarkDayCompleteTriggers()).toHaveLength(0);
    expect(container.textContent).toContain('Signups');
  });
});

describe('"Mark day complete" eligibility gates the trigger, wired end to end (B2)', () => {
  const TOMORROW_SESSION: OutreachDetailSession = {
    id: 'session-mdc-tomorrow',
    eventId: MARK_DAY_EVENT_ID,
    sessionDate: '2026-08-10',
    startsAt: '2026-08-10T14:00:00.000Z',
    endsAt: '2026-08-10T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  };
  const beforeTheDateNowFn = (): Date => new Date('2026-08-09T12:00:00.000Z'); // Aug 9 in Chicago
  const onTheDateNowFn = (): Date => new Date('2026-08-10T18:00:00.000Z'); // Aug 10 in Chicago

  it('a scheduled session whose date is TOMORROW (relative to nowFn) shows NO trigger', async () => {
    renderMarkDayCompleteDetail({
      loadData: makeMarkDayCompleteLoadData({ sessions: [TOMORROW_SESSION] }),
      nowFn: beforeTheDateNowFn,
    });
    await flushMicrotasks();
    expect(findMarkDayCompleteTriggers()).toHaveLength(0);
  });

  it('the SAME session shows a trigger once nowFn reaches that date', async () => {
    renderMarkDayCompleteDetail({
      loadData: makeMarkDayCompleteLoadData({ sessions: [TOMORROW_SESSION] }),
      nowFn: onTheDateNowFn,
    });
    await flushMicrotasks();
    expect(findMarkDayCompleteTriggers()).toHaveLength(1);
  });

  it('a COMPLETED session shows NO trigger regardless of the clock', async () => {
    renderMarkDayCompleteDetail({
      loadData: makeMarkDayCompleteLoadData({
        sessions: [{ ...MDC_SESSION_1, status: 'completed' }],
      }),
      nowFn: mdcNowFn, // far after MDC_SESSION_1's own date
    });
    await flushMicrotasks();
    expect(findMarkDayCompleteTriggers()).toHaveLength(0);
  });
});

describe('"Mark day complete" dialog resolves to the SESSION whose trigger was clicked (B3)', () => {
  it('activating the SECOND of three triggers opens the dialog for the SECOND session, not the first or third', async () => {
    renderMarkDayCompleteDetail();
    await flushMicrotasks();

    const triggers = findMarkDayCompleteTriggers();
    expect(triggers).toHaveLength(3);
    act(() => {
      triggers[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const dialogEl = findMarkDayCompleteDialogElement();
    expect(dialogEl).toBeTruthy();
    expect(dialogEl?.textContent).toContain(formatSessionDateOnly(MDC_SESSION_2));
    expect(dialogEl?.textContent).not.toContain(formatSessionDateOnly(MDC_SESSION_1));
    expect(dialogEl?.textContent).not.toContain(formatSessionDateOnly(MDC_SESSION_3));
  });
});

describe('"Mark day complete" dialog receives THIS page’s real roster, not a fixture or another roster (B4)', () => {
  it('the attendee checklist shows this event’s own real roster names', async () => {
    renderMarkDayCompleteDetail();
    await flushMicrotasks();

    act(() => {
      findMarkDayCompleteTriggers()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const dialogEl = findMarkDayCompleteDialogElement();
    expect(dialogEl?.textContent).toContain('Priya Shah');
    expect(dialogEl?.textContent).toContain('Devon Osei');
  });
});

// T179 follow-up round (checker MINOR #3): the shared `makeMarkDayCompleteLoadData`
// fixture (used by B1/B2/B3/B4/B5/B6 above) passes `rsvps: []`, so nothing at
// page level ever exercised the going-RSVP-pre-check path -- `rsvps={[]}` at
// the `<MarkDayCompleteDialog>` call site left the whole suite green. This
// block gives the fixture a real, non-empty `rsvps` array with a `going` row
// and asserts the corresponding student is pre-checked when the dialog opens,
// proving the page's real `rsvps` prop (not an empty array) reaches the
// dialog.
describe('"Mark day complete" dialog receives THIS page’s real rsvps -- going RSVP pre-checks the roster row', () => {
  it('pre-checks the student with a real going RSVP for the clicked session; the other student starts unchecked', async () => {
    const goingRsvps: RsvpRow[] = [
      {
        id: 'rsvp-priya-going',
        sessionId: MDC_SESSION_1.id,
        studentId: 'student-priya-shah',
        status: 'going',
        respondedBy: 'profile-priya-shah',
        updatedAt: '2026-08-01T00:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ];
    renderMarkDayCompleteDetail({
      loadData: makeMarkDayCompleteLoadData({ rsvps: goingRsvps }),
    });
    await flushMicrotasks();

    act(() => {
      findMarkDayCompleteTriggers()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    // Scoped to the dialog itself (Trap 10) -- the same page also mounts a
    // staff-only <AttendancePanel> using this SAME roster, which renders its
    // own, unrelated "Priya Shah"-labeled checkbox earlier in the DOM. A
    // page-wide label lookup would silently resolve to that one instead.
    const dialogEl = findMarkDayCompleteDialogElement();
    expect(dialogEl).toBeTruthy();
    const dialogLabels = Array.from(dialogEl?.querySelectorAll('label') ?? []);
    function getDialogFieldControl(labelText: string): HTMLInputElement {
      const label = dialogLabels.find((el) => el.textContent?.trim() === labelText);
      if (!label) throw new Error(`No dialog label found for "${labelText}"`);
      const forId = label.getAttribute('for');
      if (!forId) throw new Error(`Label "${labelText}" has no htmlFor`);
      const control = document.getElementById(forId);
      if (!control) throw new Error(`No control found for id "${forId}"`);
      return control as HTMLInputElement;
    }

    const priyaCheckbox = getDialogFieldControl('Priya Shah');
    const devonCheckbox = getDialogFieldControl('Devon Osei');
    expect(priyaCheckbox.checked).toBe(true);
    expect(devonCheckbox.checked).toBe(false);
  });
});

// T305 (I1) -- the only proof, through the REAL `OutreachDetail` mount, that
// `MarkDayCompleteDialog`'s new `loadAttendance` seam is actually reached in
// production wiring (this page passes no override prop for it, by design --
// `MarkDayCompleteDialog.tsx` module doc #9). `mockedLoadAttendanceForSessions`
// is this file's own existing partial-mock (`:110-118`) for the identical
// module `AttendancePanel` already uses -- no new mock is introduced.
describe('"Mark day complete" dialog seeds from RECORDED attendance through the real page wiring (T305, I1)', () => {
  it('shows the recorded-attending student checked, and loadAttendance is called with exactly [session.id]', async () => {
    // T305 (I1): this page ALSO mounts a staff-only `<AttendancePanel>`
    // (T117) that calls this SAME mocked loader with every session id on
    // this event, unconditionally, on initial render -- well before the
    // "Mark day complete" trigger is ever clicked. `mockImplementation`
    // (not `mockResolvedValueOnce`) discriminates by the argument actually
    // passed, so the panel's own multi-session call still gets `[]`
    // (harmless, matches this file's existing baseline everywhere else) and
    // ONLY `MarkDayCompleteDialog`'s own single-session
    // `[MDC_SESSION_1.id]` call gets the recorded row.
    mockedLoadAttendanceForSessions.mockImplementation(async (sessionIds) => {
      if (sessionIds.length === 1 && sessionIds[0] === MDC_SESSION_1.id) {
        return [
          {
            id: 'attendance-priya-mdc-1',
            sessionId: MDC_SESSION_1.id,
            studentId: 'student-priya-shah',
            status: 'present',
            checkInAt: null,
            checkOutAt: null,
            hoursOverride: null,
            method: 'coach',
            recordedBy: 'profile-some-other-coach',
            updatedAt: '2026-08-01T00:00:00.000Z',
            createdAt: '2026-08-01T00:00:00.000Z',
          },
        ];
      }
      return [];
    });
    // No RSVPs at all -- proves the seed comes from RECORDED attendance, not
    // an RSVP fallback (module doc #9's own S1 scenario, through real
    // wiring).
    renderMarkDayCompleteDetail({ loadData: makeMarkDayCompleteLoadData({ rsvps: [] }) });
    await flushMicrotasks();

    act(() => {
      findMarkDayCompleteTriggers()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(mockedLoadAttendanceForSessions).toHaveBeenCalledWith([MDC_SESSION_1.id]);

    const dialogEl = findMarkDayCompleteDialogElement();
    expect(dialogEl).toBeTruthy();
    const dialogLabels = Array.from(dialogEl?.querySelectorAll('label') ?? []);
    function getDialogFieldControl(labelText: string): HTMLInputElement {
      const label = dialogLabels.find((el) => el.textContent?.trim() === labelText);
      if (!label) throw new Error(`No dialog label found for "${labelText}"`);
      const forId = label.getAttribute('for');
      if (!forId) throw new Error(`Label "${labelText}" has no htmlFor`);
      const control = document.getElementById(forId);
      if (!control) throw new Error(`No control found for id "${forId}"`);
      return control as HTMLInputElement;
    }

    const priyaCheckbox = getDialogFieldControl('Priya Shah');
    expect(priyaCheckbox.checked).toBe(true);
  });
});

describe('"Mark day complete" threads the real signed-in coach’s profiles.id, not a placeholder (B5)', () => {
  // T179 follow-up round (checker MINOR #2 -- the most important of the
  // four): driven from `triggers[1]`, NOT `triggers[0]`. `triggers[0]`
  // resolves to `orderedSessions[0]`, so it cannot distinguish "the write
  // targets the session whose trigger was clicked" from "the write always
  // targets the first session" -- a mutation that swaps in
  // `orderedSessions[0].id` for the resolved session's `id` is a no-op
  // against `triggers[0]` (`orderedSessions[0].id` IS already correct
  // there) and left the whole suite green. Using the SECOND trigger means
  // the payload's `sessionId` can only equal `MDC_SESSION_2.id` if the
  // clicked trigger actually determined which session's data was written --
  // the UI showing one session while the write targets another is a
  // data-integrity gap on this write path.
  it('confirming the SECOND trigger calls the real markDayComplete mutation with the SECOND session’s id and recordedBy = the signed-in coach’s own id', async () => {
    mockedMarkDayComplete.mockResolvedValueOnce(undefined);
    renderMarkDayCompleteDetail();
    await flushMicrotasks();

    const triggers = findMarkDayCompleteTriggers();
    expect(triggers).toHaveLength(3);
    act(() => {
      triggers[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const confirmButton = findMarkDayCompleteConfirmButton();
    expect(confirmButton).toBeTruthy();
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(mockedMarkDayComplete).toHaveBeenCalledTimes(1);
    expect(mockedMarkDayComplete.mock.calls[0][0].recordedBy).toBe(COACH_USER.id);
    expect(mockedMarkDayComplete.mock.calls[0][0].sessionId).toBe(MDC_SESSION_2.id);
  });
});

describe('"Mark day complete" write/reload composition -- Trap 6, two tests, one per half (B6)', () => {
  it('(a) a REJECTING write surfaces the dialog’s own error banner', async () => {
    mockedMarkDayComplete.mockRejectedValueOnce(new Error('RLS denied this write'));
    renderMarkDayCompleteDetail();
    await flushMicrotasks();

    act(() => {
      findMarkDayCompleteTriggers()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const confirmButton = findMarkDayCompleteConfirmButton();
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(findMarkDayCompleteDialogElement()?.textContent ?? '').toContain(
      "Couldn't mark this day complete",
    );
  });

  it('(b) a REJECTING reload after a SUCCESSFUL write does NOT surface as a write failure', async () => {
    mockedMarkDayComplete.mockResolvedValueOnce(undefined);
    let loadCount = 0;
    const rejectingReloadLoadData: LoadOutreachDetailFn = async (eventId) => {
      loadCount += 1;
      if (loadCount === 1) return makeMarkDayCompleteLoadData()(eventId);
      throw new Error('refetch exploded');
    };

    renderMarkDayCompleteDetail({ loadData: rejectingReloadLoadData });
    await flushMicrotasks();
    expect(loadCount).toBe(1);

    act(() => {
      findMarkDayCompleteTriggers()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const confirmButton = findMarkDayCompleteConfirmButton();
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    await flushMicrotasks();

    // The write succeeded and the dialog closed itself on success -- no
    // write-failure banner anywhere on the page, despite the reload that
    // followed genuinely rejecting.
    expect(container.textContent).not.toContain("Couldn't mark this day complete");
    // The reload was genuinely attempted (and genuinely rejected) -- this
    // is not a vacuous "the reload never ran" pass.
    expect(loadCount).toBe(2);
  });
});

// T179 follow-up round (checker MINOR #4): the page's own `onOpenChange`
// handler (`(isOpen) => { if (!isOpen) setMarkDayCompleteSessionId(null); }`)
// is what actually lets the coach dismiss the dialog -- the module doc's own
// #15(b) claims the dialog can be closed this way. A no-op `onOpenChange`
// (`() => {}`) left the whole suite green because nothing asserted the
// dialog ever goes away. This test drives the dialog's real Cancel button
// (which calls `onOpenChange(false)` internally -- `MarkDayCompleteDialog.tsx`'s
// own `handleClose`) and asserts the whole `<MarkDayCompleteDialog>` element
// unmounts, per Trap 5's "whole element gated, not just isOpen" design.
describe('"Mark day complete" dialog Cancel really closes/unmounts it (module doc #15(b))', () => {
  it('clicking Cancel unmounts the dialog -- it is not stuck open forever', async () => {
    renderMarkDayCompleteDetail();
    await flushMicrotasks();

    act(() => {
      findMarkDayCompleteTriggers()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(findMarkDayCompleteDialogElement()).toBeTruthy();

    const cancelButton = Array.from(
      findMarkDayCompleteDialogElement()?.querySelectorAll('button') ?? [],
    ).find((btn) => btn.textContent?.trim() === 'Cancel');
    expect(cancelButton).toBeTruthy();
    act(() => {
      cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(findMarkDayCompleteDialogElement()).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T174 -- the shipped fixture must teach the RIGHT id-space.
// ---------------------------------------------------------------------------

describe('T174: FIXTURE_RSVPS.respondedBy holds profiles.id values, not students.id values', () => {
  // `rsvps.responded_by` is `uuid references public.profiles (id)`
  // (`20260717000000_scheduling_attendance.sql:72`). Every one of the seven
  // fixture rows previously carried a `student-*` value there.
  //
  // There was NO production impact -- `FIXTURE_RSVPS` is reached only through
  // `defaultLoadOutreachDetail`, never the real `loadData` -- and, verified
  // before this fix, NO existing test asserted anything about those values.
  // So the defect was invisible to the whole suite: the honest consequence is
  // that this fix needed a NEW test to have any evidence at all, which is why
  // this block exists rather than a mutation of an existing one.
  //
  // Why it mattered anyway: the fixture is what a future task reads to learn
  // the shape of a real `RsvpRow`, so the confusion propagates by imitation.
  // T157's own criterion-5 mutation showed the failure mode -- a wrong
  // profile id makes `resolveRsvpResponderAttribution` fall through to
  // `'unrecognized'` and tell a parent a stranger answered for their child.
  it('every fixture RSVP attributes to its OWN student, never to "unrecognized"', async () => {
    const data = await defaultLoadOutreachDetail('event-food-bank-sort');
    expect(data).not.toBeNull();
    const { rsvps, students } = data!;
    expect(rsvps.length).toBeGreaterThan(0); // paired: prove there is something to check.

    for (const rsvp of rsvps) {
      const student = students.find((candidate) => candidate.id === rsvp.studentId);
      expect(student, `no fixture student for rsvp ${rsvp.id}`).toBeTruthy();
      // Run the REAL attribution resolver, not a string-prefix check: a
      // prefix assertion would pass on any `profile-`-shaped typo, whereas
      // this fails unless the value genuinely matches that student's profile.
      const attribution = resolveRsvpResponderAttribution(
        rsvp.respondedBy,
        student!.id,
        student!.profileId,
        [],
      );
      expect(attribution.kind, `rsvp ${rsvp.id} misattributed`).toBe('self');
    }
  });
});
