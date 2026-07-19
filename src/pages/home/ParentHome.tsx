/**
 * T055: `/` Parent Home (HOME-03). One `Card` per linked student (name +
 * team badge, hours bar, participation %, next 3 events with RSVP status),
 * a per-event RSVP-on-behalf control (OUT-06 preview), and the literal
 * footer digest note.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `students`/`guardian_links` column shapes (constitution
 *    item 3), cited directly from
 *    `supabase/migrations/20260716000000_identity_roster.sql` (read-only):
 *
 *    `students` (lines 59-68): id, profile_id fk profiles null, display_name,
 *    team_id fk teams, grad_year null, is_active default true,
 *    goal_hours_override numeric null.
 *
 *    `guardian_links` (lines 72-79): id, parent_profile_id fk profiles,
 *    student_id fk students, relationship, created_at, unique(parent, student)
 *    -- genuinely one-to-many: a parent can have multiple rows, one per
 *    linked student. `LinkedStudentRow` below is the display-only join shape
 *    (studentId/displayName/teamId/goalHoursOverride) this page needs from
 *    `guardian_links` joined to `students` -- not a re-derivation of either
 *    table.
 *
 *    `events`/`event_sessions`/`rsvps` (`20260717000000_scheduling_attendance.sql`,
 *    lines 33-48 / 53-63 / 67-76): same subset `CoachHome.tsx`/`OutreachList.tsx`
 *    already cite -- `HomeEventRow`/`HomeSessionRow`/`HomeRsvpRow` below are
 *    verbatim camelCase renames, real status vocabularies used verbatim.
 *
 * -----------------------------------------------------------------------
 * 2. MET-01/MET-04 sourcing (constitution item 3, BLOCKER if re-derived).
 *
 * `supabase/migrations/20260717000003_metric_views.sql`:
 *   - `v_student_hours` (lines 3-19, MET-04's numerator): `student_id,
 *     season_id, confirmed_hours`. `StudentHoursMetric` below is a verbatim
 *     camelCase rename of these three columns; `findConfirmedHours` only
 *     LOOKS UP an already-computed row (defaulting to 0 when the student has
 *     none yet, the same "absence = 0, never re-derived" convention
 *     `CoachHome.tsx`'s `sumConfirmedHours` already established) -- it never
 *     recomputes an individual student's hours from raw attendance data.
 *   - MET-04's denominator (PRD line 541: `goal_hours_override ??
 *     season default_goal_hours`) has no SQL view for the ratio itself, only
 *     the numerator is a view column -- `studentGoalHours`/`hoursVsGoalPercent`
 *     below are the identical UI-side-percent-math idiom `CoachHome.tsx`'s
 *     `sumGoalHours`/`hoursVsGoalPercent` and `OutreachList.tsx`'s
 *     `confirmedPercent` already established and passed review for
 *     (independently reimplemented here, not imported -- both of those files
 *     are Forbidden Files/read-only reference only for this task).
 *   - `v_student_participation` (metric_views.sql lines 21-42, MET-01): NOT
 *     redefined here -- `StudentParticipationMetric` is imported directly
 *     from `StudentMeetingView.tsx`'s own already-checker-verified export
 *     (see module doc #3 below). This file performs NO percentage
 *     arithmetic on it anywhere (grep-provable: no `100.0 *`, no
 *     `/ greatest(` in this file) -- `findParticipationMetric` only LOOKS UP
 *     the row for a given student, `null` when absent (per that view's own
 *     "expected_ct = 0 rows simply absent" convention), same as
 *     `ConsistencyStrip`'s own null-handling already renders "—".
 *
 * -----------------------------------------------------------------------
 * 3. Reuse decision: `ConsistencyStrip` (T037, `StudentMeetingView.tsx`,
 *    already-Passed, read-only) IS reused here, and doubles as this page's
 *    "participation %" element too -- disclosed reasoning below (packet's
 *    explicit instruction to disclose either way).
 *
 * HOME-03's own literal field list (PRD line 265: "name + team badge, hours
 * bar, participation %, next 3 events with RSVP status; RSVP control on
 * behalf of student") does not separately name a "last 5 meetings" strip,
 * and the Parent Home wireframe (PRD lines 387-403, the authoritative
 * *structural intent* for this exact route -- constitution/PRD line 381)
 * shows only Hours/Participation/Next-up rows, no dot-strip element. BUT
 * BEH-06 itself (PRD line 235) explicitly names HOME-03 as one of the two
 * "student/parent meeting views" required to show the last-5-completed
 * `StatusDot` strip -- a BLOCKER-class constitution item (#17) directly
 * citing this route by name, which reads as stronger than the ledger-style
 * Acceptance line's own softer "if a meeting-history element is shown"
 * hedge.
 *
 * Resolution chosen: reuse the real, already-checker-verified `ConsistencyStrip`
 * component (imported directly from `StudentMeetingView.tsx`, NOT
 * reimplemented -- per this task's Known Context/Traps #1/Dependencies,
 * strongly preferred over new logic that could reintroduce the BEH-06 bug
 * class) as BOTH this card's meeting-history element AND its "participation
 * %" field, rather than rendering participation twice (once via a bespoke
 * `ProgressBar` and again inside the strip). `ConsistencyStrip` renders the
 * dot row (compact -- a handful of `StatusDot`s, not a heavy page-level
 * block) immediately above its own `ProgressBar`-backed participation
 * section, which satisfies PRD line 265's "participation %" requirement
 * exactly the same way `MeetingsList.tsx`'s own participation `ProgressBar`
 * already does, while ALSO satisfying BEH-06's explicit HOME-03 citation.
 * This does not conflict with the wireframe's own "structural intent, not
 * pixel spec" framing (PRD line 381) -- the wireframe's Hours/Participation/
 * Next-up regions are all still present and in the same relative order; the
 * dot strip is additive content within the existing "participation" region,
 * not an invented new page region.
 *
 * `selectLastCompletedAttendance` (the pure, exported, already-tested
 * last-5 selection function) is imported and called directly here too --
 * this file performs zero attendance-selection logic of its own.
 *
 * -----------------------------------------------------------------------
 * 4. Core structural requirement -- multiple linked students, one
 *    independent `Card` per student (Known Context/Traps #2), matching
 *    `StudentMeetingView.tsx`'s own `variant="linked"` architecture exactly
 *    (not just visually, but the SAME two-tier loading shape): an outer
 *    `loadLinkedStudents()` seam resolves the roster of linked students
 *    (`guardian_links` join `students`, plus `teams` for the badge name),
 *    then EACH student's `StudentHomeCard` independently calls its OWN
 *    `loadData(studentId, teamId)` seam and reaches its own DES-12
 *    loading/error/populated state on its own schedule -- there is no
 *    single shared loading gate across siblings, so one student's card can
 *    be loading (or erroring) while another's is already populated. See
 *    this task's worker output for a real test proving exactly that
 *    (deliberately staggered per-student load latencies), plus the
 *    already-covered "renders N independent cards, never assumes one
 *    child" case.
 *
 * A student-selector dropdown (show one child at a time) was rejected for
 * the same reason `StudentMeetingView.tsx`'s own module doc #6 already gave:
 * HOME-03's own wireframe (PRD line 387: "one card per linked student")
 * literally shows all children stacked and visible at once, not
 * single-select.
 *
 * -----------------------------------------------------------------------
 * 5. "Next 3 events" -- both meeting AND outreach sessions the student is
 *    scoped to (Known Context/Traps #4), competitions excluded, capped at
 *    exactly 3, no padding.
 *
 * `buildNextEventsForStudent` is the ONLY event-type/team-scope filter in
 * this file: `status === 'scheduled'` (not yet started/ended -- `endsAt >=
 * now`), `event.type` is `'meeting'` or `'outreach'` ONLY (a `'competition'`
 * session is excluded regardless of how soon it starts -- `NextEventRow`'s
 * own `type` field is typed as `'meeting' | 'outreach'`, not the full
 * `EventType` union, so this exclusion is enforced at the type level too,
 * not just at runtime), and the event is in the student's own team scope
 * (`isEventInTeamScope`, honoring `team_ids === null` as "all teams" per
 * the real schema, independently reimplemented -- same idiom
 * `CoachHome.tsx`'s `isEventInTeamScope` already established, not imported
 * since that file is Forbidden Files/read-only reference only here). Sorted
 * ascending by `startsAt`, sliced to exactly `limit` (default 3) -- no
 * padding step, so a student with fewer than 3 upcoming events gets that
 * many, never a fixed 3 with placeholder rows. The shipped fixture proves
 * BOTH boundary directions directly (not just asserted, see this task's
 * worker output): Ada has 5 upcoming meeting/outreach sessions in her own
 * team scope plus one earlier-dated but wrong-TYPE (competition) session
 * that must never appear regardless of date -- her card shows exactly the
 * nearest 3, the two furthest-out excluded; Bea has exactly 1 upcoming
 * session (on a DIFFERENT team, which also proves team-scope correctness
 * for both students using the same real fixture row: it appears on Bea's
 * card, never on Ada's) -- her card shows exactly 1, never padded to 3;
 * Cleo has zero -- her card falls back to its own inline `EmptyState`,
 * never a crash.
 *
 * -----------------------------------------------------------------------
 * 6. RSVP-on-behalf (OUT-06 preview) -- real, working, local-state only;
 *    explicitly NOT T043's full scope (Known Context/Traps #5).
 *
 * Per the Parent Home wireframe's own annotation (PRD line 396, "[Going▾]
 * ← RSVP-on-behalf (OUT-06)" on the OUTREACH row only, vs. line 397's
 * "meetings read-only" annotation on the meeting row), the RSVP control
 * renders ONLY on `type === 'outreach'` next-up rows; a `type === 'meeting'`
 * row renders plain read-only text, matching that same wireframe
 * distinction exactly (meetings are attendance-tracked via check-in, not
 * RSVP'd). `NextEventRowItem`'s `SegmentedControl` (Going/Maybe/Can't go,
 * the identical `RSVP_ITEMS` idiom `OutreachList.tsx`'s own student/parent
 * view already established) fires `applyRsvpOverride` on selection, which
 * updates this ONE card's own local `rsvps` state (synthesizing a new row
 * when none existed, same pattern `OutreachList.tsx`'s `withRsvpOverride`
 * already established, independently reimplemented here since that file is
 * Forbidden Files/read-only reference only) -- a real, immediately-visible
 * state change (the segment's checked state flips), not a no-op button.
 *
 * What this deliberately does NOT build (OUT-06's full scope, owned by
 * `ParentRsvp.tsx`/T043, currently Blocked, a Forbidden File never imported
 * here): no Supabase write/persistence anywhere in this file (Known Context/
 * Traps #7, same posture as every prior content page); no `responded_by =
 * parent` attribution copy rendered anywhere (`HomeRsvpRow` below DOES
 * carry a `respondedBy` field for schema fidelity with the real `rsvps`
 * table, but this file never reads or renders it -- OUT-06's own literal
 * text, PRD line 297, "Student sees 'Mom signed you up' (Timestamp +
 * responder name)" is explicitly a STUDENT-Home-surface concern, not
 * rendered on this parent-facing page regardless); no cross-role override
 * semantics (a student changing an RSVP a parent set, or vice versa) --
 * this card's local `rsvps` state is only ever written by this one parent
 * viewer's own control.
 *
 * -----------------------------------------------------------------------
 * 7. No shared Supabase client wired in yet -- same posture as every prior
 *    content page in this batch. `loadLinkedStudents`/`loadStudentData` are
 *    the injectable seams, defaulting to the OBVIOUSLY-FAKE
 *    `defaultLoadLinkedStudents`/`defaultLoadStudentHomeCardData` (fabricated
 *    names only, constitution item 6). A real implementation, once a shared
 *    Supabase client exists (a separate, not-yet-dispatched task per every
 *    sibling task's identical disclosure), would query `guardian_links`
 *    joined to `students`/`teams` for the outer seam, then
 *    `v_student_hours`/`v_student_participation`/`events`/`event_sessions`/
 *    `rsvps`/`attendance` scoped to one student for the per-card seam.
 *    `AuthUser` (`guards.tsx`) still carries no `guardian_links` linkage
 *    (the same disclosed gap `MeetingsList.tsx`/`OutreachList.tsx`/
 *    `CoachHome.tsx` already carry for their own viewer-linkage stand-ins)
 *    -- this page does not attempt to resolve "which parent is signed in"
 *    from `useAuth()`; `loadLinkedStudents()` stands in for "the linked
 *    students of whichever parent is currently viewing", the same class of
 *    provisional stand-in every sibling Home page has already disclosed.
 *
 * -----------------------------------------------------------------------
 * 8. No parent-name greeting ("Hi Maria", PRD's own wireframe chrome, line
 *    391) -- deliberately omitted, disclosed, not silently dropped.
 *
 * `AuthUser` carries only `{id, email, role}` -- no `display_name` (that
 * lives on `profiles`, not resolvable from the current auth stand-in
 * without inventing a new data source this task has no real seam for). The
 * wireframe's own framing (PRD line 381) is explicit that these sketches
 * are "structural intent, not pixel specs" and that "checkers verify region
 * placement and content presence, never ASCII fidelity" -- the greeting
 * line is page chrome, not a named field in HOME-03's own literal
 * requirement list (PRD line 265), so a generic `Heading level={1}>Home`
 * (the same top-of-page heading idiom `CoachHome.tsx` already uses) is used
 * instead of fabricating a parent display name from a linkage that does not
 * exist yet.
 *
 * -----------------------------------------------------------------------
 * 9. Footer digest note -- literal copy (Known Context/Traps #6), rendered
 *    verbatim, once, at the bottom of the page (not per-card, matching the
 *    wireframe's own placement, PRD lines 400-401, outside every student
 *    card).
 *
 * `"You get a weekly summary by email every Sunday — manage in Settings."`
 * is used character-for-character (PRD line 265's own literal quoted text),
 * rendered as a single contiguous `Text` node so it is trivially
 * grep-provable in the rendered DOM, never split across `title`/
 * `description` props or paraphrased.
 *
 * -----------------------------------------------------------------------
 * 10. Constitution item 13 -- no box-drawing/bracket characters rendered.
 *
 * Grep-provable: no `┌`/`─`/`│`/`[`/`]` character appears in any string
 * literal rendered by this file (the wireframe's own ASCII art in this
 * module doc's comments above is source-code commentary, never rendered
 * DOM). The one non-ASCII character actually rendered, the em dash `—`
 * (U+2014) in the footer copy and in date-range formatting, is a real
 * PRD-literal character, not a box-drawing glyph (U+2500 `─` is a distinct,
 * different codepoint).
 *
 * -----------------------------------------------------------------------
 * 11. `guards.tsx` `Role` vocabulary gap (same recurring, already-disclosed
 *     gap every sibling task in this batch carries) -- NOT re-derived here.
 *     This component only gates on `user === null` (signed-in check); it
 *     does not branch on `user.role` at all, since `ParentHome` is itself
 *     one of three distinct Home components (`CoachHome`/`StudentHome`/
 *     `ParentHome`, HOME-01/02/03) a future dispatcher chooses AMONG, the
 *     same posture `CoachHome.tsx`'s own module doc #7 already established
 *     for its sibling.
 *
 * -----------------------------------------------------------------------
 * 12. DES-12 four states, reached independently at TWO levels: the
 *     page-level `loadLinkedStudents` load (not-signed-in / loading / error
 *     / zero-linked-students empty / populated), and EACH card's own
 *     `loadData` load (loading / error / populated -- a card's own "empty"
 *     case, e.g. Cleo's zero-hours/zero-participation/zero-next-events
 *     student, is not a separate top-level branch, since a brand-new
 *     student's Hours bar and "Nothing scheduled" `EmptyState` are both
 *     still meaningful content, not nothing-to-show -- same posture
 *     `CoachHome.tsx`'s own module doc #11 already took for its KPI cards).
 *
 * -----------------------------------------------------------------------
 * 13. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cross-checked against `docs/swarm/astryx-api.md` directly, and
 *     re-confirmed live via `npm run astryx -- component <Name> --json` for
 *     this task (line numbers as of this task's read):
 *
 *  - `Card` (astryx-api.md line 294 section; that section's own body is
 *    `undefined`, the same disclosed CLI-cross-checked gap
 *    `RosterShell.tsx`/`MeetingsList.tsx`/`OutreachList.tsx` already hit --
 *    `npm run astryx -- component Card --json`, run live for this task,
 *    resolves `children`, `padding` -- only those two used, both default).
 *  - `Heading`: doc's own "Heading" subsection body IS populated for this
 *    CLI version (unlike prior tasks' disclosed gap) and matches the live
 *    `npm run astryx -- component Heading --json` re-run for this task:
 *    `level` (1-6, required), `children` (required) -- only those two used.
 *  - `Badge` (line 493 section, Props table): `variant` (`'blue'`,
 *    category-tag usage for the team-name badge and the read-only-meeting
 *    marker -- per the doc's own "Do: use color variants for category tags
 *    that group or classify items"), `label` used.
 *  - `ProgressBar` (line 5416 section, Props table): `label` (required),
 *    `value`, `max`, `isLabelHidden`, `hasValueLabel`, `formatValueLabel`
 *    used -- the same idiom `CoachHome.tsx`/`OutreachList.tsx` already
 *    established for a pre-computed hours-vs-goal ratio.
 *  - `SegmentedControl` (line 5575 section, Props table): `value`
 *    (required), `onChange` (required), `label` (required) used.
 *    `SegmentedControlItem`'s own subsection (line 5615): `value`
 *    (required), `label` (required) used.
 *  - `List`/`ListItem` (line 4536 section): `List`'s Props table
 *    (`children`, `hasDividers`, `header`) used directly. `ListItem`
 *    (astryx-api.md line 4588 section): `label` (required), `description`,
 *    `endContent` used -- no `onClick`/`href` (rows are not interactive).
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description`, `headingLevel`, `isCompact` used.
 *  - `Spinner` (line 5808 section, Props table): `label` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description` used.
 *  - `Layout`/`LayoutContent` (line 167/276 sections): `Layout`'s `height`,
 *    `content` used; `LayoutContent`'s `padding` used (same skeleton
 *    `CoachHome.tsx` already established for a Home-family page).
 *  - `Divider` (line 543 section): no props used (default), separating the
 *    per-student cards from the footer note.
 *  - `Text` (line 829 section, Props table): `type` (`'label'`,
 *    `'supporting'`), `color` used.
 *  - `VStack`/`HStack` ("Stack" section, `VStack`/`HStack` subsections,
 *    lines 350/374): `gap`, `hAlign`, `vAlign`, `wrap`, `padding` used.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Card,
  Divider,
  EmptyState,
  Heading,
  HStack,
  Layout,
  LayoutContent,
  List,
  ListItem,
  ProgressBar,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
  Text,
  VStack,
} from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import {
  ConsistencyStrip,
  selectLastCompletedAttendance,
  type ConsistencyAttendanceRecord,
  type ConsistencySession,
  type ConsistencyStripEntry,
  type StudentParticipationMetric,
} from '../meetings/StudentMeetingView';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real columns/views. Module docs #1/#2.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

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

export interface HomeTeamRow {
  id: string;
  name: string;
}

/** Display-only `guardian_links` join `students` shape (module doc #1) --
 * NOT a re-derivation of either table. */
