# T503 worker output — widen `rsvps` SELECT so a student sees teammates' RSVPs

Worker: worker-implementer, worktree `claude/t503-work`. Packet: v2
(`docs/swarm/active/T503-worker-packet.md`, commit `6fe761b`/`3ba8092`). Gate
evidence: `docs/swarm/active/T503-gate-report.md`.

## 1. Commit SHA and proof of the committed blob (item 21)

**Commit `e5fe9b8beafc6137b007203413b2abbfe8f6ce60`** on branch
`claude/t503-work`, pushed to `origin/claude/t503-work`.

Proof the work is in the committed blob, not just the working tree:

```
$ git show e5fe9b8:supabase/migrations/20260804000001_widen_rsvp_read_all_authenticated.sql | tail -5
-- recreate that shape); applying this migration to hosted Supabase
-- (constitution item 16 reserves cutover for the human owner).

create policy read_all_authenticated on rsvps
  for select to authenticated using (true);
```

`git show e5fe9b8 --stat` lists all 7 new files (522 insertions, 0
deletions, 0 files modified — purely additive):

```
supabase/migrations/20260804000001_widen_rsvp_read_all_authenticated.sql | 109 ++
supabase/tests/run_t503_widen_rsvp_read.sh                               | 119 ++
supabase/tests/t503_widen_rsvp_read_assertions.sql                       | 163 ++
supabase/tests/t503_widen_rsvp_read_before_direct_count.sql              |  14 ++
supabase/tests/t503_widen_rsvp_read_fixture.sql                          |  62 ++
supabase/tests/t503_widen_rsvp_read_views_snapshot.sql                   |  36 ++
supabase/tests/t503_widen_rsvp_read_writepolicies_snapshot.sql           |  19 ++
7 files changed, 522 insertions(+)
```

`git status --short` after the commit: clean.

## 2. All six gates, measured baseline, `.env.local` absent

`.env.local` confirmed absent (`ls .env.local` → No such file or directory).
Baseline measured **before any change**, and re-measured **after** — identical,
since nothing under `src/` changed:

| Gate | Before | After |
|---|---|---|
| `npx tsc --noEmit` | exit **0** | exit **0** |
| `npx eslint .` (`npm run lint`) | **0 errors / 364 warnings**, exit 0 | **0 errors / 364 warnings**, exit 0 |
| `npm run build` (`tsc --noEmit && vite build`) | exit **0** | exit **0** |
| `npm run format:check` | clean, exit **0** | clean, exit **0** |
| `npx vitest run` | **78 files / 1993 tests**, exit **0** | **78 files / 1993 tests**, exit **0** |
| SQL test script (`supabase/tests/run_t503_widen_rsvp_read.sh`) | n/a (didn't exist) | **exit 0**, "T503 widen-rsvp-read tests: ALL PASS" |

(My measured full-suite baseline, 78/1993, differs from the gate's own
78/1976 because more work — T504, T506 — landed on this branch's base between
the gate's run and mine; per the packet, "measure your own baseline.")

**The SQL test script's own exit code: 0.**

## 3. §5 mutations, run against a real PostgreSQL 16.13, with real output

Cluster: fresh `initdb`'d PostgreSQL 16.13 (not the gate's, which it tore
down), loopback TCP `127.0.0.1:55433`, socket dir `/tmp/t503wsock` (the
scratchpad path itself is too long for a Unix socket). Never touched the
shared git working tree (constitution item 23) — all mutations ran as SQL
against scratch databases via `psql`.

### Passing run (unmutated) — the six-criteria script itself

```
==> [BEFORE] direct rsvps read as Student One (shipped RLS, own row only)
1
==> PASS before-direct-read-scoped (1 row, own only)
==> C4: comparing planned-hours view snapshots BEFORE vs AFTER (must be byte-identical)
dec918993831bedfe6ebe7a35b3f4b3d6879ee833905eb69eaa47dca97ae9b99  views_before.txt
dec918993831bedfe6ebe7a35b3f4b3d6879ee833905eb69eaa47dca97ae9b99  views_after.txt
==> PASS c4-views-unchanged
==> C5: sha256 of the two rsvps write policies, BEFORE vs AFTER (must match)
01500452c33f8b947f8e76f7c871c9c4ee14fa36443863df656cc92fb3e95794  writepolicies_before.txt
01500452c33f8b947f8e76f7c871c9c4ee14fa36443863df656cc92fb3e95794  writepolicies_after.txt
==> PASS c5-write-policies-unchanged
NOTICE:  PASS c1-select-all (same-team AND cross-team rows both visible)
NOTICE:  PASS c2-insert-denied (SQLSTATE 42501)
NOTICE:  PASS c2-update-denied (UPDATE 0, no exception)
NOTICE:  PASS c2-update-denied-row-unchanged (belt-and-braces control, not the UPDATE 0 proof itself)
NOTICE:  PASS c3-anon-denied
NOTICE:  PASS control-own-insert
NOTICE:  T503 widen-rsvp-read tests: ALL PASS
```
Full log: `t503_final_test_run.log` (scratchpad). Exit code **0**.

### C1 mutation — drop the new policy → must fail on a real database

```
--- dropping policy read_all_authenticated ---
DROP POLICY
--- re-running the C1 assertion (must now FAIL) ---
ERROR:  FAIL c1-select-all: expected 4 rows visible to Student One, got 1
CONTEXT:  PL/pgSQL function inline_code_block line 7 at RAISE
MUTATION C1 exit code: 3
```
Went red exactly as required — reverts to the pre-widening 1-row scope.

### C2 mutation — widen the write policy too → C2 must go red

Widened `own_or_linked_write`'s `with check` to `(true)`:

```
--- re-running the C2 assertion (insert-denied must now FAIL) ---
NOTICE:  PASS c1-select-all (same-team AND cross-team rows both visible)
ERROR:  FAIL c2-insert-denied: cross-student INSERT succeeded
CONTEXT:  PL/pgSQL function inline_code_block line 17 at RAISE
MUTATION C2 exit code: 3
```
C1 still passes (read widening untouched by this mutation) and C2 correctly
goes red — proving read and write are genuinely independent in the test, not
just in the migration.

**Bonus, not in §5 but worth recording:** the same mutation was independently
re-run against **C5's sha256 check alone**. Before: `own_or_linked_write`'s
`with_check` = `((student_id IN (...)) AND (responded_by = auth.uid()))`,
hash `01500452c3…`. After the mutation: `with_check` = `true`, hash
`d8806426000e…`. **The hashes differ** — C5 would independently have caught
this same mutation had it shipped, not just C2.

### C3 mutation — grant the new policy to `public`/`anon` instead of `authenticated`

```
--- re-pointing read_all_authenticated at public ---
DROP POLICY
CREATE POLICY
--- re-running the C3 assertion (anon-denied must now FAIL) ---
NOTICE:  PASS c1-select-all …
NOTICE:  PASS c2-insert-denied …
NOTICE:  PASS c2-update-denied …
NOTICE:  PASS c2-update-denied-row-unchanged …
ERROR:  FAIL c3-anon-denied: anon read 4 row(s) from rsvps
CONTEXT:  PL/pgSQL function inline_code_block line 7 at RAISE
MUTATION C3 exit code: 3
```
Went red exactly as required — `anon` reads all 4 fixture rows once the
policy is `to public`.

### C4 mutation — `alter view v_planned_rsvp_hours set (security_invoker = on)`

Injected **before** the widening migration (this is the gate's own named
mutation, packet §5's own citation):

```
--- injecting the mutation BEFORE widening ---
ALTER VIEW
--- BEFORE snapshot under the mutation (student one, direct view read) ---
BEFORE row count under mutation: 1
--- applying the widening migration ---
--- AFTER snapshot under the mutation (student one, direct view read) ---
AFTER row count under mutation: 3
MUTATION C4 correctly went RED: before (1) != after (3)
```
Confirms the gate's finding by independent re-measurement: with
`security_invoker=on`, the view actually enforces RLS as the caller, so it
goes from 1 row (shipped RLS, own only) to 3 rows (after widening) — the
before/after comparison genuinely discriminates.

### C5 — sha256 pair (also shown above, restated per §7.3's explicit ask)

Unmutated run: `writepolicies_before.txt` and `writepolicies_after.txt` both
hash to **`01500452c33f8b947f8e76f7c871c9c4ee14fa36443863df656cc92fb3e95794`**
— byte-identical, proven by execution against `pg_policies`, not inferred
from a clean `git diff`.

### C6 — no application code changed

```
$ git diff --stat -- src/
$ echo $?
0
$ git diff --stat 123fa3e e5fe9b8 -- src/   # against the branch's merge-base with main, not just HEAD~1
$ echo $?
0
```
Both empty. Only `supabase/migrations/` and `supabase/tests/` files were
added; nothing under `src/` touched.

## 4. Where the D010 correction landed, and the applied-migration boundary

The correction lives **only** in the new migration's header —
`supabase/migrations/20260804000001_widen_rsvp_read_all_authenticated.sql`,
section "CORRECTION, D010" — covering **both** occurrences: the one D010
named (`20260723000000_kpi_views.sql:137-152`) and the one it didn't know
about (`20260723000001_dashboard_views.sql:49-60`).

**No applied migration file was edited.** Verified directly:

```
$ git diff --stat -- supabase/migrations/20260723000000_kpi_views.sql \
                     supabase/migrations/20260723000001_dashboard_views.sql
$ echo $?
0
```
Both empty — zero bytes changed in either file. `git status --short` shows
only new (`A`) files, no modifications (`M`) to any existing migration.

One correction to my own citation spans versus the packet's: I read the
actual false-comment blocks directly rather than trusting the packet's line
numbers (constitution item 19c). `kpi_views.sql`'s block is `:137-152` (the
packet says `:136-152`; line 136 is a blank divider comment, not part of the
claim). `dashboard_views.sql`'s block is `:49-60` (the packet says `:50-56`,
which starts one line late and cuts off before the paragraph's last two
lines, `:57-60`, that state the conclusion the false premise was used to
draw). My migration cites the fuller, directly-verified spans.

