# Worker Packet: T043

## Task ID
T043

## Objective
Build `src/pages/outreach/ParentRsvp.tsx` — parent RSVP-on-behalf (OUT-06): a parent sets their
linked student's RSVP (`responded_by` attributed to the acting parent's own real profile id); the
student sees "Mom signed you up" (`Timestamp` + responder name) and may change it themselves
afterward.

## Dependencies (status)
- T038 (`/outreach` list) — Passed. Read `OutreachList.tsx` (read-only) for established
  `rsvps`/`guardian_links` fixture conventions.
- T040 (RSVP control) — Passed. **Read `RsvpControl.tsx` in full (read-only)** — this task is
  structurally the parent-facing counterpart of that student-facing control (same
  `SegmentedControl`/status-mapping shape, different `responded_by` attribution and a different
  responder-attribution display). Reuse its established `RsvpRow` shape and status-label mapping
  (`'declined'` ↔ "Can't go") rather than inventing a divergent one. **Critically, also reuse T040's
  now-corrected `responded_by` design**: `rsvps.responded_by` is a real `profiles.id` foreign key
  (confirmed at `20260717000000_scheduling_attendance.sql` line 72:
  `responded_by uuid references public.profiles (id)`), never a literal `'parent'`/`'student'` role
  string — T040's attempt 1 originally got this right after an earlier draft of ITS OWN packet
  mistakenly suggested hardcoding a string, and its checker independently verified the real-profile-
  id design. This task's packet had the same mistaken assumption in an earlier draft (see the
  corrected Ground Truth/Trap #1 below) — do not write a literal `'parent'` string into
  `responded_by` anywhere.

## Allowed Files
- `src/pages/outreach/ParentRsvp.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `ParentRsvp.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/outreach/OutreachList.tsx`, `RsvpControl.tsx`, `OutreachEventDialog.tsx`,
  `OutreachDetail.tsx` — already-Passed/sibling tasks' files, read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `onRsvpChange`-style callback seam with an obviously-fake default.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`rsvps`: `id`, `session_id`, `student_id`, `status` (`'going'|'maybe'|'declined'`), `responded_by`,
`updated_at` — `20260717000000_scheduling_attendance.sql` lines 67-76. `guardian_links`:
`parent_profile_id`, `student_id`, `relationship` — `20260716000000_identity_roster.sql` lines
71-79.

**1. `responded_by` — a real `profiles.id` FK, this is the crux of the whole task.** Confirmed by
direct read of the migration: `responded_by uuid references public.profiles (id)`, nullable, NOT a
role-shaped string. Your component must write `responded_by` as the ACTING PARENT'S OWN real
profile id (from your injectable auth/session seam, same pattern `RsvpControl.tsx` uses for its
`currentUserProfileId` prop) when the parent sets/changes an RSVP. To determine "is this a
parent-set RSVP, and if so, which parent/relationship label to show," you cannot rely on
`responded_by`'s VALUE alone (it's just a profile id, not a role marker) — you must cross-reference
it against `guardian_links` (`parent_profile_id`, `student_id`, `relationship`) to find the matching
link row for `(responded_by, student_id)` and read that row's `relationship` field (e.g. "Mom",
"Dad", "Guardian") for the attribution label. If `responded_by` matches the STUDENT's own profile id
instead of any of their guardians', render the plain/no-attribution display (the student answered
for themself). If `responded_by` is a profile id that matches neither the student nor any of their
guardian_links rows, disclose how you handle that edge case (e.g. a coach recorded it on their
behalf — decide and disclose, don't silently misattribute it as a parent).

**2. Student can override a parent-set RSVP.** This component renders the parent-facing view where a
parent sets/changes their student's RSVP; the acceptance criterion "student can override" refers to
the STUDENT-facing control (T040's `RsvpControl.tsx`, a separate file) correctly allowing a change
regardless of who set the RSVP last — you don't rebuild that here, but your own component's write
path must not somehow lock out a subsequent student-initiated change (e.g. don't add any
parent-only "locking" mechanism not called for by OUT-06's text).

**3. `Timestamp` + responder attribution rendering** — this is a **read-side display concern** this
component should also handle when showing the *current* RSVP state for a session (not just the
write control): if `responded_by='parent'`, show the relationship-labeled attribution + a real
`Timestamp` (from `rsvps.updated_at`); if `responded_by='student'` (or however the student's own
value is represented), show a plain/no-attribution display. Prove both render paths with real tests.

**4. Multiple linked students** — same structural requirement `ParentHome.tsx`/T055 and
`StudentMeetingView.tsx`/T037's parent variant already established: a parent may have more than one
linked student. Decide whether this component is scoped to one student-at-a-time (a reusable
per-student control, likely correct given its narrow Allowed-Files scope) or must itself handle
multiple — state your reasoning; the more likely-correct reading is a single-student-scoped
reusable component that a future page (`ParentHome.tsx`, `OutreachDetail.tsx`) renders once per
linked student.

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Parent can set/change a linked student's RSVP, correctly writing `responded_by` as the acting
  parent's own real profile id (never a literal role string).
- "Mom signed you up" (or the correct relationship label) + `Timestamp` attribution renders
  correctly, derived by cross-referencing `responded_by` against `guardian_links`, with real test
  proof.
- The specific-parent-identity resolution (Known Context/Traps #1) explicitly investigated and
  disclosed, not silently fabricated.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T043 (attempt count: 0).

## Required Worker Output
- Full contents of `ParentRsvp.tsx`.
- Explicit write-up of the `responded_by`-to-specific-parent-identity resolution.
- Real test proof of the attribution display (both `responded_by='parent'` and non-parent cases).
- Explicit write-up of the single-vs-multi-student scoping decision.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
