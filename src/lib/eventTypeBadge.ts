/**
 * @file eventTypeBadge.ts
 * @input Uses `BadgeVariant` from `@astryxdesign/core` only -- no other repo
 *   modules.
 * @output Exports `EventType` and `EVENT_TYPE_BADGE`, the single event-type
 *   -> `Badge` variant/label mapping DES-04 requires.
 * @position Shared `src/lib/` utility. New in T138 (UXC-05, part 1 of 3) --
 *   this mapping was previously declared three times independently
 *   (`CoachHome.tsx`, `EventsTab.tsx`, `CalendarPage.tsx`), each derived
 *   separately from the same PRD source and agreeing today only by
 *   coincidence, not by construction (see `EventsTab.tsx`'s own module doc
 *   for that history). This file consolidates the one mapping so all three
 *   call sites import it instead of re-deriving it.
 *
 * SYNC: no other files require updating when this one changes -- it has no
 * generated/mirrored artifacts.
 */
import type { BadgeVariant } from '@astryxdesign/core';

export type EventType = 'meeting' | 'outreach' | 'competition';

/**
 * DES-04's named palette (PRD lines 186-193, cited verbatim in
 * `CalendarPage.tsx`'s own module doc #2): Meeting Violet = Astryx `purple`,
 * Circuit Blue = Astryx `blue`, Comp Orange = Astryx `orange`.
 *
 * `as const satisfies` (rather than a plain `Record<EventType, ...>`
 * annotation) so each `variant` keeps its narrow literal type
 * (`'purple' | 'blue' | 'orange'`) at every call site instead of widening to
 * the full `BadgeVariant` union -- `CalendarPage.tsx`'s own
 * `CALENDAR_TYPE_BADGE` relied on exactly that narrower type before this
 * file existed, and indexing this constant preserves it without a cast.
 */
export const EVENT_TYPE_BADGE = {
  meeting: { variant: 'purple', label: 'Meeting' }, // Meeting Violet
  outreach: { variant: 'blue', label: 'Outreach' }, // Circuit Blue
  competition: { variant: 'orange', label: 'Competition' }, // Comp Orange
} as const satisfies Record<EventType, { variant: BadgeVariant; label: string }>;
