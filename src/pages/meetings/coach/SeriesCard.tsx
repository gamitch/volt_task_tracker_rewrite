/**
 * @file SeriesCard.tsx
 * @position GAM-444 Stage B stub. One fixed-size `Card` per meeting EVENT
 *   (recurring series), MTG-01a (`docs/swarm/VOLT_Portal_PRD.md:303-313`) --
 *   the coach page's own unit of the page, per the `meetings-design` skill
 *   ("Unit of the coach page is the series, not the session"). This file
 *   exists so a downstream meetings-redesign ticket owns it in isolation
 *   (packet §1, "file-disjointness"); GAM-444 itself adds no rendering
 *   logic here -- see `../../../lib/meetings/types.ts` for the frozen
 *   `SeriesCardModel`/`MeetingsFocusRequest` shapes this component's props
 *   are built from.
 */
import type { ReactNode } from 'react';
import type { MeetingsFocusRequest, SeriesCardModel } from '../../../lib/meetings/types';

/** Props for {@link SeriesCard}. */
export interface SeriesCardProps {
  /** The series (meeting event) this card renders -- MTG-01a's field list,
   * frozen in `SeriesCardModel`. */
  model: SeriesCardModel;
  /** Count of this series' own overlapping sessions (`meetings-design`
   * skill, "Overlap badges" -- the card's own count-badge site, one of the
   * three places an overlap badge may render). `0` or `undefined` renders
   * no badge. */
  overlapCount?: number;
  /** True when this card is the rail-focused / selected series (in-memory
   * focus state -- `meetings-design` skill, "Rail<->card selection is
   * in-memory focus state; no URL params required"). */
  isSelected?: boolean;
  /** Called when this card is activated, to drill into MTG-01b's schedule
   * panel and/or move rail focus. */
  onSelect?: (request: MeetingsFocusRequest) => void;
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 */
export function SeriesCard(props: SeriesCardProps): ReactNode {
  void props;
  return null;
}
