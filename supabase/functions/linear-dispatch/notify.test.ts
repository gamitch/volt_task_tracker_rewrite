// Unit tests for notify.ts --- the Slack notifier for the dispatch
// decision, and its integration with index.ts. Run with
// `deno test --allow-env --allow-read supabase/functions/linear-dispatch/`.
//
// Two groups, matching GAM-325 §6's acceptance criteria:
//
//   1. `notifyDispatchDecision` in isolation (criterion 1): absent env,
//      rejecting fetch, non-2xx response --- all swallowed, never thrown.
//
//   2. `handleRequest` (index.ts) end to end (criterion 2): the HTTP
//      response's status and body are byte-identical whether the Slack
//      notification succeeds, fails, or is never attempted at all. This is
//      the proof that the notifier's own failure cannot change any existing
//      branch's behaviour.
//
// Fully offline: `fetch` is stubbed everywhere, either by injecting
// `fetchImpl` (group 1) or by monkey-patching `globalThis.fetch` for the
// duration of one test (group 2, needed because `index.ts` calls
// `scheduleDispatchNotification` and `fireRepositoryDispatch` with their
// default `fetchImpl`, i.e. the real global).
import assert from 'node:assert/strict';
import { computeSignature } from './signature.ts';
import { notifyDispatchDecision } from './notify.ts';
import { handleRequest } from './index.ts';

// -----------------------------------------------------------------------
// Group 1 --- notifyDispatchDecision in isolation
// -----------------------------------------------------------------------

const WEBHOOK_URL = 'https://hooks.slack.example/services/T000/B000/fake';

/** Runs `fn` with `SLACK_WEBHOOK_URL` set (or deliberately unset), restoring whatever was there before. */
async function withSlackEnv(value: string | undefined, fn: () => Promise<void>): Promise<void> {
  const previous = Deno.env.get('SLACK_WEBHOOK_URL');
  if (value === undefined) {
    Deno.env.delete('SLACK_WEBHOOK_URL');
  } else {
    Deno.env.set('SLACK_WEBHOOK_URL', value);
  }
  try {
    await fn();
  } finally {
    if (previous === undefined) {
      Deno.env.delete('SLACK_WEBHOOK_URL');
    } else {
      Deno.env.set('SLACK_WEBHOOK_URL', previous);
    }
  }
}

Deno.test('notifyDispatchDecision: absent SLACK_WEBHOOK_URL means no fetch attempted and no throw', async () => {
  await withSlackEnv(undefined, async () => {
    let called = false;
    const fetchImpl = (() => {
      called = true;
      throw new Error('fetch must not be called when SLACK_WEBHOOK_URL is absent');
    }) as unknown as typeof fetch;

    await notifyDispatchDecision({ dispatched: true, identifier: 'GAM-1', tier: 'fast', eventType: 'x' }, fetchImpl);

    assert.equal(called, false, 'fetch should never have been attempted');
  });
});

Deno.test('notifyDispatchDecision: a rejecting fetch is swallowed, not thrown', async () => {
  await withSlackEnv(WEBHOOK_URL, async () => {
    const fetchImpl = (() => Promise.reject(new Error('network is down'))) as unknown as typeof fetch;

    // The point of the assertion: this call must resolve, not reject.
    await assert.doesNotReject(() =>
      notifyDispatchDecision({ dispatched: false, reason: 'NO_TIER_LABEL', detail: 'no tier label' }, fetchImpl),
    );
  });
});

Deno.test('notifyDispatchDecision: a non-2xx response is swallowed, not thrown', async () => {
  await withSlackEnv(WEBHOOK_URL, async () => {
    const fetchImpl = (() =>
      Promise.resolve(new Response('rate limited', { status: 429 }))) as unknown as typeof fetch;

    await assert.doesNotReject(() =>
      notifyDispatchDecision({ dispatched: true, identifier: 'GAM-1', tier: 'fast', eventType: 'x' }, fetchImpl),
    );
  });
});

Deno.test('notifyDispatchDecision: a genuine 2xx response resolves cleanly and posts the webhook URL given', async () => {
  await withSlackEnv(WEBHOOK_URL, async () => {
    let capturedUrl: string | undefined;
    let capturedBody: string | undefined;
    const fetchImpl = ((url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = String(init?.body ?? '');
      return Promise.resolve(new Response('ok', { status: 200 }));
    }) as unknown as typeof fetch;

    await notifyDispatchDecision({ dispatched: true, identifier: 'GAM-42', tier: 'heavy', eventType: 'linear-issue-dispatch' }, fetchImpl);

    assert.equal(capturedUrl, WEBHOOK_URL);
    assert.ok(capturedBody?.includes('GAM-42'), 'the Slack payload should mention the dispatched identifier');
  });
});

