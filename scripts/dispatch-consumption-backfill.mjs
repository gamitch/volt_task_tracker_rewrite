// Rebuilds the consumption history for every dispatched run whose artifact has
// not yet expired, and writes it somewhere git will keep.
//
// WHY THIS IS SEPARATE FROM `dispatch-consumption.mjs`. That script records ONE
// run at the moment it ends, from a file already on the runner's disk. This one
// reaches backwards over runs that finished days ago, whose only surviving copy
// is a GitHub Actions artifact on a 30-day clock. Different input, different
// failure modes, different schedule -- and this one is a `workflow_dispatch`
// that should be runnable by hand at any time, not a step bolted to a dispatch.
//
// THE DEADLINE IS THE POINT. Artifact retention is 30 days
// (`claude-linear-dispatch.yml:463`) and the workflow's first run was
// 2026-08-09, so the first expiries land around 2026-09-08. Measured
// 2026-08-14: 37 runs, every one still inside the window. Run this before that
// date and the entire quantitative history of the dispatch loop is preserved;
// run it after and the front of it is gone for good. Nothing regenerates it.
//
// ---------------------------------------------------------------------------
// WHY THIS SCRIPT DOES NO DOWNLOADING
// ---------------------------------------------------------------------------
// Downloading an artifact needs an authenticated call to api.github.com, and
// the auth that works there is the workflow's own `GITHUB_TOKEN`. Putting the
// HTTP in here would make every test either mock a zip archive or reach the
// network, and would bury the one genuinely fragile part (auth + unzip) inside
// a module that is otherwise pure.
//
// So the WORKFLOW does the fetching: it lists runs, downloads each
// `claude-run-<ISSUE>-<RUNID>` artifact, unzips it, and drops the payload at
// `<dir>/<ISSUE>-<RUNID>.json`. This script reads that directory. The artifact
// name is the join key -- it already carries the issue identifier, so no Linear
// lookup is needed to know which row a run belongs to.
//
// That split also means this script is runnable against a directory a human
// assembled by hand, which is what anyone debugging it will actually do.
//
// ---------------------------------------------------------------------------
// THE LEDGER IS THE DELIVERABLE; THE LINEAR WRITE IS OPTIONAL
// ---------------------------------------------------------------------------
// `docs/swarm/dispatch-consumption.md` is committed to git, so it outlives the
// artifacts permanently and needs no API to read. Posting to Linear (`--post`)
// is a second, skippable step: it is the convenient copy, git is the durable
// one -- the same ordering `claude-linear-dispatch.yml` uses when it tells a
// dispatched agent to commit its run log rather than trust the transcript.
//
// Usage:
//   node scripts/dispatch-consumption-backfill.mjs --dir ./artifacts \
//     [--out docs/swarm/dispatch-consumption.md] [--post] [--repo owner/name]

import fs from 'node:fs';
import path from 'node:path';
import {
  COMMENT_MARKER,
  ROLLUP_START,
  ROLLUP_END,
  collectObjects,
  extractConsumption,
  fmtCost,
  fmtDuration,
  fmtInt,
  formatComment,
  formatRollup,
  upsertRollup,
} from './dispatch-consumption.mjs';

/** `GAM-304-31391626696.json` -> `{ identifier, runId }`. */
export function parseArtifactFilename(filename) {
  const m = /^([A-Z]+-\d+)-(\d{6,})\.json$/.exec(path.basename(filename ?? ''));
  return m ? { identifier: m[1], runId: m[2] } : null;
}

/**
 * Pure-ish. Reads a directory of `<ISSUE>-<RUNID>.json` payloads into per-run
 * consumption records.
 *
 * A file that does not match the naming convention is SKIPPED AND COUNTED, not
 * ignored. A backfill that silently processed 4 of 37 files and reported
 * success would be this project's signature defect wearing a new hat.
 */
