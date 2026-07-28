# Checker Packet: T002 (attempt 2 re-check)

## Task ID
T002

## Assigned Checker
checker-accessibility

## Attempt
2 (previous attempt 1 result: FAIL — build blocked by upstream type gap, not worker fault; see Most Recent Failure below)

## Objective
Re-verify the worker's attempt-2 rework: worker added `src/theme/astryx-augment.d.ts` (a TS module-augmentation file adding `url?: string` to `TypographyRole` on `@astryxdesign/core/theme`) to fix the TS2353 build failure from attempt 1, left `src/theme/volt.ts` untouched. Confirm the fix is real, correctly scoped, and has no side effects on the rest of the module's exports.

## Allowed Files (for this task, current)
`package.json`, `package-lock.json`, `src/theme/volt.ts`, `src/theme/astryx-augment.d.ts`

## Required Verification Steps

### 1. Build/typecheck — run yourself, quote real output
Run `npx tsc --noEmit -p tsconfig.json` and `npm run build`. Quote literal output. Both must exit 0 for this task to have any chance at PASS.

### 2. Inspect `src/theme/astryx-augment.d.ts` directly
Read the file on disk (do not trust the worker's description of it). Confirm:
- It adds only `url?: string` to `TypographyRole` — no other fields, no other interfaces touched, no unrelated `declare`/`export` statements.
- Current on-disk content is:
```ts
export {};

declare module '@astryxdesign/core/theme' {
  interface TypographyRole {
    url?: string;
  }
}
```
Flag any deviation from this.

### 3. Independently verify the `export {}` reasoning (the key new claim this attempt)
Worker's claim: without a top-level `export {}` (or other import/export statement), TypeScript treats a file containing only `declare module 'x' { ... }` as a **script**, and `declare module` in script context is an **ambient module declaration** — i.e. a full replacement of that module's shape, discarding its real exports (`defineTheme`, `Theme`, etc.) wherever else it's imported in the project. Adding `export {}` makes the file a **module**, so the same `declare module` syntax becomes an **augmentation** that merges into the existing module's declared shape instead of replacing it.

This is TypeScript's real, documented behavior (declaration merging depends on ambient-module vs augmentation context, which hinges on whether the containing file is a script or a module) — it is plausible and worth confirming empirically, not just accepting as asserted.

Verify it two ways:
- (a) Structural read: confirm `export {}` is present before the `declare module` block (see step 2).
- (b) Empirical/functional check: confirm that real exports of `@astryxdesign/core/theme` — specifically `defineTheme` (used in `volt.ts`) — still resolve and typecheck correctly *everywhere else in the project*, not just that `volt.ts` compiles. Since `volt.ts` is the only current importer, this may mean: (i) checking `tsc --noEmit` output shows no errors anywhere touching `@astryxdesign/core/theme` imports (already covered by step 1 if it's clean), and (ii) as a stronger independent check, use `grep`/read `node_modules/@astryxdesign/core/dist/theme/index.d.ts` (or wherever the real `.d.ts` lives per the module's `exports` map) to confirm what it declares (`defineTheme`, `Theme`, etc.), then reason concretely about whether `augment.d.ts`'s `declare module` (with `export {}` present) would merge with vs. replace that declaration file's ambient shape. If you have a fast way to test this directly — e.g. temporarily grepping tsc's own error list for whether `defineTheme` is still a known export, or writing a throwaway one-line probe file under `src/` that imports `defineTheme` from `@astryxdesign/core/theme` and runs `tsc --noEmit` again — do so, then delete the probe file before finishing (do not leave any extra file behind; this task's Allowed Files list does not include a probe file). State your method and result plainly. If you determine the worker's technical claim is wrong (e.g. `export {}` isn't actually necessary, or doesn't do what's claimed), say so explicitly — do not just take assertions from the worker's rationale at face value.

