# GAM-403 — task packet (HEAVY)

**Issue:** GAM-403 — "A dispatched run discovers a dead credential only after the
implementation is spent — nothing preflights push or PR capability, and the token
expression at play is the availability-dependent fallback the plan forbids"
**Tier:** HEAVY (item 26). Defended below.
**Branch:** `claude/gam-403-dispatch-credential-preflight`
**Orchestrator:** primary agent (this run). **Worker:** `worker-implementer`.
**Premise gate:** `checker-premise`. **Acceptance:** `checker-reviewer`.
**Revision 2**, answering premise-gate round 1 (`REVISE`: 1 BLOCKER, 4 MAJOR,
6 MINOR, 2 NIT). Every change made for the gate is marked **[R1-n]** against
the finding number that forced it, so a later reader can see which parts of
this packet were wrong before a worker ever saw them.

---

## 0. Tier defence (item 26 requires this be stated and defended)

HEAVY, on two of item 26's triggers rather than on the topic sounding
important (item 25 forbids the latter):

1. It changes what the **external dispatch write path** does first. Every
   autonomous run in this repository enters through
   `.github/workflows/claude-linear-dispatch.yml`; a preflight that wrongly
   *fails* halts the whole dispatch loop, and one that wrongly *passes*
   authorizes a doomed run — the exact failure it exists to prevent.
2. The deliverable is an **export another session builds against**: the
   workflow half ships as an owner-applied patch (§6), so a wrong prescription
   is discovered by a human applying it, not by CI.

Not FAST (a false pass has no test that turns red for it) and not STANDARD
(there is no single module here — the script, the workflow step and the
dispatch prompt have to agree, and the credential facts underneath them were
undocumented until this packet measured them).

---

## 1. The premise, re-measured live (item 19c)

Everything in this section was measured **in this run** (GitHub Actions run
`32303966803`, workflow `Claude — Linear dispatch`, job `work`, event
`repository_dispatch`), on `main` at `e37605f`. The issue's own citations are
confirmed; three facts it does *not* contain are the reason the naive fix is
wrong.

### 1.1 The issue's citations — all three confirmed

| Claim | Verified |
| -- | -- |
| `claude-linear-dispatch.yml:126` is `token: ${{ secrets.CLAUDE_PR_TOKEN \|\| github.token }}` | ✅ exact line |
| `claude-linear-dispatch.yml:137` is `GH_TOKEN: ${{ secrets.CLAUDE_PR_TOKEN \|\| github.token }}` | ✅ exact line |
| `claude-linear-dispatch.yml:40-43` comments the intended PAT role | ✅ lines 40-43 |
| plan §5.3 forbids availability-dependent fallbacks and requires a preflight of identity / repo / branch-write / PR-create / CI-trigger without creating a real task PR | ✅ `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:332-344` |
| Phase 1 acceptance: "a bad credential fails before expensive implementation" | ✅ same file, Phase 1 |

`grep -n 'CLAUDE_PR_TOKEN\|github.token' .github/workflows/claude-linear-dispatch.yml`
returns lines **42, 126, 137** — three, not four; line 40 says `GITHUB_TOKEN`
in caps and does not match. The substantive claim is unaffected: **the fallback
expression appears exactly twice and nowhere else.** **[R1-12]**

### 1.2 The credential matrix — measured, not inferred

Two distinct credentials are live in a dispatched run. **Their capabilities are
close to complementary, and each one fails at the thing the other does.**

| Probe | `CLAUDE_PR_TOKEN` (fine-grained PAT, `github_pat_…`, 93 chars) | Agent's `GH_TOKEN`/`GITHUB_TOKEN` (`ghs_…`, 390 chars) |
| -- | -- | -- |
| `GET /user` | `200` → `gamitch` (a User) | **`403`** "Resource not accessible by integration" |
| `GET /repos/{repo}` `.permissions` | `{admin:true, push:true, …}` | **`{admin:false, push:false, …}` — a false negative, see 1.4** |
| `git push HEAD:refs/preflight/<id>` | ✅ `[new reference]` | ✅ `[new reference]` |
| `POST /pulls` with `head == base` | **`403` "Resource not accessible by personal access token"** | **`422` "No commits between main and main"** |
| push triggers CI | ✅ measured: this branch's first push produced run `CI \| push \| claude/gam-403-…` | not measured (see 5.3) |

