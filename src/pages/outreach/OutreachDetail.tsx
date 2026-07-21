/**
 * T041: `/outreach/:eventId` detail page (OUT-04): a `MetadataList`
 * (when/where/scope/creator), per-session signup lists grouped
 * Going/Maybe/Can't go/No response, a plain Google Maps link built from the
 * address, edit/cancel via `MoreMenu`, and a NAV-08 "Copy link" action.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `events`/`event_sessions`/`rsvps` column shapes, cited
 *    directly from `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address (the exact, confirmed column name -- NOT `location_address`),
 *    team_ids uuid[] NULL (null = all teams), counts_participation,
 *    counts_volunteer_hours, created_by uuid references profiles NULLABLE,
 *    created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached, notes,
 *    created_at.
 *
 *    `rsvps` (lines 67-76): id, session_id, student_id, status (check:
 *    'going' | 'maybe' | 'declined'), responded_by uuid references profiles
 *    NULLABLE, updated_at, created_at, unique(session_id, student_id).
 *
 *    `OutreachDetailEvent`/`OutreachDetailSession`/`RsvpRow` below are
 *    camelCase renames of the subset of these columns this page needs --
 *    real status vocabularies used verbatim, never an invented string.
 *    `OutreachList.tsx`/`OutreachEventDialog.tsx`/`RsvpControl.tsx` (T038/
 *    T039/T040, all Forbidden Files, read-only reference per this task's own
 *    Dependencies) already established camelCase shapes for this same
 *    schema subset -- this file's shapes match their field names/casing
 *    (id, sessionId/eventId, studentId, status, respondedBy, updatedAt,
 *    createdAt) so a future wiring task can pass real fetched rows straight
 *    through with no reshaping, but are independently reimplemented here
 *    (not imported), since all three are Forbidden Files for this task.
 *
 * -----------------------------------------------------------------------
 * 2. THE CENTRAL TRAP -- "No response" is a UI-DERIVED bucket, never a
 *    fabricated fourth stored `rsvps.status` value.
 *
 * The real `rsvps.status` check constraint (module doc #1) only accepts
 * `'going' | 'maybe' | 'declined'` -- there is no `'no_response'`/
 * `'unanswered'`/etc. value anywhere in that check. `groupSessionSignups`
 * below is the ONE place the four signup buckets (Going/Maybe/Can't go/No
 * response) are computed, and it derives "No response" by DIFFING the
 * event's team roster (`resolveEventRoster`, module doc #3) against
 * whichever `rsvps` rows actually exist for that specific session: any
 * roster student with NO `rsvps` row at all for that `session_id` lands in
 * "No response"; a student with a `declined` row lands in "Can't go" (a
 * real answer, distinct from never having answered) -- never conflated.
 * Grep-provable: no string literal resembling a fourth status value is ever
 * written to an `rsvps`-shaped object anywhere in this file.
 *
 * -----------------------------------------------------------------------
 * 3. Roster resolution -- `events.team_ids` NULL/array semantics (module
 *    doc #1), reused for the "No response" diff (module doc #2).
 *
 * `resolveEventRoster` returns every student for `team_ids === null` (all
 * teams), or only students whose `students.team_id` (a single FK per
 * `20260716000000_identity_roster.sql` line 63 -- NOT a many-to-many
 * membership) is present in `team_ids` otherwise. This is the roster every
 * per-session grouping diffs against: for a team-scoped event, a student
 * OUTSIDE the scoped team(s) never appears in ANY bucket for that event's
 * sessions (not even "No response") -- proven in this task's own test file
 * by asserting an out-of-scope student's name is absent from the entire
 * rendered detail page for a team-scoped fixture event.
 *
 * -----------------------------------------------------------------------
 * 4. Per-session, NOT per-event, signup-list grouping (Known Context/Traps
 *    #4 -- explicit disclosure required).
 *
 * OUT-04's own text (quoted in this task's packet) reads "per-session
 * signup lists", and `event_sessions` is a real one-to-many child of
 * `events` (an outreach event may run several days, each with its own
 * attendance-relevant headcount). Flattening every session's RSVPs into one
 * event-wide bucket would silently discard which day a student is actually
 * committed to, which is exactly the information a coach opening this page
 * mid-multi-day-event needs. This file therefore renders ONE
 * `SessionSignupList` (its own four buckets) per `event_sessions` row,
 * ordered chronologically (`sortSessionsByStart`) -- never a single
 * event-wide flattened set. `groupSessionSignups` itself only ever takes a
 * single `sessionId`, not `eventId`, which is the grep-provable proof this
 * decision is structural, not incidental.
 *
 * -----------------------------------------------------------------------
 * 5. NAV-08 -- invalid/inaccessible ids reveal NOTHING (DES-12 error
 *    state), proven with a fixture "not found" result (Known Context/Traps
 *    #1).
 *
 * `LoadOutreachDetailFn` resolves to `OutreachDetailData | null` -- `null`
 * is the designed "not found / inaccessible" signal (distinct from a
 * REJECTED promise, which represents a transient fetch failure and gets its
 * own, separate `Banner` state; conflating the two would let a real network
 * blip render the same "you're not authorized" copy a genuinely-denied
 * request should show, which is its own (milder) leak). `defaultLoadOutreachDetail`
 * (module doc #7) returns `null` for any id not present in its own fixture
 * `FIXTURE_EVENTS` array -- this task's own test file passes exactly such
 * an id and asserts the ONLY thing in the container's text content is the
 * DES-12 `EmptyState` copy: no event title, no address, no signup names, no
 * `MetadataList`, nothing. `NoAccessPage.tsx` (T020, read-only reference
 * per this task's own instruction) established the same "reveal nothing,
 * generic copy" posture for its own distinct (auth-entry, not per-record)
 * scenario -- this page's `notFound` branch follows that same discipline
 * (a plain, generic `EmptyState`, no partial render of anything this page
 * would otherwise show) adapted to a per-record detail page rather than
 * reusing its literal `Card`/`Center` auth-screen chrome, which would be
 * the wrong visual register for a route nested inside the app shell.
 *
 * -----------------------------------------------------------------------
 * 6. NAV-08 Copy link -- `Toast` "Link copied", verbatim, real constructed
 *    URL, disclosed clipboard-API test limitation (Known Context/Traps #2).
 *
 * `buildOutreachDetailUrl(eventId, origin)` is the ONE place the copied URL
 * string is built (`${origin}/outreach/${eventId}`, the real route this
 * page itself is mounted at, with the real event id interpolated -- never a
 * placeholder/fake id). `handleCopyLink` fires the `Toast` (`body="Link
 * copied"`, the literal string this task's packet requires verbatim)
 * unconditionally on click and separately, best-effort, calls
 * `copyTextToClipboard` (module doc #7) -- a real `navigator.clipboard.writeText`
 * call when that API exists, silently absorbed otherwise. No real OS-level
 * clipboard *read-back* can be asserted in this project's `jsdom` test
 * environment (`jsdom` does not implement a persistent, readable clipboard
 * store) -- this task's own test file honestly tests only what is provable
 * from inside the page: (a) `buildOutreachDetailUrl`'s own string output is
 * correct and uses the real id, (b) the `Toast`'s literal "Link copied"
 * text renders after the click, and (c) a mocked `navigator.clipboard.writeText`
 * is called with that exact same URL string -- never a fabricated
 * clipboard-read-back assertion.
 *
 * -----------------------------------------------------------------------
 * 7. No shared Supabase client wired in (Forbidden Files: `src/lib/supabase/**`
 *    read-only reference only) -- deliberate scope, same posture as every
 *    prior content page in this batch.
 *
 * `defaultLoadOutreachDetail` is an obviously-fake fixture loader (constants
 * below, constitution item 6: fabricated names only), the injectable
 * default for `loadData`. `copyTextToClipboard` is a thin, directly-testable
 * wrapper around the real (when present) `navigator.clipboard.writeText`
 * Web API -- not a Supabase call, so it is not part of this disclosed gap;
 * it is exported specifically so this task's test file can spy on it.
 *
 * -----------------------------------------------------------------------
 * 8. T101 UPDATE (ED-1 Packet P10): Edit/Cancel `MoreMenu` items are NO
 *    LONGER stubs -- see module doc #10 below for the full real wiring.
 *    `OutreachEventDialog.tsx` (T039) was already built and already Passed;
 *    this task wires it into this page for the first time, in EDIT mode
 *    (Trap #5's own investigation found it genuinely supports editing an
 *    existing event -- the opposite finding from T096's
 *    `ScheduleMeetingsDialog.tsx` investigation). "Cancel event" is now a
 *    real, event-level `event_sessions.status = 'canceled'` mutation
 *    (module doc #10) -- this task's own packet explicitly resolved the
 *    ambiguity the earlier task's disclosed judgment call above had flagged
 *    ("cancel every session? which one?"): every currently-`'scheduled'`
 *    session for the event, leaving already-`'completed'` sessions
 *    untouched.
 *
 * -----------------------------------------------------------------------
 * 9. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped
 *    live for this task):
 *
 *  - `MetadataList` (line 4655 section, Props table): `children`,
 *    `columns` (`'single'`), `title` used. `MetadataListItem`'s own
 *    "Components" subsection is `undefined` (same disclosed doc-gap every
 *    sibling file in this batch has hit); cross-checked directly against
 *    the installed source
 *    (`node_modules/@astryxdesign/core/dist/MetadataList/MetadataListItem.d.ts`):
 *    `label` (required), `children` (required), `icon` -- only `label`/
 *    `children` used here.
 *  - `MoreMenu` (line 4786 section, Props table): `items`
 *    (`DropdownMenuOption[]`, re-exported from `@astryxdesign/core`'s
 *    `./DropdownMenu` barrel per `node_modules/@astryxdesign/core/dist/index.d.ts`,
 *    same as `MeetingsList.tsx`'s own confirmed citation), `label` used.
 *  - `Link` (line 1910 section, Props table): `href`, `isExternalLink`,
 *    `isStandalone`, `children` used.
 *  - `Button` (line 1768 section, Props table): `label`, `variant`,
 *    `onClick` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `AlertDialog` (T101, "AlertDialog" Props table, same citation
 *    `MeetingsList.tsx`'s own T096 cancel wiring already established):
 *    `isOpen`, `onOpenChange`, `title`, `description`, `actionLabel`,
 *    `onAction` (all required) used; `actionVariant` left at its documented
 *    `'destructive'` default (canceling an outreach event is a
 *    destructive-shaped action).
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description` used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this screen's predictable detail-page
 *    shape (title bar + fixed-length `MetadataList` + signup sessions),
 *    replacing `Spinner`'s prior use here per Astryx's own guidance
 *    (known-dimension content). `VisuallyHidden` + the wrapping `VStack`'s
 *    `aria-busy` carry the "Loading event…" announcement `Spinner`'s
 *    `label` used to provide.
 *  - `Toast`: `astryx-api.md` line 5998 section's own Props table is a
 *    real, disclosed doc-gap already caught and cited by `OutreachList.tsx`'s
 *    own module doc #4 -- it names `uniqueID`/`onHide` where the installed
 *    `ToastProps` (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`,
 *    re-verified directly for this task) has neither. Only the installed-
 *    source-verified props are used: `type`, `body` (required), `isAutoHide`
 *    (required), `autoHideDuration` (required), `onDismiss` (required, not
 *    `onHide`). No `ToastViewport` exists anywhere in this app yet (same
 *    confirmed gap `OutreachList.tsx` already found) -- `<Toast>` is
 *    rendered directly in normal document flow, per the doc's own guidance
 *    for that scenario.
 *  - `List`/`ListItem` (line 4536 section, Props table + own `undefined`
 *    `ListItem` "Components" subsection, cross-checked via
 *    `node_modules/@astryxdesign/core/dist/List/ListItem.d.ts`, same
 *    citation `OutreachList.tsx`/`MeetingsList.tsx` already made): `children`,
 *    `hasDividers` (List); `label` (ListItem) used.
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap every sibling page in this batch
 *    already hit); `npm run astryx -- component Heading` resolves `level`
 *    (required) + `children` (required) -- only those two used.
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`),
 *    `color` used.
 *  - `VStack`/`HStack` ("Stack" section, `VStack`/`HStack` subsections):
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap` used.
 *
 * -----------------------------------------------------------------------
 * 10. T101 (ED-1 Packet P10): real load + real Edit/Cancel wiring.
 *
 * `loadData` now defaults to `loadOutreachDetail`
 * (`../../lib/supabase/loaders/outreach.ts`, a real query resolving `null`
 * for a genuinely nonexistent OR RLS-inaccessible event -- module doc #5's
 * exact contract, unchanged).
 *
 * "Edit" opens the real, already-built `OutreachEventDialog.tsx` (T039) in
 * EDIT mode (`isEventDialogOpen` state). Trap #5's own investigation (this
 * task's own worker output has the full writeup) found -- by reading that
 * dialog's actual source, not by assuming the same finding T096 made for
 * `ScheduleMeetingsDialog.tsx` just because the situation rhymes -- that it
 * genuinely DOES support editing an existing event: its own
 * `OutreachEventDialogProps.initialEvent?: ExistingOutreachEvent` prop, when
 * present, pre-fills every field (loading existing sessions into "Custom
 * dates" mode) and its own `SaveOutreachEventPayload.event.id` carries the
 * existing event's id through to `onSaveEvent`. `buildInitialOutreachEvent`
 * above is the ONE place a real fetched `OutreachDetailEvent`/
 * `OutreachDetailSession[]` pair is reshaped into that dialog's own
 * `ExistingOutreachEvent` shape -- including a genuine UTC-to-Chicago-
 * wall-clock conversion (`formatChicagoWallTime`, the inverse of that
 * dialog's own `chicagoWallTimeToUtcIso`, independently reimplemented here
 * since that function isn't exported) for each session's `startTime`/
 * `endTime`. `handleSaveEventSubmit` wires the dialog's own `onSaveEvent`
 * prop to a real default (`saveOutreachEvent`, same loader module, module
 * doc #5 of that file for the full create-vs-edit reconciliation writeup)
 * and reloads this page's own data (`reloadDetail`) on success.
 *
 * "Cancel event" opens a real `AlertDialog` (DES-11) confirming an
 * event-level cancel, then calls a real mutation (`onCancelEvent`, default
 * `cancelOutreachEvent`, same loader module) that flips every currently-
 * `'scheduled'` session for this event to `'canceled'` -- optimistic local
 * flip + rollback-on-failure, mirroring `MeetingsList.tsx`'s own
 * `handleConfirmCancel` (T096) shape exactly, per this task's own packet
 * steer. This resolves the earlier task's own disclosed "cancel semantics
 * were ambiguous" judgment call (module doc #8 above): the packet's own Trap
 * #4 explicitly specifies "flip `event_sessions.status` to `'canceled'`",
 * scoped here to every still-scheduled session of the event (already-
 * completed sessions are left untouched, preserving their real attendance
 * history).
 *
 * `data`/`reloadDetail` (this file's own local state, kept in sync with
 * every successful `loadState` via a `useEffect`) is the mechanism that lets
 * this page reload/optimistically-mutate its own already-successfully-
 * loaded data in place, without re-triggering the top-level `loading`
 * DES-12 state -- same reasoning `OutreachList.tsx`'s own T101
 * `overrideData`/`reloadOutreachData` seam already established for the
 * identical architectural reason (this page's own single top-level
 * `loadState`, unchanged by this task, needed this narrower seam instead of
 * a larger `CoachMeetingsView`/`StudentMeetingsView`-style restructuring).
 *
 * -----------------------------------------------------------------------
 * 11. T117 (PRD v2 UXP-01): coach-managed attendance panel, staff-only
 *     (Known Context/Traps #5).
 *
 * This page previously had NO role derivation of its own (every prior
 * section rendered identically regardless of viewer role). `useAuth()`
 * (`../../app/guards.tsx`, read-only import, the same auth context
 * `OutreachList.tsx`'s own T101 module doc #6 already wired) is now called
 * unconditionally (React's rules-of-hooks, same posture
 * `OutreachList.tsx`'s own `useActiveSeason()` call already established),
 * and `isStaffViewer` uses the identical `user.role === 'coach' || user.role
 * === 'admin'` check `OutreachList.tsx`'s own `isCoachOrAdminView` already
 * established (that file's own module doc #6 -- only the two role literals
 * present in `guards.tsx`'s `Role` union are compared directly; a real
 * `'student'`/`'parent'` viewer, or nobody signed in at all (`user ===
 * null`), falls through to `false`). `<AttendancePanel>` (new this task) is
 * rendered ONLY when `isStaffViewer` -- a non-staff viewer sees this page
 * completely unchanged from before this task, grep-provable: the
 * `<AttendancePanel>` JSX is inside a single `isStaffViewer &&` guard, no
 * other branch references it. `roster`/`sessions`/`teams` (already computed
 * above for the Signups section) are passed straight through -- structurally
 * compatible with `AttendancePanel.tsx`'s own independently-reimplemented
 * `AttendancePanelSession`/`AttendancePanelStudent`/`AttendancePanelTeam`
 * types (that file's own module doc #1 explains why they are reimplemented
 * rather than imported from here: this file imports `AttendancePanel`, so
 * the reverse import would be circular), so no reshaping happens at this
 * call site. `currentUserProfileId={user.id}` -- `guards.tsx`'s own
 * `resolveSessionToAuthState` sets `AuthUser.id = session.user.id`, and
 * `public.profiles.id` (migration `20260716000000_identity_roster.sql` line
 * 17) is `references auth.users (id)` as its OWN primary key (not a
 * separate column) -- i.e. `profiles.id` and the signed-in `auth.users.id`
 * are the SAME value, so the signed-in coach's `user.id` IS their real
 * `profiles.id`, correctly attributable to `attendance.recorded_by` with no
 * separate lookup needed (unlike `students.id` vs. `students.profile_id`,
 * a genuinely different id space `RsvpControl.tsx`'s own module doc #3
 * already had to disclose).
 *
 * -----------------------------------------------------------------------
 * 12. T127 (PRD v2 UXP-07): "Mark event complete" bulk action, staff-only,
 *     on this page and only this page (packet Objective, verbatim).
 *
 * `isMarkEventCompleteDialogOpen` drives the one rendered
 * `<MarkEventCompleteDialog>` instance (`./MarkEventCompleteDialog.tsx`,
 * this task's own new sibling file -- see that file's own module doc for
 * the full reuse-evidence/partial-failure design writeup). The trigger is a
 * new `"Mark event complete"` `MoreMenu` item, pushed onto `menuItems`
 * ONLY when `isStaffViewer` (module doc #11's own role check, reused
 * unchanged) -- a non-staff viewer's `MoreMenu` is unaffected, grep-provable:
 * the push is inside a single `if (isStaffViewer)` guard, no other branch
 * references this item. `sessions`/`roster`/`rsvps` (already computed above
 * for the Signups section / `AttendancePanel`) are passed straight through
 * -- `MarkEventCompleteDialog` accepts the SAME `MarkDayCompleteSession`/
 * `RosterStudent`/`RsvpRow` shapes `MarkDayCompleteDialog.tsx` already
 * defines (imported by that file, not reshaped here), and this page's own
 * `OutreachDetailSession`/`RosterStudent`/`RsvpRow` types (module doc #1)
 * are structurally identical field-for-field, so no cast/remap is needed at
 * this call site (grep-provable: no `as unknown as`/manual field-mapping
 * function introduced for this wiring). `onFinished={reloadDetail}` is the
 * partial-failure-honesty seam (that dialog's own module doc #3): once the
 * bulk batch finishes (fully or partially), this page refetches its own
 * data so the Signups/`AttendancePanel` sections reflect the real
 * `event_sessions.status`/`people_reached`/`attendance` writes, never a
 * client-only optimistic guess.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertDialog,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  Link,
  List,
  ListItem,
  MetadataList,
  MetadataListItem,
  MoreMenu,
  Skeleton,
  Text,
  Toast,
  VisuallyHidden,
  VStack,
  type DropdownMenuOption,
} from '@astryxdesign/core';
import { isSupabaseLoaderError } from '../../lib/supabase';
// T117 (PRD v2 UXP-01): role-derivation seam -- module doc #11. Read-only
// import, same shared auth context `OutreachList.tsx`'s own T101 wiring
// already uses.
import { useAuth } from '../../app/guards';
// T101 (ED-1 Packet P10): real load/edit/cancel wiring -- module doc #10.
// `saveOutreachEvent`/`cancelOutreachEvent`/`OutreachEventDialog` are this
// task's own wiring of an ALREADY-BUILT, ALREADY-PASSED standalone dialog
// into this page for the first time; nothing inside `OutreachEventDialog.tsx`
// itself is modified (forbidden/read-only file).
import {
  cancelOutreachEvent,
  loadOutreachDetail,
  loadOutreachEventRoster,
  saveOutreachEvent,
  type LoadOutreachEventRosterFn,
} from '../../lib/supabase/loaders/outreach';
import {
  OutreachEventDialog,
  type ExistingOutreachEvent,
  type OnSaveOutreachEventFn,
  type OutreachRosterStudent,
} from './OutreachEventDialog';
// T117 (PRD v2 UXP-01): the new coach-managed attendance panel -- module
// doc #11.
import { AttendancePanel } from './AttendancePanel';
// T127 (PRD v2 UXP-07): "Mark event complete" bulk action -- module doc #12.
// Not given its own injectable override prop here, same posture
// `AttendancePanel` above already established (module doc #11): the dialog's
// own `onMarkSessionComplete` prop already defaults to the real
// `markDayComplete` mutation internally.
import { MarkEventCompleteDialog } from './MarkEventCompleteDialog';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

export interface TeamOption {
  id: string;
  name: string;
}

export interface ProfileOption {
  id: string;
  name: string;
}

export interface RosterStudent {
  id: string;
  name: string;
  teamId: string;
}

export interface OutreachDetailEvent {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  description: string;
  locationName: string;
  address: string;
  /** `null` = all teams (matches `events.team_ids` NULL semantics, module
   * doc #1/#3). */
  teamIds: string[] | null;
  /** `events.created_by` is a nullable `profiles` FK (module doc #1). */
  createdBy: string | null;
  /** T101 (module doc #10) -- four real `events` columns this type did not
   * previously carry, added specifically so `buildInitialOutreachEvent`
   * below can pre-fill a real edit-mode `OutreachEventDialog` without
   * inventing values. Same "page-local type grows one new field for a real
   * need" precedent `loaders/students.ts`'s own module doc already
   * established for `StudentsTab.tsx`'s local `TeamRow.archived`. */
  countsParticipation: boolean;
  countsVolunteerHours: boolean;
  adultVolunteersCount: number;
  adultVolunteerHours: number;
}

