/**
 * T030: tests for `MeetingsList.tsx` -- the shell -- and for its own default
 * wiring of `src/lib/supabase/loaders/meetings.ts`'s real seams.
 *
 * GAM-444 Stage C split this file three ways: the coach-view rendering
 * tests moved to `coach/CoachMeetingsView.test.tsx`, the student/parent-view
 * rendering tests moved to `student/StudentMeetingsView.test.tsx`, and the
 * pure-builder tests moved to `src/lib/meetings/{coachModel,studentModel}.test.ts`
 * back in Stage A. What remains here is (1) the format-function re-export
 * proof (`../../lib/meetings/format.ts`'s functions, re-exported by this
 * page module) and (2) the `loaders/meetings.ts` seam tests below, which
 * have nowhere else to go: that module is Forbidden under this ticket's
 * §3 (only its import re-point is Allowed), and it has no dedicated test
 * file of its own (see the comment ahead of the first `describe` below,
 * unchanged from before the split).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  aggregateParticipationRows,
  makeCancelMeetingSession,
  makeCreateMeetings,
  makeLoadCoachMeetingsData,
  makeLoadStudentMeetingsData,
  makeResolveCurrentStudentId,
  makeSaveMeetingSeries,
  makeSaveMeetingSession,
} from '../../lib/supabase/loaders/meetings';
import {
  buildDateRangeLabel,
  buildRecurrenceChips,
  formatDuration,
  formatHoursLabel,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
} from './MeetingsList';
import type { CreateMeetingsPayload, SaveMeetingSeriesPayload } from './ScheduleMeetingsDialog';
import type { SaveMeetingSessionPayload } from './EditMeetingSessionDialog';

// ---------------------------------------------------------------------------
// Pure formatting functions (re-exported from `../../lib/meetings/format.ts`,
// GAM-443 -- proof that this page module's own re-export surface still
// works, per GAM-444 packet §6's back-compat requirement).
// ---------------------------------------------------------------------------

describe('formatWeekdayDate (BEH-08)', () => {
  it('renders a weekday name + short date, e.g. "Wed, Jul 22"', () => {
    expect(formatWeekdayDate('2026-07-22')).toBe('Wed, Jul 22');
  });
});

describe('formatDuration / formatTimeRangeWithDuration (BEH-08)', () => {
  it('computes a whole-hour duration', () => {
    expect(formatDuration('2026-07-22T23:00:00.000Z', '2026-07-23T01:00:00.000Z')).toBe('2h');
  });

  it('computes an hours+minutes duration', () => {
    expect(formatDuration('2026-07-22T23:00:00.000Z', '2026-07-23T00:30:00.000Z')).toBe('1h 30m');
  });

  it('computes a minutes-only duration', () => {
    expect(formatDuration('2026-07-22T23:00:00.000Z', '2026-07-22T23:45:00.000Z')).toBe('45m');
  });

  it('renders a full time range + duration string, America/Chicago (NFR-09)', () => {
    // 2026-07-22T23:00:00Z / 2026-07-23T01:00:00Z = 6:00-8:00 PM America/Chicago (CDT, UTC-5).
    expect(
      formatTimeRangeWithDuration('2026-07-22T23:00:00.000Z', '2026-07-23T01:00:00.000Z'),
    ).toBe('6:00–8:00 PM · 2h');
  });
});

describe('formatHoursLabel (T122 module doc #10b)', () => {
  it('renders a whole-hour value without a decimal', () => {
    expect(formatHoursLabel(2)).toBe('2h');
    expect(formatHoursLabel(0)).toBe('0h');
  });

  it('renders a fractional value rounded to one decimal', () => {
    expect(formatHoursLabel(1.5)).toBe('1.5h');
    expect(formatHoursLabel(1.449)).toBe('1.4h');
  });
});

describe('buildRecurrenceChips / buildDateRangeLabel (T122 module doc #10b)', () => {
  it('groups by weekday in first-seen order for a multi-session set', () => {
    const sessions = [
      { sessionDate: '2026-07-06' }, // Mon
      { sessionDate: '2026-07-09' }, // Thu
      { sessionDate: '2026-07-13' }, // Mon
    ];
    expect(buildRecurrenceChips(sessions)).toEqual(['MON (2)', 'THU (1)']);
  });

  it('returns no chips for a single session', () => {
    expect(buildRecurrenceChips([{ sessionDate: '2026-07-06' }])).toEqual([]);
  });

  it('returns no chips and an empty date range label for zero sessions', () => {
    expect(buildRecurrenceChips([])).toEqual([]);
    expect(buildDateRangeLabel([])).toBe('');
  });

  it('date range label is a single date for one session, a range for multiple', () => {
    expect(buildDateRangeLabel([{ sessionDate: '2026-07-22' }])).toBe('Wed, Jul 22');
    expect(
      buildDateRangeLabel([{ sessionDate: '2026-07-22' }, { sessionDate: '2026-07-08' }]),
    ).toBe('Wed, Jul 8 – Wed, Jul 22'); // sorted ascending regardless of input order
  });
});

// ---------------------------------------------------------------------------
// T096: real `loaders/meetings.ts` seams -- `makeLoadCoachMeetingsData`,
// `makeLoadStudentMeetingsData`, `makeCancelMeetingSession`,
// `makeResolveCurrentStudentId`, `makeCreateMeetings`. Stubbed
// `SupabaseClient` only, same DI pattern `StudentsTab.test.tsx`'s own T089
// loader-level tests already established -- zero real network calls, and
// this module has no dedicated test file of its own (this task's own
// Allowed Files list only names `MeetingsList.test.tsx`, not a second file
// here).
// ---------------------------------------------------------------------------

describe('loadCoachMeetingsData (T096 real load)', () => {
  it('queries events/event_sessions/teams/attendance/rsvps/students and produces the same rows buildCoachMeetingRows would', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'event-1',
          season_id: 'season-1',
          type: 'meeting',
          title: 'DB Meeting',
          team_ids: null,
          counts_participation: true,
          location_name: 'DB Location',
          address: '1 DB Way',
        },
        {
          id: 'event-2',
          season_id: 'season-1',
          type: 'outreach',
          title: 'DB Outreach -- must never appear',
          team_ids: null,
          counts_participation: false,
          location_name: '',
          address: '',
        },
      ],
      error: null,
    });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'session-1',
          event_id: 'event-1',
          session_date: '2026-07-22',
          starts_at: '2026-07-22T23:00:00.000Z',
          ends_at: '2026-07-23T01:00:00.000Z',
          status: 'scheduled',
        },
      ],
      error: null,
    });
    const teamsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceSelectSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    // T122 (module doc #10a) -- new rsvps/students queries.
    const rsvpsSelectSpy = vi.fn().mockResolvedValue({
      data: [{ session_id: 'session-1', student_id: 'stu-1', status: 'going' }],
      error: null,
    });
    const studentsSelectSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'stu-1', display_name: 'DB Student' }],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'teams') return { select: vi.fn(() => ({ order: teamsOrderSpy })) };
      if (table === 'attendance') return { select: attendanceSelectSpy };
      if (table === 'rsvps') return { select: rsvpsSelectSpy };
      if (table === 'students') return { select: studentsSelectSpy };
      // GAM-446 -- the seventh query this loader now runs
      // (`makeLoadCoachMeetingsData`, `loaders/meetings.ts`). Empty result;
      // this file's own dedicated coverage of the merge itself lives in
      // `loaders/meetings.test.ts`, not here.
      if (table === 'v_event_attendance')
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadCoachMeetingsData(() => client);
    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('events');
    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(fromSpy).toHaveBeenCalledWith('teams');
    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(fromSpy).toHaveBeenCalledWith('rsvps');
    expect(fromSpy).toHaveBeenCalledWith('students');

    // NAV-07 -- the outreach event's title never appears (module doc #2's
    // filter, applied by the reused `buildCoachMeetingRows`, not re-derived
    // in the loader).
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      eventId: 'event-1',
      title: 'DB Meeting',
      locationName: 'DB Location',
    });
    expect(result.rows[0].sessions).toHaveLength(1);
    expect(result.rows[0].sessions[0]).toMatchObject({ sessionId: 'session-1', expectedCt: 1 });
  });

  it('bridges the "no rows" case for all six tables to an empty rows array, not a crash', async () => {
    const nullResult = { data: null, error: null };
    // `events`/`attendance`/`rsvps`/`students` `await` the `.select()`
    // result directly (no `.order()` chain); `event_sessions`/`teams` chain
    // `.select().order()`. A single thenable-plus-`.order()` stub satisfies
    // both shapes.
    const selectResult = {
      then: (resolve: (value: typeof nullResult) => void) => resolve(nullResult),
      order: vi.fn().mockResolvedValue(nullResult),
    };
    const client = {
      from: vi.fn(() => ({ select: vi.fn(() => selectResult) })),
    } as unknown as SupabaseClient;

    const load = makeLoadCoachMeetingsData(() => client);
    const result = await load();
    // T147 -- `teams` bridges the "no rows" case the same honest way `rows`
    // always has: a real empty array, never a crash/undefined.
    expect(result).toEqual({ rows: [], teams: [] });
  });
});

describe('loadStudentMeetingsData (T096 real load; T122 .limit(1) fix)', () => {
  it('scopes attendance/participation queries to the given studentId, no .limit() on the participation query anymore', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const participationEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const activeTeamsIsSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      if (table === 'v_student_participation') {
        // T122: `.limit(1)` REMOVED -- `.eq(...)` is awaited directly now.
        return { select: vi.fn(() => ({ eq: participationEqSpy })) };
      }
      if (table === 'student_teams')
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ is: activeTeamsIsSpy })) })) };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadStudentMeetingsData(() => client);
    await load('student-42');

    expect(attendanceEqSpy).toHaveBeenCalledWith('student_id', 'student-42');
    expect(participationEqSpy).toHaveBeenCalledWith('student_id', 'student-42');
    expect(activeTeamsIsSpy).toHaveBeenCalledWith('left_on', null);
  });

  // T122's own ".limit(1)" fix decision, end-to-end: a dual-member student's
  // TWO real `v_student_participation` rows (T116's own migration doc: one
  // per membership-team) are summed, not arbitrarily reduced to one team.
  it('a dual-member student with two v_student_participation rows gets an aggregated participation figure, not an arbitrary single team', async () => {
    const eventsSelectSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    // FRC team: 5 expected, 5 present (100%). FTC team: 5 expected, 0
    // present, 0 excused (0%). T120's own twin decision's "no-arithmetic"
    // option does not apply here (no team in context at this call site --
    // this file's own module doc #10g / `loaders/meetings.ts`'s own module
    // doc), so this is the aggregate path.
    const participationEqSpy = vi.fn().mockResolvedValue({
      data: [
        {
          student_id: 'student-dual',
          team_id: 'team-frc',
          season_id: 'season-1',
          expected_ct: 5,
          present_ct: 5,
          late_ct: 0,
          excused_ct: 0,
          participation_pct: 100,
        },
        {
          student_id: 'student-dual',
          team_id: 'team-ftc',
          season_id: 'season-1',
          expected_ct: 5,
          present_ct: 0,
          late_ct: 0,
          excused_ct: 0,
          participation_pct: 0,
        },
      ],
      error: null,
    });
    const activeTeamsIsSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') return { select: eventsSelectSpy };
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      if (table === 'v_student_participation') {
        return { select: vi.fn(() => ({ eq: participationEqSpy })) };
      }
      if (table === 'student_teams')
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ is: activeTeamsIsSpy })) })) };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadStudentMeetingsData(() => client);
    const data = await load('student-dual');

    // Summed: expected 10, present 5 -> round(100*5/10, 1) = 50.0 -- NOT
    // 100% (FRC only) or 0% (FTC only), either of which `.limit(1)` could
    // have silently produced depending on row order.
    expect(data.participation).toMatchObject({
      studentId: 'student-dual',
      expectedCt: 10,
      presentCt: 5,
      participationPct: 50,
    });
  });
});

describe('aggregateParticipationRows (T122 .limit(1) fix decision)', () => {
  it('returns null for zero rows', () => {
    expect(aggregateParticipationRows([])).toBeNull();
  });

  it('passes a single row through unchanged (the common, non-dual-member case)', () => {
    const row = {
      student_id: 's1',
      team_id: 't1',
      season_id: 'season-1',
      expected_ct: 7,
      present_ct: 4,
      late_ct: 1,
      excused_ct: 0,
      participation_pct: 57.1,
    };
    // T162: `toBe`, NOT `toEqual`. The function short-circuits on
    // `rows.length === 1` and returns the SAME OBJECT. Deleting that
    // short-circuit makes it recompute -- and the recomputed object is
    // byte-identical here (round(100*4/(7-0),1) === 57.1), so `toEqual`
    // stays GREEN under that mutation and proves nothing. Reference
    // identity is the only assertion that reddens. Measured, not assumed.
    expect(aggregateParticipationRows([row])).toBe(row);
  });

  // T162: the `Math.max(expectedCt - excusedCt, 1)` denominator floor
  // (`loaders/meetings.ts:477`) had NO test -- deleting it left all 1946
  // tests green. Without it, a student whose every expected session was
  // excused divides by zero. Mirrors the same guard's coverage on the twin
  // function at `loaders/checkin.test.ts:86-93`.
  //
  // Fixture is view-possible, deliberately: if every expected session was
  // excused then none can have been attended, so `present_ct` MUST be 0.
  // That is why the mutation yields NaN rather than Infinity.
  it('guards the denominator at 1 when every expected session was excused (no divide-by-zero)', () => {
    const result = aggregateParticipationRows([
      {
        student_id: 's1',
        team_id: 'team-a',
        season_id: 'season-1',
        expected_ct: 3,
        present_ct: 0,
        late_ct: 0,
        excused_ct: 3,
        participation_pct: 0,
      },
      {
        student_id: 's1',
        team_id: 'team-b',
        season_id: 'season-1',
        expected_ct: 2,
        present_ct: 0,
        late_ct: 0,
        excused_ct: 2,
        participation_pct: 0,
      },
    ]);
    // Summed: expected 5, excused 5 -> 5 - 5 = 0 -> greatest(0, 1) = 1.
    // 100 * 0 / 1 = 0. Without the floor: 0 / 0 -> NaN.
    expect(result?.participation_pct).toBe(0);
    expect(Number.isFinite(result?.participation_pct)).toBe(true);
  });

  it("sums counters across every row and recomputes participation_pct using the view's own expression", () => {
    // Dual-member fixture: team A perfect attendance (4 expected, 4
    // present -- `present_ct` already includes late per the view's own
    // `status in ('present','late')` filter, `late_ct` is a breakdown of
    // it, never additive on top), team B one excused absence (denominator
    // shrinks) -- matches `20260717000003_metric_views.sql`'s NFR-03
    // "excused-shrinks-denominator" fixture class, applied across two rows
    // instead of one.
    const result = aggregateParticipationRows([
      {
        student_id: 's1',
        team_id: 'team-a',
        season_id: 'season-1',
        expected_ct: 4,
        present_ct: 4,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 100,
      },
      {
        student_id: 's1',
        team_id: 'team-b',
        season_id: 'season-1',
        expected_ct: 4,
        present_ct: 2, // includes 1 late (late_ct below)
        late_ct: 1,
        excused_ct: 1,
        participation_pct: 66.7, // round(100*2/(4-1),1) for THIS row alone
      },
    ]);
    // Summed: expected 8, present 6 (4+2), late 1, excused 1.
    // round(100 * 6 / greatest(8 - 1, 1), 1) = round(600/7, 1) = 85.7.
    expect(result).toMatchObject({
      expected_ct: 8,
      present_ct: 6,
      late_ct: 1,
      excused_ct: 1,
      participation_pct: 85.7,
    });
  });

  it("never double-counts: a dual member's 10h-equivalent expected/present sums exactly (D-3 personal-total posture applied to participation)", () => {
    // 10 expected / 10 present split evenly across two teams (5+5 each) --
    // the aggregate must read exactly 10/10 (100%), not 20/20 or 5/5.
    const result = aggregateParticipationRows([
      {
        student_id: 's1',
        team_id: 'team-a',
        season_id: 'season-1',
        expected_ct: 5,
        present_ct: 5,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 100,
      },
      {
        student_id: 's1',
        team_id: 'team-b',
        season_id: 'season-1',
        expected_ct: 5,
        present_ct: 5,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 100,
      },
    ]);
    expect(result).toMatchObject({ expected_ct: 10, present_ct: 10, participation_pct: 100 });
  });
});

describe('cancelMeetingSession (T096 real mutation)', () => {
  it('calls event_sessions.update({ status: "canceled" }).eq("id", sessionId) with exactly the targeted id', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ update: updateSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const cancel = makeCancelMeetingSession(() => client);
    await cancel('session-99');

    expect(fromSpy).toHaveBeenCalledWith('event_sessions');
    expect(updateSpy).toHaveBeenCalledWith({ status: 'canceled' });
    expect(eqSpy).toHaveBeenCalledWith('id', 'session-99');
  });

  it('rejects with the real SupabaseLoaderError on a genuine mutation error', async () => {
    const eqSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'nope', code: '42501' } });
    const client = {
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: eqSpy })) })),
    } as unknown as SupabaseClient;

    const cancel = makeCancelMeetingSession(() => client);
    await expect(cancel('session-99')).rejects.toMatchObject({ code: '42501' });
  });
});

/**
 * T605 §7 test 9 -- the write-side guard, fake-client, full chain depth.
 * Precedent: `buildAC9FakeClient` (T510, AC9, below in this file), whose own
 * doc comment explains why a shallow mirror is insufficient (its mock does
 * not resolve `{data, error}` until `.select(...)` is actually reached).
 * This mock covers the full `update -> eq -> eq -> gt -> select` chain the
 * same way, for `makeSaveMeetingSession` instead of the series delete guard.
 */
