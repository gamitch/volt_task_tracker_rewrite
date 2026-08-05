# Worker Packet: T603 — widen the `method` shape to include `'self'` (seven edits across seven files)

**Packet v2 — REVISED after `checker-premise` round 1 of 2, verdict REVISE / BLOCKER.** v1 declared
item 19's premise gate satisfied by orchestrator pre-verification and went to `checker-premise` anyway
(process requires it regardless of what a packet claims about itself). The gate found a real defect
v1's own read-verification could not see: a **seventh** narrow copy, and v1's prescribed six-file end
state **does not compile**. v2 folds that finding in. **Round 1 was consumed by v1; round 2 reviewed
v2 and returned DISPATCH (severity MINOR). Item 19a's two rounds are now spent — any further defect
escalates to `boss-arbiter` rather than a third round. This packet is CLEARED for a worker.**

Attempt count: 0. No worker has run against any version of this packet.

**Branch:** `claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**.

**Process tier: HEAVY** (constitution item 26), unchanged by this revision. Trigger: this task widens
the type flowing through `resolveAttendanceWriteMethod` (`src/lib/supabase/loaders/attendance.ts:276-
279`), a function that takes and returns a `method`-shaped value and whose result is written straight
into production `attendance` UPSERT payloads (`AttendancePanel.tsx:717`/`790`, and after this task's
own touches land, `MarkDayCompleteDialog.tsx:795`/`835` and the real `markDayComplete` mutation built
on `outreach.ts`'s own copy of the same shape). The seventh file does not change this — it is still a
type-only widening, not a new runtime branch.

**Worker model: sonnet (default, no override).** None of item 18's four opus triggers fire — no
migration file is edited, no RLS/`security definer` object is touched, no metric-view SQL is touched,
no auth/session/role/permission logic changes. Per item 25, "touches a write path" is not itself a
reason to bump model tier; only genuine complexity is.

**Checker:** `checker-reviewer`, also sonnet (default) — see the checker packet for why this does not
need opus.

---

## 0. Gate history (item 19)

- **Round 1 of 2:** `checker-premise` reviewed v1 (the "six declarations" version) and returned
  **REVISE, severity BLOCKER**. Finding: `src/lib/supabase/loaders/outreach.ts:1258` —
  `method: 'qr' | 'coach' | 'import';`, an **inline property type** inside `OutreachAttendanceWriteRow`
  — is a seventh narrow copy the anchored `grep -rn "^export type AttendanceMethod" src` cannot see,
  because it is not an `export type` statement. Measured in an isolated worktree, exit codes captured
  on bare commands:
  - five widened (the original ledger row's count), W2's `MarkDayCompleteDialog.tsx` left narrow →
    **exit 2**, two `TS2322`s in that file.
  - **all six widened, `outreach.ts` left narrow (v1's prescribed end state) → exit 2, four errors**:
    `MarkDayCompleteDialog.test.tsx:1372`, `MarkDayCompleteDialog.tsx:936`,
    `MarkEventCompleteDialog.tsx:470`, `OutreachDetail.tsx:2518`.
  - six + `outreach.ts:1258` widened → `typecheck` **0**, `format:check` **0**, `npm test` **0**
    (81 files / 2051 tests).

  This is an **assignability break, not an exhaustiveness break** — read-verification (grepping for
  `Record<AttendanceMethod` or a `switch`) cannot catch it, because nothing is missing a branch;
  something stops being *assignable* once one side of a structural match widens and the other doesn't.
- **Round 2 of 2:** a DIFFERENT `checker-premise` agent reviewed v2 and returned **DISPATCH, severity
  MINOR**. It re-measured the full prescribed end state in its own isolated worktree rather than
  reading it: all seven widened plus both doc blocks → `typecheck` **EXIT 0**, `format:check`
  **EXIT 0**, `lint` **EXIT 0** (0 errors / 366 warnings, baseline unmoved), `npm test` **EXIT 0**
  (81 files / 2051 tests). It independently reproduced both failing states too (five widened → exit 2
  / two errors; six widened → exit 2 / four errors), and **proved the four collateral locations need
  no edit**: with all seven widened, `git diff --stat` produces no output for
  `MarkEventCompleteDialog.tsx`, `OutreachDetail.tsx` or `MarkDayCompleteDialog.test.tsx`, and
  `MarkDayCompleteDialog.tsx` shows only `@@ -575 +575 @@`.

  Its five findings are folded into this v2 text: the `:785` description corrected (Finding 1), a
  **third** latent narrow copy added at `supabase/functions/checkin/attendance_upsert.ts:43`
  (Finding 2 — the eighth-copy hunt result, latent not blocking), this section's round arithmetic
  corrected (Finding 3), the stale ledger row left to the orchestrator (Finding 4), and the
  `attendance.ts` post-edit shift measured at 211 → **222**, not "a few lines" (Finding 5).
- **Item 19 is satisfied. A worker may now run against this packet.**

---

## 1. Background — verified premises (do not re-derive; flag a dispute if your own build disagrees)

**Seven locations need editing**, not six:

| # | File:line | Owning surface | Nature |
|---|---|---|---|
| 1 | `src/lib/supabase/loaders/attendance.ts:211` | W1 (yours) | `export type AttendanceMethod` |
| 2 | `src/lib/supabase/types.ts:327` | shared | `export type AttendanceMethod` |
| 3 | `src/pages/checkin/CheckinResult.tsx:175` | W1 (yours) | `export type AttendanceMethod` |
| 4 | `src/pages/meetings/EndMeetingDialog.tsx:329` | W3 (yours) | `export type AttendanceMethod` |
| 5 | `src/pages/meetings/LiveConsole.tsx:502` | W1 (yours) | `export type AttendanceMethod` |
| 6 | `src/pages/outreach/MarkDayCompleteDialog.tsx:575` | **W2 — owner-authorized, §2** | `export type AttendanceMethod` |
| 7 | `src/lib/supabase/loaders/outreach.ts:1258` | **W2 — owner-authorized, §2** | inline property type inside `OutreachAttendanceWriteRow`, **not** an `export type` — this is why #1–#6's anchored grep could never see it |

The database has allowed `'self'` since 2026-07-24 —
`supabase/migrations/20260724000000_self_checkoff.sql:31-33`:
```
alter table public.attendance
  add constraint attendance_method_check
  check (method in ('qr', 'coach', 'import', 'self'));
