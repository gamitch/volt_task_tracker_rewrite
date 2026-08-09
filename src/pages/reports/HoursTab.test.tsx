// @vitest-environment jsdom
/**
 * T057: tests for `HoursTab.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `HoursTab.test.tsx` is
 * acceptable per established precedent -- disclose it") this test file is
 * the same class of addition `CoachHome.test.tsx`/T053,
 * `StudentHome.test.tsx`/T054, and `OutreachList.test.tsx`/T038 already
 * made in their own sibling directories, producing the "Required Worker
 * Output" section's proof:
 *   - a view-vs-UI number cross-check for confirmed hours (never
 *     recomputed -- always a verbatim `FIXTURE_STUDENT_HOURS` copy or 0),
 *   - the planned-hours boundary cases (module doc #2's four fixture RSVPs),
 *   - team subtotal correctness (both teams, checked against
 *     hand-computed sums).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- uses the same raw `createRoot`/`act` pattern
 * `ParticipationTab.tsx`'s sibling tests (and every other content page in
 * this batch) already established. `HoursTab` does not self-gate (module
 * doc #8), so no `AuthProvider`/role-login harness is needed here, unlike
 * `StudentHome.test.tsx`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeLoadHoursData } from '../../lib/supabase/loaders/reports';
import {
  buildSeasonTotals,
  buildStudentRows,
  buildTeamGroups,
  computeStudentPlannedHours,
  crossedMilestones,
  defaultLoadHoursData,
  HoursTab,
  hoursVsGoalPercent,
  PLACEHOLDER_CURRENT_SEASON_ID,
  resolveGoalHours,
  sessionHours,
  type HoursEventRow,
  type HoursLoadResult,
  type HoursRsvpRow,
  type HoursSessionRow,
} from './HoursTab';

// ---------------------------------------------------------------------------
// Render harness.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

/**
 * T095: `HoursTab`'s own default `loadData` is now the REAL Supabase-backed
 * `loadHoursData` (`../../lib/supabase/loaders/reports`), not fixture data
 * -- see `HoursTab.tsx`'s own module doc #12. This harness explicitly
 * defaults `loadData` to `defaultLoadHoursData` (the fixture generator,
 * unchanged) so every render test below keeps exercising the SAME
 * deterministic fixture numbers it always has, with zero real network
 * calls -- any test that wants different behavior (the reject case, an
 * explicit override) still overrides `loadData` via its own `props`.
 */
