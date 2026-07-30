# T184 — Worker Packet

**Pinned to branch tip `d74dc20` on `claude/swarm-plan-zl575z`.** All citations
below were read directly at that SHA by `foreman-planner`. **Your worktree is
cut from `main` and has none of today's work, including this packet.** Before
touching anything:
```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```
Report the merge result (fast-forward or not, resulting SHA) in your output,
same as T176's and T170's workers did. If it does not fast-forward cleanly,
stop and report rather than resolving conflicts silently.

**Attempt: 1 of 3** (constitution Loop Limit — a 4th attempt escalates to
`boss-arbiter`). **Tier: worker-implementer, sonnet — checker-reviewer, opus.**
Reasoning in §9.

**A `checker-premise` gate is required on this packet before it may be
dispatched (constitution item 19) — this packet has NOT been gated yet.**
`foreman-planner` recommends a **full** gate, not a light one (item 19b): the
three-way identity state this packet introduces is a genuinely new DES-12
bucket for this file, not a proven pattern rolled out to a new surface, and
this exact file family has produced a mutation-proof vacuity failure in
**every** premise/checker round run against it so far — twice on T176, once
on T170 (cited in §6). Do not treat this packet as ready until a gate has
returned DISPATCH on it.

## 1. Objective

`StudentHome.tsx`'s identity-resolution tier collapses two different facts
into one `null` and one piece of copy. Today, for a real signed-in student:

- **No `students` row is linked to her profile at all** → `resolveStudentId`
  (`resolveCurrentStudentId`, `loaders/meetings.ts:491-501`, no `is_active`
  filter) resolves `null` → **correct**, "No student account linked yet" is
  true.
- **A `students` row IS linked, but `students.is_active = false`**
  (deactivated) → `resolveStudentId` resolves her real id (that query has no
  `is_active` filter), but `resolveStudentScope`
  (`loaders/students.ts:398-408`, reading `v_student_goal_projection`, which
  ends `where s.is_active` — `dashboard_views.sql:334`) then resolves `null`
  → `StudentHome.tsx:1644-1653` renders the **same** "No student account
  linked yet" `EmptyState` (title `:1649`, description `:1650`). **This copy
  is false for her**: a record exists and is linked; she was deactivated.

Fix: make `resolveStudentIdentity` (`StudentHome.tsx:1526-1562`) distinguish
these two cases and give the second one its own, honest, distinct copy — not
a reuse of either existing empty-state message on this page.

## 2. Owner ruling, and why this is the shape it authorizes — read before designing

George's ruling (`docs/swarm/auto-mode-decisions.md`, "2026-07-30 — George's
ruling on T184", verbatim): *"A deactivated student should not be able to
login, if not possible, they should see nothing when they login."*

**That ruling settles the behaviour and nothing else.** Everything below this
line is the orchestrator's reading, not George's, and is recorded as such —
three packets on this project have previously misattributed an orchestrator
decision to the human owner (`auto-mode-decisions.md`, T148/T149/T154
entries); do not repeat that in your own output.

**Investigated: can a deactivated student sign in today? Yes — nothing blocks
it.** Traced `src/app/guards.tsx` end to end (read-only, do not edit):
`AuthProvider`'s `resolveSessionToAuthState` (`:180-208`) calls
`authModule.resolveRole(session.user.id)`, which is
`src/lib/supabase/auth.ts:296-314`'s `resolveRole` — it reads **only**
`profiles.role` (`select('role').eq('id', id)`). `students.is_active` is a
different table's column and is never read anywhere in `guards.tsx` or
`auth.ts` (grep-confirmed: neither file contains `is_active`). So Supabase
auth succeeds, `RequireAuth`/`RequireRole` both pass (she has a valid
`profiles` row with `role: 'student'`), and `DashboardPage.tsx:117-122`
routes her to `<StudentHome />` purely on `user.role` — `is_active` is
invisible to every layer between sign-in and this page.

**Three outcomes were named in the brief. This is outcome 2: only
enforceable by editing a Forbidden File, so the ruling's fallback ships.**
Blocking sign-in itself would require `resolveRole`/`AuthContextValue`/
`RequireAuth`/`RequireRole` to know about `students.is_active` — all of that
lives in `guards.tsx` (and `resolveRole` in `auth.ts`, which `guards.tsx`
wraps), and `guards.tsx` is this packet's Forbidden File. **Not a silent
substitution** — George's own ruling names this exact fallback as his second
choice, in the same sentence, in advance.

