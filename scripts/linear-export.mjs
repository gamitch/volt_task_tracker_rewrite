#!/usr/bin/env node
// Export every Linear issue back into git, so the project's memory does not
// live only on someone else's server.
//
// WHY THIS EXISTS. `docs/swarm/task-ledger.md` is being frozen because a
// hand-maintained Markdown table failed three measured ways: T063b was merged
// work with no row at all, WORKFLOWS.md claimed 40 open rows against a true 50,
// and eleven rows recorded their closure in the Epic column where no parser
// would find it. Linear cannot make those mistakes — its state is a field, not
// a cell someone picks.
//
// But Linear is a hosted service on a free plan. If the account lapses the
// history goes with it. This writes it back to git, where it is diffable,
// greppable offline, and outlives any vendor.
//
// STRICTLY ONE DIRECTION. Linear is the source of truth; these files are a
// backup. Nothing here ever writes to Linear, and the outputs are regenerated
// whole on every run — never hand-edited, never merged into. That is the entire
// point: every ledger failure above came from hand-maintenance, and a generated
// file cannot put a closure in the wrong column.
//
// Two formats on purpose. The JSON is what you would restore *from* — complete
// and exact. The Markdown is what a human greps and what git diffs
// meaningfully; a 300-issue JSON blob churns unreadably and nobody opens it.
//
// Usage:
//   LINEAR_API_KEY=lin_api_… node scripts/linear-export.mjs
//   LINEAR_API_KEY=lin_api_… node scripts/linear-export.mjs --check   # CI: fail if stale

import fs from 'node:fs';
import path from 'node:path';
import { gql, paginate, resolveTeam, requestsMade } from './linear/client.mjs';

const OUT_DIR = 'docs/swarm';
const JSON_OUT = path.join(OUT_DIR, 'linear-export.json');
const MD_OUT = path.join(OUT_DIR, 'linear-export.md');
const TEAM_NAME = 'Gamitch';

const CHECK = process.argv.includes('--check');

// Page size and every nested connection are bounded deliberately. Linear caps a
// single query at 10,000 complexity points, and complexity multiplies: an
// unbounded nested connection defaults to a large page and is charged per outer
// node. The first version of this query used first:100 with `labels`,
// `relations` and `inverseRelations` all unbounded and cost **22,861** — it
// could never have run. 25 x (20+20+20) leaves a wide margin.
const PAGE = 25;

