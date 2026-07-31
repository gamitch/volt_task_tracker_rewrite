# Worker Packet: T183

**Final revision pass — authorized as a bounded exception to constitution
item 19a's 2-round premise-gate cap.** See `docs/swarm/auto-mode-decisions.md`,
"George's ruling on T183's item-19a escalation" (2026-07-30), for the
authorization. `checker-premise` ran two rounds: round 1 REVISE (1 BLOCKER,
2 MAJOR — folded in below, see "Most Recent Failure"), round 2 REVISE (0
BLOCKER, 3 MAJOR, 3 MINOR — narrow numeric/textual corrections to this
packet's own acceptance criteria and Allowed Files, not new design work;
also folded in below). Round 2's gate independently built and ran the full
prescription in its own probes and measured **69 files / 1654 tests green,
`tsc` clean** — the design is proven correct by execution, not merely
argued. **This packet goes directly to `worker-implementer` after this
revision, with no third `checker-premise` round.**

## Task ID
T183

## Objective
`StudentHome`'s production `loadData` default (`StudentHome.tsx:1763`, currently
`defaultLoadStudentHomeData`) fabricates every real signed-in student's name as
`'Ada Reyes'`. Add a new, real loader in `loaders/students.ts` that reads the
signed-in student's actual `students.display_name`, wire it as the new
production default, and leave every other `StudentHomeData` field an honest
literal empty value (`[]`/`null`/`0`) — no new queries for
events/sessions/rsvps/hours/participation. `defaultLoadStudentHomeData` itself
is untouched and stays exported for tests.

## Scope ruling (read before starting)
This packet deliberately narrows T183's ledger-row text ("Building a real
`StudentHome` loader is this row's scope") to the display name only. The
row's own title and every concrete citation in it name exactly one
user-facing defect — the fabricated name. `events`/`sessions`/`rsvps`/
`studentHours`/`participation` are honestly empty today (T176 already made
that state correct), not fabricated, and building real queries for them is
materially larger, unscoped work with its own new tables/RLS reasoning/tests.
If you disagree after your own reading, say so explicitly in your output
rather than silently expanding scope.

## Allowed Files
- `src/lib/supabase/loaders/students.ts` — new additive exports only; no
  existing export's name, signature, or behavior changes.
- `src/lib/supabase/loaders/students.test.ts` — new tests only.
- `src/pages/home/StudentHome.tsx` — exactly three edits, nothing else:
  1. One new named import from `loaders/students.ts` (extend the existing
     import at line 392, do not add a second import statement).
  2. The default-parameter value at line 1763 (`loadData =
     defaultLoadStudentHomeData` → `loadData = loadStudentHomeData` or
     whatever name you choose — keep it consistent with your export name).
  3. Module doc #9 (lines ~258–279) corrected so it stops claiming
     `displayName` is fabricated — see Acceptance Criterion 5.
  `defaultLoadStudentHomeData` itself (lines 1017–1032) must be byte-
  unchanged.
- `src/pages/home/StudentHome.test.tsx` — the `renderAsUser` harness
  (lines 107–137), the criterion-11 test (lines 1607–1695), and new test(s)
  proving the real wiring. Do not touch any other test in this file —
  including `StudentHome.test.tsx:1710-1727` (see the explicit ruling on that
  test below; it is deliberately left unedited, not overlooked).
- `src/pages/home/DashboardPage.test.tsx` — added in round 2, **widened in
  this revision to cover collateral damage the swap itself causes** —
  scoped to exactly FOUR regions and nothing else:
  1. The T176 mock-rationale comment above the `vi.mock` block, lines
     32-45 — correct the "both resolvers"/"Both modules must be mocked
     together" language (lines 38, 45) to reflect the THIRD seam this task
     adds (the display-name loader: two `vi.mock` blocks now cover three
     mocked exports, not two), and update the trailing `'Hi Ada Reyes'`
     marker text (line 45) to whichever fabricated name your mock now
     returns.
  2. The `vi.mock('../../lib/supabase/loaders/students', …)` block, lines
     53-64 — add the new loader export to the returned mock object.
  3. The `it('renders StudentHome for role "student"')` test, lines
     222-229 — change line 226's assertion from `'Hi Ada Reyes'` to the
     fabricated name your mock returns.
  4. Three now-vacuous negative assertions in the sibling role-dispatch
     tests: `expect(container.textContent).not.toContain('Hi Ada Reyes')`
     at line 205 (`renders CoachHome for role "coach"`), line 218 (`renders
     CoachHome for role "admin"`), and line 246 (`renders ParentHome for
     role "parent"`). Once region 3's mock swaps in your new fabricated
     name, these three assert against a string (`'Ada Reyes'`) that no
     longer appears anywhere for an unrelated reason — coach/admin/parent
     renders never mount `StudentHome` at all — rather than proving
     discrimination against the name actually in play. This is the exact
     vacuity class this file's own comment at lines 200-204 already
     documents for the `ParentHome` fixture names; the same principle
     applies here. Update each to assert
     `.not.toContain('Hi <your region-3 name>')`, in addition to or instead
     of the old string, so all three remain non-vacuous proof that each
     role renders neither of the other two components' identity markers.
  Zero other lines in this file may change. `DashboardPage.tsx` itself (the
  source component) stays Forbidden — this is a test-only addition. See
  "Proving the wiring for real" below for why this file is now in scope: it
  is the only test in the repo that renders `<StudentHome />` with zero
  props through the real production dispatcher, so it is the only test that
  can actually fail if `StudentHome.tsx:1763` doesn't get swapped.

