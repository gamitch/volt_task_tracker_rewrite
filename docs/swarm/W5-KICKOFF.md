# W5 kickoff — home dashboards

**Authoritative handoff for a fresh W5 orchestrator session. Written 2026-08-03 at
`main` = `6b5663a`.** Everything you need is on disk; nothing important lives only in a
conversation. Same shape as `W2-KICKOFF.md`, which is the sister document.

> ## ⚠️ CORRECTION — 2026-08-03, before any W5 work started
>
> **The original version of this file claimed W5 "overlaps with nothing that W1, W2, W4 or W7 own."
> That is FALSE, and `WORKFLOWS.md:185-186` says so in plain text:**
>
> > *"W4 conflicts with W5 on `dashboard_views.sql` and `StudentHome.tsx` (T186, T187, T201, T202).
> > Give both to one machine, or split strictly: W4 takes the SQL, W5 takes the `.tsx`."*
>
> The author read W4's row table and its `Owns:` line and stopped two lines short. **W5 is not the
> clean workflow — there is no fully clean workflow left.** Do not rely on any "you can run without
> talking to anyone" framing. §5 now lists **three** rows that reach outside W5, not two.

**W5 — what a student, parent, or coach sees when they land.** Substantial, well-evidenced, and
mostly independent — but **not conflict-free**, and the conflicts are named in §3 and §5.

---

## 1. What you are working on

**Volt Task Tracker** — a volunteer-hours and attendance app for one FIRST robotics team: about
**20 students**, their parents, and the owner/coach (George). It is real software with real data in
it, not a demo. **341.75 hours of real volunteer history are live in the Supabase project.** Bugs
here mean a real student sees a wrong number on their own dashboard.

The team's students are also *student coaches* for younger FLL teams, so **"FLL Team Meetings"
events are `type = 'outreach'`, not meetings**, and they **do** count toward volunteer hours. This
has been proposed wrongly twice. **The rule is by event `type`, never by event name.**

**The owner deliberately maintains a two-child parent account** — his own account plus a `Test`
student as a second child — *specifically* to exercise the multi-student parent path. Two of your
rows (**T328**, **T192**) live on exactly that path, so they are testable in the real app rather
than only in fixtures. It also means a regression there is one he will personally hit.

**Stack:** React + TypeScript + Vite + Vitest, Astryx design system (`@astryxdesign/core`),
Supabase (RLS, PostgREST, Edge Functions).

**You are the orchestrator**, not the implementer. You write task packets, dispatch a premise gate,
a worker and a checker as subagents, and **you personally replay every mutation** rather than
trusting a worker's report.

## 2. Your workflow

**W5 — "what a student, parent, or coach sees when they land."**

**Files you own — do not edit source outside this list:**

```
src/pages/home/**                           (9 files, listed below)
src/lib/supabase/loaders/dashboard.ts       (743 lines, ZERO tests — that is T166)
src/lib/supabase/loaders/parentHome.ts      (496 lines, has tests)
src/lib/supabase/loaders/coachHome.ts       (219 lines, has tests)
```

`src/pages/home/` is exactly: `CoachHome.tsx(+test)`, `DashboardPage.tsx(+test)`,
`ParentHome.tsx(+test)`, `StudentHome.tsx(+test)`, and `StudentHomeSlot.tsx` — **the last has no
test because it is unreachable dead code, which is T182.**

**Your row-number block is T800–T899** (`WORKFLOWS.md:322`). File every new ledger row inside it.
Never take "the next free number" from outside your block — that is exactly how the T196/T197
collision happened, and it nearly happened a second time.

## 3. Who else is live right now — do not touch their files

| Path | Owner | Note |
|---|---|---|
| `src/pages/outreach/**`, `loaders/outreach.ts`, `loaders/selfCheckoff.ts` | **W2** | Another machine, mid-flight on T330. |
| `src/pages/checkin/**`, `pages/meetings/LiveConsole.tsx`, `Kiosk.tsx`, `loaders/checkin.ts`, `kiosk.ts`, `attendance.ts` | **W1** | Another machine, on T196 (making `LiveConsole` real — the launch blocker). |
| `supabase/migrations/*metric_views.sql`, `*kpi_views.sql`, `*dashboard_views.sql`, `loaders/kpi.ts`, `loaders/reports.ts`, `pages/reports/**`, `pages/outreach/Leaderboard.tsx` | **W4** | **⚠️ W4 CONFLICTS WITH YOU** on `dashboard_views.sql` and `StudentHome.tsx` — rows **T186, T187, T201, T202** (`WORKFLOWS.md:185-186`). Its instruction: give W4+W5 to one machine, **or split strictly — W4 takes the SQL, W5 takes the `.tsx`.** Confirm with the owner which applies before starting any of those four rows. |
| `loaders/students.ts`, `teams.ts`, `parents.ts`, `invites.ts`, `accept.ts`, `pages/roster/**` | **W7** | Unassigned, but **BOTH T200 and T187 reach into it — see §5.** |
| `pages/calendar/**`, `loaders/calendarFeed.ts` | W6 | Done — T194/T195 landed in PRs #37/#38. |

