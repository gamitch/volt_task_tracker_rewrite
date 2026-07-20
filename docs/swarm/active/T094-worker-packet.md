# Worker Packet: T094

## Task ID
T094 — ED-1 Packet P5 (expanded scope): real Teams tab + Parents tab data wiring,
including mutation seams that don't exist yet.

## Objective
Investigation before dispatch found the same class of gap T089 found for Students: both
`TeamsTab.tsx` and `ParentsTab.tsx` have real-looking interactive UI (Archive/Hard
Delete/Move for teams; Resend Invite/Remove for parents), but **every one of those
actions currently mutates only local React state — there is no injectable mutation prop
for any of them, and nothing has ever been persisted.** This packet adds real Supabase
wiring for loads AND adds the missing mutation seams together, matching the precedent
T089 already established for `StudentsTab.tsx`.

**A real, disclosed schema gap you must NOT invent a workaround for:** `profiles` has no
active/inactive column anywhere in the schema (confirmed directly — grep every
migration yourself to re-verify). PRD ROS-04 describes Remove as "unlink + deactivate
profile," but "deactivate profile" has no real column to persist to. T025's own
already-Passed work already disclosed and accepted this exact gap for the invite-only
case (Remove degrades to exactly one real effect: `invites.status='revoked'`). Your job
is NOT to add a migration for this — that's a future, separate schema decision (same
class as ROS-08's leaderboard-privacy column, which WAS eventually given its own
migration in a later packet, T091's P11 — this one has not been and is not this
packet's call to make). For a parent who already has a real account, real Remove is
scoped to: real `guardian_links` row deletion (unlink), full stop — no attempt at
"deactivating" the profile. State this limitation explicitly in your output; do not
silently under-deliver without saying so.

## Allowed Files
- `src/lib/supabase/loaders/teams.ts` (new)
- `src/lib/supabase/loaders/parents.ts` (new)
- `src/pages/roster/TeamsTab.tsx`, `TeamsTab.test.tsx`
- `src/pages/roster/ParentsTab.tsx`, `ParentsTab.test.tsx`

## Forbidden Files
- `src/lib/supabase/types.ts`, `loader.ts`, `functions.ts`, `client.ts`, `auth.ts`,
  `index.ts` — read-only, already correct (T086).
- `src/lib/supabase/loaders/invites.ts` — already correct (T087/T090), read-only
  import (you may import its exported `resendInvite`/`revokeInvite` functions directly
  rather than reimplementing invite-status mutations — see Trap #3).
- `StudentsTab.tsx`, `StudentDialog.tsx`, `InviteParentDialog.tsx`, `RosterShell.tsx` —
  already correct, do not touch.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Teams — real load.** `LoadTeamsTabDataFn = () => Promise<TeamsTabLoadResult>`
where `TeamsTabLoadResult = { teams: readonly TeamRow[]; studentTeamLinks: readonly
StudentTeamLinkRow[] }` (both types are `TeamsTab.tsx`'s own local declarations — read
the file to get `StudentTeamLinkRow`'s exact shape, it's not in the shared `types.ts`).
The `hasStudentsOrHistory` hard-delete gate flag (per `TeamDisplayRow`, and T026's own
original module doc reasoning if you want the full history) needs to be computed from
whether any real `students` row references the team — investigate whether "history"
means anything beyond "has any current or former student row" (e.g. attendance/
audit_log references) or whether a simple `students.team_id = this team` check is
the correct, already-accepted scope; document your finding either way.

**2. Teams — new mutation seams, added to `TeamsTabProps` (currently has only
`loadData`/`generateId`).** Add real seams for: create team (real `teams` insert —
`generateId`'s current client-side UUID generation should likely be replaced by letting
the real insert return the DB-generated id, mirroring `SeasonSettings`'s own
`OnCreateSeasonFn` void→row-returning change from T091 — same reasoning applies here),
archive/reactivate (a boolean flip on `teams.archived`, same optimistic-flip-plus-
rollback shape used everywhere else in this codebase now), hard delete (a real `delete`
— gated by `hasStudentsOrHistory`, already enforced client-side; the real mutation
itself needs no additional guard since the UI already prevents reaching it, but don't
skip error handling for the case where a race lets it through), and reorder/move
up-down (`teams.sort_order` — decide whether to persist immediately per move or treat
it as a lower-priority nice-to-have if genuinely out of reach; state your decision).

**3. Parents — real load.** `LoadParentsTabDataFn` returns `{ parentProfiles,
guardianLinks, students, invites }`. `ParentProfileRow`/`GuardianLinkRow` are
`ParentsTab.tsx`'s own local types — cross-check them against the real `profiles`/
`guardian_links` schema yourself (T086's shared `GuardianLinkRow` in `types.ts` also
exists; same Trap #1-style decision T087/T091 already made elsewhere — local vs. shared
type — is yours to make here too, document it). `parentProfiles` should be `profiles`
filtered `role = 'parent'`.

**4. Parents — Resend Invite.** Reuse T090's already-correct, already-Passed
`resendInvite` from `src/lib/supabase/loaders/invites.ts` directly (import it — do not
reimplement the resend Edge Function call). `handleResendInvite`'s current body is
worth reading closely before you decide exactly how to wire this, since a parent row's
"invite" isn't necessarily 1:1 with `InvitesTab`'s own row shape — check what data you
actually have available (an `InviteRow` from the loaded `invites` array, matched to
this parent's email/id) before assuming the seam signature.

**5. Parents — Remove.** See the Objective's schema-gap disclosure above: real
`guardian_links` deletion is the correct, complete scope for an active-account parent;
for an invite-only parent (no real account yet), reuse T090's `revokeInvite`
(`src/lib/supabase/loaders/invites.ts`) the same way T025's own already-accepted logic
already does locally — read `handleConfirmRemove`'s current branching to understand
which case is which before wiring real calls into each branch.

**6. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet — update existing tests that relied on bare
fixture defaults, add real tests for every new mutation seam (success + rollback-on-
failure where an optimistic pattern is used).

## Acceptance Criteria
- `TeamsTab.tsx`: real load; real create/archive/reactivate/hard-delete mutations, each
  with proper error surfacing via the existing `SupabaseLoaderError.message` pattern;
  reorder either wired for real or explicitly deferred with stated reasoning.
- `ParentsTab.tsx`: real load; Resend Invite genuinely calls T090's real resend path;
  Remove genuinely deletes the real `guardian_links` row for an active parent (with the
  "deactivate profile" limitation explicitly disclosed, not silently dropped) and
  genuinely revokes the pending invite for an invite-only parent.
- No new hand-authored error copy — errors surface via existing
  `SupabaseLoaderError.message`.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

> Additive-only migrations — you are not authorized to write one in this packet; the
> profiles-deactivation gap stays disclosed, not worked around.

## Most Recent Failure
None. This is attempt 1 for T094 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your Trap #1 (`hasStudentsOrHistory`), Trap #2 (reorder persistence), and Trap #3
  (local vs. shared type) decisions and reasoning.
- Explicit confirmation of the Remove flow's real scope for both the active-parent and
  invite-only-parent cases.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