## 5. Plain-English note for the owner

- **`responded_by` becomes visible.** Every RSVP row already carried who
  answered it (a `profiles.id`), not just what they answered. Before this
  change, RLS hid every row you weren't the responder or a linked guardian
  for; after it, any signed-in teammate can see both the answer *and* who
  gave it. Concretely: if a parent answers "going" on behalf of their child,
  teammates can now see that the parent's account was the one that clicked,
  not the student. This follows directly from your 2026-08-04 ruling and its
  own closing note — recorded, not slipped in.

- **`makeLoadOutreachData` (`outreach.ts:1034`, the loader behind
  `OutreachList`) now returns every rsvp row for the season's sessions to a
  non-staff session too, in the response payload** — not just
  `makeLoadOutreachDetail`, which the packet already named. I checked what
  the OutreachList screen actually does with that payload: `computeStudentHours`
  filters to the viewer's own student id before rendering, and the
  Expected/Attended tiles are coach-only cells, so **nothing changes on
  screen** for a student/parent viewing that list. The data is simply present
  in the network response now, where before RLS trimmed it server-side. I
  independently re-verified the packet's claim that the other four direct
  `rsvps` readers are unaffected: `meetings.ts:371` (coach-only loader,
  gated well before this table read), `reports.ts:433,641` (role-gated
  Reports screens), `dashboard.ts:528` (CoachHome, coach/admin-only), and
  `parentHome.ts:386` (an explicit `.eq('student_id')` filter on top of RLS —
  output unchanged by design either way).

## 6. Findings on packet v2 — what is wrong in it

Two real findings; the first is the significant one.

