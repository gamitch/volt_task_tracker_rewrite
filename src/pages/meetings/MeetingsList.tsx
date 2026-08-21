/**
 * T030: `/meetings` list page (MTG-01 coach view / MTG-14 student+parent
 * view) -- now a shell. GAM-444 split the original ~2900-line file into:
 *
 *   - `src/lib/meetings/types.ts` -- the frozen type contracts (module doc
 *     sections that described types travel with their type).
 *   - `src/lib/meetings/coachModel.ts` / `studentModel.ts` -- pure builder
 *     functions + fixtures (sections `#1`/`#2`/`#3` moved to `coachModel.ts`;
 *     the fixture-identifier half of `#6` to `studentModel.ts`).
 *   - `coach/CoachMeetingsView.tsx` -- the coach/admin role variant, carrying
 *     this file's own former sections `#1`-`#3`/`#5`/`#7`-`#10` and the coach
 *     preamble paragraph, verbatim, unrenumbered (packet §6b).
 *   - `student/StudentMeetingsView.tsx` -- the student/parent role variant,
 *     carrying section `#6` and the student preamble paragraph.
 *   - `src/lib/meetings/format.ts` (GAM-443, unchanged by this ticket) --
 *     section `#4`'s own date/duration formatters.
 *
 * This file itself keeps only: the top-level role switch (former section
 * `#5`, inlined below), the injectable-seam defaults (former section `#7`'s
 * own prop-level citations), and the back-compat re-export surface (packet
 * §6) 11 external modules still import from this path.
 */

import type { ReactNode } from 'react';
import { EmptyState, VStack } from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import {
  cancelMeetingSession,
  createMeetings,
  loadCoachMeetingsData,
  loadStudentMeetingsData,
  resolveCurrentStudentId,
  saveMeetingSeries,
  saveMeetingSession,
} from '../../lib/supabase/loaders/meetings';
import type { OnCreateMeetingsFn, OnSaveMeetingSeriesFn } from './ScheduleMeetingsDialog';
import type { OnSaveMeetingSessionFn } from './EditMeetingSessionDialog';
// T189 -- aliased so the default param below can share the prop's own name.
import {
  resolveStudentIsActive as defaultResolveStudentIsActive,
  type ResolveStudentIsActiveFn,
} from '../../lib/supabase/loaders/students';
import { CoachMeetingsView } from './coach/CoachMeetingsView';
import { StudentMeetingsViewContainer } from './student/StudentMeetingsView';
import type {
  CancelMeetingSessionFn,
  LoadCoachMeetingsDataFn,
  LoadStudentMeetingsDataFn,
  ResolveCurrentStudentIdFn,
} from '../../lib/meetings/types';

// ---------------------------------------------------------------------------
// GAM-444 back-compat re-exports (packet §6) -- every name this page module
// exported before the split, unchanged, so its 11 external importers need
// no edit.
// ---------------------------------------------------------------------------

export type {
  AttendanceStatus,
  CancelMeetingSessionFn,
  CoachMeetingEventTableRow,
  CoachMeetingRow,
  CoachMeetingRowSummary,
  CoachMeetingSessionDetail,
  CoachMeetingSessionDetailTableRow,
  CoachMeetingTableRow,
  CoachMeetingsData,
  CurrentViewerIdentity,
  EventType,
  LoadCoachMeetingsDataFn,
  LoadStudentMeetingsDataFn,
  PartitionedRows,
  PastAttendanceSummary,
  ResolveCurrentStudentIdFn,
  SessionStatus,
  StudentMeetingHistoryRow,
  StudentMeetingsData,
  StudentParticipationMetric,
} from '../../lib/meetings/types';

export {
  PLACEHOLDER_CURRENT_STUDENT_ID,
  buildCoachMeetingRows,
  buildCoachMeetingTableRows,
  defaultLoadCoachMeetingsData,
  partitionCoachMeetingRows,
  summarizeCoachMeetingRow,
} from '../../lib/meetings/coachModel';

