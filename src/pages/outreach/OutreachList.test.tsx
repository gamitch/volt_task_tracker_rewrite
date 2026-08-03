// @vitest-environment jsdom
/**
 * T038: tests for `OutreachList.tsx`. T101 (ED-1 Packet P10) extends this
 * file with real-load/real-create-dialog coverage (module doc #11 of the
 * component file). T106 (HOTFIX) extends it again with `useActiveSeason()`
 * wiring coverage (module doc #12 of the component file).
 *
 * Per this task's Allowed Files (`OutreachList.tsx` only) this test file is
 * a deliberate, disclosed addition beyond the literal Allowed Files list --
 * the same class of addition `CheckinResult.test.tsx` (T035) and
 * `MeetingsList.test.tsx` (T030) already made in their own sibling
 * directories, existing only to produce the DOM-text proof this task's own
 * packet requires in "Required Worker Output" (both role variants across
 * all four DES-12 states, NAV-07 filtering, BEH-01 milestone-toast dedupe,
 * BEH-02 confirmed/planned never-summed, the exported unanswered-RSVP
 * count).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `CheckinResult.test.tsx`/`MeetingsList.test.tsx` already
 * established, including `MeetingsList.test.tsx`'s `AuthProvider` +
 * `LoginAs` role-login harness.
 *
 * T106 UPDATE: `OutreachList` now calls `useActiveSeason()` unconditionally
 * (component module doc #12), so every render below must be wrapped in a
 * real `<SeasonProvider>` -- the same fake-`<SeasonProvider>`-wrapping
 * harness update `ReportsShell.test.tsx` already made for its own identical
 * T091 wiring (`src/test-utils/**` is a forbidden/read-only directory for
 * this hotfix too, so this wiring is defined locally here, same posture).
 * `DEFAULT_READY_SEASON`'s `id` intentionally reuses the exact
 * `'season-placeholder-current'` literal `defaultLoadOutreachData`'s own
 * fixture data (`FIXTURE_EVENTS`/`FIXTURE_GOAL_CONFIG`) is keyed to, so every
 * pre-existing assertion below that renders fixture data keeps passing
 * unchanged when no test overrides the resolved season id explicitly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../app/SeasonProvider';
import type { SeasonRow } from '../../lib/supabase/types';
import { makeLoadOutreachData, makeSaveOutreachEvent } from '../../lib/supabase/loaders/outreach';
import { LoginAs } from '../../test-utils/authHarness';
// T170 criterion 10 -- same `importOriginal` partial-mock convention
// `OutreachDetail.test.tsx`/`StudentsTab.test.tsx` already established
// (named in `task-ledger.md`'s T161 row as this codebase's own `loaders/`
// test convention): `SelfCheckoffDialog`'s own default `loadAttendance`
// (`loadSelfCheckoffAttendance`) is intercepted so its real Supabase call
// never fires in this test environment, AND so criterion 10 can assert on
// the exact `studentId` argument it was called with. Every other real
// export of this module (`insertSelfCheckoff`/`removeSelfCheckoff`) stays
// real -- unexercised by any test in this file (no test here submits the
// dialog's own confirm action).
vi.mock('../../lib/supabase/loaders/selfCheckoff', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/selfCheckoff')>();
  return {
    ...actual,
    loadSelfCheckoffAttendance: vi.fn(async () => []),
  };
});
import { loadSelfCheckoffAttendance } from '../../lib/supabase/loaders/selfCheckoff';

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `MeetingsList.test.tsx` (T096)
// already hit and locally polyfilled; this is the first time THIS file
// renders a real `Dialog` (`OutreachEventDialog`, T101), so the same local
// override is needed here too.
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
import {
  OutreachList,
  buildCoachOutreachTableRows,
  buildEventGroups,
  buildInitialOutreachEventFromRow,
  buildUpcomingPast,
  buildWeekdayChips,
  computeEventRowStats,
  computeGroupHours,
  computeStudentHours,
  confirmedPercent,
  crossedMilestones,
  defaultLoadOutreachData,
  deriveExpectedStudentIds,
  distinctAttendedStudentIds,
  filterOutreachEvents,
  formatEventDateRangeLabel,
  formatSessionDateOnly,
  formatSessionDateTime,
  getUnansweredRsvpCount,
  hasMilestoneToastFired,
  markMilestoneToastFired,
  PLACEHOLDER_CURRENT_STUDENT_ID,
  sessionHours,
  sumIndividualGoals,
  withRsvpOverride,
  type OutreachAttendanceRow,
  type OutreachEventRow,
  type OutreachGoalConfig,
  type OutreachLoadResult,
  type OutreachSessionRow,
  type RsvpRow,
} from './OutreachList';

// ---------------------------------------------------------------------------
// Render harness -- mirrors MeetingsList.test.tsx's own harness exactly.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
// T073a: guards.tsx's `Role` union now includes 'student'/'parent'
// (previously it did not -- module doc #6 gap, resolved). 'student' stands
// in for "not coach/admin" here, exactly the branch OutreachList's own
// `isCoachOrAdminView` check falls through on for any non-coach/admin role.
// Previously `role: 'staff'`, invalid under the corrected `Role` type.
const STUDENT_OR_PARENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

// T106 (component module doc #12): `OutreachList` now calls
// `useActiveSeason()` unconditionally, so every render needs a real
// `<SeasonProvider>` ancestor. `id` reuses `defaultLoadOutreachData`'s own
// fixture `seasonId` literal (module doc above) so existing fixture-data
// assertions keep passing unchanged by default.
const DEFAULT_READY_SEASON: SeasonRow = {
  id: 'season-placeholder-current',
  name: 'Fixture Season',
  startsOn: '2025-08-01',
  endsOn: '2026-06-30',
  defaultGoalHours: 100,
  isActive: true,
  createdAt: '2025-08-01T00:00:00.000Z',
};

const DEFAULT_LOAD_ACTIVE_SEASON: LoadActiveSeasonFn = async () => DEFAULT_READY_SEASON;

// T170 criterion 10 -- the mocked reference (module-level `vi.mock` above).
const mockedLoadSelfCheckoffAttendance = vi.mocked(loadSelfCheckoffAttendance);

/**
 * T170 (harness fix, criterion 7 -- ~10 of 82 pre-existing tests, all
 * harness-only): `OutreachList`'s own `viewerStudentId` no longer defaults
 * to `PLACEHOLDER_CURRENT_STUDENT_ID` (component module doc #15) -- with no
 * explicit `viewerStudentId`/`resolveStudentId` override, the real
 * `resolveCurrentStudentId` default would fire a genuine, unmocked Supabase
 * query in every student/parent-view test below, landing the identity tier
 * in its own `'error'` DES-12 state instead of ever reaching this file's
 * existing fixture-driven assertions. Unlike `StudentHome.test.tsx`'s own
 * T176 harness fix (which resolves to a DISTINCT, non-placeholder id,
 * because that page's `loadData` takes `studentId` as an argument), this
 * file's own `defaultLoadOutreachData` fixtures
 * (`FIXTURE_RSVPS`/`FIXTURE_GOAL_CONFIG`, component module doc #2) are
 * themselves keyed to `PLACEHOLDER_CURRENT_STUDENT_ID` -- so the harness
 * default here resolves to THAT same value, deliberately, to keep every
 * pre-existing fixture-driven assertion passing unchanged. This default is
 * spread BEFORE `props` (so an individual test's own
 * `viewerStudentId`/`resolveStudentId` override always wins, same
 * precedence `StudentHome.test.tsx`'s own harness fix established).
 */
