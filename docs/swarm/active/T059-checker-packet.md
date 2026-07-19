# Checker Packet: T059 (CSV exports) — Check Attempt 1

## Task ID
T059 — CSV exports (RPT-05/06), Epic E9 (last piece of the T053–T060 range E11's sweeps wait on).

## Checker Agent
checker-tests (per task-ledger.md T059 row).

## Objective
Verify four pure, zero-fetching CSV-generation functions (`roster.csv`, `events.csv`,
`attendance.csv`, `hours_by_student.csv`) with correct RFC 4180 escaping, ISO dates, and hours
numbers that trace back to the same computation `HoursTab.tsx` already established (never
recomputed differently).

## Allowed Files (worker's literal permitted edit)
- `src/pages/reports/csvExport.ts` (new)

**Scope flag**: worker also created `csvExport.test.ts`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`8dd0645`) — do NOT
infer authorship from commit messages. Confirm `ReportsShell.tsx`, `ParticipationTab.tsx`,
`HoursTab.tsx`, `EventsTab.tsx`, `StudentsTab.tsx`, `router.tsx`, `guards.tsx` untouched. Note: the
working tree may show other concurrently-running tasks' files (`SubscribePopover.tsx`,
`OutreachDetail.tsx`, `ParentRsvp.tsx`, `supabase/functions/ics/**`,
`supabase/functions/send-reminders/**`) — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Four pure functions, zero data-fetching** — claims `buildRosterCsv`/`buildEventsCsv`/
   `buildAttendanceCsv`/`buildHoursByStudentCsv` each take already-loaded row arrays only; no
   async, no Supabase/fetch calls anywhere in the file.
2. **Row shapes mirror sibling files**: roster mirrors `StudentsTab.tsx`'s `StudentDisplayRow`
   (claims the RAW `goalHoursOverride`, not `HoursTab.tsx`'s resolved goal, is used here — a
   disclosed choice); events mirrors `EventsTab.tsx`'s per-session row; attendance is a new shape
   sourced directly from real `attendance` columns; hours_by_student mirrors `HoursTab.tsx`'s
   `confirmedHours`/`plannedHours`/`goalHours`/`percentToGoal` fields, claimed to be typed as
   ALREADY-COMPUTED input numbers with zero arithmetic performed in this file (only one-decimal
   formatting).
3. **UTF-8 BOM included unconditionally** — claims `'﻿'` is prefixed to every generated
   document, disclosed reasoning (Excel-on-Windows compatibility, transparently ignored elsewhere).
4. **Old-app column parity explicitly deferred to T063/MIG-04** — claims no guessed old-system
   column names were fabricated.
5. **RFC 4180 escaping — claims proven with real fixtures**: `'Ortiz, Jr.'` (comma),
   `'Alex "Ace" Nguyen'` (quote), `'Nguyen, "Ace"'` (comma AND quote combined), plus newline/CR
   cases.
6. **`hours_by_student.csv` cross-check** — claims it hand-reproduced `HoursTab.tsx`'s
   `resolveGoalHours`/`hoursVsGoalPercent`/`round1` formulas (from that file's own documented text,
   since it's Forbidden to import from) in the test file, applied them to `HoursTab.tsx`'s own
   documented fixture numbers (Jordan Blake 45.5/null/80→56.9%; Maya Osei 52/50→clamped 100%; Theo
   Nakamura 0 confirmed/3.0 planned), and asserted the CSV row output matches byte-for-byte.
7. Claims 24/24 new tests pass; 815/816 repo-wide (the 1 failure claimed to belong to a different
   concurrent task's untracked test file, confirmed via git-stash isolation). typecheck/lint/build
   clean for its own files.

## Required Verification Steps
1. **Read `csvExport.ts` and `csvExport.test.ts` in full** — do not rely on the worker's module doc
   or this packet's paraphrasing.
2. **Zero-fetching claim — confirm by source read/grep.** No `await`, no `fetch`, no Supabase
   import anywhere in `csvExport.ts`.
3. **RFC 4180 escaping — reproduce or independently verify** the comma/quote/combined/newline test
   cases yourself. Write one additional adversarial case if you have capacity (e.g. a field that is
   ENTIRELY a single double-quote character, or an empty string) to rule out an off-by-one in the
   escaping logic.
4. **`hours_by_student.csv` — the central correctness check.** Independently read `HoursTab.tsx`'s
   real `resolveGoalHours`/`hoursVsGoalPercent`/`round1` functions yourself (don't trust the
   worker's hand-reproduction is faithful) and confirm the worker's reproduction in the test file is
   logically identical. Reproduce the byte-for-byte fixture cross-check yourself using the real
   source formulas, not the worker's copy of them.
5. **UTF-8 BOM and ISO-date claims — confirm by source read.**
6. **Old-app parity disclosure — confirm no fabricated column-name guesses** exist anywhere (no
   comment or code claiming "this matches the old app's column X" without a real citation).
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
   your own run. Confirm the 1 repo-wide test failure is genuinely isolated to a different
   concurrent task's file, not this task's.
9. **No box-drawing/bracket characters** in any header/label text (constitution item 13) — grep
   sweep yourself.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class): RLS/metric SQL formulas are never re-derived in TypeScript. *(Cited
  because `hours_by_student.csv` must reuse `HoursTab.tsx`'s established computation, not reinvent
  it — this is the single most important check in this packet.)*
- Item 6: no PII; test fixtures use fabricated names only.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the `hours_by_student.csv` cross-check against `HoursTab.tsx`'s real formulas
- explicit verdict on the RFC 4180 escaping correctness
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
