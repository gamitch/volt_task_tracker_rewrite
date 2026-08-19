#!/usr/bin/env node
// Credential preflight for a dispatched run — GAM-403.
//
// THE DEFECT THIS CATCHES. `claude-linear-dispatch.yml` puts a token into
// `secrets.CLAUDE_PR_TOKEN || github.token` and nothing checks, before an
// implementation is spent, whether the resulting credential can actually
// push a branch or open a pull request. Measured live in this run: a dead
// push credential does not fail `actions/checkout` (this repo is public, and
// both a garbage token and an empty one `ls-remote` it successfully), so
// nothing upstream catches it — the run burns the whole turn and finds out
// only at push time, with no run log and no branch surviving (the dispatch
// prompt's durability contract — "the pushed run log is the only thing that
// survives if you are killed" — depends on the push succeeding). This script
// fails fast, before that cost is spent, by *attempting* the real operation
// rather than reading `.permissions` off the REST API, which is measured to
// report `push:false` for the App token that then pushes successfully — a
// false negative a permissions-reading preflight would have acted on.
//
// TWO STAGES, RUN AT TWO DIFFERENT POINTS, BECAUSE TWO DIFFERENT CREDENTIALS
// LIVE IN TWO DIFFERENT PLACES:
//   --stage=push   the branch-publication credential (CLAUDE_PR_TOKEN),
//                  verified by a workflow step before claude-code-action
//                  runs.
//   --stage=pr     the PR-creation credential, which only exists inside the
//                  agent's own environment (claude-code-action mints a
//                  `claude[bot]` App token that overrides whatever the
//                  workflow assigned to GH_TOKEN) — verified as the agent's
//                  own first act.
//   --stage=all    both, for local/manual use.
//
// THE ref-write PROBE NEUTRALIZES THE CHECKOUT'S OWN CREDENTIAL ON PURPOSE.
// `actions/checkout` writes an `Authorization:` header into
// `http.https://github.com/.extraheader` in the repo's git config, and that
// header outranks any credential embedded in a push URL's userinfo. Without
// `-c "http.https://github.com/.extraheader="` on the probe command, the
// probe silently authenticates as the checkout's own credential and PASSES
// on a garbage token under test — measured live, the exact false positive
// this script exists to prevent. The probe also never targets `origin` for
// the same reason: `origin`'s remote URL carries a credential too, so the
// push URL is always built explicitly from GITHUB_REPOSITORY and the token
// under test, never from the local git config.
//
// WHAT THIS DOES NOT DO.
//   - It never reads `.permissions` from the REST API — proven unreliable
//     above.
//   - It never creates a real pull request. The PR-create check relies on
//     GitHub evaluating authorization before validation: a `head == base`
//     request is guaranteed to fail *validation* (`422`, "No commits
//     between") for a credential that is genuinely authorized to open PRs,
//     and to fail *authorization* first (`403`/`401`/other) for one that is
//     not. A `422` whose body says anything else (e.g. a typo'd base branch,
//     which also yields `422`) is treated as FAIL, not PASS, so a
//     misconfigured PREFLIGHT_BASE cannot report a silent green.
//   - It never short-circuits. Every check in a stage runs and is reported,
//     success or failure, so a failing preflight still teaches what
//     "healthy" looks like. The sole exception is a missing/empty
//     credential (check 1 FAIL): the remaining checks for that stage report
//     SKIP without attempting a call — there is nothing to send.
//   - It imports nothing outside Node's standard library. A dispatch
//     checkout has no `node_modules` (no `npm ci` runs before this step), so
//     a single non-stdlib import would fail this script at runtime with no
//     way to fix it. `vitest` appears only in this script's test file, never
//     here.
//   - It never prints a token, or any substring of one — including inside a
//     captured `git` stderr string, since `git`'s own error text quotes back
//     the credential-bearing URL it was given.
//
// Usage:
//   node scripts/dispatch-preflight.mjs --stage=push   # workflow step, pre-agent
//   node scripts/dispatch-preflight.mjs --stage=pr     # the agent's own first act
//   node scripts/dispatch-preflight.mjs --stage=all    # both, local/manual use
//
// Environment (see docs/swarm/active/GAM-403-packet.md §2.1 for the full
// table): GITHUB_REPOSITORY (required, both stages), PREFLIGHT_PUSH_TOKEN
// (stage push), PREFLIGHT_PR_TOKEN (stage pr, falls back to GH_TOKEN),
// PREFLIGHT_BUILTIN_TOKEN (stage push, the built-in `${{ github.token }}`
// passed explicitly by the workflow step), GITHUB_RUN_ID (stage push, probe
// ref uniqueness), PREFLIGHT_BASE (stage pr, default `main`),
// GITHUB_STEP_SUMMARY (both, report also appended there if set).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://api.github.com';
const EXTRAHEADER_CLEAR = 'http.https://github.com/.extraheader=';