function renderAsUser(
  user: AuthUser | null,
  props: Parameters<typeof OutreachList>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = DEFAULT_LOAD_ACTIVE_SEASON,
): void {
  const mergedProps: Parameters<typeof OutreachList>[0] = {
    resolveStudentId: async () => PLACEHOLDER_CURRENT_STUDENT_ID,
    ...props,
  };
  act(() => {
    root.render(
      // T112 (component module doc #13): `OutreachList` now renders a real
      // `<Link as={RouterLink} .../>` per row, which needs a real router
      // context ancestor (`react-router-dom`'s `LinkWithRef` throws
      // "Cannot destructure property 'basename' of ... useContext(...) as it
      // is null" otherwise) -- same `MemoryRouter` wrapping
      // `CalendarPage.test.tsx`'s own harness already established for the
      // identical reason.
      <MemoryRouter initialEntries={['/outreach']}>
        <AuthProvider>
          <SeasonProvider loadActiveSeason={loadActiveSeason}>
            {user === null ? (
              <OutreachList {...mergedProps} />
            ) : (
              <LoginAs user={user}>
                <OutreachList {...mergedProps} />
              </LoginAs>
            )}
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

// T147 -- same helper `MeetingsList.test.tsx`/`OutreachDetail.test.tsx`
// already established (Astryx `Field` renders a real `<label htmlFor={id}>`
// for every labeled input, including `MultiSelector`'s own trigger button;
// no testing-library `getByLabelText` equivalent is installed in this repo).
function getFieldControl(labelText: string): HTMLElement {
  const labels = Array.from(document.querySelectorAll('label'));
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

function freshContainer(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
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
  // T130 (UXC-13): this file now also uses `vi.stubGlobal('matchMedia', ...)`
  // (same idiom `CheckinResult.test.tsx` established for its own real
  // `matchMedia`-subscription hook) -- `vi.restoreAllMocks()` alone does not
  // undo a stubbed global, so this is added alongside it, same pairing
  // `CheckinResult.test.tsx`'s own `afterEach` already uses.
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

// T121 (UXP-04 outreach half): `OutreachEventRow` grew several new
// prefill-support fields (component module doc) -- this factory keeps every
// test literal below focused on the field(s) it actually cares about,
// rather than repeating the same fabricated boilerplate at every call site.
function makeTestEvent(
  overrides: Partial<OutreachEventRow> & Pick<OutreachEventRow, 'id'>,
): OutreachEventRow {
  return {
    seasonId: 's1',
    type: 'outreach',
    title: 'Untitled event',
    description: '',
    locationName: 'X',
    address: '',
    teamIds: null,
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// T330 -- shared full-page-render fixtures (used by both the coach-view and
// student/parent-view DOM tests below, and by the T130 responsive block's
// own narrow-mode assertion). A DATED event carries a real `going` RSVP +
// roster student so its own row shows a real, NON-ZERO planned-hours/
// expected-count value ("Planned2h" / "Expected1 students") -- this is
// deliberate (worker packet §8's own "narrow-test fixture warning"): with
// no RSVPs at all, the DATED comparator row would ALSO legitimately render
// "Planned0h"/"Expected0 students", which would make a `not.toContain(
// 'Planned0h')` proof that the DATELESS row's own em-dash fired
// unsatisfiable (it would also match the unrelated dated row). Giving the
// dated row real numbers keeps "0h"/"0 students" reachable ONLY through a
// regression in the dateless row's own dash logic.
// ---------------------------------------------------------------------------
function orphanOnlySeasonLoadData(): Promise<OutreachLoadResult> {
  return Promise.resolve({
    events: [makeTestEvent({ id: 'orphan-e1', title: 'Orphaned Coat Drive' })],
    sessions: [],
    rsvps: [],
    attendance: [],
    students: [],
    goalConfig: { seasonId: 's1', individualGoalHoursByStudentId: {} },
    teams: [],
  });
}

function orphanPlusDatedLoadData(): Promise<OutreachLoadResult> {
  return Promise.resolve({
    events: [
      makeTestEvent({ id: 'orphan-e1', title: 'Orphaned Coat Drive' }),
      makeTestEvent({ id: 'dated-e1', title: 'Scheduled Food Drive' }),
    ],
    sessions: [
      {
        id: 'dated-s1',
        eventId: 'dated-e1',
        sessionDate: '2026-09-01',
        startsAt: '2026-09-01T14:00:00.000Z',
        endsAt: '2026-09-01T16:00:00.000Z', // 2h
        status: 'scheduled',
        peopleReached: null,
      },
    ],
    rsvps: [
      {
        id: 'rsvp-1',
        sessionId: 'dated-s1',
        studentId: 'student-1',
        status: 'going',
        respondedBy: null,
        updatedAt: '2026-08-01T00:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    attendance: [],
    students: [{ id: 'student-1', name: 'Student One' }],
    goalConfig: { seasonId: 's1', individualGoalHoursByStudentId: {} },
    teams: [],
  });
}

describe('filterOutreachEvents (NAV-07)', () => {
  it('excludes non-outreach event types', () => {
    const events: OutreachEventRow[] = [
      makeTestEvent({ id: 'e1', type: 'outreach', title: 'Food Bank', locationName: 'X' }),
      makeTestEvent({ id: 'e2', type: 'meeting', title: 'Weekly Team Meeting', locationName: 'Y' }),
      makeTestEvent({ id: 'e3', type: 'competition', title: 'Regionals', locationName: 'Z' }),
    ];
    expect(filterOutreachEvents(events).map((e) => e.id)).toEqual(['e1']);
  });

  it('the shipped fixture loader excludes "Weekly Team Meeting" from its outreach-filtered events', async () => {
    const data = await defaultLoadOutreachData('season-placeholder-current');
    const outreach = filterOutreachEvents(data.events);
    expect(outreach.some((e) => e.title === 'Weekly Team Meeting')).toBe(false);
    expect(outreach.length).toBeGreaterThan(0);
  });
});

describe('sessionHours', () => {
  it('computes ends_at - starts_at in hours', () => {
    const session: OutreachSessionRow = {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-07-01',
      startsAt: '2026-07-01T14:00:00.000Z',
      endsAt: '2026-07-01T17:00:00.000Z',
      status: 'completed',
      peopleReached: null,
    };
    expect(sessionHours(session)).toBe(3);
  });
});

describe('computeStudentHours / computeGroupHours (BEH-02: never summed)', () => {
  const sessions: OutreachSessionRow[] = [
    {
      id: 'past-going',
      eventId: 'e1',
      sessionDate: '2026-06-01',
      startsAt: '2026-06-01T14:00:00.000Z',
      endsAt: '2026-06-01T17:00:00.000Z', // 3h
      status: 'completed',
      peopleReached: null,
    },
    {
      id: 'upcoming-going',
      eventId: 'e1',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T14:00:00.000Z',
      endsAt: '2026-08-01T16:00:00.000Z', // 2h
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'upcoming-declined',
      eventId: 'e1',
      sessionDate: '2026-08-05',
      startsAt: '2026-08-05T14:00:00.000Z',
      endsAt: '2026-08-05T15:00:00.000Z', // 1h, but declined -- must not count
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'canceled-going',
      eventId: 'e1',
      sessionDate: '2026-06-10',
      startsAt: '2026-06-10T14:00:00.000Z',
      endsAt: '2026-06-10T16:00:00.000Z', // 2h, but canceled -- must not count
      status: 'canceled',
      peopleReached: null,
    },
  ];
  const rsvps: RsvpRow[] = [
    {
      id: 'r1',
      sessionId: 'past-going',
      studentId: 'stu-1',
      status: 'going',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r2',
      sessionId: 'upcoming-going',
      studentId: 'stu-1',
      status: 'going',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r3',
      sessionId: 'upcoming-declined',
      studentId: 'stu-1',
      status: 'declined',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r4',
      sessionId: 'canceled-going',
      studentId: 'stu-1',
      status: 'going',
      respondedBy: 'stu-1',
      updatedAt: '',
      createdAt: '',
    },
  ];

  it('confirmed = going + completed; planned = going + scheduled; declined/canceled contribute to neither', () => {
    const breakdown = computeStudentHours('stu-1', sessions, rsvps);
    expect(breakdown).toEqual({ confirmedHours: 3, plannedHours: 2 });
  });

  it('a student with no rsvps at all gets zero for both, independently', () => {
    expect(computeStudentHours('stu-nobody', sessions, rsvps)).toEqual({
      confirmedHours: 0,
      plannedHours: 0,
    });
  });

  it('computeGroupHours sums confirmed and planned SEPARATELY across students', () => {
    const rsvpsTwoStudents: RsvpRow[] = [
      ...rsvps,
      {
        id: 'r5',
        sessionId: 'past-going',
        studentId: 'stu-2',
        status: 'going',
        respondedBy: 'stu-2',
        updatedAt: '',
        createdAt: '',
      },
    ];
    const group = computeGroupHours(['stu-1', 'stu-2'], sessions, rsvpsTwoStudents);
    // stu-1: confirmed 3, planned 2. stu-2: confirmed 3, planned 0.
    // Total confirmed 6, total planned 2 -- NEVER 8 (a summed figure).
    expect(group).toEqual({ confirmedHours: 6, plannedHours: 2 });
  });
});

describe('sumIndividualGoals', () => {
  it('sums only the requested student ids', () => {
    const goalConfig: OutreachGoalConfig = {
      seasonId: 's1',
      individualGoalHoursByStudentId: { a: 10, b: 8, c: 12 },
    };
    expect(sumIndividualGoals(['a', 'b'], goalConfig)).toBe(18);
    expect(sumIndividualGoals(['a', 'b', 'c'], goalConfig)).toBe(30);
  });

  it('treats a missing goal as 0, not an error', () => {
    const goalConfig: OutreachGoalConfig = {
      seasonId: 's1',
      individualGoalHoursByStudentId: { a: 10 },
    };
    expect(sumIndividualGoals(['a', 'nobody'], goalConfig)).toBe(10);
  });
});

describe('buildUpcomingPast', () => {
  it('splits scheduled into upcoming and completed/canceled into past, sorted, joined through events', () => {
    const events: OutreachEventRow[] = [
      makeTestEvent({ id: 'e1', title: 'E1', locationName: 'L' }),
    ];
    const sessions: OutreachSessionRow[] = [
      {
        id: 'a',
        eventId: 'e1',
        sessionDate: '2026-07-01',
        startsAt: '2026-07-01T00:00:00.000Z',
        endsAt: '2026-07-01T01:00:00.000Z',
        status: 'completed',
        peopleReached: null,
      },
      {
        id: 'b',
        eventId: 'e1',
        sessionDate: '2026-07-10',
        startsAt: '2026-07-10T00:00:00.000Z',
        endsAt: '2026-07-10T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
      {
        id: 'c',
        eventId: 'e1',
        sessionDate: '2026-07-05',
        startsAt: '2026-07-05T00:00:00.000Z',
        endsAt: '2026-07-05T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
      {
        id: 'd',
        eventId: 'e1',
        sessionDate: '2026-07-02',
        startsAt: '2026-07-02T00:00:00.000Z',
        endsAt: '2026-07-02T01:00:00.000Z',
        status: 'canceled',
        peopleReached: null,
      },
      // No matching event -- must be dropped entirely, not crash.
      {
        id: 'orphan',
        eventId: 'no-such-event',
        sessionDate: '2026-07-03',
        startsAt: '2026-07-03T00:00:00.000Z',
        endsAt: '2026-07-03T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
    ];
    const { upcoming, past } = buildUpcomingPast(sessions, events);
    expect(upcoming.map((entry) => entry.session.id)).toEqual(['c', 'b']); // ascending
    expect(past.map((entry) => entry.session.id)).toEqual(['d', 'a']); // descending
  });
});

// ---------------------------------------------------------------------------
// T121 (UXP-04 outreach half / UXD-02/03): per-EVENT row grouping/stats.
// ---------------------------------------------------------------------------

describe('buildEventGroups (UXD-02/03 per-event rows)', () => {
  const events: OutreachEventRow[] = [
    makeTestEvent({ id: 'e1', title: 'Multi-day event' }),
    makeTestEvent({ id: 'e2', title: 'Fully past event' }),
    makeTestEvent({ id: 'e3', title: 'No sessions yet' }),
  ];
  const sessions: OutreachSessionRow[] = [
    // e1: one completed (past), one still scheduled -- the WHOLE event is
    // "upcoming" (any scheduled session makes it so), even though it also
    // has a completed session.
    {
      id: 'e1-past',
      eventId: 'e1',
      sessionDate: '2026-06-01',
      startsAt: '2026-06-01T00:00:00.000Z',
      endsAt: '2026-06-01T01:00:00.000Z',
      status: 'completed',
      peopleReached: null,
    },
    {
      id: 'e1-future',
      eventId: 'e1',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-01T01:00:00.000Z',
      status: 'scheduled',
      peopleReached: null,
    },
    // e2: only completed/canceled sessions -- "past".
    {
      id: 'e2-completed',
      eventId: 'e2',
      sessionDate: '2026-05-01',
      startsAt: '2026-05-01T00:00:00.000Z',
      endsAt: '2026-05-01T01:00:00.000Z',
      status: 'completed',
      peopleReached: null,
    },
    // e3 has no sessions in this array at all.
  ];

  // T330 AUTHORIZED AMENDMENT (worker packet §6, test 1 of 2) -- the
  // routing change (module doc on `buildEventGroups`) pins `e3` (zero real
  // sessions) into `upcoming`, ahead of every dated entry, per the owner's
  // ruling. `e3` now shares this bucket with `e1`, so this test's own
  // `upcoming` assertion grows from `['e1']` to `['e3', 'e1']` and the
  // per-session assertion for `e1` moves from `upcoming[0]` to
  // `upcoming[1]`. `past` is UNCHANGED (`['e2']`) -- this is the guard
  // against §4's crash, kept exactly as it was.
  it('groups by EVENT (one entry per event, not per session) -- "upcoming" = any scheduled session, pinned dateless entries first', () => {
    const { upcoming, past } = buildEventGroups(events, sessions);
    expect(upcoming.map((entry) => entry.event.id)).toEqual(['e3', 'e1']);
    expect(upcoming[1].sessions.map((session) => session.id)).toEqual(['e1-past', 'e1-future']); // ascending
    expect(past.map((entry) => entry.event.id)).toEqual(['e2']);
  });

  // T330 AUTHORIZED AMENDMENT (worker packet §6, test 2 of 2) -- RENAMED
  // (a test named "omits" that now asserts inclusion would be worse than no
  // test at all, per the packet). `e3` (zero real sessions) is no longer
  // omitted: it is a real, pinned-first `upcoming` row (C1/C11's whole
  // point -- a failed first create must stay visible and reachable). The
  // `past` half is KEPT, unchanged in meaning: `e3` must still never reach
  // `past`, which is §4's crash guard ((c)'s own module doc -- `past`'s
  // comparator is safe only because a zero-session entry can never land
  // here after (a)).
  it('routes a zero-real-session event into upcoming, pinned first -- and still never into past', () => {
    const { upcoming, past } = buildEventGroups(events, sessions);
    expect(upcoming.some((entry) => entry.event.id === 'e3')).toBe(true);
    expect(upcoming[0].event.id).toBe('e3');
    expect(upcoming[0].sessions).toEqual([]);
    expect(past.some((entry) => entry.event.id === 'e3')).toBe(false);
  });

  // T330 (C2) -- NEW, a DELIBERATE single-orphan fixture (packet §8's own
  // C2 warning): with NO other event in `past`, a mutation that routes a
  // zero-session event to `past` instead of `upcoming` produces a
  // ONE-element `past` array, which never invokes `past`'s own comparator
  // (a one-element array never calls `.sort`'s comparator) -- so this
  // mutation would NOT throw here. This test exists so THAT case reddens by
  // its own `past.some`/`upcoming.some` assertions firing, not merely by
  // riding along on the crash the multi-entry fixture above (the shared
  // `e1`/`e2`/`e3` fixture) already produces.
  it('a single dateless event, with no other past-bucket entry to crash the comparator, still resolves to upcoming and never past', () => {
    const soloEvents: OutreachEventRow[] = [makeTestEvent({ id: 'solo', title: 'Solo dateless' })];
    const { upcoming, past } = buildEventGroups(soloEvents, []);
    expect(upcoming.some((entry) => entry.event.id === 'solo')).toBe(true);
    expect(past.some((entry) => entry.event.id === 'solo')).toBe(false);
  });

  // T330 (g)/(C4) -- NEW. Two dateless entries alongside a dated one must
  // sort without throwing: both pin ahead of the dated entry and tie with
  // each other (stable sort preserves their relative input order), then the
  // dated entry sorts last by its own next-scheduled `startsAt`, exactly as
  // before. Named mutation (packet §8 C4): removing the `aDateless ||
  // bDateless` guard must throw a real `TypeError` here, because this
  // fixture has 2 entries in `upcoming` (a 1-element bucket never invokes
  // the comparator at all).
  it('two dateless events plus one dated event sort without throwing -- both dateless pinned first, tied, dated last', () => {
    const twoDatelessEvents: OutreachEventRow[] = [
      makeTestEvent({ id: 'e4', title: 'Dateless A' }),
      makeTestEvent({ id: 'e5', title: 'Dateless B' }),
      makeTestEvent({ id: 'e6', title: 'Dated' }),
    ];
    const oneDatedSession: OutreachSessionRow[] = [
      {
        id: 'e6-s1',
        eventId: 'e6',
        sessionDate: '2026-09-01',
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-01T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
    ];
    expect(() => buildEventGroups(twoDatelessEvents, oneDatedSession)).not.toThrow();
    const { upcoming, past } = buildEventGroups(twoDatelessEvents, oneDatedSession);
    expect(upcoming.map((entry) => entry.event.id)).toEqual(['e4', 'e5', 'e6']);
    expect(past).toEqual([]);
  });

  // T330 (C5) -- NEW. `past` needs >=2 entries to actually invoke its own
  // comparator (a 1-element bucket never does -- the baseline suite only
  // ever had one). Named mutation (packet §8 C5): reversing the
  // `bLast`/`aLast` operands must flip this descending (most-recent-first)
  // order.
  it('past with >=2 entries still sorts most-recent-last-session-first (descending)', () => {
    const pastEvents: OutreachEventRow[] = [
      makeTestEvent({ id: 'e7', title: 'Older past event' }),
      makeTestEvent({ id: 'e8', title: 'Newer past event' }),
    ];
    const pastSessions: OutreachSessionRow[] = [
      {
        id: 'e7-s1',
        eventId: 'e7',
        sessionDate: '2026-01-01',
        startsAt: '2026-01-01T00:00:00.000Z',
        endsAt: '2026-01-01T01:00:00.000Z',
        status: 'completed',
        peopleReached: null,
      },
      {
        id: 'e8-s1',
        eventId: 'e8',
        sessionDate: '2026-03-01',
        startsAt: '2026-03-01T00:00:00.000Z',
        endsAt: '2026-03-01T01:00:00.000Z',
        status: 'completed',
        peopleReached: null,
      },
    ];
    const { upcoming, past } = buildEventGroups(pastEvents, pastSessions);
    expect(upcoming).toEqual([]);
    expect(past.map((entry) => entry.event.id)).toEqual(['e8', 'e7']); // e8 (Mar) before e7 (Jan)
  });
});

describe('buildWeekdayChips / formatEventDateRangeLabel (UXD-02 recurrence chips)', () => {
  it('one chip per distinct weekday, ordered by first chronological occurrence, counted correctly', () => {
    const sessions: OutreachSessionRow[] = [
      // Mondays x2, then a Thursday -- ascending order (pre-sorted, per
      // this function's own contract).
      {
        id: 's1',
        eventId: 'e1',
        sessionDate: '2026-08-03', // Monday
        startsAt: '2026-08-03T00:00:00.000Z',
        endsAt: '2026-08-03T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
      {
        id: 's2',
        eventId: 'e1',
        sessionDate: '2026-08-06', // Thursday
        startsAt: '2026-08-06T00:00:00.000Z',
        endsAt: '2026-08-06T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
      {
        id: 's3',
        eventId: 'e1',
        sessionDate: '2026-08-10', // Monday
        startsAt: '2026-08-10T00:00:00.000Z',
        endsAt: '2026-08-10T01:00:00.000Z',
        status: 'scheduled',
        peopleReached: null,
      },
    ];
    expect(buildWeekdayChips(sessions)).toEqual([
      { key: 'MON', label: 'MON (2)', count: 2 },
      { key: 'THU', label: 'THU (1)', count: 1 },
    ]);
    expect(formatEventDateRangeLabel(sessions)).toBe('Aug 3 → Aug 10');
  });

  it('a single-session event renders one date, no arrow', () => {
    const session: OutreachSessionRow = {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-08-03',
      startsAt: '2026-08-03T00:00:00.000Z',
      endsAt: '2026-08-03T01:00:00.000Z',
      status: 'scheduled',
      peopleReached: null,
    };
    expect(formatEventDateRangeLabel([session])).toBe('Aug 3');
  });

  // T330 (C9) -- NEW. No baseline test pins the zero-session branch (module
  // doc on `formatEventDateRangeLabel`: `'No sessions scheduled yet.'` for
  // `[]`) -- (a)'s routing change is what makes this branch actually reach
  // the list for the first time; the string itself was already there.
  // Named mutation (packet §8 C9): making this function return `''` for
  // `[]` must redden this directly.
  it('an empty session array renders the honest "no sessions" copy, not a blank/undefined date', () => {
    expect(formatEventDateRangeLabel([])).toBe('No sessions scheduled yet.');
  });
});

describe('computeEventRowStats (UXD-02 planned/logged hours + expected/attended + reached)', () => {
  const sessions: OutreachSessionRow[] = [
    {
      id: 'scheduled-1',
      eventId: 'e1',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T14:00:00.000Z',
      endsAt: '2026-08-01T16:00:00.000Z', // 2h
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'completed-1',
      eventId: 'e1',
      sessionDate: '2026-06-01',
      startsAt: '2026-06-01T14:00:00.000Z',
      endsAt: '2026-06-01T17:00:00.000Z', // 3h
      status: 'completed',
      peopleReached: 40,
    },
  ];
  const rsvps: RsvpRow[] = [
    {
      id: 'r1',
      sessionId: 'scheduled-1',
      studentId: 'stu-a',
      status: 'going',
      respondedBy: 'stu-a',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r2',
      sessionId: 'completed-1',
      studentId: 'stu-b',
      status: 'going',
      respondedBy: 'stu-b',
      updatedAt: '',
      createdAt: '',
    },
  ];
  // CHECKER FIX (rework of T121, MAJOR): real attendance, matching the RSVP
  // going-set 1-for-1 in THIS particular fixture (stu-b) -- the dedicated
  // divergent-fixture test below is what actually pins "attended != going"
  // as a hard regression guard; this one just proves the plumbing (real
  // `attendance` param, not `rsvps`) feeds `attendedCount`.
  const attendance: OutreachAttendanceRow[] = [
    { sessionId: 'completed-1', studentId: 'stu-b', status: 'present' },
  ];

  it('expected = distinct GOING RSVPs on scheduled sessions (intent -- no attendance can exist yet); attended = distinct PRESENT/LATE real attendance on completed sessions (never RSVP intent); reached sums completed sessions only', () => {
    const stats = computeEventRowStats(sessions, rsvps, attendance, ['stu-a', 'stu-b', 'stu-c']);
    expect(stats.expectedCount).toBe(1); // stu-a only (RSVP going)
    expect(stats.attendedCount).toBe(1); // stu-b only (real present attendance)
    expect(stats.reached).toBe(40);
    // BEH-02: computeGroupHours reused verbatim -- planned (stu-a, 2h) and
    // confirmed (stu-b, 3h) stay separate, never summed.
    expect(stats.hours).toEqual({ confirmedHours: 3, plannedHours: 2 });
  });

  it('reached is null (not a fabricated 0) when no completed session has ever recorded a value', () => {
    const noReachedSessions: OutreachSessionRow[] = [{ ...sessions[1], peopleReached: null }];
    expect(
      computeEventRowStats(noReachedSessions, rsvps, attendance, ['stu-a']).reached,
    ).toBeNull();
  });

  it('CHECKER FIX (rework of T121, MAJOR): "attended" is REAL attendance, never RSVP intent -- 5 going, only 3 real present/late (one of them a walk-in who never RSVP\'d at all; one RSVP-going student explicitly marked absent; two RSVP-going students have no attendance row at all)', () => {
    const completedSessionId = 'completed-only';
    const divergentSessions: OutreachSessionRow[] = [
      {
        id: completedSessionId,
        eventId: 'e1',
        sessionDate: '2026-06-01',
        startsAt: '2026-06-01T14:00:00.000Z',
        endsAt: '2026-06-01T17:00:00.000Z',
        status: 'completed',
        peopleReached: null,
      },
    ];
    // 5 students RSVP'd `going` for this session.
    const divergentRsvps: RsvpRow[] = ['stu-1', 'stu-2', 'stu-3', 'stu-4', 'stu-5'].map((id) => ({
      id: `rsvp-${id}`,
      sessionId: completedSessionId,
      studentId: id,
      status: 'going',
      respondedBy: id,
      updatedAt: '',
      createdAt: '',
    }));
    // Real attendance: stu-1 present, stu-2 late (both RSVP'd going), PLUS
    // stu-walkin present -- never RSVP'd at all. stu-3 is explicitly marked
    // `absent` despite RSVPing going (never counted). stu-4/stu-5 (also
    // RSVP'd going) have no `attendance` row whatsoever (never counted --
    // a `going` RSVP alone is not attendance).
    const divergentAttendance: OutreachAttendanceRow[] = [
      { sessionId: completedSessionId, studentId: 'stu-1', status: 'present' },
      { sessionId: completedSessionId, studentId: 'stu-2', status: 'late' },
      { sessionId: completedSessionId, studentId: 'stu-3', status: 'absent' },
      { sessionId: completedSessionId, studentId: 'stu-walkin', status: 'present' },
    ];
    const stats = computeEventRowStats(divergentSessions, divergentRsvps, divergentAttendance, [
      'stu-1',
      'stu-2',
      'stu-3',
      'stu-4',
      'stu-5',
      'stu-walkin',
    ]);
    // A regression back to RSVP-`going` counting would read 5 here.
    expect(stats.attendedCount).toBe(3); // stu-1, stu-2, stu-walkin -- NOT 5
  });
});

describe('distinctAttendedStudentIds (CHECKER FIX, rework of T121, MAJOR -- real attendance predicate)', () => {
  it('counts only status in (present, late) -- the same predicate v_student_hours uses (metric_views.sql line 18), never going/excused/absent', () => {
    const attendance: OutreachAttendanceRow[] = [
      { sessionId: 's1', studentId: 'stu-present', status: 'present' },
      { sessionId: 's1', studentId: 'stu-late', status: 'late' },
      { sessionId: 's1', studentId: 'stu-excused', status: 'excused' },
      { sessionId: 's1', studentId: 'stu-absent', status: 'absent' },
      { sessionId: 's2', studentId: 'stu-other-session', status: 'present' }, // wrong session -- excluded
    ];
    const result = distinctAttendedStudentIds(['s1'], attendance);
    expect([...result].sort()).toEqual(['stu-late', 'stu-present']);
  });

  it('never counts RSVP-only data -- an empty attendance array yields zero attended, even with real going RSVPs elsewhere', () => {
    expect(distinctAttendedStudentIds(['s1'], [])).toEqual(new Set());
  });
});

describe('deriveExpectedStudentIds / buildInitialOutreachEventFromRow (T121 item (b) edit-mode prefill)', () => {
  const sessions: OutreachSessionRow[] = [
    {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T14:00:00.000Z', // 9:00 AM Chicago
      endsAt: '2026-08-01T16:00:00.000Z', // 11:00 AM Chicago
      status: 'scheduled',
      peopleReached: null,
    },
  ];
  const rsvps: RsvpRow[] = [
    {
      id: 'r1',
      sessionId: 's1',
      studentId: 'stu-going',
      status: 'going',
      respondedBy: 'stu-going',
      updatedAt: '',
      createdAt: '',
    },
    {
      id: 'r2',
      sessionId: 's1',
      studentId: 'stu-maybe',
      status: 'maybe',
      respondedBy: 'stu-maybe',
      updatedAt: '',
      createdAt: '',
    },
  ];

  it('deriveExpectedStudentIds returns only going student ids, never maybe/declined', () => {
    expect(deriveExpectedStudentIds(sessions, rsvps)).toEqual(['stu-going']);
  });

  it('buildInitialOutreachEventFromRow reshapes a real OutreachEventRow + its own sessions/rsvps into ExistingOutreachEvent, including expectedStudentIds', () => {
    const event = makeTestEvent({
      id: 'e1',
      title: 'Food Bank Sort',
      description: 'desc',
      locationName: 'Loc',
      address: 'Addr',
      teamIds: ['team-ravens'],
      countsParticipation: false,
      countsVolunteerHours: true,
      adultVolunteersCount: 4,
      adultVolunteerHours: 12,
    });
    const initial = buildInitialOutreachEventFromRow(event, sessions, rsvps);
    expect(initial).toMatchObject({
      id: 'e1',
      title: 'Food Bank Sort',
      type: 'outreach',
      countsParticipation: false,
      countsVolunteerHours: true,
      teamIds: ['team-ravens'],
      adultVolunteersCount: 4,
      adultVolunteerHours: 12,
      shareToCalendarFeed: true,
      sessions: [
        { sessionDate: '2026-08-01', startTime: '09:00', endTime: '11:00', peopleReached: null },
      ],
      expectedStudentIds: ['stu-going'],
    });
  });
});

describe('confirmedPercent / crossedMilestones (BEH-01)', () => {
  it('computes percent from confirmed hours only, capped at 100', () => {
    expect(confirmedPercent(3, 12)).toBe(25);
    expect(confirmedPercent(20, 10)).toBe(100);
    expect(confirmedPercent(5, 0)).toBe(0);
  });

  it('returns every milestone at or below the current percent', () => {
    expect(crossedMilestones(0)).toEqual([]);
    expect(crossedMilestones(25)).toEqual([25]);
    expect(crossedMilestones(60)).toEqual([25, 50]);
    expect(crossedMilestones(100)).toEqual([25, 50, 75, 100]);
  });
});

describe('getUnansweredRsvpCount (BEH-04 / Known Context/Traps #3)', () => {
  const sessions: OutreachSessionRow[] = [
    {
      id: 'upcoming-1',
      eventId: 'e1',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T00:00:00.000Z',
      endsAt: '2026-08-01T01:00:00.000Z',
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'past-1',
      eventId: 'e1',
      sessionDate: '2026-06-01',
      startsAt: '2026-06-01T00:00:00.000Z',
      endsAt: '2026-06-01T01:00:00.000Z',
      status: 'completed',
      peopleReached: null,
    },
  ];
  const rsvps: RsvpRow[] = [
    {
      id: 'r1',
      sessionId: 'upcoming-1',
      studentId: 'stu-answered',
      status: 'declined',
      respondedBy: 'stu-answered',
      updatedAt: '',
      createdAt: '',
    },
  ];

  it('counts an upcoming session with no rsvp row at all', () => {
    expect(getUnansweredRsvpCount(sessions, rsvps, ['stu-unanswered'])).toBe(1);
  });

  it('never counts a declined/maybe RSVP as unanswered -- those ARE answers', () => {
    expect(getUnansweredRsvpCount(sessions, rsvps, ['stu-answered'])).toBe(0);
  });

  it('never counts a past (non-scheduled) session, answered or not', () => {
    expect(getUnansweredRsvpCount(sessions, [], ['stu-x'])).toBe(1); // only upcoming-1 counts, not past-1
  });

  it('is generic over multiple student ids (flattened count)', () => {
    expect(getUnansweredRsvpCount(sessions, rsvps, ['stu-answered', 'stu-unanswered'])).toBe(1);
  });

  it('the shipped fixture data produces the documented counts for both roles', async () => {
    const data: OutreachLoadResult = await defaultLoadOutreachData('season-placeholder-current');
    const outreachEvents = filterOutreachEvents(data.events);
    const outreachEventIds = new Set(outreachEvents.map((e) => e.id));
    const outreachSessions = data.sessions.filter((s) => outreachEventIds.has(s.eventId));
    const allStudentIds = data.students.map((s) => s.id);

    // Coach (whole roster): 2 unanswered on session-food-bank-upcoming
    // (Priya, viewer) + 2 unanswered on session-park-cleanup-upcoming
    // (Amara, Cole) = 4.
    expect(getUnansweredRsvpCount(outreachSessions, data.rsvps, allStudentIds)).toBe(4);

    // Viewer alone: unanswered only on session-food-bank-upcoming (they
    // already answered "maybe" on the park cleanup session) = 1.
    expect(
      getUnansweredRsvpCount(outreachSessions, data.rsvps, [PLACEHOLDER_CURRENT_STUDENT_ID]),
    ).toBe(1);
  });
});

describe('withRsvpOverride', () => {
  it('synthesizes a new row when none existed (the "unanswered" case being answered)', () => {
    const result = withRsvpOverride([], 'stu-1', 'sess-1', 'going');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ studentId: 'stu-1', sessionId: 'sess-1', status: 'going' });
  });

  it('updates an existing row in place, leaving other rows untouched', () => {
    const existing: RsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'sess-1',
        studentId: 'stu-1',
        status: 'maybe',
        respondedBy: 'stu-1',
        updatedAt: 'old',
        createdAt: 'old',
      },
      {
        id: 'r2',
        sessionId: 'sess-2',
        studentId: 'stu-1',
        status: 'going',
        respondedBy: 'stu-1',
        updatedAt: 'old',
        createdAt: 'old',
      },
    ];
    const result = withRsvpOverride(existing, 'stu-1', 'sess-1', 'declined');
    expect(result.find((r) => r.sessionId === 'sess-1')?.status).toBe('declined');
    expect(result.find((r) => r.sessionId === 'sess-2')?.status).toBe('going');
  });
});

describe('formatSessionDateOnly / formatSessionDateTime (NFR-09: America/Chicago)', () => {
  it('renders a weekday + short date', () => {
    const session: OutreachSessionRow = {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-07-26',
      startsAt: '2026-07-26T15:00:00.000Z',
      endsAt: '2026-07-26T17:00:00.000Z',
      status: 'scheduled',
      peopleReached: null,
    };
    expect(formatSessionDateOnly(session)).toBe('Sun, Jul 26');
  });

  it('renders date + Chicago-local time range (CDT, UTC-5)', () => {
    const session: OutreachSessionRow = {
      id: 's1',
      eventId: 'e1',
      sessionDate: '2026-07-26',
      startsAt: '2026-07-26T15:00:00.000Z', // 10:00 AM Chicago
      endsAt: '2026-07-26T17:00:00.000Z', // 12:00 PM Chicago
      status: 'scheduled',
      peopleReached: null,
    };
    expect(formatSessionDateTime(session)).toBe('Sun, Jul 26 · 10:00 AM–12:00 PM');
  });
});

describe('BEH-01 milestone-toast dedupe primitives (localStorage)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('has not fired until explicitly marked, then reports fired for that exact season+goalBar+milestone', () => {
    expect(hasMilestoneToastFired('season-x', 'team', 25)).toBe(false);
    markMilestoneToastFired('season-x', 'team', 25);
    expect(hasMilestoneToastFired('season-x', 'team', 25)).toBe(true);
  });

  it('is scoped per season -- a different season is unaffected', () => {
    markMilestoneToastFired('season-x', 'team', 25);
    expect(hasMilestoneToastFired('season-y', 'team', 25)).toBe(false);
  });

  it('is scoped per goal bar -- a different goal bar (e.g. a different student) is unaffected', () => {
    markMilestoneToastFired('season-x', 'team', 25);
    expect(hasMilestoneToastFired('season-x', 'student-someone-else', 25)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// <OutreachList /> -- signed-out fallback
// ---------------------------------------------------------------------------

describe('<OutreachList /> signed out', () => {
  it('shows a sign-in prompt, never the coach or student view', () => {
    renderAsUser(null);
    expect(container.textContent).toContain('Sign in to view outreach');
  });
});

// ---------------------------------------------------------------------------
// <OutreachList /> coach view -- all four DES-12 states
// ---------------------------------------------------------------------------

describe('<OutreachList /> coach view', () => {
  it('loading state', async () => {
    renderAsUser(COACH_USER, { loadData: () => new Promise<OutreachLoadResult>(() => {}) });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading outreach events');
  });

  it('error state', async () => {
    renderAsUser(COACH_USER, { loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load outreach events");
  });

  it('empty state (zero outreach sessions) offers a "New outreach event" action', async () => {
    renderAsUser(COACH_USER, {
      loadData: () =>
        Promise.resolve({
          events: [],
          sessions: [],
          rsvps: [],
          attendance: [],
          students: [],
          goalConfig: { seasonId: 's1', individualGoalHoursByStudentId: {} },
          teams: [],
        }),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No outreach events yet');
    expect(container.textContent).toContain('New outreach event');
  });

  it('populated state: dense per-event Upcoming/Past rows (UXD-02), expected/attended counts, unanswered badge, NAV-07 exclusion', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    // T121 (UXP-04 outreach half / UXD-02): ONE row per EVENT now (not per
    // session) -- "Community Food Bank Sort" has two sessions (one past,
    // one upcoming) but appears exactly once, under "Upcoming" (module doc
    // on `buildEventGroups`: an event with any still-scheduled session is
    // "upcoming" as a whole).
    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('Riverside Park Cleanup');
    expect(container.textContent).toContain('After-School Tutoring Drive');
    expect(container.textContent).toContain('Team season goal');
    expect(container.textContent).toContain('4 pending RSVPs');

    // UXD-02 "where": both real location columns surfaced.
    expect(container.textContent).toContain('Riverside Food Bank · 100 Riverside Dr');
    expect(container.textContent).toContain('Riverside Park · 250 Parkway Ave');

    // UXD-02 "how much"/"who": row-level PLANNED hours + EXPECTED count.
    // session-food-bank-upcoming: only Amara is 'going' -- 3h planned, 1
    // expected (the row's own group hours, reusing computeGroupHours
    // verbatim -- BEH-02, never re-derived).
    expect(container.textContent).toContain('Planned3h');
    expect(container.textContent).toContain('Expected1 students');
    // session-park-cleanup-upcoming: Priya and Devon are 'going' -- 4h
    // planned (2h session x 2 students), 2 expected.
    expect(container.textContent).toContain('Planned4h');
    expect(container.textContent).toContain('Expected2 students');
    // event-tutoring-drive (Past, single canceled session): 0h logged, 0
    // attended (a canceled session contributes to neither -- BEH-02).
    expect(container.textContent).toContain('Logged0h');
    expect(container.textContent).toContain('Attended0 students');

    // CHECKER FIX (rework of T121, MAJOR) -- "Canned Food Drive" has ZERO
    // `going` RSVPs at all (module doc on its own fixture entry) but TWO
    // real `attendance` rows (Amara present, Devon late) -- a full-page
    // render proof that "Attended" is never RSVP-derived: a regression back
    // to RSVP-going counting would render "Attended0 students" here, not
    // "Attended2 students".
    expect(container.textContent).toContain('Canned Food Drive');
    expect(container.textContent).toContain('Attended2 students');

    // UXD-03 expand-in-place: per-session detail (the past completed
    // session's "120 people reached", the canceled session's honest copy)
    // is reachable via the "+" expander, not only on the full detail page.
    //
    // T130 (UXC-04) PRE-AUTHORIZED CHANGE: the expander's VISIBLE text is no
    // longer "Show session details – {title}" (that string leaked the row
    // title into visible control text, UXC-04's one genuine violation on
    // this row -- see `OutreachList.tsx`'s own module doc above
    // `buildCoachOutreachColumns`). The title now survives only in the
    // accessible name (`label`, rendered as `aria-label` since this Button
    // has visible children, `Sessions (N)`) -- so this assertion now finds
    // the expander by its ACCESSIBLE NAME (`aria-label`) instead of visible
    // `textContent`, matching how `aria-label` is already asserted on for
    // Edit/Cancel elsewhere in this same file.
    const showButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Show session details'),
    );
    expect(showButtons.length).toBeGreaterThan(0);
    // The visible text is now a short, non-title-leaking label, and the
    // expander is a real ARIA disclosure control -- `aria-expanded` starts
    // `false`. `aria-controls` is deliberately OMITTED while collapsed
    // (post-T130-review CHECKER FIX -- module doc above,
    // `buildCoachOutreachColumns`): the rows it would reference are
    // spliced OUT of the data, not merely hidden, when collapsed, so
    // pointing at their ids before expansion would be a stale/nonexistent
    // IDREF, invalid per the ARIA spec even though it is a common
    // real-world shortcut.
    showButtons.forEach((btn) => {
      expect(btn.textContent).toMatch(/^Sessions \(\d+\)$/);
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(btn.getAttribute('aria-controls')).toBeNull();
    });
    act(() => {
      showButtons.forEach((btn) => btn.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    });
    // Re-query after expansion -- clicking replaced/re-rendered the buttons
    // (new `aria-expanded`/`label` state), so the ORIGINAL `showButtons`
    // references are stale.
    const hideButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Hide session details'),
    );
    expect(hideButtons.length).toBe(showButtons.length);
    hideButtons.forEach((btn) => {
      expect(btn.getAttribute('aria-expanded')).toBe('true');
      // Now expanded -- `aria-controls` references real ids, and each one
      // resolves to a real element in the DOM (not a stale IDREF).
      const controlsIds = btn.getAttribute('aria-controls')?.split(' ') ?? [];
      expect(controlsIds.length).toBeGreaterThan(0);
      controlsIds.forEach((id) => {
        expect(document.getElementById(id)).not.toBeNull();
      });
    });
    expect(container.textContent).toContain('120 people reached');
    expect(container.textContent).toContain('Canceled — no attendance recorded.');

    // NAV-07: meeting content must never appear.
    expect(container.textContent).not.toContain('Weekly Team Meeting');
    expect(container.textContent).not.toContain('Clubhouse');
  });

  it('T101: "New outreach event" opens the real OutreachEventDialog (module doc #11), not a stub', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    expect(newEventButtons.length).toBeGreaterThan(0);
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    // The real dialog's own DialogHeader title, in CREATE mode.
    expect(document.body.textContent).toContain('New outreach event');
    // The old stub copy must never appear anywhere anymore (grep-provable
    // proof this is genuinely wired, not still a disclosure Banner).
    expect(container.textContent).not.toContain('Event creation dialog not built yet');
  });

  it('T101: creating an outreach event via the real dialog calls the injected onSaveEvent and reloads the list', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    let loadCount = 0;
    async function countingLoadData(seasonId: string): Promise<OutreachLoadResult> {
      loadCount += 1;
      return defaultLoadOutreachData(seasonId);
    }

    renderAsUser(COACH_USER, { loadData: countingLoadData, onSaveEvent });
    await flushMicrotasks();
    expect(loadCount).toBe(1);

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const labels = Array.from(document.querySelectorAll('label'));
    const titleLabel = labels.find((el) => el.textContent?.trim().startsWith('Title'));
    const titleInput = document.getElementById(
      titleLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;
    const dateLabel = labels.find((el) => el.textContent?.trim().startsWith('Date'));
    const dateInput = document.getElementById(
      dateLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;

    function setNativeInputValue(input: HTMLInputElement, value: string): void {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    act(() => {
      setNativeInputValue(titleInput, 'Winter Coat Drive');
      setNativeInputValue(dateInput, '2026-08-15');
    });

    const createButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Create event — 1 session',
    );
    expect(createButton).toBeTruthy();
    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushMicrotasks();

    expect(onSaveEvent).toHaveBeenCalledTimes(1);
    expect(onSaveEvent.mock.calls[0][0]).toMatchObject({
      event: { title: 'Winter Coat Drive' },
    });
    // The list reloaded (module doc #11) -- a second real `loadData` call,
    // not a client-side merge.
    expect(loadCount).toBe(2);
    expect(container.textContent).toContain('Outreach event created');
  });

  it('T121 item (a): wires the real roster loader into the create dialog\'s "Expected attendees" checklist, replacing the fixture DEFAULT_STUDENTS', async () => {
    const loadRoster = vi.fn().mockResolvedValue([
      // T147: `teamId` matches `defaultLoadOutreachData`'s own `FIXTURE_TEAMS`
      // (UUID-shaped, no longer `'team-ravens'`) -- this dialog's own
      // `groupActiveRosterByTeam` only shows a roster row inside a team it can
      // actually match against the real `teams` now threaded to it.
      {
        id: 'stu-jamie',
        name: 'Jamie Rivera',
        teamId: 'b1c11111-1111-4111-8111-111111111111',
        isActive: true,
      },
    ]);
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData, loadRoster });
    await flushMicrotasks();
    expect(loadRoster).toHaveBeenCalledTimes(1);

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // The real roster row -- not the dialog's own fixture
    // (`DEFAULT_STUDENTS`, e.g. "Riley Chen"/"Sam Okafor") -- appears in the
    // "Expected attendees" checklist.
    expect(document.body.textContent).toContain('Jamie Rivera');
    expect(document.body.textContent).not.toContain('Riley Chen');
  });

  it("CHECKER FIX (rework of T121, NIT #6): a roster-load FAILURE surfaces an honest page-side notice and passes a real empty array, never the dialog's own fixture students", async () => {
    const loadRoster = vi.fn().mockRejectedValue(new Error('boom'));
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData, loadRoster });
    await flushMicrotasks();
    expect(loadRoster).toHaveBeenCalledTimes(1);

    // Honest, page-side (not injected into the forbidden dialog) DES-12
    // error notice -- visible even before the dialog is opened.
    expect(container.textContent).toContain("Couldn't load the student roster");
    expect(container.textContent).toContain('Retry');

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Never the dialog's own `DEFAULT_STUDENTS` fixture (no fake sample
    // students shown to the coach).
    expect(document.body.textContent).not.toContain('Riley Chen');
    expect(document.body.textContent).not.toContain('Sam Okafor');
    // A real, honest EMPTY roster -- both team groups render their own
    // "no active students" copy (`OutreachEventDialog.tsx`'s own existing
    // empty-roster text, unmodified/read-only).
    expect(document.body.textContent).toContain('Expected attendees (0 of 0)');

    // Retry re-invokes the real loader a second time.
    const retryButtons = Array.from(container.querySelectorAll('button')).filter(
      (btn) => btn.textContent?.trim() === 'Retry',
    );
    expect(retryButtons.length).toBeGreaterThan(0);
    act(() => {
      retryButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    expect(loadRoster).toHaveBeenCalledTimes(2);
  });

  it('T121 items (b)/(c): inline row "Edit" opens the dialog pre-filled (including real expectedStudentIds), and "Cancel" confirms then calls the real event-level mutation', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    const onCancelEvent = vi.fn().mockResolvedValue(undefined);
    // T121 item (a): a roster containing the SAME ids the fixture `going`
    // RSVPs use (`student-amara-webb`) -- the dialog's own checklist only
    // ever shows a checked id that is BOTH in `expectedStudentIds` AND in
    // its own currently-visible roster, so this is required for the
    // "1 of N checked" assertion below to mean anything (a separate, already
    // -covered concern from whether the roster loader itself is wired --
    // see the previous test).
    // T147: `teamId` matches `defaultLoadOutreachData`'s own `FIXTURE_TEAMS`
    // (UUID-shaped, no longer `'team-ravens'`).
    const loadRoster = vi.fn().mockResolvedValue([
      {
        id: 'student-amara-webb',
        name: 'Amara Webb',
        teamId: 'b1c11111-1111-4111-8111-111111111111',
        isActive: true,
      },
      {
        id: 'student-cole-jennings',
        name: 'Cole Jennings',
        teamId: 'b1c11111-1111-4111-8111-111111111111',
        isActive: true,
      },
    ]);
    renderAsUser(COACH_USER, {
      loadData: defaultLoadOutreachData,
      onSaveEvent,
      onCancelEvent,
      loadRoster,
    });
    await flushMicrotasks();

    // "Community Food Bank Sort" (Upcoming row) -- Amara (going on both its
    // sessions) AND Cole (going on the past completed session, `maybe` on
    // the upcoming one) both have a real `going` RSVP SOMEWHERE on this
    // event (fixture data, module doc above the fixture) --
    // `deriveExpectedStudentIds` is deliberately unscoped by session status
    // (component module doc), so both should open pre-checked.
    const editButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Edit – Community Food Bank Sort',
    );
    expect(editButton).toBeTruthy();
    act(() => {
      editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    // Edit mode -- the dialog's own real "Save changes — N sessions"
    // confirm label (Trap #5's `computeConfirmLabel`), never the
    // CREATE-mode "Create event — N sessions" label, and the pre-filled
    // title input carries the real event's title. `event-food-bank-sort`
    // has 2 real sessions (fixture: one past, one upcoming).
    expect(document.body.textContent).toContain('Save changes');
    const labels = Array.from(document.querySelectorAll('label'));
    const titleLabel = labels.find((el) => el.textContent?.trim().startsWith('Title'));
    const titleInput = document.getElementById(
      titleLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;
    expect(titleInput.value).toBe('Community Food Bank Sort');
    // T121 item (b): expectedStudentIds prefill -- both roster students
    // pre-checked (Amara + Cole, per the doc above).
    expect(document.body.textContent).toContain('Expected attendees (2 of 2)');

    // Submit the edit -- `onSaveEvent` receives the real existing event id.
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Save changes — 2 sessions',
    );
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
    expect(container.textContent).toContain('Outreach event updated');

    // T121 item (c) -- inline Cancel, with a real confirmation step (never
    // an unconfirmed destructive action).
    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Cancel – Riverside Park Cleanup',
    );
    expect(cancelButton).toBeTruthy();
    act(() => {
      cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('Cancel "Riverside Park Cleanup"?');
    expect(onCancelEvent).not.toHaveBeenCalled(); // not yet -- only the confirm dialog opened

    const confirmButtons = Array.from(document.querySelectorAll('button')).filter(
      (btn) => btn.textContent?.trim() === 'Cancel event',
    );
    await act(async () => {
      confirmButtons[confirmButtons.length - 1].dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushMicrotasks();
    expect(onCancelEvent).toHaveBeenCalledTimes(1);
    expect(onCancelEvent).toHaveBeenCalledWith('event-park-cleanup');
    expect(container.textContent).toContain('Event canceled');
  });

  it('UXD-05/UXC-08 (T136): exactly one "Team season goal" heading (no duplicated concept), and exactly ONE accessible GoalBar for it -- never two stacked bars', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    // "Team season goal" the CONCEPT appears as exactly one heading-level
    // occurrence in the static page text (the milestone-toast body text,
    // which also happens to contain the phrase, is a separate transient
    // element this count deliberately also tolerates by asserting on the
    // real DOM heading element specifically, not a raw substring count).
    const headings = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(
      (el) => el.textContent === 'Team season goal',
    );
    expect(headings.length).toBe(1);
    // T136: UXC-08's goal strip is a real bar again (F-3 custom component,
    // `GoalBar`) -- but exactly ONE, with confirmed/planned as two offset
    // fills inside that single track, not the pre-T121 TWO stacked
    // `ProgressBar`s this same guard used to catch (2 -> T121's 0 -> this).
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1);
    // The confirmed/planned/goal numbers still render as tiles too (T121's
    // fix to this part is unchanged -- the bar is additive, not a replacement).
    expect(container.textContent).toContain('9 hrs confirmed');
    expect(container.textContent).toContain('7 hrs planned');
  });

  it('BEH-01: the team goal bar fires milestone toasts once confirmed hours cross them (first render only)', async () => {
    window.localStorage.clear();
    // Shrinks each individual goal to 3h so the fixture's real 9h team
    // confirmed total (unchanged from defaultLoadOutreachData) crosses both
    // 25% and 50% of a 15h team goal.
    async function loadWithSmallTeamGoal(seasonId: string): Promise<OutreachLoadResult> {
      const base = await defaultLoadOutreachData(seasonId);
      const smallGoals: Record<string, number> = {};
      for (const student of base.students) smallGoals[student.id] = 3;
      return { ...base, goalConfig: { seasonId, individualGoalHoursByStudentId: smallGoals } };
    }

    renderAsUser(COACH_USER, { loadData: loadWithSmallTeamGoal });
    await flushMicrotasks();

    expect(container.textContent).toContain(
      'Team season goal: reached 25% of the season goal (confirmed hours).',
    );
    expect(container.textContent).toContain(
      'Team season goal: reached 50% of the season goal (confirmed hours).',
    );
    // 9 confirmed / 15 goal = 60% -- 75% and 100% must NOT show as reached.
    expect(container.textContent).not.toContain('75% reached');
    expect(container.textContent).not.toContain('100% reached');
  });
});

// ---------------------------------------------------------------------------
// T147: the outreach/meetings team picker shows fixture teams to real users.
// This page now threads real `teams` (`loaders/outreach.ts`'s
// `makeLoadOutreachData`) to `<OutreachEventDialog>`'s own `teams` prop
// instead of that dialog falling back to its `DEFAULT_TEAMS` fixture
// (`'team-ravens'`/`'team-titans'`, non-uuid strings that fail the real
// `events.team_ids uuid[]` insert -- the report that blocked meeting
// creation outright).
//
// Create mode has no `initialEvent`, so `OutreachEventDialog.tsx`'s own
// `allTeamIds` (derived straight from the `teams` prop) is what seeds
// `selectedTeamIds` on open -- unlike edit mode, no extra fixture-event
// scoping trick is needed here to make the `teams` prop the thing under
// test.
//
// Assertion mechanism -- UUID shape on the submitted payload, never a
// name-based assertion (packet "The assertion mechanism" section).
// ---------------------------------------------------------------------------

describe('T147: OutreachEventDialog (create mode) submits real team UUIDs, not DEFAULT_TEAMS fixture strings', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('deselecting one team submits a teamIds array of real UUIDs from the teams prop, never the fixture strings', async () => {
    const onSaveEvent = vi.fn().mockResolvedValue(undefined);
    // `defaultLoadOutreachData` (Known Context/Traps #1's own fixture
    // loader) now resolves `teams: FIXTURE_TEAMS` -- UUID-shaped ids
    // (module doc on that fixture), the real prop under test here.
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData, onSaveEvent });
    await flushMicrotasks();

    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    act(() => {
      newEventButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const labels = Array.from(document.querySelectorAll('label'));
    const titleLabel = labels.find((el) => el.textContent?.trim().startsWith('Title'));
    const titleInput = document.getElementById(
      titleLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;
    const dateLabel = labels.find((el) => el.textContent?.trim().startsWith('Date'));
    const dateInput = document.getElementById(
      dateLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;

    function setNativeInputValue(input: HTMLInputElement, value: string): void {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    act(() => {
      setNativeInputValue(titleInput, 'Winter Coat Drive');
      setNativeInputValue(dateInput, '2026-08-15');
    });

    // Open the "Team scope" MultiSelector and deselect the LAST option in
    // its own listbox -- positional, not by label text (with the fix
    // reverted the injected UUID-fixture labels are absent, so a label
    // lookup would die with a harness-shaped failure instead of the UUID
    // mismatch this test exists to prove). Scoped to the trigger's own
    // `aria-controls` listbox, not the whole document -- a second,
    // unrelated `role="option"` group exists on this page (the dialog's own
    // Event type `Selector`). The last option is never the `hasSelectAll`
    // pseudo-option, which that component places FIRST.
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
    act(() => {
      options[options.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Create event — 1 session',
    );
    expect(createButton).toBeTruthy();
    await act(async () => {
      createButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
// <OutreachList /> student/parent view -- all four DES-12 states
// ---------------------------------------------------------------------------

describe('<OutreachList /> student/parent view', () => {
  it('loading state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: () => new Promise<OutreachLoadResult>(() => {}),
    });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading outreach events');
  });

  it('error state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load outreach events");
  });

  it('empty state (zero outreach sessions)', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: () =>
        Promise.resolve({
          events: [],
          sessions: [],
          rsvps: [],
          attendance: [],
          students: [],
          goalConfig: { seasonId: 's1', individualGoalHoursByStudentId: {} },
          teams: [],
        }),
    });
    await flushMicrotasks();
    // DES-15 verbatim (PRD line 213, T083).
    expect(container.textContent).toContain('No upcoming outreach yet.');
    expect(container.textContent).toContain(
      'When your coach posts an event, you can sign up here.',
    );
  });

  it('populated state: own goal bar (confirmed/planned never summed), unanswered badge, RSVP controls, NAV-07 exclusion', async () => {
    window.localStorage.clear();
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Your season goal');
    expect(container.textContent).toContain('3 hrs confirmed');
    expect(container.textContent).toContain('0 hrs planned');
    expect(container.textContent).toContain('1 awaiting your RSVP');
    expect(container.textContent).toContain("You RSVP'd: Going"); // past session-food-bank-past

    // NAV-07: meeting content must never appear.
    expect(container.textContent).not.toContain('Weekly Team Meeting');

    // Riverside Park Cleanup: viewer already answered "maybe" -- the
    // SegmentedControl must reflect that as the checked segment.
    const radiogroups = Array.from(container.querySelectorAll('[role="radiogroup"]'));
    const parkGroup = radiogroups.find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Riverside Park Cleanup'),
    );
    expect(parkGroup).toBeTruthy();
    expect(
      parkGroup?.querySelector('button[data-value="maybe"]')?.getAttribute('aria-checked'),
    ).toBe('true');

    // Community Food Bank Sort (upcoming): viewer has NOT answered yet --
    // no segment should show as checked (the UNANSWERED_RSVP_SEGMENT_VALUE
    // sentinel matches none of the real items).
    const foodBankGroup = radiogroups.find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Community Food Bank Sort'),
    );
    expect(foodBankGroup).toBeTruthy();
    for (const value of ['going', 'maybe', 'declined']) {
      expect(
        foodBankGroup?.querySelector(`button[data-value="${value}"]`)?.getAttribute('aria-checked'),
      ).toBe('false');
    }
  });

  // T193: this test's own `onRsvpChange` used to be entirely absent, which
  // meant a click here fell through to `OutreachList`'s real default
  // (`submitRsvpChange`, an unmocked Supabase upsert that rejects in this
  // harness). Before T193 that was harmless -- the old `handleRsvpChange`
  // was local-only and never called any injected writer at all. Under T193
  // the same click now awaits that rejection and rolls the optimistic
  // update back, so this test's assertions -- taken immediately after a
  // synchronous `act()`, with no flush -- were passing only by racing
  // ahead of the rejection's microtask: `await flushMicrotasks()` inserted
  // here turns it `1 failed | 91 passed` (T193 gate finding, packet §6).
  // Fixed by injecting a real RESOLVING fake writer and flushing after the
  // click, so the assertions below now hold for the right reason (the
  // write succeeded) rather than the wrong one (racing an unhandled
  // rejection). The live-update assertions themselves are unchanged.
  it('selecting a real RSVP segment updates the goal bar and the unanswered-RSVP badge live (module doc #8b)', async () => {
    window.localStorage.clear();
    const fakeOnRsvpChange = vi.fn().mockResolvedValue(undefined);
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: defaultLoadOutreachData,
      onRsvpChange: fakeOnRsvpChange,
    });
    await flushMicrotasks();

    const foodBankGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Community Food Bank Sort'),
    );
    const goingButton = foodBankGroup?.querySelector('button[data-value="going"]');
    expect(goingButton).toBeTruthy();

    act(() => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    // session-food-bank-upcoming is `scheduled` (3h) -- a fresh "going" RSVP
    // on it adds to PLANNED hours only, never to confirmed (BEH-02).
    expect(container.textContent).toContain('3 hrs confirmed'); // unchanged
    expect(container.textContent).toContain('3 hrs planned'); // was 0, now 3
    expect(container.textContent).toContain('0 awaiting your RSVP'); // was 1, now answered
    expect(fakeOnRsvpChange).toHaveBeenCalledTimes(1);
  });

  it('BEH-01: milestone toast fires once per season+goal-bar, deduped via localStorage across remounts', async () => {
    window.localStorage.clear();

    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();
    // Viewer: 3 confirmed / 12 goal = exactly 25%.
    expect(container.textContent).toContain(
      'Your season goal: reached 25% of the season goal (confirmed hours).',
    );

    freshContainer();

    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();
    // Same season, same goal bar (the viewer's own id) -- already fired, so
    // crossing the SAME milestone again must NOT re-fire the toast.
    expect(container.textContent).not.toContain('reached 25% of the season goal');
    // The milestone tick itself is still shown as reached (a real, current
    // fact), independent of whether the one-time toast fires again.
    expect(container.textContent).toContain('25% reached');
  });

  // -------------------------------------------------------------------------
  // T129/UXC-01 (STUDENT section only -- `CoachOutreachSection` is T130's).
  // `StudentOutreachSection`'s own `List`'s `header` prop was removed (it
  // used to print "Upcoming outreach events"/"Past outreach events" a
  // second time, per `List.tsx:194-201`); its `Heading` now carries a
  // `useId`-generated id, and a `<div role="group">` wrapping the
  // List/EmptyState ternary carries `aria-labelledby={headingId}` --
  // present in BOTH branches, so the region's accessible name survives even
  // when there is no `List` to attach a `header` to.
  //
  // CHECKER FIX (rework of T129, MAJOR): the wrapper was originally an
  // Astryx `Section`, which applies a full-bleed negative-margin band
  // unconditionally and renders a bare, role-less `<div>` that cannot
  // support `aria-labelledby` under ARIA. A plain `<div role="group">`
  // fixes both; the query below includes `role="group"` so a regression
  // back to a role-less wrapper fails the lookup itself, not just a later
  // assertion.
  // -------------------------------------------------------------------------
  describe('T129 UXC-01 -- exactly one heading per Upcoming/Past section', () => {
    function resolveAriaLabelledbyTarget(headingText: string): {
      headingId: string;
      resolvedText: string | null;
    } {
      const heading = Array.from(container.querySelectorAll('h2')).find(
        (h) => h.textContent === headingText,
      );
      expect(heading).toBeTruthy();
      const headingId = heading!.id;
      expect(headingId).toBeTruthy();
      const labelledEl = container.querySelector(`[role="group"][aria-labelledby="${headingId}"]`);
      expect(labelledEl).toBeTruthy();
      expect(labelledEl!.getAttribute('role')).toBe('group');
      const resolvedId = labelledEl!.getAttribute('aria-labelledby')!;
      const resolvedEl = document.getElementById(resolvedId);
      return { headingId, resolvedText: resolvedEl?.textContent ?? null };
    }

    it('populated branch: both "Upcoming" and "Past" resolve aria-labelledby back to their own Heading, printed exactly once', async () => {
      window.localStorage.clear();
      renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
      await flushMicrotasks();

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
        const leafMatches = Array.from(container.querySelectorAll('*')).filter(
          (el) => el.children.length === 0 && el.textContent === title,
        );
        expect(leafMatches.length).toBe(1);
      }
    });

    it('empty branch: "Upcoming" has no scheduled sessions -- its aria-labelledby still resolves to its Heading, even with no List rendered ("Past" stays populated in the same render)', async () => {
      window.localStorage.clear();
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: async (seasonId: string) => {
          const base = await defaultLoadOutreachData(seasonId);
          // Every session that was 'scheduled' becomes 'completed' -- no
          // event has any scheduled session left, so `buildEventGroups`
          // (module doc above) buckets everything into "Past", leaving
          // "Upcoming" empty while "Past" stays populated.
          return {
            ...base,
            sessions: base.sessions.map((session) =>
              session.status === 'scheduled'
                ? { ...session, status: 'completed' as const }
                : session,
            ),
          };
        },
      });
      await flushMicrotasks();

      // Confirm "Upcoming" really is the EmptyState branch (per its own
      // `emptyDescription`), not a load failure or the page-level "zero
      // outreach at all" EmptyState.
      expect(container.textContent).toContain('You have no upcoming outreach events.');

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// T193: the student/parent RSVP `SegmentedControl` now actually persists
// (component module doc #16). Every test below drives the "answering for
// the first time" case (`session-food-bank-upcoming` carries no RSVP row
// for `PLACEHOLDER_CURRENT_STUDENT_ID` in `FIXTURE_RSVPS`) -- the dominant
// case the packet's own §3 named, where a scalar `previousStatus` would be
// `undefined`.
// ---------------------------------------------------------------------------

describe('<OutreachList /> T193: real RSVP writer wiring (packet §5)', () => {
  function clickFoodBankGoing(): void {
    const foodBankGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Community Food Bank Sort'),
    );
    const goingButton = foodBankGroup?.querySelector('button[data-value="going"]');
    expect(goingButton).toBeTruthy();
    act(() => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
  }

  // C1 + C2 -- Mutation 1 (revert `handleRsvpChange` to local-only) and
  // Mutation 2 (pass `viewerStudentId` as `respondedBy`) both turn this red:
  // asserted on the spy's argument object, not just the call count.
  it('C1/C2: changing an RSVP calls the injected writer exactly once, with studentId=viewerStudentId and respondedBy=viewerProfileId (the PROFILE id, not the student id)', async () => {
    window.localStorage.clear();
    const spy = vi.fn().mockResolvedValue(undefined);
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData, onRsvpChange: spy });
    await flushMicrotasks();

    clickFoodBankGoing();
    await flushMicrotasks();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      sessionId: 'session-food-bank-upcoming',
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      status: 'going',
      respondedBy: STUDENT_OR_PARENT_USER.id, // profiles.id -- T174's exact defect if swapped
    });
    expect(STUDENT_OR_PARENT_USER.id).not.toBe(PLACEHOLDER_CURRENT_STUDENT_ID);
  });

  // C3 -- Mutation: delete the rollback line in the `catch`.
  it('C3: a rejected write restores the previous (unanswered) status and surfaces a visible, honest error', async () => {
    window.localStorage.clear();
    const spy = vi.fn().mockRejectedValue(new Error('network down'));
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData, onRsvpChange: spy });
    await flushMicrotasks();

    expect(container.textContent).toContain('1 awaiting your RSVP');
    clickFoodBankGoing();
    await flushMicrotasks();

    const foodBankGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Community Food Bank Sort'),
    );
    // Rolled back to unanswered -- no segment checked, same as before the
    // click. A scalar `previousStatus` rollback cannot reach this state for
    // this session (it was `undefined`, not a real status); only restoring
    // the snapshot array does.
    for (const value of ['going', 'maybe', 'declined']) {
      expect(
        foodBankGroup?.querySelector(`button[data-value="${value}"]`)?.getAttribute('aria-checked'),
      ).toBe('false');
    }
    expect(container.textContent).toContain('1 awaiting your RSVP'); // reverted, not "0"
    expect(container.textContent).toContain("Couldn't save your RSVP");
    expect(container.textContent).toContain('network down');
  });

  // C5 -- honest framing (packet §5): this also passes against current code,
  // since the coach branch has no RSVP handler at all. Regression guard, not
  // a defect discriminator; kept with its mutation site named (fire the
  // writer on coach-view mount) rather than dressed up as a proof.
  it('C5 (regression guard, not a defect discriminator -- see worker report): a coach/admin viewer never triggers the writer', async () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData, onRsvpChange: spy });
    await flushMicrotasks();
    expect(spy).not.toHaveBeenCalled();
  });

  // C6 -- Mutation: move the state set after the `await`.
  it('C6: the optimistic update is applied before the writer promise settles', async () => {
    window.localStorage.clear();
    let resolveWrite: (() => void) | undefined;
    const spy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData, onRsvpChange: spy });
    await flushMicrotasks();

    clickFoodBankGoing();

    // The write is still outstanding (never resolved) -- the optimistic
    // update must already be visible, not gated behind the `await`.
    expect(container.textContent).toContain('0 awaiting your RSVP');
    const foodBankGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.startsWith('Your RSVP for Community Food Bank Sort'),
    );
    expect(
      foodBankGroup?.querySelector('button[data-value="going"]')?.getAttribute('aria-checked'),
    ).toBe('true');

    resolveWrite?.();
    await flushMicrotasks();
  });
});

// ---------------------------------------------------------------------------
// T170: `viewerStudentId` resolved for real (component module doc #15).
// Fixtures below deliberately use a distinct, fabricated, non-placeholder id
// (`student-real-c1`/`student-real-c2`, hazard 3c) so a mutation that breaks
// resolution and one that doesn't cannot render identically.
// ---------------------------------------------------------------------------

/** Distinct from `PLACEHOLDER_CURRENT_STUDENT_ID` and from
 * `defaultLoadOutreachData`'s own `FIXTURE_*` ids (hazard 3c). */
const DISTINCT_STUDENT_ID = 'student-real-c1';

/** Own sessions/rsvps/goalConfig keyed to `DISTINCT_STUDENT_ID`, values
 * chosen to differ from every other fixture in this file so a resolution
 * regression (e.g. falling back to the placeholder) produces visibly
 * different, not coincidentally identical, output. */
function makeDistinctViewerLoadResult(): OutreachLoadResult {
  const events: OutreachEventRow[] = [
    makeTestEvent({ id: 'event-c1-confirmed', title: 'C1 Confirmed Event' }),
    makeTestEvent({ id: 'event-c1-planned', title: 'C1 Planned Event' }),
    makeTestEvent({ id: 'event-c1-unanswered', title: 'C1 Unanswered Event' }),
  ];
  const sessions: OutreachSessionRow[] = [
    {
      id: 'session-c1-confirmed',
      eventId: 'event-c1-confirmed',
      sessionDate: '2026-06-01',
      startsAt: '2026-06-01T14:00:00.000Z',
      endsAt: '2026-06-01T16:00:00.000Z', // 2h, completed -- confirmed
      status: 'completed',
      peopleReached: null,
    },
    {
      id: 'session-c1-planned',
      eventId: 'event-c1-planned',
      sessionDate: '2026-08-01',
      startsAt: '2026-08-01T14:00:00.000Z',
      endsAt: '2026-08-01T17:00:00.000Z', // 3h, scheduled -- planned
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'session-c1-unanswered',
      eventId: 'event-c1-unanswered',
      sessionDate: '2026-08-05',
      startsAt: '2026-08-05T14:00:00.000Z',
      endsAt: '2026-08-05T15:00:00.000Z', // scheduled, no rsvp -- unanswered
      status: 'scheduled',
      peopleReached: null,
    },
  ];
  const rsvps: RsvpRow[] = [
    {
      id: 'rsvp-c1-confirmed',
      sessionId: 'session-c1-confirmed',
      studentId: DISTINCT_STUDENT_ID,
      status: 'going',
      respondedBy: DISTINCT_STUDENT_ID,
      updatedAt: '2026-05-01T00:00:00.000Z',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
    {
      id: 'rsvp-c1-planned',
      sessionId: 'session-c1-planned',
      studentId: DISTINCT_STUDENT_ID,
      status: 'going',
      respondedBy: DISTINCT_STUDENT_ID,
      updatedAt: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-07-01T00:00:00.000Z',
    },
    // Deliberately NO rsvp row for `PLACEHOLDER_CURRENT_STUDENT_ID` at all --
    // if resolution regressed to that placeholder, every figure below would
    // read 0/empty instead of this fixture's own distinct values.
  ];
  return {
    events,
    sessions,
    rsvps,
    attendance: [],
    students: [{ id: DISTINCT_STUDENT_ID, name: 'Real Student C1' }],
    goalConfig: {
      seasonId: 'season-placeholder-current',
      individualGoalHoursByStudentId: { [DISTINCT_STUDENT_ID]: 20 },
    },
    teams: [],
  };
}

describe('<OutreachList /> T170: viewerStudentId resolved for real', () => {
  it('criterion 1: real resolved id reaches every consumer, positively, with a distinct non-placeholder fixture (hazard 3c)', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: () => Promise.resolve(makeDistinctViewerLoadResult()),
      viewerStudentId: DISTINCT_STUDENT_ID,
    });
    await flushMicrotasks();

    // Confirmed/planned hours (computeStudentHours) and the unanswered-RSVP
    // count (getUnansweredRsvpCount) -- both driven by `viewerStudentId`.
    expect(container.textContent).toContain('2 hrs confirmed');
    expect(container.textContent).toContain('3 hrs planned');
    expect(container.textContent).toContain('1 awaiting your RSVP');

    // GoalBar's own aria-valuetext (goalBarId identity feeds the milestone
    // dedupe key, not directly assertable via DOM text -- the hours/goal
    // figures baked into this string are the observable proxy for it).
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute('aria-valuetext')).toBe('2 of 20 hours confirmed; 3 more planned');
  });

  /**
   * Checker MAJOR fix (gate round 1): the criterion 1 test above renders
   * with an EXPLICIT `viewerStudentId: DISTINCT_STUDENT_ID` prop, which
   * short-circuits `resolveStudentId` before it is ever called (`:3875-3876`
   * of the component). No test anywhere previously rendered with NO
   * explicit `viewerStudentId` prop and checked that the RESOLVER's own
   * distinct return value actually reached these same figures -- so a
   * mutation that discards the resolver's real return value and
   * substitutes `PLACEHOLDER_CURRENT_STUDENT_ID` whenever it is non-null
   * (`resolveStudentId(viewer).then((id) => (id === null ? null :
   * PLACEHOLDER_CURRENT_STUDENT_ID))`) passed 90/90: every positive
   * assertion took the explicit-prop bypass path, and the only
   * placeholder-returning stub is the harness's own default (indistinguishable
   * from the mutated behavior). This test renders via the SAME resolver path
   * `router.tsx:244`'s real, no-props call site actually takes.
   */
  it('criterion 1 (resolver path, no explicit prop): the SAME positive figures, reached via resolveStudentId itself, not the explicit-prop bypass', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: () => Promise.resolve(makeDistinctViewerLoadResult()),
      resolveStudentId: async () => DISTINCT_STUDENT_ID,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('2 hrs confirmed');
    expect(container.textContent).toContain('3 hrs planned');
    expect(container.textContent).toContain('1 awaiting your RSVP');

    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar?.getAttribute('aria-valuetext')).toBe('2 of 20 hours confirmed; 3 more planned');
  });

  describe('criterion 2: explicit viewerStudentId bypasses resolveStudentId entirely, paired', () => {
    it('(a) resolveStudentId is never called when viewerStudentId is explicit, and (b) the explicit id genuinely reaches the render', async () => {
      const resolveStudentId = vi.fn(async () => 'should-never-be-called');
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: () => Promise.resolve(makeDistinctViewerLoadResult()),
        viewerStudentId: DISTINCT_STUDENT_ID,
        resolveStudentId,
      });
      await flushMicrotasks();

      expect(resolveStudentId).not.toHaveBeenCalled();
      // (b) -- distinguishable content, not just "did not error."
      expect(container.textContent).toContain('2 hrs confirmed');
    });

    it('vacuity probe: a broken resolveStudentId does not affect the explicit-prop render, but DOES break a separate no-explicit-prop render', async () => {
      const brokenResolveStudentId = vi.fn(async (): Promise<string | null> => {
        throw new Error('boom');
      });

      // Explicit prop given -- must stay GREEN (resolveStudentId's own
      // brokenness is never reached).
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: () => Promise.resolve(makeDistinctViewerLoadResult()),
        viewerStudentId: DISTINCT_STUDENT_ID,
        resolveStudentId: brokenResolveStudentId,
      });
      await flushMicrotasks();
      expect(container.textContent).toContain('2 hrs confirmed');
      expect(container.textContent).not.toContain("Couldn't find your student record");

      // Separate render, no explicit prop -- must go RED under the same
      // mutation (proves the vacuity probe isn't just an always-green
      // assertion).
      freshContainer();
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: () => Promise.resolve(makeDistinctViewerLoadResult()),
        resolveStudentId: brokenResolveStudentId,
      });
      await flushMicrotasks();
      expect(container.textContent).toContain("Couldn't find your student record");
    });
  });

  it('criterion 3: coach/admin view never calls resolveStudentId, paired with a positive render control (REV2 BLOCKER-1 fix)', async () => {
    const resolveStudentId = vi.fn(async () => 'should-never-be-called');
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData, resolveStudentId });
    await flushMicrotasks();

    // Positive control FIRST: the coach view genuinely rendered a
    // coach-only affordance (not the whole view being absent/loading/
    // errored) -- otherwise the spy-not-called assertion below would pass
    // identically whether resolution was correctly skipped or the view
    // never rendered at all (the exact vacuity the gate caught in round 1).
    const newEventButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('New outreach event'),
    );
    expect(newEventButtons.length).toBeGreaterThan(0);

    expect(resolveStudentId).not.toHaveBeenCalled();
  });

  describe('criterion 4: identity tier own loading/error/null sub-states, isolated', () => {
    it('loading: shown while resolveStudentId is still pending', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: defaultLoadOutreachData,
        resolveStudentId: () => new Promise<string | null>(() => {}),
      });
      await flushMicrotasks();
      expect(container.textContent).toContain('Finding your student record');
    });

    it('error: shown when resolveStudentId rejects', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: defaultLoadOutreachData,
        resolveStudentId: () => Promise.reject(new Error('boom')),
      });
      await flushMicrotasks();
      expect(container.textContent).toContain("Couldn't find your student record");
    });

    it('null: shown when resolveStudentId resolves null (no linked student), and SelfCheckoffDialog never mounts', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: defaultLoadOutreachData,
        resolveStudentId: async () => null,
      });
      await flushMicrotasks();
      expect(container.textContent).toContain('No student account linked yet');
      // The shared SelfCheckoffDialog is only ever rendered by
      // StudentParentOutreachView -- confirms it never mounted on a null
      // identity (module doc #15's write-side T184-class verdict, (ii)).
      expect(container.querySelectorAll('dialog').length).toBe(0);
    });
  });

  describe('criterion 10: SelfCheckoffDialog carries the real resolved id, mutation-provable', () => {
    it('opening "Mark attendance" calls loadSelfCheckoffAttendance with the real, resolved, non-placeholder studentId', async () => {
      mockedLoadSelfCheckoffAttendance.mockClear();
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: defaultLoadOutreachData,
        viewerStudentId: DISTINCT_STUDENT_ID,
      });
      await flushMicrotasks();

      const cannedDriveButton = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim() === 'Mark attendance – Canned Food Drive',
      );
      expect(cannedDriveButton).toBeTruthy();
      act(() => {
        cannedDriveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushMicrotasks();

      expect(mockedLoadSelfCheckoffAttendance).toHaveBeenCalled();
      const lastCall =
        mockedLoadSelfCheckoffAttendance.mock.calls[
          mockedLoadSelfCheckoffAttendance.mock.calls.length - 1
        ];
      expect(lastCall?.[1]).toBe(DISTINCT_STUDENT_ID);
      expect(lastCall?.[1]).not.toBe(PLACEHOLDER_CURRENT_STUDENT_ID);
    });

    /**
     * Checker MAJOR fix (gate round 1) -- the criterion 10 equivalent of
     * the criterion 1 fix immediately above: the test above renders with an
     * EXPLICIT `viewerStudentId` prop, so it never observes
     * `resolveStudentId`'s own return value reaching `SelfCheckoffDialog`.
     * This test renders with NO explicit prop, via the resolver path only.
     */
    it('opening "Mark attendance" calls loadSelfCheckoffAttendance with the resolver-returned id, with NO explicit viewerStudentId prop', async () => {
      mockedLoadSelfCheckoffAttendance.mockClear();
      renderAsUser(STUDENT_OR_PARENT_USER, {
        loadData: defaultLoadOutreachData,
        resolveStudentId: async () => DISTINCT_STUDENT_ID,
      });
      await flushMicrotasks();

      const cannedDriveButton = Array.from(container.querySelectorAll('button')).find(
        (btn) => btn.textContent?.trim() === 'Mark attendance – Canned Food Drive',
      );
      expect(cannedDriveButton).toBeTruthy();
      act(() => {
        cannedDriveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
      await flushMicrotasks();

      expect(mockedLoadSelfCheckoffAttendance).toHaveBeenCalled();
      const lastCall =
        mockedLoadSelfCheckoffAttendance.mock.calls[
          mockedLoadSelfCheckoffAttendance.mock.calls.length - 1
        ];
      expect(lastCall?.[1]).toBe(DISTINCT_STUDENT_ID);
      expect(lastCall?.[1]).not.toBe(PLACEHOLDER_CURRENT_STUDENT_ID);
    });
  });
});

