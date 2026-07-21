# Worker Packet: T023

## Task ID
T023

## Objective
Build `src/pages/roster/StudentDialog.tsx` — the Add/edit student `Dialog` (ROS-03), fields in
this exact order: name, email (optional), team `Selector`, grad year (optional), active `Switch`,
individual goal override `NumberInput` (blank = inherit season default, MET-04).

## Dependencies (status)
- T021 (`/roster` shell), T022 (Students tab) — both Passed. **Read `StudentsTab.tsx` in full
  (read-only)** — it already established the real `StudentRow`/`TeamRow` fixture shapes and the
  account-status derivation this dialog's "email" field interacts with (see Trap #1 below).

## Allowed Files
- `src/pages/roster/StudentDialog.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `StudentDialog.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/roster/StudentsTab.tsx`, `RosterShell.tsx` — already-Passed sibling tasks' files,
  read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `onSubmit`-style callback seam with an obviously-fake default.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`students`: `id`, `profile_id` (nullable), `display_name`, `team_id`, `grad_year` (nullable),
`is_active`, `goal_hours_override` (nullable) — `20260716000000_identity_roster.sql` lines 59-68.
**No `email` column exists on `students`** — same finding `StudentsTab.tsx`/T022 already made and
disclosed (email lives on `profiles`, only present once a student has an account, or is supplied
fresh at invite time).

## Known Context / Traps

**1. THE "email (optional)" FIELD — resolve this against the real schema, don't silently guess.**
ROS-03 literally lists "email (optional)" as a field on the Add/edit student dialog, but `students`
has no email column. Two things ROS-03's "optional" phrasing could mean, given the real schema:
   - This dialog's "email" field is really about *whether to send this student an invite at
     creation time* (i.e., filling it in triggers a follow-up invite flow reusing T017's
     `send-invite`, conceptually similar to what T022's "Invite (if email)" MoreMenu action already
     does after the fact) — leaving it blank just creates the roster row with no account yet
     ("No account" status, same vocabulary `StudentsTab.tsx` established).
   - Read `StudentsTab.tsx`'s own resolution of the parallel "Invite (if email)" ambiguity (Known
     Context/Traps in its packet, and its checker's independent verdict in
     `docs/swarm/archive/T022-checker-packet.md`) for the established precedent/reasoning style
     before deciding your own approach here — you don't have to reach the identical conclusion, but
     your reasoning should engage with that precedent, not ignore it.
   - **Disclose your resolution explicitly.** Do not add a real `students.email` column/migration —
     out of scope for a UI-only task (constitution item 10, and this task's Allowed Files don't
     include `supabase/migrations/**`).

**2. BEH-07 confirm-button copy** — "Add student" when creating, "Save changes" when editing —
never a bare "Submit"/"OK" (checker MAJOR if violated). The dialog must know which mode it's in
(new vs. edit) and switch its own title/button copy accordingly.

**3. MET-04's "blank goal override inherits season default"** — this is a **display/copy**
requirement in this dialog, not a computation you perform. When the `NumberInput` is left blank,
the dialog should say so explicitly (e.g. helper text: "Uses the season default (100 h) if left
blank" — cite the real season default value from your fixture, don't hardcode a guess), and submit
`goal_hours_override: null` (not `0`, not a copied-in default value) — the actual inheritance
happens at read time via MET-04's real formula (`goal_hours_override ?? season.default_goal_hours`),
which lives in `v_student_hours`'s consuming logic elsewhere, not in this dialog.

**4. Team `Selector`** — populate from real `TeamRow`-shaped fixture data (cite
`StudentsTab.tsx`'s established fixture shape), excluding archived teams from the selector options
(same "archived teams disappear from selectors" rule `TeamsTab.tsx`/T026 will also need to respect —
you don't need to coordinate with that task, just apply the same rule here independently).

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Field order matches ROS-03 exactly: name, email, team, grad year, active switch, goal override.
- BEH-07 confirm button copy: "Add student" (create) / "Save changes" (edit), never bare
  "Submit"/"OK".
- Blank goal override submits `null` and is explicitly explained as inheriting the season default
  in the UI copy.
- The "email (optional)" field's real meaning (given no `students.email` column) is explicitly
  investigated and disclosed, engaging with `StudentsTab.tsx`'s precedent.
- Archived teams excluded from the team `Selector`.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T023 (attempt count: 0).

## Required Worker Output
- Full contents of `StudentDialog.tsx`.
- Explicit write-up of the "email (optional)" field resolution and how it engages with
  `StudentsTab.tsx`'s precedent.
- Real test proof of BEH-07 button copy in both create and edit modes.
- Real test proof of blank-goal-override submitting `null`.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
