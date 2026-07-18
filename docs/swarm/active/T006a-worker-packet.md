# Worker Packet: T006a

## Task ID
T006a

## Objective
Fix the CI test regression T006's mandated `App.tsx` wiring created in `src/theme/theme.smoke.test.tsx` (T002a). Real GitHub Actions CI is red on the required `npm run test` step on every push since commit e20b8d1. T006's worker was not at fault — the fix requires editing a file (`src/theme/theme.smoke.test.tsx`) that was forbidden to T006 — so this is a corrective, forward-fix task (same pattern as T002a/D002), not T006 rework. This is a same-day urgent fix: precision matters more than speed, but the scope below is small and exact.

This packet's scope is a **verbatim transcription** of boss-arbiter ruling D003 (`docs/swarm/dispute-log.md`), Rulings C and D. Nothing has been added, removed, or reinterpreted from that ruling.

## D003 Ruling — Verbatim Scope (do not deviate)

> **C. Test update APPROVED** (this entry is the explicit boss approval the Non-Negotiable requires) for `src/theme/theme.smoke.test.tsx`, exact scope:
> - Remove the outer `<Theme theme={voltTheme}>` wrapper and render `<App />` directly; App now owns the Theme provider internally per NAV-01, so the old wrapper double-wraps Theme and no longer represents the real app root. Remove the then-unused `Theme`/`voltTheme` imports.
> - Keep the `.not.toThrow()` render assertion as the core of the test — its documented purpose (exercising the React-19 `use()` runtime failure mode T002 missed) is unchanged and still served, now against the full real tree.
> - Replace `expect(container.querySelector('h1')?.textContent).toBe('VOLT Team Portal')` with a durable blank-render guard: `expect(container.textContent?.trim()).toBeTruthy()`. Deliberately do NOT assert the `'Login (placeholder)'` copy — that placeholder is scheduled to be replaced by T016 and asserting it would re-create this exact staleness problem; route/guard content behavior is T005/T016 checker territory, not this smoke test's job.
> - Update the module doc: keep the T002a history, add one line citing D003 for the restructure.
>
> No other changes to this file. Restructuring to an authenticated-session render is REJECTED: it would couple a smoke test to placeholder auth machinery that is itself temporary (real Supabase auth lands E3), guaranteeing another stale-test cycle.

> **D. Shared test infrastructure APPROVED**, exact scope:
> - New file `src/test-setup.ts`: a minimal, guarded matchMedia polyfill only (assign only if `window.matchMedia` is undefined; return a MediaQueryList stub with `matches: false`, `media: query`, no-op `addEventListener`/`removeEventListener`/`addListener`/`removeListener`/`dispatchEvent`, `onchange: null`). Nothing else in this file — it is not a general mock dumping ground.
> - `vite.config.ts` edit: add `test: { setupFiles: ['./src/test-setup.ts'] }` plus the one mechanical typing change the `test` key requires (either `/// <reference types="vitest/config" />` or switching the `defineConfig` import to `'vitest/config'` — worker's call). The `build.rollupOptions` block (T003's theme.css emission) must be byte-untouched; checker verifies `npm run build` still emits `dist/assets/theme.css` and the bundle-size gate stays green.

