# W3-A handoff — meetings hygiene wave (2026-08-03 → 04)

**Branch `claude/w3a-meetings-hygiene`, based on `main` = `33c9e24`. Unattended auto-mode window.**
All decisions the orchestrator made alone are logged in `auto-mode-decisions.md` under
**"W3-A auto-mode window"** (D1–D6), marked as the orchestrator's and reversible.

## Result: 3 of 3 shipped — wave complete

| Row | Tier | Outcome |
|---|---|---|
| **T197** | STANDARD | ✅ **PASSED** — worker + checker, both NITs closed in-branch |
| **T160** | FAST | ✅ **PASSED** — orchestrator-authored, no worker (D6), not independently reviewed |
| **T162** | STANDARD | ✅ **PASSED** — parked at gate round 2 (D4), then **re-scoped by owner ruling** and closed test-only |

**Gates after merging `main` (`f5c730a`):** `tsc` **0** · eslint **0 errors** / 364 warnings ·
prettier **clean** · vitest **78 files / 1949 tests, exit 0**.

T197 added 2 (its assertion + the NIT-1 scenario), T162 added 2 (the denominator-floor test and the
physically-sorting ordering test; the third fix was an assertion swap). T160 added none, as a pure
rename must not.

## ⚠️ The thing to read first: four ledger rows were measured wrong

**T162's "0 tests" claim was FALSE; T163's is UNVERIFIED; T161's was TRUE and its row was simply completed — see D7's retraction.** Originally stated as all four: They came from an external audit that counted
**files named `<module>.test.ts`** rather than tests *of* the module. Measured (D5, structural —
which exports any test file actually invokes; no dependency installed):

| Row | Module | Lines | Reality |
|---|---|---:|---|
| ~~T161~~ | `checkin.ts` | 521 | ❌ **RETRACTED (D7) — claim was TRUE; row was COMPLETED** (`2d58675`) |
| T162 | `meetings.ts` | 726 | 2 files, 87 it-blocks, **11/11 exports** |
| T163 | `reports.ts` | 729 | 4 files, 83 it-blocks, **6/6 exports** |
| **T164** | `kpi.ts` | 255 | **claim is TRUE — 0 runtime tests** |

**Corrected figure: ~729 lines unverified (T163), not the ~1,976 first claimed.** All four rows are
annotated in the ledger; T161's annotation is a retraction.

**T164 is the real one and the only one worth doing.** Both its test files `import type` only; every
apparent hit on `loadKpiStripData` is the component's **injected prop being stubbed**. Neither the
factory nor the singleton is ever invoked.

**D5 retracts part of D4.** D4 swept T164 in with the others on the proxy *"two test files import
it"* — the same class of shortcut as the audit's, wrong the same way. Only invocation counts.

## T162 — resolved. Both decisions ruled, row closed.

**The row as written was mostly phantom work** — its "0 tests across 726 lines" premise was false
(see above). Parked at gate round 2 under item 19a rather than looped a third time, then resolved by
two owner rulings.

**Ruling 1 — duplication.** Verbatim: *"we should not be duplicating existing test"*. So **no
`meetings.test.ts` was created**, the 17 existing tests at `MeetingsList.test.tsx:1803-2272` were
**neither duplicated nor moved**, and all work went into the file that already had them. That also
avoided creating a **third** maintenance site for the MET-01 arithmetic (**T600**).

**Ruling 2 — do the remaining gap.** Re-scoped to the three measured gaps, ~35 lines, **`meetings.ts`
itself unmodified**. Each proven by its own mutation:

| Gap | Mutation | Result |
|---|---|---|
| The `Math.max(expectedCt - excusedCt, 1)` floor had **no test** — deleting it left all 1946 green | drop the floor | `expected NaN to be +0`, **exit 1** |
| `:2017`'s `toEqual(row)` **survives** deleting the single-row short-circuit | drop `rows.length === 1` | `expected {…} to be {…} // Object.is`, **exit 1** |
| `:2166` asserted the sort was *called*, not that it *worked* | drop `.order('created_at', …)` | `expected 'student-later' to be 'student-earliest'`, **exit 1** |

Without the floor, a student whose every expected session was excused is shown **`NaN`**. The
ordering gap guarded Trap #4's earliest-linked-child rule, where a parent with two children silently
resolves to the wrong one. The old call-shape ordering test was **kept, not replaced** — insufficient,
not wrong.

## Filed this wave

- **T600** — `meetings.ts:465-489` and `checkin.ts:340-373` are two TypeScript copies of one view
  expression, no shared helper, no test asserting they agree. All three agree today. Crosses into
  W1's `checkin.ts`, so it needs an ownership call.

## Corrections made to already-landed work

- **PRD MTG-13** still said post-completion attendance edits are "(audit-logged)", contradicting
  DATA-02 as amended by the 2026-08-03 ruling. Struck.
- **`endMeeting.ts:12-19`** claimed T196 was blocked and `LiveConsole`'s marking a no-op — both false
  since T403. Rewritten (T197 packet §5).

## Not done, deliberately

**T196 was not started and must not be** — it is excluded from this wave by the owner-approved split.
It is a project, not a ticket; it carries an open owner call; and its failure mode is real `absent`
rows against real students.

## ⚠️ Two of these three rows were never independently reviewed

**T197 got the full chain** — worker, then checker. That checker found **two real NITs the
orchestrator had missed**, including one that survived the orchestrator's own mutation replay.

**T160 and T162 were orchestrator-authored with no second reader** (D6 for T160; T162 by the same
reasoning after its worker packet was abandoned). Both are disclosed as unreviewed in their ledger
rows and verification-log entries, and both carry mutation proofs as the substitute. **On the
evidence of T197, that substitute is weaker than a second reader.** If anything in this wave gets a
retrospective review, make it those two.

## Process finding — third occurrence of one shape

T403's acceptance criterion contradicted the PRD. T404's premise was wrong for this team. T162's
premise came from an audit that measured the wrong thing. **Each time the chain verified the packet
diligently and nobody re-measured the ledger row it came from.** Item 19c says *verify your own
citations*; it does not say *verify the row's*. **Three-for-three, and worth a constitution item.**

Corroborating: **three of this wave's rows had stale citations** — T162's premise, T160's line
numbers (~32-line drift, one cited line absent entirely), and the T147 comment cited at `:565` when
it starts at `:564`.
