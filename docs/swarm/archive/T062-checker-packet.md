# Checker Packet: T062 (ETL script `scripts/migrate.ts`, MIG-03) — Check Attempt 1

## Task ID
T062 — ETL script `scripts/migrate.ts` (MIG-03), Epic E10.

## Checker Agent
checker-tests (per task-ledger.md T062 row) — deterministic script verification: run it, re-derive
its idempotency/dry-run-safety proofs, re-check secret hygiene, cross-check mapping fidelity.

## Objective
Verify an idempotent, secret-free ETL script that correctly implements every row of
`docs/migration/mapping.md`'s transform table, proves `--dry-run` writes nothing, proves running
twice produces no duplicates, and honestly discloses that real old-project verification remains
externally blocked (no live connection reachable, per T061's already-Passed finding).

## Allowed Files (worker's only permitted edit)
- `scripts/migrate.ts` (new)
- `scripts/migrate/**` (new — `types.ts`, `uuid.ts`, `time.ts`, `transform.ts`, `report.ts`,
  `env.ts`, `dataSource.ts`, `dataSink.ts`, `fixtures.ts`, `core.ts`, `verify-fixture.ts`,
  `node-shims.d.ts`)

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commits (`dc64920` WIP
snapshot, `e807aa9` final) — do NOT infer authorship from commit messages. Confirm
`docs/migration/**`, `supabase/migrations/**`, any `.env*` file, `package.json`, `tsconfig.json`,
and `eslint.config.js` are all byte-unchanged. Note: the working tree may currently also show
`src/pages/outreach/**` as untracked — that belongs to a different, concurrently-running task
(T038), not this one; do not flag it against T062.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Row-by-row mapping fidelity** claimed against every row of `docs/migration/mapping.md`:
   teams (1:1, `program=null`), students (name→display_name, team join with unmatched→archived-team
   handling, goal_hours→goal_hours_override, active→is_active), seasons ("2025–2026",
   `is_active=false`, min→max session dates, idempotent find-or-create), events (direct fields,
   CMP-02 type-based flag defaults, `team_ids=null`, `created_by=null`), the "dropped columns +
   attendees[] backfill assertion" gate (claims a real pre-write assertion that throws on any
   mismatch for real runs, only reports for dry-run), event_sessions (America/Chicago time parsing,
   00:00 fallback + flag), session status resolution (completed iff parent completed AND date ≤
   cutover), the `planned=true→rsvps` / `planned=false→attendance` split, and
   `hours_override = old.hours` **unconditionally** for every migrated attendance row.
2. **Natural-key/upsert strategy per table**: `teams` by `name` (upsert, `id` excluded from
   payload); `seasons` by explicit select-then-insert (no unique constraint exists); `students`/
   `events`/`event_sessions` by a deterministic `UUIDv5(namespace, "kind:oldId")` computed
   client-side (claims hand-rolled via `node:crypto`, no new dependency); `rsvps`/`attendance` by
   the real `(session_id, student_id)` DB unique constraint.
3. **Idempotency + dry-run-safety proof**: claims a committed, runnable `verify-fixture.ts` harness
   with 28 assertions — dry-run-writes-nothing (empty store before/after), a real run that aborts
   with zero writes on an attendees-backfill mismatch, a real run that succeeds once resolved with
   correct per-table counts and the `hours_override`-always-set rule, a second real run producing
   zero new creates (idempotency), and a dry-run against the now-populated store still writing
   nothing.
4. Claims real `--dry-run --fixture` CLI output covering every required edge case (unmatched team,
   null/empty team_affiliation extended to the same archived-team rule, unparseable time,
   attendees-backfill mismatch, both `planned` values).
5. **Secret hygiene**: claims grep across `scripts/**` shows only `process.env[...]` reads via a
   `readRequiredEnv` helper, no hardcoded URL/key/JWT-shaped string; a `redactSecret` helper
   truncates any key value that's ever logged.
6. **External blocker correctly not re-investigated**: cites T061's `docs/migration/source-schema.md`
   finding (no live old-project connection reachable) rather than re-litigating it; claims the
   script fails fast and cleanly (citing that doc) when run without `--fixture` and without env
   vars.
7. Claims `scripts/**` is outside `tsconfig.json`'s `include` (`["src", "vite.config.ts"]`), so
   `npm run typecheck`/`build` don't actually type-check this tree — worker claims to have run a
   standalone `tsc --noEmit --strict` pass against `scripts/migrate/**` separately as real proof.
   Claims `eslint.config.js` has no path exclusion for `scripts/`, so `npm run lint` genuinely does
   lint it.
