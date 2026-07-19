/**
 * T038: `/outreach` list page (OUT-01). Coach (`coach`/`admin`) view: a
 * team season-goal `ProgressBar` pair (confirmed vs. planned hours, BEH-02)
 * with BEH-01 25/50/75/100% milestone ticks + deduped `Toast`, Upcoming
 * (`AvatarGroup` signup counts) / Past `List` sections, and a "New outreach
 * event" action. Student/parent view: the viewer's own goal-bar pair (same
 * BEH-01/BEH-02 rules) plus a per-row RSVP `SegmentedControl` on Upcoming
 * rows (OUT-01/OUT-03 preview).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `events`/`event_sessions`/`rsvps` column shapes, cited
 *    directly from `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address, team_ids uuid[] NULL, counts_participation,
 *    counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours,
 *    created_by, created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached, notes,
 *    created_at.
 *
 *    `rsvps` (lines 67-76): id, session_id, student_id, status (check:
 *    'going' | 'maybe' | 'declined'), responded_by, updated_at, created_at,
 *    unique(session_id, student_id).
 *
 *    `OutreachEventRow`/`OutreachSessionRow`/`RsvpRow` below are camelCase
 *    renames of the subset of these columns this screen renders/needs --
 *    real status vocabularies used verbatim (never an invented string like
 *    "confirmed"/"pending" in place of the real `'going'|'maybe'|'declined'`
 *    or `'scheduled'|'completed'|'canceled'` checks).
 *
 * -----------------------------------------------------------------------
 * 2. NAV-07 -- this route must show ONLY outreach-type sessions, never
 *    meetings.
 *
 * `filterOutreachEvents` below is the ONLY `event.type` predicate in this
 * file, and every session ever rendered is reached exclusively by joining
 * through an already-filtered outreach event id (see `OutreachList`'s own
 * body). `FIXTURE_EVENTS` deliberately includes one `type: 'meeting'` event
 * (`event-team-meeting`, "Weekly Team Meeting") with its own session
 * specifically so this filter is genuinely exercised, not just vacuously
 * true -- grep-provable: no meeting-shaped field/import anywhere in this
 * file's rendered output. See this task's worker output for the render-time
 * proof that "Weekly Team Meeting" never appears.
 *
 * -----------------------------------------------------------------------
 * 3. BEH-02 -- confirmed vs. planned hour segments, never summed into one
 *    displayed number.
 *
 * `computeStudentHours`/`computeGroupHours` below each return a
 * `{ confirmedHours, plannedHours }` pair and NEVER add the two fields
 * together anywhere in this file (grep-provable: no
 * `confirmedHours + plannedHours` or `confirmed + planned` expression
 * exists). "Confirmed" = hours from a `going` RSVP on an already-`completed`
 * session; "planned" = hours from a `going` RSVP on a still-`scheduled`
 * session; a `canceled` session contributes to neither (disclosed
 * simplification: the real `attendance.hours_override`/check-in-check-out
 * ground truth, per the same migration's `attendance` table, is the more
 * precise source for confirmed hours once attendance recording exists for
 * outreach days -- out of this list page's scope, not re-derived here).
 * Session duration (`sessionHours`) is `ends_at - starts_at` in hours.
 *
 * `ProgressBar` (astryx-api.md "ProgressBar" Props table) has no
 * multi-segment/stacked-fill prop -- confirmed directly against its own
 * Props table, which only exposes a single `value`/`max` pair per bar. So
 * "two visually distinct segments of the same ProgressBar" (packet
 * wording) is built as TWO separate, adjacent `ProgressBar` instances
 * sharing one goal `max` (`GoalProgressBar` below): one `variant="accent"`
 * for confirmed hours, one `variant="neutral"` (the closest documented
 * "lighter" semantic variant) for planned hours -- each with its own
 * `label`/`formatValueLabel` referencing only its own number, never both.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-01 -- 25/50/75/100% milestone ticks + a deduped `Toast`.
 *
 * Milestone crossing is computed from `confirmedPercent` (confirmed hours
 * only, per module doc #3 -- planned hours are provisional, so they never
 * contribute to "reaching" a milestone). `crossedMilestones` returns every
 * milestone at or below the current confirmed percentage; `GoalProgressBar`
 * fires a `Toast` for any milestone crossed that has not already fired
 * *for this exact season + goal-bar identity* (`hasMilestoneToastFired`/
 * `markMilestoneToastFired`, `localStorage` key
 * `volt.outreach.milestoneToast.<seasonId>.<goalBarId>.<milestone>`). The
 * dedupe key is deliberately scoped by BOTH `seasonId` and `goalBarId` (the
 * literal `'team'` for the coach bar, or the viewer's own student id for the
 * student/parent bar) -- not a single global flag -- per the packet's own
 * "dedupes per device/season" wording: a new season (or a different goal
 * bar) gets its own fresh set of milestone toasts. Milestone ticks
 * themselves render as a neutral `Badge` (reached) or plain `Text` (not yet
 * reached) row beneath the bars -- BEH-04 neutral-only styling applied here
 * too, per the packet's explicit instruction to extend it to every
 * badge/count this file renders.
 *
 * No `ToastViewport` is wired anywhere in this app yet (confirmed via grep:
 * zero hits for `ToastViewport`/`useToast` under `src/`, and
 * `node_modules/@astryxdesign/core/dist/index.d.ts` only re-exports
 * `Toast`/`useToast` from `./Toast` at the root, no viewport). Per the
 * Toast doc's own guidance ("The `Toast` component renders the visual toast
 * element inline ... useful for previews ... where the viewport lifecycle
 * is not needed"), this file renders `<Toast>` elements directly in normal
 * document flow (inside `GoalProgressBar`) rather than calling the
 * `useToast()` hook, which requires a `ToastViewport` ancestor that does
 * not exist. Flagged as a known, disclosed infra gap (same category as
 * every other "no shared X wired in yet" gap this batch has hit) -- a
 * future task wiring a real `ToastViewport` into `AppShell.tsx` would let
 * this switch to `useToast()` with no change to the dedupe logic itself.
 *
 * Real doc-gap found and cross-checked while wiring this up (constitution
 * item 2's mandated cross-check, same category as `Heading`/`ListItem`'s
 * "own subsection is undefined" gaps elsewhere in this file): `astyx-api.md`'s
 * "Toast" Props table lists `uniqueID`/`collisionBehavior`/`onHide` as if
 * they were props of the bare `<Toast>` element. The INSTALLED package's own
 * types (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`, the
 * `ToastProps` interface actually consumed by the `Toast` function
 * component) show those three belong to a DIFFERENT type,
 * `ToastOptions` (`.../Toast/types.d.ts`) -- the options bag `useToast()`'s
 * returned `ShowToastFn` accepts, not `<Toast>`'s own props. `<Toast>`'s
 * real props are `type`/`body`/`endContent`/`isAutoHide` (required)/
 * `autoHideDuration` (required)/`isExiting`/`onDismiss` (required, NOT
 * `onHide`). This file uses only the real, installed-source-verified set
 * (`type`, `body`, `isAutoHide`, `autoHideDuration`, `onDismiss`) -- `tsc`
 * itself rejected the doc's `uniqueID`/`onHide` names, which is how this was
 * caught. Deduplication is entirely carried by this file's own
 * `localStorage` check (`hasMilestoneToastFired`, module doc #4) before a
 * `Toast` is ever added to state -- no Astryx-level `uniqueID` mechanism is
 * needed or used for it; each rendered `<Toast>` gets a plain React `key`
 * only (list-rendering identity, not a deduplication API).
 *
 * -----------------------------------------------------------------------
 * 5. THE CENTRAL TRAP -- SideNav badge scope tension (Known Context/Traps
 *    #3), flagged as a dispute candidate, not silently skipped or worked
 *    around.
 *
 * The ledger's Acceptance line for T038 says "Outreach nav badge (BEH-04)
 * wired to real unanswered-RSVP count." `src/components/nav/SideNav.tsx`
 * (the file that actually renders that badge, via its own
 * `PLACEHOLDER_OUTREACH_BADGE_COUNT = 0` constant and an explicit module
 * comment reading "the real count is wired by T038") is a forbidden,
 * read-only file for this task -- it is rendered by `AppShell`, not by this
 * page, so this component's render tree cannot reach into it, and this
 * task must not edit it. That literal clause of the Acceptance line is
 * therefore NOT reachable from within `OutreachList.tsx` alone.
 *
 * What this file DOES instead: `getUnansweredRsvpCount` below is a real,
 * exported, reusable, well-named computation -- "unanswered" means an
 * upcoming (`status === 'scheduled'`) outreach session with NO `rsvps` row
 * at all (not `declined`/`maybe`, which ARE answers) for a given list of
 * student ids. It is generic over `studentIds` specifically so a future
 * small wiring task can call it with whichever set applies to the current
 * viewer (a single linked student for student/parent, or the full roster
 * for staff/coach) and plug the result straight into
 * `PLACEHOLDER_OUTREACH_BADGE_COUNT` in `SideNav.tsx`. This file also
 * exercises the function for real, visibly, in both views (a neutral
 * `Badge` count near each view's heading), so it is provably correct
 * against the fixture data, not just an inert unused export -- see this
 * task's worker output for the exact expected counts per role and the
 * dispute-candidate write-up.
 *
 * -----------------------------------------------------------------------
 * 6. `guards.tsx` `Role` vocabulary gap (same recurring gap `RosterShell.tsx`
 *    (T021), `ParticipationTab.tsx` (T056), and `MeetingsList.tsx` (T030)
 *    already disclosed) -- NOT re-derived here, only applied identically.
 *
 * `guards.tsx`'s exported `Role` union is still the stale
 * `'admin' | 'staff' | 'volunteer' | 'coach'` placeholder, not AUTH-05's
 * real `admin | coach | student | parent` vocabulary. Since `router.tsx`
 * wires `/outreach` with `RequireAuth` only (no `RequireRole` -- confirmed
 * by reading that forbidden/read-only file directly; this is CORRECT for
 * this route, not a gap: OUT-01 is a role-*variant* page, not a
 * role-*gated* one, same posture as `/meetings`), this component never
 * imports/uses `RequireRole` -- it only reads `useAuth().user.role` to pick
 * which variant to render. `isCoachOrAdminView` below compares only against
 * the two role literals present in the stale `Role` union (`'coach'`,
 * `'admin'`); everything else (including a real `'student'`/`'parent'`
 * value a future Supabase-backed `AuthProvider` would actually produce --
 * not expressible in today's stale `Role` type, but still a plain string at
 * runtime) falls through to the student/parent variant.
 *
 * -----------------------------------------------------------------------
 * 7. No student/profile linkage on `AuthUser` yet -- a real gap, disclosed
 *    and stood in for (same category `MeetingsList.tsx`/T030 documented).
 *
 * `AuthUser` (`guards.tsx`) carries only `{id, email, role}` -- no
 * `students.id` linkage. `PLACEHOLDER_CURRENT_STUDENT_ID` below is a
 * disclosed stand-in for "the one student this viewer is currently looking
 * at" (deliberately the same literal value `MeetingsList.tsx` uses, since
 * both pages stand in for the same not-yet-resolved viewer-linkage gap).
 *
 * -----------------------------------------------------------------------
 * 8. Deliberate stubs (per Forbidden Files -- disclosed, not silently built
 *    as if real):
 *
 *    a. "New outreach event" button (coach view) -- `OutreachEventDialog.tsx`
 *       is T039's (currently Blocked) deliverable, a forbidden file here.
 *       The button is real, visible, and clickable, but its `onClick` shows
 *       an inline `Banner` disclosing that the real event-creation dialog is
 *       not built yet, rather than silently doing nothing or faking a
 *       dialog. Same pattern `MeetingsList.tsx`'s "Schedule meetings"
 *       stub already established.
 *    b. Per-row RSVP `SegmentedControl` (student/parent view, Upcoming rows
 *       only) -- built FOR REAL as an OUT-01/OUT-03 *preview* per the
 *       packet's own instruction ("row-level RSVP controls only to the
 *       extent OUT-01 itself calls for them on the list page"): selecting a
 *       segment immediately updates this component's own local state (and
 *       therefore the goal bar / unanswered-count numbers react live). Only
 *       the PERSISTENCE layer is a stub -- no Supabase write happens
 *       anywhere in this file (Known Context/Traps #1, same as every other
 *       content page so far). The fuller, validated, server-persisted RSVP
 *       flow -- especially the parent-facing multi-student version --
 *       belongs to `RsvpControl.tsx`/`ParentRsvp.tsx` (T040/T042, Forbidden
 *       Files, currently Blocked), neither of which is built or imported
 *       here.
 *    c. Event titles are plain `Heading`/`ListItem` `label` text, never a
 *       `Link`/`href` to `/outreach/:eventId`. `OutreachDetail.tsx` (T041,
 *       Forbidden Files, currently Blocked) is the real detail page;
 *       `router.tsx`'s existing `/outreach/:eventId` route (confirmed by
 *       reading that forbidden/read-only file directly) still resolves to
 *       an inline placeholder div ("Outreach Event (placeholder) -
 *       eventId: ..."), not real detail content, so linking there would be
 *       misleading rather than helpful. Not a silently-dropped feature --
 *       OUT-01's own text never asked for detail links on the list page.
 *    d. `MarkDayCompleteDialog.tsx` (T040) and `Leaderboard.tsx` (T044) are
 *       not referenced, imported, or stubbed anywhere in this file: neither
 *       is part of OUT-01's list-page scope (this task's own objective
 *       text), and both are separate Forbidden/Blocked tasks' deliverables.
 *       Not an oversight -- explicitly out of scope here.
 *
 * -----------------------------------------------------------------------
 * 9. DES-12 four states, reachable independently for both role variants.
 *
 * `OutreachList` itself owns the single `loadData` call (loading/error/
 * "signed out" states are identical regardless of which view would
 * eventually render), then branches by role only once data has loaded
 * successfully. Empty state text/actions differ per role (coach gets an
 * `EmptyState` with a "New outreach event" action; student/parent gets a
 * plain read-only `EmptyState`), and each Upcoming/Past `List` section
 * independently falls back to its own smaller empty message when only one
 * of the two buckets is empty (e.g. "no upcoming outreach, two past
 * events"). See this task's worker output for real render-output proof of
 * loading / error / empty / populated, for both roles.
 *
 * -----------------------------------------------------------------------
 * 10. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cross-checked against `docs/swarm/astryx-api.md` directly (line
 *     numbers as of this task's read):
 *
 *  - `ProgressBar` (line 5416 section, Props table): `label` (required),
 *    `value`, `max`, `variant` (`'accent'`/`'neutral'`), `hasValueLabel`,
 *    `formatValueLabel` used.
 *  - `AvatarGroup` (line 2631 section, Props table): `children`, `size`
 *    used. `AvatarGroupOverflow`'s own subsection is `undefined`;
 *    `npm run astryx -- component AvatarGroupOverflow` (run live for this
 *    task) resolves `count` (required) + `children` -- only `count` used.
 *  - `Avatar` (line 419 section, Props table): `name`, `size` used.
 *  - `SegmentedControl` (line 5575 section, Props table): `value`
 *    (required), `onChange` (required), `label` (required) used.
 *    `SegmentedControlItem`'s own subsection is `undefined`;
 *    `npm run astryx -- component SegmentedControlItem` resolves `value`
 *    (required) + `label` (required) -- only those two used.
 *  - `Toast`: `astryx-api.md` line 5998 section's own Props table is a real,
 *    disclosed doc-gap (module doc #4 above) -- it names `uniqueID`/
 *    `onHide` where the installed `ToastProps`
 *    (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`) has neither.
 *    Only the installed-source-verified props are used: `body` (required),
 *    `type`, `isAutoHide` (required), `autoHideDuration` (required),
 *    `onDismiss` (required, not `onHide`).
 *  - `Badge` (line 493 section, Props table): `variant` (`'neutral'`
 *    only, everywhere in this file -- BEH-04), `label` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description`, `actions`, `headingLevel` used.
 *  - `Spinner` (line 5808 section, Props table): `label` used.
 *  - `List`/`ListItem` (line 4536 section): `List`'s Props table
 *    (`children`, `hasDividers`, `header`) used directly. `ListItem`'s own
 *    subsection is `undefined`; `npm run astryx -- component ListItem`
 *    resolves `label` (required), `description`, `endContent` -- only
 *    those three used (no `onClick`/`href` -- rows are not interactive,
 *    avoiding the doc's own "Don't place interactive elements inside an
 *    interactive list item" warning by never making the row itself
 *    interactive).
 *  - `Button` (line 1768 section, Props table): `label`, `variant`,
 *    `onClick` used.
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap `RosterShell.tsx`/T021,
 *    `MeetingsList.tsx`/T030 already hit); `npm run astryx -- component
 *    Heading` resolves `level` (required) + `children` (required) -- only
 *    those two used.
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`),
 *    `color` used.
 *  - `VStack`/`HStack` ("Stack" section, `VStack`/`HStack` subsections):
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap`, `justify` used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Avatar,
  AvatarGroup,
  AvatarGroupOverflow,
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  List,
  ListItem,
  ProgressBar,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
  Text,
  Toast,
  VStack,
} from '@astryxdesign/core';
import { useAuth } from '../../app/guards';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

export interface OutreachEventRow {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  locationName: string;
}

export interface OutreachSessionRow {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
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

export interface OutreachStudentFixture {
  id: string;
  name: string;
}

/**
 * UI-only season-goal target -- not present anywhere in `events`/
 * `event_sessions`/`rsvps`/`attendance` (confirmed by reading
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` directly:
 * no `goal`/`target` column anywhere in that migration). Disclosed
 * placeholder pending a real season-goal-config data source, same class of
 * gap as `PLACEHOLDER_CURRENT_SEASON_ID` elsewhere in this batch.
 */
