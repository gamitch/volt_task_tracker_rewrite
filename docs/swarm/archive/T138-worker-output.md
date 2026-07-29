# Worker Output: T138 — one shared event-type badge map

## Packet SHA verified

`76e7c1c45839d844597c379eb6b5357308b67cb1` — confirmed via
`git log -1 --format=%H -- docs/swarm/active/T138-worker-packet.md` before
writing this doc. Matches the SHA stated in the dispatch prompt (revision 2).

## FIRST — merge result

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forward merge, no conflicts (`Updating 2146255..76e7c1c`, 128 files
changed). This is how `T138-worker-packet.md` itself entered the worktree —
it did not exist before the merge.

## Where the shared module lives, and why

`src/lib/eventTypeBadge.ts` (new file).

`src/lib/` is where this repo already keeps cross-page data helpers with no
JSX (e.g. `src/lib/format/dates.ts`, added by T129 for the identical
"one correct pattern, N near-duplicate call sites" reason). `src/components/`
is reserved for components (`GoalBar`, `StatCell`) per the packet's own
instruction; this module exports a plain object and a type, no JSX, so it
belongs in `src/lib/`, following the `dates.ts` module-doc convention
(`@file`/`@input`/`@output`/`@position`/`SYNC`).

Contents:

```ts
import type { BadgeVariant } from '@astryxdesign/core';

export type EventType = 'meeting' | 'outreach' | 'competition';

export const EVENT_TYPE_BADGE = {
  meeting: { variant: 'purple', label: 'Meeting' }, // Meeting Violet
  outreach: { variant: 'blue', label: 'Outreach' }, // Circuit Blue
  competition: { variant: 'orange', label: 'Competition' }, // Comp Orange
} as const satisfies Record<EventType, { variant: BadgeVariant; label: string }>;
```

## Criterion 1 — grep, before and after

