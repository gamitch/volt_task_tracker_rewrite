# Worker Packet: T024

## Task ID
T024

## Objective
Build `src/pages/roster/InviteParentDialog.tsx` — the Invite parent `Dialog` (ROS-05, invoked from
a student row): email, relationship label, optional additional linked students (`MultiSelector`),
conceptually calling `send-invite` (T017, Passed).

## Dependencies (status)
- T021, T022 (Passed). Read `StudentsTab.tsx` (read-only) for established fixture conventions.
- T017 (`send-invite` Edge Function) — Passed. **Read
  `supabase/functions/send-invite/index.ts`/`validation.ts` in full (read-only)** — this dialog's
  submission should be modeled on that function's real request contract (email, role, student_id),
  not invented independently. You are not calling it directly (no shared client exists yet) — build
  against an injectable callback seam shaped to match its real contract.

## Allowed Files
- `src/pages/roster/InviteParentDialog.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `InviteParentDialog.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/roster/StudentsTab.tsx`, `RosterShell.tsx` — already-Passed sibling tasks' files,
  read-only reference only.
- `supabase/functions/send-invite/**` — read-only reference only, do not edit or call directly.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`invites`: `email`, `role`, `student_id` (nullable — self for students, linked child for parents),
`status`, `expires_at` — `20260717000000_scheduling_attendance.sql` lines 18-27.
`guardian_links`: `parent_profile_id`, `student_id`, `relationship`, unique per pair —
`20260716000000_identity_roster.sql` lines 71-79.

## Known Context / Traps

**1. This dialog creates an `invites` row with `role='parent'`, `student_id` = the invoking
student's id — the "primary" link.** The optional `MultiSelector` of "additional linked students"
represents creating additional `guardian_links` rows (or additional invite associations — your call
how you model this against `guardian_links`'s real one-`student_id`-per-invite-row shape; since
`invites.student_id` is a single nullable FK, not an array, decide and disclose how "additional
linked students" is represented in your submission payload — e.g. one invite + N additional
guardian-link-creation entries, since `guardian_links` itself supports many-to-many). Do not
silently assume a data shape the schema can't actually represent — investigate and disclose.

**2. BEH-07 confirm button**: "Send invite" (not bare "Submit"/"OK").

**3. DES-14 toast copy**: "Invite sent to …" (with the actual email interpolated) — cite this exact
phrasing, not a paraphrase.

**4. Relationship label is required** — real client-side validation, disabled submit until filled
(this dialog's own acceptance criterion, checker-enforced).

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Fields per ROS-05: email, relationship label (required), optional additional-linked-students
  `MultiSelector`.
- BEH-07 confirm button: "Send invite".
- DES-14 toast: "Invite sent to {email}" on success.
- Submission payload modeled on `send-invite`'s real contract (cited file+line).
- The "additional linked students" data-shape question explicitly investigated and disclosed.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T024 (attempt count: 0).

## Required Worker Output
- Full contents of `InviteParentDialog.tsx`.
- Explicit write-up of the "additional linked students" data-shape decision.
- Real test proof of the required-relationship-label validation and the BEH-07/DES-14 copy.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
