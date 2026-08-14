// Records what a dispatched run consumed onto the Linear row it worked, so the
// figure survives where a human will actually find it.
//
// WHY THIS EXISTS. The consumption numbers this project quotes -- the $9.16 in
// `claude-linear-dispatch.yml`, the $8.52/$28.58 pair, the "~$37-45 notional"
// in `docs/swarm/PARKED-orchestrator-cost-analysis.md` -- were every one of
// them harvested BY HAND from a run's artifact. Nothing in this repository
// parses `claude-execution-output.json`; before this script the only reference
// to `execution_file` anywhere was the step that uploads it. That artifact is
// on a 30-day retention, so the quantitative history of this workflow has been
// deleting itself on a rolling basis since 2026-08-09.
// `docs/swarm/active/GAM-304-run-31385764526-report.md` is the one row anybody
// rescued, and its header says so in as many words: *"Preserved from an
// expiring artifact ... this file is the durable one."* This script is that
// rescue, done automatically, for every run.
//
// ---------------------------------------------------------------------------
// THE DOLLAR FIGURE IS NOT MONEY, AND THIS SCRIPT MUST NEVER IMPLY IT IS
// ---------------------------------------------------------------------------
// `claude-linear-dispatch.yml` authenticates with `claude_code_oauth_token`,
// so runs draw on the owner's Claude subscription and `ANTHROPIC_API_KEY` is
// empty. The SDK still reports `total_cost_usd`, computed by pricing that
// run's tokens at API list rates. **No invoice follows.** That workflow spends
// twenty lines making this point; a bare "$42.18" on a ticket would undo all
// of them, and "a plausible figure read as something it is not" is the exact
// failure shape `docs/swarm/2026-08-14-owner-session-record.md` §4 is about.
// Every rendering below therefore carries the word *notional* inline, next to
// the number, not in a footnote. Do not "tidy" that away.
//
// ---------------------------------------------------------------------------
// WHAT IS AND IS NOT ESTABLISHED ABOUT THE FILE FORMAT
// ---------------------------------------------------------------------------
// Stated honestly, because the parser's shape depends on it and no real
// artifact was readable from the session that wrote this (the sandbox has no
// direct GitHub API access -- `curl` to api.github.com returns 403 -- and the
// action's README and docs/usage.md document neither `execution_file` nor the
// result message).
//
//   ESTABLISHED. The usage sub-keys `input_tokens`, `output_tokens`,
//   `cache_creation_input_tokens` and `cache_read_input_tokens` were read off
//   a real Claude Code SDK transcript. `total_cost_usd` is the field name a
//   previous session recorded after reading a real artifact (the GAM-304
//   report above quotes it verbatim).
//
//   NOT ESTABLISHED. Whether the file is a JSON array or JSONL; whether the
//   terminal result object carries a cumulative `usage`; the exact key for
//   turns and duration.
//
// So the parser does NOT pattern-match a position or assume a container. It
// walks whatever it is handed, finds the object carrying `total_cost_usd`, and
// accepts several spellings for the rest. Both containers are handled. When it
// cannot find something it says which thing, by name.
//
// ---------------------------------------------------------------------------
// IT REPORTS, IT DOES NOT GATE -- BUT IT NEVER INVENTS A NUMBER
// ---------------------------------------------------------------------------
// Exit code is always 0, matching the `linear-reconcile.mjs` and
// `linear-escalation-notify.mjs` precedent: a bookkeeping failure must not be
// why a run that did real work is reported red.
//
// That is NOT licence to fail quietly, which is this project's signature
// defect (the `tier/*` filter that would have matched nothing forever; the
// mutation run whose output was empty; the 224 tests nothing executed). The
// resolution: on any failure to establish a figure, this script still posts a
// comment, saying which thing was missing and that the run's consumption is
// UNRECOVERABLE. **A zero is never written.** An absent number that announces
// itself is recoverable; a confident `$0.00` is not.
//
// Usage:
//   LINEAR_API_KEY=lin_api_… node scripts/dispatch-consumption.mjs \
//     --issue GAM-304 --execution /path/to/claude-execution-output.json \
//     --run-id 31385764526 --repo gamitch/volt_task_tracker_rewrite \
//     [--conclusion success] [--dry-run]

import fs from 'node:fs';

