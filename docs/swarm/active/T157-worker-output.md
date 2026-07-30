# T157 worker output — mount `ParentRsvp` in `OutreachDetail.tsx`

**Commit SHA: `b0b15b0085192ae9844c61bceb1182ef5f3948c1`** (constitution item 21).
Staged with explicit pathspecs only, never `git add -A`/`git add .` (item 22).
Worktree: `.claude/worktrees/agent-af656295df9f41a32`, branch
`worktree-agent-af656295df9f41a32`. **Not pushed, no PR opened, not marked
complete** — an opus `checker-reviewer` verifies this.

---

## 0. Packet provenance — a dispatch correction, disclosed first

I was initially dispatched into a worktree created from `f7ff055` (main), which
carried **revision 1** of the packet (the version that gated REVISE with 4
MAJORs). I began implementing against it and had produced roughly 320 diff lines
across `outreach.ts` and `OutreachDetail.tsx` before the coordinator stopped me.

I **discarded that work in full** (`git checkout --` on both files; the diff is
parked at `scratchpad/rev1-wip.diff` for reference only and **was not
reapplied** — everything below was written fresh against revision 2), then:

```
git fetch origin claude/swarm-plan-zl575z
git merge origin/claude/swarm-plan-zl575z   # clean fast-forward f7ff055..02c727c
```

Confirmed revision 2 is in hand: the packet's first line under the title now
reads *"Revision 2 — this is the version that ships, and it has cleared the
gate."* Every measurement in this document is taken at or after `02c727c`.

Discarding was the right call, not just compliance: revision 1 would have had me
declare a **third** page-local `GuardianLinkRow` (§6c reverses this), name the
query `queryGuardianLinksForParent` (colliding with `checkin.ts:393`), write
`currentUserProfileId={user.id}` behind a non-narrowing boolean gate (**would not
have compiled**), use a name-only heading, and ship six mutations instead of
nine. Roughly a third of what I had written was wrong in a way revision 2 fixes.

---

## 1. Files touched

