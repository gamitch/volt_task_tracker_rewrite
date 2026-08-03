# T404 + T405 — worker packet: two `attendance` triggers, one migration wave

**Workflow W1, branch `claude/w1-checkin`. HEAVY tier — mandatory, not chosen.** Constitution item 26
names *"a migration or metric-view SQL"* as an explicit HEAVY trigger. Chain: this packet →
`checker-premise` (on Fable, **building against a real PostgreSQL**) → `worker-implementer` →
`checker-reviewer`.

**Ownership:** W1 owns the `attendance` table and its triggers as of the owner ruling 2026-08-03
(`auto-mode-decisions.md`, *"W1 OWNS ATTENDANCE SCHEMA"*). That grant obliges **more** process, not
less: a bad trigger here reaches every workflow that writes this table.

## 1. Why one packet for two rows

Both are triggers on `public.attendance`, both are migrations, and **they may interact** — a
`moddatetime`-style BEFORE trigger and the existing AFTER audit trigger both firing on one UPDATE is
itself a thing to prove, not assume. One premise gate on one scratch database can build and test both
together. Two chains would cost roughly double and prove less about the interaction.

## 2. Allowed files

- **NEW** `supabase/migrations/<timestamp>_attendance_triggers.sql` (name it per repo convention —
  check the existing files, do not invent a scheme)
- `src/lib/supabase/loaders/attendance.ts` + `attendance.test.ts` (W1's, only if the schema change
  makes the client-side T405 half redundant — see Trap 4)

**Forbidden:** `supabase/migrations/*metric_views.sql`, `*kpi_views.sql`, `*dashboard_views.sql`
(**W4's** — and `v_student_hours` / `v_student_participation` **READ `attendance`**, so you must
verify against them and must not edit them). `supabase/functions/**`. `src/pages/outreach/**` (W2
ACTIVE), `src/pages/calendar/**` (W6), `src/pages/home/**`, `endMeeting.ts` /
`EndMeetingDialog.tsx` (W3).

**Do not modify the existing migration files.** Add a new one. `20260717000001_support_audit.sql` has
been applied to the hosted database already (`docs/migration/RUNBOOK.md`); editing it in place would
desynchronise deployed state from the repo.

## 3. T404 — a post-completion attendance INSERT is never audited

`trg_audit_attendance_post_completion` (`20260717000001_support_audit.sql:153-156`) is declared
**`after update` only**. Verified on a real PostgreSQL 16 scratch database during T403 step 3's
premise gate: a post-completion UPDATE wrote exactly one correct `audit_log` row; a post-completion
**INSERT wrote zero**.

So correcting an existing row after the meeting ends is audited, while **marking a student who had no
row at all is not** — and `LiveConsole` has no session-status guard, so that path is reachable.

## 4. T405 — `attendance.updated_at` never moves on conflict-update

`updated_at` is `timestamptz not null default now()`, but **no `moddatetime`/`set_updated_at` trigger
exists on this table anywhere in the migrations** (grep-provable, zero occurrences). Verified on the
same scratch database: a conflict-update left the seeded value unchanged.

