# Checker Packet: T603 — widen the `method` shape to include `'self'` (seven edits across seven files)

**v2 — updated to match worker packet v2**, after `checker-premise` round 1 of 2 returned REVISE /
BLOCKER against v1 (a seventh narrow copy at `src/lib/supabase/loaders/outreach.ts:1258` made v1's
six-file end state fail to compile). This checker packet assumes the worker was dispatched against
worker-packet v2 (seven files, not six) — if the worker's report or diffs reference only six files,
that is itself a finding: **FAIL — the worker was working from a stale/wrong packet version.**

**Checker agent: `checker-reviewer`, sonnet (default, no override).** Not opus: the risk here is a
**compile-time representability** fix, not a destructive-write risk — `resolveAttendanceWriteMethod`'s
runtime branches are unchanged by this task (a `'self'` input still falls through the same
`existingMethod === 'qr' || existingMethod === 'import' ? existingMethod : 'coach'` else-arm as
before). Per constitution item 25, a topic that *sounds* like a write-path change is not itself
grounds to bump model tier; verify that claim yourself (AC-runtime below) rather than taking it on
faith.

**You must inspect the actual artifact — diffs, file contents, and command output you run yourself.**
Never mark this complete based only on the worker's report (Non-Negotiables; "no worker may mark its
own work complete"; "every checker must inspect the actual artifact").

---

## 1. Objective

Verify that all six `export type AttendanceMethod` declarations **and** the seventh inline-property
copy (`outreach.ts:1258`, invisible to that grep) were widened from `'qr' | 'coach' | 'import'` to
`'qr' | 'coach' | 'import' | 'self'`; that exactly two of the seven touches
(`MarkDayCompleteDialog.tsx:575` and `outreach.ts:1258`) are owner-authorized touches to an otherwise-
forbidden W2 surface and nothing else in either file changed; that the four "collateral" locations
that show TS errors in the *intermediate* six-widened state (`MarkDayCompleteDialog.tsx:936`,
`MarkEventCompleteDialog.tsx:470`, `OutreachDetail.tsx:2518`, `MarkDayCompleteDialog.test.tsx:1372`)
are untouched and resolve on their own; that `attendance.ts` and `types.ts` each carry a correct short
doc comment citing `supabase/migrations/20260724000000_self_checkoff.sql:31-33` as current source of
truth **and** a supersession note correcting their own older DDL-quote comments; that `selfCheckoff.ts`,
`csvExport.ts`, and all migration files are untouched; that all four gates (`typecheck`, `format:check`,
`lint`, `test`) exit 0 with real captured exit codes against a named baseline SHA; and that the
worker's report honestly discloses — rather than implies fixed — that `selfCheckoff.ts`'s redundant
fork/doc and `csvExport.ts`'s latent narrow copy both survive this task, naming **T608** for the
former per the owner's ruling that T603 and T608 stay separate.

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
- `src/lib/supabase/loaders/outreach.ts`
- `docs/swarm/active/T603-worker-output.md` (new file, evidence doc)

If `git diff --stat` lists **any** of the following, return **FAIL — BLOCKER — unauthorized
modification**:
- `src/lib/supabase/loaders/selfCheckoff.ts`
- `src/pages/reports/csvExport.ts`
- `src/pages/outreach/MarkEventCompleteDialog.tsx`, `src/pages/outreach/OutreachDetail.tsx`,
  `src/pages/outreach/MarkDayCompleteDialog.test.tsx` (the four collateral error locations belong to
  three of these plus `MarkDayCompleteDialog.tsx` itself — see AC7's line-scoping check for that
  fourth one)
- anything under `supabase/migrations/`
- `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/constitution.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`
- any file not in the list above

Also confirm the commit(s) were staged with explicit pathspecs — `git log -p` or the worker's own
report should not show a `git add -A`/`git add .` in its command history (item 22).

## 3. Acceptance Criteria to Verify

- **AC1 — exactly six `export type AttendanceMethod` declarations, all widened.**
  Run `grep -rn "^export type AttendanceMethod" src`. Must return **exactly 6 lines**, each ending
  `'qr' | 'coach' | 'import' | 'self';`. **This grep is structurally blind to the seventh location** —
  do not treat a clean AC1 as sufficient on its own; AC2 is mandatory.
