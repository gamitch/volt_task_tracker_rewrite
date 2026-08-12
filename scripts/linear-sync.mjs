#!/usr/bin/env node
// The explicit Linear closer (GAM-325 §3) -- the one write path this repo has
// against the live tracker. A PR merging into `main` declares the issue it
// closes on its own body (`Closes GAM-nnn`, line 1, lane A's parse); this
// script reads that declaration, checks a small precondition table, and
// either performs the close or produces a NAMED skip. Silence is the defect
// this build exists to remove -- every branch below either writes or logs a
// code string a human can grep for.
//
// ORDER OF OPERATIONS IS THE SAFETY, NOT A STYLE CHOICE (§3):
//   1. The PR number comes from the event payload ONLY -- nothing else in the
//      payload is trusted.
//   2. Everything else (`body`, `merged`, `base.ref`, `head.ref`,
//      `merge_commit_sha`) comes from an API FETCH of the PR, never from the
//      payload. This is what makes GitHub's self-contradictory `closed`
//      payload documentation irrelevant -- we never read `payload.merged`.
//   3-8. decide() below reproduces these steps as a pure function so the
//      whole behaviour table is testable without a network call.
//   9. Two Linear writes cannot be atomic, so the ORDER is the only safety
//      available: claim comment (durable record) FIRST, then `issueUpdate`,
//      then a READ-BACK of `issue.state.name`. A crash between 1 and 2 leaves
//      a comment pointing at an issue that is still open -- visible and
//      replayable, and the replay recognises its own claim. A mismatch after
//      the write is the one place this script is allowed to fail the run.
//
// SYNC_MODE defaults to `shadow` for anything other than the exact string
// `live` -- fail TOWARD shadow, so a typo can never write to the tracker.
// Shadow mode performs every read, computes the intended action, and writes
// nothing; it also compares its intended action against what the incumbent
// `merge -> Done` automation actually did, but ONLY while that automation is
// confirmed present (`assertIncumbent`/`hasIncumbentMergeToDone` below) --
// otherwise every declared merge would read as a false MISMATCH.
//
// `scripts/linear/client.mjs` is reused UNCHANGED and hardcodes
// `process.env.LINEAR_API_KEY`. This script's own secret is
// `LINEAR_SYNC_API_KEY` (§6.3's one-key-per-job discipline forbids reusing
// the export or dispatch keys) -- main() below is the one place that bridges
// the two names, and it does so only after confirming the new secret exists.
//
// Node ESM, `node:` builtins + global `fetch` only -- no npm dependencies,
// matching `linear-export.mjs` (`linear-export.yml` runs it with no `npm ci`).

import fs from 'node:fs';
import { gql } from './linear/client.mjs';
import { branchIssue, parseDeclaration } from './linear/declaration.mjs';
import { postSlack } from './linear/slack.mjs';

// ---------------------------------------------------------------------------
// SYNC_MODE -- fail toward shadow (D6)
// ---------------------------------------------------------------------------

/**
 * Resolve `SYNC_MODE`. Only the EXACT string `live` resolves to live; unset,
 * `shadow`, wrong case (`Live`), and garbage all resolve to `shadow`. This is
 * the fail-safe direction named in §3: a typo must never write to the
 * tracker.
 */
export function resolveSyncMode(env = process.env) {
  return env.SYNC_MODE === 'live' ? 'live' : 'shadow';
}

// ---------------------------------------------------------------------------
// Claim comment -- machine-readable, detected by its marker, never by prose
// ---------------------------------------------------------------------------

/** Never match this against prose -- the marker line is the only thing read. */
export const CLAIM_MARKER_RE = /<!-- linear-sync:claim pr=(\d+) run=(\d+) -->/;

/** `{ pr: number, run: string } | null` for one comment body. */
export function parseClaimMarker(commentBody) {
  if (typeof commentBody !== 'string') return null;
  const m = CLAIM_MARKER_RE.exec(commentBody);
  if (!m) return null;
  return { pr: Number(m[1]), run: m[2] };
}

/** Every claim marker found across an issue's comments, in comment order. */
export function extractClaims(comments) {
  return (comments ?? [])
    .map((c) => parseClaimMarker(c.body))
    .filter((c) => c !== null);
}