const CHECK_NAMES = {
  1: 'credential-present',
  2: 'repo-access',
  3: 'identity',
  4: 'ref-write',
  5: 'pr-create',
  6: 'ci-trigger',
};

// ---------------------------------------------------------------------------
// redact — never print a token, or any substring of one.
// ---------------------------------------------------------------------------
// The dot and dash in this character class are the whole point. The
// `claude[bot]` installation token is JWT-shaped
// (`ghs_<id>_<b64header>.<b64payload>.<signature>`); a charset limited to
// `[A-Za-z0-9_]` stops at the first `.` and leaves the payload and signature
// printed verbatim — measured at 342 of 390 characters of a live
// write-capable token surviving that narrower regex.
export const REDACT_PATTERN =
  /(?:ghs|ghp|gho|ghu|ghr)_[A-Za-z0-9_.-]+|github_pat_[A-Za-z0-9_.-]+/g;

export function redact(text) {
  if (text === undefined || text === null) return text;
  return String(text).replace(REDACT_PATTERN, '[REDACTED]');
}

// ---------------------------------------------------------------------------
// Pure classifiers — no I/O. Each takes the already-fetched status/body and
// returns { verdict, reason } (plus, for identity, a credentialClass label
// R1-7 requires the PR-create line to name).
// ---------------------------------------------------------------------------

export function classifyRepoAccess({ status, body, expectedRepo }) {
  if (status === 200 && body && body.full_name === expectedRepo) {
    return { verdict: 'PASS', reason: `GET /repos/${expectedRepo} -> 200, full_name matches` };
  }
  if (status === 200) {
    return {
      verdict: 'FAIL',
      reason: `GET /repos returned 200 but full_name (${body && body.full_name}) does not match expected ${expectedRepo}`,
    };
  }
  return { verdict: 'FAIL', reason: `GET /repos/${expectedRepo} returned ${status}` };
}

export function classifyIdentity({ status, body }) {
  if (status === 200) {
    const login = body && body.login;
    return {
      verdict: 'PASS',
      reason: `GET /user -> 200, login=${login}`,
      credentialClass: `user:${login}`,
    };
  }
  if (status === 403) {
    // Never FAIL on the 403 -- this is the working PR-create credential's
    // own identity response (§1.2). Failing here would be a regression.
    return {
      verdict: 'PASS',
      reason: 'GET /user -> 403, recorded as installation token (no user identity)',
      credentialClass: 'installation token',
    };
  }
  return {
    verdict: 'FAIL',
    reason: `GET /user returned ${status}, identity undetermined`,
    credentialClass: 'unknown',
  };
}

export function classifyPrCreateProbe({ status, body }) {
  if (status === 422) {
    const messages = [];
    if (body && typeof body.message === 'string') messages.push(body.message);
    if (body && Array.isArray(body.errors)) {
      for (const e of body.errors) {
        if (e && typeof e.message === 'string') messages.push(e.message);
      }
    }
    if (messages.some((m) => /No commits between/.test(m))) {
      return {
        verdict: 'PASS',
        reason: `POST /pulls (head==base) -> 422 "No commits between" -- authorized (${messages.join('; ')})`,
      };
    }
    return {
      verdict: 'FAIL',
      reason: `POST /pulls -> 422 but not the expected "No commits between" body (a misconfigured base must not report success): ${JSON.stringify(body)}`,
    };
  }
  if (status === 403) {
    const msg = (body && body.message) || '(no message)';
    return { verdict: 'FAIL', reason: `POST /pulls -> 403, not authorized to open PRs: ${msg}` };
  }
  if (status >= 200 && status < 300) {
    return {
      verdict: 'FAIL',
      reason: `POST /pulls -> ${status} -- a PR may have been created; treat as an alarm, never a pass`,
    };
  }
  return {
    verdict: 'FAIL',
    reason: `POST /pulls returned unexpected status ${status}, never a silent pass: ${JSON.stringify(body)}`,
  };
}

