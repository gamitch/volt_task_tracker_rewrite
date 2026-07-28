# Checker Packet: T001

## Task ID
T001 (Epic E1 — Scaffold + theme)

## Objective
Verify: the worker-implementer's Vite + React 18 + TypeScript-strict SPA scaffold (with ESLint + Prettier config, zero Tailwind/shadcn) actually builds, typechecks, and lints clean — do not trust the worker's self-reported command output; re-run everything yourself.

## Acceptance Criteria
- `npm run build` succeeds (build script is `tsc --noEmit && vite build` — typecheck is baked into build).
- `npm run typecheck` (`tsc --noEmit`) succeeds with zero errors.
- Dev server starts without error (`npm run dev` — confirm it boots; Ctrl-C/kill after confirming, no need to leave it running).
- `tsconfig.json` → `compilerOptions.strict` is `true`.
- `package.json` (dependencies + devDependencies) and `package-lock.json` contain **zero** Tailwind or shadcn packages, anywhere, direct or transitive-looking.
- `npm run lint` runs clean (zero errors; warnings acceptable unless they indicate a real config problem).
- `npm run format:check` passes (Prettier config present and enforced).
  - **Note:** `package.json`'s `format`/`format:check` scripts were corrected since the original commit — now scoped to `src/**/*.{ts,tsx}` and root config files, not `.` (which would have swept in `docs/swarm/**`). This correction is intentional and correct. Verify `format:check` passes against the actual current script as written; do not flag the correction itself as a discrepancy from any earlier version you may see referenced in prior logs.
- Only files on the Allowed Files list (see below) plus the two flagged exceptions were touched — see scope note.

## Files to Inspect
- `package.json`
- `package-lock.json` (flagged addition — see scope note)
- `tsconfig.json`
- `vite.config.ts`
- `eslint.config.js`
- `.prettierrc.json`
- `src/main.tsx`
- `src/App.tsx`
- `index.html` (flagged addition — see scope note)

## Forbidden Modification Check (run first)

**Evidence method (revised per D001 ruling — read this before proceeding):**
Do **not** use `git show <commit>`, commit diffs, or any git-history-based evidence to determine what the worker touched. Git identity in this environment does not distinguish per-agent authorship — commits are frequently bundled across the orchestrating session, foreman-authored packets, and hook-generated log lines. Treat commit bundling as unreliable; it is not evidence of worker action, and it is not something to route around cleverly (e.g. by diffing against a claimed "pre-task" ref) — just don't use it.

Instead:
1. Read the worker's actual packet (`docs/swarm/active/T001-worker-packet.md`) and note its Allowed Files list.
2. Cross-reference that list against the **current file tree state** (`ls`/`find` over repo root and `src/`, plus reading file contents/timestamps where useful) to see what exists now that's in-scope vs. out-of-scope.
3. Confirm `docs/swarm/**` and `.claude/**` show no worker-attributable content changes (foreman-authored files under `docs/swarm/active/` and hook-appended lines in `docs/swarm/verification-log.md` are expected and are not worker actions — do not flag them).

Allowed Files per the original worker packet: repo-root config only (`package.json`, `tsconfig*.json`, `vite.config.ts`, `.eslintrc*`/`eslint.config.*`, `.prettierrc*`), `src/main.tsx`, `src/App.tsx`.

Confirm the current file tree's change set (relative to a clean scaffold baseline) is exactly: the Allowed Files list + `index.html` + `package-lock.json` (see Scope Note below — already resolved, do not re-litigate). Anything beyond that set is a fresh finding and should be reported as such.

If `docs/swarm/**` or `.claude/**` shows worker-attributable content (not foreman packets, not hook log lines), return immediately:
`FAIL - BLOCKER - unauthorized modification.`

## Scope Note — index.html and package-lock.json (ALREADY RESOLVED — verify only, do not re-litigate)
D001 (see `docs/swarm/dispute-log.md`) already adjudicated this question and boss-arbiter **APPROVED** both as legitimate scope exceptions:
- `index.html` — required Vite SPA entry point; the packet's own non-negotiable "must build/run" criterion is unachievable without it. Ruled as a packet-writing gap, resolved in the worker's favor.
- `package-lock.json` — mechanical npm artifact required for reproducible installs.

This checker's job here is narrow and factual, not evaluative: confirm both files **exist** and are **reasonable** —
- `index.html` is a correct, minimal Vite entry (points at `/src/main.tsx`, no extraneous script/library tags, no Tailwind/shadcn markup or CDN links).
- `package-lock.json` is a well-formed npm lockfile consistent with `package.json`'s dependency set.

Do not classify severity or re-argue whether these files should have been created — that question is closed. Report PASS/FAIL only on "do these two files exist and look correct," folded into the overall verdict as a normal acceptance-criterion check, not a standalone adjudication.

## Relevant Constitution Excerpt
**Stack locks (item 8):** Vite + React 18 + TypeScript strict + Supabase. **No Tailwind, no shadcn, no alternate UI/CSS libraries** → BLOCKER if present.

**Dependency allowlist (item 9):** Anything beyond the Vite/React/TS/ESLint/Prettier dev-tooling slice needed for T001 requires boss-architect approval recorded in the ledger. Astryx and other allowlist items are out of scope for T001.

**Authority boundaries:** Workers may implement tasks but may not redefine success. Workers may not edit `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`. A worker who believes a standard is wrong/impossible/contradictory should file a dispute, not silently modify scope.

**Non-negotiable:** The app must build successfully. No worker may mark its own work complete — this is why you (checker-tests) must independently re-run every command rather than accept the worker's pasted output.

## Most Recent Failure
Attempt 1 issued FAIL/BLOCKER for "unauthorized modification" of `docs/swarm/**`, based on a bundled orchestrator commit diff. Boss-arbiter VACATED this verdict via D001 (`docs/swarm/dispute-log.md`): the evidence method was flawed (commit contents ≠ worker authorship in this environment), the flagged files were a foreman packet and a hook-generated log line, not worker actions. Substance (build/lint/typecheck/strict/deps) was independently verified passing by boss-arbiter. This is attempt 2 — re-run everything yourself using the revised evidence method above; do not defer to attempt 1's findings.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (files read, diffs reviewed)
- commands run, with actual output pasted (not summarized) for: `npm install`, `npm run typecheck`, `npm run build`, `npm run lint`, `npm run format:check`, and dev-server boot confirmation
- exact findings for each acceptance criterion (pass/fail per bullet)
- confirmation that index.html/package-lock.json exist and are reasonable (per Scope Note — do not re-adjudicate whether they should exist, that's closed)
- required rework if failed
- follow-up tasks if passed with minor issues (e.g., "amend future scaffold packets to list index.html/package-lock.json explicitly")
