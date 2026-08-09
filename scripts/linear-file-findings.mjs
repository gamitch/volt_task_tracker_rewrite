#!/usr/bin/env node
// File a skill's findings into Linear's Backlog.
//
// WHY. PR #118's persona harness found four unfixed UI bugs and recorded them
// in a PR body and an HTML artifact. On the day it merged, none had a ledger
// row and `events.created_by` appeared zero times anywhere in the project's
// records. That is constitution item 20's exact failure mode, and a merged PR
// body is worse than a code comment — the comment at least sits beside the code
// someone will edit.
//
// DRY RUN IS THE DEFAULT. Without --execute this makes ZERO network calls
// beyond reading, and creates nothing. A run that files forty issues unreviewed
// poisons a board faster than any of them get fixed.
//
// Input: docs/swarm/inbox/<branch>-findings.json, schema in
// docs/swarm/active/FINDINGS-PIPELINE.md. The e2e-personas skill emits it.
//
// Usage:
//   node scripts/linear-file-findings.mjs docs/swarm/inbox/foo-findings.json
//   LINEAR_API_KEY=… node scripts/linear-file-findings.mjs <file> --execute

import fs from 'node:fs';
import { gql, paginate, resolveTeam, requestsMade } from './linear/client.mjs';

const TEAM_NAME = 'Gamitch';
const EXECUTE = process.argv.includes('--execute');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--'));

/** Findings always land here. Filing is not dispatching (constitution item 28). */
const LANDING_STATE = 'Backlog';

/** Never a defaulted tier — "not yet judged" must stay distinguishable. */
const DEFAULT_TIER = 'tier/unreviewed';

const SEVERITIES = new Set(['BLOCKER', 'MAJOR', 'MINOR', 'NIT']);
const VERIFIED_BY = new Set(['browser', 'mutation', 'database', 'source']);

function fail(msg) {
  console.error(`\n${msg}`);
  process.exit(1);
}

function validate(doc) {
  if (!FILE) fail('Usage: node scripts/linear-file-findings.mjs <findings.json> [--execute]');
  if (typeof doc.source !== 'string' || !doc.source) fail('ABORT: `source` is required.');
  if (!Array.isArray(doc.findings)) fail('ABORT: `findings` must be an array (use [] for none).');

  const keys = new Set();
  doc.findings.forEach((f, i) => {
    const at = `findings[${i}]`;
    for (const req of ['findingKey', 'title', 'severity', 'verifiedBy']) {
      if (!f[req]) fail(`ABORT: ${at} is missing \`${req}\`.`);
    }
    if (!SEVERITIES.has(f.severity)) {
      fail(`ABORT: ${at}.severity is "${f.severity}"; expected one of ${[...SEVERITIES].join(', ')}.`);
    }
    if (!VERIFIED_BY.has(f.verifiedBy)) {
      fail(`ABORT: ${at}.verifiedBy is "${f.verifiedBy}"; expected one of ${[...VERIFIED_BY].join(', ')}.`);
    }
    if (keys.has(f.findingKey)) fail(`ABORT: duplicate findingKey "${f.findingKey}" within this file.`);
    keys.add(f.findingKey);
  });
}

