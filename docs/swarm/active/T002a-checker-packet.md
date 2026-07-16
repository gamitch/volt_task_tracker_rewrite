# Checker Packet: T002a

## Task ID
T002a

## Assigned Checker
checker-tests

## Attempt
1 (first check; T002a has no prior checker verdict)

## Objective
Verify the worker's React 18→19 upgrade (D002 corrective task). Do not trust any worker claim below — re-run every command yourself and quote literal output. This closes the gap D002 identified: T002 passed on typecheck/build/contrast alone, with no runtime render, and `@astryxdesign/core`'s `Theme.js` calls React's `use()` (React 19-only) and crashes under React 18 at first render.

## Allowed Files (for this task)
- `package.json`
- `package-lock.json`
- `src/theme/astryx-augment.d.ts` (touch only if `@types/react` 19 forces a change)
- One new runtime-smoke test file under `src/theme/**` or `src/test-setup/**`

## Forbidden Files (check first)
- `docs/swarm/**`, `.claude/**`
- `src/theme/volt.ts` — must remain byte-identical to the DES-03 block already verified in T002. Any content edit here is an automatic BLOCKER regardless of the reason (including "to satisfy Prettier" — see Known Finding below).
- Anything outside the Allowed Files list.

Compare the current file tree directly against this list (per D001 precedent: do not use git commit/diff history as evidence of what the worker touched — bundled commits are not reliable per-agent attribution in this environment). Read files on disk directly.

## Required Verification Steps

