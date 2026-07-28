# Checker Packet: T047 (`ics` Edge Function) — Check Attempt 1

## Task ID
T047 — `ics` Edge Function via `ical-generator` (CAL-04/05), Epic E7.

## Checker Agent
checker-tests (per task-ledger.md T047 row). **Note**: the Deno CLI is unavailable in this sandbox
(no `deno` binary) — the worker substituted a Node/tsx port of all tests plus a real `tsc --noEmit`
pass, same class of disclosed External Blocker as T017/T032/T048. If you also lack Deno, reproduce
the worker's substitute approach yourself (independently, not by trusting its port) rather than
skipping verification.

## Objective
Verify `GET /functions/v1/ics?token=<uuid>` uses `ical-generator` exclusively (zero hand-built ICS
strings anywhere in production code), correctly re-derives the PRD 8.3/8.4 role-scoping matrix
under the service role (which bypasses RLS), and produces structurally valid, CAL-04-compliant ICS
output.

## Allowed Files (worker's literal permitted edit)
- `supabase/functions/ics/**` (new directory, 20 files)

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`c459e74`) — do NOT
infer authorship from commit messages. Confirm `supabase/functions/checkin/**`, `send-invite/**`,
`src/pages/calendar/**` untouched, and no migration file added/edited (`calendar_feeds` already has
everything needed). Note: the working tree may show another concurrently-running task's files
(`supabase/functions/send-reminders/**`) — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`ical-generator`-only claim — the central safety property (CAL-04's own BLOCKER-class
   wording).** Claims `ics_builder.ts` is the SOLE production file importing `npm:ical-generator@11`
   (via `ical({name:'VOLT'})`, `.ttl(21600)` for the 6h refresh, `.createEvent({...,
   status: ICalEventStatus.CANCELLED})`, `calendar.toString()`). Claims a grep for
   `BEGIN:`/`END:V` literal strings across `index.ts`/`feed.ts`/`ics_builder.ts` returns zero hits.
   Discloses that `ics_structural_check.ts` (a TEST-ONLY file, never imported by production code)
   DOES contain literal `'BEGIN:VCALENDAR'` string comparisons — but only as a read-only PARSER for
   validating output, not as a constructor, and claims this distinction is documented in that
   file's own header.
2. **Role-scoping — explicit re-derivation, not RLS-reliant** (since the service-role client
   bypasses RLS entirely). Claims: admin/coach → `{kind:'all'}`; student → own `students.team_id`
   looked up via `profile_id`, matched against `events.team_ids is null OR overlaps`; parent → ALL
   `guardian_links` rows fetched, ALL linked students' teams unioned (claims a specific test proves
   a parent linked to students on two DIFFERENT teams sees the union of both). A student/parent
   profile with no linked students resolves to a structurally valid EMPTY feed, not an error
   (disclosed as intentional).
3. **DESCRIPTION/RSVP status** — claims ONLY the `student` role gets a DESCRIPTION (their own RSVP
   for that session, omitted not fabricated when absent); staff/parent get none, with a specific
   disclosed reason for parent (multi-child ambiguity — merging or picking one child's RSVP would
   itself be a fabrication).
4. **CAL-04 literal content** — claims `X-WR-CALNAME`, `REFRESH-INTERVAL;VALUE=DURATION:PT6H`,
   per-session (not per-event) `VEVENT`s, `UID=<session_id>@volt`,
   `SUMMARY=[Meeting|Outreach|Comp] <title>`, `LOCATION`, and `STATUS:CANCELLED` for canceled
   sessions (included, not excluded) — all verified against `ical-generator`'s real installed
   source and a live `.toString()` smoke test, not guessed API names.
5. **Feed validity** — claims a real round-trip structural parse (via the test-only
   `ics_structural_check.ts`) proves well-formed BEGIN/END pairs and correct serialization, as the
   practical substitute for the literal (untestable-here) "validates in Google Calendar" criterion.
6. **Token validation** — claims invalid/not-found and revoked tokens both collapse to the same 401
   `INVALID_TOKEN` response (a disclosed information-safety design choice, not an accidental
   conflation).
7. Claims 54/54 tests pass (ported to Node/tsx, Deno CLI unavailable), `tsc --noEmit` 0 errors
   against real installed `@supabase/supabase-js`/`ical-generator` type packages, repo-wide
   `lint`/`typecheck`/`build`/`test` unaffected (confirmed `eslint.config.js`/`vite.config.ts`
   already exclude `supabase/functions/**`).

## Required Verification Steps
1. **Read every file under `supabase/functions/ics/` in full** — do not rely on the worker's module
   docs or this packet's paraphrasing.
2. **`ical-generator`-only claim — the single most important check in this packet.** Reproduce the
   grep yourself across `index.ts`/`feed.ts`/`ics_builder.ts`. Independently confirm
   `ics_structural_check.ts` is genuinely never imported by any production file (grep for its
   filename as an import target).
3. **Role-scoping — reproduce the four role scenarios yourself**, especially the parent
   multi-team-union case (a parent linked to students on two different teams must see BOTH teams'
   events, not just one). Confirm by source read that this logic is a faithful re-derivation of PRD
   8.3/8.4, not a simplified/incorrect approximation.
4. **DESCRIPTION/RSVP scoping — confirm by source read** that only the student role ever gets a
   DESCRIPTION, and render your own explicit verdict on whether the parent-omission reasoning
   (multi-child ambiguity) is sound.
5. **CAL-04 literal content requirements — verify each one directly** against the real
   `ical-generator` API (read its installed source/types yourself, don't trust the worker's
   citations) and against a real generated-output sample if you can execute the code (Node/tsx port
   or equivalent).
6. **Feed structural validity — reproduce the round-trip parse test yourself.**
7. **Token handling — confirm the not-found/revoked conflation is deliberate and consistently
   applied**, not an accidental information leak in the other direction (e.g. does any other part
   of the response distinguish the two cases inadvertently, like a different response body shape or
   timing?).
8. **Secret hygiene (constitution item 5, BLOCKER-class)** — grep for `SUPABASE_SERVICE_ROLE_KEY`
   and confirm it's read only via `Deno.env.get`, never hardcoded/logged/echoed in any response.
9. **Re-run tests/typecheck yourself** using whatever substitute is available (Deno if present,
   Node/tsx port otherwise, reproduced independently) — don't accept "54/54" without your own run.
10. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 9: Dependencies limited to the allowlist — `ical-generator` is explicitly allowlisted for
  Edge Function use. A hand-built VCALENDAR string is treated as a BLOCKER per CAL-04's own literal
  wording. *(This is the single highest-severity finding a checker should hunt for on this task.)*
- Item 5 (BLOCKER-class): no secrets/service-role keys hardcoded anywhere.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run (or the disclosed Deno-unavailability substitute, reproduced independently)
- exact findings
- explicit verdict on the `ical-generator`-only safety property
- explicit verdict on the role-scoping correctness, especially the parent multi-team union case
- explicit verdict on the DESCRIPTION/RSVP-per-role scoping
- required rework if failed
- follow-up tasks if passed with minor issues
