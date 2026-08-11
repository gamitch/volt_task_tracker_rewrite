#!/usr/bin/env node
// GAM-325 D4 -- the daily reconciliation sweep.
//
// Runs on a schedule (lane D's `.github/workflows/linear-reconcile.yml`,
// 07:00 UTC + workflow_dispatch). READ-ONLY: this script never calls
// `issueUpdate` and never writes a comment. It lists PRs merged in the last
// 48h ON ANY BASE BRANCH -- deliberately not filtered to `main`, because a
// stacked child merging into its parent hits lane B's `NON_MAIN_BASE` skip
// and closes nothing; that declared row surfaces only here (§6.3). For each
// declared PR it reads the declared issue's STATE HISTORY, never
// `completedAt` -- a reopen/re-close leaves `completedAt` frozen at the
// issue's original close while only the history records the truth. It
// reports drift to Slack and a human decides. It always exits 0 on a
// successful run, whether or not drift is found -- this is a report, not a
// gate. (It still exits 1 if the run itself could not complete -- see
// `runReconcile`'s outer try/catch -- because a sweep that silently failed
// to check anything is a worse silence than a sweep that checked and found
// nothing wrong. Nothing in §4 says otherwise, but nothing says the
// opposite either; see this lane's worker report.)
//
// THE GAM-315 EXHIBIT THIS FILE'S TESTS ARE BUILT FROM (measured live,
// premise gate round 2, and re-confirmed by this lane against the real
// Linear API before writing any test):
//   completedAt: 2026-08-10T23:36:32.146Z (frozen at the ORIGINAL close)
//   history (newest first, state-transition entries only):
//     2026-08-11T00:47:24.148Z  In Progress -> Done   (the RE-close)
//     2026-08-11T00:27:43.816Z  Done -> In Progress    (the reopen)
//     2026-08-10T23:36:31.815Z  In Progress -> Done    (the original close)
// `completedAt` and the latest history entry disagree by ~1h11m -- reading
// `completedAt` alone would say GAM-315 has been continuously Done since
// 23:36:32 on 08-10, when the true story is a reopen and a later re-close.
// GAM-303 is NOT used for this: measured, its `completedAt` and its single
// `Done` transition agree to 33ms, so a fixture built from it would assert
// nothing (packet §4, E6).

const SEARCH_API = 'https://api.github.com/search/issues';

const HISTORY_QUERY = `
  query($id: String!) {
    issue(id: $id) {
      identifier
      completedAt
      state { name }
      history(first: 50) {
        nodes { createdAt fromState { name } toState { name } actor { name } }
      }
    }
  }
`;

/**
 * Parses the RFC 5988 `Link` header GitHub's REST API (not GraphQL) uses for
 * pagination, returning the `rel="next"` URL or `null` when there is no next
 * page.
 */
function nextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const m = /<([^>]+)>;\s*rel="next"/.exec(part.trim());
    if (m) return m[1];
  }
  return null;
}

/**
 * Lists every merged PR in `repo` with `merged_at >= sinceISO`, on ANY base
 * branch (no `base:` qualifier -- see this file's header). Uses the Search
 * API's `is:merged merged:>=` qualifier rather than walking
 * `GET /pulls?state=closed`, because sorting the latter by `updated` mixes
 * in every closed-without-merge PR touched recently for unrelated reasons
 * (a label, a comment), which makes "stop once old enough" unreliable; the
 * search qualifier filters by the field this sweep actually cares about.
 *
 * `fetchImpl` is injected so this is network-free in tests.
 */
export async function listRecentlyMergedPRs({ repo, sinceISO, fetchImpl = fetch, token }) {
  if (!repo) throw new Error('listRecentlyMergedPRs: repo is required (GITHUB_REPOSITORY).');

  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const results = [];
  let url =
    `${SEARCH_API}?q=${encodeURIComponent(`repo:${repo} is:pr is:merged merged:>=${sinceISO}`)}` +
    '&per_page=100&sort=created&order=asc';

  while (url) {
    const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) {
      throw new Error(`GitHub search API: HTTP ${res.status} for ${url}`);
    }
    const body = await res.json();
    for (const item of body.items ?? []) {
      results.push({
        number: item.number,
        title: item.title,
        body: item.body,
        htmlUrl: item.html_url,
        mergedAt: item.pull_request?.merged_at ?? null,
      });
    }
    url = nextLink(res.headers.get('link'));
  }
  return results;
}

