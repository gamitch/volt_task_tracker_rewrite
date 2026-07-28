# Worker Packet: T027

## Task ID
T027

## Objective
Build `src/pages/roster/InvitesTab.tsx` — the Invites tab (ROS-07): all invites with status
(Pending/Accepted/Expired), sent `Timestamp`, Resend/Revoke actions, using the same underlying
mechanism as `send-invite` (T017, Passed).

## Dependencies (status)
- T021 (`/roster` shell) — Passed. Read `RosterShell.tsx` (read-only) for the placeholder slot.
- T017 (`send-invite` Edge Function) — Passed. Read `supabase/functions/send-invite/index.ts`
  (read-only) for the real invite-creation contract this tab's Resend action should conceptually
  match (you are not calling this function directly — no shared client exists yet — but your fixture/
  callback shapes should be modeled on its real request/response, not invented independently).
- T011 (support + audit triggers) — Passed. **Read
  `supabase/migrations/20260717000001_support_audit.sql` lines 253-276 in full (read-only) before
  writing any Revoke logic.** There is already a real, applied DB trigger
  (`trg_audit_invite_revocation`) that automatically writes an `audit_log` row whenever
  `invites.status` transitions to `'revoked'` — DATA-02's audit-log requirement is **already
  satisfied at the database level**. Your Revoke action's job is only to set `invites.status =
  'revoked'` (via your injectable callback seam); do NOT attempt to insert into `audit_log` yourself
  from this UI task — that would be redundant with (and could conflict with) the trigger, and
  `audit_log` almost certainly has no client-writable RLS policy anyway (same posture as other
  audit tables in this project). State this citation explicitly in your output.

## Allowed Files
- `src/pages/roster/InvitesTab.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `InvitesTab.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/roster/RosterShell.tsx` — already-Passed sibling task's file, read-only reference only.
- `supabase/functions/send-invite/**` — read-only reference only, do not edit or call directly.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadData`/`onRevoke`/`onResend`-style seam with obviously-fake fixture defaults.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `invites`: `email`, `role`, `student_id` (nullable), `status`, `expires_at` —
  `20260717000000_scheduling_attendance.sql` lines 18-27.
- `trg_audit_invite_revocation` (DB trigger, already applied) — fires
  `after update on public.invites ... when (old.status is distinct from new.status and new.status =
  'revoked')`, writes `audit_log(action='invite_revoked', entity='invites', entity_id=invite.id,
  meta={old_status, new_status})` automatically — `20260717000001_support_audit.sql` lines 253-276.

## Known Context / Traps

**1. AUTH-06's 14-day expiry rule — a real, testable status-derivation, not just a stored column.**
"Invites expire after 14 days" — your status `Badge` (Pending/Accepted/Expired) must correctly derive
"Expired" for a `status='pending'` row whose `expires_at` has passed, even if no backend process has
actually flipped the stored `status` column yet (the real expiry mechanism, whatever it is, isn't
this task's job — you're deriving a DISPLAY status from `expires_at` vs. "now," not necessarily
trusting the raw `status` column value alone for the Expired case). Prove the boundary: an invite
sent exactly 14 days ago (or with `expires_at` in the past) shows Expired; one sent 13 days ago
shows Pending. Disclose your exact derivation logic.

**2. Revoke sets `invites.status='revoked'` — the audit-log write is automatic, not your job.** See
Dependencies above. This is the single most important ground-truth fact in this packet — do not
build any `audit_log` insert logic. Your Revoke callback only needs to represent "set this invite's
status to revoked."

**3. Resend invite** — same posture as `ParentsTab.tsx`/T025's Resend action and every other
not-yet-wired action in this batch: a real, working callback seam, obviously-fake default, modeled
on `send-invite`'s real contract (read-only reference).

**4. Should Resend be available for an Accepted or Revoked invite?** ROS-07's text doesn't specify —
use your judgment (most likely: only Pending or Expired invites should offer Resend; Accepted
invites have nothing to resend; Revoked invites probably shouldn't be silently resendable either) and
disclose your reasoning explicitly rather than making all three actions available unconditionally on
every row.

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- All invites listed with status `Badge` (Pending/Accepted/Expired), sent `Timestamp`,
  Resend/Revoke actions.
- AUTH-06's 14-day expiry boundary correctly derived and tested.
- Revoke sets `status='revoked'` only — no client-side `audit_log` write attempted (explicitly
  confirmed in your output that you read and cited the real DB trigger).
- Resend/Revoke availability per-row correctly gated on invite status, with disclosed reasoning.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration
> file → BLOCKER. *(Not directly applicable — cited because this task must NOT attempt to duplicate
> or re-implement the already-applied `trg_audit_invite_revocation` trigger's job.)*

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T027 (attempt count: 0).

## Required Worker Output
- Full contents of `InvitesTab.tsx`.
- Explicit citation of `trg_audit_invite_revocation` and confirmation no client-side `audit_log`
  write was attempted.
- Real test proof of the AUTH-06 14-day expiry boundary derivation.
- Explicit write-up of the per-row Resend/Revoke availability logic and reasoning.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
