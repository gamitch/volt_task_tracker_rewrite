# Worker Packet: T001

## Task ID
T001 (Epic E1 — Scaffold + theme)

## Repo Context
This repo is brand new and empty at the application level. `docs/swarm/`, `.claude/`, `.git/`, `.gitignore` already exist, but there is **no `package.json`, no `src/`, no Vite config, no lint/format config yet**. You are creating the app scaffold from scratch at the repo root. This is attempt 1 of the entire build — nothing to build on top of.

## Objective
Initialize the Vite + React 18 + TypeScript-strict SPA (per PRD D2). Add ESLint + Prettier config. Do not add Tailwind, shadcn, or any other UI/CSS library — none may be present anywhere in the resulting `package.json` or config.

## Allowed Files
- Repo root config only: `package.json`, `tsconfig*.json`, `vite.config.ts`, `.eslintrc*` (or flat `eslint.config.*`), `.prettierrc*`
- `src/main.tsx`
- `src/App.tsx`

Do not create any other `src/` files, pages, components, or routes in this task — those belong to later tasks (T002+).

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- Any file outside the Allowed Files list above (including any file not named in that list, even if it seems like normal scaffold boilerplate)

## Acceptance Criteria
- Project builds and runs (`npm run build` succeeds; dev server starts without error).
- `tsconfig.json` has `"strict": true`.
- `package.json` contains **zero** Tailwind or shadcn dependencies (dev or prod), and only dependencies that fit the constitution's allowlist (see excerpt below) for whatever this task touches — at T001 that generally means Vite/React/TypeScript/ESLint/Prettier tooling only, no UI libraries yet (Astryx comes in T002).
- ESLint and Prettier configs are present and functional (`npm run lint` runs cleanly against the scaffold).
- Matches PRD D2 stack choice (Vite + React 18 + TypeScript strict).

## Relevant Constitution Excerpt

**Stack locks (item 8):** Vite + React 18 + TypeScript strict + Supabase. **No Tailwind, no shadcn, no alternate UI/CSS libraries** (PRD D2/D3) → BLOCKER.

**Dependency allowlist (item 9):** `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator` (Edge Function), plus dev tooling (vitest, playwright, eslint, prettier). Anything else requires boss-architect approval recorded in the ledger. (T001 itself only needs the Vite/React/TS/ESLint/Prettier dev-tooling slice of this list — do not add Astryx or other allowlist items not needed yet.)

**Authority boundaries:** Workers may implement tasks, but they may not redefine success. Workers may not edit `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`. If you believe a standard here is wrong, impossible, contradictory, or harmful, file a dispute instead of modifying the standard.

**Non-negotiable:** The app must build successfully. No worker may mark its own work complete.

## Most Recent Failure
None — this is attempt 1.

## Required Worker Output
- Files changed (full list of paths created/modified)
- Summary of changes
- Commands run, with output: `npm run build`, `npm run typecheck` (or `tsc --noEmit` if no dedicated script), `npm run lint`
- `package.json` contents (or diff) for dependency-allowlist review
- Known risks
- Whether a dispute is needed
