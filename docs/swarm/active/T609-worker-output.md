# Worker Output: T609 — hide the dead Notes field in edit mode

**Packet:** `docs/swarm/active/T609-worker-packet.md` v1, attempt 1.
**Branch:** `claude/w3-meeting-workflow-0bl669`. **Baseline SHA at start:** `63bb0357e6f38c5e50ba3a36841880e504c9b8fe`.
**Commit SHA:** none — per explicit orchestrator instruction for this run ("Do not commit, do not
push, do not update any ledger or log — the orchestrator handles that"), this worker did not commit.
The diff described below is uncommitted in the shared tree, on the branch above, ready for the
orchestrator to commit with explicit pathspecs (item 22). No `git add`/`git commit` was run.

---

## 1. Files changed

Exactly two source-adjacent files, plus this output doc — matching §6 exactly:

- `src/pages/meetings/ScheduleMeetingsDialog.tsx` — the Notes `EventFormSection` block wrapped in
  `{!isEditMode && (...)}`, plus an explanatory comment.
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — one new test added, zero existing lines
  changed.
- `docs/swarm/active/T609-worker-output.md` — this file (created).

No other file was touched. Nothing under §7's Forbidden list was opened for editing.

---

## 2. Diff content

### `ScheduleMeetingsDialog.tsx` (the only hunk in the file)

```diff
-              <EventFormSection title="Notes" hasDivider={false}>
-                <TextArea label="Notes" value={notes} onChange={setNotes} isOptional rows={3} />
-              </EventFormSection>
+              {/* T609 -- create-mode-only field (mirrors Description's own
+                  `isEditMode &&` gate above, inverted): edit mode never
+                  persists this dialog's `notes` state (see `handleSubmit`'s
+                  own `:927-931` comment), so showing an editable Notes box in
+                  edit mode silently discarded whatever a coach typed into it.
+                  Per `auto-mode-decisions.md`'s "2026-07-30 -- George's ruling
+                  on T169 (owner input, verbatim)" finding 1, a control that
+                  accepts input, shows it applied, and silently discards it is
+                  worse than no control at all -- hide it instead. */}
+              {!isEditMode && (
+                <EventFormSection title="Notes" hasDivider={false}>
+                  <TextArea label="Notes" value={notes} onChange={setNotes} isOptional rows={3} />
+                </EventFormSection>
+              )}
```

Polarity, stated explicitly: the gate is `{!isEditMode && (`, matching the packet's required
direction (Notes = create-mode only). This is the inverse of Description's `{isEditMode && (` gate
four lines above it — deliberately, per the defect (Description is edit-only, Notes must become
create-only). `git diff --numstat` for this file: `17 insertions(+), 3 deletions(-)`, one hunk, all
within the Notes block region. No other hunk exists anywhere else in this file.

### `ScheduleMeetingsDialog.test.tsx` (new test only, appended inside the existing
`describe('<ScheduleMeetingsDialog /> T510 edit mode', ...)` block, immediately after the last
existing `it` in that block, `'create mode is unaffected: ...'`)

```tsx
  it('T609: Notes is create-mode only -- absent when editing, present when creating', () => {
    act(() => {
      root.render(
        <ScheduleMeetingsDialog
          isOpen
          onOpenChange={() => {}}
          teams={TEST_TEAMS}
          initialData={EDIT_INITIAL_DATA}
        />,
      );
    });
    expect(() => getFieldControl('Notes')).toThrow();

    act(() => {
      root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
    });
    expect(getFieldControl('Notes')).toBeDefined();
  });
```

`git diff --numstat` for this file: `19 insertions(+), 0 deletions(-)`. The only literal `-` line
in `git diff`'s raw output is the `--- a/...` file header itself — confirmed by grepping the diff
for lines starting with `-` (excluding `---`): zero matches. No existing test's content changed.

`EDIT_INITIAL_DATA` was reused from its existing declaration inside the same `'T510 edit mode'`
describe block (`:929-936` before this change landed) — not duplicated under a new name, per the
packet's instruction.

---

## 3. §3 MTG-02 tripwire — re-verified independently, not just trusted from the packet

Re-read `describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', ...)`,
test `'renders fields in the exact MTG-02 order: title, team scope, location, schedule mode,
date/time, notes'` directly in the current tree before touching anything. Its render call:

```tsx
root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
```

confirmed with my own eyes: no `initialData` prop is passed. Since `isEditMode = initialData !==
undefined`, this is unconditionally create mode, so `{!isEditMode && (...)}` evaluates `true` and
the Notes section renders exactly as before. This test was not edited. It was run, unmodified,
against the fixed code (both in the full suite and in the isolated per-file run below) and passed.

Also re-verified §3's exhaustive-search claim, independently, after landing the change: a literal
search for `Notes` across every `*.test.ts*` file under `src/` and both Playwright specs under
`tests/e2e/` still returns exactly **one file** — `ScheduleMeetingsDialog.test.tsx` (now containing
four occurrences of the literal string inside that one file: the pre-existing MTG-02 label
assertion plus the three lines of the new T609 test). No other test file anywhere in the repo
asserts anything about Notes, in either mode. `tests/e2e/public-routes.spec.ts` and
`tests/e2e/protected-route-redirects.spec.ts` contain no reference to "Notes" at all.

---

## 4. §5 — did any existing test contradict this fix?

**No existing test needed modification.** No test anywhere in the repository asserted Notes is
present in edit mode (§3's exhaustive search, re-verified above, confirms this both before and
after the change). No `boss-architect` ruling request was needed or filed.

---

