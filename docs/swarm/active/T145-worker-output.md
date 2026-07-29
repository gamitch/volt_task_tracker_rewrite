# T145 Worker Output — close the badge-map loose ends T138 left and exposed

## Packet SHA verified

`git log -1 --format=%H -- docs/swarm/active/T145-worker-packet.md` (run after
merging `origin/claude/swarm-plan-zl575z`, which is what brought the packet
into this worktree in the first place — see "FIRST" section below):

```
79bfcc602efd187918335d211de0cc02637fbf07
```

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

Proof is a render assertion, not an eyeball: the pre-existing test `'the
legend renders the three DES-04 category Badges with the correct variants'`
(`CalendarPage.test.tsx:273-286`, untouched by this task) renders the page,
filters `.astryx-badge` elements to those with text `Meeting`/`Outreach`/
`Competition`, and asserts `byLabel.get('Meeting') === 'purple'`,
`byLabel.get('Outreach') === 'blue'`, `byLabel.get('Competition') === 'orange'`.
This test passed unmodified both before and after the Part 1 change (see
`npx vitest run` output below — 31/31 `CalendarPage.test.tsx` tests green),
confirming three badges, same labels, same variants, same order (Meeting,
Outreach, Competition — `EVENT_TYPE_ORDER`'s literal order).

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

Before (excerpt): claimed `EVENT_TYPE_BADGE` "below was derived directly from
the PRD's own DES-04 table" and cited `CalendarPage.tsx` lines 577-586 for a
`CALENDAR_TYPE_BADGE` constant that (per the packet) was already the wrong
citation before T138.

After: corrected tense throughout — "was **originally** derived directly
from the PRD" (historical, describing the pre-T138 state), explicitly flags
that the old `CalendarPage.tsx` line citation (577-586) "was already wrong at
the time," and adds a new paragraph stating T138 consolidated every
independent copy into `src/lib/eventTypeBadge.ts` and that `EVENT_TYPE_BADGE`
"is now imported from there ... and merely re-exported further down ... it is
no longer derived or defined in this file at all." Verified against the real
import (`EventsTab.tsx:346` `import { EVENT_TYPE_BADGE } from
'../../lib/eventTypeBadge';`) and re-export (`EventsTab.tsx:474` `export {
EVENT_TYPE_BADGE };`).

### 2c. `EventsTab.tsx:47-54` (the false NOTE)

Before:
> NOTE (disclosed finding, not fixed here): this deliberately diverges from `src/pages/home/CoachHome.tsx`'s own `EVENT_TYPE_BADGE` constant (line ~1191 there: meeting=`blue`, outreach=`purple`, competition=`teal`), which does NOT match DES-04's literal table above. `CoachHome.tsx` is outside this task's Allowed Files (not editable here); this file's own mapping is the one that matches the PRD text verbatim, and the inconsistency is flagged as a candidate finding for a future corrective task touching `CoachHome.tsx`.

After:
> NOTE (pre-existing defect, exposed by T138, not caused by it): earlier revisions of this doc claimed this file's mapping "deliberately diverges" from `src/pages/home/CoachHome.tsx`'s own `EVENT_TYPE_BADGE` constant (citing meeting=`blue`, outreach=`purple`, competition=`teal` at line ~1191 there), and that `CoachHome.tsx` did NOT match DES-04. That claim has been false since T080, which corrected `CoachHome.tsx` to `meeting -> 'purple'`, `outreach -> 'blue'`, `competition -> 'orange'` -- the same DES-04 mapping this file uses -- and the line number given was already wrong even before that correction. Since T138, `CoachHome.tsx` carries no local constant at all: it imports the same shared `EVENT_TYPE_BADGE` from `src/lib/eventTypeBadge.ts` that this file imports. There is no divergence; there is one shared mapping across `CoachHome.tsx`, `CalendarPage.tsx`, and this file, and DES-04 is satisfied everywhere it is used.

Verified against the tree before writing this: `CoachHome.tsx:530` imports
`EVENT_TYPE_BADGE` from `../../lib/eventTypeBadge`, and its own comment at
`CoachHome.tsx:1782-1784` reads "T138: `EVENT_TYPE_BADGE` now lives in
`../../lib/eventTypeBadge` ... History: T080 corrected this file's mapping" —
confirming the packet's T080 claim independently rather than taking it on
faith. `EventsTab.tsx` itself was **not** touched outside the module doc
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

The neighboring `'the legend renders...'` test (`:273-286` pre-edit) was
already paired via a `Map`, so Part 1's legend coverage needed no change —
confirmed it still passes after Part 1's rewrite.

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

## Commands 6–7 (full output)

### `npx tsc --noEmit`
Clean, no output, exit 0.

### `npx vite build`
Succeeded: `✓ 2388 modules transformed` / `✓ built in 6.21s`. One pre-existing
chunk-size warning (`index-Ujfb5LPm.js` 673.19 kB), unrelated to this task
and present on the unmodified merge-base tree as well (this task added no new
imports beyond what was already imported).

### `npm run format:check`
Initially failed on `src/lib/eventTypeBadge.ts` (the new `EVENT_TYPE_ORDER`
literal needed reformatting). Ran `npx prettier --write
src/lib/eventTypeBadge.ts`, which reformatted the tuple onto multiple lines.
Re-ran `npm run format:check`: **"All matched files use Prettier code
style!"**

### `npx eslint .`
**0 errors, 352 warnings** (`✖ 352 problems (0 errors, 352 warnings)`).
Compared against the unmodified merge-base tree via `git stash` /
`npx eslint .` / `git stash pop`: baseline is also **0 errors, 352
warnings** — identical count. This task introduced zero new lint warnings.
All 352 warnings are the pre-existing `react-refresh/only-export-components`
warnings scattered across many unrelated files (roster/settings/reports
tabs, etc.) — none in the files this task touched.

### `npx vitest run` (full suite)
```
Test Files  63 passed (63)
     Tests  1469 passed (1469)
  Duration  52.27s
```
`CalendarPage.test.tsx` specifically: 31/31 passed both before and after the
mutation test (see Part 3).

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
