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

## Prescription — REVISED after premise-gate round 1 (verdict REVISE, 1 BLOCKER)

**The gate BUILT this prescription and found the original one-liner does not do what it says.
The orchestrator independently replayed the measurement. Both are recorded below.**

### The BLOCKER, measured three ways

`v_leaderboard_students` is a **simple single-table view**, so Postgres makes it
**auto-updatable** (`information_schema.views.is_updatable = YES` — the only such view in the
whole schema, all 16 surveyed). It has no `security_invoker`, so it executes as its **owner**, a
`BYPASSRLS` role. Supabase's stock default privileges grant `anon` INSERT/UPDATE/DELETE on it.
An unqualified `DELETE` needs no `SELECT` privilege, so revoking reads does not incidentally
block writes:

| Revoke applied | `anon` runs `delete from public.v_leaderboard_students` | `students` rows |
|---|---|---|
| none | `DELETE 2` | 2 → **0** |
| `revoke select ... from anon` *(the ruling's literal text)* | `DELETE 2` | 2 → **0** |
| `revoke all ... from anon` | `ERROR: permission denied for view` | 2 → 2 |

Shipping `revoke select` would have let the ledger record this exposure as "closed" while an
anonymous internet request could still empty the students roster.

### What to write

**New migration** `supabase/migrations/20260803000001_revoke_anon_leaderboard_students.sql`:

```sql
revoke all on public.v_leaderboard_students from anon;
revoke insert, update, delete on public.v_leaderboard_students from authenticated;
```

Line 1 closes the owner-ruled `anon` question completely.
Line 2 closes the identical defect for a plain logged-in non-staff session — measured: base-table
`delete from students` gives `DELETE 0` (RLS denies), but `delete from v_leaderboard_students`
gives `DELETE 1`. **`authenticated` deliberately KEEPS SELECT** — the leaderboard depends on it,
and revoking it breaks the feature.

**Header comment must record:** the ruling citation (`auto-mode-decisions.md:1297-1316`), that
line 1 uses the ruling's own "or equivalent" latitude, and that line 2 is an orchestrator scope
extension logged in `auto-mode-decisions.md` under "W4+W5 auto-mode window", **D2** — reversible
by the owner. **Do not describe line 2 as owner-authorized. It is not.**

### Test — `supabase/tests/` following the T195 precedent

Reuse `supabase/tests/calendar_feed_platform_stub.sql` (it creates the `anon`/`authenticated`
roles at `:7-13` and stubs `auth` at `:16-33` and `storage` at `:35-61`). Skip
`20260719000000_cron.sql` by name exactly as `run_calendar_feed_lifecycle.sh:29-31` does.

**Critical setup step the first version of this packet omitted — the gate proved the suite is
vacuous without it.** That stub grants nothing on public tables, so with it alone the view is
owner-only, `anon` is denied for the wrong reason, and deleting the fix changes nothing. Before
applying migrations you MUST simulate Supabase's stock grants:

```sql
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
```

**Four assertions**, so the proof is paired rather than absence-only:

1. `anon` SELECT on the view → **denied**
2. `authenticated` SELECT on the view → **still returns the active row**
3. `anon` `delete from public.v_leaderboard_students` → **denied**, and `students` still has its rows
4. `anon` SELECT on base `students` → **still 0 rows** (control)

**Do not** add any of this to `tests/rls/run.sh` — that runner is broken on bare Postgres at three
migrations and nothing in CI runs it. Filed separately as **T701**.

## Acceptance criteria — each names a mutation that turns it red

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | Suite exits 0 with all four assertions PASS | Blank the `revoke all` line, keep the file → assertion 1 must FAIL with `anon read 1 row(s)` |
| 2 | The **write** path is genuinely closed, not just the read path | Replace `revoke all` with `revoke select` → **assertion 3 must FAIL**. This is the BLOCKER's own regression test; if this mutation leaves the suite green the suite is not testing the defect. |
| 3 | `authenticated` SELECT is not collaterally damaged | Change line 1 to `revoke all ... from anon, authenticated` → assertion 2 must FAIL |
| 4 | The base-table control is genuinely asserting | Add `create policy read_all on students for select to anon using (true)` → assertion 4 must FAIL |
| 5 | The `authenticated` write revoke is load-bearing | Delete line 2 of the migration, and extend assertion 3 to run as `authenticated` → that must FAIL |

**Criterion 1 says "blank the statement, keep the file", NOT "revert the file"** — the T195
runner has a `found_*` guard, so removing the file yields `Missing required migration ... exit 1`,
a setup error rather than a real red. The gate hit exactly this.

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