// ---------------------------------------------------------------------------
// T126 (PRD v2 UXP-03): the "Mark attendance" self-check-off entry point on
// student/parent Past rows, and the shared `SelfCheckoffDialog` it opens.
// Per this task's Allowed Files, this is a deliberate, disclosed addition
// to this ALREADY-Allowed test file (same posture every prior task's own
// additions to this file already established, e.g. T106/T112/T121's own
// describe blocks below).
// ---------------------------------------------------------------------------

describe('<OutreachList /> T126: student/parent "Mark attendance" self check-off entry point', () => {
  it('a Past-bucket event with a completed session shows a "Mark attendance" action; an Upcoming-bucket event does not, even if it also has a completed session', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    // "Canned Food Drive" (event-canned-drive) has exactly one session,
    // already `completed`, no still-`scheduled` session at all -- it is
    // entirely in the Past bucket (buildEventGroups). Its own row must
    // carry a real "Mark attendance" Button.
    const cannedDriveButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Mark attendance – Canned Food Drive',
    );
    expect(cannedDriveButton).toBeTruthy();

    // "Community Food Bank Sort" (event-food-bank-sort) has BOTH a
    // completed session (session-food-bank-past) AND a still-`scheduled`
    // one (session-food-bank-upcoming) -- `buildEventGroups` puts the
    // WHOLE event in the Upcoming bucket (hasScheduled wins). Even though
    // this event genuinely has a completed day, its Upcoming-bucket row
    // must NOT offer self check-off (module doc #14: `allowSelfCheckoff`
    // is a section-level gate, not merely "does this row have a completed
    // session").
    const foodBankButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Mark attendance – Community Food Bank Sort',
    );
    expect(foodBankButton).toBeUndefined();

    // "Riverside Park Cleanup" -- Upcoming, zero completed sessions at all
    // -- likewise no button (the ordinary, uninteresting case).
    const parkCleanupButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Mark attendance – Riverside Park Cleanup',
    );
    expect(parkCleanupButton).toBeUndefined();
  });

  it('clicking "Mark attendance" opens the shared SelfCheckoffDialog scoped to that row\'s own event/sessions', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    expect(container.querySelectorAll('dialog[open]').length).toBe(0);

    const cannedDriveButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Mark attendance – Canned Food Drive',
    );
    act(() => {
      cannedDriveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    // The Dialog's own header (title + event-title subtitle) confirms it
    // opened scoped to the RIGHT row, not some other event.
    expect(container.textContent).toContain('Mark attendance');
    expect(container.textContent).toContain('Canned Food Drive');

    // Only ONE shared dialog instance exists for the whole view (module doc
    // #14) -- opening it from "Canned Food Drive" must never simultaneously
    // show a second dialog scoped to a different event.
    const dialogs = container.querySelectorAll('dialog[open]');
    expect(dialogs.length).toBe(1);
  });

  it('the dialog closes back via its own Cancel action', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const cannedDriveButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Mark attendance – Canned Food Drive',
    );
    act(() => {
      cannedDriveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    expect(container.querySelectorAll('dialog[open]').length).toBe(1);

    const cancelButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel',
    );
    act(() => {
      cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    expect(container.querySelectorAll('dialog[open]').length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// T112 HOTFIX: every event row (coach + student/parent, Upcoming + Past) now
// exposes a real "View details" navigation `Link` to `/outreach/:eventId`
// (component module doc #13) -- George's own live-reported dead-end-rows
// regression. Mirrors `CalendarPage.test.tsx`'s own "row Link text is
// distinguishable per session" assertions (real `<a href>` elements, real
// distinguishing per-row text), against this file's own real fixture data.
// ---------------------------------------------------------------------------

describe('<OutreachList /> T112: "View details" navigation link on every row', () => {
  it('coach view: every event row (Upcoming AND Past) carries a real `<a href="/outreach/:eventId">` link, distinguishable per row', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const links = Array.from(container.querySelectorAll('a'));

    // T121 (UXP-04 outreach half / UXD-02): rows are per-EVENT now, not
    // per-session (component module doc on `buildEventGroups`) --
    // event-food-bank-sort has two sessions (one past, one upcoming) but is
    // ONE row (bucketed "Upcoming", since it still has a scheduled
    // session), so its own link now appears exactly ONCE, not twice like
    // the former per-session row model. `event-park-cleanup` (Upcoming) and
    // `event-tutoring-drive` (Past) are each their own single-session row.
    const foodBankLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-food-bank-sort',
    );
    const parkCleanupLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-park-cleanup',
    );
    const tutoringLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-tutoring-drive',
    );

    expect(foodBankLink).toBeTruthy();
    expect(parkCleanupLink).toBeTruthy();
    expect(tutoringLink).toBeTruthy();

    const foodBankLinks = links.filter(
      (a) => a.getAttribute('href') === '/outreach/event-food-bank-sort',
    );
    expect(foodBankLinks.length).toBe(1);

    // Distinguishable per-row text (astryx-api.md Link Best Practices, same
    // checker-fixed requirement `CalendarPage.tsx` already satisfies).
    // T131: the standalone "View details – {title}" action text moved off
    // this link and onto the title itself -- the link's accessible name is
    // now exactly the event title (no more "View details – " prefix).
    expect(foodBankLink!.textContent).toBe('Community Food Bank Sort');
    expect(foodBankLink!.textContent).toContain('Community Food Bank Sort');
    expect(parkCleanupLink!.textContent).toContain('Riverside Park Cleanup');
    expect(tutoringLink!.textContent).toContain('After-School Tutoring Drive');

    // NAV-07: the filtered-out meeting event must never get a link either.
    expect(links.some((a) => a.getAttribute('href') === '/outreach/event-team-meeting')).toBe(
      false,
    );
  });

  it('student/parent view: every event row (Upcoming AND Past) carries a real `<a href="/outreach/:eventId">` link, distinguishable per row', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const links = Array.from(container.querySelectorAll('a'));

    // T121: one row (and therefore one link) per event -- see the coach
    // view's own test above for the full "why 1, not 2" explanation.
    const foodBankLinks = links.filter(
      (a) => a.getAttribute('href') === '/outreach/event-food-bank-sort',
    );
    const parkCleanupLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-park-cleanup',
    );
    const tutoringLink = links.find(
      (a) => a.getAttribute('href') === '/outreach/event-tutoring-drive',
    );

    expect(foodBankLinks.length).toBe(1);
    expect(parkCleanupLink).toBeTruthy();
    expect(tutoringLink).toBeTruthy();

    // T132: the title itself is now the link (no separate "View details"
    // text) on the student/parent side -- the same shape T131 already
    // shipped on the coach view's own title link (`:1729` above, this same
    // `describe` block, `toBe('Community Food Bank Sort')`). The two halves
    // of this page now agree.
    expect(foodBankLinks[0].textContent).toBe('Community Food Bank Sort');
    expect(parkCleanupLink!.textContent).toContain('Riverside Park Cleanup');
    expect(tutoringLink!.textContent).toContain('After-School Tutoring Drive');

    // T132 acceptance criterion 3: no `aria-label`/`label` override -- the
    // accessible name is the title text itself, same as it is with no
    // `aria-label` present at all.
    expect(foodBankLinks[0].hasAttribute('aria-label')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// T106 HOTFIX: `useActiveSeason()` wiring -- component module doc #12's four
// states, the explicit-`seasonId`-prop override precedence, and (Required
// Worker Output) direct proof that `loadData` is only ever called with a
// real UUID-shaped season id resolved from `useActiveSeason()`, never with
// the old `PLACEHOLDER_SEASON_ID` literal.
// ---------------------------------------------------------------------------

describe('<OutreachList /> useActiveSeason() wiring (T106 hotfix)', () => {
  it('renders a loading state for the active season itself (not the outreach-data loading state) while useActiveSeason() is still `loading`, and never calls loadData', async () => {
    const loadData = vi.fn(() => new Promise<OutreachLoadResult>(() => {}));
    renderAsUser(COACH_USER, { loadData }, () => new Promise(() => {}));
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading the active season');
    expect(container.textContent).not.toContain('Loading outreach events');
    expect(loadData).not.toHaveBeenCalled();
  });

  it('renders an honest "No active season yet" state for the real `\'none\'` case -- zero seasons in the database -- and never calls loadData', async () => {
    const loadData = vi.fn(() =>
      Promise.resolve(defaultLoadOutreachData('season-placeholder-current')),
    );
    renderAsUser(COACH_USER, { loadData }, async () => null);
    await flushMicrotasks();
    expect(container.textContent).toContain('No active season yet');
    expect(loadData).not.toHaveBeenCalled();
  });

  it("renders the real SupabaseLoaderError message for the `'error'` case, and never calls loadData", async () => {
    const loadData = vi.fn(() =>
      Promise.resolve(defaultLoadOutreachData('season-placeholder-current')),
    );
    renderAsUser(COACH_USER, { loadData }, async () => {
      throw { code: '42501', message: 'Permission denied.', cause: null };
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load the active season");
    expect(container.textContent).toContain('Permission denied.');
    expect(loadData).not.toHaveBeenCalled();
  });

  it("calls loadData with the real, resolved UUID-shaped active season id (never the old placeholder string) once useActiveSeason() is `'ready'`, with no explicit seasonId prop", async () => {
    const REAL_UUID_SEASON_ID = '3fa2c1c4-9b3a-4a0a-8b3e-5a2b7a6c9d10';
    let seasonIdSeenByLoadData: string | null = null;
    const loadData = vi.fn(async (id: string) => {
      seasonIdSeenByLoadData = id;
      return defaultLoadOutreachData(id);
    });
    renderAsUser(COACH_USER, { loadData }, async () => ({
      ...DEFAULT_READY_SEASON,
      id: REAL_UUID_SEASON_ID,
    }));
    await flushMicrotasks();

    expect(loadData).toHaveBeenCalledTimes(1);
    expect(loadData).toHaveBeenCalledWith(REAL_UUID_SEASON_ID);
    expect(seasonIdSeenByLoadData).toBe(REAL_UUID_SEASON_ID);
    // The old hardcoded placeholder must never be the id passed to loadData.
    expect(seasonIdSeenByLoadData).not.toBe('season-placeholder-current');
  });

  it("an explicit seasonId prop overrides useActiveSeason() outright, even when the hook is not `'ready'`, and loadData is called with the prop value", async () => {
    let seasonIdSeenByLoadData: string | null = null;
    const loadData = vi.fn(async (id: string) => {
      seasonIdSeenByLoadData = id;
      return defaultLoadOutreachData(id);
    });
    renderAsUser(
      COACH_USER,
      { loadData, seasonId: 'season-explicit-override' },
      // The hook itself never resolves `'ready'` here (stays `'none'`) --
      // the explicit prop must still win and render real data.
      async () => null,
    );
    await flushMicrotasks();

    expect(container.textContent).not.toContain('No active season yet');
    expect(loadData).toHaveBeenCalledWith('season-explicit-override');
    expect(seasonIdSeenByLoadData).toBe('season-explicit-override');
  });
});

// ---------------------------------------------------------------------------
// T101 (ED-1 Packet P10): real loader-level tests for
// `../../lib/supabase/loaders/outreach.ts`'s `makeLoadOutreachData`/
// `makeSaveOutreachEvent` -- same "inject a fake SupabaseClient chain"
// pattern `loaders/meetings.ts`'s own tests (`MeetingsList.test.tsx`)
// already established.
// ---------------------------------------------------------------------------

describe('loadOutreachData (T101 real load)', () => {
  it('filters events by season_id server-side, joins sessions/rsvps by id, and resolves a real per-student goal from students.goal_hours_override / seasons.default_goal_hours', async () => {
    const eventsEqSpy = vi.fn().mockResolvedValue({
      data: [
        {
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
          created_by: null,
        },
      ],
      error: null,
    });
    const sessionsInSpy = vi.fn().mockResolvedValue({
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
    // CHECKER FIX (rework of T121, MAJOR) -- the new, real, batched
    // `attendance` query this loader now issues alongside `rsvps`.
    const attendanceInSpy = vi.fn().mockResolvedValue({
      data: [{ session_id: 'session-1', student_id: 'student-1', status: 'present' }],
      error: null,
    });
    const studentsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        { id: 'student-1', display_name: 'Amara', team_id: 'team-ravens', goal_hours_override: 5 },
      ],
      error: null,
    });
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-1', default_goal_hours: 100 }, error: null });
    // T147 -- the new, real, batched `teams` query this loader now issues
    // alongside `students`/`seasons` (module doc on `makeLoadOutreachData`).
    const teamsOrderSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'b1c11111-1111-4111-8111-111111111111', name: 'Crimson Circuit', color: 'red' }],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: vi.fn(() => ({ eq: eventsEqSpy })) };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ in: sessionsInSpy })) };
      if (table === 'rsvps') return { select: vi.fn(() => ({ in: rsvpsInSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ in: attendanceInSpy })) };
      if (table === 'students') return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      if (table === 'teams') return { select: vi.fn(() => ({ order: teamsOrderSpy })) };
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: seasonMaybeSingleSpy })) })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadOutreachData(() => client);
    const result = await load('season-1');

    expect(eventsEqSpy).toHaveBeenCalledWith('season_id', 'season-1');
    expect(sessionsInSpy).toHaveBeenCalledWith('event_id', ['event-1']);
    expect(rsvpsInSpy).toHaveBeenCalledWith('session_id', ['session-1']);
    expect(teamsOrderSpy).toHaveBeenCalled();
    expect(result.teams).toEqual([
      { id: 'b1c11111-1111-4111-8111-111111111111', name: 'Crimson Circuit', color: 'red' },
    ]);
    // CHECKER FIX (rework of T121, MAJOR) -- ONE real, batched `attendance`
    // query, same `.in('session_id', [...])` shape as `rsvps` -- never a
    // per-event/per-session fan-out (this test only ever exercises ONE
    // `attendance` call for the whole season's session ids).
    expect(attendanceInSpy).toHaveBeenCalledTimes(1);
    expect(attendanceInSpy).toHaveBeenCalledWith('session_id', ['session-1']);
    expect(result.events).toHaveLength(1);
    expect(result.sessions).toHaveLength(1);
    expect(result.attendance).toEqual([
      { sessionId: 'session-1', studentId: 'student-1', status: 'present' },
    ]);
    // The student's own explicit override (5) wins over the season default
    // (100) -- both real columns, module doc #2 of the loader file.
    expect(result.goalConfig.individualGoalHoursByStudentId['student-1']).toBe(5);
  });

  // T147 (packet Part B: "Prove it, don't just assert it") -- a fake client
  // that records call ORDER, not just that each table was eventually
  // queried. `teams` depends on nothing (same as `students`/`seasons`), so
  // it must be issued in the SAME batch as those two, before the
  // session-dependent `rsvps`/`attendance` queries (which can only start
  // once `sessionRows` -- itself part of that same first batch -- has
  // resolved). A serial "teams after everything else" implementation would
  // still eventually call every table, so call-count assertions alone
  // (the test above) cannot distinguish parallel from serial; only order
  // can.
  it('issues the teams query in the SAME batch as students/seasons (zero-dependency), never serialized after the session-dependent batch', async () => {
    const callOrder: string[] = [];
    // One real event + one real session -- needed so `eventIds`/`sessionIds`
    // are both non-empty, which is what makes `event_sessions` (batch 1) and
    // `rsvps`/`attendance` (batch 2, session-dependent) actually get issued
    // at all; an empty result short-circuits those calls via `Promise.resolve([])`
    // instead (module doc on `makeLoadOutreachData`), which would make this
    // test's own ordering proof vacuous.
    const eventsEqSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'event-1',
          season_id: 'season-1',
          type: 'outreach',
          title: 'T',
          description: '',
          location_name: '',
          address: '',
          team_ids: null,
          counts_participation: false,
          counts_volunteer_hours: true,
          adult_volunteers_count: 0,
          adult_volunteer_hours: 0,
          created_by: null,
        },
      ],
      error: null,
    });
    const sessionsInSpy = vi.fn().mockResolvedValue({
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
    const attendanceInSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const studentsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const teamsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-1', default_goal_hours: 0 }, error: null });

    const fromSpy = vi.fn((table: string) => {
      callOrder.push(table);
      if (table === 'events') return { select: vi.fn(() => ({ eq: eventsEqSpy })) };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ in: sessionsInSpy })) };
      if (table === 'rsvps') return { select: vi.fn(() => ({ in: rsvpsInSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ in: attendanceInSpy })) };
      if (table === 'students') return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      if (table === 'teams') return { select: vi.fn(() => ({ order: teamsOrderSpy })) };
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: seasonMaybeSingleSpy })) })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    await makeLoadOutreachData(() => client)('season-1');

    // `from('teams')` must appear BEFORE `from('rsvps')`/`from('attendance')`
    // in call order -- those two are only ever reachable once the whole
    // first `Promise.all` batch (which `loadTeams()` is inside of) has
    // already resolved and `sessionIds` is known. `events` is issued first,
    // sequentially, ahead of the whole batch (module doc #1: it resolves
    // `eventIds`, which the FIRST batched `Promise.all` needs for
    // `loadSessions`).
    const teamsIndex = callOrder.indexOf('teams');
    const rsvpsIndex = callOrder.indexOf('rsvps');
    const attendanceIndex = callOrder.indexOf('attendance');
    expect(teamsIndex).toBeGreaterThanOrEqual(0);
    expect(rsvpsIndex).toBeGreaterThan(teamsIndex);
    expect(attendanceIndex).toBeGreaterThan(teamsIndex);
    // The real proof of "same batch, not serial": `students`/`seasons`
    // (the other two zero-dependency queries) are issued in the SAME
    // microtask turn as `teams` -- `Promise.all([a, b, c, d])` evaluates
    // its array synchronously, so all four calls land contiguously in
    // `callOrder`, immediately after `events`, with nothing
    // session-dependent interleaved before `rsvps`/`attendance`.
    expect(callOrder.slice(1, 5).sort()).toEqual(
      ['event_sessions', 'seasons', 'students', 'teams'].sort(),
    );
  });

  it('falls back to the season default_goal_hours when a student has no goal_hours_override', async () => {
    const nullEmpty = { data: [], error: null };
    const fromSpy = vi.fn((table: string) => {
      if (table === 'events')
        return { select: vi.fn(() => ({ eq: vi.fn().mockResolvedValue(nullEmpty) })) };
      if (table === 'students') {
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'student-1', display_name: 'Amara', team_id: 't', goal_hours_override: null },
              ],
              error: null,
            }),
          })),
        };
      }
      // T147 -- the new, real, batched `teams` query this loader now issues.
      if (table === 'teams') {
        return { select: vi.fn(() => ({ order: vi.fn().mockResolvedValue(nullEmpty) })) };
      }
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'season-1', default_goal_hours: 42 },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadOutreachData(() => client);
    const result = await load('season-1');
    expect(result.goalConfig.individualGoalHoursByStudentId['student-1']).toBe(42);
  });
});

