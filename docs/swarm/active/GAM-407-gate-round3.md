# GAM-407 — `checker-premise` gate, round 3

**VERDICT: REVISE.** 1 BLOCKER, 2 MAJOR, 2 MINOR, 4 NIT.

Artifact: `docs/swarm/active/GAM-407-packet.md` **revision 4**, at commit
`7284635` on `claude/gam-407-run-store-spike`.
Agent: `checker-premise`, opus, `run_in_background: false`. ~107K tokens, 41 tool
calls, 12.1 minutes. Own scratch cluster on port 55437, PostgreSQL **17.11**,
stopped and deleted before returning.

Rounds 1 and 2 are at `GAM-407-gate-round1.md` and `-round2.md`. This round was
authorized by the human owner, who closed rounds 1/2's item-19a escalation on
2026-08-18 and re-dispatched the row; the gate was instructed not to re-raise the
closed escalation, and did not.

---

## The headline, which is not the verdict

The gate **rebuilt the entire prescribed design on its own PG 17.11 cluster and
attacked it**, rather than reading it. **The design survived.** Every criterion-3
negative, the compare-and-set, idempotency under genuine concurrency, generation
fencing, scenario 14 (never previously exercised by anyone), scenario 15's
store-side half and the D2a forgery control all reproduce on the pinned major.

The three substantive findings are **not** about the database design. Two are
about things the packet *claims as evidence* that its own criteria do not
deliver, and one is a PG-17-specific collision with CI that the pin created.

---

## Findings

### BLOCKER-R3-1 — AC12's hard version abort makes the MAJOR-6 CI patch guaranteed-red, and D7's connection method cannot work on CI's server

**Measured:**

```
.github/workflows/ci.yml:196        image: postgres:16
.github/workflows/ci.yml:212-215    PGHOST: localhost / PGPORT: '5432'
                                    PGUSER: postgres / PGPASSWORD: postgres
supabase/tests/run_t503_widen_rsvp_read.sh:13   PSQL=(psql -X -v ON_ERROR_STOP=1)
supabase/tests/run_t503_widen_rsvp_read.sh:22   CREATE DATABASE "$DBNAME";
```

The `sql` job runs every suite against a **`postgres:16` service container**.
T503 — revision 4's own named shape precedent — creates a scratch *database* on
that ambient server; it never starts a cluster. Apply the MAJOR-6 patch and the
new step runs on PG 16, `server_version_num` is `16xxxx`, AC12's abort fires, and
the `sql` job goes red. **The packet mandated producing a patch whose only
possible effect on the CI it targets is failure.**

The alternative reading of AC1 — "on a scratch cluster started per the measured
procedure (`sudo -n`)" — fails differently: the `sql` job installs only
`postgresql-client` (`ci.yml:222-225`), so `/usr/lib/postgresql/*/bin` holds no
server binaries and `start.sh:34` exits 2 with `no PostgreSQL server binaries
found`.

**Second half, same root.** D7's basis is stated as *"the scratch cluster's
`pg_hba.conf` is `local all all trust`"* — confirmed on 55437, including as OS
user `runner`. CI's connection is TCP to `localhost:5432` with
`POSTGRES_PASSWORD` set, i.e. `scram-sha-256`; a freshly created passwordless
`ops_executor` cannot authenticate. **Criterion 3's negatives — the entire fix
for round 2's BLOCKER-R2-3 — are not reproducible under the delivery path the
packet specifies.**

The underlying skew is pre-existing and not the packet's fault
(`supabase/config.toml:33` declares `major_version = 17` while CI tests on 16).
This packet is the first artifact to make it load-bearing.

### MAJOR-R3-1 — `stale_generation` is unreachable under D2's signature

`publish_checkpoint(p_token text, p_expected_version int, p_payload jsonb)` takes
**no generation**. Per spec it derives `run_id` and `generation` from the row it
looked up by `sha256(p_token)`, then filters the update on that same row's
generation: **tautological, and it can never reject.** And because
`advance_generation` rotates `capability_hash`, a stale-generation token is by
construction an *unknown* token.

Measured on 17.11, implementing the spec faithfully:

```
publish_checkpoint(tok, 1, '{"ok":true}')      -> ok | 2
publish_checkpoint(tok, 1, '{"stale":true}')   -> version_conflict
                                     row re-read: gen 1, ver 2, {"ok": true}  (unmoved)
advance_generation(run, 2)                     -> ok | <new token>   row: gen 2, ver 3
publish_checkpoint(<OLD tok>, 3, …)            -> no_such_capability
                                     row re-read: gen 2, ver 3, {"ok": true}  (unmoved)
```

No input produces `stale_generation`. Round 2's own transcript agrees — three
names, not four. The name survived from revision 1's signature, which D2 changed.

**Consequence.** Worker A cannot produce the name; Worker B is required to emit
it; the checker is instructed to verify B's names against A's schema. **This is
the same cross-worker seam class the packet's own LCD 5 asserted was closed**,
moved one layer down.