export interface OutreachGoalConfig {
  seasonId: string;
  individualGoalHoursByStudentId: Readonly<Record<string, number>>;
}

export interface OutreachLoadResult {
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
  goalConfig: OutreachGoalConfig;
}

export type LoadOutreachDataFn = (seasonId: string) => Promise<OutreachLoadResult>;

export interface EnrichedOutreachSession {
  session: OutreachSessionRow;
  event: OutreachEventRow;
}

export interface HoursBreakdown {
  confirmedHours: number;
  plannedHours: number;
}

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #7.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_CURRENT_STUDENT_ID = 'student-placeholder-current-viewer';
const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #2.
// ---------------------------------------------------------------------------

const FIXTURE_STUDENTS: readonly OutreachStudentFixture[] = [
  { id: 'student-amara-webb', name: 'Amara Webb' },
  { id: 'student-cole-jennings', name: 'Cole Jennings' },
  { id: 'student-priya-patel', name: 'Priya Patel' },
  { id: 'student-devon-marsh', name: 'Devon Marsh' },
  { id: PLACEHOLDER_CURRENT_STUDENT_ID, name: 'Lena Osei' },
];

const FIXTURE_GOAL_CONFIG: OutreachGoalConfig = {
  seasonId: PLACEHOLDER_SEASON_ID,
  individualGoalHoursByStudentId: {
    'student-amara-webb': 10,
    'student-cole-jennings': 8,
    'student-priya-patel': 12,
    'student-devon-marsh': 10,
    [PLACEHOLDER_CURRENT_STUDENT_ID]: 12,
  },
};