**Where the fallback lands, and why NOT `NoAccessPage`/`AccessDeniedPage` —
this corrects the orchestrator's own earlier reading.** The brief's working
assumption was that the existing `NoAccessPage`/`AccessDeniedPage` surfaces
(`guards.tsx:440-441`, `:495-501`) were the natural landing spot. Read both
(`src/pages/no-access/NoAccessPage.tsx`, `AccessDeniedPage.tsx`) and neither
fits:

- **`NoAccessPage`'s copy is false for this user too** — "You're not on the
  roster yet" / "We couldn't find an invite or profile for your account"
  (`NoAccessPage.tsx:316-317`). She has a profile and a roster record; she
  was deactivated. Using it would trade one false statement for another.
  It also unconditionally signs the session out on mount (`:285-287`) — not
  asked for by the ruling, and a real, disclosed behaviour change beyond
  "see nothing."
- **`AccessDeniedPage` is worse: it would loop.** Its copy ("This page isn't
  part of your role", `AccessDeniedPage.tsx:92`) is also inaccurate — this
  isn't a role mismatch. And its one action is `<Link href="/">Go to your
  dashboard</Link>` (`:95-97`, `DASHBOARD_PATH = '/'`) — `/` is exactly
  `DashboardPage`, which routes her straight back to `<StudentHome />`,
  which is the page with the problem. That is a dead-end redirect loop for
  the exact user this task is about.

**Decision (mine, not George's): the fallback ships as a new, distinct
`EmptyState` inside `StudentHome.tsx` itself**, not a reroute to either
existing no-access surface. It satisfies "sees nothing" — no dashboard data,
no functional content, nothing `StudentHomeContent` would otherwise render —
with copy that is actually true, using the same `EmptyState`/`VStack`
composition this file already uses for its five other DES-12 states
(constitution item 13 — adapt content, don't invent a new layout).
**Draft copy below; check PRD DES-14–16 before finalizing** the exact
wording, same discipline T170's packet applied to its own new copy:

> Title: **"Your student account is inactive"**
> Description: **"Your student account has been deactivated. If you think
> this is a mistake, contact your coach or team admin."**

This must not share text with any of this page's other five empty/error
states (§6, criterion 4) — that is what makes "sees nothing" verifiable
rather than a description of the intent.

## 3. Two facts established before scoping — do not re-derive, but do
re-verify the reasoning

**(a) Sign-in is not blockable in scope — established in §2.**

**(b) Does the same disagreement exist on `OutreachList.tsx`? No — already
investigated and settled by T170's own packet, independently.** T170's
packet §3d (`docs/swarm/active/... T170 revision 2`, already merged into
this branch's history) traced this exact question for `/outreach` and
found: `queryStudentIdByProfileId` (same function, `loaders/meetings.ts`)
is `is_active`-agnostic there too, but `OutreachList` has **no second,
further-scoped query** analogous to `v_student_goal_projection` — its
personal figures (`computeStudentHours`, `getUnansweredRsvpCount`,
`computeEventRowStats`, `myGoalHours`) are pure client-side filters over
already-loaded season data, not a second Supabase read gated on
`is_active`. It also traced the write side (`SelfCheckoffDialog`'s
attendance insert/delete) against the `self_insert`/`self_delete` RLS
policies and `my_student_ids()` (`rls.sql:20-26`) and found those are
`is_active`-agnostic too, so nothing on that page silently rejects a
deactivated student's action either. **Conclusion, re-confirmed by reading
both files directly: this fix is `StudentHome.tsx`-only. `OutreachList.tsx`
needs no change for this defect and is Forbidden to you regardless (§4).**

**(c) A third instance was found while investigating, out of scope for this
packet, do not fix it — for the foreman/orchestrator's ledger, not yours to
act on.** `src/pages/meetings/MeetingsList.tsx` shares the identical
resolution seam (`resolveCurrentStudentId`, module doc citing T096) for its
own student view, and its participation figure reads
`v_student_participation` (`membership_views.sql:59-67`), which **also**
ends `where s.is_active`. Unlike `StudentHome`, a deactivated student there
would likely reach `StudentMeetingsView` (identity resolves non-null) with a
genuinely-empty participation row, landing in the page's existing "No
meeting history yet" copy (`MeetingsList.tsx:2349-2350`) rather than the
false "no record linked" copy — a **different, weaker** version of this
family, not verified end-to-end here and not this packet's job. State this
plainly in your own output as a discovered-but-undiagnosed instance; do not
investigate or fix it, and do not touch `MeetingsList.tsx` (§4).

## 4. Allowed / forbidden files

**Allowed:** `src/pages/home/StudentHome.tsx`, `src/pages/home/StudentHome.test.tsx`.

**Forbidden, in addition to the constitution's standing list
(`docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
`dispute-log.md`, `.claude/**`, `node_modules/`):**
- `src/app/guards.tsx` — Forbidden per this packet's own brief. See §2 for
  why the design does not need it.
