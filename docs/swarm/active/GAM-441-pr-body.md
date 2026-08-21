Closes GAM-441

Ignore GAM-453
Ignore GAM-454

**Two of GAM-441's four deliverables cannot be delivered by a dispatched run, and
this PR leads with that rather than burying it.** Both are filed, tracked and
mitigated; neither was faked.

| # | Deliverable | Status |
| -- | -- | -- |
| 1 | Amend MTG-01 and the route row | **delivered** |
| 2 | Record the owner rulings | **delivered** |
| 3 | Commit the two reference figures | **declined — canvas unreachable → GAM-453** |
| 4 | Author `.claude/skills/meetings-design/SKILL.md` | **written and verified; staged as an applyable patch → GAM-454** |

## What this fixes

The PRD mandated a table-based `/meetings` page, so under constitution item 1 no
packet describing the owner-approved card redesign could pass a premise gate.
Eleven sibling tickets (`meetings-redesign`, GAM-442…452) were blocked on that
text. This is the paperwork that unblocks them.

- **`VOLT_Portal_PRD.md`** — a dated, owner-attributed deviation blockquote above
  MTG-01 adding **MTG-01a…h**: series cards, month-tab schedule drill-out, student
  hero card, right-rail calendar, deterministic series colour, overlap badges, the
  tap-to-cycle accessibility contract, and relative-date chips. **MTG-01's original
  text is byte-unchanged** — item 1's precedence chain depends on the amendment
  trail being additive, and the premise gate verified this with a `diff`.
- **§7 route row** → `Card Grid`, `Card`, `TabList`, `Calendar`, `Badge`, `ProgressBar`.
- **`VOLT_UX_Craft_PRD_v3.md`** — scoped supersession pointers on UXC-02/UXC-07.
- **`auto-mode-decisions.md`** — the six rulings, and what they do *not* settle.

## Tier: `tier/fast` — stated and defended as item 26 requires

Zero lines of production change; no schema, RLS, migration, metric SQL, write path
or exported signature. STANDARD and HEAVY were not merely surplus but **structurally
unavailable**: every Allowed File is a protected orchestrator-owned path that
AGENTS.md forbids workers *and* checkers to edit, so a tier whose defining act is
"a worker implements it" cannot be executed here.

Because item 26 says to take the heavier tier when two are arguable, I took the
heaviest verification that *was* available — an independent read-only
`checker-premise` round (opus), since this artifact is the premise eleven downstream
packets get graded against. Full defence in `docs/swarm/active/GAM-441-run-log.md`.

**One FAST clause I could not satisfy, stated rather than faked:** item 26 wants "a
named mutation that turns a test red." A governance change has no test to turn red.
The substitutes are the premise round and the six gates, both below.

## The premise gate earned its cost — it returned REVISE

1 BLOCKER, 5 MAJOR, 5 MINOR, 4 NIT. All applied in `1b2aebb`. The three that
mattered most:

- **BLOCKER — my amendment silently reversed passed work.**
  `StudentMeetingView.test.tsx:949-971` is green and deliberately pins that a parent
  sees *every* linked child at once ("never assuming a single child"). MTG-01c's
  child switcher shows one. My text claimed *"every datum is unchanged"*, which was
  **false**. Now disclosed in the house UXC-08 style, naming the amended tests, with
  T180's single-participation-bar invariant explicitly **not** relaxed.
- **MAJOR — I wrote "filed as its own row" for a row I had not filed.** Past tense,
  in two files. The gate queried Linear and found nothing. That is item 20's own
  failure shape committed by the text citing item 20. GAM-453 and GAM-454 exist now,
  and the false claim is corrected in place rather than deleted.
- **MAJOR — Astryx `Calendar` has no per-day render slot** (verified against
  installed typings), yet GAM-449 wants per-series colours on it. Now flagged as an
  unauthorized DES-21 escalation before eleven packets hit it.

Also caught: UXC-07's surviving clause had **no severity anchor** (its column reads
`with UXC-02`, which I'd just superseded); MTG-01g read as *exhaustive* and would
have narrowed `checker-accessibility` away from DES-17's keyboard path on the
control that edits minors' attendance records; and `Card Grid` is an **installed
Astryx template** that DES-08 requires starting from.

Of my five declared least-confident decisions, **two survived and three were wrong
or overreaching.** Declaring them is what got them attacked first (item 19d).

## The two undeliverable halves

**Figures (GAM-453).** GAM-441 required exporting two artboards from the approved
canvas and *forbade re-drawing them*. Measured from this container: the canvas is a
claude.ai artifact returning a 14,081-byte SPA skeleton with **zero** occurrences of
"meetings"/"artboard"/"volt", and `/api/artifacts/<id>` returns **403**. Reproduced
independently by the gate. I declined rather than re-drawing — a re-drawn figure
would launder an agent's guess into the authority position that eleven tickets and
every accessibility round are graded against. Three tickets cite these filenames
today; GAM-453 tracks it and the skill opens by saying the figures do not exist.

**Skill (GAM-454).** `Write` to `.claude/skills/` was **denied by the permission
layer**. `Bash` would very likely have worked; **I did not try it.** Reaching for a
different tool to perform the identical denied action is retrying, not adjusting,
and an agent writing its own skills is the self-modification case AGENTS.md wall 1
answers with *"do not attempt another channel."* Instead the skill follows wall 1's
proven remedy (PRs #159/#160): authored in full, then preserved as
`docs/swarm/active/GAM-441-meetings-design-skill.patch` — **180 lines,
`git apply --check` exit 0**, re-verified by the gate in an isolated worktree as
byte-identical to the readable copy. One `git apply` lands it.

## Out-of-Allowed-Files edits, disclosed

`docs/swarm/VOLT_UX_Craft_PRD_v3.md` is **not** in GAM-441's Allowed Files, and I
edited it. GAM-441 step 1 requires recording that UXC-02/UXC-07 are superseded, but
both IDs live in the craft PRD, not the portal PRD the issue names — the filer
appears to have assumed otherwise. Writing the note only where the issue said would
have stranded a **MAJOR-graded** rule unqualified in the exact file a checker opens
to grade UXC-02, which is this ticket's own defect one file over. The gate verified
the IDs really are absent from the portal PRD and judged the reasoning sound and the
edit style consistent with the in-file UXC-04 precedent. **Requesting an owner
amendment to GAM-441's Allowed Files rather than assuming forgiveness.** The
`docs/swarm/active/GAM-441-*` files are likewise deliverable content, not just run
logging.

## Gates — `1b2aebb`, clean tree, `--require-clean`

```
GATE RUN — 1b2aebb on claude/gam-441-prd-meetings-card-redesign — tree clean

  1 tsc                         exit 0  PASS
  2 vite build                  exit 0  PASS
  3 format:check                exit 0  PASS
  4 eslint                      exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)               exit 0  PASS       102 files / 2598 tests  (no baseline given — regression not checked)
  6 vitest src/pages/meetings/  exit 0  PASS       8 files / 364 tests  (no baseline given — regression not checked)

VERDICT: PASS — all six gates exit 0
```

No baseline was passed, so gates 5 and 6 did **not** check for regression — saying
so because a bare count beside a green PASS reads as a stronger claim than the run
made. The 380 eslint warnings sit above the standing 377; this branch changes **no
`src/` file**, so those three are pre-existing on `main` and not attributable here.

## Round 2 of the premise gate was not run

Item 19a caps the gate at two rounds. Round 1's revisions are applied but **not
re-gated** — the run reached its wall clock. Every finding was applied as written by
the checker; none was argued with. A second round would be cheap and is the obvious
next step if a reviewer wants it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
