# Worker Packet: T132 — OutreachList consolidation (shared hook + student/parent link parity)

Wave 5, packet W5-P3a. Runs in parallel with T133 and T134, which touch
disjoint files. Follows T131 (Passed). **Blocks T135 and T136.**

## Objective

Three things, all in `src/pages/outreach/OutreachList.tsx`, bundled because
that one file is the contention point for the rest of wave 5:

1. Extract `useIsNarrowViewport` to a shared module so T135 (MeetingsList) can
   import it instead of copying it.
2. Bring the **student/parent** rows to the title-as-link pattern T131 shipped
   on the coach rows, so the two halves of the same page stop disagreeing.
3. Four carried follow-ups from T131's check.

## 1. Extract the viewport hook

`getIsNarrowViewport` (`:2067-2073`) and `useIsNarrowViewport` (`:2074-2081`)
move verbatim to a new `src/hooks/useIsNarrowViewport.ts`. There is currently
exactly **one** copy — you are preventing a second, not deduplicating two.

- Export both; `OutreachList.tsx` imports `useIsNarrowViewport` (its only
  consumer today, `:2701`).
- Carry the existing module-doc reasoning across — it records *why* this is a
  real `matchMedia` subscription rather than a one-shot read
  (`OutreachList.tsx:1982`). Do not drop that; the next reader needs it.
- `src/hooks/` does not exist yet. Create it.
- **Pin the 768px breakpoint in a test.** Today nothing does. A test that
  asserts the boundary behaviour at 767/768/769 belongs with the hook, in
  `src/hooks/useIsNarrowViewport.test.ts`.

## 2. Student/parent rows: title becomes the link

The student/parent renderer is at `:3160-3191` — `endContent` `:3165-3189`,
the link `:3185-3187`, and `return <ListItem label={event.title} … />` at
`:3191`. Today its rows still read `View details – {event.title}` while the
coach rows on the same page do not.

Apply T131's resolution: **delete the `Link` from `endContent`, and pass the
title as a link through `ListItem`'s `label`.**

```tsx
label={
  <Link
    as={RouterLink}
    href={routePaths.outreachEvent(event.id)}
    isStandalone
    weight="semibold"
    maxLines={1}
    color="primary"
  >
    {event.title}
  </Link>
}
```

**Ship exactly that shape.** It is the shape T131 proved. Do **not** nest a
`<Text>` inside the `Link`: `Link` already wraps its children in its own `Text`
(`node_modules/@astryxdesign/core/src/Link/Link.tsx:323-331`) and forwards
`type`/`size`/`weight`/`color`/`display`/`maxLines` (`:227-257`). Nesting puts a
`display:block; overflow:hidden` child inside an `inline-flex` `<a>` and
truncation silently stops working. `color="primary"` is required because
`LinkProps.color` defaults to `'accent'` (`Link.tsx:297`) — without it every
title turns purple.

No `label`, `aria-label`, or `tooltip` on the link. Its accessible name must be
the title text (`astryx-api.md:1952`, `:1954`).

**Pre-authorized deviations (do not dispute):**
- `ListItem.label` accepts `ReactNode`, verified in installed source
  (`src/List/ListItem.tsx:50`, `dist/List/ListItem.d.ts:29`).
  `astryx-api.md:4590` documents ListItem's props as literally `undefined`, so
  **every** ListItem prop already in this file is an installed-source
  deviation — this is established practice here, not a new escalation.
- `Link`'s `weight`/`maxLines`/`color` are absent from the `# Link` props table
  (`astryx-api.md:1961-1977`) but verified real at the lines above. D004
  precedent; T131 shipped them and Passed.

Leave the two `Button`s in `endContent` (expander, "Mark attendance") exactly
as they are — their `label`s are pinned by T126's tests.

**Weight check.** `ListItem` renders through `Item`, a three-slot flex. Confirm
the linked label still truncates and does not change the row's height or
alignment. If it does, report the measurement rather than working around it.

## 3. Carried follow-ups from T131's check

- **`:3173`** (inside the `endContent` JSDoc) describes coach-row actions as
  living in `endContent`. They have been in a `Table` since T130. Correct it.
- **Annotate `astryx-api.md`'s `# Link` props table** (`:1961-1977`) with the
  real `type`/`size`/`weight`/`color`/`display`/`maxLines` props, each marked as
  verified against installed source with the line reference, so the next task
  does not need a D004 escalation. Follow the annotation style T128 already
  established in that file.
