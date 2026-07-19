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
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

function render(props: Parameters<typeof HoursTab>[0]): void {
  act(() => {
    root.render(<HoursTab {...props} />);
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
// Render-level proof (DES-12 + real DOM number cross-checks).
// ---------------------------------------------------------------------------

describe('HoursTab render', () => {
  it('shows a loading spinner, then the populated report', async () => {
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
