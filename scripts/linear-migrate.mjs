#!/usr/bin/env node
// Linear migration — reads docs/swarm/task-ledger.md, emits a payload and a
// reconciliation report, and (only with --execute) writes to Linear.
//
// DRY RUN IS THE DEFAULT. Without --execute this process makes ZERO network
// calls and writes only to docs/swarm/active/.
//
// Plain ESM rather than TypeScript on purpose: tsconfig.json includes only
// ["src", "vite.config.ts"], so scripts/ is not typechecked, and there is no
// tsx/ts-node dependency to run a .ts file with. scripts/doctor.mjs is the
// precedent.
//
// Design rules, each of which exists because this project already shipped the
// corresponding defect:
//
//   * ASSERT THE ROW COUNT. A too-strict row regex silently dropped 7 suffixed
//     ids (T002a, T073b1, …) from an earlier count and produced a smaller,
//     entirely plausible number. See LINEAR-MIGRATION.md §4.1.
//   * LOCATE COLUMNS BY HEADER NAME, never by fixed index (T512): 37 of 295
//     rows disagree with the header's column count.
//   * FAIL LOUDLY ON ANYTHING UNRECOGNISED. An unmapped status is reported and
//     the row is withheld — never defaulted. A migration that guesses produces
//     a plausible board instead of an error.
//   * NARROWED IS OPEN. Treating it as closed silently dropped T333 from every
//     count once already (T512).
//
// Usage:
//   node scripts/linear-migrate.mjs                 # dry run, writes no network calls
//   LINEAR_API_KEY=lin_api_… node scripts/linear-migrate.mjs --execute
//
// The GraphQL endpoint, client and --phase flag land together with execution;
// they are absent rather than stubbed, because dead code that fails lint is
// worse than code that does not exist yet.

import fs from 'node:fs';
import path from 'node:path';

const LEDGER = 'docs/swarm/task-ledger.md';
const OUT_DIR = 'docs/swarm/active';
const PAYLOAD_OUT = path.join(OUT_DIR, 'linear-migration-payload.json');
const REPORT_OUT = path.join(OUT_DIR, 'linear-migration-report.md');

/** Abort if the ledger does not parse to exactly this many rows. */
const EXPECTED_ROWS = 296;

const argv = process.argv.slice(2);
const EXECUTE = argv.includes('--execute');

// ---------------------------------------------------------------------------
// Ledger parsing
// ---------------------------------------------------------------------------

/** Split a markdown table row on UNESCAPED pipes only. `\|` is literal text. */
function splitCells(line) {
  return line
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((c) => c.trim());
}

// Allows suffixed corrective ids (T002a, T073b1) — the omission that cost 7 rows.
const ROW_RE = /^\|\s*T\d+[a-z0-9]*\s*\|/;

// Two rows are short a column, and they are short DIFFERENT columns — which is
// precisely why no generic rule can repair them and why they are hand-mapped.
// Each entry lists the columns actually present, in order, verified by reading
// the row. A row whose cell count stops matching its override is withheld
// rather than reinterpreted.
const UNDERFLOW_OVERRIDES = {
  // Missing `Epic`. Reading its cells as if Epic were present is the exact
  // defect that made T063's title read "worker-implementer (sonnet)" during
  // the ClickUp migration.
  T063: ['ID', 'Title', 'Worker', 'Checker', 'Deps', 'Attempts', 'Status', 'Last Result', 'Escalated'],
  // Missing `Last Result`; Status is present and Escalated still terminates.
  T330: ['ID', 'Epic', 'Title', 'Worker', 'Checker', 'Deps', 'Attempts', 'Status', 'Escalated'],
};

