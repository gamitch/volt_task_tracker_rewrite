# Worker Packet: T087

## Task ID
T087 — ED-1 Packet P1: real invites load, send, revoke. Second packet of the ED-1 epic.
**This packet unblocks the T052 production-email smoke test** — once it lands, sending a
real invite through the live UI will actually hit the deployed `send-invite` Edge
Function instead of a fixture stub.

## Objective
`InvitesTab.tsx` and `InviteParentDialog.tsx` currently default to fixture-backed fake
data/no-op stubs. Wire them to the real Supabase data layer built in T086 (P0, already
Passed — `runMutation`, `invokeEdgeFunction`, `InviteRow`/`Role`/`InviteStatus` types are
all available now from `src/lib/supabase`).

**In scope:** real `InvitesTab` load, real revoke, real `InviteParentDialog` send.
**Explicitly out of scope, do not attempt:** `InvitesTab`'s **resend** action. Read Trap
#2 before touching anything resend-related — wiring it now would be actively wrong, not
just premature.

## Allowed Files
- `src/lib/supabase/loaders/invites.ts` (new — first file in a new `loaders/` directory;
  this establishes the directory other ED-1 packets will also add files to, but you own
  only this one file in it)
- `src/pages/roster/InvitesTab.tsx`, `InvitesTab.test.tsx`
- `src/pages/roster/InviteParentDialog.tsx`, `InviteParentDialog.test.tsx`

## Forbidden Files
- Every other file, including `StudentsTab.tsx` (a later packet's job — `InviteParentDialog`'s
  `student`/`additionalStudentOptions` props are caller-supplied and out of scope here;
  do not modify how `InviteParentDialog` is invoked, only its own `onSendInvite` seam).
- `src/lib/supabase/types.ts`, `loader.ts`, `functions.ts`, `client.ts`, `auth.ts`,
  `index.ts` — already correct (T086), read-only imports.
- `supabase/functions/**` — the `send-invite` function itself is correct and deployed;
  you call it, you don't modify it (that's a later packet, P3, for resend specifically).
- `docs/swarm/**`, `.claude/**`, `router.tsx`, `guards.tsx`.

## Known Context / Traps

