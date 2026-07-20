/**
 * T043: `ParentRsvp.tsx` -- parent RSVP-on-behalf (OUT-06, PRD line 297):
 *
 * "**OUT-06 Parent RSVP-on-behalf:** parents may set their linked student's
 * RSVP; `responded_by = parent`. Student sees 'Mom signed you up' (`Timestamp`
 * + responder name) and may change it."
 *
 * This is the parent-facing counterpart of `RsvpControl.tsx` (T040, OUT-03,
 * Forbidden Files/read-only reference here) -- same `SegmentedControl`
 * status-mapping shape (`RSVP_ITEMS` below, independently reimplemented since
 * that file cannot be imported), different `responded_by` attribution (the
 * ACTING PARENT's own real `profiles.id`, not the student's) and a different
 * responder-attribution DISPLAY (relationship-labeled "Mom signed you up"
 * instead of a plain student self-answer line).
 *
 * -----------------------------------------------------------------------
 * 1. THE CRUX OF THIS TASK -- `responded_by` is a real `profiles.id` FK,
 *    NEVER a literal `'parent'`/`'student'` role string (packet's own
 *    corrected-from-an-earlier-flawed-draft Ground Truth #1).
 *
 * Confirmed by direct read of `supabase/migrations/
 * 20260717000000_scheduling_attendance.sql` line 72: `responded_by uuid
 * references public.profiles (id) on delete restrict` -- nullable, no
 * `'parent'`/`'student'` text value anywhere in this column. The PRD's own
 * literal wording ("`responded_by = parent`", line 297) is loose shorthand
 * for "responded_by is set to the profile id of a parent", not a literal
 * schema value -- writing the string `'parent'` into this column would
 * violate the FK constraint outright. This component writes `responded_by`
 * as the ACTING PARENT'S OWN real `profiles.id`, via the same injectable
 * auth/session seam pattern `RsvpControl.tsx`'s `currentUserProfileId` prop
 * established (`currentUserProfileId` prop below, defaulting to a disclosed,
 * obviously-fake placeholder, DIFFERENT literal shape than that file's own
 * placeholder -- `PLACEHOLDER_CURRENT_PARENT_PROFILE_ID` below -- so the two
 * are never accidentally interchangeable).
 *
 * -----------------------------------------------------------------------
 * 2. THE `responded_by`-TO-SPECIFIC-PARENT-IDENTITY RESOLUTION (Ground Truth
 *    #1, Required Worker Output's own explicit ask) -- this is the READ side
 *    of the crux above, and it is NOT derivable from `responded_by`'s value
 *    alone.
 *
 * `responded_by` is just a `profiles.id` -- it carries no role/relationship
 * information by itself. To answer "was this RSVP set by a parent, and if
 * so, which relationship label do we show ('Mom'/'Dad'/'Guardian'/etc.)?",
 * `resolveRsvpResponderAttribution` below cross-references `responded_by`
 * against `guardian_links` (`parent_profile_id`, `student_id`,
 * `relationship` -- `20260716000000_identity_roster.sql` lines 72-79) for a
 * row matching `(parent_profile_id = responded_by, student_id = studentId)`,
 * and reads THAT row's `relationship` text for the label. Four distinct,
 * exhaustively-typed outcomes (`RsvpResponderAttribution`'s discriminated
 * union), each independently proven in the test file:
 *
 *   (a) `respondedBy === null` -> `{ kind: 'none' }` -- no RSVP has been
 *       recorded yet, plain "No response recorded" display.
 *   (b) `respondedBy === studentProfileId` (the STUDENT's own `profiles.id`
 *       -- NOT `rsvps.student_id`, a different id space entirely; see #3
 *       below) -> `{ kind: 'self' }` -- the student answered for themself,
 *       plain/no-attribution display (no "X signed you up" line at all).
 *   (c) `respondedBy` matches a `guardian_links` row for this student ->
 *       `{ kind: 'guardian', relationship, guardianLink }` -- the
 *       relationship-labeled "Mom signed you up" display, PRD line 297's
 *       literal example, using that row's actual `relationship` TEXT value
 *       (not a hardcoded `'Mom'`).
 *   (d) `respondedBy` is a real profile id but matches NEITHER the student
 *       NOR any of their `guardian_links` rows -- `{ kind: 'unrecognized',
 *       respondedByProfileId }`. THE EDGE CASE THE PACKET EXPLICITLY ASKS TO
 *       DISCLOSE, NOT SILENTLY MISATTRIBUTE: this is a real, plausible state
 *       given the schema alone allows ANY `profiles.id` here (e.g. a coach
 *       recording an RSVP on a student's behalf during a phone call, or an
 *       admin correcting a record) -- `buildResponderAttributionLabel` below
 *       renders a deliberately GENERIC "Someone else recorded this response
 *       on your student's behalf" line for this case, never fabricating a
 *       parent/relationship label that isn't actually backed by a matching
 *       `guardian_links` row. DECISION (disclosed, not silently chosen): this
 *       is the one safe, honest reading given the schema places no
 *       role/CHECK constraint on `responded_by` beyond "a valid profile" --
 *       a different, out-of-scope task could later add a `profiles.role`
 *       lookup for a more specific "recorded by a coach" label, but that
 *       lookup isn't available in this task's Allowed Files/data shape, so
 *       it is not fabricated here.
 *
 * -----------------------------------------------------------------------
 * 3. `profiles.id` vs `students.id` vs `students.profile_id` -- three
 *    distinct id spaces, never conflated (same distinction `RsvpControl.tsx`
 *    module doc #3 already established for the STUDENT-facing side).
 *
 * `rsvps.student_id` (this component's `studentId` prop) is a `students.id`
 * FK. `public.students` (`20260716000000_identity_roster.sql` line 61) has
 * its OWN separate `profile_id uuid references public.profiles (id)` column
 * (nullable -- a student may not have an account/profile yet), which is a
 * DIFFERENT value than `students.id`. Comparing `responded_by` (a
 * `profiles.id`) against `rsvps.student_id` (a `students.id`) would ALWAYS
 * be a type-confused false negative -- this component therefore takes a
 * SEPARATE `studentProfileId: string | null` prop (that student's own
 * `students.profile_id`, distinct from `studentId`) specifically so outcome
 * (b) above can be computed correctly.
 *
 * -----------------------------------------------------------------------
 * 4. Single-student-scoped reusable component (Known Context/Traps #4,
 *    packet's own explicit "state your reasoning" ask) -- NOT
 *    multi-student-aware itself.
 *
 * This component takes one `studentId` and renders/writes ONE student's RSVP
 * for ONE session, matching `RsvpControl.tsx`'s own single-student-scoped
 * shape exactly (same `RsvpRow`/`RsvpControlSession` per-instance shape) and
 * this task's narrow Allowed-Files scope (one new file, no page-level
 * multi-student list/loop scaffolding). This mirrors the SAME established
 * repo-wide precedent `StudentMeetingView.tsx`'s `variant="linked"` mode and
 * `ParentHome.tsx`'s `loadLinkedStudents()` outer seam already set: a parent
 * page renders ONE reusable per-student component once per `guardian_links`
 * row, rather than each per-student component re-deriving "which students is
 * this parent linked to" itself. A future page (`ParentHome.tsx`,
 * `OutreachDetail.tsx`) is expected to render one `<ParentRsvp>` per linked
 * student, passing each student's own `studentId`/`studentProfileId`/
 * `guardianLinks` slice -- not built here (outside this task's Allowed
 * Files).
 *
 * -----------------------------------------------------------------------
 * 5. Student-override trap (Ground Truth #2) -- no parent-only locking
 *    mechanism added.
 *
 * The one editability rule this component enforces -- `isRsvpEditable`/
 * `isSessionTimeEditable` below, independently reimplemented from
 * `RsvpControl.tsx`'s identical pure functions since that file is Forbidden
 * Files -- is the SAME universal "editable until session start, and only
 * while `event_sessions.status === 'scheduled'`" rule OUT-03 (PRD line 294)
 * already applies to every `rsvps` row regardless of who last set it; it is
 * not an ADDITIONAL parent-only lock layered on top. Nothing in this file
 * gates on "was this RSVP last set by a parent" -- a student using
 * `RsvpControl.tsx` can freely change an RSVP this component set, and this
 * component can freely change one the student set, right up until the same
 * shared `starts_at` boundary both controls independently compute.
 *
 * -----------------------------------------------------------------------
 * 6. `Timestamp` + responder attribution rendering -- the read-side display
 *    concern (Ground Truth #3), proven for BOTH the parent-set and
 *    non-parent-set paths.
 *
 * Whenever an `rsvps` row exists for this student/session, this component
 * renders a persistent "current RSVP state" block ABOVE the write control:
 * the current status label (`rsvpStatusLabel`, reused idiom from
 * `RsvpControl.tsx` module doc #2, independently reimplemented) plus, when
 * attribution resolves to `kind === 'guardian'`, a `Text` line
 * "`{relationship} signed you up`" (PRD line 297's literal "Mom signed you
 * up" example, using the real relationship text) immediately followed by a
 * real `Timestamp` (`astryx-api.md` line 5944 section) sourced from
 * `rsvps.updated_at` (`format="date_time"`, so the exact saved moment is
 * legible, not a bare relative "2 hours ago" with no absolute fallback
 * visible without hovering). `kind === 'self'`/`'none'` render NO
 * attribution line at all (plain display, no `Timestamp` either -- there is
 * nothing responder-specific to timestamp); `kind === 'unrecognized'` renders
 * the generic disclosed line from module doc #2(d), also with a real
 * `Timestamp`.
 *
 * -----------------------------------------------------------------------
 * 7. T101 (ED-1 Packet P10) UPDATE: `onRsvpChange` now defaults to the SAME
 *    real `rsvps` upsert `RsvpControl.tsx` uses.
 *
 * `onRsvpChange` now defaults to `submitRsvpChange`
 * (`../../lib/supabase/loaders/outreach.ts`) -- the identical real function
 * `RsvpControl.tsx`'s own default now also uses (that loader module's own
 * Trap #2 module doc has the full "one shared function, not two" decision
 * writeup: `RsvpChangeParams` here and there are field-for-field identical,
 * and the real RLS policy on `rsvps` already covers both "student
 * self-RSVP" and "parent RSVP-on-behalf" via a single `my_student_ids()`
 * union, so there is no genuine per-actor difference at the write layer).
 * This component still writes `responded_by = currentUserProfileId` (the
 * ACTING PARENT's own profile id, module doc #1 -- unchanged), never the
 * student's. `defaultOnRsvpChange` (below) is KEPT as a named export for
 * callers/tests that want an explicit no-network, log-only stub, but is no
 * longer this component's own runtime default.
 *
 * -----------------------------------------------------------------------
 * 8. Optimistic local selection + rollback on failure -- same idiom
 *    `RsvpControl.tsx` module doc #7 established, independently
 *    reimplemented here (that file is Forbidden Files). Selecting a segment
 *    synthesizes an optimistic `RsvpRow` (carrying `respondedBy =
 *    currentUserProfileId` and `updatedAt = now()`) so the attribution
 *    display updates immediately; on rejection the previous `RsvpRow` (or
 *    `null`) is restored and a `Banner status="error"` explains the failure.
 *
 * -----------------------------------------------------------------------
 * 9. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped live
 *    for this task):
 *
 *  - `SegmentedControl` (line 5575 section, Props table): `value` (required),
 *    `onChange` (required), `label` (required), `isDisabled`,
 *    `disabledMessage` used.
 *  - `SegmentedControlItem` (doc's own subsection, line 5615, `undefined` --
 *    same disclosed CLI-cross-checked gap `RsvpControl.tsx` already hit):
 *    `value` (required), `label` (required) used.
 *  - `Text` (line 829 section, Props table): `type` (`'label'`,
 *    `'supporting'`), `color` used.
 *  - `Timestamp` (line 5944 section, Props table): `value` (required),
 *    `format` (`'date_time'`), `color` used.
 *  - `Banner` (line 2694 section, Props table): `status` (required), `title`
 *    (required), `description`, `isDismissable`, `onDismiss` used.
 *  - `VStack`/`HStack` ("Stack" section, lines 374/350): `gap`, `vAlign`
 *    used.
 *
 * -----------------------------------------------------------------------
 * 10. Constitution item 13 -- no box-drawing/bracket characters rendered.
 *     Grep-provable: no `┌`/`─`/`│`/`[`/`]` character appears in any string
 *     literal rendered by this file. The one non-ASCII character rendered,
 *     the em dash `—` (U+2014) in the locked-state message, is a real
 *     punctuation character, not a box-drawing glyph (U+2500 `─` is a
 *     distinct, different codepoint) -- same disclosed distinction
 *     `RsvpControl.tsx`/`ParentHome.tsx` already made.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Banner,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  Timestamp,
  VStack,
} from '@astryxdesign/core';
// T101 (ED-1 Packet P10): real `onRsvpChange` default, shared with
// `RsvpControl.tsx` -- module doc #7.
import { submitRsvpChange } from '../../lib/supabase/loaders/outreach';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets, matching
// `RsvpControl.tsx`'s own field names/casing (module doc #4) plus the
// `guardian_links` shape (module doc #2/#3).
// ---------------------------------------------------------------------------

export type RsvpStatus = 'going' | 'maybe' | 'declined';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface RsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface RsvpControlSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
}

/** Display-only `guardian_links` row shape (module doc #2/#3), NOT a
 * re-derivation of the real table -- `id`, `parentProfileId`, `studentId`,
 * `relationship` map 1:1 to `id`, `parent_profile_id`, `student_id`,
 * `relationship` (`20260716000000_identity_roster.sql` lines 72-79). */
