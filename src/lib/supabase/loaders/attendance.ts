/**
 * T117 (PRD v2 UXP-01): real `attendance` data-layer wiring for
 * `src/pages/outreach/AttendancePanel.tsx` -- the coach-managed,
 * per-session-day attendance + per-student hours panel on `OutreachDetail`.
 * Built on T086's `createLoader`/`runMutation` (`../loader.ts`, read-only
 * import here), same DI (`getClient`) convention every prior loader module
 * (`loaders/students.ts`, `loaders/invites.ts`) already established.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `attendance` column shapes, cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql` lines
 *    82-95 (read-only, unmodified by this task -- SCH-04/T114 already
 *    proved the RLS this file relies on, `supabase/**` is Forbidden Files
 *    here regardless):
 *
 *      id uuid pk, session_id uuid not null fk event_sessions (restrict),
 *      student_id uuid not null fk students (restrict), status text check
 *      ('present'|'late'|'excused'|'absent'), check_in_at timestamptz null,
 *      check_out_at timestamptz null, hours_override numeric null, method
 *      text check ('qr'|'coach'|'import'), recorded_by uuid fk profiles
 *      (nullable, restrict), updated_at, created_at, unique (session_id,
 *      student_id).
 *
 *    `method`'s check constraint above is the ORIGINAL three-value list --
 *    SUPERSEDED (widened to add `'self'`) by
 *    `supabase/migrations/20260724000000_self_checkoff.sql:31-33`; see this
 *    file's own `AttendanceMethod` comment below. Kept here verbatim as the
 *    historical record of `20260717000000_scheduling_attendance.sql`'s
 *    original text -- do not delete.
 *
 *    SCH-04 (PRD v2 section 3, resolved 2026-07-20 by T114): `staff_all`
 *    (`for all ... using (is_staff()) with check (is_staff())`) has existed
 *    on `attendance` since v1 -- staff (admin/coach) may write any student's
 *    rows already, no new migration needed. This file is therefore pure
 *    frontend wiring against an already-permitted write surface.
 *
 * -----------------------------------------------------------------------
 * 2. TRAP #2 -- un-mark semantics (worker packet Known Context/Traps #2),
 *    THE central design decision of this file.
 *
 *    AMENDED 2026-07-20 (T119, PRD v2 section 0 decision D-7 -- George's
 *    direct product-owner override, verbatim: "As coach I am ultimate
 *    authority and should be able to overwrite an RSVP or check-ins."): the
 *    "setAbsent" branch this doc entry originally described below (demoting
 *    a real `'qr'`/`'import'` row to `status: 'absent'` instead of deleting
 *    it, to preserve `check_in_at` as history) is REMOVED. `resolveUnmark
 *    Action`/`UnmarkAction` (T117's pure decision function/type for that
 *    branch) no longer exist in this file -- un-marking a student now
 *    performs a plain DELETE for every `method` (`'coach'`, `'qr'`,
 *    `'import'`) alike; the caller (`AttendancePanel.tsx`'s `handleToggle`)
 *    calls `onRemoveAttendance` unconditionally on uncheck, no branch. The
 *    paragraphs immediately below are KEPT AS THE ORIGINAL T117 RECORD of
 *    what this reasoning was (repo convention, see `TeamsTab.tsx`/
 *    `ParentsTab.tsx`'s own "SUPERSEDED BY" notes for precedent) -- they no
 *    longer describe this file's actual behavior; a coach's attendance
 *    correction MAY now remove a QR-originated check-in row outright,
 *    per D-7.
 *
 *    `resolveAttendanceWriteMethod` below is the ONE place the CHECKED-row
 *    write-method decision is made -- pure, exported, directly tested
 *    without a fake `SupabaseClient` (same "pure decision logic, separately
 *    testable from the DB-driving wrapper" shape
 *    `supabase/functions/checkin/attendance_upsert.ts` (read-only,
 *    T032/MTG-09/MTG-11) already established for this exact table). This
 *    part is UNCHANGED by D-7 (module doc's own "3. Keep what D-7 keeps" in
 *    the T119 worker packet): it is provenance LABELING on a row a coach is
 *    actively editing while it stays checked (e.g. adjusting hours on an
 *    already-checked-in student), not a veto over deleting/overwriting
 *    anything -- D-7 only overrides veto power, not attribution.
 *
 *    ORIGINAL T117 RECORD (superseded un-mark reasoning, kept for history):
 *    unchecking an attended student DELETED the row when its existing
 *    `method` was `'coach'` (or no row existed at all -- a defensive
 *    no-op) -- this matched the reference app's plain checkbox model
 *    (packet's own wording) and was verified safe against both metric
 *    views below. When the existing row's `method` was `'qr'` or
 *    `'import'` (i.e. it carried real external provenance -- someone
 *    actually scanned in, or a row was imported), unchecking instead
 *    UPSERTED `status: 'absent'`, cleared `hours_override` to `null`, and
 *    re-attributed `recorded_by` to the acting coach, while the upsert
 *    payload never included `check_in_at`/`check_out_at` at all -- so
 *    Postgrest's `ON CONFLICT DO UPDATE SET (...)` (built only from the
 *    keys actually present in the payload) left those two columns
 *    untouched, preserving the real check-in timestamp as honest history
 *    (packet's own explicit example: "keep check_in_at, update
 *    hours_override/status, set recorded_by to the coach"). `method` itself
 *    was likewise preserved verbatim on this path (never rewritten to
 *    `'coach'`) -- the packet's own example list never said to touch
 *    `method`, and provenance ("how did this student's presence first get
 *    captured") was treated as a fact about the past that a later coach
 *    edit to status/hours did not change.
 *
 *    Verified against both metric views this table feeds
 *    (`supabase/migrations/20260717000003_metric_views.sql`, read-only) --
 *    this metrics-safety analysis remains true of the NEW plain-DELETE rule
 *    too, since DELETE was already one of the two branches proven safe here:
 *      - `v_student_hours` sums `... where a.status in ('present','late')`.
 *        A DELETED row and a `status = 'absent'` row are BOTH simply absent
 *        from that sum -- mathematically identical outcomes.
 *      - `v_student_participation` LEFT JOINs `attendance` onto the expected
 *        roster; a genuinely missing row (`a.status` is SQL `NULL` after
 *        the join) and an explicit `'absent'` row are BOTH excluded from
 *        `present_ct`/`late_ct`/`excused_ct` while both still count toward
 *        `expected_ct` -- again mathematically identical for this view's
 *        math. DELETE is therefore metrics-safe in every case this file
 *        now chooses it for.
 *
 *    `checkin` Edge Function interaction (disclosed, not a blocker,
 *    STRENGTHENED by D-7): that function's own `applyUpsertIgnoreDuplicates`
 *    (`supabase/functions/checkin/attendance_upsert.ts`, read-only) treats
 *    "no existing row for (session_id, student_id)" as "this student has
 *    never checked in" -- so if a coach DELETES ANY row for this session/
 *    student (now including a real `'qr'`/`'import'` row, per D-7) and that
 *    same student later scans a QR code for the same session, the scan is
 *    honestly treated as their first-ever check-in for that session. Under
 *    D-7 this is the correct, intended outcome for every `method`: the
 *    coach is the ultimate authority and a deletion means "this record
 *    should not stand", full stop -- there is no longer a distinction
 *    between "this coach-entered record was a mistake" and "this student's
 *    real physical check-in history should be forgotten" for the purposes
 *    of who may delete it.
 *
 * -----------------------------------------------------------------------
 * 3. Upsert key -- the packet's own banked DDL fact, applied literally.
 *
 *    Every write in this file that can hit the real `unique (session_id,
 *    student_id)` constraint uses `.upsert(..., { onConflict:
 *    'session_id,student_id' })` (no `ignoreDuplicates` -- unlike the
 *    `checkin` Edge Function's own insert-only QR path, a COACH's write is
 *    always meant to take effect, even against an existing row -- this is
 *    the intentional difference: `checkin`'s upsert models "first write
 *    wins" for a self-service kiosk flow; this file's upsert models
 *    "the acting coach's write is authoritative" for a staff-driven
 *    correction flow. Real column names only (`session_id`, `student_id`,
 *    `status`, `hours_override`, `method`, `recorded_by`) -- `check_in_at`/
 *    `check_out_at` are DELIBERATELY never included in any upsert payload
 *    this file builds (module doc #2's history-preservation mechanism).
 *
 * -----------------------------------------------------------------------
 * 4. No metric-formula re-derivation (constitution item 3). This file is a
 *    pure read/write data layer over `attendance` -- it never computes a
 *    student's confirmed-hours total, participation rate, or any other
 *    `v_student_hours`/`v_student_participation` output. `AttendancePanel.tsx`'s
 *    own module doc has the parallel disclosure for the small, honest,
 *    non-authoritative "hours recorded this event" display sum it computes
 *    locally over rows THIS panel itself just wrote (the same category of
 *    legitimate local aggregation `MarkDayCompleteDialog.tsx`'s own module
 *    doc #2(b) already established for this exact table).
 *
 * -----------------------------------------------------------------------
 * 5. T403 step 3 -- `makeSetAttendanceStatus`, a PARALLEL upsert for
 *    `LiveConsole.tsx`'s coach-driven roll-call, ADDED rather than folded
 *    into `makeUpsertAttendance` above.
 *
 *    TRAP 1 (T403 step-3 worker packet, `checker-premise`-CONFIRMED on a
 *    real PostgreSQL 16 database loaded with this repo's migrations, running
 *    the exact `ON CONFLICT` statement Postgrest generates from
 *    `makeUpsertAttendance`'s payload): `makeUpsertAttendance`'s payload
 *    always includes `hours_override`, and Postgrest's `ON CONFLICT DO
 *    UPDATE SET` touches every column present in the payload -- the SAME
 *    mechanism #3 above relies on to preserve `check_in_at`/`check_out_at`
 *    as history, proven from both directions on that real database:
 *    `check_in_at` survived an upsert, `hours_override` did not. A
 *    `LiveConsole` roll-call click has no `hoursOverride` value of its own
 *    to send, so routing it through `makeUpsertAttendance` with
 *    `hoursOverride: null` against a row where a coach had previously set a
 *    manual override would silently null that override out on every status
 *    change -- real data loss, not a display bug.
 *
 *    The fix is the same payload-OMISSION mechanism #3 already banks,
 *    applied to `hours_override`: `makeSetAttendanceStatus`'s upsert payload
 *    is exactly `{session_id, student_id, status, method, recorded_by}` --
 *    no `hours_override` key at all. The insert path gets `hours_override
 *    NULL` from the column's own default (there is no existing row, so
 *    nothing to preserve); the update path never mentions the column, so
 *    Postgrest's generated `SET` clause cannot touch it. A read-modify-write
 *    (fetch the row, resend its existing `hoursOverride` verbatim) was
 *    considered and rejected: it costs an extra round trip and opens a
 *    TOCTOU window where a concurrent QR scan lands between the read and the
 *    write and is silently clobbered by a stale snapshot -- the omission fix
 *    has neither cost.
 *
 *    `makeUpsertAttendance` above is intentionally UNMODIFIED -- byte-
 *    identical to before this addition. Its only real caller is
 *    `AttendancePanel.tsx` (`onUpsertAttendance`'s default), which still
 *    legitimately needs to write a coach's manual `hoursOverride`; changing
 *    ITS payload shape was never this fix's job (packet: blast radius is
 *    ZERO). Same `onConflict: 'session_id,student_id'` / `.select().single()`
 *    shape as module doc #3 -- this is a second write path onto the same
 *    table and constraint, not a new decision.
 *
 *    Disclosed limit (owner instruction, worker packet section 4c#1): this
 *    file's own build could not run the Postgrest binary directly. The
 *    payload-keys -> generated `DO UPDATE SET` translation is INFERRED here,
 *    not observed end to end by this worker -- well-grounded (the shipped
 *    `check_in_at` mechanism depends on the identical translation, and the
 *    premise gate exercised it from both directions on a real database) but
 *    stated as a residual, not a proven fact.
 *
 *    Sibling observation, NOT fixed here (packet Trap 1, explicitly out of
 *    scope for this step): `loaders/outreach.ts`'s own unrelated,
 *    locally-declared `upsertAttendance` (same table, different function,
 *    different shape -- the packet's own disclosed "decoy") carries the
 *    identical `hours_override` payload key under the same `onConflict`.
 *    That file is W2's, actively edited right now, and out of scope here;
 *    reported so W2 can weigh whether the same mechanism reaches it.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of the real `attendance` column subset
// (module doc #1).
// ---------------------------------------------------------------------------

export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

/**
 * GAM-479 -- the `attendance.status` sentinel meaning "a coach cleared this
 * mark and the row's other columns are being kept"
 * (`supabase/migrations/20260822000000_attendance_unmarked_sentinel.sql`).
 *
 * **It is deliberately NOT a member of `AttendanceStatus`.** `'unmarked'` is a
 * STORAGE state, not an application state: every read in this directory
 * filters it out with `.neq('status', UNMARKED_DB_STATUS)`, so above the
 * loader boundary a cleared row is indistinguishable from no row at all and
 * the four-value union -- and every exhaustive `Record<AttendanceStatus, ...>`
 * built on it -- stays exactly as it was. Widening the union instead would
 * push a fifth arm into every consumer for a value none of them can ever see.
 *
 * The two reads that deliberately do NOT filter it are
 * `meetings.ts`'s `queryAttendanceExistsForSessions` and `endMeeting.ts`'s
 * `markAbsences` sweep; both say why at their own call sites.
 */
