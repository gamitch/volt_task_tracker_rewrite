# T145 Worker Output — close the badge-map loose ends T138 left and exposed

## Packet SHA verified

`git log -1 --format=%H -- docs/swarm/active/T145-worker-packet.md` (run after
merging `origin/claude/swarm-plan-zl575z`, which is what brought the packet
into this worktree in the first place — see "FIRST" section below):

```
79bfcc602efd187918335d211de0cc02637fbf07
```

## Rework log

- **Round 1 → checker FAIL → Round 2 fix:** coordinator identified that
  `EVENT_TYPE_ORDER`'s `as const satisfies readonly EventType[]` does not
  enforce exhaustiveness (a fourth `EventType` could be added, `EVENT_TYPE_BADGE`
  fixed, and `tsc --noEmit` would go green while the legend silently dropped
  it). Addressed by adding a compile-time exhaustiveness guard to
  `src/lib/eventTypeBadge.ts` — see "Post-review addendum" below.
- **Round 2 → checker FAIL → Round 3 fix (this round):** checker found two
  further problems, both addressed in this revision:
  1. The `EventsTab.tsx` NOTE correction (2c) and the 577-586 citation
     correction (2b) both contained a false claim of my own — I had repeated
     the packet's unverified assertion that the old `CoachHome.tsx` `~1191`
     citation and the `577-586` `CalendarPage.tsx` citation were "already
     wrong at the time" they were written, without opening the actual
     commits to check. The coordinator did check (`48fcd90`, `82fafdf`) and
     both citations were accurate when written. Corrected below, verified
     directly against those two commits this round.
  2. The legend "proof" (Criterion 2) queried the whole container rather
     than the legend subtree, so it did not actually test the legend — row
     badges alone satisfied it, as demonstrated by emptying the legend and
     still passing all 31 tests. Rewrote the test to scope to the legend
     subtree and assert exact count + order, then proved it discriminates
     with three separate mutations (empty, reorder, drop-one), each
     reverted. See the rewritten "Criterion 2" section below.

## FIRST — merge result

The packet's `docs/swarm/active/T145-worker-packet.md` did not exist in this
worktree until the merge. Ran:

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Result: **fast-forward, no conflicts** (`Updating 2146255..7b6d11f`, 135 files
changed). Reported as required — no conflict, nothing further to do here.

## Part 1 — the ordered constant and how the legend consumes it

Added to `src/lib/eventTypeBadge.ts`:

```ts
export const EVENT_TYPE_ORDER = ['meeting', 'outreach', 'competition'] as const satisfies readonly EventType[];
```

(Prettier subsequently reformatted this literal onto multiple lines — see the
`format:check` section below.)

`src/pages/calendar/CalendarPage.tsx` (`:836-843` after edit) now renders the
legend as:

```jsx
<HStack gap={2} wrap="wrap">
  {EVENT_TYPE_ORDER.map((type) => (
    <Badge
      key={type}
      variant={EVENT_TYPE_BADGE[type].variant}
      label={EVENT_TYPE_BADGE[type].label}
    />
  ))}
</HStack>
```

No `Object.keys`/`Object.entries` used anywhere. `EVENT_TYPE_ORDER` is
imported alongside the already-imported `EVENT_TYPE_BADGE`.

## Post-review addendum — compile-time exhaustiveness guard

The coordinator reviewed the diff and identified a real gap: `as const
satisfies readonly EventType[]` on `EVENT_TYPE_ORDER` only constrains each
*element* to be a valid `EventType` — it does not require every `EventType`
to appear. `EVENT_TYPE_BADGE`'s `Record<EventType, ...>` shape does force a
`TS1360` error on a missing key, but `EVENT_TYPE_ORDER` alone would not, so a
future fourth event type could be added, `EVENT_TYPE_BADGE` fixed to match,
`tsc --noEmit` would go green, and the legend would still silently render
only three of four badges — the same silent-failure shape T145 was opened to
remove, just moved one level up.

Added a compile-time exhaustiveness guard to `src/lib/eventTypeBadge.ts`:

