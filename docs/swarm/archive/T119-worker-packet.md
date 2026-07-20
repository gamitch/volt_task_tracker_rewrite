# Worker Packet: T119

## Task ID
T119 — PRD v2 D-7 (George's direct decision): remove the self-authored
protection rules; the coach is the ultimate authority over RSVPs and
attendance.

## Objective
T117/T118 shipped (checker-verified) with protection rules George has now
explicitly overridden: "As coach I am ultimate authority and should be able to
overwrite an RSVP or check-ins." Implement PRD v2 §0 D-7 exactly (read it
first — it is the authority for this task):
1. **RSVP fan-out (`computeExpectedAttendeeRsvpPlan`, `loaders/outreach.ts`):**
   checked student → upsert `'going'` for every session **regardless of prior
   author or status** (a self-authored `'declined'` becomes `'going'`,
   `responded_by` becomes the acting coach). Unchecked → **delete `'going'`
   rows regardless of author** (self-authored included). Rows whose status is
   `'declined'`/`'maybe'` are left alone by an uncheck (per D-7: "not
   expected" ≠ "they answered no"). Remove the `selfAuthoredKeys` machinery.
2. **Attendance un-mark (`resolveUnmarkAction`, `loaders/attendance.ts` +
   `AttendancePanel.tsx`):** uncheck → plain DELETE for every `method`
   (`'coach'`, `'qr'`, `'import'`). Remove the setAbsent branch and
   `resolveUnmarkAction` itself if nothing else needs it (checked-row
   provenance preservation in `resolveAttendanceWriteMethod` — keeping
   `method:'qr'` verbatim when a coach edits hours on a checked QR row — is
   NOT overridden; leave it, it's labeling, not veto).

## Allowed Files
- `src/lib/supabase/loaders/outreach.ts`
- `src/pages/outreach/OutreachEventDialog.tsx`, `OutreachEventDialog.test.tsx`
- `src/lib/supabase/loaders/attendance.ts`
- `src/pages/outreach/AttendancePanel.tsx`, `AttendancePanel.test.tsx`

## Forbidden Files
- `supabase/**`, `docs/swarm/**` (the PRD D-7 edit is already made by the
  architect), everything else.

## Known Context / Traps
**1. Update the module docs honestly.** Both loaders carry long module-doc
sections describing the now-removed protection rules — rewrite them to state
D-7's rules and cite D-7 with George's decision date; preserve history with a
dated amendment note (repo convention), don't silently delete the reasoning.
**2. Tests flip, not vanish.** The tests that asserted "self-authored never
deleted/overwritten" must become tests asserting the NEW rules (self-declined
overwritten to going on check; self-authored 'going' deleted on uncheck;
declined/maybe untouched by uncheck; QR row hard-deleted on attendance
uncheck). Do not simply delete assertions — invert them so the new behavior is
pinned.
**3. Keep what D-7 keeps.** `responded_by`/`recorded_by` attribution stays
(feed visibility); `resolveAttendanceWriteMethod`'s provenance-preserving
method on checked-row edits stays; timestamps-never-in-payload discipline for
upserts stays (still correct PostgREST hygiene for the checked-row edit path).
**4. Gates.** All five clean; full suite; zero regressions elsewhere.

## Acceptance Criteria
D-7's rules implemented verbatim, module docs amended with dated notes, tests
pin the new behavior (including the three inversions), all gates green.

## Most Recent Failure
None. Attempt 1. HIGH PRIORITY — direct product-owner override of shipped
behavior.

## Required Worker Output
Full diff; before/after rule table in your own words; full gate output; risks.
