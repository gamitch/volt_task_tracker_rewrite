/**
 * @file sessionRoster.ts
 * @position GAM-491. Supplies the ONE thing `SchedulePanel.tsx` (Forbidden
 *   File here) is missing on `main`: a real `roster` /`isRosterLoading` /
 *   `rosterError` for its own frozen `SchedulePanelProps`
 *   (`../../../pages/meetings/coach/SchedulePanel.tsx:209-213`). Read side
 *   only -- the write seams (`setAttendanceStatus`/`clearAttendanceStatus`,
 *   `./attendance.ts`) and the coach's real `recordedBy` are already wired
 *   by GAM-452 and are untouched here (worker packet §1).
 *
 * -----------------------------------------------------------------------
 * 1. Model copied, not reinvented: `endMeeting.ts:255-345`
 *   (`makeLoadEndMeetingSummary`) is this directory's own precedent for
 *   exactly this shape -- an `events`/`event_sessions`/`students` read plus
 *   `makeLoadAttendanceForSessions`, scoped by `teamIds === null ||
 *   teamIds.includes(student.team_id)`, run as one `Promise.all` for the two
 *   independent reads (worker packet §6). This file does not duplicate that
 *   file's own summary/mutation logic, only its query shape.
 *
 * -----------------------------------------------------------------------
 * 2. THE finding this file exists to fix (worker packet §3): none of
 *   `makeLoadAttendanceForSessions`'s five existing consumers is this one,
 *   and it is the only attendance read in this directory that does NOT
 *   filter GAM-479's `'unmarked'` sentinel
 *   (`./attendance.ts:224-236`, `UNMARKED_DB_STATUS`) -- `excludeUnmarked`
 *   (`./attendance.ts:267`) is never called by `makeLoadAttendanceForSessions`
 *   itself, so a cleared mark's raw `'unmarked'` string reaches this loader
 *   verbatim, still typed (falsely) as `AttendanceStatus`
 *   (`./attendance.ts:282`/`:308-322`). Rather than editing `attendance.ts`
 *   (Forbidden File; the change would touch four other consumers), THIS file
 *   maps `'unmarked'` to `null` itself, at the one call site below that reads
 *   `row.status` -- so a student whose mark a coach cleared comes back as
 *   `(unset)` (`SessionRosterEntry.status: null`), never as an unknown
 *   status value a `Record<AttendanceStatus, ...>` was never built to hold.
 *   `row.status` is compared via an explicit `as string` cast (not a bare
 *   `row.status === UNMARKED_DB_STATUS`) because `AttendanceRow.status`'s
 *   declared type (`AttendanceStatus`, four literals) and
 *   `UNMARKED_DB_STATUS`'s inferred type (`'unmarked'`) have zero overlap --
 *   `tsc` treats a bare comparison of two non-overlapping literal types as
 *   an error (TS2367), which is exactly the "the type says this can't
 *   happen" mismatch this comment is describing as real. The cast is the
 *   honest way to check a value the type system (correctly, per module doc
 *   above) considers impossible.
 *
 * -----------------------------------------------------------------------
 * 3. Constitution item 6 -- no student full name may ever leave this loader.
 *   There is no shared name-shortening helper on `main`; two independent
 *   module-private precedents exist and neither is imported:
 *     - `src/pages/outreach/Leaderboard.tsx:365-375` (`formatDisplayName`,
 *       exported) -- not used here: it takes an `isPrivacyOn` flag and
 *       returns the fixed string `'Anonymous student'` when false, coupling
 *       this loader to a leaderboard setting it has nothing to do with.
 *     - `src/pages/meetings/student/StudentMeetingsView.tsx:44-48`
 *       (`firstNameLastInitial`) -- module-private, cannot be imported.
 *   `firstNameLastInitial` below is a fresh module-private copy of the same
 *   rule (trim, split on whitespace, drop empty parts; zero parts ->
 *   `'Student'`; one part -> itself; otherwise -> `First L.`), with its own
 *   fallback string chosen for THIS surface (a roster row, not a linked-
 *   student picker) rather than reusing either precedent's fallback text
 *   verbatim.
 *
 * -----------------------------------------------------------------------
 * 4. `SessionRosterEntry`/`SchedulePanelProps.roster` are read here, never
 *   reshaped -- both are frozen, imported type-only from
 *   `../../../pages/meetings/coach/SchedulePanel` (worker packet §6). One map
 *   entry per (session, in-scope student): every session id from the
 *   `event_sessions` read gets a key, even with zero attendance rows for it,
 *   so `status` is `null` rather than the session being absent from the map
 *   entirely (worker packet §7 step 6). Each session's entries are ordered
 *   by `displayName` then `studentId` for a stable render across loads
 *   (`SessionRow.tsx`'s roving-tabindex `focusedRowIndex` is positional).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import { makeLoadAttendanceForSessions, UNMARKED_DB_STATUS } from './attendance';
import type { AttendanceStatus } from './attendance';
import type { SessionRosterEntry } from '../../../pages/meetings/coach/SchedulePanel';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, exactly as Postgrest returns them) --
// `endMeeting.ts`'s own convention (module doc #1), applied to this file's
// own narrower column selections.
// ---------------------------------------------------------------------------

interface EventTeamScopeDbRow {
  id: string;
  team_ids: string[] | null;
}

interface EventSessionIdDbRow {
  id: string;
}

interface StudentRosterDbRow {
  id: string;
  display_name: string;
  team_id: string;
}

async function queryEventTeamScope(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EventTeamScopeDbRow>> {
  const result = await client.from('events').select('id, team_ids').eq('id', eventId).maybeSingle();
  return { data: (result.data as EventTeamScopeDbRow | null) ?? null, error: result.error };
}

async function queryEventSessionIds(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EventSessionIdDbRow[]>> {
  const result = await client.from('event_sessions').select('id').eq('event_id', eventId);
  return { data: (result.data as EventSessionIdDbRow[] | null) ?? null, error: result.error };
}

/** Server-side `.eq('is_active', true)` -- `endMeeting.ts:278-288`'s own
 * identically-shaped read, copied rather than imported (that file is
 * Forbidden here). */
