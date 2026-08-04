/**
 * T054: `/` Student Home (HOME-02), mobile-first (PRD 4.2 wireframe, 375px).
 *
 * Live-meeting check-in card (MTG-10) when a meeting session is genuinely
 * live + hours `ProgressBar` (MET-04) with a confirmed/planned legend
 * (BEH-02) + participation % (MET-01) + "Next up" (the student's own
 * `going` sessions) + "Sign-up opportunities" (future outreach sessions not
 * yet responded to, with inline Sign up / Can't go).
 *
 * -----------------------------------------------------------------------
 * 1. THE CENTRAL TRAP -- `StudentHomeSlot.tsx` (T008) resolution, disclosed
 *    per this task's own packet instruction.
 *
 * `StudentHomeSlot.tsx` (read in full, read-only, forbidden here) accepts
 * only `hasLiveSession?: boolean` and, when true, renders its OWN hardcoded
 * placeholder text inside a `Card` -- it has no `children` prop at all
 * (confirmed by reading its source directly: its `StudentHomeSlotProps`
 * interface has exactly one field). It is therefore structurally
 * IMPOSSIBLE to pass this file's real 6-char-code-entry UI into it -- there
 * is no seam to receive real content. Editing `StudentHomeSlot.tsx` to add a
 * `children` prop would be the "cleanest" fix, but that file is this task's
 * own Forbidden Files list, so that is not an option here either.
 *
 * `StudentHomeSlot.tsx`'s own module doc resolves this itself, read
 * literally: "a standalone component with a stable on/off prop contract
 * (`hasLiveSession`) that T054 will render inside the real `StudentHome.tsx`
 * it builds later. It is not added to `router.tsx`, any page, or
 * `AppShell.tsx` -- it is deliberately unreachable" and "This component's
 * only obligations are: (1) render nothing ... (2) exist with a stable
 * enough prop contract for T054 to render it" (NOT "for T054 to literally
 * reuse its JSX"). Read together with the ledger's "wired into T008's slot"
 * phrasing, the only coherent reading is: T008 proved the ON/OFF *contract*
 * a real live-check-in card needs (nothing shown when no session is live;
 * something shown when one is) -- it was never meant to be extended or
 * imported verbatim, since its own file admits it renders only a "Check-in
 * card placeholder ... NOT the real MTG-10 UI ... That is T054's job".
 *
 * RESOLUTION (disclosed judgment call, same discipline every other
 * scope-tension trap in this batch -- T037/T030, T038/SideNav -- required):
 * this file builds its OWN real live-check-in card (`LiveCheckInCard`
 * below) satisfying the identical on/off semantics `StudentHomeSlot`
 * demonstrated (`selectLiveMeetingSession(...) !== null` is this file's own
 * `hasLiveSession`-equivalent predicate: nothing renders when it's `null`,
 * the real card renders when it isn't) and reusing the same `Card
 * variant="default" padding={4}` shell `StudentHomeSlot` used -- but with
 * REAL children (`TextInput` + `Button`) instead of `StudentHomeSlot`'s
 * hardcoded placeholder string. `StudentHomeSlot.tsx` itself is never
 * imported, rendered, or edited anywhere in this file (grep-provable: zero
 * references to `StudentHomeSlot` in this file's source).
 *
 * -----------------------------------------------------------------------
 * 2. BEH-03 -- the hero resolves to exactly ONE primary CTA, by strict
 *    priority, never two.
 *
 * `selectHeroState(hasLiveSession, unansweredOpportunityCount)` below is the
 * ONLY function that decides which hero renders, with the packet's own
 * literal priority order: (1) live meeting check-in > (2) oldest unanswered
 * future RSVP ("You have N events to answer") > (3) quiet greeting, no CTA.
 * `StudentHome`'s render body branches on this ONE result with `&&`, so
 * exactly one of `LiveCheckInCard` / `UnansweredRsvpHero` / the plain quiet
 * greeting `Text` ever renders -- never two.
 *
 * To make "never two primary buttons shown together" independently,
 * mechanically provable (not just true by inspection), this file follows a
 * hard rule: `variant="primary"` is used on AT MOST ONE `Button` anywhere on
 * the page at any time -- the hero's own action ("Check in" inside
 * `LiveCheckInCard`, or "Review sign-up opportunities" inside
 * `UnansweredRsvpHero`). Every other button on the page (the per-row "Sign
 * up" / "Can't go" actions in Sign-up opportunities) uses `variant="secondary"`
 * / `variant="ghost"`. Astryx's own `Button` renders a real, stable
 * `data-variant` DOM attribute (verified directly against
 * `node_modules/@astryxdesign/core/dist/utils/themeProps.js`'s own doc
 * comment: "→ { className: 'astryx-button primary sm', data-variant:
 * 'primary', data-size: 'sm' }"), so this file's own test proof asserts
 * `document.querySelectorAll('[data-variant="primary"]').length` is exactly
 * 1 in the live-checkin and unanswered-rsvp states and exactly 0 in the
 * quiet-greeting state -- a real DOM count, not an inference from JSX.
 *
 * -----------------------------------------------------------------------
 * 3. BEH-02 -- confirmed vs. planned hours never summed into one number.
 *
 * `confirmedHours` comes ONLY from the `v_student_hours`-shaped
 * `StudentHoursMetric` fixture row (module doc #4) -- never recomputed.
 * `computePlannedHours` below is a SEPARATE, independently-tracked number:
 * the sum of session-duration hours for `events.counts_volunteer_hours`
 * events the student has a `going` RSVP on that are still `scheduled` (not
 * yet completed, so `v_student_hours` -- which only sums *completed*-session
 * attendance -- has no row for them yet). The two numbers are NEVER added
 * together anywhere in this file (grep-provable: no `confirmedHours +
 * plannedHours` expression exists); the `ProgressBar` renders only
 * `confirmedHours` against the goal, and a separate `Text` legend renders
 * both numbers side by side ("62 h confirmed + 3 h planned", the packet's
 * own literal worked-example format), never collapsed into one figure. Same
 * posture `OutreachList.tsx`/T038 and `CoachHome.tsx`/T053 already
 * established for this exact rule.
 *
 * -----------------------------------------------------------------------
 * 4. MET-01/MET-04 sourcing (constitution item 3, BLOCKER-class) -- fixture
 *    passthrough only, zero re-derivation.
 *
 * `supabase/migrations/20260717000003_metric_views.sql` (read-only):
 *   - `v_student_hours` (lines 3-19, MET-04's numerator): `student_id,
 *     season_id, confirmed_hours`. `StudentHoursMetric` below is a verbatim
 *     camelCase rename of these three columns; this file performs NO
 *     hours-clamping/override arithmetic anywhere -- `confirmedHours` is
 *     read directly off the fixture row, exactly like `CoachHome.tsx`/T053's
 *     `sumConfirmedHours` already established for the same view.
 *   - `v_student_participation` (lines 21-42, MET-01): `student_id,
 *     team_id, season_id, expected_ct, present_ct, late_ct, excused_ct,
 *     participation_pct`. `StudentParticipationMetric` below is a verbatim
 *     camelCase rename of all seven columns; this file performs NO
 *     percentage arithmetic on it anywhere (grep-provable: no `100.0 *`, no
 *     `/ greatest(`) -- `data.participation.participationPct` is rendered
 *     directly, exactly like `MeetingsList.tsx`/T030's own established
 *     idiom for the same view. `null` (no row) renders "—", never a
 *     fabricated 0%, per that same file's convention.
 *   - MET-04's denominator (PRD: `goal_hours_override ?? season
 *     default_goal_hours`) **CORRECTED, T176 round 2 (coordinator's own
 *     error, disclosed by them, fixed here) -- the claim this bullet
 *     previously made, "has no SQL view of its own" / "not a re-derivation
 *     of anything the views compute," is FALSE.**
 *     `v_student_goal_projection` (`supabase/migrations/
 *     20260723000001_dashboard_views.sql:322-334`) already computes exactly
 *     this coalesce in SQL: `coalesce(s.goal_hours_override,
 *     se.default_goal_hours) as goal_hours`, scoped to the currently-active
 *     season. `kpi_views.sql:216` independently carries the SUMMED form of
 *     the identical coalesce (`coalesce(sum(coalesce(s.goal_hours_override,
 *     se.default_goal_hours)), 0)`), confirming this is genuine,
 *     already-shipped view formula territory, not a gap. `goalHours` below
 *     is now a VERBATIM PASSTHROUGH of that view's own `goal_hours` column
 *     (via `resolveStudentScope`, `loaders/students.ts`, reading
 *     `v_student_goal_projection` scoped by `student_id`) -- no coalesce,
 *     no nullish-coalesce, no arithmetic of any kind happens on it in this
 *     file. `confirmedHours`/`plannedHours` are the SAME view's own
 *     `confirmed_hours`/`planned_hours` columns (its own LEFT JOINs to
 *     `v_student_hours`/`v_student_planned_hours`), read via the SAME
 *     single call -- also verbatim passthroughs, no longer sourced from
 *     `loadData`'s own (still-fixture) `data.studentHours`/
 *     `computePlannedHours(...)` for this purpose. `resolveGoalHours` (the
 *     pure function below) is NOT called anywhere in this render path
 *     anymore -- it stays exported and directly unit-tested (byte-
 *     unchanged, in case another future caller needs the raw
 *     coalesce-in-TypeScript idiom), but this file's own content tier does
 *     not use it. See the "Identity resolution" doc above
 *     `resolveStudentIdentity` below for the full record.
 *     `hoursVsGoalPercent`'s division is the same disclosed, legitimate
 *     UI-side percent math `OutreachList.tsx`'s `confirmedPercent` /
 *     `CoachHome.tsx`'s `hoursVsGoalPercent` already established, and
 *     `dashboard_views.sql`'s own module doc (heading 9) explicitly
 *     disclaims computing this exact ratio in SQL ("Percent-of-goal ... is
 *     deliberately NOT computed here") -- so this one division is
 *     confirmed-legitimate, not an oversight.
 *
 * -----------------------------------------------------------------------
 * 5. "Check in" reuses T032's real validation contract -- not a second,
 *    different implementation.
 *
 * Ground truth read directly from `supabase/functions/checkin/validation.ts`
 * (lines 18-24, `CheckinRequestBody`: `session_id`, `token | null`, `code |
 * null` -- exactly one of `token`/`code` required) and
 * `supabase/functions/checkin/index.ts` (module doc, lines 1-14: HMAC
 * short-code path, `present`/`late` auto-status, MTG-09 idempotency). The
 * exact request/response shape this file submits through was cross-checked
 * against `src/pages/checkin/CheckinResult.tsx`'s already-Passed, read-only
 * `callCheckin()` (lines 214-308) and its `CheckinCallResult`/
 * `CheckinResponsePayload`/`CheckinCredential` types (lines 148-184):
 *   POST {VITE_SUPABASE_URL}/functions/v1/checkin
 *   { session_id, code }
 *   200: { already_checked_in, attendance: { status, check_in_at, method } }
 *   non-200: { error: { code, message } }
 * `defaultSubmitCheckinCode` below is an INDEPENDENTLY-AUTHORED real,typed
 * `fetch()` call shaped identically to that contract (never imported from,
 * or a copy-paste duplicate of, `CheckinResult.tsx` -- a forbidden file
 * here) -- same envs (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`), same
 * "no bearer JWT exists anywhere in `src/` yet" gap `CheckinResult.tsx`'s
 * own module doc gap #1 already disclosed (omitting `Authorization`
 * entirely, letting the real deployed function's own 401 path handle it),
 * same server-authored-error-rendered-verbatim discipline. Injected via a
 * `submitCheckinCode` prop seam (Known Context/Traps #5's own instruction),
 * same "obviously-fake-by-default, real callback for tests/future wiring"
 * posture every prior content page in this batch has used.
 *
 * -----------------------------------------------------------------------
 * 6. "Next up" = `going` sessions only (module doc's own literal wording).
 *
 * `buildNextUp` below includes: (a) `meeting`-type sessions unconditionally
 * (MTG-03, cited from `MeetingsList.tsx`'s own module doc: meetings don't
 * use RSVP -- every team member is implicitly "going"), and (b)
 * `outreach`-type sessions ONLY where the student has a `going` RSVP row.
 * `competition`-type sessions are deliberately excluded from Next Up (the
 * packet's own text names only "meetings and outreach").
 *
 * -----------------------------------------------------------------------
 * 7. Sign-up opportunities -- inline Sign up / Can't go, real local-state
 *    update, not persisted (module doc's own instruction, same posture
 *    `OutreachList.tsx`/T038's own RSVP stub already established).
 *
 * `getUnansweredOutreachOpportunities` below uses the exact same
 * "unanswered" definition `OutreachList.tsx`'s `getUnansweredRsvpCount`
 * already established: a future (`status === 'scheduled'`, not yet started)
 * `outreach`-type session with NO `rsvps` row at all for this student
 * (`maybe`/`declined` ARE answers and are excluded). "Oldest unanswered"
 * (packet wording): since an absent RSVP row carries no timestamp of its
 * own to sort by, this is interpreted as the EARLIEST-STARTING eligible
 * session (soonest response deadline) -- a disclosed judgment call, not a
 * silent assumption. `handleRsvpChange` (`withLocalRsvpOverride`) updates
 * only this component's own React state; no Supabase write happens
 * anywhere in this file, same as `OutreachList.tsx`'s own SegmentedControl
 * stub.
 *
 * -----------------------------------------------------------------------
 * 8. `guards.tsx` `AuthUser`/`Role` gaps -- T176 UPDATE: `studentId`/`teamId`
 *    are now resolved for real; this section records what changed and what
 *    is still, deliberately, a disclosed gap.
 *
 * `AuthUser` (`guards.tsx`) carries only `{id, email, role}` -- no
 * `students.id` linkage of its own. T176 closes that gap the same way T096
 * (`MeetingsList.tsx`) already closed the identical gap for that page:
 * `resolveCurrentStudentId` (`loaders/meetings.ts`, reused verbatim, not
 * re-derived here) resolves the real `students.id` for the signed-in
 * viewer, and this file's own new `resolveStudentScope`
 * (`loaders/students.ts`, additive) resolves that student's own
 * `team_id`/`goal_hours_override` by id. `PLACEHOLDER_CURRENT_STUDENT_ID` /
 * `PLACEHOLDER_CURRENT_TEAM_ID` below are KEPT (still real, still exported --
 * `StudentHome.test.tsx`, `defaultLoadStudentHomeData`'s own fixture rows,
 * and the mutation-revert proofs in this task's own worker output all still
 * reference them) but are no longer this component's own runtime default
 * for an unresolved `studentId`/`teamId`; see the new "Identity resolution"
 * doc directly above `resolveStudentIdentity` below for the resolved shape.
 *
 * **Known, disclosed narrowing (not a bug, filed as a follow-up, T176
 * worker output criterion 12b):** `resolveStudentScope` reads the LEGACY
 * `students.team_id` primary-team column, per
 * `supabase/migrations/20260721000000_student_teams.sql`'s own header --
 * TWO separate, non-contiguous verbatim fragments from that header, quoted
 * here explicitly as such (not one contiguous sentence): line 2, "a student
 * may belong to more than one team"; and lines 10-12, "[`students.team_id`]
 * remains the legacy/primary-team read path until a later SCH-03+ packet
 * migrates readers over to this junction." Every other current reader
 * (`v_student_participation`/`v_team_hours`, `dashboard_views.sql`,
 * `kpi_views.sql`) has already migrated to the `student_teams` junction;
 * this file has not. A dual-team-member student's second team's meetings,
 * live check-in, and sign-up opportunities are silently invisible on this
 * page -- the same defect class T120 already fixed once on
 * `ParticipationTab.tsx`. Deliberate, disclosed, out of T176's bounded
 * scope (its own packet's explicit instruction), not silently assumed
 * single-valued.
 *
 * This file still does not branch on `user.role` at all (unlike
 * `OutreachList.tsx`/`MeetingsList.tsx`, which are role-VARIANT pages):
 * `StudentHome` is one of three distinct Home components (`CoachHome`/
 * `StudentHome`/`ParentHome`, HOME-01/02/03) `DashboardPage.tsx`'s own role
 * dispatcher already chooses among -- it only checks `user === null` for
 * the signed-out DES-12 state, identical to every sibling Home component's
 * own posture (and, per T176, identical to `CoachHome.tsx`'s own T155
 * outer-wrapper shape).
 *
 * -----------------------------------------------------------------------
 * 9. Data loading -- T176 UPDATE: `studentId`/`teamId` are real. T183
 *    UPDATE: `loadData`'s `displayName` is now real too (real
 *    `students.display_name`, own row, `loaders/students.ts`'s
 *    `loadStudentHomeData`) -- everything ELSE it returns remains an
 *    honest-empty literal, not fixture-derived (deliberately out of T183's
 *    bounded scope, per its own packet, except for the ONE field module doc
 *    #4 above already covers: MET-04's denominator).
 *
 * `loadData` is the injectable seam (`(studentId, seasonId) =>
 * Promise<StudentHomeData>`), defaulting to the REAL `loadStudentHomeData`
 * (T183; the still-obviously-fake `defaultLoadStudentHomeData` remains
 * exported for tests, fabricated names only per constitution item 6, but is
 * no longer what this default parameter points at). `seasonId` is now the
 * REAL `useActiveSeason().season.id` (T176, same mechanism `CoachHome.tsx`'s
 * own T155 already established for its sibling), not a placeholder default.
 * `displayName` is the real, per-student `students.display_name` (T183); the
 * other SEVEN fields (`defaultGoalHours`, `goalHoursOverride`, `events`,
 * `sessions`, `rsvps`, `studentHours`, `participation`) are honest-empty
 * literals in the new default (`0`/`null`/`[]`, never `FIXTURE_*`-derived),
 * genuinely empty/absent for a real signed-in student rather than
 * fabricated-and-wrong. A real implementation of the REST of this seam, once
 * a shared Supabase client exists for this page's own remaining fields, is
 * filed as its own follow-up (same criterion 12a), not built here.
 *
 * -----------------------------------------------------------------------
 * 10. DES-12 four states.
 *
 * Not-signed-in (`user === null`, sign-in prompt) / loading (T081: `Skeleton`,
 * previewing the known hero + hours + "Next up"/"Sign-up opportunities" list
 * shape, while `loadData` is pending -- replacing the prior `Spinner` per
 * Astryx's own guidance since this dashboard's dimensions are predictable)
 * / error (`loadData` rejects -- `Banner
 * status="error"`) / populated (hero + hours + Next up + Sign-up
 * opportunities). "Empty" is not a separate top-level branch -- the hours
 * bar and hero are meaningful even at zero; "Next up" and "Sign-up
 * opportunities" each independently fall back to their own `EmptyState`
 * when their own list is empty, the same per-section-empty pattern
 * `OutreachList.tsx`/`MeetingsList.tsx` already established.
 *
 * -----------------------------------------------------------------------
 * 11. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cross-checked against `docs/swarm/astryx-api.md` directly (line
 *     numbers as of this task's read):
 *
 *  - `Card` (line 2935 section, Props table): `variant`, `padding`,
 *    `children` used -- same shell `StudentHomeSlot.tsx` itself already
 *    used (its own module doc cites the same Props table).
 *  - `TextInput` (line 1611 section, Props table): `label` (required),
 *    `value` (required), `onChange`, `placeholder`, `isDisabled` used. No
 *    `maxLength` prop exists on the documented table -- the 6-character
 *    limit is enforced in this file's own `onChange` handler instead.
 *  - `Button` (line 1768 section, Props table): `label`, `variant`,
 *    `onClick`, `isDisabled`, `isLoading` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description` used.
 *  - `ProgressBar` (line 5416 section, Props table): `label` (required),
 *    `value`, `max`, `isLabelHidden`, `hasValueLabel`, `formatValueLabel`
 *    used.
 *  - `Divider` (line 543 section, Props table): no `label` prop used here (a
 *    prior revision used `label` for "Next up" / "Sign-up opportunities",
 *    but reading Astryx's own installed source directly
 *    (`node_modules/@astryxdesign/core/dist/Divider/Divider.js`) shows the
 *    `label` renders inside a plain `<div>` -- not a heading, not any
 *    landmark -- so it is invisible to screen-reader heading navigation.
 *    Each section's real accessible title is now a `Heading level={2}`
 *    element instead (same pattern `CoachHome.tsx`'s own already-Passed
 *    "Next up" / "Recent signups" sections use), with a bare, unlabeled
 *    `Divider` (default `orientation`/`variant`, no props) kept alongside
 *    purely as a visual separator line.
 *  - `List`/`ListItem` (line 4536 section): `List`'s Props table
 *    (`children`, `hasDividers`, `header`) used directly. `ListItem`'s own
 *    subsection is `undefined` (same disclosed CLI-cross-checked gap every
 *    sibling task in this batch hit); `MeetingsList.tsx`/`OutreachList.tsx`'s
 *    own already-established `npm run astryx -- component ListItem` read
 *    (`label` required, `description`, `endContent`) is reused here --
 *    only those three props used.
 *  - `MoreMenu` (line 4786 section, Props table): `items`
 *    (`DropdownMenuOption[]`, re-exported from `@astryxdesign/core`'s
 *    `./DropdownMenu` barrel), `label` used, same as `MeetingsList.tsx`'s
 *    own established usage.
 *  - `Badge` (line 493 section, Props table): `variant` (`'neutral'`),
 *    `label` used -- a status tag ("Going"), matching the doc's own "Do:
 *    use color/neutral variants for category tags" guidance.
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description`, `headingLevel` used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this dashboard's predictable
 *    hero/hours/list sections, replacing `Spinner`'s prior use here per
 *    Astryx's own guidance (known-dimension content). `VisuallyHidden` +
 *    the wrapping `VStack`'s `aria-busy` carry the "Loading Home…"
 *    announcement `Spinner`'s `label` used to provide.
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap every sibling task hit);
 *    `level` (required) + `children` (required) only, per that established
 *    read.
 *  - `Text` (line 829 section, Props table): `type` (`'body'`,
 *    `'supporting'`) used.
 *  - `VStack`/`HStack` ("Stack" section): `gap`, `padding`, `vAlign` used.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  Heading,
  HStack,
  List,
  ListItem,
  MoreMenu,
  ProgressBar,
  Skeleton,
  Text,
  TextInput,
  VisuallyHidden,
  VStack,
  type DropdownMenuOption,
} from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import { useActiveSeason } from '../../app/SeasonProvider';
// T176 -- real `studentId` resolution reuses T096's own `MeetingsList.tsx`/
// `loaders/meetings.ts` resolution seam verbatim, per this task's own packet
// (do not edit either file; both are read-only reference here). `resolveCurrentStudentId`
// is the real default; `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn` are the
// minimal cross-file types that seam already established -- reused, not
// re-derived. See module doc #8/#9 (updated below) and the new "Identity
// resolution" section above the top-level component for the full T176 record.
import { resolveCurrentStudentId } from '../../lib/supabase/loaders/meetings';
import type { CurrentViewerIdentity, ResolveCurrentStudentIdFn } from '../meetings/MeetingsList';
// T176 -- real `teamId`/`goalHoursOverride` own-row resolution, additive-only
// new export on `loaders/students.ts` (see that file's own module doc for
// the query/RLS record). Aliased on import (not the destructured prop name
// below) purely to avoid shadowing this file's own `StudentHomeProps.resolveStudentScope`.
import {
  loadStudentHomeData,
  resolveStudentScope as defaultResolveStudentScope,
} from '../../lib/supabase/loaders/students';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real columns/views. Module docs #4/#5/#6.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

export interface HomeEventRow {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  /** `null` = all teams, per `events.team_ids`. */
  teamIds: readonly string[] | null;
  /** Verbatim rename of `events.counts_volunteer_hours`. */
  countsVolunteerHours: boolean;
}

