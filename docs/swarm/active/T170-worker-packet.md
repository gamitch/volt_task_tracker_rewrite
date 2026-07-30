# T170 — Worker Packet

**Pinned to branch tip `dcfa6e0` on `claude/swarm-plan-zl575z`.** All citations
below were read directly at that SHA. **Your worktree is cut from `main`
(`f7ff055`) and has none of today's work, including this packet.** Before
touching anything:
```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```
Report the merge result (fast-forward or not, resulting SHA) in your output,
same as T176's worker did. If it does not fast-forward cleanly, stop and
report rather than resolving conflicts silently.

**Attempt:** 1 of 3 (constitution Loop Limit — a 4th attempt escalates to
boss-arbiter). **Tier: worker-implementer, sonnet** — reasoning below.
**Checker: checker-reviewer, opus** — same tier T176 used for the identical
defect shape.

## 1. Objective

`OutreachList.tsx` computes every personal figure on `/outreach`'s
student/parent view for `viewerStudentId = PLACEHOLDER_CURRENT_STUDENT_ID`
(`:3877`; constant at `:821` = `'student-placeholder-current-viewer'`), a
student that does not exist. `router.tsx:244` renders `<OutreachList />`
passing no props, so this is a live route. Fix: resolve the real, signed-in
viewer's `students.id` and thread it to every consumer, reusing the
already-shipped, already-tested resolution seam verbatim — do not design a
second one.

**Consequences currently measured, unchanged by your work except in kind:**
`viewerStudentId` drives `computeEventRowStats` (`:3281`), the my-RSVP lookup
(`:3310`), `computeStudentHours` (`:3554`), `myGoalHours` (`:3557`),
`getUnansweredRsvpCount` (`:3559`), and `GoalBar`'s `goalBarId` identity
(`:3594`, which also feeds the milestone-toast dedupe key,
`volt.outreach.milestoneToast.<seasonId>.<goalBarId>.<milestone>`).

