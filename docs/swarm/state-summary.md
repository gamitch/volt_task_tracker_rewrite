# Swarm State Summary

## Current Phase
Planning complete — ready to execute E1 (Scaffold + theme). Full breakdown in `docs/swarm/task-ledger.md` (70 tasks, T001–T070, epics E1–E11).

## Completed
None yet.

## Active
None yet.

## Known Decisions
- Stack locked: Vite + React 18 + TS strict + Supabase; Astryx only, no Tailwind/shadcn (PRD D2/D3, constitution item 8).
- RLS default-deny on every table; policies/metric SQL copied verbatim from PRD 8.4, never re-derived or duplicated in TS (constitution items 3/4).
- Astryx props sourced only from `docs/swarm/astryx-api.md`; CLI is a cross-check, not a source (constitution item 2).
- Motivation ethics (constitution item 17 / PRD 5.7 BEH-01…09): honest progress signals only — no streaks, loss-aversion, FOMO, or guilt copy. Folded into task acceptance criteria wherever progress bars, milestones, or meeting history appear (not a separate epic).
- Human gates live in the ledger as checker = "human (George)": T052 (production email), T063 (MIG-04 validation sign-off), T065 (MIG-06 cutover), T070 (Vercel domain go-live).

## Current Risks
- **External prerequisites (not swarm tasks, block specific ledger tasks):** (1) George must create the new Supabase project (blocks T009 onward for live verification); (2) George must create the Google OAuth client (blocks T015 end-to-end); (3) George must verify the `mail.voltfrc.org` Resend sending domain (blocks T052); (4) George must add the Vercel CNAME for `portal.voltfrc.org` (blocks T070). The swarm cannot start real migration, production email, or domain go-live work without these.
- Loop limit is 3 failed attempts per task before mandatory escalation to boss-arbiter (constitution "Loop Limit").
- No task may be marked complete on worker self-report; every row requires checker-inspected evidence per the Definition of Done.

## Next Recommended Task
**T001 — Vite + TS(strict) + ESLint/Prettier scaffold** (Epic E1, no dependencies, checker-tests). First unblocked task; everything else in E1 chains off it.