export interface LinkedStudentRow {
  studentId: string;
  displayName: string;
  teamId: string;
  goalHoursOverride: number | null;
}

export interface HomeEventRow {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  /** `null` = all teams, per `events.team_ids` (module doc #1). */
  teamIds: readonly string[] | null;
}

/**
 * Same real `event_sessions` row used for BOTH upcoming (`status ===
 * 'scheduled'`) and completed (`status === 'completed'`) sessions -- one
 * table, per the real schema, serving both this page's "Next up" rows and
 * (structurally assignable to `ConsistencySession`, module doc #3) the
 * reused `ConsistencyStrip`'s last-5-completed selection.
 */
export interface HomeSessionRow {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

export interface HomeRsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  /** Schema-faithful field (module doc #6) -- never read/rendered by this
   * file. OUT-06's "Mom signed you up" attribution copy is T043's job. */
  respondedBy: string | null;
  updatedAt: string;
}

/** Verbatim camelCase rename of `v_student_hours`'s three real columns
 * (module doc #2, MET-04's numerator). Never recomputed from raw
 * attendance in this file -- only looked up. */
export interface StudentHoursMetric {
  studentId: string;
  seasonId: string;
  confirmedHours: number;
}

export interface LinkedStudentsResult {
  students: readonly LinkedStudentRow[];
  teams: readonly HomeTeamRow[];
}

