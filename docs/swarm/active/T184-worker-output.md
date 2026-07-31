# T184 — Worker Output

**Commit SHA:** `d63f7bad1a50892bfb7dc97c2f3b4cf094f0a387` (HEAD moved; working tree
clean after commit). Files changed: `src/pages/home/StudentHome.tsx`,
`src/pages/home/StudentHome.test.tsx` — the only two allowed files. Staged with
explicit pathspecs (`git add src/pages/home/StudentHome.tsx
src/pages/home/StudentHome.test.tsx`), never `git add -A`/`git add .`.

## Merge result

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```
Fast-forward: `f7ff055..8d54793`. No conflicts.

```
git log -1 --format=%H -- docs/swarm/active/T184-worker-packet.md
8d54793ec5aa6cd079663dda3c9d7e0779e8fd1f
```
Matches the pinned SHA in the assignment exactly.

`npm ci` — clean install, 340 packages, 0 build errors (9 pre-existing audit
advisories, unrelated to this task, not touched).

## Gate round 1 amendments applied

Read the "Gate round 1 amendments — AUTHORITATIVE" section before the body, as
instructed. Applied all three:

- **A1** — criterion 1's mutation is `return { kind: 'not-linked' };` (not the
  packet body's original `return null;`). Used throughout (see Criterion 1
  below).
- **A2** — re-derived the title-string list myself (below) rather than trusting
  either the packet or the gate's own count.
- **A3** — used `toStrictEqual`, not `toEqual`, for both of the two `null`→union
  test amendments (tests 4 and 5 in §6's enumeration).

## Design implemented

`StudentIdentityOutcome = ({kind:'linked'} & ResolvedStudentIdentity) |
{kind:'not-linked'} | {kind:'inactive'}`, exactly as specified in §5 of the
packet. `resolveStudentIdentity` now returns `{kind:'not-linked'}` when
`resolveStudentId` resolves `null`, `{kind:'inactive'}` when a real,
already-resolved `studentId`'s `resolveStudentScope` call resolves `null`, and
`{kind:'linked', ...}` for every other path (both real-resolution and the
`explicitTeamId` bypass). `ResolvedStudentHomeView` now has two independent
`if` blocks in place of the old `loadState.data === null` check: `not-linked`
renders the pre-existing "No student account linked yet" EmptyState verbatim
(byte-identical copy — a regression pin, not new copy); `inactive` renders a
new, distinct EmptyState:

> Title: "Your student account is inactive"
> Description: "Your student account has been deactivated. If you think this
> is a mistake, contact your coach or team admin."

Module-doc prose above `resolveStudentIdentity` and the `ResolvedStudentHomeView`
JSDoc were both updated to describe the three-way outcome (no stale "bail to
the empty state on null" prose left in place).

Nothing else touched: `explicitTeamId` bypass untouched (still returns
`linked` without reading scope — confirmed still test-only/unreachable in
production per `DashboardPage.tsx:121` mounting `<StudentHome />` with zero
props, not re-verified beyond re-reading that call site, matches packet's
own citation). No new Supabase query, no new SQL, no `is_active` read
anywhere in the diff (see Criterion 6 below) — the `inactive` signal comes
only from `resolveStudentScope`'s existing `null` return.

## Re-derived title-string enumeration (A2, my own SHA)

Ran `grep -n 'title=' src/pages/home/StudentHome.tsx` at my dispatch SHA
(after the merge, before my own edit) directly. Result: **10 `title=`
occurrences**, 2 of which are the same dynamic `title={resultTitle}` variable
(check-in result banner, lines 1137/1140 pre-edit — not a static string, not a
collision candidate) and **8 distinct static strings**:

```
"Couldn't load Home"                  "Nothing scheduled"
"You're all caught up"                "Couldn't find your student record"
"No student account linked yet"       "Sign in to view Home"
"No active season yet"                "Couldn't load the active season"
```

This matches the gate's amendment A2 enumeration exactly (8 distinct, 10
occurrences total) — independently re-derived, not copied. The new title
("Your student account is inactive") was checked against all 8 and is
distinct from each; this is directly asserted in the new (iv) isolation test
and the criterion-4 mutation below, not merely inspected.

## Per-criterion mutation evidence (§7)

All mutations applied/reverted in this worktree only (constitution item 23).
Each mutation: applied via `Edit`, ran `npx vitest run
src/pages/home/StudentHome.test.tsx`, captured actual output, reverted via
`git checkout -- src/pages/home/StudentHome.tsx`, re-confirmed green before
the next mutation.

### Criterion 1 — new "inactive" copy renders positively; mutation per A1

Baseline positive assertion (unmutated code): a render with
`resolveStudentId` resolving `'student-real-inactive-1'` and
`resolveStudentScope` resolving `null` contains "Your student account is
inactive" and does not contain "No student account linked yet"
(`StudentHome.test.tsx`, new describe block "T184 -- deactivated student
... criterion 1").

**Mutation (A1-amended):** changed `if (scope === null) return { kind:
'inactive' };` to `if (scope === null) return { kind: 'not-linked' };`.

**Actual RED output** (`npx vitest run src/pages/home/StudentHome.test.tsx`):
```
× resolveStudentIdentity (pure-ish...) > returns {kind: "inactive"} when resolveStudentScope resolves null...
  → expected { kind: 'not-linked' } to strictly equal { kind: 'inactive' }