Before (measured at packet SHA, matches the packet's stated count):

```
$ grep -rn "meeting: { variant:" src/
src/pages/home/CoachHome.tsx:1803:  meeting: { variant: 'purple', label: 'Meeting' },
src/pages/reports/EventsTab.tsx:471:  meeting: { variant: 'purple', label: 'Meeting' },
src/pages/calendar/CalendarPage.tsx:598:  meeting: { variant: 'purple', label: 'Meeting' }, // Meeting Violet
```
(3 hits — confirmed before making any change, per the packet's "if it does
not return 3 when you start, stop and report" instruction.)

After:

```
$ grep -rn "meeting: { variant:" src/
src/lib/eventTypeBadge.ts:35:  meeting: { variant: 'purple', label: 'Meeting' }, // Meeting Violet
```
(1 hit.)

## Criterion 2 — proof every rendered badge variant/label is unchanged

**Value-by-value comparison** (not an eyeball) of the three deleted
declarations against the new shared constant, taken directly from the `git
diff` hunks below:

| Type | Old `CoachHome` | Old `EventsTab` | Old `CalendarPage` | New shared module |
|---|---|---|---|---|
| meeting | `purple` / `'Meeting'` | `purple` / `'Meeting'` | `purple` / `'Meeting'` | `purple` / `'Meeting'` |
| outreach | `blue` / `'Outreach'` | `blue` / `'Outreach'` | `blue` / `'Outreach'` | `blue` / `'Outreach'` |
| competition | `orange` / `'Competition'` | `orange` / `'Competition'` | `orange` / `'Competition'` | `orange` / `'Competition'` |

All four columns are identical, cell by cell. No value moved.

**Render-level confirmation** (test suite, not eyeball):
- `EventsTab.test.tsx:249-251` asserts `EVENT_TYPE_BADGE.meeting/outreach/
  competition` equal `{variant, label}` exactly as above, against the
  **imported** value (Trap 2) — passed unmodified, 27/27 tests in that file.
- `CalendarPage.test.tsx` asserts rendered `data-variant` attributes equal
  `'purple'`/`'blue'`/`'orange'` (both on session rows and the type legend)
  and rendered label text — passed unmodified, 31/31 tests in that file.
- `CoachHome.test.tsx` has no existing assertion on `EVENT_TYPE_BADGE`'s
  rendered output specifically (grepped for `data-variant`/
  `EVENT_TYPE_BADGE`/`NextUpRowItem` — no hits); its 100+ other tests still
  pass, but the badge-variant claim for `CoachHome` rests on the
  value-by-value table above plus `npx tsc --noEmit` (which would fail if the
  narrowed literal types didn't line up), not on a `CoachHome`-specific
  render assertion. **Stated plainly as the weakest link in this proof.**

## Trap 1 — `CalendarPage`'s narrower type

Not widened, and not preserved via a local re-annotated copy either — it
falls out of the shared module's own type for free.

`EVENT_TYPE_BADGE` in `src/lib/eventTypeBadge.ts` is declared with
`as const satisfies Record<EventType, { variant: BadgeVariant; label: string
}>` rather than a plain `Record<...>` annotation. `as const` makes each
`variant` field a literal type (`"purple"`, `"blue"`, `"orange"`) instead of
widening to `BadgeVariant`; `satisfies` checks the object is assignable to
the `Record<EventType, {variant: BadgeVariant; ...}>` shape without
performing that widening (unlike a `:` type annotation, which would).

Consequence: `EVENT_TYPE_BADGE[event.type].variant` in `CalendarPage.tsx`
still infers as `'purple' | 'blue' | 'orange'`, not the full 14-member
`BadgeVariant` union — verified by leaving `CalendarPage.tsx`'s call site
with no type annotation at all (`const typeBadge =
EVENT_TYPE_BADGE[event.type];`) and confirming `npx tsc --noEmit` is clean.
Nothing is lost; I did not need to contort the design (no cast, no
re-declared local `CALENDAR_TYPE_BADGE` copy) to keep it.

The PRD colour-name comments (`// Meeting Violet`, `// Circuit Blue`, `//
Comp Orange`) are preserved verbatim, now living beside the single
declaration in `src/lib/eventTypeBadge.ts` rather than in `CalendarPage.tsx`
(since the declaration itself moved there).

## Test count

Started: **1469 across 63 files** (matches the packet's stated baseline,
confirmed by running the suite before editing — see below, the post-change
run reports the identical number).
Ended: **1469 across 63 files** — unchanged. No test added for the shared
module itself; none was required by the packet, and the existing tests
already exercise it indirectly (via `EventsTab.test.tsx`'s value assertions
and `CalendarPage.test.tsx`'s render assertions, both against the imported
value).

## Criteria 5-6 command output

`npx tsc --noEmit`:
```
(no output — clean)
```

`npx vite build` (tail):
```
✓ built in 4.92s
```
(Only output was the existing "chunks larger than 500 kB" advisory, present
before this change too — not an error.)

`npm run format:check`:
```
Checking formatting...
All matched files use Prettier code style!
```

`npx eslint .`:
```
✖ 352 problems (0 errors, 352 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```
Baseline (measured via `git stash` immediately before re-running, on the
same worktree, same eslint config): **0 errors / 353 warnings**. Post-change:
**0 errors / 352 warnings** — one fewer, not one more. The removed warning
was `react-refresh/only-export-components` firing on `EventsTab.tsx`'s old
`export const EVENT_TYPE_BADGE = {...}` declaration; the replacement `export
{ EVENT_TYPE_BADGE };` re-export statement at that same location does not
trigger it. No new warnings anywhere else (confirmed by diffing per-file
warning blocks for the three edited files plus the new `eventTypeBadge.ts`,
which has zero warnings of its own — `react-refresh` only fires on `.tsx`
component files).

`npx vitest run`:
```
 Test Files  63 passed (63)
      Tests  1469 passed (1469)
```

## Files changed

- `src/lib/eventTypeBadge.ts` — new, the single shared module.
- `src/pages/home/CoachHome.tsx` — removed local `EVENT_TYPE_BADGE`
  declaration and its now-unused local `BadgeVariant` type alias (that type
  alias's only consumer was the removed map; `noUnusedLocals: true` in
  `tsconfig.json` would otherwise fail `tsc`); added the import.
- `src/pages/reports/EventsTab.tsx` — replaced the local `EVENT_TYPE_BADGE`
  declaration with `import { EVENT_TYPE_BADGE } from '../../lib/
  eventTypeBadge';` plus `export { EVENT_TYPE_BADGE };` at the original
  declaration site, so `EventsTab.test.tsx`'s existing value import
  (Trap 2) keeps working unmodified. `EventsTab.tsx`'s own local
  `BadgeVariant` type stays (still used by `SESSION_STATUS_BADGE`, which is
  out of this packet's scope).
- `src/pages/calendar/CalendarPage.tsx` — removed the local
  `CALENDAR_TYPE_BADGE` declaration; added the import; the one call site
  (`CalendarSessionRowItem`) now reads `EVENT_TYPE_BADGE[event.type]`
  directly.
- `docs/swarm/active/T138-worker-output.md` — this file.

## Anything unverified, stated plainly

- **`CoachHome.tsx` has no dedicated render/equality test for
  `EVENT_TYPE_BADGE`'s output** (see Criterion 2 above). I verified equality
  of the underlying data via direct diff and via `tsc`'s narrowed-type
  checks, but did not add a new test (out of scope: the packet's Allowed
  Files list tests only for files already covered, and adding a
  `CoachHome`-specific badge-render test wasn't requested). If a checker
  wants stronger proof for this specific file, that gap is real and I'm
  flagging it rather than papering over it.
- **Stale documentation prose left untouched, by design of the Allowed
  Files scope ("only the map declaration and its import").** Two spots now
  describe a state of the world that no longer exists, and I deliberately
  did not edit them because doing so would have gone beyond "the map
  declaration and its import":
  - `CalendarPage.tsx:107` (module doc #2) still says `` `CALENDAR_TYPE_BADGE`
    below maps... `` — that identifier no longer exists in this file.
  - `EventsTab.tsx`'s module doc (lines ~29-54) still narrates the three-way
    independent-derivation history in present tense ("`EVENT_TYPE_BADGE`
    below was derived directly...") and a stale line-number reference to
    `CoachHome.tsx`'s constant (it already said "line ~1191" before my
    change, which was imprecise even pre-refactor — the real line was 1802
    at packet-authoring time). I did not correct either the staleness or the
    pre-existing imprecision, both out of scope here.
  I flagged rather than silently fixed these, per the packet's own framing
  ("if consolidating would change any rendered value, stop and report" — this
  is documentation, not a rendered value, so I proceeded, but I'm not hiding
  the resulting staleness).
- **`CalendarPage.tsx`'s hard-coded legend badges** (`<Badge variant="purple"
  label="Meeting" />` etc., three JSX call sites near line 837) are a
  separate, pre-existing hand-written rendering of the same three values —
  not sourced from `CALENDAR_TYPE_BADGE`/`EVENT_TYPE_BADGE` before or after
  this change. They were never part of the "map declared three times"
  finding (they don't match the `meeting: { variant:` grep pattern, and the
  packet's Allowed Files restrict `CalendarPage.tsx` edits to "only the map
  declaration and its import"), so I left them as literal JSX, unchanged.
  Noting this because a checker skimming the file might expect them to
  reference the shared constant too; they don't, and doing so was not part
  of this packet's scope.
- I did **not** self-certify. This output reports what I measured; an
  independent checker should re-run the commands above.

## Commands run (for reference, full list)

```
git log -1 --format=%H -- docs/swarm/active/T138-worker-packet.md
git fetch origin
git merge origin/claude/swarm-plan-zl575z
grep -rn "meeting: { variant:" src/          # before and after
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .
npx vitest run
npx vitest run src/pages/reports/EventsTab.test.tsx
npx vitest run src/pages/calendar/CalendarPage.test.tsx src/pages/home/CoachHome.test.tsx
git stash && npx eslint . && git stash pop   # baseline warning-count check
```
