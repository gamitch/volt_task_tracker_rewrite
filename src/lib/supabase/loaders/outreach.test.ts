// T146: the first test in `src/lib/supabase/loaders/` -- guards the loader
// hop T143 fixed (`queryAllTeams`'s `.select()` growing `color`) against a
// silent revert. `tsc` cannot catch a dropped column here: `outreach.ts:734`
// casts the query result to `TeamDbRow[] | null`, which *asserts* `color` is
// present regardless of what the query actually asked for. This test reads
// the recorded `.select()` argument for the `teams` query directly, so a
// revert to `.select('id, name')` fails it even though the cast still
// compiles and every other DOM/loader test stays green (see this task's
// packet for the reverted-string reproduction).
//
// No `@vitest-environment jsdom` docblock -- `outreach.ts` only imports page
// types (`import type`), so this exercises pure loader logic in vitest's
// default node environment.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  makeLoadGuardianLinksForParent,
  makeLoadOutreachData,
  makeLoadOutreachDetail,
  makeMarkDayComplete,
  OUTREACH_ATTENDANCE_PAGE_SIZE,
  type OutreachAttendanceWriteRow,
  type OutreachMarkDayCompletePayload,
} from './outreach';

/**
 * Splits a recorded `.select()` argument into a normalised set of column
 * names (split on `,`, trim). A bare `'*'` is returned as its own single-
 * element set -- `select('*')` returns every column, so it satisfies any
 * "does the select ask for column X" check by construction (it's the
 * existing pattern for this exact table: `teams.ts:173`, `students.ts:185`).
 * Asserting against this parsed set, rather than string-equality against a
 * literal like `'id, name, color'`, means a harmless reordering or
 * whitespace change never fails the test -- only an actually-dropped column
 * does.
 */
function parseSelectedColumns(selectArg: unknown): Set<string> {
  const raw = String(selectArg);
  if (raw.trim() === '*') return new Set(['*']);
  return new Set(raw.split(',').map((column) => column.trim()));
}

