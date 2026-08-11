#!/usr/bin/env node
// Post-run assertion: did a dispatched agent release its claim on the Linear
// issue it was working, or is the issue still `In Progress` with the chain
// unfinished and nobody told to look?
//
// THE DEFECT THIS CATCHES (GAM-314). A dispatched run whose agent ends its
// turn with a subagent still in flight returns normally, so
// `claude-code-action` reports success, the job goes green, and the issue is
// left in `In Progress` with the chain unfinished. Measured four times (runs
// 31354278407, 31385764526, 31514339272, 31523233268), none near a turn or
// clock budget. Nothing else in the workflow reports that condition — a green
// job is the only visible signal, and it is the wrong one.
//
// THIS IS NOT A TURN-BUDGET FIX. It changes nothing about when a run stops;
// it only tells the truth about where the issue was left when it did. The
// four measured instances above all happened well inside `--max-turns` and
// `timeout-minutes`, so raising either would not have caught them.
//
// THE RULE IS A DENYLIST OF ONE, NOT AN ALLOWLIST. Only `In Progress` fails.
// Every other named state, and any name this assertion has never seen, passes
// — a state rename or a new column must not turn this into a workflow that
// blocks on states it does not understand. `Todo` in particular is a PASS: a
// correct refusal to proceed (the dispatch prompt in
// `.github/workflows/claude-linear-dispatch.yml` explicitly invites one) must
// not read as a failure, or the assertion would punish honesty.
//
// `IN PROGRESS` FAILS EVEN WHEN THE RUN STOPPED DELIBERATELY. Three benign
// shapes end with an issue legitimately `In Progress`, and all three still
// FAIL here, because in every one the chain is unfinished and nothing else
// will say so:
//   1. The run itself stopped deliberately near the wall clock (the prompt at
//      claude-linear-dispatch.yml:197-199 tells it to "stop, push what
//      exists, and say so" — which ends the job green with the issue still
//      claimed).
//   2. A premise gate or worker/checker loop was escalated to the human owner
//      (constitution.md's premise-gate cap and Loop Limit) — neither gives an
//      escalated run anywhere else to put the issue.
//   3. A Linear automation moved it back on its own (the live "On open in
//      coding tool -> started" automation measured moving GAM-304 from
//      `In Review` back to `In Progress` with `botActor: GitHub/integration`).
// The wording below names all three so the first person to hit a benign case
// does not conclude the check is broken and delete it.
//
// WHAT THIS DOES NOT DO. It never writes to Linear — read-only, always. And
// it does not (and cannot) see a wrong-but-plausible YAML edit to this
// workflow, or catch the `Todo` self-re-dispatch incentive this assertion
// creates (an unfinished agent can reach a green job by moving the issue back
// to `Todo` itself, which fires a fresh dispatch per filter.ts rule 4 rather
// than resting). Both gaps are named rather than silently accepted: GAM-326
// (the `Todo` incentive) and GAM-327 (the untested workflow YAML).
//
// Usage:
//   LINEAR_API_KEY=lin_api_… node scripts/linear-assert-released.mjs GAM-314

import fs from 'node:fs';
import { gql } from './linear/client.mjs';

/** `issue(id: …)` accepts the human identifier and raises a distinguishable
 * "Entity not found: Issue" for a junk one. `issues(filter: …)` was measured
 * to return an empty node list instead for the same input, which makes the
 * not-found case unreachable through that shape — so this is the only field
 * that lets criterion 3's "not found" and "undetermined" stay two different
 * answers. */
const QUERY = `
  query($identifier: String!) {
    issue(id: $identifier) {
      identifier
      state { name }
    }
  }
`;

/** A network blip should not turn one dispatch into a red run; a rate floor
 * or a definite API answer should not burn three attempts finding that out
 * again. Kept small on purpose — see `isRetryableError` below. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 300;

// ---------------------------------------------------------------------------
// classifyState — pure, synchronous, no network. The whole point of the row.
// ---------------------------------------------------------------------------
// The team has exactly seven states (enumerated live, packet gate round 1),
// and only one of them is a failure. Matched case-insensitively and on
// trimmed whitespace — the same shape `filter.ts` uses for its own state
// match (`filter.ts:273`) — but never on the state `type`: `In Review` and
// `In Progress` are both type `started`, so type cannot tell them apart
// (verified live).

const IN_PROGRESS_REASON =
  'is still In Progress: the run ended without releasing its claim. This can ' +
  'also be a run that stopped deliberately near the wall clock, one escalated ' +
  'to the owner under item 19a or the Loop Limit, or a row moved back by a ' +
  'Linear automation. In every case it still needs a human — the chain is ' +
  'unfinished and nothing else will say so.';

/**
 * The one decision this file exists to make. Takes a workflow-state NAME
 * (never a `type`) and returns `{ released, reason }` — never a bare boolean,
 * so every outcome carries a machine-readable explanation (the same shape
 * `supabase/functions/linear-dispatch/filter.ts` uses for `decideDispatch`).
 *
 * `released: false` only for `In Progress`. Everything else — the six other
 * named states, and any name this has never seen — is `released: true`: a
 * denylist of one, not an allowlist, so a state rename or a new column does
 * not silently start blocking dispatch runs.
 */
