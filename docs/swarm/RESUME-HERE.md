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
