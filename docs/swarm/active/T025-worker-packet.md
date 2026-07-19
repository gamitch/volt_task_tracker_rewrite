# Worker Packet: T025

## Task ID
T025

## Objective
Build `src/pages/roster/ParentsTab.tsx` — the Parents tab (ROS-04): parent rows with linked-student
`AvatarGroup`, invite status, row `MoreMenu` → Edit links, Resend invite, Remove (unlink + deactivate
profile, `AlertDialog`).

## Dependencies (status)
- T021 (`/roster` shell) — Passed. Read `RosterShell.tsx` (read-only) for the placeholder slot this
  fills and the established `RequireRole`-nesting pattern.
- T022 (Students tab) — Passed. **Read `StudentsTab.tsx` in full (read-only)** — it already
  established the account-status derivation idiom (`profile_id`/pending-invite logic) and the
  reversible-deactivate `AlertDialog` pattern this task should reuse/match, not reinvent differently.

## Allowed Files
- `src/pages/roster/ParentsTab.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `ParentsTab.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/roster/RosterShell.tsx`, `StudentsTab.tsx` — already-Passed sibling tasks' files,
  read-only reference only.
- `src/pages/roster/StudentDialog.tsx`, `InviteParentDialog.tsx` — separate, currently-Ready tasks
  (T023, T024). Render an obvious "Edit links" stub (disclosure Banner) — do not build a real
  edit-linked-students dialog here.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadData`-style seam with obviously-fake fixture defaults.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `profiles`: `id`, `display_name`, `email`, `role`, `avatar_url`, `theme_mode` —
  `20260716000000_identity_roster.sql` lines 15-23.
- `guardian_links`: `id`, `parent_profile_id`, `student_id`, `relationship`, unique
  `(parent_profile_id, student_id)` — same file, lines 71-79. A parent (`profiles.role='parent'`)
  may link to multiple students.
- `invites`: `email`, `role`, `student_id` (nullable — self for students, linked child for parents),
  `status`, `expires_at` — `20260717000000_scheduling_attendance.sql` lines 18-27.

## Known Context / Traps

**1. SEC-01 — email/contact info visible only to admin/coach and the owner.** This tab is
coach/admin-only (component-level `RequireRole`, same pattern `RosterShell.tsx`/`StudentsTab.tsx`
established, since `router.tsx`'s route-level gate gap is the same recurring, already-disclosed
issue every prior content page has hit), so showing parent emails here is correct per SEC-01 — no
extra masking needed for the coach/admin viewer. Do not add gratuitous PII beyond what ROS-04 asks
for (name, linked students, invite status), and never render a parent's email anywhere a student or
another parent could see it (there's no such surface in this task, but state this explicitly as the
reasoning, not an assumption).

**2. "Remove" = unlink + deactivate profile — this is a compound, two-effect action, not a simple
delete.** Per ROS-04's literal text, Remove both (a) removes the specific `guardian_links` row
(unlinking that parent from that student — a parent with multiple linked students who is removed
from only one loses only that link) and (b) deactivates the parent's own `profiles` row entirely if
this was their last/only link (your call on the exact multi-link interaction — disclose your
reasoning; ROS-04's text doesn't specify what happens to a parent's account status when they still
have other linked students after one removal). This is NOT the same "flip `is_active`" pattern
`StudentsTab.tsx`'s ROS-09 Deactivate used (that's a `students.is_active` flip; there is no
`profiles.is_active` column at all — check the real schema yourself and disclose what field/approach
you use to represent "deactivated" for a parent profile, since it may not literally exist as a
column). Confirm via `20260716000000_identity_roster.sql` whether `profiles` has any active/inactive
concept, and flag explicitly if none exists (a genuine schema gap, same class of finding T009's
MINOR follow-ups already established a precedent for).

**3. Remove confirms via a real `AlertDialog` (DES-11)** — copy should clearly state both effects
(unlink + deactivate), not just one.

**4. Resend invite** — a real, working stub-style action against the `invites` row targeting this
parent (role='parent'), same posture as every other not-yet-wired-to-Supabase action in this batch
(injectable callback, obviously-fake default).

**5. `AvatarGroup` for linked students** — cite `astryx-api.md`'s real props; if a parent has zero
linked students (an edge case worth handling), render sensibly (empty state within the row, not a
broken/empty `AvatarGroup`).

**6. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Parent rows show linked-student `AvatarGroup`, invite status, `MoreMenu` → Edit links (stub),
  Resend invite, Remove.
- Remove confirms via a real `AlertDialog` (DES-11) whose copy accurately describes both effects.
- SEC-01 respected — no PII leakage beyond what a coach/admin viewer is entitled to see.
- The "deactivate profile" mechanism is either correctly implemented against a real schema field, or
  the absence of such a field is explicitly flagged as a schema gap.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T025 (attempt count: 0).

## Required Worker Output
- Full contents of `ParentsTab.tsx`.
- Explicit write-up of the Remove/unlink+deactivate mechanism and whatever schema gap you found or
  didn't find.
- Real test proof of the AlertDialog Remove flow and of multi-linked-student `AvatarGroup` rendering.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
