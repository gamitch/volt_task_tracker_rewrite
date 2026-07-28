/**
 * T125 (UXP-09, PRD UXD-06 "Form layout standard"): shared layout primitives
 * for the event create/edit re-layout.
 *
 * `docs/swarm/VOLT_Portal_PRD_v2.md` UXD-06 (~line 80): "Creation/editing
 * flows with more than ~6 fields (event create, event edit/attendance) are
 * page-like layouts (routed page or full-height panel) with labeled sections
 * and room to breathe -- not cramped modals. Small confirmations stay
 * dialogs." Reference figures (binding, this task's own packet): capability
 * map "New event form" and "Edit event dialog" -- both are single,
 * well-spaced pages with clearly separated regions (identity/basics,
 * schedule, per-day details, roster/attendance), not a dense stacked list of
 * every field with no visual grouping.
 *
 * ARCHITECT DECISION (this task's own packet, supersedes the PRD's "prefer
 * one shared editor page" note): `OutreachEventDialog.tsx` and
 * `ScheduleMeetingsDialog.tsx` stay two separate dialogs (T101 session
 * reconciliation + T118/T119 RSVP-plan logic live in the outreach dialog's
 * own submit path and must not be touched by a layout-only task). THIS file
 * is the "convergence step" the packet asks for: shared section/layout
 * primitives both dialogs consume, so the two forms look and behave
 * consistently without unifying their actual field sets or handlers.
 *
 * -----------------------------------------------------------------------
 * 1. "Full-height panel" investigation (this task's own Trap #2 -- Astryx-
 *    only, no invented props).
 *
 * `docs/swarm/astryx-api.md`, "# Dialog" section, Props table (grepped live
 * for this task): `variant` is `'standard' | 'fullscreen'` -- "fullscreen:
 * expands to fill the entire viewport" -- and its own Best Practices list
 * says "Don't: Use the fullscreen variant for simple confirmations; it is
 * meant for complex content like editors or long forms," which is exactly
 * this task's use case. Cross-checked directly against the installed source
 * (`node_modules/@astryxdesign/core/dist/Dialog/Dialog.d.ts` /
 * `src/Dialog/Dialog.tsx`): `variant='fullscreen'` only changes the dialog's
 * own CSS sizing (`width: 100dvw; height: 100dvh`) -- it is still the same
 * native `<dialog>` element, same `showModal()`/focus-trap/Escape-key
 * behavior, same `purpose` dismissal semantics as the `variant='standard'`
 * dialog both files already used. So both dialogs below switch to
 * `<Dialog variant="fullscreen" ...>` for the "full-height panel" UXD-06
 * asks for -- a real, non-hallucinated Astryx variant, not an invented prop.
 * No custom CSS/xstyle is used to fake full-height (constitution item 11's
 * styling-escalation order: component prop is step 1, and a real component
 * prop already exists here).
 *
 * -----------------------------------------------------------------------
 * 2. `EventFormLayout` -- the centered, readable-width column.
 *
 * A `variant="fullscreen"` dialog is `100dvw` wide; stretching every
 * `TextInput`/`Selector` edge-to-edge across an entire desktop viewport is
 * not "room to breathe," it is unreadable line length. `EventFormLayout`
 * centers its children in a `maxWidth` (default 720px, a common readable
 * prose/form width) column using `VStack`'s own documented `maxWidth`/
 * `hAlign` props (`docs/swarm/astryx-api.md` "# Stack" section, `VStack`
 * subsection Props table). It renders `children` in the exact order given
 * -- this component never reorders fields.
 *
 * -----------------------------------------------------------------------
 * 3. `EventFormSection` -- the "labeled sections" UXD-06 asks for.
 *
 * Built from `Section` (`docs/swarm/astryx-api.md` "# Layout" section's own
 * `### Section` Components subsection is `undefined`; cross-checked directly
 * against `node_modules/@astryxdesign/core/dist/Section/Section.d.ts` /
 * `src/Section/Section.doc.mjs`, whose own `usage.description` reads:
 * "Section is the correct way to create page regions and group related
 * content on a page. Use it for ... form sections ... Combine with a
 * heading + Stack for a typical page section pattern" -- precisely this
 * component's own composition) + `Heading` (same file's "# Text" section,
 * `### Heading` Components subsection also `undefined`; cross-checked
 * against `node_modules/@astryxdesign/core/dist/Heading/Heading.d.ts` --
 * `level` (1-6) picks a REAL semantic `<h1>`-`<h6>` element, satisfying this
 * task's own Trap #3 (A11y): "labeled sections are real headings/fieldsets,"
 * not styled `Text`). `variant="transparent"` keeps the section blending
 * with the dialog's own background (no boxed-card look, which `Card` -- not
 * used here -- would imply per Section's own doc: "Use Card when you mean
 * Section... Sections are for page regions"). `dividers={['bottom']}`
 * (`Section`'s own real `dividers` prop) separates adjacent sections
 * visually; the last section in a form passes `hasDivider={false}` so
 * nothing trails immediately above the footer's action buttons.
 *
 * Each section wraps its own `children` in a nested `FormLayout`
 * (`docs/swarm/astryx-api.md` "# FormLayout" section, own text: "Supports
 * ... can be nested to mix them" / Best Practices: "Nest a ... FormLayout
 * inside a vertical one when fields naturally pair up") so within-section
 * field spacing matches the single flat `FormLayout` both dialogs used
 * before this task -- `EventFormSection` is a drop-in wrapper around what
 * was already there, not a new spacing system.
 *
 * -----------------------------------------------------------------------
 * 4. Field-order discipline (constitution item 13 / OUT-02 / MTG-02).
 *
 * Neither `EventFormLayout` nor `EventFormSection` reorders anything -- they
 * only wrap contiguous runs of a dialog's EXISTING field order in a heading
 * + divider. Each consuming dialog's own module doc records exactly which
 * of its already-literal fields fall under which section heading (a
 * disclosed grouping choice, since the PRD's literal field-order text does
 * not itself name section boundaries) -- constitution item 13's literal
 * top-to-bottom field order is therefore unchanged in both dialogs; this is
 * a visual/DOM-heading addition, not a reordering.
 */
