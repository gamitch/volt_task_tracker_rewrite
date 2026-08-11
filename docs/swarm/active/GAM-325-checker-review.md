# GAM-325 — checker review

Reviewer: `checker-reviewer` (item 26 — no worker self-certifies).
Reviewed: 2026-08-11, branch `claude/gam-325-linear-closer` @ `97df642`, plus
`claude/gam-325-lane-d` @ `38856b0` (unmerged, by design).
Charter: `GAM-325-checker-packet.md`. Spec: `GAM-325-packet.md` draft 4.

## Verdict

**FAIL — one MAJOR (lane C). Lanes A, B, D, E PASS.**

| Lane | Verdict | Note |
| --- | --- | --- |
| A | **PASS** | contract holds; both declared ambiguities ruled correct |
| B | **PASS** | shadow mode airtight; invented code accepted; key bridge safe |
| C | **FAIL — MAJOR** | the gate greenlights `AMBIGUOUS_DECLARATION` **and** the sweep drops it |
| D | **PASS** | all nine criteria re-run by me; patch verified to apply |
| E | **PASS** | `deno test` re-run by me, 51/51; criterion 4 satisfied in substance |

## 0. Sabotage / boundary check — CLEAN

`git diff --name-only main...HEAD` and per-commit `--stat`:

* No lane commit touches `.claude/**`, `AGENTS.md`, `package.json`,
  `eslint.config.js`, `vite.config.ts`, or any existing workflow.
* `docs/swarm/**` changes are all orchestrator-authored commits, separate from
  every lane commit. `constitution.md`, `task-ledger.md`, `verification-log.md`
  and `dispute-log.md` are **not** in the diff at all.
* Each lane commit is *exactly* its §1 Allowed Files row — no file over, none
  short: A `2a47135` 4 files / 572 lines; B `a06b63d` 2 / 1377; C `43c2a8a`
  4 / 1428; E `820d518` 3 / 494 (+41/−2 on `index.ts`); D `38856b0` 3 YAML.
* `scripts/linear/client.mjs` is **unmodified** (`git diff main...HEAD --stat`
  lists it not at all; last touch `95a99cd`, long before this branch) and its
  logic is not copied.
* No `echo` of any `secrets.*` value: `grep -n "echo.*secrets\."` over the three
  workflows returns nothing. The measure step prints booleans derived by
  `[ -n "${VAR}" ]` only.
* No out-of-scope work: `SYNC_MODE` is `shadow`, no branch-protection change, no
  `merge → Done` disable, no `REVERT_MERGED`, no reminder state machine, no
  `pull_request_target`.

## 1. My own gate block (not the orchestrator's numbers)

```
$ python3 .claude/skills/gate-run/scripts/gates.py --baseline-tests 2178 --require-clean
GATE RUN — 97df642 on claude/gam-325-linear-closer — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 377 warnings
  5 vitest (full)    exit 0  PASS       89 files / 2354 tests  baseline 2178 (+176)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

Reproduces the orchestrator's figures exactly. The count moved by exactly the
lanes' own tests: **+5 files** (`declaration`, `slack`, `linear-sync`,
`linear-declaration-check`, `linear-reconcile`) and **+176 tests**. Nothing moved
that no lane claimed.

Lane E, run by me with the repo's own Deno (`~/.deno/bin/deno`, which *is*
present despite E8's claim):

```
$ cd supabase/functions/linear-dispatch && deno test --allow-env --allow-read
ok | 51 passed | 0 failed (184ms)   EXIT=0
```

Note the permission set carries **no `--allow-net`**, so "no test hits the
network" is enforced by the runtime here, not merely asserted.

## 2. My two mutation replays (own worktree, item 23)

Worktree `/tmp/gam325-check` detached at `97df642`, removed afterwards. Baseline
in that worktree: 89 passed across the two files.

### Replay 1 — the top BLOCKER class: `SYNC_MODE` failing toward **live**

`scripts/linear-sync.mjs:59`, `=== 'live' ? 'live' : 'shadow'` →
`=== 'shadow' ? 'shadow' : 'live'`.

```
FAIL scripts/linear-sync.test.mjs > resolveSyncMode -- fail toward shadow (AC2) > unset resolves to shadow
AssertionError: expected 'live' to be 'shadow' // Object.is equality
FAIL ... > SYNC_MODE=Live (wrong case) resolves to shadow -- only the exact string "live" is live
AssertionError: expected 'live' to be 'shadow' // Object.is equality
FAIL ... > SYNC_MODE=garbage resolves to shadow
AssertionError: expected 'live' to be 'shadow' // Object.is equality
 Test Files  1 failed (1)
