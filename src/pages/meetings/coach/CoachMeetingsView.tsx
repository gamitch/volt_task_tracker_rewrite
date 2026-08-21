/**
 * @file CoachMeetingsView.tsx
 * @position GAM-444 Stage B: the coach/admin `/meetings` view, moved out of
 *   `src/pages/meetings/MeetingsList.tsx` byte-identical (module doc #7/#8/
 *   #9/#10, T135's own Table-migration record -- all travel with this code,
 *   verbatim, per GAM-444 packet §6b's governing rule: "each numbered
 *   section travels with the code it documents"). `MeetingsList.tsx` itself
 *   is now a shell that renders this component when
 *   `isCoachOrAdminView` is true.
 *
 *   `BadgeVariant`, `LoadState<T>`/`useLoadState` are duplicated here AND in
 *   `../student/StudentMeetingsView.tsx` (both files need them; GAM-444's
 *   Allowed Files list has no shared-hook home in scope for this ticket, the
 *   same "copy it" posture `MIN_TOUCH_TARGET_STYLE`/`sessionDetailAnchorId`
 *   below already used against `OutreachList.tsx`). `formatPastAttendanceSummary`/
 *   `SESSION_STATUS_BADGE` are coach-only and live only here;
 *   `ATTENDANCE_STATUS_BADGE` is student-only and lives only in
 *   `../student/StudentMeetingsView.tsx`.
 *
 *   GAM-444 Stage C appends the file-level module doc `MeetingsList.tsx`
 *   carried at its own `:1-506` before this split (packet §6b) directly
 *   below, verbatim and unrenumbered -- it is this file's own numbered
 *   sections `#1/#2/#3/#5/#7/#8/#9/#10` (the coach preamble paragraph plus
 *   `MeetingsList.tsx`'s own title line). Section `#6` (student/parent
 *   `studentId` resolution) and the student preamble paragraph live instead
 *   in `../student/StudentMeetingsView.tsx`'s own doc, alongside the
 *   `ResolvedStudentMeetingsView`/`StudentMeetingsViewContainer` code they
 *   describe. Section `#4` (BEH-08/NFR-09 date formatting) is not
 *   duplicated here -- GAM-443 already moved that formatter code, and its
 *   full doc, to `src/lib/meetings/format.ts`.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  Link,
  Skeleton,
  Table,
  Text,
  VisuallyHidden,
  VStack,
  pixel,
  proportional,
  type TableColumn,
} from '@astryxdesign/core';
import { Link as RouterLink } from 'react-router-dom';
// T511 -- `routePaths` is IMPORT-ONLY here (the route already exists and needs
// no change). `router.tsx` loads every page via `lazy(() => import(...))`, so a
// page importing this back from it is not a cycle -- the same idiom
// `LiveConsole.tsx` and `Kiosk.tsx` already use.
import { routePaths } from '../../../app/router';
import { isSupabaseLoaderError } from '../../../lib/supabase';
// T135 (UXC-02/03/07, T130's proven pattern) -- the shared three-tier stat
// cell (micro-label / value w/ hasTabularNumbers / secondary) extracted by
// T131's wave precisely so this task inherits it. Import only -- Forbidden
// Files bars editing `StatCell.tsx` itself.
import { StatCell } from '../../../components/StatCell';
// T135 -- `useIsNarrowViewport` (and the query constant/subscription it
// implements) was extracted to this shared hook by T132, specifically so
// this task can import it instead of re-implementing the same
// `window.matchMedia` subscription a second time (see that file's own
// module doc). Import only -- Forbidden Files bars editing `src/hooks/**`.
import { useIsNarrowViewport } from '../../../hooks/useIsNarrowViewport';
import {
  isMeetingSessionReconcilable,
  ScheduleMeetingsDialog,
  type CreateMeetingsPayload,
  type EditMeetingSeriesInitialData,
  type OnCreateMeetingsFn,
  type OnSaveMeetingSeriesFn,
  type SaveMeetingSeriesPayload,
} from '../ScheduleMeetingsDialog';
// T605 -- the per-session edit dialog. This file OWNS the mount/wiring; the
// dialog file owns its own payload/fn types, imported here as VALUES (the
// component itself) and TYPES (its own `SaveMeetingSessionPayload`/
// `OnSaveMeetingSessionFn`), mirroring exactly how `ScheduleMeetingsDialog`/
// its own payload types are imported immediately above.
import {
  EditMeetingSessionDialog,
  type EditMeetingSessionInitialData,
  type OnSaveMeetingSessionFn,
  type SaveMeetingSessionPayload,
} from '../EditMeetingSessionDialog';
import {
  formatHoursLabel,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
} from '../../../lib/meetings/format';
import type {
  CancelMeetingSessionFn,
  CoachMeetingRow,
  CoachMeetingRowSummary,
  CoachMeetingSessionDetail,
  CoachMeetingSessionDetailTableRow,
  CoachMeetingTableRow,
  LoadCoachMeetingsDataFn,
  PastAttendanceSummary,
  SessionStatus,
  Team,
} from '../../../lib/meetings/types';
import {
  buildCoachMeetingTableRows,
  partitionCoachMeetingRows,
} from '../../../lib/meetings/coachModel';

/**
 * T030: `/meetings` list page (MTG-01 coach view / MTG-14 student+parent view).
 *
 * Coach (`coach`/`admin`) view: `Section` "Upcoming" / `Section` "Past"
 * `Table`s (T135, UXC-02/03/07 -- see that task's own module doc, below the
 * T122 one, for the full Table-migration record) of **meeting-type** EVENTS
 * only (NAV-07 -- never outreach/competition; one row per recurring-meeting
 * SERIES, not per session -- T122 module doc #10 below), each row showing
 * recurrence chips + a date range (UXD-02 "when"), location (UXD-02 "where",
 * UXP-08), planned/logged hours, expected/attended counts (UXD-02 "how
 * much"/"who"), a row-level "Edit" chip (T135 -- MTG-01's own literal text
 * below, "per-row MoreMenu (Edit, Cancel session)", is a disclosed, written-
 * authorized PRD deviation as of T135, recorded beside MTG-01 in
 * `VOLT_Portal_PRD.md` -- Cancel already left this menu for T122's
 * per-session buttons, below, leaving exactly one item behind a menu) and an
 * in-place expander (UXD-03) revealing every one of the event's own sessions
 * with their own inline Cancel action (DES-11 `AlertDialog`) -- MTG-01's
 * literal text (PRD line 272: "Actions: Schedule meetings, per-row MoreMenu
 * (Edit, Cancel session -- AlertDialog)") plus T122's own density rework
 * (module doc #10).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `event_sessions`/`events`/`attendance` column shapes
 *    (Known Context/Traps #1), cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address, team_ids uuid[] NULL (null = all teams), counts_participation,
 *    counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours,
 *    created_by, created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled' -- Known Context/Traps #5's real
 *    status vocabulary, used verbatim below, never an invented string like
 *    "confirmed"/"active"), people_reached, notes, created_at.
 *
 *    `attendance` (lines 82-95): id, session_id, student_id, status (check:
 *    'present' | 'late' | 'excused' | 'absent'), check_in_at, check_out_at,
 *    hours_override, method, recorded_by, updated_at, created_at.
 *
 *    `FixtureEvent`/`FixtureEventSession`/`FixtureAttendanceRecord` below are
 *    camelCase renames of exactly these columns (only the subset this screen
 *    renders) -- no invented fields, no re-derived RLS.
 *
 * -----------------------------------------------------------------------
 * 2. NAV-07 -- this route must show ONLY meeting sessions, never outreach.
 *
 * `buildCoachMeetingRows`/`buildStudentMeetingsData` below both start with
 * `events.filter((event) => event.type === 'meeting')` -- the ONLY type
 * predicate anywhere in this file gating which sessions ever reach either
 * view's rows. `FIXTURE_EVENTS` deliberately includes one `type: 'outreach'`
 * event (`event-food-drive`) with its own session specifically so this
 * filter is genuinely exercised (grep-provable: no outreach-shaped field/
 * import anywhere in this file's rendered output -- see this task's worker
 * output for the render-time proof that its title never appears).
 *
 * -----------------------------------------------------------------------
 * 3. Known Context/Traps #3 -- participation % sourced from
 *    `v_student_participation`'s real shape, never computed here.
 *
 * `StudentParticipationMetric` below is a verbatim camelCase rename of
 * `v_student_participation`'s seven real columns, cited directly from
 * `supabase/migrations/20260717000003_metric_views.sql` lines 21-42
 * (student_id, team_id, season_id, expected_ct, present_ct, late_ct,
 * excused_ct, participation_pct) -- the exact same shape/citation
 * `ParticipationTab.tsx` (T056) already established for this metric.
 * `FIXTURE_PARTICIPATION_METRICS` below supplies already-computed
 * `participationPct` values (as the view's own SQL would have produced
 * them for the paired expected/present/excused counts); this file performs
 * NO percentage arithmetic anywhere -- grep-provable: no `100.0 *`, no
 * `/ greatest(`, no `presentCt / expectedCt` division of any kind.
 * `PastAttendanceSummary` (the coach view's per-session present/late/
 * excused/absent tally) is a DIFFERENT thing: a plain per-session COUNT
 * (`count(*) filter (where status = 'x')`, mirroring the view's own
 * internal counting step, not its percentage step) -- not a percentage,
 * so constitution item 3 does not bar computing it directly from
 * `FIXTURE_ATTENDANCE` records the same way the view's own `expected` CTE
 * would.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-08 -- every date/duration carries a weekday name and a computed
 *    duration; NFR-09 -- timestamps display in America/Chicago.
 *
 * `formatWeekdayDate` (session_date -> "Sat, Jul 25") and
 * `formatTimeRangeWithDuration` (starts_at/ends_at -> "6:00-8:00 PM - 2h",
 * PRD line 237's own worked example) are the ONLY date-formatting functions
 * used for every Upcoming and Past row in both views -- no row anywhere
 * renders a bare ISO string or an un-computed start/end pair. GAM-443 moved
 * both of them, and the rest of this file's own date/duration formatters,
 * to `src/lib/meetings/format.ts` (a shared home now also imported by
 * `CalendarPage.tsx`); this file re-exports them so this doc's own claim
 * (and every existing importer) stays true. All three `Intl.DateTimeFormat`
 * instances that back them are pinned to `timeZone: 'America/Chicago'` per
 * NFR-09 ("Timestamps stored UTC, displayed America/Chicago"), not the
 * viewer's local browser timezone.
 *
 * -----------------------------------------------------------------------
 * 5. `guards.tsx` `Role` vocabulary gap (same recurring gap `RosterShell.tsx`/
 *    T021 and `ParticipationTab.tsx`/T056 already disclosed) -- resolved by
 *    T073a, not by this task.
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * `admin | coach | student | parent` vocabulary exactly (previously a
 * stale `'admin' | 'staff' | 'volunteer' | 'coach'` placeholder). Since
 * `router.tsx` wires `/meetings` with `RequireAuth` only (no `RequireRole`
 * -- confirmed by reading that file directly; it is a forbidden/read-only
 * file here, and per the worker packet this is CORRECT for this route, not
 * a gap to fix: MTG-01 is a role-*variant* page, not a role-*gated* one),
 * this component never imports/uses `RequireRole` -- it only reads
 * `useAuth().user.role` to pick which variant to render.
 * `isCoachOrAdminView` below compares only against the `'coach'`/`'admin'`
 * literals by design (it only needs to distinguish coach/admin from
 * everyone else); everything else, including a real `'student'`/`'parent'`
 * value, now correctly type-checks too and falls through to the
 * student/parent variant.
 *
 * -----------------------------------------------------------------------
 * 6. T096 (ED-1 Packet P7): `PLACEHOLDER_CURRENT_STUDENT_ID` resolution --
 *    `AuthUser` (`guards.tsx`) still carries only `{id, email, role}`, no
 *    direct `students.id` field, but this task DOES resolve a real
 *    `students.id` from that identity instead of leaving it a placeholder
 *    (Trap #4 of this task's own worker packet -- full reasoning restated
 *    here, since this is a genuinely new resolution problem, not a reused
 *    hook):
 *
 *    - Logged-in STUDENT: `students.profile_id = auth.uid()` is a direct,
 *      unambiguous 1:1 lookup -- exactly one (or zero, for a not-yet-linked
 *      account) row.
 *    - Logged-in PARENT: `guardian_links.parent_profile_id = auth.uid()` can
 *      match MULTIPLE rows (one per linked child) -- but `StudentMeetingsView`
 *      below (unchanged by this task) still only ever accepts ONE
 *      `studentId: string`, not a list, and this task's own Allowed Files
 *      (`MeetingsList.tsx` + a new `loaders/meetings.ts`) do not extend to
 *      redesigning this route into ParentHome.tsx's own multi-card-per-child
 *      architecture (`ParentHome.tsx`'s module doc #4) -- that would be a
 *      genuinely new, much larger UI (N independent cards, N independent
 *      loads) this task's packet never asks for and Trap #4 explicitly warns
 *      against inventing. Investigated `ParentHome.tsx` (an already-real-wired
 *      parent-facing surface) for precedent per Trap #4's own instruction:
 *      its OWN precedent for "which parent is this" is to NOT attempt any
 *      `guardian_links`-keyed-by-`auth.uid()` resolution at all (that file's
 *      own module doc #7: "this page does not attempt to resolve 'which
 *      parent is signed in' from `useAuth()`"), because at the time that page
 *      was built no shared Supabase client existed yet to do so. That
 *      specific limiting reason no longer applies to THIS task (a real client
 *      now exists, and Trap #4 explicitly directs a real
 *      `guardian_links.parent_profile_id = auth.uid()` lookup) -- so the
 *      precedent actually followed here is narrower than "don't resolve at
 *      all": resolve for real, but stay honest about the one-student-only
 *      limitation `MeetingsList`'s own pre-existing (not-this-task's)
 *      `studentId: string` signature already imposes, the same way
 *      `ParentHome.tsx` stays honest about ITS OWN pre-existing gap rather
 *      than silently faking a resolution. `resolveCurrentStudentId`
 *      (`../../lib/supabase/loaders/meetings.ts`) resolves a parent to their
 *      EARLIEST-linked child only (`guardian_links` ordered by `created_at`
 *      ascending, first row) -- a disclosed, minimal, real answer for a
 *      single-student parent (the common case), with a known limitation for a
 *      genuinely multi-student parent (documented in this task's own worker
 *      output "Known risks", not silently accepted as correct for that case).
 *    - Coach/admin: `resolveCurrentStudentId` is never called at all (the
 *      `isCoachOrAdminView` branch below renders `CoachMeetingsView`
 *      instead), but returns `null` defensively rather than throwing if it
 *      ever were.
 *
 *    `resolveStudentId` (new injectable prop on `MeetingsListProps`, default
 *    `resolveCurrentStudentId`) is only ever invoked when a caller does NOT
 *    supply an explicit `studentId` prop -- an explicit `studentId` (as every
 *    existing test in `MeetingsList.test.tsx` before this task already
 *    passes) bypasses resolution entirely and is used as-is, unchanged
 *    behavior. `PLACEHOLDER_CURRENT_STUDENT_ID` is KEPT as a named export
 *    (per this task's own Known Context/Traps #5 -- `MeetingsList.test.tsx`
 *    still imports and uses it) but its role changes: it is no longer this
 *    component's own runtime default for an unresolved `studentId` (that
 *    placeholder default is removed below); it now exists solely as the
 *    fixture literal identifying "the current viewer" inside `FIXTURE_*`
 *    data below, for tests/callers that want fixture data rendered
 *    explicitly.
 *
 * -----------------------------------------------------------------------
 * 7. T096 (ED-1 Packet P7): real load/mutation/dialog wiring -- three of the
 *    four former stubs are now real; "Edit" alone remains a disclosed stub
 *    (with new, accurate copy, since the underlying reason changed -- see
 *    (b) below). **T510 UPDATE (below, after (b)'s own historical record):
 *    "Edit" is no longer a stub** -- `ScheduleMeetingsDialog.tsx` now has a
 *    real edit mode (`initialData`/`onSaveMeetingSeries`), so a real
 *    edit-dialog opener replaces the old stub handler at both
 *    `CoachMeetingsSection` mounts, and the info-banner-notice machinery this
 *    module doc originally described for that stub is deleted (AC14, this
 *    task's own worker output).
 *
 *    a. "Schedule meetings" button (coach view) -- `ScheduleMeetingsDialog.tsx`
 *       (T031, already Passed, already built, already has its own real
 *       injectable `onCreateMeetings` seam) is now imported and rendered for
 *       real by `CoachMeetingsView` below, in CREATE mode. `onClick` opens
 *       the real dialog (`isScheduleDialogOpen` state) instead of showing a
 *       stub `Banner`. `handleCreateMeetingsSubmit` below wires the dialog's
 *       own `onCreateMeetings` prop to a real default
 *       (`createMeetings`, `../../lib/supabase/loaders/meetings.ts`) that
 *       inserts one real `events` row (type `meeting`) + one real
 *       `event_sessions` row per computed date, then reloads this page's own
 *       `rows` from `loadData()` so the newly-scheduled meeting(s) appear
 *       without a manual refresh (a full reload, not a client-side merge --
 *       recomputing `CoachMeetingRow`'s own `teamScopeLabel`/
 *       `attendanceSummary` fields client-side would duplicate
 *       `buildCoachMeetingRows`' real DB-driven joins for no benefit).
 *    b. Row "Edit" menu item (coach view) -- Trap #3 of this task's own
 *       worker packet directed investigating whether
 *       `ScheduleMeetingsDialog.tsx` genuinely supports an "edit an existing
 *       meeting" mode before assuming it does. It does NOT: its own props
 *       (`ScheduleMeetingsDialogProps`) have no `initialData`/"meeting to
 *       edit" field of any kind, its `resetForm()` always resets to the same
 *       hardcoded pristine defaults (never a passed-in existing row), and its
 *       own `CreateMeetingsPayload` shape (`{event, sessions}`, always a
 *       BRAND-NEW `events` insert + N BRAND-NEW `event_sessions` inserts) is
 *       purpose-built for creating a whole new recurring-meeting SERIES, not
 *       mutating one already-scheduled session's fields in place -- there is
 *       no code path in that file that could ever target an existing row for
 *       an UPDATE. Forcing "Edit" onto this dialog would mean either (i)
 *       silently creating a SECOND competing series alongside the original
 *       whenever "Edit" is used (wrong -- corrupts the schedule) or (ii)
 *       inventing new dialog behavior (an `initialData` prop, an edit-mode
 *       branch in its own submit handler) inside `ScheduleMeetingsDialog.tsx`
 *       itself, a forbidden/read-only file for this task. Per the packet's
 *       own explicit instruction for exactly this finding, "Edit" is left as
 *       a clearly-labeled, HONEST stub instead -- new, accurate copy (NOT the
 *       old "dialog not built yet" text, since the dialog genuinely IS built
 *       now; the real remaining gap is narrower and different: "this
 *       particular dialog has no edit mode to open").
 *
 *       **T510 UPDATE: the gap (b) describes is now closed.**
 *       `ScheduleMeetingsDialog.tsx` gained a real, additive edit mode
 *       (`initialData`/`onSaveMeetingSeries` -- see that file's own module doc)
 *       per George's fully-settled T510 design ruling
 *       (`docs/swarm/auto-mode-decisions.md`, "George closes out T510's
 *       design"). `openEditDialog(row)` (below) sets `editTarget(row)` and
 *       opens the SAME `<ScheduleMeetingsDialog>` instance already mounted for
 *       create mode -- one dialog serves both, same "one dialog, one
 *       `initialData`-computed-by-ternary" shape `OutreachEventDialog.tsx`/
 *       `OutreachList.tsx` already established. `handleSaveMeetingSeriesSubmit`
 *       wires the dialog's own `onSaveMeetingSeries` prop to a real default
 *       (`saveMeetingSeries`, `../../lib/supabase/loaders/meetings.ts`) that
 *       reconciles the event's own `events`/`event_sessions` rows
 *       (future-forward only -- George's own ruling), then reloads `rows` the
 *       same way `handleCreateMeetingsSubmit` above already does.
 *    c. Row "Cancel" menu item + `AlertDialog` (coach view) -- was already
 *       real-LOOKING before this task (a genuine `AlertDialog`, DES-11), but
 *       only ever flipped local `rows` state; this task pairs it with a real
 *       `event_sessions.status = 'canceled'` mutation
 *       (`onCancelSession`, default `cancelMeetingSession`,
 *       `../../lib/supabase/loaders/meetings.ts`), optimistic-update +
 *       rollback-on-failure, mirroring `StudentsTab.tsx`'s own
 *       `handleConfirmDeactivate` (T089) shape exactly per this task's own
 *       packet steer.
 *    d. "Consistency strip"-shaped area (student/parent view) -- BEH-06's
 *       "last 5 completed meetings as `StatusDot`s" widget is T037's
 *       already-built, already-Passed deliverable
 *       (`StudentMeetingView.tsx`'s `StudentMeetingView`/`ConsistencyStrip`).
 *       T180 mounts it directly beneath this view's Upcoming/Past history,
 *       passing the `studentId` this file has already resolved (Known
 *       Context/Traps #1 of that task's own packet) -- replacing the prior
 *       placeholder `Section`'s "isn't built yet" copy entirely. T180 also
 *       deletes this file's own participation `ProgressBar` (formerly above
 *       Upcoming) as part of the same change: the strip renders its own
 *       participation figure, and shipping both would put two independently-
 *       loaded participation regions on one page (T180's own packet, Part B)
 *       -- this file's own Upcoming/Past history rows (own status per
 *       session) are UNCHANGED, a distinct, narrower deliverable from the
 *       strip mounted beneath them.
 *
 * -----------------------------------------------------------------------
 * 8. DES-12 four states, reachable independently per role variant (Known
 *    Context/Traps #6).
 *
 *    Coach view (`CoachMeetingsView`): loading (T081: `Skeleton`,
 *    previewing the known Upcoming/Past meeting-list-row shape, while
 *    `loadCoachData()` is pending -- replacing the prior `Spinner` per
 *    Astryx's own guidance since this list's dimensions are predictable)
 *    / error (`loadCoachData()` rejects --
 *    `Banner status="error"`) / empty (`loadCoachData()` resolves zero
 *    meeting-type rows -- page-level `EmptyState` with an offer to open the
 *    stubbed "Schedule meetings" flow) / populated (Upcoming/Past `Section`s
 *    with real rows; each section independently falls back to its own
 *    smaller `EmptyState` when only ONE of the two buckets is empty, e.g.
 *    "no upcoming meetings, three past ones").
 *
 *    Student/parent view (`StudentMeetingsView`): loading / error / empty
 *    (zero history rows AND no participation row) / populated -- the exact
 *    same four-state shape, built independently against `loadStudentData`,
 *    with its own distinct copy (never sharing a message with the coach
 *    view's states, so the two variants are visually/textually
 *    distinguishable per the packet's Known Context/Traps #6).
 *
 * -----------------------------------------------------------------------
 * 9. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked against `docs/swarm/astryx-api.md` directly:
 *
 *  - `Section`: "Section" Props table. `dividers`, `padding`, `children`
 *    used, matching `ParticipationTab.tsx`'s established team-grouping
 *    idiom (one `Section` per Upcoming/Past bucket here, instead of per
 *    team).
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap `RosterShell.tsx`/T021 and
 *    `Kiosk.tsx`/T034 already hit); `npm run astryx -- component Heading`
 *    resolves `level` (1-6, required) + `children` (required) -- only those
 *    two used below.
 *  - `List`/`ListItem`: "List" Props table (`children`, `hasDividers`,
 *    `header`) + `ListItem`'s own doc subsection is likewise `undefined`;
 *    `npm run astryx -- component ListItem` (re-run live for this task, not
 *    assumed from a prior task) resolves: `label` (`string`, required),
 *    `description` (`ReactNode`), `startContent`, `endContent`, `onClick`,
 *    `href`, `target`, `rel`, `isDisabled`, `isSelected` -- only `label`,
 *    `description`, `endContent` used below (no `onClick`/`href` -- rows are
 *    not interactive/clickable per this task's scope, avoiding the doc's own
 *    "Don't place interactive elements inside an interactive list item"
 *    warning entirely by never making the row itself interactive).
 *  - `Badge`: "Badge" Props table. `variant`
 *    (`'neutral'|'info'|'success'|'warning'|'error'|...`), `label` used.
 *    Session-status badges use the real `event_sessions.status` enum
 *    (Known Context/Traps #5) mapped to Astryx's semantic variants (a
 *    system-state use, matching the doc's own "Do: use success/warning/
 *    error for system status" guidance, not the "Don't: use semantic
 *    variants for categories" warning). Attendance-status badges (student
 *    view) use DES-05's literal mapping (Present=success, Late=warning,
 *    Excused=neutral, Absent=error), cited from PRD line 195.
 *  - `MoreMenu`: T135 SUPERSEDES this bullet -- the coach row's own
 *    `MoreMenu` (previously documented here, `items`/`DropdownMenuOption[]`/
 *    `label`) is REMOVED (module doc above, T135's own module doc below):
 *    once Cancel left it for T122's per-session buttons, exactly one item
 *    ("Edit") remained, so the menu itself is gone, replaced by a plain
 *    `Button` chip. `MoreMenu` is no longer imported or rendered anywhere in
 *    this file (grep-provable).
 *  - `AlertDialog`: "AlertDialog" Props table. `isOpen`, `onOpenChange`,
 *    `title`, `description`, `actionLabel`, `onAction` (all required) used;
 *    `actionVariant` left at its documented `'destructive'` default
 *    (canceling a meeting is a destructive-shaped action).
 *  - `Button`: "Button" Props table. `label`, `variant`, `onClick` used.
 *  - `Banner`: "Banner" Props table. `status`, `title`, `description` used.
 *  - `EmptyState`: "EmptyState" Props table. `title` (required),
 *    `description`, `actions` used.
 *  - `Skeleton` (T081): "Skeleton" section, lines 621-655. `width`,
 *    `height`, `index` used, replacing `Spinner`'s prior use in both role
 *    variants per Astryx's own guidance (known-dimension content).
 *    `VisuallyHidden` + the wrapping `VStack`'s `aria-busy` carry the same
 *    "Loading…" announcements `Spinner`'s `label` used to provide.
 *  - T180: `ProgressBar` is no longer imported by this file -- the student
 *    view's own participation `ProgressBar` (formerly documented here) was
 *    deleted along with the `Section` it lived in (module doc #7d); the
 *    mounted `StudentMeetingView` strip renders the page's sole
 *    participation figure now, using its own `ProgressBar` internally
 *    (`StudentMeetingView.tsx`'s own module doc #8, not this file's).
 *  - `VStack`/`HStack`: "Stack" section, `VStack`/`HStack` subsections.
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap` used.
 *  - `Text`: "Text" Props table. `type` (`'supporting'`), `color`,
 *    `hasTabularNumbers` used.
 *  - `Collapsible` (T122, new to this file at the time): T135 SUPERSEDES
 *    this bullet for the coach row -- `Collapsible` kept its own content
 *    always mounted (CSS-`display:none` while collapsed, never removed from
 *    the DOM, `Collapsible.tsx:102-104`), which is exactly the mechanism
 *    T135's own Table-migration module doc (below) found unsuitable for a
 *    `Table`'s flat `data` array; the coach row's expander is now a plain
 *    `Button` (module doc above `MIN_TOUCH_TARGET_STYLE`) driving real row
 *    splicing instead. `Collapsible` is no longer imported or rendered
 *    anywhere in this file (grep-provable).
 *
 * -----------------------------------------------------------------------
 * 10. T122 (PRD v2 UXP-04, "meetings half" of the row-density rework;
 *     capability map "Events tab" figure is the binding reference) --
 *     coach-view rows are RESTRUCTURED from one-row-per-SESSION to
 *     one-row-per-EVENT (recurring-meeting SERIES), with an in-place
 *     expander (UXD-03) revealing each session. Full decision record
 *     (density comparison against the reference figure, the `.limit(1)`
 *     fix) is in this task's own worker output; the parts that affect this
 *     file's own shape:
 *
 *     a. `CoachMeetingRow` is now `{ eventId, title, locationName,
 *        teamScopeLabel, sessions: CoachMeetingSessionDetail[] }` --
 *        `sessions` holds the SAME per-session facts the old flat row used
 *        to carry (`sessionId`, `sessionDate`, `startsAt`, `endsAt`,
 *        `status`, `attendanceSummary`), plus three NEW per-session facts
 *        this task adds: `durationHours` (plain `endsAt - startsAt`
 *        arithmetic -- the same subtraction `formatDuration` already did,
 *        factored into one shared `computeDurationMinutes` helper (now in
 *        `src/lib/meetings/format.ts`, GAM-443) so there is exactly one
 *        duration formula, not two),
 *        `expectedCt` (a real RSVP `status === 'going'` COUNT for that
 *        session -- a plain filter+length, the same class of computation
 *        `PastAttendanceSummary` already does per module doc #3, never a
 *        percentage), and `attendeeNames` (real `students.display_name`
 *        values for that session's present/late attendance rows, completed
 *        sessions only -- empty for a scheduled session, since no attendance
 *        exists yet to name).
 *     b. `summarizeCoachMeetingRow(sessions)` is a NEW pure function
 *        (exported, directly testable) that derives everything the row-level
 *        summary line needs from `sessions` alone -- UXD-02's own worked
 *        example ("MON (18) · THU (18)") is `buildRecurrenceChips`'s literal
 *        target shape (grouped by weekday, first-seen order, empty for a
 *        single-session event since a chip adds nothing for a one-off
 *        meeting -- the date range line covers that case alone);
 *        `buildDateRangeLabel` reuses `formatWeekdayDate` verbatim (BEH-08,
 *        module doc #4 -- still the ONLY weekday-date formatter, now shared
 *        via `src/lib/meetings/format.ts`, GAM-443); "planned hours" sums
 *        EVERY non-canceled session's own
 *        `durationHours`, "logged hours" sums only COMPLETED sessions' --
 *        both are plain scheduled-DURATION sums, never a re-derivation of
 *        `v_student_hours`'/`v_student_participation`'s own hours/percentage
 *        formulas (constitution item 3). Disclosed, deliberate scope
 *        decision (this task's own worker output has the full reasoning):
 *        meetings are created with `counts_volunteer_hours: false`
 *        (`loaders/meetings.ts`'s own `makeCreateMeetings`, T096, unchanged
 *        by this task) -- they never feed `v_student_hours` at all, so
 *        there is no metric-view-backed "volunteer hours credited" figure
 *        for a meeting row to show even if this task wanted one; "planned/
 *        logged hours" here means SCHEDULED MEETING TIME (how long this
 *        series is scheduled for vs. how much of it has actually happened),
 *        a real, honestly-labeled, non-metric figure, not a stand-in for
 *        volunteer-hours credit. "Expected"/"attended" counts are summed
 *        across every one of the event's own sessions (cumulative
 *        person-sessions across the whole series, e.g. an 18-Monday series
 *        with 20 students expected each week sums to 360) -- the same
 *        cumulative-count idiom `PastAttendanceSummary` already established
 *        per-session, applied across a row's own sessions instead of within
 *        one; per-session (non-cumulative) counts remain visible in the
 *        expander for exactly this reason.
 *     c. Upcoming/Past partitioning for these grouped rows can no longer
 *        reuse the old per-session `partitionByStatus` (a row can now hold
 *        BOTH completed and still-scheduled sessions at once, e.g. a
 *        weekly meeting three weeks in) -- `partitionCoachMeetingRows`
 *        (NEW, exported) buckets a row into Upcoming when ANY of its own
 *        sessions is still `'scheduled'`, else Past; sorted by the nearest
 *        upcoming session ascending (Upcoming) / the most recent session
 *        descending (Past) -- disclosed design decision: an ongoing weekly
 *        meeting with both past and future sessions stays in Upcoming until
 *        its LAST session is completed/canceled, matching how a coach would
 *        actually think of "is this meeting still going." `partitionByStatus`
 *        itself is UNCHANGED and still used by `StudentMeetingsView` below
 *        (module doc #7d / Known Context/Traps -- the student/parent view
 *        keeps its own existing per-session-row shape verbatim, per this
 *        task's own packet: "Student view: keep its existing shape").
 *     d. Row-level Cancel (module doc #7c, T096) MOVES from the row's own
 *        `MoreMenu` into each SESSION inside the expander (a plain `Button`,
 *        not a second `MoreMenu`, since a session only ever has the one
 *        action) -- semantically more correct than before (you cancel one
 *        OCCURRENCE, never a whole recurring series in one action), and the
 *        underlying mutation this task was told to "keep" (`onCancelSession`
 *        / `cancelMeetingSession`, `loaders/meetings.ts`, unchanged target
 *        shape: `(sessionId: string) => Promise<void>`) and its optimistic-
 *        update-with-rollback pattern are preserved byte-for-byte, only its
 *        UI trigger location moves. At the time of T122, the row's own
 *        `MoreMenu` carried only "Edit" (module doc #7b's stub reasoning is
 *        UNCHANGED and still reads MORE naturally: editing a whole meeting
 *        SERIES was always the real ask `ScheduleMeetingsDialog.tsx` cannot
 *        do, not editing one session) -- T135 SUPERSEDES the "MoreMenu"
 *        part of this sentence specifically: one item behind a menu is a
 *        menu that should not exist, so the row's own `MoreMenu` is REMOVED
 *        (this file's own T135 module doc, below, has the full authorized-
 *        deviation record) and replaced with a plain `Edit` `Button` chip.
 *        Edit's own stub behavior/copy is otherwise byte-for-byte unchanged.
 *     e. Location (`event.locationName`) is a real, already-existing column
 *        (UXP-08's own resolution note: `events.location_name`/`address`
 *        are `not null` in the v1 schema; this task is the first to surface
 *        them on this page) -- `loaders/meetings.ts`'s own `queryEvents`
 *        now selects both; the `FixtureEvent` fixture rows below gain real
 *        (fabricated per constitution item 6) location strings so the dense
 *        row has something honest to show without a live DB.
 *     f. UXD-05(b) fix (space rules): `CoachMeetingsSection`/
 *        `StudentHistorySection`'s own per-section `EmptyState` (e.g. "no
 *        upcoming meetings, three past ones") now passes `isCompact` --
 *        previously full-size regardless of whether the SIBLING section on
 *        the same page had real rows, which is exactly UXD-05(b)'s named
 *        violation ("a section with no rows yields its space; it does not
 *        center a message in half a viewport"). The page-level "zero
 *        meetings at all" `EmptyState` (both views) stays full-size --
 *        there is genuinely no other content on the page in that case, so
 *        `isCompact` would not apply per that prop's own documented purpose
 *        ("reduced spacing for constrained content areas"). UXD-05(a)/(c)
 *        reviewed against this page and found not applicable: no duplicated
 *        heading for one concept exists here (unlike the named Outreach
 *        anti-example), and no stacked full-width-bar pattern exists here
 *        for the tile pattern to replace. T180 UPDATE: this file no longer
 *        renders a participation `ProgressBar` of its own at all -- the
 *        single participation bar now lives inside the mounted
 *        `StudentMeetingView` strip (module doc #7d), one bar, not a stack,
 *        same conclusion.
 *     g. `.limit(1)` dual-member fix (`loaders/meetings.ts`
 *        `queryParticipationRowsForStudent`/`aggregateParticipationRows`) --
 *        this file's own consuming code (`buildStudentMeetingsData`'s
 *        `participationMetrics.find(...)`) is UNCHANGED: the loader now
 *        hands it an array with AT MOST one (already-aggregated) row
 *        instead of an arbitrary single row, so the existing `.find` still
 *        finds exactly the right thing with zero changes needed here. Full
 *        decision record lives in `loaders/meetings.ts`'s own module doc and
 *        this task's own worker output.
 */

