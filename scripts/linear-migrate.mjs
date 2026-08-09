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
//   LINEAR_API_KEY=lin_api_… node scripts/linear-migrate.mjs --execute --limit=5   # cautious first run
//   LINEAR_API_KEY=lin_api_… node scripts/linear-migrate.mjs --execute             # the rest
//
// Execution is idempotent: every issue is keyed by the `Tnnn` prefixing its
// title, existing issues are read back before anything is created, and a
// checkpoint file records what landed. Re-running resumes; it does not
// duplicate. Relations are created BEFORE archiving so both ends are still
// active, and archiving is last because it is the only step that is awkward to
// undo (there is no delete in the MCP surface, though issueDelete exists here).

import fs from 'node:fs';
import path from 'node:path';

const LEDGER = 'docs/swarm/task-ledger.md';
const OUT_DIR = 'docs/swarm/active';
const PAYLOAD_OUT = path.join(OUT_DIR, 'linear-migration-payload.json');
const REPORT_OUT = path.join(OUT_DIR, 'linear-migration-report.md');

/** Abort if the ledger does not parse to exactly this many rows. */
const EXPECTED_ROWS = 300;

const argv = process.argv.slice(2);
const EXECUTE = argv.includes('--execute');
/** Cap how many issues a single run creates — use a small value for a first real run. */
const LIMIT = Number((argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || null;
const TEAM_NAME = 'Gamitch';

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

const API = 'https://api.linear.app/graphql';
const CHECKPOINT = path.join(OUT_DIR, 'linear-migration-checkpoint.json');

/** Abort rather than get throttled mid-migration. */
const RATE_FLOOR = 150;

/** Label groups, with the descriptions that carry their meaning. */
const LABEL_SPECS = [
  ['tier', 'Process tier per constitution item 26 — triggered by risk, not topic or ticket size.'],
  ['tier/fast', 'Orchestrator implements directly. No packet, no worker, no checker. Verification is NOT reduced.'],
  ['tier/standard', 'Worker implements, orchestrator replays the mutation. No separate checker round.'],
  ['tier/heavy', 'Packet + premise gate + worker + checker. Required for write paths, RLS/auth, migrations, metric SQL.'],
  ['tier/unreviewed', 'No tier judged yet. A row carrying this must NOT be moved to In Progress until it is tiered.'],
  ['area', 'Workflow surface. A label, not a project — see LINEAR-MIGRATION.md §1.3.'],
  ...['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10'].map((w) => [`area/${w}`, `Workflow ${w.toUpperCase()}.`]),
  ['gate', 'Premise-gate state (constitution item 19).'],
  ['gate/human', 'Requires the human owner. No machine may close this.'],
  ['gate/unverified', 'Premise measured as unverified or partly false — re-measure before packeting.'],
  ['escalated', 'Escalated to boss-arbiter or the human owner.'],
];

let requestCount = 0;

async function gql(query, variables) {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error('LINEAR_API_KEY is not set — refusing to run --execute.');
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  requestCount += 1;
  const remaining = Number(res.headers.get('x-ratelimit-requests-remaining') ?? NaN);
  if (Number.isFinite(remaining) && remaining < RATE_FLOOR) {
    throw new Error(
      `Rate-limit floor reached: ${remaining} requests left this hour (floor ${RATE_FLOOR}).\n` +
        `Stopping cleanly — ${requestCount} requests made. Re-run the same command after the window\n` +
        'resets; the checkpoint makes it resume rather than duplicate.',
    );
  }
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  return { data: json.data, remaining };
}

function loadCheckpoint() {
  try {
    return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  } catch {
    return { created: {}, archived: [], related: [] };
  }
}

function saveCheckpoint(cp) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2) + '\n');
}

/** Every issue already in the workspace, keyed by the `Tnnn` its title starts with. */
async function fetchExistingByLegacyId(teamId) {
  const map = {};
  let cursor = null;
  do {
    const { data } = await gql(
      `query($teamId:String!,$after:String){ team(id:$teamId){ issues(first:250, after:$after,
         includeArchived:true){ nodes{ id title } pageInfo{ hasNextPage endCursor } } } }`,
      { teamId, after: cursor },
    );
    for (const n of data.team.issues.nodes) {
      const m = n.title.match(/^(T\d+[a-z0-9]*)\s+—/);
      if (m) map[m[1]] = n.id;
    }
    cursor = data.team.issues.pageInfo.hasNextPage ? data.team.issues.pageInfo.endCursor : null;
  } while (cursor);
  return map;
}

