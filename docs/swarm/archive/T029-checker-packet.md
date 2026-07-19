# Checker Packet: T029 (Season management) — Check Attempt 1

## Task ID
T029 — Season management `/settings/season` (SET-04), Epic E4.

## Checker Agent
checker-reviewer (per task-ledger.md T029 row).

## Objective
Verify admin-only season create/edit + set-active-season, correctly built around the real,
already-applied `seasons_single_active_idx` DB constraint (not reinventing it), with a real
`AlertDialog`-confirmed switch flow and client-side date-range validation.

## Allowed Files (worker's literal permitted edit)
- `src/pages/settings/SeasonSettings.tsx` (new)

**Scope flag**: worker also created `SeasonSettings.test.tsx`, outside the literal Allowed Files
line — same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive
the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`569a5d9`, shared
with T039 — confirm the D001 boundary per-file) — do NOT infer authorship from commit messages.
Confirm no migration file was added/edited. Confirm `router.tsx`, `guards.tsx` (import-only)
untouched. **Note a disclosed risk from the worker itself**: it reports running a project-wide
`npm run format` once mid-session that touched `Kiosk.tsx` (which it says it reverted via
`git checkout --`) and several other concurrent workers' untracked files with cosmetic-only
changes. Verify `Kiosk.tsx` is genuinely byte-unchanged from its last-Passed state (it should show
zero diff against HEAD, confirming the revert was clean) and that no functional (non-whitespace)
change landed in any file outside this task's own two files.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`seasons_single_active_idx` citation and non-reinvention** — the central safety property.
   Claims cited from `20260716000000_identity_roster.sql` lines 40-49 (columns) and 52-55 (the real
   partial unique index). No migration written. Claims the UI's atomicity contract is
   `SetActiveSeasonPayload {activateSeasonId, deactivateSeasonId}` — one injectable callback naming
   both seasons in a single payload, never two separate uncoordinated calls. `withActiveSeason`
   claimed the only place `isActive` is mutated, always producing exactly one active row in local
   state, mirroring the DB index's own invariant.
2. **Create-vs-edit**: one reusable form/dialog driven by `editingSeason: SeasonRow | null`
   (`null` = create) — claims reasoning disclosed since SET-04's three fields are identical in both
   modes.
3. **Date-range validation**: `validateSeasonDateRange` claimed to enforce `starts_on` strictly
   before `ends_on` (same-day rejected), gating the dialog's native `isDisabled` confirm button.
   Claims confirmed via the real migration that no DB `check` constraint exists for this — flagged
   as a disclosed follow-up/dispute candidate, not resolved (migrations forbidden here).
4. **Admin-only gating choice, explicitly distinguished from T028's pattern**: claims it nests
   `RequireRole allowedRoles={['admin']}` around the WHOLE PAGE (mirroring `RosterShell.tsx`'s
   precedent), deliberately NOT `AdminToggles.tsx`/T028's embedded-widget `useAuth()`-direct
   pattern — claims the reasoning is that T028's pattern exists specifically to avoid
   over-restricting a widget nested inside an already-`RequireRole`-guarded page, which doesn't
   apply here since this is a standalone page, not a widget embedded in a broader page. Claims it
   read T028's real code (landed concurrently) before writing this distinction.
5. Claims 26/26 new tests pass; 549/549 repo-wide. typecheck/lint/build/format(scoped) clean.
   Discloses the project-wide `format` run incident (see Forbidden Modification Check above).

## Required Verification Steps
1. **Read `SeasonSettings.tsx` and `SeasonSettings.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **`seasons_single_active_idx` citation — re-verify directly.** Open the migration file yourself
   and confirm the partial unique index genuinely exists at the claimed lines with the claimed
   definition. Confirm by source read that `withActiveSeason`/`SetActiveSeasonPayload` genuinely
   represents the deactivate-old+activate-new switch as one coherent unit, not two independently-
   dispatchable mutations that could leave local state with zero or two active seasons if one leg
   failed.
3. **Admin-only gating distinction — form your own explicit verdict.** Read `RosterShell.tsx` and
   `AdminToggles.tsx` (both read-only) yourself and confirm the worker's characterization of the two
   different gating patterns is accurate. Judge whether whole-page `RequireRole` really is the
   correct choice here (a standalone, not-embedded-in-another-gated-page settings screen) versus
   T028's embedded-widget pattern — this is a real architectural judgment call worth independent
   scrutiny, not just accepting the worker's self-consistent reasoning.
4. **Date-range validation — reproduce or independently verify** the same-day-rejected boundary
   case and the native-disabled confirm-button behavior.
5. **The disclosed format-run incident — verify no collateral damage landed.** Confirm `Kiosk.tsx`
   is genuinely byte-unchanged from its last-Passed commit (zero diff). Spot-check that any
   concurrent-worker files the worker mentions touching (if still present/uncommitted at check
   time) show no functional changes, only whitespace, if you can still observe them.
6. **Astryx prop citations** — spot-check `Dialog`, `DateRangeInput`, `NumberInput`, `AlertDialog`,
   `Table` against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** — don't accept "26/26"/"549/549" without your own
   run.
9. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 10 (BLOCKER-class): database changes are additive migrations via the Supabase CLI; editing
  an applied migration file is a BLOCKER. *(Cited because this task correctly did NOT touch the
  existing partial unique index or add a redundant one.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the `seasons_single_active_idx` citation and atomicity-contract design
- explicit verdict on the admin-only gating pattern choice (whole-page vs. embedded-widget)
- explicit verdict on whether the disclosed format-run incident caused any collateral damage
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