type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow';

// ---------------------------------------------------------------------------
// Status -> Badge variant mapping (coach view only).
// ---------------------------------------------------------------------------

const SESSION_STATUS_BADGE: Record<SessionStatus, { variant: BadgeVariant; label: string }> = {
  scheduled: { variant: 'info', label: 'Scheduled' },
  completed: { variant: 'success', label: 'Completed' },
  canceled: { variant: 'error', label: 'Canceled' },
};

function formatPastAttendanceSummary(summary: PastAttendanceSummary): string {
  // Mirrors MTG-13's own literal worked example format ("14 present - 2
  // late - 1 excused - 1 absent"), PRD line 287.
  return `${summary.presentCt} present · ${summary.lateCt} late · ${summary.excusedCt} excused · ${summary.absentCt} absent`;
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- module doc #8.
// ---------------------------------------------------------------------------

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the caller-supplied `deps` semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list; `retryToken` is an additional internal trigger.
  }, [...deps, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Coach view -- module doc #7/#8.
// ---------------------------------------------------------------------------

/**
 * T135 (VOLT UX Craft PRD v3.1, UXC-02/03/07) -- REWORK of T122's `ListItem`
 * coach row (module doc #10 above, kept for the row-shape/mutation history;
 * this task changes only the rendering primitive, not the underlying data or
 * mutations) onto Astryx `Table`, per PRD v3.1 F-1's finding that `ListItem`
 * wraps `Item`, a three-slot flex whose end slots are `flex: 0 0 auto`
 * (`Item.tsx:268,272`) and therefore cannot align stat/action columns across
 * sibling rows -- exactly the defect T130 already fixed on the coach
 * outreach rows (`OutreachList.tsx`'s `buildCoachOutreachColumns` and the
 * components around it). This migration copies that proven mechanism
 * (`useTableGroupedRows`/`useTableRowExpansion` remain forbidden -- zero
 * occurrences in `astryx-api.md`, constitution item 2 -- so expansion is a
 * flat `data` array with `kind: 'sessionDetail'` rows spliced in beneath
 * their parent, exactly as `buildCoachOutreachTableRows` does).
 *
 * ONE genuine deviation from the outreach pattern (packet Trap 1/2): T130
 * puts its expansion `useState` INSIDE each `CoachOutreachSection` instance
 * (Upcoming, Past expand independently). That placement is wrong here.
 * `handleConfirmCancel` (below) optimistically flips a canceled session's
 * status, `partitionCoachMeetingRows` (module doc #10c) recomputes on the
 * next render, and a row whose only scheduled session was just canceled
 * moves from the Upcoming bucket to the Past bucket -- a DIFFERENT
 * `CoachMeetingsSection` instance, with its own (in the per-section design)
 * EMPTY expansion set, silently collapsing the row at the exact moment the
 * user most wants to see the cancellation take effect. So expansion state
 * here is lifted ONE level up, into `CoachMeetingsView`, and passed down to
 * BOTH section instances -- it survives the bucket move because it is the
 * same `Set`, not two independent ones.
 *
 * Row-level actions (packet §2): the "Edit"-only `MoreMenu` this row used to
 * carry is replaced with a short `Edit` `Button` chip -- one item behind a
 * menu is a menu that should not exist, same reasoning T131 already shipped
 * on the outreach rows. AUTHORIZED (2026-07-28, George,
 * `VOLT_Portal_PRD.md` beside MTG-01): this is a disclosed PRD deviation
 * from MTG-01's literal "per-row MoreMenu (Edit, Cancel session)" text --
 * Cancel already left the row-level menu for T122's per-session buttons
 * (module doc #10d), leaving exactly one menu item. Per-session Cancel stays
 * exactly where it already was (module doc #10d), inside the expander.
 */

/** UXC-13, T130's mechanism (`MIN_TOUCH_TARGET_STYLE`, `OutreachList.tsx`) --
 * a non-exported local in a Forbidden file, so re-declared here rather than
 * imported (packet's explicit instruction: this is the one place "copy it"
 * is correct). `style` is a real, installed-source-verified prop deviation
 * on `Button` (D004, constitution item 2), not a documented one -- see
 * `OutreachList.tsx`'s own `MIN_TOUCH_TARGET_STYLE` doc comment for the full
 * `mergeProps`/StyleX citation this task inherits without re-deriving. */
const MIN_TOUCH_TARGET_STYLE: CSSProperties = { minHeight: '44px' };

/** T130's mechanism (`sessionDetailAnchorId`, `OutreachList.tsx:2099`) -- a
 * non-exported local in a Forbidden file, re-declared here (same reasoning
 * as `MIN_TOUCH_TARGET_STYLE` above). Gives each spliced-in session-detail
 * row's first `Text` a real id for the expander's `aria-controls` to
 * reference, only once that row genuinely exists in the DOM (rows are
 * spliced OUT, not hidden, when collapsed -- an `aria-controls` IDREF to a
 * nonexistent id would be invalid). */
function sessionDetailAnchorId(eventId: string, sessionId: string): string {
  return `meeting-session-detail-${eventId}-${sessionId}`;
}

/** T130's mechanism -- the expander column/mobile-card control. Visible
 * children stay the pre-existing `Session details (N)` wording (Trap 3b:
 * "keep the wording" branch -- no test churn, `:595`/`:596` stay green
 * untouched), while `label` (the accessible name) carries the per-row
 * show/hide verb + title, matching `CoachExpanderButton`'s own
 * `label`-vs-children split so the row title never leaks into the ONLY
 * visible text on a menu-free action row. */
function CoachMeetingExpanderButton({
  row,
  isExpanded,
  onToggleExpand,
}: {
  row: CoachMeetingRow;
  isExpanded: boolean;
  onToggleExpand: (eventId: string) => void;
}): ReactNode {
  const controlsIds = row.sessions
    .map((session) => sessionDetailAnchorId(row.eventId, session.sessionId))
    .join(' ');
  return (
    <Button
      label={
        isExpanded ? `Hide session details – ${row.title}` : `Show session details – ${row.title}`
      }
      size="sm"
      variant="ghost"
      aria-expanded={isExpanded}
      // Only a real disclosure target while expanded -- the referenced ids
      // do not exist in the DOM until then (row splicing, not CSS-hide).
      aria-controls={isExpanded ? controlsIds : undefined}
      style={MIN_TOUCH_TARGET_STYLE}
      onClick={() => onToggleExpand(row.eventId)}
    >
      {`Session details (${row.sessions.length})`}
    </Button>
  );
}

/** T131's compact reference-app action-cluster shape, reduced to the one
 * action this row actually has (packet §2): a short `Edit` chip, verbatim
 * `label`/visible text matching T131's own Edit button. No destructive `×`
 * here -- Cancel targets one SESSION, not a whole row, and stays inside the
 * expander (module doc #10d), so this row-level cluster is Edit alone. */
function CoachMeetingRowActions({
  row,
  onEdit,
}: {
  row: CoachMeetingRow;
  onEdit: (row: CoachMeetingRow) => void;
}): ReactNode {
  return (
    <Button
      label={`Edit – ${row.title}`}
      size="sm"
      variant="secondary"
      style={MIN_TOUCH_TARGET_STYLE}
      onClick={() => onEdit(row)}
    >
      Edit
    </Button>
  );
}

/** UXC-02: date range + recurrence chips + the canceled `Badge` -- module
 * doc above (Table migration) and packet §3: the canceled `Badge` used to
 * float in the row's own `endContent`, which the PRD itself calls a defect
 * (`VOLT_UX_Craft_PRD_v3.md:98-99`, "floating canceled badge"). It now has a
 * real column home, the date column, matching where T130 put its own type
 * `Badge`. */
function CoachMeetingDateCell({ summary }: { summary: CoachMeetingRowSummary }): ReactNode {
  return (
    <VStack gap={0.5}>
      <Text type="supporting">{summary.dateRangeLabel}</Text>
      {(summary.recurrenceChips.length > 0 || summary.canceledCt > 0) && (
        <HStack gap={1} wrap="wrap" vAlign="center">
          {summary.recurrenceChips.map((chip) => (
            <Badge key={chip} variant="neutral" label={chip} />
          ))}
          {summary.canceledCt > 0 && (
            <Badge variant="error" label={`${summary.canceledCt} canceled`} />
          )}
        </HStack>
      )}
    </VStack>
  );
}

/** UXC-04 standing ruling (packet "Standing rulings" section): NOT a link.
 * PRD NAV-08's `/meetings/:sessionId` detail route does not exist
 * (`router.tsx` has 14 routes, none of them this, and no catch-all), and no
 * meeting-detail component exists either -- linking would point at a blank
 * page. D008: a linked title is canonically `weight` 600/14px/
 * `--color-text-primary`; this plain title matches that weight (the
 * pre-Table `ListItem` label was already semibold) without the link. */
function CoachMeetingTitleCell({ row }: { row: CoachMeetingRow }): ReactNode {
  return (
    <VStack gap={0.5}>
      <Text weight="semibold" maxLines={1}>
        {row.title}
      </Text>
      <Text type="supporting" maxLines={1}>
        {`${row.locationName.trim().length > 0 ? row.locationName : 'No location set'} · ${row.teamScopeLabel}`}
      </Text>
    </VStack>
  );
}

/** T122 (module doc #10d) -- one of a `CoachMeetingRow`'s own sessions,
 * rendered inside that row's expander (UXD-03) -- T135 relocates this from a
 * `Collapsible` child into a spliced-in `Table` row's `title`-column cell
 * content (same text/shape, byte-identical, only the mounting mechanism
 * changes). Carries the ONLY per-session Cancel action left in this file
 * (module doc #10d -- moved here from the old row-level `MoreMenu`, same
 * underlying mutation/optimistic-update pattern, unchanged). `anchorId`
 * lands on the first `Text` so the expander's `aria-controls` (above) has
 * something real to reference once this row exists in the DOM. */
function CoachMeetingSessionRow({
  eventId,
  eventTitle,
  session,
  onCancelRequest,
  onEditRequest,
  anchorId,
}: {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void;
  // T605 -- same signature shape as `onCancelRequest` above, threaded
  // alongside it at every one of this component's own five call sites (§6.2).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void;
  anchorId?: string;
}): ReactNode {
  const statusBadge = SESSION_STATUS_BADGE[session.status];

  return (
    <HStack gap={3} vAlign="start" wrap="wrap" padding={2}>
      <VStack gap={0.5}>
        <Text id={anchorId} type="supporting">
          {`${formatWeekdayDate(session.sessionDate)} · ${formatTimeRangeWithDuration(session.startsAt, session.endsAt)}`}
        </Text>
        {session.status === 'scheduled' && (
          <Text type="supporting" hasTabularNumbers>
            {`Expected ${session.expectedCt}`}
          </Text>
        )}
        {session.attendanceSummary !== null && (
          <Text type="supporting">{formatPastAttendanceSummary(session.attendanceSummary)}</Text>
        )}
        {session.status === 'completed' && (
          <Text type="supporting">
            {session.attendeeNames.length > 0
              ? `Attended: ${session.attendeeNames.join(', ')}`
              : 'No attendees recorded.'}
          </Text>
        )}
        {session.status === 'canceled' && (
          <Text type="supporting">Canceled &mdash; no attendance recorded.</Text>
        )}
      </VStack>
      <HStack gap={2} vAlign="center">
        <Badge variant={statusBadge.variant} label={statusBadge.label} />
        {session.status === 'scheduled' && (
          <>
            {/* T511 -- the live console's ONLY entry point in the app.
                `routePaths.meetingLiveSession` had zero call sites, so
                `/meetings/live/:sessionId` was reachable only by typing the
                URL. A `Link`, not a `Button`: this navigates, and
                `astryx-api.md`'s Link Best Practices reserve Button for
                actions that do NOT navigate -- so a real anchor is what gives
                middle-click, ctrl-click and the correct screen-reader
                announcement. Same shape as `LiveConsole.tsx`'s own outbound
                "Open kiosk view" link. It sits beside a `Button` and will not
                look identical to it; that is the disclosed cost of being a
                real link.

                No time window, deliberately: gating this to "starting soon"
                would make the console unreachable again outside that window --
                including the case that matters most, a meeting that started an
                hour ago and is still running. See `docs/swarm/active/
                T511-scope.md` §3.

                No role check here either. `CoachMeetingSessionRow` renders only
                under `CoachMeetingsView`, which is already gated on
                `isCoachOrAdminView`; adding a second gate gives two that can
                drift apart. Asserted rather than duplicated (§4). */}
            <Link
              as={RouterLink}
              href={routePaths.meetingLiveSession(session.sessionId)}
              isStandalone
            >
              {/* The date is REQUIRED, not decorative: `astryx-api.md` forbids
                  `label` on a text link, so this visible text IS the accessible
                  name -- and a multi-session row would otherwise render several
                  links all named "Go live". The Cancel button beside it solves
                  the identical problem the same way. */}
              {`Go live — ${formatWeekdayDate(session.sessionDate)}`}
            </Link>
            {/* T605 -- gated on `isMeetingSessionReconcilable` (imported from
                `./ScheduleMeetingsDialog`, not reimplemented -- §6.2), which is
                STRICTER than the surrounding `status === 'scheduled'` block: a
                scheduled-but-already-started/expired session still gets
                Cancel (immediately above/below) but not Edit -- it is "not
                stranded," per the decisions log's own narration of this
                trade-off (`auto-mode-decisions.md:3770`, inside the section
                recording George's rulings, though this specific sentence is
                the log's own writing, not a quote from him): "it is not
                stranded, though -- it is still cancellable individually
                through the existing per-session Cancel." */}
            {isMeetingSessionReconcilable(session, new Date()) && (
              <Button
                variant="ghost"
                size="sm"
                style={MIN_TOUCH_TARGET_STYLE}
                label={`Edit ${formatWeekdayDate(session.sessionDate)} session`}
                onClick={() => onEditRequest(eventId, eventTitle, session)}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              style={MIN_TOUCH_TARGET_STYLE}
              // Includes the session's own date so a multi-session row's
              // several Cancel buttons are each unambiguous (both visually
              // and to assistive tech), unlike a bare "Cancel session".
              label={`Cancel ${formatWeekdayDate(session.sessionDate)} session`}
              onClick={() => onCancelRequest(eventId, eventTitle, session)}
            />
          </>
        )}
      </HStack>
    </HStack>
  );
}

function renderMeetingSessionDetailCell(
  row: CoachMeetingSessionDetailTableRow,
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void,
  // T605 -- threaded alongside `onCancelRequest` (§6.2 item 2).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void,
): ReactNode {
  return (
    <CoachMeetingSessionRow
      eventId={row.eventId}
      eventTitle={row.eventTitle}
      session={row.session}
      onCancelRequest={onCancelRequest}
      onEditRequest={onEditRequest}
      anchorId={sessionDetailAnchorId(row.eventId, row.session.sessionId)}
    />
  );
}

interface BuildCoachMeetingColumnsArgs {
  expandedEventIds: ReadonlySet<string>;
  onToggleExpand: (eventId: string) => void;
  onEdit: (row: CoachMeetingRow) => void;
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void;
  // T605 -- threaded alongside `onCancelRequest` (§6.2 item 3).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void;
  isNarrow: boolean;
}

/**
 * UXC-02/03/07/13 -- the ONE shared column factory both `CoachMeetingsSection`
 * instances (Upcoming, Past) call, so `resolveColumnWidths` (pure over the
 * column defs) produces byte-identical `<th>` widths for both `Table`s
 * (criterion 9) -- unlike `buildCoachOutreachColumns`, this row's content
 * mapping (§1 of the packet) is IDENTICAL for both buckets (no
 * "Planned"/"Logged" split -- "Scheduled"/"held" and "Expected"/"Attended"
 * both apply the same way to an Upcoming or a Past row), so this factory
 * takes no `bucket` parameter at all.
 *
 * Width budget (measured against this route's real available width at
 * 1440px -- see this task's own worker output for the exact
 * `clientWidth`/`scrollWidth` numbers): `expander` carries the unchanged
 * `Session details (N)` wording (Trap 3b "keep the wording" branch), wider
 * than T130's `Sessions (N)`; `date` carries recurrence chips (up to
 * `MON (18)` plus siblings) and the canceled `Badge`, so it needs more room
 * than T130's 150px; `actions` carries only the `Edit` chip, so it needs far
 * less than T130's 128px.
 */
function buildCoachMeetingColumns({
  expandedEventIds,
  onToggleExpand,
  onEdit,
  onCancelRequest,
  onEditRequest,
  isNarrow,
}: BuildCoachMeetingColumnsArgs): TableColumn<CoachMeetingTableRow>[] {
  if (isNarrow) {
    // UXC-13 (<768px): every desktop column collapses into one stacked card
    // column, exactly as `buildCoachOutreachColumns`'s `isNarrow` branch
    // does -- the fixed desktop columns sum to well over 375px, so without
    // this the page scrolls horizontally (forbidden).
    return [
      {
        key: 'card',
        header: '',
        width: proportional(1),
        renderCell: (row) => {
          if (row.kind === 'sessionDetail') {
            return renderMeetingSessionDetailCell(row, onCancelRequest, onEditRequest);
          }
          const isExpanded = expandedEventIds.has(row.row.eventId);
          return (
            <VStack gap={2}>
              <CoachMeetingTitleCell row={row.row} />
              <CoachMeetingDateCell summary={row.summary} />
              <HStack gap={4} wrap="wrap">
                <StatCell
                  label="Scheduled"
                  value={formatHoursLabel(row.summary.plannedHours)}
                  secondary={`${formatHoursLabel(row.summary.loggedHours)} held`}
                />
                <StatCell
                  label="Expected"
                  value={`${row.summary.expectedCt}`}
                  secondary={`Attended ${row.summary.attendedCt}`}
                />
              </HStack>
              <HStack gap={2} wrap="wrap" vAlign="center">
                <CoachMeetingExpanderButton
                  row={row.row}
                  isExpanded={isExpanded}
                  onToggleExpand={onToggleExpand}
                />
              </HStack>
              <CoachMeetingRowActions row={row.row} onEdit={onEdit} />
            </VStack>
          );
        },
      },
    ];
  }

  return [
    {
      key: 'expander',
      header: '',
      width: pixel(170),
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        const isExpanded = expandedEventIds.has(row.row.eventId);
        return (
          <CoachMeetingExpanderButton
            row={row.row}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
          />
        );
      },
    },
    {
      key: 'date',
      header: 'Date',
      width: pixel(200),
      renderCell: (row) =>
        row.kind === 'event' ? <CoachMeetingDateCell summary={row.summary} /> : null,
    },
    {
      key: 'title',
      header: 'Meeting',
      width: proportional(2, { minWidth: 224 }),
      renderCell: (row) =>
        row.kind === 'event' ? (
          <CoachMeetingTitleCell row={row.row} />
        ) : (
          renderMeetingSessionDetailCell(row, onCancelRequest, onEditRequest)
        ),
    },
    {
      key: 'hours',
      header: '',
      width: pixel(130),
      align: 'end',
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        return (
          <StatCell
            label="Scheduled"
            value={formatHoursLabel(row.summary.plannedHours)}
            secondary={`${formatHoursLabel(row.summary.loggedHours)} held`}
          />
        );
      },
    },
    {
      key: 'count',
      header: '',
      width: pixel(158),
      align: 'end',
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        return (
          <StatCell
            label="Expected"
            value={`${row.summary.expectedCt}`}
            secondary={`Attended ${row.summary.attendedCt}`}
          />
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: pixel(80),
      renderCell: (row) =>
        row.kind === 'event' ? <CoachMeetingRowActions row={row.row} onEdit={onEdit} /> : null,
    },
  ];
}

function CoachMeetingsSection({
  title,
  rows,
  emptyDescription,
  expandedEventIds,
  onToggleExpand,
  onEdit,
  onCancelRequest,
  onEditRequest,
}: {
  title: string;
  rows: CoachMeetingRow[];
  emptyDescription: string;
  expandedEventIds: ReadonlySet<string>;
  onToggleExpand: (eventId: string) => void;
  onEdit: (row: CoachMeetingRow) => void;
  onCancelRequest: (
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ) => void;
  // T605 -- threaded alongside `onCancelRequest` (§6.2 item 5).
  onEditRequest: (eventId: string, eventTitle: string, session: CoachMeetingSessionDetail) => void;
}): ReactNode {
  // T129/UXC-01: stable id for this section's `Heading`, so the alternating
  // Table/EmptyState below gets the heading as its accessible name via
  // `aria-labelledby` on a wrapping `<div role="group">`, instead of relying
  // on `Table`'s own scroll wrapper (which hardcodes a generic
  // `role="group" aria-label="Table"`, `Table.tsx:160-161` -- not
  // bucket-specific). This component renders twice (Upcoming, Past), so
  // each call gets its own id. CHECKER FIX (rework of T129, MAJOR): see
  // `CoachHome.tsx`'s own module doc for why the wrapper is a plain
  // `<div role="group">`, not `Section` (full-bleed margin + no nameable
  // role).
  const headingId = useId();
  const isNarrow = useIsNarrowViewport();

  const tableRows = useMemo(
    () => buildCoachMeetingTableRows(rows, expandedEventIds),
    [rows, expandedEventIds],
  );

  const columns = useMemo(
    () =>
      buildCoachMeetingColumns({
        expandedEventIds,
        onToggleExpand,
        onEdit,
        onCancelRequest,
        onEditRequest,
        isNarrow,
      }),
    [expandedEventIds, onToggleExpand, onEdit, onCancelRequest, onEditRequest, isNarrow],
  );

  return (
    <VStack gap={3}>
      <Heading level={2} id={headingId}>
        {title}
      </Heading>
      <div role="group" aria-labelledby={headingId}>
        {rows.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={`No ${title.toLowerCase()} meetings`}
            description={emptyDescription}
            // T122 (module doc #10f, UXD-05(b)) -- compact: this is a
            // SUB-section of the page, never the only content on it.
            isCompact
          />
        ) : (
          <Table
            data={tableRows}
            columns={columns}
            idKey="id"
            density="compact"
            dividers="rows"
            hasHover
          />
        )}
      </div>
    </VStack>
  );
}

/** T096 (module doc #7c) -- real success/error messaging for Cancel and
 * Schedule, same "success Banner + error Banner, dismissable, same
 * `feedback` slot" pattern `StudentsTab.tsx`'s own `FeedbackBanner` (T089)
 * already established. */
interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

export interface CoachMeetingsViewProps {
  loadData: LoadCoachMeetingsDataFn;
  /** T096 (module doc #7c). Defaults to a real `event_sessions.status =
   * 'canceled'` mutation (`cancelMeetingSession`,
   * `../../lib/supabase/loaders/meetings.ts`). */
  onCancelSession: CancelMeetingSessionFn;
  /** T096 (module doc #7a). Passed straight through to
   * `<ScheduleMeetingsDialog onCreateMeetings={...} />`; defaults to a real
   * `events`/`event_sessions` insert (`createMeetings`, same loader module). */
  onCreateMeetings: OnCreateMeetingsFn;
  /** T510 (module doc #7b). Passed straight through to
   * `<ScheduleMeetingsDialog onSaveMeetingSeries={...} />`; defaults to a real
   * future-forward `events`/`event_sessions` reconciliation (`saveMeetingSeries`,
   * same loader module). */
  onSaveMeetingSeries: OnSaveMeetingSeriesFn;
  /** T605 (§6.2/§6.3). Passed straight through to
   * `<EditMeetingSessionDialog onSaveMeetingSession={...} />` (via
   * `handleSaveMeetingSessionSubmit` below); defaults to a real guarded,
   * in-place `event_sessions` update (`saveMeetingSession`, same loader
   * module). Mirrors `onSaveMeetingSeries`'s own identical four-point thread
   * exactly (§6.2). */
  onSaveMeetingSession: OnSaveMeetingSessionFn;
}

/** T122 (module doc #10d) -- Cancel now targets one SESSION within one
 * EVENT row, not a whole flat row. */
interface CancelTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
}

