# Worker Packet: T047

## Task ID
T047 — `ics` Edge Function via `ical-generator` (CAL-04/05), Epic E7.

## Objective
Build `supabase/functions/ics/**`: `GET /functions/v1/ics?token=<uuid>` returning `text/calendar`,
correctly role-scoped, using the `ical-generator` npm package — never a hand-built VCALENDAR
string.

## Dependencies (status)
- T010 (scheduling/attendance migration) — Passed. Ground truth for `events`/`event_sessions`/
  `rsvps` schema, see below.
- T045 (`/calendar` page), T046 (Subscribe popover) — Passed/parallel. Not directly consumed (this
  is a backend-only Edge Function with no frontend import), but both establish the same CAL-03/04
  URL-shape expectations — no coordination needed beyond both citing the same real route path
  (`/functions/v1/ics?token=<uuid>`).
- **Read `supabase/functions/checkin/index.ts` in full (read-only) before writing anything** — it
  is the established, already-Passed-and-checked pattern for an Edge Function that accepts
  UNAUTHENTICATED, token-validated requests and uses the service-role client internally (PRD 8.3's
  own literal wording: "no `anon` access except the `ics` and `checkin` Edge Functions"). Reuse its
  CORS-headers/`jsonResponse`/error-shape conventions where they make sense for this function too
  (adapted for a `text/calendar` response instead of JSON).

