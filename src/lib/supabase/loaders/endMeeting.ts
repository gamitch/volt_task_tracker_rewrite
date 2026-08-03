/**
 * T178 (revision 2 -- BUILD HALF ONLY, mount split to T196): the real
 * backend behind `src/pages/meetings/EndMeetingDialog.tsx`'s three
 * injectable seams (`loadSummary`/`onEndMeeting`/`onEditAttendance`), all of
 * which are `console.warn`/fixture stubs today. Built on T086's
 * `createLoader`/`runMutation` (`../loader.ts`, read-only import here), same
 * DI (`getClient`) convention every prior loader module in this directory
 * already established. `EndMeetingDialog.tsx` is a frozen, forbidden file
 * here (module doc only) -- every page-facing type below is imported from
 * it, never redefined.
 *
 * NOT wired into `EndMeetingDialog.tsx`/`LiveConsole.tsx`/any route by this
 * task. The mount is filed as its own row, T196, blocked -- because
 * `LiveConsole.tsx`'s own attendance marking is an intentional no-op
 * (`:510-511`) and its roster loader is a fixture, so a real End Meeting
 * dialog mounted on top of that fixture-backed console would, on first real
 * use, mark every actually-checked-in student a real `absent` row (the
 * owner-ruled reason for the split -- see `docs/swarm/active/
 * T178-gate-round1-findings.md`, BLOCKER 3).
 *
 * -----------------------------------------------------------------------
 * 1. Three sequenced `runMutation` calls, not a transaction/RPC -- and the
 *    positive reason no RPC is needed.
 * -----------------------------------------------------------------------
 *
 * `makeOnEndMeeting` below issues, always in this order, always awaited
 * sequentially (never `Promise.all`'d, never reordered):
 *   1. Backfill absences -- `.upsert(rows, { onConflict:
 *      'session_id,student_id', ignoreDuplicates: true })` on `attendance`
 *      for `payload.backfillAbsentStudentIds`, one `status: 'absent',
 *      method: 'coach', recorded_by: null` row per student (backfilled rows
 *      are `recorded_by: null` by `EndMeetingDialog.tsx`'s own
 *      `applyEndMeetingResult` design -- this file mirrors that, not
 *      reinvents it).
 *   2. Checkout -- `.update({ check_out_at: payload.endsAt })` on
 *      `attendance` for `payload.checkoutStudentIds`, scoped by
 *      `session_id` + `.in('student_id', ...)`, guarded
 *      `.is('check_out_at', null)` so it never clobbers a real checkout
 *      stamp set some other way.
 *   3. Status flip -- `.update({ status: 'completed' })` on
 *      `event_sessions`, scoped `.eq('id', sessionId)`. ALWAYS last.
 *
 * Ordering history: this sequence was originally required by
 * `trg_audit_attendance_post_completion`, an `after update on
 * public.attendance` trigger that logged any attendance UPDATE against an
 * already-`'completed'` session. Running checkout (step 2) after the flip
 * would have logged the coach's own routine meeting-close checkout as a
 * post-completion correction. That trigger was REMOVED in
 * `supabase/migrations/20260803000000_simplify_attendance_audit.sql` --
 * post-completion attendance corrections are a normal workflow for this
 * team and are deliberately not audit-logged (PRD DATA-02).
 *
 * The ordering is RETAINED, but on the independent justification below
 * (safe partial-failure states), not for audit reasons. The only trigger
 * now on `attendance` is `trg_attendance_touch_updated_at` (a `before
 * insert or update` timestamp touch), which is order-independent.
 *
 * **The actual, positive justification for three sequenced calls instead of
 * an RPC** (not "we can't prove otherwise"): because the flip is always
 * last, EVERY reachable partial-failure state fails in the safe direction.
 * If step 2 (checkout) rejects, step 1 (backfill) has already landed but
 * the session is still `'scheduled'` -- no audit pollution, and a retry is
 * a clean no-op (idempotent: `ignoreDuplicates` for the backfill,
 * `.is('check_out_at', null)` for the checkout, both re-setting the same
 * terminal value for the flip). If step 3 (flip) rejects, steps 1+2 have
 * landed but the session is still `'scheduled'` -- same safe outcome, same
 * clean retry. There is NO ordering under this design in which the flip
 * lands and the checkout doesn't. This design property, not an inability to
 * prove transactional atomicity, is why three sequenced `runMutation` calls
 * are sufficient here.
 *
 * **Disclosed risk, honestly, not softened:** if step 2 or step 3 rejects
 * after an earlier step already succeeded, the database IS left in that
 * partial state until the coach retries -- this file does not roll back an
 * earlier successful write on a later failure (there is nothing to roll
 * back TO that would be safer than the state already reached, per the
 * safety property above, so this is a deliberate choice, not an oversight).
 *
 * **The human-facing side of that disclosure, which the database-safety
 * story above does NOT cover:** `runMutation` (`../loader.ts`) normalizes
 * EVERY rejection through `toLoaderError` into a plain `SupabaseLoaderError`
 * object (`{code, message, cause}`), never an `Error` instance.
 * `EndMeetingDialog.tsx`'s own frozen `handleConfirmEndMeeting` catch block
 * does `error instanceof Error ? error.message : 'Something went wrong
 * ending this meeting.'` -- since this file's rejections are never `Error`
 * instances, that check always falls through to the frozen generic
 * fallback. A coach who hits a partial failure sees only "Couldn't end
 * this meeting... Something went wrong ending this meeting," concatenated
 * with the `AlertDialog`'s own fixed title -- NEVER the real Postgres
 * error, and NOTHING about which partial state was reached. This cannot be
 * improved inside this file (`EndMeetingDialog.tsx` is frozen, out of scope
 * for this task) -- stated here plainly so the database-level safety
 * property above is not mistaken for the coach also being informed. They
 * are not.
 *
 * -----------------------------------------------------------------------
 * 2. `onEditAttendance` identity -- read fresh on every call, never baked.
 * -----------------------------------------------------------------------
 *
 * `onEndMeeting`/`EndMeetingPayload` needs no acting-coach identity
 * (backfilled rows are `recorded_by: null`, section 1 above). A real
 * `attendance` UPDATE through `onEditAttendance`, per `loaders/
 * attendance.ts`'s own established convention for this table (module doc
 * #2 there), DOES need the real acting coach's id in `recorded_by`. Since
 * `OnEditAttendanceFn`'s own signature (`EndMeetingDialog.tsx`, frozen)
 * carries no identity parameter, identity is captured by
 * `makeOnEditAttendance(getRecordedBy, getClient?)`'s own closure --
 * `getRecordedBy: () => string | null` is called FRESH on every invocation
 * of the returned function, never read once at factory-construction time,
 * so it stays correct behind a `useRef`-backed accessor that changes across
 * renders once T196 wires this factory to a real `useAuth()` ref. This file
 * has no mount in scope, so nothing here calls this factory against a real
 * ref -- that wiring is T196's job; this file's job is to make the factory
 * itself correct and tested so it is ready when T196 unblocks.
 *
 * If `getRecordedBy()` resolves `null` at call time (no signed-in coach
 * identity available), the returned function rejects BEFORE any network
 * call -- same precondition-check-then-reject shape `loaders/meetings.ts`'s
 * own `makeCreateMeetings` already uses for its own pre-condition failure
 * (no active season -> reject before either `runMutation` call is
 * invoked).
 *
 * -----------------------------------------------------------------------
 * 3. Roster resolution -- the `loaders/kiosk.ts` pattern, re-derived
 *    locally (that file is read-only precedent here, its private helpers
 *    are not exported/importable).
 * -----------------------------------------------------------------------
 *
 * `session -> event -> team_ids -> active-student filter`, the same
 * open-vs-scoped semantics `loaders/kiosk.ts`'s own
 * `makeLoadSessionEventContext`/`makeLoadKioskTally` already establish for
 * this exact "meeting roster" concept: `team_ids === null` means open to
 * every team; non-null means scoped to exactly those teams.
 * `students.is_active = true` is filtered SERVER-SIDE (`.eq('is_active',
 * true)`), matching that same file's own `queryActiveStudentTeams` --
 * team-scoping itself is applied CLIENT-SIDE afterward, over the
 * server-filtered active rows, exactly as `kiosk.ts` already does.
 *
 * **Server-side filters are argument-provable only in this harness, not
 * outcome-provable** -- a stubbed test client does no real filtering, so it
 * returns whatever `data` a test hands it regardless of what `.eq(...)` was
 * called with. `endMeeting.test.ts`'s own criterion-3 test therefore
 * asserts the RECORDED CALL ARGUMENTS included `.eq('is_active', true)`,
 * never asserts on returned data for this filter -- a returned-data
 * assertion here would pass or fail independent of whether the real filter
 * is present, which is not a real test. (Team-scoping, by contrast, is
 * genuinely client-side logic THIS file executes on injected data, so its
 * own test DOES assert outcomes.)
 *
 * `attendanceByStudentId` is populated via `makeLoadAttendanceForSessions`
 * (`./attendance`, the DI-factory constructor -- the top-level
 * `loadAttendanceForSessions` singleton has no client seam to inject a stub
 * through, so the factory is used instead), mapped down from
 * `AttendanceRow` to the smaller `AttendanceRecordState` shape
 * `EndMeetingSummaryData` needs. This is the ONLY place this file reads
 * `attendance` for the summary -- no second, independent `attendance` query
 * exists anywhere in `makeLoadEndMeetingSummary` (grep-provable; see this
 * task's own worker output for the grep proof).
 *
 * -----------------------------------------------------------------------
 * 4. `audit_log` -- never written here, anywhere.
 * -----------------------------------------------------------------------
 *
 * No `audit_log` row is written for a post-completion `attendance` edit at
 * ANY layer -- not by this file, and not by the database (section 1 above:
 * the trigger that used to do so was removed deliberately). Attendance
 * attribution lives on the row: `recorded_by` + `updated_at`. This file
 * never inserts into `audit_log` anywhere -- grep-provable, zero
 * occurrences.
 *
 * -----------------------------------------------------------------------
 * 5. No migration, no new RLS.
 * -----------------------------------------------------------------------
 *
 * `staff_all` (`supabase/migrations/20260717000002_rls.sql`, read-only
 * reference) already grants a coach/admin full write access to both
 * `event_sessions` and `attendance` -- this file is pure frontend wiring
 * against an already-permitted write surface, same posture `loaders/
 * attendance.ts` already established for this table. `attendance.recorded_by`
 * is nullable and `unique (session_id, student_id)` exists (`supabase/
 * migrations/20260717000000_scheduling_attendance.sql`), so the backfill
 * shape and its `onConflict` target are both legal without any schema
 * change.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import { makeLoadAttendanceForSessions } from './attendance';
import type {
  AttendanceRecordState,
  AttendanceStatus,
  EndMeetingPayload,
  EndMeetingRosterEntry,
  EndMeetingSummaryData,
  LoadEndMeetingSummaryFn,
  OnEditAttendanceFn,
  OnEndMeetingFn,
} from '../../../pages/meetings/EndMeetingDialog';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, exactly as Postgrest returns them) -- this
// directory's own convention (module doc #1/#5).
// ---------------------------------------------------------------------------

interface EventSessionSummaryDbRow {
  id: string;
  event_id: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

interface EventSummaryDbRow {
  id: string;
  title: string;
  team_ids: string[] | null;
}

interface StudentRosterDbRow {
  id: string;
  display_name: string;
  team_id: string;
}

// ---------------------------------------------------------------------------
// Summary load -- module doc #3.
// ---------------------------------------------------------------------------

async function queryEventSessionSummary(
  client: SupabaseClient,
  sessionId: string,
): Promise<LoaderQueryResult<EventSessionSummaryDbRow>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, ends_at, status')
    .eq('id', sessionId)
    .maybeSingle();
  return {
    data: (result.data as EventSessionSummaryDbRow | null) ?? null,
    error: result.error,
  };
}

async function queryEventSummary(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EventSummaryDbRow>> {
  const result = await client
    .from('events')
    .select('id, title, team_ids')
    .eq('id', eventId)
    .maybeSingle();
  return { data: (result.data as EventSummaryDbRow | null) ?? null, error: result.error };
}

/** Server-side `.eq('is_active', true)` (module doc #3) -- argument-provable
 * only in this harness, per that same section's disclosure. */