async function ensureLabels(teamId) {
  const { data } = await gql(
    `query($teamId:String!){ team(id:$teamId){ labels(first:250){ nodes{ id name parent{ name } } } } }`,
    { teamId },
  );
  const byPath = {};
  for (const l of data.team.labels.nodes) byPath[l.parent ? `${l.parent.name}/${l.name}` : l.name] = l.id;

  for (const [spec, description] of LABEL_SPECS) {
    if (byPath[spec]) continue;
    const [head, child] = spec.split('/');
    const isGroup = !child;
    const parentId = child ? byPath[head] : undefined;
    if (child && !parentId) throw new Error(`Label group "${head}" must exist before "${spec}"`);
    const { data: d } = await gql(
      `mutation($input:IssueLabelCreateInput!){ issueLabelCreate(input:$input){ issueLabel{ id } } }`,
      { input: { name: child ?? head, description, teamId, isGroup: isGroup || undefined, parentId } },
    );
    byPath[spec] = d.issueLabelCreate.issueLabel.id;
    console.log(`  + label ${spec}`);
  }
  return byPath;
}

async function execute(b) {
  const cp = loadCheckpoint();
  console.log('\n--- EXECUTE ---');

  const { data: me } = await gql(`{ viewer{ id name } teams(first:10){ nodes{ id key name } } }`);
  const team = me.teams.nodes.find((t) => t.name === TEAM_NAME) ?? me.teams.nodes[0];
  if (!team) throw new Error('No team found on this account.');
  console.log(`viewer ${me.viewer.name} · team ${team.name} (${team.key})`);

  const { data: st } = await gql(
    `query($teamId:String!){ team(id:$teamId){ states(first:50){ nodes{ id name } } } }`,
    { teamId: team.id },
  );
  const stateId = Object.fromEntries(st.team.states.nodes.map((s) => [s.name, s.id]));
  const missingStates = [...new Set(b.issues.map((i) => i.state))].filter((s) => !stateId[s]);
  if (missingStates.length) throw new Error(`Team is missing workflow states: ${missingStates.join(', ')}`);

  const labelId = await ensureLabels(team.id);
  const existing = await fetchExistingByLegacyId(team.id);
  Object.assign(cp.created, existing); // anything already there counts as created
  saveCheckpoint(cp);
  console.log(`already present: ${Object.keys(existing).length} issue(s)`);

  // --- create ------------------------------------------------------------
  const todo = b.issues.filter((i) => !cp.created[i.legacyId]).slice(0, LIMIT ?? Infinity);
  console.log(`creating ${todo.length} issue(s)…`);
  for (const [n, issue] of todo.entries()) {
    const labelIds = issue.labels.map((l) => labelId[l]).filter(Boolean);
    const { data, remaining } = await gql(
      `mutation($input:IssueCreateInput!){ issueCreate(input:$input){ issue{ id identifier } } }`,
      {
        input: {
          teamId: team.id,
          title: issue.title,
          description: issue.description,
          stateId: stateId[issue.state],
          labelIds,
        },
      },
    );
    cp.created[issue.legacyId] = data.issueCreate.issue.id;
    if (n % 10 === 0 || n === todo.length - 1) {
      saveCheckpoint(cp);
      console.log(`  ${n + 1}/${todo.length}  ${issue.legacyId} -> ${data.issueCreate.issue.identifier}  (quota ${remaining})`);
    }
  }
  saveCheckpoint(cp);

  // --- relations BEFORE archiving, so both ends are still active ----------
  const known = new Set(Object.keys(cp.created));
  const edges = [];
  for (const i of b.issues) {
    for (const dep of i.blockedBy) {
      if (!known.has(dep) || !known.has(i.legacyId)) continue;
      const sig = `${dep}->${i.legacyId}`;
      if (!cp.related.includes(sig)) edges.push({ sig, blocker: dep, blocked: i.legacyId });
    }
  }
  console.log(`creating ${edges.length} blockedBy relation(s)…`);
  for (const e of edges) {
    await gql(
      `mutation($input:IssueRelationCreateInput!){ issueRelationCreate(input:$input){ success } }`,
      { input: { issueId: cp.created[e.blocker], relatedIssueId: cp.created[e.blocked], type: 'blocks' } },
    );
    cp.related.push(e.sig);
    if (cp.related.length % 10 === 0) saveCheckpoint(cp);
  }
  saveCheckpoint(cp);

  // --- archive the closed ones LAST ---------------------------------------
  const toArchive = b.issues.filter((i) => !i.open && cp.created[i.legacyId] && !cp.archived.includes(i.legacyId));
  console.log(`archiving ${toArchive.length} closed issue(s)…`);
  for (const [n, issue] of toArchive.entries()) {
    await gql(`mutation($id:String!){ issueArchive(id:$id){ success } }`, { id: cp.created[issue.legacyId] });
    cp.archived.push(issue.legacyId);
    if (n % 25 === 0 || n === toArchive.length - 1) {
      saveCheckpoint(cp);
      console.log(`  archived ${n + 1}/${toArchive.length}`);
    }
  }
  saveCheckpoint(cp);

  console.log(
    `\nDONE. ${Object.keys(cp.created).length} issues, ${cp.related.length} relations, ` +
      `${cp.archived.length} archived, in ${requestCount} requests.\nCheckpoint: ${CHECKPOINT}`,
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
