// src/emails/layout/inviteFixtureBody.ts
//
// T048 -- a MINIMAL, deliberately plain "invite" email body, used only to:
//   1. prove `renderEmailLayout` produces correct end-to-end output in this
//      task's own tests (`renderEmailLayout.test.ts` imports this), and
//   2. give `supabase/functions/send-invite/index.ts` *something* real to
//      pass as `bodyHtml` when its extension point calls Resend --
//      constitution item 7's test-mode gate means this will rarely/never
//      actually reach a real inbox before T052 signs off, but the code path
//      wired at the extension point still needs to be structurally
//      complete end-to-end, not stubbed out.
//
// THIS IS EXPLICITLY NOT T049's DELIVERABLE. `src/emails/templates/**` is
// T049's Allowed Files, not this task's (see this task's Forbidden Files
// list) -- the actual "invite" template's real copy/design belongs there.
// This fixture lives under `src/emails/layout/**` (this task's own Allowed
// Files) specifically so it stays out of T049's territory. T049 should very
// likely replace or delete this fixture outright once it lands; nothing
// here should be read as a finished template deliverable.
export interface InviteFixtureBodyParams {
  /** `role_enum` value, already validated by `validation.ts` upstream -- not raw/unescaped user text, safe to interpolate directly. */
  role: 'admin' | 'coach' | 'student' | 'parent';
}

export function buildInviteFixtureBodyHtml(params: InviteFixtureBodyParams): string {
  return `
    <p style="margin:0 0 16px;">You've been invited to join <strong>VOLT Robotics</strong>'s team portal as a <strong>${params.role}</strong>.</p>
    <p style="margin:0 0 16px;">Check your inbox for a separate sign-in link to finish setting up your account.</p>
    <p style="margin:0; color:#6b6480; font-size:13px;">(This is a placeholder message from T048's shared-layout fixture -- T049 owns the real invite template content.)</p>
  `;
}

export function buildInviteFixturePreviewText(params: InviteFixtureBodyParams): string {
  return `You're invited to join VOLT Robotics as a ${params.role}.`;
}