export function classifyState(stateName) {
  const trimmed = String(stateName ?? '').trim();
  const normalized = trimmed.toLowerCase();

  if (normalized === 'in progress') {
    return { released: false, reason: IN_PROGRESS_REASON };
  }
  if (normalized === 'in review') {
    return { released: true, reason: "is in In Review — item 28e's finished state." };
  }
  if (normalized === 'todo') {
    return {
      released: true,
      reason:
        'is in Todo — a correct refusal to proceed, which the dispatch prompt explicitly invites.',
    };
  }
  if (['backlog', 'done', 'canceled', 'duplicate'].includes(normalized)) {
    return { released: true, reason: `is in ${trimmed} — not this assertion's business.` };
  }
  return {
    released: true,
    reason: `is in an unrecognised state (${JSON.stringify(trimmed)}) — this assertion is a denylist of one, not an allowlist.`,
  };
}

// ---------------------------------------------------------------------------
// isRetryableError — the second pure function. Also synchronous, over an
// Error rather than a state name.
// ---------------------------------------------------------------------------
// `scripts/linear/client.mjs` throws a bare `Error` — no status, no `cause`,
// no subclass, and it is not in this task's Allowed Files, so it cannot be
// edited to attach one. String-inspection of `err.message` is not a shortcut
// here; gate round 2 measured that no alternative exists. The client authors
// exactly four message shapes:
//
//   `LINEAR_API_KEY is not set.`        (client.mjs:27)  -- definite, no retry
//   `Rate-limit floor reached: …`       (client.mjs:38)  -- definite, no retry
//   `GraphQL query too complex …`       (client.mjs:52)  -- definite, no retry
//   `GraphQL: ` + JSON                  (client.mjs:58)  -- definite, no retry
//
// Anything else — an unwrapped `fetch`/`res.json()` failure, e.g.
// `TypeError: fetch failed` with `err.cause.code` — is a transport failure
// worth one network blip's worth of retrying.
//
// Retrying a definite answer burns requests for no information: three
// attempts against an already-reached rate floor spend the last requests in
// the window finding out what the first attempt already said.
const NO_RETRY_PREFIXES = [
  'LINEAR_API_KEY is not set.',
  'Rate-limit floor reached:',
  'GraphQL query too complex',
];

export function isRetryableError(err) {
  const message = err instanceof Error ? err.message : String(err);
  if (NO_RETRY_PREFIXES.some((prefix) => message.startsWith(prefix))) return false;
  if (message.startsWith('GraphQL: ')) return false;
  return true;
}

/** True only for the one `GraphQL: ` shape whose JSON payload names
 * `Entity not found: Issue` — the signal that a junk identifier (e.g. a typo'd
 * `repository_dispatch` payload) should read as "not found", not merely as
 * "the read failed". Every other `GraphQL: ` error (auth, complexity, any
 * other userError) is "undetermined": the read failed, but not because the
 * issue does not exist. */
export function isIssueNotFoundError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.startsWith('GraphQL: ') && message.includes('Entity not found: Issue');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reads the issue's current state name, retrying only transport-level
 * failures per `isRetryableError`. Never throws — every outcome is reported
 * as one of `ok` / `not-found` / `error`, so the caller always has something
 * to say rather than an uncaught rejection.
 */
async function readStateName(identifier) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { data } = await gql(QUERY, { identifier });
      return { kind: 'ok', stateName: data.issue?.state?.name ?? null };
    } catch (err) {
      lastErr = err;
      if (isIssueNotFoundError(err)) {
        return { kind: 'not-found', err };
      }
      if (attempt < MAX_ATTEMPTS && isRetryableError(err)) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      return { kind: 'error', err };
    }
  }
  return { kind: 'error', err: lastErr };
}

/** Builds the one-line verdict and the exit code from a `readStateName`
 * result. `undetermined` and `not found` are deliberately distinct strings
 * (criterion 3) — a check that fails silently for "could not look" reads
 * identically to the evidence-honesty defect this whole file exists to catch,
 * so it must never claim the issue is `In Progress` when it never learned
 * that. */
function verdictFor(identifier, result) {
  if (result.kind === 'not-found') {
    return {
      exitCode: 1,
      line: `${identifier}: NOT FOUND — no issue with that identifier exists in Linear. A junk repository_dispatch identifier must read as junk, not as a pass.`,
    };
  }
  if (result.kind === 'error') {
    const firstLine = String(result.err?.message ?? result.err).split('\n')[0];
    return {
      exitCode: 1,
      line: `${identifier}: UNDETERMINED — could not read its state (${firstLine}). A check that passes when it could not look reproduces the defect this assertion exists to catch.`,
    };
  }
  if (result.stateName === null) {
    return {
      exitCode: 1,
      line: `${identifier}: UNDETERMINED — Linear returned no workflow state for this issue.`,
    };
  }
  const { released, reason } = classifyState(result.stateName);
  return {
    exitCode: released ? 0 : 1,
    line: `${identifier} ${reason} (state: ${result.stateName})`,
  };
}

function reportVerdict(line) {
  console.log(line);
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      fs.appendFileSync(summaryPath, `${line}\n`);
    } catch {
      // Best-effort only — a Step Summary write failing must not mask the
      // real verdict already printed to stdout above.
    }
  }
}

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error('Usage: node scripts/linear-assert-released.mjs <ISSUE-IDENTIFIER>');
    process.exit(1);
  }

  const result = await readStateName(identifier);
  const { exitCode, line } = verdictFor(identifier, result);
  reportVerdict(line);
  process.exit(exitCode);
}

// Only run when invoked directly, so this module is import-safe for the test
// file above (which imports the pure functions and nothing else).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    reportVerdict(
      `${process.argv[2] ?? '(no identifier)'}: UNDETERMINED — unexpected error (${err.message}).`,
    );
    process.exit(1);
  });
}
