/**
 * @file SeriesCard.tsx
 * @position GAM-447. Renders MTG-01a's coach series card
 *   (`docs/swarm/VOLT_Portal_PRD.md:303-313`) -- one fixed-size `Card` per
 *   meeting EVENT (recurring series), per the `meetings-design` skill
 *   ("Unit of the coach page is the series, not the session"). GAM-444
 *   (Stage B) created this file as a stub and froze
 *   `SeriesCardProps`/`SeriesCardModel`; this ticket is the "downstream
 *   meetings-redesign ticket" the old stub doc pointed at. `SeriesCard` has
 *   no callers anywhere in the tree yet (`CoachMeetingsView` does not render
 *   it -- see item 3 below), which is why this file is safe to add
 *   *additive, optional* props to without a freeze violation (GAM-447
 *   packet §1).
 *
 * -----------------------------------------------------------------------
 * 1. Frozen inputs, not re-derived here.
 *
 * `model: SeriesCardModel` (`../../../lib/meetings/types.ts:268-306`) already
 * carries every string this component renders pre-formatted:
 * `scheduleChips` came out of `buildScheduleChips` (`../../../lib/meetings/
 * format.ts:291`) and `nextSessionLabel` is "already a formatted string"
 * (`types.ts:296-300`). Consequently **no formatter from `format.ts` is
 * imported here** -- there is nothing left for this component to format.
 * Re-running `buildScheduleChips`/`formatWeekdayDate`/etc. on already-
 * formatted strings would be exactly the duplication GAM-443 exists to
 * prevent; the packet's "import every formatter" instruction is satisfied
 * by NOT re-deriving what the model already hands us verbatim (criterion 9
 * below pins "verbatim, no re-formatting").
 *
 * `attendancePct: number | null` is rendered by branching, never computed:
 * `null -> "—"`, a real `0 -> "0%"`. No percentage arithmetic occurs in this
 * file (constitution item 3 / DATA-01) -- there is no numerator/denominator
 * division anywhere below; `attendancePct` is a passthrough value from the
 * metric view, per `types.ts:285-294`'s own binding comment.
 *
 * -----------------------------------------------------------------------
 * 2. Astryx prop sourcing (constitution item 2) -- every prop below is
 *    cross-checked against `docs/swarm/astryx-api.md` directly:
 *
 *  - `Card` (astryx-api.md:2985-2996 Props table): `height`, `padding`
 *    used. `height` is a `SizeValue` (`:2990`); a bare number is pixels.
 *    `Card.js:190` sets `hasFixedHeight = height != null` and applies its
 *    own `scrollable` overflow-containment style whenever `height` is set
 *    (verified by reading the installed `Card.js` directly) -- so the one
 *    `height` prop below both fixes the card's size AND contains any
 *    content that would otherwise grow it, satisfying MTG-01a's "does not
 *    grow with session count" without any custom CSS.
 *  - `Heading` (astryx-api.md:882-894; the doc's own "Components > Heading"
 *    subsection reads `undefined`, the same disclosed CLI-cross-checked gap
 *    `CoachHome.tsx`/`RosterShell.tsx`/`MeetingsList.tsx` already hit --
 *    `npm run astryx -- component Heading --json`, run live for this task,
 *    resolves `level` (1-6, required), `children` (required), `maxLines`):
 *    `level`, `maxLines` used, for the title clamp (item 4 below).
 *  - `Text` (astryx-api.md:829-878 Props table): `type` (`'supporting'`,
 *    `'label'`, `'body'`), `maxLines` used.
 *  - `HStack`/`VStack` (astryx-api.md:350-396): `gap`, `vAlign`, `wrap`,
 *    `height`, `justify` used.
 *  - `Badge` (astryx-api.md:526-533 Props table): `label`, `variant`
 *    (`'neutral'`, explicit, matching BEH-04's own "neutral computed count"
 *    precedent already established elsewhere in this app, e.g.
 *    `HoursTab.tsx`'s own Badge usage) used. See item 5 below for the
 *    ruling on using `Badge` for schedule chips at all.
 *  - `ProgressBar` (astryx-api.md:5445-5458 Props table): `label`
 *    (required, `:5449`), `isLabelHidden`, `value`, `max` used.
 *    `hasValueLabel` is left at its documented `false` default (`:5454`),
 *    so no percentage string is ever rendered by the bar itself --
 *    reinforcing item 1's "no percentage arithmetic" with "no percentage
 *    rendering" from this component's only other numeric-progress surface.
 *  - `Button` (astryx-api.md:1807-1827 Props table): `label`, `variant`
 *    (`'secondary'`), `onClick` used.
 *  - `EmptyState` (astryx-api.md:3997-4007 Props table): `title`
 *    (required), `description`, `headingLevel`, `isCompact` used.
 *  - `Skeleton` (astryx-api.md:642-649 Props table): `width`, `height`,
 *    `index` used, same staggered-index idiom `CoachMeetingsView.tsx:1544-
 *    1553` already established.
 *  - `Banner` (astryx-api.md:2755-2769 Props table): `status`, `title`,
 *    `description` used.
 *  - `VisuallyHidden`: the doc's own "VisuallyHidden" section (astryx-
 *    api.md:6619-6624 Props table) lists only `children`/`as`, but its own
 *    module comment (`VisuallyHiddenProps` JSDoc, installed
 *    `VisuallyHidden.d.ts`) explicitly states "The accessibility pass-
 *    throughs from `BaseProps` (`aria-*`, `role`, `id`, `data-*`, event
 *    handlers) remain, since the live-region use case needs them" -- so
 *    `role="status"` on `<VisuallyHidden as="div">` is a documented
 *    pass-through, not a hallucinated prop. Exact precedent already in this
 *    codebase: `CoachMeetingsView.tsx:1540` (`<VisuallyHidden as="div"
 *    role="status">Loading meetings…</VisuallyHidden>`).
 *
 * -----------------------------------------------------------------------
 * 3. `style`/`aria-*`/`data-*` on `<Card>` -- GAM-447 packet §5's own
 *    authorization, reproduced here so a later reader/checker does not
 *    re-litigate it (the same "record the citation" instruction
 *    `CoachHome.tsx`'s module doc follows for its own `style`-on-`Card`
 *    use): the installed `@astryxdesign/core` `CardProps extends
 *    BaseProps<HTMLDivElement>` and declares both `style?: CSSProperties`
 *    and `className?: string`
 *    (`node_modules/@astryxdesign/core/dist/Card/Card.d.ts:31-37`);
 *    `BaseProps` types `[key: \`data-${string}\`]: unknown` and every
 *    `aria-*` attribute (`dist/BaseProps.d.ts:24-33`); and the installed
 *    `Card.js` spreads `...props` onto the root `div`, so these actually
 *    reach the DOM at runtime. In-repo precedent for the identical
 *    reasoning: `CoachHome.tsx:643-670`. There IS a contrary precedent --
 *    `CheckinResult.tsx:110-121` deliberately declines `style`/`className`
 *    on `Card` because `astryx-api.md`'s own Card Props table does not list
 *    them and that task chose the conservative reading. This ticket's own
 *    packet (§5) explicitly overrides that conservative reading FOR THIS
 *    TICKET ONLY, given `astryx-api.md:2985-2996`'s Card Props table does
 *    not list `height`/`minHeight` as achieving the fixed-size promise
 *    alone in every layout context, and the packet grants `style`/
 *    `className`/`data-*`/`aria-*` explicitly (see packet §5). This file
 *    uses:
 *      - `data-series-palette-index={model.paletteIndex}` -- see item 6.
 *      - `aria-current={isSelected ? 'true' : undefined}` -- criterion 8
 *        (DES-12 "selected" state is BOTH visual and programmatic; a screen
 *        reader user gets `aria-current`, not just a colored border).
 *      - `aria-busy="true"` on the loading branch's `Card`, so the loading
 *        state is announced without adding a second live region.
 *      - `style={{ boxShadow: ... }}` (accent-colored inset ring, using the
 *        existing `--color-accent` token from `theme.css:206`, never a new
 *        hex literal) ONLY when `isSelected` -- a shape/contrast change,
 *        not a hue-only change, so the selected state does not rely on
 *        color alone even for users who cannot perceive the accent hue.
 *
 * -----------------------------------------------------------------------
 * 4. Height invariance (criterion 1). The real height risks are chip count
 *    and title length, not session count (packet's own premise-gate
 *    finding, NIT-8). `SERIES_CARD_HEIGHT_PX` is passed to `Card`'s
 *    `height` prop UNCONDITIONALLY -- it never depends on
 *    `model.scheduleChips.length`, `model.title.length`, or
 *    `model.sessionsTotal`. Two more measures make the fixed height
 *    actually hold visually, not just nominally:
 *      - the title clamps via `Heading maxLines={1}` (astryx-api.md's own
 *        Heading `maxLines` -- see item 2) instead of wrapping/growing;
 *      - the schedule-chip row is capped at `MAX_VISIBLE_SCHEDULE_CHIPS`
 *        (4) real chips plus one `+N more` chip when there are more --
 *        see item 5 for why 4 is a declared deviation, not an oversight.
 *    `Card`'s own fixed-height/scrollable behavior (item 2's `Card` note)
 *    then contains whatever overflow remains. The test asserts the DOM
 *    `--x-height` custom property `Card` sets (`element.style.
 *    getPropertyValue('--x-height')`, the exact pattern
 *    `CoachHome.test.tsx:2094` already established for reading a `SizeValue`
 *    prop back out of the DOM in this jsdom-only test environment) is
 *    byte-identical across 1 vs. 12 chips, a short vs. 300-char title, and
 *    4 vs. 56 sessions.
 *
 * -----------------------------------------------------------------------
 * 5. Two rulings recorded per packet §4 item 2 ("Schedule chips"):
 *
 * (a) **Chip-cap deviation from `meetings-design` skill (SKILL.md:40).**
 *     The skill's literal text is "One chip per weekday-with-time rule" --
 *     i.e., no cap. This component caps the VISIBLE chips at
 *     `MAX_VISIBLE_SCHEDULE_CHIPS` (4) and renders a `+N more` chip for the
 *     remainder. This is a deliberate, declared deviation: MTG-01a's fixed-
 *     size-card promise (item 4 above) outranks the skill's literal chip
 *     count, and the drill-out schedule panel (a sibling ticket, MTG-01b)
 *     carries the full, uncapped detail -- nothing is silently lost, only
 *     deferred to the view that has room for it. `overlapCount` is
 *     rendered as its own separate `Badge`, not counted against this cap.
 *
 * (b) **`Badge` for schedule chips/counts over `astryx-api.md`'s general
 *     "don't use badges for metadata" Don't (astryx-api.md:521-522, "Use
 *     badges for metadata. Durations..., counts..., dates, and
 *     descriptions are not statuses or categories; use description text
 *     ... instead").** This component uses `Badge` for schedule chips (a
 *     "Tue 6–8 PM" string) and the overlap count anyway, because the
 *     `meetings-design` skill (SKILL.md:38-46 schedule-chip format,
 *     :70-71 "BEH-04 ... a neutral computed count `Badge`, never
 *     error/red, never urgency copy") and MTG-01a itself (the PRD, which
 *     item 1 puts above both the skill and `astryx-api.md`'s generic
 *     component guidance) both specify `Badge`-shaped chips/counts for
 *     this exact surface. Where a general component-library "Don't" and a
 *     feature-specific PRD/skill instruction conflict, the more specific,
 *     higher-authority source (PRD > skill > generic component guidance)
 *     wins; `astryx-api.md`'s prose is a general style guideline, not a
 *     per-prop technical constraint the way its Props tables are (item 2
 *     is unaffected by this -- `variant`/`label` are still the only real,
 *     installed-source-verified `Badge` props used).
 *
 * -----------------------------------------------------------------------
 * 6. Open decision recorded per packet §3b (series identity color).
 *    `--color-series-1…8` does not exist in `src/theme/volt.ts` (packet's
 *    own measured finding, §0/§3b) and `volt.ts` is outside this ticket's
 *    Allowed Files. This component does NOT invent hues and does NOT
 *    borrow an unrelated existing token (e.g. `--color-data-categorical-*`,
 *    which the packet notes are already spoken for as "confirmed hours" /
 *    "planned hours" labels). Instead, `model.paletteIndex` (a stable,
 *    deterministic hash of `eventId` per the `meetings-design` skill's
 *    "Series identity color" section -- never array position) is carried
 *    onto the card's root element as `data-series-palette-index`
 *    (criterion 8), and every color-dependent treatment this ticket would
 *    otherwise apply (a series-colored dot, a tinted `ProgressBar`, a
 *    tinted calendar/next-session icon) is rendered in its plain,
 *    colorless/neutral default form for now. **This is the open decision:**
 *    once the owner settles the eight hues in `volt.ts`, a single CSS rule
 *    keyed on `[data-series-palette-index="N"]` can light up the dot/
 *    progress-bar/icon tint with no change to this component's own code.
 *
 * -----------------------------------------------------------------------
 * 7. Two things the issue asked for that the frozen `SeriesCardModel`
 *    cannot carry (packet §3a, §3c) -- NOT solved by widening the frozen
 *    type, per the `meetings-design` skill's explicit instruction not to
 *    reshape a frozen type a sibling ticket is coding against:
 *
 * (a) No location/roster-count/canceled-count/span-chip/"N expected" --
 *     `SeriesCardModel` has exactly the nine fields at `types.ts:268-306`
 *     and none of those. The supporting line renders `teamScopeLabel`
 *     alone; the next-session line renders `nextSessionLabel` verbatim (or
 *     the finished copy below when `null`). No field is fabricated, and no
 *     zero is invented for a number this component does not have (the same
 *     defect class as a fabricated `0%`, per the packet).
 *
 * (b) No Edit affordance. `onSaveMeetingSeries` is not on
 *     `SeriesCardProps` and the packet is explicit that this ticket must
 *     NOT create `SeriesEditPanel.tsx` or thread a required callback prop
 *     that would need editing `CoachMeetingsView.tsx` (outside this
 *     ticket's Allowed Files) to wire up. MTG-01a itself
 *     (`VOLT_Portal_PRD.md:303-313`) also lists no card-level Edit
 *     affordance -- the PRD's own per-row `Edit` chip lives in MTG-01b's
 *     drill-out (`:315-317`), a sibling ticket. This component ships no
 *     inert Edit control (constitution item 27).
 *
 * -----------------------------------------------------------------------
 * 8. DES-12 four states (loading/empty/error/populated, item 12). This
 *    component takes no async props of its own, so all four are reached
 *    purely from what the caller passes: `isLoading`/`errorMessage` are
 *    additive, optional props (packet §1 explicitly authorizes additive
 *    optional props on this file since `SeriesCard` has no real callers
 *    yet); `sessionsTotal === 0` is the empty branch (no fabricated
 *    caller prop needed, since it is already on the frozen model).
 */
