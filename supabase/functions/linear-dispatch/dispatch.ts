// The GitHub side: turn a dispatchable Linear issue into a
// `repository_dispatch` event that `.github/workflows/claude-linear-dispatch.yml`
// is listening for.
//
// -----------------------------------------------------------------------
// VERIFIED CONSTRAINTS (see docs/swarm/2026-08-09-linear-webhook-dispatch.md
// for the evidence behind each)
// -----------------------------------------------------------------------
// * Endpoint: `POST /repos/{owner}/{repo}/dispatches`.
// * Token: a **classic PAT with `public_repo`** is sufficient, because
//   `gamitch/volt_task_tracker_rewrite` is a public repository. GitHub's REST
//   reference says classic tokens "need the `repo` scope"; `public_repo` is
//   that scope's public-repository subset and is the narrower correct choice
//   here. A fine-grained PAT needs **Contents: read & write**.
// * **The token must belong to a human GitHub account.** This is not a style
//   preference --- `github.actor` on the triggered run becomes the PAT
//   owner, and claude-code-action's `checkHumanActor` throws unless
//   `octokit.users.getByUsername(actor).type === 'User'`. A GitHub App or
//   machine account resolves to type `Bot` and the run dies before Claude
//   starts.
// * `event_type` must be <= 100 characters.
// * `client_payload` must have <= 10 top-level properties and be < 64KB.
//   `DispatchClientPayload` has 7 and weighs a few hundred bytes.
// * A `repository_dispatch` workflow only ever runs from the **default
//   branch**, so the workflow file must be on `main` before any of this
//   works.
//
// Success is HTTP **204 No Content**, not 200 --- asserted explicitly below,
// because treating "any 2xx" as success would let a redirect or an
// unexpected 202 read as a dispatch that never happened.
import type { DispatchClientPayload } from './filter.ts';

const GITHUB_API_VERSION = '2022-11-28';

export interface DispatchTarget {
  /** `owner/name`, e.g. `gamitch/volt_task_tracker_rewrite`. */
  repo: string;
  /** The PAT. Read from env by `index.ts`; never logged, never echoed. */
  token: string;
  /** Must match the workflow's `types:` entry. */
  eventType: string;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  /** Populated only on failure --- GitHub's error body, for the log. */
  detail?: string;
}

export function dispatchUrl(repo: string): string {
  return `https://api.github.com/repos/${repo}/dispatches`;
}

/**
 * Fires the `repository_dispatch`. `fetchImpl` is injectable so this can be
 * exercised without network access.
 */
export async function fireRepositoryDispatch(
  target: DispatchTarget,
  clientPayload: DispatchClientPayload,
  fetchImpl: typeof fetch = fetch,
): Promise<DispatchResult> {
  const response = await fetchImpl(dispatchUrl(target.repo), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${target.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'Content-Type': 'application/json',
      // GitHub rejects API requests without one.
      'User-Agent': 'volt-linear-dispatch',
    },
    body: JSON.stringify({
      event_type: target.eventType,
      client_payload: clientPayload,
    }),
  });

  if (response.status === 204) {
    return { ok: true, status: 204 };
  }

  // Read the body for the log, but never let a body-read failure mask the
  // status code that actually explains the problem.
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    detail = '<response body could not be read>';
  }
  return { ok: false, status: response.status, detail };
}
