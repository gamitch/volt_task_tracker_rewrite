# T205 — worker packet

**Row:** T205 (W4 block) · **Tier: HEAVY, unconditional** · **Branch:**
`claude/t205-revoke-anon-leaderboard-view` off `origin/main` (`380266e`)

## Tier justification (state and defend it, item 26)

HEAVY is **not** a judgement call here. Constitution item 18 trigger 1 fires on anything that
*"creates or edits a file under `supabase/migrations/`"* (`constitution.md:75`), and item 26 lists
migrations and metric-view SQL among its required HEAVY triggers. FAST is barred by its own
definition — it requires *"no schema, RLS, migration, or auth/role logic"* (`constitution.md:311`).

The owner's ruling says the same thing independently: *"which per constitution item 18 trigger 1
requires opus tier and a full `checker-premise` round regardless of the change's size, **no
exception for a one-line revoke**"* (`auto-mode-decisions.md:1313-1316`).

**A one-line diff is exactly the diff item 26 warns you not to let talk you down a tier.**

## The ruling that authorises this (cite the file, never a paraphrase)

`auto-mode-decisions.md:1297-1316`, 2026-07-31, structured selection. George was given two options —
leave as-is (matching T185's proportionality precedent) vs. close it off — and **selected "Close it
off."**

What it authorises: a **new** migration, `revoke select on public.v_leaderboard_students from anon;`
or equivalent. Nothing else.

## The defect, measured — not read

`v_leaderboard_students` (`20260731000000_leaderboard_students_view.sql:54`) is
`select id, display_name from students where is_active`. Supabase's stock
`ALTER DEFAULT PRIVILEGES ... TO anon, authenticated, service_role` leaves it readable by the
**unauthenticated** `anon` role. No `revoke` exists anywhere in `supabase/migrations/` (verified).

Reproduced by the orchestrator on real Postgres 16.13 before this packet was written:

| Probe | Baseline | With `revoke` |
|---|---|---|
| `anon` → `v_leaderboard_students` | **`anon_rows=1`** | **`ERROR: permission denied for view`** |
| `authenticated` → `v_leaderboard_students` | `authenticated_rows=1` | `authenticated_rows=1` |
| `anon` → base table `students` (control) | `anon_students_rows=0` | `anon_students_rows=0` |

The base-table control staying at 0 is what proves this is specifically a **view-grant** question and
that RLS itself is intact — the same distinction T158's checker drew.

## No legitimate consumer needs `anon` on this view — verified

- Every route that reaches the leaderboard is behind `RequireAuth` (`src/app/router.tsx:190-215`).
- `/kiosk/:sessionId` is `RequireAuth` **+** `RequireRole ['coach','admin']` — not public.
- The only genuinely public routes are `/login` and `/accept-invite`; neither reads the view.
- `Leaderboard.tsx` renders inside `CoachHome`, behind `RequireAuth` at `/`.
- The single production read is `loaders/leaderboard.ts:147`, which runs on an authenticated session.

The view's own header states its purpose is to show names *"to every authenticated role"*
(`20260731000000_leaderboard_students_view.sql`, module comment) — `anon` was never intended.

## Allowed files — nothing else

```
supabase/migrations/20260803000001_revoke_anon_leaderboard_students.sql   (NEW)
supabase/tests/t205_anon_grant_assertions.sql                            (NEW)
supabase/tests/run_t205_anon_grant.sh                                    (NEW)
```

**Forbidden:** editing `20260731000000_leaderboard_students_view.sql` or any other applied
migration (constitution item 10 — editing an applied migration is a BLOCKER). The fix is
**additive**. Do not touch `src/**`.

## Prescription

1. **New migration** `supabase/migrations/20260803000001_revoke_anon_leaderboard_students.sql`:
   `revoke select on public.v_leaderboard_students from anon;`
   Header comment must cite the ruling (`auto-mode-decisions.md:1297-1316`) and state that
   `authenticated` is deliberately untouched.
2. **Permanent regression test**, following the **already-proven T195 precedent** —
   `supabase/tests/run_calendar_feed_lifecycle.sh` + `calendar_feed_platform_stub.sql`. Reuse that
   stub; it already creates the `anon`/`authenticated` roles (`:7-13`) and stubs `auth` and
   `storage` (`:35-51`). Skip `20260719000000_cron.sql` exactly as that runner does (`:29-31`,
   "requires Supabase pg_cron, pg_net, and Vault").
   Assertions, all three, so the proof is **paired** and not absence-only:
   - `anon` SELECT on `v_leaderboard_students` → **denied**
   - `authenticated` SELECT on `v_leaderboard_students` → **still returns the active row**
   - `anon` SELECT on base `students` → **still 0 rows** (control)

**Do not** add this to `tests/rls/run.sh`. That runner applies every migration unchanged and is
**broken on bare Postgres** — `cron.sql` needs `pg_cron`+`pg_net` and `avatar_storage.sql` needs
`storage.buckets`. Orchestrator measured it failing at three separate migrations. That rot is real
but is **not this row's scope** — it is filed separately as **T701**.

## Acceptance criteria — each names a mutation that turns it red

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | `run_t205_anon_grant.sh` exits 0 with all three assertions PASS | Delete the `revoke` line from the new migration → assertion 1 must FAIL |
| 2 | The fix is load-bearing, not incidental | Revert **only** the migration file; the suite must go red on assertion 1 specifically, not on a setup error |
| 3 | `authenticated` is not collaterally damaged | Change the migration to `revoke select ... from anon, authenticated` → assertion 2 must FAIL |
| 4 | The base-table control is genuinely asserting | Grant `anon` a `read_all` policy on `students` → assertion 3 must FAIL |

**A criterion whose mutation leaves the suite green is not evidence — report that instead of
shipping it** (`W5-KICKOFF.md:199-201`).

## Six gates, `.env.local` ABSENT — report every one, assert exit codes

```
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .                       (0 errors; report the warning count)
npx vitest run
bash supabase/tests/run_t205_anon_grant.sh ; echo $?
```

Orchestrator's measured branch-point baseline at `b1307c4`: tsc 0, build 0, format 0,
eslint **0 errors / 362 warnings**, vitest **78 files / 1921 tests / exit 0**. Re-measure on
`380266e` and report real numbers — `main` has moved twice during this task's scoping.

## Environment (this container)

Postgres 16.13 is installed but starts **down**. `pg_ctlcluster 16 main start`. The `root` login
role must exist for the runner's plain `psql` peer auth. `calendar_feed_platform_stub.sql` supplies
the `anon`/`authenticated` roles — do not create them by hand in the test.

## Rules

Item 22 — stage named paths only, never `git add -A`. Item 23 — mutations in your own worktree;
**commit before mutating**, since `git checkout --` also reverts uncommitted work. Item 21 — report
the commit SHA; the orchestrator verifies HEAD actually moved. You do **not** self-certify
completion.
