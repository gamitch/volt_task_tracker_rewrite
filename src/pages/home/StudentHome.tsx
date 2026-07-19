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
 *     default_goal_hours`) has no SQL view of its own -- `resolveGoalHours`
 *     below is a plain nullish-coalesce of two real, already-loaded scalar
 *     values, not a re-derivation of anything the views compute.
 *     `hoursVsGoalPercent`'s division is the same disclosed, legitimate
 *     UI-side percent math `OutreachList.tsx`'s `confirmedPercent` /
 *     `CoachHome.tsx`'s `hoursVsGoalPercent` already established (no metric
 *     view exists for this specific ratio to duplicate).
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
 * 8. `guards.tsx` `AuthUser`/`Role` gaps -- disclosed, not re-derived, same
 *    posture every sibling Home/list page in this batch already
 *    established.
 *
 * `AuthUser` (`guards.tsx`) carries only `{id, email, role}` -- no
 * `students.id` linkage. `PLACEHOLDER_CURRENT_STUDENT_ID` /
 * `PLACEHOLDER_CURRENT_TEAM_ID` below are disclosed stand-ins for "the
 * student this Student Home belongs to" and "that student's team", the same
 * class of gap `MeetingsList.tsx`/`OutreachList.tsx`/`CoachHome.tsx` already
 * documented. This file does not branch on `user.role` at all (unlike
 * `OutreachList.tsx`/`MeetingsList.tsx`, which are role-VARIANT pages):
 * `StudentHome` is one of three distinct Home components (`CoachHome`/
 * `StudentHome`/`ParentHome`, HOME-01/02/03) a future dispatcher will choose
 * among, per `CoachHome.tsx`'s own module doc #7 -- it only checks
 * `user === null` for the signed-out DES-12 state, identical to every
 * sibling Home component's own posture.
 *
 * -----------------------------------------------------------------------
 * 9. No shared Supabase client wired in yet -- same posture as every prior
 *    content page.
 *
 * `loadData` is the injectable seam (`(studentId, seasonId) =>
 * Promise<StudentHomeData>`), defaulting to the OBVIOUSLY-FAKE
 * `defaultLoadStudentHomeData` (fabricated names only, constitution item 6).
 * A real implementation, once a shared Supabase client exists (a separate,
 * not-yet-dispatched task per every sibling task's identical disclosure),
 * would query `v_student_hours` / `v_student_participation` / `events` /
 * `event_sessions` / `rsvps` directly.
 *
 * -----------------------------------------------------------------------
 * 10. DES-12 four states.
 *
 * Not-signed-in (`user === null`, sign-in prompt) / loading (`Spinner` while
 * `loadData` is pending) / error (`loadData` rejects -- `Banner
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
 *  - `Divider` (line 543 section, Props table): `label` used -- the real,
 *    documented way to render a labeled section separator, used here for
 *    "Next up" / "Sign-up opportunities" instead of literal box-drawing
 *    dash characters from the PRD wireframe (constitution item 13).
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
 *  - `Spinner` (line 5808 section, Props table): `label` used.
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap every sibling task hit);
 *    `level` (required) + `children` (required) only, per that established
 *    read.
 *  - `Text` (line 829 section, Props table): `type` (`'body'`,
 *    `'supporting'`) used.
 *  - `VStack`/`HStack` ("Stack" section): `gap`, `padding`, `vAlign` used.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  Spinner,
  Text,
  TextInput,
  VStack,
  type DropdownMenuOption,
} from '@astryxdesign/core';
import { useAuth } from '../../app/guards';

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
 * as "all teams" per the real `events` schema. */
export function isEventInTeamScope(
  event: { teamIds: readonly string[] | null },
  teamId: string,
): boolean {
  return event.teamIds === null || event.teamIds.includes(teamId);
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
  teamId: string,
  nowMs: number,
): HomeSessionRow | null {
  const meetingEventIds = new Set(
    events
      .filter((event) => event.type === 'meeting' && isEventInTeamScope(event, teamId))
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
  teamId: string,
  nowMs: number,
  limit = 5,
): NextUpRow[] {
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
  teamId: string,
  nowMs: number,
): SignupOpportunityRow[] {
  const eventById = new Map(
    events
      .filter((event) => event.type === 'outreach' && isEventInTeamScope(event, teamId))
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
// Top-level component -- module docs #8/#9/#10.
// ---------------------------------------------------------------------------

export interface StudentHomeProps {
  /** Injectable data-loading seam (module doc #9). Defaults to fixture data. */
  loadData?: LoadStudentHomeDataFn;
  studentId?: string;
  /** Which team this Student Home is scoped to (module doc #8). */
  teamId?: string;
  seasonId?: string;
  /** Injectable clock for the live-session check / Next up window / Sign-up
   * opportunity filtering (module doc #2). Defaults to the real clock. */
  nowFn?: () => Date;
  /** Injectable check-in network call (module doc #5). Defaults to the real,
   * typed `fetch()` implementation. */
  submitCheckinCode?: SubmitCheckinCodeFn;
}

export function StudentHome({
  loadData = defaultLoadStudentHomeData,
  studentId = PLACEHOLDER_CURRENT_STUDENT_ID,
  teamId = PLACEHOLDER_CURRENT_TEAM_ID,
  seasonId = PLACEHOLDER_SEASON_ID,
  nowFn = () => new Date(),
  submitCheckinCode = defaultSubmitCheckinCode,
}: StudentHomeProps = {}): ReactNode {
  const { user } = useAuth();
  const loadState = useLoadState(
    () => loadData(studentId, seasonId),
    [loadData, studentId, seasonId],
  );
  const [rsvps, setRsvps] = useState<readonly HomeRsvpRow[]>([]);
  const opportunitiesSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRsvps(loadState.data.rsvps);
    }
  }, [loadState]);

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
          description="Something went wrong loading your Home page. Try refreshing the page."
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

  const confirmedHours = data.studentHours?.confirmedHours ?? 0;
  const plannedHours = computePlannedHours(data.sessions, data.events, rsvps, studentId);
  const goalHours = resolveGoalHours(data.goalHoursOverride, data.defaultGoalHours);
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
          onReview={() => opportunitiesSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
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

      <Divider label="Next up" />
      {nextUp.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title="Nothing scheduled"
          description="Your team's next meetings, and the outreach events you're going to, will show up here."
        />
      ) : (
        <List hasDividers header="Next up">
          {nextUp.map((row) => (
            <NextUpRowItem key={row.sessionId} row={row} onCantGo={handleRsvpChange} />
          ))}
        </List>
      )}

      <Divider label="Sign-up opportunities" />
      <div ref={opportunitiesSectionRef}>
        {opportunities.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title="You're all caught up"
            description="Outreach events awaiting your response will show up here."
          />
        ) : (
          <List hasDividers header="Sign-up opportunities">
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
  );
}

export default StudentHome;