export {
  buildStudentMeetingsData,
  defaultLoadStudentMeetingsData,
  partitionByStatus,
} from '../../lib/meetings/studentModel';

// GAM-443 -- see `../../lib/meetings/format.ts`'s own doc (former section #4).
export {
  buildDateRangeLabel,
  buildRecurrenceChips,
  formatDuration,
  formatHoursLabel,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
} from '../../lib/meetings/format';

// ---------------------------------------------------------------------------
// Top-level component -- former section #5/#6, now inlined below.
// ---------------------------------------------------------------------------

export interface MeetingsListProps {
  /** Coach/admin view seam. Defaults to a real query. */
  loadCoachData?: LoadCoachMeetingsDataFn;
  /** Student/parent view seam. Defaults to a real query, same module. */
  loadStudentData?: LoadStudentMeetingsDataFn;
  /** Defaults to a real `event_sessions.status = 'canceled'` mutation. */
  onCancelSession?: CancelMeetingSessionFn;
  /** Defaults to a real `events`/`event_sessions` insert. */
  onCreateMeetings?: OnCreateMeetingsFn;
  /** Defaults to a real future-forward reconciliation mutation. */
  onSaveMeetingSeries?: OnSaveMeetingSeriesFn;
  /** Defaults to a real guarded, in-place `event_sessions` update. */
  onSaveMeetingSession?: OnSaveMeetingSessionFn;
  /** Defaults to a real resolution. Only invoked when `studentId` below is
   * NOT supplied. */
  resolveStudentId?: ResolveCurrentStudentIdFn;
  /** Defaults to a real query reading `students.is_active` for the resolved
   * student id. Only invoked on the resolved path -- when `studentId` below
   * IS supplied, `StudentMeetingsViewContainer`'s own
   * `NOOP_RESOLVE_STUDENT_IS_ACTIVE` is used instead. */
  resolveStudentIsActive?: ResolveStudentIsActiveFn;
  /**
   * Which student the student/parent view is scoped to. When omitted (the
   * real-world default), this is resolved via `resolveStudentId` instead of
   * falling back to a placeholder -- supplying it explicitly (as every
   * fixture-driven caller/test does) bypasses that resolution entirely.
   */
  studentId?: string;
}

export function MeetingsList({
  loadCoachData = loadCoachMeetingsData,
  loadStudentData = loadStudentMeetingsData,
  onCancelSession = cancelMeetingSession,
  onCreateMeetings = createMeetings,
  onSaveMeetingSeries = saveMeetingSeries,
  onSaveMeetingSession = saveMeetingSession,
  resolveStudentId = resolveCurrentStudentId,
  resolveStudentIsActive = defaultResolveStudentIsActive,
  studentId,
}: MeetingsListProps = {}): ReactNode {
  const { user } = useAuth();

  // Only the two role literals present in `guards.tsx`'s `Role` union are
  // compared directly; everything else (including a real 'student'/'parent'
  // value) falls through to the student/parent view.
  const isCoachOrAdminView = user !== null && (user.role === 'coach' || user.role === 'admin');

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="Sign in to view meetings"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  return (
    <VStack gap={6} padding={6}>
      {isCoachOrAdminView ? (
        <CoachMeetingsView
          loadData={loadCoachData}
          onCancelSession={onCancelSession}
          onCreateMeetings={onCreateMeetings}
          onSaveMeetingSeries={onSaveMeetingSeries}
          onSaveMeetingSession={onSaveMeetingSession}
        />
      ) : (
        <StudentMeetingsViewContainer
          viewer={{ id: user.id, role: user.role }}
          explicitStudentId={studentId}
          resolveStudentId={resolveStudentId}
          resolveStudentIsActive={resolveStudentIsActive}
          loadData={loadStudentData}
        />
      )}
    </VStack>
  );
}

export default MeetingsList;