- `src/pages/outreach/OutreachList.tsx`, `src/pages/outreach/OutreachList.test.tsx`
  — a T170 worker/checker pair is running against these in separate
  worktrees right now. Not needed anyway (§3b).
- `src/pages/home/CoachHome.tsx`, `src/pages/home/ParentHome.tsx` — not
  relevant to a student-role defect; standing exclusion from the brief.
- `src/pages/home/DashboardPage.tsx` — role dispatch stays untouched; the fix
  lives entirely below where this file already mounts `<StudentHome />`.
- `src/lib/supabase/loaders/meetings.ts` (`resolveCurrentStudentId` and
  `queryStudentIdByProfileId`) — **read-only reference, do not edit.**
  T170's in-flight worker also depends on this function's *current*
  (`is_active`-agnostic) behaviour for its own already-verified §3d
  conclusion (§3b above). Changing it here would silently invalidate that
  conclusion out from under a concurrent worker. The fix in this packet does
  not need to touch it: it derives the "inactive" case from
  `resolveStudentScope`'s existing `null` result (§5), not from a new
  `is_active` read.
- `src/lib/supabase/loaders/students.ts` (`resolveStudentScope`,
  `queryStudentGoalProjectionById`) — read-only reference, same reasoning:
  its existing `null`-on-no-row behaviour is the signal this fix consumes,
  not something it needs to change.
- `src/pages/meetings/MeetingsList.tsx` — read-only reference (§3c). Do not
  fix the instance found there.
- `supabase/migrations/**` — no schema/SQL change of any kind. The whole
  point of this design is that the distinction is derivable from two
  already-real seams' existing return values; adding a new query or column
  read would both violate constitution item 3 (no new metric/identity SQL
  duplicated in TS) and push this into item 18's migration/RLS tier for no
  reason (§9).

## 5. Design

Widen `resolveStudentIdentity`'s return type from `ResolvedStudentIdentity |
null` to a three-way discriminated union, keeping the successful shape flat
(minimizes the churn on the five existing tests that already assert against
it — see §6):

```ts
export interface ResolvedStudentIdentity {
  studentId: string;
  teamId: string;
  goalHours: number;
  confirmedHours: number;
  plannedHours: number;
}

export type StudentIdentityOutcome =
  | ({ kind: 'linked' } & ResolvedStudentIdentity)
  | { kind: 'not-linked' }
  | { kind: 'inactive' };