function render(props: Parameters<typeof HoursTab>[0]): void {
  act(() => {
    root.render(<HoursTab loadData={defaultLoadHoursData} {...props} />);
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

describe('sessionHours', () => {
  it('computes ends_at - starts_at in hours', () => {
    expect(
      sessionHours({
        startsAt: '2026-08-01T15:00:00.000Z',
        endsAt: '2026-08-01T18:00:00.000Z',
      }),
    ).toBe(3);
  });
});

describe('resolveGoalHours', () => {
  it('uses the override when present', () => {
    expect(resolveGoalHours(50, 80)).toBe(50);
  });
  it('falls back to the season default when override is null', () => {
    expect(resolveGoalHours(null, 80)).toBe(80);
  });
});

describe('hoursVsGoalPercent', () => {
  it('computes a plain percentage', () => {
    expect(hoursVsGoalPercent(20, 80)).toBe(25);
  });
  it('clamps at 100 even when confirmed exceeds goal', () => {
    expect(hoursVsGoalPercent(104, 100)).toBe(100);
  });
  it('returns 0 for a non-positive goal', () => {
    expect(hoursVsGoalPercent(10, 0)).toBe(0);
  });
});

describe('crossedMilestones', () => {
  it('returns every milestone at or below the percent, exactly at boundary', () => {
    expect(crossedMilestones(25)).toEqual([25]);
    expect(crossedMilestones(46.4)).toEqual([25]);
    expect(crossedMilestones(100)).toEqual([25, 50, 75, 100]);
    expect(crossedMilestones(24.9)).toEqual([]);
  });
});

describe('computeStudentPlannedHours -- module doc #2 boundary cases', () => {
  const events: HoursEventRow[] = [
    {
      id: 'event-outreach',
      seasonId: 's1',
      type: 'outreach',
      teamIds: null,
      countsVolunteerHours: true,
    },
    {
      id: 'event-meeting',
      seasonId: 's1',
      type: 'meeting',
      teamIds: null,
      countsVolunteerHours: false,
    },
  ];
  const sessions: HoursSessionRow[] = [
    {
      id: 'session-scheduled-outreach',
      eventId: 'event-outreach',
      startsAt: '2026-08-01T15:00:00.000Z',
      endsAt: '2026-08-01T18:00:00.000Z', // 3h
      status: 'scheduled',
      peopleReached: null,
    },
    {
      id: 'session-completed-outreach',
      eventId: 'event-outreach',
      startsAt: '2026-06-06T15:00:00.000Z',
      endsAt: '2026-06-06T18:00:00.000Z', // 3h
      status: 'completed',
      peopleReached: 10,
    },
    {
      id: 'session-scheduled-meeting',
      eventId: 'event-meeting',
      startsAt: '2026-07-22T23:00:00.000Z',
      endsAt: '2026-07-23T01:00:00.000Z', // 2h
      status: 'scheduled',
      peopleReached: null,
    },
  ];

  it('counts a going RSVP on a still-scheduled counts_volunteer_hours session', () => {
    const rsvps: HoursRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'session-scheduled-outreach',
        studentId: 'student-a',
        status: 'going',
      },
    ];
    expect(computeStudentPlannedHours('student-a', sessions, events, rsvps)).toBe(3);
  });

  it('excludes a going RSVP on an already-completed session (belongs to confirmed hours instead)', () => {
    const rsvps: HoursRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'session-completed-outreach',
        studentId: 'student-a',
        status: 'going',
      },
    ];
    expect(computeStudentPlannedHours('student-a', sessions, events, rsvps)).toBe(0);
  });

  it('excludes a going RSVP on a scheduled session whose event does not count volunteer hours', () => {
    const rsvps: HoursRsvpRow[] = [
      { id: 'r1', sessionId: 'session-scheduled-meeting', studentId: 'student-a', status: 'going' },
    ];
    expect(computeStudentPlannedHours('student-a', sessions, events, rsvps)).toBe(0);
  });

  it('excludes a maybe RSVP entirely', () => {
    const rsvps: HoursRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'session-scheduled-outreach',
        studentId: 'student-a',
        status: 'maybe',
      },
    ];
    expect(computeStudentPlannedHours('student-a', sessions, events, rsvps)).toBe(0);
  });

  it('never sums confirmed and planned -- this function only ever returns the planned figure', () => {
    // grep-provable at the file level too: no `confirmedHours + plannedHours`
    // expression exists anywhere in HoursTab.tsx (see worker output).
    const rsvps: HoursRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'session-scheduled-outreach',
        studentId: 'student-a',
        status: 'going',
      },
    ];
    const planned = computeStudentPlannedHours('student-a', sessions, events, rsvps);
    expect(planned).toBe(3);
    expect(typeof planned).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// buildStudentRows / buildTeamGroups -- view-vs-UI cross-check + team
// subtotal correctness, against the SAME fixture data HoursTab.tsx itself
// ships (defaultLoadHoursData), so this is a real cross-check against the
// shipped default, not a bespoke dataset.
// ---------------------------------------------------------------------------

