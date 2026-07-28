# Checker Packet: T025 (Parents tab) — Check Attempt 1

## Task ID
T025 — Parents tab (ROS-04), Epic E4.

## Checker Agent
checker-accessibility (per task-ledger.md T025 row).

## Objective
Verify a Parents tab with linked-student `AvatarGroup`, invite status, and a real `AlertDialog`
Remove flow — correctly split between what's schema-backed (real `guardian_links`/`invites`
mutations) and what's an honestly-disclosed local-only stand-in (no `profiles` active/inactive
column exists).

## Allowed Files (worker's literal permitted edit)
- `src/pages/roster/ParentsTab.tsx` (new)

**Scope flag**: worker also created `ParentsTab.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`e86d134`) — do NOT
infer authorship from commit messages. Confirm `RosterShell.tsx`, `StudentsTab.tsx`,
`StudentDialog.tsx`, `InviteParentDialog.tsx`, `router.tsx`, `guards.tsx` (import-only, `RequireRole`
only) untouched, and no migration file added. Note: the working tree may show other
concurrently-running tasks' untracked files (`OutreachEventDialog.tsx`, `TeamsTab.tsx`,
`src/pages/settings/**`) — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **THE CENTRAL TRAP — confirmed real schema gap.** Claims a direct read of
   `20260716000000_identity_roster.sql` lines 16-24 confirms `profiles` has no
   `is_active`/`status`/`deactivated_at` column at all. Split implementation by two real cases:
   - **Profile-backed parent**: `unlinkAllStudentsForParent` claimed a REAL `guardian_links`
     mutation (deletes every link row for that parent — an all-or-nothing judgment call, disclosed,
     since a per-link editor is out of scope). The "deactivate profile" half has NO real column to
     write to — claims it used a purely local, client-side `removedProfileIds: Set<string>` state
     to mark the row `Removed` in the UI only, explicitly documented as not backed by any schema
     field, with the real follow-up (a `profiles.is_active`-style migration) named but not attempted.
   - **Invite-only "parent"** (no profile yet): claims Remove degrades to the one real applicable
     effect — `invites.status = 'revoked'` (a real, already-existing check-constraint value).
   - `AlertDialog` copy claimed to differ per case, never overclaiming an effect that doesn't apply,
     never using "delete."
2. **Parent-row sourcing**: claims rows come from two real sources —
   `profiles.role='parent'` AND `role='parent'` `invites` rows with no matching profile — claimed
   de-duplicated by email so an already-registered parent never shows twice even if re-invited.
3. **Self-gating divergence, explicitly disclosed**: claims it split `ParentsTabBody`
   (ungated)/`ParentsTab` (gated default export) mirroring `LiveConsole.tsx`'s precedent, and
   explicitly disclosed this diverges from `StudentsTab.tsx`/`InvitesTab.tsx`/`TeamsTab.tsx` (which
   the worker claims don't self-gate at all — "an apparent unaddressed gap in those tasks").
4. **SEC-01**: coach/admin-only tab; parent emails shown only as the sole identifier for invite-only
   rows (no display name exists in `invites`), never gratuitous alongside an already-known name.
5. **Deliberate `AvatarGroup` `aria-label` non-use**: claims the Props table omits it, so it wasn't
   used — same "closed table wins" reasoning `StudentsTab.tsx` applied to `Table.columns`.
6. Claims 25/25 new tests pass; 548/549 repo-wide at the time of its run (the 1 failure claimed to
   be in `SeasonSettings.test.tsx`, a different concurrent task's untracked file). typecheck/
   lint(scoped)/format(scoped) clean for its own files.

## Required Verification Steps
1. **Read `ParentsTab.tsx` and `ParentsTab.test.tsx` in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **Schema-gap claim — reproduce yourself.** Read the migration directly and confirm `profiles`
   genuinely has no active/inactive-shaped column.
3. **Profile-backed Remove — the central correctness check.** Confirm by source read that
   `unlinkAllStudentsForParent` genuinely deletes real `guardian_links` rows (a real, schema-backed
   effect) and that the "deactivate" half is genuinely local-only UI state, honestly disclosed, not
   silently presented as if it persisted. Render your own explicit verdict on whether the
   all-or-nothing multi-link unlinking behavior is a reasonable judgment call given the stated
   forbidden-file constraints, or should have been handled differently.
4. **Invite-only Remove — confirm the degraded-effect handling is correct**, i.e. it genuinely only
   sets `invites.status='revoked'` and doesn't claim to do anything else.
5. **`AlertDialog` copy — confirm it genuinely differs per case** and never overclaims, never uses
   "delete."
6. **Parent-row de-duplication — reproduce or independently verify** the claimed dedup-by-email
   logic against the decoy fixture (an already-registered parent re-invited should show once).
7. **Self-gating divergence — form your own explicit verdict.** Confirm by reading
   `StudentsTab.tsx`/`InvitesTab.tsx`/`TeamsTab.tsx` (read-only, whichever exist by check time)
   whether they genuinely lack self-gating as claimed, and judge whether `ParentsTab.tsx`'s
   `RequireRole`-nesting approach is the more correct pattern that the others should arguably also
   adopt, or whether there's a reason the others intentionally omitted it.
8. **Astryx prop citations** — spot-check `Table`, `Avatar`, `AvatarGroup`/`AvatarGroupOverflow`,
   `Badge`, `StatusDot`, `MoreMenu`, `AlertDialog` against `astryx-api.md`.
9. **Test-file scope question** — render an explicit verdict, independently re-derived.
10. **Re-run typecheck/lint/build/test yourself** (scoped appropriately given concurrent-worker
    noise) — don't accept "25/25"/"548/549" without your own run.
11. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 10: database changes are additive migrations via the Supabase CLI. *(Cited because this task
  correctly did NOT attempt its own migration to "solve" the missing `profiles` column.)*
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 6: no PII... test fixtures use fabricated names. SEC-01 email-visibility rules.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the profile-backed Remove split (real mutation vs. honest local-only stand-in)
- explicit verdict on the multi-link all-or-nothing unlinking judgment call
- explicit verdict on the self-gating divergence from sibling tabs
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