export interface HomeSessionRow {
  id: string;
  eventId: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

export interface HomeRsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  updatedAt: string;
}

/** Verbatim camelCase rename of `v_student_hours`'s three real columns
 * (module doc #4, MET-04's numerator). Never recomputed in this file. */
export interface StudentHoursMetric {
  studentId: string;
  seasonId: string;
  confirmedHours: number;
}

/** Verbatim camelCase rename of `v_student_participation`'s seven real
 * columns (module doc #4, MET-01). Never recomputed in this file. */
export interface StudentParticipationMetric {
  studentId: string;
  teamId: string;
  seasonId: string;
  expectedCt: number;
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  participationPct: number;
}

export interface StudentHomeData {
  seasonId: string;
  displayName: string;
  defaultGoalHours: number;
  goalHoursOverride: number | null;
  events: readonly HomeEventRow[];
  sessions: readonly HomeSessionRow[];
  rsvps: readonly HomeRsvpRow[];
  /** `null` when no `v_student_hours` row exists yet (no completed
   * counts_volunteer_hours sessions) -- the real "absence, not a fabricated
   * 0" convention this view's own migration note describes. */
  studentHours: StudentHoursMetric | null;
  /** `null` when no `v_student_participation` row exists yet. */
  participation: StudentParticipationMetric | null;
}

