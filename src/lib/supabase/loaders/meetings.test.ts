// GAM-305 (legacy T615) criterion 5 -- select-string guard for the `teams`
// query this loader's `queryTeams` runs, mirroring `outreach.test.ts`'s own
// `parseSelectedColumns` T146 guard pattern (cited by this task's packet).
// `tsc` cannot catch a dropped `archived` column here: `meetings.ts:405`
// casts the query result to `TeamDbRow[] | null`, which *asserts* `archived`
// is present regardless of what the query actually asked for -- only reading
// the recorded `.select()` argument catches a revert.
//
// This is the FIRST test file for this loader module (no `meetings.test.ts`
// existed before this task, per the packet's own Allowed Files note).
//
// No `@vitest-environment jsdom` docblock -- `meetings.ts` value-imports two
// LAZY page modules (`MeetingsList.tsx`/`ScheduleMeetingsDialog.tsx`, see
// `src/lib/meetings/resolveCurrentStudentId.ts`'s own module doc), but
// neither of those pulls in any DOM-dependent code path this test exercises
// -- `outreach.test.ts`/`coachHome.test.ts` establish the same "loader tests
// run in vitest's default node environment" posture for this directory.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadCoachMeetingsData } from './meetings';

/** Same helper `outreach.test.ts` already established for this exact
 * purpose -- reused verbatim, not re-derived. */
function parseSelectedColumns(selectArg: unknown): Set<string> {
  const raw = String(selectArg);
  if (raw.trim() === '*') return new Set(['*']);
  return new Set(raw.split(',').map((column) => column.trim()));
}

/** Thenable passthrough chain -- `queryTeams`/`querySessions` chain
 * `.order(...)` after `.select(...)`, `queryEvents`/`queryAttendance`/
 * `queryRsvps`/`queryStudents` await `.select(...)` directly. Both shapes
 * are supported by making the returned object both thenable AND carry an
 * `.order()` method that resolves the same way. */
function makeThenableChain(rows: unknown[] | null) {
  const resolved = Promise.resolve({ data: rows, error: null });
  const orderSpy = vi.fn(() => resolved);
  return {
    then: resolved.then.bind(resolved),
    order: orderSpy,
    orderSpy,
  };
}

type ExtraRows = Partial<Record<string, unknown[] | null>>;

function makeRecordingClient(teams: unknown[] | null, extra: ExtraRows = {}) {
  const teamsChain = makeThenableChain(teams);
  const teamsSelectSpy = vi.fn(() => teamsChain);

  // GAM-446 -- `v_event_attendance` added as the seventh table this loader's
  // batch queries. Without this, the new select-string guard below cannot
  // even run: `makeRecordingClient`'s `fromSpy` throws `unexpected table:
  // v_event_attendance` at the line above before the guard gets a chance.
  const OTHER_TABLES = [
    'events',
    'event_sessions',
    'attendance',
    'rsvps',
    'students',
    'v_event_attendance',
  ] as const;
  const selectSpies: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const table of OTHER_TABLES) {
    const chain = makeThenableChain(extra[table] ?? []);
    selectSpies[table] = vi.fn(() => chain);
  }

  const fromSpy = vi.fn((table: string) => {
    if (table === 'teams') return { select: teamsSelectSpy };
    if (selectSpies[table]) return { select: selectSpies[table] };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    teamsSelectSpy,
    teamsChain,
    // GAM-446 -- exposed so tests can inspect the select-string sent to
    // `v_event_attendance` (and, in principle, any other `OTHER_TABLES`
    // member) without adding a bespoke spy per table.
    selectSpies,
  };
}

// ---------------------------------------------------------------------------
// GAM-446 fixture builders -- minimal `type: 'meeting'` event + session rows
// so `buildCoachMeetingRows` (`../../meetings/coachModel.ts`, untouched by
// this task) produces a real `CoachMeetingRow` to merge `v_event_attendance`
// onto. `coachModel.ts`'s own `if (eventSessions.length === 0) continue`
// means an event needs at least one session to become a row at all (this
// file's own module doc, GAM-446 section).
// ---------------------------------------------------------------------------

