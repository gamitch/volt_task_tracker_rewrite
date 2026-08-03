# W4 + W5 kickoff — hours accounting *and* home dashboards, one machine

**Authoritative handoff for a machine taking BOTH W4 and W5. Written 2026-08-03.**

**Read this file, then `W5-KICKOFF.md` in full.** That file carries W5's rows, the shared process
and verification standards, the git rules and the security constraints — all of which apply here
unchanged. **This file adds W4 and governs where the two meet.** Where the two disagree, this one
wins.

**Branch from `origin/main`, never from a SHA quoted in any doc.** Three other machines merge to this
repo and `main` moves hourly.

---

## 1. Why these two are one machine's job

`WORKFLOWS.md:185-186` states it directly:

> *"W4 conflicts with W5 on `dashboard_views.sql` and `StudentHome.tsx` (T186, T187, T201, T202).
> Give both to one machine, or split strictly: W4 takes the SQL, W5 takes the `.tsx`."*

The owner chose the first option. **So the conflict is now internal to you: four rows that would
have needed cross-machine coordination are simply yours to sequence.** That is the whole reason for
the pairing — it is not a workload decision.

**The four shared rows are T186, T187, T201 and T202.** Treat them as a set; each one straddles a
metric view and a screen that reads it.

## 2. What you own — both lists

**W4 — hours & goal accounting** (*"every number the app shows a user about their own contribution"*):

```
supabase/migrations/*metric_views.sql, *kpi_views.sql, *dashboard_views.sql
src/lib/supabase/loaders/kpi.ts          (255 lines, ZERO tests — that is T164)
src/lib/supabase/loaders/reports.ts      (729 lines, ZERO tests — that is T163)
src/pages/reports/**                     (EventsTab, HoursTab, ParticipationTab, ReportsShell, csvExport — all with tests)
src/pages/outreach/Leaderboard.tsx       (541 lines)
```

**W5 — home dashboards** (*"what a student, parent, or coach sees when they land"*):

```
src/pages/home/**                        (CoachHome, DashboardPage, ParentHome, StudentHome — all +test; StudentHomeSlot.tsx has none, that is T182)
src/lib/supabase/loaders/dashboard.ts    (743 lines, ZERO tests — that is T166)
src/lib/supabase/loaders/parentHome.ts   (496 lines, has tests)
src/lib/supabase/loaders/coachHome.ts    (219 lines, has tests)
```

**⚠️ `src/pages/outreach/Leaderboard.tsx` is W4's, but it sits inside `src/pages/outreach/`, which
W2 owns wholesale and is actively working in.** It is one of exactly 10 files in that directory.
**Tell W2 you have it, and touch nothing else in that folder.**

**Row-number blocks: W4 → T700–T799, W5 → T800–T899** (`WORKFLOWS.md:322`). You hold two blocks.
**File each new row in the block of the workflow it belongs to** — do not merge them, and never take
"the next free number" from outside both. That is how the T196/T197 collision happened.

## 3. Who else is live — do not touch their files

| Path | Owner |
|---|---|
| `src/pages/outreach/**` *(except `Leaderboard.tsx`)*, `loaders/outreach.ts`, `loaders/selfCheckoff.ts` | **W2**, mid-flight on T330 |
| `src/pages/checkin/**`, `pages/meetings/LiveConsole.tsx`, `Kiosk.tsx`, `loaders/checkin.ts`, `kiosk.ts`, `attendance.ts` | **W1**, on T196 (the launch blocker) |
| `loaders/students.ts`, `teams.ts`, `parents.ts`, `invites.ts`, `accept.ts`, `pages/roster/**` | **W7** — see §5, three of your rows reach in |
| `pages/calendar/**`, `loaders/calendarFeed.ts` | W6 — done |
| `src/lib/supabase/loaders/loader.ts` | **nobody** — shared spine, see §5 |

**You may import freely from any of these. You may not modify them.**

## 4. W4's rows — the whole workflow is HEAVY

`WORKFLOWS.md` is explicit: **"Constitution item 26 puts this whole workflow at HEAVY — it is
metric-view SQL, where a mistake lies to a user about their own data. Do not let a small-looking
diff talk you out of the tier."** Item 18 trigger 1 also fires unconditionally on anything touching
`supabase/migrations/`.

| Row | What | Tier |
|---|---|---|
| **T205** | `v_leaderboard_students` is readable by the unauthenticated `anon` key — **owner ruled, Ready** | HEAVY |
| **T322** | Staff KPI card sums **meeting** hours into "Season hours" and "% toward season goal" — **owner ruled wrong** | HEAVY |
| **T188** | Two different "confirmed hours" numbers exist and can legitimately disagree | HEAVY |
| **T201** | A deactivated student's hours sit in `v_student_hours` with no `is_active` filter *(shared with W5)* | HEAVY |
| **T186** | `v_student_goal_projection.team_id` is documented display-only, but a live route scopes off it *(shared with W5)* | HEAVY |
| **T202** | Zero-goal `ProgressBar`s announce a fabricated `aria-valuemax` *(shared with W5)* | STANDARD |
| **T163** | `loaders/reports.ts` has 0 tests across 729 lines | STANDARD |
| **T164** | `loaders/kpi.ts` has 0 tests across 255 lines | STANDARD |
| **T204** | `loaders/students.ts`'s RLS comment cites a false claim about view mechanics | FAST |
| **T308** | *(metric views + `MarkDayCompleteDialog`)* — **see §5, this one is W2's file** | HEAVY |

### Start with T205, then T322