/**
 * The claim comment's exact shape (§3). `pr=` in the marker is what
 * distinguishes ALREADY_DONE from DUPLICATE_CLOSE_CLAIM, and same-PR resume
 * from STALE_CLAIM -- so the marker line is never decorative.
 */
export function buildClaimComment({ prNumber, runId, prUrl, mergeSha, runUrl }) {
  return [
    `<!-- linear-sync:claim pr=${prNumber} run=${runId} -->`,
    `**Closed by [#${prNumber}](${prUrl}) on merge** — \`${mergeSha}\` → \`Done\`.`,
    `Mechanism: \`.github/workflows/linear-sync.yml\` / \`scripts/linear-sync.mjs\` (run [${runId}](${runUrl})).`,
    `This transition is attributed in Linear's history to the API key's owner, not to a bot. This comment is the record that it was an automation.`,
  ].join('\n');
}

/** Audit comment for the "closed, not merged" row -- no state move, ever. */
export function buildClosedWithoutMergeComment({ prNumber, prUrl }) {
  return `PR closed without merge — [#${prNumber}](${prUrl}). No state change made.`;
}

/** Audit comment for UNEXPECTED_STATE -- names the state, asks a human to decide. */
export function buildUnexpectedStateComment({ prNumber, prUrl, issueId, stateName }) {
  return (
    `[#${prNumber}](${prUrl}) declares this issue closed on merge, but ${issueId} is in ` +
    `"${stateName}", not In Progress or In Review. No move was made -- a human decides.`
  );
}

// ---------------------------------------------------------------------------
// decide() -- the whole precondition table, pure and network-free (§3, AC1)
// ---------------------------------------------------------------------------

/**
 * The full order of operations, steps 3-8, as one pure function. Every
 * return carries `code` (the specific, verbatim-from-spec string a test
 * asserts on) and `slackCode` (usually identical; HALF_DECLARATION and
 * PLACEHOLDER report as AMBIGUOUS_DECLARATION on the Slack line while
 * keeping their specific code in the log, per §3 -- "the sync's table has no
 * separate row for them and must not invent a state move for either").
 *
 * `issue` may be `null` when it was never fetched (not needed for the code
 * path) or genuinely not found (UNKNOWN_ISSUE). `claims` is the list already
 * extracted from the issue's comments via `extractClaims` -- decide() never
 * touches raw comment bodies.
 */
