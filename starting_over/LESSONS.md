# Lessons — why the first rewrite failed, with the receipts

This is the post-mortem of the VOLT Team Portal rewrite (2026-07 → 2026-08).
Every claim below is measured, not remembered — sources are the repo's own
records (`docs/swarm/AUDIT-TRIAGE.md`, `2026-08-10-heavy-task-lessons.md`, the
owner session records, the Linear workspace, and a gate run at the final
commit). The new PRD and constitution in this folder are built directly on
these lessons; nothing here is blame, all of it is tuition.

## The verdict, stated fairly

The project was not killed by bad code. At the final commit (`5bf0cb7`,
2026-08-23) every gate is green: 0 TypeScript errors, clean build, 0 lint
errors, **2,792 passing tests across 114 files**. The schema and RLS are
genuinely good. What failed is that none of that green ever measured the thing
that mattered: **whether a coach, student, or parent could actually use the
app.** They mostly could not, and the process that produced the green could
not see it.

## The five failures

### 1. Fixture-first development — the root defect family

Pages were built against injectable loader props that **defaulted to fixture
data**, with the "wire it to Supabase later" tasks never scoped. The backlog
doc called this out in July as "THE SINGLE MOST IMPORTANT ENGINEERING FACT"
(ED-1, `docs/backlog.html`) and it stayed true to the end:

