# GAM-481 — task packet (HEAVY)

**Issue:** GAM-481 — *The meetings-design skill omits MTG-01g's cycle order,
Shift-reverse and roll-call keys, and presents its four a11y rules as the complete
contract.*
**Tier:** HEAVY. **Branch:** `claude/gam-481-meetings-design-cycle-contract`. **PR:** #239 (draft).
**Implementer:** the **orchestrator**, not a worker — `.claude/skills/**` is on the
constitution's Authority Boundaries forbidden list for workers *and* checkers. The
premise gate and the acceptance check are read-only and run as subagents.

## Allowed Files

- `.claude/skills/meetings-design/SKILL.md` — **the only file this task edits.**
- `docs/swarm/active/GAM-481-*.md` — run log, packet, PR body (orchestrator records).

**Explicitly forbidden here:** `docs/swarm/VOLT_Portal_PRD.md` (item 1 — the PRD is
the authority being *restored to*, and is not edited to match the skill),
`docs/swarm/task-ledger.md` (frozen, item 29), `.github/workflows/**` (wall 1 —
checked at packet time, not push time; **not** in scope, so wall 1 does not bite).

## Premise, measured before the packet was written

Every claim below was re-read against the working tree at `0b06c9e7`, not taken from
the issue (item 30c: a recorded citation is historical evidence, not proof of current
state). The issue's four claims **hold**. Two of its citations are off, and one
material requirement is missing from the issue itself.

| Issue's claim | Verified? | Evidence |
| -- | -- | -- |
| Skill omits the cycle order | **yes** | `SKILL.md:113-130` — the whole tap-to-cycle section — contains no ordering of states anywhere |
| Skill omits `Shift`-reverse | **yes** | same section; the string `Shift` does not appear in the file |
| Skill omits DES-17's `1`–`4` roll-call keys | **yes** | `DES-17` and `roll-call` appear nowhere in `SKILL.md` |
| Skill presents the four rules as the complete contract | **yes** | `SKILL.md:116` *"these four are not suggestions"*; `:125-126` *"A chip missing any of the four **is** a finding"* — with no "additive / not exhaustive" qualifier anywhere |
| PRD MTG-01g says all of the above | **yes** | `VOLT_Portal_PRD.md:375-377` *"These four requirements are ADDITIVE and are NOT exhaustive… DES-17, NFR-07 and constitution item 15 apply in full"*; `:377-379` the `1`–`4` keys "which a cycling control must not remove"; `:379-380` "forward-only traversal with no reverse is a keyboard-path failure, and item 15 makes that a BLOCKER"; `:382-383` *"Cycle order is Present → Late → Excused → Absent → (unset)"*, "`Shift`-activation reverses" |
| DES-17 is at `:234` | **yes** | `VOLT_Portal_PRD.md:234` — "1–4 keys set Present/Late/Excused/Absent on the focused row" |

### Verification note — two corrections to the issue

1. **MTG-01g is at `:368-384`, not `:370-384`.** The bullet opens on `:368`
   (*"**MTG-01g Tap-to-cycle attendance chip — authorized, with binding**"*). `:370`
   is mid-sentence. The two lines are not cosmetic: a reader given `:370` starts
   inside the MTG-13 clause and can miss that the whole bullet is one ruling.
2. **The issue omits a fifth thing MTG-01g requires, in the same sentence as the
   cycle order.** `:383-384`: *"**MTG-12's coach/admin-only restriction on `excused`
   is unchanged** — a student-facing surface must skip that stop."* MTG-12 (`:416`)
   is *"Only coaches/admins may set `excused`."* An implementer handed the issue's
   four bullets and no more would write a five-stop cycle on **every** surface, which
   is a permission defect, not a styling one. **This packet fixes it too** — the task
   is "make the skill agree with MTG-01g", and this is part of MTG-01g.

## The change

Replace `SKILL.md:113-130` — the `## Tap-to-cycle attendance chip` section — so that
it carries MTG-01g in full. Nothing outside that section moves. Required content:

1. **The five-stop cycle order**, quoted: `Present → Late → Excused → Absent → (unset)`.
2. **`Shift`-activation reverses**, with the consequence stated: forward-only with no
   reverse is a keyboard-path failure → item 15 BLOCKER.
3. **`Excused` is coach/admin-only (MTG-12); a student-facing surface skips that stop.**
4. **DES-17's `1`–`4` direct-set roll-call keys survive** — a cycling control must not
   remove them; cycling is an addition to that keyboard path, not a replacement.
5. **The four a11y rules re-framed as a floor, not the contract** — carrying
   MTG-01g's own words *"ADDITIVE and are NOT exhaustive"* and *"DES-17, NFR-07 and
   constitution item 15 apply in full"*.