export function decide({ pr, issue, claims = [] }) {
  // Step 3: the trigger filter's braces are belt-and-suspenders, not the
  // only guard -- a stacked child PR merging into its parent must not close
  // anything (§3's rule surfaces those rows only in the reconciliation sweep).
  if (pr.base?.ref !== 'main') {
    return {
      code: 'NON_MAIN_BASE',
      slackCode: 'NON_MAIN_BASE',
      action: 'none',
      issue: null,
      slackLevel: 'info',
      detail: `base is "${pr.base?.ref}", not "main" -- no action.`,
    };
  }

  // Step 4: closed, not merged. No state change ever; an audit comment is
  // posted (live mode only) if -- and only if -- a valid declaration exists.
  if (pr.merged !== true) {
    const declaration = parseDeclaration(pr.body);
    if (declaration.ok) {
      return {
        code: 'CLOSED_WITHOUT_MERGE',
        slackCode: 'CLOSED_WITHOUT_MERGE',
        action: 'audit-comment',
        issue: declaration.issue,
        slackLevel: 'info',
        detail: `PR #${pr.number} closed without merge; declared ${declaration.issue} -- audit comment only, no state move.`,
      };
    }
    return {
      code: 'CLOSED_WITHOUT_MERGE',
      slackCode: 'CLOSED_WITHOUT_MERGE',
      action: 'none',
      issue: null,
      slackLevel: 'info',
      detail: `PR #${pr.number} closed without merge; no declaration -- nothing to do.`,
    };
  }

  // Step 5: parse the declaration.
  const declaration = parseDeclaration(pr.body);
  if (!declaration.ok) {
    if (declaration.code === 'NO_DECLARATION') {
      return {
        code: 'NO_DECLARATION',
        slackCode: 'NO_DECLARATION',
        action: 'none',
        issue: null,
        slackLevel: 'info',
        detail: 'no line-1 declaration -- legitimate for mention/infra/partial-work PRs.',
      };
    }
    if (declaration.code === 'AMBIGUOUS_DECLARATION') {
      return {
        code: 'AMBIGUOUS_DECLARATION',
        slackCode: 'AMBIGUOUS_DECLARATION',
        action: 'none',
        issue: null,
        slackLevel: 'warn',
        detail: declaration.detail,
      };
    }
    // HALF_DECLARATION or PLACEHOLDER: §3 -- "the sync's table has no
    // separate row for them and must not invent a state move for either."
    // Reported as AMBIGUOUS_DECLARATION on the Slack line; the specific code
    // stays in `code` for the log.
    return {
      code: declaration.code,
      slackCode: 'AMBIGUOUS_DECLARATION',
      action: 'none',
      issue: null,
      slackLevel: 'warn',
      detail:
        declaration.detail ??
        `${declaration.code}: line 1 is canonical in shape but names the placeholder GAM-000.`,
    };
  }

  // Step 6: branch consistency (the #131 mismatch class).
  const declaredIssue = declaration.issue;
  const branchDeclared = branchIssue(pr.head?.ref);
  if (branchDeclared !== null && branchDeclared !== declaredIssue) {
    return {
      code: 'DECLARATION_MISMATCH',
      slackCode: 'DECLARATION_MISMATCH',
      action: 'none',
      issue: declaredIssue,
      slackLevel: 'warn',
      detail: `branch "${pr.head?.ref}" names ${branchDeclared} but the body declares ${declaredIssue} -- no move.`,
    };
  }

  // Step 7/8: the Linear issue and the precondition table.
  if (!issue) {
    return {
      code: 'UNKNOWN_ISSUE',
      slackCode: 'UNKNOWN_ISSUE',
      action: 'none',
      issue: declaredIssue,
      slackLevel: 'warn',
      detail: `${declaredIssue} declared but not found in Linear -- no move.`,
    };
  }

  // ARCHIVED is checked before state-specific branching -- it can pair with
  // any state, and §3 says "info if Done, warn otherwise" regardless of
  // which other row would otherwise have matched.
  if (issue.archivedAt) {
    const done = issue.state?.name === 'Done';
    return {
      code: 'ARCHIVED',
      slackCode: 'ARCHIVED',
      action: 'none',
      issue: declaredIssue,
      slackLevel: done ? 'info' : 'warn',
      detail: `${declaredIssue} is archived (state "${issue.state?.name}") -- no move.`,
    };
  }

  const stateName = issue.state?.name;
  const ownClaim = claims.find((c) => c.pr === pr.number) ?? null;
  const otherClaim = claims.find((c) => c.pr !== pr.number) ?? null;

  if (stateName === 'Done') {
    if (ownClaim) {
      return {
        code: 'ALREADY_DONE',
        slackCode: 'ALREADY_DONE',
        action: 'none',
        issue: declaredIssue,
        slackLevel: 'info',
        detail: `${declaredIssue} already Done, claimed by this PR (run ${ownClaim.run}) -- benign re-delivery.`,
      };
    }
    return {
      code: 'DUPLICATE_CLOSE_CLAIM',
      slackCode: 'DUPLICATE_CLOSE_CLAIM',
      action: 'none',
      issue: declaredIssue,
      slackLevel: 'warn',
      detail: `${declaredIssue} already Done, but not claimed by PR #${pr.number} -- no move, a human decides.`,
    };
  }

  if (stateName === 'In Progress' || stateName === 'In Review') {
    // A claim from a run that never completed its close. Same PR: its own
    // claim is not an obstacle -- resume. Different PR: no move, name it.
    if (otherClaim) {
      return {
        code: 'STALE_CLAIM',
        slackCode: 'STALE_CLAIM',
        action: 'none',
        issue: declaredIssue,
        slackLevel: 'warn',
        stale: otherClaim,
        detail: `${declaredIssue} carries an unfinished claim from PR #${otherClaim.pr} (run ${otherClaim.run}) -- no move, a human adjudicates.`,
      };
    }
    if (ownClaim) {
      return {
        code: 'RESUME_CLOSE',
        slackCode: 'RESUME_CLOSE',
        action: 'close',
        issue: declaredIssue,
        slackLevel: null,
        resumed: true,
        detail: `${declaredIssue} carries this PR's own unfinished claim (run ${ownClaim.run}) -- resuming, not re-claiming.`,
      };
    }
    return {
      code: 'CLOSE',
      slackCode: 'CLOSE',
      action: 'close',
      issue: declaredIssue,
      slackLevel: null,
      resumed: false,
      detail: `${declaredIssue} in "${stateName}" -- claim, close, read back.`,
    };
  }

  // Any other state (Backlog, Todo, Canceled...).
  return {
    code: 'UNEXPECTED_STATE',
    slackCode: 'UNEXPECTED_STATE',
    action: 'audit-comment',
    issue: declaredIssue,
    slackLevel: 'warn',
    detail: `${declaredIssue} is in "${stateName}", not In Progress/In Review/Done -- no move, audit comment, a human decides.`,
  };
}