export type LoadLinkedStudentsFn = () => Promise<LinkedStudentsResult>;

/** Only meeting/outreach sessions are ever selectable (module doc #5) --
 * `type` is deliberately narrower than the full `EventType` union so a
 * competition session can never be assigned to a `NextEventRow` at the type
 * level, not just filtered out at runtime. */
export interface NextEventRow {
  sessionId: string;
  eventId: string;
  title: string;
  type: 'meeting' | 'outreach';
  sessionDate: string;
  startsAt: string;
  endsAt: string;
}

export interface StudentHomeCardData {
  defaultGoalHours: number;
  confirmedHours: number;
  participation: StudentParticipationMetric | null;
  consistencyEntries: readonly ConsistencyStripEntry[];
  nextEvents: readonly NextEventRow[];
  /** Only this student's own RSVPs for sessions appearing in `nextEvents`
   * (module doc #6) -- enough to seed the local RSVP-on-behalf state. */
  rsvps: readonly HomeRsvpRow[];
}

export type LoadStudentHomeCardDataFn = (
  studentId: string,
  teamId: string,
) => Promise<StudentHomeCardData>;

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #7.
// ---------------------------------------------------------------------------

const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Reference
// instant matches this task's real sandbox date (2026-07-19), same as
// `CoachHome.tsx`'s own `FIXTURE_REFERENCE_NOW`.
// ---------------------------------------------------------------------------