**Read this first, it changes the shape of the fix:** `seasonId` on this same
component is **already fixed** (module doc #12, `OutreachList.tsx:3901-3914`)
— the explicit-prop-wins/`useActiveSeason()`-fallback pattern is already
shipped and working. `loadData` already defaults to the real
`loadOutreachData` (`loaders/outreach.ts:971`). **You are fixing exactly one
remaining placeholder: `viewerStudentId`.** Nothing else in this file's data
path is fake. Because of that, this fix should make every personal figure on
this page genuinely correct for the first time — prove that by rendering, not
by asserting it from the code (criterion 11).

## 2. Allowed / forbidden files

**Allowed:** `src/pages/outreach/OutreachList.tsx`,
`src/pages/outreach/OutreachList.test.tsx`.

**Not `router.tsx`, and here is why, stated rather than assumed:** every
precedent in this codebase for this exact defect family (`CoachHome.tsx`/T155,
`StudentHome.tsx`/T176, `MeetingsList.tsx`/T096) resolves identity **inside**
the component via a context hook (`useAuth()`) plus an injectable resolver
prop, not by threading a resolved value through the route definition.
`OutreachList.tsx` already has `useAuth()` in scope and already follows this
pattern for `seasonId`. Follow it for `viewerStudentId` too, for the same
reason module doc #12 gives for `seasonId`: it keeps `router.tsx` as pure
route wiring and keeps the resolution colocated with the component that has
the real disclosed gap on record (module doc #7, `:217-224`).

**Forbidden, in addition to the constitution's standing list
(`docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
`dispute-log.md`, `.claude/**`, `node_modules/`):**
- `src/pages/outreach/ScheduleMeetingsDialog.tsx`,
  `src/pages/outreach/StudentDialog.tsx`,
  `src/pages/outreach/OutreachEventDialog.tsx`, and the first two's test
  files — **T151's worker owns these right now.** `OutreachList.tsx` renders
  `OutreachEventDialog`; consume it exactly as it stands today, do not touch
  its props or signature.
- `src/lib/supabase/loaders/meetings.ts` — read-only reference. Import
  `resolveCurrentStudentId`, `CurrentViewerIdentity`, `ResolveCurrentStudentIdFn`
  from it; do not edit it, do not copy its internals into a second
  implementation.
- `src/pages/meetings/MeetingsList.tsx`, `src/pages/home/StudentHome.tsx` —
  read-only reference (the latter is where `CurrentViewerIdentity`/
  `ResolveCurrentStudentIdFn` types actually originate, re-exported by
  `meetings.ts` — see `MeetingsList.tsx:698-706`). Do not edit either.
- `src/lib/supabase/loaders/outreach.ts` — not needed. `viewerStudentId` is a
  purely client-side filter over already-loaded `sessions`/`rsvps`
  (`loadData(seasonId)` never takes a student argument); if your design ends
  up wanting to touch this file, stop and report why before doing it.

## 3. What's already established — carry these, don't re-derive them

**(a) The seam, reuse verbatim.** `loaders/meetings.ts`'s
`resolveCurrentStudentId` (`makeResolveCurrentStudentId` → `:636-661`) takes a
`CurrentViewerIdentity` (`{id: string; role: Role}`, defined
`MeetingsList.tsx:698-701`) and returns `Promise<string | null>`: for
`role === 'student'`, one query on `students` filtered
`.eq('profile_id', viewer.id).maybeSingle()`; for `role === 'parent'`, the
EARLIEST-linked `guardian_links` row. `OutreachList.tsx`'s own
`isCoachOrAdminView` check (module doc #6) already falls through to the
student/parent view for exactly the roles this function handles — no new role
logic needed. Construct `viewer` from values already in scope at the top of
`OutreachList`: `{ id: user.id, role: user.role }` (see `:3930`, where
`user.id` is already passed as `viewerProfileId`).

**(b) Blast radius, measured (attribute this as the orchestrator's figure,
not yours until you reproduce it) — 3 of 82 tests in `OutreachList.test.tsx`
fail** when the default is changed to a distinct id, everything else green.
Reproduce this number yourself at your own dispatch SHA before relying on it.
**These must be harness fixes** (an explicit `viewerStudentId` prop or a
`resolveStudentId` mock added to the render call, mirroring how
`StudentHome.test.tsx` fixed its own 13/33 in T176) **— not assertion
rewrites.** If you find yourself changing what an `expect(...)` line checks
rather than what data feeds it, stop and report before proceeding.

**(c) Fixture-collision hazard, proven to bite this exact file's family
twice already (T176's criterion 3, and this file's own fixtures).**
`OutreachList.tsx`'s shipped fixtures are keyed to
`PLACEHOLDER_CURRENT_STUDENT_ID` at `:842` (`FIXTURE_STUDENTS`), `:865`
(`FIXTURE_GOAL_CONFIG.individualGoalHoursByStudentId`), `:1049`/`:1105`
(`FIXTURE_RSVPS[].studentId`/`.respondedBy`). **Any positive proof that "the
real resolved id reaches the consumers" must use a distinct, fabricated,
non-placeholder id** (e.g. `student-real-c1`) with its own constructed
sessions/rsvps/goalConfig, not the shipped fixture — otherwise a mutation that
breaks resolution and one that doesn't can render identically, exactly the
failure T176's own gate caught before dispatch.

**(d) The T184 trap — check it here, don't assume either answer.**
`queryStudentIdByProfileId` (`loaders/meetings.ts:491-501`) filters only
`.eq('profile_id', profileId)` — **no `is_active` filter.** On `StudentHome`
(T176) this produced a two-step disagreement: identity resolved, but a
*second*, further-scoped query (`v_student_goal_projection`) then filtered
`where s.is_active`, so a deactivated student's id resolved successfully yet
the downstream read came back empty, producing the false "we couldn't find a
student record" copy for someone who does, in fact, have one.

**My own read, which you must verify rather than inherit:** `OutreachList`
has no second, further-scoped query analogous to `v_student_goal_projection`.
Once `resolveCurrentStudentId` returns a real (even deactivated) student id,
every consumer here (`computeStudentHours`, `getUnansweredRsvpCount`,
`computeEventRowStats`, `myGoalHours`, the `GoalBar`) is a **pure client-side
filter over the already-loaded, season-scoped `sessions`/`rsvps`** — none of
them re-query Supabase with an `is_active`-filtered `students` read. So a
deactivated student's own outreach figures should render normally, not fall
into the false-empty state. **Confirm this by reading `loadOutreachData`
(`loaders/outreach.ts:908-963`) yourself and tracing every place
`viewerStudentId` is consumed downstream of resolution — do not take my trace
as settled.** If you find a query I missed, this is a second T184 instance:
say so explicitly, do not silently paper over it, and do not fix it here —
file the same class of follow-up T184 already is. State plainly what happens
for (i) a deactivated student and (ii) a signed-in user with no linked
student row at all, and what copy each produces.

## 4. Constitution item 3 — checked, findings below, do not re-litigate

**Grep result, stated either way per instruction:** no shipped SQL view
reproduces the formula `computeStudentHours` (`:1184-1203`) implements.
`v_student_hours` (`metric_views.sql:3-19`) computes confirmed hours from
**real `attendance` check-in/check-out rows** (`hours_override` coalesce over
clamped check-in/out times); `computeStudentHours` computes "confirmed" from
**RSVP status `going` on a `completed` session**, never touching `attendance`
at all — a different, RSVP-based heuristic, disclosed as BEH-02 in this
file's own module doc #3. `v_student_planned_hours`
(`dashboard_views.sql:95-98`, built on `v_planned_rsvp_hours:71-80`) is
closer in shape (future `going` RSVP hours) but reads real `events`/
`event_sessions`/`rsvps` tables directly, scoped by `season_id` and
`counts_volunteer_hours` — a structurally different computation from
`computeStudentHours`'s in-memory filter over this page's own already-loaded
`sessions`/`rsvps` arrays, not a duplicate of it.

**Consequence: item 3 does not block this task, and these functions are not
yours to touch.** `computeStudentHours`, `getUnansweredRsvpCount`,
`computeEventRowStats`, and the `myGoalHours` lookup all **pre-date T170 and
are called with the placeholder id today** — your fix supplies the correct
*argument* to unmodified functions; it does not introduce, expand, or
re-derive any computation. Prove this with a diff-based criterion (below),
the same technique T176's round-2 fix used to re-confirm its own item-3
compliance.

## 5. Recommended design — parallel, not sequential; state your reasoning if you diverge

T176's `ResolvedStudentHomeView` resolves identity **before** its content
fetch starts, because that fetch's own query parameters (`studentId`,
`teamId`) depend on the resolved identity. **That dependency does not exist
here** — `loadData(seasonId)` never takes a student argument; `viewerStudentId`
only filters already-loaded data. Sequencing identity resolution before the
season-data load (mechanically copying T176's shape) would add a real,
avoidable round-trip of latency for every student/parent view. Recommended
instead: add a second `useLoadState` call **inside `OutreachListLoaded`**
(`:3719` today), called unconditionally alongside the existing season-data
`loadState` (both hooks at the top of the function, both firing on the same
initial mount — genuinely parallel, no added latency), whose loader is:

```
() => (isCoachOrAdminView
  ? Promise.resolve(null)
  : explicitViewerStudentId !== undefined
    ? Promise.resolve(explicitViewerStudentId)
    : resolveStudentId(viewer))
```

This keeps `resolveStudentId` genuinely uncalled for a coach/admin viewer
(provable by spy, criterion 3) even though the *hook* fires unconditionally
(Rules of Hooks) — the same "hook always runs, injected function conditionally
invoked" idiom this file already uses elsewhere for `seasonId`/`loadData`
gating, not a new convention. `OutreachListLoaded`'s render then gains, for
the `!isCoachOrAdminView` branch only, its own DES-12 loading/error/null
states (own copy, distinguishable from the season-loading skeleton already
above it) before finally rendering `StudentParentOutreachView` with the
resolved, non-null id.

New/changed surface on `OutreachListProps`: `viewerStudentId?: string` stays
but **no longer defaults to the placeholder** (undefined when omitted); add
`resolveStudentId?: ResolveCurrentStudentIdFn` (defaults to
`resolveCurrentStudentId`), same shape `StudentHomeProps.resolveStudentId`
already establishes. Thread both down through `OutreachListLoaded`'s props
alongside a constructed `viewer: CurrentViewerIdentity`.

You may diverge from this shape, but if you do, state the reason in your
output the way T176's worker did for its own criterion-2/4 deviation (which
the checker then confirmed was the correct reading, not a violation).

**Copy:** reuse T176's established voice, not new invented strings, where the
sentence is page-agnostic. `"Finding your student record…"` and `"Couldn't
find your student record"` / `"Something went wrong looking up your student
record. Try refreshing the page."` (`StudentHome.tsx:1622-1641`) contain
nothing Home-specific — reuse verbatim if you agree, or state why not. The
"No student account linked yet" title likewise generalizes; its description
(`"...your Home will show up here"`) does not — adapt only that clause to
this page (e.g. "...your outreach view will show up here"), and check PRD
DES-14–16 first for prescribed copy before inventing anything not already
established.

## 6. Acceptance criteria — prescribed mutation, expected result, for each

Run every mutation in your own worktree only (item 23), revert with
`git checkout -- <file>` after each, re-confirm green before the next.

1. **Real resolved id reaches every consumer, positively, with a distinct
   non-placeholder fixture (hazard 3c).** Construct sessions/rsvps/goalConfig
   keyed to `student-real-c1` (fabricated name, item 6), assert the rendered
   confirmed/planned hours, unanswered-RSVP count, and `GoalBar`'s
   `aria-valuetext`/dedupe-relevant id reflect that id's own distinct values —
   not the placeholder's. **Mutation:** replace the resolved id with
   `PLACEHOLDER_CURRENT_STUDENT_ID` before it reaches
   `StudentParentOutreachView`. **Expect RED** on the positive assertion.
2. **Explicit `viewerStudentId` bypasses `resolveStudentId` entirely, paired.**
   Mutation A: make resolution fire unconditionally regardless of the explicit
   prop — expect RED on a spy-not-called assertion. Mutation B (vacuity
   probe): with the explicit prop given, break `resolveStudentId`'s body
   (`return null`/throw) — expect the explicit-prop test to stay GREEN (proves
   it's genuinely never called), and a **separate** no-explicit-prop test to
   go RED under the same mutation (proves the vacuity probe isn't just an
   always-green assertion).
3. **Coach/admin view never calls `resolveStudentId`.** Spy assertion,
   render as a coach. **Mutation:** force the loader to call
   `resolveStudentId(viewer)` even when `isCoachOrAdminView`. **Expect RED**
   on "spy called 0 times."
4. **Identity tier's own three sub-states, isolated (loading/error/null),
   each independently mutation-provable, none bleeding into another** — same
   three-way isolation technique as T176 criterion 7: mutate state (i)'s copy
   only, confirm (i) RED / (ii),(iii) GREEN; repeat for each.
5. **No metric re-derivation (item 3).** Diff-based: confirm
   `computeStudentHours`, `getUnansweredRsvpCount`, `computeEventRowStats`,
   and the `myGoalHours` expression are byte-unchanged by your diff — only the
   argument fed into them changes. Inspection-level, label it as such.
6. **T184 trap, established not assumed (§3d).** State plainly, with
   citations, what happens for (i) a deactivated student, (ii) a signed-in
   user with no linked student row. If you find a second-query hazard I
   missed, file the follow-up rather than fixing it in scope. Inspection-level.
7. **Blast radius reproduced and classified.** Report the exact failing count
   at your own dispatch SHA and confirm each fix is harness-only (§3b). If not,
   stop and report before proceeding.
8. **Render-and-enumerate over `container.innerHTML`** for a fully real render
   (real season, real resolved `viewerStudentId`, distinct fixture values) —
   classify every visible personal figure as REAL / still-fabricated / honestly
   empty, T176 §9-style table. This is the criterion that proves §1's claim
   ("this fix should make every personal figure genuinely correct") rather
   than asserting it.
9. **No regression elsewhere.** Full `OutreachList.test.tsx` and full repo
   suite stay green outside the harness-only fixes in criterion 7; coach view
   behavior and `OutreachDetail.tsx` (out of scope, unedited) unaffected.

## 7. Required evidence / gates

All five gates, measured at your own worktree SHA, before and after (baseline
by reference only — re-measure, do not assume): `npx tsc --noEmit`,
`npx vite build`, `npx prettier --check ...`, `npx eslint .`, `npx vitest run`.
Orientation only, not to be trusted verbatim: 67 files / 1591 tests, eslint 0
errors / 357 warnings, as of T176's own merge — your merge of
`origin/claude/swarm-plan-zl575z` may move these; report your own numbers.

State your commit SHA (item 21) — the orchestrator verifies HEAD actually
moved and the change is in the committed blob before treating this as
mergeable. Stage explicit pathspecs only, never `git add -A`/`git add .`
(item 22).

## 8. Tiering and gate recommendation (for the record, not yours to act on)

**Worker: sonnet.** None of item 18's four triggers apply — no migration, no
RLS/security-definer, no new metric SQL view, and `resolveCurrentStudentId`
itself is reused verbatim, unmodified (you are a new *call site*, not a
change to role-resolution logic). Per item 25's second, narrower obligation:
this should not be bumped to opus for sounding like an identity/security
topic — it is identity plumbing on a page whose data is already real, with a
proven seam. Matches T176's own worker tier exactly, and T176 is the directly
comparable precedent.

**Checker: opus**, matching T176's own checker tier — not because the topic
is sensitive, but because the artifact class (live route, DES-12 state
correctness, mutation-proof discipline, a documented history of vacuous
criteria in this exact file family) is the same one T176's opus checker
caught two BLOCKER-class premise errors in before a worker ever started.

## 9. Escalation

Attempt count starts at 0 (pre-dispatch). Three failed worker/checker rounds
escalate to boss-arbiter (constitution Loop Limit). Any dispute the worker
files goes through the standard Dispute Rule — do not improvise around a
standard believed wrong, impossible, contradictory, or harmful.