- The live check-in console was a fixture shell — any session id rendered
  seven fake students, and marking attendance was an intentional no-op
  (LIVE-001/T196, the external audit's top blocker).
- A student changing their RSVP on `/outreach` **wrote nothing to the
  database**, silently (T193). The code carried the comment "local-only. No
  Supabase write happens here."
- All three role dashboards and the calendar rendered fabricated students and
  events on production routes for months (T155/T176/T181/T324).
- Six fully built components — five of them fully tested — were **never
  mounted anywhere**, including StudentMeetingView with a nearly 1,000-line
  test file, 44 passing tests, and zero production render sites.

An external evidence-based UX audit (2026-08-01) returned ship-recommendation
**hold**, summarized in one line: *"The core attendance loop has no working
path."* At that moment the unit suite was green and 112+ tasks had "Passed."

### 2. Green gates that never measured working software

The verification stack — six repository gates, per-task checkers, mutation
replays — verified renders, props, and copy strings. It did not verify that a
route mounted real data, that a write persisted, or that a flow worked in a
browser. Concretely:

- Checkers were asked whether components *rendered*, never whether they were
  *connected* (this later became constitution item 27, too late).
- The only tests that exercise the running app — the 13 Playwright persona
  specs — ran in **no CI workflow** and fail on a clean checkout (GAM-360,
  GAM-381).
- ~66.6k lines of test code (a 0.94:1 ratio with app code, ~56k of it jsdom
  component suites) had to be maintained on every change, yet every defect
  the owner actually hit was found by using the app, not by the suite.
- Vacuous tests shipped repeatedly: mutation replay found suites that stayed
  green with the guarded feature entirely deleted (GAM-202/211/338/341).

The pattern that held every single time, recorded in the process's own
lessons doc: **reading was wrong and running was right.** Every
outcome-changing finding came from something that executed — a real browser,
a scratch database, a mutation. The owner running one real meeting on
2026-08-05 re-opened a "closed" wave with four defects, one of which was
writing false `absent` rows into production (T508).

### 3. Horizontal waves made integration nobody's job

Work was sliced into parallel component tasks with per-ticket Allowed-Files
walls. The walls did their job — 11 parallel meetings tickets merged without
conflicts — and in doing so guaranteed the failure between the tiles:

- The meetings redesign's marquee interaction (tap-to-cycle attendance chips)
  **never once worked in production**: no ticket owned the roster loader, so
  the chips never mounted. Two tickets closed "Partial" on the same gap.
- Series color tokens were consumed by components that merged before the
  palette ticket ever landed — every series dot renders gray today (GAM-466).
- `student_teams` was added by migration with **no write path** — every
  student added after 2026-07-21 silently returned zero participation rows
  (GAM-340, plus four follow-up tickets).
- The walls also forbade the right refactors: `parseDateOnly` exists 15
  times, the Chicago wall-time conversion 4 times, the LoadState hook ~20
  times — each duplicate justified by "no shared file is in my ticket."

### 4. The process outran the product and never converged

- **The backlog grew faster than it closed, to the end**: 496 Linear issues
  at the 2026-08-23 survey (301 of them bulk-imported on 08-09 from the
  earlier file ledger); final week 98 created vs 52 completed; one day saw
  the backlog grow 27→37 while five tasks merged — two new rows per merge;
  131 open at the end, 73% never triaged by the owner. Roughly a third of
  the open backlog is about the multi-agent machinery itself, zero product
  value.
- **Cost per change**: one four-file task (GAM-304) took 6 dispatch runs,
  ~12 hours wall clock, ~$90 notional — ~$36 of it delivering nothing. One
  assembly ticket (GAM-452) burned ~1.1M subagent tokens and still closed
  Partial. The full packet → premise-gate → worker → checker chain charged
  the same price for two-line fixes until George himself asked for "a
  faster path."
- **Multi-machine parallelism cost more than it bought**: two different
  tasks were both numbered T196, append-only shared docs manufactured merge
  conflicts between machines, and every record-keeping duty multiplied by
  the number of machines running.
- **Documentation became the product**: 19MB across ~680 files in
  `docs/swarm/` — a 725KB task ledger, a 915KB verification log, a 1,223-line
  constitution (~350 lines just to classify a task's process tier), and a
  92KB RESUME-HERE.md whose own header warns most of it is stale. The
  process then audited its own citations and filed four separate issues about
  one drifting eslint-warning count in a skill file.
- ~45% of page-file lines are module-doc comments citing dead task IDs.
  `OutreachList.tsx` is 4,506 lines, 2,066 of them comments.

### 5. The app never launched, so polish had no bottom

The launch gates — production email, migration validation, data cutover,
domain go-live — were identified early, assigned to the owner, and **sat
open for the entire project** while the process polished an undeployed app.
The kiosk's `checkin-token` Edge Function was written, tested, and never
deployed, with no check that could notice (GAM-388/396). Polish on an
undeployed app is unbounded work; deployment pressure is what forces the
"does it actually work" question that the gates never asked.

## What genuinely worked — do these again

1. **Metric math only in SQL views.** The one architectural rule that held.
   Every surface reads the same view; no TypeScript re-derivation; drift
   bugs died where this was followed and thrived where it wasn't.
2. **RLS as the real security layer.** When the UI wrongly showed a parent
   real Edit/Cancel controls, the database rejected the write. RLS was the
   only layer that never failed an audit.
3. **Checks that run things.** Scratch-Postgres RLS suites, mutation replay,
   and the persona e2e harness found every real defect that reviews missed.
4. **Owner rulings recorded verbatim, with dates.** The ~30 recorded
   decisions are the project's actual domain spec and its most valuable
   artifact (now consolidated in `DECISIONS.md`).
5. **Owner live testing.** The highest-confidence defect signal in the
   project, every time it happened.
6. **The proven ETL.** The real migration ran against the live project on
   2026-08-02: 20 students, 4 teams, 16 events, 117 sessions, 341.75 hours,
   matching the signed-off dry run exactly.
7. **Durable state in git.** Committing and pushing the work itself early
   and often — plus PR bodies and tracker comments — made failures cheap to
   resume instead of catastrophic. (The practice carries forward; the
   dispatch-era run-log *files* under `docs/swarm/active/` are machinery the
   rebuild drops, per the constitution's no-process-logs rule.)
8. **A lean dependency list.** Nine runtime deps; the stack itself (Vite,
   React, TypeScript, Supabase) builds fast and was never the problem.

## The rules the rebuild draws from this

Each maps to a numbered rule in `CONSTITUTION.md`:

1. **Done means driven in a real browser with the row read back** — never
   "the component renders" (→ C-1).
2. **No fixture data on live routes, ever.** A page renders real queries or
   an explicit loading/empty/error state; identity props are required, not
   defaulted (→ C-2).
3. **Vertical slices, one at a time.** A feature ships with its write path,
   its wiring, and its fallback in the same slice; a schema change lands
   with its writer (→ C-3, C-4).
4. **Deploy first, then build.** The app is live on its real URL from week
   one; every milestone is accepted on the deployed app (→ C-5).
5. **A backlog row exists only if a user hits it or it blocks launch.**
   Everything else is fixed in the moment or dropped (→ C-6).
6. **Run, don't read.** Claims about schema, policies, or component
   capability are verified by executing before they become work items —
   three of three premise-checked tickets were defective, and one session
   recorded six wrong calls, each "a plausible mechanism asserted before the
   cheap check was run" (→ C-7).
7. **Proportionate process.** One builder, one verification pass, CI that
   includes the persona suite. No packet chains, no tiering matrix, no
   19MB of process docs (→ C-8, C-9).
8. **Code stays small and shared.** Page files capped, shared utilities have
   one home, comments explain the domain, and process history lives in git
   and the tracker — not in source (→ C-10, C-11).
