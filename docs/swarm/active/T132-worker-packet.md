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

`NARROW_VIEWPORT_QUERY` (`:2065`), `getIsNarrowViewport` (`:2067-2072`) and
`useIsNarrowViewport` (`:2074-2095`) move verbatim to a new
`src/hooks/useIsNarrowViewport.ts`. **All three** — the constant is what both
functions read, and revision 1 omitted it. There is currently
exactly **one** copy — you are preventing a second, not deduplicating two.

- Export both; `OutreachList.tsx` imports `useIsNarrowViewport` (its only
  consumer today, `:2701`).
- Carry the existing module-doc reasoning across — it records *why* this is a
  real `matchMedia` subscription rather than a one-shot read
  (`OutreachList.tsx:1982`). Do not drop that; the next reader needs it.
- `src/hooks/` does not exist yet. Create it.
- **Pin the 768px breakpoint — but understand what is actually pinnable.**
  `src/test-setup.ts:14-25` installs a `matchMedia` stub whose `matches` is
  hardcoded `false`, and jsdom evaluates no media queries at all. You therefore
  **cannot** assert "a 768px viewport behaves narrow". What you can assert is
  that the hook asks for the right query: supply a `vi.stubGlobal` `matchMedia`
  that parses the query string, then pin 767/768/769 against it. Say plainly in
  your output that this pins the query, not a real viewport. A test that stubs
  `matches` directly and asserts the hook returns it is a tautology — do not
  ship one.
- Name the test file `.tsx` if you need JSX. There is no
  `@testing-library/react` in `package.json`; this repo's hook tests render a
  probe component with raw `react-dom/client` (precedent:
  `CheckinResult.test.tsx:470-513`). Adding `renderHook` would need a new
  dependency under constitution item 9 — don't.

## 2. Student/parent rows: title becomes the link

The student/parent renderer is `StudentOutreachEventRow` — JSDoc `:3171-3184`,
function `:3185-3293`, `endContent` `:3266-3290`, the `Link` **`:3286-3288`**,
and `return <ListItem label={event.title} … />` at **`:3292`**. Today its rows
still read `View details – {event.title}` while the coach rows on the same page
do not.

*(Revision 1 cited `:3160-3191`/`:3185-3187`/`:3191`. Those came from
`VOLT_UX_Craft_PRD_v3.md:79`, which records pre-T131 positions — roughly 101
lines stale. Verified against the file for revision 2.)*

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
the title text (`astryx-api.md:1952`; the no-`aria-label`-on-text-links rule is
`:1955` — `:1954` is the separate no-generic-text rule).

**Pre-authorized deviations (do not dispute):**
- `ListItem.label` accepts `ReactNode`, verified in installed source
  (`src/List/ListItem.tsx:50`, `dist/List/ListItem.d.ts:29`).
  `astryx-api.md:4590` documents ListItem's props as literally `undefined`, so
  **every** ListItem prop already in this file is an installed-source
  deviation — this is established practice here, not a new escalation.
- `Link`'s `weight`/`maxLines`/`color` are absent from the `# Link` props table
  (`astryx-api.md:1963-1977`; `:1961` is the section blurb) but verified real at
  the lines above. D004 precedent; T131 shipped them and Passed. Note `color`
  **is** already half-attested at `:1992` (the Link Theming table, `data-color`
  ← `color`), so the annotation below corrects an internal inconsistency rather
  than adding six unknowns.

Leave the two `Button`s in `endContent` (expander, "Mark attendance") exactly
as they are — `:1607`/`:1620`/`:1627` pin the `Mark attendance – …` text and
`:1042`/`:1066` pin the expander's `aria-label`.

**Disclosed residual gap, deliberately not fixed here:** that Button's *visible*
text repeats the row title, which UXC-04 (`PRD:79`) forbids. Fixing it would
break `:1607` and is out of scope. Record it as a follow-up; do not fix it, and
do not let a finding on it fail your work.

**Weight check.** `ListItem` renders through `Item`, a three-slot flex. Confirm
the linked label still truncates and does not change the row's height or
alignment. If it does, report the measurement rather than working around it.

## 3. Carried follow-ups from T131's check

- **`:3182`** (in `StudentOutreachEventRow`'s JSDoc) says the coach row's
  "primary actions -- Edit/Cancel -- live in `endContent`". They have been in a
  `Table` since T130. Correct it. *(Revision 1 cited `:3173`, a different
  sentence.)*
- **`:3261-3262`** sits directly above the code you are editing and claims every
  row "still always carries a real 'View details' `Link`, unchanged shape".
  Your change falsifies it. Correct it too.
- **Annotate `astryx-api.md`'s `# Link` props table** (`:1963-1977`) with the
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
- `src/hooks/useIsNarrowViewport.test.ts` **or** `.test.tsx` (new)
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
   `ListItem`. `OutreachList.test.tsx:1729` (coach) was amended by T131 and now
   asserts `toBe('Community Food Bank Sort')` — `:1726` is T131's *comment*, not
   the assertion. `:1762` (student/parent) still asserts
   `toContain('View details')` — **that is the one you are changing now**, and
   the premise gate confirmed by actually running it that it is the only test
   that breaks. After your change it should assert the title, as `:1729` does.
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
2. The hook's **query string** is pinned at 767 / 768 / 769 via a
   query-parsing `vi.stubGlobal`. This pins the query, not a real viewport —
   jsdom evaluates no media queries and `test-setup.ts:14-25` hardcodes
   `matches: false`. Say so in your output. A test that stubs `matches` and
   asserts the hook returns it is a tautology and fails this criterion.
3. Student/parent rows: the event title is a real `<a href="/outreach/:eventId">`
   with **no** `aria-label`, accessible name equal to the title.
4. `View details – ` no longer appears in the **rendered JSX or rendered DOM**.
   It still appears in ten module-doc comments (`:255, :259, :465, :479, :495,
   :498, :1969, :2226, :2367, :2640`) — the historical record, including T131's
   own note of the authorization for this reversal. **Do not delete them.** A
   whole-file grep is the wrong test here.
5. Rendered title weight, size and colour match the coach rows at rest (weight
   600, 14px, the `primary` token). **Truncation cannot be exercised by any
   existing fixture** — no title is long enough (`T131-worker-output.md:127-133`
   hit this exact wall). Prove the mechanism with a **synthetic long title** in
   the rig, as T131's checker did.
6. Row height **within 2px** of before, alignment unchanged — measured, not
   assumed. Swapping a bare text node for a baseline-aligned `inline-flex`
   anchor can shift the pitch slightly; report the number.
7. Both stale comments corrected: `:3182` and `:3261-3262`.
8. `astryx-api.md`'s `# Link` props table lists the six typography props with
   installed-source line references.
9. The two new regression tests exist and genuinely discriminate — prove it by
   running them against the pre-T131 file
   (`git show 6c8591d^:src/pages/outreach/OutreachList.tsx`), where the title was
   not a link and the column was `pixel(420)`. Note `buildCoachOutreachColumns`
   is **not exported** (`:2457`) and the actions column has `header: ''`, so
   either export it or locate the `<th>` positionally; `columnUtils.ts:106`
   writes `style.width = '128px'` inline, which jsdom can read.
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