export function classifyCiTrigger({ pushToken, builtInToken }) {
  if (!builtInToken) {
    return {
      verdict: 'SKIP',
      reason: 'PREFLIGHT_BUILTIN_TOKEN not provided; CI-trigger expectation cannot be derived',
      derived: true,
    };
  }
  if (pushToken === builtInToken) {
    return {
      verdict: 'FAIL',
      reason:
        'push credential is byte-identical to the built-in token -- pushes made with the built-in token do not trigger workflow runs',
      derived: true,
    };
  }
  return {
    verdict: 'PASS',
    reason: 'push credential differs from the built-in token (derived, not measured directly)',
    derived: true,
  };
}

export function classifyRefWrite({ pushResult, deleteResult }) {
  if (!pushResult || pushResult.status !== 0) {
    return {
      verdict: 'FAIL',
      reason: `push to refs/preflight/* failed -- this proves ref-write, not branch-create (refs/preflight/* sits outside refs/heads/** protection): ${describeGitResult(pushResult)}`,
    };
  }
  if (!deleteResult || deleteResult.status !== 0) {
    return {
      verdict: 'FAIL',
      reason: `push succeeded but the follow-up delete failed -- the probe littered a ref: ${describeGitResult(deleteResult)}`,
    };
  }
  return {
    verdict: 'PASS',
    reason:
      'ref-write confirmed: push + delete of refs/preflight/* both succeeded (proves ref-write, not branch-create)',
  };
}

function describeGitResult(r) {
  if (!r) return '(no result)';
  return `exit ${r.status}: ${(r.stderr || r.stdout || '').toString().trim()}`;
}

// ---------------------------------------------------------------------------
// evaluate / formatReport
// ---------------------------------------------------------------------------

export function evaluate(checks) {
  const ok = checks.every((c) => c.verdict !== 'FAIL');
  return { ok, exitCode: ok ? 0 : 1 };
}

export function formatReport(checks) {
  const lines = checks.map((c) => {
    const label = c.derived ? `${c.verdict}(DERIVED)` : c.verdict;
    return `  ${label.padEnd(14)} [${c.stage}:${c.id}] ${c.name} -- ${c.reason}`;
  });
  return redact(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// runPreflight -- the one injectable shell. No test may reach the network or
// run a real `git push`; every network/git call goes through fetchImpl /
// gitImpl.
// ---------------------------------------------------------------------------

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'dispatch-preflight',
  };
}

