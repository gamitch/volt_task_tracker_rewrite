// supabase/functions/send-reminders/send_reminder.ts
//
// T051 -- the actual "dedupe-check-then-send" orchestration (worker packet
// Known Context/Traps #1's central safety property). Deliberately factored
// out of index.ts so it is unit-testable end-to-end (dedupe check + Resend
// gate + email_log write) against fakes, with no live Supabase project or
// network access required -- see `send_reminder.test.ts` for this task's
// required "invoke the logic twice for the identical tuple" dedupe proof.
import { SENDER_ADDRESS } from '../../../src/emails/layout/constants.ts';
import type { DedupeCriteria, EmailLogEntry, EmailLogStatus, EmailLogStore } from './email_log_store.ts';
import type { SendEmailResult, SendMode } from './resend.ts';

export interface SendReminderInput {
  template: string;
  sessionId: string | null;
  toEmail: string;
  profileId: string | null;
  subject: string;
  html: string;
  /** The dedupe lookup key for this exact send attempt -- built by the
   * caller (index.ts) from `template`/`sessionId`/`toEmail` above, plus
   * `sentAtWindow` for weekly-digest (see email_log_store.ts's file
   * header). Passed in explicitly (not re-derived here) so the caller's
   * `now`/window computation is the single source of truth. */
  dedupeCriteria: DedupeCriteria;
}

export type SendReminderOutcome =
  | { outcome: 'duplicate' }
  | { outcome: 'sent' }
  | { outcome: 'skipped_test_mode' }
  | { outcome: 'failed' };

/**
 * Step order (BLOCKER-class, worker packet Known Context/Traps #1): dedupe
 * check FIRST, real send attempt (through the fail-closed `RESEND_SEND_MODE`
 * gate) SECOND, `email_log` write LAST -- and the write happens for every
 * outcome except `duplicate` (a duplicate is skipped entirely: no second
 * send attempt, no second `email_log` row -- that is the whole point of the
 * dedupe check, not an optimization on top of it).
 */
export async function sendReminderIfNotDuplicate(
  store: EmailLogStore,
  sendFn: (input: { to: string; subject: string; html: string; from: string }, mode: SendMode) => Promise<SendEmailResult>,
  sendMode: SendMode,
  input: SendReminderInput,
): Promise<SendReminderOutcome> {
  const alreadyExists = await store.findExisting(input.dedupeCriteria);
  if (alreadyExists) {
    return { outcome: 'duplicate' };
  }

  const sendResult = await sendFn(
    { to: input.toEmail, subject: input.subject, html: input.html, from: SENDER_ADDRESS },
    sendMode,
  );

  const status: EmailLogStatus = sendResult.sent ? 'sent' : sendResult.reason === 'skipped_test_mode' ? 'skipped_test_mode' : 'failed';

  const entry: EmailLogEntry = {
    to_email: input.toEmail,
    template: input.template,
    session_id: input.sessionId,
    profile_id: input.profileId,
    status,
  };
  await store.insert(entry);

  if (status === 'failed') {
    // No PII (constitution item 6): template/reason only, never to_email.
    console.error('send-reminders: branded Resend send did not succeed', {
      template: input.template,
      reason: !sendResult.sent ? sendResult.reason : undefined,
    });
  }

  return { outcome: status };
}
