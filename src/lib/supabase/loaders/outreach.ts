/**
 * T101 (ED-1 Packet P10): real `events`/`event_sessions`/`rsvps`/`students`/
 * `seasons`/`teams`/`profiles`/`attendance` data-layer wiring for
 * `src/pages/outreach/OutreachList.tsx`, `OutreachDetail.tsx`,
 * `RsvpControl.tsx`, `ParentRsvp.tsx`, and `MarkDayCompleteDialog.tsx` --
 * same recurring gap class as `RosterShell.tsx`/`StudentsTab.tsx`/
 * `MeetingsList.tsx`: `OutreachEventDialog.tsx` (T039) already ships a real,
 * working `onSaveEvent` seam, but nobody had wired the list/detail pages to
 * open it, or wired any of the five real mutations this file provides. Built
 * directly on top of T086's `createLoader`/`runMutation` (`../loader.ts`,
 * read-only import here), same DI (`getClient`) convention every prior
 * `loaders/*.ts` file in this directory already established.
 *
 * -----------------------------------------------------------------------
 * 1. Real loads (Trap #1). `events.type` check constraint verified directly
 *    against `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    line 36 (`'meeting' | 'outreach' | 'competition'`) -- same column every
 *    sibling `loaders/*.ts` file in this directory already cites.
 *
 *    `makeLoadOutreachData` (for `OutreachList.tsx`) fetches `events`
 *    server-side FILTERED BY `season_id` (a real query parameter this page's
 *    own `LoadOutreachDataFn` signature already takes, unlike
 *    `loaders/meetings.ts`'s season-unaware load) -- but deliberately does
 *    NOT also filter by `event.type` server-side: `OutreachList.tsx`'s own
 *    module doc #2 documents `filterOutreachEvents` as "the ONLY event.type
 *    predicate in this file" and tests it against a fixture that deliberately
 *    includes a non-outreach event to prove that filter is real, not
 *    vacuous. Pre-filtering server-side here would make that invariant
 *    untestable against real data flowing through this loader, so this file
 *    fetches every `type` for the given season (mirroring
 *    `loaders/meetings.ts`'s identical "fetch the full table, let the page's
 *    own pure function filter by type" decision) and leaves `type` filtering
 *    exactly where it already lives.
 *
 *    `makeLoadOutreachDetail` (for `OutreachDetail.tsx`) resolves
 *    `OutreachDetailData | null` -- `null` for a genuinely nonexistent OR
 *    RLS-inaccessible event id (`.maybeSingle()`'s "no row" case), matching
 *    that file's own module doc #5 NAV-08/DES-12 "reveal nothing" contract
 *    exactly: this loader cannot distinguish "doesn't exist" from "exists but
 *    RLS denies it" (Postgrest's row-level security makes both look like
 *    zero rows), which is precisely the RLS-honest behavior that doc already
 *    designs for.
 *
 * -----------------------------------------------------------------------
 * 2. A genuine, independent finding: `OutreachGoalConfig` is NOT actually a
 *    UI-only placeholder with no backing column -- T038's own module doc #7
 *    checked only `20260717000000_scheduling_attendance.sql` (the
 *    events/sessions/rsvps/attendance migration) for a goal/target column and
 *    correctly found none there, but never checked
 *    `20260716000000_identity_roster.sql` (the identity/roster migration),
 *    which DOES carry two real, directly-relevant columns: `seasons.
 *    default_goal_hours numeric not null default 100` (line 47) and
 *    `students.goal_hours_override numeric` (nullable, line 66) -- exactly a
 *    per-student override falling back to a per-season default, which is
 *    precisely the shape `OutreachGoalConfig.individualGoalHoursByStudentId`
 *    already expects. `resolveIndividualGoalHours` below is the ONE place
 *    this real resolution happens: `student.goalHoursOverride ??
 *    season.defaultGoalHours ?? 0` (the final `?? 0` only ever applies when
 *    `seasonId` itself doesn't resolve to a real `seasons` row -- an honest
 *    "no season, no goal" fallback, not a fabricated number). This
 *    genuinely resolves a previously-disclosed gap into a real value backed
 *    by real columns, rather than perpetuating the earlier placeholder.
 *
 * -----------------------------------------------------------------------
 * 3. Trap #2 -- RSVP mutation: ONE shared real function, not two.
 *
 * `RsvpControl.tsx` (T040, student-facing) and `ParentRsvp.tsx` (T043,
 * parent-facing) each independently declare their own `OnRsvpChangeFn`/
 * `RsvpChangeParams` types (Forbidden-Files-adjacent duplication those two
 * files' own module docs already disclose and justify -- neither can import
 * the other). Investigated whether the underlying WRITE differs between the
 * two call sites: it does not. Both `RsvpChangeParams` shapes are field-for-
 * field identical (`sessionId`, `studentId`, `status`, `respondedBy`), and
 * the real RLS policy both writes go through
 * (`rsvps` `own_or_linked_write`/`own_or_linked_update`,
 * `supabase/migrations/20260717000002_rls.sql` lines 205-212) is a SINGLE
 * policy covering both cases already: `student_id in (select
 * my_student_ids())` -- and `my_student_ids()` (same migration, lines 20-26)
 * is ITSELF already the union of "my own student row" (student self-RSVP)
 * and "students I guard via `guardian_links`" (parent RSVP-on-behalf). The
 * database makes no distinction between these two actors at the row-write
 * level; the only real difference is WHO is doing the calling (student vs.
 * parent), which is already fully captured by the `respondedBy` value each
 * component independently supplies (`currentUserProfileId` /
 * `PLACEHOLDER_CURRENT_USER_PROFILE_ID` vs. `PLACEHOLDER_CURRENT_PARENT_
 * PROFILE_ID`) before ever calling this shared function. DECISION: one real
 * function, `submitRsvpChange` below -- a plain `rsvps` upsert keyed on the
 * real `unique (session_id, student_id)` constraint (migration line 75),
 * always writing the caller-supplied `respondedBy` verbatim (never
 * re-deriving/guessing it here). Its param type (`OutreachRsvpChangeParams`)
 * is defined locally in this file (not imported from either page) so this
 * module has no circular import on `RsvpControl.tsx`/`ParentRsvp.tsx` --
 * TypeScript's structural typing alone is what lets the exact same function
 * value satisfy both of those files' own independently-declared
 * `OnRsvpChangeFn` types when each assigns it as their own `onRsvpChange`
 * prop default, with zero reshaping at either call site (grep-provable: no
 * `as unknown as` cast anywhere in this file or in either of those two
 * files' own updated default-prop lines).
 *
 * A rejected write (e.g. a session that has already started, if a caller
 * somehow bypasses `isRsvpEditable`'s client-side guard, or a genuinely
 * malformed `studentId`/`sessionId`) surfaces as a real Postgrest error
 * (`42501` for an RLS `with check` failure, a real FK violation code for a
 * bad id) -- `runMutation` (`../loader.ts`) normalizes it into a real
 * `SupabaseLoaderError` exactly like every other mutation in this directory;
 * this file does NOT retry-loop, swallow, or special-case that rejection in
 * any way (grep-provable: no `catch`/`retry` logic anywhere in
 * `makeSubmitRsvpChange`) -- both `RsvpControl.tsx`'s and `ParentRsvp.tsx`'s
 * own pre-existing `handleChange` already catch the rejection, roll back
 * their own optimistic state, and render `error.message` in a `Banner`
 * (unchanged by this task).
 *
 * -----------------------------------------------------------------------
 * 4. Mark Day Complete (`MarkDayCompleteDialog.tsx`, T042) -- THREE real
 *    writes, one of them a disclosed, non-atomic read-modify-write.
 *
 * `makeMarkDayComplete` below performs, in order:
 *   (a) `event_sessions` update: `status = 'completed'`, `people_reached =
 *       payload.peopleReached` -- the ONE place this module ever writes
 *       `event_sessions.status`, mirroring `loaders/meetings.ts`'s own
 *       `makeCancelMeetingSession` precedent for "the ONE place a given
 *       column is ever written" documentation discipline.
 *   (b) `attendance` upsert (keyed on the real `unique (session_id,
 *       student_id)` constraint, migration line 94) for every row
 *       `buildAttendanceWriteRows` (`MarkDayCompleteDialog.tsx`'s own pure
 *       function, unchanged, still the ONLY place these rows are
 *       constructed) already produced -- `checkInAt`/`checkOutAt` pass
 *       through as `null` verbatim (that dialog's own module doc #2(c),
 *       never invented here), `hoursOverride` passes through exactly as
 *       given (a real, honest `NULL` for a student the coach never
 *       overrode, per that dialog's own module doc #2's MET-03 tier-3
 *       fallback discipline -- this loader never back-fills it with a
 *       computed default).
 *   (c) An ADDITIVE update to `events.adult_volunteers_count`/
 *       `adult_volunteer_hours` (module doc #3 of `MarkDayCompleteDialog.tsx`
 *       -- these are per-session DELTAS to be ADDED to the event's running
 *       total, never absolute values to overwrite those columns with).
 *       DISCLOSED LIMITATION: Postgrest's REST interface (the only interface
 *       this project's Supabase client uses -- no `supabase.rpc(...)` call
 *       exists anywhere in this file, grep-provable) has no `SET column =
 *       column + $delta` expression support; a genuinely ATOMIC increment
 *       would require a database function (an RPC), which is out of this
 *       task's Allowed Files (no new migration is shipped here). This
 *       function therefore performs the closest available honest
 *       approximation: read the event's CURRENT `adult_volunteers_count`/
 *       `adult_volunteer_hours` (a fresh `.select()`), add this session's
 *       deltas in TypeScript, then `.update()` the computed sum. This is a
 *       real, disclosed RACE: two coaches marking two different days of the
 *       same multi-day event complete within the same few hundred
 *       milliseconds could both read the same starting total and one
 *       update could clobber the other's -- same disclosed-risk CLASS
 *       `loaders/meetings.ts`'s own `makeCreateMeetings` module doc already
 *       accepts for its own sequential, non-transactional `events` +
 *       `event_sessions` writes (this task's own worker output "Known
 *       risks" restates this for checker visibility). This step is skipped
 *       entirely (zero extra reads/writes) when both deltas are `0` -- the
 *       common case for a coach who didn't record any adult volunteers that
 *       day, per that dialog's own `0`-default `NumberInput`s.
 *
 * -----------------------------------------------------------------------
 * 5. Trap #5 -- `OutreachEventDialog.tsx` (T039) DOES genuinely support edit
 *    mode (the opposite finding from T096's `ScheduleMeetingsDialog.tsx`
 *    investigation -- verified directly against that file's own source, not
 *    assumed from the surface-level pattern rhyme): its own
 *    `OutreachEventDialogProps.initialEvent?: ExistingOutreachEvent` prop,
 *    when present, pre-fills every field (including all existing sessions,
 *    loaded into "Custom dates" schedule mode) and switches the dialog into
 *    a real edit mode (`isEditMode`, its own `resetForm()` branches on
 *    `initialEvent !== undefined`, its own `computeConfirmLabel` renders
 *    "Save changes" instead of "Create event", and its own
 *    `SaveOutreachEventPayload.event.id` carries the existing event's real
 *    id through to `onSaveEvent` when editing) -- a real, working,
 *    already-tested (`OutreachEventDialog.test.tsx`) edit path, not a stub.
 *    `makeSaveOutreachEvent` below is therefore genuinely wired for BOTH
 *    create (`OutreachList.tsx`'s "New outreach event" button) and edit
 *    (`OutreachDetail.tsx`'s "Edit" menu item), branching on whether
 *    `payload.event.id` is present -- unlike `loaders/meetings.ts`'s own
 *    `makeCreateMeetings` (create-only, since `ScheduleMeetingsDialog.tsx`
 *    genuinely has no edit mode -- T096's own documented finding, a
 *    DIFFERENT dialog with a DIFFERENT, narrower payload shape than this
 *    one).
 *
 *    CREATE path: resolves the real active season (`seasons` where
 *    `is_active = true`, `.maybeSingle()` -- same pattern
 *    `loaders/meetings.ts`'s own `makeCreateMeetings` already established,
 *    independently re-implemented here since that file's own helper is not
 *    exported/importable across `loaders/*.ts` files in this codebase's
 *    existing convention), rejecting with a real, disclosed error (never a
 *    fabricated `season_id`) if none is active; then inserts one `events`
 *    row + one `event_sessions` row per session in the payload.
 *
 *    EDIT path -- A GENUINE, INDEPENDENT FINDING beyond what this task's own
 *    packet anticipated: `rsvps.session_id` and `attendance.session_id` are
 *    BOTH declared `on delete restrict` against `event_sessions` (migration
 *    lines 69, 84) -- so a naive "delete every existing session for this
 *    event, then re-insert the dialog's current session list" reconciliation
 *    strategy (the simplest-looking approach, since the dialog's own "Custom
 *    dates" edit-mode UI presents the full desired session list, not a
 *    diff) would THROW a real foreign-key-restrict error the moment any one
 *    of those sessions already has even a single `rsvps` or `attendance`
 *    row attached to it -- which is exactly the common case for an outreach
 *    event a coach is editing well after students have started RSVPing.
 *    RESOLUTION: `updateOutreachEvent` below reconciles sessions by
 *      `sessionDate` (the dialog's own natural per-day key, since
 *      `OutreachSessionDetail`/`ExistingOutreachEventSession` are both keyed
 *      that way already): an existing `event_sessions` row whose
 *      `session_date` matches a date still present in the payload gets its
 *      `starts_at`/`ends_at`/`notes`/`people_reached` UPDATED in place
 *      (preserving its `id`, so any `rsvps`/`attendance` rows already
 *      attached to it stay correctly attached); a payload date with no
 *      matching existing row gets INSERTED as a brand-new session. A
 *      session date REMOVED from the payload (present in the DB, absent
 *      from what the coach submitted) is deliberately left UNTOUCHED --
 *      never deleted -- both because deleting it could violate the
 *      restrict FK above for a day that already has engagement, and because
 *      silently deleting some-but-not-all removed days (skipping only the
 *      ones with existing RSVPs) would be a confusing, inconsistent partial
 *      behavior. This is a disclosed, real limitation (this task's own
 *      worker output "Known risks"): editing an existing outreach event to
 *      genuinely remove a day is not supported by this wiring -- a coach
 *      who needs that would need to cancel the specific session directly
 *      (out of this dialog's own scope) or a future task would need to add
 *      real delete-with-reassignment/cascade handling.
 *
 * -----------------------------------------------------------------------
 * 6. Trap #4 / `OutreachDetail.tsx`'s own `showCancelStub` -- real,
 *    EVENT-LEVEL cancel (matches that file's own disclosed module doc #8
 *    judgment call: its `MoreMenu`'s "Cancel event" item is event-level, not
 *    per-session, since OUT-04's own text describes "edit/cancel via
 *    MoreMenu" as a single event-level action).
 *
 * `makeCancelOutreachEvent` below flips EVERY currently-`'scheduled'`
 * `event_sessions` row for the given `event_id` to `'canceled'` in one
 * `.update(...).eq('event_id', ...).eq('status', 'scheduled')` call --
 * already-`'completed'` sessions are deliberately left untouched (a
 * multi-day event canceled mid-run keeps its already-completed days'
 * attendance/history intact; only the days that haven't happened yet are
 * called off), mirroring `loaders/meetings.ts`'s own
 * `makeCancelMeetingSession` "the ONE place this column is ever written"
 * discipline, scoped to a whole event's sessions instead of a single one.
 *
 * -----------------------------------------------------------------------
 * 7. T118 (UXP-02) -- "Expected attendees" roster checklist fan-out, added
 *    to `makeSaveOutreachEvent`'s existing create/edit sequence.
 *
 *    AMENDED 2026-07-20 (T119, PRD v2 section 0 decision D-7 -- George's
 *    direct product-owner override, verbatim: "As coach I am ultimate
 *    authority and should be able to overwrite an RSVP or check-ins."): the
 *    "self-authored protection" rule this doc entry originally described
 *    below (never delete, never overwrite, a student's own `responded_by
 *    === student_id` row) is REMOVED. `selfAuthoredKeys` and every check
 *    against it are gone from `computeExpectedAttendeeRsvpPlan`. The
 *    paragraphs immediately below are KEPT AS THE ORIGINAL T118 RECORD of
 *    what this reasoning was (repo convention, see `TeamsTab.tsx`/
 *    `ParentsTab.tsx`'s own "SUPERSEDED BY" notes for precedent) -- they no
 *    longer describe this file's actual behavior. The new, simplified D-7
 *    rules (one rule -- "the checklist wins" -- instead of a provenance
 *    matrix) are documented directly on `computeExpectedAttendeeRsvpPlan`
 *    itself, below.
 *
 * RSVP DDL (re-confirmed directly against
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` lines
 * 67-76 for this task): `rsvps.status text not null check (status in
 * ('going', 'maybe', 'declined'))`, `responded_by uuid references
 * public.profiles (id) on delete restrict` (nullable), `unique (session_id,
 * student_id)`. "Planned RSVP" = `status = 'going'` -- the only status this
 * feature ever writes. `staff_all` on `rsvps`
 * (`supabase/migrations/20260717000002_rls.sql` lines 197-199) is `for all
 * ... using (is_staff()) with check (is_staff())` -- covers the new DELETE
 * this feature performs (SCH-04/T114-verified, already cited above), no new
 * policy needed.
 *
 * `computeExpectedAttendeeRsvpPlan` below is the ONE place this
 * reconciliation is computed -- a pure function, independent of any
 * Supabase client, exercised directly by this file's own colocated tests
 * (`OutreachEventDialog.test.tsx`, this task's own Allowed Files) without a
 * fake-client harness. Load-bearing rule (worker packet Trap #2, quoted
 * literally): "unchecking removes only staff-entered planned RSVPs, NEVER a
 * student's own RSVP." Implemented as:
 *   - DELETE candidates: existing rows that are BOTH `status === 'going'`
 *     AND staff-entered (`responded_by !== null && responded_by !==
 *     student_id`) AND no longer in the checked set. A self-authored row
 *     (`responded_by === student_id`) is NEVER a deletion candidate, full
 *     stop -- this is the literal Trap #2 rule.
 *   - UPSERT candidates (fan-out): one `{status: 'going', responded_by}`
 *     row per (checked student x every final session id) pair -- "RSVPs key
 *     on SESSIONS, not events" (Trap #2's own text) -- EXCEPT pairs whose
 *     existing row is already self-authored, which are skipped (left
 *     completely untouched). This is a disclosed, deliberate EXTENSION
 *     beyond the packet's literal deletion-only wording, applied for
 *     internal consistency: overwriting a student's own `responded_by` with
 *     the coach's id on the WRITE side would erase that row's
 *     self-attribution (UXP-10's future activity feed reads `responded_by`
 *     to label a row `self` vs staff-entered) just as effectively as
 *     deleting it on the delete side, even though the row's `id` and
 *     `status` might otherwise survive unchanged -- "never destroy a
 *     student's own RSVP" is read as covering both directions, not only the
 *     literal delete path. Flagged here for Foreman/Boss review as a
 *     judgment call, not silently applied.
 *
 * `makeSaveOutreachEvent` wires this in as a THIRD phase, after the
 * existing event+sessions writes (create OR edit) complete: it re-reads the
 * event's final session ids (`loadExistingSessions`, the same loader the
 * EDIT reconciliation above already uses -- re-used here for BOTH create
 * and edit, so `insertSessions`'s own insert query is never modified to add
 * a `.select('id')` return leg, which would have changed its Postgrest call
 * shape for every caller, including this file's own pre-existing loader-
 * level tests in `OutreachList.test.tsx`/`OutreachDetail.test.tsx` -- both
 * out of this task's Allowed Files and therefore never touched), then loads
 * every existing `rsvps` row already attached to those sessions, computes
 * the plan, and performs the delete (if anything to delete) then the upsert
 * (if anything to upsert). This step is ENTIRELY SKIPPED (zero extra
 * network calls) when `payload.expectedStudentIds`/`payload.respondedBy`
 * are `undefined` -- deliberate backward compatibility (`OutreachEventDialog.
 * tsx`'s own module doc 11d has the full reasoning) so this file's own
 * pre-existing tests that construct a bare `{event, sessions}` payload
 * literal keep passing completely unchanged; the real `OutreachEventDialog`
 * always supplies both fields (an empty array is a valid, meaningful
 * "nothing currently checked" instruction that still runs the DELETE half
 * of the reconciliation, clearing any now-stale staff-entered planned
 * RSVPs).
 *
 * Trap #3 (non-atomicity) extended: this is one more sequential,
 * non-transactional Postgrest step tacked onto the already-disclosed
 * create/edit sequence -- a rejection here (e.g. an RLS `with check`
 * failure) leaves the event/sessions already committed with a stale/
 * incomplete roster, surfacing as the same real `SupabaseLoaderError`
 * `OutreachEventDialog.tsx`'s existing submit-error `Banner` already
 * renders.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, runMutation, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type {
  LoadOutreachDataFn,
  OutreachEventRow,
  OutreachGoalConfig,
  OutreachLoadResult,
  OutreachSessionRow,
  OutreachStudentFixture,
  RsvpRow as ListRsvpRow,
} from '../../../pages/outreach/OutreachList';
import type {
  LoadOutreachDetailFn,
  OutreachDetailData,
  OutreachDetailEvent,
  OutreachDetailSession,
  ProfileOption,
  RosterStudent,
  RsvpRow as DetailRsvpRow,
  TeamOption,
} from '../../../pages/outreach/OutreachDetail';
import type {
  OnSaveOutreachEventFn,
  OutreachRosterStudent,
  SaveOutreachEventPayload,
} from '../../../pages/outreach/OutreachEventDialog';
// T118 (UXP-02) module doc 7 -- reuses `loaders/students.ts`'s own already-
// real `makeLoadStudentsTabData` (T089) rather than duplicating its raw
// `students` query/mapping here.
import { makeLoadStudentsTabData } from './students';

// ---------------------------------------------------------------------------
// Raw DB row shapes (snake_case, exactly as Postgrest returns them). Cited
// column-for-column against the real migrations in this file's own module
// doc above.
// ---------------------------------------------------------------------------

interface EventDbRow {
  id: string;
  season_id: string;
  type: 'meeting' | 'outreach' | 'competition';
  title: string;
  description: string;
  location_name: string;
  address: string;
  team_ids: string[] | null;
  counts_participation: boolean;
  counts_volunteer_hours: boolean;
  adult_volunteers_count: number;
  adult_volunteer_hours: number;
  created_by: string | null;
}

interface EventSessionDbRow {
  id: string;
  event_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'canceled';
  people_reached: number | null;
  notes: string;
}

interface RsvpDbRow {
  id: string;
  session_id: string;
  student_id: string;
  status: 'going' | 'maybe' | 'declined';
  responded_by: string | null;
  updated_at: string;
  created_at: string;
}

interface StudentDbRow {
  id: string;
  display_name: string;
  team_id: string;
  goal_hours_override: number | null;
}

interface SeasonGoalDbRow {
  id: string;
  default_goal_hours: number;
}

interface SeasonIdDbRow {
  id: string;
}

interface TeamDbRow {
  id: string;
  name: string;
}

interface ProfileDbRow {
  id: string;
  display_name: string;
}

interface CreatedEventDbRow {
  id: string;
}

interface ExistingSessionDbRow {
  id: string;
  session_date: string;
}

interface SessionEventIdDbRow {
  event_id: string;
}

interface EventVolunteerTotalsDbRow {
  adult_volunteers_count: number;
  adult_volunteer_hours: number;
}

// ---------------------------------------------------------------------------
// Row mappers -- snake_case DB row -> the camelCase shapes
// `OutreachList.tsx`/`OutreachDetail.tsx` already expect.
// ---------------------------------------------------------------------------

function mapEventDbRowToOutreachEventRow(row: EventDbRow): OutreachEventRow {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    locationName: row.location_name,
  };
}

function mapSessionDbRowToOutreachSessionRow(row: EventSessionDbRow): OutreachSessionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    peopleReached: row.people_reached,
  };
}

function mapRsvpDbRowToListRsvpRow(row: RsvpDbRow): ListRsvpRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    respondedBy: row.responded_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function mapStudentDbRowToOutreachStudentFixture(row: StudentDbRow): OutreachStudentFixture {
  return { id: row.id, name: row.display_name };
}

function mapEventDbRowToOutreachDetailEvent(row: EventDbRow): OutreachDetailEvent {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    description: row.description,
    locationName: row.location_name,
    address: row.address,
    teamIds: row.team_ids,
    createdBy: row.created_by,
    countsParticipation: row.counts_participation,
    countsVolunteerHours: row.counts_volunteer_hours,
    adultVolunteersCount: row.adult_volunteers_count,
    adultVolunteerHours: row.adult_volunteer_hours,
  };
}

function mapSessionDbRowToOutreachDetailSession(row: EventSessionDbRow): OutreachDetailSession {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    peopleReached: row.people_reached,
    notes: row.notes,
  };
}

function mapRsvpDbRowToDetailRsvpRow(row: RsvpDbRow): DetailRsvpRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    respondedBy: row.responded_by,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

function mapStudentDbRowToRosterStudent(row: StudentDbRow): RosterStudent {
  return { id: row.id, name: row.display_name, teamId: row.team_id };
}

function mapTeamDbRowToTeamOption(row: TeamDbRow): TeamOption {
  return { id: row.id, name: row.name };
}

function mapProfileDbRowToProfileOption(row: ProfileDbRow): ProfileOption {
  return { id: row.id, name: row.display_name };
}

// ---------------------------------------------------------------------------
// Query functions.
// ---------------------------------------------------------------------------

async function queryEventsBySeason(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<EventDbRow[]>> {
  const result = await client
    .from('events')
    .select(
      'id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours, created_by',
    )
    .eq('season_id', seasonId);
  return { data: (result.data as EventDbRow[] | null) ?? null, error: result.error };
}

async function queryEventById(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EventDbRow>> {
  const result = await client
    .from('events')
    .select(
      'id, season_id, type, title, description, location_name, address, team_ids, counts_participation, counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours, created_by',
    )
    .eq('id', eventId)
    .maybeSingle();
  return { data: (result.data as EventDbRow | null) ?? null, error: result.error };
}

async function querySessionsForEvents(
  client: SupabaseClient,
  eventIds: readonly string[],
): Promise<LoaderQueryResult<EventSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, session_date, starts_at, ends_at, status, people_reached, notes')
    .in('event_id', [...eventIds]);
  return { data: (result.data as EventSessionDbRow[] | null) ?? null, error: result.error };
}

async function querySessionsForEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EventSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, session_date, starts_at, ends_at, status, people_reached, notes')
    .eq('event_id', eventId)
    .order('starts_at', { ascending: true });
  return { data: (result.data as EventSessionDbRow[] | null) ?? null, error: result.error };
}

async function queryRsvpsForSessions(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<RsvpDbRow[]>> {
  const result = await client
    .from('rsvps')
    .select('id, session_id, student_id, status, responded_by, updated_at, created_at')
    .in('session_id', [...sessionIds]);
  return { data: (result.data as RsvpDbRow[] | null) ?? null, error: result.error };
}

async function queryAllStudents(
  client: SupabaseClient,
): Promise<LoaderQueryResult<StudentDbRow[]>> {
  const result = await client
    .from('students')
    .select('id, display_name, team_id, goal_hours_override')
    .order('display_name', { ascending: true });
  return { data: (result.data as StudentDbRow[] | null) ?? null, error: result.error };
}

async function querySeasonGoal(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<SeasonGoalDbRow>> {
  const result = await client
    .from('seasons')
    .select('id, default_goal_hours')
    .eq('id', seasonId)
    .maybeSingle();
  return { data: (result.data as SeasonGoalDbRow | null) ?? null, error: result.error };
}

async function queryActiveSeasonId(
  client: SupabaseClient,
): Promise<LoaderQueryResult<SeasonIdDbRow>> {
  const result = await client.from('seasons').select('id').eq('is_active', true).maybeSingle();
  return { data: (result.data as SeasonIdDbRow | null) ?? null, error: result.error };
}

async function queryAllTeams(client: SupabaseClient): Promise<LoaderQueryResult<TeamDbRow[]>> {
  const result = await client.from('teams').select('id, name').order('sort_order', {
    ascending: true,
  });
  return { data: (result.data as TeamDbRow[] | null) ?? null, error: result.error };
}

async function queryProfileById(
  client: SupabaseClient,
  profileId: string,
): Promise<LoaderQueryResult<ProfileDbRow>> {
  const result = await client
    .from('profiles')
    .select('id, display_name')
    .eq('id', profileId)
    .maybeSingle();
  return { data: (result.data as ProfileDbRow | null) ?? null, error: result.error };
}

async function queryExistingSessionsForEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<ExistingSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, session_date')
    .eq('event_id', eventId);
  return { data: (result.data as ExistingSessionDbRow[] | null) ?? null, error: result.error };
}

async function querySessionEventId(
  client: SupabaseClient,
  sessionId: string,
): Promise<LoaderQueryResult<SessionEventIdDbRow>> {
  const result = await client
    .from('event_sessions')
    .select('event_id')
    .eq('id', sessionId)
    .maybeSingle();
  return { data: (result.data as SessionEventIdDbRow | null) ?? null, error: result.error };
}

async function queryEventVolunteerTotals(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EventVolunteerTotalsDbRow>> {
  const result = await client
    .from('events')
    .select('adult_volunteers_count, adult_volunteer_hours')
    .eq('id', eventId)
    .maybeSingle();
  return { data: (result.data as EventVolunteerTotalsDbRow | null) ?? null, error: result.error };
}

// ---------------------------------------------------------------------------
// Trap #1 -- real loads.
// ---------------------------------------------------------------------------

/** Module doc #2 -- the ONE place `individualGoalHoursByStudentId` is
 * resolved from the two real backing columns. */
