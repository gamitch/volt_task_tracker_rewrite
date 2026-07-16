# Worker Packet: T002a

## Task ID
T002a

## Objective
Upgrade the stack from React 18 to React 19 (D002 stack-lock reversal, constitution item 8) so `@astryxdesign/core` runs correctly — the shipped `Theme.js` calls React's `use()` hook, which does not exist in React 18 and throws a TypeError at first render. T002 passed on typecheck/build/contrast alone with no runtime render, so this crash was never exercised. This task closes that gap: dependency upgrade + a mandatory runtime smoke check. It is a corrective, forward-fix task — T002 is not being reopened or redone.

## Allowed Files
- `package.json` — this includes the `format` and `format:check` script strings specifically, not just the `react`/`react-dom`/`@types/react*` version fields. See Most Recent Failure below: you are explicitly authorized to edit these two script strings to exclude `src/theme/volt.ts` from Prettier's purview. This is not a new scope grant; `package.json` was already fully in-scope, this note just confirms the specific edit is covered.
- `package-lock.json`
- `src/theme/astryx-augment.d.ts` — touch ONLY if the `@types/react` 19 compiler forces a change (e.g. a genuine type error). Do not edit it speculatively or "for cleanliness."
- One new minimal runtime-smoke test file, your choice of exact name, but it must live under `src/theme/` (e.g. `src/theme/theme.smoke.test.tsx`) or under a new `src/test-setup/**` directory if a shared vitest/jsdom setup file is genuinely required. Do not scatter test files elsewhere.

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- `src/theme/volt.ts` — already verbatim-correct per D001/D002. This task is purely a dependency + infra upgrade; it must not touch theme content.
- Anything outside the Allowed Files list above.

## Acceptance Criteria
- `react` and `react-dom` bumped to `^19` in `package.json`; `@types/react` and `@types/react-dom` bumped to `19`.
- Clean reinstall performed WITHOUT `--legacy-peer-deps` (T002's original install used this flag to route around the peer conflict — that workaround must not survive this task). Regenerated `package-lock.json` committed.
- `npm ls react react-dom @astryxdesign/core` is clean — no `ELSPROBLEMS` or `invalid` markers in the output.
- A `node -e` check confirms `typeof require('react').use === 'function'`.
- `npm run build`, `npm run typecheck`, `npm run lint`, and the format-check script all exit 0.
- `tsconfig.json` `strict: true` is unchanged.
- **MANDATORY runtime smoke check** — this is the specific failure mode a typecheck-only pass missed on T002: render the app root together with the Astryx `Theme` provider (vitest + jsdom, or an equivalent minimal runtime render) and assert it does not throw. A green typecheck alone does NOT close this task; do not submit without this test actually executing and passing.
- `src/theme/astryx-augment.d.ts` re-verified to still compile cleanly against `@types/react` 19. Only edit it if the compiler forces you to; if no change is needed, say so explicitly in your output rather than silently leaving it untouched without comment.
- If installing React 19 forces a version bump on any other allowlisted runtime dependency already in `package.json` (`@tanstack/react-query`, `react-router-dom`, `qrcode.react` if present), report that explicitly in your output — do not silently accept it as a side effect.

## Relevant Constitution Excerpt
Item 8 (Stack locks): "Vite + React 19 + TypeScript strict + Supabase. No Tailwind, no shadcn, no alternate UI/CSS libraries (PRD D2/D3) → BLOCKER. React 19 is an approved, human-authorized deviation from PRD D2's 'React 18' — see dispute-log D002 for the ruling and evidence (`@astryxdesign/core` requires React 19 at runtime, not just in peer metadata). The PRD text itself is intentionally unedited; D002 is the record of the deviation."

Item 9 (Dependency allowlist): dev tooling including `vitest` is already allowlisted — no additional approval is needed to add it if not already installed. Check `package.json` first; it may already be present from T001/T002 scaffolding.

Definition of Done: no worker may mark its own work complete; every checker must inspect the actual artifact, not just your summary. Your output below is evidence for the checker, not a self-certification.

## Most Recent Failure
Attempt 1: FAIL/MAJOR (checker-tests) — the React 19 upgrade itself is fully sound (install, `npm ls`, `use()` check, build/typecheck/lint, and the mandatory runtime smoke test all passed and were independently re-verified). The sole gap is `npm run format:check` exiting 1 on `src/theme/volt.ts`, a pre-existing Prettier `bracketSpacing` drift against the verbatim DES-03 block that predates T002a (traces to T002, confirmed via git-show). Full detail, root cause, both fix options (B preferred: narrow the `format`/`format:check` glob strings in `package.json`; A fallback: `.prettierignore` scope exception), and the exact re-verification command are in `docs/swarm/active/T002a-latest-failure.md` — read it before starting attempt 2.

Hard constraint: do NOT edit `src/theme/volt.ts` content under any circumstance to fix this. That remains forbidden per this packet's Forbidden Files list.

## Required Worker Output
- files changed (exact list, cross-checked against Allowed Files)
- summary of changes (package.json diff, package-lock.json regeneration note)
- exact commands run and their output/exit codes, specifically: `npm ls react react-dom @astryxdesign/core`, the `node -e` React `.use` check, `npm run build`, `npm run typecheck`, `npm run lint`, format-check, and the vitest smoke-test run
- confirmation that no `--legacy-peer-deps` flag was used on the reinstall
- whether `astryx-augment.d.ts` needed any change, and if so, exactly what and why
- any forced peer-version bumps on other allowlisted deps
- known risks
- whether a dispute is needed
