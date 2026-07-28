# Worker Packet: T022

## Task ID
T022

## Objective
Build `src/pages/roster/StudentsTab.tsx` — the Students tab (ROS-02): `Table` + `PowerSearch`
(search by name; filter by team, account status, active), columns: `Avatar`+name, team `Badge`,
grad year, account status (`StatusDot`: Active / Invited / No account), goal override, row
`MoreMenu` → Edit, Invite (if email), Invite parent, Deactivate (`AlertDialog`), View history.

## Dependencies (status)
- T021 (`/roster` shell + TabList) — Passed. `RosterShell.tsx` renders an `EmptyState` placeholder
  in the Students tab panel naming this task — read it (read-only, do not edit) to see the exact
  slot this component is meant to eventually fill. You are NOT wiring `StudentsTab.tsx` into
  `RosterShell.tsx` in this task (that file is forbidden) — build the standalone component.
- T009 (identity/roster migration) — Passed. Ground truth for the real `students`/`teams`/
  `profiles`/`invites` schema.

## Allowed Files
- `src/pages/roster/StudentsTab.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `StudentsTab.test.tsx` is acceptable per established precedent (same reasoning as
  every prior single-file-Allowed-Files content-page task) — disclose it, don't ask permission.

## Forbidden Files
- `src/pages/roster/RosterShell.tsx` — already-Passed task's file, read-only.
- `src/pages/roster/StudentDialog.tsx`, `InviteParentDialog.tsx` — separate, currently-Ready-but-
  not-yet-dispatched tasks (T023, T024). Render obvious "Edit"/"Invite parent" menu items that show
  a disclosure Banner (same stub pattern T030 used for its own out-of-scope actions) rather than
  opening real dialogs. Do not build their real form/submission behavior here.
- `src/app/router.tsx`, `src/app/guards.tsx` — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import. Build against an injectable
  `loadData`-style seam with obviously-fake fixture defaults, same posture as every prior content
  page.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `students`: `id`, `profile_id` (nullable, references `profiles`), `display_name`, `team_id`,
  `grad_year` (nullable), `is_active`, `goal_hours_override` (nullable) —
  `supabase/migrations/20260716000000_identity_roster.sql` lines 59-68.
- `teams`, `profiles`, `invites` — same file / `supabase/migrations/20260717000000_scheduling_attendance.sql`
  (`invites`: `email`, `role`, `student_id` nullable — self for students, linked for parents).

## Known Context / Traps

**1. THE "Invite (if email)" CONDITION IS GENUINELY AMBIGUOUS — investigate and disclose, don't
silently guess.** The PRD's ROS-02 spec (`docs/swarm/VOLT_Portal_PRD.md` line 334) says the row
`MoreMenu` shows "Invite (if email)" as one option. But `students` has **no email column at all** —
email only exists on `profiles` (via `profile_id`, only set once a student has an account) or on a
pending `invites` row (`invites.email`, targeting `invites.student_id`). Two plausible readings:
  - (a) "Invite" is shown whenever account status is "No account" (i.e., no `profile_id` AND no
    pending `invites` row) — the coach supplies the email in the invite dialog itself (T017's
    `send-invite` flow already takes an email as input), so "if email" might be a PRD-writer's
    shorthand for "assuming you're about to type one in," not a precondition sourced from existing
    data.
  - (b) There's a genuine schema gap: ROS-02 assumes a `students.email` (or similar) field that
    doesn't exist in this project's actual migrations.
  **Pick the more defensible reading (almost certainly (a) — it requires no schema change and
  matches how invites work everywhere else in this codebase), implement it, and state your
  reasoning explicitly in your output as a disclosed judgment call**, not a silent assumption. Do
  not invent a new `students.email` column or migration to "solve" this — that would be
  overreach for a UI task.

**2. Account status `StatusDot` — three real states, derive them correctly.** "Active" = has a
`profile_id`. "Invited" = no `profile_id` but a pending (`status='pending'`) `invites` row exists
targeting this student. "No account" = neither. Since no shared Supabase client exists yet (Trap
#3), your fixture data must model all three states explicitly and your derivation logic must be a
pure function of (profile_id present?, matching pending invite present?) — testable independent of
the fixture.

**3. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page (T030, T038, T056, etc.) — build against an injectable
`loadData`-style seam with obviously-fake fixture defaults, typed against the real schema above.

**4. ROS-09 — Deactivate must be disclosed correctly, not just implemented as a delete.**
Deactivating a student removes them from future expected rosters/leaderboards but preserves history
and metrics for sessions while active. Your `Deactivate` action (via `AlertDialog`, DES-11) should
be understood/labeled as flipping `is_active` to `false`, never as a destructive delete — make sure
your copy and your fixture-mutation logic reflect this (no row removal from the table view either;
per PRD wording, deactivated students still show up on the roster with `is_active=false`, just
excluded from *future* expected-roster/leaderboard computations elsewhere in the app).

**5. `PowerSearch` filters must cover all three axes named in ROS-02**: name (search), team, account
status, active. Don't drop the active/inactive filter in favor of just the account-status one.

## Acceptance Criteria
- All ROS-02 columns present: `Avatar`+name, team `Badge`, grad year, account-status `StatusDot`,
  goal override, `MoreMenu`.
- `PowerSearch` supports name/team/status/active filters.
- Deactivate uses a real `AlertDialog` (DES-11), correctly framed as a reversible state flip, not a
  delete.
- Edit / Invite parent stubbed with honest disclosure banners (not fake dialogs), per Forbidden
  Files.
- "Invite (if email)" condition resolved and explicitly disclosed per Known Context/Traps #1.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T022 (attempt count: 0).

## Required Worker Output
- Full contents of `StudentsTab.tsx`.
- Explicit write-up of the "Invite (if email)" judgment call and your reasoning.
- Explicit write-up of the account-status derivation logic and a real test proving all three states
  render correctly.
- Real proof of the Deactivate `AlertDialog` flow (open/confirm → `is_active` flips, row stays
  visible with updated status, not removed).
- Astryx prop citations for every component used (`Table`, `PowerSearch`, `Avatar`, `Badge`,
  `StatusDot`, `MoreMenu`, `AlertDialog` — grep `astryx-api.md` yourself, don't guess).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