export const UNMARKED_DB_STATUS = 'unmarked';

/**
 * GAM-479 -- the ONE filter that enforces `UNMARKED_DB_STATUS`'s "storage
 * state, never an application state" invariant. Every `query*` function in
 * this directory that selects `attendance.status` wraps its result in this.
 *
 * It filters in TypeScript rather than adding `.neq('status', ...)` to each
 * query on purpose. A `.neq` clause is invisible to this repo's hand-rolled
 * per-file query-builder fakes, whose `.eq`/`.in` chains are deliberate
 * passthroughs that record arguments instead of filtering
 * (`coachHome.test.ts:38-42` states that trap explicitly) -- so a fixture
 * carrying a cleared row could never reach the filter, and the tests below
 * could not show it being dropped. Filtering here puts the invariant on the
 * path the fixtures actually exercise.
 *
 * **`undefined` is accepted and normalised to `null`, and the parameter type
 * says so on purpose.** Every call site passes
 * `result.data as SomeDbRow[] | null`, and that cast LIES: Postgrest can
 * resolve `data` as `undefined`, and this repo's own query-builder fakes
 * routinely return a bare `{}` for a table the fixture never stubbed. The
 * expression this helper replaced was `(result.data as T[] | null) ?? null`,
 * whose `?? null` was doing exactly this coercion -- dropping it turned a
 * `undefined` into `undefined.filter(...)` and took out GAM-451's
 * selected-child boundary test on the merge with `main`. Narrowing the
 * parameter back to `T[] | null` would compile, because the cast hides the
 * real type, and break at runtime again.
 *
 * Both nullish inputs return `null`: every caller distinguishes `null` (a
 * query error) from `[]` (no rows).
 */