export const FIXTURE_REFERENCE_NOW = new Date('2026-07-19T12:00:00.000Z');

const TEAM_GEAR_GIRLS = 'team-gear-girls';
const TEAM_P3 = 'team-p3';
const TEAM_IRON_WOLVES = 'team-iron-wolves';

const FIXTURE_TEAMS: readonly HomeTeamRow[] = [
  { id: TEAM_GEAR_GIRLS, name: 'Gear Girls' },
  { id: TEAM_P3, name: 'P3' },
  { id: TEAM_IRON_WOLVES, name: 'Iron Wolves' },
];

const STUDENT_ADA = 'student-ada-fixture';
const STUDENT_BEA = 'student-bea-fixture';
const STUDENT_CLEO = 'student-cleo-fixture';

/**
 * Three linked students (module doc #4) -- proves the "one Card per linked
 * student" requirement is genuinely plural, not a single-child assumption.
 * Ada: rich populated card (5 upcoming events capped to 3, 5 completed
 * meetings capped to 5, an existing outreach RSVP). Bea: sparse-but-real
 * card (exactly 1 upcoming event, 2 completed meetings, an unanswered
 * outreach RSVP) -- on a DIFFERENT team, doubling as the team-scope
 * exclusion proof for Ada. Cleo: genuinely empty card (0 upcoming events, 0
 * completed meetings, no participation row, a goal override) -- proves the
 * empty-but-not-crashing case, never a page-level EmptyState.
 */