### Finding 1 (significant): the D010-closure citation the packet requires does not exist in this branch's committed history — it is real, but on a different branch, not yet merged here

Packet v2 §3 states: *"The owner CLOSED D010 on 2026-08-04 … He chose
'option B' (`auto-mode-decisions.md`, that date)"* and requires the
migration header to cite it. **I verified this claim is true in substance**
— but not reachable from my own branch as handed to me.

`docs/swarm/dispute-log.md` and `docs/swarm/auto-mode-decisions.md` **on my
branch** (`claude/t503-work` @ base `123fa3e`) contain **only** D010's
original 2026-07-29 entry ("stays proposed until [George] says go"). No
2026-08-04 closure text exists anywhere in my branch's `docs/swarm/`.

The actual closure commit is real: `71ee027` *"docs: close D010 on George's
ruling -- option B…"*, merged via **PR #71** into `origin/main` at `5157a37`
— but that PR landed on a **sibling branch**
(`claude/migrations-applied-2026-08-04`) that my branch never merged. My
branch's base (`123fa3e`) is **8 commits behind `origin/main`**
(`git log HEAD..origin/main` lists `f6ce0d7`/T504, `2054269`/T506, `e582925`,
`71ee027`, `5157a37` — the D010 closure among them).

I did **not** merge `origin/main` into my branch to close this gap myself —
that felt like broadening scope beyond "widen `rsvps` SELECT plus a
migration" without being asked, and the packet's own framing ("the
orchestrator replays mutations and opens the PR") suggested integration is
the orchestrator's step, not mine. Instead: I read the real commit directly
(`git show 71ee027` — reachable via `git fetch origin main` even though my
branch doesn't contain it) and cited its actual content faithfully in my
migration header, since the substance is genuine and owner-approved. **But
a checker who only checks out `claude/t503-work` as I left it will not find
the closure entry my header cites** — they would need to also check
`origin/main` (or merge/rebase this branch onto it) to verify that citation
independently. Flagging this explicitly rather than letting it surface as a
"can't verify this citation" checker finding: **the orchestrator should
merge current `origin/main` into this branch (or rebase it) before or during
review**, so the D010 closure record and this migration land in the same
merged history.

### Finding 2 (minor): the false-comment citation spans under/over-span the actual claim

Covered in §4 above — `kpi_views.sql:136-152` should be `:137-152`,
`dashboard_views.sql:50-56` should be `:49-60`. Not a content error (the
right migrations and the right false sentence are named), just imprecise
line ranges, the same class of nit round 1's F5 already found elsewhere in
this packet. My migration header uses the corrected spans.

### What I checked and found correct, not wrong

Everything else in §1-§6 of the packet checked out against the live repo:
the RLS file's line numbers (`20260717000002_rls.sql:197-212`), the
`OutreachDetail.tsx` citations (`groupSessionSignups`/`noResponse` at
`:1178-1189`, `SessionSignupList` render site and the `isStaffViewer` guard
at `:1920-1925` for attendance), `queryRsvpsForSessions`
(`outreach.ts:784-792`) being unfiltered, both owner decision entries'
verbatim text, D013's own text, and the gate's measured numbers (1 row
direct / 3 rows via view before widening, 3/3/3 for the three planned-hours
views, `42501` for cross-student INSERT, `UPDATE 0` for cross-student
UPDATE) — all independently re-derived by my own scratch-database run
above, not merely trusted from the gate report.

## Known risks

- This migration has **not** been applied to hosted Supabase (constitution
  item 16 — cutover is the owner's). Only a scratch, disposable PostgreSQL
  16 instance was used, created and destroyed by this session.
- Finding 1 above means a checker verifying my D010 citation strictly
  against `claude/t503-work` alone (without also looking at `origin/main`)
  will not be able to confirm it independently until the branches are
  reconciled.

## Dispute

Not filing a dispute. The task was fully implementable as specified; the one
real gap (Finding 1) is a branch-synchronization issue for the orchestrator
to resolve, not a defect in the task's premise, scope, or feasibility.