describe('saveOutreachEvent (T101, Trap #5 real onSaveEvent default)', () => {
  it('CREATE: resolves the active season, then inserts one events row + one event_sessions row per session', async () => {
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-active-1' }, error: null });
    const eventSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'event-created-1' }, error: null });
    const eventInsertSpy = vi.fn(() => ({ select: vi.fn(() => ({ single: eventSingleSpy })) }));
    const sessionsInsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: seasonMaybeSingleSpy })) })),
        };
      }
      if (table === 'events') return { insert: eventInsertSpy };
      if (table === 'event_sessions') return { insert: sessionsInsertSpy };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const save = makeSaveOutreachEvent(() => client);
    await save({
      event: {
        title: 'Food Bank Sort',
        description: '',
        locationName: 'X',
        address: '',
        type: 'outreach',
        countsParticipation: false,
        countsVolunteerHours: true,
        teamIds: null,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
        shareToCalendarFeed: true,
      },
      sessions: [
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T14:00:00.000Z',
          endsAt: '2026-08-01T16:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
      ],
    });

    expect(eventInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        season_id: 'season-active-1',
        type: 'outreach',
        title: 'Food Bank Sort',
      }),
    );
    expect(sessionsInsertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ event_id: 'event-created-1', session_date: '2026-08-01' }),
    ]);
  });

  it('rejects with a real, disclosed error (never a fabricated season_id) when no season is active', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const save = makeSaveOutreachEvent(() => client);
    await expect(
      save({
        event: {
          title: 'X',
          description: '',
          locationName: '',
          address: '',
          type: 'outreach',
          countsParticipation: false,
          countsVolunteerHours: true,
          teamIds: null,
          adultVolunteersCount: 0,
          adultVolunteerHours: 0,
          shareToCalendarFeed: true,
        },
        sessions: [],
      }),
    ).rejects.toThrow(/no active season/i);
  });

  it('EDIT: updates the events row, updates sessions matching an existing session_date in place, and inserts brand-new dates -- never deletes', async () => {
    const eventUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const eventUpdateSpy = vi.fn(() => ({ eq: eventUpdateEqSpy }));
    const existingSessionsEqSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'session-existing-1', session_date: '2026-08-01' }],
      error: null,
    });
    const sessionUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const sessionUpdateSpy = vi.fn(() => ({ eq: sessionUpdateEqSpy }));
    const sessionsInsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    let sessionsSelectCall = 0;
    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { update: eventUpdateSpy };
      if (table === 'event_sessions') {
        sessionsSelectCall += 1;
        return {
          select: vi.fn(() => ({ eq: existingSessionsEqSpy })),
          update: sessionUpdateSpy,
          insert: sessionsInsertSpy,
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const save = makeSaveOutreachEvent(() => client);
    await save({
      event: {
        id: 'event-existing-1',
        title: 'Food Bank Sort (updated)',
        description: '',
        locationName: 'X',
        address: '',
        type: 'outreach',
        countsParticipation: false,
        countsVolunteerHours: true,
        teamIds: null,
        adultVolunteersCount: 0,
        adultVolunteerHours: 0,
        shareToCalendarFeed: true,
      },
      sessions: [
        // Matches the existing session_date -- updated in place (its real
        // id is preserved, never deleted/recreated).
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T15:00:00.000Z',
          endsAt: '2026-08-01T17:00:00.000Z',
          notes: '',
          peopleReached: 50,
        },
        // A brand-new date -- inserted.
        {
          sessionDate: '2026-08-08',
          startsAt: '2026-08-08T14:00:00.000Z',
          endsAt: '2026-08-08T16:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
      ],
    });

    expect(eventUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Food Bank Sort (updated)' }),
    );
    expect(eventUpdateEqSpy).toHaveBeenCalledWith('id', 'event-existing-1');
    expect(sessionUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ starts_at: '2026-08-01T15:00:00.000Z', people_reached: 50 }),
    );
    expect(sessionUpdateEqSpy).toHaveBeenCalledWith('id', 'session-existing-1');
    expect(sessionsInsertSpy).toHaveBeenCalledWith([
      expect.objectContaining({ event_id: 'event-existing-1', session_date: '2026-08-08' }),
    ]);
    // Never a delete call anywhere in this reconciliation (module doc #5's
    // own genuine FK-restrict finding).
    expect(sessionsSelectCall).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// T130 (UXC-13, CHECKER FIX post-review, MAJOR): 44px touch-target proof.