- **AC2 — the seventh location, `outreach.ts:1258`, is widened.**
  Open the file and read the line directly (it will not appear in AC1's grep, since it is an inline
  interface property, not an `export type` statement):
  `method: 'qr' | 'coach' | 'import' | 'self';` inside `OutreachAttendanceWriteRow`. Its absence →
  **FAIL — BLOCKER** (this is the exact defect that produced round 1's REVISE).
- **AC3 — the residue is exactly the four known, out-of-scope narrow copies.** Run:
  ```
  grep -rnF "'qr' | 'coach' | 'import';" src
  ```
  (`-F` fixed-string, required — a bare `|` is regex alternation in both grep and ripgrep. The
  trailing `;` is required too, or a correctly-widened line matches as a substring.) Expect **exactly
  4** matches, all pre-existing:
  - `src/pages/reports/csvExport.ts:400`
  - `src/lib/supabase/loaders/attendance.test.ts:43`
  - `src/lib/supabase/loaders/endMeeting.test.ts:150`
  - `src/pages/outreach/MarkEventCompleteDialog.test.tsx:898`
  More than 4 → at least one of the seven required locations was missed, **FAIL — BLOCKER**. Fewer
  than 4, or a different set → the worker touched a Forbidden file, **FAIL — BLOCKER**.
- **AC4 — `selfCheckoff.ts` unmodified.**
  `git diff --stat -- src/lib/supabase/loaders/selfCheckoff.ts` must produce no output. Also open the
  file and confirm `SelfCheckoffAttendanceMethod` (`:93`) and the module-doc note at **`:36-46`** (not
  `:36-44` — the clause runs through "established relative to each other and to `OutreachDetail.tsx`.")
  are byte-identical to pre-task content.
- **AC5 — `csvExport.ts` unmodified.**
  `git diff --stat -- src/pages/reports/csvExport.ts` must produce no output.
- **AC6 — no migration touched.**
  `git diff --stat -- supabase/migrations/` produces no output.
- **AC7 — the five single-line files changed only their literal union, one line each.**
  `git diff -- src/pages/checkin/CheckinResult.tsx src/pages/meetings/EndMeetingDialog.tsx src/pages/meetings/LiveConsole.tsx src/pages/outreach/MarkDayCompleteDialog.tsx src/lib/supabase/loaders/outreach.ts`.
  Confirm, per file, exactly one changed line, whose only content change is appending `| 'self'`.
  **Specifically confirm `MarkDayCompleteDialog.tsx`'s diff touches only `:575`, not `:936`** (the
  collateral default-parameter location) — `:936` must be absent from the diff entirely, resolving on
  its own once `outreach.ts:1258` is widened. Any other line changed in any of these five files →
  **FAIL** (at minimum MAJOR; BLOCKER if it is one of the two authorized W2 lines, since scope there
  was authorized for exactly one line each).
- **AC8 — doc comments and supersession notes on `attendance.ts` / `types.ts`.**
  Read the diff for both. Confirm:
  - `attendance.ts`'s widened declaration (near `:211`, may have shifted) has a new JSDoc directly
    above it citing `supabase/migrations/20260724000000_self_checkoff.sql:31-33` as current source of
    truth.
  - `attendance.ts`'s module doc #1 "Ground truth" bullet list (originally `:16-22`) gained a short
    added sentence noting the `method` constraint quoted there is the ORIGINAL three-value list,
    superseded by the same migration/lines — **and the quoted DDL bullet-list text itself is
    unchanged, byte-identical** (the correction is a new sentence, not an edit to the quote).
  - `types.ts`'s existing JSDoc (previously citing only `20260717000000_scheduling_attendance.sql`
    line 90) is **extended, not replaced** — the "line 90" citation must still be present — and now
    also cites `20260724000000_self_checkoff.sql:31-33`.
  - `types.ts`'s `AttendanceRow` doc comment's verbatim `create table` quote (originally `:329-347`)
    gained one sentence **after the closing code fence, before the closing `*/`**, noting line 90's
    constraint was superseded — again, **the fenced quote itself is byte-identical**.
  - All four additions are short (one to a few lines), matching this file's existing comment density —
    not a paragraph, not a bare one-liner with no citation.
  A missing citation, a deleted "line 90" reference, an edited DDL quote, or a comment citing the wrong
  migration/lines → **FAIL — MAJOR** (provenance is the entire point of this task).
- **AC9 — the collateral files are byte-identical.**
  `git diff --stat -- src/pages/outreach/MarkEventCompleteDialog.tsx src/pages/outreach/OutreachDetail.tsx src/pages/outreach/MarkDayCompleteDialog.test.tsx`
  produces no output.
- **AC10 — `npm run typecheck` exits 0.** Run it yourself: `npm run typecheck; echo "EXIT:$?"`. Do
  **not** trust the worker's pasted output alone — re-run. Must show `EXIT:0`. If you pipe through
  `tail`/`head`/`grep`, you have not verified this criterion — capture `$?` on the bare command.
- **AC11 — `npm run format:check` exits 0.** `npm run format:check; echo "EXIT:$?"` → `EXIT:0`.
- **AC12 — `npm run lint` exits 0 errors, against the worker's named baseline SHA.** Confirm the
  worker's report states a specific `git rev-parse HEAD` baseline SHA (not "a clean checkout") with an
  associated warning count. `npm run lint; echo "EXIT:$?"` → `EXIT:0`. Compare the post-change count to
  that named baseline; this task should not move it (no new export, no new component). An unexplained
  rise is at least MINOR; an unnamed/unreproducible baseline is itself a finding against AC12 — ask for
  the SHA rather than accepting "before my change."