## Forbidden Files
- Everything under `supabase/migrations/` (read-only reference only).
- `src/pages/home/StudentHomeSlot.tsx`, `src/pages/home/DashboardPage.tsx`
  (source component — its test file is now partially Allowed, see above; the
  component itself is not).
- `src/lib/supabase/loaders/meetings.ts`, `src/lib/supabase/loaders/dashboard.ts`,
  `src/lib/supabase/loader.ts`, `src/lib/supabase/client.ts`.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`,
  `docs/swarm/verification-log.md`, `docs/swarm/dispute-log.md`, `.claude/`.

## Context you need (re-verified against current repo state; cite these line
numbers, not the ledger row's, if you quote anything back)

**`node_modules` is present in this worktree** (re-verified for this
revision — round 1's "absent, `ERR_MODULE_NOT_FOUND`" state was specific to
that gate's own environment and no longer holds here). If your own
environment is missing it, run `npm ci` (or `npm install`) first, before
any test command. Do not interpret a pre-install failure as a repo defect.

**Real baseline, measured directly (not inherited from the ledger — the
ledger's `67/1591` figure is T176-era and stale):** full suite `69 files /
1654 tests`, all passing, 63s wall time. `StudentHome.test.tsx` alone is
`55 tests`, all passing. Use these as your starting numbers in the Required
Worker Output baseline count, not any other figure you find in this repo's
history.

**The production default and its consumer.**
`StudentHome.tsx:1763`: `loadData = defaultLoadStudentHomeData,` — this is
`<StudentHome />`'s own default parameter, and `DashboardPage.tsx:122` mounts
`<StudentHome />` with zero props, so this default is the only implementation
that ever runs in production. `defaultLoadStudentHomeData` itself is at
`StudentHome.tsx:1017-1032`; `displayName: 'Ada Reyes'` is at line 1023 and
ignores both its `studentId`/`seasonId` parameters. `LoadStudentHomeDataFn`
is declared at `StudentHome.tsx:466-469` = `(studentId, seasonId) =>
Promise<StudentHomeData>`. `StudentHomeData` is declared at lines 450-464;
the SEVEN fields beyond `displayName`/`seasonId` (re-counted, the original
draft of this packet said six and miscounted its own list) are
`defaultGoalHours`/`goalHoursOverride`/`events`/`sessions`/`rsvps`/
`studentHours`/`participation`. `data.displayName` is consumed at
`StudentHome.tsx:1388` (`` <Heading level={1}>{`Hi ${data.displayName}`}</Heading> ``)
— the only remaining fabricated identity surface; `data.events`/`data.sessions`
are consumed at lines 1358-1367 for live-session/next-up/opportunity
calculations and are already correctly empty for any real signed-in student
(they filter fixture data against a real `seasonId`/`studentId` that never
matches).

**Import direction is already established — no new circularity.**
`StudentHome.tsx:392`: `import { resolveStudentScope as
defaultResolveStudentScope } from '../../lib/supabase/loaders/students';` —
`StudentHome.tsx` already imports a function FROM `loaders/students.ts`.
`loaders/students.ts:99`: `import type { ResolveStudentScopeFn } from
'../../../pages/home/StudentHome';` — and `loaders/students.ts` already
imports a TYPE from `StudentHome.tsx`, the reverse direction. Both directions
coexist today with no cycle (TypeScript type-only imports are erased; the
runtime import is one-directional, `StudentHome.tsx` → `loaders/students.ts`).
Adding one more named import (a function this time, not just a type) to
`StudentHome.tsx:392`'s existing import statement, and one more type import
(`LoadStudentHomeDataFn`, `StudentHomeData`) to `loaders/students.ts:99`'s
existing type-only import, is consistent with both existing patterns, not a
new coupling shape.

**The exact pattern to mirror — same file, same author-verified RLS
reasoning, already Passed once.** `loaders/students.ts:391-440`:
`queryStudentGoalProjectionById` + `makeResolveStudentScope`/
`resolveStudentScope` — a single-row query via
`createLoader<string, RowType>(queryFn, getClient)`, injectable `getClient`
defaulting to `getSupabaseClient`, `.eq(...).maybeSingle()`, camelCase
mapping in the returned closure. Build the new export the same shape:
```
interface StudentDisplayNameDbRow { display_name: string }

async function queryStudentDisplayNameById(
  client: SupabaseClient,
  studentId: string,
): Promise<LoaderQueryResult<StudentDisplayNameDbRow>> {
  const result = await client
    .from('students')
    .select('display_name')
    .eq('id', studentId)
    .maybeSingle();
  return { data: (result.data as StudentDisplayNameDbRow | null) ?? null, error: result.error };
}
```
`students.ts:107-116`'s own `StudentDbRow` interface already documents
`display_name: string` as the real column
(`supabase/migrations/20260716000000_identity_roster.sql`) — do not
redeclare a full-row interface; this query selects only `display_name`, same
"select only what this screen needs" discipline `queryStudentGoalProjectionById`
already established for its own narrower column set.

**Which column: `id`, not `student_id`.** The raw `students` table's primary
key is `id` (confirmed at `students.ts:107-116`). `queryStudentGoalProjectionById`
filters `v_student_goal_projection` by `.eq('student_id', ...)` because that
VIEW names its column `student_id`; the raw table does not — filter by
`.eq('id', studentId)`. `studentId` here is genuinely `students.id`:
`loaders/meetings.ts:57` documents `resolveCurrentStudentId`'s own query as
`students.profile_id = auth.uid()` resolving `students.id`, and
`StudentHome.tsx:1566` (`resolveStudentIdentity`) threads that same value
through unchanged (`explicitStudentId ?? (await resolveStudentId(viewer))`)
to what `StudentHomeContent` eventually passes to `loadData`.

**RLS — re-verified directly, not inherited. Quoted verbatim per constitution
item 3 (no paraphrase).** `supabase/migrations/
20260717000002_rls.sql:100-102`:
```sql
create policy own_or_linked_read on students
  for select to authenticated
  using (id in (select my_student_ids()));