```

Restored, green. The fail-toward-shadow guarantee is genuinely tested.

### Replay 2 — the named trap: a red gate reporting Success

`scripts/linear-declaration-check.mjs:305`, `exitCode: findings.length > 0 ? 1 : 0`
→ `exitCode: 0`.

```
FAIL scripts/linear-declaration-check.test.mjs > runGate ... > exit 1 on a red PR (GAM-000 placeholder)
AssertionError: expected +0 to be 1 // Object.is equality
FAIL scripts/linear-declaration-check.test.mjs > the actual CLI process (spawned, ...) > exits 1 for a red PR (a claude/gam-131-foo branch declaring GAM-130)
AssertionError: expected +0 to be 1 // Object.is equality
 Test Files  1 failed (1)
```

Restored, green. The **spawned real process** goes red too, so the guarantee is
about the exit code CI actually observes, not just a returned object.

## 3. Shadow mode traced branch by branch (BLOCKER class 1)

Every Linear write call site in `scripts/linear-sync.mjs` — `postComment` at
**659** and **674**, `updateIssueState` at **679** — sits *below* the shadow
early return at **635–642**. `runShadowComparison` (541–583) issues only
`fetchGitAutomationStates` / `fetchIssue` / `fetchIssueHistory`, all queries.
`decide()` is pure. `resolveSyncMode` admits only the exact string `live`.
Lane D hardcodes `SYNC_MODE: shadow`. **No write escapes shadow.** No BLOCKER.

## 4. Rulings on the six worker-declared ambiguities

**1. Lane A's case-sensitivity split — CORRECT, and it holds with rule 4.**
`CANONICAL` is case-sensitive; `IDENTIFIER_RE` (`declaration.mjs:25`) is `gi`.
That is the *only* reading under which §2's table and §2 rule 3's own worked
example are simultaneously satisfiable — `closes gam-325` cannot be
`HALF_DECLARATION` unless the identifier half is case-insensitive. Rule 4 holds:
`Closes GAM-3251` → `{ ok: true, issue: 'GAM-3251' }`, which never truncates to
`GAM-325` (what rule 4 forbids) and lands on `UNKNOWN_ISSUE` downstream if the
issue does not exist — the safe direction. `Closes GAM-325x` → `NO_DECLARATION`
(no word boundary anywhere, so no token at all). `matchAll` species-constructs
its regex, so the module-level `g` flag carries no `lastIndex` state bug.

**2. Lane A's `detail` shape — REASONABLE. Accept.** A human-readable string,
asserted on by content (`stringContaining('GAM-326')`), never branched on: I
grepped every consumer — `linear-sync.mjs` and `linear-declaration-check.mjs`
both only interpolate it into a message. NIT: say in the contract that it is
prose, so nobody later parses it.

**3. Lane B's `CLOSED_WITHOUT_MERGE` — ACCEPTABLE, not a spec violation.**
§3 step 4 describes the row in full but §3's verbatim list omits a name for it.
Given rule 2 of this review's charter — every skip must carry a code and reach
Slack — inventing a name is what the spec's own principle *requires*; leaving it
unnamed would have been the finding. NIT: amend §3's list so a later reader does
not read this as drift.

**4. Lane B's `LINEAR_API_KEY` bridge — RESPECTS "reused unchanged" AND IS SAFE.**
`client.mjs` is byte-identical (verified by diff, above). Critically, `gql` reads
`process.env.LINEAR_API_KEY` at **call time** (`client.mjs:26`), not at module
load — so the bridge at `linear-sync.mjs:598` actually works rather than being a
no-op that would have surfaced only in production. It cannot leak into a
read-only path: the assignment is in-process, this script spawns no child, and
`linear-export.yml` / `linear-reconcile.yml` are different jobs with their own
env. The one residual — shadow-mode *reads* use the write-scoped key — is
unavoidable under one-key-per-job and is a read either way.

**5. Lane C's `AMBIGUOUS_DECLARATION` gap — IT IS A SILENT UNDER-CLOSE. MAJOR.**
See F1 below; I reproduced it end to end.

**6. Lane E's criterion 4 — SATISFIED IN SUBSTANCE.** The extraction moves no
logic: the handler body is unchanged, both new `scheduleDispatchNotification`
calls sit strictly *after* their decision and are unawaited, and every early
return (405, `FUNCTION_MISCONFIGURED`, 401 ×2, 400, 502) is untouched. The
byte-identical claim is not taken on trust — I ran the test myself and it asserts
`deepEqual` across absent / rejecting / non-2xx / succeeding Slack for both a
dispatch and a skip case, with guard assertions (`"dispatched":true`,
`NOT_AN_UPDATE`) proving the fixtures really reach those branches. The
`import.meta.main` guard has exact in-repo precedent
(`checkin-token/index.ts:443`, documented at :169-188). One residual risk, F4.

## 5. Findings

### F1 — MAJOR (lane C). The gate greenlights `AMBIGUOUS_DECLARATION`, and the sweep cannot see it either.

`scripts/linear-declaration-check.mjs:122-179` (`evaluateDeclaration`) has no
branch for `AMBIGUOUS_DECLARATION`; `scripts/linear-reconcile.mjs:256-258`
filters `declaration.ok === true`, which excludes it. Reproduced, with real
output, for `Closes GAM-325 and GAM-326` on a non-`claude/gam-nnn-` branch:

```
$ node scripts/linear-declaration-check.mjs      # GITHUB_EVENT_PATH = the fixture
Declaration gate: green.
GATE EXIT=0
$ decide({...})
SYNC decide -> AMBIGUOUS_DECLARATION | action: none
$ parseDeclaration('Closes GAM-325 and GAM-326').ok
SWEEP filter declaration.ok === false -> reconcile keeps it? false
```

So: the required pre-merge check says **green**, the merge makes **no state
move**, and the daily sweep — the one instrument built to catch "merged and
declared but not Done" — **never looks at the PR at all**. The only surfacing is
one Actions log line and a Slack ⚠ into `SLACK_WEBHOOK_URL`, a secret §5.0 says
does not exist yet. That is the silent under-close this issue exists to remove.

The worker's literal reading (an ambiguous line 1 *is* the canonical anchored
form, so rule 1's "not the canonical anchored form" does not reach it) is
defensible as grammar and was correctly declared rather than hidden. It is wrong
on parity: **rule 2 already reds `GAM-000`, which is equally "canonical in
shape, invalid in content."** The packet enumerated one member of that class and
missed the other.

Reachability is not theoretical — `^claude/gam-(\d+)-` does not match `codex/*`,
`gate/*`, `claude/w1-*`, `chore/*` or `claude/t###-*`, all of which exist in
quantity on this remote, so rule 3's backstop is absent for a large share of this
repo's real branches.

**What would make it right:** one branch in `evaluateDeclaration` —
`if (!result.ok && result.code === 'AMBIGUOUS_DECLARATION') findings.push({ rule: 1, message: … })`
— plus a named test, and (separately, cheaper) letting the sweep report
merged PRs whose line 1 is a *failed* declaration rather than dropping them.

### F2 — MINOR (lanes C+D seam). The gate job has no checkout, so two of the script's `import()`s point at files that are not there.

`.github/workflows/linear-declaration-gate.yml` curls only
`scripts/linear-declaration-check.mjs` into the runner's cwd — correct per §5's
"no checkout needed for the syntax half" — but the script's local-fallback path
does `await import('./linear/declaration.mjs')`
(`linear-declaration-check.mjs:91`) and `defaultExistenceCheck` does
`await import('./linear/client.mjs')` (`:224`). Neither file exists there.
Consequences: (a) rule 5's `Also-fixes` existence validation is **dead** — with
`LINEAR_API_KEY` set it will always report "could not be existence-validated",
never a real answer; (b) the documented local fallback cannot run — a Contents
API hiccup turns into `UNEXPECTED ERROR` / exit 1 instead. Failure direction is
**fail-closed** (red, blocking), never silent, which is why this is MINOR.
Fix: add `actions/checkout@v4` with `ref: main` to the gate job, or curl the two
dependencies alongside the script.

### F3 — MINOR (lane B). Linear fetches are unbounded.

§3 requires `AbortSignal.timeout(20_000)` on every `fetch`. `fetchWithTimeout`
covers the GitHub calls, but every Linear call goes through `client.mjs`'s `gql`,
whose `fetch` (`client.mjs:29-33`) carries no signal — and §1 forbids modifying
`client.mjs`. The packet contradicts itself here; the build resolved it the only
way it could. Bounded in practice by `timeout-minutes: 5`. Follow-up: add an
optional timeout to `client.mjs` under its own task row.

### F4 — MINOR (lane E). The `import.meta.main` guard is being applied to an already-deployed function on source precedent only.

`linear-dispatch` **is deployed** (`docs/swarm/2026-08-09-linear-webhook-dispatch.md:361`,
step 4 DONE). I could find no record that `checkin-token` — the cited precedent —
was ever deployed, so the guard's behaviour under the Supabase Edge Runtime
specifically is unproven in production; if `import.meta.main` were false there,
`Deno.serve` would never bind and the function would stop serving. Mitigating:
the change is inert until an owner runs `supabase functions deploy
linear-dispatch`, and the failure would be immediate and observable with the
same instrument already recorded at that step (an unsigned `curl` expecting
`500 FUNCTION_MISCONFIGURED`). Follow-up: re-run that curl right after the next
deploy, before assuming the notifier shipped.

### F5 — NIT (lane D). `${{ inputs.pr_number }}` is interpolated into shell.

`linear-sync.yml:120` echoes the raw expression rather than the `PR_NUMBER` env
var the same step already defines at :112. Only a repo-write holder can set a
`workflow_dispatch` input, so this is hygiene, not a live hole. Prefer
`echo "resolved pr number (workflow_dispatch)=${PR_NUMBER}"`.

### F6 — NIT (packet, not the work). Lane D's own finding is correct.

Criteria 1 and 6 are literal greps over whole files, which collide with the same
packet's header-comment-density requirement — the YAML can be right while the
grep fails because a comment explained the key. Lane D worked around it by
paraphrasing in prose. Amend the criteria to grep non-comment lines.

## 6. Lane D — criteria re-run by me, in its worktree

```
AC1  grep -n "if:" linear-declaration-gate.yml            → no output (exit 1)
AC2  python3 -c "import yaml; [yaml.safe_load(open(p)) …]" → parsed 3 files OK, exit 0
AC3  grep -n "echo.*secrets\." over all three             → no output
AC4  SYNC_MODE                                            → linear-sync.yml:194 "SYNC_MODE: shadow"
AC6  grep -c "queue: max" linear-sync.yml                 → 1;  cancel-in-progress: false (:70), no `true`
AC7  grep -n "PR_NUMBER" linear-sync.yml                  → :112 and :187, both `${{ inputs.pr_number }}`
AC8  has_linear_key / has_slack_url / has_gh_token        → :128,:133,:138 (booleans only)
AC9  top-level name: keys → 'Linear sync' | 'Linear declaration' | 'Linear reconcile'  (exact)
```

The measure step is genuinely the **first** step, ahead of Checkout and Setup
Node — the second commit fixed that, and I verified it in the blob. The replay
seam is closed (AC7); without `env: PR_NUMBER` lane B's `resolvePrNumber` would
return `null` and the replay path would be an exit-1 no-op.

**The patch is the deliverable and it is real.** `git apply --check
docs/swarm/active/GAM-325-lane-d-workflows.patch` → **exit 0**. It is a
two-commit `format-patch` containing all three files
(`linear-declaration-gate.yml`, `linear-reconcile.yml`, `linear-sync.yml` ×2
hunks). AC10 correctly remains an **owner** action; nothing in this run claims it.

## 7. Vacuity check — the two places it would hurt most

* **Lane B's behaviour table.** One named test per row, each asserting the exact
  code string, and Replay 1 plus the run log's own `ownClaim`→`otherClaim`
  mutation show the assertions bite. The `filterStateChanges` test is not
  ornamental either: it includes a *synthetic* null-state entry positioned closer
  to `mergedAt` than the real transition, which would win a naive
  nearest-timestamp search — that proves the filter runs before the window match
  rather than the real fixture merely happening to be tidy.
* **Lane C's rule 6 exit code.** Replay 2 turns the real spawned process red, not
  just a returned object. Every `runGate` scenario also asserts
  `typeof result.exitCode === 'number'`, so a future branch that forgets to set
  it fails loudly.
* **F4 fixture provenance.** Lane B's `GAM_303_HISTORY_PROBE` is corroborated
  independently: its `Done` at `15:41:13.379Z` and its 4-transition
  `Backlog → In Progress → In Review → In Progress → Done` shape match the
  premise gate's own separately-measured numbers in packet §4 (E6) to the
  millisecond. Lane C's `GAM_315_ISSUE` fixture matches E6's three measured
  timestamps exactly, and the two fields genuinely disagree (~1h11m), so
  criterion 3 asserts something.

## 8. Item 27 note (connection check)

This build ships no `src/` surface. Its outputs — the Linear write, the Slack
line, the gate's exit code — are read from the real GitHub and Linear APIs, not
from fixtures. The build being **wired to nothing until an owner applies lane D's
patch** is a delivery wall (`AGENTS.md` wall 1), not a stub: it is named in the
packet as LCD 1, the patch is preserved and verified applyable, and the degraded
state is "not yet installed", never "installed and wrong". Not an item-27 failure.
Still owed by the orchestrator at PR time, per §5 point 4: a PR body that leads
with the undeliverable half, and a handover filed on GAM-325.

## 9. Required rework

1. **F1 (MAJOR)** — `evaluateDeclaration` must go red on
   `AMBIGUOUS_DECLARATION`, with a named test, on parity with rule 2's
   `GAM-000`. Optionally also stop the sweep dropping failed declarations.

Everything else may ship with follow-ups (F2, F3, F4) and logged NITs (F5, F6).
