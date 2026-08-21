/**
 * @file ChildSwitcher.tsx
 * @position GAM-444 Stage B stub. Lets a parent switch between linked
 *   students (MTG-01c: "parents switch linked students"). This file exists
 *   so a downstream meetings-redesign ticket owns it in isolation (packet
 *   §1, "file-disjointness"); GAM-444 itself adds no rendering logic here.
 *
 *   No frozen type backs the roster entry shape below -- GAM-444's own
 *   frozen-contract list (packet §4) does not name one, so it is declared
 *   inline here rather than invented into `types.ts`.
 */
import type { ReactNode } from 'react';

/** One linked student this parent can switch to. */
export interface ChildSwitcherOption {
  /** The real `students.id` this option switches to. */
  id: string;
  /** First name + last initial only (`meetings-design` skill, item 6 --
   * never a full last name on a surface showing other students). */
  displayName: string;
}

/** Props for {@link ChildSwitcher}. */
export interface ChildSwitcherProps {
  /** Every student linked to this parent's account, in resolution order
   * (earliest-linked first -- matches `resolveCurrentStudentId`'s own
   * earliest-linked-child convention, `../../../lib/meetings/resolveCurrentStudentId.ts`). */
  students: readonly ChildSwitcherOption[];
  /** The `students.id` currently in view. */
  selectedStudentId: string;
  /** Called when the parent picks a different linked student. */
  onSelect: (studentId: string) => void;
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function ChildSwitcher(props: ChildSwitcherProps): ReactNode {
  void props;
  return null;
}