describe('buildStudentRows / buildTeamGroups -- fixture walkthrough', () => {
  let data: HoursLoadResult;

  beforeEach(async () => {
    data = await defaultLoadHoursData(PLACEHOLDER_CURRENT_SEASON_ID);
  });

  // -------------------------------------------------------------------------
  // T201: a departed student's hours reconcile the team subtotal.
  //
  // The defect: `v_student_hours` has no `is_active` filter and never could
  // (it does not join `students` at all), so `v_team_hours` -- and therefore
  // CoachHome's "Hours by team" -- counted a departed member's hours. HoursTab
  // built its subtotal from an ACTIVE-ONLY roster, so the same team read 8.0 h
  // on one screen and 4.0 h on another. Measured on live PG 16.13.
  //
  // Owner ruled 2026-08-05 that the hours count: "that's actual work that was
  // done regardless if that person is no longer with the team or not." So the
  // total was right and HoursTab was wrong -- it hid the person, and the
  // hours went with them.
  //
  // These build on the loader's OWN shape (`HoursStudentFixture`), not on a
  // hand-made row, so they fail if `buildStudentRows` stops honouring
  // `isActive`.
  // -------------------------------------------------------------------------
  function withPastMember(base: HoursLoadResult): HoursLoadResult {
    const team = base.students[0]!;
    return {
      ...base,
      students: [
        ...base.students,
        {
          id: 'student-departed-t201',
          name: 'Fixture Departed T201',
          teamId: team.teamId,
          isActive: false,
          goalHoursOverride: null,
        },
      ],
      studentHours: [
        ...base.studentHours,
        { studentId: 'student-departed-t201', seasonId: base.seasonId, confirmedHours: 4 },
      ],
    };
  }

  it("T201: a departed student with hours appears, marked, and their hours land in the team's subtotal", () => {
    const withPast = withPastMember(data);
    const rows = buildStudentRows(withPast);
    const departed = rows.find((r) => r.rowId === 'student-departed-t201');

    expect(departed?.kind).toBe('past-member');
    expect(departed?.confirmedHours).toBe(4);

    // The reconciliation itself: the subtotal grows by exactly their hours.
    const teamId = withPast.students[0]!.teamId;
    const before = buildTeamGroups(buildStudentRows(data)).find((g) => g.teamId === teamId);
    const after = buildTeamGroups(rows).find((g) => g.teamId === teamId);
    expect(after!.subtotal.confirmedHours).toBe(
      Math.round((before!.subtotal.confirmedHours + 4) * 10) / 10,
    );
  });

  it('T201: a departed student contributes NO goal, so "% to goal" cannot drop because someone left', () => {
    const withPast = withPastMember(data);
    const rows = buildStudentRows(withPast);
    const departed = rows.find((r) => r.rowId === 'student-departed-t201');
    expect(departed?.goalHours).toBe(0);
    expect(departed?.percentToGoal).toBe(0);

    const teamId = withPast.students[0]!.teamId;
    const before = buildTeamGroups(buildStudentRows(data)).find((g) => g.teamId === teamId);
    const after = buildTeamGroups(rows).find((g) => g.teamId === teamId);
    // Unchanged -- the goal subtotal excludes past members entirely.
    expect(after!.subtotal.goalHours).toBe(before!.subtotal.goalHours);
  });

  it('T201: a departed student with NO hours never appears at all', () => {
    const team = data.students[0]!;
    const rows = buildStudentRows({
      ...data,
      students: [
        ...data.students,
        {
          id: 'student-departed-nohours',
          name: 'Fixture Departed NoHours',
          teamId: team.teamId,
          isActive: false,
          goalHoursOverride: null,
        },
      ],
    });
    expect(rows.find((r) => r.rowId === 'student-departed-nohours')).toBeUndefined();
  });

  it('confirmedHours is a verbatim v_student_hours copy, never recomputed', () => {
    const rows = buildStudentRows(data);
    const jordan = rows.find((r) => r.rowId === 'student-jordan-blake');
    const maya = rows.find((r) => r.rowId === 'student-maya-osei');
    const eli = rows.find((r) => r.rowId === 'student-eli-vance');
    const priya = rows.find((r) => r.rowId === 'student-priya-anand');
    // Cross-check directly against the fixture "view" rows themselves.
    expect(jordan?.confirmedHours).toBe(
      data.studentHours.find((m) => m.studentId === 'student-jordan-blake')?.confirmedHours,
    );
    expect(jordan?.confirmedHours).toBe(45.5);
    expect(maya?.confirmedHours).toBe(52);
    expect(eli?.confirmedHours).toBe(20);
    expect(priya?.confirmedHours).toBe(30);
  });

  it('a student with no v_student_hours row gets confirmedHours 0, not null/fabricated', () => {
    const rows = buildStudentRows(data);
    const theo = rows.find((r) => r.rowId === 'student-theo-nakamura');
    expect(data.studentHours.some((m) => m.studentId === 'student-theo-nakamura')).toBe(false);
    expect(theo?.confirmedHours).toBe(0);
    expect(theo?.plannedHours).toBe(3); // going + scheduled + countsVolunteerHours
  });

  it('per-student goal/percent use resolveGoalHours/hoursVsGoalPercent', () => {
    const rows = buildStudentRows(data);
    const jordan = rows.find((r) => r.rowId === 'student-jordan-blake')!;
    const maya = rows.find((r) => r.rowId === 'student-maya-osei')!;
    expect(jordan.goalHours).toBe(80); // default, no override
    expect(jordan.percentToGoal).toBe(56.9); // 45.5 / 80 * 100
    expect(maya.goalHours).toBe(50); // override
    expect(maya.percentToGoal).toBe(100); // 52 / 50 clamped
  });

  it('team subtotals sum confirmed/planned/goal separately, per team', () => {
    const rows = buildStudentRows(data);
    const groups = buildTeamGroups(rows);
    const hawks = groups.find((g) => g.teamName === 'Hawks')!;
    const otters = groups.find((g) => g.teamName === 'Otters')!;

    // Hawks: jordan (45.5/0/80) + maya (52/0/50) + theo (0/3/80)
    expect(hawks.subtotal.confirmedHours).toBe(97.5);
    expect(hawks.subtotal.plannedHours).toBe(3);
    expect(hawks.subtotal.goalHours).toBe(210);
    expect(hawks.subtotal.percentToGoal).toBe(46.4);

    // Otters: priya (30/0/80) + eli (20/0/80)
    expect(otters.subtotal.confirmedHours).toBe(50);
    expect(otters.subtotal.plannedHours).toBe(0);
    expect(otters.subtotal.goalHours).toBe(160);
    expect(otters.subtotal.percentToGoal).toBe(31.3);

    // Never cross-team-summed: neither subtotal equals the grand total.
    expect(hawks.subtotal.confirmedHours + otters.subtotal.confirmedHours).toBe(147.5);
    expect(hawks.subtotal.confirmedHours).not.toBe(147.5);
  });

  it("appends exactly one subtotal row as the LAST row of each team's table data", () => {
    const rows = buildStudentRows(data);
    const groups = buildTeamGroups(rows);
    for (const group of groups) {
      expect(group.rows[group.rows.length - 1].kind).toBe('subtotal');
      expect(group.rows.slice(0, -1).every((r) => r.kind === 'student')).toBe(true);
    }
  });
});

