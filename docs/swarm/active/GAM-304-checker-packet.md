# GAM-304 (T809) — checker packet

**Tier:** HEAVY (item 26). You are the separate acceptance checker the tier
requires. The worker does not self-certify and neither does the orchestrator;
your verdict is what lets this reach a PR.

**Artifact under review:** commit `4460dec` on `claude/gam-304-rsvp-write`.
**Your worktree:** `/tmp/gam304-check` (already created at `4460dec`, branch
`claude/gam-304-check`, `node_modules` symlinked). Mutate **only** there — item
23. Never touch the shared tree at
`/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite`, which
you may read freely.

**Packet the worker was given:** `docs/swarm/active/GAM-304-worker-packet.md`
revision 3. Read it. It was **never gated to DISPATCH** — the item 19a two-round
cap was reached with a REVISE, and the human owner authorized dispatch on the
ungated revision anyway. **You are the compensating control for that decision.**
The two gate verdicts are at `GAM-304-premise-gate-round1.md` and `-round2.md`.

## §0 — attack the three least confident decisions FIRST

The owner's ruling names this as the basis on which dispatch was authorized:
the residual risk is concentrated in the packet's three least-confident
decisions (worker packet `:478-514`). Do these before anything else.

1. **`isLoading` + `isDisabled` under plain `onClick` delivers the affordance on
   the real row components**, not on round 2's purpose-built probe. Wrong if
   `ListItem`'s `endContent` slot or `MoreMenu`'s trigger swallows or overrides
   either prop. Measure it on `SignupOpportunityRowItem` / `NextUpRowItem` as
   written.
2. **`MoreMenu.isDisabled` is the right lever for the Next-up row** rather than
   per-entry `DropdownMenuOption.isDisabled`. `astryx-api.md:4822` documents it
   as disabling the *trigger*. Wrong if that traps focus or reads as the whole
   row going dead. The worker reports it renders `aria-disabled`, not native
   `disabled`, so focus order survives — **verify that yourself in the DOM**,
   do not take the report.
3. **Criterion 7's sibling-row assertion is writable against the default
   fixtures** — needs ≥2 rows on one render. The worker reports this measured
   unfounded (existing `buildDataFixture` overrides cover it, no new fixture
   invented). Verify.

## §1 — independently verify the worker's three deviation findings

The worker deviated from the packet three times and disclosed each. Disclosure
is not proof. **Verify each by execution, not by reading its description.**

1. **`SupabaseLoaderError` is not an `Error` instance**, so the packet's
   prescribed `error instanceof Error` catch (copied from T193) would have shown
   the generic fallback for exactly the `SupabaseNotConfiguredError` that
   criterion 1 exists to prove reaches the banner. Worker replaced it with a
   disclosed `extractRsvpErrorMessage` using `isSupabaseLoaderError`. Probe the
   real rejection value. If this is right it is a genuine packet defect found by
   execution and should be recorded as such; if the helper is wrong, say so.
2. **Criterion 7's "clicked button shows `isLoading`" half is structurally
   unobservable** — React batching commits the optimistic override and the
   in-flight flag together, and `getUnansweredOutreachOpportunities` treats an
   answered RSVP as no-longer-unanswered, so the clicked row leaves the tree in
   the same commit. Worker asserted only the sibling-disable half and documented
   the rest. **This is a partially unmet acceptance criterion.** Decide whether
   the reasoning holds and grade it; do not wave it through and do not accept a
   fabricated assertion in its place.
3. **`viewerProfileId` not added to `ResolvedStudentHomeViewProps`** because
   `viewer.id` already existed there. Confirm the type surface is honest.

## §2 — replay the mutations

Replay criteria **1, 2, 3, 5 and 7** from the packet's table (`:436-444`) in
your worktree. Commit before mutating, capture the **real** red output and its
nonzero exit code, restore, and re-confirm green. A criterion whose mutation
leaves the suite green is not evidence — report that instead of passing it.

Criterion 2 has already been replayed independently by the orchestrator
(`respondedBy: viewerProfileId → studentId` → real red at
`StudentHome.test.tsx:1181`, exit 1). Re-run it anyway if cheap; if you are
short of time, prioritise **1, 5 and 7**, which nobody outside the worker has
replayed.

## §3 — the responder-threading defect class

This is what decides the task. Both write policies on `rsvps` require
`responded_by = auth.uid()` (`20260717000002_rls.sql:205-212`), and
`makeSubmitRsvpChange` never re-derives it. A wrong `responded_by` is **denied**
by RLS (`42501`), not saved wrong — so an optimistic UI that says "saved" while
the row never landed is item 26's "lie to a user about their own data".

Check both surfaces: `StudentHome` writes `studentId` = the student and
`respondedBy` = the viewer's profile id; `ParentHome` writes `studentId` = the
**child** and `respondedBy` = the **parent**. Round 1's gate proved all six RLS
paths on a scratch PostgreSQL cluster — quoted in `-round1.md`, do not re-run.

## §4 — boundary, regressions, and the standing BLOCKER

- **Allowed Files, nothing else:** `src/pages/home/{StudentHome,ParentHome}.tsx`
  and their `.test.tsx`. `loaders/outreach.ts`, `supabase/migrations/**`,
  `src/pages/outreach/**`, `docs/swarm/**`, `.claude/**` are forbidden.
- **`Button.clickAction` must not have been reintroduced.** Round 2 proved it
  runs inside `startTransition(async …)`, killing the optimistic paint and
  leaving the concurrency guard inert. The owner's BLOCKER stands. Plain
  `onClick` only.
- **Count deltas are not sufficiency.** The standard the packet sets
  (`:470-476`): *every pre-existing RSVP-interaction test must still assert a
  state the app actually holds after the write settles* — a test can stay green
  by racing a rejection. **Name the RSVP-interaction tests you checked against
  that standard**, not just the totals.
- Item 12's four async states and item 27 (the surface reads/writes the real
  source, not a stub) both apply.

## §5 — gates

```
npx tsc --noEmit ; echo $?
npx vite build ; echo $?
npm run format:check ; echo $?
npx eslint . ; echo $?
npx vitest run ; echo $?
npx vitest run src/pages/home/ ; echo $?
```

Baseline: full suite **2156**, `src/pages/home/` **219**, eslint 0 errors.
Worker reports 2162 / 225, and the orchestrator re-ran all six independently and
got the same. Assert exit codes directly, not through a pipe.

## Verdict

Return the Evidence Requirements the constitution demands: files inspected,
commands run, relevant output, pass/fail, exact failure reason, **severity per
finding** (BLOCKER / MAJOR / MINOR / NIT), and recommended next action.

Decision rules: BLOCKER or MAJOR fails the task; MINOR passes with a follow-up
filed; NIT is logged. End with **PASS** or **FAIL** on its own line.

Report the truth including "the worker was right and I could not break it."
A checker that manufactures a finding to look diligent costs a rework cycle.