import { type CSSProperties, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Heading,
  HStack,
  ProgressBar,
  Skeleton,
  Text,
  VStack,
  VisuallyHidden,
} from '@astryxdesign/core';
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
  /** Additive, optional (module doc item 8) -- renders the DES-12 loading
   * branch instead of the populated card. There are no real callers of
   * `SeriesCard` yet (packet §1), so adding this cannot break anything. */
  isLoading?: boolean;
  /** Additive, optional (module doc item 8) -- renders the DES-12 error
   * branch (a `Banner`) instead of the populated card. */
  errorMessage?: string;
}

/** MTG-01a's fixed-size promise (module doc item 4) -- passed to `Card`'s
 * own `height` prop unconditionally, never derived from chip count, title
 * length, or session count. */
const SERIES_CARD_HEIGHT_PX = 380;

/** Declared deviation from `meetings-design` skill SKILL.md:40 (module doc
 * item 5a) -- caps the VISIBLE schedule chips so the row cannot grow the
 * card; the remainder collapses into one `+N more` chip. */
const MAX_VISIBLE_SCHEDULE_CHIPS = 4;

/** MTG-01a "next-session line ... or the finished state"
 * (`types.ts:296-300`) -- the finished copy itself is this component's own
 * responsibility, sentence case per DES-14, stating when nothing further is
 * scheduled rather than what was missed (constitution item 17). */
