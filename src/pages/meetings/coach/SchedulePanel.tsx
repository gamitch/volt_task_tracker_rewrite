/**
 * @file SchedulePanel.tsx
 * @position GAM-444 Stage B stub. A month-tab schedule panel listing one
 *   series' own sessions for a selected month, with per-session status and
 *   the existing edit/cancel affordances (MTG-01b,
 *   `docs/swarm/VOLT_Portal_PRD.md:314-316`). The per-row `Edit` chip from
 *   the 2026-07-28 PRD deviation is retained here per MTG-01b's own text.
 *   This file exists so a downstream meetings-redesign ticket owns it in
 *   isolation (packet §1, "file-disjointness"); GAM-444 itself adds no
 *   rendering logic here.
 */
import type { ReactNode } from 'react';
import type { CoachMeetingSessionDetail } from '../../../lib/meetings/types';

/** Props for {@link SchedulePanel}. */
export interface SchedulePanelProps {
  /** The real `events.id` of the series this panel is drilled into. */
  eventId: string;
  /** This series' own sessions, across every month -- the panel buckets
   * these by month itself; callers do not pre-filter by month. */
  sessions: readonly CoachMeetingSessionDetail[];
  /** The month currently selected, `YYYY-MM` -- matches
   * `MeetingsFocusRequest.monthKey` (`../../../lib/meetings/types.ts`). */
  selectedMonthKey?: string;
  /** Called when the coach selects a different month tab. */
  onMonthChange?: (monthKey: string) => void;
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function SchedulePanel(props: SchedulePanelProps): ReactNode {
  void props;
  return null;
}