function buildSaveMeetingSessionFakeClient(outcome: 'ok' | 'zero'): {
  client: SupabaseClient;
  updateSpy: ReturnType<typeof vi.fn>;
} {
  const updateSpy = vi.fn();
  const client = {
    from: vi.fn((table: string) => {
      if (table !== 'event_sessions') throw new Error(`unexpected table: ${table}`);
      return {
        update: (patch: Record<string, unknown>) => {
          updateSpy(patch);
          return {
            eq: () => ({
              eq: () => ({
                gt: () => ({
                  // Nothing resolves a real `{data, error}` shape until
                  // `.select(...)` is actually reached -- dropping
                  // `.select('id')` in production would make `.gt(...)`'s
                  // return value (a plain `{ select }` object) the awaited
                  // result instead.
                  select: () =>
                    outcome === 'zero'
                      ? Promise.resolve({ data: [], error: null })
                      : Promise.resolve({ data: [{ id: 'sess-x' }], error: null }),
                }),
              }),
            }),
          };
        },
      };
    }),
  } as unknown as SupabaseClient;
  return { client, updateSpy };
}

const SAVE_MEETING_SESSION_SAMPLE_PAYLOAD: SaveMeetingSessionPayload = {
  sessionId: 'sess-x',
  sessionDate: '2099-01-01',
  startsAt: '2099-01-01T23:00:00.000Z',
  endsAt: '2099-01-02T01:00:00.000Z',
  notes: 'Updated notes.',
};