export type LoadStudentHomeDataFn = (
  studentId: string,
  seasonId: string,
) => Promise<StudentHomeData>;

/**
 * T176 round 2 (coordinator correction, module doc #4) -- the resolved
 * student's own `team_id`/`goal_hours`/`confirmed_hours`/`planned_hours`,
 * read from `v_student_goal_projection` (`supabase/migrations/
 * 20260723000001_dashboard_views.sql:322-334`), NOT the raw `students`
 * table. `goalHours` is that view's own already-coalesced `goal_hours`
 * column (`coalesce(goal_hours_override, season default_goal_hours)`,
 * computed in SQL) -- a verbatim passthrough, never recomputed here (same
 * posture `CoachHome.tsx`'s own module doc "(g) Goal source" already
 * records for the season-wide reader of this same view). `confirmedHours`/
 * `plannedHours` are that view's own `confirmed_hours`/`planned_hours`
 * columns (its own LEFT JOINs to `v_student_hours`/
 * `v_student_planned_hours`) -- also verbatim passthroughs. Type OWNED
 * here (mirrors `MeetingsList.tsx`'s own `CurrentViewerIdentity`/
 * `ResolveCurrentStudentIdFn` cross-file shape, module doc #8) and
 * imported as a type by `loaders/students.ts`, which supplies the real
 * implementation (`resolveStudentScope`, additive-only export).
 *
 * T187 -- `teamIds` widens this scope from the single legacy
 * `students.team_id` primary-team column (module doc #8's own disclosed
 * narrowing) to the student's real ACTIVE `student_teams` memberships
 * (`loaders/students.ts`'s own new read, `left_on is null`). `teamId` is
 * KEPT unchanged (owner-ruled: the primary-team value may still serve
 * display, and keeping it means no other production consumer's own shape
 * changes) -- `teamIds` is the new field every team-scope predicate in this
 * file now reads from instead.
 */
