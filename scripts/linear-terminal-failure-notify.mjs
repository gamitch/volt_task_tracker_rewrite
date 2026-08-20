// Tells the human owner, in Slack, about a terminal CI failure that the
// escalation-notify sibling does not cover: a timeout, a crash, or a
// cancellation, none of which leave the "**Escalating ..." comment
// `linear-escalation-notify.mjs` keys off.
//
// WHY THIS EXISTS. Plan §5.7/§5.1 (Phase 1) names this: "notify on every
// terminal failure", not only the comment-marker subset the sibling already
// covers (`2026-08-15-durable-multi-agent-execution-plan.md:577`). The
// sibling stays silent for the other two benign shapes
// `linear-assert-released.mjs` names (a deliberate near-wall-clock stop, a
// Linear automation moving the row back), and for a `work` job that itself
// failed or was cancelled while leaving the issue looking released.
//
// WHAT THIS DOES NOT REPLACE. `linear-escalation-notify.mjs` is unchanged and
// is still the thing that tells the owner about an escalation. This script
// imports its `detectEscalation`/`fetchIssueForEscalation` and
// `linear-assert-released.mjs`'s `classifyState`/`isIssueNotFoundError`,
// read-only, so "is this the state assert-released itself fails on" and "did
// the newest comment escalate" are always answered by the same functions
// that produced the original verdict, never a reimplementation that could
// drift from them.
//
// THE THIRD PARAMETER, `assertOutcome`. The "Assert the run released its
// claim" step goes red for three reasons — `In Progress` (state), NOT FOUND,
// or either UNDETERMINED shape after retries — and only the first of those is
// something this script's own second read can still see. Without
// `assertOutcome`, a second read that happens to look fine (a transient error
// cleared, a null state reads as '') falls through to NO_FAILURE and reports
// nothing about a red job — the exact defect this issue exists to close,
// reproduced one layer deeper. `assertOutcome` is `steps.assert.outcome` from
// the SAME job, read through `env:` in the workflow.
//
// NEVER A GATE. Exits 0 unconditionally, same contract as the sibling: a
// Slack outage, an unset webhook, or a Linear read failure must never be why
// a run is reported as failed.
//
// Usage:
//   LINEAR_API_KEY=lin_api_… SLACK_WEBHOOK_URL=https://… \
//     node scripts/linear-terminal-failure-notify.mjs GAM-404 "Issue title" \
//     failure failure https://github.com/owner/repo/actions/runs/123

import { detectEscalation, fetchIssueForEscalation } from './linear-escalation-notify.mjs';
import { classifyState, isIssueNotFoundError } from './linear-assert-released.mjs';

async function defaultGql(query, variables) {
  const { gql } = await import('./linear/client.mjs');
  return gql(query, variables);
}

async function defaultPostSlack(...args) {
  const { postSlack } = await import('./linear/slack.mjs');
  return postSlack(...args);
}

/**
 * Pure. `issue` is the shape `detectEscalation` takes (`null` when Linear
 * said "not found"). `readFailed` distinguishes a read that threw for any
 * other reason (Linear could not be asked at all) -- the two need different
 * Slack wording.
 *
 * `workResult` is `needs.work.result` (`'failure'`, `'cancelled'`,
 * `'success'`, or `undefined` outside CI).
 *
 * `assertOutcome` is `steps.assert.outcome` from the SAME job -- the Assert
 * step goes red for THREE reasons, only one of which is "still In Progress":
 * `linear-assert-released.mjs` also exits 1 on NOT FOUND (:219) and on
 * either UNDETERMINED shape (:226, :232). On this script's own second read
 * those can look fine -- a transient error clears, a null state reads as
 * '' -- and without `assertOutcome` the function would fall through to
 * NO_FAILURE and tell nobody about a red job.
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

  // The Assert step went red for a reason this second read cannot see -- NOT
  // FOUND, or either UNDETERMINED shape that has since cleared. Notify with
  // what little is known rather than fall through to silence. This is what
  // makes NO_FAILURE genuinely unreachable through the workflow's `if:`.
  if (assertOutcome === 'failure') return { shape: 'ASSERT_FAILED', notify: true };

  // Nothing wrong: Assert passed, `work` did not fail or get cancelled.
  // Reachable only when this function is called directly (tests, or a
  // future caller), never through the workflow step below.
  return { shape: 'NO_FAILURE', notify: false };
}

const SHAPE_SENTENCES = {
  STRANDED:
    'The issue is still In Progress: the run ended without releasing its claim.',
  WORK_JOB_FAILURE: 'The run job itself failed.',
  WORK_JOB_CANCELLED: 'The run job was cancelled.',
  ASSERT_FAILED:
    'The Assert step failed for a reason no longer visible on this second read ' +
    '(NOT FOUND, or an UNDETERMINED read that has since cleared). The run URL ' +
    'below is the only place the original reason survives.',
  NOT_FOUND: 'No issue with that identifier exists in Linear.',
  READ_FAILED: 'Linear could not be read to check this run.',
};

/**
 * Reads one issue, classifies the failure, and posts to Slack only when the
 * verdict says to. Always resolves; never throws; exit code is always 0.
 */