- **Add two regression tests** that T131 could not, under its one-assertion
  constraint: the coach title link renders **no** `aria-label`, and the actions
  column width is `pixel(128)`.

## Allowed Files

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `src/hooks/useIsNarrowViewport.ts` (new)
- `src/hooks/useIsNarrowViewport.test.ts` (new)
- `docs/swarm/astryx-api.md` — **only** the `# Link` props table annotation
- `docs/swarm/active/T132-worker-output.md` (create)

## Forbidden Files

- `src/pages/calendar/CalendarPage.tsx`, `src/pages/meetings/**` — **T133 and
  T134 are running concurrently in separate worktrees.** Touching their files
  creates a merge conflict that costs more than the change is worth.
- The coach `Table` code path (`buildCoachOutreachColumns`,
  `CoachEventTitleCell`, `CoachEventActions`) — T131 shipped it and it passed.
  You are changing the student/parent half only. The two new regression tests
  are the sole exception, and they only assert existing behaviour.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`, `supabase/migrations/**`.

## Traps

1. **The coach and student/parent halves of this file look alike and are not.**
   Coach rows render through `Table` columns; student/parent rows render through
   `ListItem`. `OutreachList.test.tsx:1726` (coach) was amended by T131 and now
   asserts the title. `:1762` (student/parent) still asserts
   `toContain('View details')` — **that is the one you are changing now.** After
   your change it should assert the title, exactly as `:1726` does.
2. **`ListItem.label` is not the same insertion point as a `Table` cell.** T131
   wrapped a `Text` inside a cell; you are replacing a `label` value. Verify the
   rendered result rather than assuming parity.
3. **T126's tests pin the other two buttons' labels** (`Mark attendance – …`,
   the expander). Do not reword them.
4. **Hover tint is inert on these links** — `Link` hands its inner `Text` a
   non-inheriting colour, so the hover `color-mix` never reaches the glyphs.
   This is known, vendor-side, and out of scope. The hover underline and focus
   ring are the live affordances. Do not report it as a defect or try to fix it.
5. Do not certify your own work.

## Acceptance Criteria

1. `src/hooks/useIsNarrowViewport.ts` exists, exports both functions, carries
   the `matchMedia`-subscription reasoning, and `OutreachList.tsx` imports it
   with no behaviour change.
2. The 768px boundary is pinned by a real test (767 / 768 / 769).
3. Student/parent rows: the event title is a real `<a href="/outreach/:eventId">`
   with **no** `aria-label`, accessible name equal to the title.
4. `View details – ` no longer appears anywhere in `OutreachList.tsx`.
5. Rendered title weight, size, colour and truncation match the coach rows at
   rest (weight 600, 14px, the `primary` token, single-line ellipsis).
6. Row height and alignment unchanged vs before — measured, not assumed.
7. `:3173`'s stale `endContent` description is corrected.
8. `astryx-api.md`'s `# Link` props table lists the six typography props with
   installed-source line references.
9. The two new regression tests exist and fail against pre-T131 code.
10. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
    `npm run format:check` clean.
11. `npx vitest run` green. Baseline **1414 / 61 files**. Expected delta: the
    amended `:1762` assertion, plus new tests (2 regression + the hook's). Any
    other change in count or content is a regression — report it.

## Relevant Constitution Excerpt

- Item 2 — Astryx props come only from `astryx-api.md`; absent props are
  presumed hallucinated → MAJOR. **Two exceptions pre-authorized above**
  (ListItem's props, Link's typography props), both under D004. No others.
- Item 15 — accessibility is a shipping requirement. The title link is the
  keyboard path to the detail page; it must survive.
- Non-Negotiables — existing tests pass; no worker self-certifies.

## Required Worker Output

`docs/swarm/active/T132-worker-output.md`:

- Rendered measurements of the student/parent title link vs the coach one
  (weight, size, colour, truncation) and vs the pre-change plain label.
- Row height before and after.
- The exact test lines amended and added.
- Confirmation the hook moved with no behaviour change, and how you verified it.
- Full output of the commands in criteria 10–11.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig for measurements (`*.throwaway.*` is gitignored; Chromium
at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing.**