### MAJOR-R3-2 — AC12 does not re-establish F2 or F4; the §"PG 17" table said it does

D3 asserts `rolbypassrls = false` for the owner of every `ops` object. That
establishes the F2 **precondition is avoided**; it says nothing about whether a
`BYPASSRLS` owner still defeats forced RLS on PG 17. If 17 had changed that
behaviour, D3 would pass unchanged and nobody would learn anything. Same for F4:
asserting `session_user = 'ops_executor'` and `usesuper = false` proves the *rig*
is correct, not that `SET ROLE` is authorized against `session_user`. **Rig
guards mislabelled as findings.** The D2a control does not help either — it is
owned by `ops_owner` (`NOBYPASSRLS`), so it never exercises a `BYPASSRLS` owner.

**The gate closed both by direct measurement instead:**

- **F2 HOLDS on 17.11.** `probe.sd_move()`, `security definer`, owner `postgres`
  (`rolsuper=t rolbypassrls=t`), table with `enable` + `force row level
  security`, called from an `ops_executor`-class session with `reset
  request.jwt.claims` (`visible_with_no_claim = 0`) → returned `ok`; re-read as
  `postgres`: `id 1 | MOVED_BY_SD`. **The row moved with RLS forced and no claim
  set.**
- **F4 HOLDS on 17.11.** From a `postgres` session, `set role probe_exec` gives
  `session_user=postgres, current_user=probe_exec`; then `set role probe_owner`,
  `set role postgres` and `set role service_role` **all succeed**. From the
  direct login, all three are `ERROR: 42501: permission denied to set role`.

### MINOR-R3-1 — "Not deferrable to another run either" is false

LCD 2a said the hosted `pg_roles` gap cannot be closed by anyone. **GAM-408 is
the counterexample, on this row, today**: the owner measured extensions and plan
tier through an authorized interactive connector, which is not a run and is not
bound by §5.2. One statement closes LCD 2a and most of LCD 3:

```sql
select rolname, rolsuper, rolbypassrls, rolinherit, rolcanlogin
from pg_roles where rolname in ('service_role','authenticated','anon','postgres');
```

Revision 4 also withdrew revision 3's item-20 row as "unnecessary". The
extension/tier half did happen; **the role half did not, and nothing now carries
it** — the situation item 20 exists to prevent.

### MINOR-R3-2 — AC2 passes while proving nothing about fencing

The `pg_get_functiondef` assertion is mechanically satisfiable on 17.11 (`update
ops.run` occurs exactly once; `SET search_path TO 'ops', 'pg_catalog'` renders
cleanly; output shape unchanged from 16). But per MAJOR-R3-1 the `generation`
conjunct can never reject, so a green AC2 tells a reader generation is enforced
in the CAS when it is not.

### NITs

1. `start.sh:33` quoted inexactly — the line is
   `PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)`.
2. On 17.11 the default table ACL is `arwdDxt**m**/postgres` — PG 17's new
   **MAINTAIN** privilege. A worker copying round 2's `arwdDxt` string into an
   exact-match assertion writes a red test.
3. The least-confident list has six entries; item 19d says three to five.
4. Forbidden Files reads as exhaustive but omits `.claude/settings.json`,
   `docs/swarm/constitution.md` and `docs/swarm/dispute-log.md`.

---

## Prior-round findings re-tested

| Finding | Round | Status |
|---|---|---|
| F1 `request.jwt.claims` settable; `REVOKE SET ON PARAMETER` ineffective | R1 BLOCKER-1 | **Re-established on 17.11.** After `revoke set on parameter … from public` *and* `from probe_exec`, the role still ran `set request.jwt.claims` → SET, read back the forged claim, saw the other run's row, `UPDATE 1`; re-read as `postgres`: `r2 \| FORGED` |
| F2 `security definer` + `BYPASSRLS` owner defeats forced RLS | R1 BLOCKER-2 | **Re-established on 17.11 by this gate** (not by AC12 — MAJOR-R3-2) |
| F3 PUBLIC holds EXECUTE on new functions | R2 BLOCKER-R2-1 | **Re-established on 17.11.** Fresh `probe.f()` → `proacl` NULL; called by an ungranted role |
| F4 `SET ROLE` authorized against `session_user` | R2 BLOCKER-R2-3 | **Re-established on 17.11 by this gate** (not by AC12) |
| Forced-RLS deadlock → D6 drops RLS | R2 BLOCKER-R2-2 | **CLOSED.** Executor denial is `aclcheck_error, aclchk.c:2843` — a privilege denial, not a policy denial |
| T503 role DDL misdescribed | R2 MAJOR-R2-1 | **CLOSED.** `:35` is `create role service_role nologin;`; the packet's correction is accurate |
| Default-privileges simulation scoped to `public` | R2 MAJOR-R2-2 | **CLOSED.** Exactly one `pg_default_acl` row, `ns=public` |
| DoR #3 unapproved | R2 MAJOR-R2-3 | **CLOSED by the owner.** Not re-raised |
| Return shape unconstrained | R2 MINOR-R2-1 | **CLOSED.** Built and confirmed: no `ops.run` column reaches the caller |
| item 27 → item 20 citation | R2 MINOR-R2-2 | **CLOSED**, correction retained per item 30c |
| D2a insert deadlock | R2 MINOR-R2-3 | **CLOSED.** Seeded before `force`; control ran clean |
| CI never invokes the harness | R1 MAJOR-6 | **Still true, and now worse** — BLOCKER-R3-1 |
| `gates.py --scope scripts/ --baseline-scoped 260` | R1 MINOR-1 | **CLOSED.** `npx vitest run scripts/` = 11 files / 260 tests |