**You may import freely from any of these. You may not modify them.**

## 4. State of play

`main` = **`6b5663a`**, green — measured, not assumed:

```
tsc --noEmit    exit 0
eslint .        0 errors, 360 warnings
vitest run      76 files, 1850 tests, exit 0
```

**Measure these yourself on your branch point and report real numbers.** They move often: three
machines are merging to this repo, and this baseline shifted by +8 tests and −1 warning in the
hours before it was written.

**The context you inherit.** W5 is where the **fabricated-data family** lived — `CoachHome` (T155),
`StudentHome` (T176), `ParentHome` (T181) all shipped with invented data and were fixed. That
family was declared closed. **Most of what remains on your list is residue from those fixes,** filed
honestly by the workers and checkers who did them rather than left implicit. Treat the filings as
trustworthy but **verify the line numbers** — several were written weeks ago.

## 5. Your rows — and the two that are not really yours

| Row | What | Tier |
|---|---|---|
| **T199** | `StudentHome`'s `events`/`sessions`/`rsvps`/`participation` have **no real loader** | STANDARD |
| **T187** | `StudentHome` team scoping reads the legacy single-team column — a dual-team student sees one team | HEAVY |
| **T192** | `ParentHome` issues unfiltered full-table reads once per child card | STANDARD |
| **T328** | Meetings and Outreach collapse a two-child parent to unlabeled single-child context | STANDARD |
| **T198** | Does `CoachHome` need a real per-coach team concept? *(open question — needs an owner ruling, not code)* | STANDARD |
| **T166** | `loaders/dashboard.ts` has 0 tests across 743 lines — deliberately deferred | STANDARD |
| **T331** | Staff KPI strip dominates small viewports | FAST |
| **T182** | `StudentHomeSlot.tsx` is unreachable, untested, consciously superseded | FAST |
| **T156** | The loader discards the real Postgres error — **see the warning below** | STANDARD |
| **T200** | `students.test.ts`'s row-not-found test asserts a bare `rejects.toThrow()` — **see below** | FAST |

### ⚠️ THREE rows edit files W5 does not own: T156, T200 and T187. Do not start any without reading this.

**T156 targets `src/lib/supabase/loaders/loader.ts`** — `toLoaderError` at `:116-121` replaces the
real Postgres message with a generic string, keeps the original only in `cause`, and **nothing
anywhere logs it.** That is a genuine and well-evidenced defect: diagnosing T155 required the owner
to open DevTools, filter the Network panel and click into a response body to recover
`22P02 invalid input syntax for type uuid`.

**But `loader.ts` is the shared spine of every workflow** — measured at `6b5663a`, **23 loader
modules and 33 source files** use `createLoader`/`runMutation`. Changing its error shape is an
**export another session builds against**, which is a **constitution item 26 HEAVY trigger** on its
own, and it can break W1, W2, W4 and W7 simultaneously. **Do not treat it as a W5-local change.**
Raise it with the owner and coordinate before packeting; it may deserve to be re-filed as a W10
cross-cutting row rather than run from here.

**T187 targets `src/lib/supabase/loaders/students.ts`** — `makeResolveStudentScope` (`:422`) and
`resolveStudentScope` (`:444`), which read the legacy `students.team_id`. **That file belongs to
W7**, and `parentHome.ts` consumes the same factory, so widening its return type is *an export
another session builds against* — an item 26 HEAVY trigger in its own right, which is consistent
with T187 already being tiered HEAVY. **The original version of this file missed this entirely and
described T187 as a `StudentHome.tsx`-only change.** Settle ownership with the owner before
packeting: W7 is currently unassigned, but T187 is also one of the four rows `WORKFLOWS.md:185-186`
names as a **W4/W5 conflict**, so it has two claimants, not one.