function parseLedger() {
  const lines = fs.readFileSync(LEDGER, 'utf8').split('\n');
  const headerIdx = lines.findIndex((l) => /^\|\s*ID\s*\|/.test(l));
  if (headerIdx < 0) throw new Error(`No header row found in ${LEDGER}`);

  const header = splitCells(lines[headerIdx]);
  const col = Object.fromEntries(header.map((name, i) => [name, i]));
  for (const required of ['ID', 'Epic', 'Title', 'Worker', 'Checker', 'Deps', 'Attempts', 'Status']) {
    if (!(required in col)) throw new Error(`Ledger header is missing the "${required}" column`);
  }

  const rows = [];
  const repaired = [];
  const handMapped = [];
  const underflow = [];

  for (const line of lines) {
    if (!ROW_RE.test(line)) continue;
    let cells = splitCells(line);
    let pick = (name) => cells[col[name]] ?? '';

    if (cells.length > header.length) {
      // Overflow is always an unescaped `|` inside the prose-heavy Last Result
      // cell. Rejoin cells 8 … n-2. Validated: 35/35 repair correctly.
      const merged = [...cells.slice(0, 8), cells.slice(8, -1).join(' | '), cells.at(-1)];
      repaired.push({ id: merged[0], from: cells.length });
      cells = merged;
    } else if (cells.length < header.length) {
      const present = UNDERFLOW_OVERRIDES[cells[0]];
      if (!present || present.length !== cells.length) {
        // Unknown short row, or a known one whose shape has changed. Withhold.
        underflow.push({ id: cells[0], cols: cells.length });
        continue;
      }
      const byName = Object.fromEntries(present.map((name, i) => [name, cells[i]]));
      pick = (name) => byName[name] ?? '';
      handMapped.push({ id: cells[0], missing: header.filter((h) => !present.includes(h)) });
    }

    rows.push({
      id: pick('ID'),
      epic: pick('Epic'),
      title: pick('Title'),
      worker: pick('Worker'),
      checker: pick('Checker'),
      deps: pick('Deps'),
      attempts: pick('Attempts'),
      status: pick('Status'),
      lastResult: pick('Last Result'),
      escalated: pick('Escalated'),
    });
  }

  // Cross-check against raw table lines — a single pattern is not a count.
  const tableLines = lines.filter((l) => l.startsWith('|')).length;
  const accounted = rows.length + underflow.length;
  return { rows, repaired, handMapped, underflow, header, tableLines, accounted };
}

// ---------------------------------------------------------------------------
// Status → Linear workflow state
//
// Ordered; first match wins. NARROWED is checked FIRST so it can never be
// swallowed by a later "resolved"/"closed" match — it is OPEN.
//
// MATCHED AGAINST THE HEAD OF THE CELL ONLY. The Status column is prose, and
// scanning the whole of it matches these words used incidentally. Measured:
// T173 is `Passed` but its prose reads "Scope narrowed at packeting time", so
// a whole-cell scan migrated a finished row as open Backlog; T156 is parked
// but contains "in flight" further along and came out In Progress. The real
// status token is always the first thing in the cell.
// ---------------------------------------------------------------------------

/** Only this many leading characters are considered the status token. */
const STATUS_HEAD = 90;

const STATUS_RULES = [
  { re: /narrowed/i, state: 'Backlog', note: 'NARROWED is open (T512)' },
  { re: /withdrawn/i, state: 'Canceled', note: 'WITHDRAWN — kept as a record, no defect' },
  { re: /voided|superseded|duplicate/i, state: 'Canceled' },
  { re: /premise unverified|unverified/i, state: 'Backlog', labels: ['gate/unverified'] },
  { re: /signed[- ]off/i, state: 'Done', note: 'owner sign-off recorded on the row' },
  { re: /\bverified\b/i, state: 'Done', note: 'verified by measurement (after the `unverified` rule — that string contains this one)' },
  { re: /park(ed)?\b|for later/i, state: 'Backlog', note: 'owner parked it — open, not closed' },
  { re: /in review|awaiting review/i, state: 'In Review' },
  { re: /in progress|in flight/i, state: 'In Progress' },
  { re: /closed|merged|passed|pass\b|✅|shipped|applied/i, state: 'Done' },
  { re: /ready to work/i, state: 'Todo' },
  { re: /human gate/i, state: 'Todo', labels: ['gate/human'] },
  { re: /blocked/i, state: 'Backlog' },
  { re: /reserved|deferred/i, state: 'Backlog' },
  { re: /filed|open/i, state: 'Backlog' },
];

const OPEN_STATES = new Set(['Backlog', 'Todo', 'In Progress', 'In Review']);

function normaliseStatus(raw) {
  const text = (raw || '').replace(/\*/g, '').slice(0, STATUS_HEAD);
  for (const rule of STATUS_RULES) {
    if (rule.re.test(text)) return { state: rule.state, labels: rule.labels ?? [], note: rule.note };
  }
  return null; // caller reports it; the row is withheld
}

// ---------------------------------------------------------------------------
// Area — from the id block, WITH the documented exceptions.
//
// WORKFLOWS.md: "the block is a collision-avoidance reservation, not an
// ownership claim." Deriving area from the number alone silently misfiles
// these, so they are encoded explicitly.
// ---------------------------------------------------------------------------

