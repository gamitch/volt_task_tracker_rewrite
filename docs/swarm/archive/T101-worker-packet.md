# Worker Packet: T101

## Task ID
T101 — ED-1 Packet P10 (expanded scope): real Outreach data + mutations, including
wiring `OutreachEventDialog` for the first time.

## Objective
Same recurring class of gap found in `RosterShell`/`StudentsTab`/`MeetingsList`:
`OutreachList.tsx`'s "Event creation" and `OutreachDetail.tsx`'s "Edit"/"Cancel"
actions are pure stub notices, even though `OutreachEventDialog.tsx` already exists
with a real `onSaveEvent` seam — nobody wired the two together. This packet: (1) real
loads for `OutreachList`/`OutreachDetail`, (2) real RSVP mutations
(`RsvpControl`/`ParentRsvp`), (3) a real Mark-Day-Complete mutation, (4) a real Cancel
mutation, and (5) wiring `OutreachEventDialog` into both list and detail pages for
create/edit.

## Allowed Files
- `src/lib/supabase/loaders/outreach.ts` (new)
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`
- `src/pages/outreach/OutreachDetail.tsx`, `OutreachDetail.test.tsx`
- `src/pages/outreach/RsvpControl.tsx`, `RsvpControl.test.tsx`
- `src/pages/outreach/ParentRsvp.tsx`, `ParentRsvp.test.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.tsx`, `MarkDayCompleteDialog.test.tsx`

## Forbidden Files
- `src/pages/outreach/OutreachEventDialog.tsx` — already correct, read-only import
  (render it from `OutreachList`/`OutreachDetail`, do not modify its internals).
- `src/pages/outreach/Leaderboard.tsx` — a separate future packet (P11), do not touch.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Real loads.** `LoadOutreachDataFn = (seasonId: string) =>
Promise<OutreachLoadResult>` (`OutreachList.tsx`'s own list view — real `events`
filtered to outreach type, joined with `rsvps` for the caller's own status). Verify the
exact `events.event_type`/equivalent filter condition against the real schema, don't
assume the column name. `LoadOutreachDetailFn = (eventId: string) =>
Promise<OutreachDetailData | null>` — real single-event detail load, `null` for a
genuinely nonexistent/inaccessible event (RLS-honest, not a fabricated fallback).

**2. RSVP mutations — `RsvpControl.tsx`/`ParentRsvp.tsx`, `OnRsvpChangeFn`.** Real
`rsvps` upsert keyed on `(session_id, student_id)` with `responded_by = auth.uid()` —
the with-check policy on this table requires that field, a rejected write is a real
42501-class error, not something to retry-loop around (surface it via the existing
`SupabaseLoaderError.message` pattern). Both files declare the same
`OnRsvpChangeFn` type independently — investigate whether they can now share one real
implementation in `loaders/outreach.ts` (both ultimately do the same upsert) or whether
a genuine difference (parent acting on behalf of a linked student vs. a student acting
for themselves) requires two distinct real functions; document your decision.

**3. Mark Day Complete — `MarkDayCompleteDialog.tsx`, `OnMarkDayCompleteFn`.** Real
`event_sessions` update (status → `'completed'`, plus whatever `MarkDayCompletePayload`
fields the dialog collects — read the file for the exact payload shape, likely
`peopleReached`/`notes` matching the real `not null` columns).

**4. Cancel — `OutreachDetail.tsx`'s `showCancelStub`.** Its own stub copy already
correctly describes the real mechanism: flip `event_sessions.status` to `'canceled'`.
Wire this for real, same optimistic-flip-plus-rollback shape used everywhere else in
this codebase now (mirror `MeetingsList.tsx`'s T096 cancel wiring as the direct
precedent).

**5. Wire `OutreachEventDialog` for create (from `OutreachList`) and edit (from
`OutreachDetail`).** Unlike `ScheduleMeetingsDialog` (which T096 found genuinely has no
edit-mode capability), **investigate `OutreachEventDialog.tsx`'s own props/payload shape
first** before assuming either way — it may or may not support editing an existing
event. If it does, wire both create and edit for real. If it genuinely doesn't (same
class of finding as T096's Trap #3), leave Edit as an honestly-worded stub explaining
the real limitation, not the old generic "dialog not built yet" text, and document your
investigation the same way T096 did.

**6. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet, across all five files.

## Acceptance Criteria
- `OutreachList`/`OutreachDetail`'s loads are real.
- RSVP, Mark Day Complete, and Cancel are all real mutations with proper rollback where
  optimistic, surfacing real errors via `SupabaseLoaderError.message`.
- `OutreachEventDialog` is genuinely wired for create; wired for edit if the dialog
  supports it, otherwise left as an honestly-worded stub with documented reasoning.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T101 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your RSVP shared-vs-separate-function decision (Trap #2) and reasoning.
- Your `OutreachEventDialog` edit-mode investigation and decision (Trap #5), in full.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