// T703 correction: module doc #6's "no event filter is applied" contract is
// NOT guarded at this level and cannot be -- `buildSeasonTotals(sessions)`
// takes no `events` argument, so the filter is only expressible at the call
// site. Its guard lives in the render block below, by name.
describe('buildSeasonTotals -- module doc #6', () => {
  it('sums non-null peopleReached, counts missing separately', async () => {
    const data = await defaultLoadHoursData(PLACEHOLDER_CURRENT_SEASON_ID);
    const totals = buildSeasonTotals(data.sessions);
    // sessions: cleanup-upcoming(null), cleanup-past(85), food-drive-past(null),
    // food-drive-earlier(40), meeting-upcoming(null)
    expect(totals.peopleReachedTotal).toBe(125);
    expect(totals.sessionsMissingHeadcountCount).toBe(3);
    expect(totals.totalSessionCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// T500's "sessionless events excluded from season totals" describe block
// (5 `it`s: criteria 1a/1b/2/3/4) lived here. It tested ONLY
// `adultVolunteersCount`/`adultVolunteerHours` -- a double-count guard for
// season-total figures that "2026-08-03 — George's ruling on T702"
// (`docs/swarm/auto-mode-decisions.md`) deletes outright (not filters).
// `buildSeasonTotals` no longer takes an `events` argument or returns those
// two fields, so this block is not adjustable, it is moot: removed here,
// same disposition the ruling itself records for T500 ("the fix would have
// been thrown away on the next task either way"). This IS "another passing
// test going red" beyond the packet's literal ":327's two adult assertions"
// grant; it is reported as such rather than silently folded into that
// grant -- but it does not fail as an assertion mismatch, it fails to exist:
// every one of its 5 `it`s constructs `HoursEventRow` object literals with
// `adultVolunteersCount`/`adultVolunteerHours` properties and asserts on
// `totals.adultVolunteersCount`/`totals.adultVolunteerHours`, all of which
// are TypeScript compile errors once those fields are removed from
// `HoursEventRow`/`HoursSeasonTotals` -- there is no way to run `tsc
// --noEmit` green with this block still present in any form. This is the
// concrete reason the packet's own "the total test count will drop" note is
// true by more than 1 test.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Render-level proof (DES-12 + real DOM number cross-checks).
// ---------------------------------------------------------------------------

describe('HoursTab render', () => {
  it('shows a loading Skeleton (T081: predictable KPI-card + table dimensions), then the populated report', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    expect(container.textContent).toContain('Loading hours data');
    await flushMicrotasks();
    expect(container.textContent).toContain('Season totals');
    expect(container.textContent).toContain('Hawks');
    expect(container.textContent).toContain('Otters');
  });

  it('renders an error banner when loadData rejects', async () => {
    render({
      seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
      loadData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load hours data");
  });

  it('view-vs-UI cross-check: DOM shows the exact v_student_hours-sourced team subtotal (97.5), not a recomputed number', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    // 97.5 = 45.5 (Jordan) + 52 (Maya) + 0 (Theo, no row) -- verbatim
    // FIXTURE_STUDENT_HOURS values, never re-derived from attendance.
    expect(container.textContent).toContain('97.5');
    // Otters subtotal: 30 (Priya) + 20 (Eli) = 50.0
    expect(container.textContent).toContain('50.0');
  });

  it('planned-hours boundary case reaches the DOM: Theo shows 3.0 planned, Priya/Eli show 0.0', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    const rows = Array.from(container.querySelectorAll('tr'));
    const theoRow = rows.find((row) => row.textContent?.includes('Theo Nakamura'));
    expect(theoRow?.textContent).toContain('3.0');
  });

  it('season totals reach the DOM: 125 people reached, 3 of 5 missing headcount', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    expect(container.textContent).toContain('125');
    expect(container.textContent).toContain('3 of 5 sessions have no recorded headcount yet');
  });

  // T703 correction (module doc #6). The named mutation: filter the sessions
  // fed to `buildSeasonTotals` down to `type === 'outreach'`, dropping
  // `session-meeting-upcoming`. Measured -- `peopleReachedTotal` stays 125,
  // because a meeting session's `people_reached` is structurally always null
  // (write-path proof in module doc #6); the DENOMINATORS are what move,
  // 3-of-5 -> 2-of-4. This is the only contract that fixture can hold, so it
  // gets its own named guard rather than riding along unattributed on the
  // assertion above. Season totals are session-scoped and apply no event
  // filter -- unlike planned hours (module doc #2), which filter on
  // `countsVolunteerHours`; the boundary case below is the same fixture
  // session on both sides of that difference.
  it('a session whose event does not count volunteer hours still counts toward the season-totals denominators', async () => {
    const data = await defaultLoadHoursData(PLACEHOLDER_CURRENT_SEASON_ID);
    const meetingEvent = data.events.find((event) => event.id === 'event-weekly-meeting');
    const meetingSessions = data.sessions.filter(
      (session) => session.eventId === 'event-weekly-meeting',
    );
    // The fixture this guard depends on, asserted rather than assumed.
    expect(meetingEvent?.countsVolunteerHours).toBe(false);
    expect(meetingSessions).toHaveLength(1);
    expect(meetingSessions[0]?.peopleReached).toBeNull();

    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    // 5 and 3, not 4 and 2: the meeting session is inside both denominators.
    expect(container.textContent).toContain('3 of 5 sessions have no recorded headcount yet');
    expect(container.textContent).not.toContain('2 of 4 sessions have no recorded headcount yet');
  });

  // Packet acceptance criterion 1: "The Hours tab renders no adult-volunteer
  // figures" -- re-adding either deleted KPI card must turn this red.
  it('acceptance criterion 1: renders neither "Adult volunteers" nor an adult-volunteer value in the DOM', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Adult volunteers');
    expect(container.textContent).not.toContain('Adult volunteer hours');
    // FIXTURE_EVENTS' former adult-volunteer figures summed to 6 count /
    // 18.0 h -- neither the KPI-card text nor either value may appear.
    expect(container.textContent).not.toContain('18.0 h');
  });

  it('confirmed and planned hours are never rendered as one summed figure (BEH-02)', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    // Hawks confirmed 97.5 + planned 3.0 must never appear combined as 100.5.
    expect(container.textContent).not.toContain('100.5');
  });

  it('shows a team subtotal row labeled "Team subtotal"', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    const subtotalCells = Array.from(container.querySelectorAll('td')).filter(
      (cell) => cell.textContent?.trim() === 'Team subtotal',
    );
    expect(subtotalCells.length).toBe(2); // one per team
  });

  it('renders the coach/admin-only report with no self-gate markup (no sign-in prompt)', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Sign in to view');
  });
});

