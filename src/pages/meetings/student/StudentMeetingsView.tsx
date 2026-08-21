/**
 * @file StudentMeetingsView.tsx
 * @position GAM-444 Stage B: the student/parent `/meetings` view, moved out
 *   of `src/pages/meetings/MeetingsList.tsx` byte-identical (module doc
 *   #3/#6/#7/#7d/#8 -- all travel with this code, verbatim, per GAM-444
 *   packet §6b's governing rule: "each numbered section travels with the
 *   code it documents"). `MeetingsList.tsx` itself is now a shell that
 *   renders `StudentMeetingsViewContainer` when `isCoachOrAdminView` is
 *   false.
 *
 *   `BadgeVariant`, `LoadState<T>`/`useLoadState` are duplicated here AND in
 *   `../coach/CoachMeetingsView.tsx` (both files need them; GAM-444's
 *   Allowed Files list has no shared-hook home in scope for this ticket).
 *   `ATTENDANCE_STATUS_BADGE` is student-only and lives only here;
 *   `formatPastAttendanceSummary`/`SESSION_STATUS_BADGE` are coach-only and
 *   live only in `../coach/CoachMeetingsView.tsx`.
 *
 *   `StudentMeetingsView` is exported (this file's own name, MTG-14/MTG-01c);
 *   `StudentMeetingsViewContainer` (the resolution wrapper, module doc #6,
 *   Trap #4) is also exported -- it is what the shell actually mounts.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  List,
  ListItem,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
// T189 -- honest "your account is inactive" copy (packet v2). Reads
// `students.is_active` directly (`loaders/students.ts`'s own module doc has
// the full reasoning for why this is NOT inferred from `resolveStudentScope`
// or the participation figure).
import type { ResolveStudentIsActiveFn } from '../../../lib/supabase/loaders/students';
// T180 (module doc #7d) -- T037's already-built, already-Passed BEH-06
// consistency-strip widget, mounted directly beneath this view's own
// Upcoming/Past history. `StudentMeetingView.tsx` is Trap #5's forbidden-
// export-signature-change file for this task; only its own comment text
// changes, never its exports.
import { StudentMeetingView } from '../StudentMeetingView';
import { formatTimeRangeWithDuration, formatWeekdayDate } from '../../../lib/meetings/format';
import type {
  AttendanceStatus,
  CurrentViewerIdentity,
  LoadStudentMeetingsDataFn,
  ResolveCurrentStudentIdFn,
  StudentMeetingHistoryRow,
} from '../../../lib/meetings/types';
import { partitionByStatus } from '../../../lib/meetings/studentModel';

/**
 * T030: `/meetings` list page -- student/parent role variant's own historical
 * doc, moved verbatim from `MeetingsList.tsx:22-30,130-191` (GAM-444 Stage C,
 * packet §6b). The coach-view preamble and sections #1-#5/#7-#10 live instead
 * in `../coach/CoachMeetingsView.tsx`'s own doc, alongside the code they
 * describe.
 *
 * Student/parent view (MTG-14, PRD line 288: "`/meetings` for students =
 * their own history (status per session) + participation %. ... Read-only.")
 * -- own Upcoming/Past history rows (no MoreMenu, no Schedule action -- this
 * variant is read-only per MTG-14's own text). T180 mounts the real BEH-06
 * consistency strip (`StudentMeetingView.tsx`, T037) beneath that history --
 * see module doc #7d, below -- which is now this view's sole participation
 * figure; this file no longer renders a participation `ProgressBar` of its
 * own (constitution item 3 / Known Context/Traps #3 still governs the strip
 * itself, a separate, already-Passed file this task only wires in).
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
// Status -> Badge variant mapping (student view only). DES-05's literal
// mapping (PRD line 195), used for the student's own per-session attendance
// status -- never the coach's session status badge
// (`../coach/CoachMeetingsView.tsx`'s `SESSION_STATUS_BADGE`).
// ---------------------------------------------------------------------------

const ATTENDANCE_STATUS_BADGE: Record<AttendanceStatus, { variant: BadgeVariant; label: string }> =
  {
    present: { variant: 'success', label: 'Present' },
    late: { variant: 'warning', label: 'Late' },
    excused: { variant: 'neutral', label: 'Excused' },
    absent: { variant: 'error', label: 'Absent' },
  };

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
// Student/parent view -- module doc #3/#7/#8.
// ---------------------------------------------------------------------------

function StudentHistoryRowItem({ row }: { row: StudentMeetingHistoryRow }): ReactNode {
  const description = (
    <VStack gap={0.5}>
      <Text type="supporting">
        {formatWeekdayDate(row.sessionDate)} ·{' '}
        {formatTimeRangeWithDuration(row.startsAt, row.endsAt)}
      </Text>
    </VStack>
  );

  const endContent =
    row.myAttendanceStatus !== null ? (
      <Badge
        variant={ATTENDANCE_STATUS_BADGE[row.myAttendanceStatus].variant}
        label={ATTENDANCE_STATUS_BADGE[row.myAttendanceStatus].label}
      />
    ) : (
      <Text type="supporting" color="secondary">
        Not yet held
      </Text>
    );

  return <ListItem label={row.title} description={description} endContent={endContent} />;
}

function StudentHistorySection({
  title,
  rows,
  emptyDescription,
}: {
  title: string;
  rows: StudentMeetingHistoryRow[];
  emptyDescription: string;
}): ReactNode {
  // T129/UXC-01: stable id for this section's `Heading` (see
  // `CoachMeetingsSection` above for the full rationale; this component
  // also renders twice -- Upcoming, Past -- each call gets its own id).
  const headingId = useId();
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
          <List hasDividers>
            {rows.map((row) => (
              <StudentHistoryRowItem key={row.sessionId} row={row} />
            ))}
          </List>
        )}
      </div>
    </VStack>
  );
}

export interface StudentMeetingsViewProps {
  studentId: string;
  loadData: LoadStudentMeetingsDataFn;
  /** T189 (module doc, "explicit-studentId branch never calls it" below).
   * Required, not defaulted, here -- both call sites (`StudentMeetingsViewContainer`'s
   * two branches) always supply one explicitly: the real seam on the
   * resolved path, `NOOP_RESOLVE_STUDENT_IS_ACTIVE` on the explicit-`studentId`
   * path. */
  resolveStudentIsActive: ResolveStudentIsActiveFn;
}

