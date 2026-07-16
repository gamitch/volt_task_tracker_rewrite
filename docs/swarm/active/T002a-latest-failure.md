# T002a — Most Recent Failure (attempt 1)

## Verdict
FAIL / MAJOR (checker-tests, attempt 1 of 3). Everything about the React 19 upgrade itself is sound and independently re-verified — this is a single, narrow, scoped gap.

## What passed (do not re-do any of this)
- Clean `npm install` with no `--legacy-peer-deps`; regenerated `package-lock.json` committed.
- `npm ls react react-dom @astryxdesign/core` clean — no ELSPROBLEMS/invalid markers.
- `node -e "console.log(typeof require('react').use === 'function')"` → `true`.
- `npm run build`, `npm run typecheck`, `npm run lint` all exit 0.
- Mandatory runtime smoke test (vitest + jsdom, real `createRoot`/`act` render of `<Theme><App/></Theme>`, asserts `h1` text `VOLT Team Portal`) executes and passes — this is a real render assertion, not tautological (checker confirmed by reading `App.tsx` and the test file directly).
- `astryx-augment.d.ts` unchanged, still compiles clean against `@types/react` 19.
- No forced peer-bumps on other allowlisted deps (none present to bump).
- `tsconfig.json` `strict: true` unchanged.

## The one failure
`npm run format:check` exits 1, flagging exactly one file: `src/theme/volt.ts`.

### Root cause (checker-confirmed, not a hypothesis)
`volt.ts` is the byte-for-byte verbatim DES-03 block (already checker-verified in T002). Its object literals use no inner bracket spacing (e.g. `{accent: '#5B2EE5', neutralStyle: 'cool'}`), while this repo's `.prettierrc.json` does not override Prettier's default `bracketSpacing: true`. The two have never agreed. Checker independently ran `git show` against the pre-T002a commit and reproduced the identical `format:check` failure on `volt.ts` there — this predates T002a entirely and traces back to T002. **T002a did not introduce this; it only inherited it.**

Current `package.json` scripts (unchanged since T001/T002):
```
"format": "prettier --write \"src/**/*.{ts,tsx}\" \"*.{ts,js,json,html}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx}\" \"*.{ts,js,json,html}\"",
```

## Hard constraint (carried forward, non-negotiable)
Do **NOT** edit `volt.ts` content to satisfy Prettier under any circumstance. Verbatim DES-03 compliance outranks formatting lint (constitution item 1: PRD requirement IDs outrank everything else; formatting is not a requirement ID). Any edit to `volt.ts`'s content is an automatic BLOCKER on re-check, full stop.

## Fix options (checker-approved disposition)

**Option B — PREFERRED.** Narrow the `format` / `format:check` glob strings in `package.json` to exclude `src/theme/volt.ts`, e.g. using a glob negation pattern such as:
```
"format": "prettier --write \"src/**/*.{ts,tsx}\" \"!src/theme/volt.ts\" \"*.{ts,js,json,html}\"",
"format:check": "prettier --check \"src/**/*.{ts,tsx}\" \"!src/theme/volt.ts\" \"*.{ts,js,json,html}\"",
```
`package.json` is **already in T002a's Allowed Files** — no scope exception is needed for this option. **Verify prettier's actual negation-glob syntax works before committing to it — test it directly, don't assume the pattern above is correct as-is.** Prettier's CLI glob negation behavior can be finicky depending on version/shell-quoting; confirm `format:check` actually exits 0 with `volt.ts` excluded and every other previously-covered file still checked (no silent over-exclusion).

**Option A — fallback only.** If option B does not cleanly work for a genuine prettier-glob-syntax reason (document why), create a `.prettierignore` at repo root containing:
```
src/theme/volt.ts
```
This needs a scope exception since `.prettierignore` is not on T002a's literal Allowed Files list, but it follows the exact same precedent as D001's approved index.html/package-lock.json scope exceptions (packet's literal file list makes its own acceptance criterion — `format:check` exits 0 — otherwise unachievable). Disclose the exception explicitly in worker output; do not silently add the file.

## Re-verification command
```
npm run format:check
```
Must exit 0. Checker will also confirm:
- No other file is newly excluded from formatting without justification (i.e., the exclusion is scoped to exactly `src/theme/volt.ts`).
- `volt.ts` content is still byte-for-byte identical to the DES-03 block (re-diff, not just "unchanged since I didn't touch it").
- All previously-passing checks (build/typecheck/lint/npm ls/`use()` check/smoke test) still pass — do not regress anything while fixing this.
