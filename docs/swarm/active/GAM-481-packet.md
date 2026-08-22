# GAM-481 — task packet (HEAVY) — **round 2**

**Issue:** GAM-481 — *The meetings-design skill omits MTG-01g's cycle order,
Shift-reverse and roll-call keys, and presents its four a11y rules as the complete
contract.*
**Tier:** HEAVY. **Branch:** `claude/gam-481-meetings-design-cycle-contract`. **PR:** #239 (draft).
**Implementer:** the **orchestrator**, not a worker — `.claude/skills/**` is on the
constitution's Authority Boundaries forbidden list (`constitution.md:26,32`, which
names *workers*; the round-1 gate corrected me for writing "and checkers"). The gate
and the acceptance check are read-only subagents.

> **Round-1 premise gate returned `REVISE`** (MAJOR ×2, MINOR ×5, NIT ×3, no BLOCKER).
> The premise itself was **CONFIRMED** and both of my corrections to the issue were
> upheld. What it broke was my *measurement* — round 1 covered two Markdown files and
> zero source files, on a task whose subject is the instruction set for source files.
> Every round-1 revision is applied below and marked **[R1]**. I re-verified each one
> against the tree myself rather than taking the subagent's word (`sed`/`wc`/`grep`
> outputs quoted inline).

## Allowed Files

- `.claude/skills/meetings-design/SKILL.md` — **the only file this task edits.**
- `docs/swarm/active/GAM-481-*.md` — run log, packet, PR body (orchestrator records).

**Explicitly forbidden here:** `docs/swarm/VOLT_Portal_PRD.md` (item 1 — the PRD is the
authority being *restored to*, never edited to match the skill), `src/**` (this task
writes no code — see the corrected non-goal below), `docs/swarm/task-ledger.md`
(frozen, item 29), `.github/workflows/**` (wall 1, checked at packet time and **not**
in scope, so wall 1 does not bite).

## Premise, measured — Markdown **and** source

### The issue's four claims

| Issue's claim | Verified? | Evidence |
| -- | -- | -- |
| Skill omits the cycle order | **yes** | `SKILL.md:113-130` — the whole section — contains no ordering of states; `grep -n '→' SKILL.md` returns only `:149-150` (the DES-21 escalation chain) |
| Skill omits `Shift`-reverse | **yes** | `grep -n 'Shift' .claude/skills/meetings-design/SKILL.md` → **no match** |
| Skill omits DES-17's `1`–`4` roll-call keys | **yes** | `grep` for `DES-17`, `roll-call`, `MTG-12`, `NFR-07` in `SKILL.md` → **all empty** |
| Skill presents the four rules as the complete contract | **yes** | `SKILL.md:115-116` *"these four are not suggestions"* **[R1: `:115-116`, not `:116`]**; `:125-126` *"A chip missing any of the four **is** a finding"*, with no additive/non-exhaustive qualifier anywhere in the file |

### The PRD authority

| Claim | Verified? | Evidence |
| -- | -- | -- |
| MTG-01g spans `:368-384` | **yes** | `:368` opens the bullet; `:370` is mid-sentence. **The issue's `:370-384` is wrong.** Corroborated independently of me: `AttendanceChips.tsx:2-3` already cites `:368-384` |
| *"These four requirements are ADDITIVE and are NOT exhaustive… DES-17, NFR-07 and constitution item 15 apply in full"* | **yes** | `:375-376` **[R1: `:375-376`, not `:375-377`]** |
| *"which a cycling control must not remove"* (the `1`–`4` keys) | **yes** | `:378` **[R1: `:378`, not `:377-379`]** |
| *"forward-only traversal with no reverse is a keyboard-path failure, and item 15 makes that a BLOCKER"* | **yes** | `:379-380` |
| *"Cycle order is Present → Late → Excused → Absent → (unset)"*, *"`Shift`-activation reverses"* | **yes** | `:382-383` |
| *"MTG-12's coach/admin-only restriction on `excused` is unchanged — a student-facing surface must skip that stop"* | **yes** | `:383-384`. MTG-12 itself at `:416`: *"Only coaches/admins may set `excused`."* **The issue omits this entirely.** |
| DES-17 at `:234` | **yes** | *"1–4 keys set Present/Late/Excused/Absent on the focused row"* |

### **[R1 — M1] The shipped state, which round 1 omitted**

MTG-01g's control is **not hypothetical and not future work. It is merged on `main`.**