8. Three disclosed known risks: null/empty `team_affiliation` handling is an extension beyond
   mapping.md's literal text (not explicitly settled, flagged for review); `events.address` and
   `event_sessions.notes` have no old-schema source and default to `''`; `NEW_SUPABASE_URL`/
   `NEW_SERVICE_ROLE_KEY` env var names are the worker's own naming choice (not previously
   specified anywhere).

## Required Verification Steps
1. **Read every file under `scripts/migrate/**` and `scripts/migrate.ts` in full** — do not rely on
   the worker's summary or this packet's paraphrasing.
2. **Cross-check `transform.ts` against `docs/migration/mapping.md` yourself, row by row.** Open the
   real mapping file and confirm every transform function genuinely implements what's specified —
   do not accept the worker's own cross-check table without independently re-reading both sides.
3. **`hours_override = old.hours` unconditionally — the single most correctness-critical rule
   (per the worker packet's own emphasis).** Confirm by source read that `mapAttendance` never
   derives this value from session duration or any computed source, only ever the literal old row's
   `hours` field, with no conditional branch that could skip it.
4. **The attendees-backfill assertion gate — re-verify it's a real gate, not a formality.** Confirm
   by source read that a real run genuinely aborts with zero writes when a mismatch exists (not
   just logs a warning and proceeds), and that dry-run correctly only reports without gating.
5. **Reproduce the idempotency and dry-run-safety proofs yourself.** Run
   `node --experimental-strip-types scripts/migrate/verify-fixture.ts` yourself and confirm it
   passes and that its assertions genuinely test what's claimed (read the assertions, don't just
   check the exit code) — in particular the "run twice, zero new creates" claim and the "dry-run
   against a populated store still writes nothing" claim.
6. **Run the real CLI yourself**: `node --experimental-strip-types scripts/migrate.ts --dry-run
   --fixture --cutover-date=2026-02-01` (or the worker's documented invocation) and confirm the
   output genuinely covers every required edge case (unmatched team, unparseable time,
   attendees-backfill mismatch, both `planned` values) with real, non-fabricated report content.
7. **Natural-key/upsert strategy — confirm each table's approach is genuinely idempotent.**
   Specifically verify the `UUIDv5`-based deterministic-ID approach for `students`/`events`/
   `event_sessions`: confirm the same old-project row always produces the same derived UUID across
   multiple runs (re-run the hash function yourself against a fixed input and confirm determinism),
   and confirm the upsert is genuinely keyed on that id (`onConflict:'id'`), not an insert-only path
   that would duplicate on a second run.
8. **Secret hygiene — reproduce the grep yourself.** Confirm zero hardcoded URL/key/JWT-shaped
   strings anywhere in `scripts/**`, and confirm `redactSecret` is genuinely used wherever a
   secret-shaped value could reach a log line.
9. **External-blocker citation — confirm it's a citation, not a re-investigation**, and confirm the
   script's own behavior (fails fast and clean without credentials) matches the claim by running it
   yourself without `--fixture` and without env vars set.
10. **Type-checking claim — reproduce independently.** Confirm `scripts/**` really is outside
    `tsconfig.json`'s `include` (read the file yourself), then run your own standalone
    `tsc --noEmit --strict` (or equivalent) pass against `scripts/migrate/**` and confirm it's
    clean. Also independently run `npm run lint` and confirm `scripts/**` genuinely gets linted
    (not silently excluded) and passes.
11. **PII sweep** — confirm `report.ts`'s printed migration report never includes a student name or
    email, only ids/counts (constitution item 6).
12. **NEW_SUPABASE_URL/NEW_SERVICE_ROLE_KEY naming choice** — judge whether inventing these names
    (not previously specified in any prior task's ground truth) is a reasonable, low-risk choice or
    should be flagged for boss review before MIG-04/T063 depends on it.

## Relevant Constitution Excerpts
- Item 5 (BLOCKER-class, no exceptions): no service-role key, old or new project, ever committed to
  any tracked file.
- Item 6: no PII in logs/fixtures — fixtures use fabricated names; the migration report must never
  print a real (or even fixture) student name, only ids/counts.
- Item 16: the old Lovable app is read-only reference — this script may only ever read from the old
  project and write to the new one, never write/alter/delete anything in the old project.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/script-run output, not paraphrase)
- commands run
- exact findings
- explicit verdict on whether the idempotency/dry-run-safety proofs genuinely hold (not just that
  the harness exits 0)
- explicit verdict on the `hours_override`-always-set rule's correctness
- explicit verdict on the `NEW_SUPABASE_URL`/`NEW_SERVICE_ROLE_KEY` naming choice
- required rework if failed
- follow-up tasks if passed with minor issues
