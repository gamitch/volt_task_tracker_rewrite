# Worker Packet: T059

## Task ID
T059 — CSV exports (RPT-05/06), Epic E9 (last piece of the T053–T060 range E11's sweep tasks are
waiting on).

## Objective
Build `src/pages/reports/csvExport.ts`: pure, client-generated CSV builders for `roster.csv`,
`events.csv`, `attendance.csv`, `hours_by_student.csv`, sourced from the same report queries as
T056/T057/T058, UTF-8, header row, ISO dates.

## Dependencies (status)
- T056 (`/reports` shell + Participation tab), T057 (Hours tab), T058 (Events tab) — all Passed.
  **Read all three files (read-only) before writing anything** — this task explicitly reuses "the
  same report queries" (RPT-05's own literal wording), meaning your CSV row shapes should be built
  from the SAME already-computed display-row types those three files already establish
  (`ParticipationDisplayRow`-equivalent, `HoursTab`'s per-student rows, `EventsTab`'s per-session
  rows), not independently re-queried/re-computed from raw tables. Since none of those files export
  their row-building functions or types today (each is self-contained), you cannot literally import
  them — instead, independently define equivalent row shapes here matching their column semantics
  exactly (confirmedHours from `v_student_hours` only, etc.), and cite which sibling file's shape
  each of your four exports mirrors. This is the same "forbidden-file, re-derive don't import"
  posture every prior task in this batch has taken.

## Allowed Files
- `src/pages/reports/csvExport.ts` (new — pure functions, no React/JSX)
- A colocated `csvExport.test.ts` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/reports/ReportsShell.tsx`, `ParticipationTab.tsx`, `HoursTab.tsx`, `EventsTab.tsx` —
  read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` — read-only. This task does not build the
  `Button variant="secondary"`-per-tab UI trigger or wire a download button into any page — it
  builds the pure CSV-generation functions a future wiring task will call from each tab's export
  button. State this scope boundary explicitly.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Every export function
  takes already-loaded row data as a plain argument (no data-fetching in this file at all — a pure
  transform layer, consistent with "client-generated from the same report queries" meaning the
  QUERIES live elsewhere, not that this file re-implements them).
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema/view columns to mirror (read the actual files yourself)
- `roster.csv`: sourced from `students`/`profiles`/`teams` shape — mirror `StudentsTab.tsx`'s
  (T022, read-only reference) established display-row shape (name, team, grad year, active status,
  goal hours) rather than inventing a different roster column set.
- `events.csv`: mirror `EventsTab.tsx`'s per-session row shape (type, date, attendance/signup
  counts, hours awarded, people reached, adult volunteers, status).
- `attendance.csv`: a NEW shape not literally built by any prior task — per-student-per-session
  attendance rows (status, check-in/out times, method) are the closest real ground truth
  (`attendance` table: `session_id`, `student_id`, `status`, `check_in_at`, `check_out_at`,
  `hours_override`, `method` — `20260717000000_scheduling_attendance.sql` lines 79-91). Decide and
  disclose the exact column set (student name + team for readability, not just raw ids).
- `hours_by_student.csv`: mirror `HoursTab.tsx`'s per-student row shape (confirmed hours from
  `v_student_hours`, planned hours, goal, % to goal, per T057's already-established, checker-
  approved definitions — reuse them, do not recompute differently here).

## Known Context / Traps

**1. Pure functions taking already-loaded data, not a data-fetching layer.** Each of the four
exports should be a function like `buildRosterCsv(rows: RosterCsvRow[]): string` — a plain string-
transform, zero async, zero Supabase/fetch calls anywhere in this file. This keeps the file trivially
testable and correctly scoped ("client-generated FROM the same report queries" — the queries live in
each tab's own `loadData` seam, not duplicated here).

**2. CSV correctness — UTF-8, header row, ISO dates, proper escaping (the actual craft of this
task).** Every value containing a comma, double-quote, or newline must be correctly quoted/escaped
per RFC 4180 (wrap in double-quotes, double any embedded double-quotes) — write real tests with a
fabricated student/team name containing a comma AND a name containing a double-quote to prove this,
not just happy-path names. Dates render as ISO 8601 (`YYYY-MM-DD` for date-only fields,
full ISO timestamp for datetime fields like `check_in_at`) — never a locale-formatted string like
"Jul 25, 2026". Disclose your decision on a UTF-8 BOM prefix (`﻿`) — Excel on Windows
sometimes needs it to correctly detect UTF-8 without it being misread as a different encoding; state
whether you include it and why (RPT-05's own text explicitly flags this: "UTF-8, header row, ISO
dates... UTF-8 BOM if needed").

**3. "Parity requirement: old app's CSV consumers keep working (columns superset of old ones —
verified during migration)" — this is EXPLICITLY a migration-time (T063/MIG-04, a human gate)
verification step, not something you can check now.** No old-system CSV sample or live old-project
access exists in this task's scope (same "External Blocker" class already documented for T061's
MIG-01 schema verification). Build a sensible, complete column set from the real current schema
(per Ground Truth above) and explicitly disclose that literal old-vs-new column parity is deferred
to T063's human-gated migration verification — do not fabricate a guess at what the old app's exact
column names were.

**4. Confirmed/planned hours and participation % in `hours_by_student.csv`/any CSV that touches
them — same constitution item 3 discipline as T057/T058.** Reuse the exact `resolveGoalHours`/
`hoursVsGoalPercent`-shaped computation already established (read `HoursTab.tsx`), never recompute
confirmed hours from raw attendance in this file.

**5. Reversible-vs-generated distinction: this file has no UI, so "no box-drawing characters" and
similar constitution item 13 concerns apply to any CSV header/column-label TEXT you choose, not to
rendered JSX (there is none here) — still worth a deliberate grep sweep.

**6. No shared Supabase client wired in — not applicable here** (this file never fetches data at
all, per Trap #1) — but still worth stating explicitly that this is a deliberate design choice, not
an oversight.

## Acceptance Criteria
- Four pure export functions (`roster.csv`, `events.csv`, `attendance.csv`,
  `hours_by_student.csv`), each taking already-loaded row data, zero data-fetching in this file.
- RFC 4180-correct CSV escaping proven with real comma/quote-containing fixture names.
- ISO 8601 dates throughout; UTF-8 BOM decision explicitly disclosed and justified.
- Confirmed/planned hours and participation % (wherever used) sourced consistently with T057/T058's
  established, already-checker-approved definitions — never recomputed differently.
- Old-app column parity explicitly disclosed as deferred to T063 (MIG-04), not fabricated.
- No box-drawing/bracket characters in any header/label text (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS/metric SQL formulas are never re-derived in TypeScript. *(Cited because
> `hours_by_student.csv` must reuse T057's already-established hours/goal computation, not
> reinvent it.)*

> 6. No PII; test fixtures use fabricated names only. *(Cited because your CSV-escaping proof tests
> need fabricated names with commas/quotes in them — still fabricated, not real people's names.)*

## Most Recent Failure
None. This is attempt 1 for T059 (attempt count: 0).

## Required Worker Output
- Full contents of `csvExport.ts`.
- Explicit write-up of each of the four CSV column sets and which sibling file's row shape each
  mirrors.
- Explicit write-up of the UTF-8 BOM decision.
- Explicit disclosure that old-app column parity is deferred to T063/MIG-04.
- Real test proof: RFC 4180 escaping (comma-containing and quote-containing fixture names), ISO
  date formatting, and — for `hours_by_student.csv` — a cross-check that its numbers match the same
  computation `HoursTab.tsx` would produce for the identical fixture data.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
