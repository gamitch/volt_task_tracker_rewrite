// Shared Linear GraphQL client for scripts/linear-*.mjs.
//
// scripts/linear-migrate.mjs deliberately does NOT import this. That script is
// finished work — it ran once, moved 296 rows, and its own copy of this logic
// is what was actually exercised. Refactoring it now would risk the one thing
// known to work in exchange for tidiness.
//
// Direct GraphQL rather than the Linear MCP server, for three measured reasons:
//   * MCP returns JSON bodies only, so the x-ratelimit-* headers — the whole
//     reason Linear is safer than ClickUp — are invisible through it.
//   * MCP exposes no issue delete, so a bad run cannot be undone.
//   * A script can be read before it runs. Six hundred tool calls cannot.

const API = 'https://api.linear.app/graphql';

/** Stop this far from the wall so a run ends cleanly rather than mid-write. */
const RATE_FLOOR = 150;

let requestCount = 0;

export function requestsMade() {
  return requestCount;
}

export async function gql(query, variables = {}) {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error('LINEAR_API_KEY is not set.');

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
        `Stopped after ${requestCount} requests. The measured limit is 2500/hour on a rolling window.`,
    );
  }

  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  return { data: json.data, remaining };
}

/**
 * Walk a Relay connection to exhaustion.
 *
 * `select(data)` must return the connection node — the `{ nodes, pageInfo }`
 * object itself. Paging stops only on `hasNextPage: false`, never on a page
 * count, because a cap that silently truncates is the defect this project has
 * hit most often.
 */
export async function paginate(query, variables, select) {
  const out = [];
  let after = null;
  for (;;) {
    const { data } = await gql(query, { ...variables, after });
    const conn = select(data);
    out.push(...conn.nodes);
    if (!conn.pageInfo.hasNextPage) return out;
    after = conn.pageInfo.endCursor;
  }
}

/** The team whose issues these scripts operate on. */
export async function resolveTeam(name) {
  const { data } = await gql('{ teams(first:50){ nodes{ id key name } } }');
  const team = data.teams.nodes.find((t) => t.name === name) ?? data.teams.nodes[0];
  if (!team) throw new Error(`No team found (looked for "${name}").`);
  return team;
}
