# Checker Packet: T002a

## Task ID
T002a

## Assigned Checker
checker-tests

## Attempt
2 (re-check after rework; attempt 1 FAILed/MAJOR on a single narrow gap — see Most Recent Failure below)

## Objective
Re-verify the worker's rework of the React 18→19 upgrade (D002 corrective task). Attempt 1 already fully verified the upgrade itself (install, `npm ls`, `use()`, build/typecheck/lint, mandatory runtime smoke test) — do not re-derive that from scratch, but DO re-confirm none of it regressed while the worker touched `package.json` again for this rework. Do not trust any worker claim below — re-run every command yourself and quote literal output. This is a full re-check, not a diff-only spot check.

## Allowed Files (for this task)
- `package.json`
- `package-lock.json`
- `src/theme/astryx-augment.d.ts` (touch only if `@types/react` 19 forces a change)
- One new runtime-smoke test file under `src/theme/**` or `src/test-setup/**`

## Forbidden Files (check first)
- `docs/swarm/**`, `.claude/**`
- `src/theme/volt.ts` — must remain byte-identical to the DES-03 block already verified in T002. Any content edit here is an automatic BLOCKER regardless of the reason (including "to satisfy Prettier").
- Anything outside the Allowed Files list.

Compare the current file tree directly against this list (per D001 precedent: do not use git commit/diff history as evidence of what the worker touched — bundled commits are not reliable per-agent attribution in this environment). Read files on disk directly.

## What Attempt 1 Already Established (do not re-litigate; only re-confirm no regression)
- `react`/`react-dom` at `^19.2.7`, `@types/react`/`@types/react-dom` bumped to 19, no `--legacy-peer-deps` anywhere.
- `npm ls react react-dom @astryxdesign/core` clean.
- `node -e "console.log(typeof require('react').use === 'function')"` → `true`.
- `npm run build` / `npm run typecheck` / `npm run lint` all exit 0.
- Mandatory runtime smoke test (`src/theme/theme.smoke.test.tsx`: vitest + jsdom, real `createRoot`/`act` render of `<Theme><App/></Theme>`, asserts `h1` text `VOLT Team Portal`) is a real render assertion and passes.
- `astryx-augment.d.ts` unchanged and compiles clean.
- No forced peer-bumps on other allowlisted deps (none present to bump).
- `tsconfig.json` `strict: true` unchanged.

These are folded into Required Verification Steps 5-7 below as "re-confirm," not "re-derive."

## Attempt 2 — What Changed
Worker's rework: narrowed `format`/`format:check` scripts in `package.json` with a Prettier glob negation (`"!src/theme/volt.ts"`) rather than adding a new `.prettierignore` file, since `package.json` was already an Allowed File (no scope exception needed for this path — narrower than Option A from the attempt-1 failure notice). Worker claims: `npm run format:check` exits 0; `volt.ts` byte-identical (git diff empty); typecheck/lint/build/vitest unaffected; `npm ls` clean; `react.use()` still a function; worker also claims to have proactively validated the negation isn't silently over-broad by temporarily injecting a formatting violation into `astryx-augment.d.ts`, confirming `format:check` still caught it, then fully reverting (git diff on that file also empty).

None of this is to be accepted on the worker's word. Verify independently per the steps below.

## Required Verification Steps

### 1. `format:check` — independently re-run, quote real output
Run `npm run format:check` yourself. Confirm exit code 0. Quote the literal command and output (or the tail of it if long). If it does not exit 0, this is an immediate FAIL — stop and report exactly what still fails.

### 2. `package.json` diff — confirm the fix is scoped to exactly what's claimed
Read the current `package.json` `format` and `format:check` script strings directly. Confirm:
- The only change from the attempt-1 state is a glob negation (e.g. `"!src/theme/volt.ts"`) added to those two script strings.
- No other script, dependency version, or field in `package.json` changed since attempt 1's approved state (react/react-dom/@types versions must be identical to what attempt 1 verified).
- If you have a way to diff against the attempt-1 `package.json` content (the version quoted/implied in the attempt-1 failure notice at `docs/swarm/active/T002a-latest-failure.md`), use it; otherwise reason from the on-disk content plus the attempt-1 record.