/** Wraps the rollup in the issue description so re-runs replace rather than stack. */
export const ROLLUP_START = '<!-- dispatch-consumption:start -->';
export const ROLLUP_END = '<!-- dispatch-consumption:end -->';

/** Marks a consumption comment so a later run can find its own prior postings. */
export const COMMENT_MARKER = '<!-- dispatch-consumption:run -->';

const ISSUE_QUERY = `
  query ConsumptionTarget($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      description
    }
  }
`;

const COMMENT_MUTATION = `
  mutation PostConsumption($issueId: String!, $body: String!) {
    commentCreate(input: { issueId: $issueId, body: $body }) {
      success
      comment { id url }
    }
  }
`;

const DESCRIPTION_MUTATION = `
  mutation UpdateConsumptionRollup($id: String!, $description: String!) {
    issueUpdate(id: $id, input: { description: $description }) {
      success
    }
  }
`;

async function defaultGql(query, variables) {
  const { gql } = await import('./linear/client.mjs');
  return gql(query, variables);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Pure. Turns the raw execution-file text into whatever objects it contains.
 *
 * Handles a JSON array, a bare JSON object, and JSONL, because which one the
 * action writes is NOT established (see the header). A malformed JSONL line is
 * skipped rather than fatal -- a truncated final line is the expected shape
 * when a run is killed mid-write, and the earlier lines are still evidence.
 *
 * @param {string} text
 * @returns {object[]} every object found, in file order
 */
export function collectObjects(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter((o) => o && typeof o === 'object');
    if (parsed && typeof parsed === 'object') return [parsed];
  } catch {
    // Not a single JSON document. Fall through to JSONL.
  }

  const out = [];
  for (const line of trimmed.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    try {
      const o = JSON.parse(s);
      if (o && typeof o === 'object') out.push(o);
    } catch {
      // A truncated or interleaved line. Skip it; do not abandon the file.
    }
  }
  return out;
}

