# T510 checker packet — series edit for scheduled meetings, round 1

Render PASS / FAIL / REVISE with full evidence, exactly as you normally would
— but stop there. **Do not update `docs/swarm/task-ledger.md`,
`docs/swarm/verification-log.md`, `docs/swarm/state-summary.md`, or any other
shared doc, and do not treat T510 as closed.** The foreman records your
verdict and any escalation.

**Assigned:** `checker-reviewer`.

## 0. Why this row needs more than a normal round-1 check

T510's *packet* went through two premise-gate rounds and two `boss-arbiter`
rulings (D015, D016) before any worker ever ran — all of that happened before
this artifact existed. **This is the first check any T510 artifact has ever
received.** Attempt count on the worker/checker loop is **1**; there is no
prior verification-log entry for this row (`grep T510
docs/swarm/verification-log.md` returns nothing) and no prior worker
attempt — do not confuse the packet's own two arbitration rounds with a
worker-loop attempt history. Treat this as raising the bar, not lowering it.

**Four properties in this diff were each purchased with a full revision
cycle and look like defects to a reader who does not know the history below.
Confirm each is present as specified. If present, it is NOT a finding — do
not report it as one. Only a deviation from the specified shape is a
finding.**

1. `cancelSession` (`src/lib/supabase/loaders/meetings.ts`) is deliberately,
   permanently time-**unguarded** — no `.gt('starts_at', 'now')` anywhere on
   its own mutation, with a code comment saying why. D016 §3: a symmetric
   guard here was proven to silently no-op in exactly the raced case this
   function exists to repair.