Reading of the `POST /pulls` row: a `422` is a **validation** failure, which is
reached only *after* authorization succeeds. A `403` is the authorization
failure itself. So the probe separates "may create PRs" from "may not" **while
creating nothing** — it is the constraint in the issue ("verify capability
without creating a real task PR") satisfied exactly, and it is measured, not
reasoned.

**Consequence: the PAT cannot open a pull request, and the App token can.**
This is GAM-333's finding reproduced from the other direction — its five
successful PRs authored as `claude[bot]`, and the PR list confirms it today:
`#200`, `#199`, `#198`, `#196`, `#190` are all `claude[bot] (Bot)`, and every
hand-opened one is `gamitch (User)`.

### 1.3 The line-137 assignment does not reach the agent

`secrets.CLAUDE_PR_TOKEN` **is set** — the checkout at line 126 put a
`github_pat_…` into `git config http.https://github.com/.extraheader`, and
`github.token` is a `ghs_…`, so the `||` resolved to the PAT. Yet the agent's
own `GH_TOKEN` is a `ghs_…` that opens pull requests as `claude[bot]`.

So whatever line 137 assigns, **the credential the agent actually holds is the
`claude[bot]` GitHub App installation token minted by `claude-code-action@v1`**
(the workflow's own line 105 comment — `id-token: write` "required for the
action's default GitHub App auth" — describes this mechanism). Line 137 is
inert with respect to the agent's environment.

**This is the fact that makes the obvious fix dangerous.** "Pin `GH_TOKEN` to
the PAT, since §5.3 says use the proven push token" would, if it took effect,
hand the agent the one credential measured at `403` on PR creation — breaking
the only PR path that has ever worked here.

### 1.4 `.permissions` must not be the preflight's instrument

The App token reports `push:false, admin:false` on `GET /repos/{repo}` and then
successfully pushes a ref and passes PR-create authorization. A preflight that
gated on `.permissions.push` would **fail a credential that works**. Capability
is probed by attempting the operation, never by reading a permissions field.

### 1.4b The checkout's `extraheader` outranks the credential under test — the BLOCKER **[R1-1]**

**This is the finding round 1 of the premise gate produced by running the
prescription instead of reading it, and it invalidated the original write
probe outright.**

`actions/checkout` writes an `Authorization:` header into
`http.https://github.com/.extraheader` in the repository's git config. That
header **takes precedence over credentials embedded in a push URL.** So the
obvious probe — `git push https://x-access-token:$TOKEN@github.com/… ` — does
not authenticate as `$TOKEN` at all inside the dispatch workspace. It
authenticates as whatever the checkout used.

Measured by the gate, in this run's real checkout:

```
$ FAKE="ghp_FAKEfakeFAKEfake1234567890abcdefgh"
$ git push "https://x-access-token:$FAKE@github.com/gamitch/volt_task_tracker_rewrite.git" HEAD:refs/preflight/x
 * [new reference]   HEAD -> refs/preflight/x          <-- PASS, with a garbage token
```

Control, a fresh `git init` with no extraheader, same fake token, same URL:

```
remote: Invalid username or token. Password authentication is not supported for Git operations.
fatal: Authentication failed for 'https://github.com/gamitch/volt_task_tracker_rewrite.git/'
```

**A preflight built the obvious way would therefore report PASS for a revoked,
empty or garbage push credential** — the precise false positive §0 calls
disqualifying, shipped inside the thing built to prevent it.

**The fix, verified in both directions by the gate:** neutralize the ambient
header for the probe command only.

```
git -c "http.https://github.com/.extraheader=" push "https://x-access-token:$TOKEN@github.com/$REPO.git" HEAD:refs/preflight/<id>
```

* with the fake token → `fatal: Authentication failed` (correct FAIL)
* with the PAT → `* [new reference]` (correct PASS)
* with the App token → `* [new reference]` (correct PASS)
* `--delete` with the same flag succeeds; `git ls-remote origin 'refs/preflight/*'` is empty afterwards.

**A variant that does not work, recorded so nobody re-derives it:** passing an
explicit `-c http.<url>.extraheader="AUTHORIZATION: basic <b64>"` produces
`remote: Duplicate header: "Authorization"` and HTTP 400, because the ambient
header is still sent alongside it. **Empty the setting; do not overwrite it.**

### 1.5 A probe ref under `refs/preflight/*` is CI-silent

`ci.yml` is `on: push:` **unqualified**, so any *branch* push runs the full CI
suite. Measured: pushing `HEAD:refs/preflight/probe-<run-id>` with each
credential created **no workflow run at all** (the run list immediately after
both pushes shows nothing newer than this branch's own CI run), and
`git push --delete` removed both. Refs outside `refs/heads/*` and `refs/tags/*`
do not trigger `on: push`. That is the write probe: it proves ref-write against
the real remote, costs no CI minutes, and leaves nothing behind.

---

## 2. What to build

One script, dual-purpose, plus its tests. **The worker builds only these two
files.**

### 2.1 `scripts/dispatch-preflight.mjs` (new)

A credential preflight that fails visibly *before* expensive work, run in two
stages because the two credentials do not exist in the same place:

* **Stage A — workflow step, before `claude-code-action` runs.** Verifies the
  *branch-publication* credential (`secrets.CLAUDE_PR_TOKEN`): repo access,
  ref-write, CI-trigger expectation.

  **[R1-8] Its justification, corrected.** The first draft said "a dead push
  token strands 100% of runs", which is **unmeasured and almost certainly
  false**: GAM-333's thirteen runs are 8-of-13 stranded *at PR time* and
  **0-of-13 at push time**. And Phase 1's acceptance sentence is "a bad
  credential fails before expensive implementation" — which Stage B at minute 1
  already satisfies, so that sentence does not justify Stage A either.

  The real argument, which the first draft missed: **a dead push credential
  destroys the run-log durability contract**, and nothing else in the system
  detects that. The dispatch prompt (`claude-linear-dispatch.yml:234-249`)
  makes the pushed run log "the only thing that survives if you are killed"; if
  pushing is what is broken, the run produces no log, no branch and no
  artifact, and the failure is invisible in exactly the way run 31358757094's
  was. Stage A is the only check that runs before that contract is relied on.
* **Stage B — the agent's own first act.** Verifies the *PR-creation*
  credential, which only exists inside the agent's environment (§1.3), with the
  `head == base` probe.

**Interface** (a worker may improve the naming; the behaviour is fixed):

```
node scripts/dispatch-preflight.mjs --stage=push   # Stage A
node scripts/dispatch-preflight.mjs --stage=pr     # Stage B
node scripts/dispatch-preflight.mjs --stage=all    # both, for local use
```

Environment read:

| Var | Used by | Meaning |
| -- | -- | -- |
| `GITHUB_REPOSITORY` | both | `owner/repo`; required |
| `PREFLIGHT_PUSH_TOKEN` | stage push | the branch-publication credential |
| `PREFLIGHT_PR_TOKEN` | stage pr | the PR-creation credential; falls back to `GH_TOKEN` (§5.1 defends this, and R1-7 corrects *why* it is safe) |
| `PREFLIGHT_BUILTIN_TOKEN` | stage push | **[R1-2]** the built-in `${{ github.token }}`, passed explicitly by the workflow step. Check 6 compares against **this**, never against `process.env.GITHUB_TOKEN` |
| `GITHUB_RUN_ID` | stage push | probe-ref uniqueness; default `local` |
| `PREFLIGHT_BASE` | stage pr | base branch for the probe; default `main` |
| `GITHUB_STEP_SUMMARY` | both | if set, the report is appended there too |

**Checks, and the verdict each may return** (`PASS` / `FAIL` / `SKIP`, plus a
one-line human reason; a check may also report `DERIVED` evidence — see the
CI-trigger check):

| # | Check | Stage | PASS when |
| -- | -- | -- | -- |
| 1 | credential present | both | the token env var is non-empty |
| 2 | repo access | both | `GET /repos/{repo}` → `200` and `full_name` equals `GITHUB_REPOSITORY` |
| 3 | identity | both | records the identity **without** failing on `403`: `GET /user` `200` → `login`; `403` → `"installation token (no user identity)"`. Never `FAIL` on the `403` — §1.2 shows the working PR credential returns it |
| 4 | ref-write | push | **[R1-1]** `git -c "http.https://github.com/.extraheader=" push <url-with-token> HEAD:refs/preflight/preflight-<run-id>` succeeds **and** the follow-up `--delete` (same `-c` flag) succeeds. **The `-c` argument is load-bearing, not hygiene** — without it the probe tests the checkout's credential and PASSes on a garbage token (§1.4b). A failed delete is `FAIL`, not a warning: it means the probe littered. The report line must say this proves **ref-write, not branch-create** — `refs/preflight/*` is outside any `refs/heads/**` protection or ruleset **[R1-11]** (measured today: `gh api repos/$REPO/rulesets` → `[]`, `…/rules/branches/main` → `[]`, so nothing distinguishes the namespaces yet — but that is a fact about today, not a property of the probe) |
| 5 | PR-create | pr | **[R1-6]** `POST /repos/{repo}/pulls` with `head == base == PREFLIGHT_BASE` returns **`422` AND** an `errors[].message` matching `/No commits between/`. A `422` with any other body → `FAIL`, quoting the body's message: the gate built the counter-case, and a typo'd or unset `PREFLIGHT_BASE` yields `422` with `field: base, code: invalid` — a green preflight that never exercised the configured base. `403` → `FAIL`. Any `2xx` → `FAIL` **and** the report says a PR may have been created (this must never happen; treat it as an alarm, not a pass). Any other status → `FAIL`, never a silent pass |
| 6 | CI-trigger expectation | push | **[R1-2]** the push credential is **not** byte-identical to `PREFLIGHT_BUILTIN_TOKEN`. Identical → `FAIL` ("pushes made with the built-in token do not trigger workflow runs"). `PREFLIGHT_BUILTIN_TOKEN` absent → **`SKIP`**, never `PASS` — the first draft compared against `process.env.GITHUB_TOKEN`, which is **unset** in a `run:` step unless mapped (so the check could never fail as deployed) and, inside the agent, is **not** the built-in token but the `claude[bot]` App token. **[R2-8]** (Round 1's write-up said this "produced a false FAIL"; that is backwards — with the push token set to the PAT the old check would have wrongly *passed*. The prescription is unaffected: compare against an explicitly-passed value, and `SKIP` when it is absent.) This check is `DERIVED`, and the report must label it so — §5.5 |

**Exit code:** `0` when no check is `FAIL`; `1` otherwise. Every check's line is
printed in both cases — a preflight that only speaks when it fails teaches
nobody what "healthy" looks like.

**[R2-2] No short-circuiting. Every check in the stage runs, always.** A garbage
token fails check 2 (repo access) before it ever reaches check 4 (ref-write), so
an implementation that stops at the first `FAIL` cannot satisfy acceptance
criterion 4, which requires the *ref-write* line to be named. Run them all,
report them all, then decide the exit code from the collected verdicts.

**[R2-3] The probe must never target `origin`.** In a dispatch workspace the
`origin` URL embeds a credential in its userinfo, so `git -c …extraheader= push
origin …` still authenticates as something other than the credential under
test. Build the URL explicitly from `GITHUB_REPOSITORY` and the token being
tested. The explicit-URL form is load-bearing for the same reason the `-c` flag
is, and the two together are what make the probe mean anything.

**[R2-4] A REST alternative exists and is deliberately not chosen.** Round 2
measured `POST /repos/{repo}/git/refs` → `401` on a garbage token, `201` on the
App token, `DELETE` → `204`. That path needs no `gitImpl`, no `-c` flag, no
test 12 and no live negative control — the `Authorization` header is explicit
and no git config participates. **It is rejected on fidelity:** the run
publishes its branch over git-over-HTTPS, and that transport — with its ambient
config — is exactly where the BLOCKER lived. A probe that cannot see the class
of defect this task was filed for is the wrong probe, even though it is
simpler. Recorded so the choice is visible rather than assumed.

**[R1-9] Stdlib only.** `dispatch-preflight.mjs` imports **nothing** outside
Node's standard library. There is no `npm ci` before the Claude step and
`node_modules` is absent from a fresh dispatch checkout (measured: empty this
run until the orchestrator installed it), so a single non-stdlib import makes
Stage A fail at runtime — and nobody would discover it until the owner applied
the patch. The workflow's own `assert-released` step records this rule for the
same reason ("No `npm ci`. … imports nothing, so this runs on the runner's
stock Node"). `vitest` may appear **only** in the `.test.mjs` file.

**The report shape already exists in this repository: `scripts/doctor.mjs`.**
Its header, its "REQUIRED checks decide the exit code" rule, its per-check line
printed on success *and* failure, and its stdlib-only constraint are exactly
what `formatReport`/`evaluate` need. Copy that working precedent rather than
re-deriving one. **[R1-cheaper-path-2]**

**[R1-7] The report must name the credential class on the PR-create line** —
`user:gamitch` vs `installation token` — so a reader can tell *which* credential
returned the `422`. Check 3 already computes it; printing it is what makes
§5.1's fallback auditable rather than merely defensible.

**Never print a token, or any substring of one.** Redact from every line the
script emits, including captured `git` stderr — the remote URL carries the
credential and `git`'s own error messages quote it back. **[R2-1]** Use:

```js
/(?:ghs|ghp|gho|ghu|ghr)_[A-Za-z0-9_.-]+|github_pat_[A-Za-z0-9_.-]+/g
```

**The dot and dash in that character class are the whole point, and the
obvious `[A-Za-z0-9_]` is a measured leak.** The `claude[bot]` installation
token is JWT-shaped — `ghs_<id>_<b64header>.<b64payload>.<signature>` — so a
charset without `.` stops at the first dot and redacts only the
*reconstructible* prefix (the header decodes to `{"alg":"ES256","typ":"JWT"}`)
while printing the payload and signature verbatim. Round 2 measured **342 of
390 characters of a live write-capable token surviving** the naive regex, and
both the acceptance criterion and the natural unit test went green on it,
because a hand-written fake token has no dots in it. This is the packet's own
false-green failure class occurring inside the rule meant to prevent leaks; the
PAT is unaffected (no dots), so the exposure is specifically the Stage B
credential and the one embedded in `origin`.

**Structure it for testability.** Pure, exported, no I/O:

* `classifyPrCreateProbe({ status, body })` → `{ verdict, reason }`
* `classifyRepoAccess({ status, body, expectedRepo })`
* `classifyIdentity({ status, body })`
* `classifyCiTrigger({ pushToken, builtInToken })`
* `evaluate(checks)` → `{ ok, exitCode }`
* `formatReport(checks)` → string
* `redact(text)` → string

…and one injectable shell: `runPreflight({ stage, env, fetchImpl, gitImpl })`.
Tests drive the pure functions directly and `runPreflight` with fakes. **No
test may reach the network or run `git push`.**

House style: `scripts/linear-assert-released.mjs` is the model — a header
comment that states the defect being caught, what the script deliberately does
*not* do, and the usage line. Match it.

### 2.2 `scripts/dispatch-preflight.test.mjs` (new)

Vitest, alongside the script (`scripts/*.test.mjs` is the existing convention
and the default `include` picks it up). Must cover, at minimum:

0. **[R2-5]** Check 1 (credential present): empty/missing token → `FAIL`, and
   the stage does not attempt a network call with an empty credential.
1. `422` with a `No commits between main and main` error → PR-create PASS (the
   authorized case — **the whole point**).
2. `403` → PR-create FAIL, reason names the credential.
3. `2xx` → PR-create FAIL and the reason says a PR may have been created.
4. A `500`/unknown status → FAIL, not a silent pass.
5. **[R1-6]** `422` whose body is `[{field:'base',code:'invalid'},{field:'head',code:'invalid'}]`
   (the typo'd-base case the gate constructed) → **FAIL**, and the reason quotes
   the body. This is the false-green guard; without it a mis-set
   `PREFLIGHT_BASE` reports success.
6. Repo access `200` with a *different* `full_name` → FAIL.
7. Identity `403` → PASS, recorded as an installation token (§1.2 regression
   guard: this is the working PR credential).
8. CI-trigger: push token identical to `PREFLIGHT_BUILTIN_TOKEN` → FAIL;
   different → PASS labelled `DERIVED`; **`PREFLIGHT_BUILTIN_TOKEN` absent →
   SKIP** **[R1-2]**.
9. **[R2-1]** `redact()` removes `ghs_`, `github_pat_` and `ghp_` values,
   including when embedded in a URL inside a longer `git` error string. **The
   `ghs_` fixture must contain dots**, e.g.
   `ghs_1234567_eyJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJ4In0.SIGNATURE`, and the
   assertion is that **no 20-character substring of the fixture survives** —
   not merely that the whole value is gone. A dot-free fake passes the naive
   regex and proves nothing.
10. `evaluate` → exit `1` if any check FAILs, `0` when the only non-PASS
    verdicts are `SKIP`.
11. `runPreflight({stage:'push'})` with a fake `gitImpl` whose delete fails →
    exit `1`.
12. **[R1-1] The `-c` guard is asserted, not assumed:** a fake `gitImpl`
    records its argv, and the test asserts the push **and** the delete were
    each invoked with `-c http.https://github.com/.extraheader=` **before** the
    `push`/`--delete` argument. This is the unit-level guard for the BLOCKER;
    the live negative control in §3 is the other half.

---

## 3. Acceptance criteria

A criterion is satisfied only by evidence, not by reading the code.

1. `node scripts/dispatch-preflight.mjs --stage=pr` run **in this repository
   with the agent's real `GH_TOKEN`** exits `0` and reports PR-create PASS via a
   `422`. (Live capability check — item 27's "follow the data to its real
   source" applied to a credential.)
2. The same command with a deliberately broken token exits `1` and names the
   failing check.
3. **[R1-5]** `--stage=push` exits `0` with the real push credential, and
   `git ls-remote origin 'refs/preflight/*'` afterwards is **empty**. A worker
   has no `secrets.` context, so recover the credential exactly this way, and
   only this way:

   ```
   PAT=$(git config --get-all http.https://github.com/.extraheader | head -1 | awk '{print $3}' | base64 -d | cut -d: -f2)
   PREFLIGHT_PUSH_TOKEN="$PAT" node scripts/dispatch-preflight.mjs --stage=push
   ```

   **Never echo it, never write it to a file, never put it in a commit** —
   pass it through the environment only.

4. **[R1-1] Negative control — the criterion the BLOCKER exists for.** In this
   same checked-out workspace,
   `PREFLIGHT_PUSH_TOKEN=ghp_deadbeefdeadbeefdeadbeefdeadbeefdead node scripts/dispatch-preflight.mjs --stage=push`
   must exit **`1`** and name the ref-write check. A build that passes
   criterion 3 and fails this one is the false-positive preflight this whole
   task exists to prevent, so **criterion 3 without criterion 4 proves
   nothing.**
5. No workflow run is created by the ref-write probe (checked against the runs
   list, as §1.5 did).
6. `npx vitest run scripts/dispatch-preflight.test.mjs` is green, and a
   **mutation replay** proves the suite guards the central claim: invert the
   `422`/`403` classification in the script and **§2.2's test 1** must turn red
   (test 2 will also turn red; that is expected and worth stating). The red
   output and exit code are quoted. **[R1-13]** (Item 26: a gate that only
   reads is worth much less than one that runs. Item 26's fast-tier working
   rule applies to the replay: **commit before mutating**, then revert and
   re-verify green.)
7. **[R1-4] Gates: `5 of 6`, with gate 6 SKIPPED — and that is the correct
   result, not a shortfall.** `/gate-run` derives gate 6's scope only from
   changed files under `src/`; this task's Allowed Files are `scripts/*` only,
   so `common_scope` returns `None` and gate 6 reports SKIPPED by design.
   Claiming "all six green" would be false. **Baseline for gates 5/6, measured
   by the orchestrator on this branch before the worker started:
   `98 test files, 2505 tests, 0 failures`.** The worker's run must equal that
   plus its own new tests, and any other movement is a regression to report.
8. No file outside §4's Allowed Files is modified.
9. **[R2-1]** No token value **and no 20-character substring of one** appears in
   any output the script produces or in any file the run commits. The
   substring form is the criterion, not the whole-value form: round 2 measured
   the whole-value form going green while 342 of 390 characters of a live
   credential were printed.

---

## 4. Allowed Files (worker)

* `scripts/dispatch-preflight.mjs` (create)
* `scripts/dispatch-preflight.test.mjs` (create)

**Forbidden, and each for its own reason:**

* `.github/workflows/**` — the credential wall (GAM-328, `AGENTS.md` § "Two
  walls"). Neither credential may push it. The workflow half of this task is
  produced by the **orchestrator** as an applyable patch (§6). The worker must
  not create, edit, or stage a workflow file even locally.
* `docs/swarm/**`, `.claude/**`, `AGENTS.md` — orchestrator-owned (AGENTS.md
  § "Ownership and protected files").
* Everything under `src/`, `supabase/` — this task ships no product code.

---

## 5. Least confident decisions (item 19d) — attack these first

**Round 1 resolved four of the five. The list below is the revised one — what
is still uncertain *after* the gate — with each original verdict recorded so
the gate's second round re-audits the answer rather than the question.**

1. **[R1-7 — original justification was WRONG; the decision stands on a
   different argument.]** Stage B's `PREFLIGHT_PR_TOKEN` falls back to
   `GH_TOKEN`. My original defence — "two names for one credential, not two
   credentials" — is **false about the workflow source**: line 137 assigns the
   PAT, and only the action's undocumented override makes the two names one
   value at runtime. The decision survives for a reason I did not give: **the
   failure direction is safe.** If the override ever stops, `GH_TOKEN` becomes
   the PAT, the PAT `403`s on PR-create, and the preflight **fails** — the
   correct outcome, not the false PASS I feared. Check 3 disambiguates it in
   the report (`gamitch` vs installation token), which is why R1-7's reporting
   requirement is now mandatory rather than nice-to-have. **What would still
   make me wrong:** a third credential shape that is neither the PAT nor the
   App token and that passes the probe while being unable to open a *real* PR.

2. **[R1-6 — SOUND on the axis I doubted; tightened anyway.]** The gate tried
   four ways to obtain a `422` from an unauthorized caller and got `403`, `403`,
   `401`, `403` — authorization is evaluated **before** validation, which is the
   probe's load-bearing property, and it is now measured rather than assumed.
   But the gate constructed a *different* false green: a typo'd base yields
   `422` with `field: base, code: invalid`. Check 5 now requires the
   `No commits between` message. **What would still make me wrong:** a
   `No commits between` body reachable by a caller who cannot actually open a
   PR. None found.

3. **[R1-8 — the doubt was right, my reasoning for keeping Stage A was
   wrong.]** Stage A survives, on the run-log durability argument in §2.1, not
   on the Phase-1 sentence I originally cited (Stage B satisfies that) and not
   on the 100%-stranding figure I made up (GAM-333 is 0-of-13 at push time).
   **[R2-7] Round 2 settled this, and Stage A is load-bearing rather than
   ceremony — for a third reason neither draft had.** This repository is
   **public** (`"private": false`), and round 2 measured that both a garbage
   token *and an empty token* `ls-remote` it successfully, exit `0`, real SHA
   returned. **So a dead `CLAUDE_PR_TOKEN` does not fail the checkout.** The run
   proceeds, burns the whole implementation, and discovers the credential is
   dead at push time — the exact fail-late shape GAM-403 was filed about, with
   nothing upstream to catch it. Keep Stage A; the doubt is resolved, not
   merely deferred.

4. **[R1-3 — REVERSED by the gate. My prescription was the dangerous one.]**
   I proposed pinning `GH_TOKEN` to `secrets.CLAUDE_PR_TOKEN`, arguing it was
   behaviour-preserving because line 137 is inert. The premise is confirmed and
   the conclusion is still bad: it pins **the one credential measured at `403`
   on PR-create** into the variable `gh` reads, with nothing but a floating
   third-party major tag's undocumented override standing between that and a
   broken PR path. §6 now says **delete line 137** — which is behaviour-
   preserving today *and* is literally plan §5.3's "pin the proven GitHub App
   path". Line 126's pin is unchanged and was confirmed sound. **What would
   still make me wrong:** if the action does *not* set `GH_TOKEN` itself in
   some future version, deletion leaves the agent with no `GH_TOKEN` at all —
   which fails loudly at Stage B rather than silently, so the direction is
   again safe.

5. **[R1-8 — SOUND as a labelling decision; the implementation was broken and
   is fixed under R1-2.]** The CI-trigger check is `DERIVED`, not measured: a
   branch push would run the full CI suite (§1.5), which the issue's constraint
   forbids. Corroborating evidence the gate added: every push-triggered CI run
   on this repository is `actor=gamitch`, i.e. the ✅ in §1.2's "push triggers
   CI" row belongs to the PAT. **What would still make me wrong:** the
   derivation's premise ("pushes authenticated with the built-in token do not
   create workflow runs") being false in this configuration. It is GitHub's
   documented behaviour, and it is still not a measurement I made — the report
   must not present it as one.

6. **NEW, and it is the residue of the BLOCKER.** The `-c
   http.https://github.com/.extraheader=` fix is verified against *this*
   workspace shape. **What would make it wrong:** a checkout that authenticates
   some other way (a different `actions/checkout` version, an SSH remote, a
   credential helper), where emptying that one config key would not isolate the
   probe — and the failure mode is silent, because the probe would go back to
   passing on a dead token. The unit test (§2.2 test 12) asserts the flag is
   *passed*; only §3's live negative control proves it *works*. **Both are
   required for that reason, and neither substitutes for the other.**

---

## 6. The workflow half — orchestrator-owned, ships as a patch

Not the worker's. Per GAM-328 and the #159→#160 pattern, the orchestrator
writes the workflow change, verifies it, and preserves it as
`docs/swarm/active/GAM-403-dispatch-preflight.patch` (`git format-patch`), with
the PR body **leading** with the undeliverable half rather than burying it. The
change is exactly **four** things **[R2-6]** — the count matters, because this
section is applied by hand by the owner and a miscount risks applying three of
four:

1. Line 126 → `token: ${{ secrets.CLAUDE_PR_TOKEN }}` (no fallback). Confirmed
   sound by round 1.
2. **[R1-3] Line 137 → deleted, not pinned.** `GH_TOKEN:` is removed from the
   Claude step's `env:`, with a comment recording §1.3: the agent's real
   credential is the `claude[bot]` App token minted by the action, which
   overwrote this assignment in the measured run, so deleting it is
   behaviour-preserving today — and it is plan §5.3's "pin the proven GitHub
   App path" literally, whereas pinning the PAT here would arm a latent `403`
   on the only PR path that works.
3. A new **Credential preflight** step between checkout and the Claude step,
   running `--stage=push`, with `PREFLIGHT_PUSH_TOKEN: ${{ secrets.CLAUDE_PR_TOKEN }}`
   and `PREFLIGHT_BUILTIN_TOKEN: ${{ github.token }}` mapped explicitly into its
   `env:` **[R1-2]** — neither is present in a `run:` step otherwise.
4. **[R1-10]** One paragraph in the dispatch `prompt` for `--stage=pr`, and it
   must be **sequenced against the two "first act" instructions already there**
   — claiming the issue (`yml:166-171`, "before you open any other file") and
   the run log (`yml:243-245`, "your FIRST file write"). A third unordered
   "first act" makes the order the agent's guess. Wording: *immediately after
   claiming the issue and writing the run log, and before reading the packet*.
   It must also say what to do on FAIL: **stop, record it on the issue, and
   leave the issue in `Todo`** — the refusal route `yml:228-232` already
   authorizes.

---

## 7. Evidence to record

Worker's completion report gives the commit SHA (item 21). Orchestrator
independently verifies HEAD moved and the change is in the committed blob, and
replays the mutation in its own worktree (item 23) before accepting.