```
(Drops and replaces the original `attendance_method_check` from
`20260717000000_scheduling_attendance.sql:90`, which allowed only three values. Both are read-only
history — **do not touch anything under `supabase/migrations/`**, additive-only per constitution item
10, and this migration is already applied.)

**Line numbers for #1, #2, #6, #7 above are current-HEAD numbers; #1 and #2 SHIFT once you add their
doc comments (§3) — measured by premise-gate round 2: `attendance.ts` 211 → **222** (11 lines: 7 from
the `:16-22` note, 4 from the declaration comment), `types.ts` 327 → **329**.** Match by file + content, not a literal line number that
has since moved.

**No exhaustiveness risk survives this task:** verified, there is no `Record<AttendanceMethod, …>` and
no `switch` on any method-typed value anywhere in `src/`. This was never the risk — §0's finding is an
assignability break, a structural-typing effect, which is why it was invisible to that grep.

### 1a. The four "collateral" error locations — do not edit any of them

When #1–#6 are widened but #7 is not, `tsc` reports four errors that are **not** at #7 itself, because
the real `markDayComplete` mutation (`outreach.ts`, built on `OutreachAttendanceWriteRow`'s still-narrow
`method`) is used as a **default parameter value** wherever a widened `method` shape is now expected:

- `MarkDayCompleteDialog.tsx:936` — `onMarkComplete = markDayComplete` (the default-value position;
  the prop it defaults is typed via this file's own now-widened `AttendanceWriteRow`).
- `MarkEventCompleteDialog.tsx:470` — the same default-parameter pattern,
  `onMarkSessionComplete = markDayComplete`.
- `OutreachDetail.tsx:2518` — `await markDayComplete(payload)`, a direct call site.
- `MarkDayCompleteDialog.test.tsx:1372` — a test calling `markComplete(...)` (a value obtained from
  `makeMarkDayComplete`) with a widened payload.

**Once #7 is also widened, textual identity is restored across all seven local `method`-shaped
declarations and all four of these clear on their own.** You do not edit any of them — three are
outside your Allowed Files entirely (`MarkEventCompleteDialog.tsx`, `OutreachDetail.tsx`,
`MarkDayCompleteDialog.test.tsx` are all Forbidden), and the fourth
(`MarkDayCompleteDialog.tsx:936`) is a different line in an Allowed file than the one line (`:575`)
you are authorized to touch there. If, after widening all seven, any of these four still shows an
error, **stop and flag a dispute** — do not attempt to edit a Forbidden file to make it go away.

**Reproducing §0's intermediate five-widened state yourself (optional, not required) will show the
first `TS2322` at `MarkDayCompleteDialog.tsx:785`** — the array-typed `return` statement of
`buildAttendanceWriteRows` (`:785` is `return checkedStudentIds.map((studentId) => {`; the
`): AttendanceWriteRow[] {` signature line is `:784`) — not at `:795`, the actual
`resolveAttendanceWriteMethod(...)` call site whose value is the real mismatch. This is a `tsc`
reporting-position quirk (the array-typed `return` statement is where the checker parks the
diagnostic), not a sign your build disagrees with this packet. Do not spend time hunting for a
different root cause at `:785`.

## 2. Why two W2 lines are in your Allowed Files, and why each is exactly one line

`MarkDayCompleteDialog.tsx:575` (§1's row 6) and `outreach.ts:1258` (row 7) both belong to W2.
**The owner explicitly authorized both one-line touches (2026-08-05)** so all seven land together —
the first authorization covered `MarkDayCompleteDialog.tsx:575` alone; after `checker-premise` round 1
surfaced the seventh location, the owner additionally authorized `outreach.ts:1258`. You are
authorized to change **exactly** the literal union on each of those two lines. Nothing else in either
file. If you find yourself wanting to touch any other line in `MarkDayCompleteDialog.tsx` or
`outreach.ts`, stop — that is scope growth, not this task.

**The owner separately ruled that T603 and T608 stay separate tasks: widen now, consolidate
later.** Do not fold `selfCheckoff.ts`'s fork-collapse (T608, §4) into this task even though you will
be able to see exactly what it would take.

## 3. What to change, file by file

**Widen the literal union in all seven locations** from `'qr' | 'coach' | 'import'` to
`'qr' | 'coach' | 'import' | 'self'`. For **five** of the seven, that is the **entire** change — do not
touch any other line in these files:
- `src/pages/checkin/CheckinResult.tsx:175`
- `src/pages/meetings/EndMeetingDialog.tsx:329`
- `src/pages/meetings/LiveConsole.tsx:502`
- `src/pages/outreach/MarkDayCompleteDialog.tsx:575` (§2 — one of the two authorized W2 lines)
- `src/lib/supabase/loaders/outreach.ts:1258` (§2 — the other authorized W2 line)

Their existing doc comments (where present) stay accurate after the widening and need no edit — e.g.
`MarkDayCompleteDialog.tsx:570-574`'s "textually identical to … `AttendanceMethod`" claim remains true
once both copies are widened identically, and `outreach.ts:1258` has no doc comment of its own to
begin with (it is a bare interface field). Do not add prose to any of these five files beyond the
literal union change.

**The other two — `attendance.ts` and `types.ts` — get three things each:** the literal widening, a
new/extended doc comment citing the current source of truth, **and** a short correction to a second,
older comment in the same file that would otherwise contradict the new one (see below).

### 3a. `src/lib/supabase/loaders/attendance.ts:211`

No comment currently sits directly above the declaration. Add:
```
/** `attendance.method` check constraint -- widened to permit `'self'` by
 * `supabase/migrations/20260724000000_self_checkoff.sql:31-33` (current
 * source of truth; the original three-value constraint was
 * `20260717000000_scheduling_attendance.sql` line 90). */
export type AttendanceMethod = 'qr' | 'coach' | 'import' | 'self';
```

**Also correct `attendance.ts:16-22`** — module doc #1's own "Ground truth" bullet list quotes the
original `create table` shapes and includes `method text check ('qr'|'coach'|'import')` (line 20) with
no note that this was later widened. Leaving that uncorrected 190 lines away from the fresh, accurate
comment you just added at `:211` is the exact stale-doc contradiction this project has paid for
before. Insert one short sentence immediately after that bullet-list block (after `student_id.)` at
line 22, before the blank comment line that precedes the SCH-04 paragraph), in this file's own
established "AMENDED / SUPERSEDED, kept for history" voice (module doc #2, `:34-50`, is the precedent
for this exact pattern in this exact file):
```
*
*    `method`'s check constraint above is the ORIGINAL three-value list --
*    SUPERSEDED (widened to add `'self'`) by
*    `supabase/migrations/20260724000000_self_checkoff.sql:31-33`; see this
*    file's own `AttendanceMethod` comment below. Kept here verbatim as the
*    historical record of `20260717000000_scheduling_attendance.sql`'s
*    original text -- do not delete.
```
Do not alter the quoted DDL itself (the bullet list is a verbatim historical quote); add your note
after it, as its own sentence, exactly as module doc #2 already does elsewhere in this file.

### 3b. `src/lib/supabase/types.ts:327`

Currently:
```
/** `attendance.method` check constraint, line 90 (see `AttendanceRow`
 * below). */
export type AttendanceMethod = 'qr' | 'coach' | 'import';
```
**Extend it** (keep the existing "line 90" citation — it is still true history, just no longer the
current constraint):
```
/** `attendance.method` check constraint, line 90 (see `AttendanceRow`
 * below) -- widened to permit `'self'` by
 * `supabase/migrations/20260724000000_self_checkoff.sql:31-33`, the current
 * source of truth. */
export type AttendanceMethod = 'qr' | 'coach' | 'import' | 'self';
```

**Also correct `types.ts:329-347`** — the `AttendanceRow` doc comment's own verbatim `create table`
quote includes `method text not null check (method in ('qr', 'coach', 'import')), -- line 90` with no
note of the later widening. Add one sentence **after the closing code fence, still inside the same
`/** … */` block, before the closing `*/`** (currently at line 347) — do not edit the fenced quote
itself:
```
 * ```
 * Line 90's `method` constraint above was later widened to add `'self'` by
 * `supabase/migrations/20260724000000_self_checkoff.sql:31-33` -- see the
 * `AttendanceMethod` comment above for the current constraint.
 */
```

Minor wording variation from the suggested text above is fine in both 3a and 3b; the facts that must
survive are: which migration+lines is the *current* constraint, that it *widens* to permit `'self'`,
and (for the two DDL-quote corrections) that the quoted three-value text is historical, not current.

## 4. What you must NOT do

- **Do not touch `src/lib/supabase/loaders/selfCheckoff.ts`.** It carries its own correct fork,
  `SelfCheckoffAttendanceMethod = 'qr' | 'coach' | 'import' | 'self'` (`:93`), and a module-doc note at
  **`:36-46`** explaining that it forked away from `attendance.ts` *because* `attendance.ts`'s union
  was stale. Both the fork and that note become redundant/false the moment this task lands. **That is
  known, accepted, and explicitly out of scope for T603 by the owner's own ruling (§2)** — collapsing
  the fork and correcting the module doc is **T608**, a separate task. Do not fix it here. Report it
  per §6.
- **Do not touch `src/pages/reports/csvExport.ts`.** Its `AttendanceCsvMethod` (`:400`) is an eighth
  narrow copy, structurally identical to the seven you are widening. It is safe to leave: `grep`
  confirms `buildAttendanceCsv` (the only consumer of `AttendanceCsvRow`) is called nowhere in `src/`
  outside its own test file, so nothing produces a real (possibly-`'self'`) row into this shape today.
  This is a **second** known latent narrow copy, alongside `selfCheckoff.ts`'s fork.
- **Do not touch `supabase/functions/checkin/attendance_upsert.ts`.** Its `:43`
  `method: 'qr' | 'coach' | 'import';` is a **third** latent narrow copy, found by premise-gate round
  2 — derived from at `:102` (`method: AttendanceRow['method']`) and consumed at `:131`/`:137`. It
  cannot break this build and is not in AC3's residue count: it is Deno, `tsconfig.json` includes only
  `["src", "vite.config.ts"]`, and `eslint.config.js:19` ignores `supabase/functions/**`. It is a
  production QR-check-in path with no `'self'` writer today. Out of scope, but **name all three**
  latent copies in your report (§6) — an enumeration that stops at two is incomplete under item 20.
- **Do not touch any file under `supabase/migrations/`.** Everything you need from the migration is a
  read-only citation.
- **Do not touch `MarkEventCompleteDialog.tsx`, `OutreachDetail.tsx`, or
  `MarkDayCompleteDialog.test.tsx`** even though §1a's four collateral errors briefly appear inside
  them mid-fix. They need no edit and are expected to clear once #7 is widened.
- **Do not claim "one union in one place" as achieved.** It is not — `selfCheckoff.ts`'s fork and
  `csvExport.ts`'s fork both survive this task. Your output must say this plainly (§6), not imply
  consolidation happened.
- **Do not touch `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
  `docs/swarm/constitution.md`, `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`,
  `.claude/settings.json`.**
- **Do not run `git add -A` or `git add .`** (constitution item 22) — stage the exact files you
  changed, by name.

## 5. Allowed Files

- `src/lib/supabase/loaders/attendance.ts` — line 211 + new doc comment + the `:16-22` supersession
  note (§3a)
- `src/lib/supabase/types.ts` — line 327 + extended doc comment + the `:329-347` supersession note
  (§3b)
- `src/pages/checkin/CheckinResult.tsx` — line 175 only
- `src/pages/meetings/EndMeetingDialog.tsx` — line 329 only
- `src/pages/outreach/MarkDayCompleteDialog.tsx` — line 575 only (§2 — one of the two authorized W2
  lines)
- `src/pages/meetings/LiveConsole.tsx` — line 502 only
- `src/lib/supabase/loaders/outreach.ts` — **line 1258 only** (§2 — the other authorized W2 line;
  everything else in this large file is Forbidden)
- `docs/swarm/active/T603-worker-output.md` (create — your evidence doc)

## Forbidden Files

- `src/lib/supabase/loaders/selfCheckoff.ts` (§4)
- `src/pages/reports/csvExport.ts` (§4)
- everything under `supabase/migrations/`
- `src/pages/outreach/MarkEventCompleteDialog.tsx`, `src/pages/outreach/OutreachDetail.tsx`,
  `src/pages/outreach/MarkDayCompleteDialog.test.tsx` (§1a — collateral, self-resolving, not yours to
  edit)
- any other file in `src/` not listed in §5, including any other line of
  `src/pages/outreach/MarkDayCompleteDialog.tsx` or `src/lib/supabase/loaders/outreach.ts`
- `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/constitution.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`

## 6. Acceptance Criteria

Each is independently checkable by file/line and an exact command. Run every command directly and
capture its real exit code — **do not pipe through `tail`/`head`/`grep` before checking `$?`**; that
already produced one false green on this project. Prefer `cmd; echo "EXIT:$?"` or capturing `$?`
immediately after the bare command.

- **AC1 — exactly six `export type AttendanceMethod` declarations, all widened, no seventh (of this
  specific shape).** `grep -rn "^export type AttendanceMethod" src` returns exactly 6 lines (rows 1-6
  of §1's table, at their then-current line numbers), every one ending
  `'qr' | 'coach' | 'import' | 'self';`. **This grep alone is insufficient** — see AC2/AC3; it is
  structurally blind to inline property types like row 7.
- **AC2 — the seventh location, `outreach.ts:1258`, is also widened.**
  Read the line directly: `method: 'qr' | 'coach' | 'import' | 'self';` inside
  `OutreachAttendanceWriteRow`.
- **AC3 — the full residue is exactly the four pre-existing, out-of-scope narrow copies, no more, no
  fewer.** Run:
  ```
  grep -rnF "'qr' | 'coach' | 'import';" src
  ```
  (**`-F` is required** — an unescaped `|` is regex alternation, not a literal pipe, in both GNU grep
  and ripgrep, and would silently over-match. **The trailing `;` is required too** — without it, a
  correctly widened line like `'qr' | 'coach' | 'import' | 'self';` still contains
  `'qr' | 'coach' | 'import'` as a literal substring and would falsely count as a residue.)
  **Before your change:** expect 11 matches (every location in §1's table of 7, plus the 4 named
  below — everything except `selfCheckoff.ts:93`, which already carries `'self'` and so already fails
  this pattern). **After your change:** expect exactly these 4, and nothing else:
  - `src/pages/reports/csvExport.ts:400`
  - `src/lib/supabase/loaders/attendance.test.ts:43`
  - `src/lib/supabase/loaders/endMeeting.test.ts:150`
  - `src/pages/outreach/MarkEventCompleteDialog.test.tsx:898`
- **AC4 — `selfCheckoff.ts` is unmodified.**
  `git diff --stat -- src/lib/supabase/loaders/selfCheckoff.ts` produces no output.
- **AC5 — `csvExport.ts` is unmodified.**
  `git diff --stat -- src/pages/reports/csvExport.ts` produces no output.
- **AC6 — no migration file is touched.**
  `git diff --stat -- supabase/migrations/` produces no output.
- **AC7 — the five single-line files changed only their literal union, one line each.**
  `git diff -- src/pages/checkin/CheckinResult.tsx src/pages/meetings/EndMeetingDialog.tsx src/pages/meetings/LiveConsole.tsx src/pages/outreach/MarkDayCompleteDialog.tsx src/lib/supabase/loaders/outreach.ts`
  shows, per file, exactly one changed line, and that line's only content change is appending
  `| 'self'` to the union. **`MarkDayCompleteDialog.tsx:936` (the collateral default-parameter
  location, §1a) must NOT appear in this diff** — it is expected to compile correctly unchanged once
  `outreach.ts:1258` is also widened.
- **AC8 — `attendance.ts` and `types.ts` gain exactly the three prescribed changes each, nothing
  more.** Read the diff for both files: each gains (a) the widened literal at the declaration, (b) the
  new/extended doc comment (§3a/§3b) citing `20260724000000_self_checkoff.sql:31-33`, and (c) the
  supersession sentence appended to the older DDL-quote comment, with the quoted DDL itself left
  byte-identical. No other line in either file changes.
- **AC9 — `npm run typecheck` exits 0.**
  `npm run typecheck; echo "EXIT:$?"` → `EXIT:0`. Paste the real command output, not a summary. If you
  get anything else, first confirm all seven locations (AC1+AC2) are actually widened before assuming
  a new defect — but if all seven are widened and you still see a non-zero exit, stop and dispute
  rather than editing a Forbidden file to chase it.
- **AC10 — `npm run format:check` exits 0.**
  `npm run format:check; echo "EXIT:$?"` → `EXIT:0`.
- **AC11 — `npm run lint` exits 0 errors, warning count reported against a named, reproducible
  baseline.** Before making any change, in your own worktree, run `git rev-parse HEAD` and record the
  SHA, then run `npm run lint` and record the warning count — **this SHA + count is your baseline**,
  not "a clean checkout" (which is not reproducible once HEAD has moved). Then
  `npm run lint; echo "EXIT:$?"` → `EXIT:0` after your change, with 0 errors. This task should not move
  the warning count (no new exported value or component is added); explain any delta.
- **AC12 — `npm test` exits 0, counts reported against the same baseline SHA.**
  `npm test; echo "EXIT:$?"` → `EXIT:0`. Report file/test totals at your baseline SHA (AC11) and after
  your change — this task adds no test and changes no runtime logic, so totals should be identical.
  `AttendancePanel.test.tsx`'s existing `describe('resolveAttendanceWriteMethod …')` block
  (**`:189-196`**, asserting `'qr'`/`'import'`/`'coach'`/`null` inputs) must still pass unmodified — it
  is your proof that you changed representability, not behavior.
- **AC13 — the collateral files are byte-identical.**
  `git diff --stat -- src/pages/outreach/MarkEventCompleteDialog.tsx src/pages/outreach/OutreachDetail.tsx src/pages/outreach/MarkDayCompleteDialog.test.tsx`
  produces no output.
- **AC14 — the "one union in one place" gap is disclosed, not implied fixed.**
  `docs/swarm/active/T603-worker-output.md` states in plain language that (a) `selfCheckoff.ts`'s fork
  (`SelfCheckoffAttendanceMethod`, `:93`) and its now-false module-doc note (`:36-46`) survive this
  task, naming **T608** as the follow-up per the owner's own ruling that T603 and T608 stay separate;
  and (b) `csvExport.ts`'s `AttendanceCsvMethod` (`:400`) is a second, currently-inert latent narrow
  copy, left alone because it has no in-repo producer today. (Constitution item 20: a deliberate
  deferral must name a task, not just live in a comment — you are not creating the ledger row
  yourself, but your report must give the orchestrator everything needed to.)

## 7. Relevant Constitution Excerpts

- **Non-Negotiables:** "The app must build successfully." "Existing tests must pass unless the boss
  explicitly approves a test update." "No worker may mark its own work complete." "Every checker must
  inspect the actual artifact, not just the worker's summary."
- **Item 10:** "Database changes are additive migrations via the Supabase CLI; editing an applied
  migration file → BLOCKER." (You are not editing one, only citing one — this is here so you don't.)
- **Item 19c:** "Verify your own citations before submitting." Round 1's finding was exactly this kind
  of miss — verify AC1–AC3's grep outputs yourself rather than assuming this packet's expected counts.
- **Item 20:** a deliberate deferral must produce a follow-up task, not just a code comment.
- **Item 21:** your completion report must give the commit SHA your work landed in.
- **Item 22:** explicit pathspecs only — never `git add -A` or `git add .`.
- **Item 23:** if you need to mutate anything to prove a claim (e.g. reproduce §0/§1a's intermediate
  states yourself before you believe them), do it in your own worktree, not the shared tree.

## Most Recent Failure

`checker-premise` round 1 of 2, verdict **REVISE / BLOCKER** against v1 (see §0). Not a worker-attempt
failure — no worker has run against this task yet.

## Required Worker Output

- Files changed (exact list, matching §5).
- The diff content for all seven widened lines and the doc-comment/supersession-note changes in
  `attendance.ts` and `types.ts`.
- Every command from §6 run directly, with its real captured exit code and relevant output, including
  AC3's before/after residue grep.
- Baseline SHA (AC11), plus before/after eslint warning count and vitest file/test totals against it.
- Commit SHA (item 21) and confirmation you staged explicit pathspecs (item 22).
- A **"Deferred — for the ledger"** section naming **T608** (§4/§6 AC14) verbatim, plus the
  `csvExport.ts` disclosure, so the orchestrator can create/update ledger rows without re-deriving
  them.
- Known risks, if any.
- Whether a dispute is needed (e.g., if your own `npm run typecheck` at unmodified HEAD does not show
  §0's measured intermediate failures, or if after widening all seven you still see errors at the
  §1a collateral locations — report the contradiction, do not silently proceed on a premise your own
  measurement disagrees with).