- **AC13 — `npm test` exits 0, counts match the same baseline.** `npm test; echo "EXIT:$?"` →
  `EXIT:0`. Compare file/test totals to the worker's reported before/after at the named baseline SHA —
  should be identical (no test added, no runtime logic changed). Specifically confirm
  `AttendancePanel.test.tsx`'s `describe('resolveAttendanceWriteMethod …')` block (**`:189-196`**, not
  `:189-194`) is present, unmodified, and passing — this is the direct proof that runtime behavior for
  `'qr'`/`'import'`/`'coach'`/`null` inputs did not change, only representability of `'self'` did.
- **AC-runtime — spot-check the "compile-time only" claim this packet and the worker packet both
  make.** Read `resolveAttendanceWriteMethod` (`attendance.ts`, near `:276-279`, line number may have
  shifted from the added comments) and confirm its body was **not** touched — still exactly
  `existingMethod === 'qr' || existingMethod === 'import' ? existingMethod : 'coach'` (a `'self'`
  input still resolves to `'coach'`, same as before this task, since it does not match either literal
  in the condition). If the body changed at all, this task exceeded its stated scope — file at least
  MAJOR.
- **AC14 — the deferral is disclosed, not implied fixed, for BOTH latent narrow copies.**
  Open `docs/swarm/active/T603-worker-output.md`. It must explicitly state that (a) `selfCheckoff.ts`'s
  fork and its `:36-46` module-doc note survive this task as false/redundant, naming **T608** as the
  follow-up (constitution item 20, and the owner's explicit ruling that T603/T608 stay separate — the
  report should not attempt to fold them), and (b) `csvExport.ts`'s `AttendanceCsvMethod` (`:400`) is
  a second, currently-inert latent narrow copy, left alone because it has no in-repo producer today.
  Either disclosure missing, or language implying "one union in one place" was achieved, → **FAIL —
  MAJOR** (a true technical fix reported dishonestly is worse than an incomplete one reported
  honestly).
- **AC15 — commit SHA and worktree hygiene.**
  The worker's report names a commit SHA (item 21). Confirm `git log <SHA>` exists and its diff
  matches what you inspected above — "clean" and "committed" are different claims; verify the second,
  not just the first.

## 4. Severity Guide (apply, do not invent your own scale)

- **BLOCKER:** any forbidden-file modification (§2); any gate (typecheck/format/lint/test) not at real
  exit 0; a missing widening at any of the seven required locations (AC1/AC2); an incorrect residue
  count at AC3; `selfCheckoff.ts` or `csvExport.ts` modified; `resolveAttendanceWriteMethod`'s body
  changed; any edit inside the three collateral-only files (AC9) or at
  `MarkDayCompleteDialog.tsx:936` (AC7).
- **MAJOR:** a doc-comment or supersession-note citation missing/wrong, or a DDL quote edited instead
  of annotated (AC8); scope creep beyond the one authorized line in any of the five single-line files
  (AC7); either T608 or `csvExport.ts` disclosure missing or misleading (AC14).
- **MINOR:** an unexplained but small lint-warning delta against a properly-named baseline; cosmetic
  comment wording that still conveys both required facts.
- **NIT:** wording style only, no missing fact.

## Relevant Constitution Excerpts

- Non-Negotiables: build must succeed; existing tests pass unless explicitly approved otherwise; no
  worker self-certifies; checker inspects the actual artifact.
- Item 10: editing an applied migration file → BLOCKER (you are confirming none was edited).
- Item 19c: verify citations yourself — this is exactly what round 1 caught in the previous packet
  version; the same discipline applies to your own review, not just the worker's claims.
- Item 20: a deliberate deferral must name a follow-up task, not just live in a comment.
- Item 21: "clean" and "committed" are different claims — verify the commit exists, don't assume it.
- Item 22: explicit pathspecs only, never `git add -A`.
- Item 25: do not grade this BLOCKER-adjacent purely because "write path" sounds serious — grade the
  actual, concrete risk (AC-runtime is how you confirm there isn't one beyond representability).

## Required Checker Output

- PASS or FAIL per criterion (AC1–AC15 plus AC-runtime), plus an overall verdict.
- Severity classification for each finding, using §4's guide.
- Every command you ran yourself and its real output/exit code (not the worker's pasted copy).
- Files inspected (diffs read directly, not summarized from memory).
- Exact failure reason(s), if any, with file:line evidence.
- Required rework, if failed.
- Confirmation that both the T608 follow-up and the `csvExport.ts` latent-copy note are disclosed in
  the worker's output doc, so the orchestrator can create/update ledger rows in its next pass.
