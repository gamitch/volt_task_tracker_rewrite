# GAM-403 — task packet (HEAVY)

**Issue:** GAM-403 — "A dispatched run discovers a dead credential only after the
implementation is spent — nothing preflights push or PR capability, and the token
expression at play is the availability-dependent fallback the plan forbids"
**Tier:** HEAVY (item 26). Defended below.
**Branch:** `claude/gam-403-dispatch-credential-preflight`
**Orchestrator:** primary agent (this run). **Worker:** `worker-implementer`.
**Premise gate:** `checker-premise`. **Acceptance:** `checker-reviewer`.

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
returns exactly lines 40, 42, 126, 137 — the fallback expression appears twice
and nowhere else.

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
  ref-write, CI-trigger expectation. This is where the cost is saved — a dead
  push token strands 100% of runs, and Stage A ends the job at minute 1.
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
| `PREFLIGHT_PR_TOKEN` | stage pr | the PR-creation credential; falls back to `GH_TOKEN` **only** because in Stage B that *is* the credential under test, and the fallback is between two names for one value, not between two different credentials (§5.1) |
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
| 4 | ref-write | push | `git push <remote> HEAD:refs/preflight/preflight-<run-id>` succeeds **and** the follow-up `--delete` succeeds. A failed delete is `FAIL`, not a warning: it means the probe littered |
| 5 | PR-create | pr | `POST /repos/{repo}/pulls` with `head == base == PREFLIGHT_BASE` returns **`422`**. `403` → `FAIL`. Any `2xx` → `FAIL` **and** the report says a PR may have been created (this must never happen; treat it as an alarm, not a pass) |
| 6 | CI-trigger expectation | push | the push credential is **not** byte-identical to `process.env.GITHUB_TOKEN`. Identical → `FAIL` with "pushes made with the built-in token do not trigger workflow runs". This check is `DERIVED`, and the report must label it so — §5.3 |

**Exit code:** `0` when no check is `FAIL`; `1` otherwise. Every check's line is
printed in both cases — a preflight that only speaks when it fails teaches
nobody what "healthy" looks like.

**Never print a token, or any substring of one.** Redact `ghs_[A-Za-z0-9_]+`,
`github_pat_[A-Za-z0-9_]+` and `ghp_[A-Za-z0-9_]+` from every line the script
emits, including captured `git` stderr — the remote URL carries the credential
and `git`'s own error messages quote it back.

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

1. `422` → PR-create PASS (the authorized case — **the whole point**).
2. `403` → PR-create FAIL, reason names the credential.
3. `2xx` → PR-create FAIL and the reason says a PR may have been created.
4. A `500`/unknown status → FAIL, not a silent pass.
5. Repo access `200` with a *different* `full_name` → FAIL.
6. Identity `403` → PASS, recorded as an installation token (§1.2 regression
   guard: this is the working PR credential).
7. CI-trigger: push token identical to the built-in token → FAIL; different →
   PASS labelled `DERIVED`.
8. `redact()` removes `ghs_`, `github_pat_` and `ghp_` values, including when
   embedded in a URL inside a longer `git` error string.
9. `evaluate` → exit `1` if any check FAILs, `0` when the only non-PASS verdicts
   are `SKIP`.
10. `runPreflight({stage:'push'})` with a fake `gitImpl` whose delete fails →
    exit `1`.

---

## 3. Acceptance criteria

A criterion is satisfied only by evidence, not by reading the code.