```
A signed-in student reading their own row by `id` resolves fine — this is a
simpler case than `queryStudentGoalProjectionById`'s own reasoning (no
multi-table view, no LEFT JOINs to trace), so your doc comment can be a short
paragraph citing this policy directly, not a re-derivation of the longer
argument at `students.ts:361-383`.

**Return shape — literal honest-empty, no fixtures, no second query.** Per
scope ruling above:
```
{
  seasonId,               // verbatim passthrough of the seasonId argument
  displayName,             // real, from the new query
  defaultGoalHours: 0,
  goalHoursOverride: null,
  events: [],
  sessions: [],
  rsvps: [],
  studentHours: null,
  participation: null,
}
```
No `FIXTURE_*` import in the new function.

**Row-not-found: your call, but disclose and test it.** By the time
`StudentHomeContent` calls `loadData`, `resolveStudentId` and
`resolveStudentScope` have already both resolved non-null for this
`studentId` (see `StudentHome.tsx:1558-1579`, `resolveStudentIdentity`) — so
a null `display_name` row here is a genuine anomaly, not an expected empty
state. Suggested default, matching `loaders/calendarFeed.ts`'s T177
"fail-loud on zero rows" precedent: throw, which surfaces as
`StudentHomeContent`'s existing "Couldn't load Home" error banner
(`StudentHome.tsx:1342-1353`) — no new DES-12 state needed. A graceful
fallback string is also acceptable if you prefer it, but the choice must be
in a doc comment and covered by a test either way.

**Module doc #9 needs a correction, not just a code change — THREE sentences
in this doc block go false, not one.** Re-verified directly against the
current worktree:
1. `StudentHome.tsx:259-262`: "`loadData` itself, and everything it
   returns, is still fixture-fed" — false once `displayName` is real.
2. `StudentHome.tsx:264-266`: "`loadData` is the injectable seam
   (`(studentId, seasonId) => Promise<StudentHomeData>`), defaulting to the
   OBVIOUSLY-FAKE `defaultLoadStudentHomeData`" — false once the production
   default parameter (`:1763`) points at your new loader instead;
   `defaultLoadStudentHomeData` remains obviously-fake, but it is no longer
   what `loadData` defaults to.
3. `StudentHome.tsx:267-277`: "...but every field `defaultLoadStudentHomeData`
   itself returns (`displayName`, `events`, ... ) is still the fixture it
   always was... `Hi Ada Reyes`, unconditionally fabricated regardless of
   who is signed in, is the lead item" — false on its lead claim.
Correct all three to state `displayName` is now sourced for real via the new
loader, while the other SEVEN fields remain honest-empty literals in the new
default (not fixture-derived) — a sentence or two per false claim, not a
rewrite of the whole doc block. Leave the doc's separate closing sentence
("is filed as its own follow-up … not built here", `:277-279`) intact or
only lightly touched — it stays accurate after this task (see the
disclosure note near the end of this packet); do not delete it or reword it
to claim the remaining fields are now covered by anything.

## The test-harness hazard — the load-bearing finding of this packet, verify
it yourself before writing any test change

`StudentHome.test.tsx`'s `renderAsUser` helper (lines 107-137) defaults
`resolveStudentId`/`resolveStudentScope` in `mergedProps` (lines 112-119) but
**does not default `loadData` at all**. Of this file's **29** `renderAsUser(...)`
call sites (re-counted directly — grepping `renderAsUser` returns **32**
total matched lines: 1 is the function definition itself, line 107; 2 are
comment mentions, lines 66 and 98; the remaining **29** are real call sites),
**20 pass `loadData` explicitly, 9 do not.**

**Corrected from round 1: the original draft of this packet grepped
`loadData:` and found only the 10 colon-form sites, missing 10 more that use
the shorthand object-property form `loadData,` referencing an outer-scope
variable also named `loadData`.** Colon-form (10): lines 823, 834, 854, 914,
1205, 1222, 1232, 1440, 1540, 1582. Shorthand-form (10, previously missed):
lines 704, 721, 733, 788, 933, 956, 992, 1039, 1294, 1361. That is 20 of 29.
Two further direct `root.render(...)` calls exist outside `renderAsUser`
entirely, at lines 1392 and 1412 (not 1396/1417 as an earlier draft of this
packet stated — those are the `<StudentHome ...>` JSX mount lines *inside*
those two `root.render` calls, not the calls themselves): the 1412 one
passes `loadData={fixtureLoadData}` explicitly and is unaffected either way;
the 1392 one passes no props at all (`<StudentHome />`) but is **also**
unaffected by this task, because it renders without a `<SeasonProvider>`
ancestor, so `useActiveSeason()` throws before the component ever reaches
`loadData` — confirm this yourself by reading `StudentHome.test.tsx:1387-1409`
before relying on it.

**Of the 9 sites that don't pass `loadData` explicitly, only 2 actually
reach `loadData` and would fail if it started hitting the real network call
— not "a large, mechanical batch" as an earlier draft of this packet
claimed.** The other 7 short-circuit earlier, in the identity-resolution
tier (`renderAsUser(null)` at line 818 never mounts `StudentHome` signed-in
at all; lines 1450/1468/1484/1500 are the criterion-7 identity-tier DES-12
states — pending/error/null/inactive — each of which returns before
`loadData` is invoked; lines 1699/1729 are the T184 "inactive" tests, same
early return via a null `resolveStudentScope`). **The exact two that DO
reach `loadData` and fail:** `StudentHome.test.tsx:1608` (the criterion-11
test, `describe`/`it` starting at 1607/1608, assertion at line 1644,
`expect(html).toContain('Hi Ada Reyes')`) and `StudentHome.test.tsx:1711`
(T184 criterion-5's "positive control" test, `describe`/`it` starting at
1709/1710, assertion at line 1722, `expect(container.textContent).toContain('Hi
Ada Reyes')`). Both were independently re-confirmed for this revision by
direct inspection of the source, not just accepted from the round-1 gate.

**If you swap `StudentHome.tsx:1763`'s default parameter without also fixing
the harness, exactly THREE tests, in TWO files, will start invoking your
new, real, `getSupabaseClient()`-backed loader.** In this project's test
environment `getSupabaseClient()` throws `SupabaseNotConfiguredError` when
unconfigured (`client.ts`, cited in `loader.ts`'s own module doc), which
`createLoader` normalizes into a rejected promise — so these tests will not
hang, but they will render "Couldn't load Home" instead of `'Hi Ada Reyes'`,
and fail. The third is `DashboardPage.test.tsx:226` (the `renders
StudentHome for role "student"` test), for the identical mechanism: it too
renders `<StudentHome />` with zero props, and at this point in the
sequence its `loaders/students` mock (lines 53-64) does not yet cover your
new loader's export — that mock extension only happens later, deliberately,
at criterion 7b. Confirm this yourself by running the full suite immediately
after the `StudentHome.tsx` swap, before touching any test file or the
`DashboardPage.test.tsx` mock — you should see **exactly 3 new failures, in
2 files**: `StudentHome.test.tsx:1608` (assertion at `:1644`),
`StudentHome.test.tsx:1711` (assertion at `:1722`), and
`DashboardPage.test.tsx:226`. Nothing more and nothing less. If you see a
different count or different locations, stop and re-diagnose before
proceeding; your understanding of the harness is incomplete.

**Required fix:** add a `loadData: defaultLoadStudentHomeData` default to
`renderAsUser`'s `mergedProps` (same spread-order convention already used for
`resolveStudentId`/`resolveStudentScope` — the harness default first, an
individual test's own `props` override wins via the later spread). This
restores both of the two `StudentHome.test.tsx` failures, and every other
pre-existing test in that file, to their exact original behavior with
**zero content changes**, because `defaultLoadStudentHomeData` itself is
untouched. **This harness fix lives entirely inside `StudentHome.test.tsx`
and cannot reach `DashboardPage.test.tsx` — do not expect the full suite
back to baseline at this point.** Re-run the full suite after this harness
fix (before either deliberate test update) and confirm: `StudentHome.test.tsx`
itself back to its own 55/55, and the full suite at **1653 passed / 1
failed** — the single remaining failure is `DashboardPage.test.tsx:226`,
unchanged, because its mock still doesn't cover your new loader's export.
From this point there are exactly **two** deliberate edits ahead of you:
the criterion-11 test (next section) and `DashboardPage.test.tsx`'s
"renders StudentHome for role student" test / mock ("Proving the wiring for
real" below) — the latter is also what finally clears the one remaining
failure. `StudentHome.test.tsx:1710-1727` (the T184 positive control) is
the second of the two `StudentHome.test.tsx` failures from the mid-swap
step, but its fix is **not** a third deliberate edit — it is simply
restored to green, unedited, by the harness fix alone. See the explicit
ruling on it below.

## The one test that must change on purpose, not by accident

`StudentHome.test.tsx:1607-1695`, describe block titled `T176 --
render-and-enumerate live over container.innerHTML, real ids + default
loadData (criterion 11)`. This test's own inline comment (line 1625:
`` // `defaultLoadStudentHomeData` -- the shipped default, unmodified. ``)
and its Row-1 assertion (lines 1641-1644: `` // ... stays fabricated
regardless of real, non-placeholder ids -- `defaultLoadStudentHomeData`
ignores both its parameters for `displayName`. `` / `expect(html).toContain('Hi
Ada Reyes');`) exist specifically to document what the shipped production
default does, field by field. After this task, that documentation is wrong on
its single most important row. With the harness fix above applied
unconditionally, this test would silently keep passing against
`defaultLoadStudentHomeData` (the harness default) and would no longer
exercise or prove anything about the actual new production default —
exactly the kind of stale-but-green test this project's process notes warn
about.

Fix it explicitly: give this one test its own `loadData` override that
exercises the REAL new loader against a stubbed Supabase client (see next
section for the construction), update Row 1's assertion to the real injected
name, and correct or delete the now-false inline comment. Every other row in
that test (progress bar, hours legend, participation em dash, empty Next
Up/opportunities) should keep asserting the same honest-empty behavior it
already does — those fields are unaffected by this task.

## Explicit ruling on `StudentHome.test.tsx:1710-1727` — the other test that
fails mid-swap, and is deliberately left alone

`StudentHome.test.tsx:1709-1727`, describe block `T184 -- "sees nothing" is
proven with a positive control (criterion 5)`, `it('positive control: a real
"linked" render DOES show greeting + goal-bar content markers')`. Like the
criterion-11 test, this one calls `renderAsUser` with no `loadData` override
(line 1711) and asserts `container.textContent.toContain('Hi Ada Reyes')`
(line 1722) alongside a progress-bar assertion. Round 1 correctly flagged
that this packet's earlier draft never disclosed this test exists or is
affected — fixed now, with an explicit ruling rather than leaving it for the
worker to decide:

**Do not edit this test. Leave it exactly as-is.** The harness fix alone
restores it to green, and that is the correct outcome, for a reason distinct
from the criterion-11 case: this test's own purpose (per its `describe`/`it`
titles) is to prove **DES-12 state discrimination** — that a real "linked,
active" render shows greeting-and-goal-bar markers at all, as a positive
control paired against the sibling "inactive" test right after it (lines
1728-1738) which proves those same markers are ABSENT for a deactivated
student. It does not exist to document what the production default returns,
field by field — that is the criterion-11 test's job, and only that job.
Whether the greeting text is `'Hi Ada Reyes'` (the harness/fixture default)
or some other name is immaterial to what this test is checking: it only
needs *a* truthy greeting to exist for the "linked" case and be absent for
the "inactive" case. After the harness fix, `'Hi Ada Reyes'` here is a
harness-fixture marker proving greeting-presence, not a claim about the
shipped production default — the same distinction this packet draws for the
criterion-11 test, just resolved the other way because the two tests exist
to prove different things. If you disagree with this reasoning once you've
read both tests yourself, say so explicitly in your output rather than
silently editing this test — but the packet's own ruling is: leave it alone.

## Proving the wiring for real (anti-vacuous-absence requirement)

Per this task's own instruction and the project's process history: do not
assert only `not.toContain('Hi Ada Reyes')` anywhere — pair it with a
positive assertion tied to a real injected value, so a broken-but-differently-
fabricated implementation would still fail.

Because your new loader is exported with an injectable `getClient` (mirroring
`makeResolveStudentScope`), the simplest construction is direct DI, no
`vi.mock` needed:
```
const client = { from: (table) => { /* returns display_name row */ } };
const loadData = makeLoadStudentHomeData(() => client);
renderAsUser(STUDENT_USER, { loadData, resolveStudentId: async () => 'student-x', ... });
```
mirroring `students.test.ts`'s own `makeRecordingClient` helper
(lines 40-62) but for the `students` table instead of
`v_student_goal_projection`. Use a fabricated, non-'Ada Reyes' name
(constitution item 6 — fixtures use fabricated names) so the assertion is
unambiguous, e.g. `'Priya Chen'`. Assert `container.textContent` contains
`` `Hi Priya Chen` `` and does not contain `'Hi Ada Reyes'` — both, not just
the negative.

**This DI'd `StudentHome.test.tsx` test is necessary but not sufficient —
it proves the new loader works in isolation, not that the default parameter
at `StudentHome.tsx:1763` actually got swapped.** Every render in
`StudentHome.test.tsx` passes at least `resolveStudentId`/`resolveStudentScope`
via the harness, and the two positive tests you write inject `loadData`
explicitly too — so all of them would still pass even if you never touched
line 1763 at all. **`DashboardPage.test.tsx`'s "renders StudentHome for role
\"student\"" test (lines 222-229) is the ONLY test in the entire repo that
renders `<StudentHome />` with zero props through the real production
dispatcher** (`DashboardPage.tsx:122`, Forbidden but unaffected — only its
test file changes), which makes it the only test that can actually fail if
`StudentHome.tsx:1763`'s default parameter doesn't get swapped. This is the
gate-verified "cheaper path" from round 1 (Probe D, 5/5 pass): extend the
existing `vi.mock('../../lib/supabase/loaders/students', …)` block at
`DashboardPage.test.tsx:53-64` (already there from T176's own MAJOR-6 fix —
it currently overrides only `resolveStudentScope`) to also return your new
loader's export with a distinct fabricated name, then change line 226's
assertion from `expect(container.textContent).toContain('Hi Ada Reyes')` to
expect that name instead. Use a name distinct from BOTH `'Ada Reyes'` AND
the name you pick for the `StudentHome.test.tsx` DI'd test above (e.g. if
that one uses `'Priya Chen'`, use something else here, such as `'Jordan
Blake'`) — two different fabricated names, so a reader can tell at a glance
which test is proving which thing, and so a bug that returns the wrong
constant couldn't accidentally satisfy both. Both this test and the DI'd
`StudentHome.test.tsx` test are REQUIRED (criterion 7 below) — the
`DashboardPage.test.tsx` one because it is the only real proof the
production wiring changed, the `StudentHome.test.tsx` one because it is the
more direct, more debuggable unit-level proof of the loader's own behavior.

## Acceptance Criteria
1. New additive exports in `loaders/students.ts` (suggested names:
   `queryStudentDisplayNameById`, `makeLoadStudentHomeData`,
   `loadStudentHomeData`) follow the exact `queryStudentGoalProjectionById`/
   `makeResolveStudentScope`/`resolveStudentScope` shape (injectable
   `getClient`, `.eq('id', studentId).maybeSingle()`). Zero existing export's
   name, signature, or behavior changes — diff `loaders/students.ts` and
   confirm it is additive-only.
2. The new loader's `Promise<StudentHomeData>` return matches the literal
   shape in "Return shape" above exactly: real `displayName`, verbatim
   `seasonId`, and `defaultGoalHours: 0` / `goalHoursOverride: null` /
   `events: []` / `sessions: []` / `rsvps: []` / `studentHours: null` /
   `participation: null`. No `FIXTURE_*` symbol referenced anywhere in the
   new code.
3. Row-not-found behavior is implemented, disclosed in a doc comment, and
   covered by a test (either fail-loud reject or a graceful fallback — your
   choice, but not silently unhandled).
4. `StudentHome.tsx` diff is exactly: one import extended at line 392, the
   default-parameter value at line 1763, and the module-doc #9 correction
   described above. `defaultLoadStudentHomeData` (lines 1017-1032) is
   byte-identical before/after — diff it directly to confirm.
5. `renderAsUser` (`StudentHome.test.tsx:107-137`) gets a `loadData:
   defaultLoadStudentHomeData` default added to `mergedProps`. Report FOUR
   suite runs, not two: (a) baseline before any change — expect `69 files /
   1654 tests`, all passing; (b) immediately after the `StudentHome.tsx`
   default-parameter swap, before touching the harness, any test, or the
   `DashboardPage.test.tsx` mock — expect **exactly 3** new failures, in
   **2 files**: `StudentHome.test.tsx:1608` and `:1711`, plus
   `DashboardPage.test.tsx:226` (see "test-harness hazard" above) and
   nowhere else; if you see a different count or different locations, stop
   and re-diagnose; (c) after the harness fix alone (before the deliberate
   test edits in criteria 6/7) — **do not expect all-green.** The harness
   fix lives entirely inside `StudentHome.test.tsx` and cannot reach
   `DashboardPage.test.tsx`. Expect `StudentHome.test.tsx` itself restored
   to its own full 55/55, and the full suite at **1653 passed / 1 failed**
   — the one remaining failure is `DashboardPage.test.tsx:226`, unchanged,
   because its mock still doesn't cover your new loader's export until
   criterion 7b; (d) after criteria 6/7's deliberate edits (including 7b's
   mock extension) — full suite back to `1654` passing, with the two
   deliberate content changes from criteria 6/7b, per criterion 11 below.
