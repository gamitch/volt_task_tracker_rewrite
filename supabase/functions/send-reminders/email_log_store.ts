// supabase/functions/send-reminders/email_log_store.ts
//
// T051 -- EML-03's "dedupe against email_log" correctness requirement
// (worker packet Known Context/Traps #1, cited as constitution item 7's own
// explicit framing: "dedupe is a correctness requirement, not an
// optimization" -- the central safety property of this task). This module
// is deliberately separate from index.ts so the dedupe-check-then-send
// logic is unit-testable against a fake, in-memory store, matching this
// codebase's own established "pure logic, testable without a live Supabase
// project" pattern (checkin/attendance_upsert.ts, send-invite/email_log.ts).
//
// GROUND TRUTH (from `supabase/migrations/20260717000001_support_audit.sql`,
// lines 62-73, read directly, not guessed): `email_log` has `to_email text
// not null`, `template text not null`, `session_id uuid` (nullable, no FK,
// deliberately -- rows survive session deletion), `profile_id uuid`
// (nullable, same reasoning), `status text not null`, `sent_at timestamptz
// not null default now()`. No unique constraint exists on any combination
// of these columns.
//
// DEDUPE KEY CHOICE (worker packet: "disclose and be consistent"): the
// recipient half of the key is `to_email`, NOT `profile_id`. Reasons:
//   1. `to_email` is `not null` on `email_log`; `profile_id` is nullable
//      (e.g. an invite-template row -- not relevant to this task, but the
//      column's own nullability signals it is not always populated).
//   2. Every one of this task's five templates always has a real recipient
//      email address by construction (resolved from `profiles.email` before
//      a send is ever attempted) -- `to_email` is always available, so
//      keying on it needs no special-casing.
//   3. `profile_id` IS still written to every `email_log` row this module
//      inserts (via `EmailLogEntry.profile_id`) for audit/query purposes --
//      it is simply not part of the dedupe LOOKUP key.
//
// TWO DISTINCT DEDUPE SHAPES (per-session templates vs. weekly-digest -- see
// due_window.ts's file header for the weekly-digest scope disclosure this
// directly follows from):
//   - event-reminder-48h / event-reminder-3h / meeting-reminder-3h: the
//     dedupe key is `(template, session_id, to_email)` -- `session_id` is
//     real and non-null (a given session becomes due for a given template
//     exactly once, ever, so ANY existing matching row -- regardless of its
//     `status` -- means "already attempted", and this send is skipped).
//   - weekly-digest: `session_id` is ALWAYS null (it is not a per-session
//     reminder at all -- see due_window.ts). Keying on `(template, null,
//     to_email)` alone would be WRONG: it would match the very first
//     weekly-digest ever sent to that address and then block EVERY future
//     week's digest forever, since `email_log` has no "which week" column.
//     Instead, weekly-digest dedupe additionally scopes the lookup to
//     `sent_at` falling within the CURRENT week's 15-minute send window
//     (`due_window.ts`'s `computeWeeklyDigestSentAtWindow(now)`, passed in
//     by the caller as `criteria.sentAtWindow`) -- this correctly dedupes a
//     same-window retry/overlap (this task's own required proof case) while
//     still allowing next week's digest through, because next week's
//     `sentAtWindow` is a disjoint range. Known risk (disclosed in worker
//     output): this is a narrower dedupe guarantee than the per-session
//     templates get -- it protects against retries WITHIN the same 15-
//     minute window, not against some other, unanticipated future code path
//     sending a second weekly-digest batch mid-week. Given `email_log` has
//     no dedicated "period"/"week" column and this task's allowed migration
//     is scoped to pg_cron only (not schema changes to `email_log`), this is
//     the strongest guarantee achievable without a schema change -- flagged
//     as a known risk / potential follow-up in worker output, not silently
//     presented as airtight.
//
// CONCURRENCY CAVEAT (disclosed, not hidden): `findExisting` then `insert`
// is a check-then-act sequence, not one atomic database operation --
// `email_log` has no unique constraint to enforce this atomically at the
// database layer, and adding one is out of this task's Allowed Files scope
// (the only migration this task may add is the additive, pg_cron-only
// `_cron.sql`; unrelated schema changes to the pre-existing `email_log`
// table are not part of that migration's stated purpose). Two truly
// concurrent invocations of `sendReminderIfNotDuplicate` for the identical
// tuple could theoretically both pass `findExisting` before either
// `insert`s, producing two rows/two sends. This task's own required proof
// (worker packet: "invokes your dedupe-check-then-send logic twice ...
// asserts exactly one ... results") is the SEQUENTIAL case -- a retry after
// the first attempt has already completed and been recorded -- which this
// design handles correctly and deterministically (proven in
// `email_log_store.test.ts`). True concurrent-overlap is a narrower,
// disclosed residual risk, not something claimed to be solved here.

export type EmailLogStatus = 'sent' | 'failed' | 'skipped_test_mode';

export interface EmailLogEntry {
  to_email: string;
  template: string;
  session_id: string | null;
  profile_id: string | null;
  status: EmailLogStatus;
}