× ... (iv) inactive ... shows a distinct EmptyState ...
  → expected 'No student account linked yetWe could…' to contain 'Your student account is inactive'
× T184 -- deactivated student ... criterion 1 > renders the new "inactive" title ...
  → expected 'No student account linked yetWe could…' to contain 'Your student account is inactive'
× T184 -- "sees nothing" ... > the inactive render shows NEITHER marker ...
  → expected 'No student account linked yetWe could…' to contain 'Your student account is inactive'

Test Files  1 failed (1)
     Tests  4 failed | 51 passed (55)
```
**This is assertion-RED, not crash-RED** — matches the gate's own measured
output verbatim (`expected 'No student account linked yet...' to contain
'Your student account is inactive'`), confirming the semantic collapse the
criterion is meant to prove, not a `TypeError`. Reverted; re-confirmed
`55/55` green.

### Criterion 2 — not-linked path untouched, zero-line diff (regression pin)

```
git diff HEAD -- src/pages/home/StudentHome.test.tsx | grep -A3 -B3 "iii) null"
```
produced **no output** — zero-line diff on that block, confirmed directly by
diffing the committed change, not merely asserted. The `it('(iii) null (no
linked student): shows a distinct EmptyState...')` test at its pre-edit
location is byte-identical in the final commit.

### Criterion 3 — pure-function contract, all six configurations + new inactive case

Six configurations covered: the three existing `{kind:'linked', ...}` success
paths (explicit `studentId`+scope, explicit `teamId` bypass, full
resolution) — all now assert the exact field values including `kind:
'linked'`, not just the tag; `{kind:'not-linked'}` with `resolveStudentScope`
proven not-called (paired with the positive return-value assertion, both in
the same test); and the new `{kind:'inactive'}` case with
`resolveStudentScope` proven called with the exact `studentId`
(`expect(resolveStudentScope).toHaveBeenCalledWith('student-explicit')`,
paired with `expect(result).toStrictEqual({ kind: 'inactive' })`).

**Mutation:** broke the `scope === null` guard by removing it entirely (fell
through to the `linked` return with `scope` still possibly `null`):
```ts
const scope = await resolveStudentScope(studentId);
return { kind: 'linked', studentId, teamId: scope.teamId, ... };
```

**Actual RED output:**
```
× resolveStudentIdentity (pure-ish...) > returns {kind: "inactive"} when resolveStudentScope resolves null...
  → Cannot read properties of null (reading 'teamId')
× ... (iv) inactive ... shows a distinct EmptyState ...
  → expected 'Couldn\'t find your student recordSom…' to contain 'Your student account is inactive'
× T184 -- deactivated student ... criterion 1 ...
  → expected 'Couldn\'t find your student recordSom…' to contain 'Your student account is inactive'
× T184 -- "sees nothing" ... > the inactive render shows NEITHER marker ...
  → expected 'Couldn\'t find your student recordSom…' to contain 'Your student account is inactive'

Tests  4 failed | 51 passed (55)
```
The pure-function test hits a genuine `TypeError` (guard was load-bearing, not
a silent pass); the three render-level tests fail via an assertion (the
`TypeError` is caught by `useLoadState`'s error handling and surfaces as the
tier's own "Couldn't find your student record" error banner instead of the
`inactive` copy). Reverted; re-confirmed `55/55` green.

### Criterion 4 — four-way DES-12 isolation, one state at a time

Extended the existing 3-way isolation `describe` block
(`<StudentHome /> T176 -- identity-resolution tier own DES-12 states...`)
with a 4th case, `(iv) inactive`, asserting the new title is present and
non-colliding with every other state's copy (both the sibling identity-tier
states and all 6 other static titles on the page — the full re-derived
8-title list minus the 2 already asserted directly).

**Mutation:** changed the `inactive` EmptyState's `title` to
`"MUTATED-CRITERION-4-TITLE"`.

