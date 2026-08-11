# GAM-314 — task packet (STANDARD)

**Issue:** [GAM-314](https://linear.app/gamitch/issue/GAM-314/a-dispatched-run-reports-success-while-its-work-is-still-running-in) —
"A dispatched run reports `success` while its work is still 'running in the background'".
**Branch:** `claude/gam-314-assert-run-released-claim` **Base:** `ccf77b1`
**Tier:** STANDARD — reasoning in `GAM-314-run-log.md`, restated in the PR.

---

## The defect, in one sentence

A dispatched run whose agent ends its turn with a subagent still in flight
returns normally, so `claude-code-action` reports success, the job goes green,
and the issue is left in `In Progress` with the chain unfinished — four
measured instances (runs `31354278407`, `31385764526`, `31514339272`,
`31523233268`), none of them anywhere near a turn or clock budget.

## What to build

One post-run assertion, plus the small script it calls.

### 1. `scripts/linear-assert-released.mjs` — NEW

A Node CLI, ESM, in the style of the other `scripts/linear-*.mjs` files, that:

- takes the issue identifier as `process.argv[2]` (e.g. `GAM-314`);
- reads that issue's current workflow-state name through the shared client at
  `scripts/linear/client.mjs` — **import `gql` from there, do not open a second
  fetch path.** `gql` returns `{ data, remaining }`, not the raw payload;
- exports a **pure, testable** decision function (name it `classifyState`)
  taking the state name and returning `{ released: boolean, reason: string }`.
  **Follow `supabase/functions/linear-dispatch/filter.ts` as the in-repo
  precedent** — a network-free decision module where every outcome carries a
  machine-readable reason rather than a bare boolean, tested in isolation by
  `filter.test.ts`. `scripts/migrate/manifest.test.ts` is the precedent for a
  vitest file living under `scripts/`;
- exits `0` when released, `1` when not, and `1` when the state could not be
  determined at all;
- appends a one-line verdict to `$GITHUB_STEP_SUMMARY` when that variable is
  set, and prints the same line to stdout always.

**The rule, exactly — this is the whole point of the row and it is narrow.**
The team has exactly seven states (enumerated live, gate round 1):

| Final state | Verdict | Why |
| -- | -- | -- |
| `In Progress` | **FAIL** | the chain is unfinished and nothing else will say so |
| `In Review` | pass | item 28e's finished state |
| `Todo` | pass | **a correct refusal to proceed, which the prompt explicitly invites** |
| `Backlog`, `Done`, `Canceled`, `Duplicate` | pass | not this assertion's business |
| any other / unknown name | pass | this is a denylist of one, not an allowlist |
| issue not found | **FAIL**, saying *not found* | a junk `repository_dispatch` identifier must read as junk |
| unreadable / API error | **FAIL**, saying *undetermined* | a check that passes when it could not look is the same evidence-honesty defect this row is about |

Match the state name case-insensitively and on trimmed whitespace — the same
shape `supabase/functions/linear-dispatch/filter.ts:273` already uses — but do
not invent synonyms and **do not key off the state `type`**: `In Review` and
`In Progress` are both type `started`, so type cannot distinguish them
(verified live).

**`In Progress` fails even when the run stopped deliberately.** Gate round 1
raised this as a BLOCKER and it is now decided rather than overlooked. This same
workflow's prompt (`.github/workflows/claude-linear-dispatch.yml:197-199`,
shipped in PR #141) tells an agent near the wall clock to *"stop, push what
exists, and say so"* — which ends the job green with the issue legitimately
`In Progress`. That run is still an unfinished chain that nobody will
re-dispatch, and a green tick on it is exactly the reading this row exists to
prevent. **So it fails, and the message must say why it might be expected**, in
words close to:

> `GAM-nnn is still In Progress: the run ended without releasing its claim.`
> `This can also be a run that stopped deliberately near the wall clock, one`
> `escalated to the owner under item 19a or the Loop Limit, or a row moved`
> `back by a Linear automation. In every case it still needs a human — the`
> `chain is unfinished and nothing else will say so.`

**Three benign shapes, not one.** Gate round 2 found the other two and they
belong in the message, because its whole purpose is that the first person to hit
a benign case does not conclude the check is broken and delete it:
`constitution.md:93-98` caps the premise gate at two rounds and escalates a
third REVISE **to the human owner**; the Loop Limit (`:193-197`) escalates a
third failed worker/checker attempt to `boss-arbiter`, whose options include
"the human owner must decide". Neither the prompt nor item 28 gives an escalated
run any state to move to, so it correctly rests in `In Progress`. Separately,
this workspace has a live *On open in coding tool → started* automation
(`constitution.md:622`), and GAM-304 was measured moving `In Review → In
Progress` at `2026-08-10T14:00:04.088Z` with `botActor: GitHub/integration`.
**The verdict is FAIL in all three** — each ends with an unfinished chain only a
human will move — but the wording must be wide enough to be believed.

The same sentence goes in the workflow comment block.

**Retry only what is worth retrying.** Up to **3 attempts with a short backoff**
for a transport-level failure, so one network blip is not a red run. Do **not**
retry a definite answer: an authentication error, a `4xx` `userError`, an
`Entity not found: Issue`, or the client's own `Rate-limit floor reached:`
throw. Three attempts against a rate floor burns the last requests in the
window for no information.

**How to tell them apart, since gate round 2 measured that the obvious way does
not exist.** `gql` throws a bare `Error` — no status, no `cause`, no subclass —
so the discrimination is **string-inspection of `err.message`, and there is no
alternative**: `scripts/linear/client.mjs` is not in Allowed Files and must not
be edited to attach structured errors. The client authors exactly four messages,
enumerated here so nobody has to rediscover them:

| Message prefix | Source | Retry? |
| -- | -- | -- |
| `LINEAR_API_KEY is not set.` | `client.mjs:27` | no |
| `Rate-limit floor reached:` | `client.mjs:38` | no |
| `GraphQL query too complex` | `client.mjs:52` | no |
| `GraphQL: ` + JSON | `client.mjs:58` | no |
| anything else — e.g. `TypeError: fetch failed` with `err.cause.code` | unwrapped `fetch` / `res.json()` | **yes** |

Inside the `GraphQL: ` payload the JSON parses back out to give
`extensions.statusCode` and `extensions.userError` — measured live in both gate
rounds: authentication is `401` / `userError: true`, and a missing issue is
`400` / `userError: true` with message `Entity not found: Issue`. That is how
criterion 3's *not found* is told apart from *undetermined*.

**Query the issue as `issue(id: $identifier)`.** Linear accepts the human
identifier (`GAM-314`) in that field and raises `Entity not found: Issue` for a
junk one. An `issues(filter: …)` shape returns an empty node list instead, which
makes the *not found* case unreachable — measured, and worth one sentence here
rather than a coin flip in the worker.

**Do not add a write path.** This script reads. It must never move an issue.

**`Todo` is a re-dispatch trigger, not a resting state.** Measured in gate
round 1 and confirmed independently: `filter.ts` rule 4 matches on the *new*
state being `Todo` regardless of the previous one, so `In Progress → Todo`
fires a fresh dispatch — GAM-304 moved at `13:11:21.452Z` and run
`31391626696` was created at `13:11:25Z`, four seconds later. This assertion is
therefore correct but creates an incentive worth naming: an unfinished agent
that wants a green job can reach one either by self-re-dispatching through
`Todo` or by falsely claiming completion through `In Review`. **Out of scope
here — filed as [GAM-326](https://linear.app/gamitch/issue/GAM-326) under item
20 rather than left as this paragraph.**

### 2. `scripts/linear-assert-released.test.mjs` — NEW

Vitest, importing `{ describe, it, expect }` from `'vitest'` explicitly (this
repo does not enable vitest globals). It tests `classifyState` only — no
network, no mocking of `fetch`, no import of `client.mjs`'s side effects.

Cover at least: `In Progress` → not released; `in progress` and `" In Progress "`
→ not released (case/whitespace); `In Review` → released; `Todo` → released;
`Backlog`/`Done`/`Canceled` → released; and an unknown state name → released
(the assertion is a denylist of one, not an allowlist).

### 3. `.github/workflows/claude-linear-dispatch.yml` — EDIT

Add a **second job**, after the existing `work` job. Not a step inside it —
gate round 1 overturned that choice (MAJOR 4) and the reasoning is now part of
the prescription:

```yaml
  assert-released:
    name: ${{ github.event.client_payload.identifier }} — claim released
    needs: work
    if: always() && github.event.client_payload.identifier != ''
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v6
      - name: Assert the run released its claim
        env:
          LINEAR_API_KEY: ${{ secrets.LINEAR_DISPATCH_API_KEY }}
          ISSUE_IDENTIFIER: ${{ github.event.client_payload.identifier }}
        run: node scripts/linear-assert-released.mjs "$ISSUE_IDENTIFIER"
```

Five things about that block are load-bearing and must not be "tidied":

1. **A separate job with its own checkout, not a step in `work`.** The `work`
   job has held `contents: write` and unrestricted `Bash` over that workspace
   for up to 120 minutes; running the evidence-honesty check out of the tree it
   is judging is the wrong shape. Concretely, an agent that left the tree on a
   ref predating this script produces `ERR_MODULE_NOT_FOUND` → exit 1 → a red
   job for no reason. On `repository_dispatch`, `actions/checkout` takes the
   **default branch**, so this job runs `main`'s copy of the assertion.
2. **`needs: work` with `if: always()`** so the job runs whether `work`
   succeeded, failed, or was cancelled by `timeout-minutes`. The run this
   catches is a *green* one, so a plain `needs:` would already cover the
   headline case; `always()` is for the other two. **Note the limit honestly:**
   when `work` is cancelled, the *run's* conclusion is `cancelled` regardless of
   what this job does, so on that path this buys a red job and a Step Summary
   line rather than a red run. Cite GitHub's documented `always()` semantics for
   this, **not** this repository — the one cancelled run here (`31358757094`)
   shows its post-steps `skipped` under a different, unrelated guard, which
   proves nothing either way.
3. **The identifier goes through `env:`, never interpolated into `run:`.**
   `client_payload` is attacker-controllable — the file's own `if:` guard at
   `:83` exists because "anyone able to fire a `repository_dispatch` reaches
   this file directly". `run: node … ${{ github.event.client_payload.identifier }}`
   would be a shell-injection sink. This is a BLOCKER if got wrong.
4. **`permissions: contents: read`** — this job needs nothing else. It does not
   inherit `work`'s `contents/pull-requests/issues: write`.
5. **No `npm ci`.** `scripts/linear/client.mjs` uses global `fetch` and imports
   nothing, so the script runs on the runner's stock Node. Adding an install
   step would put a minute and a dependency graph between a failure and its
   report.

Add a comment block above the job in this file's established voice, covering:
what it asserts and why the assertion is *not* "a PR exists" (a correct refusal
leaves no PR and must not fail); that it is **not** a turn-budget fix (four
measurements say so); the deliberate-stop sentence from §1 above; and one
sentence noting that `Record the session id` at `:409` interpolates a *step
output* into a `run:` block, which is safe there and is not a pattern to copy
to `client_payload`.

## Allowed files — nothing else

- `scripts/linear-assert-released.mjs` (new)
- `scripts/linear-assert-released.test.mjs` (new)
- `.github/workflows/claude-linear-dispatch.yml` (edit — the one added job and
  its comment only; **do not touch `--max-turns`, `timeout-minutes`, `--model`,
  the prompt, or any existing step**)

Forbidden, per item 22 and `AGENTS.md` § Ownership: `docs/swarm/**`,
`.claude/**`, `AGENTS.md`, `src/**`, `supabase/**`, `package.json`. Stage
explicit paths; never `git add -A`.

## Acceptance criteria

Criterion 2 was rewritten after gate round 1: **0 of 83 issues in this
workspace are in `In Review` or `Todo`** (measured live), so the original
"orchestrator supplies live identifiers" was unsatisfiable.

1. `node scripts/linear-assert-released.mjs GAM-314` exits **1** while GAM-314
   is `In Progress`, printing a line that names the state. Run this **before**
   the orchestrator's item-28e completion move, after which it stops holding.
2. `node scripts/linear-assert-released.mjs GAM-304` exits **0** (that issue is
   `Done`), proving the pass path over the real API rather than in a mock.
   The `In Review` and `Todo` states are covered by criterion 4's unit tests;
   **the orchestrator** closes the live gap by re-running criterion 1's command
   after moving GAM-314 to `In Review` and recording the exit code.
3. With `LINEAR_API_KEY` set to an invalid value, it exits **1** and the message
   says the state was *undetermined* — it must not claim the issue is
   `In Progress`. With a nonexistent identifier (`GAM-99999`) it exits **1**
   saying *not found*, distinctly from *undetermined*.
4. `npx vitest run scripts/linear-assert-released.test.mjs` passes, covering
   `classifyState` **and** the retry classifier as a second pure function over
   an `Error`: a `4xx` `userError`, `Entity not found: Issue`, and
   `Rate-limit floor reached:` → no retry; `TypeError: fetch failed` → retry.
   Without this the retry MUST is unmeasured, and a naive 3× loop around the
   whole call would pass every other criterion.
5. **Named mutation:** invert the `In Progress` comparison in `classifyState`
   (make it return `released: true`), and criterion 4's suite turns **red** on
   the `In Progress` cases. Restore, re-run green. Commit before mutating
   (item 26's fast-tier working rule).
6. All six gates green, **against the measured base at `ccf77b1`: 83 files /
   2162 tests**. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`,
   `npx eslint .` (0 errors; ~377 pre-existing warnings), full `npx vitest run`
   (expect 84 files and 2162 + your new test count), and the scoped run from 4.
   **Two of those six cannot see this change**: `tsconfig.json:22` includes only
   `["src", "vite.config.ts"]` and `format:check`'s globs are `src/**` plus root
   files, so neither reaches `scripts/**`. Therefore also run
   `npx prettier --check scripts/linear-assert-released.mjs scripts/linear-assert-released.test.mjs`
   by hand and report it — otherwise the new files drift out of format with
   nothing able to notice.
7. `git diff --name-only ccf77b1` lists exactly **five** paths: the three
   allowed implementation paths, plus `docs/swarm/active/GAM-314-packet.md` and
   `docs/swarm/active/GAM-314-run-log.md`, which are the orchestrator's and sit
   outside the worker's Allowed Files. (Round 2 caught that "only the three"
   was already false on this branch before the worker started.)
8. `GAM-326` and `GAM-327` exist in Linear — the `Todo` self-re-dispatch
   incentive and the untested workflow YAML — and are named in the packet and
   the PR. Item 20 makes the filed row what authorises the deferral, so this is
   a criterion rather than a promise. **Satisfied by the orchestrator before
   dispatch**, not by the worker.

## Least confident decisions

Declared under item 19d's spirit even though this is STANDARD, because the gate
should spend its round here rather than re-reading the workflow file.

1. **Failing the job on an undetermined read.** Chosen because a check that
   passes when it could not look reproduces the class of defect being fixed.
   Wrong if transient Linear errors are common enough that dispatch runs start
   going red for reasons unrelated to the agent — in which case the 3-attempt
   retry is the wrong dial and the answer is a distinct non-blocking outcome.
   *What would make it wrong:* evidence of Linear 5xx/rate-limit noise in this
   workspace. None observed, but none looked for either.
2. **`client.mjs`'s `RATE_FLOOR = 150` throws rather than returning.** So a run
   made near the hourly limit fails this assertion as *undetermined* even
   though the read would have succeeded. Accepted as correct-but-blunt.
   *Wrong if* a HEAVY run's own Linear traffic can realistically approach 2500
   requests/hour — measured runs use single digits, so this looks safe.
3. **Not failing on `Done`.** Item 28e forbids an *agent* moving its issue to
   `Done`, so `Done` at run end is suspicious. Excluded anyway because a PR
   merging mid-run legitimately produces it, and the issue warns explicitly
   against asserting on the wrong signal. *Wrong if* the owner wants 28e
   enforced here too — that is a separate row, not this one.
4. ~~Placing the step last rather than making it a separate job.~~
   **Overturned by gate round 1 (MAJOR 4) and now a separate job.** The
   rejection weighed YAML volume and missed the decisive fact: the assertion
   would have executed out of a workspace the run under test had unrestricted
   write access to for two hours. Recorded rather than deleted, because the
   whole point of the list is that it caught something.
5. **Testing `classifyState` and not the workflow YAML.** The YAML stays
   unexercised. The earlier claim that `GAM-312` owns that gap was wrong — that
   row is *"Two live dispatch policies exist only as file comments"* and is in
   `Backlog`. The gap is real and was unowned; it is now
   [GAM-327](https://linear.app/gamitch/issue/GAM-327), filed under item 20
   alongside GAM-326. *Wrong if* the defect that actually ships is a YAML
   typo (a wrong `env:` key, say), which no unit test can see. Mitigated only by
   the orchestrator running the script live against real issues, which criteria
   1-3 now require.
6. **Failing a deliberate near-wall-clock stop (BLOCKER 1's resolution).**
   Decided as FAIL because the chain is unfinished either way and nothing else
   reports it. *Wrong if* deliberate partial stops become common enough that
   dispatch runs are routinely red — at which point the answer is a distinct
   non-blocking outcome, not silence.
