# GAM-325 — task packet (HEAVY)

Issue: [GAM-325](https://linear.app/gamitch/issue/GAM-325/build-the-explicit-linear-closer-pr-merge-declares-its-issue-one-sync)
Tier: **HEAVY**, declared on the issue and independently confirmed by the orchestrator against item 26 — this creates a **write path against the live tracker** (`issueUpdate`), and measurement 2 below confirms no such mutation exists anywhere in the repository today.
Design of record: `docs/swarm/2026-08-11-linear-github-integration-proposal.md` §6, §8 (merged, `d907844`).
Branch: `claude/gam-325-linear-closer`
Written: 2026-08-11

---

## 0. What the orchestrator measured before writing this

Five checks, run live. Full text in `GAM-325-run-log.md`; the two that change this packet:

* **The repository is `private`, not public.** §6.4 asserts *"Because this repo is public, branch protection — including required status checks — is free. (Private repos would need GitHub Pro; not this repo's situation.)"* `gh api repos/gamitch/volt_task_tracker_rewrite` returns `"visibility": "private"`, and `branches/main` returns `"protected": false`. This lands on **Phase 3 step (a)**, not on this build — but Phase 3's halt condition ("if it cannot be made blocking, halt") is now a live possibility rather than a formality, and the proposal must be corrected. **Orchestrator owns that correction; no worker touches `docs/swarm/**`.**
* **§8's throwaway-PR measurement checklist cannot be executed by this agent.** The dispatch token gets HTTP 403 on `GET /actions/runs` and `/actions/secrets`. Every one of checklist items 1–7 is an *observation of a workflow run*, and the observation channel is closed. This is a capability limit, not an effort limit.

### How this packet answers the blocked checklist — read this before objecting to it

§8 requires the checklist *"before anything is built on the answers"*, and §8 Phase 2 requires the sync to land **in shadow mode**. Shadow mode writes nothing to Linear. So nothing in this build **relies** on an unmeasured answer, and the build is consistent with §8 rather than a waiver of it.

What this packet adds so the checklist stops being unexecutable: **the sync workflow's first job step is a measurement report** (lane D, `measure` step) that prints, from inside the run where the answers actually live:

| Checklist item | How the `measure` step answers it |
| --- | --- |
| 1. `closed` payload: number resolvable, API fetch succeeds, `merged` distinguishable | prints `event.action`, the resolved number, the top-level keys of `event.pull_request`, and both the payload's `merged` and the **API-fetched** `merged` side by side |
| 2. Which workflow-file version a `closed` event runs | prints `github.sha`, `github.ref`, `github.workflow_ref`, and a `WORKFLOW_FILE_VERSION_MARKER` constant that the owner bumps on the PR branch — if the marker printed is the PR's, the PR's version ran |
| 3. Secrets present same-repo, absent on fork | prints `has_linear_key`, `has_slack_url`, `has_gh_token` as booleans (**never values**) plus `event.pull_request.head.repo.fork` |
| 6. The gate never conditionally skips | lane D ships the gate with **no `if:` on the job or on any step**; the reviewer's acceptance criterion is a grep proving it |
| 7. `timeout-minutes: 5` and per-request timeouts bound a hung run | `timeout-minutes: 5` on the job, `AbortSignal.timeout(20_000)` on every `fetch`, and a unit test proving the script surfaces a timeout as a named failure |

Items 4, 5 and 8 are **not** answerable from inside a run and are **not** claimed: item 4 (which SHA the check registers against) and item 5 (protection actually blocks) are owner observations at Phase 3; item 8 is an opportunistic shadow-window observation. They are carried forward to the issue as owner-owned, not silently dropped.

---

## 1. Scope

Six deliverables from the issue's table, split into five lanes with **strictly disjoint Allowed Files**. No lane may edit another lane's files, and **no lane may edit `docs/swarm/**`, `.claude/**`, `AGENTS.md`, `package.json`, `eslint.config.js`, `vite.config.ts`, or any existing workflow** (`ci.yml`, `linear-export.yml`, `claude-linear-dispatch.yml`).

| Lane | Deliverable | Allowed Files (create unless noted) |
| --- | --- | --- |
| **A** | Shared parse + Slack poster (pure, no I/O of its own) | `scripts/linear/declaration.mjs`, `scripts/linear/declaration.test.mjs`, `scripts/linear/slack.mjs`, `scripts/linear/slack.test.mjs` |
| **B** | D1 — the sync worker, incl. D6 shadow mode | `scripts/linear-sync.mjs`, `scripts/linear-sync.test.mjs` |
| **C** | D3 gate script + D4 reconciliation sweep | `scripts/linear-declaration-check.mjs`, `scripts/linear-declaration-check.test.mjs`, `scripts/linear-reconcile.mjs`, `scripts/linear-reconcile.test.mjs` |
| **D** | D2 sync workflow + D3 gate workflow + D4 sweep workflow | `.github/workflows/linear-sync.yml`, `.github/workflows/linear-declaration-gate.yml`, `.github/workflows/linear-reconcile.yml` |
| **E** | D5 edge-function Slack notifier | `supabase/functions/linear-dispatch/notify.ts`, `supabase/functions/linear-dispatch/notify.test.ts`, **edit** `supabase/functions/linear-dispatch/index.ts` |

`scripts/linear/client.mjs` is **reused unchanged**. Do not modify it; do not copy its logic.

**Out of scope, and a worker doing any of it is a BLOCKER finding:** flipping `SYNC_MODE` to live by default; touching branch protection; disabling `merge → Done`; editing item 28f/28g, `AGENTS.md` or `WORKFLOWS.md` (those are Phase 3, owner-directed, per §8); adding a `REVERT_MERGED` heuristic (§6.3 cut it deliberately); adding the round-4 three-strikes/weekly-digest reminder state machine for `Also-fixes:` (§6.3 cut it deliberately); re-adding the `pull_request_target` apparatus (round 6 cut it — it is the *named fallback*, activated only by a measurement that has not happened).

---

## 2. Lane A — `scripts/linear/declaration.mjs`

The **one shared parse**. Lanes B and C import it and must not re-implement any part of it.

```js
export const CANONICAL = /^Closes (GAM-\d+)\b/;
export function parseDeclaration(body)   // → verdict, see below
export function parseAlsoFixes(body)     // → string[] of identifiers, never closes anything
export function branchIssue(headRef)     // → 'GAM-131' | null
```

### `parseDeclaration(body)` — exact contract

Input is the PR body as the GitHub API returns it (may be `null`, may use CRLF). Returns one of:

| Return | When |
| --- | --- |
| `{ ok: true, issue: 'GAM-325' }` | line 1 matches `/^Closes (GAM-\d+)\b/` **and** line 1 contains exactly one `GAM-\d+` token **and** that token is not `GAM-000` |
| `{ ok: false, code: 'NO_DECLARATION' }` | line 1 contains no magic-word + identifier pairing at all (includes a bare mention, an empty body, and a body whose line 1 is blank) |
| `{ ok: false, code: 'AMBIGUOUS_DECLARATION', detail }` | line 1 matches the canonical prefix but carries **two or more** `GAM-\d+` tokens |
| `{ ok: false, code: 'HALF_DECLARATION', detail }` | line 1 pairs a magic word with a `GAM-\d+` identifier but is **not** the canonical anchored form — includes `Fixes GAM-1`, `This closes GAM-1`, and negations like `This PR does not close GAM-304` |
| `{ ok: false, code: 'PLACEHOLDER' }` | line 1 is canonical in shape but the identifier is `GAM-000` |

Rules that are easy to get wrong, stated so they are not guessed:

1. **Line 1 is `body.split(/\r?\n/)[0]`, with trailing whitespace trimmed and leading whitespace *not* tolerated.** A body starting with a blank line has no declaration. This is the fail-safe direction (under-close), and lane C's gate catches the near-miss loudly — see §4 rule 4.
2. **Prefix-anchored, trailing prose permitted.** `Closes GAM-325 — adds the sync worker.` is valid (this is the #126/#127 shape §6.2 measured).
3. `Closes` is matched **case-sensitively and exactly**, one ASCII space before the identifier. `closes gam-325`, `Closes  GAM-325` (two spaces) and `Closes: GAM-325` are **not** canonical → `HALF_DECLARATION`. Strictness is deliberate: the gate names the canonical form, so a near-miss costs one push, and a permissive parser is how the "which text is safe where" problem comes back.
4. **The `\b` matters.** `Closes GAM-3251` must not parse as `GAM-325`.
5. The magic-word list for `HALF_DECLARATION` detection is, case-insensitively, the GitHub + Linear closing verbs: `close|closes|closed|closing|fix|fixes|fixed|fixing|resolve|resolves|resolved|resolving|complete|completes|completed|completing`. `ref`, `refs`, `references`, `see`, `part of`, `ignore`, `skip` are **not** magic words and a line 1 pairing one of them with an identifier is `NO_DECLARATION`.
6. Nothing else — titles, branch names, commit messages, later body lines — is ever read by this function. It takes one string.

### `parseAlsoFixes(body)`

Returns every `GAM-\d+` from body lines matching `/^Also-fixes:\s*(.+)$/` (any line, not just line 1), deduped, in first-appearance order. Returns `[]` when absent. **This function never closes anything** — §6.3: read it, never close from it, flag once.

### `branchIssue(headRef)`

`/^claude\/gam-(\d+)-/` — **anchored**, so GitHub's `revert-NNN-claude/gam-…` branches do not match (§6.3 says so explicitly). Returns `GAM-<n>` uppercased, or `null`. A branch with no identifier returns `null` and is not an error.

### `scripts/linear/slack.mjs`

```js
export async function postSlack(webhookUrl, { level, title, lines })  // level: 'ok' | 'info' | 'warn'
```

* Returns `{ posted: false, reason: 'NO_WEBHOOK' }` when `webhookUrl` is falsy — **never throws**, and never fails the caller.
* Catches every network/HTTP error and returns `{ posted: false, reason }`. **A Slack failure must never fail a sync run or change its exit code** — the tracker write is the job; the notification is not.
* Uses `AbortSignal.timeout(10_000)`.
* Prefixes the title with `✅`/`ℹ️`/`⚠️` by level.

### Lane A acceptance criteria

1. `scripts/linear/declaration.test.mjs` covers, as named cases, **every row of the table above** plus: `Closes GAM-3251`, `Closes GAM-325 and GAM-326`, `This PR does not close GAM-304` (#140's real shape), `Closes GAM-000`, CRLF body, `null` body, empty-string body, body whose line 1 is blank but line 3 is canonical, and `Closes GAM-325 — trailing prose` (#126's real shape).
2. `branchIssue` tests include `revert-158-claude/gam-315-foo` → `null`, and `claude/gam-325-linear-closer` → `GAM-325`.
3. `slack.test.mjs` proves the no-webhook path returns rather than throws, and that a rejected `fetch` is swallowed into `{ posted: false }`.
4. `npx eslint scripts/linear/` exits 0.

---

## 3. Lane B — `scripts/linear-sync.mjs`

Node ESM, `node:` builtins + global `fetch` only, no npm dependencies (matching `linear-export.mjs`, which `linear-export.yml` runs with no `npm ci`). Imports `gql` from `./linear/client.mjs` and the parse from `./linear/declaration.mjs`.

### Order of operations — this order is the safety, not a style choice (§6.3)

1. **Resolve the PR number from the event only.** Read `GITHUB_EVENT_PATH`, take `payload.pull_request.number ?? payload.number`. For `workflow_dispatch`, take the `PR_NUMBER` env var. Nothing else from the payload is trusted.
2. **API-fetch the PR object** — `GET /repos/{GITHUB_REPOSITORY}/pulls/{number}` with `GITHUB_TOKEN`. Everything downstream (`body`, `merged`, `base.ref`, `head.ref`, `merge_commit_sha`) comes from **this** response, never the payload. This is what makes GitHub's self-contradictory `closed` payload documentation (§10 risk 1) irrelevant.
3. `base.ref !== 'main'` → `NON_MAIN_BASE`, exit 0.
4. `merged !== true` → the "closed, not merged" row: no state change; if a valid declaration is present, post the audit comment `PR closed without merge` (live mode only); Slack info; exit 0.
5. `parseDeclaration(pr.body)`.
6. Branch consistency: `branchIssue(pr.head.ref)`, and if non-null it must equal the declared identifier → else `DECLARATION_MISMATCH`.
7. Fetch the Linear issue: state name, `archivedAt`, and its comments (for claim detection).
8. Precondition table (§4 below).
9. **Claim comment first**, then `issueUpdate`, then **read back** `issue.state.name` and fail the run loudly on mismatch.
10. Slack.

### The full behaviour table — every row acts or produces a *named* skip

Reproduce §6.3's table exactly. Codes, verbatim: `ALREADY_DONE`, `DUPLICATE_CLOSE_CLAIM`, `ARCHIVED`, `UNEXPECTED_STATE`, `NO_DECLARATION`, `AMBIGUOUS_DECLARATION`, `UNKNOWN_ISSUE`, `STALE_CLAIM`, `NON_MAIN_BASE`, `DECLARATION_MISMATCH`, plus lane A's `HALF_DECLARATION` and `PLACEHOLDER` (both reported as `AMBIGUOUS_DECLARATION` on the Slack line, with the specific code in the log — the sync's table has no separate row for them and must not invent a state move for either).

Precondition, from §6.3:

* issue in `In Progress` **or** `In Review` → act.
* issue already `Done`, **and a claim comment from this PR exists** → `ALREADY_DONE` (benign re-delivery).
* issue already `Done`, **no claim from this PR** → `DUPLICATE_CLOSE_CLAIM`, **no move**, Slack ⚠.
* `archivedAt` set → `ARCHIVED` (info if `Done`, ⚠ otherwise).
* any other state → `UNEXPECTED_STATE`, **no move**, audit comment, Slack ⚠.
* a claim comment exists from a run that never completed its close (issue not `Done`): **same PR → resume the interrupted close** (its own claim is not an obstacle); **different PR → no move, `STALE_CLAIM`** naming the stale PR and run.

### The claim comment — machine-readable, because the script re-reads it

Write exactly this shape, and detect it by the marker line:

```
<!-- linear-sync:claim pr=158 run=31358757094 -->
**Closed by [#158](…) on merge** — `abc1234` → `Done`.
Mechanism: `.github/workflows/linear-sync.yml` / `scripts/linear-sync.mjs` (run [31358757094](…)).
This transition is attributed in Linear's history to the API key's owner, not to a bot. This comment is the record that it was an automation.
```

Claim detection parses the HTML-comment marker with `/<!-- linear-sync:claim pr=(\d+) run=(\d+) -->/`, **never** by matching prose. `pr=` is what distinguishes `ALREADY_DONE` from `DUPLICATE_CLOSE_CLAIM` and same-PR resume from `STALE_CLAIM`.

### Shadow mode (D6) — and the confound §8 names

`SYNC_MODE` env, **default `shadow`** when unset or any value other than the exact string `live`. Fail *toward* shadow: a typo must not write to the tracker.

In shadow: perform every read, compute the intended action, **write nothing** — no comment, no `issueUpdate`. Post the shadow line to Slack.

The comparison must **not** use the live precondition read (§8: `merge → Done` fires ~2 s after merge, an Actions run starts seconds-to-minutes later, so the live read sees `Done` and reports `ALREADY_DONE` on exactly the happy-path merges the test needs). Instead:

* read `issue.history(first: 50)` — `createdAt`, `fromState{name}`, `toState{name}`, `actor{name}` (verified live by the orchestrator 2026-08-11: these fields exist, the connection is newest-first, and entries with `fromState: null, toState: null` are non-state edits that must be filtered out);
* reconstruct the state immediately **before** any transition whose `createdAt` is within **120 s** of `pr.merged_at` and whose `toState.name` is `Done` — that transition is the incumbent automation's;
* compute the intended action from that **reconstructed** state;
* post `MATCH` / `MISMATCH` per merged PR: *shadow's intended outcome (close / named-skip)* vs *the automation's observed transition (closed / no-op)* for the declared issue.

### Recovery and safety

* `workflow_dispatch` replay path: honour `PR_NUMBER`; the behaviour table makes it idempotent.
* Missing `LINEAR_SYNC_API_KEY` → named skip `NO_SYNC_KEY`, exit 0 with a loud log line. §6.3: this is what makes fork runs and a misconfigured deploy fail *legibly*.
* Every `fetch` carries `AbortSignal.timeout(20_000)`.
* Read-back mismatch after `issueUpdate` → **non-zero exit**, Slack ⚠. This is the one place the script is allowed to fail the run.

### Lane B acceptance criteria

1. `scripts/linear-sync.test.mjs` drives the script's exported pure functions (extract `decide({pr, issue, claims})` so the whole table is testable without network) with **one named test per row of the behaviour table**, asserting the exact code string.
2. A test proving `SYNC_MODE` unset, `SYNC_MODE=shadow`, `SYNC_MODE=Live` (wrong case) and `SYNC_MODE=garbage` all resolve to shadow, and only the exact `live` resolves to live.
3. A test proving the shadow reconstruction ignores `fromState: null` history entries and picks the pre-automation state, given a fixture built from GAM-303's real history shape.
4. A test proving a `fetch` that rejects with a timeout surfaces as a named failure, not an unhandled rejection.
5. A test proving claim detection reads the HTML marker and distinguishes `pr=158` from `pr=159`.
6. `npx eslint scripts/` exits 0.
7. **No network call in any test.** Inject the transport; do not hit Linear or GitHub.

---

## 4. Lane C — the gate script and the sweep

### `scripts/linear-declaration-check.mjs` (D3)

Metadata-only. **No checkout of the PR's code, no secrets required for the syntax half.** Loads the parse **from the default branch's ref** via one raw-file API fetch (§6.4: "so the parser is not the PR's own"), with the local module as an explicit, logged fallback only when that fetch fails.

Rules, from §6.4:

1. Canonical-or-red: a line-1 magic-word + identifier pairing that is not the canonical anchored form goes **red**, with a message naming the canonical form: `nothing closes unless line 1 starts with "Closes GAM-nnn"`. Bare mentions stay legal everywhere, line 1 included.
2. `GAM-000` is never a valid declaration → red.
3. If the head branch matches `^claude/gam-(\d+)-`, a canonical declaration **for that exact issue** must be present → else red. (This is the #131 mismatch class and the rows-1/8 stale-branch class, caught at PR time.)
4. **Added by this packet, and flagged for the premise checker as an addition to §6.4:** if no canonical declaration is on line 1 but some *later* body line matches the canonical form exactly, go red naming the line number. Rationale: §6.4's rules 1–3 are all silent on this, the parse is deliberately line-1-only (§2 rule 1), and the failure direction of the silence is the *silent under-close* that §6.4's own halt condition exists to prevent. If the premise checker judges this out of scope, cut it — it is isolated to this rule.
5. `Also-fixes:` identifiers are **existence-validated** when a read-only Linear key is present, and **advisory** (warn, do not fail) when it is not (§6.3).
6. **The gate never conditionally skips.** No `if:` on the job, no `if:` on any step, and the script always exits with a real 0/1. A required job skipped via `if:` reports Success and does not block — the trap the issue names.

A PR with no declaration at all and no `claude/gam-nnn-` branch is **green** (mention/infra/partial-work PRs are legitimate — §6.2's #132).

### `scripts/linear-reconcile.mjs` (D4)

Daily, **read-only**, writes nothing to Linear ever.

* Lists PRs merged in the last **48 h** on **any base branch** (§6.3 — a stacked child merging into its parent hits `NON_MAIN_BASE` and closes nothing, so its declared row surfaces only here).
* For each with a canonical declaration, reads the issue's **state history, never `completedAt`** (§6.3, measured 2026-08-11: a reopen/re-close left `completedAt` frozen at the original close while only the history recorded the truth — the orchestrator re-confirmed both fields exist and disagree in exactly this way on GAM-303).
* Reports drift to Slack without writing. A human decides.
* Exits 0 even when drift is found — it is a report, not a gate.

### Lane C acceptance criteria

1. One named test per gate rule 1–4 above, plus a green case for an infra PR with no declaration and a non-identifier branch, plus a red case for `claude/gam-131-foo` declaring `GAM-130`.
2. A test proving the gate's exit code is 1 on red and 0 on green, and that no code path returns without an explicit exit code.
3. A test proving the sweep reads history and not `completedAt` — assert against a fixture where the two disagree.
4. A test proving `Also-fixes:` validation is advisory (exit 0) when no key is present.
5. No network in tests. `npx eslint scripts/` exits 0.

---

## 5. Lane D — the three workflows

### 5.0 Owner actions — three secrets, assigned to nobody by the first draft

No lane can create these, and **every lane can pass its acceptance criteria while
the system writes nothing and posts nothing**. The design makes absence the safe
path (`NO_SYNC_KEY`, silent Slack no-op), so nothing breaks — it simply never
works, quietly. They are listed here so the gap is owner-owned and named rather
than discovered at cutover.

| Secret | Store | Notes |
| --- | --- | --- |
| `LINEAR_SYNC_API_KEY` | GitHub repo secret | **New key**, write-scoped, team `Gamitch`. §6.3's one-key-per-job discipline forbids reusing `LINEAR_API_KEY` (read-only, export) or `LINEAR_DISPATCH_API_KEY` (scoped to the dispatch workflow) |
| `SLACK_WEBHOOK_URL` | GitHub repo secret | Incoming webhook for `#tracker`; §8a deferred creating it to Phase 2, which is now |
| `SLACK_WEBHOOK_URL` | **Supabase** secret | Lane E reads `Deno.env.get('SLACK_WEBHOOK_URL')` — a *different* store from the GitHub one, and setting one does not set the other |

Carried to the issue as owner actions alongside checklist items 4, 5 and 8.

### `.github/workflows/linear-sync.yml`

Copy this trigger and concurrency block **verbatim from §6.3** — every clause has a recorded reason and round-6 cut the alternatives:

```yaml
on:
  pull_request:
    types: [closed]
    branches: [main]
  workflow_dispatch:
    inputs:
      pr_number: { description: 'PR number to replay', required: true }

concurrency:
  group: linear-sync
  cancel-in-progress: false
  queue: max
```

**`queue: max` is not decoration and was missing from this packet's first draft.**
The default `queue: single` **cancels the pending run** when a newer one joins the
group — GitHub's own words: *"any existing `pending` job or workflow in the same
concurrency group will be canceled and the new queued job or workflow will take
its place."* A discarded pending run here is **not** redundant: distinct PRs need
distinct duplicate-claim decisions, distinct audit comments and distinct Slack
notices even when the close they would perform is identical. Two PRs declaring
one issue plus a third arriving loses the middle one's `DUPLICATE_CLOSE_CLAIM`
warning — an R6 violation, not a lost optimisation. Round 5 withdrew its earlier
acceptance of `queue: single` on exactly these grounds.

*Measured by the orchestrator 2026-08-11, not copied from the design:* `queue:`
is a real third key of the `concurrency` block, shipped in the GitHub Actions
changelog of **2026-05-07** ("concurrency groups now allow larger queues"),
values `single` (default) and `max` (up to 100 pending, FIFO by the time each
entered the group). **`queue: max` with `cancel-in-progress: true` is a workflow
validation error** — so the two keys above must stay `false` and `max` together.

* **One job.** Not two. Round 6 collapsed the round-3 resolve/sync split.
* `timeout-minutes: 5`. §6.3 calls this non-optional: global FIFO makes serialization correct and also makes a hang *systemic*.
* `permissions: { contents: read, pull-requests: read }` — the sync needs no write scope on GitHub.
* `actions/checkout@v4` with **`ref:` pinned to the default branch** (§6.3: the script it runs is `main`'s under either trigger).
* Node pinned to `22.22.2`, matching `ci.yml` and `linear-export.yml`. **No `npm ci`** — the script uses only `node:` builtins and global `fetch`, same as `linear-export.yml`'s stated reason.
* Env: `LINEAR_SYNC_API_KEY` (**new secret** — do not reuse `LINEAR_API_KEY` or `LINEAR_DISPATCH_API_KEY`; §6.3's one-key-per-job discipline), `SLACK_WEBHOOK_URL`, `GITHUB_TOKEN`, and `SYNC_MODE: shadow` **hardcoded to `shadow` in this PR**.
* **First step is the `measure` step** described in §0 — it prints the checklist answers and **never prints a secret value**, only booleans. Two of the booleans it must print are `has_linear_key` and `has_slack_url`, so the very first run says out loud which owner secrets are missing (see §5.0).
* **The replay seam.** Lane D declares the replay input as `workflow_dispatch.inputs.pr_number`; lane B reads `process.env.PR_NUMBER`. Nothing maps one to the other unless this workflow does, so the job must carry `env: { PR_NUMBER: ${{ inputs.pr_number }} }` (empty on the `pull_request` trigger, which is correct — lane B resolves the number from the event there). Without it the replay path silently no-ops, which is this project's named recurring defect shape.

### `.github/workflows/linear-declaration-gate.yml`

* `on: pull_request: types: [opened, edited, synchronize, ready_for_review]` — plain `pull_request`, no `branches:` filter narrower than the design states.
* **One job, no `if:` anywhere**, `timeout-minutes: 5`, `permissions: { contents: read, pull-requests: read }`.
* Job name must be stable and quotable — the owner types it into branch protection at Phase 3. Use `declaration` as the job id and `Linear declaration` as its `name:`.
* No checkout needed for the syntax half; if the script is fetched from the default branch ref, say so in a comment.

### `.github/workflows/linear-reconcile.yml`

* `on: schedule: [{ cron: '0 7 * * *' }]` (07:00 UTC — one hour after `linear-export.yml`'s 06:00, so the two do not contend) `+ workflow_dispatch`.
* `concurrency: { group: linear-reconcile, cancel-in-progress: false }`, `timeout-minutes: 10`, `permissions: { contents: read, pull-requests: read }`.
* Read-only Linear key.

### Lane D acceptance criteria

1. `grep -n "if:" .github/workflows/linear-declaration-gate.yml` returns nothing.
2. Every workflow parses: `node -e "require('js-yaml')"` is not available, so validate with `python3 -c "import yaml,sys; [yaml.safe_load(open(p)) for p in sys.argv[1:]]"` over the three files, exit 0.
3. No `${{ secrets.* }}` value is ever `echo`ed; the measure step prints booleans only. Prove with a grep in the worker output.
4. `SYNC_MODE` is literally `shadow` in the committed file.
6. `grep -c "queue: max" .github/workflows/linear-sync.yml` returns 1, and the same file does **not** carry `cancel-in-progress: true` (the pair is a validation error).
7. `grep -n "PR_NUMBER" .github/workflows/linear-sync.yml` shows the `env:` mapping from `inputs.pr_number`, so lane B's replay path is actually reachable.
8. The measure step prints `has_linear_key` and `has_slack_url`.
5. Each file carries a header comment explaining *why* — matching the density of `linear-export.yml` and `ci.yml`, which is this repo's standard, not decoration.

---

## 6. Lane E — the edge-function Slack notifier (D5)

`supabase/functions/linear-dispatch/` is Deno, tested with `deno test` and covered by `ci.yml`'s `edge-functions` job (which discovers directories, so a new `notify.test.ts` is picked up automatically).

Read `index.ts`, `dispatch.ts` and `filter.ts` first. The notifier must, per §6.6 item 1:

* post **every `dispatched: true` and every skip reason** — this closes the design's "sharpest open item", where a wrongly-skipped dispatch currently looks like a quiet week;
* **ride after the dispatch decision** — never before, never in place of it;
* **tolerate its own failure** — a Slack error must not change the HTTP response code, the response body, or any existing behaviour;
* **never touch the 5 s budget** — bound the post with an `AbortSignal.timeout` well inside it and never `await` it in a way that can extend the response past its current shape. If awaiting it at all risks the budget, use the platform's background mechanism and say in a comment which you chose and why.
* read the webhook from `Deno.env.get('SLACK_WEBHOOK_URL')` and **no-op silently when absent** — the secret is not created yet (§8a: deliberately deferred to Phase 2), so absent must be the normal, quiet path.

### Lane E acceptance criteria

1. `notify.test.ts` proves: absent env → no fetch attempted, no throw; a rejecting fetch → swallowed; a non-2xx response → swallowed.
2. A test proving `index.ts`'s response status and body are **byte-identical** with the notifier failing and with it absent, for at least one dispatch case and one skip case.
3. Every existing test in `supabase/functions/linear-dispatch/` still passes: `cd supabase/functions/linear-dispatch && deno test --allow-env --allow-read` exits 0.
4. The diff to `index.ts` is additive — no existing branch's behaviour changes.

---

## 7. Evidence required from every lane

Report exit codes, not impressions:

* `npx eslint .` — 0
* `npm run typecheck` — 0 (lanes A–D add no TypeScript, but the gate must still be clean)
* `npm run test` — the suite is green **and** the file/test count moved only by the tests the lane added; state the before and after numbers
* `npm run format:check` — 0. **Note:** `format:check` scopes to `src/**/*.{ts,tsx}` plus root config files, so `scripts/**` and `.github/**` are outside prettier's scope by design (`ci.yml` explains why). Do not add them.
* Lane E additionally: `deno test --allow-env --allow-read` in its directory — 0
* **A named mutation per lane**: change one thing in the new code, name it, show the test that goes red with its real output, restore, show green. Item 26's fast-tier rule applies to every tier here: **commit before mutating**, and mutate only in your own worktree (item 23).

A worker does not self-certify. `checker-reviewer` reviews against these criteria.

---

## 8. Least confident decisions (item 19d)

1. **Shipping the build while §8's throwaway-PR checklist is unexecuted, on the argument that shadow mode means "nothing relies on the answers".** *What would make it wrong:* if a `closed` event under plain `pull_request` does not run the workflow at all — or runs a version that cannot see the event — then the shadow window never starts, and this lands three workflows that look live and are inert. The `measure` step is designed to make that visible on the first merge rather than after ten silent ones, but it cannot make it visible *before* merging. A defensible alternative is to stop here and leave the issue in `Todo` until the owner runs the checklist. I judged that worse: the checklist needs the workflow to exist to be run at all, so refusing to build makes the measurement permanently unreachable rather than merely deferred.
2. ~~**Strict line-1 parsing (no leading blank line, exact `Closes`, single space, case-sensitive).**~~ **DISCHARGED 2026-08-11 — do not spend a gate round on this.** The re-measurement this entry asked for was run live against the GitHub API (not the document) during the proposal's verification pass: all 7 completing work PRs (#126, #127, #131, #133, #136, #143, #153) match `^Closes (GAM-\d+)\b` on line 1; **no BOM and no leading whitespace on any of them** — the first codepoint is `0x43` (`C`) in every case, which is precisely the risk §2 rule 1's strictness runs; #126 and #127 carry the declaration as a line-1 *prefix* followed by prose, which §2 rule 2 permits by design; the other 23 carry no line-1 declaration, including #132, the deliberately-undeclared partial-work class §6.2 names. The strict parse is safe against this repository's real corpus.
3. **Gate rule 4 (red when the canonical form appears on a later line) is mine, not §6.4's.** *What would make it wrong:* it is scope the design did not authorize, and §6.4's rule list was cut back deliberately in round 6 with "do not re-add without the measurement that justifies it". I added it because the silence's failure direction is the silent under-close. Cutting it is cheap and isolated. **Ruled 2026-08-11 by the design's author: keep it** — §6.4 is silent there, the silence's failure direction is the silent under-close that §6.4's halt condition exists to prevent, and the rule is a refinement of rule 1's intent isolated to one branch of one script, not the kind of scope round 6 cut. The gate need not re-litigate this.
4. **The 120 s window for identifying the incumbent's merge-coincident transition in shadow mode.** *What would make it wrong:* §8 says `merge → Done` fires ~2 s after merge and an Actions run starts "seconds-to-minutes" later; the window is for matching a *history entry* to the merge timestamp, not for the run's own latency, so it should be safe. But if the owner hand-moves an issue to `Done` within two minutes of a merge, the reconstruction attributes it to the automation and the MATCH/MISMATCH line is wrong. It degrades a comparison, not a write.
5. **Splitting into five lanes with disjoint files rather than one worker.** *What would make it wrong:* lanes B and C code against lane A's contract as written here rather than as built, so a contract drift lands as a broken import three lanes wide. Mitigated by running lane A first and by the contract in §2 being exact — but if §2 is wrong in any detail, it is wrong in three files.

6. **`queue: max` is load-bearing and only measured today.** *What would make it wrong:* the key shipped 2026-05-07, so it is three months old at time of writing and the runner fleet is the thing that has to honour it. If a queued run is dropped anyway, the sync loses the duplicate-claim decision for the middle PR of any three that contend — a silent under-report, the same failure direction as everything else here. Verified as syntax against GitHub's changelog and workflow-syntax reference, **not** verified as behaviour under real contention; the first three-way contention in the shadow window is the real test, and the reconciliation sweep (D4) is what would surface a run that vanished.

---

## 9. Revision history

* **Draft 1** — 2026-08-11, orchestrator run 1. Five lanes, 5 least-confident entries.
* **Draft 2** — 2026-08-11, orchestrator run 2. Applied the three defects the design's author raised on the issue before any gate verdict was recorded: **(1)** `queue: max` restored to lane D's concurrency block with the round-5 reasoning and a fresh measurement of the key's existence; **(2)** §5.0 added — the three owner-owned secrets the build needs and no lane can create; **(3)** the `pr_number` → `PR_NUMBER` seam closed in lane D with an acceptance criterion. LCD 2 marked **discharged** by live measurement and LCD 3 **ruled keep**, so the gate spends its round on what is still open. LCD 6 added for `queue: max`.
