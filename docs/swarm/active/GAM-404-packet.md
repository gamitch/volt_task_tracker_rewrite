# GAM-404 packet — notify on every terminal failure

**Revision 3** (round 2 `checker-premise` findings folded in; see
`docs/swarm/active/GAM-404-run-log.md` for the round 1 and round 2 verdicts
this responds to).

**Tier: STANDARD** (item 26 — no write path, no schema/RLS/migration, no
auth/role logic; external Slack write only, matching the issue's own sizing).

**Item 19 premise gate: two rounds run, cap reached (19a).** Round 2 returned
REVISE with 1 MAJOR, 7 MINOR, 3 NIT and **no BLOCKER**, and escalated to the
owner rather than looping to a round 3. This revision applies round 2's
required fix and all seven MINOR items. **It is not submitted for a third gate
round** — per item 19a and the GAM-301 precedent, the owner or
`boss-architect` accepts this revision directly and only `worker-implementer`
is dispatched next. Every change in this revision is listed in §7 so the
acceptor can check it against round 2's verdict without re-reading the whole
packet.

## 1. Premise — re-verified against current `main`

| Claim | Verified |
| -- | -- |
| `linear-escalation-notify.mjs:60` is the strict marker regex | **Exact.** `const ESCALATION_MARKER = /^\s*\*\*Escalat(?:ing\|ed)\b/i;` at line 60. |
| `claude-linear-dispatch.yml:576-582` is the only notify step, `if: failure()` | **Exact** (corrected from revision 1's `577-582`: `- name:` opens at 576). It is the only Slack-posting step in the file. |
| `linear-escalation-notify.mjs` stays silent for non-escalation failures | **Confirmed by execution**, not inference: `detectEscalation` returns `escalated:false` before `postSlackImpl` is ever reached, on every non-`ESCALATED` branch. |
| `linear-assert-released.mjs` "already distinguishes the failure shapes" and is "the natural place to classify" | **Partially true.** Its header comment (27-42) narrates three benign shapes; `classifyState` (107-131) returns one identical reason string for all of them and never reads comments, so it cannot itself tell them apart. §3 explains why this packet still does not modify it. |
| Deduplication requirement, plan §5.7/§5.1 | Read at `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:419-451` and the `notification keys` row at `:271`, inside the **not-yet-deployed** controller's run-store table. Confirmed still true as of this revision: `supabase/spikes/gam-407-run-store/README.md:3` states "This is a spike, not infrastructure. Nothing here is deployed" — cited directly rather than asserted from absence, per round 1's finding. |
| "Phase 1 ... names this: notify on every terminal failure" | **Exact** at `:577`. |
| GAM-344's 120-minute cap | Not re-measured; irrelevant to this fix's mechanism (agnostic to *why* a run died). The current timeout is `timeout-minutes: 180` at `claude-linear-dispatch.yml:103`. |

**Round 2's MAJOR, verified independently for this revision — the premise it
falsifies is this packet's own:**

| Claim | Verified |
| -- | -- |
| The Assert step goes red for reasons other than `In Progress` | **Confirmed by reading the exit-1 paths.** `linear-assert-released.mjs` returns `exitCode: 1` on `NOT FOUND` (`:219-220`), on `UNDETERMINED — could not read its state` after retries (`:226-227`), on `UNDETERMINED — Linear returned no workflow state` (`:232-233`), and on an unexpected error (`:274`). **Only the first of `classifyState`'s branches is about `In Progress` at all.** |
| Therefore `NO_FAILURE` is reachable through the new step's `if:` | **Yes, and it produces silence on a red job.** `if: failure()` fires for every one of those exits. If the new script's own second read then sees a released state — the transient error cleared, or a null state resolves to `''` — and `workResult` is `'success'`, the function falls through to `{ shape: 'NO_FAILURE', notify: false }`. Round 2 measured both: `{state:{name:'In Review'}} + 'success'` → `NO_FAILURE`; `{state:null} + 'success'` → `NO_FAILURE`. |
| The Assert step can be identified from a later step in the same job | **It cannot today** — `- name: Assert the run released its claim` at `:540` carries **no `id:`**. §2 adds one. Both steps live in the same `assert-released` job, so `steps.<id>.outcome` is readable once the `id:` exists. |

**Revisions 1 and 2 both asserted `NO_FAILURE` was unreachable. Both were
wrong, and revision 2 wrote the claim in two places** (the function's own
comment and the workflow comment). §2 corrects both and adds the shape that
closes the hole. This is the defect the issue exists to fix, reproduced inside
its own fix — the same pattern GAM-403 hit, and the reason the gate is worth
its cost on a STANDARD row.

**Other citations, corrected this revision (round 2 MINOR):**
- `js-yaml@4.3.0` is **not a declared dependency**. It resolves only
  transitively: `eslint@9.39.5 > @eslint/eslintrc@3.3.6 > js-yaml@4.3.0`
  (`npm ls js-yaml`). Revision 2's "already a dependency, v4.3.0" was false on
  the first half. Criterion 10 states the transitive path so a future
  `npm prune`/major-eslint bump that drops it is a named risk rather than a
  mystery failure.
- The 2500/hour rolling rate figure is at `scripts/linear/client.mjs:40`, not
  `:17` — `:17` is `const RATE_FLOOR = 150`. Corrected in §6.
- `isIssueNotFoundError` is **already exported** by
  `linear-assert-released.mjs` (`:174`), the same file this packet already
  imports `classifyState` from. Revision 2 did not use it; §2 does.

**Other citations added in revision 2, still verified:**
- `needs.<job>.result` is readable from a step-level `if:` in a job that
  declares `needs: work` — `assert-released` already declares `needs: work`
  at `:511`, so no new `needs:` entry is required.
- `client_payload.title` is genuinely populated by the dispatching edge
  function: `supabase/functions/linear-dispatch/filter.ts:176,389`.
- `scripts/linear-sync.mjs:661` already builds a GitHub-context run URL from
  `env.GITHUB_REPOSITORY` inside a script; the packet's `RUN_URL` takes the
  same approach one level up (in `env:`).

## 2. Design

**Do not edit `linear-escalation-notify.mjs` or `linear-assert-released.mjs`.**
Both stay byte-for-byte as they are on this branch (criterion 12 makes this
mechanically checkable). This revision **imports three things, read-only**,
across the two — importing is not editing; neither file's behavior changes for
any existing caller.

### New file: `scripts/linear-terminal-failure-notify.mjs`

Same shape as its sibling: `gqlImpl`/`postSlackImpl`/`log` all injected for
tests, always exits 0, never a gate.

```js
import { detectEscalation, fetchIssueForEscalation } from './linear-escalation-notify.mjs';
import { classifyState, isIssueNotFoundError } from './linear-assert-released.mjs';

/**
 * Pure. `issue` is the shape `detectEscalation` takes (`null` when Linear
 * said "not found"). `readFailed` distinguishes a read that threw for any
 * other reason (Linear could not be asked at all) -- the two need different
 * Slack wording.
 *
 * `workResult` is `needs.work.result` (`'failure'`, `'cancelled'`,
 * `'success'`, or `undefined` outside CI).
 *
 * `assertOutcome` is `steps.assert.outcome` from the SAME job -- ADDED this
 * revision to close round 2's MAJOR. The Assert step goes red for THREE
 * reasons, only one of which is "still In Progress":
 * `linear-assert-released.mjs` also exits 1 on NOT FOUND (:219) and on
 * either UNDETERMINED shape (:226, :232). On this script's own second read
 * those can look fine -- a transient error clears, a null state reads as
 * '' -- and without `assertOutcome` the function fell through to
 * NO_FAILURE and told nobody about a red job. That is the exact defect this
 * issue exists to close, so it is checked before NO_FAILURE can be returned.
 *
 * `classifyState` is imported, not reimplemented, so "is this state the one
 * assert-released itself would fail on" always agrees with the assertion
 * that actually produced this failure.
 */
export function classifyTerminalFailure(
  issue,
  { readFailed = false, workResult, assertOutcome } = {},
) {
  if (readFailed) return { shape: 'READ_FAILED', notify: true };
  if (!issue) return { shape: 'NOT_FOUND', notify: true };
  if (detectEscalation(issue).escalated) return { shape: 'ESCALATED', notify: false };

  const stateName = issue.state?.name ?? '';
  if (!classifyState(stateName).released) {
    // The condition that makes assert-released's Assert step fail on state
    // grounds (currently: only "In Progress", per its denylist-of-one).
    return { shape: 'STRANDED', notify: true };
  }

  // The Assert step passed on state grounds, but the `work` job itself did
  // not: a run that crashes after releasing its claim, or is cancelled
  // before claiming at all.
  if (workResult === 'failure' || workResult === 'cancelled') {
    return { shape: `WORK_JOB_${workResult.toUpperCase()}`, notify: true };
  }

  // ROUND 2 MAJOR FIX. The Assert step went red for a reason this second
  // read cannot see -- NOT FOUND, or either UNDETERMINED shape that has
  // since cleared. Notify with what little is known rather than fall
  // through to silence. This is what makes NO_FAILURE genuinely
  // unreachable through the workflow's `if:`, which revisions 1 and 2 only
  // asserted.
  if (assertOutcome === 'failure') return { shape: 'ASSERT_FAILED', notify: true };

  // Nothing wrong: Assert passed, `work` did not fail or get cancelled.
  // Reachable only when this function is called directly (tests, or a
  // future caller), never through the workflow step below.
  return { shape: 'NO_FAILURE', notify: false };
}
```

`runTerminalFailureNotify({ identifier, title, runUrl, workResult,
assertOutcome, env, gqlImpl, postSlackImpl, log })`:

1. No `identifier` → log, return `{ exitCode: 0, notified: false, reason: 'NO_IDENTIFIER' }`.
2. Read the issue via `fetchIssueForEscalation`. On throw, **branch on
   `isIssueNotFoundError(err)`** (round 2 MINOR): a genuine not-found sets
   `issue = null, readFailed = false`, so criterion 4's `NOT_FOUND` case is
   reachable from a real error rather than only from a hand-constructed
   `null`; any other throw sets `readFailed = true`. Log the message either
   way — **do not return early**. Unlike the sibling, a read failure here must
   still attempt to notify (with degraded detail), or this script reproduces
   the exact silence the issue is about, one layer deeper.
3. `verdict = classifyTerminalFailure(issue, { readFailed, workResult, assertOutcome })`.
4. `!verdict.notify` → log, return `{ exitCode: 0, notified: false, reason: verdict.shape }`.
   Covers `ESCALATED` (the sibling step already posted) and `NO_FAILURE`.
5. Build a `warn`-level Slack message, title `` `${identifier} — terminal
   failure (${verdict.shape})` ``. Lines:
   - **The issue title, preferring `issue.title` when the read succeeded and
     falling back to the `title` param otherwise** (round 2 MINOR). The param
     comes from `client_payload`, which is attacker-controllable; `issue.title`
     is read from Linear and is not. Precedence was unspecified in revision 2.
   - One fixed sentence per shape: `STRANDED`, `WORK_JOB_FAILURE`,
     `WORK_JOB_CANCELLED`, `ASSERT_FAILED`, `NOT_FOUND`, `READ_FAILED`.
     `ASSERT_FAILED`'s says the Assert step failed for a reason no longer
     visible on a second read, and names the run URL as the only place the
     original reason survives.
   - `runUrl` always; `issue.url` when the read succeeded.
   - The `READ_FAILED` sentence additionally says *"This may duplicate an
     escalation ping already sent — the read that would have told us otherwise
     also failed."*
6. Post via `postSlackImpl`; same `NOT_POSTED_${reason}` handling as the sibling.
7. Return `{ exitCode: 0, notified: true, reason: verdict.shape }`.

### Workflow: two edits in `.github/workflows/claude-linear-dispatch.yml`

**Edit 1 — give the Assert step an `id:` (round 2 MAJOR, part 1).** At `:540`,
`- name: Assert the run released its claim` gains `id: assert`. Nothing else
about that step changes. Without this, `steps.assert.outcome` is undefined and
part 3 of the fix cannot be wired.

**Edit 2 — one new step**, immediately after the existing "Tell the owner if
this was an escalation" step (576-582), same `assert-released` job, **wider**
`if:` than the sibling — the deliberate, stated divergence that closes round
1's coverage finding:

```yaml
      # GAM-404 Phase 1 deliverable ("notify on every terminal failure, not
      # only comments matching the current escalation marker" --
      # 2026-08-15-durable-multi-agent-execution-plan.md:577).
      #
      # WIDER than the step above on purpose. `if: failure()` alone only
      # catches a failing Assert step -- and note that step fails for THREE
      # reasons, not one (In Progress; NOT FOUND; either UNDETERMINED
      # shape). A `work` job that itself failed or was cancelled, but left
      # Linear looking released, previously notified nobody at all --
      # measured, `checker-premise` round 1. `needs.work.result` is readable
      # here because this job already declares `needs: work` (line 511).
      #
      # ASSERT_OUTCOME closes the hole round 2 measured: when the Assert
      # step went red for a reason the notify script's own second read can
      # no longer see, the script would otherwise classify NO_FAILURE and
      # say nothing about a red job. Internally still a no-op for ESCALATED
      # (the step above already reported it). Same never-a-gate contract:
      # always exits 0.
      - name: Tell the owner about any other terminal failure
        if: failure() || needs.work.result == 'failure' || needs.work.result == 'cancelled'
        env:
          LINEAR_API_KEY: ${{ secrets.LINEAR_DISPATCH_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          ISSUE_IDENTIFIER: ${{ github.event.client_payload.identifier }}
          ISSUE_TITLE: ${{ github.event.client_payload.title }}
          WORK_RESULT: ${{ needs.work.result }}
          ASSERT_OUTCOME: ${{ steps.assert.outcome }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: node scripts/linear-terminal-failure-notify.mjs "$ISSUE_IDENTIFIER" "$ISSUE_TITLE" "$WORK_RESULT" "$ASSERT_OUTCOME" "$RUN_URL"
```

`identifier` and `title` reach the shell only through `env:`, never
interpolated into `run:` — same discipline the file documents at 543-552.
`needs.work.result`, `steps.assert.outcome` and the `github.*` context values
are not `client_payload` fields and are not attacker-controlled.

**Delivery mechanism — corrected again this revision (round 2 MINOR).**
Revision 2's step 3 said "revert the working-tree change", which as written
would still leave a workflow-touching commit in this branch's history — the
revert is a *second* commit, not an erasure of the first. Any commit touching
`.github/workflows/**` is unpushable from a dispatched run (`AGENTS.md` "Two
walls" #1, measured three ways on GAM-314). The worker:

1. Applies **both** edits to `.github/workflows/claude-linear-dispatch.yml` in
   the working tree and verifies the result structurally (see criterion 10).
2. Commits that change locally as a throwaway commit.
3. Exports it to a path **outside the repository**:
   `git format-patch -1 --stdout > "$(mktemp -d)/gam-404-workflow.patch"`.
   Outside, not merely untracked, so no later `git clean` can take it.
4. **`git reset --hard HEAD~1`** — the workflow-touching commit is now gone
   from history, not reverted on top of it.
5. Copies the saved patch to
   `docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch` and
   commits **only that file**, matching the GAM-314 precedent
   (`docs/swarm/active/GAM-314-workflow-wiring.patch`, still on this branch).
6. Confirms with `git log --stat main...HEAD` that no reachable commit touches
   `.github/workflows/**` (criterion 12).

### New test file: `scripts/linear-terminal-failure-notify.test.mjs`

Does **not** import fixtures from `scripts/linear-escalation-notify.test.mjs`
(that file exports nothing — confirmed in round 1; `import` of
`ESCALATION_COMMENT` throws `SyntaxError`). Defines its own minimal
escalation-shaped fixture inline (a comment whose body opens `**Escalating
...`), and exercises `ESCALATED` classification by calling the real, imported
`detectEscalation` against that fixture — so the test still proves the *real*
sibling function is what decides `ESCALATED`.

## 3. Why `classifyState` and `linear-escalation-notify.mjs` are not edited

**`classifyState`:** it takes a bare state name and never reads comments, so
it cannot itself distinguish "escalated" from "stranded" — that needs
comments, which only the sibling's query fetches. Beyond the dependency
argument, round 1 supplied a stronger one: `linear-assert-released.mjs` is a
**gate that exits 1**; every notify concern in this codebase is bound by
"never a gate, always exit 0" (`linear-escalation-notify.mjs:32-36`). Mixing
an always-0 concern into an exit-1 script is the wrong shape regardless of
dependency direction. This revision **imports** `classifyState` and
`isIssueNotFoundError` (read-only) instead of reimplementing either by hand.

**`linear-escalation-notify.mjs`:** unchanged for the same reason, and
because the issue's own constraint says so explicitly ("leave the escalation
path exactly as is"). This revision imports `detectEscalation` and
`fetchIssueForEscalation` from it, read-only.

## 4. Acceptance criteria

1. `classifyTerminalFailure` returns `{ shape: 'ESCALATED', notify: false }`
   for an issue whose newest comment matches the escalation marker, verified
   via the real, imported `detectEscalation` — not a reimplementation.
2. `classifyTerminalFailure` returns `{ shape: 'STRANDED', notify: true }`
   for an issue in `In Progress` (via the real, imported `classifyState`)
   with no escalation-marker comment, including zero comments.
3. `classifyTerminalFailure` returns `{ shape: 'WORK_JOB_FAILURE', notify: true }`
   and `{ shape: 'WORK_JOB_CANCELLED', notify: true }` when `classifyState`
   says released (e.g. state `Todo` or `In Review`) but `workResult` is
   `'failure'`/`'cancelled'` respectively.
4. `classifyTerminalFailure` returns `{ shape: 'NOT_FOUND', notify: true }`
   for a `null` issue with `readFailed: false`, and
   `{ shape: 'READ_FAILED', notify: true }` when `readFailed: true`.
   **`runTerminalFailureNotify` reaches the `NOT_FOUND` case from a real
   thrown error that `isIssueNotFoundError` recognises**, not only from a
   hand-passed `null` (round 2 MINOR — otherwise every real not-found routes
   into `READ_FAILED` and this criterion tests an unreachable path).
5. **`classifyTerminalFailure` returns `{ shape: 'ASSERT_FAILED', notify: true }`
   when `classifyState` says released, `workResult` is `'success'` or
   `undefined`, and `assertOutcome` is `'failure'`.** Asserted for both
   shapes round 2 measured: `{state:{name:'In Review'}}` and `{state:null}`.
   **This is the criterion for round 2's MAJOR.**
   *Named mutation: delete the `assertOutcome === 'failure'` branch → both
   cases return `NO_FAILURE` and this criterion goes red while criteria 1-4
   stay green.*
6. `classifyTerminalFailure` returns `{ shape: 'NO_FAILURE', notify: false }`
   only when `classifyState` says released, `workResult` is `'success'` or
   `undefined`, **and `assertOutcome` is not `'failure'`**.
7. `runTerminalFailureNotify` does **not** call `postSlackImpl` for
   `ESCALATED` or `NO_FAILURE` (named mutation: delete the `!verdict.notify`
   guard → both cases start calling `postSlackImpl`, red).
8. `runTerminalFailureNotify` **does** call `postSlackImpl` for `STRANDED`,
   `WORK_JOB_FAILURE`, `ASSERT_FAILED`, `NOT_FOUND`, and a simulated
   Linear-read throw (`READ_FAILED`), each with `level: 'warn'` and a message
   containing the issue identifier, **the issue title**, and `runUrl`. The
   `READ_FAILED` message additionally contains the word "duplicate".
   **The title assertion is required** (round 2 MINOR): without it, round 1's
   "`title` threaded but unused" finding survives untested. Assert both
   precedence directions — `issue.title` wins when the read succeeded, the
   payload `title` is used when it did not.
9. A Linear read failure does not prevent a Slack post (named mutation:
   revert step 2 of `runTerminalFailureNotify` to return early on throw,
   matching the sibling's `READ_FAILED` shape → `notified` goes from `true`
   to `false` for this case, red).
10. `runTerminalFailureNotify` always resolves `exitCode: 0`, including when
    `postSlackImpl` throws or returns `posted: false` (webhook-not-configured
    case explicit, matching the sibling's own test for it).
11. **The workflow edit is graded as the preserved patch, not the branch's
    committed YAML** (the latter is impossible to satisfy — round 1 MAJOR).
    `git apply --check` applies
    `docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch`
    cleanly against `main`'s copy of
    `.github/workflows/claude-linear-dispatch.yml`. The patched file, parsed
    with `js-yaml`, shows **both** edits:
    - `jobs.assert-released.steps[]` — the step named `Assert the run
      released its claim` now carries `id: assert`;
    - exactly one **new** step under `jobs.assert-released.steps`, positioned
      immediately after the existing escalation step, with an `if:`
      containing `needs.work.result`, an `env:` containing
      `ASSERT_OUTCOME`, and no `${{ }}` expression anywhere inside its `run:`
      value.

    **`js-yaml` is not a declared dependency** (round 2 MINOR). It resolves
    transitively via `eslint > @eslint/eslintrc > js-yaml@4.3.0`. If that
    path ever disappears, this criterion must add `js-yaml` as an explicit
    devDependency rather than silently lose its structural check.
12. All six gates pass: `tsc`, `vite build`, `format:check`, `eslint` (no
    warning-count rise from the branch-point baseline), full `vitest`, and
    `vitest run scripts/` (scoped; branch-point baseline **13 files / 299
    tests**, measured by the round 2 gate).
13. `scripts/linear-escalation-notify.mjs` and `scripts/linear-assert-released.mjs`
    are **byte-identical** to their `main`-branch-point versions on the
    branch's final commit, and **no reachable commit touches
    `.github/workflows/**`** (`git log --stat main...HEAD`). The patch file
    capturing the workflow edit is expected and is not a violation.

## 5. Allowed Files

- `scripts/linear-terminal-failure-notify.mjs` (new)
- `scripts/linear-terminal-failure-notify.test.mjs` (new)
- `docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch` (new —
  the preserved, undeliverable workflow edit; **not**
  `.github/workflows/claude-linear-dispatch.yml` itself, which must never
  appear in a commit reachable from this branch's pushed history)

No other file. `scripts/linear-escalation-notify.mjs` and
`scripts/linear-assert-released.mjs` are explicitly **forbidden** (criterion
13 makes that mechanically checkable).

## 6. Least confident decisions (item 19d)

1. **Cross-run/redelivery dedup is still deliberately out of scope.** The
   concrete reachable duplicate sources are not GitHub webhook redelivery
   (least reachable) but (a) an operator clicking "Re-run failed jobs" on
   `assert-released`, and (b) the `Todo` self-re-dispatch loop named at
   `linear-assert-released.mjs:47-50` and filed as **GAM-326** — a run that
   repeatedly stops itself would ping once per attempt. What would make this
   wrong: if GAM-326 recurs often enough that repeated terminal-failure pings
   become noise; the fix then is likely a per-issue rate limit or a
   comment-based dedup marker in the *new* script, not a widening of this
   packet. Not building it now because nothing in this repository measures
   how often GAM-326 actually fires.
2. **`WORK_JOB_FAILURE`/`WORK_JOB_CANCELLED` can fire for a `work` job that
   failed for a reason having nothing to do with the dispatched agent** —
   e.g. a post-processing step like "Keep the execution log" or "Record the
   session id" (both `if: always()`, both after the agent) failing on
   infrastructure grounds after the agent's own work genuinely succeeded and
   released the claim cleanly. This design still notifies in that case,
   favoring a false-positive Slack line over a missed one, consistent with
   `linear-assert-released.mjs`'s own "denylist of one, not an allowlist".
   What would make this wrong: if that shape turns out common enough to train
   the owner to ignore this channel — the same failure mode
   `linear-escalation-notify.mjs`'s header warns about for over-broad
   matching. **`ASSERT_FAILED` widens this same exposure**, since it fires on
   a red Assert step whose cause has already cleared; it is accepted for the
   same reason, and it is the shape most likely to need a rate limit first.
3. **`RUN_URL` is constructed from GitHub context values
   (`server_url`/`repository`/`run_id`), not read from an API** — the same
   approach `linear-sync.mjs:661` already uses one layer down. Believed safe
   (none of the three components are attacker-controlled) but unverified
   against a GitHub Enterprise deployment, which this repository does not run.
4. **The new script reads Linear a second time** rather than threading the
   Assert step's result through `GITHUB_OUTPUT`. Believed negligible against
   the measured **2500/hour** rolling rate limit
   (`scripts/linear/client.mjs:40`; `:17` is `RATE_FLOOR = 150`) for a
   terminal-failure-only code path, but it is a real doubling of read volume
   on exactly the path this issue is about hardening. **Round 2's MAJOR is
   the cost of that choice showing up**: because the second read can disagree
   with the first, `assertOutcome` had to be threaded through anyway. A
   future revision that threads the Assert step's *reason* through
   `GITHUB_OUTPUT` would remove both the second read and this whole class of
   disagreement.
5. **Slack message wording is not reviewed by anyone with Slack UX judgment**
   and reuses the sibling's `warn` level (the only option `slack.mjs`
   currently exposes besides `ok`/`info`). What would make this wrong: if the
   owner wants terminal failures visually distinct from escalations; that
   would require editing `slack.mjs`, out of this packet's Allowed Files.

### Disclosed, not fixed — round 2's three NITs

Logged rather than actioned, per the severity rules:

1. **A residual normalization mismatch** between `detectEscalation`'s exact
   match and `classifyState`'s trim/lowercase handling. It errs toward
   notifying, so it cannot cause silence.
2. **`readFailed` short-circuits ahead of `workResult`**, so a run that was
   cancelled *and* whose issue could not be read reports `READ_FAILED`
   without mentioning the cancellation. One notification is still sent.
3. **A run that never reaches the `assert-released` job at all** — whole-run
   infrastructure loss, a cancelled workflow before `needs: work` resolves —
   **still notifies nobody.** Nothing in this packet closes that, and nothing
   in the repository does either. It is the residue of GAM-404 that a
   workflow-internal notifier structurally cannot reach; closing it needs the
   external controller plan §5.7 describes. Stated here so the next reader
   does not assume this row closed the whole class.

## 7. What changed in revision 3

Every item round 2 raised, and where it landed:

| Round 2 finding | Where |
| -- | -- |
| **MAJOR — `NO_FAILURE` reachable, silence on a red job** (4 parts) | §1 premise table (verified independently), §2 `assertOutcome` param + `ASSERT_FAILED` branch, §2 workflow Edit 1 (`id: assert`) and Edit 2 (`ASSERT_OUTCOME` env + argv), criteria 5 and 6. **Both false "unreachable" claims corrected** — the function comment and the workflow comment. |
| MINOR — delivery step 3 leaves a workflow commit in history | §2 "Delivery mechanism", rewritten to 6 steps: patch out of the repo, `git reset --hard HEAD~1`, then commit only the copied patch. |
| MINOR — `isIssueNotFoundError` unused, criterion 4 untestable | §1 citation, §2 `runTerminalFailureNotify` step 2, criterion 4. |
| MINOR — criterion 7 must assert the Slack body carries the *title* | Criterion 8 (renumbered), both precedence directions asserted. |
| MINOR — citation renumbering slip ("criterion 8" → criterion 10) | §2 delivery step 1 now points at criterion 10; all criteria renumbered once, consistently. |
| MINOR — `client.mjs:17` is `RATE_FLOOR`, 2500/hour is at `:40` | §6 item 4. |
| MINOR — `js-yaml` is transitive, not declared | §1 citations, criterion 11, with the resolution path and the risk named. |
| MINOR — `title` precedence unspecified, payload is attacker-controllable | §2 step 5, prefer `issue.title`; criterion 8 asserts both directions. |
| NIT ×3 | §6 "Disclosed, not fixed". |

**Not submitted for a round 3.** Item 19a caps the gate at two rounds; round 2
returned no BLOCKER and said an owner could reasonably authorize this fix as
an amendment. The acceptor should check this table against the run log's round
2 verdict — that is the review this revision asks for, in place of a third
gate round.