export function StudentMeetingsView({
  studentId,
  loadData,
  resolveStudentIsActive,
}: StudentMeetingsViewProps): ReactNode {
  // T189 -- issued alongside `loadData` (not a second independent DES-12
  // state machine): this page never needed a distinct loading/error state
  // for the is-active check itself, and combining it here means a failure
  // to read `is_active` surfaces through the SAME error Banner
  // `loadData`'s own failures already use, rather than inventing a new one
  // the packet never named.
  const loadState = useLoadState(
    () => Promise.all([loadData(studentId), resolveStudentIsActive(studentId)]),
    [loadData, resolveStudentIsActive, studentId],
  );

  if (loadState.status === 'loading') {
    return (
      <VStack gap={3} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading your meetings…
        </VisuallyHidden>
        <Skeleton width={100} height={20} index={0} />
        <VStack gap={2}>
          {[0, 1, 2].map((row) => (
            <HStack key={row} gap={4} vAlign="center">
              <Skeleton width={220} height={16} index={row * 2 + 1} />
              <Skeleton width={80} height={16} index={row * 2 + 2} />
            </HStack>
          ))}
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load your meeting history"
        description="Something went wrong loading your meeting history. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  const [{ history, participation }, isActive] = loadState.data;
  const { upcoming, past } = partitionByStatus(history);
  const isEmpty = history.length === 0 && participation === null;

  return (
    <VStack gap={6}>
      <Heading level={1}>Meetings</Heading>

      {/* T189 -- the inactive branch sits ABOVE the `isEmpty` ternary, not
          below it (packet v2 §5, gate-measured MAJOR 3): placing it below
          leaves a deactivated student with zero history rows falling into
          the `isEmpty` branch instead, where "No meeting history yet" would
          render and the honest copy never would -- the branch would be
          unreachable in that state. `true`/`null` both fall through exactly
          as before this task (`isActive === false`, not a bare falsy
          check). */}
      {isActive === false ? (
        <>
          <StudentHistorySection
            title="Upcoming"
            rows={upcoming}
            emptyDescription="You have no upcoming meetings scheduled."
          />
          <StudentHistorySection
            title="Past"
            rows={past}
            emptyDescription="Your past meeting attendance will show up here."
          />

          {/* Owner ruling (auto-mode-decisions.md:1151-1162, "honest
              copy"): say once, honestly, that the account is inactive and
              participation is therefore not tracked. Upcoming/Past history
              (above) stay visible -- hiding or blanking the page is not
              authorized. Neither the "Recent attendance" heading nor the
              real BEH-06 strip (`StudentMeetingView`) render here -- both
              would only re-surface the same contradiction this task closes
              (module doc #1 / the defect this task fixes: a deactivated
              student's real attendance dots sitting directly beside a
              "no completed meetings" participation claim). Same
              `EmptyState`-shaped honest block T184 already shipped for
              `StudentHome.tsx` (`:1690-1694`), copy extended (per packet v2
              §5) to also name participation. */}
          <EmptyState
            headingLevel={2}
            title="Your student account is inactive"
            description="Your student account has been deactivated. If you think this is a mistake, contact your coach or team admin. Participation isn't tracked while your account is inactive."
          />
        </>
      ) : isEmpty ? (
        <EmptyState
          headingLevel={2}
          title="No meeting history yet"
          description="Your meeting attendance and participation will show up here once meetings for your team have been scheduled and recorded."
        />
      ) : (
        <>
          <StudentHistorySection
            title="Upcoming"
            rows={upcoming}
            emptyDescription="You have no upcoming meetings scheduled."
          />
          <StudentHistorySection
            title="Past"
            rows={past}
            emptyDescription="Your past meeting attendance will show up here."
          />

          {/* T180 (module doc #7d) -- T037's real BEH-06 consistency strip,
              mounted with the `studentId` this view has already resolved
              (Trap #1: an explicit `studentId` bypasses the strip's own
              resolution entirely). Its own participation figure is this
              page's sole one now -- this file's former `Participation`
              `ProgressBar` (formerly above Upcoming) was deleted as part of
              this same change (Part B, T180's own packet) rather than
              shipping two independently-loaded participation regions. The
              strip carries its own DES-12 loading/error/empty states
              (Trap #4) -- no second state machine wraps it here. */}
          <Heading level={2}>Recent attendance</Heading>
          <StudentMeetingView variant="own" studentId={studentId} />
        </>
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Student/parent `studentId` resolution wrapper -- module doc #6, Trap #4.
// Only ever mounted when the caller does NOT supply an explicit `studentId`
// prop; an explicit `studentId` bypasses this entirely (unchanged behavior
// for every pre-existing `MeetingsList.test.tsx` case that already passes
// one).
// ---------------------------------------------------------------------------

interface ResolvedStudentMeetingsViewProps {
  viewer: CurrentViewerIdentity;
  resolveStudentId: ResolveCurrentStudentIdFn;
  resolveStudentIsActive: ResolveStudentIsActiveFn;
  loadData: LoadStudentMeetingsDataFn;
}

function ResolvedStudentMeetingsView({
  viewer,
  resolveStudentId,
  resolveStudentIsActive,
  loadData,
}: ResolvedStudentMeetingsViewProps): ReactNode {
  const loadState = useLoadState(
    () => resolveStudentId(viewer),
    [resolveStudentId, viewer.id, viewer.role],
  );

  if (loadState.status === 'loading') {
    return (
      <VStack gap={3} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Finding your student record…
        </VisuallyHidden>
        <Skeleton width={100} height={20} index={0} />
        <Skeleton width={220} height={16} index={1} />
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't find your student record"
        description="Something went wrong looking up which student this is for you. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  if (loadState.data === null) {
    return (
      <EmptyState
        headingLevel={1}
        title="No student account linked yet"
        description="We couldn't find a student record linked to your account yet. Once one is linked, your meetings will show up here."
      />
    );
  }

  return (
    <StudentMeetingsView
      studentId={loadState.data}
      loadData={loadData}
      resolveStudentIsActive={resolveStudentIsActive}
    />
  );
}

/**
 * T189 (C5) -- the explicit-`studentId` branch of `StudentMeetingsViewContainer`
 * below is a fixture-driven path (every pre-existing test, and any future
 * caller that already knows the exact student it wants) that never resolves
 * anything for real -- module doc #6 already establishes this for
 * `resolveStudentId`, and this task deliberately does not widen that: the
 * is-active check is resolution-adjacent, not resolution itself, but is
 * bypassed the same way for the same reason. This local no-op stands in on
 * that branch instead of the caller-supplied `resolveStudentIsActive` seam,
 * so a test's spy on that seam can assert it is genuinely never called
 * there (never a stubbed call count of 1 that merely resolves to a
 * "doesn't matter" value). `null` renders identically to `true` (module doc
 * above), so this has no visible effect on the explicit-`studentId` path.
 */
const NOOP_RESOLVE_STUDENT_IS_ACTIVE: ResolveStudentIsActiveFn = () => Promise.resolve(null);

interface StudentMeetingsViewContainerProps {
  viewer: CurrentViewerIdentity;
  explicitStudentId: string | undefined;
  resolveStudentId: ResolveCurrentStudentIdFn;
  resolveStudentIsActive: ResolveStudentIsActiveFn;
  loadData: LoadStudentMeetingsDataFn;
}

/** Module doc #6 -- an explicit `studentId` (every pre-existing test case)
 * renders `StudentMeetingsView` directly, exactly as before this task;
 * `undefined` (the new real-world default) routes through
 * `ResolvedStudentMeetingsView`'s own real `resolveStudentId` load state.
 * T189 (C5): the explicit branch passes `NOOP_RESOLVE_STUDENT_IS_ACTIVE`,
 * never the caller-supplied `resolveStudentIsActive` -- see that constant's
 * own doc immediately above. */
export function StudentMeetingsViewContainer({
  viewer,
  explicitStudentId,
  resolveStudentId,
  resolveStudentIsActive,
  loadData,
}: StudentMeetingsViewContainerProps): ReactNode {
  if (explicitStudentId !== undefined) {
    return (
      <StudentMeetingsView
        studentId={explicitStudentId}
        loadData={loadData}
        resolveStudentIsActive={NOOP_RESOLVE_STUDENT_IS_ACTIVE}
      />
    );
  }
  return (
    <ResolvedStudentMeetingsView
      viewer={viewer}
      resolveStudentId={resolveStudentId}
      resolveStudentIsActive={resolveStudentIsActive}
      loadData={loadData}
    />
  );
}