/** The issue body. `Finding-Key:` is the dedupe identity and must survive edits. */
function buildBody(f, doc) {
  const L = [];
  if (f.observed || f.expected) {
    L.push('| | |', '| -- | -- |');
    if (f.observed) L.push(`| Observed | ${String(f.observed).replace(/\|/g, '\\|')} |`);
    if (f.expected) L.push(`| Expected | ${String(f.expected).replace(/\|/g, '\\|')} |`);
    L.push('');
  }
  for (const e of f.evidence ?? []) {
    L.push(`**\`${e.file}${e.line ? `:${e.line}` : ''}\`**`);
    if (e.quote) L.push('', '```', e.quote, '```');
    L.push('');
  }
  if (f.proposedScope) L.push('**Proposed scope** (a candidate, not a prescription)', '', f.proposedScope, '');
  if (f.reproduction) L.push('**Reproduce**', '', '```bash', f.reproduction, '```', '');
  L.push('---', '');
  L.push(`**Severity** ${f.severity} · **Verified by** \`${f.verifiedBy}\` · **Source** \`${doc.source}\``);
  if (doc.commit) L.push(`Measured against \`${doc.commit}\`${doc.branch ? ` on \`${doc.branch}\`` : ''}.`);
  L.push('');
  L.push('This was filed automatically and is an input to triage, not a verdict.');
  L.push('Re-verify before acting: this project has filed rows on premises that turned out false.');
  L.push('');
  L.push(`Finding-Key: ${f.findingKey}`);
  return L.join('\n');
}

function labelsFor(f, doc) {
  const out = [DEFAULT_TIER, `provenance/${doc.source}`];
  if (f.area) out.push(`area/${f.area}`);
  return out;
}

async function main() {
  if (!FILE || !fs.existsSync(FILE)) fail(`ABORT: findings file not found: ${FILE ?? '(none given)'}`);
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  validate(doc);

  if (doc.findings.length === 0) {
    console.log(`${FILE}: 0 findings — an explicit claim that the run looked and found nothing.`);
    return;
  }

  const team = await resolveTeam(TEAM_NAME);

  // Dedupe against Finding-Key already in the workspace, so re-running a suite
  // that finds the same four bugs does not file them a second time.
  const existing = await paginate(
    // first:50, not 100. Linear caps a single query at 10,000 complexity points
    // and the export's first version blew that at 22,861 by paging too wide.
    // Descriptions are large; there is no reason to sail close to the limit.
    `query($teamId:String!,$after:String){ team(id:$teamId){ issues(first:50, after:$after,
       includeArchived:true){ nodes{ identifier description } pageInfo{ hasNextPage endCursor } } } }`,
    { teamId: team.id },
    (d) => d.team.issues,
  );
  const seen = new Map();
  for (const i of existing) {
    const m = (i.description ?? '').match(/^Finding-Key:\s*(\S+)\s*$/m);
    if (m) seen.set(m[1], i.identifier);
  }

  const fresh = doc.findings.filter((f) => !seen.has(f.findingKey));
  const dupes = doc.findings.filter((f) => seen.has(f.findingKey));

  console.log(`${FILE}`);
  console.log(`  source     : ${doc.source}`);
  console.log(`  findings   : ${doc.findings.length}`);
  console.log(`  already filed: ${dupes.length}${dupes.length ? ` (${dupes.map((f) => `${f.findingKey}→${seen.get(f.findingKey)}`).join(', ')})` : ''}`);
  console.log(`  to file    : ${fresh.length}`);
  for (const f of fresh) {
    console.log(`    [${f.severity}] ${f.title.slice(0, 68)}`);
    console.log(`      labels: ${labelsFor(f, doc).join(', ')}  state: ${LANDING_STATE}`);
  }

  if (!EXECUTE) {
    console.log('\nDRY RUN — nothing created. Review the above, then re-run with --execute.');
    return;
  }
  if (fresh.length === 0) {
    console.log('\nNothing to file.');
    return;
  }

  const { data: st } = await gql(
    `query($teamId:String!){ team(id:$teamId){ states(first:50){ nodes{ id name } }
       labels(first:250){ nodes{ id name parent{ name } } } } }`,
    { teamId: team.id },
  );
  const stateId = st.team.states.nodes.find((s) => s.name === LANDING_STATE)?.id;
  if (!stateId) fail(`ABORT: team has no "${LANDING_STATE}" state.`);
  const labelId = Object.fromEntries(
    st.team.labels.nodes.map((l) => [l.parent ? `${l.parent.name}/${l.name}` : l.name, l.id]),
  );

  for (const f of fresh) {
    const wanted = labelsFor(f, doc);
    const missing = wanted.filter((l) => !labelId[l]);
    if (missing.length) {
      // Do not invent labels mid-run: a typo'd area would file work into a
      // group nobody filters on. Report and stop.
      fail(`ABORT: labels do not exist in the workspace: ${missing.join(', ')}\nCreate them first.`);
    }
    const { data } = await gql(
      `mutation($input:IssueCreateInput!){ issueCreate(input:$input){ issue{ identifier url } } }`,
      {
        input: {
          teamId: team.id,
          title: f.title,
          description: buildBody(f, doc),
          stateId,
          labelIds: wanted.map((l) => labelId[l]),
        },
      },
    );
    console.log(`  + ${data.issueCreate.issue.identifier}  ${f.findingKey}`);
  }
  console.log(`\nFiled ${fresh.length} to ${LANDING_STATE} in ${requestsMade()} requests.`);
  console.log('Filing is not dispatching — promote to Todo when you want one worked.');
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