export function excludeUnmarked<T extends { status: string }>(
  rows: T[] | null | undefined,
): T[] | null {
  return rows == null ? null : rows.filter((row) => row.status !== UNMARKED_DB_STATUS);
}
/** `attendance.method` check constraint -- widened to permit `'self'` by
 * `supabase/migrations/20260724000000_self_checkoff.sql:31-33` (current
 * source of truth; the original three-value constraint was
 * `20260717000000_scheduling_attendance.sql` line 90). */
export type AttendanceMethod = 'qr' | 'coach' | 'import' | 'self';

export interface AttendanceRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  hoursOverride: number | null;
  method: AttendanceMethod;
  recordedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

/** Raw `public.attendance` row exactly as Postgrest returns it (snake_case)
 * -- module doc #1. */
interface AttendanceDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  check_in_at: string | null;
  check_out_at: string | null;
  hours_override: number | null;
  method: AttendanceMethod;
  recorded_by: string | null;
  updated_at: string;
  created_at: string;
}

function mapAttendanceDbRowToAttendanceRow(row: AttendanceDbRow): AttendanceRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    hoursOverride: row.hours_override,
    method: row.method,
    recordedBy: row.recorded_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Trap #2 -- pure decision function. Module doc #2.
//
// T119 (PRD v2 D-7): `resolveUnmarkAction`/`UnmarkAction` (T117's un-mark
// branch decision) are REMOVED from this file -- un-marking is no longer a
// decision at all, it is unconditional for every `method`. GAM-479 changed
// what that unconditional action IS (a `'unmarked'` sentinel write via
// `makeClearAttendanceStatus`, no longer a row DELETE) without reintroducing
// a branch. Only `resolveAttendanceWriteMethod` (the write-method LABEL,
// unchanged by D-7 per module doc #2, and used by the clear path too so a
// cleared `qr` row keeps saying `qr`) remains here.
// ---------------------------------------------------------------------------

