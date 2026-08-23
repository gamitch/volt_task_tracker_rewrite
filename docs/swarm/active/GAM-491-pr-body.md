Closes GAM-491

**DRAFT — opened early per `AGENTS.md` wall 3.** The PR credential this run holds
expires 60 minutes after job start (`exp` decoded at minute 1), so the PR is
opened while the branch carries only its run log, and pushed into afterwards.
This body is finalized before the draft flag is cleared.

## What changed

*(to be filled in when the work lands — see `docs/swarm/active/GAM-491-run-log.md`
for the live state of this run)*

## Tier, stated and defended

**STANDARD, with a required acceptance checker** (constitution item 26; tiered
under item 28d as part of claiming, because the row arrived `tier/unreviewed`).

Measured against `main` at `8f6b6a6f` rather than taken from the issue text:

- No unconditional HEAVY trigger applies. The change is one read-only loader plus
  three props at one call site — no migration, no RLS or `security definer`
  helper, no auth/session/role-resolution change, no metric SQL, and no write
  path at all. The issue's own constraint is that `setAttendanceStatus` and
  `clearAttendanceStatus` stay untouched, so nothing here can overwrite, clear or
  null a persisted field.
- No contract change. `SessionRosterEntry`, `roster`, `isRosterLoading` and
  `rosterError` already exist and are exported (`src/pages/meetings/coach/SchedulePanel.tsx:178`,
  `:209-215`). This ticket supplies those props; it does not redefine them, so the
  frozen-contract trigger does not fire.
- The read seam is established, not novel: `src/lib/supabase/loaders/kiosk.ts:460`
  and `src/lib/supabase/loaders/endMeeting.ts:339` already read `students` +
  `attendance` for a single session on the coach path.
- The losing argument was HEAVY on "reports a user's own persisted records."
  Item 26 answers it explicitly: *presenting* values through an already-settled
  source-of-truth contract "is not this trigger — it routes to STANDARD with its
  required checker." The attendance contract is settled; this ticket reads it.
- A checker is required all the same, on three of item 26's STANDARD triggers:
  role-sensitive presentation (a coach seeing a student roster), user-data
  reporting whose mapping could mislead (each student's own attendance status),
  and constitution item 6 — first name + last initial, never a full name.

## Verification

*(gate-run evidence block and mutations table to be pasted verbatim before the
draft flag clears)*

Linear-Issue: GAM-491