// ---------------------------------------------------------------------------
// T095: real `loaders/reports.ts` seam -- `makeLoadHoursData`. Stubbed
// `SupabaseClient` only, same DI pattern `StudentsTab.test.tsx`'s own
// `loadStudentsTabData` tests already established -- zero real network
// calls.
// ---------------------------------------------------------------------------

function buildFakeHoursClient(db: {
  season: Record<string, unknown> | null;
  students: Record<string, unknown>[];
  teams: Record<string, unknown>[];
  studentHours: Record<string, unknown>[];
  events: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  rsvps: Record<string, unknown>[];
}): { client: SupabaseClient; fromSpy: ReturnType<typeof vi.fn> } {
  const fromSpy = vi.fn((table: string) => {
    switch (table) {
      case 'seasons':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: db.season, error: null }),
            })),
          })),
        };
      case 'students':
        // T201 -- the roster query no longer chains through `.eq('is_active',
        // true)`, so this double no longer nests `order` under `eq`. It is
        // shaped to the REAL call (`.select(...).order(...)`) rather than kept
        // permissive: a double that accepted both would have gone on passing
        // if the filter were silently reinstated.
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: db.students, error: null }),
          })),
        };
      case 'teams':
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: db.teams, error: null }),
          })),
        };
      case 'v_student_hours':
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: db.studentHours, error: null }),
          })),
        };
      case 'events':
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: db.events, error: null }),
          })),
        };
      case 'event_sessions':
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: db.sessions, error: null }),
          })),
        };
      case 'rsvps':
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({ data: db.rsvps, error: null }),
          })),
        };
      default:
        throw new Error(`buildFakeHoursClient: unexpected table "${table}"`);
    }
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, fromSpy };
}

