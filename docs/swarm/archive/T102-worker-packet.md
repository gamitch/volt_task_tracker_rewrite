# Worker Packet: T102

## Task ID
T102 — ED-1 Packet P13: real `AcceptInvitePage.tsx` invite-lookup + real (or honestly
confirmed-impossible) `NoAccessPage.tsx` contact data.

## Objective
Wire `AcceptInvitePage.tsx`'s invite lookup to real Supabase data — with a critical,
non-obvious constraint (Trap #1). Investigate whether `NoAccessPage.tsx`'s "contact"
data has any real, meaningful implementation available, or whether it's a genuine,
disclosed schema gap with nothing to wire (Trap #2) — do not force a fake answer either
way.

## Allowed Files
- `src/lib/supabase/loaders/accept.ts` (new)
- `src/pages/accept-invite/AcceptInvitePage.tsx`, `AcceptInvitePage.test.tsx`
- `src/pages/no-access/NoAccessPage.tsx`, `NoAccessPage.test.tsx`

## Forbidden Files
- `src/lib/supabase/types.ts`, `loader.ts`, `functions.ts`, `client.ts`, `auth.ts`,
  `index.ts` — read-only, already correct (T086). Note: `auth.ts`'s real
  `updateUserPassword` is already correctly wired as `AcceptInvitePage`'s
  `updateUserPassword` prop default — do not touch that seam, it's not part of this
  packet's scope; you're wiring `loadInvite` only.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. CRITICAL — `AcceptInvitePage.loadInvite` must NOT query the `invites` table
directly.** The `invites` table's only read policy is `staff_all` — an invitee
accepting their own invite is, by definition, not staff. A direct `select` against
`invites` here will "work" for you during dev if you happen to be testing as an admin,
and then silently return zero rows for every real, non-staff invitee — a genuine,
dangerous false-positive that would only surface once a real user tries to accept a
real invite. **The correct real source is the authenticated session's own metadata.**
`send-invite`'s `inviteUserByEmail(email, { data: { role, student_id, invite_id } })`
call sets `role`/`student_id`/`invite_id` into `auth.users.raw_user_meta_data`, which
the client SDK exposes as `user.user_metadata` on the current session — read it from
there via the shared Supabase client (`getSupabaseClient().auth.getUser()` or
equivalent — check what's already available via `src/lib/supabase/auth.ts`'s exports
before writing a new session-read path). Combine this with the invitee's own `profiles`
row status if useful (e.g. to detect `'accepted'` — a `profiles` row already existing
for this user id is itself evidence of prior acceptance, since the acceptance trigger
is what creates it). Map into `AcceptInviteData`'s exact shape (`name`, `email`, `role`,
`status` — read the file for the precise fields).

**2. `status` derivation — no `invites.status` to read directly, so infer it
honestly.** Without table access, you can't read `pending`/`expired`/`revoked`
directly. Investigate what's actually derivable from the session alone: a token
exchange that succeeds at all generally means the invite was valid enough to create a
session (Supabase's own auth layer already rejects a used/expired/invalid invite link
before your code ever runs, surfacing as an auth error state, not a normal page render
— read `getInviteStatusError`'s existing four-case switch and decide which cases are
even reachable via a real session vs. which are handled earlier by Supabase's own auth
error path). Document your reasoning for whichever subset of statuses your real
implementation can and cannot honestly distinguish — this is a genuine investigation,
not a trivial swap.

**3. `NoAccessPage`'s "contact" data — investigate before concluding it's impossible.**
The file's own comment says no schema mechanism exists for a "team contact person."
That's true for a *dedicated* contact-person concept, but investigate whether a
reasonable, real, honest substitute exists — e.g., querying `profiles` for any row with
`role = 'admin'` and using its `display_name` (a team genuinely has admins, and
"contact your coach or team admin" is already this page's own fallback framing — a real
admin's actual name is a meaningfully better version of that same idea, not a
different concept). If you judge this is a legitimate real answer, wire it. If you judge
it's still not a good enough fit (e.g., multiple admins exist with no way to know which
one is "the" contact), leave `defaultLoadNoAccessData` as the honest, disclosed fallback
it already is — do not invent a fake single-contact concept the schema has no real way
to represent. Either outcome is acceptable; document which you chose and why.

**4. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet.

## Acceptance Criteria
- `AcceptInvitePage.loadInvite` is real, sources data from the session/`user_metadata`
  and `profiles`, never queries `invites` directly.
- Your `status`-derivation investigation (Trap #2) is documented, with the real
  implementation honestly limited to whatever's genuinely derivable.
- `NoAccessPage`'s Trap #3 investigation and decision are documented either way.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T102 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your Trap #1/#2 investigation and final `loadInvite` design, in full.
- Your Trap #3 (`NoAccessPage`) decision and reasoning.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