2. Step f (session removal) is **per-session paired**, never batched. Steps
   a–e (the still-future guard, the attendance check, the attendance-driven
   cancel batch) ARE batched. Only f is per-id (D015's ruled fix).
3. The guarded delete (`deleteSessionIfStillFuture`) keeps `.select('id')`
   and an empty result routes to `cancelSession` (D016's fix for the silent
   zero-row loss path). Removing either half reopens a real defect.
4. `computeConfirmLabel` takes `isEditMode: boolean` **first**, before the
   session count. Grant B (boss ruling, `auto-mode-decisions.md:3843`)
   authorized the five test call-site edits this required.

## 1. Dispatch context — corrected git state, read before anything else

**The work is now committed, not in the working tree.** Baseline `eaa9070`
(`eaa907092c35a23c8634c6ab0e31ba567a6d319e`) is the packet-final commit.
Worker output landed at **`0444798`**
(`044479838214ba72bb107db451a938a3b5e700f7`), commit message `T510: edit a
meeting series — shared fields plus future-forward schedule`. Verify this
yourself before trusting it further:
```
git log --oneline eaa9070..0444798
git rev-parse HEAD          # should print 044479838214ba72bb107db451a938a3b5e700f7
git status --short          # should be empty (clean tree)
```
**Every diff-based criterion below must be run as `git diff eaa9070 0444798
-- <path>` (or `git show --stat 0444798`), never as a plain working-tree
diff.** The tree is clean now, so a bare `git diff` or `git diff HEAD`
against nothing will show an empty diff and silently pass every scope
criterion vacuously — that is not evidence, it is an artifact of the tree
being clean. Pin the SHA in every command; do not rely on `HEAD` remaining
`0444798` for the whole session.

- **Worker packet:** `docs/swarm/active/T510-worker-packet.md`, v4 final (the
  file itself, §0, records the full D015/D016 history — read it, not just
  this packet's summary).
- **Worker output (unverified self-report):** `docs/swarm/active/T510-worker-output.md`.
- **Worker:** `worker-implementer`, tier sonnet (packet §3).
- **Branch:** `claude/w3-meeting-workflow-0bl669`.
- **Allowed files (packet §5) — expected diffstat**, confirm independently,
  do not just eyeball this table:
  ```
  git show --stat 0444798
  ```
  should show exactly these six paths and nothing else:
  ```
  docs/swarm/active/T510-worker-output.md              (new)
  src/lib/supabase/loaders/meetings.ts
  src/pages/meetings/MeetingsList.test.tsx
  src/pages/meetings/MeetingsList.tsx
  src/pages/meetings/ScheduleMeetingsDialog.test.tsx
  src/pages/meetings/ScheduleMeetingsDialog.tsx
  ```
  `MeetingsList.tsx` carries a large deletion count — that is the dead stub
  removal (AC14 below), expected, not itself a red flag.

## 2. Objective

Verify that `0444798` actually implements worker packet v4's design: a real
series-edit path for scheduled meetings (shared fields always editable,
future-forward-only schedule reconciliation, per-session-paired removal with
the D015/D016 fallback), replacing the "no edit mode" stub — against **what
was built**, not against the plan's assumptions. Full acceptance criteria
are worker packet §8 (AC1–AC20); this packet prioritizes the ones most
likely to be wrong in a way a summary would hide.

## 3. Worker's self-report — reproduced only so you know what to check, verify none of it as fact

- Claims all four gates `EXIT:0` on the committed state; lint 0 errors/370
  warnings (baseline 366); vitest 81 files/2087 tests (baseline 2055),
  +32 tests, 0 files added.
- Claims the +4 lint warnings are entirely `react-refresh/only-export-components`
  on four newly-exported pure symbols in `ScheduleMeetingsDialog.tsx`
  (`isMeetingSessionReconcilable`, `computeMeetingSeriesReconcilePlan`,
  `buildEditConfirmationDescription`, `defaultOnSaveMeetingSeries`) — **verify
  this attribution, do not accept it.** A warning-count rise is exactly where
  a real regression hides in plain sight; the four could just as easily be a
  different rule, a different file, or fewer than four with something else
  making up the difference.
- Claims two AC9 Branch-F mutations and one Grant-A property-6 mutation were
  applied and reverted live. Claims no dispute filed; one interpretive note
  (see §8 below).

## 4. Required verification

### 4a. Sabotage / scope check — run first
```
git diff eaa9070 0444798 --stat
git diff eaa9070 0444798 --stat -- docs/ .claude/
```
The second command must show **only**
`docs/swarm/active/T510-worker-output.md`. Confirm by name that none of the
following appear anywhere in the full stat output: anything under
`.claude/`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
`docs/swarm/dispute-log.md`, `docs/swarm/constitution.md`,
`docs/swarm/auto-mode-decisions.md`, anything under `supabase/migrations/`,
`src/lib/supabase/loaders/selfCheckoff.ts`, `src/lib/supabase/loaders/csvExport.ts`,
`src/lib/supabase/loaders/{outreach,endMeeting,attendance,students,client,loader}.ts`,
`src/lib/supabase/types.ts`, `src/pages/meetings/{LiveConsole,EndMeetingDialog,Kiosk,StudentMeetingView}.tsx`
(or their test files), or anything under `src/pages/outreach/`. **Any match
here is BLOCKER — unauthorized/forbidden-file modification**, per worker
packet §Forbidden Files and the constitution's Failure Severity.

**The "two W2 files, one line each" note — this is NOT a deviation.** The
worker's output (`T510-worker-output.md`, "Disputes" section) records that an
orchestrator instruction referencing "two W2 files authorized for exactly
one line each" matched nothing in the T510 packet, and the worker correctly
followed the packet instead. That instruction was the orchestrator's own
error, leaked over from T603 (a different row) — it does not apply to T510
and the worker's choice to disregard it was correct. **Confirm only that no
W2-owned file appears in the `0444798` diffstat** (W3 owns
`pages/meetings/**`, per the ledger row); do not fault the worker for the
mismatch, and do not treat the note as an open question.

### 4b. Independent gate re-run — bare commands, `$?` captured directly, never through a pipe
At `0444798` (already `HEAD`, tree already clean):
```
npm run typecheck; echo "EXIT:$?"
npm run format:check; echo "EXIT:$?"
npm run lint; echo "EXIT:$?"
npm test -- --run; echo "EXIT:$?"
```
All four must be `EXIT:0`. Then **independently derive the baseline** rather
than reusing the worker's reported 366/2055 numbers — check out `eaa9070` in
your own worktree (item 23: mutation/experiment work never touches the
shared tree) and run `npm run lint` and `npm test -- --run` there too:
```
git worktree add <scratch-path> eaa9070
cd <scratch-path> && npm run lint; npm test -- --run
```
Compare your own before/after numbers to the worker's claim. **Specifically
verify the +4 lint delta**, not just the count: run `npm run lint` at
`0444798` and inspect the actual warning list — confirm exactly four new
warnings beyond the `eaa9070` baseline, that all four are
`react-refresh/only-export-components`, and that all four point at
`ScheduleMeetingsDialog.tsx`'s four newly-exported symbols named above. If
any new warning is a different rule, lands in a different file, or the count
doesn't reconcile exactly, that is a finding (severity depends on what the
extra warning is — a new rule category on a write-path file is at least
MAJOR). Also confirm the vitest file count is unchanged (81 → 81) and the
+32 test delta reconciles against the worker's own itemization
(`MeetingsList.test.tsx` +7, `ScheduleMeetingsDialog.test.tsx` +25) —
`git diff eaa9070 0444798 -- src/pages/meetings/MeetingsList.test.tsx src/pages/meetings/ScheduleMeetingsDialog.test.tsx | grep -c '^+.*it('` as a rough cross-check, not a substitute for actually reading the new tests.

### 4c. Confirm the four hard-won properties (§0) — presence check, not a finding either way if present
1. **`cancelSession` unguarded:**
   ```
   grep -n "cancelSession = runMutation" -A6 src/lib/supabase/loaders/meetings.ts
   ```
   Confirm the mutation is `client.from('event_sessions').update({ status: 'canceled' }).eq('id', sessionId)` with **no** `.gt(` anywhere in that chain, and that a comment directly above it explains why a time guard must not be added. Absence of the comment is a MINOR finding (the guard's absence is still correct; the missing rationale invites a future worker to "fix" it back into the bug D016 closed) — presence of a `.gt(...)` guard on this specific mutation is BLOCKER (reopens D016's defect).
2. **Step f is per-id, not batched:**
   ```
   grep -n "removeOneSession\|Promise.all(toDelete" src/lib/supabase/loaders/meetings.ts
   ```
   Confirm `toDelete.map(id => removeOneSession(id))` (or equivalent per-id call), and separately confirm steps a/c/e each use a single batched `.in(...)` call, not a loop.
3. **Guarded delete + empty-result routing:**
   ```
   grep -n "deleteSessionIfStillFuture = runMutation" -A10 src/lib/supabase/loaders/meetings.ts
   grep -n "deletedRows" -B2 -A4 src/lib/supabase/loaders/meetings.ts
   ```
   Confirm the chain ends `.select('id')` and that `(deletedRows ?? []).length === 0` (or equivalent) routes to `cancelSession(sessionId)`. This is also verified behaviorally in §4d — do not stop at the grep.
4. **`computeConfirmLabel(isEditMode, sessionCount)`:**
   ```
   grep -n "function computeConfirmLabel\|computeConfirmLabel(" src/pages/meetings/ScheduleMeetingsDialog.tsx src/pages/meetings/ScheduleMeetingsDialog.test.tsx
   ```
   Confirm the signature is `(isEditMode: boolean, sessionCount: number)`, the component's own internal call passes the real `isEditMode` variable (not a literal), and exactly five test call sites gain a literal `false` as a new leading argument with zero asserted output strings changed.

### 4d. Mutation replay — run these yourself, in your own worktree copy, never the shared tree (item 23)

Use `.claude/skills/mutation-replay/SKILL.md` / `scripts/replay.py`. Do not
accept "worker confirmed RED" as evidence for any of the three below.

1. **AC9 Branch F, mutation 1 — drop `.select('id')`** from
   `deleteSessionIfStillFuture` in `loaders/meetings.ts`. Run
   `npm test -- --run src/pages/meetings/MeetingsList.test.tsx -t AC9`.
   **Expected: 5 of 6 branch tests go RED (A, C, D, E, F); Branch B stays
   green** (it never reaches the delete path). **Read the failure reason
   carefully before judging the mutation caught anything**: for Branch D and
   Branch F specifically, the sub-assertion "X is canceled" still PASSES
   under this mutation — X really is still canceled. What must fail is the
   **"X ONLY"** part (Y gets wrongly canceled too) and **"Y receives NO
   update call"** (Y now receives one). A checker that expects the "X is
   canceled" assertion itself to go red will wrongly conclude this test is
   vacuous — it is not; it is failing via a different, correct sub-assertion.
   Revert (`git checkout 0444798 -- src/lib/supabase/loaders/meetings.ts`)
   and re-run to confirm green before the next mutation.
2. **AC9 Branch F, mutation 2 — drop the `(deletedRows ?? []).length === 0`
   routing check entirely** (never call `cancelSession` on an empty result).
   Same test command. **Expected: exactly Branch F goes RED**, all other
   five stay green (`cancelEntries` empty instead of containing X). Revert
   and confirm green again.
3. **Grant A property 6 — revert `onEdit={openEditDialog}` back to a
   stub/no-op at BOTH `CoachMeetingsSection` mounts** in `MeetingsList.tsx`.
   Run `npm test -- --run src/pages/meetings/MeetingsList.test.tsx -t "T510: Edit opens"`.
   **Expected: RED** (clicking Edit no longer opens any dialog; the
   `hasAttribute('open')` assertion fails). Revert and re-run the full
   meetings suite to confirm green before moving on.

For all three: confirm the file is byte-identical to `0444798` afterward
(`git diff 0444798 -- <file>` empty) before finishing.

### 4e. Grant A — verify all six properties on the single authorized replacement test
Citation: `auto-mode-decisions.md:3843`, "2026-08-06 — Boss ruling
(constitution item 10)" — re-derivation of the old stub test is authorized,
deletion is not. Locate the replacement by name (not line range) in
`MeetingsList.test.tsx`:
```
grep -n "T510: Edit opens the real dialog" src/pages/meetings/MeetingsList.test.tsx
```
Read the actual test body and confirm:
1. Finds the Edit control via an `aria-label` starting `Edit – Weekly Build
   Meeting` — confirm the dash character is actually an en dash (`–`), not a
   hyphen, matching the real rendered `aria-label`.
2. Asserts BOTH the dialog has `hasAttribute('open') === true` with the
   edit-mode title, AND Title/Location `.value` equal the clicked row's real
   fixture values (`'Weekly Build Meeting'` / `'Robotics Lab'`) — presence
   alone is not sufficient; prefill must be checked.
3. `container.textContent` does NOT contain `"Editing an existing meeting
   isn't supported yet"` and does NOT contain `'not built yet'`.
4. **Asserts `onCreateMeetings` (injected `vi.fn()`) is NOT called by the
   edit interaction.** This is not incidental — it is the stub's real duty
   inherited: without it, nothing here proves the edit path doesn't
   accidentally create a second, competing series. Confirm the assertion is
   present and actually exercised (the mock must be wired to the component
   under test, not a dead import).
5. **Test count must not decrease.** `git diff eaa9070 0444798 -- src/pages/meetings/MeetingsList.test.tsx`
   — confirm this is a 1-for-1 replacement of the old stub test (net 0 from
   this specific swap) and that the file's own provenance comment above the
   test still contains the original T096/T135 history with a "T510 UPDATE"
   paragraph appended, not a deleted/replaced comment block.
6. Covered by §4d mutation 3 above.

### 4f. MTG-02 tripwire — must be unmodified and green
```
grep -n "field order (MTG-02" src/pages/meetings/ScheduleMeetingsDialog.test.tsx
```
Take the line range this returns and diff exactly that block:
```
git diff eaa9070 0444798 -- src/pages/meetings/ScheduleMeetingsDialog.test.tsx
```
— confirm zero changed lines fall inside that describe block. Then confirm
it passes in your §4b test run. **If it is red, this is a finding against
the CODE (Description leaked into create mode), not the test — do not
recommend touching the test.** This is worker packet §2/§9's explicit,
pre-ruled framing; treat any red here as BLOCKER against the implementation.

### 4g. Remaining acceptance criteria — inspect directly, do not wave through
- **AC1** — `git diff eaa9070 0444798 -- src/pages/meetings/ScheduleMeetingsDialog.tsx`
  and confirm zero changed lines inside the existing `CreateMeetingsEventPayload`,
  `CreateMeetingsSessionPayload`, `CreateMeetingsPayload`, `OnCreateMeetingsFn`,
  `defaultOnCreateMeetings` declarations. Do this yourself; do not reuse the
  worker's "IDENTICAL" claim.
- **AC8** — the partial `events` update object has **exactly** the keys
  `title`, `team_ids`, `location_name`, `description` — grep the
  `.update({...})` call site in `makeSaveMeetingSeries` and confirm no other
  key (especially `address`, `counts_participation`, `counts_volunteer_hours`)
  is present.
- **AC14** — dead stub code removed:
  ```
  grep -rn "StubNotice\|StubBanner\|showEditStub\|stubNotice" src/pages/meetings/MeetingsList.tsx
  ```
  must return zero matches at `0444798`.
- **AC15** — the four frozen tests/describe blocks (worker packet §2's last
  bullet list, identified by name) exist, are unmodified, and pass:
  `'"Schedule meetings" opens the real ScheduleMeetingsDialog (module doc #7a)'`,
  the injected-`onCreateMeetings` seam test and its sibling,
  `describe('createMeetings (T096, Trap #3 real onCreateMeetings default)', ...)`.

## 5. Constitution excerpts relevant to this check

- **Non-Negotiables:** "Every checker must inspect the actual artifact, not
  just the worker's summary." "No worker may mark its own work complete."
- **Item 20** — a deliberate deferral must file a task, not a comment. The
  D015/D016 residual race and the DST edge case are explicitly **not**
  item-20 deferrals (they are ruled, disclosed limitations) — do not require
  a new ledger row for either; do require the worker's output to state them
  as Known Risks (it does — confirm it, don't re-litigate the ruling).
- **Item 21** — "existence is verified, not assumed": confirm HEAD actually
  moved to `0444798` and the change is in the committed blob
  (`git log --oneline eaa9070..0444798`, `git status --short` clean), not
  merely that the worker's report describes real work.
- **Item 22** — explicit pathspecs only. The six-path diffstat in §1 is your
  evidence this held; if any stray file appears, that alone is a finding
  independent of whether its content is harmless.
- **Item 23** — mutation experiments run in your own worktree, never the
  shared tree. Applies to §4b's baseline re-derivation and all of §4d.
- **Item 26 / Tier** — this is a HEAVY-tier write path (deletes `rsvps` and
  `event_sessions` rows); hold it to that bar, not a light-touch one.

## 6. Failure severity

- **BLOCKER**: any forbidden-file modification (§4a); a broken gate; the
  MTG-02 tripwire going red (§4f, and it indicts the code, not the test);
  either AC9 mutation failing to reproduce the expected RED (§4d 1–2); the
  Grant-A property-6 mutation failing to go RED; `cancelSession` gaining a
  time guard; step f found batched; `.select('id')` or the empty-result
  routing missing from the shipped code (not just from a mutation test).
- **MAJOR**: the lint-warning attribution not reconciling exactly (§4b); any
  AC9/Grant-A property present in test intent but actually vacuous under
  replay; an undisclosed scope deviation from worker packet §4/§8.
- **MINOR**: e.g. a missing rationale comment where the guarded behavior
  itself is correct (§4c.1) — pass with a follow-up.
- **NIT**: cosmetic only.

## 7. Required checker output

Per the constitution's Evidence Requirements and the `checker-reviewer`
agent format:
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
Include, explicitly: the four confirmed-property checks (§4c) stated as
confirmed-present (not findings) if they hold; the actual RED/GREEN
transcript for each of the three §4d mutations, with the Branch D/F "which
sub-assertion actually failed" detail called out by name; your own
independently-derived lint/test baseline numbers next to the worker's
claimed 366→370 / 2055→2087; and confirmation that the "two W2 files" note
is resolved (no W2 file in the diff) rather than flagged as a deviation.

**Restated: PASS/FAIL/REVISE verdict only. No ledger update, no
verification-log entry, no state-summary edit, no treating T510 as closed.**