**1. `InvitesTab.tsx` declares its own local `InviteRow`/`Role`/`InviteStatus` types**
(a verbatim camelCase-rename subset, written before `src/lib/supabase/types.ts` had an
equivalent). These are now duplicates of T086's shared `InviteRow`/`Role`/`InviteStatus`
exports. Decide how to resolve this: either (a) `InvitesTab.tsx` imports the shared types
from `src/lib/supabase` and drops its local duplicates (cleaner, removes drift risk), or
(b) keep the local types and have your loader map DB rows into them explicitly. Either
is acceptable — state your choice and reasoning in your output. If you choose (a), check
`InvitesTab.tsx`'s exported `InviteDisplayRow`/`InviteDisplayStatus` types still work
correctly against the shared `InviteStatus` (four values: `pending | accepted | expired
| revoked` — should match exactly, verify don't assume).

**2. Resend is explicitly NOT wireable yet — do not attempt it, even partially.**
`send-invite`'s first call creates the `auth.users` row immediately via
`inviteUserByEmail`; calling it again for the same email always returns 409
`ALREADY_INVITED` (verified directly in `send-invite/index.ts`). There is currently no
real resend path — that's P3's job (a separate Edge Function extension, not yet built).
Leave `InvitesTab`'s `onResend` seam exactly as it is today (fixture-backed default),
and add a clear one-line comment at the seam explaining why it's still fixture-backed
(cite this packet and P3) so nobody mistakes it for an oversight. Do not disable the
Resend button or change its visible behavior — that's a UI decision outside this
packet's scope; just don't wire its data seam.

**3. `InvitesTab` load — the `invites` table's RLS.** The `staff_all` policy is the only
read policy on `invites` (confirmed in `20260717000002_rls.sql`). Since `InvitesTab`
only renders for admin/coach (gated upstream by `RosterShell`'s `RequireRole`), every
authenticated session reaching this component is genuinely staff, so a real query
should return real rows or a genuine empty result — an empty array is "no invites
exist yet," not an RLS-caused false-empty. Build the loader as
`createLoader((client) => client.from('invites').select('*').order('created_at', {
ascending: false }))`, matching `InvitesTabLoadResult { invites: readonly InviteRow[] }`'s
shape (map `data ?? []` since `createLoader` resolves `null` on no-rows, but this
component's own type expects an array — decide and document how you bridge `null` →
`{ invites: [] }`).

**4. Revoke — a real mutation, not a load.** `RevokeInviteFn = (invite: InviteRow) =>
Promise<void>`. Build via `runMutation((client, invite) => client.from('invites')
.update({ status: 'revoked' }).eq('id', invite.id))`. The audit-log row
(`trg_audit_invite_revocation`) fires automatically via a DB trigger — you write nothing
to `audit_log` from the client; if you find yourself writing to `audit_log`, stop, that
is wrong (no client-write policy exists on that table, and it would also be genuinely
redundant with the trigger).

**5. `InviteParentDialog.onSendInvite` — real send, sequential, abort-on-first-failure.**
The dialog already builds one `SendInviteRequestPayload` per selected student
(`buildInviteParentSubmission`, already correct, do not touch). Your job: implement
`onSendInvite` to call `invokeEdgeFunction<{ invite: {...} }>('send-invite', payload)`
once per entry in `submission.inviteRequests`, **sequentially** (not `Promise.all` — the
design intentionally wants ordered, abort-on-first-failure semantics), and rethrow the
first failure so the dialog's existing error state (already built, do not touch) shows
it. If invite 1 of 3 succeeds and invite 2 fails, invite 1's row now genuinely exists as
`pending` in the database — this is disclosed, not silently compensated (there is no
staff-delete-invite UI to roll it back with). Add a one-line comment noting this partial-
success behavior is a known, accepted characteristic, not a bug to fix here.
`submission.relationship` is collected but has no `send-invite` request field to carry
it — this is a pre-existing, already-disclosed gap (the invite-acceptance trigger
hardcodes `relationship='guardian'`); do not invent a way to smuggle it in, don't touch
it, it is correctly out of scope.

**6. Error surface.** `invokeEdgeFunction` (T086) already produces a `SupabaseLoaderError`-
shaped rejection for every failure mode, including the exact `ALREADY_INVITED` DES-16
message. `InviteParentDialog`'s existing `submitError` state / `InvitesTab`'s existing
error-Banner pattern should consume `.message` directly — you should not need to write
new error-copy anywhere in this packet; if you find yourself hand-authoring a new error
string, stop and check whether an existing DES-16 message already covers it.

**7. Test files.** Update both test files: swap any test that asserted against the old
fixture defaults to explicitly inject the fixture function through the seam instead
(same pattern used project-wide — the default changes, the fixture literal doesn't).
Add real tests proving: the load genuinely queries `invites` and maps rows correctly;
revoke genuinely calls the mutation with the right id/status; send genuinely calls
`invokeEdgeFunction` once per student with the right payload shape, sequentially, and a
failure on request 2 of 3 stops before request 3 and surfaces the error.

## Acceptance Criteria
- `InvitesTab.tsx`'s default `loadData` is a real Supabase query against `invites`;
  default `onRevoke` is a real mutation. `onResend` remains fixture-backed with an
  explanatory comment (Trap #2) — this is correct, not incomplete.
- `InviteParentDialog.tsx`'s default `onSendInvite` genuinely calls the real
  `send-invite` Edge Function, sequentially, once per selected student, aborting on
  first failure.
- Zero new hand-authored error copy — all errors surface via the existing
  `SupabaseLoaderError.message` from T086's helpers.
- No client write to `audit_log` anywhere in this packet.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

> No secrets or service-role keys anywhere in the frontend — BLOCKER (not directly
> relevant to this packet's own writes, but `invokeEdgeFunction`'s contract depends on
> it; do not work around it by trying to pass any kind of elevated token yourself).

## Most Recent Failure
None. This is attempt 1 for T087 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your Trap #1 decision (shared types vs. local duplicates) and reasoning.
- Confirmation that resend was left untouched, with the exact comment text you added.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