export interface OutreachDetailSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
  notes: string;
}

export interface RsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface OutreachDetailData {
  event: OutreachDetailEvent;
  sessions: readonly OutreachDetailSession[];
  rsvps: readonly RsvpRow[];
  students: readonly RosterStudent[];
  teams: readonly TeamOption[];
  profiles: readonly ProfileOption[];
}

/**
 * `null` = "not found / inaccessible" -- the designed DES-12/NAV-08 signal
 * (module doc #5). Distinct from a REJECTED promise, which represents a
 * transient fetch failure, not an invalid/inaccessible id.
 */
export type LoadOutreachDetailFn = (eventId: string) => Promise<OutreachDetailData | null>;

export interface SessionSignupGroups {
  going: RosterStudent[];
  maybe: RosterStudent[];
  cantGo: RosterStudent[];
  noResponse: RosterStudent[];
}

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #7.
// ---------------------------------------------------------------------------

const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

const FIXTURE_TEAMS: readonly TeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];

const FIXTURE_PROFILES: readonly ProfileOption[] = [
  { id: 'profile-coach-owens', name: 'Jordan Owens' },
];

const FIXTURE_STUDENTS: readonly RosterStudent[] = [
  { id: 'student-amara-chen', name: 'Amara Chen', teamId: 'team-ravens' },
  { id: 'student-marcus-bello', name: 'Marcus Bello', teamId: 'team-ravens' },
  { id: 'student-nina-ortiz', name: 'Nina Ortiz', teamId: 'team-ravens' },
  { id: 'student-sofia-delgado', name: 'Sofia Delgado', teamId: 'team-titans' },
  { id: 'student-ravi-kapoor', name: 'Ravi Kapoor', teamId: 'team-titans' },
];