export interface GuardianLinkRow {
  id: string;
  parentProfileId: string;
  studentId: string;
  relationship: string;
}

export interface RsvpChangeParams {
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  /** Module doc #1 -- the ACTING PARENT's own real `profiles.id`, never a
   * literal role string. */
  respondedBy: string;
}

export type OnRsvpChangeFn = (params: RsvpChangeParams) => Promise<void>;

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #1.
// ---------------------------------------------------------------------------

/**
 * Disclosed, obviously-fake stand-in for "the signed-in parent's own
 * `profiles.id`" until a real Supabase-backed auth context is wired into
 * this batch. Deliberately a DIFFERENT literal shape/prefix than
 * `RsvpControl.tsx`'s `PLACEHOLDER_CURRENT_USER_PROFILE_ID` -- both are
 * `profiles.id`-space placeholders, but for different actors (student vs.
 * parent), so they are never accidentally interchangeable in a test/fixture.
 */
export const PLACEHOLDER_CURRENT_PARENT_PROFILE_ID = 'profile-placeholder-current-parent';

/** Not a real RSVP status -- never matches an actual `SegmentedControlItem`
 * value, so passing it as `value` leaves the control visually unselected,
 * the correct representation of "no `rsvps` row exists yet". Same sentinel
 * idiom `RsvpControl.tsx`/`OutreachList.tsx` already established. */
