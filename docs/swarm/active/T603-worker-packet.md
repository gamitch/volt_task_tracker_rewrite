# Worker Packet: T603 — widen `AttendanceMethod` to include `'self'` (six declarations)

**Packet v1.** Not yet dispatched. Attempt count: 0 (this is the first attempt).

**Branch:** `claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**.

**Process tier: HEAVY** (constitution item 26). Trigger: this task widens the type flowing through
`resolveAttendanceWriteMethod` (`src/lib/supabase/loaders/attendance.ts:276-279`), a function that
takes and returns `AttendanceMethod` and whose result is written straight into production `attendance`
UPSERT payloads (`AttendancePanel.tsx:717`/`790`, and — once this task's own touch to
`MarkDayCompleteDialog.tsx` lands — `MarkDayCompleteDialog.tsx:795`/`835`). That is "touches a write
path" under item 26 even though this task changes no runtime branch of that function. HEAVY normally
means packet + premise gate + worker + checker; the premise gate (item 19) is **already satisfied** —
every factual claim below was grep/read-verified against the live repository by the orchestrator
before this packet was written (see §1). No separate `checker-premise` round is required before you
start.

**Worker model: sonnet (default, no override).** None of item 18's four opus triggers fire — no
migration file is edited, no RLS/`security definer` object is touched, no metric-view SQL is touched,
and no auth/session/role/permission logic changes. Per item 25, a write-path label is not itself a
reason to bump model tier; only genuine complexity is, and this task's complexity is "keep a
mechanical, well-specified edit inside its stated boundaries," not novel reasoning.

**Checker:** `checker-reviewer`, also sonnet (default) — see the checker packet for why this does not
need opus.

---

## 1. Background — verified premises (do not re-derive; flag a dispute if your own build disagrees)

The ledger row this task is based on undercounts the affected declarations. The **real** count,
confirmed by `grep -rn "^export type AttendanceMethod" src`, is **six**, all currently
`'qr' | 'coach' | 'import'`:

| # | File:line | Owning surface |
|---|---|---|
| 1 | `src/lib/supabase/loaders/attendance.ts:211` | W1 (yours) |
| 2 | `src/lib/supabase/types.ts:327` | shared |
| 3 | `src/pages/checkin/CheckinResult.tsx:175` | W1 (yours) |
| 4 | `src/pages/meetings/EndMeetingDialog.tsx:329` | W3 (yours) |
| 5 | `src/pages/meetings/LiveConsole.tsx:502` | W1 (yours) |
| 6 | `src/pages/outreach/MarkDayCompleteDialog.tsx:575` | **W2 — see §2, owner-authorized exception** |

The database has allowed `'self'` since 2026-07-24 —
`supabase/migrations/20260724000000_self_checkoff.sql:31-33`:
```
alter table public.attendance
  add constraint attendance_method_check
  check (method in ('qr', 'coach', 'import', 'self'));
```
(This drops and replaces the original `attendance_method_check` from
`20260717000000_scheduling_attendance.sql:90`, which allowed only three values. Both are read-only
history for you — **do not touch anything under `supabase/migrations/`**, additive-only per
constitution item 10, and this migration is already applied.)

**Line numbers above are current-HEAD numbers.** Adding the doc comments in §3 will push the
`attendance.ts` and `types.ts` declarations down a few lines — match by file + content, not by a
literal line number that has since shifted.

**No exhaustiveness risk:** verified, there is no `Record<AttendanceMethod, …>` and no `switch` on any
method-typed value anywhere in `src/`. Widening the union cannot silently drop a branch.

## 2. Why a W2 file is in your Allowed Files, and why it is exactly one line

Widening only the five files you own leaves `MarkDayCompleteDialog.tsx`'s own local
`AttendanceMethod` (line 575, a **separate, textually-identical declaration**, not an import) narrower
than `attendance.ts`'s once you widen the latter. `resolveAttendanceWriteMethod`'s return value is
assigned into that narrower type at two call sites — `MarkDayCompleteDialog.tsx:795` and `:835`
(`method: resolveAttendanceWriteMethod(existing?.method ?? null)` /
`resolveAttendanceWriteMethod(existing.method)`) — and this **measured**, not predicted: doing five and
not six leaves `npm run typecheck` at **exit 2**, two `TS2322`s in that file. A partial fix is RED, not
merely incomplete.

**The owner explicitly authorized this one-line touch to W2's file on 2026-08-05** so all six widen
together. You are authorized to change **exactly** `MarkDayCompleteDialog.tsx:575`'s literal union.
Nothing else in that file. If you find yourself wanting to touch any other line in it, stop — that is
scope growth, not this task.

## 3. What to change, file by file

**Widen the literal union in all six locations** from `'qr' | 'coach' | 'import'` to
`'qr' | 'coach' | 'import' | 'self'`. For four of the six, that is the **entire** change — do not touch
any other line in these files:
- `src/pages/checkin/CheckinResult.tsx:175`
- `src/pages/meetings/EndMeetingDialog.tsx:329`
- `src/pages/meetings/LiveConsole.tsx:502`
- `src/pages/outreach/MarkDayCompleteDialog.tsx:575` (§2 — the one authorized W2 line)

Their existing doc comments (where present) stay accurate after the widening and need no edit — e.g.
`MarkDayCompleteDialog.tsx:570-574`'s "textually identical to … `AttendanceMethod`" claim remains true
once both copies are widened identically. Do not add prose to these four files beyond the literal
union change.

**The other two additionally gain a short doc comment** citing the migration that is the actual source
of truth, matching this repo's existing comment density (one short JSDoc block, same shape as the
comments already on these types):

`src/lib/supabase/loaders/attendance.ts:211` currently has no comment directly above it. Add:
```
/** `attendance.method` check constraint -- widened to permit `'self'` by
 * `supabase/migrations/20260724000000_self_checkoff.sql:31-33` (current
 * source of truth; the original three-value constraint was
 * `20260717000000_scheduling_attendance.sql` line 90). */