describe('queryAllTeams (via makeLoadOutreachDetail) -- T146 select-string guard', () => {
  it("asks the `teams` table for `color` (plus `id`/`name`), and threads a stubbed row's color through to the loader's result", async () => {
    // `outreach.ts:873` short-circuits (`if (eventRow === null) return null`)
    // before the teams query ever fires, so the event stub MUST resolve a
    // non-null row -- a minimal one suffices since
    // `mapEventDbRowToOutreachDetailEvent` is a pure field copy.
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
        created_by: null,
      },
      error: null,
    });
    // Empty sessions: `.in()` for rsvps is only reached when the sessions
    // stub returns a non-empty array, so leaving it empty keeps `rsvps`
    // (and, since `created_by` is null above, `profiles`) out of the picture
    // entirely -- this test only needs to observe the `teams` query.
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const studentsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    // The recorder: captures the exact argument `queryAllTeams` passes to
    // `.select()` for the `teams` table, per this task's injectable-seam
    // instruction (`makeLoadOutreachDetail`'s `getClient` factory) rather
    // than exporting the module-private `queryAllTeams` itself.
    const teamsSelectSpy = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [{ id: 't1', name: 'Ravens', color: 'blue' }],
        error: null,
      }),
    }));

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventMaybeSingleSpy })) })),
        };
      }
      if (table === 'event_sessions') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: sessionsOrderSpy })) })) };
      }
      if (table === 'students') {
        return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      }
      if (table === 'teams') {
        return { select: teamsSelectSpy };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadOutreachDetail(() => client);
    const result = await load('event-1');

    expect(teamsSelectSpy).toHaveBeenCalledTimes(1);
    // `teamsSelectSpy` is deliberately untyped-as-to-arity above (a bare
    // `vi.fn(() => ...)`) so it can serve as both the recorder and the
    // chain's actual implementation without a dead parameter; the recorded
    // argument is read back here via the mock's call log instead.
    const [recordedSelectArg] = teamsSelectSpy.mock.calls[0] as unknown as [string];
    const columns = parseSelectedColumns(recordedSelectArg);
    const askedForColor = columns.has('*') || columns.has('color');
    expect(askedForColor).toBe(true);
    if (!columns.has('*')) {
      expect(columns.has('id')).toBe(true);
      expect(columns.has('name')).toBe(true);
    }

    // The mapper hop (`mapTeamDbRowToTeamOption`, outreach.ts:607-609): a
    // stubbed `color` on the raw DB row must survive into the loader's
    // reshaped result, not just get asked for.
    expect(result?.teams).toEqual([{ id: 't1', name: 'Ravens', color: 'blue' }]);
  });

  // T157: the same guard, for the same reason, applied to the OTHER column
  // this task added to a select string on this loader. `outreach.ts`'s
  // `queryAllStudents` casts its result to `StudentDbRow[] | null`, which
  // asserts `profile_id` is present regardless of what was asked for -- so a
  // revert to the pre-T157 select still compiles, and every DOM test that
  // injects its own `loadData` stays green, while every real parent's
  // `studentProfileId` silently becomes `undefined` and their child's own
  // self-answered RSVP is misattributed to "someone else."
  it('asks the `students` table for `profile_id`, and threads it through to RosterStudent.profileId', async () => {
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
        created_by: null,
      },
      error: null,
    });
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    const studentsSelectSpy = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'student-1',
            display_name: 'Amara Chen',
            team_id: 't1',
            profile_id: 'profile-amara-chen',
            goal_hours_override: null,
          },
        ],
        error: null,
      }),
    }));

    const fromSpy = vi.fn((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventMaybeSingleSpy })) })),
        };
      }
      if (table === 'event_sessions') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: sessionsOrderSpy })) })) };
      }
      if (table === 'students') {
        return { select: studentsSelectSpy };
      }
      if (table === 'teams') {
        return {
          select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const result = await makeLoadOutreachDetail(() => client)('event-1');

    expect(studentsSelectSpy).toHaveBeenCalledTimes(1);
    const [recordedSelectArg] = studentsSelectSpy.mock.calls[0] as unknown as [string];
    const columns = parseSelectedColumns(recordedSelectArg);
    expect(columns.has('*') || columns.has('profile_id')).toBe(true);
    if (!columns.has('*')) {
      // Pre-existing columns must survive the addition, not be replaced by it.
      expect(columns.has('id')).toBe(true);
      expect(columns.has('display_name')).toBe(true);
      expect(columns.has('team_id')).toBe(true);
      expect(columns.has('goal_hours_override')).toBe(true);
    }

    // The mapper hop (`mapStudentDbRowToRosterStudent`): asked-for is not
    // enough, the value must survive into the page's own row shape.
    expect(result?.students).toEqual([
      {
        id: 'student-1',
        name: 'Amara Chen',
        teamId: 't1',
        profileId: 'profile-amara-chen',
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// T157: the new `guardian_links` read. Same T146 select-string-guard pattern as
// the `queryAllTeams` describe block above (its structural template), reusing
// that block's own `parseSelectedColumns` helper rather than restating the
// column-splitting logic -- a same-file reuse, which does not pre-empt the
// separate open question of whether this helper should later be extracted to
// `src/test-utils/` on first CROSS-file need (T161's ledger row owns that).
// ---------------------------------------------------------------------------

describe('queryGuardianLinksWithRelationshipForParent (via makeLoadGuardianLinksForParent) -- T157 select-string + filter guard', () => {
  /** Records `.select()`/`.eq()`/`.order()` for the `guardian_links` table and
   * resolves one real row. The chain mirrors the loader's own call order
   * (`.select(...).eq(...).order(...)`), so each link is both recorder and
   * implementation. */
  function makeRecordingClient(rows: unknown[]) {
    const orderSpy = vi.fn().mockResolvedValue({ data: rows, error: null });
    const eqSpy = vi.fn(() => ({ order: orderSpy }));
    const selectSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn((table: string) => {
      if (table === 'guardian_links') return { select: selectSpy };
      throw new Error(`unexpected table: ${table}`);
    });
    return {
      client: { from: fromSpy } as unknown as SupabaseClient,
      fromSpy,
      selectSpy,
      eqSpy,
      orderSpy,
    };
  }

  it('asks `guardian_links` for `relationship` (not just the three id columns) and threads it through', async () => {
    // `relationship` is the ONLY column here that is not an id: it is the text
    // `ParentRsvp.tsx` builds PRD line 297's "Mom signed you up" attribution
    // from. All three of this repo's other `guardian_links` reads
    // (`parents.ts:190`, `checkin.ts:393`, `meetings.ts:504`) omit it, so
    // "copy the neighbouring query" is a live way to lose it -- and the
    // `as GuardianLinkDbRow[]` cast in the loader means `tsc` would not
    // notice.
    const { client, fromSpy, selectSpy, eqSpy, orderSpy } = makeRecordingClient([
      {
        id: 'link-1',
        parent_profile_id: 'profile-parent-1',
        student_id: 'student-amara-chen',
        relationship: 'Mom',
      },
    ]);

    const load = makeLoadGuardianLinksForParent(() => client);
    const links = await load('profile-parent-1');

    expect(fromSpy).toHaveBeenCalledWith('guardian_links');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    const [recordedSelectArg] = selectSpy.mock.calls[0] as unknown as [string];
    const columns = parseSelectedColumns(recordedSelectArg);
    expect(columns.has('*') || columns.has('relationship')).toBe(true);
    if (!columns.has('*')) {
      expect(columns.has('id')).toBe(true);
      expect(columns.has('parent_profile_id')).toBe(true);
      expect(columns.has('student_id')).toBe(true);
    }

    // Deterministic ordering, matching `checkin.ts:393`'s own template.
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: true });

    // The mapper hop -- `relationship` must survive into the row shape
    // `<ParentRsvp>` actually consumes, not merely be asked for.
    expect(links).toEqual([
      {
        id: 'link-1',
        parentProfileId: 'profile-parent-1',
        studentId: 'student-amara-chen',
        relationship: 'Mom',
      },
    ]);
    // Recorded here too so a dropped filter is caught even if the assertion
    // below is ever moved.
    expect(eqSpy).toHaveBeenCalledWith('parent_profile_id', 'profile-parent-1');
  });

  it('filters server-side by the REAL supplied parent profile id, never a hardcoded or omitted one', async () => {
    const { client, eqSpy } = makeRecordingClient([]);
    const load = makeLoadGuardianLinksForParent(() => client);

    await load('profile-parent-somebody-else');

    // Defence in depth on top of the `own_read` RLS policy, which is a
    // DISJUNCTION and therefore strictly broader than this: it also admits
    // co-guardian rows carrying a different `parent_profile_id`.
    expect(eqSpy).toHaveBeenCalledTimes(1);
    expect(eqSpy).toHaveBeenCalledWith('parent_profile_id', 'profile-parent-somebody-else');
  });

  it('resolves an empty array (never null) when the parent has no links', async () => {
    const { client } = makeRecordingClient([]);
    const load = makeLoadGuardianLinksForParent(() => client);
    // `[]`, not `null`/`undefined` -- so a caller can never read "no rows" as
    // "fall back to something."
    await expect(load('profile-parent-1')).resolves.toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T327: `makeMarkDayComplete`'s write ORDER. First coverage of this mutation
// (T165: 21/23 exports in this loader were untested before this) -- nothing
// existing pins the old order, which is why the reorder was safe to make and
// why C1/C4's recorded-order assertions are the criteria that matter.
// ---------------------------------------------------------------------------

interface MarkDayCompleteRecordedCall {
  table: string;
  method: 'update' | 'select' | 'upsert';
}

/**
 * Records table AND METHOD (`endMeeting.test.ts:353`'s "dispatches on the
 * METHOD called" shape), not table alone -- with nonzero adult-volunteer
 * deltas, `event_sessions` receives BOTH an `update` (the status flip) and a
 * `select` (step 3's `querySessionEventId` read, `outreach.ts:866-876`). A
 * table-only recorder cannot distinguish the flip from that read, and C1
 * would assert on the wrong call. Also copies `endMeeting.test.ts:613`'s
 * `{ client, fromSpy, updateArgs, eqArgs }` helper shape (here widened per
 * table) so a test can assert both the write's exact payload and the order
 * writes were dispatched in.
 */
function makeMarkDayCompleteRecordingClient(
  options: {
    attendanceError?: { message: string; code?: string } | null;
    sessionFlipError?: { message: string; code?: string } | null;
    sessionEventId?: string | null;
    volunteerTotals?: { adult_volunteers_count: number; adult_volunteer_hours: number };
  } = {},
): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  order: MarkDayCompleteRecordedCall[];
  eventSessionsUpdateArgs: unknown[];
  eventSessionsEqArgs: [string, unknown][];
  attendanceUpsertArgs: [unknown, unknown][];
  eventsUpdateArgs: unknown[];
} {
  const order: MarkDayCompleteRecordedCall[] = [];
  const eventSessionsUpdateArgs: unknown[] = [];
  const eventSessionsEqArgs: [string, unknown][] = [];
  const attendanceUpsertArgs: [unknown, unknown][] = [];
  const eventsUpdateArgs: unknown[] = [];

  const resolvedSessionEventId =
    options.sessionEventId === undefined ? 'event-1' : options.sessionEventId;
  const resolvedVolunteerTotals = options.volunteerTotals ?? {
    adult_volunteers_count: 3,
    adult_volunteer_hours: 6,
  };

  const fromSpy = vi.fn((table: string) => {
    if (table === 'event_sessions') {
      return {
        update: (patch: unknown) => {
          order.push({ table, method: 'update' });
          eventSessionsUpdateArgs.push(patch);
          return {
            eq: (column: string, value: unknown) => {
              eventSessionsEqArgs.push([column, value]);
              return Promise.resolve({ data: null, error: options.sessionFlipError ?? null });
            },
          };
        },
        select: () => {
          order.push({ table, method: 'select' });
          return {
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data:
                    resolvedSessionEventId === null ? null : { event_id: resolvedSessionEventId },
                  error: null,
                }),
            }),
          };
        },
      };
    }
    if (table === 'attendance') {
      return {
        upsert: (rows: unknown, opts: unknown) => {
          order.push({ table, method: 'upsert' });
          attendanceUpsertArgs.push([rows, opts]);
          return Promise.resolve({ data: null, error: options.attendanceError ?? null });
        },
      };
    }
    if (table === 'events') {
      return {
        select: () => {
          order.push({ table, method: 'select' });
          return {
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: resolvedVolunteerTotals, error: null }),
            }),
          };
        },
        update: (patch: unknown) => {
          order.push({ table, method: 'update' });
          eventsUpdateArgs.push(patch);
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    order,
    eventSessionsUpdateArgs,
    eventSessionsEqArgs,
    attendanceUpsertArgs,
    eventsUpdateArgs,
  };
}

const SAMPLE_ATTENDANCE_ROW: OutreachAttendanceWriteRow = {
  sessionId: 'session-day-1',
  studentId: 'student-1',
  status: 'present',
  checkInAt: null,
  checkOutAt: null,
  hoursOverride: null,
  method: 'coach',
  recordedBy: 'coach-1',
};

function makeMarkDayCompletePayload(
  overrides: Partial<OutreachMarkDayCompletePayload> = {},
): OutreachMarkDayCompletePayload {
  return {
    sessionId: 'session-day-1',
    peopleReached: 12,
    attendance: [SAMPLE_ATTENDANCE_ROW],
    adultVolunteersCountThisSession: 2,
    adultVolunteerHoursThisSession: 4,
    recordedBy: 'coach-1',
    ...overrides,
  };
}

describe('makeMarkDayComplete (T327) -- completion write ordering', () => {
  it("C1: writes attendance BEFORE flipping event_sessions to completed -- asserts on the recorded ORDER of client.from(...) calls, distinguishing the flip UPDATE from step 3's event_sessions SELECT", async () => {
    const setup = makeMarkDayCompleteRecordingClient();
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    await markDayComplete(makeMarkDayCompletePayload());

    expect(setup.order).toEqual([
      { table: 'attendance', method: 'upsert' },
      { table: 'event_sessions', method: 'update' },
      { table: 'event_sessions', method: 'select' },
      { table: 'events', method: 'select' },
      { table: 'events', method: 'update' },
    ]);
  });

  it('C2: when the attendance write rejects, event_sessions is never flipped to completed -- and the attendance write WAS attempted', async () => {
    const setup = makeMarkDayCompleteRecordingClient({
      attendanceError: { message: 'boom', code: 'ATTENDANCE_FAIL' },
    });
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    await expect(markDayComplete(makeMarkDayCompletePayload())).rejects.toBeTruthy();

    // Presence: the attendance write was attempted (not a fake-client throw
    // before either call).
    expect(setup.attendanceUpsertArgs).toHaveLength(1);
    // Absence: no update carrying status:'completed' was ever issued.
    expect(setup.eventSessionsUpdateArgs).toHaveLength(0);
  });

  it('C3: with no attendance rows, the session still flips to completed -- the length>0 guard is preserved', async () => {
    const setup = makeMarkDayCompleteRecordingClient();
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    await markDayComplete(
      makeMarkDayCompletePayload({
        attendance: [],
        adultVolunteersCountThisSession: 0,
        adultVolunteerHoursThisSession: 0,
      }),
    );

    expect(setup.attendanceUpsertArgs).toHaveLength(0);
    expect(setup.eventSessionsUpdateArgs).toEqual([{ status: 'completed', people_reached: 12 }]);
  });

  it('C4: the adult-volunteer update still runs LAST, after the status flip, and the happy path resolves normally', async () => {
    const setup = makeMarkDayCompleteRecordingClient();
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    await expect(markDayComplete(makeMarkDayCompletePayload())).resolves.toBeUndefined();

    expect(setup.order).toEqual([
      { table: 'attendance', method: 'upsert' },
      { table: 'event_sessions', method: 'update' },
      { table: 'event_sessions', method: 'select' },
      { table: 'events', method: 'select' },
      { table: 'events', method: 'update' },
    ]);
  });

  it('C5: the adult-volunteer update is skipped entirely when both deltas are 0', async () => {
    const setup = makeMarkDayCompleteRecordingClient();
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    await markDayComplete(
      makeMarkDayCompletePayload({
        adultVolunteersCountThisSession: 0,
        adultVolunteerHoursThisSession: 0,
      }),
    );

    expect(setup.order.some((call) => call.table === 'events')).toBe(false);
    expect(setup.eventsUpdateArgs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T402: `queryAttendanceForSessions`'s own `.range()` pagination -- this
// file's OWN, file-local, unrelated duplicate of the defect T320 fixed in
// `loaders/attendance.ts`'s `makeLoadAttendanceForSessions`
// (`supabase/config.toml`'s `[api] max_rows = 1000`; PostgREST truncates
// silently at that cap with a 200 and a partial `Content-Range`, not an
// error).
//
// §5 test-seam decision, recorded per this task's own worker packet item 20:
// `queryAttendanceForSessions`/`queryAttendanceForSessionsPage` is file-local
// and has exactly ONE caller (`makeLoadOutreachData`'s own `loadAttendance`
// closure) -- unlike `attendance.ts`'s `makeLoadAttendanceForSessions`,
// nothing else in this codebase reaches it directly, so there is no
// standalone factory to export without inventing NEW public API surface
// purely to shortcut this test file. DECISION: test through the existing
// public caller, `makeLoadOutreachData`, exactly as `OutreachList.test.tsx`'s
// own pre-existing `loadOutreachData (T101 real load)` describe block already
// does for this same loader's OTHER tables -- `makeOutreachDataClient` below
// mirrors that file's own `fromSpy` shape, narrowed to let each test swap in
// its own `attendance` table stub. The ONE new export this task adds,
// `OUTREACH_ATTENDANCE_PAGE_SIZE`, is a plain constant (not the query
// function itself), exported for the same "assertable boundary, no
// magic-number duplicate" reason `attendance.ts`'s own `ATTENDANCE_PAGE_SIZE`
// already is -- see that constant's own doc comment in `outreach.ts`.
//
// KNOWN COLLATERAL (disclosed, not fixed here -- outside this task's Allowed
// Files): changing this query's PostgREST chain from `.select().in()` to
// `.select().in().order().range()` breaks TWO pre-existing tests in
// `src/pages/outreach/OutreachList.test.tsx` ("loadOutreachData (T101 real
// load) > filters events by season_id..." and "...issues the teams query in
// the SAME batch..."), both of which stub the `attendance` table with a bare
// `{ select: () => ({ in: ... }) }` chain that has no `.order()` method.
// Same "stub-shape breakage, not a behaviour regression" class T320's own
// verification-log entry names for the identical situation in
// `endMeeting.test.ts`/`AttendancePanel.test.tsx` -- there, T320 was
// authorized to cross the file boundary and fix the stub shape; here, this
// task's Allowed Files are only `outreach.ts` and this file, so the fix is
// reported rather than applied. See this task's own worker-output doc.
// ---------------------------------------------------------------------------

interface OutreachAttendanceFixtureRow {
  session_id: string;
  student_id: string;
  status: 'present' | 'late' | 'excused' | 'absent';
}

function attendanceFixtureRow(studentId: string): OutreachAttendanceFixtureRow {
  return { session_id: 'session-1', student_id: studentId, status: 'present' };
}

/** A full page of distinct rows, offset so page contents never collide --
 * same shape `attendance.test.ts`'s own `fullPage` helper uses. */
function fullAttendancePage(pageIndex: number): OutreachAttendanceFixtureRow[] {
  return Array.from({ length: OUTREACH_ATTENDANCE_PAGE_SIZE }, (_, i) =>
    attendanceFixtureRow(`student-${pageIndex * OUTREACH_ATTENDANCE_PAGE_SIZE + i}`),
  );
}

/**
 * Records every `.range()` call for the `attendance` table specifically
 * (mirrors `attendance.test.ts`'s own `makePagingClient`, narrowed to just
 * the ONE table entry `makeOutreachDataClient` below slots in, since this
 * loader's other four tables are fixed/uninteresting for these tests).
 */
function makeAttendancePagingTable(pages: OutreachAttendanceFixtureRow[][]) {
  const rangeCalls: Array<[number, number]> = [];
  const orderSpy = vi.fn((column: string, opts: unknown) => {
    void column;
    void opts;
    return {
      range: vi.fn((from: number, to: number) => {
        rangeCalls.push([from, to]);
        const index = rangeCalls.length - 1;
        return Promise.resolve({ data: pages[index] ?? [], error: null });
      }),
    };
  });
  const inSpy = vi.fn(() => ({ order: orderSpy }));
  const selectSpy = vi.fn(() => ({ in: inSpy }));
  return { select: selectSpy, selectSpy, inSpy, orderSpy, rangeCalls };
}

/**
 * A full `makeLoadOutreachData` fixture -- ONE event with ONE session, so
 * `sessionIds` is non-empty and the `attendance` query (this task's own
 * target) actually fires. Every table OTHER than `attendance` resolves the
 * cheapest real shape that lets the loader run to completion; each test
 * below supplies its own `attendanceTable` stub (the §5 test-seam decision
 * above).
 */
function makeOutreachDataClient(attendanceTable: { select: () => unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
} {
  const fromSpy = vi.fn((table: string) => {
    if (table === 'events') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: 'event-1',
                season_id: 'season-1',
                type: 'outreach',
                title: 'Food Bank',
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
          }),
        })),
      };
    }
    if (table === 'event_sessions') {
      return {
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
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
          }),
        })),
      };
    }
    if (table === 'rsvps') {
      return {
        select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) })),
      };
    }
    if (table === 'attendance') return attendanceTable;
    if (table === 'students') {
      return {
        select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
      };
    }
    if (table === 'teams') {
      return {
        select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
      };
    }
    if (table === 'seasons') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: { id: 'season-1', default_goal_hours: 0 }, error: null }),
          })),
        })),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, fromSpy };
}

