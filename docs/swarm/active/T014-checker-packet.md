# Checker Packet: T014

## Task ID
T014 — NFR-03 metric-view fixture tests (persisted, re-runnable, against T013's already-Passed views)

## Checker Agent
checker-tests

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
Four new files under `supabase/tests/`: `auth_stub.sql`, `seed.sql`, `assertions.sql`, `run.sh`. The worker's claim is that `bash supabase/tests/run.sh` stands up a disposable scratch Postgres database, applies all five existing migration files (T009–T013) **unmodified**, applies a minimal `auth` schema stub (needed because a bare Postgres instance lacks Supabase's managed `auth` schema), loads fabricated-name fixture data, and runs SQL assertions covering all four NFR-03 cases (excused-shrinks-denominator, hours_override-wins, check-in clamping — both the positive-clamp and zero-floor sub-cases — and the no-completed-sessions "—" case), exiting non-zero if any assertion fails. The worker also claims it ran a negative-control test: patched one expected value in `assertions.sql` to something wrong, confirmed the suite correctly failed and identified the bad case, then reverted.

Treat every worker claim below as a hypothesis to independently verify, not as evidence. Constitution item 3 (metric SQL verbatim, BLOCKER if re-derived) is not directly this task's scope (T013 already covers the views themselves), but this task's entire purpose is proving those views behave correctly — a fixture suite that looks plausible but doesn't actually exercise the four NFR-03 cases, or that silently reimplements the formula instead of testing the real view, would defeat the point. Constitution item 6 (fabricated names only in test fixtures) is directly checkable here.

**Note on evidence availability:** as with T013, there is no persisted worker-output artifact (no `T014-latest-result.md`) — the worker's claimed command output, negative-control narrative, and grep results were reported conversationally, not saved to disk. Do not treat any narrative claim as verified until you reproduce it yourself.

## Files to Inspect
- `supabase/tests/auth_stub.sql` (new)
- `supabase/tests/seed.sql` (new)
- `supabase/tests/assertions.sql` (new)
- `supabase/tests/run.sh` (new)
- `supabase/migrations/20260716000000_identity_roster.sql` (T009 — read-only zero-diff baseline)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010 — read-only zero-diff baseline)
- `supabase/migrations/20260717000001_support_audit.sql` (T011 — read-only zero-diff baseline)
- `supabase/migrations/20260717000002_rls.sql` (T012 — read-only zero-diff baseline)
- `supabase/migrations/20260717000003_metric_views.sql` (T013 — read-only zero-diff baseline)
- `src/**` (read-only, for the TS formula-duplication grep)
- `package.json` (confirm zero diff — worker was forbidden from adding scripts/deps here)

## Forbidden Modification Check (run first, per D001 standing rule — compare file tree/content directly, never git history/commit-bundling)
Worker's Allowed Files were `supabase/tests/**` only (fixtures + runner). Verify:
- All five files under `supabase/migrations/` are byte-identical to their known-good pre-T014 state (diff or checksum each one directly).
- `src/**` has zero new/modified files.
- `package.json` has zero diff (no new scripts, no new dependencies added).
- Nothing under `docs/swarm/**` or `.claude/**` was touched by the worker (do not flag this checker packet itself, other `docs/swarm/active/*.md` packets, or hook-appended `verification-log.md` lines as findings — those are normal swarm-operation byproducts, not worker artifacts, per the standing calibration note in `docs/swarm/state-summary.md`).
- No file exists outside `supabase/tests/**` that wasn't there before this task.

If any forbidden file was modified, return FAIL - BLOCKER - unauthorized modification.

## Required Verification Steps

1. **Independent clean re-run.** From a fresh scratch database (do not reuse any state left over from a prior run), execute `bash supabase/tests/run.sh` exactly as documented, unmodified. Report the real command and real full output, not a paraphrase. Confirm: the script creates its own scratch DB, applies `auth_stub.sql`, applies all five migrations in filename order, loads `seed.sql`, runs `assertions.sql`, drops the scratch DB on exit (check via `trap cleanup EXIT` in the script and confirm the DB is actually gone afterward), and exits 0 with all four cases reported PASS. If `psql`/a reachable Postgres server genuinely isn't available in your environment, say so explicitly and explain exactly what you did instead — do not fabricate a pass you didn't observe (same standard the worker itself was held to).

2. **Re-verify the migrations were not modified.** Independently compute a SHA-256 checksum (or run a direct `diff`) of all five files under `supabase/migrations/` against their known-good content (cross-reference the archived checker packets — `docs/swarm/archive/T009-checker-packet.md` through the T013 entry — for what "known-good" means, but your primary evidence must be your own direct read/checksum of the current file contents, not trusting the cross-reference alone). Any difference → BLOCKER (constitution item 10).