export interface StudentScope {
  teamId: string;
  /** The student's ACTIVE `student_teams` memberships (module doc #8) --
   * may contain more than one id for a dual-team student. Never includes a
   * team the student has LEFT (`left_on is null` is the loader's own
   * filter). */
  teamIds: readonly string[];
  goalHours: number;
  confirmedHours: number;
  plannedHours: number;
}

/** `null` when the resolved student has no `v_student_goal_projection` row
 * (e.g. an inactive student, or genuinely no active season -- defensive;
 * in practice `StudentHome`'s own outer wrapper never mounts this seam
 * until `activeSeason.status === 'ready'`). */
export type ResolveStudentScopeFn = (studentId: string) => Promise<StudentScope | null>;

// ---------------------------------------------------------------------------
// Check-in contract -- module doc #5. Independently authored, shaped
// identically to `CheckinResult.tsx`'s real `callCheckin()` contract.
// ---------------------------------------------------------------------------

export interface CheckinSubmitCredential {
  sessionId: string;
  code: string;
}

export type CheckinAttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface CheckinSubmitAttendance {
  status: CheckinAttendanceStatus;
  checkInAt: string | null;
}

export interface CheckinSubmitError {
  code: string;
  message: string;
}

export type CheckinSubmitResult =
  | { ok: true; alreadyCheckedIn: boolean; attendance: CheckinSubmitAttendance }
  | { ok: false; error: CheckinSubmitError };

export type SubmitCheckinCodeFn = (
  credential: CheckinSubmitCredential,
) => Promise<CheckinSubmitResult>;

function readViteEnvVar(key: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[key];
}

/**
 * Real, typed `fetch()` call shaped exactly like T032's `checkin` contract
 * (module doc #5). Independently authored -- not imported from, or a
 * duplicate of, `CheckinResult.tsx`'s own `callCheckin()` (a forbidden file
 * here), but submits through the identical request/response shape.
 */
export async function defaultSubmitCheckinCode(
  credential: CheckinSubmitCredential,
): Promise<CheckinSubmitResult> {
  const supabaseUrl = (readViteEnvVar('VITE_SUPABASE_URL') ?? '').replace(/\/+$/, '');
  const anonKey = readViteEnvVar('VITE_SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl) {
    return {
      ok: false,
      error: {
        code: 'CHECKIN_CLIENT_NOT_CONFIGURED',
        message:
          'The check-in service is not configured for this environment. Contact an administrator.',
      },
    };
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { apikey: anonKey } : {}),
        // No real Supabase auth session exists anywhere in src/ yet (same
        // gap CheckinResult.tsx's module doc gap #1 discloses) -- omitting
        // Authorization entirely lets the real deployed function's own 401
        // UNAUTHENTICATED path handle this honestly.
      },
      body: JSON.stringify({ session_id: credential.sessionId, code: credential.code }),
    });
  } catch {
    return {
      ok: false,
      error: {
        code: 'CHECKIN_NETWORK_ERROR',
        message: 'Could not reach the check-in service. Check your connection and try again.',
      },
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: {
        code: 'CHECKIN_INVALID_RESPONSE',
        message: 'The check-in service returned an unexpected response. Try again.',
      },
    };
  }

  if (!response.ok) {
    const maybeError = (payload as { error?: Partial<CheckinSubmitError> } | null)?.error;
    if (
      maybeError &&
      typeof maybeError.code === 'string' &&
      typeof maybeError.message === 'string'
    ) {
      return { ok: false, error: { code: maybeError.code, message: maybeError.message } };
    }
    return {
      ok: false,
      error: {
        code: 'CHECKIN_UNKNOWN_ERROR',
        message: 'Something went wrong checking you in. Try again in a moment.',
      },
    };
  }

  const data = payload as {
    already_checked_in: boolean;
    attendance: { status: CheckinAttendanceStatus; check_in_at: string | null };
  };
  return {
    ok: true,
    alreadyCheckedIn: data.already_checked_in,
    attendance: { status: data.attendance.status, checkInAt: data.attendance.check_in_at },
  };
}

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #8.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_CURRENT_STUDENT_ID = 'student-placeholder-current-viewer';
export const PLACEHOLDER_CURRENT_TEAM_ID = 'team-placeholder-current-viewer';
const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing.
// ---------------------------------------------------------------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The ONLY team-scope predicate in this file -- honors `team_ids === null`
 * as "all teams" per the real `events` schema. T187: the second parameter is
 * the student's own ACTIVE team ids (plural -- a dual-team student), not a
 * single primary team; an event is in scope when it shares AT LEAST ONE id
 * with that set. */
export function isEventInTeamScope(
  event: { teamIds: readonly string[] | null },
  teamIds: readonly string[],
): boolean {
  return event.teamIds === null || event.teamIds.some((id) => teamIds.includes(id));
}

/** MTG-10's own literal wireframe annotation: "only while a session is
 * live" -- currently within [startsAt, endsAt], not a "starts soon" window
 * (unlike `CoachHome.tsx`'s coach-facing 60-minutes-before eligibility). */
export function isSessionLive(
  session: { startsAt: string; endsAt: string; status: SessionStatus },
  nowMs: number,
): boolean {
  if (session.status !== 'scheduled') return false;
  const startMs = new Date(session.startsAt).getTime();
  const endMs = new Date(session.endsAt).getTime();
  return nowMs >= startMs && nowMs <= endMs;
}

/** The earliest genuinely-live meeting-type session in team scope, or
 * `null` -- this file's own `hasLiveSession`-equivalent predicate (module
 * doc #1). */
export function selectLiveMeetingSession(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  teamIds: readonly string[],
  nowMs: number,
): HomeSessionRow | null {
  const meetingEventIds = new Set(
    events
      .filter((event) => event.type === 'meeting' && isEventInTeamScope(event, teamIds))
      .map((e) => e.id),
  );
  const live = sessions
    .filter((session) => meetingEventIds.has(session.eventId) && isSessionLive(session, nowMs))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return live[0] ?? null;
}

export interface NextUpRow {
  sessionId: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  /** `true` for an outreach row reached via a `going` RSVP -- eligible for
   * the inline "Can't go" action (module doc #6). */
  isOutreachGoing: boolean;
}

/** Module doc #6 -- meetings unconditionally (MTG-03, no RSVP), outreach
 * only via a `going` RSVP. Competitions deliberately excluded (the packet's
 * own text names only "meetings and outreach"). */
