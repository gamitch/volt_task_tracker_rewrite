/**
 * @file HeroCard.tsx
 * @position GAM-444 Stage B stub. The student/parent hero card for the next
 *   meeting (MTG-01c, `docs/swarm/VOLT_Portal_PRD.md:317-318`: "Students and
 *   parents get a hero card for the next meeting plus their own attendance
 *   summary and history"). This file exists so a downstream
 *   meetings-redesign ticket owns it in isolation (packet §1,
 *   "file-disjointness"); GAM-444 itself adds no rendering logic here.
 */
import type { ReactNode } from 'react';
import type { StudentMeetingHistoryRow } from '../../../lib/meetings/types';

/** Props for {@link HeroCard}. */
export interface HeroCardProps {
  /** The nearest still-`scheduled` session for this student's own history,
   * or `null` when none is scheduled. */
  nextSession: StudentMeetingHistoryRow | null;
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function HeroCard(props: HeroCardProps): ReactNode {
  void props;
  return null;
}