(For reference only — not additional scope — Ruling E is what set the Allowed/Forbidden Files and Acceptance Criteria below, and Ruling F is what governs T006's own sequencing; both are reflected in the sections below and require no separate action from you.)

## Allowed Files
- `src/theme/theme.smoke.test.tsx` — scoped edit per Ruling C only.
- `src/test-setup.ts` (new) — per Ruling D only.
- `vite.config.ts` — scoped edit per Ruling D only (`test.setupFiles` wiring + the one mechanical typing change it requires). The existing `build.rollupOptions` block must remain byte-untouched.

## Forbidden Files
- `docs/swarm/**`, `.claude/**`.
- `src/theme/volt.ts` — explicitly forbidden by D003.
- `src/App.tsx`, `src/app/**`, `src/components/**` — explicitly forbidden by D003. This task does not touch T006's deliverables (`AppShell.tsx`/`TopNav.tsx`) or App.tsx under any circumstance — D003 ruled there is no T006 rework, in files or otherwise.
- `package.json` — explicitly forbidden by D003.
- `.github/workflows/ci.yml` — explicitly forbidden by D003.
- Anything outside the three Allowed Files listed above.

## Acceptance Criteria
1. `npm run test` exits 0 (full suite, not just the one file).
2. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check` all exit 0.
3. `theme.smoke.test.tsx` renders `<App />` directly (no outer `<Theme>` wrapper), with the then-unused `Theme`/`voltTheme` imports removed.
4. `.not.toThrow()` is kept as the core render assertion.
5. The stale `expect(container.querySelector('h1')?.textContent).toBe('VOLT Team Portal')` assertion is replaced with `expect(container.textContent?.trim()).toBeTruthy()` — and only that; do not assert `'Login (placeholder)'` or any other specific copy.
6. The test file's module doc keeps its T002a history and adds one line citing D003 for the restructure.
7. `src/test-setup.ts` contains only the guarded matchMedia polyfill described in Ruling D — nothing else. "Guarded" means: only assign `window.matchMedia` if it is not already defined, so a real browser/CI environment that already has a real `matchMedia` is never clobbered. Confirm this explicitly (e.g. a quick check/comment or test note showing the guard branch).
8. `vite.config.ts` gains `test: { setupFiles: ['./src/test-setup.ts'] }` plus the one mechanical typing change the `test` key requires (your choice: `/// <reference types="vitest/config" />` or switching `defineConfig`'s import to `'vitest/config'`). Nothing else in this file changes.
9. T003's `build.rollupOptions` block in `vite.config.ts` is confirmed **byte-unchanged** (diff or checksum before/after, not eyeballed).
10. Production build artifacts unchanged: `npm run build` still emits `dist/assets/theme.css`, and the bundle-size gate (from `.github/workflows/ci.yml`'s logic) is manually re-verified still passing after this change — re-run the same check the CI workflow does, don't just assume it still passes. CI itself will also re-verify this on push, but you must confirm it locally first.

## Relevant Constitution Excerpts

> Non-Negotiables: "Existing tests must pass unless the boss explicitly approves a test update." — D003 (`docs/swarm/dispute-log.md`) is that explicit boss approval for `theme.smoke.test.tsx`, exactly per Ruling C above. No other test file or broader test-update authorization exists; do not use this approval as license to touch any other test.

> Non-Negotiables: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary." Your output below is evidence for checker-tests, not a self-certification.

> Item 10 (Database changes are additive migrations...editing an applied migration file → BLOCKER) does not literally apply here, but the same discipline applies to `vite.config.ts`'s `build.rollupOptions` block: it is T003's already-Passed deliverable and must be proven byte-unchanged, not just "probably fine."

## Most Recent Failure
None — this is attempt 1 for T006a. (Context, not a T006a failure: T006 attempt 1 failed the required CI `npm run test` gate for reasons D003 ruled were outside T006's own Allowed Files and not a worker fault — see `docs/swarm/dispute-log.md` D003 for the full history.)

## Context Note
Real GitHub Actions CI is currently red on this branch's required `npm run test` gate (same class as the two prior same-day CI-break fixes logged in `docs/swarm/state-summary.md`, and the T002a corrective-task precedent). It will re-run automatically once your fix is pushed. This should be a fast, narrowly-scoped task — three files, all with an exact prescribed shape — but verify each acceptance criterion for real rather than assuming; do not submit without having actually run `npm run test`/`typecheck`/`lint`/`build`/`format:check` yourself.

## Required Worker Output
- Files changed (exact list — must match the three Allowed Files above, or fewer): full diffs or contents.
- `npm run test` full output (exit code + pass/fail summary).
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check` output (exit codes).
- Diff or checksum proving `vite.config.ts`'s `build.rollupOptions` block is byte-unchanged before/after your edit.
- Confirmation `dist/assets/theme.css` is still emitted by the build, plus your manual re-check of the bundle-size gate logic from `.github/workflows/ci.yml` (state the numbers: current gzip size vs. budget).
- Explicit statement of how you confirmed the `matchMedia` polyfill is guarded (i.e., that it would not clobber a real `window.matchMedia` if one already existed).
- Known risks.
- Whether a dispute is needed (should not be, given the scope is fully prescribed — but flag it if you hit something D003 didn't anticipate rather than improvising around it).