| Fact | Evidence |
| -- | -- |
| The chip exists and is merged | `src/pages/meetings/coach/AttendanceChips.tsx`, `git log --oneline main -1 --` → `4bc99293 GAM-448: month-tab SchedulePanel with in-place attendance editing` — an ancestor of the merge-base `0b06c9e7` |
| Five-stop cycle | `AttendanceChips.tsx:59-66` — `FORWARD_CYCLE = ['present','late','excused','absent',null]` |
| `Shift`-reverse | `AttendanceChips.tsx:230` — `const direction: 1 | -1 = event.shiftKey ? -1 : 1;` |
| MTG-12 skip, and the **reduced order** | `AttendanceChips.tsx:142-144` — `buildEffectiveCycle()` returns `FORWARD_CYCLE.filter((stop) => stop !== 'excused')` when `canSetExcused` is false. `canSetExcused = false` is the **parameter default** (`:224`), so it is the behaviour of every caller that does not opt in |
| DES-17 keys live on the **row**, not the chip | `SessionRow.tsx:155-161` — `DIGIT_KEY_TO_STATUS`, on the row's own `onKeyDown`. `AttendanceChips.tsx:60-69` records *"this file adds no `onKeyDown` of its own anywhere"*, settled in GAM-448's round-2 gate against `LiveConsole.tsx`'s shipped roving-tabindex shape |
| **Key `3` is MTG-12-gated too** | `SessionRow.tsx:249-250` — `if (status === 'excused' && !canSetExcused) return; // MTG-12 defence in depth`, on *"the single guarded write path both a chip cycle tap AND a DES-17 digit key funnel through"* |
| Both are green-test-pinned | `SessionRow.test.tsx:578` *"key 3 (Excused) emits no write when canSetExcused is false (the default)"*; `:598` *"the cycle's forward stops skip Excused entirely: Late -> Absent directly"* |

