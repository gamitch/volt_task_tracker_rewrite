# T164 — worker packet: first tests for `loaders/kpi.ts`

**Branch `claude/t164-kpi-loader-tests`. Base `08a1092`. STANDARD tier.**
Baseline measured at base: **78 files / 1952 tests, exit 0**.

**Premise gate SKIPPED under item 19b** — orchestrator decision, logged in `auto-mode-decisions.md`
("T196 unmonitored window", D4). Justification is in §1: the premise is **measured three times, not
inherited**, and the pattern is settled with three in-repo precedents. The residual risk is a
*vacuous test*, which is a worker risk the checker catches.

**Ownership: `loaders/kpi.ts` is W4's file** (`WORKFLOWS.md:226`). The owner authorized this row
directly (*"go ahead with T164"*). **Scoped to this row's tests only** — do not touch W4's view
migrations, `loaders/reports.ts`, or `pages/reports/**`.

## 1. The premise — measured, and it is the ONE row of four that is true

Three of the ledger's four "0 tests" rows were **false** — an audit counted *files named
`<module>.test.ts>`* rather than tests *of* the module (see D5/D7). **T164 is the survivor.**
Re-verified a third time at HEAD `bab3371`:

| Check | Result |
|---|---|
| Runtime imports of `loaders/kpi` in any test | **0** |
| Type-only imports | 2 (`KpiStrip.test.tsx:24`, `AppShell.test.tsx:48`) |
| Any test invoking `makeLoadKpiStripData` or `loadKpiStripData` | **0** |
| File size | **255 lines** |

Every apparent use of `loadKpiStripData` in `KpiStrip.test.tsx` is the component's **injected prop
being stubbed** — that exercises `KpiStrip`, not this loader. **The runtime is genuinely untested.**

## 2. What the file actually is — verified, not assumed

- **No arithmetic anywhere.** The math lives in W4's `*kpi_views.sql`, which this file only reads.
  So there is **no metric-math risk in the loader** and no item-18 opus trigger.
- Reads two views: `v_season_kpis` (`:153`) and `v_season_kpi_team_counts` (`:166`).
- `makeLoadKpiStripData(getClient = getSupabaseClient)` (`:236-237`) — **client-injectable**, the
  same convention every sibling loader uses. **A stubbed transport needs zero network.**
- The returned function (`:245-252`): `Promise.all` both queries → map team counts → **if the KPI
  row is `null`, return `zeroedKpiStripData`, else `mapKpisDbRowToKpiStripData`.**

**Only `makeLoadKpiStripData` and `loadKpiStripData` are exported.** The three internal functions
(`zeroedKpiStripData:183`, `mapKpisDbRowToKpiStripData:202`, `mapTeamCountDbRowToBreakdownRow:172`)
must be tested **through the factory** with a stubbed client.

## 3. ⚠️ THE DEFECT CLASS THAT MATTERS — a field swap

`mapKpisDbRowToKpiStripData` (`:202-222`) is a **verbatim column rename**, 11 fields, no logic:

```ts
meetingHours: row.meeting_hours,
outreachHours: row.outreach_hours,
competitionHours: row.competition_hours,
```

**Swap any two and nothing crashes — a coach is shown meeting hours labelled as outreach hours.**
That is item 26's *"lie to a user about their own data"* exactly, and it is the whole reason this
row is worth doing.

**A test asserting only "an object came back with 12 keys" cannot catch it.** Give every field a
**distinct** value in the fixture so a swap is observable. `totalHours: 1, meetingHours: 2,
outreachHours: 3…` — never two fields sharing a value, and never `0` for more than one.

## 4. What to cover

1. **The mapping (`:202`)** — highest value. Distinct-value fixture, assert the whole object.
2. **The zero path (`:183`)** — when `v_season_kpis` returns **no row**, the loader must return
   zeroes **with the team breakdown still populated** (`:249-251` passes `teamBreakdown` into the
   zeroed shape). A student-facing strip showing zeroes but losing its team list is a real defect.
3. **`teamCountRows ?? []` (`:247`)** — a null team-count response must yield `[]`, not a crash.
4. **Both queries actually run** (`Promise.all`, `:246`) — assert both view names are queried.

## 5. How to test

**Precedent to copy — read one before starting:** `loaders/checkin.test.ts`,
`loaders/endMeeting.test.ts`, `loaders/attendance.test.ts`. All three stub the client through the
factory's `getClient` parameter. `checkin.test.ts:144-149` is the shape for a throwing `getClient`.

**Outcome-provable, not call-shape.** This project has shipped **7+ assertions that passed for the
wrong reason** and one that went **vacuous rather than red** (`verification-log.md:7726-7733`,
`:7791-7799`).

## 6. Acceptance criteria

| # | Criterion | Mutation → must go RED at exit 1 |
|---|---|---|
| C1 | The mapping is field-accurate | **swap `meeting_hours` and `outreach_hours`** in `mapKpisDbRowToKpiStripData` |
| C2 | A second, non-adjacent swap is caught too | swap `goal_target_hours` and `goal_pct` |
| C3 | The no-KPI-row path returns zeroes | make the `kpisRow === null` ternary (`:249`) always take the `map…` branch |
| C4 | …**and still carries the team breakdown** | pass `[]` instead of `teamBreakdown` into `zeroedKpiStripData` (`:250`) |
| C5 | A null team-count response yields `[]`, not a crash | change `(teamCountRows ?? [])` to `teamCountRows!` (`:247`) |
| C6 | Both views are queried | delete `loadTeamCounts()` from the `Promise.all` (`:246`) |
| C7 | Suite green | — base **1952**; state your delta (a new file makes it **79** files) |

**C1 and C2 are the ones that matter.** If your test passes with two fields swapped, it is not
testing the mapping — say so rather than adjusting it.

**Item 23: mutate in your own worktree, never the shared tree. Commit before mutating.** Record each
mutation's exact failing assertion and exit code, restore, verify `git diff --quiet`. **A green suite
at exit 0 after a mutation means that criterion is not covered.**

## 7. Required output

- C1–C7 with **real** mutation output (failing assertion + exit code)
- Gates: `tsc`, `eslint`, `prettier`, `vitest`. **Base: 78 files / 1952 tests, exit 0.** If yours
  differ, say so plainly.
- Confirmation `kpi.ts` itself is **unmodified** — or the defect that justified touching it, and the
  dispute you raised **first**
- Anything found and not fixed, **filed**. Block: **T700–T799** (W4's).