export interface SentAtWindow {
  /** Inclusive lower bound, ISO 8601 UTC. */
  startIso: string;
  /** Exclusive upper bound, ISO 8601 UTC. */
  endIso: string;
}

export interface DedupeCriteria {
  template: string;
  toEmail: string;
  /** Non-null for the three per-session templates; null for weekly-digest
   * (see file header). */
  sessionId: string | null;
  /** Required (and used) only when `sessionId` is null -- see file header
   * "weekly-digest" dedupe shape. Ignored when `sessionId` is non-null. */
  sentAtWindow?: SentAtWindow;
}

export interface EmailLogStore {
  /** True iff a matching row already exists (see file header for the two
   * distinct matching shapes). */
  findExisting(criteria: DedupeCriteria): Promise<boolean>;
  insert(entry: EmailLogEntry): Promise<{ ok: boolean }>;
}

// Minimal shape of the adminClient methods this module needs, so it can be
// wired against a real `SupabaseClient` in index.ts without importing
// `@supabase/supabase-js` types into this module itself (same "narrow
// interface, not the full client type" pattern
// `send-invite/email_log.ts`'s own `EmailLogWriter` already established).
export interface QueryBuilderLike {
  eq(column: string, value: unknown): QueryBuilderLike;
  gte(column: string, value: unknown): QueryBuilderLike;
  lt(column: string, value: unknown): QueryBuilderLike;
  limit(count: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>;
}

export interface EmailLogTableClient {
  select(columns: string): QueryBuilderLike;
  insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
}

export interface EmailLogClientLike {
  from(table: 'email_log'): EmailLogTableClient;
}

/**
 * Real, Supabase-backed `EmailLogStore`. `findExisting` fails CLOSED on a
 * query error (treats it as "a matching row exists" / skip-this-send)
 * rather than open: the harm this module exists to prevent (a duplicate
 * send) is judged worse than the harm of a rare missed reminder caused by a
 * transient lookup error, mirroring the same fail-closed philosophy
 * `resend.ts`'s `resolveSendMode()` already uses for the test-mode gate --
 * disclosed explicitly here since it is a real, deliberate trade-off, not
 * an accident. `insert` mirrors `send-invite/email_log.ts`'s own
 * `writeEmailLog` -- never throws, logs template/status only (no `to_email`
 * -- constitution item 6, no PII in logs).
 */
export function createSupabaseEmailLogStore(adminClient: EmailLogClientLike): EmailLogStore {
  return {
    async findExisting(criteria: DedupeCriteria): Promise<boolean> {
      let query = adminClient.from('email_log').select('id').eq('template', criteria.template).eq('to_email', criteria.toEmail);

      if (criteria.sessionId !== null) {
        query = query.eq('session_id', criteria.sessionId);
      } else if (criteria.sentAtWindow) {
        query = query.gte('sent_at', criteria.sentAtWindow.startIso).lt('sent_at', criteria.sentAtWindow.endIso);
      }

      const { data, error } = await query.limit(1);

      if (error) {
        // Fail-closed (see function header) -- no PII (to_email) in the log.
        console.error('send-reminders: email_log dedupe lookup failed, failing closed (skipping send)', {
          template: criteria.template,
        });
        return true;
      }

      return (data?.length ?? 0) > 0;
    },

    async insert(entry: EmailLogEntry): Promise<{ ok: boolean }> {
      const { error } = await adminClient.from('email_log').insert({
        to_email: entry.to_email,
        template: entry.template,
        session_id: entry.session_id,
        profile_id: entry.profile_id,
        status: entry.status,
      });

      if (error) {
        console.error('send-reminders: email_log insert failed', { template: entry.template, status: entry.status });
        return { ok: false };
      }

      return { ok: true };
    },
  };
}

/**
 * In-memory `EmailLogStore` fake -- used by this module's own tests
 * (`email_log_store.test.ts`) to prove the dedupe/re-run guarantee without
 * a live Supabase project. Implements the identical matching semantics as
 * `createSupabaseEmailLogStore` above (same two dedupe shapes), just backed
 * by a plain array instead of a real `email_log` table.
 */
export class InMemoryEmailLogStore implements EmailLogStore {
  readonly rows: EmailLogEntry[] = [];
  private readonly sentAt: Date[] = [];

  findExisting(criteria: DedupeCriteria): Promise<boolean> {
    const match = this.rows.some((row, index) => {
      if (row.template !== criteria.template || row.to_email !== criteria.toEmail) return false;
      if (criteria.sessionId !== null) {
        return row.session_id === criteria.sessionId;
      }
      if (row.session_id !== null) return false;
      if (!criteria.sentAtWindow) return true;
      const sentAtIso = this.sentAt[index].toISOString();
      return sentAtIso >= criteria.sentAtWindow.startIso && sentAtIso < criteria.sentAtWindow.endIso;
    });
    return Promise.resolve(match);
  }

  insert(entry: EmailLogEntry, sentAt: Date = new Date()): Promise<{ ok: boolean }> {
    this.rows.push(entry);
    this.sentAt.push(sentAt);
    return Promise.resolve({ ok: true });
  }
}
