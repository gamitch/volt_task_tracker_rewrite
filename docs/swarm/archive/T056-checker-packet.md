# Checker Packet: T056 (`/reports` shell + Participation tab) — Check Attempt 1

## Task ID
T056 — `/reports` shell + Participation tab (RPT-01/RPT-02), Epic E9.

## Checker Agent
checker-accessibility (per task-ledger.md T056 row).

## Objective
Verify a coach/admin-only `/reports` shell (TabList Participation|Hours|Events) whose Participation
tab correctly answers "which students are below 70% participation?" (P-COACH2) using
`v_student_participation` data only, with zero TS re-derivation of the metric formula.

## Allowed Files (worker's only permitted edit)
- `src/pages/reports/ReportsShell.tsx` (new)
- `src/pages/reports/ParticipationTab.tsx` (new)

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`6483b7b`) — do NOT
infer authorship from commit messages. Confirm no other file (especially `router.tsx`, `guards.tsx`,
`supabase/migrations/**`) was touched.

## Worker's Claimed Changes (do not trust — verify independently)
1. `ReportsShell.tsx`: `RequireRole(['coach','admin'])`-wrapped `TabList`, literal order
   Participation | Hours | Events. Hours/Events render `EmptyState` naming T057/T058 as future
   owners. Same nested-guard pattern as T021's (Passed) `RosterShell.tsx`.
2. `ParticipationTab.tsx`: team-grouped `Table`+`Section` composition (claims no documented
   "Grouped Table" component exists — grepped `astryx-api.md`, zero hits), `PowerSearch` filter,
   "Below 70%" `ToggleButton` quick-filter (claims no `Chip` component exists either), `ProgressBar`
   for participation %, sort via `SegmentedControl`+`ToggleButton` (claims deliberately avoided
   `Table`'s real-but-undocumented `sortable` column field since `astryx-api.md`'s own `columns`
   prop enumeration excludes it).
3. **Constitution item 3 (BLOCKER-class) claim**: every displayed number comes off a
   `ParticipationMetricRow` type that is a verbatim camelCase rename of `v_student_participation`'s
   7 real columns (cites `supabase/migrations/20260717000003_metric_views.sql` lines 21-42). Claims
   grep for `100.0 *`/`/ greatest(` returns 4 hits, all inside a module-doc comment quoting the SQL
   for citation, zero hits in executable code.
4. Claims `buildDisplayRows` is a pure LEFT JOIN (student → metric-or-null), no arithmetic.
5. **RLS-on-views claim**: `v_student_participation` is a plain view (no `security_definer`/
   `security_barrier`); `students`/`attendance`/`event_sessions` all carry `staff_all using
   (is_staff())` RLS, so admin/coach querying the view get full rows via the base tables' own RLS —
   no view-level policy needed.
6. Claims a temporary, deleted-after scratch test proved the "below 70%" chip against a 6-student/
   2-team fixture: exact-70.0% boundary student excluded (strict `<`), `expected_ct=0` student
   shows `null` not `0%`/fabricated, excused-shrinks-denominator case included, exact chip result
   set `{Diego Ramirez, Liam Ortiz}`, team grouping verified independently per team.
7. **Two gaps flagged** (same recurring pattern as T018/T020/T021/T034): (a) `router.tsx`'s
   `/reports` route has only `RequireAuth`, no `RequireRole` — component-level guard used instead;
   (b) no shared Supabase client exists in `src/` — built `useParticipationData` with an injectable
   `loadData` seam defaulting to fake fixture data (T020 `loadData` precedent).
8. Claims `npm run typecheck`/`build`/`format:check` all clean; `npm run lint` shows 4
   pre-existing-pattern warnings matching `guards.tsx`/`router.tsx` (not new) and 2 transient errors
   belonging to a different concurrent worker's file (`CheckinResult.test.tsx`, T035, not touched
   by this task).

## Required Verification Steps
1. **Read both files in full** — do not rely on the worker's module doc or this packet's
   paraphrasing.
2. **Constitution item 3 — the core BLOCKER-class check.** Open
   `supabase/migrations/20260717000003_metric_views.sql` yourself and read
   `v_student_participation`'s real definition (lines ~21-42). Confirm every field
   `ParticipationTab.tsx` renders is a direct passthrough of a view column, with **zero** TS-side
   arithmetic on participation numbers (present/expected/late/excused counts, percentage). Re-grep
   the file yourself for any `%`, `/`, division, or percentage-computation operator in executable
   code (not comments) — do not trust the worker's claimed grep hit count, reproduce it.
3. **"Below 70%" correctness — re-derive independently.** Don't just accept the worker's claimed
   scratch-test result. Build your own small fixture (or reuse the worker's described one) and
   verify: strict `<` at the 70% boundary (a student at exactly 70.0% must NOT appear), `null`
   handling for `expected_ct=0` (never displayed as `0%` or excluded silently without a "no data"
   treatment), and that the filter reads only the view's own percentage field.
4. **RLS-on-views claim — re-verify by reading the real files.** Open
   `20260717000002_rls.sql` yourself and confirm the `staff_all`/`is_staff()` policies on
   `students`/`attendance`/`event_sessions` are as claimed. Confirm `v_student_participation` in
   the migrations file has no `security_definer`/`security_barrier` modifier. Judge whether the
   worker's "view is RLS-safe via base-table policies" reasoning is actually correct — this is a
   real security-relevant claim, not a formality.
5. **RPT-06 role gate — confirm by direct code read**, not by trusting the T021-precedent
   citation. Read `guards.tsx`'s `RequireRole` yourself, confirm `ReportsShell.tsx` genuinely wraps
   its content in it with `['coach','admin']`, and confirm (by reading `router.tsx`, read-only) that
   the route-level gate really is absent as claimed.
6. **Astryx prop citations** — spot-check `Table`, `Section`, `PowerSearch`, `ProgressBar`,
   `SegmentedControl`/`ToggleButton`, `Text` against `astryx-api.md` (grep, don't read the whole
   file) for the props actually used. Independently confirm the "no `Grouped Table` component" and
   "no `Chip` component" claims by grepping `astryx-api.md` yourself.
7. **`sortable` column field judgment call** — the worker flagged this as a real, disclosed
   judgment call (conservative reading of an undocumented-but-real package feature). Form your own
   explicit verdict: is avoiding it correct per constitution item 2, or is the worker being overly
   conservative in a way that should be reworked? State your reasoning.
8. **Build/typecheck/lint/format** — reproduce independently. If the shared working tree shows
   errors from other concurrent workers' unrelated files, confirm (by path) they're genuinely not
   yours to fix, same as the worker claims.
9. **No box-drawing / fabricated data sweep** — grep the file yourself for box-drawing characters
   and any hardcoded student-name-shaped fixture data outside the fixture/dev-loader path.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class, no exceptions): no re-deriving RLS/metric SQL formulas in TypeScript —
  the participation percentage and its component counts must come from the view only.
- Item 2: Astryx component usage must be verbatim/documented — no inventing components or
  undocumented prop shapes without explicit CLI/source cross-check disclosure.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on constitution item 3 compliance
- explicit verdict on the RLS-on-views security claim
- explicit verdict on whether the two flagged gaps (RPT-06 router-level, shared Supabase client)
  need a dispute filed or are correctly deferred as follow-up tasks
- required rework if failed
- follow-up tasks if passed with minor issues
