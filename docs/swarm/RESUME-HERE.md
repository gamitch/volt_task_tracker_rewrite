# Resume here — state of play at `main` = `94267a0` (2026-07-31 update below the line at §"UPDATE")

Written 2026-07-30 so this session's context can be cleared without losing anything.
Fresh orchestrator session: read this, then `constitution.md`, then the open rows in
`task-ledger.md`. Everything is on disk; nothing important lives only in a conversation.

**A 2026-07-31 update sits near the top of this file (search "UPDATE — 2026-07-31") — read
it before acting on anything below that predates it, since branch/PR state and the triage
proposal's T169/T177 rows have both moved since this file was first written.**

## UPDATE — 2026-07-31 (latest): T196/T197 collision resolved, `main` now carries T178 too

A **parallel session** operating on `main`/`claude/swarm-plan-zl575z` merged **PR #7 (T178)**
while this session was mid-flight on `claude/t183-student-home-loader` (PR #6) and flagged, via a
note relayed through the human owner, that both sessions had independently filed **T196 and T197**
for two entirely different tasks each — "next free number" is read from a file two branches edit
independently, so it was never actually a reservation.

- **`main` = `534bdbf`, carrying T178 (real end-meeting backend; mount deliberately parked as its
  own T196, blocked on `LiveConsole`'s own loaders becoming real).** `main`'s T196/T197 are now
  canonical (they landed first): **T196** = the parked `EndMeetingDialog` mount (blocked, data-loss
  risk), **T197** = `onEditAttendance` row-scoping unasserted (must land together with T196, not
  before).
- **This branch's own T196/T197 (filed while packeting T183) have been renumbered to T199/T200**
  in `task-ledger.md`/`verification-log.md` here — **T199** = `StudentHome`'s deliberately-deferred
  `events`/`sessions`/`rsvps`/`participation` real-loader work, **T200** = the MINOR
  `students.test.ts` assertion-tightening follow-up. T198 (this branch's own `CoachHome`
  team-linkage product question, filed while packeting T173) did not collide and keeps its number.
  **All four original rows are real and none were dropped** — this was a pure renumbering on this
  branch's copy, not a resolution-by-picking-a-side.
- **PR #6 is now behind `main`** (based on `a3b9f00`; `main` has moved to `534bdbf` via PR #7).
  It will need an update-from-`main` before it can merge, and that update **will conflict** on
  `task-ledger.md` (the T196/T197 numbers, now resolved by the renumbering above — take this
  branch's T198/T199/T200 rows AND main's T196/T197 rows, don't drop either side) and on this
  file's own top section (both branches independently inserted a dated UPDATE at the same anchor
  point — keep both blocks, don't pick one).
- **Two corrections to the still-open triage proposal further down this file**, both measured
  rather than guessed, from the same parallel session's work on T178: the "T178/T179/T180 — three
  finished components mounted nowhere" framing held for only one of the three.
  - **T179** (`MarkDayCompleteDialog`) is a real wiring gap, but not a simple mount: its
    persistence seam is already real (`markDayComplete`, shipped by T101), but four other props
    (`session`, `roster`, `rsvps`, `currentUserProfileId`) still default to fixtures/a placeholder.
    Mounting it as-is risks one forgotten prop writing real attendance rows for fixture students —
    T151's required-prop mechanism needs to land first.
  - **T180** is genuinely cheap and low-risk: all three of its seams already default to real
    loaders, and it's read-only. It was also **missing from every triage table entirely** — the
    proposal's "37 → 16" result should have been "37 → 17."
- **Backlog as it actually stands, this update:** of the ten original user-facing rows, seven have
  closed (T169, T177, T178, T183, T173, T191, and now **T158** — all merged on their own branches,
  T183/T173/T191/T158 on `claude/t183-student-home-loader`/PR #6, not yet merged to `main`). T173
  PASSED with 4 NIT (residue covered by T198); T191 PASSED with 3 NIT (residue filed as T202); T158
  PASSED with 1 MINOR (residue filed as T205, owner-ruled "close it off," not yet dispatched).
  Remaining: T179, T180, T189, plus the residue rows (T193, T194, T195, T198, T199, T200, T201,
  T202, T203, T204, T205, and whatever T178/T179's own follow-ups turn out to be) — **T158's own
  embed half, T203, is the most natural next pick** (its design/CSS-hazard investigation is already
  written into the row). **The triage proposal's cuts are still unapplied and still awaiting the
  owner's veto** — this update doesn't apply them either.
- **T173 also hit item 19a's 2-round cap — twice, on the same packet** (two separate
  owner-authorized bounded exceptions, both proven narrow by execution rather than open design
  disputes; see its `verification-log.md` entry and `auto-mode-decisions.md`). Adopted a cheaper
  design mid-packeting (thread `defaultGoalHours` from `activeSeason.season`, matching T176's
  shipped pattern) rather than a third Supabase query. `teamId` deliberately unresolved, filed as
  **T198** (product question, not a schema gap to guess at).
- **T191 was a genuine open product question, not a mid-flight gate escalation** — `RESUME-HERE.md`
  had already flagged it under "Awaiting the owner's answer" before this session began. George
  chose "no bar at all" over a season-default number (the latter would have needed a new SQL view
  and opus tier). Its own packet then hit item 19a's cap once (1 MAJOR: a naive page-wide
  progressbar count would have been vacuous by fixture coincidence — `ConsistencyStrip` renders its
  own bar independent of `isActive`, and both test fixtures happened to pin `participation: null`;
  fixed via a selector scoped to the Hours-vs-goal section specifically). Split off **T201**
  (`confirmedHours`/`is_active`, undiagnosed scope, same posture as T189) and **T202** (a sibling
  `ProgressBar` clamp elsewhere still fabricates `aria-valuemax` for assistive tech).
- **T158 was the highest-scrutiny task this session — a new database migration.** Split into the
  real data layer only (this row) vs. the embed (**T203**), since item 18's migration trigger
  forces opus/full-gate regardless of the UI half's size. Hit item 19a's 2-round cap **twice on one
  packet** (both owner-authorized): round 1→2 fixed a false supporting claim (only 1 of 3 cited
  "already-queried" views actually was) and extended the RLS trace to the loader's own unfiltered
  `v_student_hours` read; round 2→3, George asked a clarifying question about why a scratch Postgres
  was needed before authorizing (recorded in `auto-mode-decisions.md`), closing a vacuous
  live-DB-proof criterion. **The core RLS/view-visibility mechanism was empirically verified four
  times by three different agents** (`@electric-sql/pglite`, an in-process WASM Postgres, ~40s
  setup, no Docker) rather than reasoned about — this project had gotten a closely related RLS/view
  claim wrong twice before (`dashboard_views.sql`, then `loaders/students.ts`), so nothing here was
  taken on argument alone. **Follow-up: T205** — checker found the new view is also readable by
  Supabase's unauthenticated `anon` key (not just logged-in users), a different threat model than
  T185's already-settled "any authenticated caller" ruling; George ruled "close it off" (one-line
  revoke migration, not yet dispatched, needs its own full opus-tier gate per item 18 regardless of
  size). Also filed **T204** (a second, previously-undisclosed instance of the same stale-RLS-comment
  class T158 fixed once in `dashboard_views.sql`'s wake, found this time in `loaders/students.ts`).

## UPDATE — 2026-07-30 evening: T183 landed on its own branch, `main` unchanged

- **`main` is still `94267a0` / 69 files / 1654 tests** — nothing below in the 2026-07-31
  UPDATE section changed. T183 landed on a **separate** branch, `claude/t183-student-home-loader`
  (PR #6, draft, not yet merged into `main`), cut fresh from `main` for exactly this purpose.
  **On that branch only**, HEAD is `b21a603` and the suite is **69 files / 1660 tests** (+6, a
  disclosed, checker-ruled-correct delta from T183's own mandated new test coverage — see its
  `verification-log.md` entry). Do not read `1654` as the count on that branch, and do not read
  `1660` back onto `main` until it actually merges.
- T183 fixed `StudentHome`'s fabricated `'Ada Reyes'` greeting (real `students.display_name` now
  wired as the production default). Went through a full 2-round `checker-premise` cap (item 19a)
  — round 1 found a genuine BLOCKER, round 2 found only narrow packet-text mismatches after
  independently building and running the full fix clean — then one owner-authorized bounded
  revision round, same escalation shape as T177's earlier one this session. Follow-ups filed:
  **T196** (the deliberately-deferred `events`/`sessions`/`rsvps`/`participation` real-loader
  work), **T197** (MINOR test-assertion tightening).
- Same branch/PR is being used for T173, T191, T158 next (owner instruction, 2026-07-30) rather
  than opening a new branch per task — matching this project's own established convention of one
  PR accumulating several tasks before merging to `main` (see PR #3's 16-task history above).

## UPDATE — 2026-07-31: branch state, and two triage rows resolved

- **PR #3 and PR #4 are both merged into `main`.** `main` = `94267a0`, carrying everything
  through T177 plus the View As feature requirements/design docs (PR #4). No open PRs remain.
  `claude/swarm-plan-zl575z` (`f7e3143`) is content-equivalent to `main` but sits 2 commits
  "behind" it in graph terms — GitHub's PR-merge created `97398ff` on `main` directly, and a
  manual reconciling merge added `94267a0`, neither replayed onto the feature branch.
  Harmless, but `git pull origin main` into this branch before starting new work on it.
- Working tree clean. Gates re-measured green at `main`/`f7e3143`: `tsc` exit 0 · eslint
  **0 errors / 358 warnings** · **69 files / 1654 tests** (measured with `.env.local`
  **absent**, the mandated gate state) · `vite build` ✓. One pre-existing, unrelated
  `prettier --check` warning on `src/theme/volt.ts` predates this session (confirmed present
  at `fe62f88`, before any of today's commits) — not this session's to fix.
- **The `.claude/worktrees/agent-a640406e50762373c` preservation note above no longer
  applies.** That directory is empty in this checkout and `git worktree list` has no record
  of it — specific to whatever filesystem wrote the note, not something deleted here.
- **T169 and T177 both landed** (see below), resolving 2 of the triage proposal's "KEEP — a
  user hits this" rows. **The rest of the triage proposal (further down this file) is
  unchanged and still awaiting the owner's veto** — do not treat T169/T177 landing as any
  kind of signal about the other rows in that proposal.

### Landed 2026-07-30/31

- **T169 (OutreachDetail half) — merged `18b481c`.** PASS, attempt 1, no BLOCKER/MAJOR/MINOR
  (2 NIT, log-only). Mounted `RsvpControl` role-gated beside T157's `ParentRsvp` for the
  signed-in student's own roster row, via a new `resolveOwnRosterStudent`. 2 rounds of
  `checker-premise` (round 1 REVISE on a scope claim that went stale mid-session — T170 had
  merged — round 2 DISPATCH). **Follow-up filed: T193** — the `OutreachList.tsx` student
  half of T169 (the other row referenced in the old triage table below), now genuinely
  unblocked since T170 supplies a real `viewerStudentId`. Not yet packeted.
- **T177 — merged `18b481c` (source work), reconciled onto `main` at `94267a0`.** PASS,
  attempt 2 (attempt 1 FAILed on 1 MAJOR: a new test wasn't actually hermetic to the
  env-injection claim it made). Wired a real, injectable Functions-URL resolver and a new
  `loaders/calendarFeed.ts` replacing a placeholder host and a fixture feed. **Heaviest
  premise-gate history of any task yet** — 2 REVISE rounds (3 BLOCKER/2 MAJOR, then 1 new
  BLOCKER/2 new MAJOR introduced by the first round's own fixes), hit item 19a's 2-round
  cap, escalated to the human owner, who authorized one bounded revision-round exception
  (recorded in `auto-mode-decisions.md`, "George's ruling on T177's item-19a escalation" —
  a **structured-selection** ruling, not a verbatim quote; the entry says so explicitly).
  **Follow-ups filed: T195** (nothing anywhere provisions a `calendar_feeds` row — the real
  remaining gap; T177 makes the widget's failure *honest*, not the feature *functional*) and
  **T194** (`onResetFeedToken`, same defect family, sequence after T195).
- **Both merged via a deliberate test of running the packet → premise-gate → worker →
  checker pipeline through subagents**, to see whether it reduces context growth in the
  orchestrating session. **It worked** — each stage ran in its own subagent transcript; only
  dispatch prompts, file reads, and final summaries landed here. Worth repeating.
- **PR #3 and PR #4 both required manual intervention to merge.** PR #3 was initially
  blocked by GitHub's stacked-PR restriction (PR #4 had it as a base) — no CLI/API
  workaround found; the owner unstacked both in the GitHub UI, after which the normal merge
  API worked. PR #4 merged into the *feature branch* (its base ref), not `main`, so `main`
  needed a **second, separate, real merge** afterward (a raw fast-forward push was rejected
  as non-fast-forward, since `main`'s own PR-merge commit had diverged from the feature
  branch in the interim).

### New rows filed this session (not part of the pre-existing triage proposal below)

- **T193** — `OutreachList.tsx`'s student-facing RSVP control (T169's other half). A
  reusable pattern already exists from T169's OutreachDetail half — the packet should
  evaluate whether it transfers directly.
- **T195** — the `calendar_feeds` provisioning gap. Likely needs a migration (item 18
  trigger 1 → opus tier) alongside `fn_handle_invite_acceptance`. Sequence before T194.
- **T194** — `SubscribePopover.tsx`'s `onResetFeedToken`, same fixture-default defect family
  as T177 just fixed, one function over. Sequence after T195.

### New process lessons this session

- **A `git stash`/`git stash pop` cycle mid-merge silently destroys `MERGE_HEAD`.** Paid for
  on T177's merge: after `git merge --no-ff --no-commit`, a stash-and-pop used to spot-check
  an unrelated pre-existing prettier warning cleared `.git/MERGE_HEAD` without any error
  message, and the subsequent `git commit` landed a **single-parent commit** — correct file
  content, wrong lineage. Caught only by checking `git log --pretty=%P` out of habit. Fixed
  via `git commit-tree` with the correct two parents against the already-correct tree,
  rather than redoing the work. **Rule: never run `git stash` between `git merge --no-ff
  --no-commit` and the final `git commit`** — use a disposable worktree for any mid-merge
  spot-check instead.
- **GitHub's stacked-PR restriction blocks the merge API, not just a UI button.** PR #3
  couldn't be merged via `gh pr merge` while PR #4 (open, based on PR #3's head branch)
  existed. No workaround found short of the owner unstacking both in the GitHub UI. Check
  for other open PRs based on the same head branch before attempting a PR merge.
- **Merging a PR whose base is a feature branch (not `main`) does not update `main`.** Needs
  a second, real merge afterward — not something the original PR's merge does for you, and
  a raw ref push will be rejected non-fast-forward if `main` has since diverged.
- **The subagent-pipeline dispatch pattern measurably reduces orchestrator context growth**
  — validated deliberately as a test on T169 and T177. Default to it for future tasks.

---

## Where the repo is (as of 2026-07-30 — see the 2026-07-31 UPDATE section above for what changed)

- **PR #2 is merged** and must not be reused. `main` = `f7ff055`.
- **PR #3 is open** (`claude/swarm-plan-zl575z` → `main`), carrying **16 merged tasks**.
- Gates measured green at `3e967e6`: `tsc` exit 0 · eslint **0 errors / 356 warnings** ·
  **68 files / 1631 tests** · prettier clean · `vite build` ✓.
- One worktree is deliberately preserved: `.claude/worktrees/agent-a640406e50762373c`
  (T144's contrast evidence, D011). **Do not delete it.** All others cleaned up.
  **[2026-07-31: this worktree does not exist in the current checkout — see UPDATE.]**

## The headline: both defect families that produced every real bug are now closed

**1. Fabricated dashboards — CLOSED.** All three role dashboards rendered fixture data on
live routes. `CoachHome` (T155), `StudentHome` (T176), `ParentHome` (T181). All three now
show real data. Residuals are filed, not forgotten: T173, T183, T191.

**2. Placeholder-default props — mechanism closed on the dialogs.** T151 made `teams`
required and deleted all three fixtures, so a forgetful call site **cannot compile**.
T170 and T176 fixed the two live-route instances. T172 remains: generalise the mechanism.

## Landed this session (16 tasks)

T142–T151, T154, T155, T157, T170, T176, T181, T184. Full detail per task in
`verification-log.md`; every merge carries its ledger row in the same commit (item 24).

**User-visible fixes the owner reported or would notice:** the dashboard `22P02` failure
(T155), meeting creation (T147), the light/dark control (T148), per-user theming (T154),
self check-off on `/outreach` — which was silently failing against a nonexistent student
(T170), and honest copy for a deactivated student (T184).

## Ready to dispatch, in priority order

1. **T158** — Leaderboard, embedded in the dashboard per the owner's ruling. **Unblocked**
   now T155 landed; `CoachHome` sources a real `seasonId`, so the embed inherits it free.
   Two units: build a real `loadLeaderboardData` (none exists), then embed. Note T155
   restructured `CoachHome` into an outer/inner split — older line citations are stale.
2. ~~**T169**~~ — **DONE 2026-07-31** (OutreachDetail half, `18b481c`). Other half re-filed as
   **T193**, still open — see the 2026-07-31 UPDATE section at the top of this file.
3. **T172** — the mechanism fix, and **it should now absorb the vacuous-absence problem**
   (see below), not just the placeholder-default one.
4. **T178/T179/T180** — three finished, tested components mounted nowhere, each with a
   "not shipped yet" stub still sitting at the intended host.

## Blocked on the owner, not on us

`T052`, `T063`, `T064`, `T065`, `T070` — production email, MIG-04 validation, cutover,
Vercel go-live. **These are what stand between this app and being used.** Everything else
is polish on something not yet deployed.

## Owner rulings — cite the record, never a paraphrase

All verbatim in `auto-mode-decisions.md`. Packets have falsely promoted the orchestrator's
decisions to owner authority **three times, two shipped**. Rule: an owner-approval claim must
cite a section of that file, or it is the orchestrator's decision and must say so.

On record: keep the localStorage seed · ratify the `CoachHome.test.tsx:1194-1196` amendment ·
fix the shared-browser theme bleed properly · embed the leaderboard in the dashboard ·
`ParentRsvp` in `OutreachDetail` · `RsvpControl` on **both** surfaces · a deactivated student
should not be able to log in, or failing that should see nothing · **proportionality**
(constitution item 25 — grade security findings against a small volunteer team, not a company).

## Awaiting the owner's answer

- **T188** — two "confirmed hours" numbers that can legitimately disagree, so one student can
  see different totals on two screens. Naming or reconciling is a product call.
- **T191** — a deactivated child's card shows `0 / 1 h`, where the `1` is a UI clamp artifact
  in no data source. Season default, or no bar at all?

## Hard-won process lessons — each was paid for

- **The vacuous-absence assertion is now structural, not careless.** Seven instances across
  six tasks — and the seventh was **inside a criterion explicitly written to prevent it**
  (T181 revision 1: "state this ordering so the criterion cannot pass by accident"; it passed
  with the entire bug restored). Declaring an ordering does not make an absence assertion
  safe. Only pairing it with a positive does. **T172 should absorb this.**
- **A criterion that cannot fail is worse than no criterion.** Prescribe the mutation, run it,
  report the failure output. Watch for fixture collisions where the "real" and mutated values
  are the same string — that killed a T176 criterion outright.
- **Cite by symbol, not line number.** Ten-plus citation errors reached artifacts in one day,
  mostly line numbers lifted from grep output without checking which construct they belonged
  to. See `architecture-review-parallelism.md` §3.1.
- **Do not describe a screen from reading code — render it.** Three successive descriptions of
  one screen were wrong; every correction came from an agent that dumped the DOM.
- **Verify the fix's premise, not just its logic.** T154's prescribed remedy would never have
  fired — it assumed a non-null → non-null transition, but `logout()` sets `user: null` first.
  Measured: a green suite with the bug intact.
- **A false claim in a module doc has the same reach as one in a packet, and nothing gates
  module docs.** "MET-04's denominator has no SQL view" appeared in five artifacts and cost
  T176 a full round; it was still sitting in `ParentHome.tsx` when T181 started.
- **Agent worktrees are cut from `main`, not the branch tip — merge the branch in first.**
  T157's worker built ~320 lines against a superseded packet revision for want of this check.
- **Mutations run in the agent's own worktree** (item 23), never the shared tree.
- **Dispatch a gate that can write.** `checker-premise` has Bash but no Write/Edit, so it
  cannot run prescribed mutations. Gates that found BLOCKERs were general-purpose agents with
  write access in their own worktree.
- **Gate proportionately (item 25).** T151 skipped a gate (mechanical, compiler-enforced) and
  passed clean; T170 got a narrow one and it found a BLOCKER; T181 got a full one and it found
  two. Match the round to the risk, not to the topic.

---

# TRIAGE PROPOSAL — 2026-07-30, awaiting the owner's veto

**Written because the process was generating work faster than it closed it.** The owner
measured it: 27 open rows this morning, 37 by evening, 5 tasks merged in between — **2 new
rows filed per task merged** — against **54% of the token allowance spent**. T181 alone cost
roughly **1.1M tokens** (foreman 187K + gate 164K + foreman revision 267K + worker 346K +
checker 132K). At that rate the backlog never closes and the app never ships.

**The cause is a policy I chose and never checked with him:** checkers are instructed to find
things, and I filed *everything* they found. Most of those rows are artifacts of reviewing, not
defects a user meets.

**Nothing below is executed. The owner vetoes individually, then a session applies it.**

## Rule applied

A row survives only if **a user hits it, or it blocks deployment.** Everything else closes —
closed, not deferred. If a closed item ever bites, it gets re-filed with a real symptom
attached, which is cheaper than carrying it.

## KEEP — the deployment path (5). Only the owner can move these.

| Row | Why |
|---|---|
| T052 | production email enablement — HUMAN GATE |
| T063 | MIG-04 validation gates + sign-off — HUMAN GATE |
| T064 | roster → accounts post-migration verification (MIG-05) |
| T065 | MIG-06 cutover — HUMAN GATE |
| T070 | Vercel domain go-live — HUMAN GATE |

**The app is not deployed.** Polish on an undeployed app is unbounded, which is the real reason
the backlog grows. These five are the only path to "finished".

## KEEP — a user hits this (9)

| Row | Why |
|---|---|
| T169 | **RESOLVED 2026-07-31, merged `18b481c` (OutreachDetail half).** The `OutreachList` half is re-filed as **T193**, still open. |
| T177 | **RESOLVED 2026-07-31, merged (see UPDATE section above).** Provisioning gap it exposed is re-filed as **T195**; `onResetFeedToken` as **T194**. |
| T183 | `Hi Ada Reyes` greets every real signed-in student |
| T173 | `CoachHome`'s three fabricated surfaces (`0 / 38 hrs`, `Default goal 10h`, admin Season-setup card) |
| T191 | a deactivated child's card shows a `1 h` goal that exists in no data source |
| T158 | Leaderboard — owner-ruled to embed in the dashboard; unblocked |
| T178 | `EndMeetingDialog` built, tested, mounted nowhere — host still shows a "not shipped yet" banner |
| T179 | `MarkDayCompleteDialog` same shape — a real coach workflow action |
| T189 | `MeetingsList` participation reads an `is_active`-filtered view; **impact genuinely unknown** — investigate, then fix or close |

## KEEP — cheap and pays for itself (2)

| Row | Why |
|---|---|
| T156 | the loader throws away the real Postgres error. This is why diagnosing the dashboard bug needed DevTools and a screenshot. Makes every future bug cheaper. |
| T175 | add `format:check` to CI — minutes of work, closes a silent-drift class |

## CLOSE — process artifacts, no user impact (13)

| Row | Why it closes |
|---|---|
| T152 | a test guard that discriminates in one direction. No user meets a half-strength guard. |
| T171 | a true property that no test pins. The code is correct. |
| T190 | fixture id-space rekeying so *future* tests are discriminating by construction |
| T174 | `FIXTURE_RSVPS` id-space confusion — fixture-only |
| T186 | a view column's comment says display-only. A comment. |
| T160 | a type is still called `FixtureTeam`. Cosmetic. |
| T182 | delete `StudentHomeSlot.tsx` — dead code hurting nobody |
| T187 | dual-team narrowing, deliberate and disclosed. **Re-open when a student actually joins two teams.** |
| T192 | per-card full-table reads — fine at one team, one season (item 25) |
| T168 | the placeholder sweep. **The audits are done**; both families were found and closed. |
| T172 | the mechanism fix. T151 already made the dialogs compiler-enforced and every known instance is fixed; this now only prevents hypothetical future ones. |
| T144 | already closed as no-change (D011) — listed so it is not re-opened |
| T153 | already ruled by the owner (keep the seed) — listed so it is not re-opened |

## CLOSE — test coverage (7)

**T161, T162, T163, T164, T165, T166, T167** — seven loader files with no unit tests.

The risk is real and the cost is not worth it here. The suite is already **1631 tests**, and
every loader bug that actually mattered this project was caught by the owner using the app, not
by a unit test. **If a loader bug bites, write that loader's test then**, with a real symptom to
target. Carrying seven speculative rows costs more than it saves.

## ASK THE OWNER — one line each (2)

| Row | The question |
|---|---|
| T188 | Two "confirmed hours" numbers exist and can legitimately disagree — attendance-backed vs RSVP-backed — so one student can see different totals on two screens. Rename them, or make outreach read the attendance number? |
| T191 | (also in KEEP) A deactivated child's goal bar: season default, or no bar at all? |

## Result if accepted

**37 open → 16**, of which **5 are the owner's deployment gates** and **2 are cheap
infrastructure**. Nine real user-facing items remain, most of them small.

## And the process change that matters more than the cut

**Match weight to risk — constitution item 25 already permits this and I under-used it.**

- T151: no premise gate, sonnet worker, `checker-tests`. **Passed clean, roughly a tenth of
  T181's cost.** That should be the default.
- T170: narrow gate — found a BLOCKER. Worth it.
- T181: full gate — found two BLOCKERs. Worth it, but a 1.1M-token task.

**Reserve foreman + gate + opus checker for live-route bugs.** Everything else: packet, worker,
cheap checker. And **stop filing findings as rows** — a checker's observation gets fixed in the
moment or dropped, unless a user meets it.