/** Pure. Depth-first search for the first value at any of `names`. */
function findFirst(node, names, seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return undefined;
  seen.add(node);
  for (const name of names) {
    const v = node[name];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v) return v;
  }
  for (const v of Object.values(node)) {
    const found = findFirst(v, names, seen);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Pure. Every `usage` object anywhere in the tree. */
export function collectUsage(node, out = [], seen = new Set()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return out;
  seen.add(node);
  if (node.usage && typeof node.usage === 'object' && !Array.isArray(node.usage)) {
    out.push(node.usage);
  }
  for (const v of Object.values(node)) collectUsage(v, out, seen);
  return out;
}

const N = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Pure. Reduces usage objects to the four counters, using established key names. */
export function sumUsage(usages) {
  const t = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  for (const u of usages) {
    t.input += N(u.input_tokens);
    t.output += N(u.output_tokens);
    t.cacheRead += N(u.cache_read_input_tokens);
    t.cacheWrite += N(u.cache_creation_input_tokens);
  }
  return { ...t, total: t.input + t.output + t.cacheRead + t.cacheWrite };
}

/**
 * Pure. Extracts one run's figures from the parsed execution file.
 *
 * The result object is located by the field this script actually needs
 * (`total_cost_usd`) rather than by `type === 'result'` or by being last,
 * because neither of those is established and both would fail silently if
 * wrong. If several objects carry it, the LAST wins -- the SDK's terminal
 * summary rather than any interim one.
 *
 * `usage` is preferred from the result object when it has one (cumulative);
 * otherwise every `usage` in the file is summed. Which of those applies is
 * reported in `tokenSource`, so a reader can tell a real total from a
 * reconstructed one instead of guessing.
 *
 * @returns {{ok: boolean, reason: string, cost?: number, tokens?: object,
 *            tokenSource?: string, turns?: number, durationMs?: number,
 *            model?: string, sessionId?: string, missing?: string[]}}
 */
export function extractConsumption(objects) {
  if (!Array.isArray(objects) || objects.length === 0) {
    return { ok: false, reason: 'EMPTY_EXECUTION_FILE', missing: ['everything'] };
  }

  const withCost = objects.filter((o) => typeof o?.total_cost_usd === 'number');
  const result = withCost.length > 0 ? withCost[withCost.length - 1] : null;

  if (!result) {
    // Deliberately fatal to the FIGURE, not to the run. Emitting 0 here is the
    // whole failure mode this script exists to avoid.
    return {
      ok: false,
      reason: 'NO_TOTAL_COST_USD',
      missing: ['total_cost_usd'],
    };
  }

  const resultUsage =
    result.usage && typeof result.usage === 'object' && !Array.isArray(result.usage)
      ? [result.usage]
      : null;
  const usages = resultUsage ?? collectUsage({ objects });
  const tokens = sumUsage(usages);
  const tokenSource = resultUsage ? 'result.usage' : `summed:${usages.length}`;

  const missing = [];
  if (tokens.total === 0) missing.push('token counts');

  const turns = findFirst(result, ['num_turns', 'numTurns', 'turns']);
  const durationMs = findFirst(result, ['duration_ms', 'durationMs']);
  const model = findFirst(result, ['model', 'modelId']);
  const sessionId = findFirst(result, ['session_id', 'sessionId']);

  if (turns === undefined) missing.push('turns');
  if (durationMs === undefined) missing.push('duration');

  return {
    ok: true,
    reason: 'OK',
    cost: result.total_cost_usd,
    tokens,
    tokenSource,
    turns: typeof turns === 'number' ? turns : undefined,
    durationMs: typeof durationMs === 'number' ? durationMs : undefined,
    model: typeof model === 'string' ? model : undefined,
    sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    missing,
  };
}

/** Pure. Reads the execution file from disk, tolerating its absence. */
export function readExecutionFile(pathname, { readFile = fs.readFileSync } = {}) {
  if (!pathname) return { ok: false, reason: 'NO_EXECUTION_PATH' };
  try {
    return { ok: true, reason: 'OK', text: readFile(pathname, 'utf8') };
  } catch (err) {
    // A run cancelled at `timeout-minutes` never gets its file written -- the
    // SDK writes it at the end. That is the single most likely reason to be
    // here, and it is exactly the run whose consumption a reader most wants.
    return {
      ok: false,
      reason: 'EXECUTION_FILE_UNREADABLE',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export const fmtInt = (n) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

/** Pure. `$28.58`, always with the word `notional` supplied by the caller. */
export const fmtCost = (n) => (typeof n === 'number' ? `$${n.toFixed(2)}` : '—');

/** Pure. `1h 44m` / `59m 12s` / `8s`. */
export function fmtDuration(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const runUrl = (repo, runId) =>
  repo && runId ? `https://github.com/${repo}/actions/runs/${runId}` : null;

/**
 * Pure. The per-run comment body.
 *
 * Written for the reader who lands on the ticket in six months, so it repeats
 * the notional caveat rather than assuming they have read the workflow.
 */
export function formatComment({ consumption, runId, repo, conclusion, artifactExpiry }) {
  const url = runUrl(repo, runId);
  const link = url ? `[${runId}](${url})` : (runId ?? '—');
  const lines = [COMMENT_MARKER, '', `## Dispatch consumption — run ${link}`, ''];

  if (!consumption.ok) {
    lines.push(
      `**UNRECOVERABLE for this run — \`${consumption.reason}\`.**`,
      '',
      'No figure is recorded because none could be established, and this script',
      'never writes a zero in place of a number it does not have. Most likely the',
      'run was cancelled at `timeout-minutes` before the SDK wrote its execution',
      'file, which is exactly the run whose consumption you probably wanted.',
      '',
      consumption.detail ? `Detail: \`${consumption.detail}\`` : null,
      url ? `Run: ${url}` : null,
    );
    return lines.filter((l) => l !== null).join('\n');
  }

  const t = consumption.tokens;
  lines.push(
    '| Measure | Value |',
    '| -- | -- |',
    `| notional consumption | **${fmtCost(consumption.cost)}** — API list-price equivalent, **NOT money charged**; this workflow uses subscription auth |`,
    `| tokens | **${fmtInt(t.total)}** total |`,
    `| — input | ${fmtInt(t.input)} |`,
    `| — output | ${fmtInt(t.output)} |`,
    `| — cache read | ${fmtInt(t.cacheRead)} |`,
    `| — cache write | ${fmtInt(t.cacheWrite)} |`,
    `| turns | ${consumption.turns ?? '—'} |`,
    `| wall clock | ${fmtDuration(consumption.durationMs)} |`,
    `| model | ${consumption.model ? `\`${consumption.model}\`` : '—'} |`,
    `| conclusion | ${conclusion ? `\`${conclusion}\`` : '—'} |`,
    '',
  );

  if (consumption.missing?.length) {
    lines.push(
      `Not established from the artifact: ${consumption.missing.join(', ')}. ` +
        'Shown as `—` rather than guessed.',
      '',
    );
  }

  lines.push(
    `Token total is from \`${consumption.tokenSource}\`. Cache reads dominate a ` +
      'Claude Code run and are billed far below input rate, so the token total ' +
      'and the notional figure are not proportional — compare like with like.',
    '',
  );

  if (url) {
    lines.push(
      `Source: ${url} · artifact \`claude-run-*-${runId}\`` +
        (artifactExpiry ? ` expires ${artifactExpiry}` : ' (30-day retention)'),
    );
  }

  return lines.join('\n');
}

/** Pure. The one-line running total kept in the issue description. */
export function formatRollup(runs) {
  const known = runs.filter((r) => typeof r.cost === 'number');
  const unrecoverable = runs.length - known.length;

  if (known.length === 0) {
    return (
      `**Dispatch consumption:** ${runs.length} run${runs.length === 1 ? '' : 's'}, ` +
      'none recoverable — see comments.'
    );
  }

  const cost = known.reduce((a, r) => a + r.cost, 0);
  const tokens = known.reduce((a, r) => a + (r.tokens?.total ?? 0), 0);
  const ms = known.reduce((a, r) => a + (r.durationMs ?? 0), 0);

  let line =
    `**Dispatch consumption:** ${runs.length} run${runs.length === 1 ? '' : 's'} · ` +
    `${fmtCost(cost)} notional (not money charged — subscription auth) · ` +
    `${fmtInt(tokens)} tokens · ${fmtDuration(ms)}`;

  if (unrecoverable > 0) line += ` · ${unrecoverable} run(s) unrecoverable`;
  return line;
}

/**
 * Pure. Idempotently writes the rollup block into a description.
 *
 * Marker-delimited so a second run REPLACES rather than appends. An issue whose
 * description already ends in a rollup must not accumulate one per attempt --
 * GAM-344 alone would have produced two, GAM-304 more.
 */
export function upsertRollup(description, rollupLine) {
  const block = `${ROLLUP_START}\n${rollupLine}\n${ROLLUP_END}`;
  const body = typeof description === 'string' ? description : '';

  const start = body.indexOf(ROLLUP_START);
  const end = body.indexOf(ROLLUP_END);

  if (start !== -1 && end !== -1 && end > start) {
    return body.slice(0, start) + block + body.slice(end + ROLLUP_END.length);
  }
  if (start !== -1 || end !== -1) {
    // Exactly one marker present: a truncated or hand-edited block. Appending
    // would leave two half-blocks and a rollup that never updates again.
    return `${body.trimEnd()}\n\n${block}`;
  }
  return body.trim() ? `${body.trimEnd()}\n\n${block}` : block;
}

/** Pure. Rebuilds the per-run history from this issue's own prior comments. */
export function parsePriorRuns(comments) {
  const runs = [];
  for (const c of comments ?? []) {
    const body = typeof c?.body === 'string' ? c.body : '';
    if (!body.includes(COMMENT_MARKER)) continue;

    const runId = body.match(/run \[?(\d{6,})\]?/)?.[1];
    const cost = body.match(/\*\*\$([0-9]+\.[0-9]{2})\*\*/)?.[1];
    const total = body.match(/\| tokens \| \*\*([0-9,]+)\*\* total \|/)?.[1];
    const unrecoverable = body.includes('**UNRECOVERABLE');

    runs.push({
      runId,
      cost: unrecoverable || cost === undefined ? undefined : Number(cost),
      tokens: total ? { total: Number(total.replace(/,/g, '')) } : undefined,
    });
  }
  return runs;
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function runDispatchConsumption({
  identifier,
  executionPath,
  runId,
  repo,
  conclusion,
  dryRun = false,
  gqlImpl = defaultGql,
  readFile = fs.readFileSync,
  log = console.log,
} = {}) {
  if (!identifier) {
    log('No --issue given; nothing to record.');
    return { exitCode: 0, recorded: false, reason: 'NO_IDENTIFIER' };
  }

  const file = readExecutionFile(executionPath, { readFile });
  const consumption = file.ok
    ? extractConsumption(collectObjects(file.text))
    : { ok: false, reason: file.reason, detail: file.detail };

  if (!consumption.ok) {
    log(`${identifier}: consumption UNRECOVERABLE (${consumption.reason}).`);
  } else {
    log(
      `${identifier}: ${fmtCost(consumption.cost)} notional, ` +
        `${fmtInt(consumption.tokens.total)} tokens, ${consumption.turns ?? '—'} turns.`,
    );
  }

  const body = formatComment({ consumption, runId, repo, conclusion });

  if (dryRun) {
    log('\n--- comment (dry run, nothing posted) ---\n');
    log(body);
    return { exitCode: 0, recorded: false, reason: 'DRY_RUN', consumption, body };
  }

  let issue = null;
  try {
    const { data } = await gqlImpl(ISSUE_QUERY, { id: identifier });
    issue = data?.issue ?? null;
  } catch (err) {
    log(`Could not read ${identifier}: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 0, recorded: false, reason: 'READ_FAILED', consumption };
  }

  if (!issue) {
    log(`${identifier}: not found in Linear.`);
    return { exitCode: 0, recorded: false, reason: 'ISSUE_NOT_FOUND', consumption };
  }

  try {
    await gqlImpl(COMMENT_MUTATION, { issueId: issue.id, body });
  } catch (err) {
    log(`Could not comment on ${identifier}: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 0, recorded: false, reason: 'COMMENT_FAILED', consumption };
  }

  // The rollup is derived from THIS run plus whatever prior runs the
  // description already accounted for. Reading the comments back would be the
  // more accurate source, but it costs a second round trip on every run and
  // races a comment that has only just been written; the backfill script is
  // where a full recount belongs.
  const priorLine = (issue.description ?? '').match(
    new RegExp(`${ROLLUP_START}\\n([\\s\\S]*?)\\n${ROLLUP_END}`),
  )?.[1];
  const priorCount = Number(priorLine?.match(/\*\* (\d+) run/)?.[1] ?? 0);
  const priorCost = Number(priorLine?.match(/\$([0-9.]+) notional/)?.[1] ?? 0);
  const priorTokens = Number(priorLine?.match(/· ([0-9,]+) tokens/)?.[1]?.replace(/,/g, '') ?? 0);

  const accumulated = [
    ...(priorCount > 0
      ? [{ cost: priorCost, tokens: { total: priorTokens }, durationMs: 0, synthetic: priorCount }]
      : []),
    {
      cost: consumption.ok ? consumption.cost : undefined,
      tokens: consumption.tokens,
      durationMs: consumption.durationMs,
    },
  ];
  // The synthetic prior entry stands for `priorCount` runs, not one.
  const runCount = priorCount + 1;
  const rollup = formatRollup(accumulated).replace(
    /\*\*Dispatch consumption:\*\* \d+ runs?/,
    `**Dispatch consumption:** ${runCount} run${runCount === 1 ? '' : 's'}`,
  );

  try {
    await gqlImpl(DESCRIPTION_MUTATION, {
      id: issue.id,
      description: upsertRollup(issue.description ?? '', rollup),
    });
  } catch (err) {
    log(`Comment posted, but rollup failed: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 0, recorded: true, reason: 'ROLLUP_FAILED', consumption };
  }

  log(`${identifier}: consumption recorded (comment + description rollup).`);
  return { exitCode: 0, recorded: true, reason: 'RECORDED', consumption };
}

function arg(name, argv) {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const { exitCode } = await runDispatchConsumption({
    identifier: arg('issue', argv) ?? process.env.ISSUE_IDENTIFIER,
    executionPath: arg('execution', argv) ?? process.env.EXECUTION_FILE,
    runId: arg('run-id', argv) ?? process.env.GITHUB_RUN_ID,
    repo: arg('repo', argv) ?? process.env.GITHUB_REPOSITORY,
    conclusion: arg('conclusion', argv),
    dryRun: argv.includes('--dry-run'),
  });
  process.exitCode = exitCode;
}

// Only run when invoked directly, so the test file can import the exports.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
