# T702 — worker packet

**Row:** T702 (W4 block) · **Tier: STANDARD** · **Branch:**
`claude/t702-drop-adult-volunteer-totals`

## Tier justification (item 26 — state and defend it)

**STANDARD, not HEAVY.** None of item 26's required HEAVY triggers fire: no write path or
destructive operation, no RLS/auth/role logic, no migration, no metric-view SQL, and no export
another *session* builds against (`buildSeasonTotals` has exactly two consumers, both inside W4's
own files — the render at `HoursTab.tsx:1094` and the tests).

**Not FAST either**, despite being a deletion: it removes fields from an exported type and crosses
four files including the PRD, which is past FAST's "no cross-module signature, ≤~20 lines" bar.

## The ruling — cite it, never paraphrase it

`auto-mode-decisions.md`, **"2026-08-03 — George's ruling on T702"**. Structured selection, three
options, he chose **"Drop it — students only."** Verbatim: *"we only nee to count student hours per
rules we already established"* and *"this should just be a change in the sql queries"*.

**Two things this authorizes that you could not otherwise do:**

1. **Amend RPT-03** (`VOLT_Portal_PRD.md:370`). Constitution item 1 puts PRD requirement IDs above
   this constitution and above agent judgment. The owner is the only one who can authorize this.
2. **Change a passing test.** `HoursTab.test.tsx:327` asserts the fields you are deleting. The
   Non-Negotiables require the owner's explicit approval to update an existing green test — this
   ruling is that approval. **You still may not change any OTHER passing test.**

## What to do

**1. `src/lib/supabase/loaders/reports.ts`** — drop `adult_volunteers_count, adult_volunteer_hours`
from `queryHoursEvents`'s select (`:408`) and from the `HoursEventDbRow` type (`:343-344`) and its
mapping (`:468-469`). **Leave `queryEventsEvents` (`:605`) completely alone** — that feeds RPT-04.

**2. `src/pages/reports/HoursTab.tsx`** — delete the two reduces (`:593-596`), the two fields on
`HoursSeasonTotals` (`:573-574`), the two fields on `HoursEventRow` (`:340-343`), and the two KPI
cards that render them (`:1063`, `:1069`). Update **module doc #6** (`:134-162`) to record that
RPT-03's adult-volunteer clause was removed by owner ruling, with the citation — that doc currently
presents the sum as ground truth and will otherwise become a false claim, which is the exact
documentation-trap class that cost T176 a full round.

**3. `src/pages/reports/HoursTab.test.tsx`** — update the `:327` test: drop the two adult
assertions, keep everything else. **People-reached assertions stay** (`peopleReachedTotal` 125,
`sessionsMissingHeadcountCount` 3, `totalSessionCount` 5) — they are unaffected and must still pass.

**4. `docs/swarm/VOLT_Portal_PRD.md:370`** — amend RPT-03. It currently ends:
*"…team subtotal rows; season totals for people reached and adult volunteers (count and hours)."*
Remove only the adult-volunteer clause. **People reached stays.** Do not touch RPT-04 (`:371`) or
RPT-05 (`:372`), which name adult volunteers independently and are **not** covered by this ruling.

## Allowed files — nothing else

```
src/lib/supabase/loaders/reports.ts
src/pages/reports/HoursTab.tsx
src/pages/reports/HoursTab.test.tsx
docs/swarm/VOLT_Portal_PRD.md          (RPT-03 line only)
```

**Explicitly forbidden**, and each for its own reason:
- `src/pages/reports/EventsTab.tsx` and `src/pages/reports/csvExport.ts` — RPT-04/RPT-05 show adult
  volunteers **per event**, were not ruled on, and stay.
- `src/pages/outreach/**` and `src/lib/supabase/loaders/outreach.ts` — **W2's files.** They are where
  a coach *enters* these numbers. Collection continues; only RPT-03's aggregation stops.
- Any migration. The `events.adult_volunteers_count`/`adult_volunteer_hours` columns stay. Dropping
  them is destructive, irreversible and was not asked for (item 25).

## Acceptance criteria — each names a mutation that turns it red

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | The Hours tab renders no adult-volunteer figures | Re-add either KPI card → a new test asserting the DOM contains neither "Adult volunteers" nor its value must FAIL |
| 2 | People-reached totals are untouched | Change `peopleReachedTotal`'s reduce → the surviving `:327` assertions (125 / 3 / 5) must FAIL |
| 3 | RPT-04's per-event figures still work | Delete the adult columns from `queryEventsEvents` → `EventsTab`'s existing tests must FAIL |

Criterion 3 is the guard against over-deleting into RPT-04. **A criterion whose mutation leaves the
suite green is not evidence — report that instead of shipping it.**

## Six gates, `.env.local` ABSENT — assert exit codes directly, not through a pipe

```
npx tsc --noEmit ; echo $?
npx vite build ; echo $?
npm run format:check ; echo $?
npx eslint . ; echo $?
npx vitest run ; echo $?
npx vitest run src/pages/reports/ ; echo $?
```

Reference at this branch point: eslint **0 errors / 364 warnings**, vitest **78 files / 1950 tests**.
Re-measure and report yours. **The total test count will drop** — that is expected here, since
assertions are being removed by owner ruling; state the new number and why.

## Rules

Item 22 — named pathspecs only, never `git add -A`. Item 23 — your own worktree, **commit before
mutating**. Item 21 — report the commit SHA; the orchestrator verifies HEAD moved and the change is
in the committed blob. You do **not** self-certify. If the packet is wrong or impossible, **say so**
rather than quietly picking a side.