**W1 has already fixed its own write path client-side** (`abda77c`): `makeSetAttendanceStatus` sends
`updated_at` from an injectable clock. That is a partial fix — `makeUpsertAttendance` is untouched
(W2's `AttendancePanel` depends on it), so W2's write path is still stale. The trigger is the
complete fix.

## 5. Traps — claims to CONFIRM OR REFUTE BY BUILDING. Do not accept any on this packet's authority.

### 🚨 Trap 1 — widening the audit trigger to INSERT may ABORT REAL CHECK-INS. Highest priority.

Two facts that are individually documented and, taken together, are alarming:

**(a) The audit function dereferences `OLD`:**

```sql
jsonb_build_object('old_status', old.status, 'new_status', new.status)
```

`OLD` is **null for INSERT operations** in a row-level trigger. Dereferencing it on the INSERT path
may raise rather than yield null.

**(b) `audit_log.actor` is NOT NULL, and the actor expression can resolve to NULL.** The function
computes `coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid)`. T403 step
3's premise gate already proved (its experiment F) that when this resolves NULL, **the NOT NULL
violation kills the triggering statement outright** — it does not merely skip the audit row.

**Now the part that makes this a BLOCKER-class risk.** `supabase/functions/checkin/` writes
`attendance` with the **service role**, where `auth.uid()` is NULL. Its
`applyUpsertIgnoreDuplicates` performs an **INSERT**. So widening the trigger to
`after insert or update` could mean: **a student who scans the QR code for a session that has been
marked completed has their check-in aborted entirely, with a NOT NULL error instead of a check-in.**

That would be a far worse outcome than the missing audit row T404 describes. **A fix that silently
breaks QR check-ins is not a fix.**

**Gate must:** stand up a real PostgreSQL, load the real migrations, and determine — by executing,
not reading — (i) whether `old.status` on the INSERT path raises or yields null; (ii) whether an
INSERT with no `auth.uid()` and no `app.actor_id` aborts; (iii) whether the Edge Function's actual
insert shape is affected. Then prescribe a fix that audits post-completion INSERTs **without ever
aborting a legitimate check-in** — likely `TG_OP` branching plus an actor fallback or a guard — and
prove the QR path still works.

### Trap 2 — `moddatetime` may fight W1's own client-supplied `updated_at`

`makeSetAttendanceStatus` now sends `updated_at` explicitly. A BEFORE-trigger would **overwrite** it
with the database's `now()`.

That is probably the better outcome (server clock beats client clock, and it is why the trigger is
the complete fix) — but it must be stated, not assumed, and it decides whether the client-side half
should now be **removed** as redundant or **kept** as defence in depth.

**Gate must:** determine the actual precedence, and recommend keep-or-remove with a reason. Note the
client value is not merely cosmetic today: it is what makes `updated_at` move at all.

### Trap 3 — trigger interaction and ordering

A new BEFORE trigger and the existing AFTER audit trigger will both fire on one UPDATE. PostgreSQL
fires triggers of the same timing **in name order**, which makes the chosen name load-bearing rather
than cosmetic.

**Gate must:** confirm the audit trigger still records correct `old_status`/`new_status` with the new
trigger present, and state whether the name affects behaviour.

### Trap 4 — does this break W4's views, or the metrics?

`v_student_hours` and `v_student_participation`
(`20260717000003_metric_views.sql`, **W4's, read-only here**) read `attendance`.

**Gate must:** confirm neither trigger changes any column those views aggregate. `updated_at` and
`audit_log` should be invisible to them — verify rather than assert, because a metric regression is
the one class of bug this project treats as unrecoverable.

### Trap 5 — INSERT-path audit semantics

If a post-completion INSERT is audited, what should `old_status` be? There is no old status. Null is
the honest answer; a fabricated `'absent'` would be a lie in an audit log.

**Gate must:** prescribe the exact `meta` shape and say whether `action` should stay
`attendance_edited_post_completion` or gain an INSERT-specific value. **An audit log that
misdescribes what happened is worse than one with a gap** — the gap is at least honest.

### Trap 6 — the deployed database is already live

`docs/migration/RUNBOOK.md` records a real migration run: 20 students, 16 events, 117 sessions, 79
attendance rows, 341.75 hours. This migration will run against **real data**.

**Gate must:** confirm the migration is idempotent / safely re-runnable, and that it needs no
backfill. If historical post-completion INSERTs exist that were never audited, say so — and
recommend **against** back-filling audit rows, since an audit entry claiming an actor and time it
cannot know is fabrication.

## 6. Acceptance criteria

1. A post-completion attendance **INSERT** writes exactly one correct `audit_log` row.
2. A post-completion **UPDATE** still writes exactly one correct row — unchanged behaviour.
3. An attendance write while the session is `scheduled` writes **zero** audit rows, as today.
4. **A service-role INSERT with no `auth.uid()` does NOT abort.** Trap 1. Prove with the QR path's
   actual write shape.
5. `attendance.updated_at` moves on conflict-update, via the database, for **every** writer —
   including `makeUpsertAttendance`, which W2 uses.
6. `v_student_hours` and `v_student_participation` return identical results before and after.
7. Migration is idempotent and safe against the live dataset's shape.
8. Named mutations, each run, each with its real exit code. At minimum: revert the trigger to
   `after update`; break the `TG_OP` branch; drop the `moddatetime` trigger. **A mutation that passes
   at exit 0 is a finding about the test, not a pass — this project has hit that six times.**

## 7. Gates

`.env.local` absent. `tsc` · `vite build` · prettier · eslint · vitest. Baseline at this packet's
head: **78 files / 1912 tests, exit 0**. Assert exit codes, never pass counts.

**SQL is not covered by vitest.** State plainly how each SQL-level criterion was proven — a real
database, the statements run, the observed rows. Do not let "the suite is green" stand in for "the
trigger works."