const FIXTURE_STUDENTS: readonly LinkedStudentRow[] = [
  {
    studentId: STUDENT_ADA,
    displayName: 'Ada R.',
    teamId: TEAM_GEAR_GIRLS,
    goalHoursOverride: null,
  },
  { studentId: STUDENT_BEA, displayName: 'Bea R.', teamId: TEAM_P3, goalHoursOverride: null },
  {
    studentId: STUDENT_CLEO,
    displayName: 'Cleo R.',
    teamId: TEAM_IRON_WOLVES,
    goalHoursOverride: 20,
  },
];

const FIXTURE_DEFAULT_GOAL_HOURS = 100;

/** Pre-computed `v_student_hours` rows (module doc #2) -- never recomputed.
 * Ada's 62/100 matches the PRD's own Parent Home wireframe worked example
 * (line 393, "62/100 h"). Bea has no row yet (module doc #2's "absence, not
 * a fabricated 0" convention -- `findConfirmedHours` below defaults such an
 * absence to 0, the same convention `CoachHome.tsx`'s `sumConfirmedHours`
 * already established for a roster sum). */
const FIXTURE_HOURS: readonly StudentHoursMetric[] = [
  { studentId: STUDENT_ADA, seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 62 },
  { studentId: STUDENT_CLEO, seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 5 },
];

/**
 * Pre-computed `v_student_participation` rows (module doc #2/#3) -- never
 * recomputed by this file. Ada: round(100*20/(26-3),1) = 87.0, matching the
 * PRD wireframe's own "Participation 87%" worked example (line 394). Bea:
 * round(100*3/(4-0),1) = 75.0. Cleo has no row at all (no completed
 * sessions yet this season) -- `ConsistencyStrip` renders "—", never a
 * fabricated 0%.
 */
const FIXTURE_PARTICIPATION: readonly StudentParticipationMetric[] = [
  {
    studentId: STUDENT_ADA,
    teamId: TEAM_GEAR_GIRLS,
    seasonId: PLACEHOLDER_SEASON_ID,
    expectedCt: 26,
    presentCt: 20,
    lateCt: 2,
    excusedCt: 3,
    participationPct: 87,
  },
  {
    studentId: STUDENT_BEA,
    teamId: TEAM_P3,
    seasonId: PLACEHOLDER_SEASON_ID,
    expectedCt: 4,
    presentCt: 3,
    lateCt: 0,
    excusedCt: 0,
    participationPct: 75,
  },
];

const EVENT_GEAR_BUILD = 'event-gear-build'; // meeting, Gear Girls
const EVENT_GEAR_FAIR = 'event-gear-fair'; // outreach, Gear Girls
const EVENT_GEAR_REGIONALS = 'event-gear-regionals'; // competition, Gear Girls
const EVENT_P3_OUTREACH = 'event-p3-outreach'; // outreach, P3
const EVENT_P3_BUILD = 'event-p3-build'; // meeting, P3 (completed sessions only)

const FIXTURE_EVENTS: readonly HomeEventRow[] = [
  {
    id: EVENT_GEAR_BUILD,
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Build Meeting',
    teamIds: [TEAM_GEAR_GIRLS],
  },
  {
    id: EVENT_GEAR_FAIR,
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'STEM Fair',
    teamIds: [TEAM_GEAR_GIRLS],
  },
  // Deliberately dated EARLIER than every meeting/outreach session below but
  // must NEVER appear in Ada's "Next 3" -- proves type-exclusion holds even
  // when it would otherwise sort first (module doc #5).
  {
    id: EVENT_GEAR_REGIONALS,
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'competition',
    title: 'Regionals Kickoff',
    teamIds: [TEAM_GEAR_GIRLS],
  },
  {
    id: EVENT_P3_OUTREACH,
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Garden Day',
    teamIds: [TEAM_P3],
  },
  {
    id: EVENT_P3_BUILD,
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'P3 Weekly Meeting',
    teamIds: [TEAM_P3],
  },
];

const SESSION_ADA_UP_1 = 'session-ada-up-1';
const SESSION_ADA_UP_2 = 'session-ada-up-2'; // STEM Fair -- has an existing RSVP
const SESSION_ADA_UP_3 = 'session-ada-up-3';
const SESSION_ADA_UP_4 = 'session-ada-up-4'; // must be excluded -- 4th nearest
const SESSION_ADA_UP_5 = 'session-ada-up-5'; // must be excluded -- 5th nearest
const SESSION_ADA_COMPETITION = 'session-ada-competition'; // must never appear
const SESSION_BEA_UP_1 = 'session-bea-up-1'; // Bea's ONLY upcoming session