async function queryActiveStudentsForRoster(
  client: SupabaseClient,
): Promise<LoaderQueryResult<StudentRosterDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name, team_id')
    .eq('is_active', true);
  return { data: (result.data as StudentRosterDbRow[] | null) ?? null, error: result.error };
}

/**
 * `EndMeetingDialog.tsx`'s real `loadSummary`. `getClient` is injectable
 * (defaults to the shared singleton), this directory's own convention, so
 * tests can supply a stubbed transport with zero real network calls.
 *
 * If the session or its parent event cannot be found, this rejects (a plain
 * `Error`, not a `SupabaseLoaderError` -- there is no Postgrest error to
 * normalize here, this is a "the id itself doesn't resolve" case) rather
 * than resolving a placeholder `EndMeetingSummaryData` -- `LoadEndMeetingSummaryFn`'s
 * own signature (`EndMeetingDialog.tsx`, frozen) is non-nullable, unlike
 * `loaders/kiosk.ts`'s own `KioskTallyLoader`/`KioskSessionTitleLoader`
 * (both nullable), so there is no first-class "not found" value this
 * function's return type can express -- rejecting is the honest choice
 * given that constraint. Not exercised by this task's acceptance criteria
 * (§6 of the worker packet); disclosed here as a design decision, not
 * silently assumed.
 */
