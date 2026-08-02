# VOLT Team Portal — Swarm Overview

**Read this file first.** It's the lean entry point. For anything not covered
here, go to the specific doc — don't re-read `task-ledger.md`,
`verification-log.md`, or `dispute-log.md` in full just to get oriented.

| Need | File |
|---|---|
| Run this swarm with Codex (no slash commands required) | `CODEX.md` |
| Project rules, severity rubric, Non-Negotiables, agent tiering, dispatch gate | `constitution.md` |
| Per-task status, deps, Allowed Files, acceptance criteria | `task-ledger.md` |
| Full evidence/reasoning for a specific task's PASS/FAIL | `verification-log.md` (search `## T0xx`) |
| **Wave-5 (current) requirements** | `VOLT_UX_Craft_PRD_v3.md` — full version w/ screenshots: `VOLT_UX_Craft_PRD_v3.html` |
| **Wave-5 binding visual references** | `figures/ux-craft/*.webp` — open with the Read tool; `old-*` = reference app, `new-*` = portal survey |
| Functional requirements (waves 1–4) | `VOLT_Portal_PRD_v2.md` |
| Original requirements, wireframes §4.2/§7.1, requirement IDs | `VOLT_Portal_PRD.md` (v1.5 — still authoritative for IDs and per-route layout) |
| Boss-arbiter rulings (D001–D005) | `dispute-log.md` |
| Standing decisions, risks, per-task one-liners | `state-summary.md` |
| Astryx component API | `astryx-api.md` (grep, don't read whole file — **and see F-1/F-2/F-3 below: it has been wrong twice; installed source wins**) |
| Archived worker/checker packets | `archive/T0xx-*.md` |

## Status snapshot (2026-07-28)

**134 tasks · 129 Passed · 5 Blocked · 0 In Progress.**

Every automatable task through wave 4 is Passed and independently
checker-verified. **The 5 Blocked tasks are all human gates waiting on George,
not on agents**: T052 (production email — needs Resend domain verification +
sign-off), T063/T064/T065 (migration validation → cutover — needs old-project
credentials), T070 (Vercel domain go-live).

### Where the app stands

All 13 routes resolve to real components backed by real Supabase data and real
auth. Waves 1–4 delivered, on top of the v1 app:

- **D-2 single active season** and **D-3 membership double-count** semantics
  (`student_teams` junction; a dual member's hours count once personally and in
  full for each of their teams).
- **Coach-managed attendance** with per-student hours, and **D-7 coach
  authority** (a coach's edits override any student RSVP or check-in).
- **Dense outreach + meetings rows** with expand-in-place and inline actions;
  real attendance (not RSVP intent) in the Attended column.
- **Persistent staff KPI strip**, **coach dashboard analytics** (stat tiles,
  goal projection, hours-by-team, top events) and a **self-vs-staff activity
  feed**.
- **Event create/edit forms** re-laid as full-height sectioned panels.
- **Retroactive student/parent self check-off**, with its own `'self'` method +
  RLS policies (students can only add/remove their own self-recorded rows).
- **Mark whole event complete** driving the existing per-day completion path.

**1385 tests green**; typecheck, lint, build, and format gates all clean.

### George must run `supabase db push`

Six migrations are committed and unapplied: `student_teams`, `membership_views`,
`kpi_views`, `dashboard_views`, `self_checkoff`, `planned_hours_future_guard`.
All additive.

## Current work: wave 5 (UX craft)

**Approved and ready to dispatch. Next task ID: T129.**

Requirements: `VOLT_UX_Craft_PRD_v3.md` (v3.1). Wave 5 is visual craft only —
no new features. It closes the gap George identified: the reference app is a
better *visual instrument* (alignment, density, row separation, color encoding)
than the portal, and a large part of that is drift from PRD v1's own §4.2/§7.1
wireframes.

Packet order: **P1** (heading dedup, copy-jargon sweep, ISO dates) and **P2**
(migrate outreach rows to Astryx `Table` — the proving ground) first. **P2
blocks P3.** P4/P5/P6 are parallel-safe after P1.

Two decisions George recorded (do not re-litigate):
1. `/reports` and `/settings` are template-as-is routes (PRD v1 §7.1) — wave 5
   does **not** re-lay them out; Settings still gets its copy fix.
2. Leaderboard proportional bars + "% of goal" are **approved** as an explicit
   constitution item-17 ruling (facts only, SEC-04 anonymization unchanged).

### Feasibility constraints verified against installed Astryx source

- **F-1** — `List`/`ListItem` **cannot** align columns across rows (3-slot flex,
  self-sizing end caps). `Table` can (`pixel()`/`proportional()`/`renderCell`/
  `useTableRowExpansion`/`useTableGroupedRows`) and is already used in
  `StudentsTab.tsx` and `ParticipationTab.tsx`. Use `Table`.
- **F-2** — `xstyle` is typed everywhere but **unusable**: StyleX is
  compile-time and this app has no StyleX plugin. Escalation is
  component → theme token → custom CSS.
- **F-3** — `ProgressBar` cannot segment, tick, or mark a goal. One small custom
  bar component is **pre-approved** for UXC-05/UXC-08 only.

## Standing rules

- **Constitution item 18 (agent tiering)**: `worker-implementer` runs on sonnet
  by default; the orchestrator passes `model: "opus"` for migrations, RLS /
  `security definer` helpers, metric-math SQL views, and auth/session/permission
  logic.
- **Constitution item 19 (dispatch gate)**: no PRD, packet set, or packet
  reaches a worker until `checker-premise` returns DISPATCH. The planning layer
  was previously the only unchecked artifact in this process — a real PRD
  reached the approval gate carrying two false claims, an impossible
  prescription, and a silent reversal of a passed task's green test.
- **No worker self-certifies.** Every PASS requires a checker independently
  re-deriving the evidence, never trusting the worker's report. Two of the last
  16 worker attempts claimed work that did not exist; both were caught this way.
- **Never `git stash`** in the shared tree — three workers have done it; each
  time the checker had to run an integrity sweep before reviewing.
- **Every close-out does a full-ledger sweep**, not just direct dependents.
- **D001**: never infer worker authorship from git history — compare Allowed
  Files against the file tree.
- **D002**: stack is locked to **React 19** (not PRD's literal "React 18") —
  `@astryxdesign/core` requires it at runtime.
- **D003**: when a task first mounts a component tree, check whether
  pre-existing tests in adjacent forbidden files could break.
- **D004**: Astryx's `mobileNav={<X/>}` shorthand silently disables the toggle —
  use the `{ content: <X/> }` config form.
- **D005**: contrast checks must include foreground-ON-accent pairings in both
  themes, not only accent-on-surface.

## Known process debt

- PRD v1 §7.1 instructs checkers to verify "region placement and content
  presence, **never ASCII fidelity**." That standing rule is why visual density
  and alignment drifted unchecked across ~130 tasks. Wave 5 recommends amending
  it (PRD v3.1 §6 item 5).
- Constitution item 2 says Astryx props come *only* from `astryx-api.md`, but
  that doc has been wrong twice (T125 found `undefined` entries; T128 fixed a
  false `<main>` claim; D004 is precedent). Installed source should be
  authoritative when the doc is silent or contradicted.