function resolveIndividualGoalHours(
  students: readonly StudentDbRow[],
  seasonGoal: SeasonGoalDbRow | null,
): Record<string, number> {
  const goalByStudentId: Record<string, number> = {};
  for (const student of students) {
    goalByStudentId[student.id] =
      student.goal_hours_override ?? seasonGoal?.default_goal_hours ?? 0;
  }
  return goalByStudentId;
}

export function makeLoadOutreachData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadOutreachDataFn {
  const loadEvents = createLoader<string, EventDbRow[]>(queryEventsBySeason, getClient);
  const loadSessions = createLoader<readonly string[], EventSessionDbRow[]>(
    querySessionsForEvents,
    getClient,
  );
  const loadRsvps = createLoader<readonly string[], RsvpDbRow[]>(queryRsvpsForSessions, getClient);
  const loadStudents = createLoader<void, StudentDbRow[]>(queryAllStudents, getClient);
  const loadSeasonGoal = createLoader<string, SeasonGoalDbRow>(querySeasonGoal, getClient);

  return async (seasonId: string): Promise<OutreachLoadResult> => {
    const eventRows = (await loadEvents(seasonId)) ?? [];
    const eventIds = eventRows.map((event) => event.id);

    const [sessionRows, studentRows, seasonGoalRow] = await Promise.all([
      eventIds.length > 0 ? loadSessions(eventIds) : Promise.resolve([]),
      loadStudents(),
      loadSeasonGoal(seasonId),
    ]);
    const sessionIds = (sessionRows ?? []).map((session) => session.id);
    const rsvpRows = sessionIds.length > 0 ? ((await loadRsvps(sessionIds)) ?? []) : [];

    const students = studentRows ?? [];
    const goalConfig: OutreachGoalConfig = {
      seasonId,
      individualGoalHoursByStudentId: resolveIndividualGoalHours(students, seasonGoalRow),
    };

    return {
      events: eventRows.map(mapEventDbRowToOutreachEventRow),
      sessions: (sessionRows ?? []).map(mapSessionDbRowToOutreachSessionRow),
      rsvps: rsvpRows.map(mapRsvpDbRowToListRsvpRow),
      students: students.map(mapStudentDbRowToOutreachStudentFixture),
      goalConfig,
    };
  };
}