const FIXTURE_SESSIONS: readonly HomeSessionRow[] = [
  // Ada -- 5 upcoming meeting/outreach sessions (module doc #5 boundary proof).
  {
    id: SESSION_ADA_UP_1,
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-07-21',
    startsAt: '2026-07-21T23:00:00.000Z',
    endsAt: '2026-07-22T01:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: SESSION_ADA_UP_2,
    eventId: EVENT_GEAR_FAIR,
    sessionDate: '2026-07-25',
    startsAt: '2026-07-25T14:00:00.000Z',
    endsAt: '2026-07-25T17:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: SESSION_ADA_UP_3,
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-07-28',
    startsAt: '2026-07-28T23:00:00.000Z',
    endsAt: '2026-07-29T01:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: SESSION_ADA_UP_4,
    eventId: EVENT_GEAR_FAIR,
    sessionDate: '2026-08-01',
    startsAt: '2026-08-01T14:00:00.000Z',
    endsAt: '2026-08-01T17:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: SESSION_ADA_UP_5,
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-08-04',
    startsAt: '2026-08-04T23:00:00.000Z',
    endsAt: '2026-08-05T01:00:00.000Z',
    status: 'scheduled',
  },
  // Earlier-dated than all five above, but a competition -- must never
  // appear in Ada's Next 3 (module doc #5).
  {
    id: SESSION_ADA_COMPETITION,
    eventId: EVENT_GEAR_REGIONALS,
    sessionDate: '2026-07-20',
    startsAt: '2026-07-20T15:00:00.000Z',
    endsAt: '2026-07-20T20:00:00.000Z',
    status: 'scheduled',
  },
  // Ada -- 5 COMPLETED meeting sessions (consistency strip cap-at-5 proof).
  {
    id: 'session-ada-completed-1',
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-05-27',
    startsAt: '2026-05-27T23:00:00.000Z',
    endsAt: '2026-05-28T01:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-ada-completed-2',
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-06-03',
    startsAt: '2026-06-03T23:00:00.000Z',
    endsAt: '2026-06-04T01:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-ada-completed-3',
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-06-10',
    startsAt: '2026-06-10T23:00:00.000Z',
    endsAt: '2026-06-11T01:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-ada-completed-4',
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-06-17',
    startsAt: '2026-06-17T23:00:00.000Z',
    endsAt: '2026-06-18T01:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-ada-completed-5',
    eventId: EVENT_GEAR_BUILD,
    sessionDate: '2026-06-24',
    startsAt: '2026-06-24T23:00:00.000Z',
    endsAt: '2026-06-25T01:00:00.000Z',
    status: 'completed',
  },
  // Bea -- exactly 1 upcoming session (module doc #5 fewer-than-limit proof;
  // ALSO the team-scope exclusion proof for Ada, since it's P3-only).
  {
    id: SESSION_BEA_UP_1,
    eventId: EVENT_P3_OUTREACH,
    sessionDate: '2026-07-26',
    startsAt: '2026-07-26T15:00:00.000Z',
    endsAt: '2026-07-26T18:00:00.000Z',
    status: 'scheduled',
  },
  // Bea -- 2 COMPLETED meeting sessions (fewer-than-5, no padding).
  {
    id: 'session-bea-completed-1',
    eventId: EVENT_P3_BUILD,
    sessionDate: '2026-06-10',
    startsAt: '2026-06-10T23:00:00.000Z',
    endsAt: '2026-06-11T01:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-bea-completed-2',
    eventId: EVENT_P3_BUILD,
    sessionDate: '2026-06-17',
    startsAt: '2026-06-17T23:00:00.000Z',
    endsAt: '2026-06-18T01:00:00.000Z',
    status: 'completed',
  },
  // Cleo has zero sessions of any kind -- the genuinely-empty case.
];

/** All four `AttendanceStatus` values across Ada's 5 completed sessions
 * (proves DES-05's full mapping is reachable through this page's own
 * wiring, on top of `StudentMeetingView.test.tsx`'s own already-passed
 * unit coverage of the mapping itself). */
const FIXTURE_ATTENDANCE: readonly ConsistencyAttendanceRecord[] = [
  { sessionId: 'session-ada-completed-1', studentId: STUDENT_ADA, status: 'present' },
  { sessionId: 'session-ada-completed-2', studentId: STUDENT_ADA, status: 'late' },
  { sessionId: 'session-ada-completed-3', studentId: STUDENT_ADA, status: 'excused' },
  { sessionId: 'session-ada-completed-4', studentId: STUDENT_ADA, status: 'absent' },
  { sessionId: 'session-ada-completed-5', studentId: STUDENT_ADA, status: 'present' },
  { sessionId: 'session-bea-completed-1', studentId: STUDENT_BEA, status: 'present' },
  { sessionId: 'session-bea-completed-2', studentId: STUDENT_BEA, status: 'late' },
];