Four source files (exactly §5's Allowed list) plus this output doc:

| File | Change |
|---|---|
| `src/lib/supabase/loaders/outreach.ts` | `profile_id` on `StudentDbRow`/`queryAllStudents`/`mapStudentDbRowToRosterStudent`; new `GuardianLinkDbRow`, `queryGuardianLinksWithRelationshipForParent`, `mapGuardianLinkDbRowToGuardianLinkRow`, `LoadGuardianLinksForParentFn`, `makeLoadGuardianLinksForParent`, `loadGuardianLinksForParent`; type-import of `GuardianLinkRow` from `ParentRsvp.tsx` |
| `src/lib/supabase/loaders/outreach.test.ts` | +4 tests (one `students`-select guard added to T146's existing describe block, one new 3-test describe block for the guardian-links query). T146's own test left byte-intact. |
| `src/pages/outreach/OutreachDetail.tsx` | Module doc #13; `RosterStudent.profileId`; `profileId` on all 5 `FIXTURE_STUDENTS`; new exported `resolveParentLinkedRosterStudents`; `loadGuardianLinksForParent` + `nowFn` props; `isParentViewer`; `GuardianLinksLoadState` + fetch effect + retry; region-scoped loading/error UI; one `<ParentRsvp>` per (session × linked student) with a dated `Heading level={4}` |
| `src/pages/outreach/OutreachDetail.test.tsx` | `profileId` on the 2 test-local rosters; `submitRsvpChange` added to the shared `vi.mock` factory + `afterEach` clear; `PARENT_USER`; +17 tests |
| `docs/swarm/active/T157-worker-output.md` | this file (created) |

**Nothing else was touched.** `ParentRsvp.tsx` and `RsvpControl.tsx` were read
only — `ParentRsvp.tsx` is `import type`'d and value-imported, which §5
explicitly authorizes and which is not a write. `CoachHome*`/`DashboardPage*`,
`client.ts`, `ThemeModeProvider.tsx`, `guards.tsx`, and every migration are
untouched (`git show --stat b0b15b0` confirms five paths total).

---

## 2. Baselines and results — measured at my own dispatch SHA (criterion 12)

Measured at `02c727c`, freshly, **not reused from the packet or the ledger**:

| Suite | Before (`02c727c`) | After (`b0b15b0`) | Delta |
|---|---|---|---|
| `src/pages/outreach/OutreachDetail.test.tsx` | 43 | 60 | +17 |
| `src/lib/supabase/loaders/outreach.test.ts` | 1 | 5 | +4 |
| `src/pages/outreach/ParentRsvp.test.tsx` (untouched, watched) | 22 | 22 | 0 |
| **Those three combined** | **66** | **87** | **+21** |
| Full repo suite | — | **1567 passed, 66 files, 0 failed** | — |

**Zero baseline tests broken; zero existing assertions modified.** The 66/66 and
`tsc` exit 0 figures the gate reported at `0b932d0` reproduced exactly at my own
SHA, but I re-measured rather than inheriting them.

**Criterion 11 — `tsc`:** `npx tsc --noEmit` → **exit 0**, before and after.

Intermediate `tsc` evidence for §6a's blast radius: after changing
`RosterStudent` and the five production fixtures, `tsc` reported **exactly five**
remaining errors — `OutreachDetail.test.tsx` lines 294/295/296 and 340/341,
`TS2741: Property 'profileId' is missing`. Five production + five test = **ten
sites**, independently confirming the packet's measured blast radius. No error
appeared in `AttendancePanel.tsx`, `MarkEventCompleteDialog.tsx`,
`MarkDayCompleteDialog.tsx`, or `OutreachList.tsx` — the extra field flows
structurally into those independently-reimplemented types, and the extra
`profile_id` column is a genuine no-op for `makeLoadOutreachData`'s shared use of
`StudentDbRow`.

**Lint:** `npx eslint` on all four files → **0 errors**, 16 warnings, all of the
pre-existing `react-refresh/only-export-components` class this file already
triggers for every exported pure function. Baseline for `OutreachDetail.tsx`
alone was 15 warnings (measured by stashing my change); the +1 is exactly
`resolveParentLinkedRosterStudents`, matching the file's own convention of
exporting pure functions for direct testing.

**`nowFn` instant (required by §11):** `2026-07-30T12:00:00.000Z`.
- Strictly **after** `session-park-cleanup`'s start `2026-07-26T15:00:00.000Z` ✓
  (that fixture session stays deterministically locked)
- Strictly **before** `session-food-bank-day1`'s start `2026-08-02T14:00:00.000Z`
  ✓ and `day2`'s `2026-08-09T14:00:00.000Z` ✓ (the parent fixture sessions are
  deterministically editable)

Every new test that renders a control pins it. None of this task's assertions is
wall-clock-coupled, so criterion 12's baseline cannot go stale on a date change.

---

## 3. Executed mutation evidence — all nine, plus three supplementary

Every mutation below was **actually applied and run in this worktree** (item 23),
its real output pasted, then restored with `git checkout -- <path>` (byte-identical
by construction) and re-verified green before the next one. `git status` was
empty and `git diff HEAD` was empty at the end — the tree is exactly `b0b15b0`.

Technique note for the re-executing checker: single-line `perl -pi -e` and the
Edit tool both work in this sandbox; heredoc-to-source does not. `git checkout --
<path>` is the reliable restore.

### Mutation 1 — criterion 1 (reachability)

**Applied:** deleted the entire parent-viewer JSX block (the
`{isParentViewer && user !== null && guardianLinksState.status === 'ready' && parentLinkedStudents.map(...)}`
expression) from the per-session loop.

```
 FAIL  src/pages/outreach/OutreachDetail.test.tsx > T157 reachability: a parent sees a real <ParentRsvp> control on this page > renders one control per (session x linked student), each with its own dated heading
Error: No "Your RSVP for Amara Chen — Sun, Aug 2" heading. h4s present:
 ❯ parentRsvpBlock src/pages/outreach/OutreachDetail.test.tsx:1668:11
 ❯ parentRsvpControlIn src/pages/outreach/OutreachDetail.test.tsx:1678:10
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1765:12

 Test Files  1 failed (1)
      Tests  1 failed | 59 skipped (60)
```

Restored → 60 passed. **This is the proof that a real `<ParentRsvp>` render
exists and is load-bearing — not satisfiable from `ParentRsvp.test.tsx`.**

### Mutation 2a — criterion 2a (roster-membership predicate)

**Applied:** `perl -pi` replacing
`return roster.filter((student) => linkedStudentIds.has(student.id));` with
`return [...roster];`.

```
⎯⎯⎯ Failed Tests 3 ⎯⎯⎯

 FAIL  ... > returns exactly the one roster student this parent is actually linked to
AssertionError: expected [ …(3) ] to deeply equal [ { id: 'student-amara-chen', …(3) } ]
- Expected
+ Received
      "id": "student-amara-chen",
      ...
+   { "id": "student-marcus-bello", "name": "Marcus Bello", ... },
+   { "id": "student-nina-ortiz",  "name": "Nina Ortiz",  ... },
  ]
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1725:20

 FAIL  ... > excludes a link row for the right student that belongs to a DIFFERENT parent
AssertionError: expected [ …(3) ] to deeply equal []

 FAIL  ... > returns nothing when the parent has no guardian links at all
```

All three cases fail (the packet predicted the first two; the third fails too).
Restored → green.

### Mutation 2a′ — SUPPLEMENTARY: the *other* predicate, run separately

Not one of the prescribed nine. I ran it because the dispatch note asserted the
two cases in criterion 2a are non-redundant, and that claim is only worth
anything if executed.

**Applied:** deleted `.filter((link) => link.parentProfileId === parentProfileId)`
from `resolveParentLinkedRosterStudents`.

```
⎯⎯⎯ Failed Tests 1 ⎯⎯⎯

 FAIL  ... > excludes a link row for the right student that belongs to a DIFFERENT parent
AssertionError: expected [ { id: 'student-amara-chen', …(3) } ] to deeply equal []
- []
+ [ { "id": "student-amara-chen", "name": "Amara Chen", ... } ]
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1748:20

      Tests  1 failed | 2 passed | 57 skipped (60)
```

**Confirmed as predicted: only case 2 catches this.** Cases 1 and 3 stay green —
case 1 has a single matching link, so a dropped `parentProfileId` filter changes
nothing there. Each of §7d's two predicates has its own uniquely-failing case,
and neither test is redundant. Case 1 uses an exact-array `toEqual`, not
`toContain`; with `toContain` mutation 2a above would not have failed it.

### Mutation 2b — criterion 2b (cross-family, rendered)

**Applied:** at the call site, `? resolveParentLinkedRosterStudents(...)` → `? roster`.

```
 FAIL  ... > 2b -- a roster teammate this parent is NOT linked to gets no control
AssertionError: expected <h4 …(3)></h4> to be undefined
- Expected: undefined
+ Received:
<h4 class="astryx-heading level-4 primary …" data-level="4">
  Your RSVP for Marcus Bello — Sun, Aug 2
</h4>
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1797:64
```

A student who is not this parent's child is handed a control. Restored → green.

### Mutation 2c — criterion 2c (team-scope composition order)

**Applied:** at the call site, swapped the first argument `roster` → `students`.

```
 FAIL  ... > 2c -- a linked student outside this event's team scope gets no control
AssertionError: expected <h4 …(3)></h4> to be undefined
- Expected: undefined
+ Received:
<h4 class="astryx-heading level-4 primary …" data-level="4">
  Your RSVP for Sofia Delgado — Sun, Aug 2
</h4>
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1814:65
```

This is the composition-order defect the round-1 gate traced: the filter is
correct in isolation and wrong because it is wired to the unfiltered upstream
array. Restored → green.

### Mutation 4 — criterion 4 (`currentUserProfileId` threading)

**Applied:** deleted `currentUserProfileId={user.id}` from the call site.

```
 FAIL  ... > clicking a segment writes responded_by as the signed-in parent, not the placeholder
AssertionError: expected "spy" to be called with arguments: [ ObjectContaining{…} ]

  1st spy call:
  [
-   ObjectContaining {
-     "respondedBy": "profile-parent-1",
+   {
+     "respondedBy": "profile-placeholder-current-parent",
      "sessionId": "session-parent-day1",
      "status": "going",
      "studentId": "student-amara-chen",
    },
  ]
Number of calls: 1
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1898:36
```

**Exactly the predicted failure**, and exactly the defect class this task exists
to close: not a crash, but a real `rsvps` row written to the database attributed
to `profile-placeholder-current-parent` — a `profiles.id` that does not exist.
Restored → green.

### Mutation 5 — criterion 5 (`studentProfileId` threading)

**Applied:** `studentProfileId={student.profileId}` → `studentProfileId={null}`.

```
 FAIL  ... > a student's own RSVP shows NO attribution line, not "someone else recorded this"
AssertionError: expected 'Your RSVP for Amara Chen — Sun, Aug 2…' not to contain 'Someone else recorded this response o…'

Expected: "Someone else recorded this response on your student's behalf"
Received: "Your RSVP for Amara Chen — Sun, Aug 2Current response: Sign upSomeone else recorded this response on your student's behalfJul 20, 2026, 9:00 AMSign upMaybeCan't go←→to navigateYou can change this on your student's behalf until the event starts."
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1939:35
```

**Exactly the predicted failure chain**: `resolveRsvpResponderAttribution` cannot
match the self case, falls through `guardianLinks`, finds no match, lands on
`'unrecognized'`, and the page tells a parent a stranger answered for their child
when in fact the child answered for themself. Restored → green.

### Mutation 6 — criterion 6 (`guardianLinks` threading)

**Applied:** `guardianLinks={guardianLinksState.guardianLinks.filter(...)}` → `guardianLinks={[]}`.

```
 FAIL  ... > a parent-set RSVP renders "Mom signed you up" from the fetched relationship text
AssertionError: expected 'Your RSVP for Amara Chen — Sun, Aug 2…' to contain 'Mom signed you up'

Expected: "Mom signed you up"
Received: "Your RSVP for Amara Chen — Sun, Aug 2Current response: MaybeSomeone else recorded this response on your student's behalfJul 20, 2026, 9:00 AMSign upMaybeCan't go←→to navigateYou can change this on your student's behalf until the event starts."
 ❯ src/pages/outreach/OutreachDetail.test.tsx:1969:31
```

Attribution falls to `'unrecognized'` — the parent's own RSVP is disowned back to
them. Restored → green.

### Mutation 7 — criterion 7 (loader select-string guard)

**Applied:** `.select('id, parent_profile_id, student_id, relationship')` →
`.select('id, parent_profile_id, student_id')` (the exact shape all three of this
repo's other `guardian_links` reads already use, which is what makes this a live
revert risk).

```
 FAIL  src/lib/supabase/loaders/outreach.test.ts > queryGuardianLinksWithRelationshipForParent (via makeLoadGuardianLinksForParent) -- T157 select-string + filter guard > asks `guardian_links` for `relationship` (not just the three id columns) and threads it through
AssertionError: expected false to be true // Object.is equality
- true
+ false
 ❯ src/lib/supabase/loaders/outreach.test.ts:266:61

      Tests  1 failed | 4 passed (5)
```

Restored → 5 passed.

### Mutation 7′ — SUPPLEMENTARY: the `.eq()` filter argument

Not one of the prescribed nine, but criterion 7 has two halves and I wanted the
second half executed too.

**Applied:** `.eq('parent_profile_id', parentProfileId)` →
`.eq('parent_profile_id', 'profile-hardcoded')`.

```
⎯⎯⎯ Failed Tests 2 ⎯⎯⎯
 FAIL  ... > asks `guardian_links` for `relationship` …
  1st spy call:
  [ "parent_profile_id",
-   "profile-parent-1",
+   "profile-hardcoded",  ]
 FAIL  ... > filters server-side by the REAL supplied parent profile id, never a hardcoded or omitted one
  [ "parent_profile_id",
-   "profile-parent-somebody-else",
+   "profile-hardcoded",  ]
```

Both tests catch it. Restored → green.

### Mutation 7″ — SUPPLEMENTARY: the *other* new select column

`profile_id` on `queryAllStudents` is the second column this task added to a
select string, and it has the identical `as StudentDbRow[]`-cast blind spot, so I
guarded and mutation-proved it too.

**Applied:** `.select('id, display_name, team_id, profile_id, goal_hours_override')` →
`.select('id, display_name, team_id, goal_hours_override')` (the exact pre-T157 string).

```
 FAIL  ... > asks the `students` table for `profile_id`, and threads it through to RosterStudent.profileId
AssertionError: expected false to be true // Object.is equality
 ❯ src/lib/supabase/loaders/outreach.test.ts:189:59
```

Worth having: without this guard, a revert of that one string leaves `tsc` green,
leaves every DOM test green (they all inject their own `loadData`), and silently
makes every real parent's `studentProfileId` `undefined` — i.e. mutation 5's
misattribution, in production, undetected. Restored → green.

### Mutation 9 — criterion 9 (error + Retry re-fetch)

**Applied:** removed `guardianLinksRetryToken` from the fetch effect's dependency array.

```
 FAIL  ... > a rejected fetch shows an honest Banner whose Retry really re-fetches and recovers
AssertionError: expected "spy" to be called 2 times, but got 1 times
 ❯ src/pages/outreach/OutreachDetail.test.tsx:2027:40
```

The Banner and its Retry button still render; the button is simply inert. That is
precisely the failure mode worth catching. Restored → green.

### Criteria 3, 8, 10 — non-mutation, as §11 directs

§11 states these three are structural/behavioral checks, not revert-and-fail
proofs, and instructs me to say so rather than force a mutation onto them. Doing
that:

- **Criterion 3 (role gating)** is negative-space coverage: five tests
  (unauthenticated / `STUDENT_USER` / `COACH_USER` / `ADMIN_USER`, plus a positive
  control confirming `PARENT_USER` *does* trigger it with their own real
  `profiles.id`). Each asserts zero `ParentRsvp` controls, zero "Your RSVP"
  headings, and `expect(spy).not.toHaveBeenCalled()`. Note the positive control
  is what stops the four negatives from being vacuous — four "it isn't called"
  assertions would all pass if the loader were never wired at all.
- **Criterion 8 (loading)** is an inspection assertion: with the promise left
  unresolved, an `[aria-busy="true"]` container with a `[role="status"]`
  announcement is present, and zero controls/headings render. Mutation 1 already
  proves the control's existence is load-bearing; there is no single line whose
  deletion makes "does it show a loading state" interestingly true or false.
- **Criterion 10 (ready-empty)** documents §10's deliberate no-empty-state
  choice: zero headings, zero controls, no `[aria-busy]` left behind, no error
  banner, and the rest of the page (Signups, Amara Chen, Marcus Bello) undisturbed.

---

## 4. §6/§7 prescriptions — followed as-written vs. deviated

**Followed exactly as written**, with no deviation:

- §6a `RosterStudent.profileId`, required not optional; all ten sites updated
  (five production fixtures with distinctive non-null `profile-…` strings, two
  test-local rosters with `null` per §6a's explicit allowance).
- §6b `StudentDbRow.profile_id`, the select-string growth, and
  `mapStudentDbRowToRosterStudent`.
- §6c **reuse** `GuardianLinkRow` from `ParentRsvp.tsx` — no third declaration.
  Imported as `import { ParentRsvp, type GuardianLinkRow } from './ParentRsvp'`
  in the page and `import type { GuardianLinkRow } from '../../../pages/outreach/ParentRsvp'`
  in the loader. I verified the type-only import does not create a runtime cycle
  despite `ParentRsvp.tsx` value-importing `submitRsvpChange` from `outreach.ts`
  (type imports are erased); `tsc` and the full suite confirm.
- §6d the loader, including the `checkin.ts:393` structural template, the
  `queryGuardianLinksWithRelationshipForParent` name, and the
  `.order('created_at', { ascending: true })` clause.
- §7a `isParentViewer`, §7b the injectable prop, §7d the pure function verbatim.
- §7e the `nowFn` seam, the `user !== null &&` gate (load-bearing — I confirmed
  by construction that `currentUserProfileId={user.id}` needs it), the
  `Heading level={4}` carrying **both** student name and session date via this
  page's own `formatSessionDateOnly` (not `ParentRsvp.tsx`'s same-named export),
  and the heading-then-sibling-radiogroup locator.
- §7f: `FIXTURE_EVENTS`/`FIXTURE_RSVPS`/`isStaffViewer`/`SessionSignupList`/
  `AttendancePanel`/`MarkEventCompleteDialog`/the dialog wiring all untouched.
- §8.7 reused the existing unexported `parseSelectedColumns` rather than writing
  a second copy, and did **not** extract it to `src/test-utils/` (T161's call).

**Deviations, all disclosed rather than silently taken:**

1. **§8 criterion 4's prescribed mock shape is wrong, and I did not follow it.**
   The packet says to add
   `submitRsvpChange: vi.fn(async () => ({ id: 'rsvp-generated', ... }))` with the
   parenthetical "(shape to match `RsvpRow`)". But `outreach.ts` declares
   `export type SubmitRsvpChangeFn = (params: OutreachRsvpChangeParams) => Promise<void>`
   — it resolves **void**, and `makeSubmitRsvpChange`'s returned function is
   `async (params) => { await mutate(params); }` with no return value.
   `<ParentRsvp>` never reads the resolved value; it builds its own optimistic row.
   Returning an `RsvpRow` would make `vi.mocked(submitRsvpChange)` disagree with
   the real signature. **I used `vi.fn(async () => {})`.** Flagging rather than
   silently following (§2) or silently deviating. This is a wording slip in the
   packet, not a design problem — the criterion itself is sound and passes.

2. **§7c's two allowed shapes — I implemented the first.** `useState` initialises
   directly to `{ status: 'loading' }`, and the fetch effect settles a non-parent
   viewer to `{ status: 'idle' }` on its first run. A parent viewer therefore
   never observes `idle`, so criterion 8 has a real window to assert against.
   (§7c asked me to state which shape I used.)

3. **Placement of the region's loading/error UI was not prescribed; I chose
   once-per-page inside the Signups section**, immediately after
   `<Heading level={2}>Signups</Heading>`, rather than once per session. Reason:
   while the fetch is in flight the page does not yet know how many linked
   students exist, and N duplicate `role="status"` live regions is worse for a
   screen reader than one. It sits inside the section whose children the controls
   are, so all four DES-12 states for the "Your RSVP" region are co-located. The
   error `Banner` matches the existing roster-failure banner's shape as §8.9
   requires (`status="error"` + `endContent={<Button variant="ghost" label="Retry" …/>}`).

4. **Test-harness addition not prescribed: `renderParentDetail` stubs
   `loadRoster: async () => []`.** Left at its real default, `loadRoster` rejects
   in this environment (no configured Supabase client), which renders this page's
   unrelated T147 roster-failure Banner — **whose own "Retry" button would
   collide with criterion 9's `Retry` locator** and make that criterion pass or
   fail for the wrong reason. Stubbing it keeps each criterion measuring only its
   own subject. Documented in the helper's own docstring.

5. **Import alias.** `loadGuardianLinksForParent as defaultLoadGuardianLinksForParent`
   in `OutreachDetail.tsx`, because the prop shadows the import name. Mechanical.

6. **Three supplementary mutations beyond the prescribed nine** (2a′, 7′, 7″), run
   as extra evidence, documented above. No prescribed mutation was skipped or
   substituted.

**Design choices I was asked to flag if I disagreed (§2): I do not disagree with
any of §6/§7's foreman-level calls.** The `GuardianLinkRow` reuse, the
`checkin.ts` template, the `nowFn` seam over moving fixture dates, and the
dated-heading locator are all, in my assessment, the right calls — the dated
heading in particular is doing real accessibility work, not just serving the test.

**Authority attribution (§2), stated correctly:** the only decision authorized by
George is *that `OutreachDetail.tsx` hosts `ParentRsvp`*
(`docs/swarm/auto-mode-decisions.md`, "2026-07-30 — George's rulings on
T157/T158"). Every other design decision I implemented is the **foreman's**, made
under standing orchestrator authority, and the six deviations above are **mine**.
None of it is George's.

---

## 5. Notes required by §5 / §11

**T165 files-in-flight note.** I landed before T165 dispatched. T165's future
worker extends this same `src/lib/supabase/loaders/outreach.test.ts` and its
ledger row already instructs it to keep T146's column-guard describe block
byte-intact. It must now also keep **byte-intact**:
- the new `queryGuardianLinksWithRelationshipForParent (via makeLoadGuardianLinksForParent) -- T157 select-string + filter guard` describe block (3 tests), and
- the new `asks the `students` table for `profile_id`…` test **inside** T146's
  existing `queryAllTeams (via makeLoadOutreachDetail) -- T146 select-string guard`
  describe block. I added it there deliberately (same file, same pattern, same
  loader) rather than opening a third block — T146's own test is untouched, but
  the block it lives in now has a sibling.

**`nowFn` coupling note (§7e asked for this if I noticed it).** Any future task
that adds another `<ParentRsvp>` render site on this page must pass
`now={nowFn}`, or it reintroduces the wall-clock coupling this task removed.
Recorded in the component's own module doc #13(g) as well as here, since
comments alone are not triaged.

---

## 6. FOLLOW-UP NEEDED

One genuine out-of-scope finding, discovered while threading `profileId`. Per
item 20 I am not fixing it and not leaving it only as a code comment.

```
FOLLOW-UP NEEDED (item 20):
- What: Every row in `OutreachDetail.tsx`'s `FIXTURE_RSVPS` sets `respondedBy`
  to a `students.id`-shaped value (e.g. `respondedBy: 'student-amara-chen'`),
  but `rsvps.responded_by` is a `profiles.id` FK — so the seven fixture rows
  populate a profiles.id column with values from the students.id space, the
  exact id-space confusion `ParentRsvp.tsx` module doc #3 exists to warn about.
- Why out of scope for T157: §7f restricts changes to `FIXTURE_RSVPS` to what
  this task's own tests need, and mine need nothing from it — my parent tests
  inject their own `loadData` with correctly-spaced ids. The rows are fixtures
  consumed only by `defaultLoadOutreachDetail` (an injectable test/demo default,
  never the production `loadData`), so there is no production impact today; the
  cost is that a future reader copying a fixture row inherits the wrong id space,
  and that a parent viewing a fixture-loaded page would see every self-answered
  RSVP resolve to `'unrecognized'` ("Someone else recorded this response on your
  student's behalf") rather than to `'self'`.
- Suggested Allowed Files for the follow-up: src/pages/outreach/OutreachDetail.tsx,
  src/pages/outreach/OutreachDetail.test.tsx
- Evidence: `OutreachDetail.tsx :: FIXTURE_RSVPS` (all seven rows' `respondedBy`
  values) vs. `supabase/migrations/20260717000000_scheduling_attendance.sql`'s
  `responded_by uuid references public.profiles (id)`; and
  `OutreachDetail.tsx :: FIXTURE_STUDENTS`, which as of this task carries the
  real, correctly-spaced `profileId` values those rows should have used.
```

No other deferrals. The zero-linked-students empty state is not a deferral —
§7c/§10 resolved it as a tested, deliberate zero-length `ready` (criterion 10).

---

## 7. Constitution checks

- **Item 6 (no PII):** every new name/relationship is fabricated and in this
  file's existing register — `Amara Chen`, `Marcus Bello`, `Nina Ortiz`,
  `Sofia Delgado`, relationship `'Mom'` (PRD line 297's own literal example),
  `parent@example.com`. No real names, no real emails.
- **Item 10:** no existing test's assertion was modified. I added tests, added a
  required field at ten fixture sites, and edited the shared `vi.mock` factory
  and `afterEach` clear block — the last of which §12 explicitly authorizes and
  which I am naming here because it is real shared-infrastructure editing, not
  just "adding tests."
- **Item 12:** all four states ship and all four are tested — loading
  (criterion 8), empty as zero-length `ready` (criterion 10), error + Retry
  (criterion 9), populated (criterion 1).
- **Item 13:** no box-drawing characters rendered. The one non-ASCII character in
  new rendered copy is the em dash `—` (U+2014) in the heading — real
  punctuation, a different codepoint from U+2500 `─`, the same disclosed
  distinction `ParentRsvp.tsx`/`RsvpControl.tsx` already made.
- **Item 14:** sentence case throughout ("Your RSVP for …", "Couldn't load your
  linked students", "Loading your RSVP options…"); timestamps rendered
  America/Chicago via this page's own existing formatter.
- **Item 15:** the `Heading level={4}` is a real accessible heading inside the
  existing h1 → h2 (Signups) → h3 (session) hierarchy, and it is what makes two
  otherwise-identically-labelled radiogroups distinguishable to a screen reader.
- **Item 20:** the one deferral above is filed with the exact template.
- **Items 21/22:** SHA `b0b15b0`, explicit pathspecs only.
- **Item 23:** every mutation ran in this worktree; the shared tree was never
  modified.
- **Item 2 (Astryx props):** no new Astryx component is introduced. `VStack`,
  `Heading`, `Banner`, `Button`, `Skeleton`, `VisuallyHidden` are all used with
  props this file already uses at existing call sites.

---

## 8. Not complete, no dispute

I am **not** marking this task complete (constitution Non-Negotiables). I am
**not** filing a dispute — nothing in the packet was structurally wrong. The one
factual slip I found (§8 criterion 4's mock return shape, §4 deviation 1) is a
wording error I flagged and worked around, not grounds for a dispute.

Not pushed, no PR opened. `checker-reviewer` (opus) should re-execute all nine
mutations independently against `b0b15b0`.