/** `OutreachList.tsx`'s own real default `loadData`. */
export const loadOutreachData: LoadOutreachDataFn = makeLoadOutreachData();

export function makeLoadOutreachDetail(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadOutreachDetailFn {
  const loadEvent = createLoader<string, EventDbRow>(queryEventById, getClient);
  const loadSessions = createLoader<string, EventSessionDbRow[]>(querySessionsForEvent, getClient);
  const loadRsvps = createLoader<readonly string[], RsvpDbRow[]>(queryRsvpsForSessions, getClient);
  const loadStudents = createLoader<void, StudentDbRow[]>(queryAllStudents, getClient);
  const loadTeams = createLoader<void, TeamDbRow[]>(queryAllTeams, getClient);
  const loadProfile = createLoader<string, ProfileDbRow>(queryProfileById, getClient);

  return async (eventId: string): Promise<OutreachDetailData | null> => {
    const eventRow = await loadEvent(eventId);
    // Module doc #1 -- the designed NAV-08/DES-12 "not found / inaccessible"
    // signal, RLS-honest: `.maybeSingle()` cannot distinguish "doesn't
    // exist" from "RLS denies it", and it should not try to.
    if (eventRow === null) return null;

    const [sessionRows, studentRows, teamRows] = await Promise.all([
      loadSessions(eventId),
      loadStudents(),
      loadTeams(),
    ]);
    const sessionIds = (sessionRows ?? []).map((session) => session.id);
    const rsvpRows = sessionIds.length > 0 ? ((await loadRsvps(sessionIds)) ?? []) : [];
    const profileRow = eventRow.created_by !== null ? await loadProfile(eventRow.created_by) : null;

    return {
      event: mapEventDbRowToOutreachDetailEvent(eventRow),
      sessions: (sessionRows ?? []).map(mapSessionDbRowToOutreachDetailSession),
      rsvps: rsvpRows.map(mapRsvpDbRowToDetailRsvpRow),
      students: (studentRows ?? []).map(mapStudentDbRowToRosterStudent),
      teams: (teamRows ?? []).map(mapTeamDbRowToTeamOption),
      profiles: profileRow !== null ? [mapProfileDbRowToProfileOption(profileRow)] : [],
    };
  };
}

/** `OutreachDetail.tsx`'s own real default `loadData`. */
export const loadOutreachDetail: LoadOutreachDetailFn = makeLoadOutreachDetail();

// ---------------------------------------------------------------------------
// Trap #2 -- shared RSVP mutation (module doc #3). Locally-defined param
// type -- structurally, not nominally, compatible with both
// `RsvpControl.tsx`'s and `ParentRsvp.tsx`'s own independently-declared
// `OnRsvpChangeFn`/`RsvpChangeParams`, so no circular import is needed here.
// ---------------------------------------------------------------------------

export interface OutreachRsvpChangeParams {
  sessionId: string;
  studentId: string;
  status: 'going' | 'maybe' | 'declined';
  /** A real `profiles.id` -- the RLS `with check` on `rsvps` requires this
   * to equal `auth.uid()` (module doc #3); this function writes whatever the
   * caller supplies verbatim, never re-deriving it. */
  respondedBy: string;
}

export type SubmitRsvpChangeFn = (params: OutreachRsvpChangeParams) => Promise<void>;

/** Module doc #3 -- the ONE real `rsvps` upsert, shared by both
 * `RsvpControl.tsx` (student self-RSVP) and `ParentRsvp.tsx` (parent
 * RSVP-on-behalf). */
export function makeSubmitRsvpChange(
  getClient: () => SupabaseClient = getSupabaseClient,
): SubmitRsvpChangeFn {
  const mutate = runMutation<OutreachRsvpChangeParams, void>(
    (client, params) =>
      client.from('rsvps').upsert(
        {
          session_id: params.sessionId,
          student_id: params.studentId,
          status: params.status,
          responded_by: params.respondedBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,student_id' },
      ),
    getClient,
  );
  return async (params) => {
    await mutate(params);
  };
}

/** Real default `onRsvpChange` for both `RsvpControl.tsx` and
 * `ParentRsvp.tsx`. */
export const submitRsvpChange: SubmitRsvpChangeFn = makeSubmitRsvpChange();

// ---------------------------------------------------------------------------
// Trap #3 -- Mark Day Complete (module doc #4). Locally-defined payload type
// -- structurally compatible with `MarkDayCompleteDialog.tsx`'s own
// `OnMarkDayCompleteFn`/`MarkDayCompletePayload`, no circular import needed.
// ---------------------------------------------------------------------------

export interface OutreachAttendanceWriteRow {
  sessionId: string;
  studentId: string;
  status: 'present' | 'late' | 'excused' | 'absent';
  checkInAt: string | null;
  checkOutAt: string | null;
  hoursOverride: number | null;
  method: 'qr' | 'coach' | 'import';
  recordedBy: string;
}

export interface OutreachMarkDayCompletePayload {
  sessionId: string;
  peopleReached: number | null;
  attendance: readonly OutreachAttendanceWriteRow[];
  adultVolunteersCountThisSession: number;
  adultVolunteerHoursThisSession: number;
  recordedBy: string;
}

export type MarkDayCompleteFn = (payload: OutreachMarkDayCompletePayload) => Promise<void>;

/** Module doc #4 -- three real writes: `event_sessions` status flip,
 * `attendance` upsert, and a disclosed non-atomic additive `events`
 * adult-volunteer update. */
export function makeMarkDayComplete(
  getClient: () => SupabaseClient = getSupabaseClient,
): MarkDayCompleteFn {
  const updateSession = runMutation<{ sessionId: string; peopleReached: number | null }, void>(
    (client, args) =>
      client
        .from('event_sessions')
        .update({ status: 'completed', people_reached: args.peopleReached })
        .eq('id', args.sessionId),
    getClient,
  );
  const upsertAttendance = runMutation<readonly OutreachAttendanceWriteRow[], void>(
    (client, rows) =>
      client.from('attendance').upsert(
        rows.map((row) => ({
          session_id: row.sessionId,
          student_id: row.studentId,
          status: row.status,
          check_in_at: row.checkInAt,
          check_out_at: row.checkOutAt,
          hours_override: row.hoursOverride,
          method: row.method,
          recorded_by: row.recordedBy,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'session_id,student_id' },
      ),
    getClient,
  );
  const loadSessionEventId = createLoader<string, SessionEventIdDbRow>(
    querySessionEventId,
    getClient,
  );
  const loadEventVolunteerTotals = createLoader<string, EventVolunteerTotalsDbRow>(
    queryEventVolunteerTotals,
    getClient,
  );
  const updateEventVolunteerTotals = runMutation<
    { eventId: string; count: number; hours: number },
    void
  >(
    (client, args) =>
      client
        .from('events')
        .update({ adult_volunteers_count: args.count, adult_volunteer_hours: args.hours })
        .eq('id', args.eventId),
    getClient,
  );

  return async (payload: OutreachMarkDayCompletePayload): Promise<void> => {
    await updateSession({ sessionId: payload.sessionId, peopleReached: payload.peopleReached });

    if (payload.attendance.length > 0) {
      await upsertAttendance(payload.attendance);
    }

    // Module doc #4(c) -- disclosed non-atomic read-modify-write, skipped
    // entirely when there is nothing to add.
    if (payload.adultVolunteersCountThisSession > 0 || payload.adultVolunteerHoursThisSession > 0) {
      const sessionEvent = await loadSessionEventId(payload.sessionId);
      if (sessionEvent !== null) {
        const totals = await loadEventVolunteerTotals(sessionEvent.event_id);
        const currentCount = totals?.adult_volunteers_count ?? 0;
        const currentHours = totals?.adult_volunteer_hours ?? 0;
        await updateEventVolunteerTotals({
          eventId: sessionEvent.event_id,
          count: currentCount + payload.adultVolunteersCountThisSession,
          hours: currentHours + payload.adultVolunteerHoursThisSession,
        });
      }
    }
  };
}

/** Real default `onMarkComplete` for `MarkDayCompleteDialog.tsx`. */
export const markDayComplete: MarkDayCompleteFn = makeMarkDayComplete();

// ---------------------------------------------------------------------------
// Trap #5 -- real `onSaveEvent` for `OutreachEventDialog.tsx`, wired for both
// create (`OutreachList.tsx`) and edit (`OutreachDetail.tsx`). Module doc #5.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T118 (UXP-02) module doc 7 -- the ONE pure function computing the
// expected-attendees RSVP reconciliation plan (Trap #2). Independent of any
// Supabase client -- exercised directly by `OutreachEventDialog.test.tsx`.
// ---------------------------------------------------------------------------

export interface ExpectedAttendeeRsvpPlan {
  idsToDelete: string[];
  rowsToUpsert: Array<{ sessionId: string; studentId: string }>;
}

/**
 * T119 (PRD v2 D-7, George's direct 2026-07-20 override -- module doc 7's
 * "AMENDED" note above has the full history): the coach is the ultimate
 * authority over RSVPs. ONE rule, no provenance matrix ("the checklist
 * wins"):
 *   - CHECKED student -> upsert `status: 'going'` for every final session
 *     id, REGARDLESS of any existing row's prior author or status. A
 *     student's own self-authored `'declined'`/`'maybe'`/`'going'` row is
 *     overwritten to `'going'` just like a staff-entered one; `responded_by`
 *     becomes the acting coach's id. `selfAuthoredKeys` (T118's protection
 *     mechanism) is gone -- there is no longer any row this fan-out skips.
 *   - UNCHECKED student -> DELETE that student's `status === 'going'` rows
 *     across the given sessions, REGARDLESS of who authored them (a
 *     self-authored `'going'` row is deleted exactly like a staff-entered
 *     one).
 *   - A row whose status is `'declined'`/`'maybe'` is left COMPLETELY
 *     UNTOUCHED by an uncheck (D-7's own text: "not expected" is not the
 *     same fact as "they answered no" -- an uncheck only ever clears a
 *     PLANNED (`'going'`) attendance entry, it never mutates a student's
 *     actual declined/maybe answer). This part of the rule is unchanged from
 *     T118 -- it was never a self-authored-protection rule, it is a status
 *     filter (`row.status === 'going'`) that applies identically regardless
 *     of author.
 */
export function computeExpectedAttendeeRsvpPlan(
  existingRsvps: readonly RsvpDbRow[],
  sessionIds: readonly string[],
  expectedStudentIds: readonly string[],
): ExpectedAttendeeRsvpPlan {
  const checkedSet = new Set(expectedStudentIds);

  const idsToDelete = existingRsvps
    .filter((row) => row.status === 'going' && !checkedSet.has(row.student_id))
    .map((row) => row.id);

  const rowsToUpsert: Array<{ sessionId: string; studentId: string }> = [];
  for (const sessionId of sessionIds) {
    for (const studentId of checkedSet) {
      rowsToUpsert.push({ sessionId, studentId });
    }
  }

  return { idsToDelete, rowsToUpsert };
}

function toEventInsertPayload(event: SaveOutreachEventPayload['event']) {
  return {
    type: event.type,
    title: event.title,
    description: event.description,
    location_name: event.locationName,
    address: event.address,
    team_ids: event.teamIds,
    counts_participation: event.countsParticipation,
    counts_volunteer_hours: event.countsVolunteerHours,
    adult_volunteers_count: event.adultVolunteersCount,
    adult_volunteer_hours: event.adultVolunteerHours,
  };
}

export function makeSaveOutreachEvent(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnSaveOutreachEventFn {
  const loadActiveSeasonId = createLoader<void, SeasonIdDbRow>(queryActiveSeasonId, getClient);
  const insertEvent = runMutation<
    { event: SaveOutreachEventPayload['event']; seasonId: string },
    CreatedEventDbRow
  >(
    (client, args) =>
      client
        .from('events')
        .insert({ season_id: args.seasonId, ...toEventInsertPayload(args.event) })
        .select('id')
        .single(),
    getClient,
  );
  const updateEvent = runMutation<{ id: string; event: SaveOutreachEventPayload['event'] }, void>(
    (client, args) =>
      client.from('events').update(toEventInsertPayload(args.event)).eq('id', args.id),
    getClient,
  );
  const insertSessions = runMutation<
    { eventId: string; sessions: readonly SaveOutreachEventPayload['sessions'][number][] },
    void
  >(
    (client, args) =>
      client.from('event_sessions').insert(
        args.sessions.map((session) => ({
          event_id: args.eventId,
          session_date: session.sessionDate,
          starts_at: session.startsAt,
          ends_at: session.endsAt,
          status: 'scheduled',
          notes: session.notes,
          people_reached: session.peopleReached,
        })),
      ),
    getClient,
  );
  const loadExistingSessions = createLoader<string, ExistingSessionDbRow[]>(
    queryExistingSessionsForEvent,
    getClient,
  );
  const updateSession = runMutation<
    { id: string; session: SaveOutreachEventPayload['sessions'][number] },
    void
  >(
    (client, args) =>
      client
        .from('event_sessions')
        .update({
          starts_at: args.session.startsAt,
          ends_at: args.session.endsAt,
          notes: args.session.notes,
          people_reached: args.session.peopleReached,
        })
        .eq('id', args.id),
    getClient,
  );

  async function createOutreachEvent(payload: SaveOutreachEventPayload): Promise<string> {
    const activeSeason = await loadActiveSeasonId();
    if (activeSeason === null) {
      throw new Error(
        'No active season is set up yet. Ask an admin to set an active season in Season Settings before creating an outreach event.',
      );
    }
    const createdEvent = await insertEvent({ event: payload.event, seasonId: activeSeason.id });
    if (payload.sessions.length > 0) {
      // Disclosed risk -- same class `loaders/meetings.ts`'s own
      // `makeCreateMeetings` already accepts: if the `events` insert
      // succeeds but this `event_sessions` insert then fails, the database
      // is left with a real "outreach" event row with zero sessions.
      await insertSessions({ eventId: createdEvent.id, sessions: payload.sessions });
    }
    // T118 (UXP-02) module doc 7 -- `createdEvent.id` is now also needed by
    // the RSVP-reconciliation phase below; `insertSessions`'s own query
    // shape is deliberately left unchanged (module doc 7 explains why).
    return createdEvent.id;
  }

  // Module doc #5 EDIT path -- reconciles by `sessionDate` (never deletes an
  // existing session, per this file's own genuine FK-restrict finding above).
  async function updateOutreachEvent(
    eventId: string,
    payload: SaveOutreachEventPayload,
  ): Promise<void> {
    await updateEvent({ id: eventId, event: payload.event });

    const existing = (await loadExistingSessions(eventId)) ?? [];
    const existingIdByDate = new Map(existing.map((row) => [row.session_date, row.id] as const));

    const toUpdate = payload.sessions.filter((session) =>
      existingIdByDate.has(session.sessionDate),
    );
    const toInsert = payload.sessions.filter(
      (session) => !existingIdByDate.has(session.sessionDate),
    );

    await Promise.all(
      toUpdate.map((session) => {
        const id = existingIdByDate.get(session.sessionDate);
        // `toUpdate`'s own `.filter` guarantees a match exists.
        return updateSession({ id: id as string, session });
      }),
    );
    if (toInsert.length > 0) {
      await insertSessions({ eventId, sessions: toInsert });
    }
  }

  // T118 (UXP-02) module doc 7 -- RSVP reconciliation phase. `loadRsvps`
  // reuses the exact same `queryRsvpsForSessions` query function
  // `makeLoadOutreachData`/`makeLoadOutreachDetail` above already use (not
  // duplicated).
  const loadRsvpsForEventSessions = createLoader<readonly string[], RsvpDbRow[]>(
    queryRsvpsForSessions,
    getClient,
  );
  const upsertExpectedAttendeeRsvps = runMutation<
    { rows: readonly { sessionId: string; studentId: string }[]; respondedBy: string },
    void
  >(
    (client, args) =>
      client.from('rsvps').upsert(
        args.rows.map((row) => ({
          session_id: row.sessionId,
          student_id: row.studentId,
          status: 'going',
          responded_by: args.respondedBy,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'session_id,student_id' },
      ),
    getClient,
  );
  const deleteRsvpsByIds = runMutation<readonly string[], void>(
    (client, ids) =>
      client
        .from('rsvps')
        .delete()
        .in('id', [...ids]),
    getClient,
  );

  // Module doc 7 -- shared by CREATE and EDIT; re-reads the event's final
  // session ids via `loadExistingSessions` (already defined above for the
  // EDIT path) rather than threading a return value through
  // `insertSessions`'s own unmodified mutation.
  async function reconcileExpectedAttendeeRsvps(
    eventId: string,
    expectedStudentIds: readonly string[],
    respondedBy: string,
  ): Promise<void> {
    const sessionRows = (await loadExistingSessions(eventId)) ?? [];
    const sessionIds = sessionRows.map((row) => row.id);
    if (sessionIds.length === 0) return;

    const existingRsvps = (await loadRsvpsForEventSessions(sessionIds)) ?? [];
    const plan = computeExpectedAttendeeRsvpPlan(existingRsvps, sessionIds, expectedStudentIds);

    if (plan.idsToDelete.length > 0) {
      await deleteRsvpsByIds(plan.idsToDelete);
    }
    if (plan.rowsToUpsert.length > 0) {
      await upsertExpectedAttendeeRsvps({ rows: plan.rowsToUpsert, respondedBy });
    }
  }

  return async (payload: SaveOutreachEventPayload): Promise<void> => {
    let eventId: string;
    if (payload.event.id === undefined) {
      eventId = await createOutreachEvent(payload);
    } else {
      eventId = payload.event.id;
      await updateOutreachEvent(eventId, payload);
    }

    // Module doc 7 -- deliberately gated on BOTH fields being present
    // (back-compat guard, `OutreachEventDialog.tsx`'s own module doc 11d).
    if (payload.expectedStudentIds !== undefined && payload.respondedBy !== undefined) {
      await reconcileExpectedAttendeeRsvps(
        eventId,
        payload.expectedStudentIds,
        payload.respondedBy,
      );
    }
  };
}

/** Real default `onSaveEvent` -- passed to `OutreachEventDialog` from both
 * `OutreachList.tsx` (create mode) and `OutreachDetail.tsx` (edit mode). */
export const saveOutreachEvent: OnSaveOutreachEventFn = makeSaveOutreachEvent();

// ---------------------------------------------------------------------------
// Trap #4 -- real, event-level Cancel for `OutreachDetail.tsx`. Module doc #6.
// ---------------------------------------------------------------------------

export type CancelOutreachEventFn = (eventId: string) => Promise<void>;

/** Module doc #6 -- the ONE place this module ever writes
 * `event_sessions.status = 'canceled'` at event scope; only currently-
 * `'scheduled'` sessions for the event are affected. */
export function makeCancelOutreachEvent(
  getClient: () => SupabaseClient = getSupabaseClient,
): CancelOutreachEventFn {
  const mutate = runMutation<string, void>(
    (client, eventId) =>
      client
        .from('event_sessions')
        .update({ status: 'canceled' })
        .eq('event_id', eventId)
        .eq('status', 'scheduled'),
    getClient,
  );
  return async (eventId) => {
    await mutate(eventId);
  };
}

/** `OutreachDetail.tsx`'s own real default `onCancelEvent`. */
export const cancelOutreachEvent: CancelOutreachEventFn = makeCancelOutreachEvent();

// ---------------------------------------------------------------------------
// T118 (UXP-02) module doc 7 / Known Context/Traps #4 -- a real, ready
// roster loader for `OutreachEventDialog.tsx`'s new `students` prop. NOT
// wired into any page by this task (`OutreachList.tsx`/`OutreachDetail.tsx`
// page-level wiring is out of this task's own Allowed Files) -- same
// disclosed-scope posture `submitRsvpChange`/`markDayComplete` above already
// had before their own later wiring tasks landed.
// ---------------------------------------------------------------------------

export type LoadOutreachEventRosterFn = () => Promise<OutreachRosterStudent[]>;

/**
 * Reuses `loaders/students.ts`'s own already-real `makeLoadStudentsTabData`
 * (T089, real `students` query + row mapping) rather than duplicating that
 * table's query/mapping here (packet Trap #4: "reuse exportable pieces of
 * loaders/students.ts... rather than duplicating mapping logic"). Filters to
 * `isActive` only -- "Active students grouped by team chips" -- and reshapes
 * `StudentRow` (`id`/`displayName`/`teamId`/`isActive`, `StudentsTab.tsx`'s
 * own local type) into `OutreachEventDialog.tsx`'s own `OutreachRosterStudent`
 * shape (`id`/`name`/`teamId`/`isActive`).
 */
export function makeLoadOutreachEventRoster(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadOutreachEventRosterFn {
  const loadStudentsTab = makeLoadStudentsTabData(getClient);
  return async (): Promise<OutreachRosterStudent[]> => {
    const data = await loadStudentsTab();
    return data.students
      .filter((student) => student.isActive)
      .map((student) => ({
        id: student.id,
        name: student.displayName,
        teamId: student.teamId,
        isActive: student.isActive,
      }));
  };
}

/** Ready real default -- not yet wired to `OutreachEventDialog`'s own
 * `students` prop by any page (module doc above). */
export const loadOutreachEventRoster: LoadOutreachEventRosterFn = makeLoadOutreachEventRoster();