async function safeFetchJson(fetchImpl, url, options) {
  try {
    const res = await fetchImpl(url, options);
    let body = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch (err) {
    return { status: 0, body: null, networkError: err };
  }
}

function buildPushUrl(repo, token) {
  return `https://x-access-token:${token}@github.com/${repo}.git`;
}

async function runPushStage({ env, repo, fetchImpl, gitImpl }) {
  const token = env.PREFLIGHT_PUSH_TOKEN;
  const runId = env.GITHUB_RUN_ID || 'local';
  const builtInToken = env.PREFLIGHT_BUILTIN_TOKEN;
  const checks = [];

  const hasCredential = typeof token === 'string' && token.length > 0;
  checks.push({
    id: 1,
    name: CHECK_NAMES[1],
    stage: 'push',
    verdict: hasCredential ? 'PASS' : 'FAIL',
    reason: hasCredential
      ? 'PREFLIGHT_PUSH_TOKEN is set'
      : 'PREFLIGHT_PUSH_TOKEN is empty or unset',
  });

  if (!hasCredential) {
    // [R2-2] exception: nothing to send with an empty credential -- report
    // SKIP for every remaining check in this stage without attempting a call.
    checks.push({
      id: 2,
      name: CHECK_NAMES[2],
      stage: 'push',
      verdict: 'SKIP',
      reason: 'no credential to test -- repo access not attempted',
    });
    checks.push({
      id: 3,
      name: CHECK_NAMES[3],
      stage: 'push',
      verdict: 'SKIP',
      reason: 'no credential to test -- identity not attempted',
    });
    checks.push({
      id: 4,
      name: CHECK_NAMES[4],
      stage: 'push',
      verdict: 'SKIP',
      reason: 'no credential to test -- ref-write not attempted',
    });
    checks.push({
      id: 6,
      name: CHECK_NAMES[6],
      stage: 'push',
      verdict: 'SKIP',
      reason: 'no credential to test -- CI-trigger comparison not attempted',
      derived: true,
    });
    return checks;
  }

  const repoRes = await safeFetchJson(fetchImpl, `${API}/repos/${repo}`, {
    headers: authHeaders(token),
  });
  checks.push({
    id: 2,
    name: CHECK_NAMES[2],
    stage: 'push',
    ...classifyRepoAccess({ status: repoRes.status, body: repoRes.body, expectedRepo: repo }),
  });

  const idRes = await safeFetchJson(fetchImpl, `${API}/user`, { headers: authHeaders(token) });
  checks.push({
    id: 3,
    name: CHECK_NAMES[3],
    stage: 'push',
    ...classifyIdentity({ status: idRes.status, body: idRes.body }),
  });

  const ref = `refs/preflight/preflight-${runId}`;
  const url = buildPushUrl(repo, token);
  // The -c flag is load-bearing, not hygiene: without it this probe would
  // authenticate as the checkout's own credential, not the token under test.
  const pushResult = gitImpl(['-c', EXTRAHEADER_CLEAR, 'push', url, `HEAD:${ref}`]);
  const deleteResult = gitImpl(['-c', EXTRAHEADER_CLEAR, 'push', url, '--delete', ref]);
  checks.push({
    id: 4,
    name: CHECK_NAMES[4],
    stage: 'push',
    ...classifyRefWrite({ pushResult, deleteResult }),
  });

  checks.push({
    id: 6,
    name: CHECK_NAMES[6],
    stage: 'push',
    ...classifyCiTrigger({ pushToken: token, builtInToken }),
  });

  return checks;
}

async function runPrStage({ env, repo, fetchImpl }) {
  const token = env.PREFLIGHT_PR_TOKEN || env.GH_TOKEN;
  const base = env.PREFLIGHT_BASE || 'main';
  const checks = [];

  const hasCredential = typeof token === 'string' && token.length > 0;
  checks.push({
    id: 1,
    name: CHECK_NAMES[1],
    stage: 'pr',
    verdict: hasCredential ? 'PASS' : 'FAIL',
    reason: hasCredential
      ? 'PREFLIGHT_PR_TOKEN (or GH_TOKEN fallback) is set'
      : 'PREFLIGHT_PR_TOKEN and GH_TOKEN are both empty or unset',
  });

  if (!hasCredential) {
    checks.push({
      id: 2,
      name: CHECK_NAMES[2],
      stage: 'pr',
      verdict: 'SKIP',
      reason: 'no credential to test -- repo access not attempted',
    });
    checks.push({
      id: 3,
      name: CHECK_NAMES[3],
      stage: 'pr',
      verdict: 'SKIP',
      reason: 'no credential to test -- identity not attempted',
    });
    checks.push({
      id: 5,
      name: CHECK_NAMES[5],
      stage: 'pr',
      verdict: 'SKIP',
      reason: 'no credential to test -- PR-create not attempted',
    });
    return checks;
  }

  const repoRes = await safeFetchJson(fetchImpl, `${API}/repos/${repo}`, {
    headers: authHeaders(token),
  });
  checks.push({
    id: 2,
    name: CHECK_NAMES[2],
    stage: 'pr',
    ...classifyRepoAccess({ status: repoRes.status, body: repoRes.body, expectedRepo: repo }),
  });

  const idRes = await safeFetchJson(fetchImpl, `${API}/user`, { headers: authHeaders(token) });
  const idVerdict = classifyIdentity({ status: idRes.status, body: idRes.body });
  checks.push({ id: 3, name: CHECK_NAMES[3], stage: 'pr', ...idVerdict });

  const prRes = await safeFetchJson(fetchImpl, `${API}/repos/${repo}/pulls`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'dispatch-preflight probe (never created -- head==base is validation-rejected)',
      head: base,
      base,
    }),
  });
  const prVerdict = classifyPrCreateProbe({ status: prRes.status, body: prRes.body });
  // [R1-7] name the credential class on the PR-create line.
  checks.push({
    id: 5,
    name: CHECK_NAMES[5],
    stage: 'pr',
    verdict: prVerdict.verdict,
    reason: `${prVerdict.reason} [credential: ${idVerdict.credentialClass || 'unknown'}]`,
  });

  return checks;
}