const AREA_BY_BLOCK = { 4: 'w1', 5: 'w2', 6: 'w3', 7: 'w4', 8: 'w5' };
const AREA_OVERRIDES = {
  T508: 'w3', T510: 'w3', T511: 'w3', // filed under W2's block, live on W3's surface
  T509: 'w4', //                        filed under W2's block, is W4's metric SQL
  T507: null, //                        explicitly an unowned surface
};

function areaFor(id) {
  if (id in AREA_OVERRIDES) return AREA_OVERRIDES[id];
  const n = Number((id.match(/^T(\d+)/) || [])[1]);
  if (!Number.isFinite(n) || n < 400) return null; // pre-dates the W-block scheme
  return AREA_BY_BLOCK[Math.floor(n / 100)] ?? null;
}

// ---------------------------------------------------------------------------
// Tier — only meaningful for rows that can still be dispatched.
//
// Closed rows get a tier label ONLY when their own text records one; they are
// never marked `unreviewed`, because a finished row needs no dispatch decision.
// Open rows with no recorded tier get `unreviewed` — deliberately NOT a
// defaulted `standard`, which would be indistinguishable from a judged one.
// See LINEAR-MIGRATION.md §1.4.
// ---------------------------------------------------------------------------

function tierFor(row, isOpen) {
  const hay = `${row.status} ${row.lastResult}`;
  if (/\bHEAVY\b/.test(hay)) return 'tier/heavy';
  if (/\bSTANDARD\b/.test(hay)) return 'tier/standard';
  if (/\bFAST\b/.test(hay)) return 'tier/fast';
  return isOpen ? 'tier/unreviewed' : null;
}

function depsFor(row) {
  const raw = row.deps || '';
  if (/^(—|-|none|n\/a)?$/i.test(raw.trim())) return [];
  return [...new Set((raw.match(/T\d+[a-z0-9]*/g) || []))];
}