- **T205 is Ready and already ruled.** The owner decided 2026-07-31, structured selection: **"Close
  it off."** The fix is a one-line follow-up migration — `revoke select on
  public.v_leaderboard_students from anon;` or equivalent. It is real unauthenticated exposure, the
  ruling exists, and the change is tiny. **The tier is still HEAVY and unconditional** (item 18
  trigger 1 — it touches `supabase/migrations/`), and a one-line migration is exactly the kind of
  diff item 26 warns you not to let talk you down.
- **T322 is the headline correctness row and is also already ruled.** `v_season_kpis` computes
  `total_hours = sum(type_hours)` across **all** types including `meeting`
  (`20260723000000_kpi_views.sql:180`), so meeting hours inflate a volunteer-hours goal.

  **The rule is by event `type`, never by event name — this has already confused two reviewers and
  the orchestrator once.** `type = 'meeting'` does not count. `type = 'outreach'` does, and that
  **includes** `GG FLL Team Meetings` and `P3 FLL Team Meetings` despite the word *Meetings* in
  their titles: the team's own students are *student coaches* running those sessions for younger FLL
  teams in the community. Those two events are **72 of 117 sessions (62%) of the migrated data**.
  **Not authorized:** retyping any event, or touching the FLL events.

  **It is latent today**, not visible — the team records no `meeting`-type events, so the figure
  reads `0.0h`. It becomes a live wrong number the moment the first internal team meeting is
  recorded. Read the full ruling in `auto-mode-decisions.md` before packeting; **cite that file,
  never a paraphrase of it.**

## 5. Rows that reach outside both workflows — read before starting any of them

**T308 targets `MarkDayCompleteDialog.tsx`, which is W2's file** and which W2 has changed twice in
the last day (T309, and T327 reordered its loader's writes). **Do not take the dialog half.** Write
the metric-view half if it stands alone, and hand the dialog half to W2 as a W2-block row.

**T204 targets `loaders/students.ts`** — W7's file. FAST, one comment. W7 is unassigned; take it and
say so in the PR, or hand it over if W7 gets a machine.

**T187 also targets `loaders/students.ts`** — `makeResolveStudentScope` (`:422`) and
`resolveStudentScope` (`:444`). `parentHome.ts` consumes the same factory, so widening its return is
*an export another session builds against*, an item 26 HEAVY trigger in its own right. **This is one
of the four W4/W5 shared rows, so with the pairing it now has one owner — you — except for the W7
file question.**

**T156 targets `loaders/loader.ts`, the shared spine.** Measured: **23 loader modules and 33 source
files** use `createLoader`/`runMutation`. Changing its error shape can break W1, W2 and W7 at once.
**Do not treat it as local.** Raise it with the owner; it may belong in W10.

**T200 targets `loaders/students.test.ts`** — W7's. One-assertion FAST fix.

## 6. W5's rows and start order — with a correction that matters

**Read `W5-KICKOFF.md` §5 in full.** Two things there are already corrected and must not be
re-derived:

- **T199 is NOT fabricated data.** `StudentHome.tsx:1768` binds the real `loadData =
  loadStudentHomeData` (`loaders/students.ts:550`), whose `makeLoadStudentHomeData` returns
  `events: []`, `sessions: []`, `rsvps: []`, `participation: null`. The ledger's own words:
  *"honestly empty," not fabricated.* **T199 is a missing feature**, and the first version of that
  kickoff was wrong to call it a wrong number on a live route.
- **T192 is real but explicitly acceptable** at this scale under item 25's proportionality, per its
  own ledger row. Do not spend a HEAVY cycle optimising it. **T328 sits on the same two-child parent
  path and is worth more** — the owner maintains that fixture precisely to exercise it.

**Suggested order across both workflows**, given the pairing:

1. **T205** — ruled, Ready, one line, real exposure.
2. **T322** — ruled, the headline correctness row.
3. **T187** — the only row that puts a wrong value in front of a real user today (a two-team student
   sees one team). Now unambiguously yours. **Every other reader has already migrated** to the
   `student_teams` junction (`membership_views.sql:63`/`:92`, `dashboard_views.sql:205-206`,
   `kpi_views.sql:256`), so it is a finishing move — but it edits W7's file, so settle that first.
4. **T199** — cheap, self-contained, entirely inside your own files.
5. Then the rest of the shared set (**T186, T201, T202**) as one wave, since they straddle the same
   view/screen boundary the pairing exists to resolve.

## 7. Everything else comes from `W5-KICKOFF.md`

Do not re-derive these; they are written up there and apply identically:

- **§6** — constitution item 26's three tiers. **HEAVY = packet + premise gate + worker + checker**,
  gate capped at two rounds, you personally replay every mutation, and **the gate must BUILD the
  prescription in its own worktree, not read it.**
- **§7** — verification standards: every criterion names a production mutation that turns it red and
  you run it yourself; paired assertions; the six gates with `.env.local` absent; assert exit codes,
  not just counts. **Includes the harness trap at `DashboardPage.test.tsx:36-46`**, which is in your
  files and which four consecutive tasks have fallen into.
- **§8** — git: task-scoped branches, own worktree, commit before mutating, **never `git add -A`**,
  PR + CI green, ledger row and verification-log entry written **before** the PR (item 24).
- **§9** — security: **no PII anywhere** (item 6, BLOCKER), never a service-role key, never the
  migration JSON exports.

**Three failure modes this project repeats, all of which have bitten the handoff you are reading:**
writing criteria against an **imagined harness**; **citing code that exists but never runs**; and
**recommending on a question already settled** — search `auto-mode-decisions.md` and the target
module's own doc header first.

**Do not write code in your first ten minutes.**
