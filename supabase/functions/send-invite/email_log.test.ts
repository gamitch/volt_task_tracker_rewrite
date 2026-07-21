// T048: unit tests for email_log.ts. Run with
// `deno test supabase/functions/send-invite/` (same convention as T017's
// validation.test.ts). Uses an in-memory fake `EmailLogWriter` -- no live
// Supabase project needed, same pattern as T032's attendance_upsert.test.ts
// fake-table approach.
import assert from 'node:assert/strict';
import { writeEmailLog, type EmailLogEntry, type EmailLogWriter } from './email_log.ts';

function fakeAdminClient(rows: Record<string, unknown>[], shouldError = false): EmailLogWriter {
  return {
    from(table: string) {
      assert.equal(table, 'email_log');
      return {
        insert: async (row: Record<string, unknown>) => {
          if (shouldError) {
            return { error: { message: 'insert failed' } };
          }
          rows.push(row);
          return { error: null };
        },
      };
    },
  };
}

Deno.test('writeEmailLog: inserts a row with the exact email_log column shape (to_email, template, session_id, profile_id, status)', async () => {
  const rows: Record<string, unknown>[] = [];
  const client = fakeAdminClient(rows);
  const entry: EmailLogEntry = {
    to_email: 'invitee@example.com',
    template: 'invite',
    session_id: null,
    profile_id: null,
    status: 'skipped_test_mode',
  };

  const result = await writeEmailLog(client, entry);

  assert.equal(result.ok, true);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    to_email: 'invitee@example.com',
    template: 'invite',
    session_id: null,
    profile_id: null,
    status: 'skipped_test_mode',
  });
});

Deno.test('writeEmailLog: defaults session_id/profile_id to null when omitted', async () => {
  const rows: Record<string, unknown>[] = [];
  const client = fakeAdminClient(rows);

  await writeEmailLog(client, { to_email: 'a@example.com', template: 'invite', status: 'sent' });

  assert.equal(rows[0].session_id, null);
  assert.equal(rows[0].profile_id, null);
});

Deno.test('writeEmailLog: accepts every status in the chosen vocabulary (sent, failed, skipped_test_mode)', async () => {
  const rows: Record<string, unknown>[] = [];
  const client = fakeAdminClient(rows);

  for (const status of ['sent', 'failed', 'skipped_test_mode'] as const) {
    await writeEmailLog(client, { to_email: 'a@example.com', template: 'invite', status });
  }

  assert.deepEqual(
    rows.map((r) => r.status),
    ['sent', 'failed', 'skipped_test_mode'],
  );
});

Deno.test('writeEmailLog: on insert error, returns { ok: false } without throwing', async () => {
  const rows: Record<string, unknown>[] = [];
  const client = fakeAdminClient(rows, true);

  const result = await writeEmailLog(client, { to_email: 'a@example.com', template: 'invite', status: 'failed' });

  assert.equal(result.ok, false);
  assert.equal(rows.length, 0);
});