**Consequence, and it is the point of round 2:** the skill must be written to agree with
**merged code**, not only with the PRD. Restoring MTG-01g's text while leaving the
skill silent about a control that already exists is how a sibling ticket builds a
second one — the exact failure `SKILL.md:19-22` exists to prevent (*"Copying is how
`formatWeekdayDate` ended up existing twice"*).

### Verification note — three corrections carried forward

1. **MTG-01g is `:368-384`, not the issue's `:370-384`.**
2. **The issue omits MTG-12's `excused` skip** (`:383-384`), which sits in the *same
   sentence* as the cycle order it does quote. An implementer given the issue's four
   bullets writes a five-stop cycle on every surface — a permission defect, not a
   styling one.
3. **[R1] I in turn omitted the intersection of those two rules.** MTG-12 gates *every*
   path to `excused`, so DES-17's key **`3`** is gated as well. Round 1 of this packet
   said the keys "survive" and said nothing about key 3 — by my own reasoning in
   correction 2, a keyboard route straight to the defect correction 2 exists to
   prevent. The shipped code already gets this right (`SessionRow.tsx:249-250`); the
   packet did not.

## The change

Replace **`SKILL.md:113-126`** — the `## Tap-to-cycle attendance chip` heading through
the "For checkers" paragraph — so it carries MTG-01g in full. **`:128-130` (the
MTG-13 / MTG-11 last-write-wins paragraph) is preserved verbatim and is not part of
the replaced range** **[R1: round 1 said "replace `:113-130`" and then required
`:128-130` preserved; the replaced range is `:113-126`]**. Nothing outside the section
moves.

Required content:

1. **The five-stop cycle order**, quoted: `Present → Late → Excused → Absent → (unset)`.
2. **`Shift`-activation reverses**, with the consequence stated: forward-only with no
   reverse is a keyboard-path failure → item 15 **BLOCKER**.
3. **`Excused` is coach/admin-only (MTG-12), and a student-facing surface skips that
   stop — so the reduced order is `Present → Late → Absent → (unset)`. [R1 — M2]**
   Round 1 hedged this as possibly inventing a contract the PRD lacks. It invents
   nothing: it is shipped (`AttendanceChips.tsx:142-144`) and green-test-pinned
   (`SessionRow.test.tsx:598`). State it concretely. A parenthetical may note that
   `/meetings`' student view is read-only (MTG-01c), but that does **not** make the
   rule moot — `canSetExcused` defaults to `false`, so the reduced cycle is what an
   un-opted-in caller gets on **any** surface.
4. **DES-17's `1`–`4` direct-set roll-call keys survive** — MTG-01g says a cycling
   control must not remove them; cycling is an addition to that keyboard path, not a
   replacement. **[R1] And say where they live and how they are gated:** on the roster
   **row**, not on the chip (`SessionRow.tsx`, settled in GAM-448's round-2 gate — a
   sibling binding a second `onKeyDown` on the chip is the failure this prevents), and
   **key `3` is subject to the same MTG-12 gate as the cycle stop.**
5. **The four a11y rules re-framed as a floor, not the contract** — carrying MTG-01g's
   own words *"ADDITIVE and are NOT exhaustive"* and *"DES-17, NFR-07 and constitution
   item 15 apply in full"*.
6. **The checker guidance kept in both directions.** MTG-01g's actual narrow holding —
   a compliant chip is not a finding merely for being an unconventional control /
   a `SegmentedControl` preference — survives. What changes is that "missing any of
   the four" stops being the *whole* failure set.
7. **`:128-130` preserved byte-identical.** Correct, and out of scope.
8. **[R1 — dropped and replaced.]** Round 1 required a PRD **line** citation on the
   section, justified as *"the absence of which is how this drifted"*. **Both halves
   were wrong.** The justification is false — `SKILL.md:115` already said *"Authorized
   by MTG-01g"* and `:13-15` already names the authority blockquote; the pointer
   existed, the *content* was narrow. And the prescription is reversed by measurement:
   `SKILL.md` carries four line citations and **two are stale today** —

   ```
   $ wc -l src/pages/meetings/MeetingsList.tsx src/pages/meetings/MeetingsList.test.tsx
     193 src/pages/meetings/MeetingsList.tsx      # SKILL.md:156 cites :602
    1160 src/pages/meetings/MeetingsList.test.tsx # SKILL.md:160 cites :2021
   ```

   both broken by sibling `6213afd6` in this same wave, both still open on GAM-466.
   **So: cite requirement IDs only** (`MTG-01g`, `DES-17`, `MTG-12`, `NFR-07`,
   item 15), which never go stale — and which is already this file's own convention
   everywhere else. **No PRD line numbers enter `SKILL.md`.**
9. **[R1 — new] Name the shipped implementation so no sibling builds a second one.**
   State inside the section that the control already exists and is merged —
   `src/pages/meetings/coach/AttendanceChips.tsx` + `SessionRow.tsx` (GAM-448) — and
   that a new chip is a duplication to raise, not a gap to fill.

   *Scope note, because this touches the round-1 Non-goals fence.* The gate's cheaper
   path 3 suggested adding a row to the frozen "Don't re-derive these — import them"
   table at `:24-31`. **Declined, deliberately:** that table freezes shared `src/lib/**`
   formatters and types that six tickets import, and a coach-page component is not
   that shape — a student-view ticket will not import it. Putting the pointer *inside
   the section being rewritten* achieves the same anti-duplication goal with the blast
   radius kept to one section, on a file with live parallel readers. A **path** is
   cited rather than a line number, per requirement 8. Recorded here rather than
   silently ignored.

### The corrected non-goal **[R1 — M1]**

Round 1 wrote: *"There is no component to fix here — this task fixes the instructions
a sibling ticket's component **will be** written from."* **That is false**, and it is
the sentence that let round 1 skip the source tree. The component is merged. The
non-goal is now narrower and true: **this task writes no code** — no file under
`src/**` changes, because the shipped implementation already satisfies MTG-01g and
needs no fix. What is broken is the *instruction set*, and only that is edited.

## Other non-goals

- **Do not edit the PRD.** Item 1 makes it the authority; the skill is the bug.
- **Do not touch any other section of `SKILL.md`.** Schedule chips, palette, overlap
  and DES-05 are being coded against right now by sibling tickets.
- **Do not fix `SKILL.md:156` / `:160`.** They are stale (measured above) but GAM-466
  owns them. They are cited here as *evidence* for requirement 8, not adopted as work.
- **Do not re-file or re-grade GAM-448.** Its gate round is cited as evidence of cost.

## Acceptance criteria **[R1: A3, A4, A6, A7, A9, A10 all restated]**

| # | Criterion | How it is measured |
| -- | -- | -- |
| A1 | `Present → Late → Excused → Absent → (unset)` appears in the section | `grep -F 'Present → Late → Excused → Absent → (unset)'` returns a match |
| A2 | `Shift`-reverse stated **with** its item-15 BLOCKER consequence | `grep -F 'Shift'` matches; read the sentence for the consequence |
| A3 | `1`–`4` keys stated as surviving, **on the row**, with key `3` MTG-12-gated, citing **DES-17 by ID** | `grep -F 'DES-17'` and `grep -F 'MTG-12'` both match; read for placement + key-3 gate. **No PRD line number appears** |
| A4 | The four are re-framed as a floor | **mechanical:** `grep -F 'A chip missing any of the four'` returns **no match**, **and** `grep -F 'ADDITIVE and are NOT exhaustive'` returns a match |
| A5 | `excused` coach/admin-only skip stated, **with the reduced order** | `grep -F 'Present → Late → Absent → (unset)'` returns a match |
| A6 | The `SegmentedControl` protection survives | **mechanical:** the section contains a sentence stating a compliant chip is not a finding merely for being an unconventional control / a `SegmentedControl` preference — `grep -F 'SegmentedControl'` matches and the sentence is read |
| A7 | The MTG-13 / MTG-11 last-write-wins paragraph is byte-identical | `git diff` shows those three lines as **context, not a changed hunk**. Their line numbers **will move** — do not measure this by `sed -n '128,130p'` |
| A8 | No file other than `SKILL.md` and `docs/swarm/active/GAM-481-*` is touched | `git diff --stat` against the merge-base |
| A9 | **No PRD or source *line number* is written into `SKILL.md` by this change** | `git diff` on the section: no `:<digits>` citation added. (Round 1's A9 required the opposite and is reversed) |
| A10 | Six gates green — **regression evidence only, and labelled as such** | `gate-run` block pasted into the PR body. **This verifies nothing about this change:** no gate reads `.md`, `eslint.config.js:24` ignores `.claude` outright, `format:check` globs `src/**/*.{ts,tsx}` and root files only, and gate 6 (scoped vitest) **has no target** on a docs-only change. Run it to prove nothing else regressed; do not report it as verification of the edit |
| A11 | **[R1 — new]** The shipped implementation is named as the thing not to duplicate | `grep -F 'AttendanceChips'` returns a match in the section |

**The criterion this task is most likely to fail is A9**, and round 1 failed its own
predecessor of it — it prescribed exactly the stale-citation pattern that has now
broken twice in this file and once in `.claude/skills/gate-run/SKILL.md`.

## Least confident decisions (item 19d) — round 2

Round 1's five: **LCD-1 SOUND**, **LCD-2 WRONG** (falsified by shipped code — folded
into requirement 3), **LCD-3 SOUND**, **LCD-4 WRONG** (falsified by 2/4 stale citations
in this same file — folded into requirement 8), **LCD-5 SOUND** (and the gate supplied
a stronger defence than mine: no other tier is *structurally* available — FAST needs a
mutation that turns a test red, impossible for Markdown; STANDARD's implementer is a
worker, who may not touch `.claude/skills/`). The three that remain open:

1. **Declining the import-table row (requirement 9's scope note).** I put the
   anti-duplication pointer inside the rewritten section instead of adding
   `AttendanceChips` to the frozen table at `:24-31`. **What would make this wrong:**
   the table is where a sibling *looks* for "already exists, don't rebuild"; a pointer
   buried in a prose section may not be read by someone who never opens that section
   because they think their chip is a different chip. If duplication is the real risk,
   the table is the higher-traffic location and I have optimised for blast radius over
   discoverability.
2. **Stating the reduced order `Present → Late → Absent → (unset)` as contract.** The
   gate showed it is shipped and pinned, which answers "is it real". **What would make
   this wrong:** the PRD says only *"must skip that stop"* and never spells the reduced
   order out, so I am promoting an implementation detail of GAM-448 into a contract
   eleven tickets must follow. If a future surface needs a different reduced order, the
   skill will be the thing forbidding it — and the skill is not the authority.
3. **Writing "the DES-17 keys live on the row, not the chip" into the contract.** It
   came from GAM-448's round-2 gate and is shipped. **What would make this wrong:**
   that is a *placement* ruling for one component's DOM shape, not a PRD requirement —
   DES-17 says only "on the focused row" in the roll-call sense. Freezing a DOM
   placement in a design contract may over-constrain a sibling whose surface has no
   roster row at all. The safer form is to state the *rule* (exactly one handler, and
   it is gated) and leave placement as GAM-448's precedent rather than law.