const UNANSWERED_RSVP_SEGMENT_VALUE = 'unanswered';

// ---------------------------------------------------------------------------
// The label-vs-stored-value mapping -- reused idiom from `RsvpControl.tsx`
// module doc #2, independently reimplemented here (that file is Forbidden
// Files/read-only reference only). OUT-03's own literal labels (PRD line
// 294), NOT an invented divergent set.
// ---------------------------------------------------------------------------

export const RSVP_ITEMS: readonly { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Sign up' },
  { value: 'maybe', label: 'Maybe' },
  // The real `rsvps.status` check constraint only accepts the enum value
  // 'declined' -- "Can't go" is only ever the user-facing label.
  { value: 'declined', label: "Can't go" },
];

export function rsvpStatusLabel(status: RsvpStatus): string {
  return RSVP_ITEMS.find((item) => item.value === status)?.label ?? status;
}

// ---------------------------------------------------------------------------
// The `responded_by`-to-specific-parent-identity resolution -- module doc #2,
// the crux of this task. Pure functions, exported for direct testing.
// ---------------------------------------------------------------------------

export type RsvpResponderAttribution =
  | { kind: 'none' }
  | { kind: 'self' }
  | { kind: 'guardian'; relationship: string; guardianLink: GuardianLinkRow }
  | { kind: 'unrecognized'; respondedByProfileId: string };