1. `node scripts/dispatch-preflight.mjs --stage=pr` run **in this repository
   with the agent's real `GH_TOKEN`** exits `0` and reports PR-create PASS via a
   `422`. (Live capability check — item 27's "follow the data to its real
   source" applied to a credential.)
2. The same command with a deliberately broken token exits `1` and names the
   failing check.
3. `--stage=push` with `PREFLIGHT_PUSH_TOKEN` set to `CLAUDE_PR_TOKEN` exits `0`,
   and `git ls-remote` afterwards shows **no** surviving `refs/preflight/*`.
4. No workflow run is created by the ref-write probe (checked against the runs
   list, as §1.5 did).
5. `npx vitest run scripts/dispatch-preflight.test.mjs` is green, and a
   **mutation replay** proves the suite guards the central claim: invert the
   `422`/`403` classification in the script and criterion-1's test must turn
   red. The red output and exit code are quoted. (Item 26: a gate that only
   reads is worth much less than one that runs.)
6. All six gates green (`/gate-run`).
7. No file outside §4's Allowed Files is modified.
8. No token value appears in any output the script produces or in any file the
   run commits.

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

1. **Stage B's `PREFLIGHT_PR_TOKEN` falls back to `GH_TOKEN`, and this packet
   forbids fallbacks.** I claim it is not the same thing: §5.3 forbids a
   fallback *between two different credentials* whose selection changes
   behaviour silently, whereas this is one credential reachable under two names
   in the same environment. **What would make me wrong:** if any dispatch path
   sets `GH_TOKEN` to something other than the agent's App token — in which case
   Stage B would silently test the wrong credential and report PASS, which is
   precisely the false-positive this issue exists to prevent. If the gate
   thinks this is real, the fix is to require `PREFLIGHT_PR_TOKEN` explicitly
   and `SKIP` loudly when absent.

2. **The `head == base` → `422` probe is the right instrument.** It is measured
   here on both credentials, so its discriminating power is not theoretical.
   **What would make me wrong:** GitHub returning `422` for an *unauthorized*
   caller under some condition (e.g. a repo with PR creation disabled, or a
   fine-grained PAT whose repository access was revoked rather than
   under-scoped), which would make the probe a false positive. I could not
   construct such a case in this repository. A stricter reading of the `422`
   body (require the `No commits between` message specifically, not any `422`)
   is the cheap hedge, and I have specified only the status code.

3. **Stage A verifies a credential that is not the one the agent will use.**
   §1.3 shows the agent's PR credential is minted by the action and is invisible
   to any earlier step, so Stage A can only prove the *push* path. **What would
   make me wrong:** if this makes Stage A worth less than its complexity —
   i.e. if push failures are rare and PR failures are the whole problem, then
   Stage A is ceremony and Stage B alone (run at minute 1 by the agent) is the
   entire deliverable. GAM-333's data says 8 of 13 runs stranded *at PR time*
   with the branch already pushed, which is evidence in exactly that direction.
   I kept Stage A because Phase 1's acceptance sentence is "a bad credential
   fails before expensive implementation" and only a step that runs before the
   action can do that — but the gate should weigh this, and dropping Stage A is
   an acceptable outcome of the gate.

4. **Pinning both lines to `${{ secrets.CLAUDE_PR_TOKEN }}` is
   behaviour-preserving today.** It follows from CLAUDE_PR_TOKEN being set
   (proved in §1.3), so `X || Y` ≡ `X`. **What would make me wrong:** if the
   secret is ever absent for a *different* trigger of the same workflow, where
   today the run degrades to `github.token` and continues, and after this change
   it fails at checkout. I claim that is the intent ("failure is a visible
   terminal event", §5.3), but it converts a silent degradation into a hard
   stop for the whole dispatch loop, and that is the owner's risk to accept, not
   mine to hide.

5. **The CI-trigger check is `DERIVED`, not measured.** It compares the push
   token to the built-in token rather than pushing a branch and watching for a
   run — because a branch push *would* run the full CI suite (§1.5), which the
   issue's constraint forbids ("without mutating anything a later phase treats
   as evidence"). **What would make me wrong:** if the derivation's premise
   ("pushes authenticated with the built-in `GITHUB_TOKEN` do not create
   workflow runs") is false in this repository's configuration. It is GitHub's
   documented behaviour and the workflow's own line 40 comment asserts it, but
   neither is a measurement I made, and the report must not present it as one.

---

## 6. The workflow half — orchestrator-owned, ships as a patch

Not the worker's. Per GAM-328 and the #159→#160 pattern, the orchestrator
writes the workflow change, verifies it, and preserves it as
`docs/swarm/active/GAM-403-dispatch-preflight.patch` (`git format-patch`), with
the PR body **leading** with the undeliverable half rather than burying it. The
change is exactly three things:

1. Line 126 → `token: ${{ secrets.CLAUDE_PR_TOKEN }}` (no fallback).
2. Line 137 → `GH_TOKEN: ${{ secrets.CLAUDE_PR_TOKEN }}` (no fallback), with a
   comment recording §1.3 — that the agent's real credential is the App token
   minted by the action, so this assignment governs nothing the agent sees, and
   pinning it changes no behaviour today.
3. A new **Credential preflight** step between checkout and the Claude step,
   running `--stage=push`, plus one paragraph in the dispatch `prompt` telling
   the agent to run `--stage=pr` as its first act.

---

## 7. Evidence to record

Worker's completion report gives the commit SHA (item 21). Orchestrator
independently verifies HEAD moved and the change is in the committed blob, and
replays the mutation in its own worktree (item 23) before accepting.
