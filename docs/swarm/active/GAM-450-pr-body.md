Closes GAM-450

## What changed

Adds `src/lib/meetings/overlap.ts` — one pure, synchronous `buildOverlapIndex`
that takes every session across all loaded series and returns a map from
session id to the sessions it genuinely clashes with. The three badge sites
(`SeriesCard`, `SchedulePanel`, `MeetingsRail`) can now share one answer
instead of each deriving its own. Nothing in `src/` computed overlap before
this; it is the first implementation, not a de-duplication.

The rules it encodes: different series only, same Chicago calendar day,
strictly intersecting intervals (`a.start < b.end && b.start < a.end`, so
4–6 PM and 6–8 PM do **not** clash), and canceled sessions excluded in both
directions. Only sessions with at least one clash appear as keys —
`MeetingsRail.tsx:665`'s `overlapIndex.get(id) ?? []` is the only read site in
the codebase and that idiom is what rule 5 rests on.

## What the issue got wrong

**The UTC day-shift is the ordinary case here, not the edge case the issue
describes.** The issue warns about "a 11 PM Chicago session" as a hazard.
Measured in `src/lib/meetings/coachModel.ts:167-207`: all five meeting fixtures
already end on the following UTC date — a 6–8 PM Chicago session is stored
`startsAt 2026-07-22T23:00:00Z` / `endsAt 2026-07-23T01:00:00Z`. Any evening
meeting ending at or after 7 PM Chicago crosses under CDT. So bucketing the day
from an instant breaks the **common** path. The module buckets on the stored
`sessionDate` string and nothing else; the premise gate traced that field to
`event_sessions.session_date date not null` and confirmed it is Chicago-sourced
(`ScheduleMeetingsDialog.tsx:486-490` derives the instants *from* the date, not
the reverse).

**The issue proposes FAST; this ran STANDARD.** See below.

## Tier, stated and defended

**STANDARD.** The row arrived `tier/unreviewed`; I tiered it as part of
claiming (item 28d), before moving it to `In Progress`, and that judgement is
reviewable.

- **Not FAST**, which the issue asked for. FAST caps at roughly 20 lines of
  production change and exists for "a few line bug fix". This is 78 lines of
  new module plus 233 of tests, and it ships a new exported contract that
  sibling tickets code against — item 26's own HEAVY trigger wording is "an
  export another session builds against".
- **Not HEAVY**, and that was the closer call. Every core trigger is absent: no
  write path, no destructive operation, no RLS/auth/role logic, no migration,
  no metric-view SQL. The export trigger is defused because `OverlapRef` and
  `OverlapIndex` were already frozen by GAM-444 at `src/lib/meetings/types.ts:350-356`,
  explicitly marked "TYPE ONLY — `buildOverlapIndex` and its home belong to
  GAM-450". This implements a frozen shape rather than authoring one. **I
  recorded at claim time that if that contract were absent from the repo the
  trigger would fire and this would escalate to HEAVY**; it was present, so it
  did not.
- **Item 19 binds at every tier**, so the packet went through `checker-premise`
  before any worker saw it. It returned REVISE, then DISPATCH — two rounds,
  within the item 19a cap.

## Verification

Six gates, run by the orchestrator with `--require-clean` on the final branch
state, independently of the worker's own run:

```
GATE RUN — 61132fba on claude/gam-450-overlap-index — tree clean

  1 tsc                       exit 0  PASS
  2 vite build                exit 0  PASS
  3 format:check              exit 0  PASS
  4 eslint                    exit 0  PASS       0 errors, 382 warnings
  5 vitest (full)             exit 0  PASS       111 files / 2699 tests  (no baseline given — regression not checked)
  6 vitest src/lib/meetings/  exit 0  PASS       4 files / 35 tests  (no baseline given — regression not checked)

VERDICT: PASS — all six gates exit 0
```

The worker's independent run produced the same figures (2699 / 35 / 0 errors /
382 warnings) at its own commit `f3fedd60`. Two runs agreeing, not one number
quoted twice. Its first run had gate 3 red on formatting only; it fixed that
with `prettier --write` and re-ran, and reported the failure rather than only
the green result.

`61132fba` is the last commit carrying source or PR-body changes; anything
after it on this branch is the run log only. The gates were run twice — once at
`10d1139f` and again at `61132fba` after the doc commits, because appended
Markdown can move gate 3 — and produced identical figures both times.

**No baseline was measured**, so gates 5 and 6 correctly print "regression not
checked" — that stays visible. The no-regression claim is made structurally
instead, which is stronger than a count: `git diff --name-status origin/main...HEAD -- src/`
returns only `A` rows, so no pre-existing test file was modified or deleted.

### Mutations

Replayed by the orchestrator in a dedicated worktree at `f3fedd60` (item 23 —
never the shared tree), after committing (item 26's "commit before mutating").

| Mutation | Result |
| -- | -- |
| `a.start < b.end && b.start < a.end` → `<=` on **both** sides | **RED** — `overlap.test.ts:67:57`, `AssertionError: expected true to be false`. Test 2, touching intervals. Matches the worker's reported line and text exactly. |
| `a.start <= b.end` alone (**single**-sided — the version this packet originally named) | **RED at `overlap.test.ts:71:58` only; lines 67–68 PASS.** Line 71 is the reversed-input-order assertion; 67–68 are forward order. |

**That second row is the finding this PR is proudest of, and it is not
cosmetic.** My original packet named the single-sided mutation. The premise
gate refused it as a MAJOR, having replayed 2 loop shapes × 2 input orders and
found it survives under the `i < j` pairwise loop with the test listing 4–6 PM
first — because for a touching pair the comparison that actually fails is the
*second* one (`b.start < a.end` is `18 < 18`). The shipped implementation does
use that exact loop shape. So the replay above confirms the gate empirically
against real code: a fully correct module would have reported a surviving
mutation, and the author would have had to choose between reporting phantom
missing coverage or restructuring a correct loop to satisfy a ritual. The gate
also required the both-orders assertion at line 71, which is the only thing
that catches it.

## Scope: what this does and does not close

This ships an **internal seam with no user-visible surface** — nothing renders
from it in this PR. Item 27's fixture test does not apply: the rule is scoped
to a surface a user can reach, and there is none here. `buildOverlapIndex` has
no caller yet; wiring it to the three badge sites is GAM-452's job, and that
row carries the obligation to read real data.

Concretely: this PR does not make an overlap badge appear anywhere. It makes
one computable.

## Follow-ups filed

None. No defect was deferred and nothing was left knowingly broken, so item 20
produces no row. The one design decision left open — ref ordering follows input
order rather than chronological — is disclosed below rather than filed, because
no consumer renders refs today (the sole read site renders `refs.length`).

## Known gaps, disclosed

- **Ref ordering is input order, not chronological.** Deterministic, but
  arbitrary. The only current consumer reads `.length`, so nothing depends on
  it. A future consumer that renders refs in sequence would need this pinned.
- **`completed` sessions are treated as overlappable.** Past clashes badge like
  future ones. The premise gate checked MTG-01f and the `meetings-design` skill
  and found no time restriction on overlap badges (the "never on a past
  session" rule at SKILL.md:67 is scoped to relative-date chips), but this is a
  judgement about intent and the owner may disagree.
- **Test 5b's fixture times are contrived**, as the worker disclosed unprompted:
  to force the naive-UTC-collision scenario it uses instants that no real
  meeting would have. The mechanics it proves are the packet's, but it does not
  mirror a real row from `coachModel.ts`.
- **No baseline test count was measured** — see Verification.

Linear-Issue: GAM-450