/**
 * Cross-references `responded_by` against `guardian_links` -- `responded_by`
 * alone carries no role/relationship information (module doc #2). Returns
 * one of four exhaustively-typed outcomes; see module doc #2(a)-(d).
 */
export function resolveRsvpResponderAttribution(
  respondedBy: string | null,
  studentId: string,
  studentProfileId: string | null,
  guardianLinks: readonly GuardianLinkRow[],
): RsvpResponderAttribution {
  if (respondedBy === null) {
    return { kind: 'none' };
  }
  if (studentProfileId !== null && respondedBy === studentProfileId) {
    return { kind: 'self' };
  }
  const guardianLink = guardianLinks.find(
    (link) => link.studentId === studentId && link.parentProfileId === respondedBy,
  );
  if (guardianLink) {
    return { kind: 'guardian', relationship: guardianLink.relationship, guardianLink };
  }
  // Module doc #2(d) -- the disclosed edge case: matches neither the student
  // nor any guardian_links row. Never silently misattributed as a parent.
  return { kind: 'unrecognized', respondedByProfileId: respondedBy };
}

/** The ONE place attribution-label copy is produced (module doc #2/#6).
 * `null` means "render no attribution line" (self-answered or unanswered). */
export function buildResponderAttributionLabel(
  attribution: RsvpResponderAttribution,
): string | null {
  switch (attribution.kind) {
    case 'guardian':
      // PRD line 297's literal "Mom signed you up" example, using the real
      // `guardian_links.relationship` text, not a hardcoded 'Mom'.
      return `${attribution.relationship} signed you up`;
    case 'unrecognized':
      // Module doc #2(d) -- deliberately generic, never fabricates a
      // relationship that isn't backed by a real guardian_links row.
      return "Someone else recorded this response on your student's behalf";
    case 'self':
    case 'none':
      return null;
  }
}