describe('saveMeetingSession (T605, write-side guard, full chain depth)', () => {
  it('the .update({...}) argument object has exactly the keys session_date, starts_at, ends_at, notes', async () => {
    const { client, updateSpy } = buildSaveMeetingSessionFakeClient('ok');
    const save = makeSaveMeetingSession(() => client);
    await save(SAVE_MEETING_SESSION_SAMPLE_PAYLOAD);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const patch = updateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(patch).sort()).toEqual(['ends_at', 'notes', 'session_date', 'starts_at']);
    expect(patch).toEqual({
      session_date: SAVE_MEETING_SESSION_SAMPLE_PAYLOAD.sessionDate,
      starts_at: SAVE_MEETING_SESSION_SAMPLE_PAYLOAD.startsAt,
      ends_at: SAVE_MEETING_SESSION_SAMPLE_PAYLOAD.endsAt,
      notes: SAVE_MEETING_SESSION_SAMPLE_PAYLOAD.notes,
    });
  });

  it('a non-empty result resolves without throwing', async () => {
    const { client } = buildSaveMeetingSessionFakeClient('ok');
    const save = makeSaveMeetingSession(() => client);
    await expect(save(SAVE_MEETING_SESSION_SAMPLE_PAYLOAD)).resolves.toBeUndefined();
  });

  it("an empty-array result REJECTS with a real error -- named mutation: dropping .select('id') from the production chain must break this describe block's own proof that .select('id') is load-bearing (see worker output for the measured before/after)", async () => {
    const { client } = buildSaveMeetingSessionFakeClient('zero');
    const save = makeSaveMeetingSession(() => client);
    await expect(save(SAVE_MEETING_SESSION_SAMPLE_PAYLOAD)).rejects.toThrow();
  });
});

