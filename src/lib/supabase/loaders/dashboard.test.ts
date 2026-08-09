// T166: the first tests for `loaders/dashboard.ts`, which shipped with ZERO
// tests. The row was filed blocked on T155 (which changed how `CoachHome`
// calls this loader) and was re-opened after T155 merged 2026-07-30.
//
// PREMISE, MEASURED before writing (not taken from the row's own wording):
// `dashboard.ts` has 21 `export` lines but only TWO value exports --
// `makeLoadDashboardData` (the 129-line factory) and the bare
// `loadDashboardData` singleton. `makeLoadDashboardData` is invoked 0 times
// anywhere in the suite. `CoachHome.test.tsx` mentions `loadDashboardData`
// 40+ times and EVERY one is that component's own INJECTED PROP being
// stubbed (`vi.fn()`, `fixtureLoadDashboardData`, `defaultLoadDashboardData`)
// -- which exercises `CoachHome`'s handling of results, never this loader.
// The single test that reaches the real function (`CoachHome.test.tsx`'s
// 'the real default loadDashboardData ... fails safely') only proves it does
// not crash with no Supabase configured; it asserts nothing about the
// query fan-out or the row mapping.
//
// Mirrors `loaders/kpi.test.ts` (T164, the same defect class) and its
// `.from(table)` dispatcher, widened to this file's FOUR chain shapes:
//   `.select().eq().maybeSingle()` -- the 4 single-row season stat views
//   `.select().eq()`               -- the 4 per-season array views + `events`
//   `.select()`                    -- `teams` and `students`, unfiltered
//   `.select().in()`               -- the 3 feed tables keyed by id list
//
// `students` is queried TWICE with DIFFERENT selects (`id, display_name` for
// the goal-projection name join; `id, display_name, profile_id` for the feed).
// A dispatcher keyed on table name alone cannot tell them apart, so the
// dispatcher below keys `students` on its select string.
//
// No `@vitest-environment jsdom` docblock -- `dashboard.ts` imports no page
// or React code, so this runs in vitest's default node environment, the
// posture `kpi.test.ts`/`coachHome.test.ts`/`students.test.ts` established.
//
// Only `makeLoadDashboardData` is tested, through its factory with a stubbed
// client. The bare `loadDashboardData` export calls the real
// `getSupabaseClient()` singleton and is left untouched -- the same posture
// every sibling loader test file takes.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { makeLoadDashboardData } from './dashboard';

// ---------------------------------------------------------------------------
// Chain-shape tables. Derived by reading each `query*` function in
// `dashboard.ts`, not guessed -- a table in the wrong set makes the fake
// return a non-thenable and the test errors loudly rather than passing.
// ---------------------------------------------------------------------------

const MAYBE_SINGLE_TABLES = new Set([
  'v_season_roster_stats',
  'v_season_attendance_rate',
  'v_season_session_days',
  'v_season_upcoming_committed_hours',
]);

const EQ_ARRAY_TABLES = new Set([
  'v_season_day_of_week_sessions',
  'v_team_hours',
  'v_event_student_hours',
  'v_student_goal_projection',
  'events',
]);

const IN_ARRAY_TABLES = new Set(['event_sessions', 'rsvps', 'attendance']);

/** `students` selects, used to disambiguate its two distinct queries. */
const DASHBOARD_STUDENTS_SELECT = 'id, display_name';
const FEED_STUDENTS_SELECT = 'id, display_name, profile_id';

type FixtureMap = Record<string, unknown>;

interface RecordingClient {
  client: SupabaseClient;
  /** Every table passed to `.from(...)`, in call order. */
  fromCalls: string[];
  /** Id lists passed to `.in(...)`, keyed by table. */
  inArgs: Record<string, string[][]>;
  /** Season ids passed to `.eq('season_id', ...)`, keyed by table. */
  eqArgs: Record<string, string[]>;
}

