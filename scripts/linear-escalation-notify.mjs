// Tells the human owner, in Slack, that a run escalated something to them and
// is waiting on their comment.
//
// WHY THIS EXISTS. An item-19a escalation (constitution.md:93 -- the premise
// gate is capped at two rounds, a third REVISE goes to the owner) deliberately
// leaves its issue `In Progress`. That is the correct state -- the chain really
// is unfinished -- but it makes an escalation indistinguishable from healthy
// active work. It lands in no triage queue. Measured on GAM-301: the run
// escalated at 14:55, left a detailed comment, and the only machine-visible
// signals were a red `assert-released` check on a branch with no PR, and a
// Linear comment nobody was subscribed to. The owner found out by asking.
//
// WHAT FIRES IT. `claude-linear-dispatch.yml`'s `assert-released` job, on
// failure. That job already runs at exactly the right moment (immediately
// after a dispatched run ends) and already goes red on exactly this case.
// `scripts/linear-assert-released.mjs:27-42` names three benign shapes that
// legitimately end `In Progress`; this script exists to tell shape 2 (an
// escalation) apart from shapes 1 and 3, so the owner is pinged for the one
// that actually needs them and not for the two that don't.
//
// THE MARKER, AND ITS LIMIT. Detection keys off the opening of the newest
// comment: an escalating agent writes `**Escalating ...` (bold, first thing in
// the body) -- the convention GAM-301's own escalation already followed. This
// is deliberately strict rather than a loose /escalat/i scan, because issues
// accumulate prose *about* escalations that must not trip it: GAM-301 also
// carries a retraction comment mentioning "escalation" five times, and a loose
// match would fire on that. The cost of strictness is a missed ping if an
// agent phrases its escalation differently; that is the safer failure, and
// `assert-released` is still red either way. If this misses one, fix the
// agent's wording, not this regex.
//
// NEVER A GATE. Exits 0 unconditionally, matching `linear-reconcile.mjs`'s
// "report, not a gate" precedent. A Slack outage, an unset webhook, or a
// Linear read failure must never be why a run is reported as failed -- and
// this script runs in an `if: failure()` step, where a non-zero exit would
// muddy an already-red job with a second, unrelated cause.
//
// Usage:
//   LINEAR_API_KEY=lin_api_… SLACK_WEBHOOK_URL=https://… \
//     node scripts/linear-escalation-notify.mjs GAM-301

const ISSUE_QUERY = `
  query EscalationCheck($id: String!) {
    issue(id: $id) {
      identifier
      title
      url
      state { name }
      comments(first: 5, orderBy: createdAt) {
        nodes { body createdAt url }
      }
    }
  }
`;

// Comment bodies open with this when a run hands the decision back. No
// blockquote alternative on purpose: a reply that *begins* by quoting an
// earlier escalation ("> **Escalating per item 19a…") is discussion about an
// escalation, not a new one, and must not re-ping.
const ESCALATION_MARKER = /^\s*\*\*Escalat(?:ing|ed)\b/i;

/** How much of the escalation comment to quote into Slack. */
const EXCERPT_CHARS = 280;

async function defaultGql(query, variables) {
  const { gql } = await import('./linear/client.mjs');
  return gql(query, variables);
}

async function defaultPostSlack(...args) {
  const { postSlack } = await import('./linear/slack.mjs');
  return postSlack(...args);
}

export async function fetchIssueForEscalation(identifier, { gqlImpl = defaultGql } = {}) {
  const { data } = await gqlImpl(ISSUE_QUERY, { id: identifier });
  return data?.issue ?? null;
}

/**
 * Pure. Decides whether an issue's newest comment is a run handing the
 * decision back to the owner.
 *
 * Only the NEWEST comment is considered. An older escalation that has since
 * been answered -- by the owner, or by a later run posting its own status --
 * is resolved by definition, and re-pinging it would train the owner to
 * ignore this channel. `comments(orderBy: createdAt)` returns oldest-first,
 * so the newest is the last node.
 *
 * @param {{ state?: {name?: string}, comments?: {nodes?: Array<{body?: string, url?: string, createdAt?: string}>} } | null} issue
 * @returns {{ escalated: boolean, reason: string, excerpt?: string, commentUrl?: string }}
 */
