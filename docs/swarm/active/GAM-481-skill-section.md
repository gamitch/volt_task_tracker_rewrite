# GAM-481 — the undeliverable half, preserved as an applyable artifact

**This run could not write the file it was dispatched to fix, and did not route
around the block.** `AGENTS.md` wall 1 is the precedent: write it, verify it, preserve
it as an applyable artifact under `docs/swarm/active/`, lead the PR body with the
undeliverable half, file the handover. PRs #159/#160 proved that route end to end.

## The block, measured rather than assumed

`Edit` on `.claude/skills/meetings-design/SKILL.md` returns:

> *Claude requested permissions to write to
> `/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite/.claude/skills/meetings-design/SKILL.md`,
> but you haven't granted it yet.*

**Correction, found by the acceptance checker and confirmed here.** An earlier draft of
this artifact said reading `.claude/**` through `Bash` was refused too. **That was
wrong.** `sed -n '113,116p' .claude/skills/meetings-design/SKILL.md` runs normally.
What actually happened is that one *compound* Bash command was refused and the harness
listed each of its parts, several of which touched `.claude` paths — and the run read
that as a path ban rather than a whole-command refusal. The packet's own evidence
contradicted the claim at the time (`GAM-481-packet.md` quotes `grep` output from that
very path) and the run did not notice. What **is** measured: the `Edit` write above is
refused. A `Bash` **write** has not been tested and will not be — that is the channel
wall 1 forbids, and testing it is the same act as using it.

**The block is not one of this repository's own settings.** `.claude/settings.json` contains only `hooks` and no `permissions` block;
`.claude/settings.local.json`, `~/.claude/settings.json` and
`/etc/claude-code/managed-settings.json` carry no deny rule; and the dispatch
workflow's `--allowedTools` (`claude-linear-dispatch.yml:426`) grants `Write` and
`Edit` unrestricted. The guard is the harness's own protection of agent and skill
configuration — the same class of boundary as wall 1: **it stops an autonomous run
from rewriting its own instructions.**

Which is exactly what this task is. The constitution authorises it (AGENTS.md:
*"The primary orchestrator owns those records"*) and the owner authorised it by
promoting GAM-481 to `Todo` — but the authorisation lives in the tracker and the
guard lives in the harness, and a run that reaches for `Bash` to defeat the guard has
made the guard worthless for the case it exists for. So: not attempted. Wall 1's
sentence is *"Do not attempt another channel."*

## The change, exactly

**Replace `.claude/skills/meetings-design/SKILL.md` lines 113–126** — the
`## Tap-to-cycle attendance chip — the a11y contract is binding` heading through the
`**For checkers:** …` paragraph ending `…keyboard-path failures on core flows a
BLOCKER.` — with the block under **New text** below.

**Line 127 (blank) and lines 128–130 are preserved byte-identical** and are *not* part
of the replaced range:

```
MTG-13 already permits editing attendance after completion, so cycling grants no
new authority — and per MTG-11 as superseded, **last write wins**; a coach tap does
not outrank a later QR scan.
```

Nothing else in the file changes. The replaced range is corroborated independently:
`docs/swarm/active/GAM-448-packet.md:443` already cites the tap-to-cycle section as
`SKILL.md:113-126`.

### Old text (verbatim, for the applier to match against)

```markdown
## Tap-to-cycle attendance chip — the a11y contract is binding

Authorized by MTG-01g. It is **not** a free design choice, and these four are not
suggestions:

1. a real `<button>` — not a `div` with a click handler
2. accessible name = **student name + current status** ("Ada L., present")
3. each state change announced via `aria-live`
4. target **≥44px**

**For checkers:** grade against this contract. A compliant chip is **not** a finding
merely because a `SegmentedControl` would have been more conventional — that
preference was considered and overruled. A chip missing any of the four **is** a
finding, and item 15 makes keyboard-path failures on core flows a BLOCKER.
```

### New text

```markdown
## Tap-to-cycle attendance chip — the a11y contract is binding

Authorized by MTG-01g. It is **not** a free design choice — and MTG-01g is **wider
than the four accessibility rules below.**

**It already exists — do not build a second one.**
`src/pages/meetings/coach/AttendanceChips.tsx` is the control, and `SessionRow.tsx`
owns the write path and the roll-call keys; both are frozen by GAM-448. A new chip is
a duplication to raise on your ticket, not a gap to fill.

### The cycle

**`Present → Late → Excused → Absent → (unset)`** — five stops, and
**`Shift`-activation reverses.** A forward-only cycle with no reverse is a
keyboard-path failure, and item 15 makes that a **BLOCKER**.

**`Excused` is coach/admin-only (MTG-12), and MTG-01g leaves that unchanged — a
student-facing surface skips that stop**, so its cycle is
**`Present → Late → Absent → (unset)`**. That is not a variant somebody picked: it is
the five-stop order minus the forbidden stop, and no other reduced order agrees with
both rules. The skip is not conditional on a surface being read-only — a surface that
does not explicitly grant `excused` gets the four-stop cycle. (The `/meetings` student
view happens to be read-only under MTG-01c; that is a separate fact, not the reason.)

### DES-17's roll-call keys survive

`1`–`4` set Present / Late / Excused / Absent directly on the focused row. MTG-01g says
a cycling control **must not remove them** — cycling is an addition to that keyboard
path, never a replacement for it.

Two rules travel with the keys:

- **Exactly one `1`–`4` handler per surface.** A second one bound on the chip itself
  is the duplication to raise. On the coach roster the handler sits on the row rather
  than the chip — `SessionRow.tsx`, whose module doc records the reasoning. Follow that
  as precedent; it is not a DOM shape the PRD mandates, and a surface with no roster
  row is not bound to it.
- **Key `3` carries the same MTG-12 gate as the `excused` cycle stop.** Gating the
  cycle and leaving the key open is a keyboard route straight around the permission
  rule.

### The four a11y rules — a floor, not the whole contract

1. a real `<button>` — not a `div` with a click handler
2. accessible name = **student name + current status** ("Ada L., present")
3. each state change announced via `aria-live`
4. target **≥44px**

MTG-01g's own words: **"These four requirements are ADDITIVE and are NOT exhaustive"**,
and **"DES-17, NFR-07 and constitution item 15 apply in full"**. So satisfying all four
does not finish the job — a chip can pass every one of them and still fail on DES-17
(visible focus, the roll-call keys), on NFR-07 (WCAG 2.1 AA in both modes), or on item
15 (any keyboard-path failure on a core flow).

**For checkers, and it cuts both ways.** Missing any one of the four is a finding on
its own — that has not changed. What has changed is that it is no longer the whole
failure set: grade against MTG-01g and DES-17, not against the four alone, so a chip
that drops the reverse traversal, the roll-call keys, or the MTG-12 gate is also a
finding even with all four satisfied. In the other direction, a
*compliant* chip is **not** a finding merely because a `SegmentedControl` would have
been more conventional — that preference was considered and overruled, and that is the
narrow thing MTG-01g settles.
```

