// src/emails/templates/invite.tsx
//
// T049 -- EML-02 "invite" template (row 1 of the v1 template set, PRD line
// 318-326, cited verbatim): trigger "AUTH-03" (invite sent), recipient
// "invitee".
//
// TRAP #1 DECISION -- plain TypeScript, `.tsx` filename, NOT React/JSX
// (written once here in full; `signup-confirm.tsx`, `event-reminder-48h.tsx`,
// `event-reminder-3h.tsx`, and `meeting-reminder-3h.tsx` each carry a short
// cross-reference back to this comment rather than repeating it verbatim):
//
// `src/emails/layout/renderEmailLayout.ts`/`constants.ts` (T048, read-only
// to this task) are deliberately zero-React/JSX plain TypeScript so the
// exact same source file is importable byte-unchanged from BOTH the src/
// Vite/tsc toolchain AND the Deno runtime -- `supabase/functions/send-invite/
// index.ts` already reaches `renderEmailLayout.ts` via a relative import one
// level above its own function directory, and EML-03 describes
// `send-reminders` as the analogous (not-yet-built, T051) Deno Edge Function
// that will eventually call `event-reminder-48h`/`event-reminder-3h`/
// `meeting-reminder-3h`/`signup-confirm`. PRD EML-02 itself frames all five
// of these templates as content actually sent BY those two Deno Edge
// Functions, not merely rendered in a browser tab -- so this task follows
// T048's own precedent: this file (and its four siblings) is plain
// TypeScript, zero React/JSX/`@astryxdesign/*` import, exporting ordinary
// functions that build and return HTML/plain-text strings. The `.tsx`
// extension is exactly what the task ledger names these five files as; a
// `.tsx` extension does not by itself require JSX content -- `tsc`/Vite both
// accept a `.tsx` file containing no JSX syntax at all (this repo's own
// `tsconfig.json` sets `"jsx": "react-jsx"`, which only changes how JSX
// syntax -- if any were present -- gets transformed; it does not forbid a
// `.tsx` file with zero JSX in it). Keeping the ledger's literal filename
// while staying Deno-import-compatible is therefore possible without
// contradiction. The alternative (real JSX + a React-based email renderer,
// e.g. an `@react-email/*`-style package) was rejected for the same two
// reasons T048's own module doc gives: (1) it is not on the constitution
// item 9 dependency allowlist, and adding one would require a disclosed
// dispute, not a silent addition; and (2) even if it were allowlisted, there
// is no build step wired between src/ and the Deno Edge Functions today that
// would make a JSX-based template consumable from `send-invite`/
// `send-reminders` without new infrastructure this task is not scoped to
// build. A hand-written HTML-string function has no such gap -- it is
// importable from both runtimes today, with zero new dependencies.
//
// DEPENDENCIES NOTE (disclosed per this task's worker packet Dependencies
// section): `src/emails/layout/inviteFixtureBody.ts` (T048) is left
// completely untouched by this task. Its own module doc says T049 "should
// very likely replace or delete this fixture outright once it lands" -- but
// `src/emails/layout/**` is explicitly outside this task's Allowed Files
// (and is listed in this task's own Forbidden Files), so it cannot be edited
// or deleted here. This file is the real replacement content. Whether
// `supabase/functions/send-invite/index.ts`'s EXTENSION POINT call to
// `buildInviteFixtureBodyHtml`/`buildInviteFixturePreviewText` gets swapped
// for this file's `buildInviteBodyHtml`/`buildInvitePreviewText` is a future
// wiring task's decision (`supabase/functions/send-invite/**` is also this
// task's Forbidden Files) -- nothing in this file touches
// `src/emails/layout/**` or `supabase/functions/**`.
//
// Escaping: `renderEmailLayout()`'s own `bodyHtml` contract is "trusted HTML
// the layout does NOT re-escape" -- this file owns escaping any dynamic
// value before interpolating it. `escapeHtml` below mirrors
// `renderEmailLayout.ts`'s own (unexported, so not importable) `escapeHtml`
// helper exactly; it is duplicated per-file across this task's five
// templates rather than factored into a shared util, since this task's
// Allowed Files are exactly these five template files plus colocated tests
// -- no shared-helper file is in scope to create. This mirrors the same
// reimplement-rather-than-reach-into-a-sibling-task's-file posture
// `src/pages/home/StudentHome.tsx` already takes for its own
// `formatDateOnly`/`formatDateTimeRange` (see that file's own comment).

/** `role_enum` value. Per EML-02's "invite" row, the recipient is the
 * invitee themselves -- there is no invitee display name available at send
 * time (`supabase/functions/send-invite/index.ts`, read-only reference,
 * only has the invitee's `email` and validated `role` in scope at its
 * EXTENSION POINT; the invitee has no `profiles` row yet). `role` is
 * already validated against the `role_enum` vocabulary upstream
 * (`validation.ts`), matching `inviteFixtureBody.ts`'s own documented
 * assumption -- not raw/unescaped user text, safe to interpolate directly. */
export type InviteRole = 'admin' | 'coach' | 'student' | 'parent';

export interface InviteTemplateProps {
  role: InviteRole;
  /** Display name of the admin/coach who sent the invite, if the caller has
   * one available. Optional because the real send path currently only has
   * `callerProfile.id` (a uuid), not a display name, in scope at its
   * EXTENSION POINT -- see that file's own comment. Freeform text: escaped
   * before interpolation, never assumed pre-sanitized. */
  inviterName?: string;
  /** AUTH-06: invites expire this many days after creation. Defaults to the
   * same literal (`14`) `validation.ts`'s own `computeExpiresAt` uses, so
   * this template stays honest even if a caller does not pass it explicitly
   * -- a real send path should still pass it explicitly once wired, so this
   * copy cannot silently drift from that constant if it ever changes. */
  expiresInDays?: number;
}

const DEFAULT_EXPIRES_IN_DAYS = 14;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** DES-14 sentence case, plain verbs. BEH-09 "say what happens next": states
 * the separate sign-in email that is already on its way (per
 * `send-invite/index.ts`'s own comment, Supabase's default invite email is
 * sent moments before this branded one) and the real AUTH-06 expiry. */
export function buildInviteBodyHtml(props: InviteTemplateProps): string {
  const expiresInDays = props.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS;
  const role = props.role;

  const introText = props.inviterName
    ? `<strong>${escapeHtml(props.inviterName)}</strong> invited you to join <strong>VOLT Robotics</strong>'s team portal as a <strong>${role}</strong>.`
    : `You've been invited to join <strong>VOLT Robotics</strong>'s team portal as a <strong>${role}</strong>.`;

  return `
    <p style="margin:0 0 16px;">${introText}</p>
    <p style="margin:0 0 16px;">Check your inbox for a separate sign-in link to finish setting up your account.</p>
    <p style="margin:0; color:#6b6480; font-size:13px;">This invite link expires in ${expiresInDays} days.</p>
  `;
}

export function buildInvitePreviewText(props: InviteTemplateProps): string {
  // Passed to `renderEmailLayout()`, which escapes `previewText` itself
  // (see that file's own doc) -- plain text is returned here, not
  // pre-escaped HTML.
  return props.inviterName
    ? `${props.inviterName} invited you to join VOLT Robotics as a ${props.role}.`
    : `You're invited to join VOLT Robotics as a ${props.role}.`;
}