const FIXTURE_EVENTS: readonly OutreachDetailEvent[] = [
  {
    id: 'event-food-bank-sort',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Food Bank Sort',
    description: 'Sorting and packing donated groceries for weekend distribution.',
    locationName: 'Riverside Food Bank',
    // Deliberately contains a space, comma, and "#" -- module doc #6's own
    // URL-encoding proof needs real special characters to be meaningful.
    address: '100 Riverside Dr, Suite #4',
    teamIds: null, // all teams
    createdBy: 'profile-coach-owens',
    // T101 -- CMP-02's real outreach defaults (matches
    // `OutreachEventDialog.tsx`'s own `OUTREACH_FIXED_FLAGS`).
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 4,
    adultVolunteerHours: 12,
  },
  {
    id: 'event-park-cleanup',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Riverside Park Cleanup',
    description: 'Litter pickup and trail maintenance along the riverside path.',
    locationName: 'Riverside Park',
    address: '250 Parkway Ave',
    teamIds: ['team-ravens'], // module doc #3 -- team-scoped roster proof.
    createdBy: null, // module doc's "Unknown creator" fallback proof.
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
  },
];

const FIXTURE_SESSIONS: readonly OutreachDetailSession[] = [
  {
    id: 'session-food-bank-day1',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-08-02',
    startsAt: '2026-08-02T14:00:00.000Z', // 9:00 AM America/Chicago (CDT)
    endsAt: '2026-08-02T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
  {
    id: 'session-food-bank-day2',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-08-09',
    startsAt: '2026-08-09T14:00:00.000Z',
    endsAt: '2026-08-09T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
  {
    id: 'session-park-cleanup',
    eventId: 'event-park-cleanup',
    sessionDate: '2026-07-26',
    startsAt: '2026-07-26T15:00:00.000Z', // 10:00 AM America/Chicago
    endsAt: '2026-07-26T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
];

const FIXTURE_RSVPS: readonly RsvpRow[] = [
  // session-food-bank-day1 -- all four buckets deliberately present
  // (roster = all 5 students, event.teamIds is null).
  {
    id: 'rsvp-1',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-amara-chen',
    status: 'going',
    respondedBy: 'student-amara-chen',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'rsvp-2',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-marcus-bello',
    status: 'maybe',
    respondedBy: 'student-marcus-bello',
    updatedAt: '2026-07-20T09:05:00.000Z',
    createdAt: '2026-07-20T09:05:00.000Z',
  },
  {
    id: 'rsvp-3',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-sofia-delgado',
    status: 'declined',
    respondedBy: 'student-sofia-delgado',
    updatedAt: '2026-07-20T09:10:00.000Z',
    createdAt: '2026-07-20T09:10:00.000Z',
  },
  // Nina Ortiz + Ravi Kapoor deliberately have NO rsvp row for this session
  // -- the derived "No response" case (module doc #2).

  // session-food-bank-day2 -- a different mix (per-session grouping proof,
  // module doc #4): both Maybe and Can't go are empty here.
  {
    id: 'rsvp-4',
    sessionId: 'session-food-bank-day2',
    studentId: 'student-nina-ortiz',
    status: 'going',
    respondedBy: 'student-nina-ortiz',
    updatedAt: '2026-07-21T09:00:00.000Z',
    createdAt: '2026-07-21T09:00:00.000Z',
  },
  {
    id: 'rsvp-5',
    sessionId: 'session-food-bank-day2',
    studentId: 'student-ravi-kapoor',
    status: 'going',
    respondedBy: 'student-ravi-kapoor',
    updatedAt: '2026-07-21T09:05:00.000Z',
    createdAt: '2026-07-21T09:05:00.000Z',
  },
  // Amara, Marcus, Sofia deliberately unanswered for day2.

  // session-park-cleanup -- team-scoped roster (event.teamIds = ['team-ravens']
  // -- Sofia/Ravi, both Titans, are OUTSIDE this roster entirely).
  {
    id: 'rsvp-6',
    sessionId: 'session-park-cleanup',
    studentId: 'student-amara-chen',
    status: 'going',
    respondedBy: 'student-amara-chen',
    updatedAt: '2026-07-18T09:00:00.000Z',
    createdAt: '2026-07-18T09:00:00.000Z',
  },
  {
    id: 'rsvp-7',
    sessionId: 'session-park-cleanup',
    studentId: 'student-nina-ortiz',
    status: 'declined',
    respondedBy: 'student-nina-ortiz',
    updatedAt: '2026-07-18T09:05:00.000Z',
    createdAt: '2026-07-18T09:05:00.000Z',
  },
  // Marcus Bello (Ravens) has no rsvp row for this session -- "No response".
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#4/#5/#6.
// ---------------------------------------------------------------------------

/** Module doc #3 -- `events.team_ids` NULL/array roster resolution. */
export function resolveEventRoster(
  event: OutreachDetailEvent,
  students: readonly RosterStudent[],
): RosterStudent[] {
  if (event.teamIds === null) return [...students];
  const teamIdSet = new Set(event.teamIds);
  return students.filter((student) => teamIdSet.has(student.teamId));
}

/**
 * THE CENTRAL TRAP (module doc #2) -- the ONE place the four signup buckets
 * are computed, per SESSION (module doc #4), by diffing `roster` against
 * whichever `rsvps` rows actually exist for `sessionId`. "No response" is
 * derived, never a fabricated fourth stored status.
 */
export function groupSessionSignups(
  sessionId: string,
  roster: readonly RosterStudent[],
  rsvps: readonly RsvpRow[],
): SessionSignupGroups {
  const rsvpByStudentId = new Map(
    rsvps
      .filter((rsvp) => rsvp.sessionId === sessionId)
      .map((rsvp) => [rsvp.studentId, rsvp] as const),
  );
  const going: RosterStudent[] = [];
  const maybe: RosterStudent[] = [];
  const cantGo: RosterStudent[] = [];
  const noResponse: RosterStudent[] = [];
  for (const student of roster) {
    const rsvp = rsvpByStudentId.get(student.id);
    if (rsvp === undefined) {
      noResponse.push(student); // Diffed, not a stored value (module doc #2).
      continue;
    }
    if (rsvp.status === 'going') going.push(student);
    else if (rsvp.status === 'maybe') maybe.push(student);
    else cantGo.push(student); // 'declined' -- OUT-04's "Can't go" bucket.
  }
  return { going, maybe, cantGo, noResponse };
}

export function sortSessionsByStart(
  sessions: readonly OutreachDetailSession[],
): OutreachDetailSession[] {
  return [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** "When" `MetadataListItem` value -- a compact summary across every
 * session (the per-session date/time detail itself lives in each
 * `SessionSignupList` heading, module doc #4). */
export function formatWhenSummary(sessions: readonly OutreachDetailSession[]): string {
  if (sessions.length === 0) return 'No sessions scheduled yet.';
  const sorted = sortSessionsByStart(sessions);
  if (sorted.length === 1) return formatSessionDateTime(sorted[0]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${sorted.length} sessions, ${formatSessionDateOnly(first)} – ${formatSessionDateOnly(last)}`;
}

/** "Scope" `MetadataListItem` value -- `events.team_ids` NULL/array
 * semantics (module doc #1/#3), rendered as team names, not raw ids. */
export function formatScopeLabel(
  teamIds: readonly string[] | null,
  teams: readonly TeamOption[],
): string {
  if (teamIds === null) return 'All teams';
  const names = teamIds
    .map((id) => teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  return names.length > 0 ? names.join(', ') : 'No teams';
}

/** "Created by" `MetadataListItem` value -- `events.created_by` is
 * NULLABLE (module doc #1), and a non-null id may not resolve against the
 * fixture/real profile set either; both cases fall back to the same
 * generic, honest label (never a blank/undefined render). */
export function resolveCreatorName(
  createdBy: string | null,
  profiles: readonly ProfileOption[],
): string {
  if (createdBy === null) return 'Unknown creator';
  return profiles.find((profile) => profile.id === createdBy)?.name ?? 'Unknown creator';
}

/** Module doc #6 -- a PLAIN Google Maps URL built from the address, not an
 * embedded map/iframe/SDK integration. `encodeURIComponent` handles every
 * special character (spaces, commas, "#", etc.) the fixture address
 * deliberately exercises. */
export function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Module doc #6 -- the ONE place the copied "Copy link" URL string is
 * built: the real `/outreach/:eventId` route this page is mounted at, with
 * the real event id interpolated. */
export function buildOutreachDetailUrl(eventId: string, origin: string): string {
  return `${origin}/outreach/${eventId}`;
}

/** Module doc #6/#7 -- a thin, directly-testable wrapper around the real
 * (when present) `navigator.clipboard.writeText` Web API. Silently
 * absorbed when the API is unavailable (e.g. an insecure context, or this
 * project's own `jsdom` test environment when not explicitly mocked) --
 * the "Link copied" `Toast` fires regardless (module doc #6), since the
 * constructed URL/toast are this component's own, fully-provable
 * responsibility, independent of whether the OS clipboard write itself
 * succeeds in any given browser/environment. */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (module doc #5/#7).
// ---------------------------------------------------------------------------

export async function defaultLoadOutreachDetail(
  eventId: string,
): Promise<OutreachDetailData | null> {
  const event = FIXTURE_EVENTS.find((candidate) => candidate.id === eventId);
  if (event === undefined) return null; // Module doc #5 -- DES-12/NAV-08 signal.
  return {
    event,
    sessions: FIXTURE_SESSIONS.filter((session) => session.eventId === eventId),
    rsvps: FIXTURE_RSVPS,
    students: FIXTURE_STUDENTS,
    teams: FIXTURE_TEAMS,
    profiles: FIXTURE_PROFILES,
  };
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `OutreachList.tsx`/`RsvpControl.tsx` are not in this task's Allowed Files.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

const CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CHICAGO_TIME_ZONE,
});

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

export function formatSessionDateOnly(session: OutreachDetailSession): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
}

export function formatSessionDateTime(session: OutreachDetailSession): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${formatSessionDateOnly(session)} · ${startText}–${endText}`;
}

/** T101 (module doc #10) -- `starts_at`/`ends_at` (UTC) -> zero-padded
 * `"HH:MM"` Chicago wall-clock time, the exact shape
 * `OutreachEventDialog.tsx`'s own `ExistingOutreachEventSession.startTime`/
 * `endTime` (and `createISOTimeString`) expect. `formatToParts` (not a plain
 * locale-formatted string) is used deliberately -- the same defensive
 * pattern `OutreachEventDialog.tsx`'s own `getTimeZoneOffsetMinutes` already
 * established -- so this never depends on `en-US`'s exact separator/spacing
 * conventions for a 24-hour clock. */
const CHICAGO_24H_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: CHICAGO_TIME_ZONE,
});

export function formatChicagoWallTime(isoDateTime: string): string {
  const parts = CHICAGO_24H_TIME_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/**
 * T121 item (b) (UXP-04 outreach half) -- distinct student ids with an
 * existing `status='going'` RSVP on ANY of the given sessions. The ONE
 * place this page derives the "Expected attendees" checklist prefill from
 * real RSVP rows it already loads (this page's own `rsvps`, already fetched
 * by `loadOutreachDetail` -- no new query). Not scoped to still-`scheduled`
 * sessions only -- the packet's own wording is "the event's existing
 * 'going' RSVPs", unqualified by session status, matching
 * `OutreachList.tsx`'s own identical `deriveExpectedStudentIds` (that
 * file's own Allowed Files, independently reimplemented here per this
 * module's own "not imported across `OutreachList.tsx`/`OutreachDetail.tsx`"
 * convention, module doc #1).
 */
export function deriveExpectedStudentIds(
  sessions: readonly OutreachDetailSession[],
  rsvps: readonly RsvpRow[],
): string[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const ids = new Set<string>();
  for (const rsvp of rsvps) {
    if (rsvp.status === 'going' && sessionIds.has(rsvp.sessionId)) ids.add(rsvp.studentId);
  }
  return [...ids];
}

/** T101 (module doc #10, Trap #5) -- the ONE place a real fetched
 * `OutreachDetailEvent`/`OutreachDetailSession[]` pair is reshaped into
 * `OutreachEventDialog.tsx`'s own real `ExistingOutreachEvent` edit-mode
 * shape. T121 item (b) UPDATE: now also takes this event's own `rsvps` so
 * `expectedStudentIds` can be prefilled from real data instead of being left
 * `undefined` (which the dialog treats as "prefill an empty checklist" --
 * honest for a brand-new event, but wrong for an event students have
 * already RSVP'd to). */
export function buildInitialOutreachEvent(
  event: OutreachDetailEvent,
  sessions: readonly OutreachDetailSession[],
  rsvps: readonly RsvpRow[],
): ExistingOutreachEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    locationName: event.locationName,
    address: event.address,
    // `OutreachEventDialog.tsx`'s own type Selector only ever offers
    // 'outreach'/'competition' (that file's own module doc #1 -- 'meeting'
    // is deliberately excluded there). This route is only ever navigated to
    // for a real outreach/competition event in practice; any other real
    // `events.type` value collapses to 'outreach' here, a disclosed,
    // defensible fallback rather than a crash.
    type: event.type === 'competition' ? 'competition' : 'outreach',
    countsParticipation: event.countsParticipation,
    countsVolunteerHours: event.countsVolunteerHours,
    teamIds: event.teamIds,
    adultVolunteersCount: event.adultVolunteersCount,
    adultVolunteerHours: event.adultVolunteerHours,
    // No backing `events` column exists for this UI-only field
    // (`OutreachEventDialog.tsx`'s own module doc #7) -- defaults to `true`
    // (that dialog's own "on by default" semantics) since the event's
    // actual prior value can never be known. Disclosed, not fabricated as a
    // real fetched value.
    shareToCalendarFeed: true,
    sessions: sessions.map((session) => ({
      sessionDate: session.sessionDate,
      startTime: formatChicagoWallTime(session.startsAt),
      endTime: formatChicagoWallTime(session.endsAt),
      peopleReached: session.peopleReached,
    })),
    expectedStudentIds: deriveExpectedStudentIds(sessions, rsvps),
  };
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- extended with a `notFound` bucket
// (module doc #5) beyond the loading/error/success trio every sibling page
// in this batch already established.
// ---------------------------------------------------------------------------

type DetailLoadState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'notFound' }
  | { status: 'success'; data: OutreachDetailData };

function useOutreachDetailLoadState(
  loadData: LoadOutreachDetailFn,
  eventId: string,
): DetailLoadState {
  const [state, setState] = useState<DetailLoadState>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing `loadData`/`eventId` deps semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    loadData(eventId)
      .then((result) => {
        if (!isMounted) return;
        setState(result === null ? { status: 'notFound' } : { status: 'success', data: result });
      })
      .catch(() => {
        if (isMounted) {
          setState({ status: 'error', retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [loadData, eventId, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Presentational subcomponents -- module doc #4.
// ---------------------------------------------------------------------------

function SignupBucket({
  label,
  students,
}: {
  label: string;
  students: readonly RosterStudent[];
}): ReactNode {
  return (
    <VStack gap={1}>
      <Text type="supporting">
        {label} ({students.length})
      </Text>
      {students.length === 0 ? (
        <Text type="supporting" color="secondary">
          No students
        </Text>
      ) : (
        <List hasDividers>
          {students.map((student) => (
            <ListItem key={student.id} label={student.name} />
          ))}
        </List>
      )}
    </VStack>
  );
}

function SessionSignupList({
  session,
  roster,
  rsvps,
}: {
  session: OutreachDetailSession;
  roster: readonly RosterStudent[];
  rsvps: readonly RsvpRow[];
}): ReactNode {
  const groups = useMemo(
    () => groupSessionSignups(session.id, roster, rsvps),
    [session.id, roster, rsvps],
  );

  return (
    <VStack gap={3}>
      <Heading level={3}>
        {formatSessionDateTime(session)}
        {session.status !== 'scheduled' ? ` — ${session.status}` : ''}
      </Heading>
      <HStack gap={5} wrap="wrap">
        <SignupBucket label="Going" students={groups.going} />
        <SignupBucket label="Maybe" students={groups.maybe} />
        <SignupBucket label="Can't go" students={groups.cantGo} />
        <SignupBucket label="No response" students={groups.noResponse} />
      </HStack>
    </VStack>
  );
}

/** T101 (module doc #10) -- real success/error messaging for Edit and
 * Cancel, same "success Banner + error Banner, dismissable" pattern
 * `MeetingsList.tsx`'s own `FeedbackBanner` (T096) already established. */
interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Component. Module docs #5/#6/#8/#10.
// ---------------------------------------------------------------------------

export interface OutreachDetailProps {
  /** Overrides the `:eventId` route param -- primarily for direct testing
   * (mirrors `LiveConsoleBody`'s own `sessionId`-via-`useParams` +
   * prop-override precedent). Falls back to `useParams<{ eventId: string }>()`
   * when omitted -- this page is NOT wired into `router.tsx` by this task
   * (Forbidden Files), so `useParams` only resolves when a test/future
   * caller renders this component inside an actually-matched route. */
  eventId?: string;
  /** Injectable data-loading seam (module doc #7). T101: defaults to a real
   * query (`loadOutreachDetail`, `../../lib/supabase/loaders/outreach.ts`);
   * `defaultLoadOutreachDetail` (fixture) remains exported for callers/tests
   * that want to inject it explicitly. `null` = not found/inaccessible
   * (module doc #5). */
  loadData?: LoadOutreachDetailFn;
  /** T101 (module doc #10). Defaults to a real `events`/`event_sessions`
   * insert/update, passed straight through to `<OutreachEventDialog
   * onSaveEvent={...} />` in EDIT mode. */
  onSaveEvent?: OnSaveOutreachEventFn;
  /** T101 (module doc #10, Trap #4). Defaults to a real, event-level
   * `event_sessions.status = 'canceled'` mutation. */
  onCancelEvent?: (eventId: string) => Promise<void>;
  /** T121 item (a) (UXP-04 outreach half) -- real roster loader default
   * (T118's `loadOutreachEventRoster`, previously built/tested but
   * unconsumed by any page), wired into this page's own edit-mode
   * `OutreachEventDialog` `students` prop, replacing that dialog's own
   * `DEFAULT_STUDENTS` fixture fallback. */
  loadRoster?: LoadOutreachEventRosterFn;
}

export function OutreachDetail({
  eventId: eventIdProp,
  loadData = loadOutreachDetail,
  onSaveEvent = saveOutreachEvent,
  onCancelEvent = cancelOutreachEvent,
  loadRoster = loadOutreachEventRoster,
}: OutreachDetailProps = {}): ReactNode {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const eventId = eventIdProp ?? routeEventId ?? '';

  // T117 (module doc #11) -- called unconditionally (rules of hooks), same
  // posture `OutreachList.tsx`'s own `useActiveSeason()` call already
  // established for this exact reason.
  const { user } = useAuth();

  const loadState = useOutreachDetailLoadState(loadData, eventId);
  // T101 (module doc #10) -- kept in sync with every successful `loadState`
  // (effect below), so a post-edit reload / a post-cancel optimistic flip
  // can be reflected immediately without re-triggering the top-level
  // `loading` DES-12 state.
  const [data, setData] = useState<OutreachDetailData | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  // T101 (module doc #10) -- drives the one rendered
  // `<OutreachEventDialog>` instance, in EDIT mode (Trap #5: that dialog
  // genuinely supports editing an existing event, unlike T096's
  // `ScheduleMeetingsDialog.tsx` finding).
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  // T127 (module doc #12) -- drives the one rendered
  // `<MarkEventCompleteDialog>` instance.
  const [isMarkEventCompleteDialogOpen, setIsMarkEventCompleteDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  // T121 item (a) -- best-effort roster fetch for the edit-mode dialog's
  // "Expected attendees" checklist. Deliberately named `eventDialogRoster`,
  // NOT `roster` -- this component's own pre-existing `roster` local
  // (module doc #3's `resolveEventRoster(event, students)`, further below)
  // is a DIFFERENT, team-scoped `RosterStudent[]` shape used for the
  // Going/Maybe/Can't-go/No-response signup buckets and `AttendancePanel`;
  // this is `OutreachEventDialog`'s own unrelated `OutreachRosterStudent[]`
  // checklist shape (T118). A rejection (e.g. Supabase isn't configured in
  // this environment/test) leaves `eventDialogRoster` at its initial
  // `undefined`, so `OutreachEventDialog` falls back to its own
  // `DEFAULT_STUDENTS` fixture -- never a broken edit flow.
  const [eventDialogRoster, setEventDialogRoster] = useState<
    readonly OutreachRosterStudent[] | undefined
  >(undefined);

  useEffect(() => {
    if (loadState.status === 'success') {
      setData(loadState.data);
    }
  }, [loadState]);

  useEffect(() => {
    let isMounted = true;
    loadRoster()
      .then((rosterData) => {
        if (isMounted) setEventDialogRoster(rosterData);
      })
      .catch(() => {
        // Disclosed soft-fail -- see the `eventDialogRoster` state doc above.
      });
    return () => {
      isMounted = false;
    };
  }, [loadRoster]);

  async function reloadDetail(): Promise<void> {
    const fresh = await loadData(eventId);
    setData(fresh);
  }

  function openEditDialog(): void {
    setIsEventDialogOpen(true);
  }

  function openCancelConfirm(): void {
    setIsCancelConfirmOpen(true);
  }

  // T127 (module doc #12).
  function openMarkEventCompleteDialog(): void {
    setIsMarkEventCompleteDialogOpen(true);
  }

  // T101 (module doc #10, Trap #5) -- real `onSaveEvent` wiring (edit mode).
  // Reloads this page's own data via `reloadDetail()` on success (a full
  // reload, not a client-side merge -- same reasoning `MeetingsList.tsx`'s
  // own T096 `handleCreateMeetingsSubmit` already established, since
  // recomputing this page's own derived fields -- roster/signup groupings --
  // client-side would duplicate the loader's own DB-driven joins for no
  // benefit).
  async function handleSaveEventSubmit(
    payload: Parameters<OnSaveOutreachEventFn>[0],
  ): Promise<void> {
    await onSaveEvent(payload);
    try {
      await reloadDetail();
      setFeedback({
        status: 'success',
        title: 'Event updated',
        description: `"${payload.event.title}" was updated.`,
      });
    } catch {
      // The save itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal.
      setFeedback({
        status: 'success',
        title: 'Event updated',
        description: `"${payload.event.title}" was updated. Refresh the page to see the changes.`,
      });
    }
  }

  // T101 (module doc #10, Trap #4) -- real, event-level cancel mutation,
  // optimistic update + rollback on failure, mirroring `MeetingsList.tsx`'s
  // own `handleConfirmCancel` (T096) shape.
  async function handleConfirmCancel(): Promise<void> {
    if (data === null) return;
    const target = data;
    const optimisticSessions = target.sessions.map((session) =>
      session.status === 'scheduled' ? { ...session, status: 'canceled' as const } : session,
    );
    setData({ ...target, sessions: optimisticSessions });
    setIsCancelConfirmOpen(false);
    try {
      await onCancelEvent(target.event.id);
      setFeedback({
        status: 'success',
        title: 'Event canceled',
        description: `"${target.event.title}"'s remaining scheduled sessions are marked canceled. Already-completed sessions are untouched.`,
      });
    } catch (error) {
      setData(target); // rollback
      setFeedback({
        status: 'error',
        title: "Couldn't cancel event",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong canceling "${target.event.title}". Try again in a moment.`,
      });
    }
  }

  function handleCopyLink(): void {
    if (loadState.status !== 'success') return;
    const current = data ?? loadState.data;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = buildOutreachDetailUrl(current.event.id, origin);
    setCopiedUrl(url);
    copyTextToClipboard(url).catch(() => {
      // Best-effort only -- module doc #6: no OS-level clipboard write can
      // be proven in this test environment; the Toast still fires above
      // regardless of whether this resolves or rejects.
    });
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={6} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading event…
        </VisuallyHidden>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Skeleton width={260} height={28} index={0} />
          <Skeleton width={100} height={32} index={1} />
        </HStack>
        <VStack gap={2}>
          {['When', 'Where', 'Scope', 'Created by'].map((label, index) => (
            <HStack key={label} gap={4} vAlign="center">
              <Skeleton width={80} height={14} index={index * 2 + 2} />
              <Skeleton width={220} height={14} index={index * 2 + 3} />
            </HStack>
          ))}
        </VStack>
        <VStack gap={3}>
          <Skeleton width={100} height={22} index={10} />
          <Skeleton width="100%" height={80} index={11} />
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load this event"
          description="Something went wrong loading this outreach event. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  if (loadState.status === 'notFound') {
    // Module doc #5 -- DES-12/NAV-08 "reveal nothing" state: no
    // MetadataList, no signup lists, no other event data anywhere in this
    // render, grep/test-provable against this exact branch.
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="This outreach event isn't available"
          description="It may have been removed, or you may not have access to it."
        />
      </VStack>
    );
  }

  // T101 (module doc #10) -- `data` (kept in sync by the effect above) is
  // preferred when present so a post-edit reload / post-cancel optimistic
  // flip is reflected immediately; falls back to `loadState.data`
  // defensively for the very first successful render (before the effect has
  // committed).
  const detailData = data ?? loadState.data;
  const { event, sessions, rsvps, students, teams, profiles } = detailData;
  const roster = resolveEventRoster(event, students);
  const orderedSessions = sortSessionsByStart(sessions);
  // T117 (module doc #11) -- staff-only gate for the new attendance panel;
  // every other branch/section on this page is unchanged for a non-staff
  // viewer.
  const isStaffViewer = user !== null && (user.role === 'coach' || user.role === 'admin');
  const menuItems: DropdownMenuOption[] = [
    { label: 'Edit', onClick: openEditDialog },
    { label: 'Cancel event', onClick: openCancelConfirm },
  ];
  // T127 (module doc #12) -- staff-only, this page only (packet Objective).
  if (isStaffViewer) {
    menuItems.push({ label: 'Mark event complete', onClick: openMarkEventCompleteDialog });
  }

  return (
    <VStack gap={6} padding={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>{event.title}</Heading>
        <HStack gap={2} vAlign="center">
          <Button label="Copy link" variant="secondary" onClick={handleCopyLink} />
          <MoreMenu items={menuItems} label={`Actions for ${event.title}`} />
        </HStack>
      </HStack>

      {event.description !== '' && <Text type="supporting">{event.description}</Text>}

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      {copiedUrl !== null && (
        <Toast
          type="info"
          body="Link copied"
          isAutoHide
          autoHideDuration={3000}
          onDismiss={() => setCopiedUrl(null)}
        />
      )}

      <MetadataList columns="single" title="Event details">
        <MetadataListItem label="When">{formatWhenSummary(sessions)}</MetadataListItem>
        <MetadataListItem label="Where">
          <VStack gap={1}>
            <Text type="body">{event.locationName}</Text>
            <Text type="supporting" color="secondary">
              {event.address}
            </Text>
            <Link href={buildGoogleMapsUrl(event.address)} isExternalLink isStandalone>
              Open in Google Maps
            </Link>
          </VStack>
        </MetadataListItem>
        <MetadataListItem label="Scope">{formatScopeLabel(event.teamIds, teams)}</MetadataListItem>
        <MetadataListItem label="Created by">
          {resolveCreatorName(event.createdBy, profiles)}
        </MetadataListItem>
      </MetadataList>

      <VStack gap={5}>
        <Heading level={2}>Signups</Heading>
        {orderedSessions.length === 0 ? (
          <Text type="supporting">No sessions scheduled yet.</Text>
        ) : (
          orderedSessions.map((session) => (
            <SessionSignupList key={session.id} session={session} roster={roster} rsvps={rsvps} />
          ))
        )}
      </VStack>

      {/* T117 (module doc #11) -- staff-only, UXD-06 spacious page-level
          section (not a modal). Non-staff viewers see this page exactly as
          before this task -- no branch below this guard ever renders for
          them. */}
      {isStaffViewer && user !== null && (
        <AttendancePanel
          sessions={sessions}
          roster={roster}
          teams={teams}
          currentUserProfileId={user.id}
        />
      )}

      {/* T127 (module doc #12) -- "Mark event complete" bulk action,
          staff-only trigger (the `MoreMenu` item above), same
          `sessions`/`roster`/`rsvps` this page already fetched/derived for
          the Signups section, no reshaping needed (module doc #12). */}
      <MarkEventCompleteDialog
        isOpen={isMarkEventCompleteDialogOpen}
        onOpenChange={setIsMarkEventCompleteDialogOpen}
        eventTitle={event.title}
        sessions={sessions}
        roster={roster}
        rsvps={rsvps}
        currentUserProfileId={user?.id}
        onFinished={() => {
          void reloadDetail();
        }}
      />

      <AlertDialog
        isOpen={isCancelConfirmOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setIsCancelConfirmOpen(false);
        }}
        title={`Cancel "${event.title}"?`}
        description="This marks every still-scheduled session for this event canceled. Already-completed sessions are left untouched, and no attendance will be recorded for the canceled ones."
        actionLabel="Cancel event"
        onAction={() => {
          void handleConfirmCancel();
        }}
      />

      {/* T101 (module doc #10, Trap #5) -- `OutreachEventDialog.tsx` (T039,
          already Passed, already built, genuinely supports edit mode) wired
          into this page for the first time, in EDIT mode
          (`initialEvent` pre-fills every field from the real fetched
          event/sessions/rsvps -- `buildInitialOutreachEvent`, T121 item (b)
          UPDATE: now also prefills `expectedStudentIds`). `teams`
          deliberately NOT overridden, same "still fixture-backed" posture
          `OutreachList.tsx`'s own T101 wiring already established for the
          identical reason. T121 item (a): `students`/`currentUserProfileId`
          now wired to the real roster loader / signed-in coach id. */}
      <OutreachEventDialog
        isOpen={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        onSaveEvent={handleSaveEventSubmit}
        initialEvent={buildInitialOutreachEvent(event, sessions, rsvps)}
        students={eventDialogRoster}
        currentUserProfileId={user?.id}
      />
    </VStack>
  );
}

export default OutreachDetail;