const ISSUES_QUERY = `
  query($teamId:String!, $after:String) {
    team(id:$teamId) {
      issues(first:${PAGE}, after:$after, includeArchived:true) {
        nodes {
          identifier title description url
          createdAt updatedAt completedAt canceledAt archivedAt
          state { name type }
          labels(first:20) { nodes { name parent { name } } }
          assignee { name }
          relations(first:20) { nodes { type relatedIssue { identifier } } }
          inverseRelations(first:20) { nodes { type issue { identifier } } }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

// Identifier-only, so it is cheap enough to page in large chunks. This exists
// to cross-check the expensive walk above; it must paginate too, or it counts
// one page and the check compares 301 against a page size.
const COUNT_QUERY = `
  query($teamId:String!, $after:String) {
    team(id:$teamId) {
      issues(first:250, after:$after, includeArchived:true) {
        nodes { identifier }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

/** `Tnnn` if the title carries one — the bridge to 300 rows of cross-references. */
function legacyIdOf(title) {
  const m = title.match(/^(T\d+[a-z0-9]*)\s+—/);
  return m ? m[1] : null;
}

function labelPaths(issue) {
  return issue.labels.nodes
    .map((l) => (l.parent ? `${l.parent.name}/${l.name}` : l.name))
    .sort();
}

function toRecord(issue) {
  return {
    identifier: issue.identifier,
    legacyId: legacyIdOf(issue.title),
    title: issue.title,
    state: issue.state.name,
    stateType: issue.state.type,
    archived: Boolean(issue.archivedAt),
    labels: labelPaths(issue),
    assignee: issue.assignee?.name ?? null,
    blockedBy: issue.inverseRelations.nodes
      .filter((r) => r.type === 'blocks')
      .map((r) => r.issue.identifier)
      .sort(),
    blocks: issue.relations.nodes
      .filter((r) => r.type === 'blocks')
      .map((r) => r.relatedIssue.identifier)
      .sort(),
    createdAt: issue.createdAt,
    completedAt: issue.completedAt,
    canceledAt: issue.canceledAt,
    url: issue.url,
    description: issue.description ?? '',
  };
}

const BANNER =
  'GENERATED FILE — DO NOT EDIT. Regenerated whole by `scripts/linear-export.mjs`.\n' +
  'Linear is the source of truth; this is a backup so the history survives the account.\n' +
  'Edits here are lost on the next run and change nothing in Linear.';

function renderMarkdown(records, meta) {
  const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
  const open = records.filter((r) => !['completed', 'canceled'].includes(r.stateType));

  const L = [];
  L.push('# Linear export — VOLT Team Portal');
  L.push('');
  for (const line of BANNER.split('\n')) L.push(`> **${line}**`);
  L.push('');
  L.push(`Exported ${meta.exportedAt} from team \`${meta.team}\`.`);
  L.push('');
  L.push(`- **${records.length}** issues (${records.filter((r) => r.archived).length} archived)`);
  L.push(`- **${open.length}** not yet completed or cancelled`);
  L.push(`- ${records.filter((r) => r.legacyId).length} carry a legacy \`Tnnn\` id`);
  L.push('');
  L.push('## Open');
  L.push('');
  L.push('| Issue | Legacy | State | Labels | Title |');
  L.push('| -- | -- | -- | -- | -- |');
  for (const r of open.sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))) {
    L.push(`| [${r.identifier}](${r.url}) | ${r.legacyId ?? '—'} | ${r.state} | ${r.labels.join(' ') || '—'} | ${esc(r.title)} |`);
  }
  L.push('');
  L.push('## Closed and cancelled');
  L.push('');
  L.push('| Issue | Legacy | State | Title |');
  L.push('| -- | -- | -- | -- |');
  const closed = records
    .filter((r) => ['completed', 'canceled'].includes(r.stateType))
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));
  for (const r of closed) {
    L.push(`| [${r.identifier}](${r.url}) | ${r.legacyId ?? '—'} | ${r.state} | ${esc(r.title)} |`);
  }
  L.push('');
  L.push('Full descriptions, relations and timestamps are in `linear-export.json`.');
  return L.join('\n') + '\n';
}

async function main() {
  const team = await resolveTeam(TEAM_NAME);
  const issues = await paginate(ISSUES_QUERY, { teamId: team.id }, (d) => d.team.issues);

  const records = issues
    .map(toRecord)
    .sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }));

  // A count that cannot be cross-checked is not a count. This walk is
  // independent of the one above and cheap; if the two disagree, pagination
  // dropped something and a truncated backup is worse than none.
  const ids = await paginate(COUNT_QUERY, { teamId: team.id }, (d) => d.team.issues);
  if (ids.length !== records.length) {
    const missing = ids
      .map((i) => i.identifier)
      .filter((i) => !records.some((r) => r.identifier === i));
    throw new Error(
      `ABORT: exported ${records.length} issues but the team has ${ids.length}. ` +
        `Refusing to write a partial backup.${missing.length ? ` Missing: ${missing.slice(0, 10).join(', ')}` : ''}`,
    );
  }

  const meta = {
    exportedAt: new Date().toISOString(),
    team: team.name,
    teamKey: team.key,
    issueCount: records.length,
    generator: 'scripts/linear-export.mjs',
    note: BANNER,
  };

  const json = JSON.stringify({ meta, issues: records }, null, 2) + '\n';
  const md = renderMarkdown(records, meta);

  if (CHECK) {
    // Compare ignoring the timestamp, which changes every run by design.
    const strip = (s) => s.replace(/"exportedAt": "[^"]*"/, '').replace(/^Exported .*$/m, '');
    const stale = [
      [JSON_OUT, json],
      [MD_OUT, md],
    ].filter(([f, want]) => {
      const have = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      return strip(have) !== strip(want);
    });
    if (stale.length) {
      console.error(`STALE: ${stale.map(([f]) => f).join(', ')} — re-run scripts/linear-export.mjs`);
      process.exit(1);
    }
    console.log(`up to date — ${records.length} issues, ${requestsMade()} requests`);
    return;
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(JSON_OUT, json);
  fs.writeFileSync(MD_OUT, md);
  console.log(
    `exported ${records.length} issues (${records.filter((r) => r.archived).length} archived) ` +
      `in ${requestsMade()} requests\n  ${JSON_OUT}\n  ${MD_OUT}`,
  );
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
