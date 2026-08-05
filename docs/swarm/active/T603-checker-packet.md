# Checker Packet: T603 — widen `AttendanceMethod` to include `'self'` (six declarations)

**Checker agent: `checker-reviewer`, sonnet (default, no override).** Not opus: unlike T305 (which
this task's write-path framing echoes), the risk here is a **compile-time representability** fix, not
a destructive-write risk — `resolveAttendanceWriteMethod`'s runtime branches are unchanged by this
task (a `'self'` input still falls through the same `existingMethod === 'qr' || existingMethod ===
'import' ? existingMethod : 'coach'` else-arm as before). Per constitution item 25, a topic that
*sounds* like a write-path change is not itself grounds to bump model tier; verify that claim yourself
(§3, AC-runtime) rather than taking it on faith.

**You must inspect the actual artifact — diffs, file contents, and command output you run yourself.**
Never mark this complete based only on the worker's report (Non-Negotiables; "no worker may mark its
own work complete"; "every checker must inspect the actual artifact").

---

## 1. Objective

Verify that all six `export type AttendanceMethod` declarations in `src/` were widened from
`'qr' | 'coach' | 'import'` to `'qr' | 'coach' | 'import' | 'self'`, that exactly one of them
(`MarkDayCompleteDialog.tsx:575`) is an owner-authorized touch to an otherwise-forbidden W2 file and
nothing else in that file changed, that `attendance.ts` and `types.ts` each carry a correct short doc
comment citing `supabase/migrations/20260724000000_self_checkoff.sql:31-33` as current source of
truth, that `selfCheckoff.ts` and all migration files are untouched, that all four gates (`typecheck`,
`format:check`, `lint`, `test`) exit 0 with real captured exit codes, and that the worker's report
honestly discloses — rather than implies fixed — that `selfCheckoff.ts`'s redundant fork and its
now-false module doc survive this task as follow-up **T608**.

## 2. Forbidden Modification Check (run first)

```
git status --porcelain
git diff --stat
```
Confirm the changed-file set is **exactly**:
- `src/lib/supabase/loaders/attendance.ts`
- `src/lib/supabase/types.ts`
- `src/pages/checkin/CheckinResult.tsx`
- `src/pages/meetings/EndMeetingDialog.tsx`
- `src/pages/meetings/LiveConsole.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `docs/swarm/active/T603-worker-output.md` (new file, evidence doc)

If `git diff --stat` lists **any** of the following, return **FAIL — BLOCKER — unauthorized
modification**:
- `src/lib/supabase/loaders/selfCheckoff.ts`
- anything under `supabase/migrations/`
- `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/constitution.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`
- any file not in the list above

Also confirm the commit(s) were staged with explicit pathspecs — `git log -p` or the worker's own
report should not show a `git add -A`/`git add .` in its command history (item 22).

## 3. Acceptance Criteria to Verify

- **AC1 — exactly six declarations, all widened, no seventh.**
  Run `grep -rn "^export type AttendanceMethod" src`. Must return **exactly 6 lines**, one per file
  in §2's list (excluding the output doc), each ending `'qr' | 'coach' | 'import' | 'self';`. If it
  returns more or fewer than 6, or any line still lacks `'self'`, **FAIL — BLOCKER**.
- **AC2 — `selfCheckoff.ts` unmodified.**
  `git diff --stat -- src/lib/supabase/loaders/selfCheckoff.ts` must produce no output. Also open the
  file and confirm `SelfCheckoffAttendanceMethod` (`:93`) and the module-doc note at `:36-44` are
  byte-identical to pre-task content — this is the concrete check behind "the row's own stated end
  state, one union in one place, is not achieved here," and it must remain provably true.
- **AC3 — no migration touched.**
  `git diff --stat -- supabase/migrations/` produces no output.
- **AC4 — the four single-line files changed only their literal union.**
  `git diff -- src/pages/checkin/CheckinResult.tsx src/pages/meetings/EndMeetingDialog.tsx src/pages/meetings/LiveConsole.tsx src/pages/outreach/MarkDayCompleteDialog.tsx`.
  Confirm, per file, exactly one changed line, whose only content change is appending `| 'self'`.
  Any other line changed in any of these four files → **FAIL** (at minimum MAJOR; BLOCKER if it is
  the MarkDayCompleteDialog.tsx W2 file, since scope there was authorized for exactly one line).
- **AC5 — doc comments on `attendance.ts` / `types.ts`.**
  Read the diff for both. Confirm:
  - `attendance.ts`'s widened declaration now has a JSDoc directly above it citing
    `supabase/migrations/20260724000000_self_checkoff.sql:31-33` as the current source of truth.
  - `types.ts`'s existing JSDoc (previously citing only `20260717000000_scheduling_attendance.sql`
    line 90) is **extended, not replaced** — the "line 90" citation must still be present — and now
    also cites `20260724000000_self_checkoff.sql:31-33`.
  - Both comments are short (one JSDoc block, a couple of lines), matching this file's existing
    comment density — not a paragraph, not a bare one-liner with no citation.
  A missing citation, a deleted "line 90" reference, or a comment that cites the wrong migration/lines
  → **FAIL — MAJOR** (provenance is the entire point of this task).
- **AC6 — `git diff -- supabase/migrations/20260724000000_self_checkoff.sql` confirms line
  numbers.** Read the migration file directly; confirm lines 31-33 are in fact
  `alter table public.attendance add constraint attendance_method_check check (method in ('qr',
  'coach', 'import', 'self'));` (spanning those three lines). If the packet's cited lines are wrong,
  that is a foreman/premise error, not a worker error — note it but do not fail the worker for citing
  the number the packet gave them unless their comment itself misquotes the constraint text.
- **AC7 — `npm run typecheck` exits 0.** Run it yourself: `npm run typecheck; echo "EXIT:$?"`. Do
  **not** trust the worker's pasted output alone — re-run. Must show `EXIT:0`. If you pipe through
  `tail`/`head`/`grep`, you have not verified this criterion — capture `$?` on the bare command.
- **AC8 — `npm run format:check` exits 0.** `npm run format:check; echo "EXIT:$?"` → `EXIT:0`.
- **AC9 — `npm run lint` exits 0 errors.** `npm run lint; echo "EXIT:$?"` → `EXIT:0`. Compare the
  warning count to the worker's reported baseline; this task should not move it (no new export, no
  new component). An unexplained rise is at least MINOR.
- **AC10 — `npm test` exits 0, counts match baseline.** `npm test; echo "EXIT:$?"` → `EXIT:0`. Compare
  file/test totals to the worker's reported before/after — should be identical (no test added, no
  runtime logic changed). Specifically confirm `AttendancePanel.test.tsx`'s
  `describe('resolveAttendanceWriteMethod …')` block (`:189-194`) is present, unmodified, and passing —
  this is the direct proof that runtime behavior for `'qr'`/`'import'`/`'coach'`/`null` inputs did not
  change, only representability of `'self'` did.
- **AC-runtime — spot-check the "compile-time only" claim this packet and the worker packet both
  make.** Read `resolveAttendanceWriteMethod` (`attendance.ts`, current line number near :276-279)
  and confirm its body was **not** touched — still exactly
  `existingMethod === 'qr' || existingMethod === 'import' ? existingMethod : 'coach'` (a `'self'`
  input still resolves to `'coach'`, same as before this task, since it does not match either literal
  in the condition). If the body changed at all, this task exceeded its stated scope — file at least
  MAJOR.
- **AC11 — the deferral is disclosed, not implied fixed.**
  Open `docs/swarm/active/T603-worker-output.md`. It must explicitly state that `selfCheckoff.ts`'s
  fork and its `:36-44` module-doc note survive this task as false/redundant, and must name **T608**
  as the follow-up (constitution item 20). Its absence, or language implying "one union in one place"
  was achieved, → **FAIL — MAJOR** (a true technical fix reported dishonestly is worse than an
  incomplete one reported honestly).
- **AC12 — commit SHA and worktree hygiene.**
  The worker's report names a commit SHA (item 21). Confirm `git log <SHA>` exists and its diff
  matches what you inspected above — "clean" and "committed" are different claims; verify the second,
  not just the first.

## 4. Severity Guide (apply, do not invent your own scale)

- **BLOCKER:** any forbidden-file modification (§2); any gate (typecheck/format/lint/test) not at real
  exit 0; a seventh `AttendanceMethod` declaration appearing anywhere; `selfCheckoff.ts` modified;
  `resolveAttendanceWriteMethod`'s body changed.
- **MAJOR:** a doc-comment citation missing/wrong (AC5); scope creep beyond the one authorized line in
  any of the four single-line files (AC4); the T608 disclosure missing or misleading (AC11).
- **MINOR:** an unexplained but small lint-warning delta; cosmetic comment wording that still conveys
  both required facts.
- **NIT:** wording style only, no missing fact.

## Relevant Constitution Excerpts

- Non-Negotiables: build must succeed; existing tests pass unless explicitly approved otherwise; no
  worker self-certifies; checker inspects the actual artifact.
- Item 10: editing an applied migration file → BLOCKER (you are confirming none was edited).
- Item 20: a deliberate deferral must name a follow-up task, not just live in a comment.
- Item 21: "clean" and "committed" are different claims — verify the commit exists, don't assume it.
- Item 22: explicit pathspecs only, never `git add -A`.
- Item 25: do not grade this BLOCKER-adjacent purely because "write path" sounds serious — grade the
  actual, concrete risk (AC-runtime is how you confirm there isn't one beyond representability).

## Required Checker Output

- PASS or FAIL per criterion (AC1–AC12), plus an overall verdict.
- Severity classification for each finding, using §4's guide.
- Every command you ran yourself and its real output/exit code (not the worker's pasted copy).
- Files inspected (diffs read directly, not summarized from memory).
- Exact failure reason(s), if any, with file:line evidence.
- Required rework, if failed.
- Confirmation that the T608 follow-up is disclosed in the worker's output doc, so the orchestrator
  can create that ledger row in its next pass.