export async function runPreflight({ stage, env, fetchImpl, gitImpl }) {
  const repo = env.GITHUB_REPOSITORY;
  const checks = [];

  if (stage === 'push') {
    checks.push(...(await runPushStage({ env, repo, fetchImpl, gitImpl })));
  } else if (stage === 'pr') {
    checks.push(...(await runPrStage({ env, repo, fetchImpl })));
  } else if (stage === 'all') {
    checks.push(...(await runPushStage({ env, repo, fetchImpl, gitImpl })));
    checks.push(...(await runPrStage({ env, repo, fetchImpl })));
  } else {
    checks.push({
      id: 0,
      name: 'stage',
      stage: String(stage),
      verdict: 'FAIL',
      reason: `unknown --stage value: ${stage} (expected push, pr, or all)`,
    });
  }

  const { ok, exitCode } = evaluate(checks);
  return { checks, ok, exitCode };
}

// ---------------------------------------------------------------------------
// Real (non-injected) implementations, used only by main().
// ---------------------------------------------------------------------------

function defaultGitImpl(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.error) {
    return { status: 1, stdout: '', stderr: String(r.error.message || r.error) };
  }
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function parseStageArg(argv) {
  const arg = argv.find((a) => a.startsWith('--stage='));
  return arg ? arg.slice('--stage='.length) : undefined;
}

async function main() {
  const stage = parseStageArg(process.argv.slice(2));
  if (!stage || !['push', 'pr', 'all'].includes(stage)) {
    console.error('Usage: node scripts/dispatch-preflight.mjs --stage=push|pr|all');
    process.exit(1);
    return;
  }

  const { checks, exitCode } = await runPreflight({
    stage,
    env: process.env,
    fetchImpl: fetch,
    gitImpl: defaultGitImpl,
  });

  const report = formatReport(checks);
  console.log(`dispatch-preflight --stage=${stage}`);
  console.log(report);
  console.log(exitCode === 0 ? 'RESULT: PASS' : 'RESULT: FAIL');

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    try {
      fs.appendFileSync(
        summaryPath,
        `dispatch-preflight --stage=${stage}\n\n\`\`\`\n${report}\n\`\`\`\n\nRESULT: ${exitCode === 0 ? 'PASS' : 'FAIL'}\n`,
      );
    } catch {
      // Best-effort only -- a Step Summary write failing must not mask the
      // real verdict already printed to stdout above.
    }
  }

  process.exit(exitCode);
}

// Only run when invoked directly, so this module is import-safe for its test
// file (which imports the pure functions and runPreflight, never main()).
//
// NOT the repo's usual `import.meta.url === \`file://${process.argv[1]}\``
// idiom, and the difference matters more here than in the five sibling
// scripts that use it. That comparison is between a percent-encoded, symlink-
// resolved URL and a raw path, so it silently fails to match when the checkout
// path contains a space or any component is a symlink — and then `main()`
// never runs and the process exits **0, with no output at all**. In
// `linear-assert-released.mjs` that is a silent no-op; here it is a credential
// preflight reporting success on a dead credential, which is an authorization
// to spend a whole run. Measured by the acceptance checker on this script's
// first implementation: with the garbage-token negative control, a path
// containing a space and a symlinked path both produced no output and exit 0.
//
// Compare real paths instead, falling back to a string compare only if a
// path cannot be resolved.
const invokedDirectly = (() => {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  const here = fileURLToPath(import.meta.url);
  try {
    return fs.realpathSync(here) === fs.realpathSync(argv1);
  } catch {
    return here === argv1;
  }
})();

if (invokedDirectly) {
  main().catch((err) => {
    console.error(redact(`dispatch-preflight crashed: ${err && err.stack ? err.stack : err}`));
    process.exit(1);
  });
}