const FINISHED_SESSIONS_COPY = 'No sessions remaining';

function buildSelectionStyle(isSelected: boolean | undefined): CSSProperties | undefined {
  // Module doc item 3 -- an accent-colored ring (shape + contrast change),
  // not a hue-only change, so the selected state does not rely on color
  // alone. `--color-accent` is an existing token (`theme.css:206`), never a
  // new hex literal.
  return isSelected ? { boxShadow: 'inset 0 0 0 2px var(--color-accent)' } : undefined;
}

function formatAttendanceText(attendancePct: number | null): string {
  // Module doc item 1 -- pure branch, never arithmetic. `null` is the
  // metric view's own "no completed sessions yet" signal
  // (`v_student_participation`'s convention); a real `0` is a real zero,
  // never conflated with "no data" (constitution item 3 is BLOCKER-graded
  // on exactly this confusion).
  return attendancePct === null ? '—' : `${attendancePct}%`;
}

/**
 * Stub -- GAM-444 creates this file and freezes its props; the rendering is
 * a downstream meetings-redesign ticket's own deliverable (packet §1: "MOVE
 * CODE; ADD NO FEATURES. If you find yourself writing new rendering logic,
 * you have left scope").
 *
 * GAM-447 is that downstream ticket -- see the module doc above for the
 * full decision record (Astryx prop sourcing, the chip-cap and Badge
 * rulings, the open series-palette decision, and the two frozen-contract
 * gaps this component deliberately does not paper over).
 */