//
// `minHeight` is set via the documented `style` prop (module doc on
// `MIN_TOUCH_TARGET_STYLE`, `OutreachList.tsx`) -- a real inline `style`
// HTML attribute, which jsdom (unlike a StyleX-driven CSS class) reflects
// correctly without needing a real layout engine or a loaded stylesheet.
// ---------------------------------------------------------------------------

describe('<OutreachList /> coach view -- T130 44px touch targets (UXC-13, checker fix)', () => {
  it('the expander, Edit, and Cancel buttons all carry a real 44px minHeight via the documented `style` prop', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const expanderButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Show session details'),
    );
    const editButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Edit – '),
    );
    const cancelButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Cancel – '),
    );
    expect(expanderButtons.length).toBeGreaterThan(0);
    expect(editButtons.length).toBeGreaterThan(0);
    expect(cancelButtons.length).toBeGreaterThan(0);

    for (const btn of [...expanderButtons, ...editButtons, ...cancelButtons]) {
      expect(btn.style.minHeight).toBe('44px');
    }
  });
});

// ---------------------------------------------------------------------------
// T130 (UXC-01, CHECKER FIX post-review, MAJOR): coach section
// `aria-labelledby` parity with T129's own (already checker-verified) fix
// on the student side of this same file.
//
// `CoachOutreachSection`'s `Heading` carries a `useId`-generated id, and a
// plain `<div role="group" aria-labelledby={headingId}>` (NOT `Section`,
// which renders a bare, role-less `<div>` -- `aria-labelledby` on an
// implicit `role="generic"` element is name-prohibited under ARIA and is
// silently discarded by assistive technology even though the attribute is
// genuinely present in the DOM) wraps the `Table`/`EmptyState` ternary, so
// the query below includes `role="group"` -- a regression back to a
// role-less wrapper fails the lookup itself, not a later, weaker
// assertion. Mirrors `StudentOutreachSection`'s own identical fix exactly
// (T129, that describe block above, `resolveAriaLabelledbyTarget`).
// ---------------------------------------------------------------------------