function makeMeetingEventRow(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    season_id: 'season-1',
    type: 'meeting',
    title: `Meeting ${id}`,
    team_ids: null,
    counts_participation: true,
    location_name: 'Room 1',
    address: '1 Main St',
    description: '',
    ...overrides,
  };
}

function makeSessionRow(
  id: string,
  eventId: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    event_id: eventId,
    session_date: '2026-07-01',
    starts_at: '2026-07-01T23:00:00.000Z',
    ends_at: '2026-07-02T01:00:00.000Z',
    status: 'completed',
    notes: '',
    ...overrides,
  };
}

describe('queryEventAttendance (via makeLoadCoachMeetingsData) -- GAM-446', () => {
  it('asks v_event_attendance for all six columns (select-string guard); OTHER_TABLES lets the query actually run', async () => {
    const { client, selectSpies } = makeRecordingClient([], {
      events: [makeMeetingEventRow('event-1')],
      event_sessions: [makeSessionRow('session-1', 'event-1')],
      v_event_attendance: [
        {
          event_id: 'event-1',
          held_ct: 2,
          graded_marks_ct: 5,
          excused_ct: 1,
          attended_marks_ct: 3,
          attendance_pct: 75,
        },
      ],
    });

    const load = makeLoadCoachMeetingsData(() => client);
    await load();

    expect(selectSpies['v_event_attendance']).toHaveBeenCalledTimes(1);
    const [recordedSelectArg] = selectSpies['v_event_attendance'].mock.calls[0] as unknown as [
      string,
    ];
    const columns = parseSelectedColumns(recordedSelectArg);
    for (const column of [
      'event_id',
      'held_ct',
      'graded_marks_ct',
      'excused_ct',
      'attended_marks_ct',
      'attendance_pct',
    ]) {
      expect(columns.has('*') || columns.has(column)).toBe(true);
    }
  });

  it('fires all seven from() calls synchronously, in one batch -- not a second round trip', async () => {
    const { client, fromSpy } = makeRecordingClient([]);
    const load = makeLoadCoachMeetingsData(() => client);
    const pending = load();
    // Assertion runs BEFORE `pending` is awaited -- proves the seventh query
    // (`v_event_attendance`) fires in the SAME synchronous batch as the
    // other six, not a second round trip issued only after they settle.
    expect(fromSpy.mock.calls.length).toBe(7);
    const calledTables = new Set(fromSpy.mock.calls.map((call) => call[0]));
    expect(calledTables.size).toBe(7);
    await pending;
  });

  it('passes attendance_pct through as null, never fabricating 0 -- and a real 0 survives as 0, not conflated with null', async () => {
    const { client } = makeRecordingClient([], {
      events: [makeMeetingEventRow('event-null'), makeMeetingEventRow('event-zero')],
      event_sessions: [
        makeSessionRow('session-null', 'event-null'),
        makeSessionRow('session-zero', 'event-zero'),
      ],
      v_event_attendance: [
        {
          event_id: 'event-null',
          held_ct: 3,
          graded_marks_ct: 0,
          excused_ct: 0,
          attended_marks_ct: 0,
          attendance_pct: null,
        },
        {
          event_id: 'event-zero',
          held_ct: 3,
          graded_marks_ct: 6,
          excused_ct: 0,
          attended_marks_ct: 0,
          attendance_pct: 0,
        },
      ],
    });

    const load = makeLoadCoachMeetingsData(() => client);
    const data = await load();

    const nullRow = data.rows.find((row) => row.eventId === 'event-null');
    const zeroRow = data.rows.find((row) => row.eventId === 'event-zero');
    expect(nullRow?.attendancePct).toBeNull();
    expect(zeroRow?.attendancePct).toBe(0);
  });

  it('held_ct (SESSIONS) and graded_marks_ct (MARKS) land in their own fields, not conflated, and gradedMarksCt reaches the row', async () => {
    const { client } = makeRecordingClient([], {
      events: [makeMeetingEventRow('event-1')],
      event_sessions: [makeSessionRow('session-1', 'event-1')],
      v_event_attendance: [
        {
          event_id: 'event-1',
          held_ct: 20,
          graded_marks_ct: 40,
          excused_ct: 5,
          attended_marks_ct: 30,
          attendance_pct: 85.7,
        },
      ],
    });

    const load = makeLoadCoachMeetingsData(() => client);
    const data = await load();

    const row = data.rows.find((row) => row.eventId === 'event-1');
    expect(row?.heldCt).toBe(20);
    expect(row?.gradedMarksCt).toBe(40);
    expect(row?.excusedCt).toBe(5);
    expect(row?.attendedMarksCt).toBe(30);
  });

  it('merges by eventId, not array position -- view rows arriving in a different order than the events still land on the right row', async () => {
    const { client } = makeRecordingClient([], {
      events: [makeMeetingEventRow('event-1'), makeMeetingEventRow('event-2')],
      event_sessions: [
        makeSessionRow('session-1', 'event-1'),
        makeSessionRow('session-2', 'event-2'),
      ],
      // Deliberately reversed relative to `events` above -- if the merge
      // ever regressed to indexing by array position, `event-1`'s row would
      // wrongly get `event-2`'s values (heldCt 9, attendancePct 100).
      v_event_attendance: [
        {
          event_id: 'event-2',
          held_ct: 9,
          graded_marks_ct: 9,
          excused_ct: 0,
          attended_marks_ct: 9,
          attendance_pct: 100,
        },
        {
          event_id: 'event-1',
          held_ct: 1,
          graded_marks_ct: 1,
          excused_ct: 0,
          attended_marks_ct: 0,
          attendance_pct: 0,
        },
      ],
    });

    const load = makeLoadCoachMeetingsData(() => client);
    const data = await load();

    const row1 = data.rows.find((row) => row.eventId === 'event-1');
    const row2 = data.rows.find((row) => row.eventId === 'event-2');
    expect(row1?.heldCt).toBe(1);
    expect(row1?.attendancePct).toBe(0);
    expect(row2?.heldCt).toBe(9);
    expect(row2?.attendancePct).toBe(100);
  });
});