export async function resolveStudentIdentity(
  viewer: CurrentViewerIdentity,
  explicitStudentId: string | undefined,
  explicitTeamId: string | undefined,
  resolveStudentId: ResolveCurrentStudentIdFn,
  resolveStudentScope: ResolveStudentScopeFn,
  seasonDefaultGoalHours: number,
): Promise<StudentIdentityOutcome> {
  const studentId = explicitStudentId ?? (await resolveStudentId(viewer));
  if (studentId === null) return { kind: 'not-linked' };
  if (explicitTeamId !== undefined) {
    return {
      kind: 'linked',
      studentId,
      teamId: explicitTeamId,
      goalHours: seasonDefaultGoalHours,
      confirmedHours: 0,
      plannedHours: 0,
    };
  }
  const scope = await resolveStudentScope(studentId);
  if (scope === null) return { kind: 'inactive' };
  return {
    kind: 'linked',
    studentId,
    teamId: scope.teamId,
    goalHours: scope.goalHours,
    confirmedHours: scope.confirmedHours,
    plannedHours: scope.plannedHours,
  };
}
```

**Why `scope === null` with a non-null `studentId` safely means "inactive,"
not something else — re-derive this yourself against the live SQL, don't
just trust this paragraph.** `v_student_goal_projection`
(`dashboard_views.sql:322-334`) is `from students s join seasons se on
se.is_active left join ... where s.is_active`. `StudentHome`'s own
`activeSeason.status === 'ready'` gate (`:1748-1760`, unchanged by this
task) already guarantees an active season exists by the time this component
mounts, so the `join seasons se on se.is_active` half cannot be what empties
the row. With a `studentId` that `resolveStudentId` just confirmed is a real
row in `students`, the **only** remaining clause that can make this query
return zero rows is `where s.is_active`. **Disclosed, accepted risk, not
engineered around (proportionality, constitution item 25):** a race where
the active season changes between `StudentHome`'s season check and this
query is theoretically possible and would be misread as "inactive" for one
render; given this is a small volunteer team's app and the failure mode is
an honest-but-imprecise empty state (never fabricated data, never a crash),
state this in your output rather than building a fourth state to cover it.

In `ResolvedStudentHomeView` (`StudentHome.tsx:1586-1670`), replace the
`if (loadState.data === null)` block (`:1644-1653`) with:

```tsx
if (loadState.data.kind === 'not-linked') {
  return (
    <VStack gap={4} padding={6}>
      <EmptyState
        headingLevel={1}
        title="No student account linked yet"
        description="We couldn't find a student record linked to your account yet. Once one is linked, your Home will show up here."
      />
    </VStack>
  );
}

if (loadState.data.kind === 'inactive') {
  return (
    <VStack gap={4} padding={6}>
      <EmptyState
        headingLevel={1}
        title="Your student account is inactive"
        description="Your student account has been deactivated. If you think this is a mistake, contact your coach or team admin."
      />
    </VStack>
  );
}

