// supabase/functions/send-invite/email_log.ts
//
// T048 -- shared `email_log` write helper (EML-01: "Every send logged to
// `email_log`"). Ground Truth (from this task's worker packet, read
// directly from the migrations, not guessed):
//
//   supabase/migrations/20260717000001_support_audit.sql:
//     create table public.email_log (
//       id uuid primary key default gen_random_uuid(),
//       to_email text not null,
//       template text not null,
//       session_id uuid,        -- nullable, no FK (deliberate)
//       profile_id uuid,        -- nullable, no FK (deliberate)
//       status text not null,   -- unconstrained text, no enumerated vocabulary
//       sent_at timestamptz not null default now(),
//       created_at timestamptz not null default now()
//     );
//
//   supabase/migrations/20260717000002_rls.sql:
//     alter table public.email_log enable row level security;
//     create policy staff_read on email_log for select to authenticated using (is_staff());
//   -- there is NO insert policy for any authenticated role. "Populated
//   -- exclusively by future service-role Edge Functions, which bypass RLS
//   -- as table owner." This confirms the insert below must go through the
//   -- service-role `adminClient` already in scope at index.ts's extension
//   -- point -- it bypasses RLS as the designed mechanism, not a gap.
//
// STATUS VOCABULARY (this task's own choice -- no enumerated vocabulary was
// given anywhere available to this task; T050/T051, both currently Blocked,
// will need to interoperate with whatever is picked here):
//   'sent'               -- production mode, and Resend's API accepted the
//                           send (2xx response).
//   'failed'             -- production mode, but the send did not succeed
//                           (Resend returned a non-2xx status, or
//                           RESEND_API_KEY was missing/misconfigured).
//   'skipped_test_mode'  -- RESEND_SEND_MODE was not exactly 'production',
//                           so the real Resend API was never called at all
//                           (constitution item 7's test-mode gate). This
//                           value exists specifically so a reviewer (T052)
//                           or a future reminder-dedupe query (EML-03) can
//                           distinguish "we tried and it failed" from "we
//                           deliberately did not attempt this while in test
//                           mode" -- these are not the same fact.
export type EmailLogStatus = 'sent' | 'failed' | 'skipped_test_mode';

export interface EmailLogEntry {
  to_email: string;
  template: string;
  session_id?: string | null;
  profile_id?: string | null;
  status: EmailLogStatus;
}

// Minimal shape of the adminClient methods this helper needs, so it can be
// unit-tested against a fake client without importing supabase-js (matching
// the same "pure logic, testable without a live Supabase project" pattern
// T017/T032 used for validation.ts/attendance_upsert.ts).
export interface EmailLogWriter {
  from(table: string): {
    insert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
}

export interface WriteEmailLogResult {
  ok: boolean;
}

/**
 * Writes one `email_log` row via the service-role `adminClient` (bypasses
 * RLS by design -- see the table's own `staff_read`-only policy above).
 * Never throws -- a logging failure must not take down the invite-send
 * response itself; callers get `{ ok: false }` back and may log
 * (PII-free) diagnostics themselves.
 */
export async function writeEmailLog(adminClient: EmailLogWriter, entry: EmailLogEntry): Promise<WriteEmailLogResult> {
  const { error } = await adminClient.from('email_log').insert({
    to_email: entry.to_email,
    template: entry.template,
    session_id: entry.session_id ?? null,
    profile_id: entry.profile_id ?? null,
    status: entry.status,
  });

  if (error) {
    // Constitution item 6: no PII (to_email) in logs -- log template/status
    // only, never the recipient address or the raw error object (which
    // could otherwise echo back inserted values).
    console.error('send-invite: email_log insert failed', { template: entry.template, status: entry.status });
    return { ok: false };
  }

  return { ok: true };
}
