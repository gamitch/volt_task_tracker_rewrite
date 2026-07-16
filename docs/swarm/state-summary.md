# Swarm State Summary

## Current Phase
E1 (Scaffold + theme) underway — T001 and T002 complete. D002 (2026-07-16) reversed the React 18 lock to React 19 (@astryxdesign/core requires React 19 at runtime); corrective task T002a inserted between T002 and T003, dispatched In Progress. T003 reverted Ready→Blocked pending T002a (same theme system). T009 (E2) dispatched In Progress in parallel — no file overlap with T002a. T005 (E1) remains Ready/undispatched. Full breakdown in `docs/swarm/task-ledger.md` (71 tasks, T001–T070 + T002a, epics E1–E11).

## Completed
- **T001** — Vite + TS(strict) + ESLint/Prettier scaffold. Passed checker-tests: build/typecheck/lint/format:check all clean, strict mode confirmed, zero Tailwind/shadcn, scope exceptions (index.html, package-lock.json) verified per D001.
- **T002** — Astryx install + `volt.ts` theme. Passed checker-accessibility (attempt 1 FAIL was an upstream type-gap issue, not worker fault; attempt 2 PASS): `volt.ts` verbatim vs DES-03, `astryx-augment.d.ts` fixes the upstream type gap and was empirically verified via negative-control test, build/typecheck clean, WCAG AA contrast passes both modes.

## Active
- **T002a** — React 18→19 upgrade (D002 corrective task, E1, checker-tests). Dispatched, attempt 0, In Progress. Packet: `docs/swarm/active/T002a-worker-packet.md`.
- **T009** — Migration: identity/roster tables (E2, checker-tests). Dispatched, attempt 0, In Progress. Independent of T002a (no file overlap). Packet: `docs/swarm/active/T009-worker-packet.md`.

## Known Decisions
- Stack locked: Vite + **React 19** + TS strict + Supabase; Astryx only, no Tailwind/shadcn (PRD D2/D3, constitution item 8). **React 19 is a human-authorized deviation from PRD D2's "React 18"** — see `dispute-log.md` D002 (2026-07-16): `@astryxdesign/core` requires React 19 at runtime (calls `use()`), confirmed by the fact that T002's own shipped `Theme.js` would throw under React 18 at first render. Corrective task T002a upgrades the dependency; T003 is blocked until T002a passes.
- RLS default-deny on every table; policies/metric SQL copied verbatim from PRD 8.4, never re-derived or duplicated in TS (constitution items 3/4).
- Astryx props sourced only from `docs/swarm/astryx-api.md`; CLI is a cross-check, not a source (constitution item 2).
- Motivation ethics (constitution item 17 / PRD 5.7 BEH-01…09): honest progress signals only — no streaks, loss-aversion, FOMO, or guilt copy. Folded into task acceptance criteria wherever progress bars, milestones, or meeting history appear (not a separate epic).
- Human gates live in the ledger as checker = "human (George)": T052 (production email), T063 (MIG-04 validation sign-off), T065 (MIG-06 cutover), T070 (Vercel domain go-live).
- **D001 (resolved)** — T001's first checker-tests run FAILed on a git-commit-bundling evidence trap: it inferred worker authorship of `docs/swarm/**` changes from a bundled orchestrator commit, but git identity here doesn't distinguish per-agent authorship (commits mix orchestrator, foreman-authored packets, and hook-generated log lines). Boss-arbiter vacated the verdict. **Standing rule for all future checker packets:** never use git history/commit diffs as evidence of which agent touched a file. Instead compare the task's Allowed Files list against the current file tree state directly. This risk recurs on every checker-tests run unless checker packets keep stating the file-tree-comparison method explicitly.
- **Ledger status-propagation gap (found + fixed 2026-07-16):** when T001 passed, only its direct dependent T002 was flipped Blocked→Ready; T005 and T009 (both dep solely on T001) were incorrectly left Blocked. A full-ledger sweep was run comparing every Blocked task's Deps column against current dependency Status; only tasks with ALL deps Passed flip to Ready. Result: T005 and T009 corrected to Ready (see task-ledger.md). No other rows qualified — every other Blocked task has at least one dependency that is itself not yet Passed. **Standing rule:** on every task Passed close-out, sweep the full ledger for newly-unblocked tasks, not just the task's immediate/listed dependents.

## Current Risks
- **External prerequisites (not swarm tasks, block specific ledger tasks):** (1) George must create the new Supabase project (blocks T009 onward for live verification); (2) George must create the Google OAuth client (blocks T015 end-to-end); (3) George must verify the `mail.voltfrc.org` Resend sending domain (blocks T052); (4) George must add the Vercel CNAME for `portal.voltfrc.org` (blocks T070). The swarm cannot start real migration, production email, or domain go-live work without these.
- **T002 upstream type gap (resolved locally, informational only):** `@astryxdesign/core@0.1.6`'s `TypographyRole` interface omits the `url` field its own JSDoc documents. Worked around via `src/theme/astryx-augment.d.ts` (verified correct, T002 Passed). Not a stack-lock or spec problem. NIT follow-up: consider filing an upstream issue against `@astryxdesign/core@0.1.6` for this gap — log only, no swarm action needed; the local augmentation file already covers it. Detail archived at `docs/swarm/archive/T002-latest-failure.md`.
- Loop limit is 3 failed attempts per task before mandatory escalation to boss-arbiter (constitution "Loop Limit").
- No task may be marked complete on worker self-report; every row requires checker-inspected evidence per the Definition of Done.

## Next Recommended Task
T002a and T009 were just dispatched (In Progress, see Active). Remaining Ready/unblocked task not yet dispatched:
- **T005 — Router skeleton + route guards + deep-link redirect** (E1, checker-reviewer). Dep T001 Passed. Independent of T002a/T009 — safe to dispatch in parallel.

T003 (E1) is Blocked again pending T002a per D002; do not dispatch until T002a Passes.