/**
 * Reads one Linear issue's `completedAt`, current `state.name`, and its
 * `history` connection (newest-first, per the live probe pasted in this
 * lane's worker report -- and matching the shape lane B's own probe of
 * GAM-303 was asked to confirm independently for its file). `gqlImpl` is
 * injected so this is network-free in tests; production defaults to
 * `client.mjs`'s `gql` (read-only -- `LINEAR_API_KEY`, never a write key).
 */
export async function fetchIssueTruth(identifier, { gqlImpl = defaultGql } = {}) {
  const { data } = await gqlImpl(HISTORY_QUERY, { id: identifier });
  return data?.issue ?? null;
}

async function defaultGql(query, variables) {
  const { gql } = await import('./linear/client.mjs');
  return gql(query, variables);
}

/**
 * Pure. Reduces one issue's `{ completedAt, state, history }` to the state
 * the HISTORY says is true, never trusting `completedAt` for either "is it
 * done" or "since when." History is newest-first; entries with
 * `fromState: null, toState: null` are non-state edits (comments, labels,
 * etc.) and are filtered out before taking the most recent transition.
 *
 * `completedAtIsStale` is true exactly in the GAM-315 shape this file's
 * header describes: the issue IS currently Done, but the timestamp history
 * says it became Done most recently is more than `STALE_TOLERANCE_MS` away
 * from `completedAt` -- i.e. it was reopened and re-closed after its
 * original completion, and `completedAt` never moved to reflect that. The
 * tolerance exists because `completedAt` and its paired history entry are
 * two separate writes a few milliseconds apart even when nothing was ever
 * reopened (GAM-303, measured: 33ms) -- see `STALE_TOLERANCE_MS` below.
 */
// Ordinary write lag between `completedAt` being stamped and its paired
// history entry being recorded is milliseconds (measured: GAM-303's two
// fields are 33ms apart, and that is agreement, not drift -- packet §4,
// E6). A real reopen/re-close is minutes-to-hours apart (GAM-315: ~1h11m).
// The threshold only needs to sit between those two measured scales.
const STALE_TOLERANCE_MS = 60_000;

export function resolveIssueTruth(issue) {
  const nodes = issue?.history?.nodes ?? [];
  const transitions = nodes.filter((n) => n.fromState && n.toState);
  const latest = transitions[0] ?? null;

  const trueState = latest ? latest.toState.name : (issue?.state?.name ?? null);
  const trueStateSince = latest ? latest.createdAt : null;
  const completedAt = issue?.completedAt ?? null;

  const gapMs =
    latest && completedAt != null ? Math.abs(new Date(trueStateSince).getTime() - new Date(completedAt).getTime()) : 0;

  return {
    trueState,
    trueStateSince,
    completedAt,
    completedAtIsStale: Boolean(latest && trueState === 'Done' && completedAt != null && gapMs > STALE_TOLERANCE_MS),
  };
}

/**
 * Pure. Combines one declared PR with its issue's history-derived truth into
 * one drift/info verdict. `drift: true` is the actionable case this sweep
 * exists to surface (a human decides what to do about it); `drift: false`
 * entries with a `code` other than `'OK'` are informational-only lines
 * (still posted to Slack, never gate anything).
 */
export function evaluateDrift({ pr, declaration, issueTruth }) {
  if (!issueTruth) {
    return {
      drift: true,
      code: 'UNKNOWN_ISSUE',
      message: `PR #${pr.number} ("${pr.title}") declares ${declaration.issue}, but that issue could not be found in Linear.`,
    };
  }

  const truth = resolveIssueTruth(issueTruth);

  if (truth.trueState !== 'Done') {
    return {
      drift: true,
      code: 'NOT_DONE',
      message:
        `PR #${pr.number} ("${pr.title}") merged ${pr.mergedAt}, declares ${declaration.issue}, but ` +
        `${declaration.issue} is currently "${truth.trueState}", not Done.`,
    };
  }

  if (truth.completedAtIsStale) {
    return {
      drift: false,
      code: 'REOPENED_AFTER_COMPLETE',
      message:
        `${declaration.issue} (PR #${pr.number}) is Done, but was reopened and re-closed after its ` +
        `original completedAt (${truth.completedAt}); the true close time from history is ` +
        `${truth.trueStateSince}.`,
    };
  }

  return {
    drift: false,
    code: 'OK',
    message: `${declaration.issue} (PR #${pr.number}) is Done -- matches its declaration.`,
  };
}

