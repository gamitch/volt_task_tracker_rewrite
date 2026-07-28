// supabase/functions/send-reminders/send_reminder.test.ts
//
// T051 -- REAL, REQUIRED dedupe re-run proof (worker packet Known Context/
// Traps #1: "write a real test that invokes your dedupe-check-then-send
// logic twice for the identical (template, session, recipient) tuple and
// asserts exactly one email_log row/one send attempt results, not two.").
// Run with `deno test --allow-env` (no network, no database -- the
// `EmailLogStore` and Resend `sendFn` are both fakes/spies).
import assert from 'node:assert/strict';
import { InMemoryEmailLogStore } from './email_log_store.ts';
import { sendReminderIfNotDuplicate } from './send_reminder.ts';
import type { SendEmailResult, SendMode } from './resend.ts';

function buildInput(overrides: Partial<Parameters<typeof sendReminderIfNotDuplicate>[3]> = {}) {
  return {
    template: 'event-reminder-48h',
    sessionId: 'session-aaa',
    toEmail: 'student@example.com',
    profileId: 'profile-aaa',
    subject: 'Your event is coming up',
    html: '<p>hi</p>',
    dedupeCriteria: { template: 'event-reminder-48h', sessionId: 'session-aaa', toEmail: 'student@example.com' },
    ...overrides,
  };
}

// --- THE required proof: identical (template, session, recipient) tuple, --
// --- invoked twice, sequentially (a retry / overlapping cron invocation) --

Deno.test('DEDUPE PROOF: invoking the identical (template, session, recipient) tuple twice results in exactly one send attempt and exactly one email_log row', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: false, reason: 'skipped_test_mode' });
  };

  const input = buildInput();

  const firstOutcome = await sendReminderIfNotDuplicate(store, sendFn, 'test', input);
  const secondOutcome = await sendReminderIfNotDuplicate(store, sendFn, 'test', input);

  assert.deepEqual(firstOutcome, { outcome: 'skipped_test_mode' });
  assert.deepEqual(secondOutcome, { outcome: 'duplicate' });
  assert.equal(sendCallCount, 1, 'the Resend send path must be invoked exactly once, not twice');
  assert.equal(store.rows.length, 1, 'exactly one email_log row must exist, not two');
});

Deno.test('DEDUPE PROOF (production mode, real sent status): same tuple twice still yields exactly one send + one row', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: true, providerId: 'resend-msg-1' });
  };

  const input = buildInput({
    template: 'meeting-reminder-3h',
    sessionId: 'session-bbb',
    toEmail: 'coach@example.com',
    dedupeCriteria: { template: 'meeting-reminder-3h', sessionId: 'session-bbb', toEmail: 'coach@example.com' },
  });

  const first = await sendReminderIfNotDuplicate(store, sendFn, 'production', input);
  const second = await sendReminderIfNotDuplicate(store, sendFn, 'production', input);

  assert.deepEqual(first, { outcome: 'sent' });
  assert.deepEqual(second, { outcome: 'duplicate' });
  assert.equal(sendCallCount, 1);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].status, 'sent');
});

Deno.test('DEDUPE PROOF: a THIRD invocation of the same tuple is still a duplicate (not just "twice")', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: false, reason: 'skipped_test_mode' });
  };
  const input = buildInput();

  await sendReminderIfNotDuplicate(store, sendFn, 'test', input);
  await sendReminderIfNotDuplicate(store, sendFn, 'test', input);
  const third = await sendReminderIfNotDuplicate(store, sendFn, 'test', input);

  assert.deepEqual(third, { outcome: 'duplicate' });
  assert.equal(sendCallCount, 1);
  assert.equal(store.rows.length, 1);
});

// --- Non-duplicate tuples must NOT be conflated with each other ----------

Deno.test('a different recipient for the SAME session/template is NOT treated as a duplicate', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: false, reason: 'skipped_test_mode' });
  };

  await sendReminderIfNotDuplicate(store, sendFn, 'test', buildInput({ toEmail: 'student@example.com' }));
  await sendReminderIfNotDuplicate(
    store,
    sendFn,
    'test',
    buildInput({
      toEmail: 'parent@example.com',
      dedupeCriteria: { template: 'event-reminder-48h', sessionId: 'session-aaa', toEmail: 'parent@example.com' },
    }),
  );

  assert.equal(sendCallCount, 2);
  assert.equal(store.rows.length, 2);
});

Deno.test('a different SESSION for the same template/recipient is NOT treated as a duplicate', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: false, reason: 'skipped_test_mode' });
  };

  await sendReminderIfNotDuplicate(store, sendFn, 'test', buildInput({ sessionId: 'session-aaa' }));
  await sendReminderIfNotDuplicate(
    store,
    sendFn,
    'test',
    buildInput({
      sessionId: 'session-zzz',
      dedupeCriteria: { template: 'event-reminder-48h', sessionId: 'session-zzz', toEmail: 'student@example.com' },
    }),
  );

  assert.equal(sendCallCount, 2);
  assert.equal(store.rows.length, 2);
});