describe('<OutreachList /> coach view -- T130 UXC-01 aria-labelledby parity with T129', () => {
  function resolveCoachAriaLabelledbyTarget(headingText: string): {
    headingId: string;
    resolvedText: string | null;
  } {
    const heading = Array.from(container.querySelectorAll('h2')).find(
      (h) => h.textContent === headingText,
    );
    expect(heading).toBeTruthy();
    const headingId = heading!.id;
    expect(headingId).toBeTruthy();
    const labelledEl = container.querySelector(`[role="group"][aria-labelledby="${headingId}"]`);
    expect(labelledEl).toBeTruthy();
    expect(labelledEl!.getAttribute('role')).toBe('group');
    const resolvedId = labelledEl!.getAttribute('aria-labelledby')!;
    const resolvedEl = document.getElementById(resolvedId);
    return { headingId, resolvedText: resolvedEl?.textContent ?? null };
  }

  it('populated branch: both "Upcoming" and "Past" resolve aria-labelledby back to their own Heading via a real role="group" wrapper, printed exactly once', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    for (const title of ['Upcoming', 'Past']) {
      const { resolvedText } = resolveCoachAriaLabelledbyTarget(title);
      expect(resolvedText).toBe(title);
      const leafMatches = Array.from(container.querySelectorAll('*')).filter(
        (el) => el.children.length === 0 && el.textContent === title,
      );
      expect(leafMatches.length).toBe(1);
    }
  });

  it('empty branch: "Upcoming" has no scheduled sessions -- its aria-labelledby still resolves to its Heading via role="group", even with no Table rendered ("Past" stays populated in the same render)', async () => {
    renderAsUser(COACH_USER, {
      loadData: async (seasonId: string) => {
        const base = await defaultLoadOutreachData(seasonId);
        return {
          ...base,
          sessions: base.sessions.map((session) =>
            session.status === 'scheduled' ? { ...session, status: 'completed' as const } : session,
          ),
        };
      },
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('No outreach events are currently scheduled.');

    for (const title of ['Upcoming', 'Past']) {
      const { resolvedText } = resolveCoachAriaLabelledbyTarget(title);
      expect(resolvedText).toBe(title);
    }
  });
});

// ---------------------------------------------------------------------------
// T130 (UXC-02/07): coach `Table` migration -- column-alignment proof.
//
// jsdom returns zeros for real layout geometry, and `<td>` never receives a
// width at all (widths are applied only to `<th>`, `BaseTable.tsx:405-407`,
// under `tableLayout: 'fixed'`, `BaseTable.tsx:54`) -- so this asserts the
// documented substitute proof instead (packet's own Required Output list):
//   (i)   each column's `<th>` carries the expected inline `width`/`minWidth`
//   (ii)  those `<th>` style strings are byte-identical between the
//         Upcoming and Past `<table>`s
//   (iii) `tableLayout: 'fixed'` -- proven at the SOURCE level, not via
//         jsdom `getComputedStyle` (confirmed empirically: jsdom does not
//         apply the installed package's compiled StyleX stylesheet, so
//         `getComputedStyle(table).tableLayout` reads back the CSS default
//         `'auto'` regardless of the real class applied -- the same
//         "jsdom returns zeros for geometry" limitation this task's own
//         packet names). The real mechanism (`BaseTable.tsx:49-55,368`):
//         the base `styles.table` StyleX rule sets `tableLayout: 'fixed'`
//         unconditionally; the ONLY override, `styles.tableAutoLayout`
//         ('auto'), is applied exclusively in "children mode"
//         (`styles: children ? [styles.table, styles.tableAutoLayout] :
//         [styles.table]`). `OutreachList.tsx`'s two `<Table data columns
//         .../>` call sites never pass `children` (data-driven mode only,
//         grep-provable), so the auto-layout override can never apply --
//         `tableLayout: 'fixed'` is therefore active by construction, not
//         by a runtime check this environment can observe.
//   (iv)  every body `<tr>` has the same `<td>` count in the same column
//         order
// ---------------------------------------------------------------------------

describe('<OutreachList /> coach view -- T130 Table column-alignment proof (UXC-02/07)', () => {
  it('Upcoming and Past tables render the same 6 columns with byte-identical <th> widths, and every body row has 6 <td>s in the same order', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const tables = Array.from(container.querySelectorAll('table'));
    // This page renders exactly 4 coach outreach events (5 fixtures exist;
    // `event-team-meeting` is excluded by NAV-07) -- 2 Upcoming, 2 Past --
    // so exactly one `<table>` per bucket.
    expect(tables.length).toBe(2);
    const [upcomingTable, pastTable] = tables;

    const upcomingThStyles = Array.from(upcomingTable.querySelectorAll('thead th')).map((th) =>
      th.getAttribute('style'),
    );
    const pastThStyles = Array.from(pastTable.querySelectorAll('thead th')).map((th) =>
      th.getAttribute('style'),
    );

    // (i) six columns, each carrying a real inline width/minWidth (the
    // expander/date/stat/action columns are `pixel()`; the title column is
    // `proportional(2)`, which resolves to a `%` width plus a `minWidth`
    // floor -- never a column with no width style at all).
    expect(upcomingThStyles.length).toBe(6);
    upcomingThStyles.forEach((style) => {
      expect(style).toMatch(/width:/);
      expect(style).toMatch(/min-width:/);
    });

    // (ii) byte-identical between Upcoming and Past -- both call the SAME
    // `buildCoachOutreachColumns` factory with the same `pixel()`/
    // `proportional()` values (only header/cell TEXT differs by bucket,
    // never a width).
    expect(pastThStyles).toEqual(upcomingThStyles);

    // (iv) every body `<tr>` in both tables has the same <td> count (6, one
    // per column) in the same column order -- including the collapsed
    // (non-expanded) event rows this render already contains. `kind:
    // 'sessionDetail'` child rows (only reachable once expanded, covered by
    // the dedicated expansion test below) also carry all 6 `<td>`s, several
    // deliberately empty (`null`-rendered) -- proven separately below.
    for (const table of tables) {
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      expect(bodyRows.length).toBeGreaterThan(0);
      bodyRows.forEach((row) => {
        expect(row.querySelectorAll('td').length).toBe(6);
      });
    }
  });

  it('expanding an event row splices session-detail rows beneath it, each still carrying all 6 <td>s (5 empty, 1 with the session content) -- no colSpan, no lost column alignment', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const upcomingTable = container.querySelectorAll('table')[0];
    const expandButton = Array.from(upcomingTable.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Show session details'),
    );
    expect(expandButton).toBeTruthy();
    const rowCountBefore = upcomingTable.querySelectorAll('tbody tr').length;

    act(() => {
      expandButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const rowCountAfter = upcomingTable.querySelectorAll('tbody tr').length;
    expect(rowCountAfter).toBeGreaterThan(rowCountBefore);

    Array.from(upcomingTable.querySelectorAll('tbody tr')).forEach((row) => {
      expect(row.querySelectorAll('td').length).toBe(6);
    });

    // The now-"Hide" button is a real ARIA disclosure control referencing
    // real ids of the rows it just revealed.
    const hideButton = Array.from(upcomingTable.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Hide session details'),
    );
    expect(hideButton).toBeTruthy();
    expect(hideButton?.getAttribute('aria-expanded')).toBe('true');
    const controlsIds = hideButton?.getAttribute('aria-controls')?.split(' ') ?? [];
    expect(controlsIds.length).toBeGreaterThan(0);
    controlsIds.forEach((id) => {
      expect(document.getElementById(id)).not.toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// T132: two regression tests T131 could not add under its own "exactly one
// assertion changes" constraint -- the coach title link's accessible name
// (no `aria-label` override) and the actions column's real (post-T131)
// `pixel(128)` width. Both are proven to genuinely discriminate below by
// running them against the real pre-T131 file (`git show
// c8275c7:src/pages/outreach/OutreachList.tsx`), where the coach title was
// plain text (no link at all) and the actions column was `pixel(420)` --
// see this task's own worker output for that run's output.
// ---------------------------------------------------------------------------

describe('<OutreachList /> coach view -- T132 regression: coach title link accessible name', () => {
  it('the coach event title `<a>` carries no `aria-label` -- its accessible name is the title text itself', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const foodBankLink = Array.from(container.querySelectorAll('a')).find(
      (a) => a.getAttribute('href') === '/outreach/event-food-bank-sort',
    );
    expect(foodBankLink).toBeTruthy();
    expect(foodBankLink!.hasAttribute('aria-label')).toBe(false);
    expect(foodBankLink!.textContent).toBe('Community Food Bank Sort');
  });
});

describe('<OutreachList /> coach view -- T132 regression: actions column width', () => {
  it('the actions column (last <th>, header: "") carries the real post-T131 pixel(128) width', async () => {
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const tables = Array.from(container.querySelectorAll('table'));
    expect(tables.length).toBe(2);
    tables.forEach((table) => {
      const ths = Array.from(table.querySelectorAll('thead th'));
      expect(ths.length).toBe(6);
      // `buildCoachOutreachColumns` is not exported (module doc above), and
      // the actions column shares `header: ''` with the expander column, so
      // it is located POSITIONALLY -- it is the last of the 6 columns
      // (`key: 'actions'` is the final entry in the array
      // `buildCoachOutreachColumns` returns, verified by reading the
      // component file directly).
      const actionsTh = ths[ths.length - 1];
      // `columnUtils.ts:106` writes `style.width = \`${value}px\`` inline,
      // which jsdom can read even though it can't compute real layout.
      expect(actionsTh.getAttribute('style')).toMatch(/width:\s*128px/);
    });
  });
});

// ---------------------------------------------------------------------------
// T130 (UXC-13): responsive -- real `matchMedia` subscription, same
// `vi.stubGlobal('matchMedia', ...)` override idiom `CheckinResult.test.tsx`
// established for its own real-subscription hook.
// ---------------------------------------------------------------------------

describe('<OutreachList /> coach view -- T130 responsive (UXC-13)', () => {
  function stubMatchMedia(matches: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  }

  it('below 768px, every coach table collapses to a single stacked column (no fixed-width column set that could force horizontal scroll at 375px)', async () => {
    stubMatchMedia(true);
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const tables = Array.from(container.querySelectorAll('table'));
    expect(tables.length).toBe(2);
    tables.forEach((table) => {
      const ths = Array.from(table.querySelectorAll('thead th'));
      expect(ths.length).toBe(1);
      expect(ths[0].getAttribute('style')).toMatch(/width: 100%/);
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      bodyRows.forEach((row) => {
        expect(row.querySelectorAll('td').length).toBe(1);
      });
    });
    // The row content itself is still fully present -- collapsing columns
    // never drops data, only re-flows it into one stacked cell per row.
    expect(container.textContent).toContain('Community Food Bank Sort');
    expect(container.textContent).toContain('Planned3h');
  });

  it('at/above 768px (the default, unstubbed jsdom matchMedia -- see module doc), the desktop 6-column set renders', async () => {
    stubMatchMedia(false);
    renderAsUser(COACH_USER, { loadData: defaultLoadOutreachData });
    await flushMicrotasks();

    const tables = Array.from(container.querySelectorAll('table'));
    tables.forEach((table) => {
      expect(table.querySelectorAll('thead th').length).toBe(6);
    });
  });

  // T330 (C6/C7, narrow arm) -- NEW. The narrow stacked-card column
  // (`isNarrow` branch, module doc on `buildCoachOutreachColumns`) is a
  // SEPARATE render path from the desktop `hours`/`count` columns -- no
  // baseline test exercised em-dash rendering here at all (this describe
  // block predates T330), so without this test the narrow em-dash mutation
  // has nothing to redden and a coach-on-a-phone regression (still seeing
  // "0h"/"0 students" on a dateless row) would stay invisible. Uses the
  // shared `orphanPlusDatedLoadData` fixture (module doc above it) so the
  // dated row's own real "Planned2h"/"Expected1 students" stays reachable,
  // keeping the "Planned0h"/"Expected0 students" negative assertions below
  // meaningful (this file's own §8 fixture warning).
  it('below 768px, a dateless row renders em-dash hours/count on the narrow stacked-card column, not "0h"/"0 students"', async () => {
    stubMatchMedia(true);
    renderAsUser(COACH_USER, { loadData: orphanPlusDatedLoadData });
    await flushMicrotasks();

    // Regression guard -- the dated row is unaffected on the narrow branch.
    expect(container.textContent).toContain('Scheduled Food Drive');
    expect(container.textContent).toContain('Planned2h');
    expect(container.textContent).toContain('Expected1 students');

    // The dateless row: em-dashed, never a fabricated "0h"/"0 students".
    expect(container.textContent).toContain('Orphaned Coat Drive');
    expect(container.textContent).toContain('Planned—');
    expect(container.textContent).toContain('Expected—');
    expect(container.textContent).not.toContain('Planned0h');
    expect(container.textContent).not.toContain('Expected0 students');
  });
});

// ---------------------------------------------------------------------------
// T330 -- a dateless (zero-session) event is visible and fixable, on both
// views. Fixtures (`orphanOnlySeasonLoadData`/`orphanPlusDatedLoadData`)
// defined above, module doc there.
// ---------------------------------------------------------------------------

describe('<OutreachList /> T330: dateless (zero-session) events are visible and fixable', () => {
  // C11 -- the criterion that makes this task fix its own headline
  // scenario: without the `hasAnyOutreach` change (module doc on
  // `CoachOutreachView`/`StudentParentOutreachView`), a season whose ONLY
  // event has zero sessions still shows the EmptyState forever, even though
  // every other criterion in this describe block passes. Paired assertion
  // (packet §8): the row rendering AND the EmptyState NOT rendering, in the
  // SAME test.
  it('C11 (coach view): an orphan-only season (real events, zero sessions) renders the row, not the EmptyState', async () => {
    renderAsUser(COACH_USER, { loadData: orphanOnlySeasonLoadData });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('No outreach events yet');
    expect(container.textContent).toContain('Orphaned Coat Drive');
    expect(container.textContent).toContain('No sessions scheduled yet.'); // C9 DOM proof
    expect(container.textContent).toContain('Needs dates');
  });

  it('C11 (student/parent view): an orphan-only season renders the row, not the EmptyState', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      loadData: orphanOnlySeasonLoadData,
      viewerStudentId: 'student-1',
    });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('No upcoming outreach yet.');
    expect(container.textContent).toContain('Orphaned Coat Drive');
    expect(container.textContent).toContain('No sessions scheduled yet.'); // C9 DOM proof
    expect(container.textContent).toContain('Needs dates');
  });

  // C6/C7 (desktop arm) + C8 + C10. Paired assertions (packet §8): the
  // dated row's real values prove C10 (regression guard -- nothing about
  // the dated row changed), and the dateless row's dash + badge prove
  // C6/C7/C8 together, with a negative assertion that rules out the
  // "0h"/"0 students" fabrication a reverted dash would produce.
  it('C6/C7/C8/C10 (coach view, desktop): a dateless row renders em-dash hours/count + "Needs dates" badge; a dated row is completely unchanged', async () => {
    renderAsUser(COACH_USER, { loadData: orphanPlusDatedLoadData });
    await flushMicrotasks();

    // C10 regression guard: the DATED row's date/hours/count are real, and
    // it carries no badge.
    expect(container.textContent).toContain('Sep 1');
    expect(container.textContent).toContain('Planned2h');
    expect(container.textContent).toContain('Expected1 students');

    // C6/C7/C8/C9: the DATELESS row -- visible, honest date-cell copy,
    // badged, and its hours/count cells are a real em dash, never a
    // fabricated "0h"/"0 students".
    expect(container.textContent).toContain('Orphaned Coat Drive');
    expect(container.textContent).toContain('No sessions scheduled yet.');
    expect(container.textContent).toContain('Planned—');
    expect(container.textContent).toContain('Expected—');
    expect(container.textContent).not.toContain('Planned0h');
    expect(container.textContent).not.toContain('Expected0 students');

    // C8's absence arm must be paired with proof the row itself rendered
    // (packet §8) -- and proof the badge appears EXACTLY once (on the
    // dateless row only, never leaking onto the dated row).
    const needsDatesMatches = container.textContent?.match(/Needs dates/g) ?? [];
    expect(needsDatesMatches.length).toBe(1);
  });

  // C12 -- a real criterion, not a smoke test (packet §8): the inline
  // "Edit" action must open the dialog on a dateless row without crashing,
  // reusing the shipped T121 Edit-button idiom.
  it('C12: the inline "Edit" action opens the dialog on a dateless row, pre-filled, without crashing', async () => {
    renderAsUser(COACH_USER, { loadData: orphanPlusDatedLoadData });
    await flushMicrotasks();

    const editButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.getAttribute('aria-label') === 'Edit – Orphaned Coat Drive',
    );
    expect(editButton).toBeTruthy();
    expect(() => {
      act(() => {
        editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      });
    }).not.toThrow();

    // Edit mode, real prefill, from an event with zero sessions
    // (`buildInitialOutreachEventFromRow` is total over `sessions: []`).
    expect(document.body.textContent).toContain('Save changes');
    const labels = Array.from(document.querySelectorAll('label'));
    const titleLabel = labels.find((el) => el.textContent?.trim().startsWith('Title'));
    const titleInput = document.getElementById(
      titleLabel?.getAttribute('for') ?? '',
    ) as HTMLInputElement;
    expect(titleInput.value).toBe('Orphaned Coat Drive');
  });
});

// ---------------------------------------------------------------------------
// T130 -- `buildCoachOutreachTableRows` pure-function coverage (this file's
// own "pure functions exported, directly tested" convention).
// ---------------------------------------------------------------------------

describe('buildCoachOutreachTableRows (T130)', () => {
  const event: OutreachEventRow = {
    id: 'e1',
    seasonId: 's1',
    type: 'outreach',
    title: 'Test Event',
    description: '',
    locationName: 'X',
    address: '',
    teamIds: null,
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
  };
  const sessionA: OutreachSessionRow = {
    id: 'sA',
    eventId: 'e1',
    sessionDate: '2026-08-01',
    startsAt: '2026-08-01T14:00:00.000Z',
    endsAt: '2026-08-01T16:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
  };
  const sessionB: OutreachSessionRow = {
    id: 'sB',
    eventId: 'e1',
    sessionDate: '2026-08-02',
    startsAt: '2026-08-02T14:00:00.000Z',
    endsAt: '2026-08-02T16:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
  };
  const enrichedEvents = [{ event, sessions: [sessionA, sessionB] }];

  it('collapsed (no expanded ids): one row per event, kind "event"', () => {
    const rows = buildCoachOutreachTableRows(enrichedEvents, 'upcoming', [], [], [], new Set());
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('event');
  });

  it('expanded: the event row is immediately followed by one "sessionDetail" row per session, same order', () => {
    const rows = buildCoachOutreachTableRows(
      enrichedEvents,
      'upcoming',
      [],
      [],
      [],
      new Set(['e1']),
    );
    expect(rows.map((r) => r.kind)).toEqual(['event', 'sessionDetail', 'sessionDetail']);
    expect(rows.map((r) => r.id)).toEqual(['e1', 'e1::session::sA', 'e1::session::sB']);
  });
});