const FIXTURE_EVENTS: readonly OutreachEventRow[] = [
  {
    id: 'event-food-bank-sort',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Food Bank Sort',
    locationName: 'Riverside Food Bank',
  },
  {
    id: 'event-park-cleanup',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Riverside Park Cleanup',
    locationName: 'Riverside Park',
  },
  {
    id: 'event-tutoring-drive',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'After-School Tutoring Drive',
    locationName: 'Lincoln Elementary',
  },
  // Deliberately type: 'meeting' -- proves NAV-07 filtering (module doc #2).
  // This event's own session ("Weekly Team Meeting") must NEVER appear
  // anywhere this file renders.
  {
    id: 'event-team-meeting',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Team Meeting',
    locationName: 'Clubhouse',
  },
];

const FIXTURE_SESSIONS: readonly OutreachSessionRow[] = [
  {
    id: 'session-food-bank-past',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-06-14',
    startsAt: '2026-06-14T14:00:00.000Z', // 9:00 AM America/Chicago (CDT)
    endsAt: '2026-06-14T17:00:00.000Z', // 12:00 PM America/Chicago -- 3h
    status: 'completed',
    peopleReached: 120,
  },
  {
    id: 'session-food-bank-upcoming',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-08-02',
    startsAt: '2026-08-02T14:00:00.000Z',
    endsAt: '2026-08-02T17:00:00.000Z', // 3h
    status: 'scheduled',
    peopleReached: null,
  },
  {
    id: 'session-park-cleanup-upcoming',
    eventId: 'event-park-cleanup',
    sessionDate: '2026-07-26',
    startsAt: '2026-07-26T15:00:00.000Z', // 10:00 AM America/Chicago
    endsAt: '2026-07-26T17:00:00.000Z', // 12:00 PM America/Chicago -- 2h
    status: 'scheduled',
    peopleReached: null,
  },
  {
    id: 'session-tutoring-canceled',
    eventId: 'event-tutoring-drive',
    sessionDate: '2026-06-01',
    startsAt: '2026-06-01T22:00:00.000Z', // 5:00 PM America/Chicago
    endsAt: '2026-06-02T00:00:00.000Z', // 7:00 PM America/Chicago -- 2h, but canceled
    status: 'canceled',
    peopleReached: null,
  },
  // Meeting session -- module doc #2. Must never render anywhere.
  {
    id: 'session-team-meeting',
    eventId: 'event-team-meeting',
    sessionDate: '2026-07-22',
    startsAt: '2026-07-22T23:00:00.000Z',
    endsAt: '2026-07-23T01:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
  },
];