/** T605 -- which session (if any) `<EditMeetingSessionDialog>` is currently
 * editing; `null` => closed. Unlike `ScheduleMeetingsDialog`'s shared
 * create/edit instance (`isScheduleDialogOpen` + `editTarget`), this new
 * dialog has exactly one mode, so `editSessionTarget !== null` IS its own
 * `isOpen` -- same shape `cancelTarget`/`AlertDialog` below already use
 * (§6.2). */
interface EditSessionTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
  /** Every OTHER session's own `sessionDate` on this same event, any status
   * (§6.5's `sessionDateCollidesWithSibling`/§3.5's duplicate-date guard). */
  otherSessionDates: readonly string[];
}

export function CoachMeetingsView({
  loadData,
  onCancelSession,
  onCreateMeetings,
  onSaveMeetingSeries,
  onSaveMeetingSession,
}: CoachMeetingsViewProps): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<CoachMeetingRow[]>([]);
  // T147 -- real teams, populated the same two places `rows` is (the
  // initial-load effect below and the post-create reload,
  // `handleCreateMeetingsSubmit`), threaded to `<ScheduleMeetingsDialog>`'s
  // own `teams` prop.
  const [teams, setTeams] = useState<readonly Team[]>([]);
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  // T605 -- drives the one rendered `<EditMeetingSessionDialog>` instance
  // (§6.2).
  const [editSessionTarget, setEditSessionTarget] = useState<EditSessionTarget | null>(null);
  // T096 (module doc #7a) -- drives the one rendered `<ScheduleMeetingsDialog>`
  // instance, shared by both CREATE mode (`editTarget === null`) and T510's
  // real EDIT mode (`editTarget !== null`, module doc #7b).
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  // T510 (module doc #7b) -- which row (if any) `<ScheduleMeetingsDialog>` is
  // currently editing; `null` => create mode. Mirrors `OutreachList.tsx`'s own
  // `editingTarget` state.
  const [editTarget, setEditTarget] = useState<CoachMeetingRow | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  // T135 (Table migration, Trap 1/2) -- ONE expansion-state set for BOTH the
  // Upcoming and Past `CoachMeetingsSection` instances, deliberately NOT one
  // per instance (T130's own `OutreachList.tsx` placement, which does not
  // apply here -- see this file's own Table-migration module doc above).
  // Confirming a cancel can move a row from Upcoming to Past
  // (`handleConfirmCancel` below, `partitionCoachMeetingRows`'s own doc); a
  // per-section `Set` would silently re-collapse the row when it lands in
  // its new section's own, separately-mounted `Table`. Lifting the state
  // here means the SAME `Set` (and the same expanded-id membership) survives
  // the bucket move.
  const [expandedEventIds, setExpandedEventIds] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpand = useCallback((eventId: string): void => {
    setExpandedEventIds((previous) => {
      const next = new Set(previous);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(loadState.data.rows);
      setTeams(loadState.data.teams);
    }
  }, [loadState]);

  // T122 (module doc #10c) -- `partitionByStatus` no longer applies to
  // grouped event rows; see `partitionCoachMeetingRows`'s own doc.
  const { upcoming, past } = useMemo(() => partitionCoachMeetingRows(rows), [rows]);

  function openScheduleDialog(): void {
    setEditTarget(null);
    setIsScheduleDialogOpen(true);
  }

  // T510 (module doc #7b) -- `ScheduleMeetingsDialog.tsx` now has a real edit
  // mode; opens the SAME dialog instance already mounted for create, in EDIT
  // mode for this row.
  function openEditDialog(row: CoachMeetingRow): void {
    setEditTarget(row);
    setIsScheduleDialogOpen(true);
  }

  // T605 (§6.2) -- `rows` is already in scope; no new query, no widening of
  // `CoachMeetingSessionDetailTableRow`. `otherSessionDates` is every OTHER
  // session's own `sessionDate` on this same event, any status (mirrors
  // `computeMeetingSeriesReconcilePlan`'s own `allExistingDates` -- ANY
  // status, not just scheduled).
  function handleEditRequest(
    eventId: string,
    eventTitle: string,
    session: CoachMeetingSessionDetail,
  ): void {
    const row = rows.find((r) => r.eventId === eventId);
    const otherSessionDates = (row?.sessions ?? [])
      .filter((s) => s.sessionId !== session.sessionId)
      .map((s) => s.sessionDate);
    setEditSessionTarget({ eventId, eventTitle, session, otherSessionDates });
  }

  // T096 (module doc #7c) -- real mutation, optimistic update + rollback on
  // failure, mirroring `StudentsTab.tsx`'s own `handleConfirmDeactivate`
  // (T089) shape. T122 (module doc #10d) -- the optimistic flip/rollback now
  // targets one SESSION nested inside its EVENT row, not a flat row; the
  // mutation itself (`onCancelSession(sessionId)`) is byte-for-byte
  // unchanged.
  async function handleConfirmCancel(): Promise<void> {
    if (cancelTarget === null) return;
    const target = cancelTarget;
    setRows((prev) =>
      prev.map((row) =>
        row.eventId === target.eventId
          ? {
              ...row,
              sessions: row.sessions.map((session) =>
                session.sessionId === target.session.sessionId
                  ? { ...session, status: 'canceled' }
                  : session,
              ),
            }
          : row,
      ),
    );
    setCancelTarget(null);
    try {
      await onCancelSession(target.session.sessionId);
      setFeedback({
        status: 'success',
        title: 'Meeting session canceled',
        description: `"${target.eventTitle}" on ${formatWeekdayDate(target.session.sessionDate)} is marked canceled. No attendance will be recorded for it.`,
      });
    } catch (error) {
      setRows((prev) =>
        prev.map((row) =>
          row.eventId === target.eventId
            ? {
                ...row,
                sessions: row.sessions.map((session) =>
                  session.sessionId === target.session.sessionId
                    ? { ...session, status: target.session.status }
                    : session,
                ),
              }
            : row,
        ),
      );
      setFeedback({
        status: 'error',
        title: "Couldn't cancel meeting",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong canceling "${target.eventTitle}". Try again in a moment.`,
      });
    }
  }

  // T096 (module doc #7a) -- real `onCreateMeetings` wiring. Reloads `rows`
  // from `loadData()` on success (a full reload, not a client-side merge --
  // see module doc #7a for why).
  async function handleCreateMeetingsSubmit(payload: CreateMeetingsPayload): Promise<void> {
    await onCreateMeetings(payload);
    const sessionCount = payload.sessions.length;
    try {
      const fresh = await loadData();
      setRows(fresh.rows);
      setTeams(fresh.teams);
      setFeedback({
        status: 'success',
        title: 'Meetings scheduled',
        description: `${sessionCount} meeting${sessionCount === 1 ? '' : 's'} scheduled.`,
      });
    } catch {
      // The create itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal: `rows` just won't reflect
      // the new meeting(s) until the next successful load/retry.
      setFeedback({
        status: 'success',
        title: 'Meetings scheduled',
        description: `${sessionCount} meeting${sessionCount === 1 ? '' : 's'} scheduled. Refresh the page to see ${sessionCount === 1 ? 'it' : 'them'} in the list below.`,
      });
    }
  }

  // T510 (module doc #7b) -- real `onSaveMeetingSeries` wiring, mirroring
  // `handleCreateMeetingsSubmit`'s own reload-and-feedback shape.
  async function handleSaveMeetingSeriesSubmit(payload: SaveMeetingSeriesPayload): Promise<void> {
    await onSaveMeetingSeries(payload);
    try {
      const fresh = await loadData();
      setRows(fresh.rows);
      setTeams(fresh.teams);
      setFeedback({
        status: 'success',
        title: 'Meeting series updated',
        description: 'This meeting series was updated.',
      });
    } catch {
      // The save itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal: `rows` just won't reflect
      // the change until the next successful load/retry.
      setFeedback({
        status: 'success',
        title: 'Meeting series updated',
        description: 'This meeting series was updated. Refresh the page to see the change.',
      });
    }
  }

  // T605 (§6.2) -- real `onSaveMeetingSession` wiring, mirroring
  // `handleSaveMeetingSeriesSubmit`'s own identical reload-and-feedback shape
  // immediately above.
  async function handleSaveMeetingSessionSubmit(payload: SaveMeetingSessionPayload): Promise<void> {
    await onSaveMeetingSession(payload);
    try {
      const fresh = await loadData();
      setRows(fresh.rows);
      setTeams(fresh.teams);
      setFeedback({
        status: 'success',
        title: 'Meeting session updated',
        description: 'This meeting session was updated.',
      });
    } catch {
      // The save itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal: `rows` just won't reflect
      // the change until the next successful load/retry.
      setFeedback({
        status: 'success',
        title: 'Meeting session updated',
        description: 'This meeting session was updated. Refresh the page to see the change.',
      });
    }
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading meetings…
        </VisuallyHidden>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Skeleton width={140} height={28} index={0} />
          <Skeleton width={160} height={32} index={1} />
        </HStack>
        <VStack gap={3}>
          <Skeleton width={100} height={20} index={2} />
          <VStack gap={2}>
            {[0, 1, 2].map((row) => (
              <HStack key={row} gap={4} vAlign="center">
                <Skeleton width={220} height={16} index={row * 2 + 3} />
                <Skeleton width={80} height={16} index={row * 2 + 4} />
              </HStack>
            ))}
          </VStack>
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load meetings"
        description="Something went wrong loading this season's meetings. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  const hasAnyMeetings = rows.length > 0;

  return (
    <VStack gap={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>Meetings</Heading>
        <Button label="Schedule meetings" variant="primary" onClick={openScheduleDialog} />
      </HStack>

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      {!hasAnyMeetings ? (
        <EmptyState
          headingLevel={2}
          // DES-15 verbatim (PRD line 212): "No meetings scheduled. Set up
          // your weekly build meetings once and check-in takes care of
          // itself." -- title carries the first sentence, description the
          // second; concatenated they reproduce the PRD text exactly.
          title="No meetings scheduled."
          description="Set up your weekly build meetings once and check-in takes care of itself."
          actions={
            <Button label="Schedule meetings" variant="primary" onClick={openScheduleDialog} />
          }
        />
      ) : (
        <>
          <CoachMeetingsSection
            title="Upcoming"
            rows={upcoming}
            emptyDescription="No meetings are currently scheduled."
            expandedEventIds={expandedEventIds}
            onToggleExpand={toggleExpand}
            onEdit={openEditDialog}
            onCancelRequest={(eventId, eventTitle, session) =>
              setCancelTarget({ eventId, eventTitle, session })
            }
            onEditRequest={handleEditRequest}
          />
          <CoachMeetingsSection
            title="Past"
            rows={past}
            emptyDescription="Completed and canceled meetings will show up here."
            expandedEventIds={expandedEventIds}
            onToggleExpand={toggleExpand}
            onEdit={openEditDialog}
            onCancelRequest={(eventId, eventTitle, session) =>
              setCancelTarget({ eventId, eventTitle, session })
            }
            onEditRequest={handleEditRequest}
          />
        </>
      )}

      <AlertDialog
        isOpen={cancelTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCancelTarget(null);
        }}
        title={
          cancelTarget !== null
            ? `Cancel "${cancelTarget.eventTitle}" on ${formatWeekdayDate(cancelTarget.session.sessionDate)}?`
            : ''
        }
        description="This marks the session canceled. Students won't be expected to attend, and no attendance will be recorded for it."
        actionLabel="Cancel session"
        onAction={() => {
          void handleConfirmCancel();
        }}
      />

      {/* T096 (module doc #7a) -- `ScheduleMeetingsDialog.tsx` (T031,
          already Passed, already built) wired into this page for the first
          time. T147: `teams` now real too -- `loaders/meetings.ts`'s
          `makeLoadCoachMeetingsData` already fetched this list for its own
          per-row team-scope label; it is now threaded through
          `CoachMeetingsData`/this view's own `teams` state instead of the
          dialog falling back to its own `DEFAULT_TEAMS` fixture
          (`'team-ravens'`/`'team-titans'`, non-uuid strings that failed the
          real `events.team_ids uuid[]` insert -- the report that blocked
          meeting creation outright). No new query, no new round trip.
          T510 (module doc #7b) -- ONE dialog instance now serves BOTH create
          (`editTarget === null`) and edit (`editTarget !== null`) mode,
          mirroring `OutreachList.tsx`'s own `initialData` ternary shape.
          `onOpenChange` also clears `editTarget` on close, mirroring
          `OutreachList.tsx:3505-3508`, so the next "Schedule meetings" open
          never inherits a stale edit target. */}
      <ScheduleMeetingsDialog
        isOpen={isScheduleDialogOpen}
        onOpenChange={(nextIsOpen) => {
          setIsScheduleDialogOpen(nextIsOpen);
          if (!nextIsOpen) setEditTarget(null);
        }}
        teams={teams}
        onCreateMeetings={handleCreateMeetingsSubmit}
        initialData={
          editTarget !== null
            ? ({
                eventId: editTarget.eventId,
                title: editTarget.title,
                teamIds: editTarget.teamIds ?? null,
                locationName: editTarget.locationName,
                description: editTarget.description ?? '',
                sessions: editTarget.sessions.map((s) => ({
                  sessionId: s.sessionId,
                  sessionDate: s.sessionDate,
                  startsAt: s.startsAt,
                  endsAt: s.endsAt,
                  status: s.status,
                })),
              } satisfies EditMeetingSeriesInitialData)
            : undefined
        }
        onSaveMeetingSeries={handleSaveMeetingSeriesSubmit}
      />

      {/* T605 (§6.2) -- a SEPARATE, single-purpose dialog (not a second mode
          on `ScheduleMeetingsDialog`, which owns a series-wide schedule-mode
          model this fixed-identity single-session edit has no use for -- §6.4).
          `editSessionTarget !== null` IS its own `isOpen`, same shape the
          `cancelTarget`/`AlertDialog` pair above already uses -- this dialog
          has exactly one mode, unlike `ScheduleMeetingsDialog`'s shared
          create/edit instance. "Cancel this meeting" inside this dialog
          triggers the SAME `cancelTarget` state/`AlertDialog` above (§3.4) --
          no second confirmation, no second copy of that text, no second call
          to `onCancelSession`. */}
      <EditMeetingSessionDialog
        isOpen={editSessionTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditSessionTarget(null);
        }}
        initialData={
          editSessionTarget !== null
            ? ({
                eventId: editSessionTarget.eventId,
                eventTitle: editSessionTarget.eventTitle,
                session: {
                  sessionId: editSessionTarget.session.sessionId,
                  sessionDate: editSessionTarget.session.sessionDate,
                  startsAt: editSessionTarget.session.startsAt,
                  endsAt: editSessionTarget.session.endsAt,
                  notes: editSessionTarget.session.notes,
                },
                otherSessionDates: editSessionTarget.otherSessionDates,
              } satisfies EditMeetingSessionInitialData)
            : null
        }
        onSaveMeetingSession={handleSaveMeetingSessionSubmit}
        onRequestCancelSession={() => {
          if (editSessionTarget === null) return;
          setCancelTarget({
            eventId: editSessionTarget.eventId,
            eventTitle: editSessionTarget.eventTitle,
            session: editSessionTarget.session,
          });
          setEditSessionTarget(null);
        }}
      />
    </VStack>
  );
}
