# GAM-404 packet — notify on every terminal failure

**Revision 2** (round 1 `checker-premise` findings folded in; see
`docs/swarm/active/GAM-404-run-log.md` for the round 1 verdict this responds
to).

**Tier: STANDARD** (item 26 — no write path, no schema/RLS/migration, no
auth/role logic; external Slack write only, matching the issue's own sizing).
**Item 19 premise gate: scoped light-to-medium per 19b**, capped at two rounds
(19a) — this is round 2, the last before an owner escalation.

## 1. Premise — re-verified against current `main`

| Claim | Verified |
| -- | -- |
| `linear-escalation-notify.mjs:60` is the strict marker regex | **Exact.** `const ESCALATION_MARKER = /^\s*\*\*Escalat(?:ing\|ed)\b/i;` at line 60. |
| `claude-linear-dispatch.yml:576-582` is the only notify step, `if: failure()` | **Exact** (corrected from revision 1's `577-582`: `- name:` opens at 576). It is the only Slack-posting step in the file. |
| `linear-escalation-notify.mjs` stays silent for non-escalation failures | **Confirmed by execution**, not inference: `detectEscalation` returns `escalated:false` before `postSlackImpl` is ever reached, on every non-`ESCALATED` branch. |
| `linear-assert-released.mjs` "already distinguishes the failure shapes" and is "the natural place to classify" | **Partially true.** Its header comment (27-42) narrates three benign shapes; `classifyState` (107-131) returns one identical reason string for all of them and never reads comments, so it cannot itself tell them apart. §3 explains why this packet still does not modify it. |
| Deduplication requirement, plan §5.7/§5.1 | Read at `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:419-451` and the `notification keys` row at `:271`, inside the **not-yet-deployed** controller's run-store table. Confirmed still true as of this revision: `supabase/spikes/gam-407-run-store/README.md:3` states "This is a spike, not infrastructure. Nothing here is deployed" — cited directly rather than asserted from absence, per round 1's finding. |
| "Phase 1 ... names this: notify on every terminal failure" | **Exact** at `:577`. **Revision 1 overstated this as "implements exactly that one deliverable"; corrected in §2 below** — round 1 measured a real coverage gap in the `if: failure()` gate that this revision closes. |
| GAM-344's 120-minute cap | Not re-measured; irrelevant to this fix's mechanism (agnostic to *why* a run died). **Citation fixed**: the current timeout is `timeout-minutes: 180` at `claude-linear-dispatch.yml:103` (revision 1 cited `:74`, which is prose, not the setting). |

**New citations added this revision, verified:**
- `needs.<job>.result` is readable from a step-level `if:` in a job that
  declares `needs: work` — `assert-released` already declares `needs: work`
  at `:511`, so no new `needs:` entry is required, only a richer `if:`
  expression on the new step.
- `client_payload.title` is genuinely populated by the dispatching edge
  function, not just assumed: `supabase/functions/linear-dispatch/filter.ts:176,389`.
- `scripts/linear-sync.mjs:661` already builds a GitHub-context run URL from
  `env.GITHUB_REPOSITORY` inside a script rather than in YAML — the packet's
  `RUN_URL` construction takes the same approach one level up (in `env:`),
  which round 1 judged strictly better (composed once, not per-script) and
  asked to have the precedent cited rather than reinvented silently.

## 2. Design

**Do not edit `linear-escalation-notify.mjs` or `linear-assert-released.mjs`.**
Both stay byte-for-byte as they are on this branch (criterion 10 makes this
mechanically checkable). This revision **imports two things, read-only, from
each** — importing is not editing; neither file's behavior changes for any
existing caller.

### New file: `scripts/linear-terminal-failure-notify.mjs`

Same shape as its sibling: `gqlImpl`/`postSlackImpl`/`log` all injected for
tests, always exits 0, never a gate.

```js
import { detectEscalation, fetchIssueForEscalation } from './linear-escalation-notify.mjs';
import { classifyState } from './linear-assert-released.mjs';

/**
 * Pure. `issue` is the shape `detectEscalation` takes (`null` when the read
 * failed or the issue does not exist). `readFailed` distinguishes a genuine
 * `null` issue (Linear said "not found") from a read that threw (Linear
 * could not be asked at all) -- the two need different Slack wording.
 * `workResult` is `needs.work.result` from the workflow (`'failure'`,
 * `'cancelled'`, `'success'`, or `undefined` outside CI) -- ADDED this
 * revision to close round 1's coverage finding: a `work` job that itself
 * failed or was cancelled, but left Linear in a state `classifyState`
 * treats as released, previously notified nobody at all.
 *
 * `classifyState` is imported, not reimplemented, so "is this state the one
 * `assert-released` itself would fail on" always agrees with the assertion
 * that actually produced this failure -- round 1's normalization finding
 * (trim/case mismatch against a hand-rolled check) is closed by construction
 * rather than by more careful hand-rolling.
 */
export function classifyTerminalFailure(issue, { readFailed = false, workResult } = {}) {
  if (readFailed) return { shape: 'READ_FAILED', notify: true };
  if (!issue) return { shape: 'NOT_FOUND', notify: true };
  if (detectEscalation(issue).escalated) return { shape: 'ESCALATED', notify: false };

  const stateName = issue.state?.name ?? '';
  if (!classifyState(stateName).released) {
    // The exact condition that makes assert-released's own Assert step
    // fail (currently: only "In Progress", per its denylist-of-one) -- an
    // unfinished chain with no escalation comment.
    return { shape: 'STRANDED', notify: true };
  }

  // The Assert step passed (Linear looks fine), but the `work` job itself
  // did not. This is the shape round 1 found missing entirely: a run that
  // crashes after releasing its claim, or is cancelled before claiming at
  // all, previously produced a green (or silently-passing) assert-released
  // job and no notification anywhere.
  if (workResult === 'failure' || workResult === 'cancelled') {
    return { shape: `WORK_JOB_${workResult.toUpperCase()}`, notify: true };
  }

  // Nothing wrong: Assert passed and `work` did not fail or get cancelled.
  // Unreachable through the workflow's own `if:` (see §2's YAML), kept for
  // the function to stay total and independently testable.
  return { shape: 'NO_FAILURE', notify: false };
}
```

`runTerminalFailureNotify({ identifier, title, runUrl, workResult, env,
gqlImpl, postSlackImpl, log })`:

1. No `identifier` → log, return `{ exitCode: 0, notified: false, reason: 'NO_IDENTIFIER' }`.
2. Read the issue via `fetchIssueForEscalation`. On throw, set `issue = null,
   readFailed = true` and log the message — **do not return early**. Unlike
   the sibling, a read failure here must still attempt to notify (with
   degraded detail), or this script reproduces the exact silence the issue
   is about, one layer deeper.
3. `verdict = classifyTerminalFailure(issue, { readFailed, workResult })`.
4. `!verdict.notify` → log, return `{ exitCode: 0, notified: false, reason: verdict.shape }`.
   Covers both `ESCALATED` (the sibling step already posted) and `NO_FAILURE`.
5. Build a `warn`-level Slack message, title `` `${identifier} — terminal
   failure (${verdict.shape})` ``. Lines: the issue title when known (`title`
   param, or `issue.title` when the read succeeded), one fixed sentence per
   shape (`STRANDED`, `WORK_JOB_FAILURE`, `WORK_JOB_CANCELLED`, `NOT_FOUND`,
   `READ_FAILED`), `runUrl` always, `issue.url` when the read succeeded. The
   `READ_FAILED` sentence additionally says *"This may duplicate an
   escalation ping already sent — the read that would have told us otherwise
   also failed."* (closes round 1's "false claim of at most one ping": the
   one case where a duplicate is possible is now named in the message itself
   rather than only in this packet).
6. Post via `postSlackImpl`; same `NOT_POSTED_${reason}` handling as the
   sibling.
7. Return `{ exitCode: 0, notified: true, reason: verdict.shape }`.

### Workflow: one new step in `.github/workflows/claude-linear-dispatch.yml`

Immediately after the existing "Tell the owner if this was an escalation"
step (576-582), same job (`assert-released`), **wider** `if:` than the
sibling step — this is the deliberate, stated divergence that closes round
1's coverage finding, not an oversight:

```yaml
      # GAM-404 Phase 1 deliverable ("notify on every terminal failure, not
      # only comments matching the current escalation marker" --
      # 2026-08-15-durable-multi-agent-execution-plan.md:577).
      #
      # WIDER than the step above on purpose. `if: failure()` alone only
      # catches a failing Assert step (Linear still `In Progress`). A `work`
      # job that itself failed or was cancelled, but left Linear looking
      # released (claim never landed -- still `Todo`; or released cleanly
      # before work died in a later step), previously notified nobody at
      # all -- measured, `checker-premise` round 1. `needs.work.result` is
      # readable here because this job already declares `needs: work` (line
      # 511).
      #
      # Internally a no-op for ESCALATED (the step above already reported
      # it) and for NO_FAILURE (unreachable through this `if:`, kept for the
      # script's own totality). Same never-a-gate contract: always exits 0.
      - name: Tell the owner about any other terminal failure
        if: failure() || needs.work.result == 'failure' || needs.work.result == 'cancelled'
        env:
          LINEAR_API_KEY: ${{ secrets.LINEAR_DISPATCH_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          ISSUE_IDENTIFIER: ${{ github.event.client_payload.identifier }}
          ISSUE_TITLE: ${{ github.event.client_payload.title }}
          WORK_RESULT: ${{ needs.work.result }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: node scripts/linear-terminal-failure-notify.mjs "$ISSUE_IDENTIFIER" "$ISSUE_TITLE" "$WORK_RESULT" "$RUN_URL"
```

`identifier` and `title` reach the shell only through `env:`, never
interpolated into `run:` — same discipline the file documents at 543-552.
`needs.work.result` and the `github.*` context values are not
`client_payload` fields and are not attacker-controlled.

**Delivery mechanism — corrected this revision (round 1 MAJOR).** This edit
cannot be committed to this branch: any commit touching
`.github/workflows/**` is unpushable from a dispatched run (`AGENTS.md` "Two
walls" #1, measured three ways on GAM-314). The worker:

1. Writes the change to `.github/workflows/claude-linear-dispatch.yml` in the
   working tree and verifies it (structurally — see criterion 8).
2. Exports it with `git format-patch -1 --stdout > docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch`
   against a commit made **only** to prepare the patch, matching the
   GAM-314 precedent (`docs/swarm/active/GAM-314-workflow-wiring.patch`).
3. **Reverts the working-tree change to the YAML** so no commit that reaches
   `origin` on this branch touches `.github/workflows/**`. Only the `.patch`
   file under `docs/swarm/active/` is committed.

### New test file: `scripts/linear-terminal-failure-notify.test.mjs`

**Round 1 BLOCKER fix:** does **not** import fixtures from
`scripts/linear-escalation-notify.test.mjs` (that file exports nothing —
confirmed, `import` of `ESCALATION_COMMENT` throws `SyntaxError`). Instead
defines its own minimal escalation-shaped fixture inline (a comment whose
body opens `**Escalating ...`), and exercises `ESCALATED` classification by
calling the real, imported `detectEscalation` against that fixture — so the
test still proves the *real* sibling function is what decides `ESCALATED`,
without needing the sibling's test file to export anything.

## 3. Why `classifyState` and `linear-escalation-notify.mjs` are not edited

**`classifyState`:** it takes a bare state name and never reads comments, so
it cannot itself distinguish "escalated" from "stranded" — that needs
comments, which only the sibling's query fetches. Beyond the dependency
argument, round 1 supplied a stronger one: `linear-assert-released.mjs` is a
**gate that exits 1**; every notify concern in this codebase is bound by
"never a gate, always exit 0" (`linear-escalation-notify.mjs:32-36`). Mixing
an always-0 concern into an exit-1 script is the wrong shape regardless of
dependency direction. This revision **imports** `classifyState` (read-only)
instead of reimplementing its state check by hand — closing round 1's
normalization-mismatch finding — without editing the function itself.

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
   `'failure'`/`'cancelled'` respectively — **this is the criterion for round
   1's coverage finding** and has no analogue in the sibling file.
4. `classifyTerminalFailure` returns `{ shape: 'NOT_FOUND', notify: true }`
   for a `null` issue with `readFailed: false`, and
   `{ shape: 'READ_FAILED', notify: true }` when `readFailed: true`.
5. `classifyTerminalFailure` returns `{ shape: 'NO_FAILURE', notify: false }`
   when `classifyState` says released and `workResult` is `'success'` or
   `undefined`.
6. `runTerminalFailureNotify` does **not** call `postSlackImpl` for
   `ESCALATED` or `NO_FAILURE` (named mutation: delete the `!verdict.notify`
   guard → both cases start calling `postSlackImpl`, red).
7. `runTerminalFailureNotify` **does** call `postSlackImpl` for `STRANDED`,
   `WORK_JOB_FAILURE`, `NOT_FOUND`, and a simulated Linear-read throw
   (`READ_FAILED`), each with `level: 'warn'` and a message containing the
   issue identifier and `runUrl`; the `READ_FAILED` message additionally
   contains the word "duplicate".
8. A Linear read failure does not prevent a Slack post (named mutation:
   revert step 2 of `runTerminalFailureNotify` to return early on throw,
   matching the sibling's `READ_FAILED` shape → `notified` goes from `true`
   to `false` for this case, red).
9. `runTerminalFailureNotify` always resolves `exitCode: 0`, including when
   `postSlackImpl` throws or returns `posted: false` (webhook-not-configured
   case explicit, matching the sibling's own test for it).
10. **The workflow edit is graded as the preserved patch, not the branch's
    committed YAML (round 1 MAJOR — the latter is impossible to satisfy).**
    `git apply --check` applies
    `docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch`
    cleanly against `main`'s copy of
    `.github/workflows/claude-linear-dispatch.yml`; the patched file, parsed
    with `js-yaml` (already a dependency, v4.3.0), shows exactly one new
    step under `jobs.assert-released.steps`, positioned immediately after
    the existing escalation step, with an `if:` containing
    `needs.work.result`, and no `${{ }}` expression anywhere inside its
    `run:` value.
11. All six gates pass: `tsc`, `vite build`, `format:check`, `eslint` (no
    warning-count rise from the branch-point baseline), full `vitest`, and
    `vitest run scripts/` (scoped).
12. `scripts/linear-escalation-notify.mjs` and `scripts/linear-assert-released.mjs`
    are **byte-identical** to their `main`-branch-point versions on the
    branch's final commit (`git diff --stat main...HEAD` shows neither
    file) — the patch file capturing the workflow edit is expected and is
    not a violation of this criterion.

## 5. Allowed Files

- `scripts/linear-terminal-failure-notify.mjs` (new)
- `scripts/linear-terminal-failure-notify.test.mjs` (new)
- `docs/swarm/active/GAM-404-workflow-terminal-failure-notify.patch` (new —
  the preserved, undeliverable workflow edit; **not**
  `.github/workflows/claude-linear-dispatch.yml` itself, which must never
  appear in a commit reachable from this branch's pushed history — round 1
  MAJOR)

No other file. `scripts/linear-escalation-notify.mjs` and
`scripts/linear-assert-released.mjs` are explicitly **forbidden** (criterion
12 makes that mechanically checkable).

## 6. Least confident decisions (item 19d)

1. **Cross-run/redelivery dedup is still deliberately out of scope.**
   Refined this revision per round 1: the concrete reachable duplicate
   sources are not GitHub webhook redelivery (least reachable) but (a) an
   operator clicking "Re-run failed jobs" on `assert-released`, and (b) the
   `Todo` self-re-dispatch loop named at `linear-assert-released.mjs:47-50`
   and filed as **GAM-326** — a run that repeatedly stops itself would ping
   once per attempt. What would make this wrong: if GAM-326 recurs often
   enough that repeated terminal-failure pings become noise; the fix then is
   likely a per-issue rate limit or a comment-based dedup marker in the
   *new* script, not a widening of this packet. Not building it now because
   nothing in this repository measures how often GAM-326 actually fires.
2. **`WORK_JOB_FAILURE`/`WORK_JOB_CANCELLED` can fire for a `work` job that
   failed for a reason having nothing to do with the dispatched agent** —
   e.g. a post-processing step like "Keep the execution log" or "Record the
   session id" (both `if: always()`, both after the agent) failing on
   infrastructure grounds after the agent's own work genuinely succeeded and
   released the claim cleanly. This design still notifies in that case
   (favoring a false-positive Slack line over a missed one, consistent with
   this codebase's stated preference throughout — `linear-assert-released.mjs`'s
   own "denylist of one, not an allowlist"). What would make this wrong: if
   that shape turns out to be common enough that it trains the owner to
   ignore this channel, the same failure mode `linear-escalation-notify.mjs`'s
   header warns about for over-broad matching. No data exists yet on how
   often it would fire.
3. **`RUN_URL` is constructed from GitHub context values
   (`server_url`/`repository`/`run_id`), not read from an API** — the same
   approach `linear-sync.mjs:661` already uses one layer down. Believed safe
   (none of the three components are attacker-controlled) but unverified
   against a GitHub Enterprise deployment, which this repository does not
   run.
4. **The new script reads Linear a second time** rather than threading the
   Assert step's result through `GITHUB_OUTPUT`. Believed negligible against
   the measured 2500/hour rolling rate floor (`client.mjs:17`) for a
   terminal-failure-only code path, but it is a real doubling of read volume
   on exactly the path this issue is about hardening.
5. **Slack message wording is not reviewed by anyone with Slack UX
   judgment** and reuses the sibling's `warn` level (the only option
   `slack.mjs` currently exposes besides `ok`/`info`). What would make this
   wrong: if the owner wants terminal failures visually distinct from
   escalations; that would require editing `slack.mjs`, out of this
   packet's Allowed Files.
