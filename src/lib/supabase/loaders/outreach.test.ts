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
  computeExpectedAttendeeRsvpPlan,
  makeCancelOutreachEvent,
  makeLoadGuardianLinksForParent,
  makeLoadOutreachData,
  makeLoadOutreachDetail,
  makeLoadOutreachEventRoster,
  makeMarkDayComplete,
  makeSaveOutreachEvent,
  makeSubmitRsvpChange,
  OUTREACH_ATTENDANCE_PAGE_SIZE,
  type OutreachAttendanceWriteRow,
  type OutreachMarkDayCompletePayload,
} from './outreach';
// T165: type-only import, same convention `outreach.ts` itself already uses
// for this exact type (module doc #5) -- erased at compile time, so this
// does not make the test file's import of `makeSaveOutreachEvent` circular.
import type { SaveOutreachEventPayload } from '../../../pages/outreach/OutreachEventDialog';

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
        data: [{ id: 't1', name: 'Ravens', color: 'blue', archived: false }],
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
    // GAM-305 (legacy T615) criterion 5 -- the select-string guard for
    // `archived`. A type assertion cannot catch this (both loaders cast with
    // `as TeamDbRow[]`, so a dropped column compiles fine); only reading the
    // recorded `.select()` argument catches a revert.
    const askedForArchived = columns.has('*') || columns.has('archived');
    expect(askedForArchived).toBe(true);
    if (!columns.has('*')) {
      expect(columns.has('id')).toBe(true);
      expect(columns.has('name')).toBe(true);
    }

    // The mapper hop (`mapTeamDbRowToTeamOption`, outreach.ts:607-609): a
    // stubbed `color`/`archived` on the raw DB row must survive into the
    // loader's reshaped result, not just get asked for.
    expect(result?.teams).toEqual([{ id: 't1', name: 'Ravens', color: 'blue', archived: false }]);
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
// T406: `upsertAttendance`'s NARROWED `attendance` DB mapping (`outreach.ts`,
// grep `upsertAttendance` -- do not trust a line number) -- closes a real
// TOCTOU: `MarkDayCompleteDialog.tsx` loads attendance ONCE on open and
// `handleSubmit` writes that same snapshot later, so a row written in
// between (a student scanning the QR kiosk while the dialog is still open)
// was silently overwritten by the stale snapshot. `docs/swarm/active/
// T406-gate-report.md` proved by EXECUTION, against a real PostgreSQL 16.13
// loaded with this repo's actual migrations, that PostgREST leaves an unsent
// column untouched on the conflict path (E1/E7) and reproduced the defect
// itself (E4: `14:07:33+00` -> `NULL`) and the batch-uniformity trap (E5).
//
// C2 (`docs/swarm/active/T406-worker-packet.md` §8) is the criterion this
// task exists for, and it is explicitly NOT a shape/call-args assertion:
// "re-add check_in_at to the payload" also turns a plain payload-keys check
// red, so a shape assertion cannot discriminate the outcome this fix
// actually has to guarantee from a fix that merely changed which keys get
// sent (the gate's MAJOR-2, `T406-gate-report.md`). The suite below drives
// the REAL `makeMarkDayComplete` against a STATEFUL fake `attendance` table
// that models the union-of-keys/null-fill semantics that report's E1/E5
// proved (`@supabase/postgrest-js` v2.110.7,
// `PostgrestQueryBuilder.ts:1403-1409`: a batch upsert's `columns=` is the
// UNION of `Object.keys` across every row in the array; a row missing a key
// IN that union is written NULL for it -- `defaultToNull` is the client's
// default, no `Prefer: missing=default` is ever sent by this codebase). A
// column never present in the union for ANY row in the batch is left
// UNTOUCHED on the conflict path (E1). Every assertion below reads the
// fake's in-memory STORE after the write -- never `mock.calls` -- per that
// same finding.
// ---------------------------------------------------------------------------

type FakeAttendanceRow = Record<string, unknown> & {
  session_id: string;
  student_id: string;
};

function fakeAttendanceRowKey(row: { session_id: string; student_id: string }): string {
  return `${row.session_id}:${row.student_id}`;
}

/**
 * A stateful fake for the `attendance` table's real `.upsert(rows,
 * {onConflict})` call. Models the union-of-keys semantics
 * `T406-gate-report.md` E1/E5 proved by execution against a real PostgreSQL
 * 16.13 loaded with this repo's real migrations, cross-checked against the
 * installed `@supabase/postgrest-js` v2.110.7 client source AND PostgREST's
 * own server-side `mutatePlanToQuery`: the columns actually written for one
 * upsert call are the UNION of `Object.keys` across every row the client
 * sends in that single array (`PostgrestQueryBuilder.ts:1403-1409`); a row
 * omitting a key that IS in that union is written NULL for it
 * (`json_to_recordset`, no `missing=default`); a column that is in NO row's
 * keys for that call is left completely untouched on the conflict path
 * (`DO UPDATE SET c = EXCLUDED.c` only for the payload-derived column list --
 * an unsent column never appears in `SET`). `event_sessions`/`events` are
 * stubbed inert (no-op success) -- C2/C3 only need `attendance` STATE, and a
 * zero-delta payload (this suite's convention) never reaches the `events`
 * read-modify-write, so `fromSpy` never even needs an `events` branch.
 */