/**
 * The write method for a coach-initiated present/hours upsert. A row that
 * already carries real external provenance (`'qr'`/`'import'`) keeps that
 * provenance; a row this coach is originating from scratch (no existing row,
 * or an existing `'coach'` row) is/stays `'coach'`.
 */
export function resolveAttendanceWriteMethod(
  existingMethod: AttendanceMethod | null,
): AttendanceMethod {
  return existingMethod === 'qr' || existingMethod === 'import' ? existingMethod : 'coach';
}

// ---------------------------------------------------------------------------
// Load -- every `attendance` row for a set of `event_sessions` ids.
// ---------------------------------------------------------------------------

export type LoadAttendanceForSessionsFn = (
  sessionIds: readonly string[],
) => Promise<AttendanceRow[]>;

/**
 * T320: mirrors `supabase/config.toml:18`'s `[api] max_rows = 1000`.
 *
 * PostgREST silently truncates any response at that cap and returns **200
 * with a partial `Content-Range`** -- not an error -- so `createLoader`
 * (`../loader.ts`, which throws only on `result.error`) resolved a partial
 * array that every caller read as complete. Requesting a page larger than
 * `max_rows` does not help: the server clamps it. Paginating is the only
 * way to see past the cap.
 *
 * Exported so the pagination boundary is assertable from a test rather than
 * inferred from a magic number.
 */