const FIXTURE_RSVPS: readonly RsvpRow[] = [
  {
    id: 'rsvp-1',
    sessionId: 'session-food-bank-past',
    studentId: 'student-amara-webb',
    status: 'going',
    respondedBy: 'student-amara-webb',
    updatedAt: '2026-06-10T12:00:00.000Z',
    createdAt: '2026-06-10T12:00:00.000Z',
  },
  {
    id: 'rsvp-2',
    sessionId: 'session-food-bank-past',
    studentId: 'student-cole-jennings',
    status: 'going',
    respondedBy: 'student-cole-jennings',
    updatedAt: '2026-06-10T12:05:00.000Z',
    createdAt: '2026-06-10T12:05:00.000Z',
  },
  {
    id: 'rsvp-3',
    sessionId: 'session-food-bank-past',
    studentId: 'student-priya-patel',
    status: 'declined',
    respondedBy: 'student-priya-patel',
    updatedAt: '2026-06-10T12:10:00.000Z',
    createdAt: '2026-06-10T12:10:00.000Z',
  },
  {
    id: 'rsvp-4',
    sessionId: 'session-food-bank-past',
    studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
    status: 'going',
    respondedBy: PLACEHOLDER_CURRENT_STUDENT_ID,
    updatedAt: '2026-06-10T12:15:00.000Z',
    createdAt: '2026-06-10T12:15:00.000Z',
  },
  {
    id: 'rsvp-5',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-amara-webb',
    status: 'going',
    respondedBy: 'student-amara-webb',
    updatedAt: '2026-07-15T09:00:00.000Z',
    createdAt: '2026-07-15T09:00:00.000Z',
  },
  {
    id: 'rsvp-6',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-cole-jennings',
    status: 'maybe',
    respondedBy: 'student-cole-jennings',
    updatedAt: '2026-07-15T09:05:00.000Z',
    createdAt: '2026-07-15T09:05:00.000Z',
  },
  {
    id: 'rsvp-7',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-devon-marsh',
    status: 'declined',
    respondedBy: 'student-devon-marsh',
    updatedAt: '2026-07-15T09:10:00.000Z',
    createdAt: '2026-07-15T09:10:00.000Z',
  },
  // Priya and the current viewer deliberately have NO rsvp row for
  // session-food-bank-upcoming -- the "unanswered" case (module doc #5).
  {
    id: 'rsvp-8',
    sessionId: 'session-park-cleanup-upcoming',
    studentId: 'student-priya-patel',
    status: 'going',
    respondedBy: 'student-priya-patel',
    updatedAt: '2026-07-10T09:00:00.000Z',
    createdAt: '2026-07-10T09:00:00.000Z',
  },
  {
    id: 'rsvp-9',
    sessionId: 'session-park-cleanup-upcoming',
    studentId: 'student-devon-marsh',
    status: 'going',
    respondedBy: 'student-devon-marsh',
    updatedAt: '2026-07-10T09:05:00.000Z',
    createdAt: '2026-07-10T09:05:00.000Z',
  },
  {
    id: 'rsvp-10',
    sessionId: 'session-park-cleanup-upcoming',
    studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
    status: 'maybe',
    respondedBy: PLACEHOLDER_CURRENT_STUDENT_ID,
    updatedAt: '2026-07-10T09:10:00.000Z',
    createdAt: '2026-07-10T09:10:00.000Z',
  },
  // Amara and Cole deliberately have NO rsvp row for
  // session-park-cleanup-upcoming -- the "unanswered" case (module doc #5).
  {
    id: 'rsvp-11',
    sessionId: 'session-tutoring-canceled',
    studentId: 'student-cole-jennings',
    status: 'going',
    respondedBy: 'student-cole-jennings',
    updatedAt: '2026-05-20T09:00:00.000Z',
    createdAt: '2026-05-20T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#4/#5.
// ---------------------------------------------------------------------------

/** The ONLY `event.type` predicate in this file (module doc #2). */
export function filterOutreachEvents(events: readonly OutreachEventRow[]): OutreachEventRow[] {
  return events.filter((event) => event.type === 'outreach');
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** `ends_at - starts_at`, in hours. */
export function sessionHours(session: OutreachSessionRow): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  return Math.max(0, ms / 3_600_000);
}

/**
 * BEH-02 (module doc #3): `going` + `completed` -> confirmed; `going` +
 * `scheduled` -> planned; anything else (a `maybe`/`declined` RSVP, no RSVP
 * at all, or a `canceled` session) contributes to neither. Never returns a
 * combined number.
 */
export function computeStudentHours(
  studentId: string,
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
): HoursBreakdown {
  let confirmedHours = 0;
  let plannedHours = 0;
  for (const session of sessions) {
    const rsvp = rsvps.find(
      (r) => r.sessionId === session.id && r.studentId === studentId && r.status === 'going',
    );
    if (!rsvp) continue;
    if (session.status === 'completed') {
      confirmedHours += sessionHours(session);
    } else if (session.status === 'scheduled') {
      plannedHours += sessionHours(session);
    }
  }
  return { confirmedHours: round1(confirmedHours), plannedHours: round1(plannedHours) };
}

/** Sums each student's confirmed/planned hours SEPARATELY across the group
 * (module doc #3) -- confirmed totals never mix with planned totals. */
export function computeGroupHours(
  studentIds: readonly string[],
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
): HoursBreakdown {
  let confirmedHours = 0;
  let plannedHours = 0;
  for (const studentId of studentIds) {
    const breakdown = computeStudentHours(studentId, sessions, rsvps);
    confirmedHours += breakdown.confirmedHours;
    plannedHours += breakdown.plannedHours;
  }
  return { confirmedHours: round1(confirmedHours), plannedHours: round1(plannedHours) };
}

/** "sum of individual goals" -- the coach team bar's own goal denominator. */
export function sumIndividualGoals(
  studentIds: readonly string[],
  goalConfig: OutreachGoalConfig,
): number {
  return round1(
    studentIds.reduce((sum, id) => sum + (goalConfig.individualGoalHoursByStudentId[id] ?? 0), 0),
  );
}

/** `scheduled` -> Upcoming; anything else -> Past. Sorted by start time. */
export function buildUpcomingPast(
  sessions: readonly OutreachSessionRow[],
  events: readonly OutreachEventRow[],
): { upcoming: EnrichedOutreachSession[]; past: EnrichedOutreachSession[] } {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const enriched: EnrichedOutreachSession[] = [];
  for (const session of sessions) {
    const event = eventById.get(session.eventId);
    if (event) enriched.push({ session, event });
  }
  const upcoming = enriched
    .filter((entry) => entry.session.status === 'scheduled')
    .sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
  const past = enriched
    .filter((entry) => entry.session.status !== 'scheduled')
    .sort((a, b) => b.session.startsAt.localeCompare(a.session.startsAt));
  return { upcoming, past };
}

export const GOAL_MILESTONES = [25, 50, 75, 100] as const;
export type GoalMilestone = (typeof GOAL_MILESTONES)[number];

/** Percentage of the goal reached by CONFIRMED hours only (module doc #4). */
export function confirmedPercent(confirmedHours: number, goalHours: number): number {
  if (goalHours <= 0) return 0;
  return Math.min(100, (confirmedHours / goalHours) * 100);
}

export function crossedMilestones(percent: number): GoalMilestone[] {
  return GOAL_MILESTONES.filter((milestone) => percent >= milestone);
}

/**
 * BEH-04 / Known Context/Traps #3 (module doc #5): a real, exported,
 * reusable "unanswered RSVP" count. "Unanswered" = an upcoming
 * (`status === 'scheduled'`) session with NO `rsvps` row at all for that
 * student -- `declined`/`maybe` ARE answers and are never counted.
 * Generic over `studentIds` so a future SideNav-wiring task can call this
 * with the viewer's own linked student(s) or the full roster, as
 * appropriate to who is signed in.
 */
export function getUnansweredRsvpCount(
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
  studentIds: readonly string[],
): number {
  const upcomingSessions = sessions.filter((session) => session.status === 'scheduled');
  let count = 0;
  for (const session of upcomingSessions) {
    for (const studentId of studentIds) {
      const hasResponse = rsvps.some(
        (rsvp) => rsvp.sessionId === session.id && rsvp.studentId === studentId,
      );
      if (!hasResponse) count += 1;
    }
  }
  return count;
}

/**
 * Applies a local (fixture-only, not persisted -- module doc #8b) RSVP
 * change for one student/session pair, synthesizing a new row when none
 * existed yet (the "unanswered" case being answered for the first time).
 */
export function withRsvpOverride(
  rsvps: readonly RsvpRow[],
  studentId: string,
  sessionId: string,
  status: RsvpStatus,
): RsvpRow[] {
  const now = new Date().toISOString();
  const existingIndex = rsvps.findIndex(
    (rsvp) => rsvp.studentId === studentId && rsvp.sessionId === sessionId,
  );
  if (existingIndex === -1) {
    const newRow: RsvpRow = {
      id: `local-rsvp-${studentId}-${sessionId}`,
      sessionId,
      studentId,
      status,
      respondedBy: studentId,
      updatedAt: now,
      createdAt: now,
    };
    return [...rsvps, newRow];
  }
  return rsvps.map((rsvp, index) =>
    index === existingIndex ? { ...rsvp, status, updatedAt: now } : rsvp,
  );
}

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (Known Context/Traps #1). Real callers (once a shared Supabase
// client exists -- a separate, not-yet-dispatched task) pass their own.
// ---------------------------------------------------------------------------

export async function defaultLoadOutreachData(seasonId: string): Promise<OutreachLoadResult> {
  return {
    events: FIXTURE_EVENTS.filter((event) => event.seasonId === seasonId),
    sessions: FIXTURE_SESSIONS,
    rsvps: FIXTURE_RSVPS,
    students: FIXTURE_STUDENTS,
    goalConfig:
      FIXTURE_GOAL_CONFIG.seasonId === seasonId
        ? FIXTURE_GOAL_CONFIG
        : { seasonId, individualGoalHoursByStudentId: {} },
  };
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `MeetingsList.tsx` is not in this task's Allowed Files.
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

export function formatSessionDateOnly(session: OutreachSessionRow): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
}

export function formatSessionDateTime(session: OutreachSessionRow): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${formatSessionDateOnly(session)} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// BEH-01 milestone-toast dedupe -- module doc #4.
// ---------------------------------------------------------------------------

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts.
    return null;
  }
}

function milestoneToastStorageKey(
  seasonId: string,
  goalBarId: string,
  milestone: GoalMilestone,
): string {
  return `volt.outreach.milestoneToast.${seasonId}.${goalBarId}.${milestone}`;
}

export function hasMilestoneToastFired(
  seasonId: string,
  goalBarId: string,
  milestone: GoalMilestone,
): boolean {
  return (
    getLocalStorage()?.getItem(milestoneToastStorageKey(seasonId, goalBarId, milestone)) === 'true'
  );
}

export function markMilestoneToastFired(
  seasonId: string,
  goalBarId: string,
  milestone: GoalMilestone,
): void {
  getLocalStorage()?.setItem(milestoneToastStorageKey(seasonId, goalBarId, milestone), 'true');
}

interface ActiveMilestoneToast {
  id: string;
  message: string;
}

function useMilestoneToasts(
  seasonId: string,
  goalBarId: string,
  label: string,
  confirmedHours: number,
  goalHours: number,
): { toasts: ActiveMilestoneToast[]; dismissToast: (id: string) => void } {
  const [toasts, setToasts] = useState<ActiveMilestoneToast[]>([]);

  useEffect(() => {
    const percent = confirmedPercent(confirmedHours, goalHours);
    const newlyCrossed = crossedMilestones(percent).filter(
      (milestone) => !hasMilestoneToastFired(seasonId, goalBarId, milestone),
    );
    if (newlyCrossed.length === 0) return;
    newlyCrossed.forEach((milestone) => markMilestoneToastFired(seasonId, goalBarId, milestone));
    setToasts((prev) => [
      ...prev,
      ...newlyCrossed.map((milestone) => ({
        id: `${goalBarId}-${milestone}`,
        message: `${label}: reached ${milestone}% of the season goal (confirmed hours).`,
      })),
    ]);
  }, [seasonId, goalBarId, label, confirmedHours, goalHours]);

  function dismissToast(id: string): void {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  return { toasts, dismissToast };
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook.
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
// Goal bar -- shared by both role variants. Module docs #3/#4.
// ---------------------------------------------------------------------------

interface GoalProgressBarProps {
  /** Unique per goal bar ('team', or a student id) -- scopes the BEH-01
   * milestone-toast dedupe key. */
  goalBarId: string;
  seasonId: string;
  label: string;
  confirmedHours: number;
  plannedHours: number;
  goalHours: number;
}

function GoalProgressBar({
  goalBarId,
  seasonId,
  label,
  confirmedHours,
  plannedHours,
  goalHours,
}: GoalProgressBarProps): ReactNode {
  const { toasts, dismissToast } = useMilestoneToasts(
    seasonId,
    goalBarId,
    label,
    confirmedHours,
    goalHours,
  );
  const percent = confirmedPercent(confirmedHours, goalHours);
  const safeMax = goalHours > 0 ? goalHours : 1;

  return (
    <VStack gap={2}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          type="info"
          body={toast.message}
          isAutoHide
          autoHideDuration={5000}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
      <Heading level={2}>{label}</Heading>
      <Text type="supporting">Season goal: {goalHours} hrs</Text>
      <ProgressBar
        label={`${label}: confirmed hours`}
        value={confirmedHours}
        max={safeMax}
        variant="accent"
        hasValueLabel
        formatValueLabel={(value) => `${value} hrs confirmed`}
      />
      <ProgressBar
        label={`${label}: planned hours`}
        value={plannedHours}
        max={safeMax}
        variant="neutral"
        hasValueLabel
        formatValueLabel={(value) => `${value} hrs planned`}
      />
      <HStack justify="between" wrap="wrap" gap={2}>
        {GOAL_MILESTONES.map((milestone) =>
          percent >= milestone ? (
            <Badge key={milestone} variant="neutral" label={`${milestone}% reached`} />
          ) : (
            <Text key={milestone} type="supporting" color="secondary">
              {milestone}%
            </Text>
          ),
        )}
      </HStack>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Coach view -- module docs #2/#5/#8a/#9.
// ---------------------------------------------------------------------------

interface StubNotice {
  title: string;
  description: string;
}

function CoachOutreachRowItem({
  session,
  event,
  rsvps,
  students,
}: {
  session: OutreachSessionRow;
  event: OutreachEventRow;
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
}): ReactNode {
  const goingStudents = useMemo(() => {
    const goingIds = new Set(
      rsvps
        .filter((rsvp) => rsvp.sessionId === session.id && rsvp.status === 'going')
        .map((rsvp) => rsvp.studentId),
    );
    return students.filter((student) => goingIds.has(student.id));
  }, [rsvps, students, session.id]);

  const visibleStudents = goingStudents.slice(0, 3);
  const overflowCount = Math.max(0, goingStudents.length - visibleStudents.length);

  const description = (
    <VStack gap={0.5}>
      <Text type="supporting">
        {formatSessionDateTime(session)} — {event.locationName}
      </Text>
      {session.status !== 'scheduled' &&
        (session.status === 'canceled' ? (
          <Text type="supporting">Canceled — no attendance recorded.</Text>
        ) : (
          <Text type="supporting">
            {session.peopleReached !== null
              ? `${session.peopleReached} people reached`
              : 'No attendance summary recorded yet.'}
          </Text>
        ))}
    </VStack>
  );

  const endContent =
    session.status === 'scheduled' ? (
      <HStack gap={2} vAlign="center">
        {goingStudents.length > 0 && (
          <AvatarGroup size="small">
            {visibleStudents.map((student) => (
              <Avatar key={student.id} name={student.name} size="small" />
            ))}
            {overflowCount > 0 && <AvatarGroupOverflow count={overflowCount} />}
          </AvatarGroup>
        )}
        <Badge variant="neutral" label={`${goingStudents.length} going`} />
      </HStack>
    ) : undefined;

  return <ListItem label={event.title} description={description} endContent={endContent} />;
}

function CoachOutreachSection({
  title,
  enrichedSessions,
  rsvps,
  students,
  emptyDescription,
}: {
  title: string;
  enrichedSessions: readonly EnrichedOutreachSession[];
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
  emptyDescription: string;
}): ReactNode {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      {enrichedSessions.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={`No ${title.toLowerCase()} outreach events`}
          description={emptyDescription}
        />
      ) : (
        <List hasDividers header={`${title} outreach events`}>
          {enrichedSessions.map(({ session, event }) => (
            <CoachOutreachRowItem
              key={session.id}
              session={session}
              event={event}
              rsvps={rsvps}
              students={students}
            />
          ))}
        </List>
      )}
    </VStack>
  );
}

interface CoachOutreachViewProps {
  seasonId: string;
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
  goalConfig: OutreachGoalConfig;
}

function CoachOutreachView({
  seasonId,
  events,
  sessions,
  rsvps,
  students,
  goalConfig,
}: CoachOutreachViewProps): ReactNode {
  const [stubNotice, setStubNotice] = useState<StubNotice | null>(null);
  const { upcoming, past } = useMemo(() => buildUpcomingPast(sessions, events), [sessions, events]);
  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const teamHours = useMemo(
    () => computeGroupHours(studentIds, sessions, rsvps),
    [studentIds, sessions, rsvps],
  );
  const teamGoalHours = useMemo(
    () => sumIndividualGoals(studentIds, goalConfig),
    [studentIds, goalConfig],
  );
  const unansweredCount = useMemo(
    () => getUnansweredRsvpCount(sessions, rsvps, studentIds),
    [sessions, rsvps, studentIds],
  );

  function showNewEventStub(): void {
    setStubNotice({
      title: 'Event creation dialog not built yet',
      description:
        "This action opens the new-outreach-event dialog (T039, OUT-01/OUT-02). That dialog hasn't shipped yet, so no event was created.",
    });
  }

  const hasAnyOutreach = sessions.length > 0;

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <VStack gap={1}>
          <Heading level={1}>Outreach</Heading>
          <Badge variant="neutral" label={`${unansweredCount} pending RSVPs`} />
        </VStack>
        <Button label="New outreach event" variant="primary" onClick={showNewEventStub} />
      </HStack>

      {stubNotice !== null && (
        <Banner
          status="info"
          title={stubNotice.title}
          description={stubNotice.description}
          isDismissable
          onDismiss={() => setStubNotice(null)}
        />
      )}

      {!hasAnyOutreach ? (
        <EmptyState
          title="No outreach events yet"
          description="Outreach events for this season will show up here once they're scheduled."
          actions={
            <Button label="New outreach event" variant="primary" onClick={showNewEventStub} />
          }
        />
      ) : (
        <>
          <GoalProgressBar
            goalBarId="team"
            seasonId={seasonId}
            label="Team season goal"
            confirmedHours={teamHours.confirmedHours}
            plannedHours={teamHours.plannedHours}
            goalHours={teamGoalHours}
          />
          <CoachOutreachSection
            title="Upcoming"
            enrichedSessions={upcoming}
            rsvps={rsvps}
            students={students}
            emptyDescription="No outreach events are currently scheduled."
          />
          <CoachOutreachSection
            title="Past"
            enrichedSessions={past}
            rsvps={rsvps}
            students={students}
            emptyDescription="Completed and canceled outreach events will show up here."
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Student/parent view -- module docs #3/#5/#7/#8b/#9.
// ---------------------------------------------------------------------------

const RSVP_ITEMS: readonly { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't go" },
];

/** Not a real RSVP status -- never matches an actual `SegmentedControlItem`
 * value, so passing it as `value` leaves the control visually unselected,
 * which is the correct representation of "no RSVP row exists yet". */
const UNANSWERED_RSVP_SEGMENT_VALUE = 'unanswered';

function rsvpStatusLabel(status: RsvpStatus): string {
  return RSVP_ITEMS.find((item) => item.value === status)?.label ?? status;
}

function StudentOutreachRowItem({
  session,
  event,
  status,
  onRsvpChange,
}: {
  session: OutreachSessionRow;
  event: OutreachEventRow;
  status: RsvpStatus | null;
  onRsvpChange: (sessionId: string, status: RsvpStatus) => void;
}): ReactNode {
  const isEditable = session.status === 'scheduled';

  const description = (
    <Text type="supporting">
      {formatSessionDateTime(session)} — {event.locationName}
    </Text>
  );

  const endContent = isEditable ? (
    <SegmentedControl
      value={status ?? UNANSWERED_RSVP_SEGMENT_VALUE}
      onChange={(value) => onRsvpChange(session.id, value as RsvpStatus)}
      label={`Your RSVP for ${event.title} on ${formatSessionDateOnly(session)}`}
    >
      {RSVP_ITEMS.map((item) => (
        <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
      ))}
    </SegmentedControl>
  ) : (
    <Text type="supporting" color="secondary">
      {status === null ? 'No response recorded' : `You RSVP'd: ${rsvpStatusLabel(status)}`}
    </Text>
  );

  return <ListItem label={event.title} description={description} endContent={endContent} />;
}

function StudentOutreachSection({
  title,
  enrichedSessions,
  viewerStudentId,
  rsvps,
  onRsvpChange,
  emptyDescription,
}: {
  title: string;
  enrichedSessions: readonly EnrichedOutreachSession[];
  viewerStudentId: string;
  rsvps: readonly RsvpRow[];
  onRsvpChange: (sessionId: string, status: RsvpStatus) => void;
  emptyDescription: string;
}): ReactNode {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      {enrichedSessions.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={`No ${title.toLowerCase()} outreach events`}
          description={emptyDescription}
        />
      ) : (
        <List hasDividers header={`${title} outreach events`}>
          {enrichedSessions.map(({ session, event }) => (
            <StudentOutreachRowItem
              key={session.id}
              session={session}
              event={event}
              status={
                rsvps.find(
                  (rsvp) => rsvp.sessionId === session.id && rsvp.studentId === viewerStudentId,
                )?.status ?? null
              }
              onRsvpChange={onRsvpChange}
            />
          ))}
        </List>
      )}
    </VStack>
  );
}

interface StudentParentOutreachViewProps {
  seasonId: string;
  viewerStudentId: string;
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  initialRsvps: readonly RsvpRow[];
  goalConfig: OutreachGoalConfig;
}

function StudentParentOutreachView({
  seasonId,
  viewerStudentId,
  events,
  sessions,
  initialRsvps,
  goalConfig,
}: StudentParentOutreachViewProps): ReactNode {
  const [rsvps, setRsvps] = useState<readonly RsvpRow[]>(initialRsvps);

  useEffect(() => {
    setRsvps(initialRsvps);
  }, [initialRsvps]);

  const { upcoming, past } = useMemo(() => buildUpcomingPast(sessions, events), [sessions, events]);
  const myHours = useMemo(
    () => computeStudentHours(viewerStudentId, sessions, rsvps),
    [viewerStudentId, sessions, rsvps],
  );
  const myGoalHours = goalConfig.individualGoalHoursByStudentId[viewerStudentId] ?? 0;
  const unansweredCount = useMemo(
    () => getUnansweredRsvpCount(sessions, rsvps, [viewerStudentId]),
    [sessions, rsvps, viewerStudentId],
  );

  function handleRsvpChange(sessionId: string, status: RsvpStatus): void {
    // Module doc #8b: local-only. No Supabase write happens here -- the
    // real persisted, validated RSVP flow is RsvpControl.tsx/ParentRsvp.tsx
    // (T040/T042, Forbidden Files, currently Blocked).
    setRsvps((prev) => withRsvpOverride(prev, viewerStudentId, sessionId, status));
  }

  const hasAnyOutreach = sessions.length > 0;

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>Outreach</Heading>
        <Badge variant="neutral" label={`${unansweredCount} awaiting your RSVP`} />
      </HStack>

      {!hasAnyOutreach ? (
        <EmptyState
          title="No outreach events yet"
          description="Outreach events for this season will show up here once your coach schedules them."
        />
      ) : (
        <>
          <GoalProgressBar
            goalBarId={viewerStudentId}
            seasonId={seasonId}
            label="Your season goal"
            confirmedHours={myHours.confirmedHours}
            plannedHours={myHours.plannedHours}
            goalHours={myGoalHours}
          />
          <StudentOutreachSection
            title="Upcoming"
            enrichedSessions={upcoming}
            viewerStudentId={viewerStudentId}
            rsvps={rsvps}
            onRsvpChange={handleRsvpChange}
            emptyDescription="You have no upcoming outreach events."
          />
          <StudentOutreachSection
            title="Past"
            enrichedSessions={past}
            viewerStudentId={viewerStudentId}
            rsvps={rsvps}
            onRsvpChange={handleRsvpChange}
            emptyDescription="Your past outreach participation will show up here."
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Top-level component -- module docs #6/#7/#9.
// ---------------------------------------------------------------------------

export interface OutreachListProps {
  /** Injectable data-loading seam (Known Context/Traps #1). Defaults to
   * fixture data. */
  loadData?: LoadOutreachDataFn;
  seasonId?: string;
  /** Which student the student/parent view is currently scoped to (module
   * doc #7). */
  viewerStudentId?: string;
}

export function OutreachList({
  loadData = defaultLoadOutreachData,
  seasonId = PLACEHOLDER_SEASON_ID,
  viewerStudentId = PLACEHOLDER_CURRENT_STUDENT_ID,
}: OutreachListProps = {}): ReactNode {
  const { user } = useAuth();
  const loadState = useLoadState(() => loadData(seasonId), [loadData, seasonId]);

  // Module doc #6 -- only the two role literals present in guards.tsx's
  // stale `Role` union are compared directly; everything else (including a
  // real 'student'/'parent' value) falls through to the student/parent view.
  const isCoachOrAdminView = user !== null && (user.role === 'coach' || user.role === 'admin');

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          title="Sign in to view outreach"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6}>
        <Spinner label="Loading outreach events…" />
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load outreach events"
          description="Something went wrong loading this season's outreach events. Try refreshing the page."
        />
      </VStack>
    );
  }

  // Module doc #2 -- the only place events are filtered by type; every
  // session below is reached exclusively through an outreach event id.
  const outreachEvents = filterOutreachEvents(loadState.data.events);
  const outreachEventIds = new Set(outreachEvents.map((event) => event.id));
  const outreachSessions = loadState.data.sessions.filter((session) =>
    outreachEventIds.has(session.eventId),
  );

  return (
    <VStack gap={6} padding={6}>
      {isCoachOrAdminView ? (
        <CoachOutreachView
          seasonId={seasonId}
          events={outreachEvents}
          sessions={outreachSessions}
          rsvps={loadState.data.rsvps}
          students={loadState.data.students}
          goalConfig={loadState.data.goalConfig}
        />
      ) : (
        <StudentParentOutreachView
          seasonId={seasonId}
          viewerStudentId={viewerStudentId}
          events={outreachEvents}
          sessions={outreachSessions}
          initialRsvps={loadState.data.rsvps}
          goalConfig={loadState.data.goalConfig}
        />
      )}
    </VStack>
  );
}

export default OutreachList;
