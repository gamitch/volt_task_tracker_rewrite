# Checker Packet: T022 (Students tab table + row actions) — Check Attempt 1

## Task ID
T022 — Students tab table + row actions (ROS-02), Epic E4.

## Checker Agent
checker-accessibility (per task-ledger.md T022 row).

## Objective
Verify a `Table`+`PowerSearch` Students tab with all ROS-02 columns, a correctly-derived three-state
account-status `StatusDot`, and a reversible (not destructive) ROS-09 Deactivate flow.

## Allowed Files (worker's literal permitted edit)
- `src/pages/roster/StudentsTab.tsx` (new)

**Scope flag**: worker also created `src/pages/roster/StudentsTab.test.tsx`, outside the literal
Allowed Files line — same disclosed pattern already ruled in-scope by prior checkers. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`007a38e`) — do NOT
infer authorship from commit messages. Confirm `RosterShell.tsx` (T021, Passed) is byte-unchanged.
Confirm `router.tsx`, `guards.tsx`, `src/lib/supabase/**` untouched. Note: the working tree may
currently also show `CoachHome.tsx`/`.test.tsx` (T053) and `ScheduleMeetingsDialog.tsx`/`.test.tsx`
(T031) as untracked — those belong to different, concurrently-running tasks; do not flag them
against T022.

## Worker's Claimed Changes (do not trust — verify independently)
1. **"Invite (if email)" resolved**: `students` has no email column (verified against
   `20260716000000_identity_roster.sql` lines 59-68). Worker chose reading (a): "Invite" shows
   exactly when `accountStatus === 'no_account'`, since the real `send-invite` function already
   takes email as its own request input (cites `supabase/functions/send-invite/validation.ts`) —
   never looked up from a table. `shouldShowInviteAction(accountStatus)` is the single exported pure
   function implementing this.
2. **Account-status derivation**: `deriveAccountStatus(profileId, hasPendingSelfInviteFlag)` →
   `'active'` (profileId set) / `'invited'` (pending self-invite) / `'no_account'` (neither). Claims
   a subtlety handled correctly: `invites.student_id` is reused for both self-invites
   (`role='student'`) and parent invites (`role='parent'`, targeting the child) — `hasPendingSelfInvite`
   filters on `role === 'student'` specifically, so a pending parent-invite targeting a no-account
   student does NOT make that student show as "Invited". Claims tests exercise this decoy case
   directly, plus an `'expired'`-status self-invite (should also resolve to `no_account`).
3. **ROS-09 Deactivate/Reactivate**: `withActiveOverride` is claimed to be the only place `isActive`
   is mutated, always returns the full row set with one row flipped, never removes a row. Dialog
   copy explicitly states data is "preserved" and the student "still show[s] up here" — claims a
   test asserts the rendered text never matches `/delete/i`. Claims a full round-trip test:
   Deactivate → row stays visible with a "Deactivated" badge → MoreMenu now offers "Reactivate" →
   reactivating flips it back. "Reactivate" is disclosed as an addition beyond ROS-02's literal text,
   justified by needing to demonstrate reversibility in the UI.
4. **A real jsdom/MoreMenu finding**: claims Astryx's `MoreMenu`/`DropdownMenu` renders every row's
   menu items unconditionally into the DOM (native `popover="auto"` semantics, visibility toggled by
   CSS not conditional mounting) — meaning a naive `document.querySelectorAll('[role="menuitem"]')`
   in a multi-row table would pick up every row's items at once. Claims all test helpers were
   rewritten to scope queries via each trigger's `aria-controls` id to work around this.
5. Team `Badge` variant hardcoded to `neutral` (not mapped from `teams.color`, an unconstrained
   free-text column with no documented Badge-variant mapping) — disclosed as a deliberate
   non-guess, same reasoning `ParticipationTab.tsx`/T056 applied to a similar doc gap.
6. Claims 19/19 new tests pass (195/195 repo-wide at the time of the worker's run);
   typecheck/build/lint/format(scoped) all exit 0. Disclosed transient failures mid-session were
   caused by other concurrent workers' in-progress files (CoachHome.tsx, ScheduleMeetingsDialog.tsx),
   confirmed via git status not to be its own.

## Required Verification Steps
1. **Read `StudentsTab.tsx` and `StudentsTab.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **"Invite (if email)" judgment call — form your own explicit verdict.** Confirm `students`
   genuinely has no email column (read the migration yourself). Judge whether reading (a) (gate on
   `no_account` status, email supplied at invite-time) is the more defensible interpretation of the
   PRD's "Invite (if email)" phrase, or whether this needed a dispute instead of a unilateral
   resolution. Confirm `send-invite`'s real request contract genuinely takes email as input (read
   `supabase/functions/send-invite/validation.ts` yourself).
3. **Account-status derivation — the parent-invite decoy case is the trickiest part, re-verify it
   yourself.** Read `hasPendingSelfInvite`/`deriveAccountStatus` and confirm by source read (not
   just trusting the test) that a `role='parent'` invite targeting a no-account student's id does
   NOT cause that student to show "Invited". Also confirm the `status='expired'` self-invite case
   correctly resolves to `no_account`, not `invited`.
4. **ROS-09 reversibility — the core safety property of this task.** Confirm by source read that
   `withActiveOverride` never removes a row from the data set, only flips a boolean. Confirm the
   dialog copy is genuinely non-destructive-sounding. Reproduce the worker's claimed round-trip test
   yourself or verify it independently.
5. **MoreMenu/popover jsdom finding — verify this is a genuine, correctly-handled testing-
   environment quirk, not a real accessibility defect.** Confirm by reading the installed
   `@astryxdesign/core` `useLayer`/`MoreMenu` source that items really are present in the DOM
   regardless of visual open state (a real, if unusual, implementation detail), and that this does
   NOT mean multiple rows' menus are simultaneously *visible*/*focusable* to a real user or a real
   screen reader — only that a naive DOM query in tests would over-match. Distinguish "test query
   scoping issue" from "real accessibility bug" explicitly.
6. **Astryx prop citations** — spot-check `Table` (confirm the `columns` shape doesn't include
   `sortable`, matching the T056 precedent the worker cites), `PowerSearch`, `Avatar`, `Badge`,
   `StatusDot` (confirm it's paired with visible `Text`, per its own "always pair with a label"
   documented guidance), `MoreMenu`, `AlertDialog` against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** — don't accept "19/19"/"exit 0" without your own
   run. Confirm the transient concurrent-worker failures the worker disclosed are genuinely
   unrelated to this task's own commit.
9. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 6: no PII... test fixtures use fabricated names.
- Standing rule: never fabricate data where a real mapping/source doesn't exist (the team-color-to-
  Badge-variant non-guess is an application of this).

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the "Invite (if email)" judgment call
- explicit verdict on the ROS-09 reversibility claim
- explicit verdict on the MoreMenu/popover jsdom finding (test-scoping issue vs. real a11y defect)
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
