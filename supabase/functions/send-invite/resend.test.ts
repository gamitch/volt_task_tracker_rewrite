// T048: unit tests for resend.ts -- constitution item 7's BLOCKER-class
// test-mode gate is the primary thing under test here. Run with
// `deno test supabase/functions/send-invite/` (same convention as T017's
// validation.test.ts). Uses `node:assert` for zero external network
// dependency, same as validation.test.ts.
import assert from 'node:assert/strict';
import { resolveSendMode, sendBrandedEmail, type SendMode } from './resend.ts';

// --- resolveSendMode: env-only, fail-closed -------------------------------

Deno.test('resolveSendMode: defaults to test when RESEND_SEND_MODE is unset', () => {
  const original = Deno.env.get('RESEND_SEND_MODE');
  Deno.env.delete('RESEND_SEND_MODE');
  try {
    assert.equal(resolveSendMode(), 'test');
  } finally {
    if (original !== undefined) Deno.env.set('RESEND_SEND_MODE', original);
  }
});

Deno.test('resolveSendMode: only the exact literal "production" resolves to production (fail-closed)', () => {
  const original = Deno.env.get('RESEND_SEND_MODE');
  const notProduction = ['', 'prod', 'Production', 'PRODUCTION', 'true', '1', 'live', 'send'];
  try {
    for (const value of notProduction) {
      Deno.env.set('RESEND_SEND_MODE', value);
      assert.equal(resolveSendMode(), 'test', `expected "${value}" to resolve to test, not production`);
    }
    Deno.env.set('RESEND_SEND_MODE', 'production');
    assert.equal(resolveSendMode(), 'production');
  } finally {
    if (original === undefined) Deno.env.delete('RESEND_SEND_MODE');
    else Deno.env.set('RESEND_SEND_MODE', original);
  }
});

// --- sendBrandedEmail: real send path unreachable outside production -----

Deno.test('sendBrandedEmail: in test mode, never calls fetch and returns skipped_test_mode', async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error('fetch must never be called outside production mode');
  }) as typeof fetch;

  try {
    const result = await sendBrandedEmail(
      { to: 'someone@example.com', subject: 'test', html: '<p>hi</p>', from: 'VOLT Robotics <notifications@mail.voltfrc.org>' },
      'test',
    );
    assert.equal(fetchCalled, false, 'the real Resend send API must never be reached in test mode');
    assert.deepEqual(result, { sent: false, reason: 'skipped_test_mode' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('sendBrandedEmail: an arbitrary non-"production" mode string also never calls fetch', async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error('fetch must never be called outside production mode');
  }) as typeof fetch;

  try {
    // Deliberately cast an invalid mode through, to prove even a caller bug
    // upstream (not just resolveSendMode's own default) is fail-closed at
    // this layer too -- defense-in-depth within the same module.
    const result = await sendBrandedEmail(
      { to: 'someone@example.com', subject: 'test', html: '<p>hi</p>', from: 'VOLT Robotics <notifications@mail.voltfrc.org>' },
      'anything-else-entirely' as SendMode,
    );
    assert.equal(fetchCalled, false);
    assert.deepEqual(result, { sent: false, reason: 'skipped_test_mode' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test('sendBrandedEmail: in production mode, calls fetch exactly once against api.resend.com with a Bearer header, never logs the key', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get('RESEND_API_KEY');
  Deno.env.set('RESEND_API_KEY', 'sk_test_should_never_be_logged_or_echoed');

  let callCount = 0;
  let capturedUrl = '';
  let capturedAuth: string | null = null;
  let capturedBody: unknown;

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    callCount += 1;
    capturedUrl = String(url);
    const headers = init?.headers as Record<string, string> | undefined;
    capturedAuth = headers?.Authorization ?? null;
    capturedBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    return new Response(JSON.stringify({ id: 'resend-msg-1' }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await sendBrandedEmail(
      { to: 'someone@example.com', subject: 'You are invited', html: '<p>hi</p>', from: 'VOLT Robotics <notifications@mail.voltfrc.org>' },
      'production',
    );
    assert.equal(callCount, 1);
    assert.equal(capturedUrl, 'https://api.resend.com/emails');
    assert.equal(capturedAuth, 'Bearer sk_test_should_never_be_logged_or_echoed');
    assert.deepEqual(capturedBody, {
      from: 'VOLT Robotics <notifications@mail.voltfrc.org>',
      to: 'someone@example.com',
      subject: 'You are invited',
      html: '<p>hi</p>',
    });
    assert.deepEqual(result, { sent: true, providerId: 'resend-msg-1' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete('RESEND_API_KEY');
    else Deno.env.set('RESEND_API_KEY', originalKey);
  }
});

Deno.test('sendBrandedEmail: in production mode with a non-2xx Resend response, returns resend_error with the status, no throw', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get('RESEND_API_KEY');
  Deno.env.set('RESEND_API_KEY', 'sk_test_key');

  globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'invalid from address' }), { status: 422 })) as typeof fetch;

  try {
    const result = await sendBrandedEmail(
      { to: 'someone@example.com', subject: 'test', html: '<p>hi</p>', from: 'VOLT Robotics <notifications@mail.voltfrc.org>' },
      'production',
    );
    assert.deepEqual(result, { sent: false, reason: 'resend_error', status: 422 });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete('RESEND_API_KEY');
    else Deno.env.set('RESEND_API_KEY', originalKey);
  }
});

Deno.test('sendBrandedEmail: in production mode with no RESEND_API_KEY configured, returns missing_api_key and never calls fetch', async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = Deno.env.get('RESEND_API_KEY');
  Deno.env.delete('RESEND_API_KEY');

  let fetchCalled = false;
  globalThis.fetch = (() => {
    fetchCalled = true;
    throw new Error('must not be called without an API key');
  }) as typeof fetch;

  try {
    const result = await sendBrandedEmail(
      { to: 'someone@example.com', subject: 'test', html: '<p>hi</p>', from: 'VOLT Robotics <notifications@mail.voltfrc.org>' },
      'production',
    );
    assert.equal(fetchCalled, false);
    assert.deepEqual(result, { sent: false, reason: 'missing_api_key' });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) Deno.env.delete('RESEND_API_KEY');
    else Deno.env.set('RESEND_API_KEY', originalKey);
  }
});
