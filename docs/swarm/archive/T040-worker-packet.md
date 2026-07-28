# Worker Packet: T040

## Task ID
T040

## Objective
Build `src/pages/outreach/RsvpControl.tsx` — a standalone, reusable RSVP `SegmentedControl`
[Sign up|Maybe|Can't go] → writes `rsvps.status`, `responded_by` attributed to the student
themself (OUT-03). Editable until session start; helper text per BEH-09 ("You can change this
until the event starts").

## Dependencies (status)
- T038 (`/outreach` list) — Passed. **Read `OutreachList.tsx` in full (read-only) before writing any
  code.** It already ships an inline, stub-quality per-row RSVP `SegmentedControl` for its own list
  view, with an explicit module-doc note that "the fuller, validated, server-persisted flow belongs
  to `RsvpControl.tsx`" (this task). Your job is to build the real, standalone, reusable version —
  match its `RsvpRow`/`rsvps` fixture shape (cited from the real schema at its lines 26 area) rather
  than inventing a different one, so a future wiring task can swap `OutreachList.tsx`'s inline stub
  for your real component with minimal friction.
- T039 (New/edit outreach event dialog) — Passed. Read `OutreachEventDialog.tsx` (read-only) for the
  real `event_sessions`/session-timing fixture shapes it establishes, and use the same conventions.

## Allowed Files
- `src/pages/outreach/RsvpControl.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `RsvpControl.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachEventDialog.tsx` — already-Passed/sibling tasks'
  files, read-only reference only.
- `src/pages/outreach/OutreachDetail.tsx`, `ParentRsvp.tsx` — separate, not-yet-built tasks (T041,
  T043). This component should be usable BY those future tasks (export it cleanly), but don't build
  their pages here.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `onRsvpChange`-style callback seam with an obviously-fake default.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`rsvps`: `id`, `session_id`, `student_id`, `status` (check: `'going'|'maybe'|'declined'`),
`responded_by`, `updated_at`, unique `(session_id, student_id)` —
`20260717000000_scheduling_attendance.sql` lines 67-76. Note the real enum uses `'declined'`, not
literally "can't go" — that's the UI label, not the stored value; map the `SegmentedControl`'s
third option's *label* ("Can't go") to the stored value `'declined'` and disclose this mapping
explicitly (a subtle label-vs-value mismatch worth getting right and citing).

## Known Context / Traps

**1. "Editable until session start" — a real, testable time-boundary, not just documentation.**
Once `event_sessions.starts_at` has passed, the control must lock (become non-interactive, with
clear "locked" messaging — your call on exact copy, disclose it). Prove the boundary: a session
starting in 1 minute is still editable; one that started 1 minute ago is locked.

**2. BEH-09 helper text is a literal, specific copy pattern**: "You can change this until the event
starts" — use it verbatim (or the session-specific variant if you choose to interpolate a date/time,
disclose your choice), not a paraphrase. Confirmation states the next system event per the same
BEH-09 rule (e.g. "we'll remind you 2 days before" — this project's reminder system, T051, is not
yet built; state this copy as a **static, honest** confirmation line describing the intended future
behavior, not a claim that a real reminder is actually scheduled).

**3. `responded_by` — a real `profiles` foreign key, NOT a literal string.** Read the column
definition yourself (`20260717000000_scheduling_attendance.sql` lines 65-74): `responded_by` is
`uuid references public.profiles (id)`, nullable — there is no `'student'`/`'parent'` text value
anywhere in this column. This component is specifically the student's own RSVP control (not the
parent's — that's T043's separate `ParentRsvp.tsx`), so your `onRsvpChange`-style callback should
pass whatever the current student's own profile id is (from your injectable auth/session seam, same
pattern every other page task in this batch uses) — representing "this student answered for
themself" via a real id, not a hardcoded role string. Disclose how you represent this given no
shared Supabase client/auth context is wired in yet.

**4. Reuse `OutreachList.tsx`'s established `RsvpRow`/fixture shape** rather than inventing your own,
per Dependencies above — this reduces the friction of the eventual wiring task that consolidates the
two.

## Acceptance Criteria
- `SegmentedControl` [Sign up|Maybe|Can't go] correctly mapped to `rsvps.status`
  (`'going'|'maybe'|'declined'`), `responded_by` always attributed to the acting student's own
  real profile id (never a literal role string).
- Editable-until-session-start boundary correctly enforced and tested.
- BEH-09 helper text and next-system-event confirmation present, honest about T051 not existing yet.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

## Most Recent Failure
None. This is attempt 1 for T040 (attempt count: 0).

## Required Worker Output
- Full contents of `RsvpControl.tsx`.
- Explicit write-up of the label-vs-stored-value mapping (`'Can't go'` → `'declined'`).
- Real test proof of the session-start lock boundary.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
