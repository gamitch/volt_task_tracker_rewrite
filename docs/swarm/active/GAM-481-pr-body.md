Closes GAM-481

## The undeliverable half, first

**This run could not write the file it was dispatched to fix, and deliberately did not
route around the block.** The change is complete, gated and preserved as an applyable
artifact — `docs/swarm/active/GAM-481-skill-section.md` — for an owner or a scoped
session to apply as a normal PR, exactly the route `AGENTS.md` wall 1 prescribes and
PRs #159/#160 proved end to end.

`Edit` on `.claude/skills/meetings-design/SKILL.md` returns *"Claude requested
permissions to write to … but you haven't granted it yet."* Reading `.claude/**`
through `Bash` is refused the same way; the `Read` tool is not.

**It is not one of this repository's settings.** `.claude/settings.json` contains only
`hooks` and no `permissions` block; `.claude/settings.local.json`,
`~/.claude/settings.json` and `/etc/claude-code/managed-settings.json` carry no deny
rule; and `claude-linear-dispatch.yml:426` grants `Write` and `Edit` unrestricted. The
guard is the harness's own protection of agent and skill configuration — the same class
of boundary as wall 1: **it stops an autonomous run from rewriting its own
instructions.** Which is precisely what this task is. The constitution authorises the
edit (*"The primary orchestrator owns those records"*) and the owner authorised it by
promoting GAM-481 to `Todo` — but that authorisation lives in the tracker and the guard
lives in the harness, and a run that reaches for `Bash` to defeat it has made the guard
worthless for the one case it exists for. Wall 1's sentence is *"Do not attempt another
channel."* It was not attempted.

**Handover:** filed to `Backlog` with `tier/unreviewed` per item 20 — the row id is recorded in `docs/swarm/active/GAM-481-run-log.md` (filed after this body was pushed, so the number is in the log rather than hard-coded here).

## What changed

`.claude/skills/meetings-design/SKILL.md:113-126` — the tap-to-cycle attendance chip
section, the binding contract eleven parallel `meetings-redesign` tickets read before
writing code — is rewritten to carry MTG-01g in full instead of a subset of it. Added:
the five-stop cycle order, `Shift`-reverse with its item-15 BLOCKER consequence,
MTG-12's coach/admin-only `excused` skip **and the reduced order it entails**, DES-17's
`1`–`4` roll-call keys with the MTG-12 gate on key `3`, MTG-01g's own "ADDITIVE and are
NOT exhaustive" qualifier re-framing the four a11y rules as a floor, and a pointer to
the already-merged implementation so no sibling builds a second chip. Lines 128-130 are
preserved byte-identical. Nothing else in the file moves; no code changes.

## What the issue got wrong

Both corrections were verified independently by the premise gate, and one of them by
the shipped code.

1. **MTG-01g spans `VOLT_Portal_PRD.md:368-384`, not the issue's `:370-384`.** `:370` is
   mid-sentence. Corroborated independently of this run: `AttendanceChips.tsx:3-4`
   already cites `:368-384`.
2. **The issue omits a fifth MTG-01g requirement, in the same sentence as the cycle
   order it does quote** — `:383-384`, *"MTG-12's coach/admin-only restriction on
   `excused` is unchanged — a student-facing surface must skip that stop"*, with MTG-12
   at `:416`. An implementer handed the issue's four bullets writes a five-stop cycle on
   every surface: a permission defect, not a styling one. Fixed here.

## What *this run* got wrong, and the gate caught

Recorded because the corrections are the evidence the gate ran.

- **Round 1 measured two Markdown files and zero source files**, on a task about the
  instruction set for source files. `src/pages/meetings/coach/AttendanceChips.tsx` is
  **merged on `main`** (`4bc99293`, GAM-448) and already implements MTG-01g in full. My
  non-goal *"there is no component to fix here… a sibling ticket's component **will be**
  written from"* was flatly false.
- **I hedged the student-facing reduced order as possibly inventing a contract.** It
  invents nothing — it is the five-stop order minus the forbidden stop, the unique
  reading consistent with both PRD sentences, and it is shipped
  (`AttendanceChips.tsx:142-144`) and green-test-pinned (`SessionRow.test.tsx:599`).
- **I prescribed writing PRD line numbers into `SKILL.md`.** Reversed by measurement:
  the file carries four line citations and **two are already stale** — `:156` points at
  `MeetingsList.tsx:602` (193 lines, and it no longer imports `ConsistencyStrip` at all)
  and `:160` at `MeetingsList.test.tsx:2021` (1160 lines), both broken by sibling commit
  `6213afd6` in this same wave. The new text cites requirement **IDs** only.