const FIXTURE_RSVPS: readonly HomeRsvpRow[] = [
  // Ada already answered "maybe" for STEM Fair -- the SegmentedControl must
  // reflect that as the pre-checked segment (module doc #6).
  {
    id: 'rsvp-ada-fair',
    sessionId: SESSION_ADA_UP_2,
    studentId: STUDENT_ADA,
    status: 'maybe',
    respondedBy: STUDENT_ADA,
    updatedAt: '2026-07-18T12:00:00.000Z',
  },
  // Bea's only upcoming (outreach) session has NO rsvp row yet -- the
  // "unanswered" case (module doc #6).
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#5/#6.
// ---------------------------------------------------------------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The ONLY team-scope predicate in this file -- honors `team_ids === null`
 * as "all teams" per the real `events` schema (module doc #1/#5).
 * Independently reimplemented, same idiom as `CoachHome.tsx`'s own
 * `isEventInTeamScope` (Forbidden Files/read-only reference only here). */
export function isEventInTeamScope(
  event: { teamIds: readonly string[] | null },
  teamId: string,
): boolean {
  return event.teamIds === null || event.teamIds.includes(teamId);
}

/** MET-04's denominator (module doc #2): `goal_hours_override ??
 * default_goal_hours`. */
export function studentGoalHours(
  student: { goalHoursOverride: number | null },
  defaultGoalHours: number,
): number {
  return student.goalHoursOverride ?? defaultGoalHours;
}

/** UI-side percent math, no metric-view equivalent to duplicate (module doc
 * #2) -- same idiom `CoachHome.tsx`/`OutreachList.tsx` already established. */
export function hoursVsGoalPercent(confirmedHours: number, goalHours: number): number {
  if (goalHours <= 0) return 0;
  return Math.min(100, round1((confirmedHours / goalHours) * 100));
}

/** Looks up an already-computed `v_student_hours` row; 0 when the student
 * has none yet (module doc #2) -- never recomputed. */
export function findConfirmedHours(
  studentId: string,
  seasonId: string,
  hours: readonly StudentHoursMetric[],
): number {
  return (
    hours.find((row) => row.studentId === studentId && row.seasonId === seasonId)?.confirmedHours ??
    0
  );
}

/** Looks up an already-computed `v_student_participation` row; `null` when
 * absent (module doc #2/#3) -- never recomputed, never a fabricated 0%. */
export function findParticipationMetric(
  studentId: string,
  participation: readonly StudentParticipationMetric[],
): StudentParticipationMetric | null {
  return participation.find((row) => row.studentId === studentId) ?? null;
}

export const NEXT_EVENTS_LIMIT = 3;

/**
 * "Next 3 events" (module doc #5) -- the ONLY event-type/team-scope/status
 * filter for the Next-up section. `status === 'scheduled'` and not yet
 * ended (`endsAt >= nowMs`), `type` is `'meeting'` or `'outreach'` ONLY
 * (competitions excluded), and the event is in this student's own team
 * scope. Sorted ascending by `startsAt`, capped at exactly `limit` -- no
 * padding, so a student with fewer than `limit` upcoming events gets that
 * many back, never a fixed count with placeholder rows.
 */
export function buildNextEventsForStudent(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  teamId: string,
  nowMs: number,
  limit: number = NEXT_EVENTS_LIMIT,
): NextEventRow[] {
  const eventById = new Map(
    events
      .filter(
        (event) =>
          (event.type === 'meeting' || event.type === 'outreach') &&
          isEventInTeamScope(event, teamId),
      )
      .map((event) => [event.id, event] as const),
  );

  return sessions
    .filter((session) => {
      if (session.status !== 'scheduled' || !eventById.has(session.eventId)) return false;
      return new Date(session.endsAt).getTime() >= nowMs;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit)
    .map((session) => {
      // Narrowing is safe: `eventById` was built from meeting/outreach
      // events only (module doc #5), so `event.type` here is never
      // `'competition'`.
      const event = eventById.get(session.eventId)!;
      return {
        sessionId: session.id,
        eventId: event.id,
        title: event.title,
        type: event.type as 'meeting' | 'outreach',
        sessionDate: session.sessionDate,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      };
    });
}

/**
 * Applies a local (fixture-only, not persisted -- module doc #6) RSVP
 * change for one student/session pair, synthesizing a new row when none
 * existed yet. Independently reimplemented -- same idiom
 * `OutreachList.tsx`'s `withRsvpOverride` already established (Forbidden
 * Files/read-only reference only here).
 */
export function applyRsvpOverride(
  rsvps: readonly HomeRsvpRow[],
  studentId: string,
  sessionId: string,
  status: RsvpStatus,
): HomeRsvpRow[] {
  const now = new Date().toISOString();
  const existingIndex = rsvps.findIndex(
    (rsvp) => rsvp.studentId === studentId && rsvp.sessionId === sessionId,
  );
  if (existingIndex === -1) {
    const newRow: HomeRsvpRow = {
      id: `local-rsvp-${studentId}-${sessionId}`,
      sessionId,
      studentId,
      status,
      respondedBy: null, // module doc #6: attribution is T043's job, never set here.
      updatedAt: now,
    };
    return [...rsvps, newRow];
  }
  return rsvps.map((rsvp, index) =>
    index === existingIndex ? { ...rsvp, status, updatedAt: now } : rsvp,
  );
}

// ---------------------------------------------------------------------------
// Fixture loaders -- obviously-fake defaults for the injectable `loadData`
// seams (module doc #7). Real callers (once a shared Supabase client is
// wired to a page -- a separate, not-yet-dispatched task) pass their own.
// ---------------------------------------------------------------------------

export async function defaultLoadLinkedStudents(): Promise<LinkedStudentsResult> {
  return { students: FIXTURE_STUDENTS, teams: FIXTURE_TEAMS };
}

export async function defaultLoadStudentHomeCardData(
  studentId: string,
  teamId: string,
): Promise<StudentHomeCardData> {
  const nextEvents = buildNextEventsForStudent(
    FIXTURE_SESSIONS,
    FIXTURE_EVENTS,
    teamId,
    FIXTURE_REFERENCE_NOW.getTime(),
  );
  const nextEventSessionIds = new Set(nextEvents.map((event) => event.sessionId));
  return {
    defaultGoalHours: FIXTURE_DEFAULT_GOAL_HOURS,
    confirmedHours: findConfirmedHours(studentId, PLACEHOLDER_SEASON_ID, FIXTURE_HOURS),
    participation: findParticipationMetric(studentId, FIXTURE_PARTICIPATION),
    consistencyEntries: selectLastCompletedAttendance(
      FIXTURE_SESSIONS as readonly ConsistencySession[],
      FIXTURE_ATTENDANCE,
      studentId,
    ),
    nextEvents,
    rsvps: FIXTURE_RSVPS.filter(
      (rsvp) => rsvp.studentId === studentId && nextEventSessionIds.has(rsvp.sessionId),
    ),
  };
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `OutreachList.tsx`/`CoachHome.tsx` are Forbidden Files/read-only
// reference only for this task.
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

/** `session_date` ('YYYY-MM-DD') -> a real calendar date, parsed without a
 * local-timezone day-shift. */
function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

function formatSessionDateOnly(row: { sessionDate: string }): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(row.sessionDate));
}

function formatSessionDateTime(row: {
  sessionDate: string;
  startsAt: string;
  endsAt: string;
}): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(row.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(row.endsAt));
  return `${formatSessionDateOnly(row)} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- same shape every sibling page uses.
// ---------------------------------------------------------------------------

type LoadState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) setState({ status: 'error', error });
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list.
  }, deps);

  return state;
}

// ---------------------------------------------------------------------------
// RSVP-on-behalf control -- module doc #6.
// ---------------------------------------------------------------------------

const RSVP_ITEMS: readonly { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't go" },
];

/** Not a real RSVP status -- never matches an actual `SegmentedControlItem`
 * value, so passing it as `value` leaves the control visually unselected,
 * the correct representation of "no RSVP row exists yet". */
const UNANSWERED_RSVP_SEGMENT_VALUE = 'unanswered';

/** The only Badge variant this file needs for the read-only meeting-row
 * marker (module doc #6) -- category-tag usage per astryx-api.md's own
 * "use color variants for category tags" guidance. */
const MEETING_ROW_BADGE_VARIANT: BadgeVariant = 'blue';

function NextEventRowItem({
  row,
  studentDisplayName,
  status,
  onRsvpChange,
}: {
  row: NextEventRow;
  studentDisplayName: string;
  status: RsvpStatus | null;
  onRsvpChange: (sessionId: string, status: RsvpStatus) => void;
}): ReactNode {
  const description = <Text type="supporting">{formatSessionDateTime(row)}</Text>;

  // Module doc #6: RSVP-on-behalf control ONLY on outreach rows -- meeting
  // rows are read-only (attendance is tracked via check-in, not RSVP),
  // matching the Parent Home wireframe's own annotation distinction.
  const endContent =
    row.type === 'outreach' ? (
      <SegmentedControl
        value={status ?? UNANSWERED_RSVP_SEGMENT_VALUE}
        onChange={(value) => onRsvpChange(row.sessionId, value as RsvpStatus)}
        label={`RSVP on behalf of ${studentDisplayName} for ${row.title} on ${formatSessionDateOnly(row)}`}
      >
        {RSVP_ITEMS.map((item) => (
          <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
        ))}
      </SegmentedControl>
    ) : (
      <Badge variant={MEETING_ROW_BADGE_VARIANT} label="Meeting — read-only" />
    );

  return <ListItem label={row.title} description={description} endContent={endContent} />;
}

// ---------------------------------------------------------------------------
// One student's Card -- module doc #4. Independently loads/renders (own
// DES-12 states), matching `StudentMeetingView.tsx`'s `variant="linked"`
// per-child independence exactly.
// ---------------------------------------------------------------------------

interface StudentHomeCardProps {
  studentId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  goalHoursOverride: number | null;
  loadData: LoadStudentHomeCardDataFn;
}

function StudentHomeCard({
  studentId,
  displayName,
  teamId,
  teamName,
  goalHoursOverride,
  loadData,
}: StudentHomeCardProps): ReactNode {
  const loadState = useLoadState(() => loadData(studentId, teamId), [loadData, studentId, teamId]);
  const [rsvps, setRsvps] = useState<readonly HomeRsvpRow[]>([]);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRsvps(loadState.data.rsvps);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only on load-state transitions.
  }, [loadState]);

  if (loadState.status === 'loading') {
    return (
      <Card>
        <Spinner label={`Loading ${displayName}'s Home card…`} />
      </Card>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Card>
        <Banner
          status="error"
          title="Couldn't load this student's Home card"
          description="Something went wrong loading this student's data. Try refreshing the page."
        />
      </Card>
    );
  }

  const data = loadState.data;
  const goalHours = studentGoalHours({ goalHoursOverride }, data.defaultGoalHours);
  const hoursPercent = hoursVsGoalPercent(data.confirmedHours, goalHours);

  function handleRsvpChange(sessionId: string, status: RsvpStatus): void {
    setRsvps((prev) => applyRsvpOverride(prev, studentId, sessionId, status));
  }

  return (
    <Card>
      <VStack gap={4}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Heading level={3}>{displayName}</Heading>
          <Badge variant="blue" label={teamName} />
        </HStack>

        <VStack gap={1}>
          <Text type="label">Hours vs. goal</Text>
          <ProgressBar
            label={`${displayName}'s hours vs. goal`}
            isLabelHidden
            value={data.confirmedHours}
            max={goalHours > 0 ? goalHours : 1}
            hasValueLabel
            formatValueLabel={(value, max) => `${value} / ${max} h (${hoursPercent}%)`}
          />
        </VStack>

        <ConsistencyStrip entries={data.consistencyEntries} participation={data.participation} />

        <VStack gap={2}>
          <Heading level={4}>Next up</Heading>
          {data.nextEvents.length === 0 ? (
            <EmptyState
              headingLevel={5}
              isCompact
              title="Nothing scheduled"
              description={`${displayName}'s next meetings and outreach events will show up here.`}
            />
          ) : (
            <List hasDividers header={`${displayName}'s next events`}>
              {data.nextEvents.map((row) => (
                <NextEventRowItem
                  key={row.sessionId}
                  row={row}
                  studentDisplayName={displayName}
                  status={rsvps.find((rsvp) => rsvp.sessionId === row.sessionId)?.status ?? null}
                  onRsvpChange={handleRsvpChange}
                />
              ))}
            </List>
          )}
        </VStack>
      </VStack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Top-level component -- module docs #4/#8/#9/#11/#12.
// ---------------------------------------------------------------------------

export interface ParentHomeProps {
  /** Injectable outer data-loading seam (module doc #7). Defaults to
   * fixture data. */
  loadLinkedStudents?: LoadLinkedStudentsFn;
  /** Injectable per-student data-loading seam (module doc #4/#7). Defaults
   * to fixture data. */
  loadStudentData?: LoadStudentHomeCardDataFn;
}

/** PRD line 265's own literal footer copy, verbatim (module doc #9). */
export const WEEKLY_SUMMARY_FOOTER_NOTE =
  'You get a weekly summary by email every Sunday — manage in Settings.';

export function ParentHome({
  loadLinkedStudents = defaultLoadLinkedStudents,
  loadStudentData = defaultLoadStudentHomeCardData,
}: ParentHomeProps = {}): ReactNode {
  const { user } = useAuth();
  const loadState = useLoadState(loadLinkedStudents, [loadLinkedStudents]);

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          title="Sign in to view Home"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6}>
        <Spinner label="Loading Home…" />
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load Home"
          description="Something went wrong loading your linked students. Try refreshing the page."
        />
      </VStack>
    );
  }

  const { students, teams } = loadState.data;
  const teamNameById = new Map(teams.map((team) => [team.id, team.name] as const));

  if (students.length === 0) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          title="No linked students yet"
          description="Once a student is linked to your account, their Home card will show up here."
        />
      </VStack>
    );
  }

  return (
    <Layout
      height="fill"
      content={
        <LayoutContent padding={6}>
          <VStack gap={6}>
            <Heading level={1}>Home</Heading>

            {students.map((student) => (
              <StudentHomeCard
                key={student.studentId}
                studentId={student.studentId}
                displayName={student.displayName}
                teamId={student.teamId}
                teamName={teamNameById.get(student.teamId) ?? 'Unassigned team'}
                goalHoursOverride={student.goalHoursOverride}
                loadData={loadStudentData}
              />
            ))}

            <Divider />

            <Text type="supporting" color="secondary">
              {WEEKLY_SUMMARY_FOOTER_NOTE}
            </Text>
          </VStack>
        </LayoutContent>
      }
    />
  );
}

export default ParentHome;