const { studentId, teamId, goalHours, confirmedHours, plannedHours } = loadState.data;
```

The trailing destructure needs no `kind` field and no cast — TypeScript
narrows `loadState.data` to the `{kind:'linked', ...}` member once the two
`if` blocks above have returned.

Update the surrounding module-doc prose (`:1497-1506`,
`"resolve studentId ... bail to the empty state on null"`) to describe the
three-way outcome accurately — this file's own convention (every module doc
in this codebase records the real current shape) is not optional
housekeeping here; leaving stale prose describing a two-way `null` collapse
right next to code that no longer collapses it is exactly the kind of trap
this task exists to remove.

## 6. Existing tests this change requires you to touch — enumerated, not
discovered by you

**This packet requires amending existing, currently-passing tests.**
Flagged explicitly per the non-negotiable rule (existing tests must pass
unless authorized) — **this authorization is the orchestrator's, delegated
through `foreman-planner`, NOT George's**, on the same footing as the
T148/T149/T154 test amendments recorded in `auto-mode-decisions.md`. It is
necessary, not convenient: the five tests below assert the exact `null`
collapse this task is fixing, and cannot be made to pass alongside the new
behaviour without being told about the new return shape.
**`foreman-planner` flags this for the orchestrator to ratify before
dispatch — do not treat it as self-authorizing.**

All five are in `describe('resolveStudentIdentity (pure-ish, ...', ...)`,
`StudentHome.test.tsx:1074-1187`:

1. `:1075-1100` — add `kind: 'linked'` to the `toEqual({...})` object at `:1093-1099`.
2. `:1102-1127` — same, to the object at `:1120-1126`.
3. `:1129-1154` — same, to the object at `:1147-1153`.
4. `:1156-1174` ("returns null (no student linked) when resolveStudentId
   resolves null...") — change `expect(result).toBeNull()` (`:1172`) to
   `expect(result).toEqual({ kind: 'not-linked' })`. Title may be kept or
   lightly reworded; behaviour asserted must not change.
5. `:1176-1186` ("returns null when resolveStudentScope resolves null") —
   change `expect(result).toBeNull()` (`:1185`) to
   `expect(result).toEqual({ kind: 'inactive' })`. **Rename the test title**
   — it currently describes the exact bug this task removes and must not
   keep asserting it by name after the behaviour changes.

**Everything else in this ~88-`it(` file must need zero edits**, most
importantly the existing three-way isolation test at `:1473-1479` ("(iii)
null (no linked student): shows a distinct EmptyState..." — `resolveStudentId:
async () => null`). That test exercises the **`not-linked`** path only and
must stay green with **zero** modification — if your diff touches it, you
have changed the wrong branch. State the diff on that describe block
explicitly in your output (expect empty).

If your implementation requires touching any `it(` block not listed above,
stop and report which one and why before proceeding — same discipline T170's
packet §3b established for its own blast-radius accounting.

## 7. Acceptance criteria — prescribed mutation, expected result, for each

Run every mutation in your own worktree only (constitution item 23), revert
with `git checkout -- <file>` after each, re-confirm green before the next.
**No criterion below may rest on absence alone without a paired positive
proof that the thing being tested for absence was ever in a position to
happen** — this exact shape has cost this file family a BLOCKER on T176 and
another on T170; do not reproduce it a third time.

1. **The new "inactive" copy renders, positively, for the exact scenario
   this task fixes.** Render as a signed-in student with `resolveStudentId`
   resolving a real, distinct, non-placeholder, non-fixture id (e.g.
   `'student-real-inactive-1'`) and `resolveStudentScope` resolving `null`.
   Assert the container text contains your new title ("Your student account
   is inactive" or your finalized DES-14–16-checked wording) **and does
   not** contain "No student account linked yet." **Mutation:** revert
   `resolveStudentIdentity`'s `scope === null` branch to `return null` (the
   pre-fix collapse). **Expect RED**: the new title disappears from the
   render (assert on the new title's presence going false, not merely on
   the old title reappearing, since the pre-fix `null` also renders the OLD
   copy — the discriminating assertion is the new title's absence).

2. **Not-linked path is untouched — regression pin, not a new test.**
   `StudentHome.test.tsx:1473-1479` passes with a **zero-line diff**. State
   this plainly in your output; do not merely claim it, show the diff (or
   its absence) for that block.

3. **Pure-function contract, all six configurations, per §6's enumerated
   edits plus one new case.** `resolveStudentIdentity` returns:
   - `{kind:'linked', ...}` for the three existing success configurations
     (explicit `studentId` + real scope; explicit `teamId` bypass; full
     resolution) — exact field values asserted, not just the `kind` tag.
   - `{kind:'not-linked'}` when `resolveStudentId` resolves `null`, with
     `resolveStudentScope` proven **not called** (spy assertion, paired
     with the positive return-value assertion — not spy-only).
   - `{kind:'inactive'}` (**new test**) when `resolveStudentId` resolves a
     real id and `resolveStudentScope` resolves `null`, with
     `resolveStudentScope` proven **called with that exact id** (spy
     assertion, paired the same way).
   **Mutation, for the new `inactive` case specifically:** swap the
   `scope === null` check's branch order/return so it falls through to the
   `linked` return with `scope` still `null` (i.e. break the guard).
   **Expect RED** with a `TypeError`/`undefined` field access, not a silent
   pass — if it does not fail, the guard was never load-bearing and your
   design has a gap.

4. **Three (now four)-way DES-12 isolation, extending the existing
   pattern.** `StudentHome.tsx`'s own `:1440-1480`-area tests already
   isolate loading/error/not-linked for this identity tier one mutation at
   a time (T176's criterion 7 shape). Add the `inactive` state as a fourth
   isolated case in the same style: mutate ONE state's copy/condition,
   confirm that state alone goes RED while the other three (loading, error,
   not-linked) stay GREEN; repeat for `inactive`. This is also where you
   prove the new copy is **textually distinct** from all five pre-existing
   states on this page (loading skeleton text, "Couldn't find your student
   record", "No student account linked yet", "Couldn't load Home", and the
   populated content's own greeting) — assert non-collision, not just
   presence.

5. **"Sees nothing" is proven with a positive control, not asserted from
   the code.** Establish a positive-control render (reuse an existing
   passing "ready" configuration) and capture that its container text
   contains `Hi ${displayName}` (`StudentHome.tsx:1388`) and/or a
   `StudentHomeContent`-only marker (e.g. the goal bar's
   `aria-valuenow`/`aria-valuetext`). Then, in the `inactive`-state render,
   assert **none** of those same markers are present. **Mutation:** delete
   or comment out the `kind === 'inactive'` early-return so execution falls
   through toward `StudentHomeContent`. **Expect RED**: the "must not
   appear" markers now appear (or the render throws trying to destructure
   `studentId` off a `{kind:'inactive'}` object — either failure is
   acceptable evidence, but report which one you got).

6. **No metric/identity re-derivation (constitution item 3).** Diff-based:
   confirm no new Supabase query, no new SQL, and no direct read of
   `is_active` anywhere in your diff — the `inactive` signal must come
   **only** from `resolveStudentScope`'s existing `null` return, never a
   new field on `ResolveStudentScopeFn`'s result. Inspection-level, label
   it as such (not mutation-provable — there is nothing to mutate to prove
   an absence of a query you didn't add; state this plainly rather than
   inventing a mutation for it).

7. **Blast radius confined to the two allowed files.** `git diff --stat`
   against your merge base touches only `src/pages/home/StudentHome.tsx`
   and `src/pages/home/StudentHome.test.tsx`. In particular, confirm zero
   diff in `src/lib/supabase/loaders/meetings.ts`,
   `src/lib/supabase/loaders/students.ts`, `src/app/guards.tsx`,
   `src/pages/outreach/OutreachList.tsx`,
   `src/pages/outreach/OutreachList.test.tsx` — the last two matter because
   a concurrent T170 worker/checker pair is running against them right now
   (§4). Inspection-level.

8. **No other regression.** Full `StudentHome.test.tsx` and full repo suite
   green outside the five identified mechanical edits (§6) and your new
   additions. Report exact before/after counts measured in your own
   worktree — orientation only, not to be trusted verbatim: 67 files / 1591
   tests, eslint 0 errors / 357 warnings, as of T176's merge. Your merge of
   `origin/claude/swarm-plan-zl575z` may move these; re-measure, don't
   assume.

9. **Standard gates clean.** `npx tsc --noEmit`, `npx vite build`, `npx
   prettier --check ...`, `npx eslint .`, `npx vitest run` — all before and
   after, measured in your own worktree.

## 8. Required evidence

State your commit SHA (constitution item 21) — the orchestrator verifies
HEAD actually moved and the change is in the committed blob before treating
this as mergeable. Stage explicit pathspecs only, never `git add -A`/`git
add .` (item 22). Report every mutation's actual output (pass/fail counts,
not "as expected") for every criterion in §7 — a claim without the output is
not evidence (this is the standard this project's gates have enforced on
every task in this file family so far).

## 9. Tiering and gate recommendation (for the record)

**Worker: sonnet.** None of constitution item 18's four triggers apply: no
migration file, no RLS policy or `security definer` change, no new SQL view
with metric math, and — the one worth stating explicitly since the topic is
adjacent to access control — **this does not change auth, session, or
role-resolution logic.** `guards.tsx`/`auth.ts`'s actual role resolution
(`profiles.role`) is untouched and unread by this change; the distinction
this task adds lives entirely inside one page component's own local
DES-12 branching, consuming two seams' *existing* return values. Per item
25's proportionality clause: do not bump tier because the topic sounds like
access control when the trigger list itself is not met. This matches T170's
own tiering reasoning for the same file family, and T176's own precedent
(the directly comparable prior task on this exact component).

**Checker: opus**, matching T176's and T170's own checker tier — not for
topic sensitivity, but because this artifact class (live route, DES-12
state correctness, mutation-proof discipline) is the one that has produced
a caught BLOCKER in **every** gate/checker round run against this file
family so far (T176: 2 BLOCKERs pre-dispatch; T170: 1 BLOCKER round 1). A
lighter checker tier would be under-provisioned against this file's own
track record, independent of the underlying topic.

**Premise gate: full, mandatory, not yet run (§0/top of packet).** Item 19b
scopes gates by risk — "light check or skip for packets that roll out an
already-verified pattern to a new surface." This packet does not qualify:
the three-way `StudentIdentityOutcome` union is a new pattern for this
specific file, not a proven one being reapplied, and §6's five-test
amendment is exactly the kind of premise a gate should verify by execution
(does the existing test suite actually only need those five edits — proven
by running it, not asserted) before a worker spends a cycle on it.

## 10. Escalation

Attempt count starts at 0 (pre-dispatch). Three failed worker/checker rounds
escalate to `boss-arbiter` (constitution Loop Limit). Any dispute the worker
files goes through the standard Dispute Rule — do not improvise around a
standard believed wrong, impossible, contradictory, or harmful.
