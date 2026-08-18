Closes GAM-407 — the bounded spike ran, and the stop rule does not fire

Ignore GAM-414
Ignore GAM-415
Ignore GAM-416
Ignore GAM-417

## What changed

A disposable-cluster spike answering plan §11.1 decision 1: **is Supabase/PostgreSQL a viable operational run store?** Eight new files — an `ops` schema and a 37-assertion fault harness (`supabase/spikes/`, `supabase/tests/`), plus a controller-ordering module and a deterministic episode-summary renderer with their tests (`scripts/`) — and the spike report those artifacts exist to produce.

**Answer: yes at the database layer, under a configuration that three of four measured findings show is *not* the default.** Criteria 1-4 PASS, criterion 5 PARTIAL, scenario 15 PARTIAL. No criterion is FAIL.

Nothing is deployed. No file under `supabase/migrations/` is touched, no live endpoint contacted, no existing write path modified.

**The most transferable output is four findings about plan §5.1's capability model, all re-established on PostgreSQL 17.11:** RLS keyed on `request.jwt.claims` enforces nothing against a holder who can issue SQL; a `security definer` function owned by a `BYPASSRLS` role runs with RLS off; `PUBLIC` holds `EXECUTE` on every new function by default (an executor reached `advance_generation` on **another run** and was handed its plaintext token); and `SET ROLE` is authorized against `session_user`, so a `nologin` test rig makes every escalation assertion succeed. Three are stock defaults, and every one would have shipped green under a review that read the code instead of running it.

## What the issue and the plan got wrong

- **Plan §5.1 criterion 1 was not testable as the packet first specified it.** The compare-and-set derived `generation` from the row it then filtered on — tautological, and measured incapable of rejecting. `stale_generation` was an unreachable outcome. Fixed by making the executor assert its generation; without that, this PR would have reported criterion 1 PASS while testing two thirds of it.
- **The issue asked the spike to measure the live project's extension set and plan tier. No dispatched run can** — plan §5.2 means there is no credential, deliberately. The owner measured it interactively (GAM-408): free tier, seven extensions, PostgreSQL 17.6.1.141, and **nothing in this design needs an extension**.
- **`supabase/config.toml:33` declares `major_version = 17` while `.github/workflows/ci.yml:196` has tested every SQL suite on `postgres:16`.** Pre-existing, surfaced by this row's PG-17 pin, filed as GAM-415.
- **The packet's own expectation `service_role=f` contradicted its requirement to create that role `bypassrls`.** The worker took the requirement, flagged it, and the checker endorsed it. Corrected in the packet rather than deleted, per item 30c.

## Tier: HEAVY, stated and defended

Item 26's trigger is *can a mistake here corrupt data, or lie to a user about their own data?* Two triggers fire: `security definer` helpers plus RLS on the negative-control table, and **the artifact decides the architecture every Phase 2 slice builds on**. Worker A carried item 18's `model: "opus"` override for the SQL.

**The losing argument was STANDARD:** nothing here ships to a user, no product table changes, and the whole thing lives under `supabase/spikes/`. That reading is wrong for one reason — a spike whose *output is a decision* is only as good as its adversarial review, and this row is the evidence. **The premise gate ran four rounds and returned REVISE three times**, catching two BLOCKERs, then three more, then one more, every one of them by building the design on a real cluster rather than reading it. Then the code checker **failed the finished work** on a fifth. A STANDARD tier would have shipped the first version.

**Process deviation, declared rather than relabelled:** item 19a caps the gate at two rounds. Rounds 1 and 2 ended in an escalation the human owner closed on 2026-08-18 (*"proceed, pin the harness to PG 17"*), which restarted the cycle; rounds 3 and 4 are that cycle. Round 4 returned DISPATCH.

## Verification

```
GATE RUN — 482183b on claude/gam-407-run-store-spike — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)    exit 0  PASS       98 files / 2505 tests  baseline 2466 (+39)
  6 vitest scripts/  exit 0  PASS       13 files / 299 tests  baseline 260 (+39)

VERDICT: PASS — all six gates exit 0
```

