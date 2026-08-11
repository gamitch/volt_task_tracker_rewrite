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
  taking the state name and returning `{ released: boolean, reason: string }`;
- exits `0` when released, `1` when not, and `1` when the state could not be
  determined at all;
- appends a one-line verdict to `$GITHUB_STEP_SUMMARY` when that variable is
  set, and prints the same line to stdout always.

**The rule, exactly — this is the whole point of the row and it is narrow:**

| Final state | Verdict | Why |
| -- | -- | -- |
| `In Progress` | **FAIL** | the run stopped holding a claim it never released |
| `In Review` | pass | item 28e's finished state |
| `Todo` | pass | **a correct refusal to proceed, which the prompt explicitly invites** |
| `Backlog`, `Done`, `Canceled`, `Duplicate` | pass | not this assertion's business |
| unreadable / API error | **FAIL**, with a message that says *undetermined*, not *In Progress* | a check that passes when it could not look is the same evidence-honesty defect this row is about |

Match the state name case-insensitively and on trimmed whitespace, but do not
invent synonyms and **do not key off the state `type`** — `In Review` and
`In Progress` are both type `started`, so type cannot distinguish them.

Retry the read up to **3 attempts with a short backoff** so one transient
network blip is not a red run; after that, fail as undetermined.

**Do not add a write path.** This script reads. It must never move an issue.

### 2. `scripts/linear-assert-released.test.mjs` — NEW

Vitest, importing `{ describe, it, expect }` from `'vitest'` explicitly (this
repo does not enable vitest globals). It tests `classifyState` only — no
network, no mocking of `fetch`, no import of `client.mjs`'s side effects.

Cover at least: `In Progress` → not released; `in progress` and `" In Progress "`
→ not released (case/whitespace); `In Review` → released; `Todo` → released;
`Backlog`/`Done`/`Canceled` → released; and an unknown state name → released
(the assertion is a denylist of one, not an allowlist).

### 3. `.github/workflows/claude-linear-dispatch.yml` — EDIT

Add **one step, last in the job**, after `Record the session id`:

```yaml
      - name: Assert the run released its claim
        if: always()
        env:
          LINEAR_API_KEY: ${{ secrets.LINEAR_DISPATCH_API_KEY }}
          ISSUE_IDENTIFIER: ${{ github.event.client_payload.identifier }}
        run: node scripts/linear-assert-released.mjs "$ISSUE_IDENTIFIER"
```

Three things about that block are load-bearing and must not be "tidied":

1. **`if: always()`** — the run this catches is a *green* one, so a step that
   only runs on success would still catch it; but a run killed by the
   120-minute timeout is the other case worth reporting, and `always()` covers
   both. It also means this step runs after a failed agent step, where it is
   informative rather than harmful.
2. **The identifier goes through `env:`, never interpolated into `run:`.**
   `client_payload` is attacker-controllable — the file's own `if:` guard at
   `:83` exists because "anyone able to fire a `repository_dispatch` reaches
   this file directly". `run: node … ${{ github.event.client_payload.identifier }}`
   would be a shell-injection sink. This is a BLOCKER if got wrong.
3. **Last in the job**, so `Keep the execution log` has already uploaded the
   transcript by the time this can turn the job red. The artifact from a failing
   run is the one someone will want.

Add a comment block above the step in this file's established voice: what it
asserts, why the assertion is *not* "a PR exists" (a correct refusal leaves no
PR and must not fail), and that it is not a turn-budget fix.

## Allowed files — nothing else

- `scripts/linear-assert-released.mjs` (new)
- `scripts/linear-assert-released.test.mjs` (new)
- `.github/workflows/claude-linear-dispatch.yml` (edit — the one added step and
  its comment only; **do not touch `--max-turns`, `timeout-minutes`, `--model`,
  the prompt, or any existing step**)

Forbidden, per item 22 and `AGENTS.md` § Ownership: `docs/swarm/**`,
`.claude/**`, `AGENTS.md`, `src/**`, `supabase/**`, `package.json`. Stage
explicit paths; never `git add -A`.

## Acceptance criteria

1. `node scripts/linear-assert-released.mjs GAM-314` exits **1** while GAM-314
   is `In Progress`, printing a line that names the state.
2. The same command exits **0** against an issue that is `In Review`, and
   **0** against one in `Todo`. (The orchestrator supplies live identifiers.)
3. With `LINEAR_API_KEY` unset or invalid, it exits **1** and the message says
   the state was *undetermined* — it must not claim the issue is `In Progress`.
4. `npx vitest run scripts/linear-assert-released.test.mjs` passes.
5. **Named mutation:** invert the `In Progress` comparison in `classifyState`
   (make it return `released: true`), and criterion 4's suite turns **red** on
   the `In Progress` cases. Restore, re-run green. Commit before mutating
   (item 26's fast-tier working rule).
6. All six gates green: `tsc --noEmit`, `vite build`, `format:check`,
   `eslint .` (0 errors), full `vitest run`, and the scoped run from 4. The
   full-suite file/test count may rise by exactly the new file and its tests;
   report the numbers.
7. `git diff --name-only` against the base lists only the three allowed paths.

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
4. **Placing the step last rather than making it a separate job.** A separate
   job would isolate the assertion from the agent's `permissions` block and
   could be `needs: work` with `if: always()`. Rejected as more YAML for the
   same signal. *Wrong if* the assertion ever needs to run when the `work` job
   is skipped entirely — it does not, because a skipped job never claimed.
5. **Testing `classifyState` and not the workflow YAML.** The YAML stays
   unexercised; `GAM-312` owns that gap. *Wrong if* the defect that actually
   ships is a YAML typo (a wrong `env:` key, say), which the unit test cannot
   see. Mitigated only by the orchestrator running the script live.