export function buildNextUp(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  rsvps: readonly HomeRsvpRow[],
  studentId: string,
  teamIds: readonly string[],
  nowMs: number,
  limit = 5,
): NextUpRow[] {
  const eventById = new Map(
    events
      .filter(
        (event) =>
          (event.type === 'meeting' || event.type === 'outreach') &&
          isEventInTeamScope(event, teamIds),
      )
      .map((event) => [event.id, event] as const),
  );
  return sessions
    .filter((session) => {
      if (session.status !== 'scheduled') return false;
      const event = eventById.get(session.eventId);
      if (!event) return false;
      if (new Date(session.endsAt).getTime() < nowMs) return false;
      if (event.type === 'meeting') return true;
      return rsvps.some(
        (rsvp) =>
          rsvp.sessionId === session.id && rsvp.studentId === studentId && rsvp.status === 'going',
      );
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit)
    .map((session) => {
      const event = eventById.get(session.eventId)!;
      return {
        sessionId: session.id,
        title: event.title,
        type: event.type,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        isOutreachGoing: event.type === 'outreach',
      };
    });
}

export interface SignupOpportunityRow {
  sessionId: string;
  title: string;
  startsAt: string;
}

/** Module doc #7 -- "unanswered" = a future, team-scoped, `outreach`-type
 * session with NO `rsvps` row at all for this student. Sorted
 * earliest-starting first ("oldest unanswered", module doc #7's disclosed
 * interpretation). */
export function getUnansweredOutreachOpportunities(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  rsvps: readonly HomeRsvpRow[],
  studentId: string,
  teamIds: readonly string[],
  nowMs: number,
): SignupOpportunityRow[] {
  const eventById = new Map(
    events
      .filter((event) => event.type === 'outreach' && isEventInTeamScope(event, teamIds))
      .map((event) => [event.id, event] as const),
  );
  return sessions
    .filter((session) => {
      if (session.status !== 'scheduled') return false;
      if (new Date(session.startsAt).getTime() < nowMs) return false;
      const event = eventById.get(session.eventId);
      if (!event) return false;
      return !rsvps.some((rsvp) => rsvp.sessionId === session.id && rsvp.studentId === studentId);
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((session) => ({
      sessionId: session.id,
      title: eventById.get(session.eventId)!.title,
      startsAt: session.startsAt,
    }));
}

/** `ends_at - starts_at`, in hours. */
export function sessionHours(session: { startsAt: string; endsAt: string }): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  return Math.max(0, ms / 3_600_000);
}

/** Module doc #3 -- a SEPARATE number from `confirmedHours`, never summed
 * with it. Sum of session-duration hours for still-`scheduled`
 * `counts_volunteer_hours` events the student has a `going` RSVP on. */
export function computePlannedHours(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  rsvps: readonly HomeRsvpRow[],
  studentId: string,
): number {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  let total = 0;
  for (const session of sessions) {
    if (session.status !== 'scheduled') continue;
    const event = eventById.get(session.eventId);
    if (!event || !event.countsVolunteerHours) continue;
    const hasGoingRsvp = rsvps.some(
      (rsvp) =>
        rsvp.sessionId === session.id && rsvp.studentId === studentId && rsvp.status === 'going',
    );
    if (!hasGoingRsvp) continue;
    total += sessionHours(session);
  }
  return round1(total);
}

/** MET-04's denominator (module doc #4): `goal_hours_override ?? season
 * default_goal_hours`. */
export function resolveGoalHours(
  goalHoursOverride: number | null,
  defaultGoalHours: number,
): number {
  return goalHoursOverride ?? defaultGoalHours;
}

/** UI-side percent math, no metric-view equivalent to duplicate (module doc
 * #4) -- same idiom `OutreachList.tsx`/`CoachHome.tsx` already established. */
export function hoursVsGoalPercent(confirmedHours: number, goalHours: number): number {
  if (goalHours <= 0) return 0;
  return Math.min(100, round1((confirmedHours / goalHours) * 100));
}

export type HeroState = 'live-checkin' | 'unanswered-rsvp' | 'quiet-greeting';

/** BEH-03 (module doc #2) -- the ONLY function that decides which hero
 * renders. Strict priority: (1) live check-in > (2) oldest unanswered
 * future RSVP > (3) quiet greeting. */
export function selectHeroState(
  hasLiveSession: boolean,
  unansweredOpportunityCount: number,
): HeroState {
  if (hasLiveSession) return 'live-checkin';
  if (unansweredOpportunityCount > 0) return 'unanswered-rsvp';
  return 'quiet-greeting';
}

/** Local (fixture-only, not persisted -- module doc #7) RSVP change,
 * synthesizing a new row when none existed yet. */
export function withLocalRsvpOverride(
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
    return [
      ...rsvps,
      { id: `local-rsvp-${studentId}-${sessionId}`, sessionId, studentId, status, updatedAt: now },
    ];
  }
  return rsvps.map((rsvp, index) =>
    index === existingIndex ? { ...rsvp, status, updatedAt: now } : rsvp,
  );
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported --
// `MeetingsList.tsx`/`OutreachList.tsx` are read-only reference files).
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

export function formatDateOnly(iso: string): string {
  return WEEKDAY_DATE_FORMATTER.format(new Date(iso));
}

export function formatDateTimeRange(startsAt: string, endsAt: string): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(endsAt));
  return `${formatDateOnly(startsAt)} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #9.
// ---------------------------------------------------------------------------

// Fixed reference instant the shipped fixture data is authored around
// (matches this task's real sandbox date, 2026-07-19).
export const FIXTURE_REFERENCE_NOW = new Date('2026-07-19T12:00:00.000Z');

const FIXTURE_EVENTS: readonly HomeEventRow[] = [
  {
    id: 'event-weekly-build',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Build Meeting',
    teamIds: null, // all teams
    countsVolunteerHours: false,
  },
  {
    id: 'event-stem-fair',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'STEM Fair',
    teamIds: [PLACEHOLDER_CURRENT_TEAM_ID],
    countsVolunteerHours: true,
  },
  {
    id: 'event-library-demo',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Library Demo',
    teamIds: [PLACEHOLDER_CURRENT_TEAM_ID],
    countsVolunteerHours: true,
  },
  // Titans-only -- proves team-scope exclusion everywhere below (Next up,
  // Sign-up opportunities, live-session selection).
  {
    id: 'event-titans-meeting',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Titans Strategy Session',
    teamIds: ['team-titans'],
    countsVolunteerHours: false,
  },
];

const FIXTURE_SESSIONS: readonly HomeSessionRow[] = [
  {
    id: 'session-build-upcoming',
    eventId: 'event-weekly-build',
    startsAt: '2026-07-21T23:00:00.000Z', // Tue 6:00 PM America/Chicago
    endsAt: '2026-07-22T01:00:00.000Z', // Tue 8:00 PM America/Chicago
    status: 'scheduled',
  },
  {
    id: 'session-stem-fair-upcoming',
    eventId: 'event-stem-fair',
    startsAt: '2026-07-25T15:00:00.000Z', // Sat 10:00 AM America/Chicago
    endsAt: '2026-07-25T18:00:00.000Z', // Sat 1:00 PM America/Chicago -- 3h
    status: 'scheduled',
  },
  {
    id: 'session-library-demo-upcoming',
    eventId: 'event-library-demo',
    startsAt: '2026-07-25T20:00:00.000Z',
    endsAt: '2026-07-25T22:00:00.000Z',
    status: 'scheduled',
  },
  // Titans-only, would otherwise be "live" relative to FIXTURE_REFERENCE_NOW
  // -- must be excluded everywhere by team scope (module doc #9).
  {
    id: 'session-titans-meeting',
    eventId: 'event-titans-meeting',
    startsAt: '2026-07-19T11:30:00.000Z',
    endsAt: '2026-07-19T13:30:00.000Z',
    status: 'scheduled',
  },
];

const FIXTURE_RSVPS: readonly HomeRsvpRow[] = [
  {
    id: 'rsvp-stem-fair-going',
    sessionId: 'session-stem-fair-upcoming',
    studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
    status: 'going',
    updatedAt: '2026-07-15T09:00:00.000Z',
  },
  // Deliberately NO rsvp row for session-library-demo-upcoming -- the
  // "unanswered" case (module doc #7).
];

/** Pre-computed `v_student_hours` row (module doc #4) -- never recomputed
 * by this file. */
const FIXTURE_STUDENT_HOURS: StudentHoursMetric = {
  studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
  seasonId: PLACEHOLDER_SEASON_ID,
  confirmedHours: 62,
};

/** Pre-computed `v_student_participation` row (module doc #4) -- what the
 * view's own SQL would have produced for these counts (8 expected, 7
 * present incl. 1 late, 0 excused -> round(100*7/8,1) = 87.5); never
 * computed by this file. */
const FIXTURE_PARTICIPATION: StudentParticipationMetric = {
  studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
  teamId: PLACEHOLDER_CURRENT_TEAM_ID,
  seasonId: PLACEHOLDER_SEASON_ID,
  expectedCt: 8,
  presentCt: 7,
  lateCt: 1,
  excusedCt: 0,
  participationPct: 87.5,
};

const FIXTURE_DEFAULT_GOAL_HOURS = 100;

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (module doc #9).
// ---------------------------------------------------------------------------

export async function defaultLoadStudentHomeData(
  studentId: string,
  seasonId: string,
): Promise<StudentHomeData> {
  return {
    seasonId,
    displayName: 'Ada Reyes',
    defaultGoalHours: FIXTURE_DEFAULT_GOAL_HOURS,
    goalHoursOverride: null,
    events: FIXTURE_EVENTS.filter((event) => event.seasonId === seasonId),
    sessions: FIXTURE_SESSIONS,
    rsvps: FIXTURE_RSVPS,
    studentHours: FIXTURE_STUDENT_HOURS.studentId === studentId ? FIXTURE_STUDENT_HOURS : null,
    participation: FIXTURE_PARTICIPATION.studentId === studentId ? FIXTURE_PARTICIPATION : null,
  };
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook.
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
// Hero -- module docs #1/#2. Exactly one of these three ever renders.
// ---------------------------------------------------------------------------

function LiveCheckInCard({
  session,
  submitCheckinCode,
}: {
  session: HomeSessionRow;
  submitCheckinCode: SubmitCheckinCodeFn;
}): ReactNode {
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [resultTitle, setResultTitle] = useState('');
  const [resultMessage, setResultMessage] = useState<string | undefined>(undefined);

  const isCodeComplete = code.length === 6;

  async function handleCheckIn(): Promise<void> {
    setPhase('submitting');
    const result = await submitCheckinCode({ sessionId: session.id, code });
    if (!result.ok) {
      setPhase('error');
      setResultTitle("Couldn't check you in");
      setResultMessage(result.error.message);
      return;
    }
    setPhase('success');
    setResultTitle(result.alreadyCheckedIn ? 'Already checked in' : "You're in");
    setResultMessage(
      result.attendance.checkInAt
        ? `Checked in at ${new Date(result.attendance.checkInAt).toLocaleTimeString()}`
        : undefined,
    );
  }

  return (
    <Card variant="default" padding={4}>
      <VStack gap={3}>
        <Heading level={2}>Meeting live now</Heading>
        <Text type="supporting">
          Scan the QR code on the kiosk screen, or enter the 6-character code shown there.
        </Text>
        <TextInput
          label="Check-in code"
          value={code}
          onChange={(value) =>
            setCode(
              value
                .replace(/[^a-zA-Z0-9]/g, '')
                .slice(0, 6)
                .toUpperCase(),
            )
          }
          placeholder="ABC123"
          isDisabled={phase === 'submitting' || phase === 'success'}
        />
        <Button
          label="Check in"
          variant="primary"
          isDisabled={!isCodeComplete || phase === 'success'}
          isLoading={phase === 'submitting'}
          onClick={() => {
            void handleCheckIn();
          }}
        />
        {phase === 'success' && (
          <Banner status="success" title={resultTitle} description={resultMessage} />
        )}
        {phase === 'error' && (
          <Banner status="error" title={resultTitle} description={resultMessage} />
        )}
      </VStack>
    </Card>
  );
}

function UnansweredRsvpHero({
  count,
  onReview,
}: {
  count: number;
  onReview: () => void;
}): ReactNode {
  return (
    <Card variant="default" padding={4}>
      <VStack gap={2}>
        <Heading
          level={2}
        >{`You have ${count} ${count === 1 ? 'event' : 'events'} to answer`}</Heading>
        <Text type="supporting">
          Respond to the sign-up opportunities below to let your coach know if you&apos;re going.
        </Text>
        <Button label="Review sign-up opportunities" variant="primary" onClick={onReview} />
      </VStack>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Next up / Sign-up opportunities rows.
// ---------------------------------------------------------------------------

function NextUpRowItem({
  row,
  onCantGo,
}: {
  row: NextUpRow;
  onCantGo: (sessionId: string, status: RsvpStatus) => void;
}): ReactNode {
  const description = (
    <Text type="supporting">{formatDateTimeRange(row.startsAt, row.endsAt)}</Text>
  );

  const menuItems: DropdownMenuOption[] = [
    { label: "Can't go", onClick: () => onCantGo(row.sessionId, 'declined') },
  ];

  const endContent = row.isOutreachGoing ? (
    <HStack gap={2} vAlign="center">
      <Badge variant="neutral" label="Going" />
      <MoreMenu items={menuItems} label={`Actions for ${row.title}`} />
    </HStack>
  ) : undefined;

  return <ListItem label={row.title} description={description} endContent={endContent} />;
}

function SignupOpportunityRowItem({
  row,
  onRespond,
}: {
  row: SignupOpportunityRow;
  onRespond: (sessionId: string, status: RsvpStatus) => void;
}): ReactNode {
  const description = <Text type="supporting">{formatDateOnly(row.startsAt)}</Text>;

  const endContent = (
    <HStack gap={2}>
      <Button
        label="Sign up"
        variant="secondary"
        onClick={() => onRespond(row.sessionId, 'going')}
      />
      <Button
        label="Can't go"
        variant="ghost"
        onClick={() => onRespond(row.sessionId, 'declined')}
      />
    </HStack>
  );

  return <ListItem label={row.title} description={description} endContent={endContent} />;
}

// ---------------------------------------------------------------------------
// Shared DES-12 loading skeleton -- module docs #8/#9/#10, T176 UPDATE.
// Reused for BOTH the outer wrapper's season-status 'loading' branch AND
// the content tier's own data-loading branch -- one implementation, so a
// future edit to either state's shape can't silently drift the other out of
// sync (same reasoning `CoachHome.tsx`'s own `CoachHomeLoadingSkeleton`,
// T155, already established for its sibling Home component).
// ---------------------------------------------------------------------------

function StudentHomeLoadingSkeleton(): ReactNode {
  return (
    <VStack gap={6} padding={6} aria-busy="true">
      <VisuallyHidden as="div" role="status">
        Loading Home…
      </VisuallyHidden>
      <Skeleton width={160} height={28} index={0} />
      <Skeleton width="100%" height={64} index={1} />
      <VStack gap={2}>
        <Skeleton width={180} height={20} index={2} />
        <Skeleton width="100%" height={10} index={3} />
        <Skeleton width={220} height={14} index={4} />
      </VStack>
      <VStack gap={2}>
        <Skeleton width={100} height={20} index={5} />
        {[0, 1].map((row) => (
          <HStack key={row} gap={4} vAlign="center">
            <Skeleton width={220} height={16} index={row + 6} />
            <Skeleton width={80} height={16} index={row + 8} />
          </HStack>
        ))}
      </VStack>
      <VStack gap={2}>
        <Skeleton width={200} height={20} index={10} />
        {[0, 1].map((row) => (
          <HStack key={row} gap={4} vAlign="center">
            <Skeleton width={220} height={16} index={row + 11} />
            <Skeleton width={80} height={16} index={row + 13} />
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Content tier -- module docs #8/#9/#10. Everything the pre-T176
// `StudentHome` body did, unchanged in behavior -- only WHERE
// `studentId`/`teamId`/`seasonId`/`goalHours`/`confirmedHours`/
// `plannedHours` come from changed (props from the identity-resolution
// tier below, instead of defaulted parameters / the still-fixture
// `loadData` result's own fields -- module doc #4, T176 round 2 correction).
// Only ever mounts once a real `studentId`/`teamId` are known (either
// resolved for real, or explicitly supplied -- module doc above the
// identity-resolution tier).
// ---------------------------------------------------------------------------

interface StudentHomeContentProps {
  studentId: string;
  /** T187: the student's ACTIVE `student_teams` memberships (module doc #8),
   * not the single legacy `teamId` -- this is what every team-scope
   * predicate below now reads. */
  teamIds: readonly string[];
  seasonId: string;
  /** Verbatim passthrough of `v_student_goal_projection.goal_hours`
   * (`resolveStudentScope`) -- already the coalesced
   * `goal_hours_override ?? season default_goal_hours` value, computed in
   * SQL. NOT fed through `resolveGoalHours` (module doc #4 T176 round 2). */
  goalHours: number;
  /** Verbatim passthrough of the same view's own `confirmed_hours` column
   * (its own `v_student_hours` LEFT JOIN). Replaces the pre-round-2
   * `data.studentHours?.confirmedHours ?? 0` (still-fixture) source. */
  confirmedHours: number;
  /** Verbatim passthrough of the same view's own `planned_hours` column
   * (its own `v_student_planned_hours` LEFT JOIN). Replaces the
   * pre-round-2 `computePlannedHours(...)` (still-fixture-sourced) call. */
  plannedHours: number;
  loadData: LoadStudentHomeDataFn;
  nowFn: () => Date;
  submitCheckinCode: SubmitCheckinCodeFn;
}

function StudentHomeContent({
  studentId,
  teamIds,
  seasonId,
  goalHours,
  confirmedHours,
  plannedHours,
  loadData,
  nowFn,
  submitCheckinCode,
}: StudentHomeContentProps): ReactNode {
  const loadState = useLoadState(
    () => loadData(studentId, seasonId),
    [loadData, studentId, seasonId],
  );
  const [rsvps, setRsvps] = useState<readonly HomeRsvpRow[]>([]);
  const opportunitiesSectionRef = useRef<HTMLDivElement | null>(null);

  // T129/UXC-01: stable ids for the "Next up" / "Sign-up opportunities"
  // `Heading`s, so each section's alternating List/EmptyState gets the
  // heading as its accessible name via `aria-labelledby` on a wrapping
  // `<div role="group">`, instead of the `List`'s own `header` prop (which
  // duplicates the visible title and disappears entirely in the empty
  // branch). CHECKER FIX (rework of T129, MAJOR): see `CoachHome.tsx`'s own
  // module doc for why the wrapper is a plain `<div role="group">`, not
  // `Section` (full-bleed margin + no nameable role).
  const nextUpHeadingId = useId();
  const opportunitiesHeadingId = useId();

  useEffect(() => {
    if (loadState.status === 'success') {
      setRsvps(loadState.data.rsvps);
    }
  }, [loadState]);

  if (loadState.status === 'loading') {
    return <StudentHomeLoadingSkeleton />;
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load Home"
          description="Something went wrong loading your Home page. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  const data = loadState.data;
  const nowMs = nowFn().getTime();

  const liveSession = selectLiveMeetingSession(data.sessions, data.events, teamId, nowMs);
  const nextUp = buildNextUp(data.sessions, data.events, rsvps, studentId, teamId, nowMs);
  const opportunities = getUnansweredOutreachOpportunities(
    data.sessions,
    data.events,
    rsvps,
    studentId,
    teamId,
    nowMs,
  );
  const heroState = selectHeroState(liveSession !== null, opportunities.length);

  // T176 round 2 (module doc #4): `confirmedHours`/`plannedHours`/
  // `goalHours` are all verbatim passthroughs of `v_student_goal_projection`
  // (props, from `resolveStudentScope`) -- NOT `data.studentHours`/
  // `computePlannedHours(...)`/`data.defaultGoalHours`/
  // `data.goalHoursOverride` (still-fixture `loadData` fields, kept on
  // `StudentHomeData` unchanged but no longer consulted for these three
  // numbers). `resolveGoalHours`/`computePlannedHours` themselves stay
  // exported and directly unit-tested, byte-unchanged; simply not called
  // from this render path anymore.
  const hoursPercent = hoursVsGoalPercent(confirmedHours, goalHours);

  function handleRsvpChange(sessionId: string, status: RsvpStatus): void {
    // Module doc #7: local-only. No Supabase write happens here.
    setRsvps((prev) => withLocalRsvpOverride(prev, studentId, sessionId, status));
  }

  return (
    <VStack gap={6} padding={6}>
      <Heading level={1}>{`Hi ${data.displayName}`}</Heading>

      {heroState === 'live-checkin' && liveSession !== null && (
        <LiveCheckInCard session={liveSession} submitCheckinCode={submitCheckinCode} />
      )}
      {heroState === 'unanswered-rsvp' && (
        <UnansweredRsvpHero
          count={opportunities.length}
          onReview={() => {
            // Moves both the viewport AND real programmatic keyboard focus
            // to the target section (the `tabIndex={-1}` div above makes it
            // focusable without adding it to the normal Tab order) --
            // scrollIntoView alone does not move focus, which would strand
            // keyboard/screen-reader users after activating this control.
            const target = opportunitiesSectionRef.current;
            target?.scrollIntoView({ behavior: 'smooth' });
            target?.focus();
          }}
        />
      )}
      {heroState === 'quiet-greeting' && (
        <Text type="supporting">
          You&apos;re all caught up. Nothing needs your attention right now.
        </Text>
      )}

      <VStack gap={2}>
        <Heading level={2}>Your outreach hours</Heading>
        <ProgressBar
          label="Outreach hours vs. your goal"
          isLabelHidden
          value={confirmedHours}
          max={goalHours > 0 ? goalHours : 1}
          hasValueLabel
          formatValueLabel={(value, max) => `${value} / ${max} h (${hoursPercent}%)`}
        />
        <Text type="supporting">{`${confirmedHours} h confirmed + ${plannedHours} h planned`}</Text>
        <Text type="body">
          {`Participation: ${data.participation !== null ? `${data.participation.participationPct}%` : '—'}`}
        </Text>
      </VStack>

      <Divider />
      <VStack gap={3}>
        <Heading level={2} id={nextUpHeadingId}>
          Next up
        </Heading>
        <div role="group" aria-labelledby={nextUpHeadingId}>
          {nextUp.length === 0 ? (
            <EmptyState
              headingLevel={3}
              title="Nothing scheduled"
              description="Your team's next meetings, and the outreach events you're going to, will show up here."
            />
          ) : (
            <List hasDividers>
              {nextUp.map((row) => (
                <NextUpRowItem key={row.sessionId} row={row} onCantGo={handleRsvpChange} />
              ))}
            </List>
          )}
        </div>
      </VStack>

      <Divider />
      <div ref={opportunitiesSectionRef} tabIndex={-1}>
        <VStack gap={3}>
          <Heading level={2} id={opportunitiesHeadingId}>
            Sign-up opportunities
          </Heading>
          <div role="group" aria-labelledby={opportunitiesHeadingId}>
            {opportunities.length === 0 ? (
              <EmptyState
                headingLevel={3}
                title="You're all caught up"
                description="Outreach events awaiting your response will show up here."
              />
            ) : (
              <List hasDividers>
                {opportunities.map((row) => (
                  <SignupOpportunityRowItem
                    key={row.sessionId}
                    row={row}
                    onRespond={handleRsvpChange}
                  />
                ))}
              </List>
            )}
          </div>
        </VStack>
      </div>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Identity-resolution tier -- T176. Real `studentId`/`teamId`/goal-hours
// resolution, mirroring `MeetingsList.tsx`'s own T096
// `ResolvedStudentMeetingsView`/`StudentMeetingsViewContainer` split
// (`../meetings/MeetingsList.tsx`, read-only reference, never imported --
// independently authored against the identical shape, per this task's own
// packet instruction not to edit that file).
//
// `resolveStudentIdentity` below composes the two resolution seams into one
// exported, independently-testable async function (same "pure-ish,
// exported, unit-testable" posture `buildNextUp`/`selectHeroState` already
// establish elsewhere in this file): resolve `studentId` (skip the
// `resolveStudentId` call entirely when `explicitStudentId` is supplied --
// plain `??` short-circuit, not a separate branch, so the call is
// GENUINELY never made, not just its result discarded), return
// `{kind:'not-linked'}` when it is `null` (no `students` row linked to this
// profile at all); then, UNLESS `explicitTeamId` is supplied (in which case
// there is no view row to read -- `goalHours` for this render honestly
// falls back to the real `seasonDefaultGoalHours` (the same value a
// `null`-override coalesce would have produced), `confirmedHours`/
// `plannedHours` default to `0` -- an honest default for the
// explicit-bypass path, never hit by a real signed-in caller), resolve
// `{teamId, goalHours, confirmedHours, plannedHours}` via
// `resolveStudentScope(studentId)`. T184: a `null` scope here does NOT mean
// "no student" -- `studentId` is already confirmed real by the branch
// above -- it means a REAL, linked `students` row with `is_active = false`
// (`v_student_goal_projection` ends `where s.is_active`,
// `dashboard_views.sql`), so this branch returns the distinct
// `{kind:'inactive'}` rather than reusing the `not-linked` result. Every
// other path returns `{kind:'linked', ...}`. See `StudentIdentityOutcome`
// below.
//
// T176 ROUND 2 (checker MAJOR fix -- see `loaders/students.ts`'s own module
// doc for the full record): this tier no longer skips its own mount when
// both `explicitStudentId`/`explicitTeamId` are supplied. Measured directly
// (throwaway local experiment, not committed): with the skip-mount branch
// removed, the rendered sequence is IDENTICAL in every configuration --
// `resolveStudentIdentity`'s own internal `??` short-circuit already makes
// resolution for a fully-explicit call settle within the SAME microtask
// tick regardless of whether this tier mounts at all (an `async function`
// with no real `await` work still returns a promise that resolves on the
// very next microtask, same as `useLoadState`'s own content-tier hop), so
// there is no observable "Finding your student record…" flash to avoid in
// the first place. The branch was therefore genuinely redundant, not
// merely un-tested -- deleted rather than pinned with a contrived test
// (the checker's own instruction: delete if genuinely redundant, pin
// otherwise). `StudentHome`'s own `'ready'` case below now renders
// `ResolvedStudentHomeView` directly.
// ---------------------------------------------------------------------------

export interface ResolvedStudentIdentity {
  studentId: string;
  teamId: string;
  goalHours: number;
  confirmedHours: number;
  plannedHours: number;
}

// T184: `resolveStudentIdentity` used to collapse two different facts into
// one `null` -- "no student row linked to this profile at all" and "a
// student row IS linked, but `students.is_active = false`" (deactivated) --
// because `resolveStudentScope` reads `v_student_goal_projection`, which
// ends `where s.is_active` (`dashboard_views.sql`), so a deactivated
// student's own real, linked `studentId` still resolves a `null` scope. The
// caller could not tell those two cases apart, so both rendered the SAME
// "No student account linked yet" copy -- false for a deactivated student
// who DOES have a linked record. `StudentIdentityOutcome` below is a
// three-way discriminated union so each fact gets its own, honest, distinct
// outcome: `'not-linked'` (no row at all) vs `'inactive'` (row exists,
// `resolveStudentScope` returned `null` for a `studentId` that
// `resolveStudentId` just confirmed is real). See `ResolvedStudentHomeView`
// below for the two independent EmptyStates this produces.
export type StudentIdentityOutcome =
  ({ kind: 'linked' } & ResolvedStudentIdentity) | { kind: 'not-linked' } | { kind: 'inactive' };

export async function resolveStudentIdentity(
  viewer: CurrentViewerIdentity,
  explicitStudentId: string | undefined,
  explicitTeamId: string | undefined,
  resolveStudentId: ResolveCurrentStudentIdFn,
  resolveStudentScope: ResolveStudentScopeFn,
  seasonDefaultGoalHours: number,
): Promise<StudentIdentityOutcome> {
  const studentId = explicitStudentId ?? (await resolveStudentId(viewer));
  if (studentId === null) return { kind: 'not-linked' };
  if (explicitTeamId !== undefined) {
    return {
      kind: 'linked',
      studentId,
      teamId: explicitTeamId,
      goalHours: seasonDefaultGoalHours,
      confirmedHours: 0,
      plannedHours: 0,
    };
  }
  const scope = await resolveStudentScope(studentId);
  if (scope === null) return { kind: 'inactive' };
  return {
    kind: 'linked',
    studentId,
    teamId: scope.teamId,
    goalHours: scope.goalHours,
    confirmedHours: scope.confirmedHours,
    plannedHours: scope.plannedHours,
  };
}

interface ResolvedStudentHomeViewProps {
  viewer: CurrentViewerIdentity;
  explicitStudentId: string | undefined;
  explicitTeamId: string | undefined;
  resolveStudentId: ResolveCurrentStudentIdFn;
  resolveStudentScope: ResolveStudentScopeFn;
  seasonId: string;
  seasonDefaultGoalHours: number;
  loadData: LoadStudentHomeDataFn;
  nowFn: () => Date;
  submitCheckinCode: SubmitCheckinCodeFn;
}

/**
 * Always mounts once `StudentHome`'s outer wrapper reaches
 * `activeSeason.status === 'ready'` (T176 round 2 -- no skip-mount branch
 * above this component anymore; see module doc above for why). Owns its
 * OWN loading/error/not-linked/inactive (T184) DES-12 copy, each
 * independently distinguishable from the content tier's own "Loading
 * Home…"/"Couldn't load Home" copy (criterion 7 -- not a re-run of T129's
 * shared-skeleton-text NIT) and from each other.
 */
function ResolvedStudentHomeView({
  viewer,
  explicitStudentId,
  explicitTeamId,
  resolveStudentId,
  resolveStudentScope,
  seasonId,
  seasonDefaultGoalHours,
  loadData,
  nowFn,
  submitCheckinCode,
}: ResolvedStudentHomeViewProps): ReactNode {
  const loadState = useLoadState(
    () =>
      resolveStudentIdentity(
        viewer,
        explicitStudentId,
        explicitTeamId,
        resolveStudentId,
        resolveStudentScope,
        seasonDefaultGoalHours,
      ),
    [
      viewer.id,
      viewer.role,
      explicitStudentId,
      explicitTeamId,
      resolveStudentId,
      resolveStudentScope,
      seasonDefaultGoalHours,
    ],
  );

  if (loadState.status === 'loading') {
    return (
      <VStack gap={3} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Finding your student record…
        </VisuallyHidden>
        <Skeleton width={160} height={20} index={0} />
        <Skeleton width={220} height={16} index={1} />
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't find your student record"
          description="Something went wrong looking up your student record. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  if (loadState.data.kind === 'not-linked') {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="No student account linked yet"
          description="We couldn't find a student record linked to your account yet. Once one is linked, your Home will show up here."
        />
      </VStack>
    );
  }

  if (loadState.data.kind === 'inactive') {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="Your student account is inactive"
          description="Your student account has been deactivated. If you think this is a mistake, contact your coach or team admin."
        />
      </VStack>
    );
  }

  const { studentId, teamId, goalHours, confirmedHours, plannedHours } = loadState.data;
  return (
    <StudentHomeContent
      studentId={studentId}
      teamId={teamId}
      seasonId={seasonId}
      goalHours={goalHours}
      confirmedHours={confirmedHours}
      plannedHours={plannedHours}
      loadData={loadData}
      nowFn={nowFn}
      submitCheckinCode={submitCheckinCode}
    />
  );
}

// ---------------------------------------------------------------------------
// Top-level component -- module docs #8/#9/#10, T176 UPDATE. Outer,
// season-status-dispatch-only wrapper, same shape `CoachHome.tsx`'s own
// T155 `CoachHome`/`CoachHomeContent` split already established for its
// sibling Home component. `user === null` MUST be checked BEFORE the
// `activeSeason.status` switch, not merged into it and not after it --
// `<SeasonProvider>`'s own first synchronous render is always
// `{status:'loading'}` regardless of who the user is (`SeasonProvider.tsx`),
// so a reordered check would show the season-loading skeleton instead of the
// sign-in prompt on the very first paint (criterion 5a -- measured, not
// theoretical: this file's own `StudentHome.test.tsx` "shows a sign-in
// prompt when signed out" test renders synchronously with no microtask
// flush). Both `useAuth()` and `useActiveSeason()` are called
// unconditionally before either conditional return, satisfying Rules of
// Hooks the same way `CoachHome`'s own module doc already describes for its
// own two hooks.
//
// No more `seasonId` prop (same T155 precedent `CoachHome.tsx`'s own
// `CoachHomeProps` doc already establishes for the identical reason): it is
// always `useActiveSeason().season.id` once resolved. No test in this file
// or `DashboardPage.test.tsx` ever passed `seasonId` as a render prop before
// this change (grep-verified), and production never set it either
// (`DashboardPage.tsx` renders `<StudentHome />` with no props).
// ---------------------------------------------------------------------------

export interface StudentHomeProps {
  /** Injectable data-loading seam (module doc #9). Defaults to fixture data. */
  loadData?: LoadStudentHomeDataFn;
  /** Explicit bypass for real `studentId` resolution (module doc above the
   * identity-resolution tier). Omitted (the real-world default) resolves
   * for real via `resolveStudentId`. */
  studentId?: string;
  /** Explicit bypass for real `teamId`/`goalHoursOverride` resolution (same
   * module doc). Omitted (the real-world default) resolves for real via
   * `resolveStudentScope`. */
  teamId?: string;
  /** Injectable clock for the live-session check / Next up window / Sign-up
   * opportunity filtering (module doc #2). Defaults to the real clock. */
  nowFn?: () => Date;
  /** Injectable check-in network call (module doc #5). Defaults to the real,
   * typed `fetch()` implementation. */
  submitCheckinCode?: SubmitCheckinCodeFn;
  /** T176 (module doc #8). Defaults to a real resolution
   * (`../../lib/supabase/loaders/meetings.ts`, reused verbatim from T096).
   * Only ever invoked when `studentId` above is NOT supplied. */
  resolveStudentId?: ResolveCurrentStudentIdFn;
  /** T176 (module doc #8). Defaults to a real resolution
   * (`../../lib/supabase/loaders/students.ts`, additive). Only ever invoked
   * when `teamId` above is NOT supplied. */
  resolveStudentScope?: ResolveStudentScopeFn;
}

export function StudentHome({
  loadData = loadStudentHomeData,
  studentId: explicitStudentId,
  teamId: explicitTeamId,
  nowFn = () => new Date(),
  submitCheckinCode = defaultSubmitCheckinCode,
  resolveStudentId = resolveCurrentStudentId,
  resolveStudentScope = defaultResolveStudentScope,
}: StudentHomeProps = {}): ReactNode {
  const { user } = useAuth();
  const activeSeason = useActiveSeason();

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="Sign in to view Home"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  switch (activeSeason.status) {
    case 'loading':
      return <StudentHomeLoadingSkeleton />;
    case 'none':
      return (
        <VStack gap={4} padding={6}>
          <Banner
            status="info"
            title="No active season yet"
            description="An admin needs to create and activate a season in Season settings before Home can show data here."
          />
        </VStack>
      );
    case 'error':
      return (
        <VStack gap={4} padding={6}>
          <Banner
            status="error"
            title="Couldn't load the active season"
            description={activeSeason.error.message}
            endContent={<Button variant="ghost" label="Retry" onClick={activeSeason.refresh} />}
          />
        </VStack>
      );
    case 'ready':
      return (
        <ResolvedStudentHomeView
          viewer={{ id: user.id, role: user.role }}
          explicitStudentId={explicitStudentId}
          explicitTeamId={explicitTeamId}
          resolveStudentId={resolveStudentId}
          resolveStudentScope={resolveStudentScope}
          seasonId={activeSeason.season.id}
          seasonDefaultGoalHours={activeSeason.season.defaultGoalHours}
          loadData={loadData}
          nowFn={nowFn}
          submitCheckinCode={submitCheckinCode}
        />
      );
  }
}

export default StudentHome;
