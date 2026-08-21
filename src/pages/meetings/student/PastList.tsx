/**
 * @file PastList.tsx
 * @position GAM-444 Stage B stub. The student/parent view's own Past
 *   history rows (MTG-01c/MTG-14, read-only), sibling to `UpcomingList.tsx`
 *   in this same directory. This file exists so a downstream
 *   meetings-redesign ticket owns it in isolation (packet §1,
 *   "file-disjointness"); GAM-444 itself adds no rendering logic here.
 */
import type { ReactNode } from 'react';
import type { StudentMeetingHistoryRow } from '../../../lib/meetings/types';

/** Props for {@link PastList}. */
export interface PastListProps {
  /** This student's own `completed`/`canceled` sessions, sorted descending
   * by `startsAt` (same ordering `partitionByStatus`'s `past` bucket
   * already produces, `../../../lib/meetings/studentModel.ts`). */
  rows: readonly StudentMeetingHistoryRow[];
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function PastList(props: PastListProps): ReactNode {
  void props;
  return null;
}
