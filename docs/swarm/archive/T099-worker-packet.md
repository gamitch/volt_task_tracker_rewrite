# Worker Packet: T099

## Task ID
T099 — URGENT: real invite emails are currently showing placeholder text to real
recipients. Fix `send-invite`'s three call sites to use T049's real, already-Passed
invite template instead of T048's throwaway fixture.

## Objective
George just ran a real production smoke test (invited himself via the live app) and
received a branded email containing the literal text: *"(This is a placeholder message
from T048's shared-layout fixture -- T049 owns the real invite template content.)"*

This is a fully known, already-disclosed gap — T049 (Passed) built the real template
(`src/emails/templates/invite.tsx`, `buildInviteBodyHtml`/`buildInvitePreviewText`) and
its own checker explicitly flagged at PASS time that `send-invite/index.ts` still called
the old fixture, not the real template — but no task's file scope included both files at
once, so it was never picked up. It's surfaced now because it just reached a real inbox.

**Three call sites need fixing, not one:**
1. The main send path (~line 475-476) still calls
   `buildInviteFixturePreviewText`/`buildInviteFixtureBodyHtml` (T048's fixture).
2. The resend path's preview text (~line 205) also calls the fixture's preview-text
   function.
3. `buildResendInviteBodyHtml` (T090's own function, ~line 94-100) — a genuinely real,
   non-fixture function with a real action link — still has the exact same placeholder
   disclaimer sentence copied verbatim into its own closing line. This one isn't a
   wrong-function-call, it's leftover placeholder prose inside otherwise-correct code.

## Allowed Files
- `supabase/functions/send-invite/index.ts`
- `supabase/functions/send-invite/*.test.ts`

## Forbidden Files
- `src/emails/templates/invite.tsx` — T049's real template, already correct and
  Passed, read-only import.
- `src/emails/layout/inviteFixtureBody.ts` — T048's fixture. Per that file's own
  module doc, it should "very likely" be deleted once T049's real template is actually
  wired in — but this packet does not authorize deleting it (a different, forbidden
  file's fate is not this task's call; leave it in place, just stop calling it from
  `index.ts`. If it becomes provably dead/unused after your fix, flag that in your
  output rather than deleting it yourself).
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Send path fix.** Replace the import (`import { buildInviteFixtureBodyHtml,
buildInviteFixturePreviewText } from '../../../src/emails/layout/inviteFixtureBody.ts'`)
with T049's real exports from `../../../src/emails/templates/invite.ts` (verify the
exact real file path/extension yourself — the repo may reference `.ts`/`.tsx` build
output differently than the source path, check how other already-correct imports in
this same file resolve cross-directory TS imports for the Deno runtime). Read
`InviteTemplateProps` in full: `role` (required), `inviterName` (optional — the send
path's own existing comment already discloses it currently only has
`callerProfile.id`, a uuid, not a display name, in scope; investigate whether a cheap
additional lookup — e.g. `callerProfile` already has more than `id` available from an
earlier query in this same function, check what's already fetched — makes a real
`inviterName` easily available, or whether omitting it and using the graceful
fallback copy is the honest, correct call for this attempt; either is acceptable,
document your choice), `expiresInDays` (optional, defaults to 14 — pass the real
`computeExpiresAt`-derived value explicitly if it's already in scope at this call
site, matching the template's own doc comment's stated preference for not relying on
the fallback silently staying in sync).

**2. Resend path's preview text.** Decide what's genuinely correct here — T049's
`buildInvitePreviewText` was written for a first-time invite ("You're invited..."),
which may not be the most accurate framing for a resend. You have the real
`buildResendInviteBodyHtml` right there in the same file for reference on the resend
framing already established — either reuse `buildInvitePreviewText` if you judge the
copy still fits, or write a small resend-specific preview-text function alongside
`buildResendInviteBodyHtml` if it doesn't. State your reasoning.

**3. `buildResendInviteBodyHtml`'s placeholder line.** Delete the placeholder
disclaimer sentence and replace it with real, accurate closing copy — this function
already has everything it needs (a real `actionLink`, a real `role`) to write a
genuine final line, not a repeat of T049's exact "expires in N days" line unless you
also thread a real expiry value into this function's params (check whether the resend
branch's caller already computes a fresh `expires_at` it could pass through — it
should, since resend extends the invite's expiry).

**4. Test coverage.** Update/add `deno test` coverage proving the real template
functions are genuinely called (not the fixture) at all three sites, and that the
placeholder disclaimer string is gone everywhere in this file's actual output.

**5. Do not touch `RESEND_SEND_MODE` or anything about the test/production gate.**
This packet is purely about which template content gets used once a send happens; it
has nothing to do with whether a send happens for real.

## Acceptance Criteria
- Zero occurrences of "T048's shared-layout fixture" or "T049 owns the real invite
  template content" anywhere in `send-invite/index.ts`'s actual runtime output
  (grep-provable in the source, and provable via a test asserting the rendered HTML
  does not contain that string).
- All three call sites use real, non-fixture content.
- `deno test` clean for this function, including new/updated coverage for the above.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean (frontend side unaffected but must stay green).

## Relevant Constitution Excerpts
> DES-16: errors and user-facing copy say what happened and what to do — placeholder/
> internal-task-ID text reaching a real user is a direct violation of this spirit even
> though it's not phrased as an error.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
This task exists because of a live, real production email — George received the
placeholder text in an actual inbox during the T052 smoke test. Attempt 1 for T099.

## Required Worker Output
- Full diff of `send-invite/index.ts` (and any test file changes).
- Confirmation, with grep evidence, that the placeholder string is gone everywhere.
- Your `inviterName`/`expiresInDays` availability findings for the send path (Trap #1).
- Your resend-preview-text decision (Trap #2).
- Full deno test + frontend test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
