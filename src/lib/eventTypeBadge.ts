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

/**
 * Explicit render order for anything (e.g. `CalendarPage.tsx`'s DES-04
 * legend) that needs all three event types in a fixed, human-meaningful
 * sequence: Meeting, Outreach, Competition. Deliberately not derived via
 * `Object.keys(EVENT_TYPE_BADGE)` -- that would only work today by accident
 * of the object literal's insertion order, which is not a contract.
 */
export const EVENT_TYPE_ORDER = [
  'meeting',
  'outreach',
  'competition',
] as const satisfies readonly EventType[];

/**
 * Compile-time exhaustiveness guard for `EVENT_TYPE_ORDER`.
 *
 * `as const satisfies readonly EventType[]` only constrains every *element*
 * of the array to be a valid `EventType` -- it does not require every
 * `EventType` to appear. Adding a fourth member to the `EventType` union
 * therefore produces no error on `EVENT_TYPE_ORDER` on its own (unlike
 * `EVENT_TYPE_BADGE` above, whose `Record<EventType, ...>` shape forces a
 * TS1360 error for a missing key). Without this guard, a future added type
 * would go green at `tsc --noEmit` while the legend silently rendered only
 * the types present in this list -- replacing dependence on object
 * insertion order (T145's original bug) with an equally silent dependence
 * on someone remembering to update this second list.
 *
 * If `EVENT_TYPE_ORDER` is missing any `EventType`, `Exclude<...>` resolves
 * to the missing member(s) instead of `never`, so the conditional type
 * below resolves to a 2-tuple literal type naming them, and assigning
 * `true` to that type fails to typecheck.
 */
type EventTypeOrderIsExhaustive =
  Exclude<EventType, (typeof EVENT_TYPE_ORDER)[number]> extends never
    ? true
    : [
        'EVENT_TYPE_ORDER is missing event types:',
        Exclude<EventType, (typeof EVENT_TYPE_ORDER)[number]>,
      ];
const eventTypeOrderIsExhaustive: EventTypeOrderIsExhaustive = true;
void eventTypeOrderIsExhaustive;