**T200 targets `src/lib/supabase/loaders/students.test.ts`**, which belongs to **W7**. It is a
one-assertion FAST fix (a bare `rejects.toThrow()` that passes for any error at all — the
absence-only failure mode this project has shipped 7+ times). **If W7 is unassigned, take it and say
so in the PR. If W7 has a machine, hand it over.** Do not silently edit another workflow's file.

### Where to start

**Ordering is now an open question — put it to the owner rather than assuming.** The original
version of this file said "start with T199, then T187" on the strength of the fabricated-data claim
corrected below. With that claim gone, **T187 is the only row here that puts a wrong value in front
of a real user** (a two-team student sees one team), which argues for T187 first — but T187 is
HEAVY, reaches into W7's file, and is one of the four rows in the W4/W5 conflict set. **T199 is
cheap, self-contained and entirely inside your own files**, which argues for doing it first simply
because it can start immediately. Both remain the right two rows; only their order is unsettled.

- **T199 is NOT fabricated data, and the original version of this file was wrong to say so.**
  `StudentHome.tsx`'s `loadData` defaults to the **real** `loadStudentHomeData`
  (`loaders/students.ts:550`), whose `makeLoadStudentHomeData` returns `events: []`, `sessions: []`,
  `rsvps: []`, `participation: null` — **verified at those lines**. The ledger's own wording is
  *"honestly empty," not fabricated*. The fixture path is test-only. **T199 is a missing feature, not
  a wrong number in front of a user**, and it should be prioritised as such.
- **T187** is the correctness bug underneath it, and it is **HEAVY**: `resolveStudentScope` reads
  `students.team_id`, the legacy single-team column, so a student on two teams sees only one.
  **Every other reader has already migrated to the `student_teams` junction** —
  `membership_views.sql:63`/`:92`, `dashboard_views.sql:205-206`, `kpi_views.sql:256`. StudentHome
  is the last holdout, which makes this a finishing move rather than a new design. It was
  **disclosed, not overlooked**: `StudentHome.tsx` module doc #8 (`:212-240`) records it as a
  *"Known, disclosed narrowing (not a bug, filed as a follow-up)"* and quotes the migration header
  that authorises it. **Read that doc entry before packeting — it also tells you which readers have
  already migrated, so the work is bounded.**

**Do not start with T192.** It is real — a three-child parent triggers 6 full `event_sessions`
scans and 3 full `events` scans per page load, neither season-scoped — but the ledger row already
records it as **acceptable at this project's scale under constitution item 25's proportionality**.
Fixing it is optimisation, not correctness. **T328 sits on the same two-child parent path and is
worth more**, because it is something the owner actually sees.

**T198 is a question, not a task.** Do not build anything for it. Put it to the owner.

## 6. Process — constitution item 26's three tiers

**Read `docs/swarm/constitution.md`.** Item 26 decides how much process a task gets. **Tier is about
risk, not diff size.**