/** Rebuild a full, lossless description: prose first, provenance appended. */
function buildDescription(row, statusNote) {
  const esc = (s) => (s || '—').trim();
  return [
    esc(row.lastResult),
    '',
    '---',
    '',
    '**Ledger provenance** — migrated verbatim from `docs/swarm/task-ledger.md`.',
    '',
    `| Field | Value |`,
    `| -- | -- |`,
    `| Legacy ID | \`${row.id}\` |`,
    `| Epic | ${esc(row.epic)} |`,
    `| Worker | ${esc(row.worker)} |`,
    `| Checker | ${esc(row.checker)} |`,
    `| Attempts | ${esc(row.attempts)} |`,
    `| Deps | ${esc(row.deps)} |`,
    `| Escalated | ${esc(row.escalated)} |`,
    `| Original status | ${esc(row.status)} |`,
    statusNote ? `\n> Status mapping note: ${statusNote}` : '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build() {
  const parsed = parseLedger();
  const issues = [];
  const unmapped = [];

  for (const row of parsed.rows) {
    const mapped = normaliseStatus(row.status);
    if (!mapped) {
      unmapped.push({ id: row.id, status: row.status.slice(0, 90) });
      continue;
    }
    const isOpen = OPEN_STATES.has(mapped.state);
    const labels = [...mapped.labels];
    const area = areaFor(row.id);
    if (area) labels.push(`area/${area}`);
    const tier = tierFor(row, isOpen);
    if (tier) labels.push(tier);
    if (/resolved|yes/i.test(row.escalated)) labels.push('escalated');

    issues.push({
      legacyId: row.id,
      title: `${row.id} — ${row.title}`,
      description: buildDescription(row, mapped.note),
      state: mapped.state,
      open: isOpen,
      labels,
      blockedBy: depsFor(row),
    });
  }
  return { ...parsed, issues, unmapped };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function tally(list, keyFn) {
  const m = new Map();
  for (const x of list) m.set(keyFn(x), (m.get(keyFn(x)) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function writeReport(b) {
  const openCt = b.issues.filter((i) => i.open).length;
  const L = [];
  L.push('# Linear migration — dry-run reconciliation report');
  L.push('');
  L.push('Generated by `scripts/linear-migrate.mjs`. **Nothing was written to Linear.**');
  L.push('');
  L.push('## Reconciliation');
  L.push('');
  L.push('| Check | Value |');
  L.push('| -- | -- |');
  L.push(`| Rows parsed | **${b.rows.length}** |`);
  L.push(`| Expected | ${EXPECTED_ROWS} |`);
  L.push(`| Rows repaired (column overflow) | ${b.repaired.length} |`);
  L.push(`| Rows hand-mapped (column underflow) | ${b.handMapped.length} |`);
  L.push(`| Rows withheld (column underflow) | ${b.underflow.length} |`);
  L.push(`| Rows withheld (unmapped status) | ${b.unmapped.length} |`);
  L.push(`| Issues to create | **${b.issues.length}** |`);
  L.push(`| … of which active | ${openCt} |`);
  L.push(`| … of which archived on arrival | ${b.issues.length - openCt} |`);
  L.push(`| Active vs 250 free-plan cap | ${openCt} / 250 |`);
  L.push('');

  if (b.underflow.length) {
    L.push('## ⚠ Withheld — column underflow (needs a hand-written override)');
    L.push('');
    for (const u of b.underflow) L.push(`- \`${u.id}\` — ${u.cols} columns, expected ${b.header.length}`);
    L.push('');
  }
  if (b.unmapped.length) {
    L.push('## ⚠ Withheld — unmapped status (add a rule, do NOT default)');
    L.push('');
    for (const u of b.unmapped) L.push(`- \`${u.id}\` — \`${u.status}\``);
    L.push('');
  }

  for (const [name, pairs] of [
    ['State', tally(b.issues, (i) => i.state)],
    ['Labels', tally(b.issues.flatMap((i) => i.labels), (x) => x)],
  ]) {
    L.push(`## ${name}`);
    L.push('');
    L.push('| Value | Rows |');
    L.push('| -- | -- |');
    for (const [k, n] of pairs) L.push(`| \`${k}\` | ${n} |`);
    L.push('');
  }

  const known = new Set(b.issues.map((i) => i.legacyId));
  const danglingDeps = [...new Set(b.issues.flatMap((i) => i.blockedBy).filter((d) => !known.has(d)))];
  L.push('## Relations');
  L.push('');
  L.push(`- \`blockedBy\` edges: **${b.issues.reduce((n, i) => n + i.blockedBy.length, 0)}**`);
  L.push(`- Dangling (target not migrated): ${danglingDeps.length ? danglingDeps.join(', ') : 'none'}`);
  L.push('');

  L.push('## Every id, in order — spot-check this list');
  L.push('');
  L.push('```');
  const ids = b.issues.map((i) => i.legacyId);
  for (let i = 0; i < ids.length; i += 10) L.push(ids.slice(i, i + 10).join(' '));
  L.push('```');

  fs.writeFileSync(REPORT_OUT, L.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Execute (only with --execute)
// ---------------------------------------------------------------------------

async function execute() {
  throw new Error(
    [
      'Execution is intentionally not wired yet.',
      '',
      'The dry run must be reviewed and its report signed off first — that review',
      'is the substitute for a premise gate (LINEAR-MIGRATION.md §9), and it is the',
      'step the ClickUp migration skipped, which is why its payload shipped with',
      'silently truncated cells.',
      '',
      `Report: ${REPORT_OUT}`,
      `Payload: ${PAYLOAD_OUT}`,
    ].join('\n'),
  );
}

// ---------------------------------------------------------------------------

async function main() {
  const b = build();

  console.log(`parsed        : ${b.rows.length} rows (expected ${EXPECTED_ROWS})`);
  console.log(`repaired      : ${b.repaired.length} overflow, ${b.handMapped.length} hand-mapped underflow`);
  console.log(`withheld      : ${b.underflow.length} underflow, ${b.unmapped.length} unmapped status`);
  console.log(`issues        : ${b.issues.length}  (${b.issues.filter((i) => i.open).length} active)`);
  console.log(`table lines   : ${b.tableLines} raw, ${b.accounted} accounted for`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(PAYLOAD_OUT, JSON.stringify(b.issues, null, 2) + '\n');
  writeReport(b);
  console.log(`\nwrote ${PAYLOAD_OUT}\nwrote ${REPORT_OUT}`);

  const discovered = b.rows.length + b.underflow.length;
  if (discovered !== EXPECTED_ROWS) {
    console.error(
      `\nABORT: discovered ${discovered} rows but expected ${EXPECTED_ROWS}.\n` +
        'Either the ledger changed (update EXPECTED_ROWS deliberately) or the row\n' +
        'pattern is dropping rows again. A count that moved silently is the defect\n' +
        'this check exists to catch — see LINEAR-MIGRATION.md §4.1.',
    );
    process.exit(1);
  }

  if (!EXECUTE) {
    console.log('\nDRY RUN — no network calls made. Review the report, then re-run with --execute.');
    return;
  }
  await execute();
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
