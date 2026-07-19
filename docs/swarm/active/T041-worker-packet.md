# Worker Packet: T041

## Task ID
T041

## Objective
Build `src/pages/outreach/OutreachDetail.tsx` — `/outreach/:eventId` (OUT-04): `MetadataList`
(when/where/scope/creator), per-session signup lists grouped Going/Maybe/Can't go/No response, a
plain Google Maps link built from the address, edit/cancel via `MoreMenu`, and a NAV-08 "Copy link"
action.

## Dependencies (status)
- T038 (`/outreach` list) — Passed. Read `OutreachList.tsx` (read-only) for established fixture
  conventions (`events`/`event_sessions`/`rsvps` shapes).
- T039 (event dialog), T040 (RSVP control) — **listed as this task's ledger dependencies; may or may
  not be Passed by the time you're dispatched.** If Passed, read `OutreachEventDialog.tsx`/
  `RsvpControl.tsx` (read-only) for their established conventions and cite them. If not yet Passed,
  build against `OutreachList.tsx`'s existing shapes and disclose that you did so — do not block on
  or wait for those files.

## Allowed Files
- `src/pages/outreach/OutreachDetail.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `OutreachDetail.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachEventDialog.tsx`, `RsvpControl.tsx` —
  already-Passed/sibling tasks' files, read-only reference only.
- `src/pages/outreach/MarkDayCompleteDialog.tsx`, `ParentRsvp.tsx`, `Leaderboard.tsx` — separate,
  not-yet-built tasks (T042, T043, T044). Render obvious stub actions (disclosure Banner) for
  "edit"/"cancel" via the `MoreMenu`, not real dialogs.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only. `/outreach/:eventId` is
  already wired (`RequireAuth` only) to an inline placeholder — this task does not wire itself in.
- `src/lib/supabase/**` — read-only reference only, do not import directly.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`events`: `id`, `season_id`, `type`, `title`, `description`, `location_name`, `location_address`
(confirm exact column name yourself — read the migration), `team_ids` (nullable array),
`created_by`, `counts_participation`, `counts_volunteer_hours` —
`20260717000000_scheduling_attendance.sql` lines 33-48.
`rsvps`: `session_id`, `student_id`, `status` (`'going'|'maybe'|'declined'`), `responded_by` — same
file, lines 67-76. "No response" (the fourth grouping bucket) is a UI-derived category — a student
with NO `rsvps` row at all for that session — not a stored enum value; derive it, don't invent a
fourth database status.

## Known Context / Traps

**1. NAV-08 — invalid/inaccessible IDs render the DES-12 error state, revealing nothing about the
event.** This is a real, checker-scrutinized security-adjacent requirement: an invalid `eventId` (or
one the current viewer isn't authorized to see, once real RLS/auth is wired) must render a generic
"not found"-style error, never a partial render that leaks the event's title/location/attendee list
before failing. Since no shared Supabase client exists yet, prove this with your fixture-loader
seam: a "not found" fixture result must render the DES-12 error state and nothing else — no
`MetadataList`, no signup lists, no other event data anywhere in the DOM.

**2. NAV-08 Copy link — `Toast` "Link copied", verbatim.** The copied value should be the real,
constructible URL for this event (`/outreach/:eventId` with the real id interpolated), even though
no real clipboard-integration test can prove an OS-level clipboard write in this environment — test
what's testable (the toast fires, the URL string constructed is correct) and disclose the clipboard-
API limitation honestly rather than fabricating a clipboard-read-back assertion.

**3. Map link is a PLAIN Google Maps URL built from the address** — not an embedded map/iframe, not
a fancier maps SDK integration. `https://www.google.com/maps/search/?api=1&query=<url-encoded
address>` (or equivalent well-known plain-URL pattern) is the right shape — cite your exact URL
construction and make sure the address is properly URL-encoded (no raw spaces/special characters
breaking the link).

**4. Grouped signup lists (Going/Maybe/Can't go/No response)** — per-session, not per-event (an
event may have multiple `event_sessions`). Decide and disclose whether you group signup lists once
per event (flattening all sessions) or per-session (nested), based on your read of OUT-04's intent —
the PRD phrase "per-session signup lists" suggests per-session grouping is correct; state this
explicitly rather than silently flattening.

**5. Edit/Cancel `MoreMenu` stubs** — obvious disclosure banners, per Forbidden Files.

**6. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- `MetadataList` shows when/where/scope/creator.
- Per-session signup lists correctly grouped Going/Maybe/Can't go/No response (No response
  correctly derived, not a fabricated database value).
- Plain Google Maps link correctly URL-encoded from the address.
- Invalid/inaccessible IDs render DES-12's error state and reveal nothing else — proven with a
  fixture test.
- Copy link fires `Toast` "Link copied" with the correct constructed URL.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T041 (attempt count: 0).

## Required Worker Output
- Full contents of `OutreachDetail.tsx`.
- Real test proof of the invalid-ID DES-12 error state revealing nothing else.
- Real test proof of the Copy link toast and correct URL construction.
- Explicit write-up of the per-session-vs-per-event grouping decision.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