export function detectEscalation(issue) {
  if (!issue) return { escalated: false, reason: 'ISSUE_NOT_FOUND' };

  const stateName = issue.state?.name ?? '';
  if (stateName !== 'In Progress') {
    // Shapes 1 and 3 from assert-released's list, plus every ordinary
    // finished run. Not our case.
    return { escalated: false, reason: `STATE_${stateName.toUpperCase().replace(/\s+/g, '_')}` };
  }

  const nodes = issue.comments?.nodes ?? [];
  const newest = nodes.length > 0 ? nodes[nodes.length - 1] : null;
  if (!newest) return { escalated: false, reason: 'NO_COMMENTS' };

  const body = typeof newest.body === 'string' ? newest.body : '';
  if (!ESCALATION_MARKER.test(body)) {
    return { escalated: false, reason: 'NEWEST_COMMENT_NOT_AN_ESCALATION' };
  }

  return {
    escalated: true,
    reason: 'ESCALATED',
    excerpt: buildExcerpt(body),
    commentUrl: newest.url,
  };
}

/** Pure. First meaningful line of the escalation, flattened for Slack. */
export function buildExcerpt(body, limit = EXCERPT_CHARS) {
  const flattened = body
    .replace(/\s+/g, ' ')
    .replace(/\*\*/g, '')
    .trim();
  if (flattened.length <= limit) return flattened;
  return `${flattened.slice(0, limit).trimEnd()}…`;
}

/**
 * Reads one issue, and posts to Slack only if its newest comment is an
 * escalation. Always resolves; never throws; exit code is always 0.
 */
export async function runEscalationNotify({
  identifier,
  env = process.env,
  gqlImpl = defaultGql,
  postSlackImpl = defaultPostSlack,
  log = console.log,
} = {}) {
  if (!identifier) {
    log('No issue identifier given; nothing to check.');
    return { exitCode: 0, notified: false, reason: 'NO_IDENTIFIER' };
  }

  let issue = null;
  try {
    issue = await fetchIssueForEscalation(identifier, { gqlImpl });
  } catch (err) {
    // A Linear read failure must not add a second red cause to an
    // already-failing job. Report and leave.
    log(`Could not read ${identifier}: ${err instanceof Error ? err.message : String(err)}`);
    return { exitCode: 0, notified: false, reason: 'READ_FAILED' };
  }

  const verdict = detectEscalation(issue);
  if (!verdict.escalated) {
    log(`${identifier}: no owner escalation detected (${verdict.reason}).`);
    return { exitCode: 0, notified: false, reason: verdict.reason };
  }

  const lines = [
    `*${issue.identifier} — ${issue.title}*`,
    '',
    'A run stopped and handed this back to you. It is waiting on your comment;',
    'nothing will move until you give it a direction and re-dispatch.',
    '',
    `> ${verdict.excerpt}`,
    '',
    verdict.commentUrl ? `Escalation comment: ${verdict.commentUrl}` : `Issue: ${issue.url}`,
  ];

  const posted = await postSlackImpl(env.SLACK_WEBHOOK_URL, {
    level: 'warn',
    title: `${issue.identifier} escalated to you — needs your comment`,
    lines,
  });

  if (posted && posted.posted === false) {
    log(`Slack not posted: ${posted.reason}`);
    return { exitCode: 0, notified: false, reason: `NOT_POSTED_${posted.reason}` };
  }

  log(`${identifier}: owner escalation notified via Slack.`);
  return { exitCode: 0, notified: true, reason: 'ESCALATED' };
}

async function main() {
  const identifier = process.argv[2];
  const { exitCode } = await runEscalationNotify({ identifier });
  process.exitCode = exitCode;
}

// Only run when invoked directly, so the test file can import the exports.
if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
