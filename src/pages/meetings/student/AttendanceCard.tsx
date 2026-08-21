/**
 * @file AttendanceCard.tsx
 * @position GAM-444 Stage B stub. The student/parent view's own attendance
 *   summary card (MTG-01c, "hero card for the next meeting plus their own
 *   attendance summary and history"). `participationPct` is DATA-01
 *   passthrough from `v_student_participation` (never computed here -- see
 *   `StudentParticipationMetric`'s own doc, `../../../lib/meetings/types.ts`).
 *   This file exists so a downstream meetings-redesign ticket owns it in
 *   isolation (packet §1, "file-disjointness"); GAM-444 itself adds no
 *   rendering logic here.
 */
import type { ReactNode } from 'react';
import type { StudentParticipationMetric } from '../../../lib/meetings/types';

/** Props for {@link AttendanceCard}. */
export interface AttendanceCardProps {
  /** This student's own participation metric row, or `null` when they have
   * no row in the view at all (no explicit attendance mark this season --
   * see `StudentParticipationMetric`'s own doc for the `null` vs.
   * `participationPct: null` distinction). */
  participation: StudentParticipationMetric | null;
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function AttendanceCard(props: AttendanceCardProps): ReactNode {
  void props;
  return null;
}
