# Checker Packet: T027 (Invites tab) — Check Attempt 1

## Task ID
T027 — Invites tab (ROS-07), Epic E4.

## Checker Agent
checker-accessibility (per task-ledger.md T027 row).

## Objective
Verify an Invites tab with a correctly-derived AUTH-06 14-day expiry display status, Resend/Revoke
actions correctly gated per-row, and — critically — Revoke that does NOT attempt to duplicate the
already-applied `trg_audit_invite_revocation` DB trigger's job.

## Allowed Files (worker's literal permitted edit)
- `src/pages/roster/InvitesTab.tsx` (new)

**Scope flag**: worker also created `InvitesTab.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`a155680`, shared
with T024 — confirm the D001 boundary per-file) — do NOT infer authorship from commit messages.
**Critical check**: confirm zero `audit_log` code-level references exist in `InvitesTab.tsx` (only
comment mentions are acceptable). Confirm `RosterShell.tsx`, `send-invite/**`, `router.tsx`,
`guards.tsx` (import-only), `supabase/migrations/**` untouched.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`trg_audit_invite_revocation` citation and non-duplication — the central safety property of
   this task.** Claims the real, applied trigger (cited `supabase/migrations/20260717000001_support_audit.sql`
   lines 253-277) is cited in the module doc, and claims a grep confirms every `audit_log` mention in
   the file is inside a comment — zero code-level references, zero imports, zero `.from('audit_log')`
   calls, zero insert calls. `defaultOnRevokeInvite`/the real `RevokeInviteFn` seam claimed to do
   exactly one thing: set `invites.status='revoked'`.
2. **AUTH-06 14-day boundary**: `deriveInviteDisplayStatus(status, expiresAt, now)` claimed tested
   both as a pure function (exactly-14-days → expired; 13 days → pending; accepted/revoked/expired
   stored status trusted regardless of `expires_at`) AND via a real render-level test (a
   `status:'pending'` row with a long-past `expiresAt` renders "Expired" through the real component
   tree).
3. **Resend/Revoke per-row availability**: `canResendInvite`/`canRevokeInvite` both `true` only for
   `pending`/`expired`, `false` for `accepted`/`revoked` — claims specific reasoning for each
   (accepted has nothing to resend/revoke meaningfully; revoked is terminal, resending would
   silently un-cancel a deliberate decision, and re-revoking wouldn't even satisfy the trigger's
   `old.status IS DISTINCT FROM new.status` condition). Claims kept as two separately-named functions
   (currently evaluating identically) for future divergence.
4. **A fourth display status, "Revoked," added beyond ROS-07's literal "Pending/Accepted/Expired"
   wording** — claims disclosed as a deliberate additive judgment call (hiding/mislabeling a revoked
   row would be dishonest and make the Revoke action look like it does nothing).
5. **Non-`MoreMenu` placeholder for accepted/revoked rows**: claims an em-dash `'—'` placeholder
   shown instead (no `MoreMenu` trigger at all for those rows), consistent with `StudentsTab.tsx`'s
   existing null-placeholder precedent, not a box-drawing character.
6. Claims 18 new tests (426/426 repo-wide); typecheck/lint(scoped)/format(scoped) clean, with a
   specific verification claim: temporarily moved its two new files out of the tree and reran
   `npm run typecheck`, and the same pre-existing `TeamsTab.tsx`/`SeasonSettings.tsx` errors
   persisted, confirming those are genuinely unrelated to this task.

## Required Verification Steps
1. **Read `InvitesTab.tsx` and `InvitesTab.test.tsx` in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **`trg_audit_invite_revocation` citation — re-verify directly, this is the central safety
   property.** Open `supabase/migrations/20260717000001_support_audit.sql` yourself and confirm the
   trigger genuinely exists and fires as claimed. Reproduce the `audit_log` grep yourself and confirm
   zero code-level references — this is the single most important check in this packet, since if the
   worker were wrong about the trigger's existence/behavior, a real audit-log gap could ship
   undetected.
3. **AUTH-06 boundary — re-derive independently.** Confirm the exactly-14-days case correctly
   resolves to "expired" (boundary-inclusive, not off-by-one) by reading `deriveInviteDisplayStatus`
   directly and reproducing or independently writing the boundary test.
4. **Resend/Revoke gating — confirm by source read.** Verify the reasoning for excluding
   accepted/revoked rows is sound, and confirm both functions genuinely gate on the claimed statuses.
5. **"Revoked" as a fourth status — form your own explicit verdict** on whether this additive
   judgment call is correct (more honest/transparent) or oversteps ROS-07's literal three-status
   spec.
6. **Astryx prop citations** — spot-check `Table`, `Badge`, `Timestamp` (confirm `format="date_time"`
   is the right choice for AUTH-06 precision, not a relative/auto format), `MoreMenu`, `AlertDialog`
   against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself.** Reproduce the worker's own "moved files out,
   errors persisted" isolation technique (or an equivalent) to independently confirm the disclosed
   repo-wide failures are genuinely unrelated to this task.
9. **No box-drawing/bracket characters** — confirm the `'—'` em-dash placeholder is legitimate
   typography, not disguised box-drawing.

## Relevant Constitution Excerpts
- Item 10: database changes are additive migrations via the Supabase CLI. *(Cited because this task
  must NOT attempt to duplicate or re-implement the already-applied trigger's job.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the audit-log non-duplication safety property
- explicit verdict on the "Revoked" fourth-status addition
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