6. The criterion-11 test (`StudentHome.test.tsx:1607-1695`) is deliberately
   updated per "The one test that must change" above: real loader injected
   via a stubbed client, Row 1 asserts the real injected name, stale comment
   corrected. No other assertion in that test changes.
7. BOTH of the following (not either/or — see "Proving the wiring for real"
   above for why one alone is insufficient):
   a. A new test in `StudentHome.test.tsx` (colocated with or replacing part
      of the criterion-11 update — your call on whether it's the same test
      or a sibling) proves the wiring positively via direct DI: a
      fabricated, distinct display name from a stubbed client renders
      verbatim in the `Hi <name>` greeting, AND `'Hi Ada Reyes'` is absent —
      both assertions present, not just one.
   b. `DashboardPage.test.tsx`'s `loaders/students` mock block (lines 53-64)
      is extended to also return your new loader's export with a second,
      distinct fabricated name (not the same string used in 7a), and the
      `renders StudentHome for role "student"` test's assertion (line 226)
      is updated from `'Hi Ada Reyes'` to that name. This is the only test
      in the repo that renders `<StudentHome />` zero-props through the
      real production dispatcher, so it is the only test that closes the
      vacuity gap on `StudentHome.tsx:1763` actually changing.
   c. Because 7b changes what `<StudentHome />` actually renders under
      `DashboardPage.test.tsx`'s zero-props dispatch, three OTHER
      assertions in the same file go vacuously true for the wrong reason
      once `'Ada Reyes'` stops appearing anywhere: `expect(container
      .textContent).not.toContain('Hi Ada Reyes')` at line 205 (`role
      "coach"`), line 218 (`role "admin"`), and line 246 (`role "parent"`)
      — this file's own comment at lines 200-204 already documents this
      exact vacuity class for the `ParentHome` fixture names, and the same
      principle applies here. Update all three to assert
      `.not.toContain('Hi <your 7b name>')`, in addition to or instead of
      the old string, so each stays proof that the coach/admin/parent
      renders show neither `StudentHome`'s nor `ParentHome`'s identity
      markers. Also correct the mock-rationale comment at lines 32-45: it
      currently says "**both** resolvers must be mocked together" (line 38)
      and "...would otherwise surface as 'Couldn't find your student
      record' instead of 'Hi Ada Reyes'" (lines 43-45) — both claims go
      false once a third seam (this task's display-name loader) exists and
      the marker string changes; reword to name three mocked exports across
      the two `vi.mock` blocks, and the new marker string.
8. New unit tests in `students.test.ts`, mirroring the existing
   `makeResolveStudentScope` describe block (lines 64-170): correct
   `.from('students').select('display_name').eq('id', studentId)
   .maybeSingle()` chain (spy-verified), camelCase mapping, the SEVEN
   literal honest-empty fields (`defaultGoalHours`, `goalHoursOverride`,
   `events`, `sessions`, `rsvps`, `studentHours`, `participation` — not six,
   an earlier draft of this packet miscounted), the row-not-found behavior
   from criterion 3, and an eq-drop filter-guard mutation test proving the
   intended assertion fails (not a `TypeError`) — same technique as the
   existing eq-drop test at lines 145-169.
9. `StudentHome.test.tsx:1199-1212` (T176 criterion 1, "loadData is called
   with exactly the injected resolveStudentId result") and lines 1215-1242
   (criterion 2) pass unmodified — both already inject `loadData` explicitly.
   Confirm by running them, not by inspection alone.
10. `defaultLoadStudentHomeData`'s own direct-injection tests (e.g.
    "renders the shipped default fixture data end to end",
    `StudentHome.test.tsx:842-873`) pass unmodified.
11. Full repo test suite: report before/after counts (baseline `69 files /
    1654 tests`, per above; final also `69 files / 1654 tests`, all
    passing). Zero newly-*failing* tests at any point outside the
    documented mid-swap window (criterion 5b/5c). Content changes are
    confined to: the criterion-11 test (criterion 6), `DashboardPage.test.tsx`'s
    "renders StudentHome for role student" test and its mock (criterion
    7b), and the three sibling-role `.not.toContain(...)` assertions plus
    the mock-rationale comment in `DashboardPage.test.tsx` (criterion 7c) —
    all of which remain passing throughout, so none of them count against
    the newly-failing check. `StudentHome.test.tsx:1710-1727` (T184's
    positive control) must be green and BYTE-IDENTICAL to its pre-task
    state — it is restored by the harness fix alone and is explicitly NOT
    to be edited (see the ruling on it above). Zero `.skip`/`.only`/`.todo`
    introduced.
12. `tsc`, eslint, and prettier all clean (or unchanged from baseline
    counts, with any delta explained). Current baseline, re-measured
    directly for this revision (`RESUME-HERE.md:20`, matching this
    packet's own `69 files / 1654 tests` figure): `tsc` exit 0, eslint
    **0 errors / 358 warnings**, prettier clean except one pre-existing,
    unrelated warning on `src/theme/volt.ts` (not yours to fix). An
    expected `react-refresh/only-export-components` +1 is acceptable if
    you export a new component-adjacent function, matching the class
    already tolerated at `StudentHome.tsx` per T176/T184's own merges.
13. Zero diff on every Forbidden file. Zero diff outside the Allowed list —
    including, for `DashboardPage.test.tsx` specifically, zero diff outside
    its FOUR named regions (the mock-rationale comment, lines 32-45; the
    mock block, lines 53-64; the student-role test, lines 222-229; and the
    three sibling-test assertions at lines 205/218/246). Diff that file
    directly and confirm nothing else moved.

## Relevant Constitution Excerpt
- Non-Negotiables: "Existing tests must pass unless the boss explicitly
  approves a test update." (This packet pre-authorizes content updates to a
  bounded, named set: the `StudentHome.test.tsx` criterion-11 test
  (criterion 6); `DashboardPage.test.tsx`'s "renders StudentHome for role
  student" test and its mock (criterion 7b); and, added in this revision,
  `DashboardPage.test.tsx`'s three sibling-role `.not.toContain(...)`
  assertions at lines 205/218/246 plus its mock-rationale comment
  (criterion 7c) — the last three are the packet's own swap causing
  collateral vacuity elsewhere in the same file, not new scope. All are
  necessary and load-bearing; every other test, including
  `StudentHome.test.tsx:1710-1727`, must remain green AND unedited.)
- Item 3: RLS/metric SQL come only from PRD 8.4 / real migrations, copied
  verbatim; no re-deriving. The `own_or_linked_read` policy is quoted
  verbatim in the Context section above, including its `for select to
  authenticated` clause — cite it exactly as shown, not paraphrased.
  (This task adds no metric math.)
- Item 6: "No PII ... in ... test fixtures -- fixtures use fabricated names."
  Use a fabricated name (not a real person) for the new test's stubbed
  `display_name`.
- Item 18: sonnet tier is correct — this reads an existing RLS-covered table
  the same way T176's already-Passed `queryStudentGoalProjectionById` does;
  it does not touch migrations, RLS authoring, security-definer SQL, or
  auth/session/role logic.
- Item 19c: "Verify your own citations before submitting." Every line number
  in this packet was re-read against the current worktree, not inherited from
  the ledger row — do the same before you rely on any of them, they may have
  drifted further by the time you start.
- Item 20: any deliberate narrowing you decide to make beyond this packet's
  own scope ruling must produce a follow-up ledger row, not just a code
  comment. **This item-20 question for the events/sessions/rsvps/
  studentHours/participation seam has already been decided by the
  orchestrator, not left to you — see "Disclosure note" below. You do not
  need to file anything about it; just leave the module-doc sentence intact
  per the instruction above.**
- Item 25 (proportionality): this is a small-team app; do not over-engineer
  the row-not-found handling or add defensive layers beyond what's asked.

## Disclosure note (decided by the orchestrator, not yours to resolve)
`StudentHome.tsx:277-279`'s module doc says the remaining `events`/
`sessions`/`rsvps`/`participation` seam "is filed as its own follow-up …
not built here." T183's own ledger row text ("Building a real `StudentHome`
loader is this row's scope") reads as if T183 were that follow-up — but this
packet deliberately narrows T183 to `displayName` only, and no row among
T184-T189 covers building real queries for the rest. The orchestrator is
filing a new follow-up ledger row to cover that gap so the module doc's
sentence stays true after this task lands. **This is not something for you
to act on** beyond the module-doc-correction instruction already given
above (leave that closing sentence intact, don't delete it or claim
coverage it doesn't have).

## Most Recent Failure
**Round 1 (checker-premise): REVISE.** 1 BLOCKER (the harness+swap combo
silently broke `DashboardPage.test.tsx:226`, a test outside the original
Allowed Files, which criterion 13 then forbade fixing — resolved by adding
that file to Allowed Files, scoped, this round), 2 MAJOR (a second broken
test, `StudentHome.test.tsx:1710-1727`, was never disclosed — resolved with
an explicit ruling above; and no test exercised the actual production
default at all, since every positive test injected `loadData` — resolved by
requiring the `DashboardPage.test.tsx` proof). Plus 7 factual corrections
(stale baseline numbers, a field-count error, an under-counted `loadData`
grep, an imprecise "large batch" failure-count claim, a non-verbatim RLS
quote, two mislabeled line numbers, and a missing node_modules-install
note) — all folded into this revision and independently re-verified against
the current worktree (not accepted on the gate's word alone): `npm ci` +
full suite run confirms `69 files / 1654 tests` baseline and `55` tests in
`StudentHome.test.tsx`; the `own_or_linked_read` RLS policy, the 7-field
`StudentHomeData` shape, the 20/29 `loadData`-site split, the exactly-two
failing tests, and the `root.render` line numbers (1392/1412) were all
directly re-read from source, not copied from the gate's report.

**Round 2 (checker-premise): REVISE.** 0 BLOCKER, 3 MAJOR, 3 MINOR — narrow
numeric/textual corrections to this packet's own acceptance criteria and
Allowed Files, not a design flaw. The gate independently built and ran the
full prescription (not just critiqued it), measuring **69 files / 1654
tests green, `tsc` clean**, and separately proved (by omitting just the
`StudentHome.tsx:1763` swap) that the wiring-proof criterion genuinely fails
without the real fix. All findings folded into this revision and
independently re-verified against the current worktree:
1. **MAJOR — "exactly 2 new failures" was wrong.** Measured: **3** failing
   tests in **2** files (`StudentHome.test.tsx:1608`/`:1711` plus
   `DashboardPage.test.tsx:226`). Fixed in the test-harness-hazard section,
   criterion 5(b), and Required Worker Output.
2. **MAJOR — criterion 5(c) claimed the impossible.** The harness fix lives
   only in `StudentHome.test.tsx`; it cannot reach `DashboardPage.test.tsx`.
   After the harness fix alone the suite is **1653/1654**, not all-green.
   Fixed in criterion 5(c) and the "Required fix" paragraph.
3. **MAJOR — the packet forbade fixing collateral damage it itself causes.**
   Once 7b's mock swaps in the new name, three sibling assertions in
   `DashboardPage.test.tsx` (lines 205/218/246) go vacuously true, and the
   mock-rationale comment (lines 32-45) goes stale. Fixed: Allowed Files and
   criterion 13 widened to four named regions; new criterion 7c added.
4. **MINOR — `renderAsUser` arithmetic.** Grep returns **32** matched lines
   (1 definition + 2 comments + 29 call sites), not "31 ... one comment."
   The 29/20/9 figures were already correct.
5. **MINOR — module doc #9 under-scoped.** Two more sentences besides the
   one already flagged are now false (lines 259-262, 264-266). All three
   now named in the correction instruction.
6. **MINOR — citation nits.** `StudentHomeData` closes at line 464 (already
   correct). `DashboardPage.test.tsx`'s student-role test closes at line
   **229**, not 230 — fixed throughout. Lint baseline re-measured at **0
   errors / 358 warnings** (`RESUME-HERE.md:20`), not the 357 T181-era
   figure — added to criterion 12. `node_modules` **is** present in this
   worktree — softened the note accordingly.

**This was the final authorized revision round.** Per George's ruling
(`auto-mode-decisions.md`, "George's ruling on T183's item-19a
escalation"), this packet is dispatched directly to `worker-implementer`
after this revision — there is no third `checker-premise` round.

## Required Worker Output
- Files changed (exact list).
- Summary of the new loader's shape and your row-not-found decision.
- Confirmation you ran `npm ci` (or `npm install`) first if `node_modules`
  was missing in your environment (it is present in this worktree as
  handed off, but confirm your own state before relying on that).
- Confirmation you ran the full suite FOUR times: (1) before any change —
  baseline count, expect `69 files / 1654 tests`; (2) immediately after the
  `StudentHome.tsx` default-swap, before touching the harness or the
  `DashboardPage.test.tsx` mock — to confirm you personally observed
  **exactly 3** new failures, in **2 files** (`StudentHome.test.tsx:1608`
  and `:1711`, plus `DashboardPage.test.tsx:226`), and nowhere else, not
  just took this packet's word for it; (3) after the harness fix alone,
  before any deliberate test edit — confirm `StudentHome.test.tsx` back to
  55/55 and the full suite at **1653/1654** with only
  `DashboardPage.test.tsx:226` still failing (do not report "all green"
  here — that is not correct at this checkpoint); (4) after criteria 6/7's
  deliberate edits — final count, back to `69 files / 1654 tests`, all
  passing, with content changes confined to the criterion-11 test, the
  `DashboardPage.test.tsx` student-role test/mock, and the three
  `DashboardPage.test.tsx` sibling-assertion + comment updates (criterion
  7c) — and `StudentHome.test.tsx:1710-1727` green but byte-identical.
- `tsc`/eslint/prettier output, compared against the current baseline (`tsc`
  exit 0, eslint 0 errors / 358 warnings — see criterion 12).
- Confirmation `defaultLoadStudentHomeData` is byte-identical (a `git diff`
  excerpt scoped to lines 1017-1032, or equivalent).
- Confirmation `StudentHome.test.tsx:1710-1727` is byte-identical before/
  after (a `git diff` excerpt scoped to those lines, or equivalent).
- Confirmation `DashboardPage.test.tsx`'s diff touches only its four named
  regions — lines 32-45, 53-64, 205, 218, 222-229, and 246 (a `git diff` of
  the whole file, or equivalent).
- Known risks, and whether a dispute is needed (e.g. if you concluded the
  scope ruling above is wrong, the row-not-found behavior needs a different
  DES-12 treatment than a plain error banner, or you disagree with the
  ruling on `StudentHome.test.tsx:1710-1727`).