import type { ReactNode } from 'react';
import { FormLayout, Heading, Section, Text, VStack, type HeadingLevel } from '@astryxdesign/core';

export interface EventFormLayoutProps {
  /**
   * `EventFormSection`s (or any other content, e.g. a submit-error `Banner`)
   * in visual/DOM order -- this component only supplies the centered,
   * readable-width column (module doc #2); it never reorders its children.
   */
  children: ReactNode;
  /** Maximum width (px) of the readable column. @default 720 */
  maxWidth?: number;
}

/**
 * Centers a full-height (`Dialog variant="fullscreen"`, module doc #1) form
 * panel's content in a readable-width column -- UXD-06's "room to breathe"
 * without stretching every field edge-to-edge across the whole viewport.
 */
export function EventFormLayout({ children, maxWidth = 720 }: EventFormLayoutProps): ReactNode {
  return (
    <VStack hAlign="center">
      <VStack gap={4} width="100%" maxWidth={maxWidth}>
        {children}
      </VStack>
    </VStack>
  );
}

export interface EventFormSectionProps {
  /**
   * Section heading text -- rendered as a REAL semantic `Heading` (module
   * doc #3, Trap #3: labeled sections must be real headings, not styled
   * `Text`).
   */
  title: string;
  /** Optional one-line supporting copy under the heading. */
  description?: string;
  /**
   * @default 2 -- every section in a form is a top-level region; the
   * consuming dialog's own `DialogHeader` title is the implicit h1.
   */
  headingLevel?: HeadingLevel;
  /**
   * Whether to draw a divider below this section, separating it from
   * whatever comes next. Pass `false` for the last section in a form.
   * @default true
   */
  hasDivider?: boolean;
  /** The section's own fields, in the SAME order they already appeared in
   * before this task (module doc #4) -- wrapped in a nested `FormLayout`
   * (module doc #3) for consistent field-to-field spacing. */
  children: ReactNode;
}

/**
 * One labeled, full-width form region -- UXD-06's "labeled sections" and
 * this task's own packet: "Teams & attendees (the UXP-02 roster checklist
 * gets a full-width labeled section -- it is the worst-crowded region
 * today)." See module doc #3 for the Astryx composition and #4 for the
 * field-order discipline.
 */
export function EventFormSection({
  title,
  description,
  headingLevel = 2,
  hasDivider = true,
  children,
}: EventFormSectionProps): ReactNode {
  return (
    <Section variant="transparent" dividers={hasDivider ? ['bottom'] : undefined}>
      <VStack gap={4}>
        <VStack gap={0.5}>
          <Heading level={headingLevel}>{title}</Heading>
          {description !== undefined && <Text type="supporting">{description}</Text>}
        </VStack>
        <FormLayout>{children}</FormLayout>
      </VStack>
    </Section>
  );
}

export default EventFormLayout;
