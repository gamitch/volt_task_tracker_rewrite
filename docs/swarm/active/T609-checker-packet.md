# T609 checker packet — hide the dead Notes field in edit mode, round 1

Render PASS / FAIL / REVISE with full evidence, exactly as you normally would
— but stop there. **Do not update `docs/swarm/task-ledger.md`,
`docs/swarm/verification-log.md`, `docs/swarm/state-summary.md`, or any other
shared doc, and do not treat T609 as closed.** The foreman records your
verdict and any escalation.

**Assigned:** `checker-reviewer`. **Attempt:** 1 (first worker run, first
check — no prior verification-log entry for this row).

## 0. Why this check is the only independent gate this row gets

This packet's premise (`docs/swarm/active/T609-worker-packet.md` §0) skipped
`checker-premise` under item 19b, on the argument that this rolls out an
idiom already shipped in the same file (Description's `isEditMode &&` gate)
inverted for Notes. **That means nothing upstream of you has verified this
row's premise or its build.** Treat this round as the sole check before
merge, not as a second opinion on something already validated.

**Do not report the following as a finding — it is the intended design,
carved out deliberately:** notes still are not persisted when saving an
edited meeting. That is **T605** (HEAVY, currently in premise-gate revision),
a separate row. This task's whole scope is *hiding* the input that already
didn't save, not making it save.

## 1. Dispatch context — anchor every diff to the commit, never the working tree

**The work is committed at `b0f94f6`, parent `47966ef`.** The working tree is
clean (this commit is HEAD), so a bare `git diff` or `git diff HEAD` shows
**nothing** and would make every scope criterion below pass vacuously — this
project has been bitten by exactly that before. Anchor every command to
`git diff 47966ef b0f94f6`, never a bare diff.

```
git log --oneline 47966ef..b0f94f6
git rev-parse HEAD                 # must print b0f94f6's full SHA
git status --short                 # must be empty
git show --stat b0f94f6
```

**Expected diffstat — exactly three paths, nothing else:**
```
docs/swarm/active/T609-worker-output.md            (new)
src/pages/meetings/ScheduleMeetingsDialog.tsx       | 14 ++++++++++---
src/pages/meetings/ScheduleMeetingsDialog.test.tsx  | 19 +++++++++++++++++++
```
Confirm with `git diff 47966ef b0f94f6 --numstat -- src/pages/meetings/ScheduleMeetingsDialog.tsx src/pages/meetings/ScheduleMeetingsDialog.test.tsx`
— expect `14  3  ...tsx` and `19  0  ...test.tsx`. **Note:** the worker's own
output doc (`T609-worker-output.md` §2) self-reports `17 insertions(+), 3
deletions(-)` for the `.tsx` file — that number was measured against the
worker's pre-commit working-tree baseline (`63bb035`), not against `47966ef`.
A 14-vs-17 difference between those two baselines is not itself a finding;
verify the **actual** committed numbers above independently and only flag it
if the hunk content (§3 below) doesn't match what's described.

- **Worker packet:** `docs/swarm/active/T609-worker-packet.md`.
- **Worker output (unverified self-report):** `docs/swarm/active/T609-worker-output.md`.
- **Worker:** `worker-implementer`, sonnet, STANDARD tier (packet §0).
- **Branch:** `claude/w3-meeting-workflow-0bl669`.

## 2. Objective

Verify `b0f94f6` actually gates the Notes `EventFormSection` in
`ScheduleMeetingsDialog.tsx` to create-mode-only (`{!isEditMode && (...)}`),
adds exactly one new test proving both directions, and touches nothing else
— against what was built, not the packet's plan.

## 3. Priority 1 — polarity, and this is the finding that matters most

An inverted gate would compile, pass a careless read of the source, and
**invert the defect rather than fix it** (Notes would then hide in create
and show in edit — the opposite of both the requirement and of Description's
established pattern). Do not stop at reading the source.

```
grep -n "EventFormSection title=\"Notes\"" -B10 src/pages/meetings/ScheduleMeetingsDialog.tsx
grep -n "isEditMode && (" -A8 src/pages/meetings/ScheduleMeetingsDialog.tsx | head -20
```
Confirm textually: the Notes block is gated `{!isEditMode && (` (currently
around `:1151`, locate by content — this file's own precedent is line
numbers drift, do not cite by line alone) and Description's gate, four lines
above at `:1021`, reads `{isEditMode && (` — the **opposite** polarity,
deliberately.

**Then prove the rendered outcome, not just the source, in both modes:**
```
npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "T609"
```
Expect exit 0, 1 test passed. Read the test body itself
(`it('T609: Notes is create-mode only ...')`) and confirm it does two
things, not one: renders with `initialData={EDIT_INITIAL_DATA}` (edit mode)
and asserts `expect(() => getFieldControl('Notes')).toThrow()`, **then**
re-renders with no `initialData` (create mode) and asserts
`expect(getFieldControl('Notes')).toBeDefined()`. Both halves must be
present and both must pass — a test asserting only the edit-mode absence
would also pass against a fix that hides Notes in *both* modes.

**BLOCKER if the gate is inverted in either direction**, or if only one half
of the new test exists.

## 4. Priority 2 — the MTG-02 field-order tripwire is green and unedited

```
grep -n "field order (MTG-02" -A3 src/pages/meetings/ScheduleMeetingsDialog.test.tsx
git diff 47966ef b0f94f6 -- src/pages/meetings/ScheduleMeetingsDialog.test.tsx
```
Confirm zero changed lines fall inside that `describe` block (the diff
should be a pure addition elsewhere in the file, per §6 below), and confirm
its render call carries **no `initialData` prop** — unconditionally create
mode. Run it directly:
```
npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "renders fields in the exact MTG-02 order"
```
Expect exit 0. **If this is red, that is a finding against the CODE (the
gate leaked into create mode, or was inverted), never against the test —
do not recommend touching the test.** State this explicitly in your output
either way.

## 5. Priority 3 — replay the named mutation independently

Do not accept "the worker ran this and saw it fail" as evidence. Use
`.claude/skills/mutation-replay/SKILL.md` (`scripts/replay.py`), in your own
worktree (item 23) — never the shared tree.

1. Baseline in the worktree at `b0f94f6`:
   `npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "T609"`
   → exit 0, 1 passed.
2. Mutate: revert the `{!isEditMode && (` wrapper so the Notes
   `EventFormSection` renders unconditionally again (byte-identical to its
   `47966ef` state for that block — confirm with
   `git diff 47966ef -- src/pages/meetings/ScheduleMeetingsDialog.tsx` inside
   the worktree showing zero diff for that hunk after the mutation).
3. Re-run the same targeted command. **Expect exit 1**, with the failure
   being the edit-mode half specifically:
   `AssertionError: expected [Function] to throw an error` on the
   `expect(() => getFieldControl('Notes')).toThrow()` line. Read the actual
   failure output yourself — do not accept a paraphrase.
4. Per the skill's own caution: check that the count moved (1 failed, not 0
   run/skipped) and that the failure is this specific assertion, not an
   unrelated syntax error that would redden the whole file for the wrong
   reason.