// ---------------------------------------------------------------------------
// Shadow-mode history reconstruction (§3, gate round 1 F4)
// ---------------------------------------------------------------------------

/**
 * Drop non-state edits (`fromState: null, toState: null`) from a raw
 * `history` connection. The live probe against GAM-303 (pasted in the
 * worker's report) confirmed these entries exist interleaved with real
 * transitions and are NOT newest-first-filtered by the API itself.
 */
export function filterStateChanges(historyNodes) {
  return (historyNodes ?? []).filter((n) => n.fromState !== null && n.toState !== null);
}

/**
 * The incumbent `merge -> Done` automation's transition for one merge, or
 * `null` if none matches. `history` is asserted newest-first by the probe;
 * this function does not depend on that order, only on filtering plus a
 * window match, so it is order-independent by construction.
 *
 * The window is 120s (LCD 4): `merge -> Done` fires ~2s after merge, and the
 * comparison is against a HISTORY ENTRY's timestamp, not this run's own
 * latency -- so 120s is generous room around a ~2s event, not a race against
 * how long the Actions run itself takes to start.
 */
export function reconstructAutomationTransition(historyNodes, mergedAt, windowMs = 120_000) {
  const mergedMs = new Date(mergedAt).getTime();
  const candidates = filterStateChanges(historyNodes).filter((n) => n.toState.name === 'Done');
  return (
    candidates.find((n) => Math.abs(new Date(n.createdAt).getTime() - mergedMs) <= windowMs) ??
    null
  );
}

/**
 * Shadow-only (GAM-335): `decide()` must be handed the issue's state
 * immediately BEFORE any merge-coincident automation transition, not the
 * live post-automation read -- otherwise an ordinary declared merge always
 * looks like `DUPLICATE_CLOSE_CLAIM` against the incumbent's own already-
 * applied `Done`. If reconstruction finds no merge-coincident transition,
 * the live read already IS the prior state and `issue` is returned
 * unchanged (this is what keeps the already-`Done` case degenerate-MATCH
 * rather than broken). Never call this for live mode: after cutover the
 * incumbent is gone and the live read is the true precondition.
 */
export function resolveShadowIssueState(issue, historyNodes, mergedAt) {
  if (!issue) return issue;
  const transition = reconstructAutomationTransition(historyNodes, mergedAt);
  if (!transition) return issue;
  return { ...issue, state: { name: transition.fromState.name } };
}

/**
 * §3 / gate round 1 F2: the shadow window is only meaningful while the
 * incumbent `merge -> Done` automation stays enabled. Read once at startup;
 * `gitAutomationStates` shape confirmed live (query pasted in the worker's
 * report): `{ event, targetBranch, state{ name type } }`.
 */
export function hasIncumbentMergeToDone(gitAutomationStateNodes) {
  return (gitAutomationStateNodes ?? []).some((n) => n.event === 'merge' && n.state?.name === 'Done');
}

/**
 * The shadow MATCH/MISMATCH/INCUMBENT_DISABLED decision. A void run (the
 * incumbent is disabled) emits NEITHER MATCH nor MISMATCH -- the caller must
 * not fold `void: true` results into any consecutive-MATCH counter.
 */