// ---------------------------------------------------------------------------
// Pure functions -- session-start editability boundary. Module doc #5,
// independently reimplemented from `RsvpControl.tsx`'s identical functions
// (that file is Forbidden Files) -- the SAME universal rule, not a
// parent-only addition.
// ---------------------------------------------------------------------------

export function isSessionTimeEditable(startsAt: string, now: Date): boolean {
  return now.getTime() < new Date(startsAt).getTime();
}

export function isRsvpEditable(session: RsvpControlSession, now: Date): boolean {
  return session.status === 'scheduled' && isSessionTimeEditable(session.startsAt, now);
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- independently reimplemented (not imported)
// -- `RsvpControl.tsx` is not in this task's Allowed Files.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

export function formatSessionDateOnly(session: RsvpControlSession): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
}

// ---------------------------------------------------------------------------
// Default injectable seams -- module doc #7.
// ---------------------------------------------------------------------------

export const defaultOnRsvpChange: OnRsvpChangeFn = async (params) => {
  console.warn(
    '[ParentRsvp] No Supabase client wired in yet (module doc #7) -- this stub only logs the ' +
      'rsvps upsert that would have been persisted.',
    params,
  );
};

function defaultNow(): Date {
  return new Date();
}

// ---------------------------------------------------------------------------
// Live session-start lock boundary -- reused idiom, independently
// reimplemented (module doc #5).
// ---------------------------------------------------------------------------