export type AttendanceMethod = 'qr' | 'coach' | 'import' | 'self';
```

`src/lib/supabase/types.ts:325-327` currently reads:
```
/** `attendance.method` check constraint, line 90 (see `AttendanceRow`
 * below). */
export type AttendanceMethod = 'qr' | 'coach' | 'import';
```
**Extend it** (keep the existing "line 90" citation — it is still true history, just no longer the
current constraint) — do not delete it, add to it:
```
/** `attendance.method` check constraint, line 90 (see `AttendanceRow`
 * below) -- widened to permit `'self'` by
 * `supabase/migrations/20260724000000_self_checkoff.sql:31-33`, the current
 * source of truth. */
export type AttendanceMethod = 'qr' | 'coach' | 'import' | 'self';
```
Minor wording variation is fine; both facts (which migration+lines is the current constraint, and that
it widens to permit `'self'`) must survive in your version.

## 4. What you must NOT do

- **Do not touch `src/lib/supabase/loaders/selfCheckoff.ts`.** It carries its own correct fork,
  `SelfCheckoffAttendanceMethod = 'qr' | 'coach' | 'import' | 'self'` (`:93`), and a module-doc note at
  `:36-44` explaining that it forked away from `attendance.ts` *because* `attendance.ts`'s union was
  stale. Both the fork and that note become redundant/false the moment this task lands. **That is
  known, accepted, and explicitly out of scope for T603** — collapsing the fork and correcting the
  module doc is a separate, already-named follow-up task, **T608**. Do not fix it here even though you
  will be able to see exactly what needs fixing. Report it per §6.
- **Do not touch any file under `supabase/migrations/`.** Everything you need from the migration is a
  read-only citation.
- **Do not claim "one union in one place" as achieved.** It is not — `selfCheckoff.ts`'s fork survives
  this task. Your output must say this plainly (§6), not imply consolidation happened.
- **Do not touch `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
  `docs/swarm/constitution.md`, `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`,
  `.claude/settings.json`.**
- **Do not run `git add -A` or `git add .`** (constitution item 22) — stage the exact files you
  changed, by name.

## 5. Allowed Files

- `src/lib/supabase/loaders/attendance.ts` — line 211 + new doc comment (§3)
- `src/lib/supabase/types.ts` — line 327 + extended doc comment (§3)
- `src/pages/checkin/CheckinResult.tsx` — line 175 only
- `src/pages/meetings/EndMeetingDialog.tsx` — line 329 only
- `src/pages/outreach/MarkDayCompleteDialog.tsx` — line 575 only (§2 — the one authorized W2 line)
- `src/pages/meetings/LiveConsole.tsx` — line 502 only
- `docs/swarm/active/T603-worker-output.md` (create — your evidence doc)

## Forbidden Files

- `src/lib/supabase/loaders/selfCheckoff.ts` (§4)
- everything under `supabase/migrations/`
- any file in `src/` not listed in §5, including any other line of
  `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/constitution.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`

## 6. Acceptance Criteria

Each is independently checkable by file/line and an exact command. Run every command directly and
capture its real exit code — **do not pipe through `tail`/`head`/`grep` before checking `$?`**; that
already produced one false green on this project. Prefer `cmd; echo "EXIT:$?"` or capturing `$?`
immediately after the bare command.