### 4. `src/theme/volt.ts` — re-diff directly, don't assume unchanged
It should be byte-for-byte identical to the DES-03 block already verified in attempt 1 (see PRD text below). Re-read the file and re-diff it yourself rather than relying on "already verified" — quick confirmation is fine if it matches, but it must be a real read, not an assumption.
```tsx
import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

export const voltTheme = defineTheme({
  name: 'volt',
  extends: neutralTheme,
  color: {accent: '#5B2EE5', neutralStyle: 'cool'},
  typography: {
    heading: {
      family: 'Space Grotesk',
      url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap',
      fallbacks: 'system-ui, sans-serif',
    },
    body: {
      family: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
      fallbacks: '-apple-system, sans-serif',
    },
  },
  radius: {base: 6, multiplier: 1},
  tokens: {
    // [light, dark]
    '--color-accent': ['#5B2EE5', '#9B7BFF'],
  },
});
```

### 5. Forbidden-file / scope check (standing D001 rule)
Per dispute D001 (`docs/swarm/dispute-log.md`): do not use git history/commit diffs as evidence of what the worker touched. Directly compare the current file tree against T002's current Allowed Files list: `package.json`, `package-lock.json`, `src/theme/volt.ts`, `src/theme/astryx-augment.d.ts`. Flag anything outside that set. `docs/swarm/**` and `.claude/**` must be untouched by the worker.

### 6. Spot-check only — do not fully redo
Attempt 1 already independently verified and PASSed: WCAG AA contrast for accent-on-surface both modes (7.08:1 light, 4.81:1 dark — both clear AA), and `npm run astryx -- component --list` / astryx script correctness, on an unchanged `volt.ts`/`package.json` (aside from whatever `npm install` touched in `package.json`/`package-lock.json` for this attempt, if anything — confirm nothing besides lockfile/version bookkeeping changed there). You do not need to recompute contrast ratios again. Do spot-check that `package.json`'s `astryx` script line is still exactly:
```json
"astryx": "node node_modules/@astryxdesign/cli/bin/astryx.mjs"
```

## Relevant Constitution Excerpts
- Non-Negotiables: "The app must build successfully." / "Every checker must inspect the actual artifact, not just the worker's summary." / "No worker may mark its own work complete."
- Item 1 (Authority): PRD requirement IDs > constitution > ledger text > agent judgment.
- Item 3: PRD-specified code blocks (like DES-03) must be verbatim, never re-derived or paraphrased — applies to `volt.ts`.
- Item 8/9: Stack locks — React 18, no Tailwind/shadcn; `@astryxdesign/*` pre-approved on the dependency allowlist.

## Most Recent Failure (attempt 1)
FAIL — not worker fault. `volt.ts` verbatim vs DES-03, astryx script/CLI correct, contrast independently recomputed and passing both modes, no forbidden-file violations. But `npx tsc --noEmit -p tsconfig.json` / `npm run build` failed: TS2353 `'url' does not exist in type 'TypographyRole'` at volt.ts:11,16 — confirmed upstream `@astryxdesign/core@0.1.6` defect (package's own JSDoc promises `url` inheritance on `TypographyConfig.heading`, but the `TypographyRole` interface never declares it). Required rework: add `src/theme/astryx-augment.d.ts` type augmentation, do not touch `volt.ts`. Full detail: `docs/swarm/archive/T002-latest-failure.md`.

## Required Checker Output
- PASS or FAIL (cannot PASS while build/typecheck fails)
- severity: BLOCKER / MAJOR / MINOR / NIT, applied to whichever finding actually warrants it
- exact commands run and literal output (tsc + build)
- `astryx-augment.d.ts` content confirmation (step 2) and your independent verdict on the `export {}` / ambient-vs-augmentation claim (step 3), including method used and result
- volt.ts re-diff result (one-line confirmation if clean, side-by-side if not)
- forbidden-file/scope check result
- package.json astryx-script spot-check result
- whether a dispute is warranted (should not be if the worker's account holds up under independent checks)

---
Archived 2026-07-16 after T002 Passed checker-accessibility (attempt 2, PASS on merits — empirical negative-control test on the `export{}` claim confirmed real, all other steps confirmed clean). See `docs/swarm/verification-log.md` for the PASS entry and `docs/swarm/task-ledger.md` for the closed-out ledger row.