function useSessionRsvpLock(session: RsvpControlSession, getNow: () => Date): boolean {
  const computeIsEditable = useCallback(() => isRsvpEditable(session, getNow()), [session, getNow]);
  const [isEditable, setIsEditable] = useState(computeIsEditable);

  useEffect(() => {
    setIsEditable(computeIsEditable());
    if (!computeIsEditable()) return;
    const msUntilLock = new Date(session.startsAt).getTime() - getNow().getTime();
    // `window.setTimeout`'s delay is a signed 32-bit int (max 2147483647ms,
    // ~24.85 days) -- an over-range delay is silently CLAMPED to 1ms rather
    // than throwing, which would fire almost immediately and incorrectly
    // lock a session that's actually weeks away. No timer is scheduled at
    // all beyond this bound (a natural re-render/remount recomputes
    // `isEditable` correctly long before such a distant boundary is reached).
    if (msUntilLock <= 0 || msUntilLock > 2147483647) return;
    const timeoutId = window.setTimeout(() => setIsEditable(false), msUntilLock);
    return () => window.clearTimeout(timeoutId);
  }, [computeIsEditable, session.startsAt, getNow]);

  return isEditable;
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface ParentRsvpProps {
  /** `rsvps.student_id` -- the ONE linked student this instance is scoped to
   * (module doc #4). */
  studentId: string;
  /** That student's OWN `profiles.id` (`students.profile_id`, a DIFFERENT id
   * space than `studentId` -- module doc #3), or `null` when the student has
   * no linked profile/account yet. Used only to detect "the student answered
   * for themself" (module doc #2(b)). */
  studentProfileId: string | null;
  session: RsvpControlSession;
  /** Display context only, e.g. `events.title` -- used in the control's
   * accessible label and lock messaging. */
  eventTitle: string;
  /** The current `rsvps` row for `(session.id, studentId)`, or `null` when
   * none exists yet. */
  currentRsvp: RsvpRow | null;
  /** This student's own `guardian_links` rows (module doc #2/#4) -- the
   * caller is expected to pass rows already scoped to `studentId` (matching
   * `ParentHome.tsx`/`StudentMeetingView.tsx`'s own pre-filtered
   * per-student-slice convention); this component additionally re-checks
   * `link.studentId === studentId` defensively inside
   * `resolveRsvpResponderAttribution`. */
  guardianLinks: readonly GuardianLinkRow[];
  /** Injectable auth/session seam (module doc #1) -- the ACTING PARENT's own
   * real `profiles.id`, attributed to `responded_by` on write. Defaults to a
   * disclosed placeholder `profiles.id`. */
  currentUserProfileId?: string;
  /** Injectable persistence seam (module doc #7). T101: defaults to a real
   * `rsvps` upsert (`submitRsvpChange`, `../../lib/supabase/loaders/
   * outreach.ts`, shared with `RsvpControl.tsx`); `defaultOnRsvpChange`
   * (log-only) remains exported for callers/tests that want to inject it
   * explicitly. */
  onRsvpChange?: OnRsvpChangeFn;
  /** Injectable clock seam so the session-start lock boundary is
   * deterministically testable (module doc #5). Defaults to the real system
   * clock. */
  now?: () => Date;
}

export function ParentRsvp({
  studentId,
  studentProfileId,
  session,
  eventTitle,
  currentRsvp,
  guardianLinks,
  currentUserProfileId = PLACEHOLDER_CURRENT_PARENT_PROFILE_ID,
  onRsvpChange = submitRsvpChange,
  now = defaultNow,
}: ParentRsvpProps): ReactNode {
  const isEditable = useSessionRsvpLock(session, now);

  const [displayedRsvp, setDisplayedRsvp] = useState<RsvpRow | null>(currentRsvp);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Module doc #8 -- resync whenever the caller's own `currentRsvp` changes
  // (e.g. a future re-fetch after a successful write elsewhere, possibly by
  // the student's own `RsvpControl.tsx`).
  useEffect(() => {
    setDisplayedRsvp(currentRsvp);
  }, [currentRsvp, session.id, studentId]);

  const attribution = resolveRsvpResponderAttribution(
    displayedRsvp?.respondedBy ?? null,
    studentId,
    studentProfileId,
    guardianLinks,
  );
  const attributionLabel = buildResponderAttributionLabel(attribution);

  async function handleChange(value: string): Promise<void> {
    if (!isEditable || isSubmitting) return;
    const nextStatus = value as RsvpStatus;
    const previousRsvp = displayedRsvp;
    // Optimistic (module doc #8) -- synthesize the row this write would
    // produce so the attribution display updates immediately.
    const optimisticRsvp: RsvpRow = {
      id: previousRsvp?.id ?? `pending-${session.id}-${studentId}`,
      sessionId: session.id,
      studentId,
      status: nextStatus,
      respondedBy: currentUserProfileId,
      updatedAt: now().toISOString(),
      createdAt: previousRsvp?.createdAt ?? now().toISOString(),
    };
    setDisplayedRsvp(optimisticRsvp);
    setSubmitError(null);
    setConfirmation(null);
    setIsSubmitting(true);
    try {
      await onRsvpChange({
        sessionId: session.id,
        studentId,
        status: nextStatus,
        respondedBy: currentUserProfileId,
      });
      setConfirmation(`RSVP saved: ${rsvpStatusLabel(nextStatus)}`);
    } catch (error) {
      setDisplayedRsvp(previousRsvp); // rollback (module doc #8)
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong saving your student's RSVP.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const controlLabel = `RSVP on behalf of your student for ${eventTitle} on ${formatSessionDateOnly(session)}`;

  return (
    <VStack gap={2}>
      {/* Read-side current-state display (module doc #6) -- rendered
          whenever an rsvps row exists, regardless of who set it. */}
      {displayedRsvp !== null ? (
        <VStack gap={0.5}>
          <Text type="label">Current response: {rsvpStatusLabel(displayedRsvp.status)}</Text>
          {attributionLabel !== null && (
            <HStack gap={1} vAlign="center">
              <Text type="supporting" color="secondary">
                {attributionLabel}
              </Text>
              <Timestamp value={displayedRsvp.updatedAt} format="date_time" color="secondary" />
            </HStack>
          )}
        </VStack>
      ) : (
        <Text type="supporting" color="secondary">
          No response recorded yet.
        </Text>
      )}

      <SegmentedControl
        value={displayedRsvp?.status ?? UNANSWERED_RSVP_SEGMENT_VALUE}
        onChange={(value) => {
          void handleChange(value);
        }}
        label={controlLabel}
        isDisabled={!isEditable || isSubmitting}
        disabledMessage={
          isEditable ? undefined : 'This session has already started, so RSVP changes are locked.'
        }
      >
        {RSVP_ITEMS.map((item) => (
          <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
        ))}
      </SegmentedControl>

      {isEditable ? (
        <Text type="supporting">
          You can change this on your student's behalf until the event starts.
        </Text>
      ) : (
        <Text type="supporting" color="secondary">
          RSVP locked — this session already started.
        </Text>
      )}

      {confirmation !== null && (
        <Banner
          status="success"
          title={confirmation}
          isDismissable
          onDismiss={() => setConfirmation(null)}
        />
      )}

      {submitError !== null && (
        <Banner
          status="error"
          title="Couldn't save your student's RSVP"
          description={submitError}
        />
      )}
    </VStack>
  );
}

export default ParentRsvp;