// -----------------------------------------------------------------------
// Group 2 --- handleRequest (index.ts) end to end: byte-identical proof
// -----------------------------------------------------------------------

const WEBHOOK_SECRET = 'fabricated-test-webhook-secret-not-a-real-credential';
const GITHUB_TOKEN = 'fabricated-test-github-token-not-a-real-credential';
const GITHUB_REPO = 'gamitch/volt_task_tracker_rewrite';
const DISPATCH_URL = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;

const REQUIRED_ENV: Record<string, string> = {
  LINEAR_WEBHOOK_SECRET: WEBHOOK_SECRET,
  GITHUB_DISPATCH_TOKEN: GITHUB_TOKEN,
  GITHUB_DISPATCH_REPO: GITHUB_REPO,
};

/** A dispatchable Issue `update` payload: Backlog -> Todo, tiered, unarchived. */
function dispatchablePayloadBody(): string {
  return JSON.stringify({
    action: 'update',
    type: 'Issue',
    createdAt: '2026-08-11T12:00:00.000Z',
    data: {
      id: '9f1c2d3e-4b5a-6789-0abc-def012345678',
      identifier: 'GAM-900',
      title: 'Fabricated test issue',
      priority: 2,
      state: { id: 'state-uuid', name: 'Todo', type: 'unstarted' },
      labels: [{ id: 'l1', name: 'fast', parent: { name: 'tier' } }],
    },
    updatedFrom: { stateId: '11111111-2222-3333-4444-555555555555' },
    url: 'https://linear.app/gamitch/issue/GAM-900/fabricated-test-issue',
    webhookTimestamp: Date.now(),
    organizationId: '78884f5f-97f6-4d32-9856-a1739a3c26b9',
    webhookId: 'webhook-uuid',
  });
}

/** A payload `decideDispatch` names a skip for: action is `create`, not `update`. */
function skippedPayloadBody(): string {
  return JSON.stringify({
    action: 'create',
    type: 'Issue',
    createdAt: '2026-08-11T12:00:00.000Z',
    data: {
      id: '9f1c2d3e-4b5a-6789-0abc-def012345678',
      identifier: 'GAM-901',
      title: 'Fabricated test issue, freshly created',
      priority: 2,
      state: { id: 'state-uuid', name: 'Todo', type: 'unstarted' },
      labels: [{ id: 'l1', name: 'fast', parent: { name: 'tier' } }],
    },
    updatedFrom: { stateId: '11111111-2222-3333-4444-555555555555' },
    url: 'https://linear.app/gamitch/issue/GAM-901/fabricated-test-issue',
    webhookTimestamp: Date.now(),
    organizationId: '78884f5f-97f6-4d32-9856-a1739a3c26b9',
    webhookId: 'webhook-uuid',
  });
}

async function signedRequest(rawBody: string): Promise<Request> {
  const signature = await computeSignature(WEBHOOK_SECRET, rawBody);
  return new Request('https://example.supabase.co/functions/v1/linear-dispatch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Linear-Signature': signature,
    },
    body: rawBody,
  });
}

/** Sets the required non-Slack secrets and SLACK_WEBHOOK_URL (or clears it), running `fn`, then restoring all of it. */
async function withHandlerEnv<T>(slackWebhookUrl: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous: Record<string, string | undefined> = {};
  const keys = [...Object.keys(REQUIRED_ENV), 'SLACK_WEBHOOK_URL'];
  for (const key of keys) previous[key] = Deno.env.get(key);

  for (const [key, value] of Object.entries(REQUIRED_ENV)) Deno.env.set(key, value);
  if (slackWebhookUrl === undefined) {
    Deno.env.delete('SLACK_WEBHOOK_URL');
  } else {
    Deno.env.set('SLACK_WEBHOOK_URL', slackWebhookUrl);
  }

  try {
    return await fn();
  } finally {
    for (const key of keys) {
      const original = previous[key];
      if (original === undefined) Deno.env.delete(key);
      else Deno.env.set(key, original);
    }
  }
}