```ts
type EventTypeOrderIsExhaustive =
  Exclude<EventType, (typeof EVENT_TYPE_ORDER)[number]> extends never
    ? true
    : [
        'EVENT_TYPE_ORDER is missing event types:',
        Exclude<EventType, (typeof EVENT_TYPE_ORDER)[number]>,
      ];
const eventTypeOrderIsExhaustive: EventTypeOrderIsExhaustive = true;
void eventTypeOrderIsExhaustive;
```

Used the coordinator-supplied shape, dropping the underscore prefix on the
binding/type names: `noUnusedLocals`/`noUnusedParameters` are both `true` in
`tsconfig.json`, and the `void eventTypeOrderIsExhaustive;` statement already
counts as a real reference for both `tsc` and
`@typescript-eslint/no-unused-vars`, so no underscore convention or
eslint-disable comment was needed. Verified: `npx eslint
src/lib/eventTypeBadge.ts` — no output (clean). `npx prettier --check
src/lib/eventTypeBadge.ts` — failed once on the guard's initial formatting;
ran `npx prettier --write src/lib/eventTypeBadge.ts` (reformatted the ternary
branch's array literal onto multiple lines), then `--check` passed.

**Verification the guard fires, exactly as the coordinator described:**

1. Baseline hash (clean, guard in place, no mutation):
   ```
   sha256sum src/lib/eventTypeBadge.ts
   1d0fff8975767b44c019246263c5ce26fbfdf5f00736b0f5519e19975acb9d93
   ```
   `npx tsc --noEmit` on this state: clean, no output.

2. Added a fourth `EventType` union member only:
   ```ts
   export type EventType = 'meeting' | 'outreach' | 'competition' | 'fundraiser';
   ```
   `npx tsc --noEmit` produced **two** errors: the pre-existing `TS1360` on
   `EVENT_TYPE_BADGE` ("Property 'fundraiser' is missing...") and, separately,
   the new guard:
   ```
   src/lib/eventTypeBadge.ts(79,7): error TS2322: Type 'boolean' is not
   assignable to type '["EVENT_TYPE_ORDER is missing event types:",
   "fundraiser"]'.
   ```

3. To isolate the exact gap the coordinator described (someone adds the type,
   fixes `EVENT_TYPE_BADGE`, `EVENT_TYPE_ORDER` stays stale), also added a
   `fundraiser` entry to `EVENT_TYPE_BADGE` (satisfying its `Record` check)
   while leaving `EVENT_TYPE_ORDER` untouched. `npx tsc --noEmit` then
   produced **exactly one** error — the guard, and only the guard:
   ```
   src/lib/eventTypeBadge.ts(80,7): error TS2322: Type 'boolean' is not
   assignable to type '["EVENT_TYPE_ORDER is missing event types:",
   "fundraiser"]'.
   ```
   This is the scenario that would previously have gone green at `tsc
   --noEmit` while the legend silently dropped the fourth badge; the guard
   is what now catches it, naming the missing member by name.

4. Reverted both mutations (the `EventType` union and the `EVENT_TYPE_BADGE`
   addition) back to their exact original text.

5. Re-hashed:
   ```
   sha256sum src/lib/eventTypeBadge.ts
   1d0fff8975767b44c019246263c5ce26fbfdf5f00736b0f5519e19975acb9d93
   ```
   Identical to step 1 — byte-identical revert confirmed.

**Full re-verification after the guard was added (final state):**

- `npx tsc --noEmit` — clean, exit 0.
- `npx vite build` — succeeded (`✓ 2388 modules transformed`, `✓ built in
  5.86s`), same pre-existing unrelated chunk-size warning as before.
- `npm run format:check` — "All matched files use Prettier code style!"
- `npx eslint .` — **0 errors, 352 warnings**, identical count to the
  merge-base baseline established earlier in this task (via `git stash` /
  `npx eslint .` / `git stash pop`). No new warnings from the guard.
- `npx vitest run` (full suite) — **63 test files, 1469 tests, all
  passing**. Test count unchanged: the guard is pure `type`/`const`
  TypeScript with no runtime behavior and adds no test files or blocks.

## Criterion 2 — proof the rendered legend is unchanged

**Superseded by rework.** The original version of this section cited the
pre-existing test `'the legend renders the three DES-04 category Badges with
the correct variants'` as proof of "three badges, same labels, same variants,
same order." That was overstated: that test queried every `.astryx-badge` in
the *whole container*, not the legend subtree, and every session row also
renders a `.astryx-badge` with the same three labels (NAV-07's per-row type
badge). Filtering by label and keying into a `Map` meant the test would still
pass if the legend rendered **zero** badges — the July fixture's row badges
alone satisfy it — and a `Map` keyed by label asserts nothing about count or
order regardless. Demonstrated directly: replacing the legend's
`EVENT_TYPE_ORDER.map(...)` with `EVENT_TYPE_ORDER.slice(0, 0).map(...)`
(rendering zero legend badges) still passed all 31 tests. So the test
established that the labels `Meeting`/`Outreach`/`Competition` map to
`purple`/`blue`/`orange` **somewhere in the page**, not specifically in the
legend, and said nothing about count (three) or order.

The rendered legend genuinely is unchanged; what was missing was a test that
would actually catch it if it were not. Rewrote the test
(`CalendarPage.test.tsx`, now titled `'the legend renders exactly three
DES-04 category Badges, in Meeting/Outreach/Competition order'`) to scope to
the legend's own subtree and assert order:

```ts
const legendContainer = Array.from(container.querySelectorAll('.astryx-stack')).find((el) => {
  const children = Array.from(el.children);
  return children.length === 3 && children.every((c) => c.classList.contains('astryx-badge'));
});
expect(legendContainer).toBeTruthy();

const legendPairs = Array.from(legendContainer!.children).map((badge) => [
  badge.textContent,
  badge.getAttribute('data-variant'),
]);
expect(legendPairs).toEqual([
  ['Meeting', 'purple'],
  ['Outreach', 'blue'],
  ['Competition', 'orange'],
]);
```

`.astryx-stack` is `HStack`/`VStack`'s real rendered class (the same pattern
this file already uses for `.astryx-badge`, not an invented test hook). The
legend is identified as the one `.astryx-stack` whose direct children are
*exactly* three `.astryx-badge` elements and nothing else — true only of the
legend (confirmed by inspecting the rendered `container.innerHTML` directly:
each session row has exactly one badge alongside other row content, never
three badges as a container's only children; the only other `data-gap="2"
data-wrap="wrap"` `.astryx-stack` on the page wraps an `<h2>`, not badges).
`toEqual` against an ordered array of `[label, variant]` pairs asserts count,
labels, variants, and order together — a swap, a drop, a reorder, or an empty
render all fail it.

**Mutation-testing evidence (three mutations, each reverted):**

Baseline hashes before any mutation:
```
sha256sum src/pages/calendar/CalendarPage.tsx src/pages/calendar/CalendarPage.test.tsx
bd2105ca52d9423a0747dfbe29a6e1a4c7b87b6a80cc120a97b2d3a50e715f84  CalendarPage.tsx
0aa5c51f14008b4177a01aacb9fb0622ee69a13fe387b8e498ef53543f5d21b4  CalendarPage.test.tsx
```

1. **Emptying the legend** — `EVENT_TYPE_ORDER.map(...)` →
   `EVENT_TYPE_ORDER.slice(0, 0).map(...)` in `CalendarPage.tsx`. Result:
   **fails** — `expect(legendContainer).toBeTruthy()` → `AssertionError:
   expected undefined to be truthy` (no `.astryx-stack` has three badge-only
   children anymore). Reverted; `sha256sum CalendarPage.tsx` back to
   `bd2105ca...`.

2. **Reordering `EVENT_TYPE_ORDER`** — `['meeting', 'outreach',
   'competition']` → `['outreach', 'meeting', 'competition']` in
   `src/lib/eventTypeBadge.ts`. Result: **fails** — `toEqual` diff shows
   `['Outreach', 'blue']` where `['Meeting', 'purple']` was expected (and
   vice versa) as the first two pairs. Reverted; `sha256sum
   eventTypeBadge.ts` back to `1d0fff8975767b44c019246263c5ce26fbfdf5f00736
   b0f5519e19975acb9d93`.

3. **Dropping one entry** — `['meeting', 'outreach', 'competition']` →
   `['meeting', 'competition']` in `src/lib/eventTypeBadge.ts`. Result:
   **fails** — same `expect(legendContainer).toBeTruthy()` failure as
   mutation 1 (only two badges now render, so no `.astryx-stack` has exactly
   three badge-only children). Reverted; hash back to the same baseline as
   above.

After each revert, `sha256sum` on the touched file matched its pre-mutation
value exactly, and `npx vitest run src/pages/calendar/CalendarPage.test.tsx`
returned to **31 passed (31)**.

This proves the rewritten legend test discriminates on count, labels,
variants, and order — none of which the superseded version actually tested.

## Criterion 3 — grep for hand-written event-type badges

```
grep -rn 'variant="purple"\|variant="blue"\|variant="orange"' src/
```

Output:

```
src/pages/home/ParentHome.tsx:1176:          <Badge variant="blue" label={teamName} />
```

One survivor, and it is **not** an event-type badge: it renders the team
name (`label={teamName}`, e.g. "Team 11195") next to a student's name on the
parent dashboard card, unrelated to DES-04's meeting/outreach/competition
palette. Confirmed by reading `ParentHome.tsx:1171-1177` — the surrounding
`Card` shows `displayName` (a student) and `teamName`, nothing to do with
event type. No hand-written event-type badge remains anywhere in `src/`.

## Part 2 — prose corrections (before/after)

### 2a. `CalendarPage.tsx:107`

Before:
> `` `CALENDAR_TYPE_BADGE` below maps `meeting -> 'purple'`, `outreach -> 'blue'`, `competition -> 'orange'` -- Astryx `Badge`'s own ``

After:
> `` `EVENT_TYPE_BADGE` (`../../lib/eventTypeBadge`, imported above) maps `meeting -> 'purple'`, `outreach -> 'blue'`, `competition -> 'orange'` -- Astryx `Badge`'s own ``

The citation confirmed against the tree exactly matched the packet
(`grep -n` showed the hand-written legend at `CalendarPage.tsx:837-839`
before edit, and the stale prose at line 107) — no mismatch to report.

### 2b. `EventsTab.tsx:29-46`

**Reworked once.** Round 1 corrected the tense but, following the packet's
own (incorrect) framing, asserted the old `CalendarPage.tsx` line citation
(577-586) "was already wrong at the time." The coordinator checked the T058
commit (`48fcd90`) directly and found the constant actually spans lines
580-587 there — close, not fabricated, and my round-1 wording overstated it
into a second false claim replacing the first. Corrected per the
coordinator's instruction: drop the "already wrong" framing and state the
verified fact plainly.

Before (as originally written pre-T145, at T058):
> ... its own `CALENDAR_TYPE_BADGE` constant (`CalendarPage.tsx` lines
> 577-586) maps `meeting -> 'purple'`, `outreach -> 'blue'`,
> `competition -> 'orange'`, IDENTICAL to `EVENT_TYPE_BADGE` below -- both
> independently derived from the same DES-04 table, confirmed byte-identical
> in outcome, not merely "reused" by import ...

After (final, this round):
> ... its own then-local badge-map constant (the `CalendarPage.tsx` line
> citation this doc originally gave for it, 577-586, actually spanned lines
> 580-587 at that commit (`48fcd90`) -- a few lines off, not fabricated)
> mapped `meeting -> 'purple'`, `outreach -> 'blue'`,
> `competition -> 'orange'`, IDENTICAL to this file's then-local mapping --
> both independently derived from the same DES-04 table, agreeing by
> construction from a shared source, not by import.

Verified directly this round: `git show 48fcd90:src/pages/calendar/CalendarPage.tsx | grep -n CALENDAR_TYPE_BADGE`
locates the declaration at line 580 (`const CALENDAR_TYPE_BADGE: Record<`)
closing at line 587 (`};`) — confirmed by reading the actual lines, not
inferred. Also kept: the tense correction (`EVENT_TYPE_BADGE` is now
imported/re-exported, not derived in this file) and the paragraph on T138's
consolidation, both unchanged from round 1 and not disputed by the
coordinator. Verified against the real import (`EventsTab.tsx:346` `import {
EVENT_TYPE_BADGE } from '../../lib/eventTypeBadge';`) and re-export
(`EventsTab.tsx:474` `export { EVENT_TYPE_BADGE };`).

### 2c. `EventsTab.tsx:47-54` (the false NOTE)

**Reworked once.** Round 1 corrected the divergence claim (true fix) but
also asserted the original `~1191` `CoachHome.tsx` citation "was already
wrong even before" T080's correction — a claim the packet's own wording had
suggested but which round 1 did not independently verify before repeating.
The coordinator checked the T058 commit (`48fcd90`) directly: at that
commit, `CoachHome.tsx` line 1191 is exactly `const EVENT_TYPE_BADGE:
Record<EventType, ...> = {` with `meeting=blue, outreach=purple,
competition=teal` — the citation was fully accurate when T058 wrote it. Only
T080 (`82fafdf`) made it stale, by both correcting the mapping and moving the
constant to line 1210. Round 1's "already wrong at the time" clause was
itself false — new false history replacing old false history, the exact
defect this task exists to remove. Dropped completely per the coordinator's
instruction (not replaced with a softer version of the same claim).

Before (as originally written pre-T145, at T058):
> NOTE (disclosed finding, not fixed here): this deliberately diverges from `src/pages/home/CoachHome.tsx`'s own `EVENT_TYPE_BADGE` constant (line ~1191 there: meeting=`blue`, outreach=`purple`, competition=`teal`), which does NOT match DES-04's literal table above. `CoachHome.tsx` is outside this task's Allowed Files (not editable here); this file's own mapping is the one that matches the PRD text verbatim, and the inconsistency is flagged as a candidate finding for a future corrective task touching `CoachHome.tsx`.

After (round 1, now superseded by this rework — recorded so the error is
visible, not hidden):
> NOTE (pre-existing defect, exposed by T138, not caused by it): earlier revisions of this doc claimed this file's mapping "deliberately diverges" from `src/pages/home/CoachHome.tsx`'s own `EVENT_TYPE_BADGE` constant (citing meeting=`blue`, outreach=`purple`, competition=`teal` at line ~1191 there), and that `CoachHome.tsx` did NOT match DES-04. That claim has been false since T080, which corrected `CoachHome.tsx` to `meeting -> 'purple'`, `outreach -> 'blue'`, `competition -> 'orange'` -- the same DES-04 mapping this file uses -- and the line number given was already wrong even before that correction. [...]

After (final, this round):
> NOTE (history, verified against the actual commits, not re-derived from this doc's own prior wording): when T058 wrote this NOTE, its claim was accurate -- at that commit (`48fcd90`), `CoachHome.tsx` line 1191 was exactly `const EVENT_TYPE_BADGE: Record<EventType, ...> = {` with `meeting=blue, outreach=purple, competition=teal`, which genuinely did NOT match DES-04. T080 (`82fafdf`) corrected `CoachHome.tsx` to `meeting -> 'purple'`, `outreach -> 'blue'`, `competition -> 'orange'` -- the same DES-04 mapping this file uses, which is what made the divergence claim false -- and moved the constant to line 1210, which is what made the `~1191` citation stale. T138 then removed the local constant from `CoachHome.tsx` entirely: it now imports the same shared `EVENT_TYPE_BADGE` from `src/lib/eventTypeBadge.ts` that this file imports. There is no divergence today; there is one shared mapping across `CoachHome.tsx`, `CalendarPage.tsx`, and this file, and DES-04 is satisfied everywhere it is used.

Verified directly this round (not taken on the packet's or my own round-1
word):
```
git show 48fcd90:src/pages/home/CoachHome.tsx | sed -n '1191,1194p'
# const EVENT_TYPE_BADGE: Record<EventType, { variant: BadgeVariant; label: string }> = {
#   meeting: { variant: 'blue', label: 'Meeting' },
#   outreach: { variant: 'purple', label: 'Outreach' },
#   competition: { variant: 'teal', label: 'Competition' },

git show 82fafdf:src/pages/home/CoachHome.tsx | grep -n "const EVENT_TYPE_BADGE"
# 1210:const EVENT_TYPE_BADGE: Record<EventType, { variant: BadgeVariant; label: string }> = {
```
Both confirm the coordinator's correction exactly: line 1191 was accurate at
T058, T080 both fixed the colours and moved the constant to line 1210.
`EventsTab.tsx` itself remains **not** touched outside the module doc
(`:29-54`); no code lines in this file were changed, per Allowed Files.

## Part 3 — tightened assertion + mutation-testing evidence

`CalendarPage.test.tsx:264-271` (pre-edit) used unpaired `toContain` on a flat
list of variants. Rewrote it (now `CalendarPage.test.tsx:266-282`) to group
badges by label first, then assert every badge under a given label carries
the correct variant:

```ts
const badges = Array.from(container.querySelectorAll('.astryx-badge'));
const variantsForLabel = (label: string) =>
  badges.filter((b) => b.textContent === label).map((b) => b.getAttribute('data-variant'));

const meetingVariants = variantsForLabel('Meeting');
const outreachVariants = variantsForLabel('Outreach');
const competitionVariants = variantsForLabel('Competition');
expect(meetingVariants.length).toBeGreaterThan(0);
expect(outreachVariants.length).toBeGreaterThan(0);
expect(competitionVariants.length).toBeGreaterThan(0);
expect(meetingVariants.every((v) => v === 'purple')).toBe(true); // Meeting Violet, paired with label
expect(outreachVariants.every((v) => v === 'blue')).toBe(true); // Circuit Blue, paired with label
expect(competitionVariants.every((v) => v === 'orange')).toBe(true); // Comp Orange, paired with label
```

The neighboring `'the legend renders...'` test (`:273-286` pre-edit) also
keyed by label into a `Map`, which looked paired but was not scoped to the
legend subtree and so did not actually test the legend specifically (row
badges carry the same labels) — see the corrected "Criterion 2" section
below, which replaces that test with one scoped to the legend and covers
count/order as well as the label-variant pairing this row-level test covers.

**Mutation test performed:**

1. Recorded baseline hashes:
   ```
   sha256sum src/lib/eventTypeBadge.ts src/pages/calendar/CalendarPage.test.tsx
   07f55a907e3a2e66f58b6ce49b5cc41cfa0d730250e75e6f3963fdb9374e0ac7  src/lib/eventTypeBadge.ts
   8f1f5b48f14e7d496c2aa272afcbdbfa2a725d8afc09bffe4556a4f8a5b8aa9d  src/pages/calendar/CalendarPage.test.tsx
   ```
2. Mutated `EVENT_TYPE_BADGE` in `src/lib/eventTypeBadge.ts` to swap the
   `meeting`/`outreach` variants (labels unchanged — a genuine label/variant
   swap):
   ```ts
   meeting: { variant: 'blue', label: 'Meeting' },   // was purple
   outreach: { variant: 'purple', label: 'Outreach' }, // was blue
   ```
3. Ran `npx vitest run src/pages/calendar/CalendarPage.test.tsx`. Result:
   **2 failed, 29 passed** (of 31):
   - `... default (unfiltered) July view mixes ...` — `expected false to be
     true` at the new `meetingVariants.every(...)` line (this is the
     tightened assertion — it now catches the swap it previously would not).
   - `... the legend renders the three DES-04 category Badges ...` —
     `expected 'blue' to be 'purple'` (the already-paired legend test also
     caught it, as expected).
4. Reverted the mutation to the exact original text.
5. Re-hashed:
   ```
   07f55a907e3a2e66f58b6ce49b5cc41cfa0d730250e75e6f3963fdb9374e0ac7  src/lib/eventTypeBadge.ts
   8f1f5b48f14e7d496c2aa272afcbdbfa2a725d8afc09bffe4556a4f8a5b8aa9d  src/pages/calendar/CalendarPage.test.tsx
   ```
   Identical to step 1 — byte-identical revert confirmed.
6. Re-ran `npx vitest run src/pages/calendar/CalendarPage.test.tsx`:
   **31 passed (31)**.

This proves the tightened assertion discriminates a swapped label/variant
pair (it did not, before this change, for that specific row-level test —
the packet notes the file still failed via *other* assertions under
mutation, which is a weaker guarantee than this test now provides on its
own).

## What I reconciled the test count against

Reconciled against my own merge base, `7b6d11f` (= `origin/claude/swarm-plan-zl575z`
HEAD at merge time, confirmed identical via `git log --oneline -1 HEAD` and
`git log --oneline -1 origin/claude/swarm-plan-zl575z` both showing `7b6d11f`
after the fast-forward). This task's diff (`git diff --stat`) touches four
files and adds/removes zero `it(`/`describe(` blocks — it only rewrites the
body of one existing test and adds prose/a constant — so the total test
count is necessarily unchanged between merge-base and this task's final
state. Confirmed directly: `npx vitest run` on the merge-base tree (not
separately re-run, since the diff analysis above makes the count
deterministic) — and on this task's final tree: **63 test files, 1469 tests,
all passing.**

## Commands 6–7 (full output, final re-run this round, after all three rework items)

### `npx tsc --noEmit`
Clean, no output, exit 0.

### `npx vite build`
Succeeded: `✓ 2388 modules transformed` / `✓ built in 5.83s`. One pre-existing
chunk-size warning (`index-Ujfb5LPm.js` 673.19 kB), unrelated to this task
and present on the unmodified merge-base tree as well.

### `npm run format:check`
`All matched files use Prettier code style!` — clean.

### `npx eslint .`
**0 errors, 352 warnings** (`✖ 352 problems (0 errors, 352 warnings)`).
Re-compared against the current committed tree (pre-this-round, commit
`771519a`) via `git stash` / `npx eslint .` / `git stash pop` one more time
this round: baseline is also **0 errors, 352 warnings** — identical count.
This round introduced zero new lint warnings. All 352 warnings are the
pre-existing `react-refresh/only-export-components` warnings scattered
across many unrelated files — none in the files this task touched.

### `npx vitest run` (full suite)
```
Test Files  63 passed (63)
     Tests  1469 passed (1469)
  Duration  50.20s
```
`CalendarPage.test.tsx` specifically: 31/31 passed after all mutation tests
in this round (row-variant pairing from round 1, exhaustiveness guard from
round 2, and the three legend mutations from this round), each reverted to
a byte-identical file.

## Citation check

Every line citation in the packet (`CalendarPage.tsx:837-839`,
`CalendarPage.tsx:107`, `EventsTab.tsx:29-54`, `EventsTab.tsx:47-54`,
`CalendarPage.test.tsx:264-271`) matched the tree exactly after the merge —
no mismatch to report.

## Unverified

- I did not independently re-derive or check every other file in the repo
  for additional hand-written `purple`/`blue`/`orange` badges outside the
  grep pattern the packet specified (e.g. a badge using a variable that
  evaluates to `'purple'` at runtime rather than a literal string would not
  be caught by this grep). The grep as specified in the packet found exactly
  one survivor, explained above.
- I did not run `npm run astryx -- component Badge` to cross-check the
  `Badge` props; I relied on `variant`/`label` already being used
  identically at the pre-existing call site (`CalendarPage.tsx:645`,
  unchanged by this task) and in the pre-existing legend code this task
  replaced.

## Git status

Committed on this worktree's branch (`worktree-agent-a5fec7b0908b22a38`).
`git status --porcelain` after commit: empty apart from gitignored files (see
final report below for exact output).