## Allowed Files
- `supabase/functions/ics/**` (new directory — confirm via `Glob` it doesn't exist yet)

## Forbidden Files
- `supabase/functions/checkin/**`, `send-invite/**` — read-only reference only, do not edit.
- `src/pages/calendar/**` — read-only reference only (no frontend work in this task).
- `supabase/migrations/**` — read-only. `calendar_feeds` already has everything this function
  needs (`token`, `profile_id`, `revoked_at`) — do not add a migration.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `calendar_feeds`: `id`, `profile_id` (fk profiles), `token` (uuid, unique), `revoked_at`
  (nullable) — `20260717000001_support_audit.sql` lines 45-52.
- `profiles`: `id`, `role` (`'admin'|'coach'|'student'|'parent'`) —
  `20260716000000_identity_roster.sql`.
- `students`: `id`, `profile_id`, `team_id` — same migration.
- `guardian_links`: `parent_profile_id`, `student_id` — same migration, for parent role-scoping.
- `events`: `id`, `season_id`, `type`, `title`, `location_name`, `address`, `team_ids` (nullable
  array = all teams) — `20260717000000_scheduling_attendance.sql` lines 29-46.
- `event_sessions`: `id`, `event_id`, `starts_at`, `ends_at`, `status`
  (`'scheduled'|'completed'|'canceled'`) — same migration, lines 51-63.
- `rsvps`: `session_id`, `student_id`, `status` — same migration, lines 65-74 (needed for
  "DESCRIPTION includes RSVP status when applicable").

## Known Context / Traps

**1. `ical-generator` is REQUIRED — hand-built VCALENDAR strings are a checker BLOCKER (CAL-04's
own literal wording).** It IS on the constitution item 9 dependency allowlist specifically for
Edge Function use — confirmed at `docs/swarm/constitution.md` line 52. Import it via
`npm:ical-generator` (Deno 2 native npm-specifier support), the same import style
`checkin/index.ts` uses for `npm:@supabase/supabase-js@2`. A checker WILL grep for manual
`BEGIN:VCALENDAR`/`BEGIN:VEVENT` string concatenation and treat any hit as an automatic BLOCKER —
do not write any ICS-format string by hand anywhere in this function, including in tests (use the
library's own output or a real parser to validate test fixtures too).

**2. Role-scoping — copy the PRD 8.3/8.4 matrix verbatim, do not re-derive different logic.**
CAL-04's own literal text: "students: team-scoped events; parents: linked students' events;
coaches/admins: all." This is the SAME scoping logic already real and applied at the RLS level for
`events`/`sessions` (PRD 8.3 table) — since this function runs under the SERVICE ROLE (bypassing
RLS, same as `checkin`'s architecture), YOU must replicate the scoping decision explicitly in this
function's own query logic (RLS won't do it for you here, unlike a normal authenticated client
query). Resolve the token → `calendar_feeds.profile_id` → `profiles.role`, then: `admin`/`coach` →
all events; `student` → look up their own `students.team_id`, filter events where
`team_ids is null or team_id = any(team_ids)`; `parent` → look up ALL their linked students via
`guardian_links`, union each linked student's team-scoped events (a parent with children on
different teams should see both). Cite this explicitly in your module doc, don't just say "matches
the matrix."

**3. Token validation — mirrors `checkin`'s auth model, but the LOOKUP is different.**
`checkin` validates an HMAC-signed rotating token against a secret; THIS function looks up a
STORED, STABLE `calendar_feeds.token` UUID directly via a database query (service-role client),
checking `revoked_at is null`. An invalid, not-found, or revoked token must return a real 401/403
JSON-or-plain error (your call, disclose it) — never partial calendar data, never a 200 with an
empty-but-technically-valid ICS body that could be mistaken for "this token is fine but you have no
events" (that would leak information about token validity ambiguously — be explicit).

**4. Exact ICS content requirements, cited verbatim from CAL-04, do not paraphrase or guess a
different shape:**
- `X-WR-CALNAME: VOLT`
- `REFRESH-INTERVAL;VALUE=DURATION:PT6H` (cite `ical-generator`'s real API for setting this
  property — check its actual TypeScript types/README, don't guess a method name)
- Sessions from 30 days past through all future (relative to request time), filtered by the
  resolved role-scope from Trap #2
- One `VEVENT` per SESSION (not per event — a recurring meeting's 10 sessions are 10 separate
  VEVENTs)
- `UID=<session_id>@volt` (the real session id, not the event id)
- `SUMMARY=[Meeting|Outreach|Comp] <title>` — the literal bracketed type prefix, mapped from
  `events.type` (`meeting`→"Meeting", `outreach`→"Outreach", `competition`→"Comp" — note "Comp",
  not "Competition", per CAL-04's own literal example text)
- `LOCATION` from `events.location_name`(+ `address` — your call on exact concatenation, disclose
  it)
- `DESCRIPTION` includes RSVP status "when applicable" — this only makes sense for the `student`
  role-scope case (a student's own RSVP status for that session); coaches/admins/parents viewing
  the feed don't have a single obviously-relevant RSVP to show (a parent has one per linked child)
  — decide and disclose how you handle DESCRIPTION for each role, don't silently omit it everywhere
  or silently fabricate a value for non-student roles.
- Canceled sessions (`status='canceled'`) emit `STATUS:CANCELLED` (cite `ical-generator`'s real API
  for this, not a guessed property name) — they are NOT excluded from the feed, they're included
  WITH the cancelled marker (so calendar apps show them struck through, per iCal convention).

**5. Feed validation — CAL-04 says "feed validates in Google Calendar."** You cannot literally test
against Google Calendar in this sandboxed environment (network egress blocked, same class of gap
already documented for T017/T032/T048's Resend/Docker/deno.land blocks) — instead, prove
structural validity by parsing your own generated output back with a real ICS parser (or
`ical-generator`'s own round-trip/serialization guarantees) and asserting well-formed
BEGIN/END pairs, correct line-folding (RFC 5545's 75-octet line-length fold, which `ical-generator`
handles internally — don't hand-implement it), and no malformed lines. Disclose this as the
practical substitute for the literal Google Calendar acceptance criterion, same posture as prior
External Blocker sections.

**6. CORS/method handling** — reuse `checkin/index.ts`'s `CORS_HEADERS`/OPTIONS-preflight pattern,
adapted: this is a `GET` endpoint (not POST), so adjust `Access-Control-Allow-Methods` accordingly.

## Acceptance Criteria
- Uses `ical-generator` exclusively — zero hand-built ICS strings anywhere (grep-provable).
- Role-scoping matches the PRD 8.3/8.4 matrix exactly, explicitly cited and reasoned per role
  (including the parent multi-linked-student union case).
- All CAL-04 literal content requirements present and correct (`X-WR-CALNAME`, 6h refresh interval,
  30-days-past window, per-session `VEVENT`s, `UID`/`SUMMARY`/`LOCATION`/`DESCRIPTION` shapes,
  `STATUS:CANCELLED` for canceled sessions — included, not excluded).
- Invalid/revoked/not-found tokens return a real error, never partial or ambiguous data.
- Feed structural validity proven via round-trip parsing (practical substitute for live Google
  Calendar validation, disclosed).
- `SUPABASE_SERVICE_ROLE_KEY`/any secret read only via `Deno.env.get`, never hardcoded/logged
  (constitution item 5, BLOCKER if violated).
- `npm run build`/`typecheck`/`lint`/`test` all exit 0 for this function (Deno-specific test
  runner, mirror `checkin/**`'s own test commands).

## Relevant Constitution Excerpts
> 5. No secrets/service-role keys in the frontend bundle or hardcoded anywhere. → BLOCKER if
> violated. *(Applies here to `SUPABASE_SERVICE_ROLE_KEY`, read only via `Deno.env.get`.)*

> 9. Dependencies limited to the allowlist — `ical-generator` is explicitly allowlisted for Edge
> Function use. A hand-built VCALENDAR string is a BLOCKER per CAL-04's own literal wording, treated
> with the same severity as an unauthorized dependency.

## Most Recent Failure
None. This is attempt 1 for T047 (attempt count: 0).

## Required Worker Output
- Full contents of every file under `supabase/functions/ics/**`.
- Explicit citation proving `ical-generator` is used for every ICS-format concern (VEVENT
  construction, line-folding, `STATUS:CANCELLED`, `REFRESH-INTERVAL`) — grep proof of zero hand-
  built ICS strings.
- Explicit write-up of the role-scoping resolution per role (Trap #2), including the parent
  multi-student union case.
- Explicit write-up of the DESCRIPTION/RSVP-status-per-role decision (Trap #4).
- Real test proof: round-trip ICS parse validity, per-role scoping (4 role scenarios), canceled-
  session `STATUS:CANCELLED` inclusion, invalid/revoked-token error handling.
- `npm run build`/`typecheck`/`lint`/`test` output (Deno-specific, mirroring `checkin/**`).
- Known risks; whether a dispute is needed (you flag, you don't resolve).