- **AC1 — exactly six canonical declarations, all six widened, no seventh.**
  `grep -rn "^export type AttendanceMethod" src` returns exactly 6 lines (the six files in §1's
  table, at their then-current line numbers), every one ending
  `'qr' | 'coach' | 'import' | 'self';`.
- **AC2 — `selfCheckoff.ts` is unmodified.**
  `git diff --stat -- src/lib/supabase/loaders/selfCheckoff.ts` produces no output.
- **AC3 — no migration file is touched.**
  `git diff --stat -- supabase/migrations/` produces no output.
- **AC4 — the four single-line files changed only their literal union.**
  `git diff -- src/pages/checkin/CheckinResult.tsx src/pages/meetings/EndMeetingDialog.tsx src/pages/meetings/LiveConsole.tsx src/pages/outreach/MarkDayCompleteDialog.tsx`
  shows, per file, exactly one changed line, and that line's only content change is appending
  `| 'self'` to the union.
- **AC5 — `attendance.ts` and `types.ts` doc comments land as specified.**
  Read the diff for both files: `attendance.ts` gains a new JSDoc directly above the widened
  declaration citing `20260724000000_self_checkoff.sql:31-33`; `types.ts`'s existing JSDoc is extended
  (not deleted/replaced) to also cite that same file:lines, and its original "line 90" citation is
  still present.
- **AC6 — `npm run typecheck` exits 0.**
  `npm run typecheck; echo "EXIT:$?"` → `EXIT:0`. Paste the real command output, not a summary.
- **AC7 — `npm run format:check` exits 0.**
  `npm run format:check; echo "EXIT:$?"` → `EXIT:0`.
- **AC8 — `npm run lint` exits 0 (errors), warning count reported against baseline.**
  `npm run lint; echo "EXIT:$?"` → `EXIT:0` with 0 errors. Report the warning count before your change
  (run it on a clean checkout first) and after; this task should not move it, since no new exported
  value or component is added. Explain any delta.
- **AC9 — `npm test` exits 0, counts reported against baseline.**
  `npm test; echo "EXIT:$?"` → `EXIT:0`. Report the file/test totals before and after — this task adds
  no test and changes no runtime logic, so the totals should be identical. In particular,
  `AttendancePanel.test.tsx`'s existing `describe('resolveAttendanceWriteMethod …')` block
  (`:189-194`, asserting `'qr'`/`'import'`/`'coach'`/`null` inputs) must still pass unmodified —
  it is your proof that you changed representability, not behavior.
- **AC10 — the "one union in one place" gap is disclosed, not implied fixed.**
  `docs/swarm/active/T603-worker-output.md` states in plain language that `selfCheckoff.ts`'s fork
  (`SelfCheckoffAttendanceMethod`, `:93`) and its now-false module-doc note (`:36-44`) both survive
  this task, and names **T608** as the follow-up that must collapse them. (Constitution item 20: a
  deliberate deferral must name a task, not just live in a comment — you are not creating the ledger
  row yourself, but your report must give the orchestrator everything needed to create it.)

## 7. Relevant Constitution Excerpts

- **Non-Negotiables:** "The app must build successfully." "Existing tests must pass unless the boss
  explicitly approves a test update." "No worker may mark its own work complete." "Every checker must
  inspect the actual artifact, not just the worker's summary."
- **Item 10:** "Database changes are additive migrations via the Supabase CLI; editing an applied
  migration file → BLOCKER." (You are not editing one, only citing one — this is here so you don't.)
- **Item 20:** a deliberate deferral must produce a follow-up task, not just a code comment.
- **Item 21:** your completion report must give the commit SHA your work landed in.
- **Item 22:** explicit pathspecs only — never `git add -A` or `git add .`.
- **Item 23:** if you need to mutate anything to prove a claim (e.g. reproduce the partial-fix TS2322s
  yourself before you believe §2), do it in your own worktree, not the shared tree.

## Most Recent Failure

None — first attempt.

## Required Worker Output

- Files changed (exact list, matching §5).
- The diff content for each of the six widened lines and the two new/extended doc comments.
- Every command from §6 run directly, with its real captured exit code and relevant output.
- Before/after eslint warning count and vitest file/test totals.
- Commit SHA (item 21) and confirmation you staged explicit pathspecs (item 22).
- A **"Deferred — for the ledger"** section naming **T608** (§4, AC10) verbatim, so the orchestrator
  can create that row without re-deriving it.
- Known risks, if any.
- Whether a dispute is needed (e.g., if your own `npm run typecheck` at unmodified HEAD does *not*
  show the five-of-six partial-fix failure described in §2 — report the contradiction, do not silently
  proceed on a premise your own measurement disagrees with).
