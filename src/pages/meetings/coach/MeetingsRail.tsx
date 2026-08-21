/**
 * @file MeetingsRail.tsx
 * @position GAM-444 Stage B stub. A month `Calendar` + per-day agenda
 *   (`meetings-design` skill, "The rest of the page, in one place" --
 *   "Rail is a month `Calendar` + per-day agenda. Rail<->card selection is
 *   in-memory focus state; no URL params required"). This file exists so a
 *   downstream meetings-redesign ticket owns it in isolation (packet §1,
 *   "file-disjointness"); GAM-444 itself adds no rendering logic here.
 */
import type { ReactNode } from 'react';
import type {
  CoachMeetingRow,
  MeetingsFocusRequest,
  OverlapIndex,
} from '../../../lib/meetings/types';

/** Props for {@link MeetingsRail}. */
export interface MeetingsRailProps {
  /** Every coach series row currently in view -- the rail's per-day agenda
   * is built from these rows' own sessions. */
  rows: readonly CoachMeetingRow[];
  /** Cross-series overlap lookup (`meetings-design` skill, "Overlap
   * badges"); the rail's agenda item is one of the three sites that render
   * an overlap badge. */
  overlapIndex: OverlapIndex;
  /** In-memory rail<->card focus state; `null` when nothing is focused. */
  focus: MeetingsFocusRequest | null;
  /** Called when the coach picks a day/session in the rail, or clears
   * focus (`null`). */
  onFocusChange: (request: MeetingsFocusRequest | null) => void;
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function MeetingsRail(props: MeetingsRailProps): ReactNode {
  void props;
  return null;
}