| Tier | When | Who runs |
|---|---|---|
| **FAST** | No write path, no schema/RLS/auth, no cross-module signature, ≤~20 lines, and you can name the mutation | You implement it directly. **Verification is NOT reduced.** |
| **STANDARD** | Everything else that isn't HEAVY | Worker + you replay mutations |
| **HEAVY** | **Required** for write paths, RLS/auth, migrations, metric-view SQL, or an export another session builds against | **Packet + premise gate + worker + checker** (item 26's exact words), with you replaying every mutation. Gate capped at two rounds; a third escalates to the owner (item 19a). |

**The premise gate is the highest-leverage slot and must BUILD the prescription in its own worktree,
not read it.** Every save it has produced came from executing. On T305 it proved the proposed fix
would null a student's recorded hours. On T193 it measured a claimed hazard as false. On T309 and
T327 it caught the orchestrator's own errors — twice.

**Recommended model allocation** (the owner's, and it has paid off): **Fable** on the premise gate,
**Sonnet** on the worker, **you** replaying the mutations.

## 7. Verification standards — not negotiable

**Every acceptance criterion must name a production-code mutation that turns it red, and you must
run it yourself.** A criterion whose mutation leaves the suite green is not evidence — report that
instead of shipping it.

**Paired assertions.** An absence-only assertion passes for the wrong reason — an early throw
satisfies "X is not there" just as well as correct behaviour does. Pair it with a presence
assertion. **T200 on your own list is an instance of this exact bug**, so you have a worked example.

**A count delta answers "did anything break", not "is anything now passing for the wrong reason."**

**Six gates, `.env.local` ABSENT, report every one:**

```
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .            (0 errors; report the warning count and explain any rise)
npx vitest run
npx vitest run <the targeted files>; echo $?     # assert the exit code, not just the count
```

### The harness trap that has bitten four consecutive tasks — and it lives in YOUR files

**`src/pages/home/DashboardPage.test.tsx:36-46` documents a mount-time loader trap verbatim**, and
it is more specific than most: it names **three** seams a zero-props `<StudentHome />` render
reaches, and records that mocking `resolveCurrentStudentId` alone still leaves `resolveStudentScope`
hitting the real `getSupabaseClient()` — measured by the T176 gate, round 1, MAJOR 6. T183 added a
third seam (`StudentHome.tsx:1768`'s own `loadData` default). It is one of the two places in this
repo where this trap is written down, and orchestrators have *still* written criteria against an
imagined harness four tasks running.

**Open the test file and read its `vi.mock` block before writing a single criterion.** Do not
describe a harness you have not opened. On T309 a packet claimed a test file had no mock when it had
one at `:49-55` with four existing tests asserting the call — the two dialog test files had simply
been confused for each other.

### Two more failure modes to check yourself against

- **Citing code that exists but does not run.** A T330 closure was proposed on a real line that is
  dead on the surface that mattered. **Reading that a branch exists is not evidence that it renders.**
- **Recommending on a question already settled.** Before putting any product question to the owner,
  search **`auto-mode-decisions.md`** and the target module's own doc header. T309's storage
  question had been ruled on months earlier and the owner was asked to re-decide it.

## 8. Git — how to work

**Branch per task, task-scoped, never session-scoped** (`WORKFLOWS.md` rule 2):
`claude/t199-studenthome-loader`, not `claude/swarm-plan-xyz`.

```bash
git fetch origin main
git checkout -b claude/t<row>-<slug> origin/main
```

- **Work in your own git worktree** (item 23). Do not move the shared checkout's HEAD.
- **Commit before running any mutation** — reverting with `git checkout --` also reverts
  uncommitted work. This has bitten this project.
- **Stage named paths only. Never `git add -A` or `git add .`** (item 22). The recorded rationale
  (`constitution.md:213-217`): a subagent modified a source file **without authorization** during a
  documentation commit, and a habitual `git add -A` would have swept it into a commit whose message
  described packet authoring — no packet defining it, no checker verifying it. **The mechanism is
  indifferent to severity.**
- **Never commit to `main`.** Open a PR; `main` is protected by CI. **Wait for CI green before
  merging, and then verify the files actually landed on `main`** — a PR whose CI passed but was
  never merged looks identical to a merged one until you check.
- **Use a merge, not a squash**, if your verification log cites an implementation SHA.
- **Item 24: the ledger row and the verification-log entry go in the same work as the merge**, and
  are written **before** the PR. T323 merged without either and another session had to backfill it.
  **Item 26 removes coordination, not bookkeeping.**

## 9. Security and privacy — hard rules

- **Constitution item 6: no PII** — no student names or emails in logs, URLs, analytics, commit
  messages, docs, or test fixtures. **Fixtures use fabricated names.** BLOCKER.
- **Never paste a service-role key** into a chat, a doc, or a commit. It bypasses RLS entirely.
- **Never commit the migration JSON exports** — `students.json` holds twenty real children's first
  names.

## 10. Reading order for your first ten minutes

1. **This file.**
2. `docs/swarm/constitution.md` — items 6, 19, 20, 22, 23, 24, 25, 26.
3. `docs/swarm/WORKFLOWS.md` § W5 — and the concurrency guidance above it.
4. `docs/swarm/task-ledger.md` — your rows. **T199, T187, T192 and T156 carry long, evidence-dense
   entries; read them in full rather than the one-line summaries in §5.**
5. `src/pages/home/DashboardPage.test.tsx:36-46` — the harness trap, in your own files.
6. `docs/swarm/auto-mode-decisions.md` — the owner's rulings. **Cite this file, never a paraphrase.**

**Do not write code in your first ten minutes.** Every expensive mistake in this project came from
acting on a premise nobody had checked.
