# Worker Packet: T090

## Task ID
T090 — ED-1 Packet P3: real `send-invite` resend mode + wire `InvitesTab.onResend`.

## Objective
T087 (Passed) deliberately left `InvitesTab.onResend` fixture-backed because
`send-invite`'s only current path (`auth.admin.inviteUserByEmail`) creates the
`auth.users` row immediately on first call — calling it again for the same email always
fails with a real 409. This packet adds a genuine resend path to the deployed Edge
Function, then wires `onResend` to it.

**Read `supabase/functions/send-invite/index.ts` in full before starting** — it already
has an "EXTENSION POINT" comment (right after the successful `inviteUserByEmail` call)
showing exactly where T048's branded-email/`email_log` machinery was added; your resend
branch needs to reuse that same machinery (`resend.ts`'s `sendBrandedEmail`,
`email_log.ts`'s `writeEmailLog` — both already correct, read-only for you), not
duplicate it.

## Allowed Files
- `supabase/functions/send-invite/index.ts`
- `supabase/functions/send-invite/validation.ts`
- `supabase/functions/send-invite/*.test.ts` (deno tests, colocated per existing
  convention)
- `src/lib/supabase/loaders/invites.ts` (append only — this file is T087's, already
  landed; add a `resendInvite` function alongside the existing `loadInvitesTabData`/
  `revokeInvite`, do not restructure what's already there)
- `src/pages/roster/InvitesTab.tsx`, `InvitesTab.test.tsx` (resend seam lines only —
  everything else in this file is T087's, already correct, do not touch load/revoke
  logic)

## Forbidden Files
- `supabase/functions/send-invite/resend.ts`, `email_log.ts` — already correct
  (T048), read-only imports.
- `src/pages/roster/InviteParentDialog.tsx` — T087's send path is unrelated to resend,
  do not touch.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. How the caller signals "this is a resend, not a new send."** The current request
body shape (`validation.ts`'s `InviteRequestBody`: `{email, role, student_id}`) has no
concept of an existing invite id. Add an optional `invite_id` field to the validated
body shape — when present and a valid UUID, take the resend branch; when absent, take
the existing send branch (byte-for-byte unchanged, do not touch the current successful
path's logic). Extend `validateInviteRequest` accordingly, and extend
`InviteValidationErrorCode` with whatever new codes you need (e.g. `INVALID_INVITE_ID`,
`INVITE_NOT_FOUND`, `INVITE_NOT_PENDING`) with DES-16-style messages matching the
existing file's tone exactly.

**2. Resend branch logic, in order:**
- Same auth/staff gate as today (unchanged — the existing code already runs this before
  validation; your branch point comes after, once you know it's a resend).
- Look up the invite by `invite_id` via the service-role (`adminClient`) client. Not
  found → 404-class error. Found but `status !== 'pending'` → a real, distinct error
  (an accepted/expired/revoked invite cannot be "resent" — expired should probably
  guide the caller to send a *new* invite instead; write DES-16 copy that says so, don't
  just say "invalid").
- Extend `expires_at` by another `INVITE_EXPIRY_DAYS` (14, `computeExpiresAt()` already
  exists) from *now*, update the row.
- Since `auth.admin.inviteUserByEmail` cannot be called again, use
  `adminClient.auth.admin.generateLink({ type: 'invite', email: invite.email, options:
  { data: { role: invite.role, student_id: invite.student_id, invite_id: invite.id } }
  })` to get a fresh action link (verify the exact real signature/return shape of
  `generateLink` yourself against the installed `@supabase/supabase-js` types — do not
  guess the options shape).
- Send the branded email via the existing `sendBrandedEmail`/`email_log` machinery
  (read exactly how the current EXTENSION POINT code calls them and reuse the same
  call, substituting the new link/invite data) — reuse, don't reimplement.
- Return the updated invite row, same shape as the existing success response (module
  doc already shows this shape — match it, `ResendInviteFn = (invite: InviteRow) =>
  Promise<InviteRow>` on the frontend side expects this).

**3. Do not touch the existing send path's behavior at all.** Every existing test for
the plain-send flow must still pass unchanged — this is a strictly additive branch.

**4. `email_log` status values.** Check what status enum/values `email_log.ts`'s
`writeEmailLog` currently accepts for the send path and confirm a resend should log the
same way (probably yes — it's still an "invite" template email) or needs a distinguishing
value — your call, document it, don't silently reuse a value that would make send vs.
resend indistinguishable in the log if that distinction matters for anything downstream
(check if anything reads `email_log` and cares — if nothing does yet, matching the
existing value is fine and simpler).

**5. Frontend wiring.** `resendInvite` in `loaders/invites.ts`: call
`invokeEdgeFunction<{invite: {...}}>('send-invite', { invite_id: invite.id })` (T086's
helper, same as T087's send call), unwrap the response, map back into `InvitesTab`'s
local `InviteRow` type exactly the way `loadInvitesTabData` already does (reuse
`mapInviteDbRowToInviteRow` if the response shape matches, don't write a second mapper
if you can avoid it). Wire `InvitesTab.tsx`'s `onResend` default to it, removing the
comment T087 added explaining why it *couldn't* be wired yet (update it to describe
what it now does, or remove it if no longer needed).

**6. Deno tests.** `send-invite` has existing `deno test`-based coverage
(`resend.test.ts`, likely others) — find and follow that exact pattern for your new
validation/resend-branch tests (`deno test`, not `vitest` — this is server-side Deno
code). Cover: valid resend of a pending invite succeeds; resend of a non-pending invite
is rejected with the right error; resend of a nonexistent `invite_id` is rejected;
non-staff caller is still rejected (same gate, but verify your new branch doesn't
accidentally bypass it — the branch point must be AFTER the auth/staff check, not
before).

## Acceptance Criteria
- `send-invite` genuinely supports resend via an `invite_id` field, fully additive to
  the existing send path (zero behavior change to plain sends).
- `InvitesTab.onResend` is genuinely wired to the real resend path.
- Resend correctly rejects for non-pending invites with clear DES-16 copy.
- New deno tests cover the resend branch's success/failure paths.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean (frontend); deno test output clean (backend) — run both, they
  are separate toolchains, don't assume one covers the other.

## Relevant Constitution Excerpts
> No secrets or service-role keys anywhere in the frontend — BLOCKER. The service-role
> client stays entirely inside `index.ts`, same as today.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T090 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed file.
- The exact new request/response shapes for the resend branch.
- Your `email_log` status-value decision (Trap #4) and reasoning.
- Full frontend (vitest) AND backend (deno test) output, both shown separately.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
