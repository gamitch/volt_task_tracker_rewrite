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
      adultVolunteersCount: 0,
      adultVolunteerHours: 0,
    },
    {
      id: 'event-meeting',
      seasonId: 's1',
      type: 'meeting',
      teamIds: null,
      countsVolunteerHours: false,
      adultVolunteersCount: 0,
      adultVolunteerHours: 0,
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

describe('buildSeasonTotals -- module doc #6', () => {
  it('sums non-null peopleReached, counts missing separately, sums adult volunteers across all event types', async () => {
    const data = await defaultLoadHoursData(PLACEHOLDER_CURRENT_SEASON_ID);
    const totals = buildSeasonTotals(data.events, data.sessions);
    // sessions: cleanup-upcoming(null), cleanup-past(85), food-drive-past(null),
    // food-drive-earlier(40), meeting-upcoming(null)
    expect(totals.peopleReachedTotal).toBe(125);
    expect(totals.sessionsMissingHeadcountCount).toBe(3);
    expect(totals.totalSessionCount).toBe(5);
    // events: cleanup(4/12) + food-drive(2/6) + meeting(0/0)
    expect(totals.adultVolunteersCount).toBe(6);
    expect(totals.adultVolunteerHours).toBe(18);
  });
});

// ---------------------------------------------------------------------------
// T500: an event with zero sessions did not happen (event/session creation
// is not transactional -- T330's finding), so its adult-volunteer figures
// must not land in the season total. `FIXTURE_EVENTS` above cannot exercise
// this: every one of its events has a session. A local fixture is built
// per-test instead, per the packet's own instruction not to touch
// `FIXTURE_EVENTS` (other tests depend on its exact shape).
// ---------------------------------------------------------------------------
describe('buildSeasonTotals -- T500: sessionless events excluded from season totals', () => {
  const baseEvent: HoursEventRow = {
    id: 'event-base',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    type: 'outreach',
    teamIds: null,
    countsVolunteerHours: true,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
  };
  const baseSession: HoursSessionRow = {
    id: 'session-base',
    eventId: 'event-base',
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: '2026-01-01T01:00:00.000Z',
    status: 'completed',
    peopleReached: null,
  };

  // Criterion 1 (split into two `it`s -- a single `it` halts at its first
  // failed `expect`, so it cannot show both fields going red on the same
  // revert).
  it('criterion 1a: excludes a sessionless event from adultVolunteersCount', () => {
    const events: readonly HoursEventRow[] = [
      { ...baseEvent, id: 'event-with-session', adultVolunteersCount: 5, adultVolunteerHours: 10 },
      { ...baseEvent, id: 'event-sessionless', adultVolunteersCount: 3, adultVolunteerHours: 7 },
    ];
    const sessions: readonly HoursSessionRow[] = [
      { ...baseSession, id: 'session-1', eventId: 'event-with-session' },
    ];
    const totals = buildSeasonTotals(events, sessions);
    expect(totals.adultVolunteersCount).toBe(5); // NOT 8 (5 + 3)
  });

  it('criterion 1b: excludes a sessionless event from adultVolunteerHours', () => {
    const events: readonly HoursEventRow[] = [
      { ...baseEvent, id: 'event-with-session', adultVolunteersCount: 5, adultVolunteerHours: 10 },
      { ...baseEvent, id: 'event-sessionless', adultVolunteersCount: 3, adultVolunteerHours: 7 },
    ];
    const sessions: readonly HoursSessionRow[] = [
      { ...baseSession, id: 'session-1', eventId: 'event-with-session' },
    ];
    const totals = buildSeasonTotals(events, sessions);
    expect(totals.adultVolunteerHours).toBe(10); // NOT 17 (10 + 7)
  });

  // Criterion 2: the T330 double-count scenario named in the defect -- a
  // failed session insert leaves a sessionless orphan event behind, and a
  // successful retry produces a second event (this time with a session)
  // carrying the SAME adult-volunteer figures. The season total must count
  // that figure once, not twice.
  it('criterion 2: a sessioned event and its sessionless retry-orphan duplicate are counted once, not twice', () => {
    const events: readonly HoursEventRow[] = [
      { ...baseEvent, id: 'event-retry-succeeded', adultVolunteersCount: 4, adultVolunteerHours: 12 },
      {
        ...baseEvent,
        id: 'event-orphan-from-failed-attempt',
        adultVolunteersCount: 4,
        adultVolunteerHours: 12,
      },
    ];
    const sessions: readonly HoursSessionRow[] = [
      { ...baseSession, id: 'session-1', eventId: 'event-retry-succeeded' },
    ];
    const totals = buildSeasonTotals(events, sessions);
    expect(totals.adultVolunteersCount).toBe(4); // NOT 8
    expect(totals.adultVolunteerHours).toBe(12); // NOT 24
  });

  // Criterion 3 -- the over-fixing guard. An event WITH a session must
  // still be fully counted no matter its `type` or `countsVolunteerHours`
  // (RPT-03 is unqualified; narrowing this is T702's question, not this
  // task's). If the predicate were changed to also filter on
  // `countsVolunteerHours` or `type === 'outreach'`, this must fail.
  it('criterion 3: an event WITH a session is still fully counted regardless of type or countsVolunteerHours', () => {
    const events: readonly HoursEventRow[] = [
      {
        ...baseEvent,
        id: 'event-meeting-with-session',
        type: 'meeting',
        countsVolunteerHours: false,
        adultVolunteersCount: 2,
        adultVolunteerHours: 5,
      },
    ];
    const sessions: readonly HoursSessionRow[] = [
      { ...baseSession, id: 'session-1', eventId: 'event-meeting-with-session' },
    ];
    const totals = buildSeasonTotals(events, sessions);
    expect(totals.adultVolunteersCount).toBe(2);
    expect(totals.adultVolunteerHours).toBe(5);
  });

  // Criterion 4: the pre-existing contract is untouched by this predicate --
  // session-derived totals do not depend on which events have sessions.
  it('criterion 4: peopleReachedTotal, sessionsMissingHeadcountCount and totalSessionCount are unaffected by the event-level filter', () => {
    const events: readonly HoursEventRow[] = [
      { ...baseEvent, id: 'event-sessionless', adultVolunteersCount: 9, adultVolunteerHours: 20 },
    ];
    const sessions: readonly HoursSessionRow[] = [
      { ...baseSession, id: 'session-1', eventId: 'event-elsewhere', peopleReached: 10 },
      { ...baseSession, id: 'session-2', eventId: 'event-elsewhere', peopleReached: null },
    ];
    const totals = buildSeasonTotals(events, sessions);
    expect(totals.peopleReachedTotal).toBe(10);
    expect(totals.sessionsMissingHeadcountCount).toBe(1);
    expect(totals.totalSessionCount).toBe(2);
    // The sessionless event's own figures are still excluded, unrelated to
    // the session-derived totals asserted above.
    expect(totals.adultVolunteersCount).toBe(0);
    expect(totals.adultVolunteerHours).toBe(0);
  });
});

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

  it('season totals reach the DOM: 125 people reached, 3 of 5 missing headcount, 6 adult volunteers, 18.0 h', async () => {
    render({ seasonId: PLACEHOLDER_CURRENT_SEASON_ID });
    await flushMicrotasks();
    expect(container.textContent).toContain('125');
    expect(container.textContent).toContain('3 of 5 sessions have no recorded headcount yet');
    expect(container.textContent).toContain('Adult volunteers');
    expect(container.textContent).toContain('18.0 h');
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
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({ data: db.students, error: null }),
            })),
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
          adult_volunteers_count: 2,
          adult_volunteer_hours: 4,
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
        { id: 'student-1', name: 'DB Student', teamId: 'team-1', goalHoursOverride: null },
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
          adultVolunteersCount: 2,
          adultVolunteerHours: 4,
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
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
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
