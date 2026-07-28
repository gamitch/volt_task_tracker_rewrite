/**
 * T130 (VOLT UX Craft PRD v3.1, UXC-03): "One shared three-tier `renderCell`
 * stat helper (micro-label / value w/ `hasTabularNumbers` / secondary)
 * across rows and tiles."
 *
 * EXTRACTED, not re-designed -- this is the exact three-`Text` shape that
 * was already rendering three separate times before this task, verbatim
 * (same `type`/`color`/`weight`/`hasTabularNumbers` props, same tier order):
 *
 *   - `OutreachList.tsx` (pre-T130) lines 1789-1795 -- the "Confirmed"/
 *     "Planned"/"Goal"/"% of goal" tiles inside `GoalProgressBar`.
 *   - `OutreachList.tsx` (pre-T130) lines 1959-1968 -- the per-row
 *     "Planned"/"Expected" (or "Logged"/"Attended" + optional "Reached N")
 *     stat pair inside each coach event row's `endContent`.
 *   - `KpiStrip.tsx` lines 313-330 (`KpiTile`) / `CoachHome.tsx` lines
 *     1773-1794 (`KpiCard`) -- the same label/value/secondary idea, one
 *     level up, wrapped in a `Card` + `Heading` for a standalone dashboard
 *     tile (that `Card`/`Heading` wrapper is deliberately NOT part of this
 *     component -- see below).
 *
 * `GoalProgressBar` (`OutreachList.tsx`) is NOT refactored to consume this
 * component by this task -- out of scope, explicitly named in this task's
 * own worker packet ("do not refactor `GoalProgressBar`... Extract *from*
 * its shape; leave the component itself alone"), because its exact rendered
 * output ("9 hrs confirmed" / "7 hrs planned") is pinned by
 * `OutreachList.test.tsx:1296-1297`. This component exists so `OutreachList`
 * (T130, the coach event-row `Table` cells) and future callers (T131's
 * rollout, W5-P4's dashboard/tile work) can all render the identical shape
 * from one place instead of re-copying the same three `Text` elements a
 * fourth/fifth time.
 *
 * Deliberately NOT `Card`/`Heading`-wrapped (unlike `KpiTile`/`KpiCard`):
 * this component's first, real consumer is a `Table` `renderCell` (a table
 * cell, not a standalone dashboard tile), so it renders bare `Text`
 * elements only -- a future dashboard-tile caller can still wrap this same
 * component in its own `Card`+optional `Heading` shell, same composition
 * `KpiTile`/`KpiCard` already use around their own (currently un-extracted)
 * copy of this shape.
 */
import type { ReactNode } from 'react';
import { Text, VStack } from '@astryxdesign/core';

export interface StatCellProps {
  /** Micro-label, e.g. "Planned" / "Logged" / "Confirmed". */
  label: string;
  /** The tabular-numeric headline value, e.g. "3h" / "2 students". */
  value: string;
  /** Optional third tier, e.g. "Reached 45". Omitted entirely when absent
   * (never an empty `Text` node). */
  secondary?: string;
}

export function StatCell({ label, value, secondary }: StatCellProps): ReactNode {
  return (
    <VStack gap={0}>
      <Text type="label" color="secondary">
        {label}
      </Text>
      <Text type="body" weight="semibold" hasTabularNumbers>
        {value}
      </Text>
      {secondary !== undefined && <Text type="supporting">{secondary}</Text>}
    </VStack>
  );
}