/**
 * Stubs `globalThis.fetch` for one test. `dispatch.ts` and `notify.ts` both
 * fall back to the real global `fetch` when `index.ts` does not inject one,
 * so this is the only way to keep the whole `handleRequest` call offline.
 *
 * `slackBehaviour` controls what a request to `SLACK_WEBHOOK_URL` does:
 *   - 'reject'  -> the fetch call rejects (network error)
 *   - 'error'   -> resolves with a non-2xx response
 *   - 'ok'      -> resolves with a 200
 * Any request to the GitHub dispatch URL always resolves 204 (dispatch
 * accepted), so the "dispatched: true" branch is reachable in every case.
 */
function withStubbedFetch<T>(
  slackBehaviour: 'reject' | 'error' | 'ok',
  fn: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target === DISPATCH_URL) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    // Everything else in these fixtures is the Slack webhook.
    void init;
    if (slackBehaviour === 'reject') {
      return Promise.reject(new Error('simulated Slack network failure'));
    }
    if (slackBehaviour === 'error') {
      return Promise.resolve(new Response('rate limited', { status: 429 }));
    }
    return Promise.resolve(new Response('ok', { status: 200 }));
  }) as typeof fetch;

  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

async function captureResponse(req: Request): Promise<{ status: number; body: string }> {
  const response = await handleRequest(req);
  const body = await response.text();
  return { status: response.status, body };
}

Deno.test({
  name:
    'handleRequest: a dispatch case response is byte-identical whether Slack notification succeeds, fails, or SLACK_WEBHOOK_URL is absent',
  // The notification is scheduled, not awaited (rule 3): outside the real
  // Supabase Edge Runtime it runs detached, so this test deliberately does
  // not wait for it to settle before asserting on the response. That is
  // the behaviour under test, not an oversight, so sanitizers are off.
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const absent = await withHandlerEnv(undefined, () =>
      withStubbedFetch('ok', async () => captureResponse(await signedRequest(dispatchablePayloadBody()))),
    );
    const failing = await withHandlerEnv(WEBHOOK_URL, () =>
      withStubbedFetch('reject', async () => captureResponse(await signedRequest(dispatchablePayloadBody()))),
    );
    const erroring = await withHandlerEnv(WEBHOOK_URL, () =>
      withStubbedFetch('error', async () => captureResponse(await signedRequest(dispatchablePayloadBody()))),
    );
    const succeeding = await withHandlerEnv(WEBHOOK_URL, () =>
      withStubbedFetch('ok', async () => captureResponse(await signedRequest(dispatchablePayloadBody()))),
    );

    assert.equal(absent.status, 200);
    assert.deepEqual(absent, failing, 'absent vs. rejecting Slack fetch must be byte-identical');
    assert.deepEqual(absent, erroring, 'absent vs. non-2xx Slack response must be byte-identical');
    assert.deepEqual(absent, succeeding, 'absent vs. a genuinely successful Slack post must be byte-identical');
    assert.ok(absent.body.includes('"dispatched":true'), 'guard: this really is the dispatch case');
  },
});

Deno.test({
  name:
    'handleRequest: a skip case response is byte-identical whether Slack notification succeeds, fails, or SLACK_WEBHOOK_URL is absent',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const absent = await withHandlerEnv(undefined, () =>
      withStubbedFetch('ok', async () => captureResponse(await signedRequest(skippedPayloadBody()))),
    );
    const failing = await withHandlerEnv(WEBHOOK_URL, () =>
      withStubbedFetch('reject', async () => captureResponse(await signedRequest(skippedPayloadBody()))),
    );
    const erroring = await withHandlerEnv(WEBHOOK_URL, () =>
      withStubbedFetch('error', async () => captureResponse(await signedRequest(skippedPayloadBody()))),
    );
    const succeeding = await withHandlerEnv(WEBHOOK_URL, () =>
      withStubbedFetch('ok', async () => captureResponse(await signedRequest(skippedPayloadBody()))),
    );

    assert.equal(absent.status, 200);
    assert.deepEqual(absent, failing, 'absent vs. rejecting Slack fetch must be byte-identical');
    assert.deepEqual(absent, erroring, 'absent vs. non-2xx Slack response must be byte-identical');
    assert.deepEqual(absent, succeeding, 'absent vs. a genuinely successful Slack post must be byte-identical');
    assert.ok(absent.body.includes('"dispatched":false'), 'guard: this really is the skip case');
    assert.ok(absent.body.includes('NOT_AN_UPDATE'), 'guard: the skip reason really is the one this fixture names');
  },
});