export function readBackfillDir(dir, { readDir = fs.readdirSync, readFile = fs.readFileSync } = {}) {
  let names = [];
  try {
    names = readDir(dir);
  } catch (err) {
    return {
      runs: [],
      skipped: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const runs = [];
  const skipped = [];

  for (const name of names.slice().sort()) {
    const parsed = parseArtifactFilename(name);
    if (!parsed) {
      skipped.push({ name, reason: 'FILENAME_NOT_ISSUE_RUNID' });
      continue;
    }
    let text = '';
    try {
      text = readFile(path.join(dir, name), 'utf8');
    } catch (err) {
      skipped.push({ name, reason: 'UNREADABLE', detail: err instanceof Error ? err.message : '' });
      continue;
    }
    runs.push({
      ...parsed,
      consumption: extractConsumption(collectObjects(text)),
    });
  }

  return { runs, skipped };
}

/** Groups runs by the issue they worked, preserving run order within each. */
export function groupByIssue(runs) {
  const byIssue = new Map();
  for (const r of runs) {
    if (!byIssue.has(r.identifier)) byIssue.set(r.identifier, []);
    byIssue.get(r.identifier).push(r);
  }
  for (const list of byIssue.values()) list.sort((a, b) => Number(a.runId) - Number(b.runId));
  return byIssue;
}

const totals = (runs) => {
  const ok = runs.filter((r) => r.consumption.ok);
  return {
    runs: runs.length,
    unrecoverable: runs.length - ok.length,
    cost: ok.reduce((a, r) => a + r.consumption.cost, 0),
    tokens: ok.reduce((a, r) => a + (r.consumption.tokens?.total ?? 0), 0),
    ms: ok.reduce((a, r) => a + (r.consumption.durationMs ?? 0), 0),
  };
};

/**
 * Pure. Renders the committed ledger.
 *
 * Per-run rows rather than per-issue only, because the two questions this has
 * to answer are different: "what did GAM-344 cost" wants the issue total, and
 * "what did the two killed attempts cost" wants the runs that produced nothing.
 * Collapsing to one row per issue would lose the second, which is the more
 * expensive lesson -- ~$36 of GAM-304's ~$85 went to runs that delivered
 * nothing.
 */
export function formatLedger(byIssue, { skipped = [], generatedFor = 'unknown' } = {}) {
  const all = [...byIssue.values()].flat();
  const grand = totals(all);

  // A total is only a total of what was recoverable. Rendering `$0.00` when
  // nothing could be read would state, in the most authoritative row of the
  // file, that these runs consumed nothing -- the same lie
  // `dispatch-consumption.mjs` refuses to tell on a comment, and a worse one
  // here because a ledger reads as settled fact.
  const anyRecovered = grand.runs - grand.unrecoverable > 0;
  const costCell = anyRecovered
    ? `**${fmtCost(grand.cost)}** (not money charged)` +
      (grand.unrecoverable > 0 ? ` — across ${grand.runs - grand.unrecoverable} of ${grand.runs} runs` : '')
    : '— no run yielded a figure';

  const lines = [
    '# Dispatch consumption ledger',
    '',
    '<!-- Generated by scripts/dispatch-consumption-backfill.mjs. Do not hand-edit:',
    '     a re-run overwrites this file wholesale. -->',
    '',
    '**Every dollar figure here is notional and is NOT money anyone was charged.**',
    '`claude-linear-dispatch.yml` authenticates with `claude_code_oauth_token`, so runs draw on',
    "the owner's Claude subscription and `ANTHROPIC_API_KEY` is empty. The SDK still reports",
    '`total_cost_usd`, computed by pricing that run\'s tokens at API list rates. No invoice follows.',
    'The figure is kept because it is the only quantitative signal available — subscription',
    'consumption is exposed as a number nowhere — and it is proportional to tokens weighted by',
    'model tier, so it compares one run against another soundly. Read it as notional consumption,',
    'never as spend.',
    '',
    'This file exists because the source it is built from expires. Artifact retention is 30 days',
    '(`claude-linear-dispatch.yml:463`); this ledger is committed to git and does not.',
    '',
    `**Source:** ${generatedFor}`,
    '',
    '## Totals',
    '',
    '| Measure | Value |',
    '| -- | -- |',
    `| rows covered | ${byIssue.size} |`,
    `| runs covered | ${grand.runs} |`,
    `| notional consumption | ${costCell} |`,
    `| tokens | ${anyRecovered ? fmtInt(grand.tokens) : '—'} |`,
    `| wall clock | ${anyRecovered ? fmtDuration(grand.ms) : '—'} |`,
    `| runs with no recoverable figure | ${grand.unrecoverable} |`,
    '',
    '## Per row',
    '',
    '| Row | Runs | Notional | Tokens | Wall clock | Unrecoverable |',
    '| -- | -- | -- | -- | -- | -- |',
  ];

  const sorted = [...byIssue.entries()].sort((a, b) => totals(b[1]).cost - totals(a[1]).cost);
  for (const [identifier, runs] of sorted) {
    const t = totals(runs);
    // Same rule as the grand total: a row whose every run is unrecoverable has
    // no cost to report, and `$0.00` would claim it ran for free.
    const rowRecovered = t.runs - t.unrecoverable > 0;
    lines.push(
      `| ${identifier} | ${t.runs} | ${rowRecovered ? fmtCost(t.cost) : '—'} | ` +
        `${rowRecovered ? fmtInt(t.tokens) : '—'} | ${rowRecovered ? fmtDuration(t.ms) : '—'} | ` +
        `${t.unrecoverable || '—'} |`,
    );
  }

  lines.push('', '## Per run', '', '| Row | Run | Notional | Tokens | Turns | Wall clock | Model |', '| -- | -- | -- | -- | -- | -- | -- |');

  for (const [identifier, runs] of sorted) {
    for (const r of runs) {
      const c = r.consumption;
      lines.push(
        `| ${identifier} | [${r.runId}](https://github.com/gamitch/volt_task_tracker_rewrite/actions/runs/${r.runId}) | ` +
          (c.ok
            ? `${fmtCost(c.cost)} | ${fmtInt(c.tokens.total)} | ${c.turns ?? '—'} | ${fmtDuration(c.durationMs)} | ${c.model ? `\`${c.model}\`` : '—'} |`
            : `— | — | — | — | **${c.reason}** |`),
      );
    }
  }

  if (skipped.length > 0) {
    lines.push(
      '',
      '## Files skipped',
      '',
      'Listed rather than dropped: a backfill that silently covered a subset would report',
      'success over a gap, which is the failure this repository keeps catching.',
      '',
      '| File | Reason |',
      '| -- | -- |',
      ...skipped.map((s) => `| \`${s.name}\` | ${s.reason} |`),
    );
  }

  return `${lines.join('\n')}\n`;
}

async function defaultGql(query, variables) {
  const { gql } = await import('./linear/client.mjs');
  return gql(query, variables);
}

const ISSUE_QUERY = `
  query BackfillTarget($id: String!) {
    issue(id: $id) { id identifier description
      comments(first: 100) { nodes { body } } }
  }
`;

const COMMENT_MUTATION = `
  mutation PostBackfill($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) { success }
  }
`;

const DESCRIPTION_MUTATION = `
  mutation UpdateBackfillRollup($id: String!, $description: String!) {
    issueUpdate(id: $id, input: { description: $description }) { success }
  }
`;

/**
 * Posts one issue's whole history: one comment per run that does not already
 * have one, then a rollup covering all of them.
 *
 * Idempotent by design. The backfill will be re-run -- once to preserve the
 * history, again after later dispatches -- and a version that posted a second
 * comment per run each time would make the row unreadable within a week.
 * Existing comments are matched on the run id inside the marker.
 */
export async function postIssueBackfill(identifier, runs, { gqlImpl = defaultGql, repo, log = console.log } = {}) {
  let issue = null;
  try {
    const { data } = await gqlImpl(ISSUE_QUERY, { id: identifier });
    issue = data?.issue ?? null;
  } catch (err) {
    log(`  ${identifier}: read failed (${err instanceof Error ? err.message : String(err)})`);
    return { posted: 0, reason: 'READ_FAILED' };
  }
  if (!issue) {
    log(`  ${identifier}: not found in Linear`);
    return { posted: 0, reason: 'ISSUE_NOT_FOUND' };
  }

  const existing = (issue.comments?.nodes ?? [])
    .map((c) => (typeof c?.body === 'string' ? c.body : ''))
    .filter((b) => b.includes(COMMENT_MARKER));

  let posted = 0;
  for (const r of runs) {
    if (existing.some((b) => b.includes(r.runId))) continue;
    const body = formatComment({ consumption: r.consumption, runId: r.runId, repo });
    try {
      await gqlImpl(COMMENT_MUTATION, { issueId: issue.id, body });
      posted += 1;
    } catch (err) {
      log(`  ${identifier}: comment for ${r.runId} failed (${err instanceof Error ? err.message : String(err)})`);
    }
  }

  const rollup = formatRollup(
    runs.map((r) => ({
      cost: r.consumption.ok ? r.consumption.cost : undefined,
      tokens: r.consumption.tokens,
      durationMs: r.consumption.durationMs,
    })),
  );

  try {
    await gqlImpl(DESCRIPTION_MUTATION, {
      id: issue.id,
      description: upsertRollup(issue.description ?? '', rollup),
    });
  } catch (err) {
    log(`  ${identifier}: rollup failed (${err instanceof Error ? err.message : String(err)})`);
    return { posted, reason: 'ROLLUP_FAILED' };
  }

  log(`  ${identifier}: ${runs.length} run(s), ${posted} new comment(s), rollup updated`);
  return { posted, reason: 'OK' };
}

export async function runBackfill({
  dir,
  out = 'docs/swarm/dispatch-consumption.md',
  post = false,
  repo = 'gamitch/volt_task_tracker_rewrite',
  gqlImpl = defaultGql,
  readDir = fs.readdirSync,
  readFile = fs.readFileSync,
  writeFile = fs.writeFileSync,
  log = console.log,
} = {}) {
  if (!dir) {
    log('No --dir given; nothing to back-fill.');
    return { exitCode: 0, reason: 'NO_DIR' };
  }

  const { runs, skipped, error } = readBackfillDir(dir, { readDir, readFile });
  if (error) {
    log(`Could not read ${dir}: ${error}`);
    return { exitCode: 0, reason: 'DIR_UNREADABLE' };
  }
  if (runs.length === 0) {
    log(`No artifact payloads matched <ISSUE>-<RUNID>.json in ${dir}.`);
    if (skipped.length) log(`${skipped.length} file(s) skipped: ${skipped.map((s) => s.name).join(', ')}`);
    return { exitCode: 0, reason: 'NOTHING_TO_DO', skipped };
  }

  const byIssue = groupByIssue(runs);
  const recovered = runs.filter((r) => r.consumption.ok).length;
  log(
    `${runs.length} run(s) across ${byIssue.size} row(s); ` +
      `${recovered} with a figure, ${runs.length - recovered} unrecoverable, ${skipped.length} file(s) skipped.`,
  );

  writeFile(out, formatLedger(byIssue, { skipped, generatedFor: `${runs.length} artifacts from ${repo}` }), 'utf8');
  log(`Ledger written to ${out}.`);

  if (!post) {
    log('Not posting to Linear (--post not given). The ledger is the durable copy.');
    return { exitCode: 0, reason: 'LEDGER_ONLY', runs: runs.length, issues: byIssue.size, skipped };
  }

  let postedTotal = 0;
  for (const [identifier, issueRuns] of byIssue) {
    const { posted } = await postIssueBackfill(identifier, issueRuns, { gqlImpl, repo, log });
    postedTotal += posted;
  }

  log(`Backfill complete: ${postedTotal} comment(s) posted across ${byIssue.size} row(s).`);
  return { exitCode: 0, reason: 'POSTED', runs: runs.length, issues: byIssue.size, posted: postedTotal, skipped };
}

function arg(name, argv) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const { exitCode } = await runBackfill({
    dir: arg('dir', argv) ?? process.env.ARTIFACT_DIR,
    out: arg('out', argv) ?? 'docs/swarm/dispatch-consumption.md',
    post: argv.includes('--post'),
    repo: arg('repo', argv) ?? process.env.GITHUB_REPOSITORY ?? 'gamitch/volt_task_tracker_rewrite',
  });
  process.exitCode = exitCode;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { ROLLUP_START, ROLLUP_END };
