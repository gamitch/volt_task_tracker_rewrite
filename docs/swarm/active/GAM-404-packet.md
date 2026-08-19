# GAM-404 packet — notify on every terminal failure

**Tier: STANDARD** (item 26 — no write path, no schema/RLS/migration, no
auth/role logic; external Slack write only, matching the issue's own sizing).
**Item 19 premise gate: scoped light-to-medium per 19b.** The failure premise
(silent terminal failures) is already measured by the issue and by this
packet's own re-verification below; what has never been reviewed by anyone
but its author is the *prescription* — a new script and a new workflow step —
so the gate is pointed at feasibility, the escalation-path-untouched
constraint, and the dedup/notify-shape logic, not a full re-audit of settled
ground.

## 1. Premise — re-verified against current `main`, not taken from the issue

| Claim | Verified |
| -- | -- |
| `linear-escalation-notify.mjs:60` is the strict marker regex | **Exact.** `const ESCALATION_MARKER = /^\s*\*\*Escalat(?:ing\|ed)\b/i;` at line 60. |
| `claude-linear-dispatch.yml:577-582` is the only notify step, `if: failure()` | **Exact.** The `Tell the owner if this was an escalation` step spans 576-582, `if: failure()` at 577, invoking `linear-escalation-notify.mjs`. |
| `linear-escalation-notify.mjs` stays silent for non-escalation failures | **Confirmed by reading, not inference.** `detectEscalation` returns `escalated:false` for any state other than `In Progress`, for no comments, and for a newest comment that does not match the marker; `runEscalationNotify` then logs and returns `notified:false` with **no Slack post** in every one of those branches. |
| `linear-assert-released.mjs` "already distinguishes the failure shapes" and is "the natural place to classify" | **Partially true, corrected here.** Its *header comment* (lines 27-42) narrates three benign shapes, but `classifyState` (107-131) does **not** return which shape applied — every `In Progress` case gets the identical `IN_PROGRESS_REASON` string, and the function never reads comments so it structurally cannot tell "escalated" from "crashed" (that distinction needs the escalation marker, which lives only in comments). This packet does not change `classifyState`'s signature or behavior — see §3 for why. |
| Deduplication requirement, plan §5.7 | **Read at `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:419-450` and `:249-271`.** `notification keys` for failure/completion dedup are named as a field of the **future controller's** authoritative run store (§5.1's table, not yet built — no such store exists in this repository today). Durable cross-run dedup is therefore **out of this packet's scope**; see §5.4 for what this packet does instead and why that is not a corner cut. |
| "Phase 1 ... names this: notify on every terminal failure" | **Exact.** `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:577`: "notify on every terminal failure, not only comments matching the current escalation marker" — a Phase 1 deliverable, not Phase 2's controller. This packet implements exactly that one deliverable and nothing from Phase 2 (no controller, no run store, no generation fencing). |
| GAM-344 died at the former 120-minute cap, twice | **Not re-measured** — this packet relies on the issue's citation of the plan's own diagnosis, which is itself unchanged by this fix (the timeout cap is a separate, already-superseded setting — `claude-linear-dispatch.yml:74` now reads 180, per the file's own history). Not a premise this fix depends on; the fix is agnostic to *why* a run died. |

**Correction to the issue's own filing:** none found. Citations held up exactly as stated.

## 2. Design

**Do not touch `linear-escalation-notify.mjs` or `linear-assert-released.mjs`'s
`classifyState`.** Both stay byte-for-byte as they are — the issue's own
constraint ("leave the escalation path exactly as is") is read literally: not
just "the marker regex doesn't widen" but "the file's behavior is unchanged,"
so a reviewer can diff this change against exactly one new file plus one
workflow step and trust nothing about the existing escalation path moved.

### New file: `scripts/linear-terminal-failure-notify.mjs`

Same shape as its sibling (`gqlImpl`/`postSlackImpl` injected, `log` injected,
always exits 0, never a gate — matching `linear-escalation-notify.mjs`'s own
"NEVER A GATE" rule so a Slack outage or a Linear read failure cannot add a
second red cause to an already-failing job).

Reuses `detectEscalation` and `fetchIssueForEscalation` **by importing them
unchanged** from `./linear-escalation-notify.mjs` — this is what makes "leave
the escalation path exactly as is" mechanically true rather than merely
stated: the marker regex is not duplicated into a second file where it could
drift.

```js
import { detectEscalation, fetchIssueForEscalation } from './linear-escalation-notify.mjs';

/**
 * Pure. `issue` is the same shape `detectEscalation` takes; `readFailed` is
 * true when the Linear read itself threw. Escalation is excluded on purpose
 * -- the sibling step already covers that shape, and this function exists
 * to catch every OTHER terminal shape, not to re-decide that one.
 */
export function classifyTerminalFailure(issue, { readFailed = false } = {}) {
  if (readFailed) return { shape: 'READ_FAILED', notify: true };
  if (!issue) return { shape: 'NOT_FOUND', notify: true };
  if (detectEscalation(issue).escalated) return { shape: 'ESCALATED', notify: false };
  const stateName = (issue.state?.name ?? '').trim();
  if (stateName.toLowerCase() === 'in progress') {
    return { shape: 'STRANDED', notify: true };
  }
  // Defensive only -- assert-released's classifyState is a denylist of one,
  // so a failing job with a state other than "In Progress" should not be
  // reachable today. If it ever is, default to notifying rather than
  // silence: the false-positive here is a spurious Slack line, the
  // false-negative is this issue happening again.
  return { shape: `UNEXPECTED_STATE_${stateName || 'UNKNOWN'}`, notify: true };
}
```

`runTerminalFailureNotify({ identifier, title, runUrl, env, gqlImpl,
postSlackImpl, log })`:

1. No `identifier` → log, return `{ exitCode: 0, notified: false, reason: 'NO_IDENTIFIER' }` (mirrors sibling).
2. Read the issue via `fetchIssueForEscalation`. On throw, set `issue = null, readFailed = true` and log the message — **do not return early**, unlike the sibling. A read failure is itself part of "every terminal failure" this script exists to surface, so it must still attempt to notify (with degraded detail) rather than going silent, which would reproduce the exact defect this issue is about one level deeper.
3. `verdict = classifyTerminalFailure(issue, { readFailed })`.
4. `!verdict.notify` (i.e. `ESCALATED`) → log, return `{ exitCode: 0, notified: false, reason: verdict.shape }`. No Slack post — the sibling step already sent it for this event.
5. Build a `warn`-level Slack message. Title: `` `${identifier} — terminal failure (${verdict.shape})` ``. Body names the shape in plain language (four fixed strings, one per `shape` value from step 3, plus a generic fallback for `UNEXPECTED_STATE_*`), and always includes `runUrl` (the GitHub Actions run — always available, independent of whether Linear could be read) and, when the issue read succeeded, `issue.url`.
6. Post via `postSlackImpl`; same `NOT_POSTED_${reason}` handling as the sibling (`posted.posted === false` → log, return `{ exitCode: 0, notified: false, reason: … }`).
7. Return `{ exitCode: 0, notified: true, reason: verdict.shape }`.

### Workflow: one new step in `.github/workflows/claude-linear-dispatch.yml`

Immediately after the existing "Tell the owner if this was an escalation"
step (currently lines 576-582), same job (`assert-released`), same `if:
failure()` gate, same `env:`-not-`run:` interpolation discipline for
`client_payload` fields (both `identifier` and the newly-added `title` are
attacker-controllable, per the file's own documented reasoning at
lines 543-552):

```yaml
      # GAM-404 Phase 1 deliverable ("notify on every terminal failure, not
      # only comments matching the current escalation marker" --
      # 2026-08-15-durable-multi-agent-execution-plan.md:577). Runs on the
      # SAME `if: failure()` as the step above; internally a no-op for the
      # ESCALATED shape, which that step already reports, so one terminal
      # event never produces two Slack pings. Same never-a-gate contract:
      # always exits 0.
      - name: Tell the owner about any other terminal failure
        if: failure()
        env:
          LINEAR_API_KEY: ${{ secrets.LINEAR_DISPATCH_API_KEY }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          ISSUE_IDENTIFIER: ${{ github.event.client_payload.identifier }}
          ISSUE_TITLE: ${{ github.event.client_payload.title }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: node scripts/linear-terminal-failure-notify.mjs "$ISSUE_IDENTIFIER" "$ISSUE_TITLE" "$RUN_URL"
```

This edit is **behind the credential wall** (`AGENTS.md` "Two walls" #1 — no
dispatched run can push `.github/workflows/**`). Per that same section, the
worker writes and verifies the YAML, then the orchestrator preserves it as an
applyable patch under `docs/swarm/active/` rather than attempting another
channel.

### New test file: `scripts/linear-terminal-failure-notify.test.mjs`

Same no-network discipline as the sibling test file (`gqlImpl`/`postSlackImpl`
injected in every test that reaches them). Reuses the sibling test file's
`ESCALATION_COMMENT` / `issueWith` fixtures where the shape under test is
`ESCALATED`, so the two test files agree on what an escalation looks like
instead of each inventing its own fixture.

## 3. Why `classifyState` is not touched

An earlier draft of this design considered adding a `shape` field to
`classifyState`'s return value so `linear-assert-released.mjs` could report a
richer verdict. Rejected: `classifyState` takes a bare state **name** and
never reads comments, so it cannot itself distinguish "escalated" from
"stranded" — the marker lives only in comments. Reaching into comments from
`linear-assert-released.mjs` would mean either duplicating the escalation
query there too, or importing `linear-escalation-notify.mjs` into
`linear-assert-released.mjs`, which inverts the dependency this packet
otherwise keeps one-directional (the new file depends on the existing one,
not the reverse) and touches a file the issue's own "Where it lives" table
does not name as one to change behaviorally. The chosen design gets the same
classification power by having the *new* script do its own read, at the cost
of one extra Linear query per terminal failure — cheap, and terminal
failures are (by definition) not the common case.

## 4. Acceptance criteria

1. `classifyTerminalFailure` returns `{ shape: 'ESCALATED', notify: false }`
   for an issue whose newest comment matches the escalation marker — verified
   by calling `detectEscalation` from the unmodified sibling file, not a
   reimplementation.
2. `classifyTerminalFailure` returns `{ shape: 'STRANDED', notify: true }`
   for an issue in `In Progress` with no escalation-marker comment (including
   zero comments).
3. `classifyTerminalFailure` returns `{ shape: 'NOT_FOUND', notify: true }`
   for a `null` issue, and `{ shape: 'READ_FAILED', notify: true }` when
   `readFailed: true` is passed regardless of the `issue` argument.
4. `runTerminalFailureNotify` does **not** call `postSlackImpl` when the
   shape is `ESCALATED` (named mutation: delete the `!verdict.notify` guard
   in `runTerminalFailureNotify` → the `ESCALATED` test case starts calling
   `postSlackImpl`, red).
5. `runTerminalFailureNotify` **does** call `postSlackImpl` for `STRANDED`,
   `NOT_FOUND`, and a simulated Linear-read throw (`READ_FAILED`), in each
   case with `level: 'warn'` and a message containing the issue identifier
   and `runUrl`.
6. A Linear read failure does not prevent a Slack post (`gqlImpl` rejects →
   `notified: true`, message notes the read could not be confirmed) — this is
   the one behavior that has no analogue in the sibling file and is the
   named mutation for "silent-on-read-failure": revert step 2 above to
   `return early on throw` (matching the sibling's `READ_FAILED` early
   return) → this criterion's test goes from `notified: true` to
   `notified: false`, red.
7. `runTerminalFailureNotify` always resolves with `exitCode: 0`, including
   when `postSlackImpl` itself throws or returns `posted: false` — same
   contract as the sibling, asserted the same way (webhook-not-configured
   case explicitly, matching the sibling's own test for it).
8. The new workflow step is present, positioned immediately after the
   existing escalation step inside `assert-released`, gated on the identical
   `if: failure()`, and interpolates `client_payload.identifier` /
   `client_payload.title` only through `env:` (never directly into `run:`) —
   checked by reading the committed YAML, since this step cannot execute in
   CI (no `repository_dispatch` event fires on a feature branch).
9. All six gates pass: `tsc`, `vite build`, `format:check`, `eslint` (no
   warning-count rise from the branch-point baseline), full `vitest`, and
   `vitest run scripts/` (scoped — the only `src/`-independent surface this
   packet touches).
10. `scripts/linear-escalation-notify.mjs` and
    `scripts/linear-assert-released.mjs` are **byte-identical** to their
    `main`-branch-point versions (`git diff --stat` on this branch shows
    neither file).

## 5. Allowed Files

- `scripts/linear-terminal-failure-notify.mjs` (new)
- `scripts/linear-terminal-failure-notify.test.mjs` (new)
- `.github/workflows/claude-linear-dispatch.yml` (one new step; undeliverable
  from this container — preserve as a patch per "Two walls" #1)

No other file. In particular, `scripts/linear-escalation-notify.mjs` and
`scripts/linear-assert-released.mjs` are explicitly **forbidden** files for
this packet (criterion 10 makes that mechanically checkable).

## 6. Least confident decisions (item 19d)

1. **Cross-run redelivery dedup is deliberately out of scope, not solved.**
   If GitHub redelivers the originating webhook and a second real `work`/
   `assert-released` pair executes for the same identifier, this design
   posts a second Slack message. What would make this wrong: if the owner
   considers that a real, frequent problem today rather than a Phase-2
   controller responsibility — the plan (§5.1) explicitly assigns durable
   notification dedup to the not-yet-built controller's run store, and nothing
   in this repository persists notification state across workflow runs today
   (there is no store to persist it in without inventing a new Linear write
   path, which the issue's own sizing note rules out — "no product write
   path"). Re-check by asking whether redelivery has actually recurred; if it
   has, the fix is likely a job-level idempotency key, not a widening of this
   packet.
2. **The Slack message for `UNEXPECTED_STATE_*` is unreachable today and
   thinly tested.** What would make this wrong: if `linear-assert-released.mjs`
   ever grows a new failure state that is not `In Progress` — nothing in this
   packet's Allowed Files can cause that, but a future, unrelated change to
   `classifyState` could. Re-check this branch's test coverage if
   `classifyState` is ever touched.
3. **`RUN_URL` is constructed from `github.server_url`/`github.repository`/
   `github.run_id`, not read from an API.** What would make this wrong: if
   GitHub Enterprise or a repository rename makes that concatenation invalid
   in some deployment this repository doesn't currently have; both are GitHub
   context values, not attacker-controlled, and are exactly the components
   GitHub's own docs use to build a run URL, so this is believed safe but
   unverified against a real GHES instance.
4. **The new step always fetches Linear a second time** (once for the
   `assert-released` step, again here) rather than threading the first read's
   result through `GITHUB_OUTPUT`. What would make this wrong: if Linear's
   rate floor (`client.mjs`'s `RATE_FLOOR`) becomes a real constraint at this
   call volume — terminal failures are rare by definition, so this is
   believed negligible, but it is a real doubling of read volume on the one
   path this whole issue is about hardening.
5. **`postSlackImpl`'s message wording is not reviewed by anyone with Slack
   UX judgment** — it is plain warn-level text matching the sibling's
   register. What would make this wrong: if the owner wants terminal
   failures visually distinct from escalations in Slack (e.g. a different
   emoji/level) rather than sharing `warn`; nothing here blocks that as a
   follow-up.