export function makeLoadEndMeetingSummary(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadEndMeetingSummaryFn {
  const loadSession = createLoader<string, EventSessionSummaryDbRow>(
    queryEventSessionSummary,
    getClient,
  );
  const loadEvent = createLoader<string, EventSummaryDbRow>(queryEventSummary, getClient);
  const loadActiveStudents = createLoader<void, StudentRosterDbRow[]>(
    queryActiveStudentsForRoster,
    getClient,
  );
  const loadAttendanceForSessions = makeLoadAttendanceForSessions(getClient);

  return async (sessionId: string): Promise<EndMeetingSummaryData> => {
    const session = await loadSession(sessionId);
    if (session === null) {
      throw new Error(`End-meeting summary: session "${sessionId}" was not found.`);
    }
    const event = await loadEvent(session.event_id);
    if (event === null) {
      throw new Error(
        `End-meeting summary: event "${session.event_id}" for session "${sessionId}" was not found.`,
      );
    }
    // Independent of the roster/event lookups above -- runs concurrently.
    const [studentRows, attendanceRows] = await Promise.all([
      loadActiveStudents(),
      loadAttendanceForSessions([sessionId]),
    ]);

    const teamIds = event.team_ids;
    const roster: EndMeetingRosterEntry[] = (studentRows ?? [])
      .filter((student) => teamIds === null || teamIds.includes(student.team_id))
      .map((student) => ({ studentId: student.id, name: student.display_name }));

    // The ONLY `attendance` read in this function -- module doc #3.
    const attendanceByStudentId: Record<string, AttendanceRecordState> = {};
    for (const row of attendanceRows) {
      attendanceByStudentId[row.studentId] = {
        status: row.status,
        checkInAt: row.checkInAt,
        checkOutAt: row.checkOutAt,
        method: row.method,
        recordedBy: row.recordedBy,
      };
    }

    return {
      session: {
        id: session.id,
        title: event.title,
        endsAt: session.ends_at,
        status: session.status,
      },
      roster,
      attendanceByStudentId,
    };
  };
}

/** `EndMeetingDialog.tsx`'s own default `loadSummary` -- real query. */
export const loadEndMeetingSummary: LoadEndMeetingSummaryFn = makeLoadEndMeetingSummary();

// ---------------------------------------------------------------------------
// onEndMeeting -- module doc #1's three sequenced mutations.
// ---------------------------------------------------------------------------

interface BackfillAbsencesArgs {
  sessionId: string;
  studentIds: readonly string[];
}

interface CheckoutStudentsArgs {
  sessionId: string;
  studentIds: readonly string[];
  endsAt: string;
}

/**
 * `EndMeetingDialog.tsx`'s real `onEndMeeting`. `getClient` is injectable,
 * this directory's own convention. See module doc #1 for the full ordering
 * rationale and the disclosed partial-failure behavior -- restated only in
 * inline comments below, not re-argued.
 */
export function makeOnEndMeeting(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnEndMeetingFn {
  const backfillAbsences = runMutation<BackfillAbsencesArgs, void>(
    (client, args) =>
      client.from('attendance').upsert(
        args.studentIds.map((studentId) => ({
          session_id: args.sessionId,
          student_id: studentId,
          status: 'absent' as const,
          method: 'coach' as const,
          recorded_by: null,
        })),
        { onConflict: 'session_id,student_id', ignoreDuplicates: true },
      ),
    getClient,
  );

  const checkoutStudents = runMutation<CheckoutStudentsArgs, void>(
    (client, args) =>
      client
        .from('attendance')
        .update({ check_out_at: args.endsAt })
        .eq('session_id', args.sessionId)
        .in('student_id', [...args.studentIds])
        .is('check_out_at', null),
    getClient,
  );

  const flipSessionStatus = runMutation<string, void>(
    (client, sessionId) =>
      client.from('event_sessions').update({ status: 'completed' }).eq('id', sessionId),
    getClient,
  );

  return async (payload: EndMeetingPayload): Promise<void> => {
    // Step 1 -- INSERT ... ON CONFLICT DO NOTHING, order-independent, but
    // run first anyway (module doc #1).
    await backfillAbsences({
      sessionId: payload.sessionId,
      studentIds: payload.backfillAbsentStudentIds,
    });
    // Step 2 -- MUST precede step 3 (module doc #1's ordering rationale).
    await checkoutStudents({
      sessionId: payload.sessionId,
      studentIds: payload.checkoutStudentIds,
      endsAt: payload.endsAt,
    });
    // Step 3 -- ALWAYS last (module doc #1).
    await flipSessionStatus(payload.sessionId);
  };
}

/** `EndMeetingDialog.tsx`'s own default `onEndMeeting` -- real mutations. */
export const onEndMeeting: OnEndMeetingFn = makeOnEndMeeting();

// ---------------------------------------------------------------------------
// onEditAttendance -- module doc #2's fresh-per-call identity closure.
// ---------------------------------------------------------------------------

interface EditAttendanceArgs {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  recordedBy: string;
}

/**
 * `EndMeetingDialog.tsx`'s real `onEditAttendance`. `getRecordedBy` is
 * called FRESH on every invocation of the returned function (module doc #2)
 * -- never read once at construction time, so this stays correct behind a
 * `useRef`-backed accessor across renders once T196 wires this factory to a
 * real `useAuth()` ref (not done by this task). `getClient` is injectable,
 * this directory's own convention.
 */
export function makeOnEditAttendance(
  getRecordedBy: () => string | null,
  getClient: () => SupabaseClient = getSupabaseClient,
): OnEditAttendanceFn {
  const editAttendance = runMutation<EditAttendanceArgs, void>(
    (client, args) =>
      client
        .from('attendance')
        .update({ status: args.status, recorded_by: args.recordedBy })
        .eq('session_id', args.sessionId)
        .eq('student_id', args.studentId),
    getClient,
  );

  return async (sessionId: string, studentId: string, status: AttendanceStatus): Promise<void> => {
    // Module doc #2 -- read FRESH on every call, precondition-check-then-
    // reject shape mirroring `loaders/meetings.ts`'s own
    // `makeCreateMeetings` for its own pre-condition failure. Rejects
    // BEFORE `editAttendance` (and therefore before any `client.from(...)`
    // call) is ever invoked.
    const recordedBy = getRecordedBy();
    if (recordedBy === null) {
      throw new Error('No signed-in coach identity is available to record this attendance change.');
    }
    await editAttendance({ sessionId, studentId, status, recordedBy });
  };
}