async function queryActiveStudentsForRoster(
  client: SupabaseClient,
): Promise<LoaderQueryResult<StudentRosterDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name, team_id')
    .eq('is_active', true);
  return { data: (result.data as StudentRosterDbRow[] | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// Module doc #3 -- the name rule. Fresh module-private copy, not imported
// (neither existing precedent is importable/appropriate -- see module doc).
// ---------------------------------------------------------------------------

function firstNameLastInitial(name: string): string {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  if (pieces.length === 0) return 'Student';
  if (pieces.length === 1) return pieces[0];
  const first = pieces[0];
  const last = pieces[pieces.length - 1];
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

// ---------------------------------------------------------------------------
// Load.
// ---------------------------------------------------------------------------

export type LoadSessionRosterFn = (
  eventId: string,
) => Promise<ReadonlyMap<string, readonly SessionRosterEntry[]>>;

/**
 * `CoachMeetingsView.tsx`'s real `loadSessionRoster`. `getClient` is
 * injectable (defaults to the shared singleton), this directory's own
 * convention, so tests supply a stubbed transport with zero real network
 * calls.
 *
 * An unknown `eventId` REJECTS with a plain `Error` naming the id --
 * `endMeeting.ts:296-306`'s own documented choice for a non-nullable return
 * type: there is no first-class "not found" value `LoadSessionRosterFn`'s
 * signature can express, so rejecting is the honest option (worker packet
 * §7 step 1). An event with zero sessions resolves an EMPTY map instead
 * (worker packet §7 step 2) -- that is a legitimate, not-an-error outcome
 * (a series that has not yet had any session scheduled onto it), and no
 * attendance query is issued for it (`makeLoadAttendanceForSessions` already
 * short-circuits `[]`, but the students query is skipped too rather than
 * relying on that).
 */
export function makeLoadSessionRoster(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadSessionRosterFn {
  const loadEventScope = createLoader<string, EventTeamScopeDbRow>(queryEventTeamScope, getClient);
  const loadSessionIds = createLoader<string, EventSessionIdDbRow[]>(
    queryEventSessionIds,
    getClient,
  );
  const loadActiveStudents = createLoader<void, StudentRosterDbRow[]>(
    queryActiveStudentsForRoster,
    getClient,
  );
  const loadAttendanceForSessions = makeLoadAttendanceForSessions(getClient);

  return async (eventId: string) => {
    const event = await loadEventScope(eventId);
    if (event === null) {
      throw new Error(`Session roster: event "${eventId}" was not found.`);
    }

    const sessionRows = await loadSessionIds(eventId);
    const sessionIds = (sessionRows ?? []).map((row) => row.id);
    if (sessionIds.length === 0) {
      return new Map<string, readonly SessionRosterEntry[]>();
    }

    // Independent of each other -- runs concurrently (`endMeeting.ts:332-337`
    // precedent).
    const [studentRows, attendanceRows] = await Promise.all([
      loadActiveStudents(),
      loadAttendanceForSessions(sessionIds),
    ]);

    const teamIds = event.team_ids;
    const scopedStudents = (studentRows ?? []).filter(
      (student) => teamIds === null || teamIds.includes(student.team_id),
    );

    // sessionId -> studentId -> real (non-`'unmarked'`) status. Module doc
    // #2 -- the ONE place this loader guards the sentinel; deleting this
    // `continue` is the named mutation (worker packet §10).
    const statusBySessionAndStudent = new Map<string, Map<string, AttendanceStatus>>();
    for (const row of attendanceRows) {
      if ((row.status as string) === UNMARKED_DB_STATUS) continue;
      let byStudent = statusBySessionAndStudent.get(row.sessionId);
      if (!byStudent) {
        byStudent = new Map<string, AttendanceStatus>();
        statusBySessionAndStudent.set(row.sessionId, byStudent);
      }
      byStudent.set(row.studentId, row.status);
    }

    const roster = new Map<string, readonly SessionRosterEntry[]>();
    for (const sessionId of sessionIds) {
      const byStudent = statusBySessionAndStudent.get(sessionId);
      const entries: SessionRosterEntry[] = scopedStudents.map((student) => ({
        studentId: student.id,
        displayName: firstNameLastInitial(student.display_name),
        status: byStudent?.get(student.id) ?? null,
      }));
      entries.sort((a, b) => {
        const byName = a.displayName.localeCompare(b.displayName);
        return byName !== 0 ? byName : a.studentId.localeCompare(b.studentId);
      });
      roster.set(sessionId, entries);
    }
    return roster;
  };
}

/** `CoachMeetingsView.tsx`'s own default `loadSessionRoster` -- real query. */
export const loadSessionRoster: LoadSessionRosterFn = makeLoadSessionRoster();
