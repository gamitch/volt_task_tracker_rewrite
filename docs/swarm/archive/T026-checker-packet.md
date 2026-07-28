# Checker Packet: T026 (Teams tab CRUD + archive) — Check Attempt 1

## Task ID
T026 — Teams tab (CRUD + archive), Epic E4.

## Checker Agent
checker-accessibility (per task-ledger.md T026 row).

## Objective
Verify full team CRUD with a correctly-distinguished reversible Archive vs. irreversible-and-gated
Hard Delete, a real "no students or history" block, and a defensible color-chip selector built from
genuinely-documented Astryx components (no invented `ColorPicker`).

## Allowed Files (worker's literal permitted edit)
- `src/pages/roster/TeamsTab.tsx` (new)

**Scope flag**: worker also created `TeamsTab.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`ceebc11`) — do NOT
infer authorship from commit messages. Confirm `RosterShell.tsx`, `StudentsTab.tsx`, `router.tsx`,
`guards.tsx` (import-only) untouched. Note: the working tree may show other concurrently-running
tasks' untracked files (`OutreachEventDialog.tsx`, `src/pages/settings/**`) — not this task's
concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Archive vs. Hard Delete separation**: `withArchivedOverride` claimed the only place `archived`
   is mutated, always returns the full row set with one row flipped (never removes a row). Archive
   opens a real `AlertDialog` with reversible-sounding copy ("preserved… you can unarchive it at any
   time"). `withHardDelete` claimed the ONLY place a row is actually removed, blocked
   (`MoreMenu` item rendered `isDisabled` with a reason-naming label, not hidden) whenever
   `hasStudentsOrHistory` is true; when allowed, confirms via a distinct, unambiguously-worded
   "cannot be undone" `AlertDialog`.
2. **"No students or history" gate**: `teamHasStudentsOrHistory` claimed to return `true` if ANY
   `StudentTeamLinkRow` references the team — deliberately not filtering on `is_active`, since even
   a deactivated student's link counts as history. Claims `canHardDelete` is the single predicate
   both the menu-disabling logic and the confirm-handler guard call (can't drift between the two
   surfaces). Claims a real test proves clicking the disabled item on a blocked team opens no dialog
   and the row survives, and a separate test proves an allowed team's row is actually removed on
   confirm.
3. **Color-chip investigation — a genuine, not-invented finding**: claims a grep of every
   `# ComponentName` heading in `astryx-api.md` confirms NO `ColorPicker`/`ColorInput`/`Swatch`
   component exists. Claims it built the picker entirely from two real documented components
   instead: `Token`'s closed 11-color union (imported as the real `TokenColor` type) rendered via
   `Selector`'s `renderOption` prop, plus a live `Token` preview below the selector (since
   `Selector`'s trigger only shows plain text — claims confirmed against the installed
   `Selector.tsx` source). Claims `toKnownTeamColor` falls back unrecognized legacy free-text color
   values to `'default'` for swatch rendering ONLY, never mutating the stored string — proven with a
   `'crimson-legacy'` fixture row.
4. Claims 27/27 new tests pass; 548/549 repo-wide (the 1 failure claimed to be a different
   concurrent task's `SeasonSettings.test.tsx`, unrelated). typecheck/lint(scoped)/format(scoped)
   clean for its own files. Explicitly recommends the checker verify in isolation rather than trust
   a repo-wide green run, given concurrent-worker noise.

## Required Verification Steps
1. **Read `TeamsTab.tsx` and `TeamsTab.test.tsx` in full** — do not rely on the worker's module doc
   or this packet's paraphrasing.
2. **Archive/Hard-Delete separation — confirm by source read.** Verify `withArchivedOverride` never
   removes a row (only flips a boolean) and `withHardDelete` is genuinely the sole removal path.
3. **"No students or history" gate — the central safety property of this task.** Confirm
   `canHardDelete` is genuinely the single shared predicate (grep for any second, divergent
   implementation of the same check). Reproduce or independently verify the four boundary-case
   tests (has-active-student blocked, history-only blocked, zero-links allowed, archived+other-state
   still blocked when history exists).
4. **Disabled-not-hidden UI choice** — confirm by source read that the blocked Hard Delete menu item
   is genuinely `isDisabled` (not conditionally absent), and judge whether disabled-with-reason is
   the better accessibility choice than hiding it outright (a defensible design call worth an
   explicit verdict, not just acceptance).
5. **Color-chip investigation — reproduce the grep yourself.** Confirm zero `ColorPicker`/
   `ColorInput`/`Swatch` components exist in `astryx-api.md`. Confirm `Token`'s real 11-color union
   and `Selector`'s `renderOption` prop are genuinely documented as claimed. Confirm
   `toKnownTeamColor`'s fallback behavior never mutates the stored free-text value, only affects
   swatch rendering.
6. **Astryx prop citations** — spot-check `Table`, `Selector`, `Token`, `MoreMenu`, `AlertDialog`,
   `DialogHeader`, `Heading` (confirm the claimed CLI-cross-check doc gaps) against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself**, scoped to this task's files given the disclosed
   concurrent-worker noise (reproduce the worker's own isolation approach) — don't accept
   "27/27"/"548/549" without your own run.
9. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface — the color-chip
  investigation is exactly this rule in action; verify it wasn't secretly a workaround for a
  component that does exist.
- Item 13: no box-drawing/bracket-character fake structure.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the "no students or history" gate's single-predicate safety property
- explicit verdict on the color-chip investigation's genuineness
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