export const ATTENDANCE_PAGE_SIZE = 1000;

/**
 * Upper bound on pages, so a server that ignores `.range()` produces a
 * diagnosable error instead of an unbounded loop. 100 pages is 100,000
 * attendance rows -- orders of magnitude beyond anything this deployment can
 * reach (the live database holds 79), so tripping it means something is
 * wrong with the transport, not with the data.
 */
const ATTENDANCE_MAX_PAGES = 100;

/**
 * T320: ONE page of the `attendance` rows for a set of session ids.
 *
 * `.order('id')` is **load-bearing, not cosmetic**. Page N+1 is defined as
 * an offset into a result set, and Postgres gives no ordering guarantee
 * without an explicit `order by` -- so paginating an unordered query can
 * return the same row on two pages and never return another. `id` is the
 * table's uuid primary key (migration lines 82-95, cited in module doc #1),
 * so it is total, stable, and always present.
 */
async function queryAttendanceForSessionsPage(
  client: SupabaseClient,
  args: { sessionIds: readonly string[]; from: number },
): Promise<LoaderQueryResult<AttendanceDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('*')
    .in('session_id', [...args.sessionIds])
    .order('id', { ascending: true })
    .range(args.from, args.from + ATTENDANCE_PAGE_SIZE - 1);
  return { data: (result.data as AttendanceDbRow[] | null) ?? null, error: result.error };
}