6. **The checker guidance kept in both directions.** The existing sentence protecting
   a compliant chip from a `SegmentedControl` preference is MTG-01g's actual narrow
   holding and must survive verbatim in substance; what changes is that "missing any
   of the four" stops being the *whole* failure set.
7. **The MTG-13 / MTG-11 paragraph (`:128-130`) is preserved verbatim.** It is
   correct and out of scope.
8. **A PRD line citation** on the section, so the next reader can check the skill
   against its authority in one jump — the absence of which is how this drifted.

## Acceptance criteria — each independently checkable

| # | Criterion | How it is measured |
| -- | -- | -- |
| A1 | `Present → Late → Excused → Absent → (unset)` appears in the section | `grep` the literal arrow chain |
| A2 | `Shift`-reverse stated **with** its item-15 BLOCKER consequence | read `:113-…` |
| A3 | `1`–`4` roll-call keys stated as surviving, citing DES-17 `:234` | read |
| A4 | MTG-01g's "additive / NOT exhaustive" qualifier present in MTG-01g's own words, and the four are no longer described as the complete failure set | read; the strings "not suggestions" as a *closed* set and "missing any of the four **is** a finding" as the *only* finding must both be gone |
| A5 | `excused` coach/admin-only skip stated (MTG-12) | read |
| A6 | The `SegmentedControl` protection survives in substance | read |
| A7 | `:128-130` (MTG-13 / MTG-11 last-write-wins) byte-identical | `git diff` shows those lines unchanged |
| A8 | No file other than `SKILL.md` and `docs/swarm/active/GAM-481-*` is touched | `git diff --stat` against merge-base |
| A9 | Every PRD line number written into the skill resolves to the text claimed | `sed -n` each cited line |
| A10 | Six gates green | `gate-run` block pasted into the PR body |

**A9 is the criterion this task is most likely to fail**, and it is the one the issue
itself failed (correction 1 above). Line numbers written into a contract that eleven
tickets read are load-bearing.

## Non-goals

- **Do not edit the PRD.** Item 1 makes it the authority; the skill is the bug.
- **Do not touch any other section of `SKILL.md`.** The schedule-chip, palette,
  overlap and DES-05 sections are being coded against right now by sibling tickets.
- **Do not write code.** No file under `src/**` changes. There is no component to fix
  here — this task fixes the *instructions* a sibling ticket's component will be
  written from.
- **Do not re-file or re-grade GAM-448.** Its gate round is cited as evidence of cost,
  not reopened.

## Least confident decisions (item 19d)

1. **Adding the MTG-12 `excused`-skip rule is in scope.** The issue does not ask for
   it; I am adding it because it sits in the same MTG-01g sentence as the cycle order,
   and shipping the cycle order without it hands implementers a five-stop cycle on a
   surface where one stop is forbidden. **What would make this wrong:** if the owner
   reads GAM-481 as strictly four bullets, this is scope creep into a contract eleven
   tickets read — the more conservative move is a separate row. I judged a permission
   rule severable from its own cycle order to be worse than a slightly wider diff.
2. **The student-facing cycle is `Present → Late → Absent → (unset)`** — i.e. the
   skip removes the stop and closes the gap. **What would make this wrong:** MTG-01g
   says only "must skip that stop" and never spells the reduced order out, and
   MTG-01c makes the student/parent view **read-only**, so on `/meetings` today the
   question may be entirely moot. If it is moot, stating a concrete four-stop order
   invents a contract the PRD does not have. I lean toward stating the *rule* and
   flagging the read-only fact rather than freezing a reduced order.
3. **Rewriting the section wholesale rather than appending to it.** Appending would
   leave "these four are not suggestions" standing three lines above its own
   contradiction. **What would make this wrong:** a wholesale rewrite has a larger
   blast radius on a file with live parallel readers, and risks losing a nuance the
   original phrasing carried that I have not noticed.
4. **Citing PRD line numbers inside the skill at all.** It is what makes A9 checkable
   and gives the next reader a one-jump path to the authority. **What would make this
   wrong:** the PRD is edited more often than the skill, so a line citation is a
   claim with a short half-life — the very failure mode item 30c warns about. The
   alternative is citing only requirement IDs (`MTG-01g`, `DES-17`), which never go
   stale. I want this decision attacked specifically.
5. **Tier HEAVY rather than STANDARD.** Defended on item 26's "an export another
   session builds against". **What would make this wrong:** if that phrase is read
   narrowly as a code export (a module boundary another session imports), a Markdown
   contract is not one, and STANDARD plus an orchestrator replay would have been the
   proportionate call under item 25.
