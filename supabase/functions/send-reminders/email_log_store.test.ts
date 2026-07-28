// supabase/functions/send-reminders/email_log_store.test.ts
//
// T051 -- unit tests for `email_log_store.ts` itself: the Supabase-backed
// adapter's query construction (proves it queries by the right columns,
// not by relying on `send_reminder.test.ts`'s higher-level proof alone),
// its fail-closed behavior on a lookup error, and the in-memory fake's own
// matching semantics in isolation. Run with `deno test --allow-env`.
import assert from 'node:assert/strict';
import {
  createSupabaseEmailLogStore,
  InMemoryEmailLogStore,
  type EmailLogClientLike,
  type EmailLogTableClient,
  type QueryBuilderLike,
} from './email_log_store.ts';

// --- a minimal fake EmailLogClientLike that records every filter call ----

interface RecordedQuery {
  eqCalls: Array<[string, unknown]>;
  gteCalls: Array<[string, unknown]>;
  ltCalls: Array<[string, unknown]>;
}

function buildFakeSelectClient(result: { data: unknown[] | null; error: { message: string } | null }): {
  client: EmailLogClientLike;
  inserted: Record<string, unknown>[];
  recordedQuery: RecordedQuery;
} {
  const inserted: Record<string, unknown>[] = [];
  const recordedQuery: RecordedQuery = { eqCalls: [], gteCalls: [], ltCalls: [] };

  function buildBuilder(): QueryBuilderLike {
    const builder: QueryBuilderLike = {
      eq(column, value) {
        recordedQuery.eqCalls.push([column, value]);
        return builder;
      },
      gte(column, value) {
        recordedQuery.gteCalls.push([column, value]);
        return builder;
      },
      lt(column, value) {
        recordedQuery.ltCalls.push([column, value]);
        return builder;
      },
      limit() {
        return Promise.resolve(result);
      },
    };
    return builder;
  }

  const tableClient: EmailLogTableClient = {
    select: () => buildBuilder(),
    insert: (row) => {
      inserted.push(row);
      return Promise.resolve({ error: null });
    },
  };

  const client: EmailLogClientLike = {
    from: () => tableClient,
  };

  return { client, inserted, recordedQuery };
}

Deno.test('createSupabaseEmailLogStore.findExisting: for a per-session template, filters by template + to_email + session_id (not sent_at)', async () => {
  const { client, recordedQuery } = buildFakeSelectClient({ data: [], error: null });
  const store = createSupabaseEmailLogStore(client);

  await store.findExisting({ template: 'event-reminder-48h', toEmail: 'student@example.com', sessionId: 'session-1' });

  assert.deepEqual(recordedQuery.eqCalls, [
    ['template', 'event-reminder-48h'],
    ['to_email', 'student@example.com'],
    ['session_id', 'session-1'],
  ]);
  assert.deepEqual(recordedQuery.gteCalls, []);
  assert.deepEqual(recordedQuery.ltCalls, []);
});

Deno.test('createSupabaseEmailLogStore.findExisting: for weekly-digest (sessionId null), filters by template + to_email + sent_at window, not session_id', async () => {
  const { client, recordedQuery } = buildFakeSelectClient({ data: [], error: null });
  const store = createSupabaseEmailLogStore(client);

  await store.findExisting({
    template: 'weekly-digest',
    toEmail: 'parent@example.com',
    sessionId: null,
    sentAtWindow: { startIso: '2026-07-19T22:00:00.000Z', endIso: '2026-07-19T22:15:00.000Z' },
  });

  assert.deepEqual(recordedQuery.eqCalls, [
    ['template', 'weekly-digest'],
    ['to_email', 'parent@example.com'],
  ]);
  assert.deepEqual(recordedQuery.gteCalls, [['sent_at', '2026-07-19T22:00:00.000Z']]);
  assert.deepEqual(recordedQuery.ltCalls, [['sent_at', '2026-07-19T22:15:00.000Z']]);
});

Deno.test('createSupabaseEmailLogStore.findExisting: returns true when a matching row exists', async () => {
  const { client } = buildFakeSelectClient({ data: [{ id: 'row-1' }], error: null });
  const store = createSupabaseEmailLogStore(client);

  const result = await store.findExisting({ template: 'event-reminder-3h', toEmail: 'x@example.com', sessionId: 's1' });

  assert.equal(result, true);
});

Deno.test('createSupabaseEmailLogStore.findExisting: returns false when no matching row exists', async () => {
  const { client } = buildFakeSelectClient({ data: [], error: null });
  const store = createSupabaseEmailLogStore(client);

  const result = await store.findExisting({ template: 'event-reminder-3h', toEmail: 'x@example.com', sessionId: 's1' });

  assert.equal(result, false);
});

Deno.test('createSupabaseEmailLogStore.findExisting: FAILS CLOSED (treats as duplicate/skip) on a query error, does not throw', async () => {
  const { client } = buildFakeSelectClient({ data: null, error: { message: 'connection reset' } });
  const store = createSupabaseEmailLogStore(client);

  const result = await store.findExisting({ template: 'meeting-reminder-3h', toEmail: 'x@example.com', sessionId: 's1' });

  assert.equal(result, true, 'a lookup error must fail CLOSED (skip the send) rather than risk a duplicate');
});

Deno.test('createSupabaseEmailLogStore.insert: writes the exact email_log column shape', async () => {
  const { client, inserted } = buildFakeSelectClient({ data: [], error: null });
  const store = createSupabaseEmailLogStore(client);

  const result = await store.insert({
    to_email: 'student@example.com',
    template: 'event-reminder-48h',
    session_id: 'session-1',
    profile_id: 'profile-1',
    status: 'sent',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(inserted, [
    {
      to_email: 'student@example.com',
      template: 'event-reminder-48h',
      session_id: 'session-1',
      profile_id: 'profile-1',
      status: 'sent',
    },
  ]);
});

// --- InMemoryEmailLogStore's own matching semantics, in isolation --------

Deno.test('InMemoryEmailLogStore: matches per-session criteria on (template, session_id, to_email) exactly', async () => {
  const store = new InMemoryEmailLogStore();
  await store.insert({ to_email: 'a@example.com', template: 'event-reminder-48h', session_id: 's1', profile_id: null, status: 'sent' });

  assert.equal(await store.findExisting({ template: 'event-reminder-48h', toEmail: 'a@example.com', sessionId: 's1' }), true);
  assert.equal(await store.findExisting({ template: 'event-reminder-48h', toEmail: 'a@example.com', sessionId: 's2' }), false);
  assert.equal(await store.findExisting({ template: 'event-reminder-3h', toEmail: 'a@example.com', sessionId: 's1' }), false);
  assert.equal(await store.findExisting({ template: 'event-reminder-48h', toEmail: 'b@example.com', sessionId: 's1' }), false);
});

Deno.test('InMemoryEmailLogStore: a null-session (weekly-digest) row never matches a per-session lookup and vice versa', async () => {
  const store = new InMemoryEmailLogStore();
  await store.insert({ to_email: 'parent@example.com', template: 'weekly-digest', session_id: null, profile_id: null, status: 'sent' });

  assert.equal(
    await store.findExisting({ template: 'weekly-digest', toEmail: 'parent@example.com', sessionId: 'some-session' }),
    false,
  );
});