**Actual RED output:**
```
✓ (i) loading: shows the tier's own loading text...
✓ (ii) error: shows a distinct error banner...
✓ (iii) null (no linked student): shows a distinct EmptyState...
× (iv) inactive (real, linked student, deactivated): shows a distinct EmptyState...
  → expected 'MUTATED-CRITERION-4-TITLEYour student…' to contain 'Your student account is inactive'
× T184 -- deactivated student ... criterion 1 ...
× T184 -- "sees nothing" ... > the inactive render shows NEITHER marker ...

Tests  3 failed | 52 passed (55)
```
**(i)/(ii)/(iii) stayed GREEN while only the mutated state's own tests (and
the two other tests that assert the same title string) went RED** — confirms
isolation: mutating the `inactive` state's copy does not perturb the other
three states. Reverted; re-confirmed `55/55` green.

### Criterion 5 — "sees nothing" positive control

New positive control (`T184 -- "sees nothing" is proven with a positive
control`): a real "linked" render (fresh, distinct ids —
`student-real-linked-c5`/`team-real-c5`) asserted to contain `Hi Ada Reyes`
(the fixture `loadData`'s `displayName`) and a `[role="progressbar"]` element
with `aria-valuetext="4 / 20 h (20%)"`. A second test renders `inactive`
(`student-real-inactive-c5`, `resolveStudentScope: async () => null`) and
asserts **neither** marker is present.

**Mutation:** commented out the entire `if (loadState.data.kind ===
'inactive') { ... }` early-return block.

**Actual RED output:**
```
× (iv) inactive ...
  → expected 'Hi Ada ReyesYou\'re all caught up. No…' to contain 'Your student account is inactive'
× T184 -- deactivated student ... criterion 1 ...
  → expected 'Hi Ada ReyesYou\'re all caught up. No…' to contain 'Your student account is inactive'
× T184 -- "sees nothing" ... > the inactive render shows NEITHER marker ...
  → expected 'Hi Ada ReyesYou\'re all caught up. No…' not to contain 'Hi Ada Reyes'

Tests  3 failed | 52 passed (55)
```
**Got the "markers now appear" failure, not a crash** — execution fell
through past the deleted guard into `StudentHomeContent` with `studentId`/
`teamId`/etc. destructured as `undefined` off a `{kind:'inactive'}` object;
`StudentHomeContent` still rendered (using its own still-fixture `loadData`,
independent of the undefined identity fields), so `Hi Ada Reyes` and the
progress bar both genuinely appeared. This is real, positive evidence that
the positive-control markers are not tautological — they only appear when
`StudentHomeContent` actually mounts, and the mutation makes exactly that
happen for a state that should show nothing. Reverted; re-confirmed `55/55`
green. `npx tsc --noEmit` was also run against this mutation as a secondary
check and fails to compile (`Property 'studentId' does not exist on type
'({kind:"linked"...}) | {kind:"inactive"}'`) — disclosed for completeness,
but the vitest run above (esbuild-transformed, no type-check) is the actual
RED evidence since that is what the runtime test suite exercises.

### Criterion 6 — no metric/identity re-derivation (inspection-level, not mutation-provable)

```
git diff HEAD | grep -n 'is_active\|supabase\|\.from(\|\.select('
```
Only 4 matches, all inside newly-added **comments** (module-doc prose
describing the existing SQL, e.g. "`v_student_goal_projection` ends `where
s.is_active`"). No production code in the diff reads `is_active`, calls
Supabase, or adds a new field to `ResolveStudentScopeFn`'s result. The
`inactive` signal comes only from `resolveStudentScope`'s pre-existing `null`
return. Stated as inspection-level per the packet's own instruction — there
is nothing to mutate to prove the absence of a query that was never added.

### Criterion 7 — blast radius confined to the two allowed files

```
git diff HEAD --stat
 src/pages/home/StudentHome.test.tsx | 94 +++++++++++++++++++++++++++++++++++--
 src/pages/home/StudentHome.tsx      | 72 +++++++++++++++++++++-------
 2 files changed, 144 insertions(+), 22 deletions(-)

git diff HEAD --stat -- src/lib/supabase/loaders/meetings.ts src/lib/supabase/loaders/students.ts src/app/guards.tsx src/pages/outreach/OutreachList.tsx src/pages/outreach/OutreachList.test.tsx
(no output)
```
Zero diff in every named forbidden file, confirmed directly.

### Criterion 8 — no other regression, exact before/after counts

Baseline, measured in this worktree at merge base (via `git stash` before
any of my edits, `npx vitest run`, then `git stash pop`):
```
Test Files  67 passed (67)
     Tests  1591 passed (1591)
```
Matches the orientation figure exactly (67 files / 1591 tests) — my merge did
not move it.

After my change (final, committed state):
```
Test Files  67 passed (67)
     Tests  1595 passed (1595)
```
+4 tests: (iv) inactive isolation, criterion-1 render test, and 2 criterion-5
positive/negative-control tests. The 5 packet-enumerated amendments modified
existing tests in place (0 net count change from those). No test file other
than `StudentHome.test.tsx` was touched.

### Criterion 9 — standard gates, before/after

**Before** (merge base, stashed):
- `npx tsc --noEmit` — not separately re-run at baseline (my post-change run
  is clean; see below). `npx eslint .` — **0 errors, 357 warnings** (measured
  directly at baseline, matches orientation exactly).
- `npx vitest run` — 67 files / 1591 tests, all passing (above).

**After** (final, committed):
- `npx tsc --noEmit` — clean, no output.
- `npx vite build` — succeeds (`✓ built in ~6-10s`, only the pre-existing
  >500kB chunk-size advisory, unrelated to this change).
- `npm run format:check` (`prettier --check`) — initially flagged
  `StudentHome.tsx` (module-doc wrapping); ran `npx prettier --write
  src/pages/home/StudentHome.tsx`, re-ran `format:check` — **all matched
  files use Prettier code style**.
- `npx eslint .` — **0 errors, 357 warnings** — identical to baseline, no new
  warnings introduced.
- `npx vitest run` — 67 files / 1595 tests, all passing.

## Non-negotiable #4 — no assertion weakened, no coverage lost (five amendments)

1. (`:1093` area) added `kind: 'linked'` to the `toEqual` object — additive,
   not weakened.
2. Same, second success config.
3. Same, third success config.
4. `expect(result).toBeNull()` → `expect(result).toStrictEqual({ kind:
   'not-linked' })` (A3: `toStrictEqual`, not `toEqual`) — strictly stronger
   (rejects any extra own-property `undefined` fields `toBeNull()` also would
   have rejected, unlike a plain `toEqual`).
5. `expect(result).toBeNull()` → `expect(result).toStrictEqual({ kind:
   'inactive' })`, title renamed (it used to describe/assert the exact bug
   this task removes); **also added** a new spy assertion
   (`expect(resolveStudentScope).toHaveBeenCalledWith('student-explicit')`)
   that the original test did not have — additive, required by §7 criterion
   3's "spy assertion, paired with the positive return-value assertion, not
   spy-only" instruction.

None of the five was found to test something the new design cannot express —
no stop-and-report was triggered.

## Known risks / disclosed, not engineered around

- **Race window** (packet's own §5 disclosure, re-verified, not re-derived):
  a race where the active season changes between `StudentHome`'s own
  `activeSeason.status === 'ready'` gate and the `resolveStudentScope` call
  could theoretically be misread as `inactive` for one render. Accepted per
  constitution item 25 proportionality — small volunteer-team app, failure
  mode is an honest-but-imprecise empty state, never fabricated data or a
  crash. Not tested or engineered around, per the packet's own instruction.
- **`explicitTeamId` bypass** still returns `linked` without reading scope,
  so it would show a deactivated student real content if ever reachable —
  confirmed (by re-reading, not re-deriving) still unreachable in production
  (`DashboardPage.tsx:121` mounts `<StudentHome />` with zero props). Left
  as-is, per the packet's explicit instruction not to "fix" it.
- **Sign-in itself is not blocked** for a deactivated student — per George's
  own ruling, this is the disclosed, authorized fallback, not a gap I
  introduced or missed. `guards.tsx`/`auth.ts` were read-only reference,
  never edited (confirmed: `git diff HEAD --stat` shows zero touch on either
  file).
- **`MeetingsList.tsx`'s own, weaker instance of this same family** (§3c of
  the packet, filed as T189) was not investigated or touched, per explicit
  instruction — stated here plainly, not omitted.
- **Criterion 6 is inspection-level, not mutation-provable** — there is no
  meaningful mutation for "a query that was never added"; stated plainly per
  the packet's own classification, not glossed over.

## Not verified by me (relying on the packet/gate's own citations, re-read but not re-executed against the DB)

- The actual Postgres behavior of `v_student_goal_projection`'s `where
  s.is_active` clause and `my_student_ids()`'s absence of an `is_active`
  filter were re-read as cited SQL text
  (`supabase/migrations` is Forbidden — no schema/SQL change and no new
  migration was run to empirically re-verify these against a live database
  in this task). This matches the packet's own citation discipline (read the
  file directly) but is not an independent database-level re-verification;
  stated plainly rather than omitted.

## Dispute

None filed. The packet's design was directly implementable as specified
(with the three gate-round-1 amendments applied), all prescribed mutations
produced the expected evidence, and all five gates are clean.

**Not marking this task complete — a checker verifies it.**