function makeStatefulMarkDayCompleteClient(seed: readonly FakeAttendanceRow[] = []): {
  client: SupabaseClient;
  store: Map<string, FakeAttendanceRow>;
} {
  const store = new Map<string, FakeAttendanceRow>();
  for (const row of seed) store.set(fakeAttendanceRowKey(row), { ...row });

  const fromSpy = vi.fn((table: string) => {
    if (table === 'attendance') {
      return {
        upsert: (rows: FakeAttendanceRow[]) => {
          const unionKeys = new Set<string>();
          for (const row of rows) {
            for (const key of Object.keys(row)) unionKeys.add(key);
          }
          for (const row of rows) {
            const key = fakeAttendanceRowKey(row);
            const existing = store.get(key);
            const merged: FakeAttendanceRow = existing
              ? { ...existing }
              : { session_id: row.session_id, student_id: row.student_id };
            for (const column of unionKeys) {
              merged[column] = column in row ? row[column] : null;
            }
            store.set(key, merged);
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    if (table === 'event_sessions') {
      return {
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      };
    }
    throw new Error(`unexpected table in T406 stateful fake: ${table}`);
  });

  return { client: { from: fromSpy } as unknown as SupabaseClient, store };
}

describe('makeMarkDayComplete (T406) -- narrowed write survives a concurrent scan', () => {
  it("C2: a row written BETWEEN the dialog's load and its submit (a concurrent QR scan) keeps its real check_in_at after the narrowed write -- asserted on POST-WRITE ROW STATE, never on the call args", async () => {
    const MID_RACE_SCAN_TIME = '2026-08-04T14:07:33.000Z';
    const setup = makeStatefulMarkDayCompleteClient([
      {
        session_id: 'session-day-1',
        student_id: 'student-1',
        status: 'present',
        check_in_at: MID_RACE_SCAN_TIME,
        check_out_at: null,
        hours_override: null,
        method: 'qr',
        recorded_by: 'coach-1',
      },
    ]);
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    // The dialog loaded ONCE on open, before the scan above happened, and
    // now submits that stale pre-scan snapshot (checkInAt: null).
    await markDayComplete(
      makeMarkDayCompletePayload({
        attendance: [
          {
            sessionId: 'session-day-1',
            studentId: 'student-1',
            status: 'present',
            checkInAt: null,
            checkOutAt: null,
            hoursOverride: null,
            method: 'coach',
            recordedBy: 'coach-1',
          },
        ],
        adultVolunteersCountThisSession: 0,
        adultVolunteerHoursThisSession: 0,
      }),
    );

    const row = setup.store.get('session-day-1:student-1');
    expect(row?.check_in_at).toBe(MID_RACE_SCAN_TIME);
    // The coach's stale `status`/`method` DO still land -- narrowing only
    // protects the columns this task's packet §4 says are droppable. This
    // is the residual §5/the packet's own worker-output requirement
    // documents: `method` cannot be dropped (E3), so a concurrent scan's
    // `method: 'qr'` provenance IS still clobbered even though its
    // timestamp survives.
    expect(row?.status).toBe('present');
    expect(row?.method).toBe('coach');
  });

  it("C2 (subset-uniformity guard): a heterogeneous batch -- one scanned row plus one OTHER row -- still leaves the scanned row's check_in_at untouched, proving the narrowing is uniform across the whole batch, not just that one row (T406-gate-report.md E5's union-columns null-fill: a key present on ANY row in the batch null-fills every OTHER row that omits it)", async () => {
    const MID_RACE_SCAN_TIME = '2026-08-04T15:00:00.000Z';
    const setup = makeStatefulMarkDayCompleteClient([
      {
        session_id: 'session-day-1',
        student_id: 'student-1',
        status: 'present',
        check_in_at: MID_RACE_SCAN_TIME,
        check_out_at: null,
        hours_override: null,
        method: 'qr',
        recorded_by: 'coach-1',
      },
    ]);
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    await markDayComplete(
      makeMarkDayCompletePayload({
        attendance: [
          {
            sessionId: 'session-day-1',
            studentId: 'student-1',
            status: 'present',
            checkInAt: null,
            checkOutAt: null,
            hoursOverride: null,
            method: 'coach',
            recordedBy: 'coach-1',
          },
          {
            sessionId: 'session-day-1',
            studentId: 'student-2',
            status: 'absent',
            checkInAt: null,
            checkOutAt: null,
            hoursOverride: null,
            method: 'coach',
            recordedBy: 'coach-1',
          },
        ],
        adultVolunteersCountThisSession: 0,
        adultVolunteerHoursThisSession: 0,
      }),
    );

    const scannedRow = setup.store.get('session-day-1:student-1');
    expect(scannedRow?.check_in_at).toBe(MID_RACE_SCAN_TIME);
  });

  it("C3: a student with NO prior row (the INSERT leg) still gets a correct row written, carrying method -- the DB's real `not null` constraint is T406-gate-report.md's E3 (quoted below), not reproducible in vitest (no Postgres present here to raise 23502)", async () => {
    // T406-gate-report.md E3, quoted verbatim for the DB-level half of this
    // criterion: "ERROR:  null value in column \"method\" of relation
    // \"attendance\" violates not-null constraint" -- and on BOTH the
    // INSERT leg and the pure conflict leg, per that report (PostgreSQL
    // checks NOT NULL on the candidate tuple before conflict arbitration).
    const setup = makeStatefulMarkDayCompleteClient([]); // no prior row for this student
    const markDayComplete = makeMarkDayComplete(() => setup.client);

    await markDayComplete(
      makeMarkDayCompletePayload({
        attendance: [
          {
            sessionId: 'session-day-1',
            studentId: 'student-new',
            status: 'present',
            checkInAt: null,
            checkOutAt: null,
            hoursOverride: null,
            method: 'coach',
            recordedBy: 'coach-1',
          },
        ],
        adultVolunteersCountThisSession: 0,
        adultVolunteerHoursThisSession: 0,
      }),
    );

    const row = setup.store.get('session-day-1:student-new');
    expect(row?.method).toBe('coach');
    expect(row?.status).toBe('present');
    expect(row?.recorded_by).toBe('coach-1');
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

// ---------------------------------------------------------------------------
// T165: the five previously-untested exports (worker packet §1's corrected
// count: 18 value exports total, 7 already exercised above by T146/T157/
// T327/T406/T402 -- `makeMarkDayComplete` wrongly listed as a target by the
// ledger row, already covered by two whole describe blocks above, is NOT
// re-covered here). Order follows the packet's own priority: the pure
// function first, then `makeSubmitRsvpChange`, then the ~200-line
// `makeSaveOutreachEvent`, then `makeCancelOutreachEvent`, then
// `makeLoadOutreachEventRoster`. Every test below names the mutation that
// reddens it; the real red output for each is pasted in
// `docs/swarm/active/T165-worker-output.md`.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T165.1: `computeExpectedAttendeeRsvpPlan` (module doc #7, T119's D-7
// override of T118) -- pure, no Supabase client. Cheapest real coverage in
// the file (packet §1), so it is covered thoroughly: every documented branch
// gets its own test and its own mutation, not one happy path.
// ---------------------------------------------------------------------------

interface RsvpFixtureRow {
  id: string;
  session_id: string;
  student_id: string;
  status: 'going' | 'maybe' | 'declined';
  responded_by: string | null;
  updated_at: string;
  created_at: string;
}

function rsvpFixtureRow(overrides: Partial<RsvpFixtureRow> = {}): RsvpFixtureRow {
  return {
    id: 'rsvp-default',
    session_id: 'session-1',
    student_id: 'student-1',
    status: 'going',
    responded_by: 'coach-1',
    updated_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('computeExpectedAttendeeRsvpPlan (T165) -- T119 D-7 reconciliation branches', () => {
  it('fans out ONE upsert row per (checked student x session) pair -- a true cross product, not one row per session or per student -- mutation: `break` out of the inner loop after the first checked student per session', () => {
    const plan = computeExpectedAttendeeRsvpPlan(
      [],
      ['session-a', 'session-b'],
      ['student-x', 'student-y'],
    );

    expect(plan.rowsToUpsert).toHaveLength(4);
    const pairs = new Set(plan.rowsToUpsert.map((row) => `${row.sessionId}:${row.studentId}`));
    expect(pairs).toEqual(
      new Set([
        'session-a:student-x',
        'session-a:student-y',
        'session-b:student-x',
        'session-b:student-y',
      ]),
    );
  });

  it('deduplicates a REPEATED id in expectedStudentIds -- one row per session, not one per occurrence -- mutation: iterate the raw `expectedStudentIds` array directly instead of the deduped `checkedSet`', () => {
    const plan = computeExpectedAttendeeRsvpPlan([], ['session-a'], ['student-x', 'student-x']);

    expect(plan.rowsToUpsert).toEqual([{ sessionId: 'session-a', studentId: 'student-x' }]);
  });

  it("T119: unchecking a student deletes their going rows regardless of author, INCLUDING their own self-authored row -- T118's selfAuthoredKeys protection no longer applies -- mutation: reinstate `&& row.responded_by !== row.student_id` on the delete filter", () => {
    const selfAuthored = rsvpFixtureRow({
      id: 'rsvp-self',
      student_id: 'student-x',
      status: 'going',
      responded_by: 'student-x',
    });

    const plan = computeExpectedAttendeeRsvpPlan([selfAuthored], ['session-1'], []);

    expect(plan.idsToDelete).toEqual(['rsvp-self']);
  });

  // T165 (orchestrator addition after mutation replay): the delete filter has TWO
  // conditions and, before this test, only `row.status === 'going'` was pinned.
  // Dropping `!checkedSet.has(row.student_id)` left the whole suite green at 38/38,
  // even though it makes every save delete the rows of students who are STILL
  // checked. That is not a no-op dressed up as one: the plan is observably
  // different (`['r2']` vs `['r1','r2']`), and on the real write path the row is
  // deleted and re-upserted, which replaces a student's own self-authored 'going'
  // with a coach-authored one -- exactly the intent-vs-record distinction T121
  // established and `OutreachList.tsx` still carries.
  it('a student who is STILL CHECKED keeps their existing going row -- it is not deleted and re-created -- mutation: drop `!checkedSet.has(row.student_id)` from the delete filter', () => {
    const stillChecked = rsvpFixtureRow({
      id: 'rsvp-keep',
      student_id: 'student-keep',
      status: 'going',
      responded_by: 'student-keep',
    });
    const nowUnchecked = rsvpFixtureRow({
      id: 'rsvp-drop',
      student_id: 'student-drop',
      status: 'going',
    });

    const plan = computeExpectedAttendeeRsvpPlan(
      [stillChecked, nowUnchecked],
      ['session-1'],
      ['student-keep'],
    );

    // Only the unchecked student's row is deleted. `rsvp-keep` must NOT appear.
    expect(plan.idsToDelete).toEqual(['rsvp-drop']);
  });

  it("a 'maybe'/'declined' row for an unchecked student is left COMPLETELY UNTOUCHED -- an uncheck only ever clears a PLANNED ('going') entry, never a student's actual declined/maybe answer -- mutation: drop the `row.status === 'going'` condition from the delete filter", () => {
    const maybeRow = rsvpFixtureRow({ id: 'rsvp-maybe', student_id: 'student-x', status: 'maybe' });
    const declinedRow = rsvpFixtureRow({
      id: 'rsvp-declined',
      student_id: 'student-y',
      status: 'declined',
    });

    const plan = computeExpectedAttendeeRsvpPlan([maybeRow, declinedRow], ['session-1'], []);

    expect(plan.idsToDelete).toEqual([]);
  });

  it('checking a student still produces an upsert row even when that student already has an existing SELF-AUTHORED row for the session -- T119 removed the old skip, there is no longer any row the upsert fan-out skips -- mutation: reinstate a selfAuthoredKeys-based skip in the upsert loop', () => {
    const selfAuthored = rsvpFixtureRow({
      id: 'rsvp-self',
      student_id: 'student-x',
      status: 'declined',
      responded_by: 'student-x',
    });

    const plan = computeExpectedAttendeeRsvpPlan([selfAuthored], ['session-1'], ['student-x']);

    expect(plan.rowsToUpsert).toEqual([{ sessionId: 'session-1', studentId: 'student-x' }]);
  });

  it('unchecking EVERY student (empty expectedStudentIds) deletes every existing going row rather than being treated as a "nothing to do" shortcut -- mutation: `if (checkedSet.size === 0) return { idsToDelete: [], rowsToUpsert: [] };`', () => {
    const goingA = rsvpFixtureRow({ id: 'rsvp-a', student_id: 'student-a', status: 'going' });
    const goingB = rsvpFixtureRow({ id: 'rsvp-b', student_id: 'student-b', status: 'going' });

    const plan = computeExpectedAttendeeRsvpPlan([goingA, goingB], ['session-1'], []);

    expect([...plan.idsToDelete].sort()).toEqual(['rsvp-a', 'rsvp-b']);
    expect(plan.rowsToUpsert).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// T165.2: `makeSubmitRsvpChange` (module doc #3) -- ONE shared `rsvps`
// upsert behind both `RsvpControl.tsx` (student self-RSVP) and
// `ParentRsvp.tsx` (parent RSVP-on-behalf).
//
// T157's own standing warning still applies here, verbatim: `makeSubmitRsvpChange`
// is the mutation behind what was once an UNREACHABLE RSVP UI. A green test
// in this block is NOT evidence the feature is reachable from either page's
// UI -- only that this loader function itself does the right upsert when
// called directly.
// ---------------------------------------------------------------------------

/**
 * A stateful fake for the `rsvps` table's `.upsert(row, {onConflict})` call,
 * keyed by whatever columns the RECORDED `onConflict` argument actually
 * names -- not hardcoded to `session_id:student_id` -- so a test observes the
 * real CONSEQUENCE of a wrong `onConflict` target (two distinct rows
 * colliding into one) rather than merely asserting the argument's call
 * shape.
 */
function makeStatefulRsvpClient(): {
  client: SupabaseClient;
  store: Map<string, Record<string, unknown>>;
} {
  const store = new Map<string, Record<string, unknown>>();
  const fromSpy = vi.fn((table: string) => {
    if (table !== 'rsvps') throw new Error(`unexpected table in T165 rsvp fake: ${table}`);
    return {
      upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => {
        const keyColumns = opts.onConflict.split(',').map((column) => column.trim());
        const key = keyColumns.map((column) => String(row[column])).join(':');
        store.set(key, { ...row });
        return Promise.resolve({ data: null, error: null });
      },
    };
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, store };
}

describe('makeSubmitRsvpChange (T165) -- module doc #3 shared rsvps upsert', () => {
  it('upserts keyed on the REAL session_id+student_id unique constraint -- two DIFFERENT sessions for the same student remain two SEPARATE rows, not one collapsed by student_id alone -- mutation: change onConflict from "session_id,student_id" to "student_id"', async () => {
    const { client, store } = makeStatefulRsvpClient();
    const submit = makeSubmitRsvpChange(() => client);

    await submit({
      sessionId: 'session-a',
      studentId: 'student-1',
      status: 'going',
      respondedBy: 'student-1',
    });
    await submit({
      sessionId: 'session-b',
      studentId: 'student-1',
      status: 'declined',
      respondedBy: 'student-1',
    });

    expect(store.size).toBe(2);
    expect(store.get('session-a:student-1')?.status).toBe('going');
    expect(store.get('session-b:student-1')?.status).toBe('declined');
  });

  it('writes the caller-supplied respondedBy VERBATIM -- never re-derives it from studentId (module doc #3) -- mutation: change `responded_by: params.respondedBy` to `responded_by: params.studentId`', async () => {
    const { client, store } = makeStatefulRsvpClient();
    const submit = makeSubmitRsvpChange(() => client);

    await submit({
      sessionId: 'session-a',
      studentId: 'student-1',
      status: 'going',
      respondedBy: 'parent-99',
    });

    expect(store.get('session-a:student-1')?.responded_by).toBe('parent-99');
  });

  it('a rejected upsert (e.g. an RLS with-check failure) surfaces as a real rejection -- not retried, swallowed, or special-cased (module doc #3) -- mutation: wrap the mutate call in a try/catch that swallows the error', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table !== 'rsvps') throw new Error(`unexpected table: ${table}`);
      return {
        upsert: () => Promise.resolve({ data: null, error: { message: 'denied', code: '42501' } }),
      };
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;
    const submit = makeSubmitRsvpChange(() => client);

    await expect(
      submit({
        sessionId: 'session-a',
        studentId: 'student-1',
        status: 'going',
        respondedBy: 'student-1',
      }),
    ).rejects.toMatchObject({ code: '42501' });
  });
});

// ---------------------------------------------------------------------------
// T165.3: `makeSaveOutreachEvent` (module docs #5, #7) -- create+edit event
// writes plus the T118/T119 RSVP reconciliation fan-out. ~200 lines, the
// largest of this task's five targets.
//
// T330's own verification-log entry (`docs/swarm/verification-log.md`, grep
// "T330") already established that an `events` row left behind by a failed
// `event_sessions` insert is a DISCLOSED, ACCEPTED risk -- "same class
// loaders/meetings.ts's own makeCreateMeetings already accepts" (this file's
// module doc #5, CREATE path). The test below for that path asserts the REAL
// shipped behaviour (event created, rejection propagates, no compensating
// delete/rollback) -- it does not assert or require a rollback, which would
// contradict T330's own finding.
// ---------------------------------------------------------------------------

function minimalOutreachEventPayload(
  overrides: Partial<SaveOutreachEventPayload['event']> = {},
): SaveOutreachEventPayload['event'] {
  return {
    title: 'Food Bank',
    description: '',
    locationName: 'X',
    address: '',
    type: 'outreach',
    countsParticipation: true,
    countsVolunteerHours: true,
    teamIds: null,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
    shareToCalendarFeed: false,
    ...overrides,
  };
}

interface SaveEventRecordedCall {
  table: string;
  method: string;
}

/**
 * A configurable fake covering every table `makeSaveOutreachEvent` touches:
 * `seasons` (active-season lookup), `events` (insert/update), `event_sessions`
 * (insert/update/select for the EDIT reconciliation), and `rsvps`
 * (select/upsert/delete for the T118/T119 fan-out). Each table's behaviour is
 * independently overridable per test via `options`, and every call is
 * recorded (table + method) in `order` -- the same recorder shape
 * `makeMarkDayCompleteRecordingClient` above already established for this
 * file.
 */
function makeSaveOutreachEventClient(
  options: {
    activeSeasonId?: string | null;
    insertSessionsError?: { message: string; code?: string } | null;
    existingSessions?: Array<{ id: string; session_date: string }>;
    existingRsvps?: RsvpFixtureRow[];
  } = {},
): {
  client: SupabaseClient;
  order: SaveEventRecordedCall[];
  eventInsertArgs: unknown[];
  eventUpdateArgs: unknown[];
  sessionInsertArgs: unknown[][];
  sessionUpdateArgs: Array<{ id: string; patch: unknown }>;
  rsvpDeleteIds: string[][];
  rsvpUpsertArgs: unknown[][];
} {
  const order: SaveEventRecordedCall[] = [];
  const eventInsertArgs: unknown[] = [];
  const eventUpdateArgs: unknown[] = [];
  const sessionInsertArgs: unknown[][] = [];
  const sessionUpdateArgs: Array<{ id: string; patch: unknown }> = [];
  const rsvpDeleteIds: string[][] = [];
  const rsvpUpsertArgs: unknown[][] = [];

  const resolvedActiveSeasonId =
    options.activeSeasonId === undefined ? 'season-1' : options.activeSeasonId;
  const existingSessions = options.existingSessions ?? [];
  const existingRsvps = options.existingRsvps ?? [];

  const fromSpy = vi.fn((table: string) => {
    if (table === 'seasons') {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: resolvedActiveSeasonId === null ? null : { id: resolvedActiveSeasonId },
                error: null,
              }),
          }),
        }),
      };
    }
    if (table === 'events') {
      return {
        insert: (patch: unknown) => {
          order.push({ table, method: 'insert' });
          eventInsertArgs.push(patch);
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id: 'event-created-1' }, error: null }),
            }),
          };
        },
        update: (patch: unknown) => {
          order.push({ table, method: 'update' });
          eventUpdateArgs.push(patch);
          return { eq: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    }
    if (table === 'event_sessions') {
      return {
        insert: (rows: unknown[]) => {
          order.push({ table, method: 'insert' });
          sessionInsertArgs.push(rows);
          return options.insertSessionsError
            ? Promise.resolve({ data: null, error: options.insertSessionsError })
            : Promise.resolve({ data: null, error: null });
        },
        update: (patch: unknown) => {
          order.push({ table, method: 'update' });
          return {
            eq: (_column: string, id: string) => {
              sessionUpdateArgs.push({ id, patch });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        select: () => {
          order.push({ table, method: 'select' });
          return {
            eq: () => Promise.resolve({ data: existingSessions, error: null }),
          };
        },
        delete: () => {
          order.push({ table, method: 'delete' });
          return { in: () => Promise.resolve({ data: null, error: null }) };
        },
      };
    }
    if (table === 'rsvps') {
      return {
        select: () => {
          order.push({ table, method: 'select' });
          return { in: () => Promise.resolve({ data: existingRsvps, error: null }) };
        },
        delete: () => {
          order.push({ table, method: 'delete' });
          return {
            in: (_column: string, ids: string[]) => {
              rsvpDeleteIds.push(ids);
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        upsert: (rows: unknown[]) => {
          order.push({ table, method: 'upsert' });
          rsvpUpsertArgs.push(rows);
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    throw new Error(`unexpected table in T165 save-event fake: ${table}`);
  });

  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    order,
    eventInsertArgs,
    eventUpdateArgs,
    sessionInsertArgs,
    sessionUpdateArgs,
    rsvpDeleteIds,
    rsvpUpsertArgs,
  };
}

describe('makeSaveOutreachEvent (T165) -- CREATE path', () => {
  it('rejects with the disclosed "no active season" message and never attempts the events insert -- mutation: remove the `if (activeSeason === null) throw` guard', async () => {
    const setup = makeSaveOutreachEventClient({ activeSeasonId: null });
    const save = makeSaveOutreachEvent(() => setup.client);

    await expect(save({ event: minimalOutreachEventPayload(), sessions: [] })).rejects.toThrow(
      /No active season/,
    );
    expect(setup.eventInsertArgs).toHaveLength(0);
  });

  it("when the events insert succeeds but the event_sessions insert THEN fails, the rejection propagates (not swallowed) -- and the event row was ALREADY durably created, matching T330's disclosed orphan-event risk (module doc #5, this file, and this task's own worker-output doc) -- mutation: wrap `await insertSessions(...)` in a try/catch that swallows the error", async () => {
    const setup = makeSaveOutreachEventClient({
      insertSessionsError: { message: 'boom', code: 'SESSIONS_FAIL' },
    });
    const save = makeSaveOutreachEvent(() => setup.client);

    await expect(
      save({
        event: minimalOutreachEventPayload(),
        sessions: [
          {
            sessionDate: '2026-08-01',
            startsAt: '2026-08-01T14:00:00.000Z',
            endsAt: '2026-08-01T16:00:00.000Z',
            notes: '',
            peopleReached: null,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'SESSIONS_FAIL' });

    // The disclosed, ACCEPTED consequence: the event was already inserted
    // before the session insert rejected, and nothing here compensates for
    // that -- proving the orphan, not fixing it (T330).
    expect(setup.eventInsertArgs).toHaveLength(1);
  });
});

describe('makeSaveOutreachEvent (T165) -- EDIT path (module doc #5, sessionDate reconciliation)', () => {
  it('an existing session date is UPDATED IN PLACE (preserving its id), and a brand-new date is INSERTED -- never the reverse -- mutation: swap the `toUpdate`/`toInsert` filter predicates', async () => {
    const setup = makeSaveOutreachEventClient({
      existingSessions: [
        { id: 'sess-old-1', session_date: '2026-08-01' },
        { id: 'sess-old-2', session_date: '2026-08-08' },
      ],
    });
    const save = makeSaveOutreachEvent(() => setup.client);

    await save({
      event: minimalOutreachEventPayload({ id: 'event-1' }),
      sessions: [
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T15:00:00.000Z',
          endsAt: '2026-08-01T17:00:00.000Z',
          notes: 'updated',
          peopleReached: 5,
        },
        {
          sessionDate: '2026-08-15',
          startsAt: '2026-08-15T14:00:00.000Z',
          endsAt: '2026-08-15T16:00:00.000Z',
          notes: 'new',
          peopleReached: null,
        },
      ],
    });

    expect(setup.sessionUpdateArgs).toEqual([
      {
        id: 'sess-old-1',
        patch: {
          starts_at: '2026-08-01T15:00:00.000Z',
          ends_at: '2026-08-01T17:00:00.000Z',
          notes: 'updated',
          people_reached: 5,
        },
      },
    ]);
    expect(setup.sessionInsertArgs).toEqual([
      [
        {
          event_id: 'event-1',
          session_date: '2026-08-15',
          starts_at: '2026-08-15T14:00:00.000Z',
          ends_at: '2026-08-15T16:00:00.000Z',
          status: 'scheduled',
          notes: 'new',
          people_reached: null,
        },
      ],
    ]);
  });

  it("a session date REMOVED from the payload (present in the DB, absent from what the coach submitted) is left UNTOUCHED -- NEVER deleted (module doc #5's own disclosed limitation) -- mutation: add a compensating delete for removed dates", async () => {
    const setup = makeSaveOutreachEventClient({
      existingSessions: [
        { id: 'sess-old-1', session_date: '2026-08-01' },
        { id: 'sess-old-2', session_date: '2026-08-08' },
      ],
    });
    const save = makeSaveOutreachEvent(() => setup.client);

    await save({
      event: minimalOutreachEventPayload({ id: 'event-1' }),
      sessions: [
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T15:00:00.000Z',
          endsAt: '2026-08-01T17:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
      ],
    });

    expect(
      setup.order.some((call) => call.table === 'event_sessions' && call.method === 'delete'),
    ).toBe(false);
  });
});

describe('makeSaveOutreachEvent (T165) -- module doc #7 RSVP reconciliation phase', () => {
  it('omitting expectedStudentIds/respondedBy skips the reconciliation phase ENTIRELY -- zero rsvps network calls, the back-compat guard (module doc #7) -- mutation: drop the `!== undefined` half of the guard so reconciliation always runs', async () => {
    const setup = makeSaveOutreachEventClient({
      existingSessions: [{ id: 'sess-old-1', session_date: '2026-08-01' }],
    });
    const save = makeSaveOutreachEvent(() => setup.client);

    await save({ event: minimalOutreachEventPayload({ id: 'event-1' }), sessions: [] });

    expect(setup.order.some((call) => call.table === 'rsvps')).toBe(false);
  });

  it("when both fields ARE present, deletes stale planned RSVPs BEFORE upserting the new checked set, and the plan computed matches computeExpectedAttendeeRsvpPlan's own rules -- mutation: swap the order of the delete/upsert `if` blocks", async () => {
    const setup = makeSaveOutreachEventClient({
      existingSessions: [{ id: 'sess-1', session_date: '2026-08-01' }],
      existingRsvps: [
        rsvpFixtureRow({
          id: 'rsvp-stale',
          session_id: 'sess-1',
          student_id: 'student-unchecked',
          status: 'going',
          responded_by: 'coach-1',
        }),
      ],
    });
    const save = makeSaveOutreachEvent(() => setup.client);

    await save({
      event: minimalOutreachEventPayload({ id: 'event-1' }),
      sessions: [
        {
          sessionDate: '2026-08-01',
          startsAt: '2026-08-01T14:00:00.000Z',
          endsAt: '2026-08-01T16:00:00.000Z',
          notes: '',
          peopleReached: null,
        },
      ],
      expectedStudentIds: ['student-checked'],
      respondedBy: 'coach-1',
    });

    const rsvpCalls = setup.order.filter((call) => call.table === 'rsvps');
    expect(rsvpCalls.map((call) => call.method)).toEqual(['select', 'delete', 'upsert']);
    expect(setup.rsvpDeleteIds).toEqual([['rsvp-stale']]);
    expect(setup.rsvpUpsertArgs[0]).toEqual([
      {
        session_id: 'sess-1',
        student_id: 'student-checked',
        status: 'going',
        responded_by: 'coach-1',
        updated_at: expect.any(String),
      },
    ]);
  });
});

// ---------------------------------------------------------------------------
// T165.4: `makeCancelOutreachEvent` (module doc #6) -- flips every
// CURRENTLY-'scheduled' event_sessions row for the event to 'canceled';
// already-'completed' sessions, and other events' sessions, are deliberately
// left untouched.
// ---------------------------------------------------------------------------

interface EventSessionStatusFixture {
  id: string;
  event_id: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

/**
 * A stateful fake for `event_sessions.update({status}).eq(...).eq(...)`:
 * applies the patch only to rows matching BOTH recorded `.eq()` filters, so a
 * test can observe which rows actually flipped (state) rather than only
 * which arguments were passed (shape).
 */
function makeStatefulEventSessionsStatusClient(seed: readonly EventSessionStatusFixture[]): {
  client: SupabaseClient;
  store: Map<string, EventSessionStatusFixture>;
} {
  const store = new Map(seed.map((row) => [row.id, { ...row }]));
  const fromSpy = vi.fn((table: string) => {
    if (table !== 'event_sessions') {
      throw new Error(`unexpected table in T165 cancel-event fake: ${table}`);
    }
    return {
      update: (patch: { status: EventSessionStatusFixture['status'] }) => {
        let matches = [...store.values()];
        return {
          eq: (column1: string, value1: unknown) => {
            matches = matches.filter(
              (row) => (row as unknown as Record<string, unknown>)[column1] === value1,
            );
            return {
              eq: (column2: string, value2: unknown) => {
                matches = matches.filter(
                  (row) => (row as unknown as Record<string, unknown>)[column2] === value2,
                );
                for (const row of matches) store.set(row.id, { ...row, ...patch });
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
        };
      },
    };
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient, store };
}

describe('makeCancelOutreachEvent (T165) -- module doc #6 event-scoped cancel', () => {
  it("flips only the given event's currently-SCHEDULED sessions to canceled -- already-completed sessions and OTHER events' sessions are left untouched -- mutation: drop the `.eq('status', 'scheduled')` filter", async () => {
    const setup = makeStatefulEventSessionsStatusClient([
      { id: 'sess-scheduled', event_id: 'event-1', status: 'scheduled' },
      { id: 'sess-completed', event_id: 'event-1', status: 'completed' },
      { id: 'sess-other-event', event_id: 'event-2', status: 'scheduled' },
    ]);
    const cancel = makeCancelOutreachEvent(() => setup.client);

    await cancel('event-1');

    expect(setup.store.get('sess-scheduled')?.status).toBe('canceled');
    expect(setup.store.get('sess-completed')?.status).toBe('completed');
    expect(setup.store.get('sess-other-event')?.status).toBe('scheduled');
  });

  it('a rejected update surfaces as a real rejection -- not swallowed -- mutation: wrap `await mutate(eventId)` in a try/catch that swallows the error', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table !== 'event_sessions') throw new Error(`unexpected table: ${table}`);
      return {
        update: () => ({
          eq: () => ({
            eq: () =>
              Promise.resolve({ data: null, error: { message: 'boom', code: 'CANCEL_FAIL' } }),
          }),
        }),
      };
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;
    const cancel = makeCancelOutreachEvent(() => client);

    await expect(cancel('event-1')).rejects.toMatchObject({ code: 'CANCEL_FAIL' });
  });
});

// ---------------------------------------------------------------------------
// T165.5: `makeLoadOutreachEventRoster` -- reuses `loaders/students.ts`'s
// own `makeLoadStudentsTabData` (T089); filters to `isActive` students and
// reshapes into `OutreachRosterStudent`.
// ---------------------------------------------------------------------------

interface StudentTabFixtureRow {
  id: string;
  profile_id: string | null;
  display_name: string;
  team_id: string;
  grad_year: number | null;
  is_active: boolean;
  goal_hours_override: number | null;
  created_at: string;
}

function studentTabFixtureRow(overrides: Partial<StudentTabFixtureRow> = {}): StudentTabFixtureRow {
  return {
    id: 'student-default',
    profile_id: null,
    display_name: 'Default Student',
    team_id: 'team-1',
    grad_year: null,
    is_active: true,
    goal_hours_override: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeRosterStudentsClient(students: readonly StudentTabFixtureRow[]): {
  client: SupabaseClient;
} {
  const fromSpy = vi.fn((table: string) => {
    if (table === 'students') {
      return { select: () => ({ order: () => Promise.resolve({ data: students, error: null }) }) };
    }
    if (table === 'teams' || table === 'invites') {
      return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
    }
    throw new Error(`unexpected table in T165 roster fake: ${table}`);
  });
  return { client: { from: fromSpy } as unknown as SupabaseClient };
}

describe('makeLoadOutreachEventRoster (T165)', () => {
  it("filters to ACTIVE students only, and maps into OutreachRosterStudent's id/name/teamId/isActive shape -- mutation: drop the `.filter((student) => student.isActive)` line", async () => {
    const { client } = makeRosterStudentsClient([
      studentTabFixtureRow({
        id: 'student-active',
        display_name: 'Amara Chen',
        team_id: 't1',
        is_active: true,
      }),
      studentTabFixtureRow({
        id: 'student-inactive',
        display_name: 'Graduated Grad',
        team_id: 't2',
        is_active: false,
      }),
    ]);
    const loadRoster = makeLoadOutreachEventRoster(() => client);

    const roster = await loadRoster();

    expect(roster).toEqual([
      { id: 'student-active', name: 'Amara Chen', teamId: 't1', isActive: true },
    ]);
  });

  it('propagates a rejection from the underlying students load rather than swallowing it -- mutation: wrap the load in a try/catch that resolves an empty roster instead', async () => {
    const fromSpy = vi.fn((table: string) => {
      if (table === 'students') {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({ data: null, error: { message: 'boom', code: 'STUDENTS_FAIL' } }),
          }),
        };
      }
      if (table === 'teams' || table === 'invites') {
        return { select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;
    const loadRoster = makeLoadOutreachEventRoster(() => client);

    await expect(loadRoster()).rejects.toMatchObject({ code: 'STUDENTS_FAIL' });
  });
});
