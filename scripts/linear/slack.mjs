// A single, deliberately unambitious Slack poster shared by the sync worker
// (lane B), the gate script and the reconciliation sweep (lane C).
//
// The one rule that matters: the tracker write is the job; the notification
// is not. `LINEAR_SYNC_API_KEY` performing an `issueUpdate` is the thing
// GAM-325 exists to build safely -- a Slack webhook returning 500, or not
// being configured yet (§5.0's `SLACK_WEBHOOK_URL` is an owner action not
// yet taken), must never be why that write is reported as failed, retried,
// or turned into a non-zero exit. So this function is built to never throw
// and never surface an error to its caller in any way other than the
// `{ posted: false, reason }` return value.

const LEVEL_PREFIX = { ok: '✅', info: 'ℹ️', warn: '⚠️' };

/**
 * @param {string|undefined|null} webhookUrl
 * @param {{ level: 'ok'|'info'|'warn', title: string, lines?: string[] }} message
 * @returns {Promise<{ posted: true } | { posted: false, reason: string }>}
 */
export async function postSlack(webhookUrl, { level, title, lines = [] }) {
  // §5.0: the GitHub secret is a Phase-2 owner action, not yet created as of
  // this build. Absence must be the normal, quiet path -- every caller of
  // this function runs the same whether or not Slack exists yet.
  if (!webhookUrl) {
    return { posted: false, reason: 'NO_WEBHOOK' };
  }

  const prefix = LEVEL_PREFIX[level] ?? '';
  const text = [`${prefix} ${title}`, ...lines].join('\n');

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      // Bounded independently of any caller's own timeout budget (lane B's
      // fetches use 20s -- §3) -- a hung webhook must not be why a caller
      // that is waiting on this promise runs long.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { posted: false, reason: `HTTP ${res.status}` };
    }
    return { posted: true };
  } catch (err) {
    // Network failure, DNS failure, abort-on-timeout -- all the same
    // "swallow it" shape. The reason string is for a human reading a log,
    // never for a caller to branch on.
    return { posted: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
