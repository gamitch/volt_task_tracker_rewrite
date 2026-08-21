Closes GAM-444

Splits `src/pages/meetings/MeetingsList.tsx` (2910 lines) into a 193-line shell
plus `coach/`, `student/` and `src/lib/meetings/` modules, and freezes the type
contracts the five parallel Wave-2 meetings-redesign tickets code against. After
this merges, those tickets own disjoint files and cannot conflict.

**Behavior-preserving, and that was proved rather than asserted.** The checker
byte-diffed every moved block against the merge base: both view components, both
props interfaces and all eleven pure functions are identical apart from an added
`export` keyword and changed import depth. 79 top-level declarations at the base,
0 missing. Test bodies differ on 15 lines, all import/`vi.mock` path depth, with
zero assertion text lost.

## What the issue got wrong

The issue carried a `Verification note` claiming a re-check against `main`. Three
of its headline numbers were stale and one instruction was not implementable —
all measured on `bdfafcf` before the packet was written.

| Issue said | Measured | Why |
| -- | -- | -- |
| **2997** lines | **2910** | 2997 was exact at `0138bfc`; `b7e9b1d` (GAM-443) then hoisted the formatters to `src/lib/meetings/format.ts`, −87 lines. The issue was verified against the commit *before* that merge. |
| role switch at `:2944–2996` | `:2857–2910` | Same 87-line shift — the cited range was past EOF. |
| **121** existing tests | **106** | Never 121 at any commit in the last twelve touching the file. |
| `resolveCurrentStudentId.ts` is the `src/lib/meetings/` precedent | `format.ts` is too | GAM-443 landed after the issue was written. |

**The 121 was the dangerous one.** A worker told "all 121 existing tests must
still pass" would have had to invent 15 tests, which the same plan item forbids
("no assertion changes").

**Plan item 6 is cut and filed, not silently dropped** — see *Known gaps*.

## Tier, stated and defended

**HEAVY** (packet → `checker-premise` → worker → `checker-reviewer`), judged
before the `In Progress` move per item 28d.

Trigger: item 26's **"an export another session builds against"**. This ticket's
whole purpose is freezing contracts — `SeriesCardModel`, `MeetingsFocusRequest`,
`OverlapIndex` and eight stub props interfaces — that five separate tickets build
on in parallel. A wrong contract is not a local defect its own PR catches; it is
a wrong foundation under five tickets. Secondary trigger: the moved student view
renders participation %, so a mis-wired builder lies to a student about their own
attendance.

The losing argument was STANDARD: "git mv + re-point imports" is mechanical and a
106-test suite machine-checks behavior preservation. Real, but incomplete — the
suite constrains the *moved* code and says nothing about the *new* contracts,
which are the part five tickets depend on and the part no existing test can see.

**The tier earned its cost twice.** Round 1 of the premise gate caught a BLOCKER
I had wrong: I claimed `SeriesCardModel` had no spec. It does —
`VOLT_Portal_PRD.md:303-313` (MTG-01a) — and my paraphrase dropped the constraint
that matters, that attendance % is **DATA-01 passthrough, `number | null`, null
renders `—`, never computed in TypeScript**. Freezing `attendancePct: number`
would have handed five tickets a type that cannot represent `—`, forcing GAM-445
to fabricate a `0`; item 3 grades a TS-side metric computation a BLOCKER. Round 2
then caught that §2/§3 and criterion 6 contradicted each other over
`loaders/meetings.ts`, in a way that would have made a worker **silently skip the
one re-point the ticket exists for**.

**Process deviation, declared.** Both gate rounds returned REVISE, and item 19
forbids a worker seeing a packet without DISPATCH. Rather than open a third full
audit — 19a prices a round at ~105-130K opus tokens and calls a third net
negative — I sent the four specified edits back to *the same round-2 checker in
its existing context* to confirm only that they landed. That preserves what item
19 protects (checked by someone who did not write it) at a fraction of a round.
It returned **DISPATCH**, 0 BLOCKER / 0 MAJOR / 0 MINOR. Had it returned anything
else I would have escalated to the owner rather than making a fourth pass.

## Verification

Six gates, run by the orchestrator on the committed SHA with `--require-clean`:

```
GATE RUN — 6213afd on claude/gam-444-split-meetingslist — tree clean

  1 tsc                        exit 0  PASS
  2 vite build                 exit 0  PASS
  3 format:check               exit 0  PASS
  4 eslint                     exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)              exit 0  PASS       108 files / 2623 tests  baseline 2623 (+0)
  6 vitest src/pages/meetings  exit 0  PASS       10 files / 347 tests

VERDICT: PASS — all six gates exit 0
```