### 3. `volt.ts` byte-identical — verify against the DES-03 spec directly, not just "git diff was empty"
Read `src/theme/volt.ts` on disk right now and diff its actual current content against the DES-03 block reproduced below (identical to the block already verified in T002 and in attempt 1's packet). Do not accept "git diff was empty" as sufficient — confirm the file's current content, character for character, matches:
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

### 4. Independently verify the glob negation actually scopes correctly (not silently over-broad)
Do your own version of the worker's claimed validation — do not trust that the worker's already-reverted test proves anything, since you cannot inspect a reverted state after the fact. Options (pick one, or more than one if the first is inconclusive):
- Temporarily inject a formatting violation into a *different* file than the worker used (e.g. a file under `src/` other than `volt.ts` and `astryx-augment.d.ts`, to avoid any doubt about which file the worker already touched), run `format:check`, confirm it fails and correctly flags that file, then fully revert and re-confirm `git diff`/content is clean and `format:check` passes again.
- Alternatively (or additionally), reason directly from the glob syntax itself: read the exact script string and confirm the negation pattern is syntactically a Prettier ignore-glob that only matches `src/theme/volt.ts` and nothing else (e.g. it isn't an overly broad pattern like `!src/theme/*` that would also exclude `astryx-augment.d.ts` or a future file in that directory). State explicitly what the pattern excludes and confirm it is exactly one file.
- Confirm `astryx-augment.d.ts` and any other previously-formatted file are still actually being checked by `format:check` (not silently excluded) — e.g. run `npx prettier --check src/theme/astryx-augment.d.ts` directly and confirm it's covered/clean, or point to the script's glob still matching it.

State your method and result explicitly — this cannot be a rubber stamp of the worker's already-reverted test.

### 5. Re-confirm no regression: typecheck/lint/build/vitest
Run `npm run build`, `npm run typecheck`, `npm run lint`, and `npx vitest run` (or `npm test`) yourself. All must exit 0. Quote exit codes and any warnings. Specifically confirm `src/theme/theme.smoke.test.tsx` (or wherever the runtime smoke test lives) still passes — this is the mandatory D002 check and must not silently regress while the worker edited `package.json` again.

### 6. Re-confirm `npm ls` clean and `react.use()` still a function
Run `npm ls react react-dom @astryxdesign/core` — quote full output, confirm no `ELSPROBLEMS`/`invalid`/`UNMET PEER DEPENDENCY`. Run `node -e "console.log(typeof require('react').use === 'function')"` — must print `true`. These should be unchanged from attempt 1 since the rework didn't touch dependency versions, but re-verify rather than assume, since this is a full re-check.

### 7. `astryx-augment.d.ts` — confirm unchanged from T002's approved content
Read `src/theme/astryx-augment.d.ts` on disk. It must be identical to T002's checker-approved content (the worker claims it used this file transiently to test the glob negation and fully reverted it):
```ts
export {};

declare module '@astryxdesign/core/theme' {
  interface TypographyRole {
    url?: string;
  }
}
```
If it differs in any way from this, that is a BLOCKER — the worker's claimed revert failed, regardless of intent.

## Relevant Constitution Excerpts
- Non-Negotiables: "The app must build successfully." / "Protected source text must remain verbatim unless explicitly approved." / "Every checker must inspect the actual artifact, not just the worker's summary." / "No worker may mark its own work complete."
- Item 8 (Stack locks): React 19 is the approved, human-authorized deviation from PRD D2 (see D002). No Tailwind/shadcn/alternate UI libs.
- Item 9 (Dependency allowlist): `vitest` and other dev tooling are pre-allowlisted; no extra approval needed.
- D001 precedent (dispute-log.md): scope exceptions for mechanical/infra files are approvable when a packet's literal Allowed Files list makes its own acceptance criteria unachievable; not a forbidden-file violation when disclosed. Not directly needed this attempt since the worker's fix path (glob negation inside `package.json`) required no scope exception — `package.json` was already fully allowed.

## Most Recent Failure (attempt 1 — condensed; full detail in `docs/swarm/active/T002a-latest-failure.md`)
FAIL/MAJOR. Everything about the React 19 upgrade itself was sound and independently verified (install, `npm ls`, `use()`, build/typecheck/lint, mandatory runtime smoke test, `astryx-augment.d.ts` unchanged, no forced peer-bumps, `strict:true` unchanged). Sole gap: `npm run format:check` exited 1, flagging only `src/theme/volt.ts` — pre-existing Prettier `bracketSpacing` drift against the verbatim DES-03 block, confirmed by checker via `git show` to predate T002a (traces to T002, not introduced by this task). Checker-approved fix: narrow the `format`/`format:check` glob in `package.json` (already an Allowed File) to exclude `src/theme/volt.ts`, or fall back to a `.prettierignore` scope exception if the glob approach didn't work cleanly. Hard constraint carried forward: `volt.ts` content must never be edited to satisfy Prettier.

## Required Checker Output
- PASS or FAIL (cannot PASS while format:check/build/typecheck/lint/`npm ls`/the `use()` check/the vitest smoke test fail, or if `volt.ts` content deviates even slightly, or if the glob negation is shown to be over-broad)
- severity: BLOCKER / MAJOR / MINOR / NIT per finding
- exact commands run and literal output for: `npm run format:check`, `npm run build`, `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm ls react react-dom @astryxdesign/core`, the `node -e` `use()` check
- `package.json` script-diff confirmation (step 2) — exact statement of what changed vs. attempt 1
- `volt.ts` byte-identical confirmation (step 3) — method and result, not just "git diff empty"
- independent glob-scoping verification (step 4) — method and result; must not merely cite the worker's already-reverted test
- `astryx-augment.d.ts` unchanged confirmation (step 7)
- forbidden-file/scope check result
- whether a dispute is warranted (should not be if the worker's account holds up under independent checks)
- required rework, if any, stated explicitly — if this attempt fails, this will be attempt 2's FAIL, with one attempt remaining before mandatory escalation to boss-arbiter (loop limit = 3)