- **I missed the intersection of my own two rules.** MTG-12 gates *every* path to
  `excused`, so DES-17's key `3` is gated too — a keyboard route straight around the
  permission rule I had just added. The shipped code already gets this right
  (`SessionRow.tsx:250`); my packet did not.
- **Round 2 told me "the keys live on the row, not the chip" was wrong as law** — that
  is a DOM-placement ruling for one component, not a PRD requirement. The new text
  states the portable rule (exactly one handler per surface; key `3` gated) and cites
  GAM-448's placement as precedent.

## Tier, stated and defended

**HEAVY** (`tier/unreviewed` → `tier/heavy` at claim time, item 28d).

Item 26's trigger *"an export another session builds against"* applies literally:
`SKILL.md` is the contract eleven parallel tickets read before writing code, and a
wrong edit to it is caught by no test and no gate — it silently mis-instructs every
sibling. The cost is measured: GAM-448's premise gate returned REVISE with two BLOCKERs
traceable to this exact gap. The premise gate added a stronger argument than mine —
**no other tier is structurally available.** FAST requires *"a named mutation exists
that turns a test red"*, impossible for Markdown; STANDARD says *"worker implements"*,
and `constitution.md:26,32` forbids a worker touching `.claude/skills/`. HEAVY is the
only tier whose declared implementer can legally be the orchestrator with a gate
attached. Item 26's tiebreak points the same way.

**Declared process deviation** (at claim time, not after the fact): HEAVY ran in its
orchestrator-implements form — `checker-premise` gated the packet, the orchestrator was
to make the edit because no worker may, `checker-reviewer` grades it. Round 2 judged
this *"correct and correctly scoped… not a way to skip a check."*

**Premise gate, two rounds (item 19a's cap):** round 1 `REVISE` (2 MAJOR, 5 MINOR,
3 NIT); round 2 `DISPATCH` (4 MINOR, 5 NIT) — *"Round 1's two MAJORs and all five
MINORs are substantively fixed, not merely acknowledged."* Both rounds `opus`, both
dispatched with `run_in_background: false` and waited on. Full findings and verdicts in
`docs/swarm/active/GAM-481-run-log.md`.

## Verification

Gate block in `docs/swarm/active/GAM-481-run-log.md` with exit codes.

**Five gates, not six, and the honest count matters here.** Gate 6 (scoped vitest) has
**no target** — this branch changes only Markdown under `docs/swarm/active/`.
`gate-run/SKILL.md:100`: *"SKIPPED — gate 6 had no defensible scope. Five gates passed.
Say five."*

**And the five that ran verify nothing about the change.** No gate reads this file:
`eslint.config.js:24` ignores `.claude` outright, `format:check` globs
`src/**/*.{ts,tsx}` plus root files, `tsc` and `vite build` see no Markdown, and no test
reads `SKILL.md`. They are regression evidence — proof nothing else moved — and are
reported as that rather than as verification of the edit. The real verification is the
eleven acceptance criteria in `docs/swarm/active/GAM-481-packet.md`, each with a
runnable command in the artifact.

**No mutation table.** Item 26's FAST tier requires a named mutation that turns a test
red; there is no such mutation for a Markdown contract, which is one of the reasons
this row is HEAVY rather than FAST. Claiming one would be inventing evidence.

## Scope — item 27

No user-visible surface ships in this PR, so item 27's fixture test does not apply. The
surface this contract *describes* — the tap-to-cycle chip — is already merged and reads
real data through `SessionRow.tsx`'s guarded write path; this PR changes no code.

**This closes GAM-481 as the work being done, not as the file being changed.** The
`SKILL.md` edit itself lands when GAM-485 applies the artifact.

## Follow-ups filed

- **Apply the artifact** — `docs/swarm/active/GAM-481-skill-section.md` to
  `.claude/skills/meetings-design/SKILL.md`. `Backlog`, `tier/unreviewed`, per item 20. Row id in the run log.

## Known gaps, disclosed

- **The edit is not in this diff.** Everything above describes a change delivered as an
  artifact. If you read only the diff you will see records and no `SKILL.md`.
- **`SKILL.md:156` and `:160` are stale and are left stale.** GAM-444's run log folds in
  only `:156`; **`:160` appears to be unowned.** Out of scope here (GAM-466 territory),
  cited as the evidence base for citing IDs rather than line numbers, and flagged rather
  than left implicitly covered — leaving a stale citation implicitly owned is how it
  outlives three tickets.
- **No `checker-accessibility` round.** This PR ships no UI. The a11y contract it
  documents is graded on the tickets that implement it.

Linear-Issue: GAM-481