### 1. `package.json` dependency versions — inspect directly
Current on-disk values (already read by foreman, re-confirm yourself):
- `react`: `^19.2.7`, `react-dom`: `^19.2.7`
- `@types/react`: `^19.2.17`, `@types/react-dom`: `^19.2.3`
Confirm these are present and no `--legacy-peer-deps` workaround survives anywhere (check for a committed `.npmrc` with `legacy-peer-deps=true` — none exists on disk as of this packet's writing; re-confirm) and no such flag appears in any `package.json` script.

### 2. Clean reinstall, no flags
Run `npm install` with no flags (or `rm -rf node_modules && npm install` for a true clean install) and confirm it completes with exit 0 and no peer-conflict errors/warnings requiring override. Quote the tail of the install output.

### 3. `npm ls` clean check
Run `npm ls react react-dom @astryxdesign/core`. Quote full output. Must show no `ELSPROBLEMS`, no `invalid`, no `UNMET PEER DEPENDENCY` markers. `package-lock.json` already shows `node_modules/react` at `19.2.7` and `@astryxdesign/core`'s peerDependencies at `react >=19.0.0` / `react-dom >=19.0.0` (lines ~132-146, ~4884-4902) — confirm the installed tree actually satisfies this, don't just trust the lockfile.

### 4. React `use()` availability
Run `node -e "console.log(typeof require('react').use === 'function')"`. Must print `true`. Quote output.

### 5. build / typecheck / lint — run yourself, quote real output
Run `npm run build`, `npm run typecheck`, `npm run lint`. All three must exit 0. Quote exit codes and any warnings.

### 6. `format:check` — expect FAILURE, verify root cause (see Known Finding below)
Run `npm run format:check`. As of this packet, no `.prettierignore` exists at repo root and the script is `prettier --check "src/**/*.{ts,tsx}" "*.{ts,js,json,html}"`, which includes `src/theme/volt.ts`. `.prettierrc.json` does not override `bracketSpacing` (Prettier default `true`, i.e. `{ accent: ... }` with inner spaces), but `volt.ts`'s object literals (verbatim DES-03 text, e.g. `{accent: '#5B2EE5', neutralStyle: 'cool'}`) have no inner spacing. Expect `format:check` to fail solely on `volt.ts`. Confirm this is the *only* file it flags — if other files are also flagged, that's a separate, real worker defect (do not fold it into the known-issue disposition below).

### 7. Independently re-verify the "pre-existing, not introduced by T002a" claim
Worker claims (via `git stash`/`git stash pop` against T002a's pre-upgrade state) that this same `volt.ts`-vs-Prettier drift exists identically before this task's changes. Re-verify with your own method — `git stash`/`git stash pop`, or `git show <pre-T002a-commit>:src/theme/volt.ts | npx prettier --check --stdin-filepath src/theme/volt.ts`, or equivalent — and confirm independently rather than accepting the worker's stash/pop narrative. State your method and result.

### 8. Runtime smoke test — the mandatory D002 check
Read `src/theme/theme.smoke.test.tsx` directly (already reproduced below for reference; re-read on disk, don't trust this excerpt as current):
```tsx
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { Theme } from '@astryxdesign/core';
import App from '../App';
import { voltTheme } from './volt';

describe('Theme runtime smoke check', () => {
  it('renders the app root inside the Astryx Theme provider without throwing', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
      expect(() => {
        act(() => {
          root.render(
            <Theme theme={voltTheme}>
              <App />
            </Theme>,
          );
        });
      }).not.toThrow();
      expect(container.querySelector('h1')?.textContent).toBe('VOLT Team Portal');
    } finally {
      act(() => { root.unmount(); });
      container.remove();
    }
  });
});
```
Confirm this is a REAL render assertion, not tautological:
- It uses `react-dom/client` `createRoot` + `act` — an actual DOM render, not a shallow/mock render.
- It renders `<Theme theme={voltTheme}>` — the real Astryx `Theme` provider from `@astryxdesign/core` (the exact component whose `Theme.js` calls `use()` per D002's evidence), not a stub.
- The `container.querySelector('h1')?.textContent === 'VOLT Team Portal'` assertion is meaningful: `src/App.tsx` on disk literally renders `<h1>VOLT Team Portal</h1>` — confirm this yourself by reading `src/App.tsx`. This means the test would fail both on a `Theme`-provider throw AND on App not actually mounting inside it — it is not a no-op assertion.
- Confirm the `@vitest-environment jsdom` pragma is present (line 1) and that `jsdom` is an installed devDependency (`package.json` shows `"jsdom": "^29.1.1"`).
Then actually run `npx vitest run` (or `npm test`) yourself and quote the pass/fail output for this specific test file. A green typecheck does NOT substitute for this — the test must actually execute.

### 9. `astryx-augment.d.ts` — confirm unchanged
Read `src/theme/astryx-augment.d.ts` on disk. It should be identical to T002's checker-approved content:
```ts
export {};

declare module '@astryxdesign/core/theme' {
  interface TypographyRole {
    url?: string;
  }
}
```
Worker claims no edit was needed and it still compiles clean against `@types/react` 19 (already covered by step 5's typecheck pass, since this file is part of the compiled project). If it differs from the above, treat any change as needing the same scrutiny T002's `export {}` fix received — do not accept a new edit here without independent justification.

### 10. Forced peer-bumps on other allowlisted deps — confirm the "nothing to check" claim is true
`package.json` `dependencies`/`devDependencies` currently contain no `@tanstack/react-query`, `react-router-dom`, or `qrcode.react` (confirmed absent by foreman via grep). Re-confirm yourself by reading `package.json`. If true, the worker's claim that "no forced bump check applies" is factually correct (not an excuse to skip a check that had nothing to check) — note this plainly rather than penalizing it.

### 11. `tsconfig.json` strict unchanged
Confirm `strict: true` is still set and no other compiler options changed without justification.

## Known Finding — `format:check` fails on `volt.ts` (decision required, not a re-investigation)
Root cause (steps 6-7 should confirm, not re-derive from scratch): `volt.ts` is verbatim DES-03 text and is a forbidden file for this task — its content must not change. The repo's `.prettierrc.json` uses Prettier's default `bracketSpacing: true`, which conflicts with DES-03's exact object-literal formatting. This is pre-existing drift, not something T002a introduced.

Disposition:
- Editing `volt.ts`'s content to satisfy Prettier is **NOT acceptable** — verbatim DES-03 compliance outranks formatting lint (same precedence as constitution item 1: PRD requirement IDs > constitution > ledger > agent judgment; formatting is not a requirement ID).
- The correct scoped fix is excluding `volt.ts` from Prettier's purview without altering its content — either a new root `.prettierignore` containing `src/theme/volt.ts`, or narrowing the `format`/`format:check` glob in `package.json` to exclude that one path. `package.json` edits are already in-scope (Allowed Files); a new `.prettierignore` file is outside T002a's literal Allowed Files list but follows the exact same precedent as D001's approved index.html/package-lock.json scope exceptions (packet's literal file list made its own acceptance criterion — `format:check` exits 0 — unachievable without it).
- **Required rework** if: (a) `volt.ts` was edited to fix formatting, or (b) `format:check` still fails after the worker's fix, or (c) the worker did nothing about it and just reported the failure without a fix.
- **Acceptable to PASS** (on this point) if: the worker added a `.prettierignore` (or narrowed the glob in `package.json`) that scopes out only `volt.ts`, `format:check` now exits 0, `volt.ts` content is unchanged (re-diff it — see step below), and no other file is newly excluded from formatting without justification.
- If the worker used a `.prettierignore` file: note it as a scope exception in your verdict (same class as D001's), not a forbidden-file violation, since it doesn't appear on T002a's list but is the minimal fix for an otherwise-unachievable acceptance criterion.

Re-diff `volt.ts` against the DES-03 block (identical to the block quoted in the archived T002 checker packet) regardless of which fix path was taken — content must be byte-for-byte unchanged:
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

## Relevant Constitution Excerpts
- Non-Negotiables: "The app must build successfully." / "Protected source text must remain verbatim unless explicitly approved." / "Every checker must inspect the actual artifact, not just the worker's summary." / "No worker may mark its own work complete."
- Item 8 (Stack locks): React 19 is the approved, human-authorized deviation from PRD D2 (see D002). No Tailwind/shadcn/alternate UI libs.
- Item 9 (Dependency allowlist): `vitest` and other dev tooling are pre-allowlisted; no extra approval needed.
- D001 precedent (dispute-log.md): scope exceptions for mechanical/infra files (there: index.html, package-lock.json) are approvable when the packet's literal Allowed Files list makes its own acceptance criteria unachievable; not a forbidden-file violation when the worker discloses the deviation rather than hiding it. Applies here to a `.prettierignore` addition if the worker chose that path.

## Most Recent Failure
None. First checker attempt for T002a.

## Required Checker Output
- PASS or FAIL (cannot PASS while build/typecheck/lint/`npm ls`/the `use()` check/the vitest smoke test fail; `format:check` disposition follows the Known Finding rules above, not a blanket "all scripts must exit 0")
- severity: BLOCKER / MAJOR / MINOR / NIT per finding
- exact commands run and literal output for: clean install, `npm ls react react-dom @astryxdesign/core`, the `node -e` `use()` check, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npx vitest run` (smoke test specifically)
- your independent verdict on whether the smoke test is a real render assertion (step 8) — method and result
- your independent verdict on the "pre-existing drift" claim (step 7) — method and result
- `volt.ts` re-diff result (must be byte-identical regardless of which prettier fix path was taken)
- `astryx-augment.d.ts` diff-or-unchanged confirmation
- forbidden-file/scope check result, including explicit disposition on any `.prettierignore` addition
- whether a dispute is warranted (should not be if the worker's account holds up under independent checks)
- required rework, if any, stated explicitly (especially: rework required if `volt.ts` content was touched, or if `format:check` still fails with no fix attempted)