describe('resolveCurrentStudentId (T096, Trap #4 real resolution)', () => {
  it('a student resolves via students.profile_id = auth.uid()', async () => {
    const maybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'student-real-id' }, error: null });
    const eqSpy = vi.fn(() => ({ maybeSingle: maybeSingleSpy }));
    const fromSpy = vi.fn(() => ({ select: vi.fn(() => ({ eq: eqSpy })) }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-student-1', role: 'student' });

    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(eqSpy).toHaveBeenCalledWith('profile_id', 'profile-student-1');
    expect(result).toBe('student-real-id');
  });

  it('a student with no linked row resolves null, not a crash', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-student-2', role: 'student' });
    expect(result).toBeNull();
  });

  it("a parent resolves via their EARLIEST-linked guardian_links row (Trap #4's documented limitation)", async () => {
    const limitSpy = vi.fn().mockResolvedValue({
      data: [{ student_id: 'student-earliest' }],
      error: null,
    });
    const orderSpy = vi.fn(() => ({ limit: limitSpy }));
    const eqSpy = vi.fn(() => ({ order: orderSpy }));
    const fromSpy = vi.fn(() => ({ select: vi.fn(() => ({ eq: eqSpy })) }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-parent-1', role: 'parent' });

    expect(fromSpy).toHaveBeenCalledWith('guardian_links');
    expect(eqSpy).toHaveBeenCalledWith('parent_profile_id', 'profile-parent-1');
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(limitSpy).toHaveBeenCalledWith(1);
    expect(result).toBe('student-earliest');
  });

  // T162: the test above asserts the sort was REQUESTED, not that it WORKED --
  // its `orderSpy` ignores its arguments and the fixture resolves the same row
  // either way, so deleting `.order('created_at', {ascending:true})` from
  // `loaders/meetings.ts:512` leaves it GREEN. That matters here specifically:
  // Trap #4's rule is EARLIEST-linked child, so a parent with two children
  // silently resolves to the wrong one if the ordering is lost.
  //
  // This fake instead SORTS PHYSICALLY, and only when `.order()` is called.
  // The rows are seeded in reverse `created_at` order, so an unsorted read
  // returns the LATER-linked child and the assertion reddens.
  it('a parent with TWO linked students resolves the earliest-linked one -- outcome-provable, not call-shape', async () => {
    const linkRows = [
      { student_id: 'student-later', created_at: '2026-03-01T00:00:00Z' },
      { student_id: 'student-earliest', created_at: '2026-01-01T00:00:00Z' },
    ];

    const makeChain = (rows: readonly { student_id: string; created_at: string }[]) => ({
      order: (column: string, opts?: { ascending?: boolean }) =>
        makeChain(
          [...rows].sort((a, b) => {
            const dir = opts?.ascending === false ? -1 : 1;
            const av = String(a[column as 'created_at']);
            const bv = String(b[column as 'created_at']);
            return av < bv ? -dir : av > bv ? dir : 0;
          }),
        ),
      limit: (n: number) =>
        Promise.resolve({
          data: rows.slice(0, n).map(({ student_id }) => ({ student_id })),
          error: null,
        }),
    });

    const client = {
      from: () => ({ select: () => ({ eq: () => makeChain(linkRows) }) }),
    } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-parent-1', role: 'parent' });

    // Seeded later-first. With `.order(...)` the earliest wins; without it,
    // `.limit(1)` takes `student-later` and this fails on a real value.
    expect(result).toBe('student-earliest');
  });

  it('a parent with zero linked students resolves null, not a crash', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) })),
          })),
        })),
      })),
    } as unknown as SupabaseClient;

    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-parent-2', role: 'parent' });
    expect(result).toBeNull();
  });

  it('a coach/admin resolves null defensively (this function is never actually called for that role in real use)', async () => {
    const client = { from: vi.fn() } as unknown as SupabaseClient;
    const resolve = makeResolveCurrentStudentId(() => client);
    const result = await resolve({ id: 'profile-coach-1', role: 'coach' });
    expect(result).toBeNull();
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe('createMeetings (T096, Trap #3 real onCreateMeetings default)', () => {
  const SAMPLE_PAYLOAD: CreateMeetingsPayload = {
    event: {
      title: 'Weekly Build',
      teamIds: null,
      locationName: 'Robotics Lab',
      description: '',
      address: '',
    },
    sessions: [
      {
        sessionDate: '2026-08-05',
        startsAt: '2026-08-06T00:00:00.000Z',
        endsAt: '2026-08-06T02:00:00.000Z',
        notes: '',
      },
    ],
  };

  it('resolves the active season, then inserts one events row + one event_sessions row per date', async () => {
    const seasonMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'season-active-1' }, error: null });
    const eventSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { id: 'event-created-1' }, error: null });
    const eventSelectSpy = vi.fn(() => ({ single: eventSingleSpy }));
    const eventInsertSpy = vi.fn(() => ({ select: eventSelectSpy }));
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

    const create = makeCreateMeetings(() => client);
    await create(SAMPLE_PAYLOAD);

    expect(eventInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        season_id: 'season-active-1',
        type: 'meeting',
        title: 'Weekly Build',
        location_name: 'Robotics Lab',
        team_ids: null,
      }),
    );
    expect(sessionsInsertSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        event_id: 'event-created-1',
        session_date: '2026-08-05',
        status: 'scheduled',
      }),
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

    const create = makeCreateMeetings(() => client);
    await expect(create(SAMPLE_PAYLOAD)).rejects.toThrow(/No active season/);
  });
});