Harness, on PostgreSQL **17.11** with 24 of 25 product migrations applied: **37 assertions, 0 failed, exit 0**. Reproduced independently by the reviewing checker on its own cluster. Re-run on PostgreSQL **16.14**: also 37/0 — **nothing in the design is PG-17-specific**, measured by two agents.

| Mutation | Result |
|---|---|
| Drop `version` from the CAS `where` clause | RED — `ac2-single-update-cas` and `crit1-stale-version` |
| Drop `unique (issue_identifier, todo_event_id)` | RED — 13 failures. Arrives as a hard `42P10` (`on conflict` unplannable), **not** as a duplicate row; the checker built the stronger variant separately and got `rows=2`, two distinct `run_id`s, both `created=true` |
| `alter function ops.publish_checkpoint owner to postgres` | RED — `guard-d3-ownership` |
| `publishExternal` calls the sinks before validating | RED — 8 tests, all six zero-invocation cases plus the ordering test |

**The check that changed the outcome.** `checker-reviewer` **FAILED** the first attempt and proved it by construction: scenario 15's assertion had a term satisfied trivially whenever no publication ever occurred. With `schema.sql` completely intact it pointed the token at a non-resolving value, and the harness still reported `37 assertions, 0 failed`, `ALL PASS`, exit 0 — with the line still claiming the publication rolled back. Fixed in `4c4389d`. On re-review the checker re-ran its own probe (now red, and red for the *new* reason) and then designed a second one it had not been asked for — a *valid* token with a version the CAS could not match, isolating "the update happened" from "the token resolved". Also red.

## Scope

Item 27 does not apply: a database spike has no user-visible surface, and the issue's own framing is evidence rather than infrastructure. Nothing here reads from a fixture on a user's real path because nothing here is on a user's path.

Two results are **PARTIAL and say so in the report** rather than being rounded up: criterion 5 (the deterministic renderer exists; nothing writes to git) and scenario 15 (the unreachable-store case is exercised; the ambiguous partial-write case is not). Criterion 3's PASS carries a stated limit in the same sentence, every time it is quoted: the hosted project's `pg_roles` attributes are unmeasured.

## Follow-ups filed (item 20), all to `Backlog`

- **GAM-414** `tier/fast` `gate/human` — one `pg_roles` query on the owner's channel, which lifts criterion 3 from PASS-with-caveat to PASS.
- **GAM-415** `tier/standard` — the CI/`config.toml` PostgreSQL major skew, and CI-wiring this harness when Phase 2 builds the real store.
- **GAM-416** `tier/fast` — three harness assertions that pass when the thing they guard does not exist. Same family as the MAJOR the checker caught, found before they misled anyone.
- **GAM-417** `tier/standard` — criterion 5's git-write half.

## Known gaps, disclosed

- **The harness is deliberately not wired into CI.** `ci.yml:196` runs the `sql` job on a `postgres:16` service container that installs no server binaries. Wiring it in would either go red or require bumping that image — which moves **nine currently-green SQL suites** onto a new major, a Definition of Ready #5 decision belonging to the owner and not something to smuggle in as a side effect of a spike. GAM-415.
- **The Edge-Function capability variant is compared but not built.** The report labels that comparison as reasoning, not evidence.
- **`20260719000000_cron.sql` is not applied** on the scratch cluster (needs `pg_cron`), so nothing depending on it is represented in these 37 assertions.
- The harness measured **17.11**; the live server is **17.6.1.141**. Same major, different minor, stated rather than collapsed to "PG 17".
- **One input to §11.1 decision 1 that this spike could not settle:** the live project is on the **free** tier, where a project pauses on inactivity — a sibling project in the same org currently reads `INACTIVE`. A store whose purpose is outliving executor death, hosted where the store itself pauses, is an architectural question for the owner, and it is the one thing that could still turn decision 1 around.

`docs/swarm/active/GAM-407-spike-report.md` §5 carries a twelve-item list of things this work **must not** be quoted as claiming. It is the checker's list, and it is binding.

Linear-Issue: GAM-407