describe('queryAttendanceForSessions pagination (T402, mirrors T320) -- exercised via makeLoadOutreachData, its only caller', () => {
  it('C1: a result set larger than one page returns ALL rows, not just the first page -- mutation: remove the pagination loop, return the first page only', async () => {
    const attendanceTable = makeAttendancePagingTable([
      fullAttendancePage(0),
      [attendanceFixtureRow('student-tail')],
    ]);
    const { client } = makeOutreachDataClient(attendanceTable);

    const result = await makeLoadOutreachData(() => client)('season-1');

    expect(result.attendance).toHaveLength(OUTREACH_ATTENDANCE_PAGE_SIZE + 1);
    expect(attendanceTable.rangeCalls).toEqual([
      [0, OUTREACH_ATTENDANCE_PAGE_SIZE - 1],
      [OUTREACH_ATTENDANCE_PAGE_SIZE, OUTREACH_ATTENDANCE_PAGE_SIZE * 2 - 1],
    ]);
    // The row that used to be silently dropped before this fix.
    expect(result.attendance[result.attendance.length - 1]).toEqual({
      sessionId: 'session-1',
      studentId: 'student-tail',
      status: 'present',
    });
  });

  it("C2 -- the REAL proof (not call-shape): dropping the stable order lets separate page requests observe DRIFTING physical row order, duplicating and dropping rows -- mutation: delete `.order('id', ...)`", async () => {
    // This is the exact "observable consequence" proof this task's own
    // packet §6 demands, not "was .order() called" (a call-shape assertion
    // that proves nothing about correctness -- see the OTHER test below,
    // deliberately kept secondary).
    //
    // Models the real risk (packet §3, T320's own verification-log entry):
    // Postgres gives NO ordering guarantee absent an explicit `order by`,
    // and each page here is a SEPARATE round trip -- so an "unordered"
    // query's physical row order can legitimately drift between two page
    // requests (e.g. straddling a concurrent write, a different scan plan,
    // etc). This fake models that drift directly: with NO stable `.order(
    // 'id', ...)` recorded before a given `.range()` call, it serves a
    // ROTATED view of the same underlying rows instead of a stable one; with
    // the stable order recorded, it always sorts before slicing. `student_id`
    // stands in for the real `id` ordering column here since this loader's
    // own `.select()` never returns `id` at all (see `AttendanceDbRow`'s own
    // doc comment in `outreach.ts`).
    const TOTAL = OUTREACH_ATTENDANCE_PAGE_SIZE + 500; // forces exactly two pages: one full (1000), one short (500)
    const ROTATE_STEP = 37; // arbitrary, non-trivial shift relative to TOTAL
    const base: OutreachAttendanceFixtureRow[] = Array.from({ length: TOTAL }, (_, i) =>
      attendanceFixtureRow(`student-${String(i).padStart(4, '0')}`),
    );
    function rotate<T>(arr: readonly T[], shift: number): T[] {
      if (arr.length === 0) return [];
      const s = shift % arr.length;
      return [...arr.slice(s), ...arr.slice(0, s)];
    }
    let queryCount = 0;
    const attendanceTable = {
      select: vi.fn(() => ({
        in: vi.fn(() => {
          let orderedById = false;
          const chain = {
            order: vi.fn((column: string) => {
              if (column === 'id') orderedById = true;
              return chain;
            }),
            range: vi.fn((from: number, to: number) => {
              const physical = orderedById
                ? [...base].sort((a, b) => (a.student_id < b.student_id ? -1 : 1))
                : rotate(base, queryCount * ROTATE_STEP);
              queryCount += 1;
              return Promise.resolve({ data: physical.slice(from, to + 1), error: null });
            }),
          };
          return chain;
        }),
      })),
    };
    const { client } = makeOutreachDataClient(attendanceTable);

    const result = await makeLoadOutreachData(() => client)('season-1');

    // With `.order('id', ...)` genuinely applied (the real, unmutated code),
    // every page is sliced from the SAME stable sort, so the union across
    // pages is exactly the input set: right length AND no duplicate ids.
    // (A length-only assertion would NOT catch the mutation here -- see this
    // test's own doc comment above and the worker-output doc's §4/§6 record:
    // under the mutation, `1000 + 500 === 1500` STILL holds even though 37
    // ids are duplicated and 37 different ids are dropped entirely.)
    expect(result.attendance).toHaveLength(TOTAL);
    const uniqueStudentIds = new Set(result.attendance.map((row) => row.studentId));
    expect(uniqueStudentIds.size).toBe(TOTAL);
    for (let i = 0; i < TOTAL; i += 1) {
      expect(uniqueStudentIds.has(`student-${String(i).padStart(4, '0')}`)).toBe(true);
    }
  });

  it("C2 -- secondary/defense-in-depth ONLY (call-shape, deliberately not this criterion's sole proof): each page request orders by id ascending", async () => {
    const attendanceTable = makeAttendancePagingTable([[attendanceFixtureRow('student-1')]]);
    const { client } = makeOutreachDataClient(attendanceTable);

    await makeLoadOutreachData(() => client)('season-1');

    expect(attendanceTable.orderSpy).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('C3: exhausting the page bound THROWS rather than returning a partial set -- mutation: replace the throw with `return rows`', async () => {
    // 100 full pages -- OUTREACH_ATTENDANCE_MAX_PAGES's own bound (asserted
    // via the thrown message below) -- so every one of the 100 allowed
    // attempts comes back full and the loop never sees a short page.
    const pages = Array.from({ length: 100 }, (_, i) => fullAttendancePage(i));
    const attendanceTable = makeAttendancePagingTable(pages);
    const { client } = makeOutreachDataClient(attendanceTable);

    await expect(makeLoadOutreachData(() => client)('season-1')).rejects.toThrow(
      /exceeded 100 pages/,
    );
  });

  it('C4: a short page terminates the loop -- exactly ONE request is issued, not more -- mutation: remove the `< PAGE_SIZE` break', async () => {
    const attendanceTable = makeAttendancePagingTable([
      [attendanceFixtureRow('student-1'), attendanceFixtureRow('student-2')],
    ]);
    const { client } = makeOutreachDataClient(attendanceTable);

    const result = await makeLoadOutreachData(() => client)('season-1');

    expect(result.attendance).toHaveLength(2);
    // The request-COUNT assertion this criterion specifically demands (not
    // just the row count, which a looser mutation could coincidentally
    // still get right).
    expect(attendanceTable.rangeCalls).toHaveLength(1);
  });

  it('C5: an error from any page propagates -- never silently swallowed into [] -- mutation: swallow the error and return []', async () => {
    const orderSpy = vi.fn(() => ({
      range: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom', code: 'ATT500' } }),
    }));
    const attendanceTable = {
      select: vi.fn(() => ({ in: vi.fn(() => ({ order: orderSpy })) })),
    };
    const { client } = makeOutreachDataClient(attendanceTable);

    await expect(makeLoadOutreachData(() => client)('season-1')).rejects.toMatchObject({
      code: 'ATT500',
    });
  });
});
