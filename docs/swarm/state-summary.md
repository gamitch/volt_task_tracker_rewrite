# Swarm State Summary

## Current Phase
E1 (Scaffold + theme) underway — T001 and T002 complete, T003 ready to dispatch. Full breakdown in `docs/swarm/task-ledger.md` (70 tasks, T001–T070, epics E1–E11).

## Completed
- **T001** — Vite + TS(strict) + ESLint/Prettier scaffold. Passed checker-tests: build/typecheck/lint/format:check all clean, strict mode confirmed, zero Tailwind/shadcn, scope exceptions (index.html, package-lock.json) verified per D001.
- **T002** — Astryx install + `volt.ts` theme. Passed checker-accessibility (attempt 1 FAIL was an upstream type-gap issue, not worker fault; attempt 2 PASS): `volt.ts` verbatim vs DES-03, `astryx-augment.d.ts` fixes the upstream type gap and was empirically verified via negative-control test, build/typecheck clean, WCAG AA contrast passes both modes.

## Active
None.

## Known Decisions
- Stack locked: Vite + React 18 + TS strict + Supabase; Astryx only, no Tailwind/shadcn (PRD D2/D3, constitution item 8).
- RLS default-deny on every table; policies/metric SQL copied verbatim from PRD 8.4, never re-derived or duplicated in TS (constitution items 3/4).
- Astryx props sourced only from `docs/swarm/astryx-api.md`; CLI is a cross-check, not a source (constitution item 2).
- Motivation ethics (constitution item 17 / PRD 5.7 BEH-01…09): honest progress signals only — no streaks, loss-aversion, FOMO, or guilt copy. Folded into task acceptance criteria wherever progress bars, milestones, or meeting history appear (not a separate epic).
- Human gates live in the ledger as checker = "human (George)": T052 (production email), T063 (MIG-04 validation sign-off), T065 (MIG-06 cutover), T070 (Vercel domain go-live).
- **D001 (resolved)** — T001's first checker-tests run FAILed on a git-commit-bundling evidence trap: it inferred worker authorship of `docs/swarm/**` changes from a bundled orchestrator commit, but git identity here doesn't distinguish per-agent authorship (commits mix orchestrator, foreman-authored packets, and hook-generated log lines). Boss-arbiter vacated the verdict. **Standing rule for all future checker packets:** never use git history/commit diffs as evidence of which agent touched a file. Instead compare the task's Allowed Files list against the current file tree state directly. This risk recurs on every checker-tests run unless checker packets keep stating the file-tree-comparison method explicitly.

## Current Risks
- **External prerequisites (not swarm tasks, block specific ledger tasks):** (1) George must create the new Supabase project (blocks T009 onward for live verification); (2) George must create the Google OAuth client (blocks T015 end-to-end); (3) George must verify the `mail.voltfrc.org` Resend sending domain (blocks T052); (4) George must add the Vercel CNAME for `portal.voltfrc.org` (blocks T070). The swarm cannot start real migration, production email, or domain go-live work without these.
- **React 18 vs `@astryxdesign/core` peer-dependency conflict (surfaced during T002 checker-accessibility, not blocking):** `@astryxdesign/core` declares `peerDependencies.react >= 19.0.0` / `react-dom >= 19.0.0`, but the repo is locked to React 18 (D2). Confirmed real via `npm ls` (ELSPROBLEMS/invalid markers); `npm install --legacy-peer-deps` succeeds and no runtime failure has been proven yet. Not a T002 blocker — tracked here for future watch (e.g. if a component T006+ exercises a React-19-only API at runtime, or if a future `@astryxdesign/core` patch tightens the peer-dep enforcement).
- **T002 upstream type gap (resolved locally, informational only):** `@astryxdesign/core@0.1.6`'s `TypographyRole` interface omits the `url` field its own JSDoc documents. Worked around via `src/theme/astryx-augment.d.ts` (verified correct, T002 Passed). Not a stack-lock or spec problem. NIT follow-up: consider filing an upstream issue against `@astryxdesign/core@0.1.6` for this gap — log only, no swarm action needed; the local augmentation file already covers it. Detail archived at `docs/swarm/archive/T002-latest-failure.md`.
- Loop limit is 3 failed attempts per task before mandatory escalation to boss-arbiter (constitution "Loop Limit").
- No task may be marked complete on worker self-report; every row requires checker-inspected evidence per the Definition of Done.

## Next Recommended Task
**T003 — CSS cascade layers + `theme.css` build pattern** (Epic E1, checker-tests). Now Ready — its only dependency, T002, has Passed. Dispatch to worker-implementer with a fresh packet covering `@layer reset, astryx-base, app` (NFR-08) and the prebuilt `theme.css` import pattern (DES-07).