/**
 * Fake Supabase client dispatching on `.from(table)`. Any table absent from
 * `fixtures` resolves `{ data: null }`, which is exactly what Supabase does
 * for an empty result and what the loader's own `?? []` guards must absorb.
 */
function makeRecordingClient(fixtures: FixtureMap): RecordingClient {
  const fromCalls: string[] = [];
  const inArgs: Record<string, string[][]> = {};
  const eqArgs: Record<string, string[]> = {};

  const client = {
    from(table: string) {
      fromCalls.push(table);
      return {
        select(select: string) {
          const key = table === 'students' ? `students:${select}` : table;
          const data = key in fixtures ? fixtures[key] : null;

          if (MAYBE_SINGLE_TABLES.has(table)) {
            return {
              eq(_column: string, value: string) {
                (eqArgs[table] ??= []).push(value);
                return { maybeSingle: async () => ({ data, error: null }) };
              },
            };
          }

          if (EQ_ARRAY_TABLES.has(table)) {
            return {
              async eq(_column: string, value: string) {
                (eqArgs[table] ??= []).push(value);
                return { data, error: null };
              },
            };
          }

          if (IN_ARRAY_TABLES.has(table)) {
            return {
              async in(_column: string, ids: string[]) {
                (inArgs[table] ??= []).push([...ids]);
                return { data, error: null };
              },
            };
          }

          // Bare terminal select: `teams` and both `students` queries.
          return Promise.resolve({ data, error: null });
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, fromCalls, inArgs, eqArgs };
}

// ---------------------------------------------------------------------------
// Fixtures -- fabricated names only (constitution item 6).
//
// Every numeric field gets a DISTINCT, non-zero value so that swapping any
// two columns in a mapper is observable in a single `toEqual`, rather than
// hiding behind two fields that happen to share a value. This is the defect
// class `kpi.test.ts` was written for and it applies verbatim here: every
// mapper in `dashboard.ts` is a column rename with no arithmetic.
// ---------------------------------------------------------------------------

const SEASON_ID = 'season-fixture-001';

const ROSTER_STATS_ROW = {
  season_id: SEASON_ID,
  active_student_count: 17,
  avg_hours_per_active_student: 23.5,
  students_at_goal_count: 6,
};

const ATTENDANCE_RATE_ROW = {
  season_id: SEASON_ID,
  expected_ct: 88,
  present_ct: 71,
  attendance_rate_pct: 80.7,
};

const SESSION_DAYS_ROW = { season_id: SEASON_ID, session_days_logged: 39 };

const UPCOMING_COMMITTED_ROW = { season_id: SEASON_ID, committed_hours_30d: 52.25 };

const DAY_OF_WEEK_ROWS = [
  { season_id: SEASON_ID, day_of_week: 2, session_count: 11 },
  { season_id: SEASON_ID, day_of_week: 4, session_count: 7 },
];

const TEAM_ROWS = [
  { id: 'team-aurora', name: 'Aurora Assembly' },
  { id: 'team-basalt', name: 'Basalt Builders' },
];

const TEAM_HOURS_ROWS = [
  { team_id: 'team-aurora', season_id: SEASON_ID, confirmed_hours: 141.5 },
  { team_id: 'team-basalt', season_id: SEASON_ID, confirmed_hours: 96.25 },
];

const TOP_EVENT_ROWS = [
  {
    event_id: 'event-harvest',
    season_id: SEASON_ID,
    title: 'Harvest Drive',
    starts_on: '2026-03-04',
    ends_on: '2026-03-05',
    student_count: 12,
    total_hours: 48.75,
  },
];

const STUDENT_ROWS = [
  { id: 'student-wren', display_name: 'Wren Calloway' },
  { id: 'student-idris', display_name: 'Idris Fenwick' },
];

const GOAL_PROJECTION_ROWS = [
  {
    student_id: 'student-wren',
    season_id: SEASON_ID,
    team_id: 'team-aurora',
    goal_hours: 100,
    confirmed_hours: 63.5,
    planned_hours: 18.25,
  },
];

const FEED_EVENT_ROWS = [
  { id: 'event-harvest', season_id: SEASON_ID, title: 'Harvest Drive', type: 'outreach' as const },
];

const FEED_SESSION_ROWS = [
  {
    id: 'session-harvest-1',
    event_id: 'event-harvest',
    session_date: '2026-03-04',
    starts_at: '2026-03-04T15:30:00Z',
  },
];

const FEED_RSVP_ROWS = [
  {
    id: 'rsvp-1',
    session_id: 'session-harvest-1',
    student_id: 'student-wren',
    status: 'going' as const,
    responded_by: 'profile-guardian-1',
    updated_at: '2026-03-01T09:00:00Z',
    created_at: '2026-02-27T09:00:00Z',
  },
];

const FEED_ATTENDANCE_ROWS = [
  {
    id: 'attendance-1',
    session_id: 'session-harvest-1',
    student_id: 'student-wren',
    status: 'present' as const,
    recorded_by: 'profile-coach-1',
    updated_at: '2026-03-04T18:00:00Z',
    created_at: '2026-03-04T17:55:00Z',
  },
];

const FEED_STUDENT_ROWS = [
  { id: 'student-wren', display_name: 'Wren Calloway', profile_id: 'profile-wren' },
  { id: 'student-idris', display_name: 'Idris Fenwick', profile_id: null },
];

/** Every table populated -- the happy path. */
function fullFixtures(): FixtureMap {
  return {
    v_season_roster_stats: ROSTER_STATS_ROW,
    v_season_attendance_rate: ATTENDANCE_RATE_ROW,
    v_season_session_days: SESSION_DAYS_ROW,
    v_season_upcoming_committed_hours: UPCOMING_COMMITTED_ROW,
    v_season_day_of_week_sessions: DAY_OF_WEEK_ROWS,
    v_team_hours: TEAM_HOURS_ROWS,
    teams: TEAM_ROWS,
    v_event_student_hours: TOP_EVENT_ROWS,
    v_student_goal_projection: GOAL_PROJECTION_ROWS,
    [`students:${DASHBOARD_STUDENTS_SELECT}`]: STUDENT_ROWS,
    [`students:${FEED_STUDENTS_SELECT}`]: FEED_STUDENT_ROWS,
    events: FEED_EVENT_ROWS,
    event_sessions: FEED_SESSION_ROWS,
    rsvps: FEED_RSVP_ROWS,
    attendance: FEED_ATTENDANCE_ROWS,
  };
}

// ---------------------------------------------------------------------------

describe('makeLoadDashboardData', () => {
  describe("the empty-`.in()` guard -- the module's own documented invariant #5", () => {
    // `dashboard.ts` module doc #5 states every `.in(...)` query is guarded by
    // a `.length > 0` check. That invariant had no test. It matters because
    // `.in('event_id', [])` is not harmless: PostgREST returns every row the
    // caller can see, so a dropped guard turns an empty dashboard into a
    // full-table read.
    it('never queries event_sessions when the season has no events', async () => {
      const { client, fromCalls } = makeRecordingClient({ ...fullFixtures(), events: [] });

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(fromCalls).not.toContain('event_sessions');
      expect(result.activityFeedSource.sessions).toEqual([]);
    });

    it('never queries rsvps or attendance when the season has no events', async () => {
      const { client, fromCalls } = makeRecordingClient({ ...fullFixtures(), events: [] });

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(fromCalls).not.toContain('rsvps');
      expect(fromCalls).not.toContain('attendance');
      expect(result.activityFeedSource.rsvps).toEqual([]);
      expect(result.activityFeedSource.attendance).toEqual([]);
    });

    it('queries event_sessions but not rsvps/attendance when events have no sessions', async () => {
      const { client, fromCalls } = makeRecordingClient({
        ...fullFixtures(),
        event_sessions: [],
      });

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(fromCalls).toContain('event_sessions');
      expect(fromCalls).not.toContain('rsvps');
      expect(fromCalls).not.toContain('attendance');
      expect(result.activityFeedSource.rsvps).toEqual([]);
    });

    it('passes the event ids to event_sessions and the session ids to rsvps/attendance', async () => {
      const { client, inArgs } = makeRecordingClient(fullFixtures());

      await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(inArgs.event_sessions).toEqual([['event-harvest']]);
      expect(inArgs.rsvps).toEqual([['session-harvest-1']]);
      expect(inArgs.attendance).toEqual([['session-harvest-1']]);
    });
  });

  describe('display-name joins', () => {
    // `v_team_hours`/`v_student_goal_projection` carry ids only; names come
    // from separate unfiltered `teams`/`students` reads joined in memory.
    // A missing id must degrade to a visible placeholder, never to a wrong
    // name or a crash.
    it('falls back to "Unknown team" when a team hours row has no matching team', async () => {
      const { client } = makeRecordingClient({
        ...fullFixtures(),
        teams: [{ id: 'team-basalt', name: 'Basalt Builders' }],
      });

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(result.teamHours).toEqual([
        {
          teamId: 'team-aurora',
          teamName: 'Unknown team',
          seasonId: SEASON_ID,
          confirmedHours: 141.5,
        },
        {
          teamId: 'team-basalt',
          teamName: 'Basalt Builders',
          seasonId: SEASON_ID,
          confirmedHours: 96.25,
        },
      ]);
    });

    it('falls back to "Unknown student" when a projection row has no matching student', async () => {
      const { client } = makeRecordingClient({
        ...fullFixtures(),
        [`students:${DASHBOARD_STUDENTS_SELECT}`]: [],
      });

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(result.goalProjection[0]?.displayName).toBe('Unknown student');
      // The team join is independent and must still resolve.
      expect(result.goalProjection[0]?.teamName).toBe('Aurora Assembly');
    });

    it('resolves both names from the two separate `students` queries', async () => {
      const { client } = makeRecordingClient(fullFixtures());

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      // Goal projection reads the `id, display_name` query...
      expect(result.goalProjection[0]?.displayName).toBe('Wren Calloway');
      // ...while the feed reads the `id, display_name, profile_id` one, whose
      // extra column must survive into the feed source.
      expect(result.activityFeedSource.students).toEqual([
        { id: 'student-wren', displayName: 'Wren Calloway', profileId: 'profile-wren' },
        { id: 'student-idris', displayName: 'Idris Fenwick', profileId: null },
      ]);
    });
  });

  describe('absent single-row stats', () => {
    it('maps each missing season stat view to null rather than fabricating a zero', async () => {
      // The four `.maybeSingle()` views legitimately return no row for a
      // season with no activity. Fabricating `0` there is the defect class
      // behind T155/T176 -- a plausible number a coach cannot distinguish
      // from a real one.
      const { client } = makeRecordingClient({});

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(result.rosterStats).toBeNull();
      expect(result.attendanceRate).toBeNull();
      expect(result.sessionDays).toBeNull();
      expect(result.upcomingCommittedHours).toBeNull();
    });

    it('coalesces every null array result to an empty array', async () => {
      const { client } = makeRecordingClient({});

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(result.dayOfWeekSessions).toEqual([]);
      expect(result.teamHours).toEqual([]);
      expect(result.topEvents).toEqual([]);
      expect(result.goalProjection).toEqual([]);
      expect(result.activityFeedSource).toEqual({
        events: [],
        sessions: [],
        rsvps: [],
        attendance: [],
        students: [],
      });
    });
  });

  describe('season scoping', () => {
    it('passes the requested season id to every per-season query and echoes it back', async () => {
      const { client, eqArgs } = makeRecordingClient(fullFixtures());

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(result.seasonId).toBe(SEASON_ID);
      for (const table of EQ_ARRAY_TABLES) {
        expect(eqArgs[table]).toEqual([SEASON_ID]);
      }
      for (const table of MAYBE_SINGLE_TABLES) {
        expect(eqArgs[table]).toEqual([SEASON_ID]);
      }
    });

    it('reads teams and students unfiltered -- a known residual, pinned so a fix is visible', async () => {
      // T155's premise gate measured this: `teams` and `students` are read
      // with no season filter, so both name maps span every season. Harmless
      // for name lookup today (ids are globally unique), and pinned here so
      // that adding a season filter shows up as a failing test rather than a
      // silent behaviour change.
      const { client, eqArgs } = makeRecordingClient(fullFixtures());

      await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(eqArgs.teams).toBeUndefined();
      expect(eqArgs.students).toBeUndefined();
    });
  });

  describe('column mapping fidelity', () => {
    it('renames every column without transposing any pair', async () => {
      const { client } = makeRecordingClient(fullFixtures());

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(result.rosterStats).toEqual({
        seasonId: SEASON_ID,
        activeStudentCount: 17,
        avgHoursPerActiveStudent: 23.5,
        studentsAtGoalCount: 6,
      });
      expect(result.attendanceRate).toEqual({
        seasonId: SEASON_ID,
        expectedCt: 88,
        presentCt: 71,
        attendanceRatePct: 80.7,
      });
      expect(result.sessionDays).toEqual({ seasonId: SEASON_ID, sessionDaysLogged: 39 });
      expect(result.upcomingCommittedHours).toEqual({
        seasonId: SEASON_ID,
        committedHours30d: 52.25,
      });
      expect(result.dayOfWeekSessions).toEqual([
        { seasonId: SEASON_ID, dayOfWeek: 2, sessionCount: 11 },
        { seasonId: SEASON_ID, dayOfWeek: 4, sessionCount: 7 },
      ]);
      expect(result.topEvents).toEqual([
        {
          eventId: 'event-harvest',
          seasonId: SEASON_ID,
          title: 'Harvest Drive',
          startsOn: '2026-03-04',
          endsOn: '2026-03-05',
          studentCount: 12,
          totalHours: 48.75,
        },
      ]);
      expect(result.goalProjection).toEqual([
        {
          studentId: 'student-wren',
          seasonId: SEASON_ID,
          displayName: 'Wren Calloway',
          teamId: 'team-aurora',
          teamName: 'Aurora Assembly',
          goalHours: 100,
          confirmedHours: 63.5,
          plannedHours: 18.25,
        },
      ]);
    });

    it('maps the activity feed source rows, preserving nullable audit columns', async () => {
      const { client } = makeRecordingClient(fullFixtures());

      const result = await makeLoadDashboardData(() => client)(SEASON_ID);

      expect(result.activityFeedSource.events).toEqual([
        { id: 'event-harvest', seasonId: SEASON_ID, title: 'Harvest Drive', type: 'outreach' },
      ]);
      expect(result.activityFeedSource.sessions).toEqual([
        {
          id: 'session-harvest-1',
          eventId: 'event-harvest',
          sessionDate: '2026-03-04',
          startsAt: '2026-03-04T15:30:00Z',
        },
      ]);
      expect(result.activityFeedSource.rsvps).toEqual([
        {
          id: 'rsvp-1',
          sessionId: 'session-harvest-1',
          studentId: 'student-wren',
          status: 'going',
          respondedBy: 'profile-guardian-1',
          updatedAt: '2026-03-01T09:00:00Z',
          createdAt: '2026-02-27T09:00:00Z',
        },
      ]);
      expect(result.activityFeedSource.attendance).toEqual([
        {
          id: 'attendance-1',
          sessionId: 'session-harvest-1',
          studentId: 'student-wren',
          status: 'present',
          recordedBy: 'profile-coach-1',
          updatedAt: '2026-03-04T18:00:00Z',
          createdAt: '2026-03-04T17:55:00Z',
        },
      ]);
    });
  });
});
