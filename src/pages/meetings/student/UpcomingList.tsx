/**
 * @file UpcomingList.tsx
 * @position GAM-444 Stage B stub. The student/parent view's own Upcoming
 *   history rows (MTG-01c/MTG-14, read-only -- `meetings-design` skill,
 *   "Student/parent (MTG-01c): hero card for the next meeting + attendance
 *   summary + history; parents switch linked students; read-only"). This
 *   file exists so a downstream meetings-redesign ticket owns it in
 *   isolation (packet §1, "file-disjointness"); GAM-444 itself adds no
 *   rendering logic here.
 */
import type { ReactNode } from 'react';
import type { StudentMeetingHistoryRow } from '../../../lib/meetings/types';

/** Props for {@link UpcomingList}. */
export interface UpcomingListProps {
  /** This student's own still-`scheduled` sessions, sorted ascending by
   * `startsAt` (same ordering `partitionByStatus`'s `upcoming` bucket
   * already produces, `../../../lib/meetings/studentModel.ts`). */
  rows: readonly StudentMeetingHistoryRow[];
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function UpcomingList(props: UpcomingListProps): ReactNode {
  void props;
  return null;
}