export async function runTerminalFailureNotify({
  identifier,
  title,
  runUrl,
  workResult,
  assertOutcome,
  env = process.env,
  gqlImpl = defaultGql,
  postSlackImpl = defaultPostSlack,
  log = console.log,
} = {}) {
  if (!identifier) {
    log('No issue identifier given; nothing to check.');
    return { exitCode: 0, notified: false, reason: 'NO_IDENTIFIER' };
  }

  let issue = null;
  let readFailed = false;
  try {
    issue = await fetchIssueForEscalation(identifier, { gqlImpl });
  } catch (err) {
    // Unlike the sibling, a read failure here must still attempt to notify
    // (with degraded detail), or this script reproduces the exact silence
    // the issue is about, one layer deeper.
    if (isIssueNotFoundError(err)) {
      issue = null;
      readFailed = false;
    } else {
      readFailed = true;
    }
    log(`Could not read ${identifier}: ${err instanceof Error ? err.message : String(err)}`);
  }

  const verdict = classifyTerminalFailure(issue, { readFailed, workResult, assertOutcome });

  if (!verdict.notify) {
    log(`${identifier}: no terminal-failure notification needed (${verdict.shape}).`);
    return { exitCode: 0, notified: false, reason: verdict.shape };
  }

  const issueTitle = issue?.title ?? title;
  const lines = [
    `*${identifier} — ${issueTitle}*`,
    '',
    SHAPE_SENTENCES[verdict.shape],
  ];
  if (verdict.shape === 'READ_FAILED') {
    lines.push(
      '',
      'This may duplicate an escalation ping already sent — the read that ' +
        'would have told us otherwise also failed.',
    );
  }
  lines.push('', `Run: ${runUrl}`);
  if (issue?.url) {
    lines.push(`Issue: ${issue.url}`);
  }

  let posted;
  try {
    posted = await postSlackImpl(env.SLACK_WEBHOOK_URL, {
      level: 'warn',
      title: `${identifier} — terminal failure (${verdict.shape})`,
      lines,
    });
  } catch (err) {
    // Never a gate: a throwing postSlackImpl must not turn this exit
    // non-zero either.
    log(`Slack post threw: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 0, notified: false, reason: 'NOT_POSTED_THREW' };
  }

  if (posted && posted.posted === false) {
    log(`Slack not posted: ${posted.reason}`);
    return { exitCode: 0, notified: false, reason: `NOT_POSTED_${posted.reason}` };
  }

  log(`${identifier}: terminal failure (${verdict.shape}) notified via Slack.`);
  return { exitCode: 0, notified: true, reason: verdict.shape };
}

async function main() {
  const [identifier, title, workResult, assertOutcome, runUrl] = process.argv.slice(2);
  const { exitCode } = await runTerminalFailureNotify({
    identifier,
    title,
    runUrl,
    workResult,
    assertOutcome,
  });
  process.exitCode = exitCode;
}

// Only run when invoked directly, so the test file can import the exports.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