Scoped over both packet directories (`src/pages/meetings src/lib/meetings`):
**374 tests / 13 files** against a baseline of 374 / 9 — count identical, four
new files.

**Criterion 2 was checked by name, not by count**, because Stage A legitimately
*adds* test files and a count cannot then detect a deletion. Comparing
`assertionResults[].fullName` sets between the merge-base suite and the split:
**106 baseline names, 106 present, 0 missing, 0 renamed.**

| Check | Baseline | After |
| -- | -- | -- |
| shell line count (criterion 1, ≤200) | 2910 | **193** |
| entry chunk | 688.21 kB / gzip 202.57 kB | 688.21 kB / gzip 202.55 kB |
| `MeetingsList` chunk (still lazy) | 35.60 kB / gzip 10.35 kB | 35.88 kB / gzip 10.31 kB |
| dist assets | 53 | 53 |

The chunk figures matter because §5 deliberately moves two *value* imports across
the page/lib boundary. I had flagged in the packet's least-confident list that
this might make criterion 5 unsatisfiable, citing T605's measured
`+50.47 kB gz, 18 lazy chunks collapsed`. **The gate measured it and I was
wrong**: T605 recorded the *opposite* direction — an eager entry module pulling
lazy pages in — whereas §5 *removes* a `lib → page` value edge and so cannot grow
entry reachability.

Criterion 6 checked mechanically: `git diff --name-only bdfafcf..HEAD` contains
no forbidden path, and the only `src/lib/supabase/**` path touched is
`loaders/meetings.ts`, which §3 explicitly carves out.

Staged commits: `827069b` (types + pure builders + re-points), `269731b` (view
moves + eight stubs), `6213afd` (test split + shell). Existence verified against
the remote per item 21 rather than taken from the worker's report.

## Scope

**Passed, not Partial.** The live route (`router.tsx:153` → the surviving default
export) mounts `CoachMeetingsView` / `StudentMeetingsViewContainer` with the real
`loaders/meetings` seams as defaults, so the user-visible surface reads real data
on the real path. The eight new stub components are inert and imported by nothing
— they ship no user-visible surface at all, so item 27 does not apply to them.

## Follow-ups filed

Both to `Backlog` with `tier/unreviewed`, before this PR was finalized.

- **GAM-466** — the deferred `--color-series-1…8` tokens, *and* the design-contract
  correction this run could not make (below).
- **GAM-470** — `checker-reviewer`'s three MINOR findings: the page's re-export
  surface is 38 names rather than the 40 the packet promised (measured impact
  zero — nothing imports the two missing names from the page path); module doc
  section `#6` is duplicated verbatim in both view files; and the shell's header
  claims prop-level citations it condensed away, dropping repo-wide
  `module doc #N` back-references 84 → 79.

## Known gaps, disclosed

**1. Plan item 6 (`--color-series-1…8`) is not shipped.** The route the issue
named is impossible: `defineTheme.d.ts:201` types the block as
`Partial<Record<TokenName, TokenValue>>` and `:42` makes `TokenName` a *closed*
union, so the name is a hard `tsc` failure —
`error TS2353 ... does not exist in type`, exit 2, reproduced independently in
both gate rounds. Every entry is a real `[light, dark]` hex pair, so there is no
"names only" form either.

A `theme.css` `@layer app` route **is** legal (DES-21 step 4) and measured green
with zero invented hex — so the honest blocker is not the type system but that
**the hues are an open owner decision**
(`auto-mode-decisions.md:4345-4347`), and placeholder values would ship a
user-visible surface on a stub. Filed as GAM-466 with the measurement attached.

**2. The `meetings-design` skill still promises those tokens, and this run could
not fix it.** `.claude/skills/meetings-design/SKILL.md:31` says
`--color-series-1…8` are frozen by GAM-444 in `volt.ts`. That is now false, and
the packet assigned the repair to the orchestrator because Authority Boundaries
forbid workers editing `.claude/skills/**`. **My edit was refused by this run's
permission boundary — `.claude/**` is not writable here.** Leading with the
undeliverable half rather than burying it, per `AGENTS.md` wall 1: the correction
is handed over on **GAM-466**, together with `SKILL.md:156`'s stale
`MeetingsList.tsx:602` citation, whose render site has now moved to
`student/StudentMeetingsView.tsx` anyway.

Anyone merging this should expect that skill row to be wrong until GAM-466 lands.

Linear-Issue: GAM-444