## 5. Commands run, with real captured exit codes (bare command, never piped through `tail`)

All commands below were run with `$?` captured immediately after the bare command (redirected to a
file with `>`, never `| tee` / `| tail`).

### Baseline (before any change, at `63bb0357e6f38c5e50ba3a36841880e504c9b8fe`)

- `npm run typecheck` → `EXIT:0`
- `npm run format:check` → `EXIT:0`
- `npm run lint` → `EXIT:0`; **0 errors, 370 warnings** (`✖ 370 problems (0 errors, 370 warnings)`)
- `npm test` (`vitest run`) → `EXIT:0`; **81 test files passed (81)**, **2087 tests passed (2087)**

### After the change (shared tree, uncommitted)

- `npm run typecheck` → `EXIT:0`
- `npm run format:check` → `EXIT:0`
- `npm run lint` → `EXIT:0`; **0 errors, 370 warnings** — identical to baseline, no delta (a
  render-only change adding no new export, as expected; no explanation needed since the count did
  not move)
- `npm test` (`vitest run`) → `EXIT:0`; **81 test files passed (81)**, **2088 tests passed (2088)**
  — exactly one more test than baseline (2087 → 2088), matching "this task adds exactly one test."
- Focused run, `npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx` → `EXIT:0`; **57
  tests passed (57)** in this file (56 pre-existing + 1 new T609 test), including the MTG-02 test
  and the new T609 test both passing. (Pre-existing `act(...)`/`scrollTo` stderr noise in this
  file's output is unrelated existing behavior, not new — the same warnings appear against
  unmodified code and do not fail any test.)

### §4 named mutation — run in an isolated worktree (constitution item 23), never the shared tree

1. Created a detached worktree at HEAD (`git worktree add --detach <scratch-path> HEAD`), copied
   the two fixed files into it, symlinked `node_modules` (no reinstall).
2. **Sanity check first:** ran the new T609 test against the *real fix* in that isolated worktree —
   `npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "T609"` → `EXIT:0`, `1
   passed | 56 skipped (57)`. Confirms the fix is what makes the test pass, in isolation.
3. **Applied the named mutation:** reverted the `{!isEditMode && (...)}` wrapper, restoring the
   Notes `EventFormSection` to unconditional rendering. Verified via `git diff
   src/pages/meetings/ScheduleMeetingsDialog.tsx` inside the worktree that this produced **zero
   diff against HEAD** — i.e., byte-identical to the pre-fix state, exactly as the packet requires.
4. Re-ran the same targeted command under the mutation:
   `npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx -t "T609"` → **`EXIT:1`**.
   Real failure output:
   ```
   × <ScheduleMeetingsDialog /> T510 edit mode > T609: Notes is create-mode only -- absent when editing, present when creating 242ms

   FAIL  src/pages/meetings/ScheduleMeetingsDialog.test.tsx > <ScheduleMeetingsDialog /> T510 edit mode > T609: Notes is create-mode only -- absent when editing, present when creating
   AssertionError: expected [Function] to throw an error
    ❯ src/pages/meetings/ScheduleMeetingsDialog.test.tsx:1156:44
      1154|       );
      1155|     });
      1156|     expect(() => getFieldControl('Notes')).toThrow();
         |                                            ^
      1157|
      1158|     act(() => {

   Test Files  1 failed (1)
        Tests  1 failed | 56 skipped (57)
   ```
   This is exactly the edit-mode half of the new test failing, exactly as predicted: with the
   mutation applied, `getFieldControl('Notes')` finds the control in edit mode instead of throwing.
   This is the real, captured proof that the test is not vacuous — not a description of what it
   would show.
5. Removed the worktree's `node_modules` symlink and ran `git worktree remove <path> --force`;
   confirmed via `git worktree list` that only the main working tree remains. The shared tree
   (`git status --short`) still shows only the two intended modified files, unaffected by the
   mutation experiment.

---

## 6. `git diff` confinement checks (§8)

- `ScheduleMeetingsDialog.tsx`: one hunk, entirely inside the Notes block region (`17
  insertions(+), 3 deletions(-)`). No other hunk anywhere else in the file.
- `ScheduleMeetingsDialog.test.tsx`: `19 insertions(+), 0 deletions(-)`. Grepping the raw diff for
  lines starting with `-` (excluding the `---` file header) returns zero matches — confirmed no
  existing test's content changed.

---

## 7. Known risks

- **T605/file-conflict sequencing (packet §7's own flag):** `ScheduleMeetingsDialog.tsx` is listed
  as Forbidden to T605's own worker packet, and T605 has not yet been dispatched. If T605's worker
  starts before this task's checker round finishes, both tasks would touch this same file
  concurrently. This is unchanged by this worker's diff and is the orchestrator's sequencing call
  per the packet, not something resolved here.
- **Uncommitted state:** per this run's explicit instruction not to commit, the fix exists only as
  an uncommitted working-tree diff on `claude/w3-meeting-workflow-0bl669`. Until the orchestrator
  commits it (with explicit pathspecs, item 22), there is no commit SHA to cite for item 21, and
  the diff could be lost if the tree is reset before that happens.
- No other risk identified. Create mode's own render path and `handleSubmit`'s save path were not
  touched; `notes` state, `sessionsPayload` construction, and `loaders/meetings.ts` are all
  unmodified, matching the packet's Forbidden list.

---

## 8. Dispute

**No dispute filed.** The render gate was the complete, correct fix as scoped; no contradicting
test was found (§4 above); nothing encountered during implementation suggested the fix needed to be
wider than the single conditional wrapper described in §2 of the packet.