5. Revert, confirm the worktree is byte-identical to `b0f94f6` again, remove
   the worktree.

**Why this one matters more than most mutation replays here:** a test
asserting a field is *absent* passes trivially if the field never renders at
all (a typo in the label string, a helper that always throws, etc.) — the
create-mode half of the same test is what makes this non-vacuous, and this
replay is what proves the edit-mode half is actually watching the gate
rather than something unrelated. **BLOCKER if the mutation fails to redden,
or reddens for a different reason than the one named above.**

## 6. Priority 4 — create mode's save path is untouched

The fix must be render-only. Confirm the diff does not reach `handleSubmit`,
`handleConfirmEditSave`, the `sessionsPayload` construction, or the loader —
all three are named Forbidden in the worker packet (§7).

```
git diff 47966ef b0f94f6 -- src/pages/meetings/ScheduleMeetingsDialog.tsx
```
Confirm the **only** hunk is the Notes-block region (wrapper + comment).
Specifically confirm zero changed lines in:
- `handleSubmit` (create path builds `payload.sessions: sessionsPayload`,
  and the edit path hardcodes `notes` to `''` with its own pre-existing
  comment — neither line should move).
- `sessionsPayload` (`useMemo(() => buildEventSessionsPayload(sessionDates, startTime, endTime, notes), ...)`)
  — confirm create mode's `notes` state still flows into this unchanged, by
  reading it directly rather than trusting the worker's claim.
- The `notes`/`setNotes` state declaration.

```
git diff 47966ef b0f94f6 -- src/lib/supabase/loaders/meetings.ts
```
Must be empty — no loader/query/mutation touch of any kind.

**BLOCKER if any of the above moved.**

## 7. Priority 5 — independent gate re-runs, derive your own baseline

Bare commands only, `$?` captured directly, never through a pipe:
```
npm run typecheck; echo "EXIT:$?"
npm run format:check; echo "EXIT:$?"
npm run lint; echo "EXIT:$?"
npm test; echo "EXIT:$?"
```
All four must be `EXIT:0` at `b0f94f6` (already HEAD, tree already clean).