async function defaultLoadParser() {
  return import('./linear/declaration.mjs');
}

async function defaultPostSlack(...args) {
  const { postSlack } = await import('./linear/slack.mjs');
  return postSlack(...args);
}

/**
 * The whole sweep, wrapped in one try/catch. A successful run -- one that
 * actually listed PRs and read Linear, whatever it found -- always resolves
 * `exitCode: 0`; only a run that could not complete (a thrown error before
 * reporting) resolves `exitCode: 1`. Every dependency the sweep needs is
 * injected with a production default, so tests never touch the network.
 */
export async function runReconcile({
  env = process.env,
  now = new Date(),
  hoursWindow = 48,
  fetchImpl = fetch,
  listPRs = listRecentlyMergedPRs,
  gqlImpl,
  postSlackImpl = defaultPostSlack,
  loadParser = defaultLoadParser,
  log = console,
} = {}) {
  const logError = (...args) => (log.error ?? log.log ?? (() => {}))(...args);
  const logInfo = (...args) => (log.log ?? log.error ?? (() => {}))(...args);

  try {
    const parser = await loadParser();
    const repo = env.GITHUB_REPOSITORY;
    const sinceISO = new Date(now.getTime() - hoursWindow * 3600 * 1000).toISOString();

    let prs = [];
    if (repo) {
      prs = await listPRs({ repo, sinceISO, fetchImpl, token: env.GITHUB_TOKEN });
    } else {
      logError('No GITHUB_REPOSITORY -- cannot list merged PRs. Reporting zero checked.');
    }

    const declared = prs
      .map((pr) => ({ pr, declaration: parser.parseDeclaration(pr.body) }))
      .filter(({ declaration }) => declaration.ok === true);

    const entries = [];
    for (const { pr, declaration } of declared) {
      let issueTruth;
      try {
        issueTruth = await fetchIssueTruth(declaration.issue, { gqlImpl });
      } catch (err) {
        entries.push({
          drift: true,
          code: 'READ_ERROR',
          message: `PR #${pr.number} declares ${declaration.issue}, but its Linear state could not be read (${err instanceof Error ? err.message : String(err)}).`,
        });
        continue;
      }
      entries.push(evaluateDrift({ pr, declaration, issueTruth }));
    }

    const drifted = entries.filter((e) => e.drift);
    const informational = entries.filter((e) => !e.drift && e.code !== 'OK');

    for (const e of entries) logError(`${e.drift ? 'DRIFT' : 'INFO'} [${e.code}] ${e.message}`);

    const level = drifted.length > 0 ? 'warn' : 'info';
    const lines = [
      `${declared.length} declared PR(s) checked, merged in the last ${hoursWindow}h (any base branch).`,
      ...drifted.map((e) => `⚠ ${e.message}`),
      ...informational.map((e) => `ℹ️ ${e.message}`),
    ];

    const posted = await postSlackImpl(env.SLACK_WEBHOOK_URL, {
      level,
      title: `Linear reconcile — ${drifted.length} drift, ${declared.length} checked`,
      lines,
    });
    if (posted && posted.posted === false) {
      logInfo(`Slack not posted: ${posted.reason}`);
    }

    logInfo(`Reconcile sweep complete: ${declared.length} checked, ${drifted.length} drift. Exiting 0 (report, not a gate).`);

    return { exitCode: 0, entries, checked: declared.length, drifted: drifted.length };
  } catch (err) {
    logError(`UNEXPECTED ERROR: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    return { exitCode: 1, error: true };
  }
}

async function main() {
  const result = await runReconcile();
  process.exit(result.exitCode);
}

// Only run when invoked directly -- import-safe for the test file.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`UNEXPECTED ERROR: ${err instanceof Error ? err.stack : err}`);
    process.exit(1);
  });
}