/**
 * Injectable-`getClient` convention every prior loader module in this
 * directory already established, so tests supply a stubbed transport with
 * zero real network calls. Short-circuits to `[]` for an empty
 * `sessionIds` (an event with no sessions yet) without ever issuing a
 * `.in('session_id', [])` query, which some Postgrest configurations treat
 * as "match nothing" but is unnecessary network traffic either way.
 */
export function makeLoadAttendanceForSessions(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadAttendanceForSessionsFn {
  const loadPage = createLoader<{ sessionIds: readonly string[]; from: number }, AttendanceDbRow[]>(
    queryAttendanceForSessionsPage,
    getClient,
  );
  return async (sessionIds) => {
    if (sessionIds.length === 0) return [];
    // T320: page until a SHORT page comes back. A full page is ambiguous --
    // it means "at least this many", never "exactly this many" -- so a full
    // final page costs one extra empty request rather than silently dropping
    // whatever followed it. That ambiguity is the entire bug being fixed.
    const rows: AttendanceDbRow[] = [];
    for (let page = 0; page < ATTENDANCE_MAX_PAGES; page += 1) {
      const pageRows = await loadPage({ sessionIds, from: page * ATTENDANCE_PAGE_SIZE });
      // T502: `null` here is NOT "zero rows" -- it is "no answer". `createLoader`
      // returns `result.data ?? null` WITHOUT throwing when `data` and `error`
      // are both null (`loader.ts:174-177`), and postgrest-js really can produce
      // that pair: an empty 2xx body, and a 404 that it rewrites to status 204
      // leaving `error` null. The previous `?? []` collapsed that anomaly into
      // an empty page, which this loop then reads as "shorter than a full page,
      // so we are done" -- and it returns fewer attendance rows than exist,
      // silently. That is the exact silent-truncation class T320 exists to
      // remove, re-entering through the one door T320 left open.
      //
      // Throwing is deliberate and matches the page-cap branch below: a caller
      // that cannot get a trustworthy answer must be told, never handed a short
      // list that looks complete. A genuinely empty result set arrives as `[]`,
      // not `null`, so the ordinary "no attendance yet" path is untouched.
      if (pageRows === null) {
        throw new Error(
          `loadAttendanceForSessions: page ${page} resolved with neither rows nor an ` +
            `error, so the result set cannot be trusted to be complete`,
        );
      }
      rows.push(...pageRows);
      if (pageRows.length < ATTENDANCE_PAGE_SIZE) {
        return rows.map(mapAttendanceDbRowToAttendanceRow);
      }
    }
    // Only reachable if every one of ATTENDANCE_MAX_PAGES pages came back
    // full. Throwing keeps this loader's contract honest -- returning the
    // rows gathered so far would reintroduce exactly the silent-truncation
    // behaviour T320 exists to remove.
    throw new Error(
      `loadAttendanceForSessions: exceeded ${ATTENDANCE_MAX_PAGES} pages of ` +
        `${ATTENDANCE_PAGE_SIZE} rows without reaching the end of the result set`,
    );
  };
}

/** Default `loadAttendance` for `AttendancePanel.tsx` -- real query. */
export const loadAttendanceForSessions: LoadAttendanceForSessionsFn =
  makeLoadAttendanceForSessions();

// ---------------------------------------------------------------------------
// Upsert -- the ONE place a coach's present/absent/hours write happens.
// Module doc #3.
// ---------------------------------------------------------------------------

export interface UpsertAttendanceParams {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  /** `null` = no explicit override -- `v_student_hours`'s own coalesce falls
   * back to the real session-duration tier itself; never back-filled with a
   * computed default here (same discipline
   * `MarkDayCompleteDialog.tsx`'s own `buildAttendanceWriteRows` already
   * established for this exact column). */
  hoursOverride: number | null;
  method: AttendanceMethod;
  /** `attendance.recorded_by` -- always the ACTING coach's own
   * `profiles.id` (module doc #2 -- always re-attributed to whoever is
   * editing right now, even when `method` itself is preserved as `'qr'`). */
  recordedBy: string;
}

export type UpsertAttendanceFn = (params: UpsertAttendanceParams) => Promise<AttendanceRow>;

/**
 * Module doc #3 -- `onConflict: 'session_id,student_id'`, the packet's own
 * banked DDL fact, applied literally. Deliberately never includes
 * `check_in_at`/`check_out_at` in the payload (module doc #2's history-
 * preservation mechanism: Postgrest's `ON CONFLICT DO UPDATE SET` only ever
 * touches columns present in the payload). Resolves the freshly-written row
 * (`.select().single()`) so the caller can merge the real DB-assigned
 * `id`/`updatedAt`/`createdAt` into local state, same "resolve the written
 * row" discipline `loaders/students.ts`'s own `createStudent`/
 * `updateStudent` already established.
 */
export function makeUpsertAttendance(
  getClient: () => SupabaseClient = getSupabaseClient,
): UpsertAttendanceFn {
  const mutate = runMutation<UpsertAttendanceParams, AttendanceDbRow>(
    (client, params) =>
      client
        .from('attendance')
        .upsert(
          {
            session_id: params.sessionId,
            student_id: params.studentId,
            status: params.status,
            hours_override: params.hoursOverride,
            method: params.method,
            recorded_by: params.recordedBy,
          },
          { onConflict: 'session_id,student_id' },
        )
        .select()
        .single(),
    getClient,
  );
  return async (params) => mapAttendanceDbRowToAttendanceRow(await mutate(params));
}

/** Default `onUpsertAttendance` for `AttendancePanel.tsx` -- real upsert. */
export const upsertAttendance: UpsertAttendanceFn = makeUpsertAttendance();

// ---------------------------------------------------------------------------
// Set status -- T403 step 3, module doc #5. A PARALLEL write path onto the
// same table/constraint as the upsert above, added specifically so a coach
// roll-call action in `LiveConsole.tsx` never has to send a `hours_override`
// value it does not have.
// ---------------------------------------------------------------------------

export interface SetAttendanceStatusParams {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  /** `attendance.recorded_by` -- always the ACTING coach's own
   * `profiles.id`, same contract as `UpsertAttendanceParams.recordedBy`
   * above (module doc #2 -- always re-attributed to whoever is editing
   * right now, even when `method` itself is preserved as `'qr'`/`'import'`). */
  recordedBy: string;
}

export type SetAttendanceStatusFn = (params: SetAttendanceStatusParams) => Promise<AttendanceRow>;

/**
 * Module doc #5 -- T403 step 3's Trap 1 fix. Same `onConflict:
 * 'session_id,student_id'` / `.select().single()` shape as
 * `makeUpsertAttendance`, but the payload deliberately OMITS
 * `hours_override`: the insert path gets the column's own default, the
 * update path never mentions it, so Postgrest's generated `ON CONFLICT DO
 * UPDATE SET` cannot touch it -- an existing coach-set hours override
 * survives a later status change untouched. `makeUpsertAttendance` above is
 * unmodified; this is a parallel write path, not a replacement.
 */
export function makeSetAttendanceStatus(
  getClient: () => SupabaseClient = getSupabaseClient,
): SetAttendanceStatusFn {
  const mutate = runMutation<SetAttendanceStatusParams, AttendanceDbRow>(
    (client, params) =>
      client
        .from('attendance')
        .upsert(
          {
            session_id: params.sessionId,
            student_id: params.studentId,
            status: params.status,
            method: params.method,
            recorded_by: params.recordedBy,
          },
          { onConflict: 'session_id,student_id' },
        )
        .select()
        .single(),
    getClient,
  );
  return async (params) => mapAttendanceDbRowToAttendanceRow(await mutate(params));
}

/** Default `onSetAttendanceStatus` for `LiveConsole.tsx` -- real upsert that
 * never touches `hours_override` (module doc #5). */
export const setAttendanceStatus: SetAttendanceStatusFn = makeSetAttendanceStatus();

// ---------------------------------------------------------------------------
// Clear -- GAM-479. The chip cycle's `(unset)` stop, as a non-destructive
// write. This is what `SessionRow.tsx` calls; it is NOT the outreach
// checkbox's un-mark, which is still the real DELETE below.
// ---------------------------------------------------------------------------

export interface ClearAttendanceStatusParams {
  sessionId: string;
  studentId: string;
  method: AttendanceMethod;
  /** `attendance.recorded_by` -- the ACTING coach, same contract as
   * `SetAttendanceStatusParams.recordedBy`. Clearing a mark is an edit, so
   * the row records who cleared it even though `method` is left alone as the
   * provenance of the `check_in_at` being preserved. */
  recordedBy: string;
}

export type ClearAttendanceStatusFn = (params: ClearAttendanceStatusParams) => Promise<void>;

/**
 * GAM-479. Writes `status: UNMARKED_DB_STATUS` through the SAME upsert shape
 * `makeSetAttendanceStatus` above uses, and for the same reason: the payload
 * omits `hours_override` AND `check_in_at`/`check_out_at`, so Postgrest's
 * generated `ON CONFLICT DO UPDATE SET` cannot touch them. Clearing a mark
 * therefore preserves the QR check-in timestamp and any coach-set hours
 * override -- the exact columns the old `makeRemoveAttendance` wiring
 * destroyed, with no audit trail behind them
 * (`20260803000000_simplify_attendance_audit.sql:38-39` dropped it).
 *
 * `method` is a required param rather than a hardcoded `'coach'` because the
 * insert path needs a value for a `not null` column when no row exists yet
 * (a `Shift`-tap backward from `Present` reaches this stop with nothing in the
 * table). Callers pass `resolveAttendanceWriteMethod`'s answer, so a cleared
 * `'qr'` row keeps saying `'qr'`.
 *
 * Returns `void`, not an `AttendanceRow`: the written row's `status` is the
 * sentinel, which is by construction not an `AttendanceStatus`, and no caller
 * uses the round-trip -- `SessionRow.tsx` has already applied its optimistic
 * `null` before awaiting.
 */
export function makeClearAttendanceStatus(
  getClient: () => SupabaseClient = getSupabaseClient,
): ClearAttendanceStatusFn {
  const mutate = runMutation<ClearAttendanceStatusParams, void>(
    (client, params) =>
      client.from('attendance').upsert(
        {
          session_id: params.sessionId,
          student_id: params.studentId,
          status: UNMARKED_DB_STATUS,
          method: params.method,
          recorded_by: params.recordedBy,
        },
        { onConflict: 'session_id,student_id' },
      ),
    getClient,
  );
  return async (params) => {
    await mutate(params);
  };
}

/** Default `onClearAttendance` for `SessionRow.tsx`'s chip cycle. */
export const clearAttendanceStatus: ClearAttendanceStatusFn = makeClearAttendanceStatus();

// ---------------------------------------------------------------------------
// There is no attendance DELETE in this file, deliberately (GAM-479).
//
// `RemoveAttendanceParams`, `RemoveAttendanceFn`, `makeRemoveAttendance` and
// `removeAttendance` used to live here and are GONE. Both callers moved to
// `makeClearAttendanceStatus` above: `SessionRow.tsx`'s chip cycle and
// `AttendancePanel.tsx`'s checkbox. The seam is removed rather than left
// exported-but-unused because an exported delete is an invitation to re-wire
// the exact data-loss path GAM-479 closed -- a coach clearing a mark must not
// be able to destroy a QR `check_in_at` or an `hours_override` again, and the
// audit trigger that would have recovered them was dropped by
// `20260803000000_simplify_attendance_audit.sql:38-39`.
//
// D-7 is untouched by the removal: a coach still clears any mark, of any
// `method`, with one action and no permission check. Consequence worth
// knowing: `attendance` rows are now append-and-update only, so a session
// that ever carried marks stays undeletable (`session_id` is
// `on delete restrict`) and `meetings.ts`'s own session-removal guard routes
// it to `cancel` -- which is what it already did for a session with marks.
// ---------------------------------------------------------------------------
