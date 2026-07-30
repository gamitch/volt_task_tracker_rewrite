# Resume here — state of play at `claude/swarm-plan-zl575z` = `3e967e6`

Written 2026-07-30 so this session's context can be cleared without losing anything.
Fresh orchestrator session: read this, then `constitution.md`, then the open rows in
`task-ledger.md`. Everything is on disk; nothing important lives only in a conversation.

## Where the repo is

- **PR #2 is merged** and must not be reused. `main` = `f7ff055`.
- **PR #3 is open** (`claude/swarm-plan-zl575z` → `main`), carrying **16 merged tasks**.
- Gates measured green at `3e967e6`: `tsc` exit 0 · eslint **0 errors / 356 warnings** ·
  **68 files / 1631 tests** · prettier clean · `vite build` ✓.
- One worktree is deliberately preserved: `.claude/worktrees/agent-a640406e50762373c`
  (T144's contrast evidence, D011). **Do not delete it.** All others cleaned up.

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
2. **T169** — `RsvpControl` on both surfaces (owner-ruled). The `OutreachDetail` half can go
   now; the student half is **unblocked** too, since T170 landed.
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
| T169 | **silent data loss** — a student RSVPs, sees it apply, and it is discarded on reload. Owner-ruled, both surfaces, both halves now unblocked. |
| T177 | the calendar-feed subscribe link points at a non-existent host **and** the feed row is a fixture — both halves fake |
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