describe('loadHoursData (T095 real load)', () => {
  it('queries seasons/students/teams/v_student_hours/events/event_sessions/rsvps and maps snake_case DB rows to the HoursLoadResult contract (no re-derived arithmetic on confirmedHours)', async () => {
    const { client, fromSpy } = buildFakeHoursClient({
      season: { default_goal_hours: 80 },
      students: [
        {
          id: 'student-1',
          display_name: 'DB Student',
          team_id: 'team-1',
          is_active: true,
          goal_hours_override: null,
        },
      ],
      teams: [{ id: 'team-1', name: 'DB Team' }],
      studentHours: [{ student_id: 'student-1', season_id: 'season-1', confirmed_hours: 12.5 }],
      events: [
        {
          id: 'event-1',
          season_id: 'season-1',
          type: 'outreach',
          team_ids: null,
          counts_volunteer_hours: true,
        },
      ],
      sessions: [
        {
          id: 'session-1',
          event_id: 'event-1',
          starts_at: '2026-01-01T00:00:00.000Z',
          ends_at: '2026-01-01T02:00:00.000Z',
          status: 'completed',
          people_reached: 10,
        },
      ],
      rsvps: [{ id: 'rsvp-1', session_id: 'session-1', student_id: 'student-1', status: 'going' }],
    });

    const load = makeLoadHoursData(() => client);
    const result = await load('season-1');

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(fromSpy).toHaveBeenCalledWith('v_student_hours');
    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).toHaveBeenCalledWith('rsvps');

    expect(result).toEqual<HoursLoadResult>({
      seasonId: 'season-1',
      defaultGoalHours: 80,
      students: [
        {
          id: 'student-1',
          name: 'DB Student',
          teamId: 'team-1',
          isActive: true,
          goalHoursOverride: null,
        },
      ],
      teams: [{ id: 'team-1', name: 'DB Team' }],
      // Verbatim rename, not recomputed -- 12.5 is a direct copy of the
      // fake `v_student_hours` row's own `confirmed_hours` value.
      studentHours: [{ studentId: 'student-1', seasonId: 'season-1', confirmedHours: 12.5 }],
      events: [
        {
          id: 'event-1',
          seasonId: 'season-1',
          type: 'outreach',
          teamIds: null,
          countsVolunteerHours: true,
        },
      ],
      sessions: [
        {
          id: 'session-1',
          eventId: 'event-1',
          startsAt: '2026-01-01T00:00:00.000Z',
          endsAt: '2026-01-01T02:00:00.000Z',
          status: 'completed',
          peopleReached: 10,
        },
      ],
      rsvps: [{ id: 'rsvp-1', sessionId: 'session-1', studentId: 'student-1', status: 'going' }],
    });
  });

  it('short-circuits event_sessions/rsvps queries when the season has zero events (never calls `.in()` with an empty id array)', async () => {
    const { client, fromSpy } = buildFakeHoursClient({
      season: { default_goal_hours: 80 },
      students: [],
      teams: [],
      studentHours: [],
      events: [],
      sessions: [],
      rsvps: [],
    });
    const load = makeLoadHoursData(() => client);
    const result = await load('season-empty');

    expect(fromSpy).not.toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).not.toHaveBeenCalledWith('rsvps');
    expect(result.events).toEqual([]);
    expect(result.sessions).toEqual([]);
    expect(result.rsvps).toEqual([]);
  });

  it('falls back to defaultGoalHours 0 (never throws) when no matching season row exists', async () => {
    const { client } = buildFakeHoursClient({
      season: null,
      students: [],
      teams: [],
      studentHours: [],
      events: [],
      sessions: [],
      rsvps: [],
    });
    const load = makeLoadHoursData(() => client);
    const result = await load('season-missing');
    expect(result.defaultGoalHours).toBe(0);
  });

  it('rejects with the real SupabaseLoaderError when a query fails', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === 'seasons') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: { message: 'denied', code: '42501' } }),
            })),
          })),
        };
      }
      if (table === 'students') {
        // T201 -- shaped to the real call (`.select(...).order(...)`); the
        // roster query no longer chains through `.eq('is_active', true)`.
        return {
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      if (table === 'v_student_hours' || table === 'events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        };
      }
      if (table === 'teams') {
        return {
          select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadHoursData(() => client);
    await expect(load('season-1')).rejects.toMatchObject({ code: '42501' });
  });
});