3. **Re-verify the negative-control claim yourself — do not accept the worker's narrative.** Make your own copy of `assertions.sql` (or a scratch variant), patch exactly one expected value to something deliberately wrong (e.g. change case (a)'s expected `participation_pct` from `100.0` to `50.0`, or case (c-ii)'s expected `confirmed_hours` from `0` to a nonzero value), re-run the suite against a fresh scratch DB with your patched assertions file, and confirm: (a) the suite correctly reports a FAIL for exactly the case you patched, (b) the script's overall exit code is non-zero, (c) the other three cases still correctly report PASS (proving the failure is localized, not a suite-wide breakage). Then revert your patch (or simply discard your scratch copy — the repo's own `assertions.sql` must remain untouched) and re-confirm a clean full-PASS run. Report the actual patched diff, the actual FAIL output, and the actual reverted-and-passing re-run.

4. **Case-by-case correctness re-derivation.** Read `seed.sql` and `assertions.sql` directly yourself (not from this packet's earlier transcription) and confirm, independently working the arithmetic, that each of the four cases' expected values are actually correct against T013's verbatim view SQL (read `20260717000003_metric_views.sql` directly, do not trust any transcription):
   a. **excused-shrinks-denominator** — Student Alpha: 1 present + 1 excused session against a `counts_participation` event → `expected_ct=2, present_ct=1, excused_ct=1`, `participation_pct = round(100*1/greatest(2-1,1),1) = 100.0`. Confirm this is what the fixture actually encodes and what the assertion actually checks (not 50.0, which is what a bug that fails to shrink the denominator would produce).
   b. **hours_override-wins** — Student Bravo: a 9.25h `hours_override` on a row whose clamped check-in/check-out span would otherwise compute to 2.0h (window 09:00–11:00, actual check-out 12:00). Confirm `confirmed_hours` assertion is 9.25, not 2.0.
   c. **check-in clamping** — (i) Student Charlie: window 09:00–11:00, check-in 08:00/check-out 12:30 (actual span 4.5h) must clamp to 2.0h (the window length). (ii) Student Delta: window 09:00–11:00, check-in 12:00/check-out 13:00 (entirely after `ends_at`) must clamp to exactly 0, never negative.
   d. **no-completed-sessions "—" case** — Student/Team Echo's only session is `status='scheduled'`, never `'completed'`. Confirm both `v_student_participation` and `v_team_participation` produce zero rows for this student/team (asserted as a direct row-count check in `assertions.sql`, not inferred from a field value).
   Flag anything that looks like it tests the wrong thing, has an off-by-one in the fixture setup, or would pass even if the underlying view had the corresponding bug (i.e. check the tests are not trivially/vacuously true).

5. **Fabricated-names-only confirmation (constitution item 6).** Read `seed.sql` directly and confirm every student/team/event name is a clearly fabricated placeholder (e.g. "Fixture Student Alpha," "Fixture Team Bravo") — zero real VOLT student, parent, or team names anywhere in any of the four new files. Also grep the whole `supabase/tests/` directory for anything that looks like a real email address or name pattern as an extra check.

6. **TS formula-duplication grep — independent.** Run your own `grep -rn "participation_pct\|confirmed_hours\|hours_override" src/` (run it yourself, don't reuse any reported output) and confirm zero hits, consistent with T013's own baseline.

7. **D001-method forbidden-file check.** Confirm via direct file-tree/content comparison (never git history) that only the four files listed under Files to Inspect (new) exist under `supabase/tests/**`, and nothing else in the repository changed as a result of this task.

8. **Build/typecheck/lint/format:check regression re-run.** These are new SQL/shell files with no relationship to the TypeScript/Vite toolchain, so no regression is expected — but confirm this rather than assume it. Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check` (and `npm run test` for completeness) and confirm all exit 0 with the same baseline warning count as the last known-clean run (8 pre-existing non-blocking fast-refresh warnings). If `supabase/tests/**`'s `.sql`/`.sh` files trip any of these tools (e.g. an overly broad ESLint/Prettier glob), report that as a finding — do not silently wave it through.

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come only from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER. (Context: this task tests, but does not modify, T013's verbatim views.)
>
> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names.
>
> 9. Dependency allowlist... Anything else requires boss-architect approval recorded in the ledger. (Worker was forbidden from adding a Postgres client dependency; confirm `package.json` is untouched.)
>
> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.
>
> Non-Negotiable: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

## Known Context / Non-Issues (verify, do not just accept)
- pgTAP/Supabase CLI were reportedly unavailable in the worker's environment, so a plain `psql`/shell runner was used instead (the packet's documented fallback option 2). This is an acceptable, packet-sanctioned approach — but confirm it actually works end-to-end yourself rather than accepting the choice as automatically sufficient.
- Do not flag this checker packet's own existence, other `docs/swarm/active/*.md` files, or hook-appended `verification-log.md` lines as forbidden-file violations — see the standing calibration note.

## Most Recent Failure
None — this is T014's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased), including the full `bash supabase/tests/run.sh` transcript from a clean scratch DB (step 1)
- migration-file zero-diff evidence (checksums or diff output, step 2)
- your own negative-control patch, the actual FAIL output it produced, and the reverted clean-pass re-run (step 3)
- your independent arithmetic re-derivation for all four cases (step 4)
- fabricated-names confirmation (step 5)
- independent TS-duplication grep output (step 6)
- forbidden-file/scope check result (step 7)
- build/typecheck/lint/format:check/test output (step 8)
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's self-report, the inline comments in the SQL files, or this packet's own arithmetic transcriptions. Generate your own evidence for every claim.