Deno.test('a different TEMPLATE for the same session/recipient is NOT treated as a duplicate (e.g. 48h vs 3h reminder for the same session)', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: false, reason: 'skipped_test_mode' });
  };

  await sendReminderIfNotDuplicate(store, sendFn, 'test', buildInput({ template: 'event-reminder-48h' }));
  await sendReminderIfNotDuplicate(
    store,
    sendFn,
    'test',
    buildInput({
      template: 'event-reminder-3h',
      dedupeCriteria: { template: 'event-reminder-3h', sessionId: 'session-aaa', toEmail: 'student@example.com' },
    }),
  );

  assert.equal(sendCallCount, 2);
  assert.equal(store.rows.length, 2);
});

// --- weekly-digest's distinct (sentAtWindow-based) dedupe shape ----------

Deno.test('weekly-digest: same tuple twice WITHIN the same sentAtWindow dedupes to one send (session_id is always null for this template)', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: false, reason: 'skipped_test_mode' });
  };

  // `InMemoryEmailLogStore.insert` stamps each row with the REAL wall-clock
  // time it is called (matching `email_log.sent_at`'s own `default now()`
  // in production, where this module never passes an explicit timestamp).
  // The window below is therefore built to bracket the real "now" at test
  // time (a 10-minute window centered on it), not a fixed calendar literal
  // -- both sequential calls below complete within milliseconds of each
  // other, comfortably inside that window.
  const now = new Date();
  const dedupeCriteria = {
    template: 'weekly-digest',
    sessionId: null,
    toEmail: 'parent@example.com',
    sentAtWindow: {
      startIso: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      endIso: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    },
  };
  const input = buildInput({
    template: 'weekly-digest',
    sessionId: null,
    toEmail: 'parent@example.com',
    dedupeCriteria,
  });

  const first = await sendReminderIfNotDuplicate(store, sendFn, 'test', input);
  const second = await sendReminderIfNotDuplicate(store, sendFn, 'test', input);

  assert.deepEqual(first, { outcome: 'skipped_test_mode' });
  assert.deepEqual(second, { outcome: 'duplicate' });
  assert.equal(sendCallCount, 1);
  assert.equal(store.rows.length, 1);
});

Deno.test('weekly-digest: the SAME recipient in a DIFFERENT week (disjoint sentAtWindow) is allowed through, not treated as a duplicate', async () => {
  const store = new InMemoryEmailLogStore();
  let sendCallCount = 0;
  const sendFn = (): Promise<SendEmailResult> => {
    sendCallCount += 1;
    return Promise.resolve({ sent: false, reason: 'skipped_test_mode' });
  };

  // Same "bracket the real insert timestamp" reasoning as the test above:
  // `weekOneCriteria`'s window brackets real "now" (so the row this test's
  // first call inserts, stamped at real "now", falls inside it);
  // `weekTwoCriteria` is a full week later -- genuinely disjoint from real
  // "now" regardless of what the sandbox's wall clock happens to read.
  const now = new Date();
  const weekOneCriteria = {
    template: 'weekly-digest',
    sessionId: null,
    toEmail: 'parent@example.com',
    sentAtWindow: {
      startIso: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
      endIso: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    },
  };
  const weekTwoCriteria = {
    template: 'weekly-digest',
    sessionId: null,
    toEmail: 'parent@example.com',
    sentAtWindow: {
      startIso: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      endIso: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 15 * 60 * 1000).toISOString(),
    },
  };

  await sendReminderIfNotDuplicate(
    store,
    sendFn,
    'test',
    buildInput({ template: 'weekly-digest', sessionId: null, toEmail: 'parent@example.com', dedupeCriteria: weekOneCriteria }),
  );
  await sendReminderIfNotDuplicate(
    store,
    sendFn,
    'test',
    buildInput({ template: 'weekly-digest', sessionId: null, toEmail: 'parent@example.com', dedupeCriteria: weekTwoCriteria }),
  );

  assert.equal(sendCallCount, 2, 'next week is a genuinely new send, not a duplicate of last week');
  assert.equal(store.rows.length, 2);
});

// --- BLOCKER-class: the RESEND_SEND_MODE gate is respected inside the ----
// --- dedupe-then-send path, never bypassed --------------------------------

Deno.test('outside production mode, sendReminderIfNotDuplicate never causes a real network call, and still writes a skipped_test_mode row', async () => {
  const store = new InMemoryEmailLogStore();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => {
    throw new Error('the real Resend API must never be reached outside production mode');
  }) as typeof fetch;

  // Uses the REAL sendBrandedEmail from resend.ts (not a fake) to prove the
  // gate holds end-to-end through this orchestration layer, not just in
  // resend.test.ts's own isolated tests.
  const { sendBrandedEmail } = await import('./resend.ts');

  try {
    const outcome = await sendReminderIfNotDuplicate(store, sendBrandedEmail, 'test' as SendMode, buildInput());
    assert.deepEqual(outcome, { outcome: 'skipped_test_mode' });
    assert.equal(store.rows.length, 1);
    assert.equal(store.rows[0].status, 'skipped_test_mode');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