describe('queryTeams (via makeLoadCoachMeetingsData) -- GAM-305 criterion 5 select-string guard', () => {
  it("asks the `teams` table for `archived` (plus `id`/`name`), and threads a stubbed row's archived flag through to the loader's result", async () => {
    const { client, teamsSelectSpy } = makeRecordingClient([
      { id: 'team-active', name: 'Active Team', archived: false },
      { id: 'team-archived', name: 'Legacy Forge', archived: true },
    ]);

    const load = makeLoadCoachMeetingsData(() => client);
    const data = await load();

    expect(teamsSelectSpy).toHaveBeenCalledTimes(1);
    const [recordedSelectArg] = teamsSelectSpy.mock.calls[0] as unknown as [string];
    const columns = parseSelectedColumns(recordedSelectArg);
    const askedForArchived = columns.has('*') || columns.has('archived');
    expect(askedForArchived).toBe(true);
    if (!columns.has('*')) {
      expect(columns.has('id')).toBe(true);
      expect(columns.has('name')).toBe(true);
    }

    // The mapper hop (`mapTeamDbRow`): a stubbed `archived` on the raw DB
    // row must survive into the loader's own `teams` result, not just get
    // asked for.
    expect(data.teams).toEqual([
      { id: 'team-active', name: 'Active Team', archived: false },
      { id: 'team-archived', name: 'Legacy Forge', archived: true },
    ]);
  });

  it('resolves an empty array (never null) for teams when zero rows are found', async () => {
    const { client } = makeRecordingClient(null);
    const load = makeLoadCoachMeetingsData(() => client);
    const data = await load();
    expect(data.teams).toEqual([]);
  });
});
