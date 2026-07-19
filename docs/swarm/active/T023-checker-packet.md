# Checker Packet: T023 (Add/edit student dialog) — Check Attempt 1

## Task ID
T023 — Add/edit student dialog (ROS-03), Epic E4.

## Checker Agent
checker-reviewer (per task-ledger.md T023 row).

## Objective
Verify a `Dialog` with ROS-03's exact field order, BEH-07 computed confirm-button copy, a
well-reasoned resolution of the schema-forced "email (optional)" ambiguity consistent with
`StudentsTab.tsx`'s established precedent, and correct blank-goal-override-submits-null behavior.

## Allowed Files (worker's literal permitted edit)
- `src/pages/roster/StudentDialog.tsx` (new)

**Scope flag**: worker also created `StudentDialog.test.tsx`, outside the literal Allowed Files
line — same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive
the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`97af69b`) — do NOT
infer authorship from commit messages. Confirm `StudentsTab.tsx`, `RosterShell.tsx`, `router.tsx`,
`guards.tsx` (import-only) untouched. Note: the working tree may currently show many other
concurrently-running tasks' untracked files (`Leaderboard.tsx`, `OutreachEventDialog.tsx`,
`InviteParentDialog.tsx`, `InvitesTab.tsx`, `ParentsTab.tsx`, `TeamsTab.tsx`,
`src/pages/settings/**`) — none belong to T023; do not flag them.

## Worker's Claimed Changes (do not trust — verify independently)
1. **"email (optional)" resolution**: applied the same reading (a) `StudentsTab.tsx`/T022 already
   established for the parallel "Invite (if email)" ambiguity — `StudentFormPayload.inviteEmail` is
   a disclosed, non-`students`-column signal submitted alongside the real roster fields, never
   merged into them; this dialog never calls `send-invite` itself (no shared client). Claims it also
   identified and handled an edit-mode wrinkle NOT spelled out in the packet: if the student being
   edited already has an account (`profileId !== null`), their real email lives on their own
   `profiles` row, out of reach here — `computeEmailFieldDisabled(mode, hasAccount)` disables the
   field with an explicit message in that case, staying enabled for create mode and for editing an
   accountless student.
2. **BEH-07**: `computeConfirmLabel('create')` → "Add student", `computeConfirmLabel('edit')` →
   "Save changes" — claims verified both via unit test and rendered-DOM test, plus explicit
   assertions "Submit"/"OK" never appear.
3. **Blank goal override → `null`**: `buildStudentFormPayload` claimed tested directly — blank state
   submits `goalHoursOverride === null` (not `0`); helper text cites the fixture's real
   `defaultGoalHours: 100`, matching the real `seasons.default_goal_hours` column default (cited
   file+line).
4. **Deliberate fixture duplication**: `StudentDialogTeamOption`/fixture data independently defined,
   NOT imported from `StudentsTab.tsx` (forbidden/read-only) — claims this matches
   `ScheduleMeetingsDialog.tsx`/T031's precedent toward `MeetingsList.tsx`'s fixtures.
5. Claims 24 new tests (426/426 repo-wide at last check); typecheck/lint(scoped)/format(scoped) all
   clean for its own files. Discloses one repo-wide `build`/`typecheck` blocker at the time of its
   run, attributed to a different concurrent worker's in-progress `SeasonSettings.tsx` (a `DateRange`
   type mismatch, outside its Allowed Files) — recommends the checker re-run once that lands.

## Required Verification Steps
1. **Read `StudentDialog.tsx` and `StudentDialog.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **"email (optional)" resolution — confirm consistency with `StudentsTab.tsx`'s precedent**, not
   just internal coherence. Read `StudentsTab.tsx`'s own resolution (and its checker's verdict in
   `docs/swarm/archive/T022-checker-packet.md`) and confirm this task's approach is the same reading
   applied consistently, not a divergent one.
3. **Edit-mode email-disable wrinkle — the worker's own extra finding, re-verify it's real and
   correct.** Confirm by source read that `computeEmailFieldDisabled` genuinely disables the field
   only when `profileId !== null` (an already-accounted student), and stays enabled for create mode
   and accountless-student edits.
4. **BEH-07 — confirm by source read**, not just the test claim, for both modes.
5. **Blank goal override — re-derive independently.** Confirm `buildStudentFormPayload` genuinely
   submits `null` (not `0`, not a copied-in default value) when the field is blank, and confirm the
   helper text's cited default (100) genuinely matches the real `seasons.default_goal_hours` column
   default by reading the migration yourself.
6. **Astryx prop citations** — spot-check `Dialog`, `TextInput`, `Selector`, `NumberInput`
   (especially the `hasClear`-widens-`onChange`-to-`number | null` claim — verify against the
   installed `.d.ts`), `Switch`, `Button` against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** (scoped appropriately given concurrent-worker
   noise in the shared tree, same as the worker did) — don't accept "24 new"/"426/426" without your
   own run. If the disclosed `SeasonSettings.tsx` blocker still exists at check time, confirm it's
   genuinely unrelated to this task before treating the whole-repo build as informative either way.
9. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 6: no PII... test fixtures use fabricated names.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the "email (optional)" resolution's consistency with `StudentsTab.tsx`'s
  precedent
- explicit verdict on the edit-mode email-disable wrinkle
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
