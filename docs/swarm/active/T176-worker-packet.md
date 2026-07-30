
# T176 — Worker Packet

`StudentHome`'s `studentId`/`teamId`/`seasonId` default to placeholders; every
signed-in student's dashboard fetches a fixture identity's data.

**Header.** Branch tip `b2beb09` on `claude/swarm-plan-zl575z`. Ledger row:
`docs/swarm/task-ledger.md` (T176, "Filed"; T155, "MERGED — the landed
template"). Source audit: `docs/swarm/inbox/claude-audit-batch-2-t168-sweep.md`
draft T-C1. **All citations below are read-verified by the foreman-planner
directly against the live file contents at this SHA — not measured by
running anything (the foreman has no Bash tool).** Line numbers are hints,
not authoritative; two are already known to have drifted (see "Corrections
to my own inputs" at the end). Re-verify everything with your own tools
before relying on it, per item 19c.

**FIRST ACTION, before reading anything else in this packet or in
`StudentHome.tsx`: merge `origin/claude/swarm-plan-zl575z` into your
worktree.** Worktrees are created from `main` (`f7ff055`), which does **not**
contain T155's merged `CoachHome` split, T157's `ParentRsvp` wiring, or the
`resolveCurrentStudentId` precedent this packet builds on. T157's worker was
dispatched against a stale packet for exactly this reason and threw away
~320 lines. If your worktree doesn't contain `b2beb09`, this packet will
cite symbols and patterns that don't exist yet in your tree.

**Nothing in this packet is owner-approved.** George asked only for T176 to
be dispatched; every architectural decision below (the 3-tier component
split, which files are Allowed, the worker tier) is the foreman's own
judgment call, not his. Nothing here cites `auto-mode-decisions.md` because
nothing relevant exists there (checked: no entry mentions `StudentHome` or
T176).

---

## 1. The bug (read-verified)

`StudentHome.tsx`, `export function StudentHome({...})` (hint: `:1130-1137`):

```ts
export function StudentHome({
  loadData = defaultLoadStudentHomeData,
  studentId = PLACEHOLDER_CURRENT_STUDENT_ID,   // 'student-placeholder-current-viewer'
  teamId = PLACEHOLDER_CURRENT_TEAM_ID,          // 'team-placeholder-current-viewer'
  seasonId = PLACEHOLDER_SEASON_ID,              // 'season-placeholder-current'
  nowFn = () => new Date(),
  submitCheckinCode = defaultSubmitCheckinCode,
}: StudentHomeProps = {}): ReactNode {
```

`DashboardPage.tsx` (`export function DashboardPage`, hint `:107-130`) role
switch: `case 'student': return <StudentHome />;` — zero props, the sole
production render site.

Load-bearing: `const loadState = useLoadState(() => loadData(studentId,
seasonId), [loadData, studentId, seasonId]);` (hint `:1139-1142`) is the real
fetch call. Every signed-in student's dashboard is fetched for the fixture
identity, not theirs.

## 2. What I established myself, read-verified, not yet rendered

### 2a. `studentId` — reuse the shipped seam, do not build a second one

`resolveCurrentStudentId` (value, `loaders/meetings.ts` `:664`) /
`makeResolveCurrentStudentId` (`:636-661`) already resolves the signed-in
user's own `students.id`:
- student role → `students.profile_id = auth.uid()` (`queryStudentIdByProfileId`, `:491-501`, private)
- parent role → earliest-linked child via `guardian_links` (`queryFirstLinkedStudentId`, `:504-518`, private)
- coach/admin → returns `null` defensively (dead branch here: `DashboardPage`
  only ever mounts `StudentHome` for `role === 'student'`, so this branch
  never fires in production — don't build role-branching inside
  `StudentHome` to guard against it, the shared function already does)

Its types (`CurrentViewerIdentity { id: string; role: Role }`,
`ResolveCurrentStudentIdFn = (viewer) => Promise<string | null>`) are
**exported from `MeetingsList.tsx`** (`:698`, `:706`), and `loaders/
meetings.ts` already imports them back from there (`:158-171`) — a two-way
type/value split that's the established convention for this exact
capability, not an accident. Import both the types (from `MeetingsList.tsx`)
and the default value (from `loaders/meetings.ts`) into `StudentHome.tsx`
the same way. **Do not edit `MeetingsList.tsx` or `MeetingsList.test.tsx` —
both are read-only reference/Forbidden here.**

The precedent (`MeetingsList.tsx`) resolves only when the caller does *not*
supply an explicit `studentId` — an inner wrapper component
(`ResolvedStudentMeetingsView`, `:2411-2455`) owns its own `useLoadState`
call and its own loading/error/null-empty-state DOM, and only renders the
real content component once resolution succeeds. `StudentMeetingsViewContainer`
(`:2468-2484`) is the dispatcher: `explicitStudentId !== undefined` bypasses
resolution entirely, unchanged behavior for every caller/test that already
passes one. **Mirror this shape.**

The module doc's own framing (`MeetingsList.tsx` module doc #6, hint
`:124-183`) is explicit that this fails loudly rather than silently faking a
resolution — that's the posture, not decoration.

### 2b. `teamId` — resolvable here. T155's deferral does NOT transfer.

T155 deferred `CoachHome`'s `teamId` on a measured fact, not a guess:
`AuthUser` (`guards.tsx`, `export interface AuthUser`, **verified at `:49-53`,
not `:219-223`** — see corrections section) is `{id, email, role}`, no team
linkage at all, and a *coach's* team isn't a well-defined single value
anyway (a coach isn't scoped to one team). For a *student*, there is exactly
one team: `students.team_id uuid not null references public.teams (id)`
(`supabase/migrations/20260716000000_identity_roster.sql:63`) — **`not
null`**, so once `studentId` is known, `teamId` always exists and is a
single value.

RLS confirmed (`supabase/migrations/20260717000002_rls.sql:96-102`):
```sql
create policy staff_all on students ...
create policy own_or_linked_read on students
  for select to authenticated
  using (id in (select my_student_ids()));
```
`my_student_ids()` (`:20-26`) returns the signed-in student's own row id (or
their guardian's linked children). A plain `select('team_id').eq('id',
studentId)` for the just-resolved `studentId` is therefore already
RLS-scoped to the requester's own row — no new authorization logic needed,
same posture the reused `resolveCurrentStudentId` already has.

**Do not reuse `queryAllStudents`** (`loaders/outreach.ts:756-768`) even
though it does select `team_id` — it is `outreach.ts`-private (not
exported), it's the coach-facing full-roster query (would need a network
call returning every visible row just to read one), and cross-importing a
private-by-convention query between two unrelated page-loader files isn't
this codebase's pattern anywhere else. It's cited here only as schema
evidence that `team_id` is a real, already-used column — not as a function
to import.

**Add ONE new, minimal function to `loaders/meetings.ts`** (additive only —
see Allowed Files) that takes an already-resolved `studentId: string` and
returns `Promise<string | null>` (`null` only defensively, since the column
is `not null`; treat it the same as "no student record" if it ever occurs).
Own its type (`ResolveStudentTeamIdFn`) in `StudentHome.tsx` — the actual
consumer — and have `loaders/meetings.ts` import it back as a type, mirroring
the exact cross-file shape `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn`
already use in the opposite direction.

### 2c. There is no real `StudentHome` loader. Fixing identity props ≠ fixing the data.

`LoadStudentHomeDataFn` (`:383-386`) is declared only in this file;
`defaultLoadStudentHomeData` (`:903-918`) is the only implementation
anywhere, and it's a fixture. Building a real loader is explicitly **out of
scope** here — same posture T155 took for `CoachHome`, T173's own filed
follow-up.

**Read-verified prediction of what survives the fix, NOT rendered — you must
confirm or correct this by actually rendering (§6, criterion 10):**

`defaultLoadStudentHomeData(studentId, seasonId)`:
- `seasonId: seasonId` — passthrough, always real once you fix sourcing.
- `displayName: 'Ada Reyes'` — **hardcoded literal, ignores both params
  entirely.** Renders as `` `Hi ${data.displayName}` `` (`:1250`). My
  prediction: **stays fabricated**, unconditionally, forever, regardless of
  which real student is signed in.
- `defaultGoalHours: FIXTURE_DEFAULT_GOAL_HOURS` (`= 100`, `:896`) —
  **hardcoded, ignores both params.** Feeds `goalHours =
  resolveGoalHours(data.goalHoursOverride, data.defaultGoalHours)` (`:1240`,
  and `goalHoursOverride` is *also* always `null` from the fixture) →
  `hoursVsGoalPercent` → the `ProgressBar`'s `formatValueLabel` (`:1284`,
  `` `${value} / ${max} h (${hoursPercent}%)` ``). My prediction: with
  `confirmedHours` correctly going to `0` (see below), this renders `0 / 100
  h (0%)` — a fabricated denominator beside a genuinely honest zero, same
  two-surfaces-one-field shape T173 found on `CoachHome`'s `defaultGoalHours`
  (there: `0 / 38 hrs` + a separate `Default goal 10h` secondary; here, only
  the one surface — I did not find a second secondary-text surface for this
  field on this page, but confirm by reading, don't take my word for it).
- `events: FIXTURE_EVENTS.filter((e) => e.seasonId === seasonId)` (`:912`) —
  every `FIXTURE_EVENTS` row hardcodes `seasonId: PLACEHOLDER_SEASON_ID`
  (`:794/802/810/820`). Once `seasonId` is a real season UUID this filter
  never matches → `events` becomes `[]`. **My prediction: this correctly
  goes honestly empty** — same mechanism T173 found on `CoachHome`'s
  `events`/`teamParticipation`/`studentHours` fields.
- `sessions: FIXTURE_SESSIONS` (`:913`), `rsvps: FIXTURE_RSVPS` (`:914`) —
  neither is filtered at the loader level, but every consumer
  (`selectLiveMeetingSession` `:553-568`, `buildNextUp` `:584-627`,
  `getUnansweredOutreachOpportunities` `:639-666`) joins sessions back to
  `events` via `eventById.get(session.eventId)` and drops any session with
  no matching event. With `events` empty, every join misses → hero renders
  `quiet-greeting`, "Next up" and "Sign-up opportunities" both render their
  `EmptyState`. **My prediction: honestly empty**, not fabricated (the
  "you're all caught up" quiet-greeting copy is the same for a genuinely
  caught-up student and for this all-filtered-out state — it never asserts
  a false positive, so I'm not calling it fabricated, but flag if you
  disagree).
- `studentHours`/`participation`: both gated `FIXTURE_*.studentId ===
  studentId` (`:915-916`) against the fixture's own hardcoded
  `PLACEHOLDER_CURRENT_STUDENT_ID`. Once `studentId` is a real resolved
  student id, neither matches → both `null` → `confirmedHours` becomes `0`
  (`:1238`, `?? 0`) and `` `Participation: ${... : '—'}` `` (`:1288`) shows
  `—`. **My prediction: honestly empty.**

**I got the CoachHome equivalent of this enumeration wrong three times in
one day before a render proved it. Do not repeat my prediction as fact —
render it and correct me if I'm wrong.** (§6, criterion 10, is not optional
and is not satisfied by re-tracing the code above — I already did that.)

## 3. Corrections to my own inputs (found while verifying, before dispatch)

1. `AuthUser`'s no-team-linkage evidence is at `guards.tsx:49-53` (`export
   interface AuthUser { id: string; email: string; role: Role; }`), not
   `:219-223` (that's `AuthProviderProps`, an unrelated interface). Same
   citation-drift class the T157 gate caught twice on this project already
   (`:2396`/`:2320`, `:1392-1397`/`:1391-1396`). The *conclusion* the brief
   drew from it is still correct — just the line number was wrong.
2. `queryAllStudents`'s select string (`'id, display_name, team_id,
   profile_id, goal_hours_override'`) lives in `loaders/outreach.ts:756-768`,
   not a shared `loaders/students.ts` — no such file exists. It's real
   evidence that `team_id` is a live, already-used column (confirms `teamId`
   is resolvable), but it is **not exported** and should not be imported or
   reused directly (§2b).
3. The ledger row's own re-verification SHA (`08b3ac1`) predates this
   packet's dispatch SHA (`b2beb09`) — I re-read the live files myself at
   dispatch time rather than trusting that earlier pass, and everything
   above reflects that fresh read.

## 4. The trap the brief did not flag — found here, not in any of the three inputs

**`DashboardPage.test.tsx` will break, and it is not obviously in scope.**

`DashboardPage.tsx` renders `<StudentHome />` with **zero** props (module
doc #3's own text: "This dispatcher's ONLY job is role-based component
selection... does not plumb any props through"). `DashboardPage.test.tsx`
has an existing test, `'renders StudentHome for role "student"'` (hint
`:148-155`), that asserts `container.textContent` contains `'Hi Ada Reyes'`
after exactly 3 flushed microtasks, with **no** mock of
`resolveCurrentStudentId` or the Supabase client anywhere in that file.

Once `StudentHome`'s default `studentId`/`teamId` resolution goes real (an
actual `getSupabaseClient()`-backed call), this test's unmocked render will
hit that real default inside jsdom with no Supabase env configured — it will
not synchronously produce `'Hi Ada Reyes'` the way it does today. This is
the same class of trap the brief told you to watch for in `StudentHome.
test.tsx` itself (§6, criterion 10's "pin the loader" instruction), just in
a **different, easy-to-miss file** that doesn't import from `StudentHome.tsx`
directly and that neither the brief nor T155's ledger row mentions.

Precedent for what to do about it: this exact file was already touched by
T155 for the analogous `CoachHome`/`useActiveSeason()` case — its own module
doc (`:35-46`) attributes a `<SeasonProvider>` wrapper addition to T155,
"harness-only, no individual `it(` body changes" where avoidable. Follow
that precedent: `DashboardPage.test.tsx` is an Allowed File here, scoped
narrowly (§5) to making the identity resolution resolve safely in this
harness (e.g. `vi.mock('../../lib/supabase/loaders/meetings', async
(importOriginal) => ({...(await importOriginal()), resolveCurrentStudentId:
async () => FIXTURE_ID}))` — the `importOriginal` partial-mock pattern this
project already uses elsewhere, cited in T161's own ledger row) plus,
if needed, an extra `await flushMicrotasks()` call for the added async hop.
**Once mocked to a fixture id, my own prediction (§2c) is that `'Hi Ada
Reyes'` still appears** (it's unconditionally fabricated), so this
particular test's *assertions* may not need to change at all — only its
*harness*. Disclose exactly what you changed and why; do not touch the
other four `it(` bodies in that `describe` block unless you can show they
are actually affected.

## 5. Allowed / Forbidden files

**Allowed:**
- `src/pages/home/StudentHome.tsx`
- `src/pages/home/StudentHome.test.tsx`
- `src/lib/supabase/loaders/meetings.ts` — **additive only.** You may add new
  exports (a team-id resolver, its DB row type, its query function). You may
  **not** change the name, signature, return shape, or behavior of any
  existing export — `resolveCurrentStudentId`, `makeResolveCurrentStudentId`,
  `queryStudentIdByProfileId`, `StudentIdDbRow`, `queryFirstLinkedStudentId`,
  `GuardianLinkStudentIdDbRow`, or anything else already in that file. If
  your diff touches an existing line for any reason, stop and explain why in
  your worker output before proceeding.
- `src/lib/supabase/loaders/meetings.test.ts` — **new file.** Scope it to
  the new team-id resolver only. This is **not** T162 ("`loaders/meetings.ts`
  has 0 tests, 726 lines" — still filed, not yet packeted, still true for
  everything else in that file after you land this). Say so explicitly in
  your output so a future reader doesn't assume T162 is subsumed.
- `src/pages/home/DashboardPage.test.tsx` — **harness-only** (§4). Do not
  change `DashboardPage.tsx` itself (see Forbidden below) or any assertion
  in the `'coach'`/`'admin'`/`'parent'`/`null` cases.

**Forbidden (task-specific, in addition to the standing list):**
- `src/pages/home/DashboardPage.tsx` — see reasoning below.
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx`
- `src/pages/home/ParentHome.tsx`, `ParentHome.test.tsx`
- `src/pages/meetings/MeetingsList.tsx`, `MeetingsList.test.tsx`,
  `ScheduleMeetingsDialog.tsx` — read-only reference; import from, never edit.
- `src/lib/supabase/loaders/outreach.ts` — read-only reference (§2b/§3.2).
- `supabase/migrations/**` — no migration needed; the schema already
  supports this (§2b).

**Standing Forbidden list:** `docs/swarm/constitution.md`,
`docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
`docs/swarm/dispute-log.md`, `.claude/**`, `node_modules/`.

**Why `DashboardPage.tsx` is Forbidden here (decision, not the owner's):**
T155's proven pattern sources `seasonId` entirely inside `CoachHome.tsx`
via `useActiveSeason()`, leaving `DashboardPage.tsx` byte-identical
(sha256-confirmed by T155's checker) — no props threaded from the
dispatcher. `MeetingsList.tsx`'s `studentId` resolution is the same shape:
resolved internally via `useAuth()`, never threaded in from a parent. Both
precedents independently chose "resolve inside the leaf component," and
`DashboardPage.tsx`'s own module doc already asserts (and today is still
true) that it "does not plumb any props through." Mirroring both
precedents keeps that assertion true and avoids a second task ever needing
to touch this exact dispatcher file for identity plumbing. (Its module doc
is stale in one place after this lands — see §7 NIT — but fixing prose in a
Forbidden file is out of scope; flag it, don't fix it.)

## 6. Prescribed shape (deviate only with a stated reason in your worker output)

Three-component split, extending T155's two-tier `CoachHome`/`CoachHomeContent`
pattern with one more tier for identity resolution (season status and
student identity are independent — season doesn't depend on which student it
is, so gate season first, matching `CoachHome`'s already-proven ordering,
then resolve identity):

1. **`StudentHome`** (outer, keeps the name — `DashboardPage.tsx` imports it
   unchanged). Calls `useAuth()` and `useActiveSeason()` unconditionally
   (mirrors `CoachHome`'s own module doc note, hint `:2108-2111`: "Both
   `useAuth()` and `useActiveSeason()` are called unconditionally before
   either conditional return"). `user === null` check **first** (sign-in
   prompt, unchanged copy) — **must** precede the `activeSeason.status`
   switch, not be merged into or follow it (criterion 5). Then the same
   four-way `activeSeason.status` switch `CoachHome`'s outer wrapper already
   uses (`loading`/`none`/`error`/`ready` — independently authored, not
   imported from the Forbidden `CoachHome.tsx`). On `ready`, renders the
   identity-resolution wrapper.
2. **A new inner wrapper** (name it what you like — mirrors
   `ResolvedStudentMeetingsView`): calls `useLoadState` unconditionally to
   resolve `{studentId, teamId}` via a small exported pure function (e.g.
   `resolveStudentIdentity(viewer, resolveStudentId, resolveTeamId)`,
   exported so it's independently unit-testable the same way `buildNextUp`/
   `selectHeroState` already are in this file) — **unless** both `studentId`
   and `teamId` were supplied explicitly as props, in which case skip this
   tier entirely and render the content component directly (mirrors
   `StudentMeetingsViewContainer`'s `explicitStudentId !== undefined`
   bypass, generalized to two independently-bypassable props). Give this
   tier its **own** loading/error/no-student-linked DES-12 states, with
   copy distinguishable from the data-loading/error copy the content
   component already has (criterion 7) — do not reuse "Loading Home…"/
   "Couldn't load Home" verbatim for both boundaries; that ambiguity was
   already logged as a NIT against `CoachHome`'s shared-skeleton-text choice
   in T155's own merge (filed as T173) — don't repeat it here uncorrected.
3. **The renamed content component** (e.g. `StudentHomeContent`): everything
   `StudentHome`'s current function body does, unchanged in behavior,
   parameterized by real, never-defaulted-to-a-placeholder `studentId`/
   `teamId`/`seasonId` props (mirrors `CoachHomeContentProps`).

## 7. Acceptance criteria — each with its prescribed mutation

Baselines **by reference**: before any edit, run the full suite (`npm run
typecheck`, `npm run lint`, `npm run format:check`, `npm run build`,
`vitest run`) at your own merged worktree tip and record those exact
numbers as your reference baseline. Do not use any count in this packet or
in any ledger row as a baseline — two prior tasks on this project shipped
false regressions from stale pinned numbers.

1. **Real `studentId` reaches `loadData`.** Inject a distinguishable,
   non-placeholder, fabricated (item 6) `resolveStudentId` (e.g. resolves to
   `'student-fixture-resolved'`) and spy on `loadData`; assert `loadData`
   was called with exactly that id, never `PLACEHOLDER_CURRENT_STUDENT_ID`.
   **Positive assertion, paired, not negative-only** — asserting merely
   "not the placeholder" would pass if the fetch were disabled entirely.
   *Mutation:* revert to the hardcoded placeholder default; confirm the spy
   assertion goes red with the wrong id; restore; report the failure output.
   Mutation-provable.

2. **Explicit `studentId` prop bypasses resolution.** Pass an explicit
   `studentId` plus a `resolveStudentId` spy; assert the spy was called
   **zero** times. *Mutation:* remove the bypass branch so resolution always
   fires; confirm the spy's call count goes from 0 to 1 and the test fails.
   Mutation-provable.

3. **Real `teamId`, resolved from the real `studentId`, reaches the
   team-scoped widgets.** Reuse this file's own existing "Titans-only"
   team-scope-exclusion fixture pattern (`FIXTURE_EVENTS`'s
   `event-titans-meeting`/`FIXTURE_SESSIONS`'s `session-titans-meeting`,
   `:816-825`/`:850-858`): inject `resolveTeamId` returning a specific
   fixture team id, construct events scoped to that id (rendered) and to a
   different id (excluded), assert both outcomes on real DOM text.
   *Mutation:* revert to the hardcoded `PLACEHOLDER_CURRENT_TEAM_ID` (or
   skip team resolution); confirm the team-scope proof now passes/fails
   incorrectly (the wrong session renders, or the right one doesn't).
   Mutation-provable.

4. **Explicit `teamId` prop bypasses its own resolution**, independently of
   criterion 2 (a caller may supply one without the other). Same shape as
   criterion 2, spy call count. Mutation-provable.

5. **Ordering: `user === null` precedes the season switch, which precedes
   identity resolution.** Reuse T155's own proof technique exactly: a
   synchronous sign-in-prompt test with no microtask flush.
   *Mutation:* reorder the checks; confirm the synchronous test fails
   (shows a season-loading skeleton instead of "Sign in to view Home", or
   an identity-loading state instead of either). Mutation-provable.

6. **`seasonId` is sourced from `useActiveSeason()`, never
   `PLACEHOLDER_SEASON_ID`.** Two parts, mirroring T155's own criterion 4:
   (a) a probe rendering `StudentHome` with no `<SeasonProvider>` ancestor
   throws exactly `'useActiveSeason() must be called within a
   <SeasonProvider>.'`; (b) a spy on `loadData` receives the real
   `activeSeason.season.id`, never the retired placeholder. *Mutation for
   (b):* revert to the defaulted `seasonId` parameter; confirm the spy sees
   the placeholder again. Mutation-provable, positive+paired.

7. **Identity-resolution's own loading/error/no-student-linked states are
   DES-12-complete (item 12) and textually distinct from the data-loading/
   error states.** *Mutation (loading):* make `resolveStudentId` never
   resolve; assert the identity-tier's own loading text, not "Loading
   Home…". *Mutation (error):* make it reject; assert a distinct error
   banner with a working Retry. *Mutation (null):* make it resolve `null`;
   assert a distinct "no student record" EmptyState. Mutation-provable for
   existence/distinctness of each state; the exact copy choice itself is
   your call, not mandated.

8. **The new `team_id` query is scoped only by the resolved student's own
   id — no new client-side authorization logic.** Using a stubbed Supabase
   client (mirror T157's checker's own filter-guard technique: assert the
   exact `.eq(...)` args reaching the stub, not just the return value).
   *Mutation:* drop the `.eq('id', studentId)` filter; confirm the guard
   test fails. Mutation-provable. Separately, **inspection-only, not
   mutation-provable**: confirm by diff review that no new role/family
   check was added anywhere (RLS is the sole authorization boundary here,
   per §2b) — label this half of the criterion as inspection.

9. **No metric-math re-derivation (constitution item 3).** Diff review only
   (**inspection, not mutation-provable**): `resolveGoalHours`,
   `hoursVsGoalPercent`, `computePlannedHours`, `buildNextUp`,
   `getUnansweredOutreachOpportunities`, `selectLiveMeetingSession` function
   *bodies* are byte-unchanged; only their call sites' `studentId`/`teamId`
   argument sourcing may change.

10. **Render and enumerate every surviving on-screen fabricated surface,
    live — not by re-tracing the code I already traced in §2c.** With the
    real, never-placeholder `studentId`/`teamId`/`seasonId` (via your own
    resolvers) and the **default** `loadData` (`defaultLoadStudentHomeData`,
    not a test-injected fixture), render `StudentHome` end-to-end, dump the
    full DOM text, and list every surviving string individually: its exact
    on-screen text, the field it comes from, and whether it **stays
    fabricated** or **goes honestly empty**. Confirm or correct my §2c
    prediction (`'Hi Ada Reyes'` and the `defaultGoalHours`-fed denominator
    predicted to survive; `events`/`sessions`/`rsvps`/`studentHours`/
    `participation` predicted to go honestly empty). This is a live-render
    requirement, not an inspection — label it as such in your output.

11. **File the follow-up (item 20).** Whatever criterion 10 actually finds,
    state the exact ledger-row text for a `StudentHome` sibling of T173 (the
    `CoachHome` equivalent) — same defect class (`LoadStudentHomeDataFn` has
    no real implementation anywhere; the fixture's unfiltered fields
    survive the identity fix). The foreman cannot write this row without
    your criterion-10 findings.

12. **`DashboardPage.test.tsx`'s existing five tests all stay green,** with
    every change disclosed (§4). If the student-role test's assertions
    genuinely must change (not just its harness), say exactly what and why.

## 8. Worker/checker tier

**Worker: sonnet.** Walking item 18's four triggers explicitly, since the
brief asked me to say whether it fires rather than assert it doesn't:
- creates/edits a file under `supabase/migrations/` — no (§2b: schema
  already supports this, no migration).
- creates/modifies an RLS policy or a `security definer` helper — no (the
  new query relies entirely on the already-shipped `own_or_linked_read`
  policy, unmodified).
- creates/modifies a SQL view with metric math — no.
- changes auth, session, role-resolution, or permission logic — **this is
  the one to weigh, not wave away.** The new code reads which team a
  signed-in student's own row belongs to. It is not role *resolution*
  (that's `guards.tsx`'s `resolveRole`, untouched) and it is not a new
  *permission* — RLS already enforces the exact same row-scoping
  regardless of what this task's TypeScript does or gets wrong (§2b,
  §7 criterion 8's inspection half). It's narrower than T157's own new
  query (a cross-family `guardian_links` read, opus-escalated as a judgment
  call) — this is a single own-row read, by the resolved viewer, of a
  column already reachable to a coach/admin via `queryAllStudents`. The
  literal precedent, `resolveCurrentStudentId` itself (T096), shipped at
  the default tier with no opus override. I'm following that precedent, not
  overriding it — flag to the checker if you disagree; this is exactly the
  kind of call item 18 wants recorded, not silently assumed either way.

**Checker: `checker-reviewer`, opus.** Matches T155 (sonnet worker, opus
checker) — the closest template — not because item 18 forces it, but
because this task's hardest failure mode (§2c/criterion 10, the
render-and-enumerate requirement) is exactly the class of judgment that
needed opus's rigor project-wide even on sonnet-tier work, and getting it
wrong here has already cost three corrections on the sibling CoachHome task
in one day.

Checker instructions specific to this task: independently execute every
mutation above rather than trusting the worker's description of one (per
T157's own checker's practice); re-render criterion 10 yourself with your
own fixture ids rather than re-reading the worker's enumeration; verify
`DashboardPage.test.tsx`'s harness change doesn't silently disable the
student-role test's own assertions (e.g. an over-broad mock that makes the
test pass regardless of what `StudentHome` renders — check the mock is
narrowly scoped to `resolveCurrentStudentId`/the new team resolver, not the
whole `loaders/meetings.ts` module's behavior).

## 9. Required worker output

- Full DOM dump for criterion 10's render, with the enumeration as its own
  labeled section (not folded into the mutation report for another
  criterion).
- Every mutation's actual command/diff and the actual failure output
  (constitution item 13's spirit: no unexecutable prescriptions carried
  forward — if any mutation above turns out not to fail as predicted, say
  so and explain, don't silently skip it).
- The exact `DashboardPage.test.tsx` diff, with reasoning for every changed
  line.
- The exact follow-up ledger-row text (criterion 11).
- Full suite counts before/after, by reference to your own dispatch-SHA
  baseline, not any number in this packet.
- Any place you deviated from §6's prescribed shape, and why.