**All nine of round 2's required revisions are correctly applied in revision 4;
nothing adjacent was broken by the surgical edits.**

---

## Positive results measured on PG 17.11 — spike evidence

| Claim | Measured |
|---|---|
| Harness follows the pin | `start.sh` selected `/usr/lib/postgresql/17/bin`; `ready: postgres 17.11`; `server_version_num = 170011`; 24 of 25 migrations applied (`pg_cron` skipped) |
| Built-ins, no extension | only `plpgsql` installed; `sha256(bytea)` → 64 hex chars; `gen_random_uuid()` → ok |
| D5 explicit revokes | after the packet's five lines: `reserve_run`/`advance_generation`/`record_terminal_event` → `{ops_owner=X/ops_owner}`; `publish_checkpoint` → `{ops_owner=X/ops_owner,ops_executor=X/ops_owner}`. **No NULL ACLs** |
| D3 ownership | `ops_owner=f, ops_executor=f, service_role=f, postgres=t` |
| D7 direct login | `psql -U ops_executor` works on the scratch socket even as OS user `runner`; `session_user=ops_executor`, `usesuper=f` |
| Criterion-3 negatives | `ops.run` → `42501 permission denied for table run`; `public.events` → `42501`; `set role ops_owner/postgres/service_role` → three `42501`s; `reserve_run`/`advance_generation`/`record_terminal_event` → three `42501`s; forged token → `no_such_capability`, nothing moved |
| **Bonus negatives, not in the packet** | `create table public.zz_probe` → `42501 permission denied for schema public`; `create function public.sha256(bytea)` → `42501`. **The `search_path` shadowing attack on the `security definer` functions is closed** |
| Criterion 1 | exactly one `update ops.run`; `ok\|2`, then `version_conflict` with the row re-read unmoved |
| Criterion 2 | sequential and concurrent both: one row, same `run_id`, `created` true→false, `count(*) = 1`. Loser blocks on the winner's speculative-insert token with **no advisory-lock barrier needed** |
| Scenario 13 | `advance_generation` → gen 2 + rotated hash; old token → `no_such_capability`; row re-read gen 2 / ver 3 / `{"ok": true}` unchanged |
| **Scenario 14 (never previously exercised)** | `record_terminal_event` twice → `recorded` then `duplicate`; one `run_event` row (`{"n": 1}`); one effect on `ops.run` (`status=terminal`) |
| Scenario 15 store-side | `FATAL: 57P01: terminating connection due to administrator command`, psql exit **2**, mid-flight update **rolled back** |
| D2a negative control | with a `NOBYPASSRLS` owner and rows seeded before `force`: the executor forged `r2`'s claim and moved the row → `r2 \| FORGED` |
| `pg_get_functiondef` (AC2) | shape unchanged on 17; `SET search_path TO 'ops', 'pg_catalog'`; `where` carries all three columns |

---

## Conflicts with shipped work

- **No file collision.** `supabase/spikes/` does not exist; all eight worker
  paths are new; `supabase/migrations/` holds 25 files, untouched. The plan
  document is correctly forbidden (GAM-410 / PR #198).
- **One latent reversal, via BLOCKER-R3-1's remedy #1.** Bumping `ci.yml:196`
  `postgres:16` → `postgres:17` would move **nine currently-green SQL suites**
  (`tests/rls/run.sh`, `supabase/tests/run.sh`, T700, T801, T205, T322, T503,
  T195, T509) onto a new major in one patch. That needs explicit authorization
  under Definition of Ready #5 and **must not be smuggled in as a side effect of
  a spike's CI wiring.**

## Required revisions

1. Resolve the AC12-abort vs `postgres:16` CI collision (BLOCKER-R3-1).
2. Resolve `stale_generation` (MAJOR-R3-1).
3. Rewrite the §"PG 17" F2/F4 rows and AC12 (MAJOR-R3-2).
4. Add one sentence to AC2 (MINOR-R3-2).
5. File an item-20 successor row for the hosted `pg_roles` query; delete "not
   deferrable" from LCD 2a (MINOR-R3-1).
6. The four NITs.

*Scratch cluster stopped and deleted (`stopped and deleted /tmp/scratch-pg-55437`);
port 55432 never touched; shared tree `git status` clean.*
