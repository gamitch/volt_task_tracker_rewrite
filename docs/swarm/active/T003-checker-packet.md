# Checker Packet: T003

## Task ID
T003 — CSS cascade layers + `theme.css` build pattern

## Checker Agent
checker-tests

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
Declare explicit `@layer reset, astryx-base, app` (NFR-08) and wire the Astryx `/built` theme import + prebuilt `theme.css` build pattern (DES-07), with zero runtime style injection.

## Allowed Files (only these should differ from the pre-T003 tree)
- `src/theme/theme.css`
- `src/main.tsx` (import statement only)
- `vite.config.ts` (only if genuinely required)

## Forbidden Files (BLOCKER if touched)
- `docs/swarm/**`, `.claude/**`
- `src/theme/volt.ts` (must remain byte-identical to DES-03 — already verified verbatim in T002/T002a, this task must not touch it)
- `src/theme/astryx-augment.d.ts`
- `src/App.tsx`
- anything outside the three Allowed Files above

**Standing rule (D001, do not re-litigate):** never use git commit history/diffs as evidence of which agent touched a file — git identity here mixes orchestrator/worker/hook commits and does not reliably distinguish authorship. Instead, compare the task's Allowed Files list directly against the current file tree state (what changed vs. what T002a left behind) to check for forbidden-file violations.

## Ground-Truth Requirement Text (verbatim, outranks any paraphrase)
- **NFR-08** (PRD Section 11): "CSS cascade layers declared explicitly per Astryx migration docs (`@layer reset, astryx-base, app`); no unlayered global CSS."
- **DES-07** (PRD 5.2): "Use the `/built` theme import + `theme.css` pattern for production (pre-built CSS, no runtime injection)."
- **DES-21** (PRD 5.2, cited for context only, not directly graded here): styling escalation order component → theme token → xstyle → custom CSS; ejecting component source needs boss approval.
- Constitution item 1 (precedence): PRD requirement IDs outrank constitution/ledger/packet paraphrase — if this packet conflicts with actual PRD text, follow the PRD.
- Constitution item 8 (stack lock, BLOCKER class): Vite + React 19 + TS strict + Supabase, no Tailwind/shadcn/alternate CSS libs.
- Constitution item 10: DB migrations only — not applicable to this task, included only so you don't misapply it.
- Constitution item 11: UI built from Astryx components; DES-21 escalation order.
- Definition of Done: worker self-report is never sufficient; you must inspect the actual artifact.

## Worker's Claims — Verify Independently, Do Not Trust
1. `src/theme/theme.css` line 36 declares `@layer reset, astryx-base, app;` as the very first statement, matching NFR-08's exact order.
2. Imports `@astryxdesign/core/reset.css` and `@astryxdesign/core/astryx.css`, both already self-wrapped in their own `@layer` blocks by the package (not something this task needed to wrap) — so no unlayered global CSS enters via those imports.
3. The generated theme-token/component-override block (originally emitted by Astryx's CLI into its own default `astryx-theme` layer) was hand-copied and placed under `@layer app` instead — worker's stated reasoning: NFR-08 defines only a 3-layer scheme (`reset, astryx-base, app`), with no separate `astryx-theme` layer, so renaming to `app` is the literal-PRD-text-compliant choice, not an invented one. `src/theme/volt.ts` itself was never touched (still byte-identical to DES-03, per T002/T002a's confirmed baseline).
4. `vite.config.ts`'s `assetFileNames` routes the app's single CSS build output to a stable `assets/theme.css` filename (avoiding a content-hashed name), justified because this app has exactly one CSS entry point (`theme.css`, imported by `main.tsx`).
5. `src/main.tsx` changed by exactly two lines versus the T002a baseline: a `/// <reference types="vite/client" />` triple-slash directive and the `import './theme/theme.css';` line — no other restructuring.
6. `npm run build` produces a real static `dist/assets/theme.css` file, referenced via a `<link rel="stylesheet">` tag in `dist/index.html` — not runtime style injection (no `<style>` tag, no JS-injected CSS-in-JS for this layer).

## Known Context / Non-Issues (do not re-flag as new findings)
- `npm run format:check`'s prettier globs (`"src/**/*.{ts,tsx}"`, `"!src/theme/volt.ts"`, `"*.{ts,js,json,html}"`) do not include `.css` files at all — `theme.css` is not run through Prettier by that script. This is expected (the file is explicitly documented in its own header as a generated/hand-copied build artifact, not hand-authored source) and is not a T003 regression. Do not fail the task on this basis alone; note it only if you find it material to something else.
- T002/T002a already established `src/theme/volt.ts` is byte-identical to DES-03 as of the last passed check — your job here is to confirm T003 did not disturb that, not to re-derive DES-03 conformance from scratch.

## Required Verification Steps
1. Independently run `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`. Quote real output (exit codes + relevant lines), not paraphrase.
2. Grep `src/theme/theme.css` for `@layer` declarations. Confirm the top-level order statement is exactly `@layer reset, astryx-base, app;` and that every rule in the file sits inside one of those three layers — flag any unlayered global CSS as a BLOCKER per NFR-08's explicit "no unlayered global CSS" text.
3. Read `node_modules/@astryxdesign/core/src/reset.css` and `node_modules/@astryxdesign/core/dist/astryx.css` (resolve via the package's `exports` map in `node_modules/@astryxdesign/core/package.json` — `./reset.css` → `src/reset.css`, `./astryx.css` → `dist/astryx.css`) to confirm they are genuinely pre-wrapped in `@layer reset { ... }` and `@layer astryx-base { ... }` respectively, not something the worker needed to wrap themselves.
4. Confirm `src/theme/volt.ts` is untouched: compare its current content against the DES-03 spec block in `docs/swarm/VOLT_Portal_PRD.md` (~line 156 onward) directly, the same method T002/T002a used — do not rely on git history for this (see D001 standing rule above; content comparison against the PRD ground truth is the correct method, not commit provenance).
5. Confirm `src/main.tsx`'s change versus its T002a-passed baseline is exactly the two claimed lines (vite/client reference + theme.css import), nothing else added, removed, or restructured.
6. Run the build, inspect `dist/index.html` for a real `<link rel="stylesheet" href=".../assets/theme.css">` tag (not a `<style>` tag, not JS-injected CSS). Confirm `dist/assets/theme.css` exists on disk and its content starts with the `@layer reset, astryx-base, app;` declaration.
7. Confirm no forbidden-file violations: compare the Allowed Files list above against the current file tree state directly (never git-commit-bundling — D001 standing rule). Specifically confirm `src/theme/astryx-augment.d.ts`, `src/App.tsx`, `docs/swarm/**`, and `.claude/**` show no changes attributable to this task's scope.

## Most Recent Failure
None — this is T003's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized)
- pass/fail per verification step above
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT per constitution's Failure Severity table)
- recommended next action

Do not mark this task complete based on the worker's report. Inspect the actual files and command output yourself.