**Do not reuse the worker's reported 370 warnings / 2087→2088 numbers.**
Derive your own baseline in an isolated worktree at the parent:
```
git worktree add <scratch-path> 47966ef
cd <scratch-path> && npm run lint; npm test
```
Compare: lint warning count must be **identical** at both ends (a render-only
change, no new export — if it moved, that's a MAJOR needing explanation, not
an assumption). Vitest total must move by **exactly +1** (baseline N →
N+1), file count unchanged, and the added test must be the new T609 test —
confirm via
`git diff 47966ef b0f94f6 -- src/pages/meetings/ScheduleMeetingsDialog.test.tsx | grep -c '^+.*it('`
(expect exactly 1). Also run the focused file directly at `b0f94f6`:
```
npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx
```
Expect one more passing test than the `47966ef` baseline run of the same
file, with the MTG-02 test and the T609 test both green.

## 8. Priority 6 — sabotage / scope check against `47966ef`

```
git diff 47966ef b0f94f6 --stat -- docs/ .claude/ supabase/
```
Must show **only** `docs/swarm/active/T609-worker-output.md`. Confirm by
name that none of the following appear anywhere in the full
`git show --stat b0f94f6` output: anything under `.claude/`,
`docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
`docs/swarm/dispute-log.md`, `docs/swarm/constitution.md`,
`docs/swarm/auto-mode-decisions.md`, anything under `supabase/migrations/`,
and any `src/` file other than the two named in §1's diffstat (in
particular: no `MeetingsList.tsx`/`.test.tsx`, no
`EditMeetingSessionDialog.*`, no `LiveConsole*`/`Kiosk.tsx`/
`EndMeetingDialog.tsx`, nothing under `src/pages/outreach/`). Confirm the
total file count in `git show --stat b0f94f6` is exactly **3**.

**Any match here is BLOCKER** — unauthorized/forbidden-file modification,
per the worker packet's Forbidden list and the constitution's Failure
Severity.

## 9. Relevant constitution excerpts

- **Non-Negotiables:** "Existing tests must pass unless the boss explicitly
  approves a test update." "No worker may mark its own work complete."
  "Every checker must inspect the actual artifact, not just the worker's
  summary."
- **Item 13:** field order (MTG-02) is structural intent, not a suggestion —
  governs §4.
- **Item 19b** (quoted in the worker packet §0): why no `checker-premise`
  round ran on this packet — governs §0 above.
- **Item 21:** completion reports state a commit SHA; existence is verified,
  not assumed. Confirm `git log --oneline 47966ef..b0f94f6` is non-empty and
  `git status --short` is clean at `b0f94f6` (§1).
- **Item 22:** explicit pathspecs only — the 3-file diffstat in §1 is your
  evidence this held; any stray file is a finding independent of its content.
- **Item 23:** mutation experiments run in your own worktree, never the
  shared tree — governs §5 and §7's baseline re-derivation.
- **Item 26 / Tier:** STANDARD (single module, no write path, rolling out an
  in-file idiom) — "verification is not reduced" even at this tier; run
  every check below in full.

## 10. Failure severity

- **BLOCKER:** the gate inverted in either direction (§3); MTG-02 red due to
  the code (§4); the named mutation fails to redden, or reddens for the
  wrong reason (§5); `handleSubmit`/`handleConfirmEditSave`/`sessionsPayload`/
  the loader touched (§6); any gate exit code nonzero (§7); any forbidden
  file touched or file count ≠ 3 (§8).
- **MAJOR:** lint or test delta doesn't reconcile exactly (§7); an
  undisclosed scope deviation from the worker packet §6/§7.
- **MINOR:** e.g. the explanatory comment is present but garbled or
  mis-cites `auto-mode-decisions.md`, while the gate itself is correct.
- **NIT:** cosmetic only.

## 11. Required checker output

Per the constitution's Evidence Requirements and the `checker-reviewer`
format:
```
# Check Result
PASS or FAIL

# Severity
BLOCKER / MAJOR / MINOR / NIT

# Evidence Inspected
- Files:
- Commands:
- Outputs:

# Findings

# Required Rework
(only if FAIL)

# Follow-up Tasks
(only if PASS with MINOR/NIT)
```
Include, explicitly: the polarity confirmation from §3 stated for both
Description and Notes; the real RED transcript from the §5 mutation replay
(not a description of what it would show); your own independently-derived
lint/test baseline next to the worker's claimed 370/0-delta and
2087→2088; and confirmation that the §8 sabotage check found exactly 3
files. Also state explicitly whether the MTG-02 tripwire stayed green, and
if not, that the finding is against the code, not the test (§4).

**Restated: PASS/FAIL/REVISE verdict only. No ledger update, no
verification-log entry, no state-summary edit, no treating T609 as closed.**