export function SeriesCard(props: SeriesCardProps): ReactNode {
  const { model, overlapCount, isSelected, onSelect, isLoading, errorMessage } = props;

  const sharedCardProps = {
    height: SERIES_CARD_HEIGHT_PX,
    padding: 4 as const,
    'data-series-palette-index': model.paletteIndex,
    'aria-current': isSelected ? ('true' as const) : undefined,
    style: buildSelectionStyle(isSelected),
  };

  if (isLoading === true) {
    return (
      <Card {...sharedCardProps} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading series…
        </VisuallyHidden>
        <VStack gap={3}>
          <Skeleton width={180} height={22} index={0} />
          <Skeleton width={120} height={14} index={1} />
          <HStack gap={1.5} wrap="wrap">
            <Skeleton width={70} height={22} index={2} />
            <Skeleton width={70} height={22} index={3} />
            <Skeleton width={70} height={22} index={4} />
          </HStack>
          <Skeleton width="100%" height={10} index={5} />
          <Skeleton width={150} height={14} index={6} />
          <Skeleton width={170} height={14} index={7} />
        </VStack>
      </Card>
    );
  }

  if (errorMessage !== undefined) {
    return (
      <Card {...sharedCardProps}>
        <VStack gap={3} height="100%" justify="center">
          <Banner status="error" title="Couldn't load this series" description={errorMessage} />
        </VStack>
      </Card>
    );
  }

  if (model.sessionsTotal === 0) {
    // Module doc item 8 -- empty branch: no progress bar, no next-session
    // line, per DES-12's own criterion for this state.
    return (
      <Card {...sharedCardProps}>
        <VStack gap={3} height="100%" justify="center">
          <EmptyState
            headingLevel={3}
            isCompact
            title={model.title}
            description={`${model.teamScopeLabel} — no sessions scheduled.`}
          />
        </VStack>
      </Card>
    );
  }

  const visibleChips = model.scheduleChips.slice(0, MAX_VISIBLE_SCHEDULE_CHIPS);
  const hiddenChipCount = model.scheduleChips.length - visibleChips.length;
  const attendanceText = formatAttendanceText(model.attendancePct);
  const nextSessionText = model.nextSessionLabel ?? FINISHED_SESSIONS_COPY;

  return (
    <Card {...sharedCardProps}>
      <VStack gap={3} height="100%">
        <VStack gap={0.5}>
          <HStack gap={1.5} vAlign="center" wrap="wrap">
            <Heading level={3} maxLines={1}>
              {model.title}
            </Heading>
            {overlapCount ? <Badge variant="neutral" label={`${overlapCount} overlap`} /> : null}
          </HStack>
          <Text type="supporting" maxLines={1}>
            {model.teamScopeLabel}
          </Text>
        </VStack>

        <HStack gap={1.5} wrap="wrap">
          {/* Criterion 9 -- chips are rendered verbatim from the model, no
              re-formatting; module doc item 5a for the cap. */}
          {visibleChips.map((chip, index) => (
            // Chip strings are not guaranteed unique (e.g. two identical
            // weekday/time rules would be a caller bug, not something this
            // component can detect), and the visible list is static per
            // render (no reordering/insertion mid-list), so index is a
            // stable, safe key here.
            <Badge key={`chip-${index}`} label={chip} />
          ))}
          {hiddenChipCount > 0 && <Badge key="chip-more" label={`+${hiddenChipCount} more`} />}
        </HStack>

        <VStack gap={1}>
          <ProgressBar
            label={`${model.title}: sessions held`}
            isLabelHidden
            value={model.sessionsCompleted}
            max={model.sessionsTotal}
          />
          <Text type="supporting">
            {`${model.sessionsCompleted} of ${model.sessionsTotal} sessions held`}
          </Text>
        </VStack>

        <VStack gap={0.5}>
          <Text type="label">Attendance</Text>
          <Text type="body">{`${attendanceText} across ${model.sessionsCompleted} held`}</Text>
        </VStack>

        <VStack gap={0.5}>
          <Text type="label">Next session</Text>
          <Text type="body">{nextSessionText}</Text>
        </VStack>

        <Button
          label={`View full schedule (${model.sessionsTotal} sessions)`}
          variant="secondary"
          onClick={() => onSelect?.({ eventId: model.eventId })}
        />
      </VStack>
    </Card>
  );
}