// ---------------------------------------------------------------------------
// T510 -- saveMeetingSeries (worker packet §4b/§8, AC8/AC9). Far-future
// (year 2099) session dates throughout, since `makeSaveMeetingSeries`'s own
// `now` (the D015/D016-required FRESH now, independent of the dialog's own
// confirmation-preview `now`) is a real, un-injectable `new Date()` -- these
// fixtures must stay "future" regardless of when this suite actually runs.
// ---------------------------------------------------------------------------

interface FakeExistingSessionRow {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

describe('saveMeetingSeries (T510, AC8 partial events update)', () => {
  it('AC8: the .update({...}) argument object has EXACTLY the keys title, team_ids, location_name, description', async () => {
    const eventsUpdateSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return {
            update: (patch: Record<string, unknown>) => ({
              eq: (...args: unknown[]) => eventsUpdateSpy(patch, ...args),
            }),
          };
        }
        if (table === 'event_sessions') {
          return { select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const save = makeSaveMeetingSeries(() => client);
    const payload: SaveMeetingSeriesPayload = {
      eventId: 'event-1',
      event: {
        title: 'New title',
        teamIds: ['team-a'],
        locationName: 'New location',
        description: 'New description',
        address: 'ignored-by-the-update-mutation',
      },
      desiredFutureSessions: [],
    };
    await save(payload);

    expect(eventsUpdateSpy).toHaveBeenCalledTimes(1);
    const [patch, , eventId] = eventsUpdateSpy.mock.calls[0] as [
      Record<string, unknown>,
      string,
      string,
    ];
    expect(Object.keys(patch).sort()).toEqual([
      'description',
      'location_name',
      'team_ids',
      'title',
    ]);
    expect(patch).toEqual({
      title: 'New title',
      team_ids: ['team-a'],
      location_name: 'New location',
      description: 'New description',
    });
    expect(eventId).toBe('event-1');
  });
});

/**
 * AC9's shared fake client. Records every call by intent onto ONE ordered
 * `log`, so per-id sequencing assertions (Branch A) are checkable, and covers
 * the FULL four-deep `delete -> eq -> gt -> select` chain (D016 §5/Q4) for
 * `deleteSessionIfStillFuture` -- not a one-filter-deep mirror like
 * `TeamsTab.test.tsx:1185-1195`'s own precedent (that precedent is cited for
 * SHAPE only; this mock's own `event_sessions.delete()` branch does not
 * resolve anything until `.select(...)` is actually called, so a mutation
 * that drops `.select('id')` changes this mock's own observable behavior,
 * not just the production code's).
 */
function buildAC9FakeClient(options: {
  existingSessions: FakeExistingSessionRow[];
  stillFutureIds: string[];
  attendanceSessionIds: string[];
  deleteOutcomeById: Record<string, 'ok' | 'zero' | '23503'>;
}): {
  client: SupabaseClient;
  log: Array<{ type: string; id?: string; ids?: string[] }>;
} {
  const log: Array<{ type: string; id?: string; ids?: string[] }> = [];

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'events') {
        return {
          update: () => ({
            eq: () => {
              log.push({ type: 'eventsUpdate' });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === 'event_sessions') {
        return {
          select: (columns: string) => {
            if (columns === 'id') {
              // queryStillFutureSessionIds -- `.select('id').in(...).gt(...)`.
              return {
                in: () => ({
                  gt: () =>
                    Promise.resolve({
                      data: options.stillFutureIds.map((id) => ({ id })),
                      error: null,
                    }),
                }),
              };
            }
            // queryEditableSessionsForEvent -- `.select('id, ...').eq('event_id', ...)`.
            return { eq: () => Promise.resolve({ data: options.existingSessions, error: null }) };
          },
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, id: string) => {
              if ('status' in patch) {
                log.push({ type: 'cancelEq', id });
              } else {
                log.push({ type: 'updateTimeEq', id });
              }
              return Promise.resolve({ data: null, error: null });
            },
            in: (_col: string, ids: readonly string[]) => {
              log.push({ type: 'cancelBatchIn', ids: [...ids] });
              return Promise.resolve({ data: null, error: null });
            },
          }),
          insert: () => {
            log.push({ type: 'sessionsInsert' });
            return Promise.resolve({ data: null, error: null });
          },
          // The FULL four-deep chain (D016 §5/Q4): nothing resolves a real
          // `{data, error}` shape until `.select(...)` is actually reached --
          // dropping `.select('id')` in production would make `.gt(...)`'s
          // return value (a plain `{ select }` object) the awaited result
          // instead, which is exactly the named mutation's own effect
          // (`deletedRows` becomes `undefined` for EVERY call).
          delete: () => ({
            eq: (_col: string, id: string) => ({
              gt: () => ({
                select: () => {
                  log.push({ type: 'sessionDeleteEqGtSelect', id });
                  const outcome = options.deleteOutcomeById[id] ?? 'ok';
                  if (outcome === '23503') {
                    return Promise.resolve({
                      data: null,
                      error: { message: 'FK violation', code: '23503' },
                    });
                  }
                  if (outcome === 'zero') {
                    return Promise.resolve({ data: [], error: null });
                  }
                  return Promise.resolve({ data: [{ id }], error: null });
                },
              }),
            }),
          }),
        };
      }
      if (table === 'rsvps') {
        return {
          delete: () => ({
            eq: (_col: string, id: string) => {
              log.push({ type: 'rsvpsDelete', id });
              return Promise.resolve({ data: null, error: null });
            },
          }),
        };
      }
      if (table === 'attendance') {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: options.attendanceSessionIds.map((id) => ({ session_id: id })),
                error: null,
              }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient;

  return { client, log };
}

const AC9_SAMPLE_EVENT: SaveMeetingSeriesPayload['event'] = {
  title: 'Weekly Build Meeting',
  teamIds: null,
  locationName: 'Robotics Lab',
  description: '',
  address: '',
};

function ac9Session(
  id: string,
  dateSeed: number,
  status: FakeExistingSessionRow['status'] = 'scheduled',
): FakeExistingSessionRow {
  const date = `2099-01-${String(dateSeed).padStart(2, '0')}`;
  return {
    id,
    session_date: date,
    starts_at: `${date}T23:00:00.000Z`,
    ends_at: `2099-01-${String(dateSeed + 1).padStart(2, '0')}T01:00:00.000Z`,
    status,
  };
}

describe("saveMeetingSeries (T510, AC9 -- D015-ruled per-session-paired removal, D016's f2 fix, six branches)", () => {
  it("Branch A (clean, at least two ids, no attendance): per-id ordering (rsvps delete before that SAME id's session delete), the chain ends .select('id'), no update call for either", async () => {
    const sessionX = ac9Session('session-x', 1);
    const sessionY = ac9Session('session-y', 8);
    const { client, log } = buildAC9FakeClient({
      existingSessions: [sessionX, sessionY],
      stillFutureIds: ['session-x', 'session-y'],
      attendanceSessionIds: [],
      deleteOutcomeById: {},
    });
    const save = makeSaveMeetingSeries(() => client);

    await save({ eventId: 'event-1', event: AC9_SAMPLE_EVENT, desiredFutureSessions: [] });

    for (const id of ['session-x', 'session-y']) {
      const rsvpIndex = log.findIndex((entry) => entry.type === 'rsvpsDelete' && entry.id === id);
      const deleteIndex = log.findIndex(
        (entry) => entry.type === 'sessionDeleteEqGtSelect' && entry.id === id,
      );
      expect(rsvpIndex).toBeGreaterThanOrEqual(0);
      expect(deleteIndex).toBeGreaterThanOrEqual(0);
      // That id's OWN rsvps delete happens strictly before that SAME id's
      // OWN session delete (D015 §2's ordering) -- the FULL chain, not just
      // a first-filter mirror (D016 §5/Q4): `sessionDeleteEqGtSelect` is
      // only ever logged once `.select(...)` is reached.
      expect(rsvpIndex).toBeLessThan(deleteIndex);
    }
    expect(log.some((entry) => entry.type === 'cancelEq')).toBe(false);
    expect(log.some((entry) => entry.type === 'cancelBatchIn')).toBe(false);
  });

  it('Branch B (unchanged, batched): an id with attendance is batch-canceled and its RSVPs are never touched', async () => {
    const sessionWithAttendance = ac9Session('session-attend', 1);
    const { client, log } = buildAC9FakeClient({
      existingSessions: [sessionWithAttendance],
      stillFutureIds: ['session-attend'],
      attendanceSessionIds: ['session-attend'],
      deleteOutcomeById: {},
    });
    const save = makeSaveMeetingSeries(() => client);

    await save({ eventId: 'event-1', event: AC9_SAMPLE_EVENT, desiredFutureSessions: [] });

    const batchCancel = log.find((entry) => entry.type === 'cancelBatchIn');
    expect(batchCancel).toBeDefined();
    expect(batchCancel?.ids).toEqual(['session-attend']);
    expect(log.some((entry) => entry.type === 'rsvpsDelete' && entry.id === 'session-attend')).toBe(
      false,
    );
    expect(log.some((entry) => entry.type === 'sessionDeleteEqGtSelect')).toBe(false);
  });

  it("Branch C (unchanged, batched): an id absent from queryStillFutureSessionIds's result never reaches any subsequent delete/cancel/attendance-check call", async () => {
    const sessionStillFuture = ac9Session('session-safe', 1);
    const sessionRaced = ac9Session('session-raced', 8);
    const { client, log } = buildAC9FakeClient({
      existingSessions: [sessionStillFuture, sessionRaced],
      // Only ONE of the two toRemove candidates is still future by the time
      // this guard runs.
      stillFutureIds: ['session-safe'],
      attendanceSessionIds: [],
      deleteOutcomeById: {},
    });
    const save = makeSaveMeetingSeries(() => client);

    await save({ eventId: 'event-1', event: AC9_SAMPLE_EVENT, desiredFutureSessions: [] });

    expect(log.some((entry) => entry.id === 'session-raced')).toBe(false);
    expect(
      log.some((entry) => entry.type === 'sessionDeleteEqGtSelect' && entry.id === 'session-safe'),
    ).toBe(true);
  });

  it("Branch D (LOAD-BEARING, the 23503 trigger): X is canceled and X ONLY; Y is genuinely deleted and receives no update call; Y's own rsvps delete is independent of X; no update call ever targets both; the save resolves", async () => {
    const sessionX = ac9Session('session-x', 1);
    const sessionY = ac9Session('session-y', 8);
    const { client, log } = buildAC9FakeClient({
      existingSessions: [sessionX, sessionY],
      stillFutureIds: ['session-x', 'session-y'],
      attendanceSessionIds: [],
      deleteOutcomeById: { 'session-x': '23503', 'session-y': 'ok' },
    });
    const save = makeSaveMeetingSeries(() => client);

    await expect(
      save({ eventId: 'event-1', event: AC9_SAMPLE_EVENT, desiredFutureSessions: [] }),
    ).resolves.toBeUndefined();

    const cancelEntries = log.filter((entry) => entry.type === 'cancelEq');
    expect(cancelEntries).toEqual([{ type: 'cancelEq', id: 'session-x' }]);
    expect(log.some((entry) => entry.type === 'cancelBatchIn')).toBe(false);
    expect(log.some((entry) => entry.type === 'rsvpsDelete' && entry.id === 'session-y')).toBe(
      true,
    );
    expect(
      log.some((entry) => entry.type === 'sessionDeleteEqGtSelect' && entry.id === 'session-y'),
    ).toBe(true);
  });

  it('Branch E: a non-23503 error on either half of any pair rejects the overall save', async () => {
    const sessionX = ac9Session('session-x', 1);
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'events') {
          return { update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) };
        }
        if (table === 'event_sessions') {
          return {
            select: (columns: string) => {
              if (columns === 'id') {
                return {
                  in: () => ({
                    gt: () => Promise.resolve({ data: [{ id: 'session-x' }], error: null }),
                  }),
                };
              }
              return { eq: () => Promise.resolve({ data: [sessionX], error: null }) };
            },
            delete: () => ({
              eq: () => ({
                gt: () => ({
                  select: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: 'unexpected failure', code: 'UNEXPECTED' },
                    }),
                }),
              }),
            }),
          };
        }
        if (table === 'rsvps') {
          return { delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) };
        }
        if (table === 'attendance') {
          return { select: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) };
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    } as unknown as SupabaseClient;

    const save = makeSaveMeetingSeries(() => client);
    await expect(
      save({ eventId: 'event-1', event: AC9_SAMPLE_EVENT, desiredFutureSessions: [] }),
    ).rejects.toMatchObject({ code: 'UNEXPECTED' });
  });

  it("Branch F (NEW, D016's load-bearing assertion, the ZERO-ROW trigger): X's guarded delete resolves { data: [], error: null } (no rejection) -- X is canceled and X ONLY, Y is genuinely deleted and receives no update call, the save resolves", async () => {
    const sessionX = ac9Session('session-x', 1);
    const sessionY = ac9Session('session-y', 8);
    const { client, log } = buildAC9FakeClient({
      existingSessions: [sessionX, sessionY],
      stillFutureIds: ['session-x', 'session-y'],
      attendanceSessionIds: [],
      deleteOutcomeById: { 'session-x': 'zero', 'session-y': 'ok' },
    });
    const save = makeSaveMeetingSeries(() => client);

    await expect(
      save({ eventId: 'event-1', event: AC9_SAMPLE_EVENT, desiredFutureSessions: [] }),
    ).resolves.toBeUndefined();

    const cancelEntries = log.filter((entry) => entry.type === 'cancelEq');
    expect(cancelEntries).toEqual([{ type: 'cancelEq', id: 'session-x' }]);
    expect(
      log.some((entry) => entry.type === 'sessionDeleteEqGtSelect' && entry.id === 'session-y'),
    ).toBe(true);
    expect(log.some((entry) => entry.type === 'cancelEq' && entry.id === 'session-y')).toBe(false);
  });
});
