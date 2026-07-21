# Checker Packet: T044 (Leaderboard) — Check Attempt 1

## Task ID
T044 — Leaderboard (OUT-08), Epic E6.

## Checker Agent
checker-reviewer (per task-ledger.md T044 row).

## Objective
Verify a top-10-by-season-hours leaderboard, visible to all roles, sourced from `v_student_hours`
only (constitution item 3, BLOCKER-class), with BLOCKER-class SEC-04/ROS-08 name-format enforcement
when the privacy toggle is ON — and independently judge a real, evidence-driven reversal the worker
made mid-implementation about what the toggle's OFF state actually means.

## Allowed Files (worker's literal permitted edit)
- `src/pages/outreach/Leaderboard.tsx` (new)

**Scope flag**: worker also created `Leaderboard.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`9dc4cbf`) — do NOT
infer authorship from commit messages. Confirm `OutreachList.tsx`, `OutreachEventDialog.tsx`,
`AdminToggles.tsx` (T028, already-Passed) all byte-unchanged — the worker claims it only *read*
`AdminToggles.tsx` as read-only reference, never edited it. Note: the working tree may show other
concurrently-running tasks' untracked files — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Constitution item 3 (BLOCKER-class)**: `topStudentsByHours` claimed a pure sort (descending by
   `confirmedHours`) + `slice(0, 10)` over an already-computed `v_student_hours`-shaped fixture
   value — claims grep-confirmed `hours_override`/`check_in_at`/`check_out_at` appear only inside
   the module doc comment, zero occurrences in executable code.
2. **SEC-04/ROS-08 "First L." format (BLOCKER-class)**: `formatDisplayName` claimed the sole place a
   raw `displayName` is formatted; when privacy is ON (default), returns `"${firstName}
   ${lastInitial}."`. Claims a fixture student with a distinctive last name ("Zephyrine
   Wrzesniewski") proves via test that BOTH `container.textContent` shows "Zephyrine W." AND
   `container.innerHTML` (not just visible text) never contains "Wrzesniewski" — nor any of 9 other
   fixture students' surnames.
3. **THE CENTRAL JUDGMENT CALL — toggle-OFF semantics reversed from the worker's own packet's
   initial framing.** The packet originally suggested "OFF renders full names" as a guess. Worker
   claims it discovered `AdminToggles.tsx` (T028, already-Passed by the time it ran) already exists
   in the repo with real, first-party evidence: its `Switch`'s own `description` text states
   verbatim "Controls whether leaderboard and kiosk surfaces display students' full first name plus
   last initial, **or a fully anonymized identifier**" — meaning OFF is claimed to be MORE private
   (a fixed "Anonymous student" label, zero name-derived data), never a full-name reveal. Worker
   claims it implemented this confirmed reading instead of its own packet's initial guess, citing the
   real source in its module doc.
4. **Fixture design proving `slice(0,10)` is genuinely exercised**: 11 current-season students (one
   past the limit) with the 11th-ranked student claimed provably absent from the DOM; a 12th student
   exists only in a different season with artificially high hours, claimed to prove season-scoping is
   load-bearing.
5. **No role gate at all** — claims the component has zero role-dependent branching (no
   `useAuth`/`RequireRole` import whatsoever), the strongest form of "visible to all roles."
6. Claims 17/17 new tests pass, 426/426 repo-wide; typecheck(scoped)/lint(scoped)/format(scoped)
   clean. Discloses repo-wide build/typecheck failures attributed to other concurrent workers'
   in-progress files (`SeasonSettings.tsx`, transiently `ParentsTab.tsx`/`InvitesTab.tsx`).

## Required Verification Steps
1. **Read `Leaderboard.tsx` and `Leaderboard.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **Constitution item 3 — reproduce the grep yourself.** Confirm `hours_override`/`check_in_at`/
   `check_out_at` genuinely appear only in comments, zero occurrences in executable code. Confirm
   `topStudentsByHours` is genuinely a plain sort+slice with no arithmetic on the hours value itself.
3. **SEC-04/ROS-08 BLOCKER-class name format — this is the single highest-stakes check in this
   packet.** Reproduce the "First L." format test yourself, and specifically confirm the worker's
   claim that `innerHTML` (not just visible text) was checked — a name leaking into an `alt`
   attribute, `title` attribute, or `data-*` attribute would pass a naive textContent-only check but
   still be a real BLOCKER. Grep the rendered output for every fixture student's full last name
   yourself.
4. **THE TOGGLE-OFF SEMANTICS REVERSAL — the central judgment call of this check.** Read
   `AdminToggles.tsx` yourself (read-only) and confirm the cited `Switch` description text genuinely
   says what the worker claims (anonymized identifier when OFF, not full names). Render your own
   explicit verdict: was reversing course based on this real evidence the correct move (versus
   sticking with the packet's original, unconfirmed guess)? Confirm the OFF-state fixed
   "Anonymous student" label is genuinely name-data-free (no first name, no initial, nothing
   derived from `displayName` leaks through even in this state).
5. **Fixture design — reproduce the 11th-student-excluded and different-season-excluded proofs
   yourself.**
6. **No role gate — confirm by source read** that zero `useAuth`/role-branching exists anywhere in
   the file, matching OUT-08's "all roles" requirement.
7. **Astryx prop citations** — spot-check `Section`, `List`/`ListItem`, `Badge`, `Banner`,
   `EmptyState` against `astryx-api.md`.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** (scoped appropriately given concurrent-worker
   noise) — don't accept "17/17"/"426/426" without your own run.
10. **No box-drawing/bracket characters, no fabricated real-looking PII beyond disclosed fixtures**
    — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class): no re-deriving RLS/metric SQL formulas in TypeScript.
- Item 6 (BLOCKER-class per this task's own ledger Acceptance line): no last names when the privacy
  toggle is on — SEC-04/ROS-08.
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the BLOCKER-class name-format enforcement (including the innerHTML check)
- explicit verdict on the toggle-OFF semantics reversal
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