export function evaluateShadowRun({ incumbentEnabled, intendedWouldClose, automationTransition }) {
  if (!incumbentEnabled) {
    return { code: 'INCUMBENT_DISABLED', void: true, automationClosed: null };
  }
  const automationClosed = automationTransition !== null && automationTransition !== undefined;
  return {
    code: intendedWouldClose === automationClosed ? 'MATCH' : 'MISMATCH',
    void: false,
    automationClosed,
  };
}

// ---------------------------------------------------------------------------
// Timeouts -- every fetch is bounded, and a timeout is a NAMED failure (§3)
// ---------------------------------------------------------------------------

/** Distinguishes a bounded timeout from any other network failure in logs/tests. */
export class SyncTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SyncTimeoutError';
    this.code = 'FETCH_TIMEOUT';
  }
}

/**
 * Wrap one `fetch`-shaped call with a 20s bound (§3) and turn an abort into a
 * named `SyncTimeoutError` rather than letting an AbortError surface raw or,
 * worse, an unhandled rejection escape the caller. `fetchImpl` is injected so
 * tests never touch the network or the real `AbortSignal.timeout` clock.
 */
export async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 20_000) {
  try {
    return await fetchImpl(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new SyncTimeoutError(`fetch timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// I/O -- everything below this line touches the network. Not unit-tested
// (AC7: no network call in any test); exercised only by a real run.
// ---------------------------------------------------------------------------

/** Step 1: resolve the PR number from the event ONLY. */
export function resolvePrNumber(env, readFile = fs.readFileSync) {
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    const n = Number(env.PR_NUMBER);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const eventPath = env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  const payload = JSON.parse(readFile(eventPath, 'utf8'));
  return payload.pull_request?.number ?? payload.number ?? null;
}

/** Step 2: API-fetch the PR. Everything downstream reads this, never the payload. */
async function fetchPR(env, number, fetchImpl = fetch) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/pulls/${number}`;
  const res = await fetchWithTimeout(fetchImpl, url, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} fetching PR #${number}: ${await res.text()}`);
  }
  return res.json();
}

function splitIdentifier(identifier) {
  const m = /^([A-Za-z]+)-(\d+)$/.exec(identifier);
  if (!m) throw new Error(`Not a valid Linear identifier: ${identifier}`);
  return { teamKey: m[1], number: Number(m[2]) };
}

const ISSUE_QUERY = `
  query($number: Float!, $teamKey: String!) {
    issues(filter: { number: { eq: $number }, team: { key: { eq: $teamKey } } }, first: 1) {
      nodes {
        id
        identifier
        archivedAt
        state { name }
        comments(first: 50) { nodes { body } }
      }
    }
  }
`;

async function fetchIssue(identifier) {
  const { teamKey, number } = splitIdentifier(identifier);
  const { data } = await gql(ISSUE_QUERY, { number, teamKey });
  return data.issues.nodes[0] ?? null;
}

const HISTORY_QUERY = `
  query($id: String!) {
    issue(id: $id) {
      history(first: 50) {
        nodes { createdAt fromState { name } toState { name } actor { name } }
      }
    }
  }
`;

async function fetchIssueHistory(issueId) {
  const { data } = await gql(HISTORY_QUERY, { id: issueId });
  return data.issue.history.nodes;
}

// Shape confirmed live against this workspace -- see the worker report for
// the raw response pasted alongside the GAM-303 history probe.
const AUTOMATION_QUERY = `{
  teams(first:50){
    nodes{
      key
      gitAutomationStates(first:30){
        nodes{ event targetBranch{ id branchPattern isRegex } state{ name type } }
      }
    }
  }
}`;

async function fetchGitAutomationStates(teamKey) {
  const { data } = await gql(AUTOMATION_QUERY);
  const team = data.teams.nodes.find((t) => t.key === teamKey);
  return team?.gitAutomationStates?.nodes ?? [];
}

async function postComment(issueId, body) {
  const { data } = await gql(
    `mutation($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id } } }`,
    { input: { issueId, body } },
  );
  if (!data.commentCreate.success) throw new Error('commentCreate did not report success.');
  return data.commentCreate.comment;
}

async function resolveStateId(teamKey, stateName) {
  const { data } = await gql(
    `query($teamKey: String!) { teams(filter: { key: { eq: $teamKey } }, first: 1) { nodes { states(first: 50) { nodes { id name } } } } }`,
    { teamKey },
  );
  const states = data.teams.nodes[0]?.states.nodes ?? [];
  const found = states.find((s) => s.name === stateName);
  if (!found) throw new Error(`No "${stateName}" state on team ${teamKey}.`);
  return found.id;
}

async function updateIssueState(issueId, stateId) {
  const { data } = await gql(
    `mutation($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success } }`,
    { id: issueId, input: { stateId } },
  );
  if (!data.issueUpdate.success) throw new Error('issueUpdate did not report success.');
}

async function readBackStateName(issueIdentifier) {
  const issue = await fetchIssue(issueIdentifier);
  return issue?.state?.name ?? null;
}

/**
 * Shadow-only: compare the intended action against the incumbent
 * automation's observed transition, per §3. Reads only; never writes.
 * Skipped entirely when there is nothing to compare (not a declared merge
 * into main).
 */
async function runShadowComparison({ env, pr, decision, prNumber }) {
  if (pr.base?.ref !== 'main' || pr.merged !== true || !decision.issue) return;

  const teamKey = splitIdentifier(decision.issue).teamKey;
  const automationStates = await fetchGitAutomationStates(teamKey);
  const incumbentEnabled = hasIncumbentMergeToDone(automationStates);

  if (!incumbentEnabled) {
    console.log(
      `INCUMBENT_DISABLED: team ${teamKey} has no merge->Done gitAutomationStates entry -- comparison void, neither MATCH nor MISMATCH.`,
    );
    await postSlack(env.SLACK_WEBHOOK_URL, {
      level: 'warn',
      title: `INCUMBENT_DISABLED: shadow comparison void for PR #${prNumber}`,
      lines: [
        `Team ${teamKey}'s merge -> Done automation is not present. This run does not count toward the consecutive-MATCH exit criterion.`,
      ],
    });
    return;
  }

  const issue = await fetchIssue(decision.issue);
  if (!issue) return;
  const history = await fetchIssueHistory(issue.id);
  const automationTransition = reconstructAutomationTransition(history, pr.merged_at);
  const intendedWouldClose = decision.action === 'close';
  const result = evaluateShadowRun({ incumbentEnabled, intendedWouldClose, automationTransition });

  console.log(
    `${result.code}: shadow intended ${intendedWouldClose ? 'close' : decision.code} vs automation ${
      automationTransition ? 'closed' : 'no-op'
    }.`,
  );
  await postSlack(env.SLACK_WEBHOOK_URL, {
    level: result.code === 'MISMATCH' ? 'warn' : 'info',
    title: `${result.code}: PR #${prNumber} -> ${decision.issue}`,
    lines: [
      `shadow: ${intendedWouldClose ? 'would close' : decision.code}; automation: ${
        automationTransition ? 'closed' : 'no-op'
      }.`,
    ],
  });
}

async function main() {
  const env = process.env;

  // Missing key is a named, loud, exit-0 skip -- not a crash. §3: this is
  // what makes fork runs (no secrets delivered) and a misconfigured deploy
  // fail LEGIBLY rather than exploding a required check.
  if (!env.LINEAR_SYNC_API_KEY) {
    console.log('NO_SYNC_KEY: LINEAR_SYNC_API_KEY is not set -- nothing to do, exiting 0.');
    return;
  }
  // client.mjs is reused UNCHANGED and hardcodes process.env.LINEAR_API_KEY.
  // This is the one and only place that bridges the new, write-scoped secret
  // into the name client.mjs expects.
  process.env.LINEAR_API_KEY = env.LINEAR_SYNC_API_KEY;

  const syncMode = resolveSyncMode(env);
  console.log(
    `SYNC_MODE resolved to "${syncMode}" (raw: ${JSON.stringify(env.SYNC_MODE ?? null)}).`,
  );

  const prNumber = resolvePrNumber(env);
  if (!prNumber) {
    console.error('Could not resolve a PR number from the event or PR_NUMBER -- exiting 1.');
    process.exitCode = 1;
    return;
  }

  const pr = await fetchPR(env, prNumber);

  let issue = null;
  let claims = [];
  if (pr.base?.ref === 'main' && pr.merged === true) {
    const declaration = parseDeclaration(pr.body);
    if (declaration.ok) {
      issue = await fetchIssue(declaration.issue);
      if (issue) claims = extractClaims(issue.comments?.nodes ?? []);
    }
  }

  // Shadow-only (GAM-335): decide() must see the reconstructed prior state,
  // not the live post-automation read. Live mode passes `issue` through
  // unchanged -- after cutover the incumbent is gone and the live read is
  // the true precondition.
  let decideIssue = issue;
  if (syncMode === 'shadow' && issue) {
    const history = await fetchIssueHistory(issue.id);
    decideIssue = resolveShadowIssueState(issue, history, pr.merged_at);
  }

  const decision = decide({ pr, issue: decideIssue, claims });
  console.log(
    `decide() -> ${decision.code}${
      decision.code !== decision.slackCode ? ` (Slack: ${decision.slackCode})` : ''
    }: ${decision.detail}`,
  );

  const runId = env.GITHUB_RUN_ID ?? 'local';
  const prUrl = `https://github.com/${env.GITHUB_REPOSITORY}/pull/${prNumber}`;
  const runUrl = `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${runId}`;

  if (syncMode === 'shadow') {
    await runShadowComparison({ env, pr, decision, prNumber });
    await postSlack(env.SLACK_WEBHOOK_URL, {
      level: decision.slackLevel ?? 'info',
      title: `[shadow] ${decision.slackCode}: PR #${prNumber}${decision.issue ? ` -> ${decision.issue}` : ''}`,
      lines: [decision.detail],
    });
    return;
  }

  // Live mode from here down -- the only branch that ever writes to Linear.

  if (decision.action === 'audit-comment' && decision.issue) {
    if (!issue) issue = await fetchIssue(decision.issue);
    if (issue) {
      const body =
        decision.code === 'CLOSED_WITHOUT_MERGE'
          ? buildClosedWithoutMergeComment({ prNumber, prUrl })
          : buildUnexpectedStateComment({
              prNumber,
              prUrl,
              issueId: decision.issue,
              stateName: issue.state?.name,
            });
      await postComment(issue.id, body);
    } else {
      console.error(`Could not post audit comment: ${decision.issue} not found in Linear.`);
    }
  }

  if (decision.action === 'close' && issue) {
    if (!decision.resumed) {
      const claimBody = buildClaimComment({
        prNumber,
        runId,
        prUrl,
        mergeSha: (pr.merge_commit_sha ?? '').slice(0, 7),
        runUrl,
      });
      await postComment(issue.id, claimBody);
    }

    const teamKey = splitIdentifier(decision.issue).teamKey;
    const stateId = await resolveStateId(teamKey, 'Done');
    await updateIssueState(issue.id, stateId);

    // The one place this script is allowed to fail the run (§3).
    const readBack = await readBackStateName(decision.issue);
    if (readBack !== 'Done') {
      console.error(
        `READ-BACK MISMATCH: issueUpdate reported success but ${decision.issue} reads back as "${readBack}", not "Done". Failing the run.`,
      );
      await postSlack(env.SLACK_WEBHOOK_URL, {
        level: 'warn',
        title: `READ_BACK_MISMATCH: ${decision.issue} did not confirm Done`,
        lines: [`PR #${prNumber}, run ${runId}. Reads back as "${readBack}".`],
      });
      process.exitCode = 1;
      return;
    }

    await postSlack(env.SLACK_WEBHOOK_URL, {
      level: 'ok',
      title: `${decision.issue} -> Done`,
      lines: [`Closed by PR #${prNumber} (${decision.code}).`],
    });
    return;
  }

  await postSlack(env.SLACK_WEBHOOK_URL, {
    level: decision.slackLevel ?? 'info',
    title: `${decision.slackCode}: PR #${prNumber}${decision.issue ? ` -> ${decision.issue}` : ''}`,
    lines: [decision.detail],
  });
}

// Only run when invoked directly, so this module is import-safe for the test
// file (which imports the pure functions and nothing else -- AC7, no network
// call in any test).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`\n${err.message}`);
    process.exit(1);
  });
}