## Why each addition is there — traceable to the PRD, not to taste

| Added | Authority | Also true in shipped code |
| -- | -- | -- |
| Five-stop cycle order | MTG-01g (`PRD:382`) | `AttendanceChips.tsx:130-136`, `FORWARD_CYCLE` |
| `Shift`-reverse, and forward-only ⇒ item 15 BLOCKER | MTG-01g (`:382-383`, `:379-380`) | `AttendanceChips.tsx:232`, `event.shiftKey ? -1 : 1` |
| `Excused` coach/admin-only; student surface skips it; reduced order `Present → Late → Absent → (unset)` | MTG-01g (`:383-384`) + MTG-12 (`:416`) | `AttendanceChips.tsx:142-144`; `canSetExcused = false` is the parameter default at `:224`; pinned by `SessionRow.test.tsx:599` |
| DES-17's `1`–`4` keys survive | MTG-01g (`:378`), DES-17 (`:234`) | `SessionRow.tsx:156-161`, `DIGIT_KEY_TO_STATUS` |
| Key `3` carries the same MTG-12 gate | MTG-12 (`:416`) applied to DES-17's key path | `SessionRow.tsx:250`, `if (status === 'excused' && !canSetExcused) return;`, pinned by `SessionRow.test.tsx:578` |
| The four are a **floor** — "ADDITIVE and are NOT exhaustive" | MTG-01g (`:375-376`) verbatim | — |
| "Do not build a second one" | Anti-duplication; `SKILL.md:21-22`'s own thesis | `AttendanceChips.tsx` is merged at `4bc99293` (GAM-448), an ancestor of the merge-base `0b06c9e7` |

**PRD line numbers appear in this artifact and deliberately do NOT appear in the new
`SKILL.md` text.** The round-1 premise gate reversed my decision to cite them there:
`SKILL.md` carries four line citations today and **two are already stale** — `:156`
points at `MeetingsList.tsx:602` (that file is 193 lines, and no longer imports
`ConsistencyStrip` at all) and `:160` at `MeetingsList.test.tsx:2021` (1160 lines),
both broken by sibling commit `6213afd6` in this same wave. The new text cites
requirement **IDs** only, which never go stale — and that is already this file's
convention everywhere else.

## How to apply, and how to check it

1. Replace lines 113–126 with the **New text** block above (drop the outer ```` ``` ````
   fence).
2. Confirm the eleven acceptance criteria in `docs/swarm/active/GAM-481-packet.md`.
   The mechanical ones:

```bash
F=.claude/skills/meetings-design/SKILL.md
grep -cF 'Present → Late → Excused → Absent → (unset)' "$F"   # A1  -> 1
grep -cF 'Present → Late → Absent → (unset)'          "$F"   # A5  -> 1
grep -cF 'ADDITIVE and are NOT exhaustive'            "$F"   # A4a -> 1
grep -cF 'A chip missing any of the four'             "$F"   # A4b -> 0
grep -cF 'DES-17' "$F"; grep -cF 'MTG-12' "$F"               # A3  -> >=1 each
grep -cF 'SegmentedControl' "$F"                             # A6  -> 1
grep -cF 'AttendanceChips' "$F"                              # A11 -> 1
git diff -U0 -- "$F" | grep -c 'MTG-13 already permits'      # A7  -> 0 (context, not a hunk)
```

3. **A9 — no line numbers.** `git diff -- "$F"` must add no `:<digits>` citation. The
   new text legitimately contains `≥44px`, `item 15`, `1`–`4` and `WCAG 2.1 AA`; none
   of those is a file:line citation.
4. **A10 — gates are regression evidence only, and five of six is the honest count.**
   No gate reads this file: `eslint.config.js:24` ignores `.claude` outright,
   `format:check` globs `src/**/*.{ts,tsx}` plus root files, `tsc` and `vite build`
   see no Markdown, and no test reads `SKILL.md`. Gate 6 (scoped vitest) has **no
   target** on a docs-only change — `gate-run/SKILL.md:100`: *"SKIPPED — gate 6 had no
   defensible scope. Five gates passed. Say five."*
