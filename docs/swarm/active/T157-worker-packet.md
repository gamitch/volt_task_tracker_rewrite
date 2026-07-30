# T157 worker packet — mount `ParentRsvp` in `OutreachDetail.tsx`

Written against branch `claude/swarm-plan-zl575z` @ `1c119ae`. All citations below
are symbol-based; line numbers are given only as non-authoritative hints, per
`architecture-review-parallelism.md` §3.1 (line citations are the largest source of
stale-packet defects on this branch, and multiple other tasks are landing lines in
adjacent files while this one is in flight). If a hint is stale, trust the symbol,
re-locate it, and proceed — do not stop and report a citation drift as a blocker.

**Foreman's epistemic status, stated per instruction:** I have no Bash tool. Every
figure and design claim below is **read-verified** (I opened the file and read the
text) but **not executed** — I have not run `tsc`, the test suite, or any mutation.
`checker-premise` must re-verify all of it by execution before this reaches a worker,
per constitution item 19. Do not treat anything below as measured.

---

## 1. Objective

`ParentRsvp.tsx` is a finished, tested, unreachable component. Mount it in
`OutreachDetail.tsx` so a signed-in parent viewing an outreach event's detail page
sees a real, working RSVP-on-behalf control for each of their linked students, with
real data threaded through — not fixture defaults.

## 2. Authority — read this before touching scope

**George ruled, verbatim** (`docs/swarm/auto-mode-decisions.md`, section "2026-07-30 —
George's rulings on T157/T158"): *"embed the leaderboard in the dashboard, ParentRsvp
in OutreachDetail."* This settles **one thing only**: `ParentRsvp` is hosted by
`OutreachDetail.tsx`. Cite that document for the host-screen decision. Do not cite him
for anything else in this packet.

**Everything else below — the loader design, which props get which real values, where
in the page the control sits, the test shape, the tiering — is the orchestrator's call,
not George's.** If your own output doc states a decision was "authorized," state
correctly *by whom*: the host screen is his; every other design choice in this packet
is the foreman's, made under standing orchestrator authority. Three packets on this
branch have already mis-attributed an orchestrator decision to George; do not make a
fourth. If you disagree with a foreman-level design choice here, say so in your output
doc — do not silently follow it if you find it wrong, and do not silently deviate
either. Flag it.

**`RsvpControl` (the student-facing self-service control) is explicitly NOT in this
task.** It is `T169`, blocked on a separate ruling about which screen hosts it. Do not
mount it, do not import it, do not reference it as in-scope, and do not let anything
you write invite a future reader to "while I'm here" it in. If you notice something
that would be easier to fix by touching `RsvpControl.tsx`, don't — it's not in your
Allowed Files (see §5) and doing so would violate constitution item 20's opposite
(silent scope creep instead of silent scope drop) as much as a silent deferral would.

## 3. Correction to the ledger's own framing — read before designing the loader side

The ledger row and this task's source audit both say **"the mutation path is real...
no loader work is needed — this is placement plus data threading."** That claim is
**correct for the RSVP submission itself** (`submitRsvpChange`,
`outreach.ts :: makeSubmitRsvpChange`, needs zero changes) but **wrong about the read
side**, and I want to be explicit that I am correcting it rather than silently
following it:

- `ParentRsvp.tsx :: ParentRsvpProps` requires `studentProfileId: string | null` and
  `guardianLinks: readonly GuardianLinkRow[]`. Neither exists anywhere in
  `OutreachDetail.tsx`'s current data shape:
  - `OutreachDetail.tsx :: RosterStudent` carries only `id`/`name`/`teamId` — no
    `profileId`.
  - `OutreachDetail.tsx :: OutreachDetailData` carries no `guardianLinks` field at
    all, and nothing in `outreach.ts` queries the `guardian_links` table for this
    page's purposes today.
- I independently confirmed (read, not executed) that `outreach.ts`'s only students
  query, `queryAllStudents`, selects `'id, display_name, team_id, goal_hours_override'`
  — no `profile_id` — and that no query anywhere in `outreach.ts` touches
  `guardian_links`.
- This is real, bounded loader work, not "just wiring." §6 below designs it. It is
  in scope for this task (not a deferral) because without it, the only way to satisfy
  §8's acceptance criteria would be to pass fixture/empty values into `ParentRsvp`,
  which is exactly the defect class (optional prop, plausible default, caller passes
  nothing) that produced three of the owner's four production bugs this session.
  Threading this data for real *is* the task, not scope creep on top of it.

## 4. Ground truth, re-verified against the live tree (read-verified, not executed)

- `ParentRsvp.tsx` is imported by exactly one file, its own test
  (`ParentRsvp.test.tsx`, symbol: the `import { ParentRsvp, ... } from './ParentRsvp'`
  line). Zero production importers.
- `ParentRsvp.tsx :: ParentRsvp` (its own module doc #4, symbol-cited) states:
  *"A future page (`ParentHome.tsx`, `OutreachDetail.tsx`) is expected to render one
  `<ParentRsvp>` per linked student, passing each student's own
  `studentId`/`studentProfileId`/`guardianLinks` slice — not built here."* You are
  that future task, for `OutreachDetail.tsx` only.
- `ParentRsvpProps` (full shape, `ParentRsvp.tsx`): `studentId: string`,
  `studentProfileId: string | null`, `session: RsvpControlSession`,
  `eventTitle: string`, `currentRsvp: RsvpRow | null`,
  `guardianLinks: readonly GuardianLinkRow[]`, `currentUserProfileId?: string`
  (defaults to a disclosed placeholder), `onRsvpChange?: OnRsvpChangeFn` (defaults to
  the real `submitRsvpChange`), `now?: () => Date` (defaults to the real clock).
- `submitRsvpChange` (`outreach.ts :: makeSubmitRsvpChange` / its default export
  `submitRsvpChange`) is real, Supabase-backed, and already the default `onRsvpChange`
  baked into `ParentRsvp.tsx` at its own import time — same posture
  `MarkEventCompleteDialog`'s `onMarkSessionComplete` already has relative to
  `OutreachDetail.tsx` (module doc #12: "not given its own injectable override prop
  here... the dialog's own default already uses the real mutation internally"). Do
  **not** add an `onRsvpChange` override prop to `OutreachDetail`'s own props — that
  would deviate from this established, already-precedented pattern for no benefit.
- `guardian_links` table (`supabase/migrations/20260716000000_identity_roster.sql`,
  symbol: `create table public.guardian_links`): `id`, `parent_profile_id` (FK
  `profiles`, not null), `student_id` (FK `students`, not null), `relationship` (text,
  **not null**), `created_at`. RLS (`20260717000002_rls.sql`, symbol: `own_read` policy
  on `guardian_links`): `parent_profile_id = auth.uid() or student_id in (select
  my_student_ids())`. A query filtered `.eq('parent_profile_id', <the signed-in
  parent's own id>)` is RLS-consistent and cannot over-fetch another parent's rows.
- `students` table (same migration, symbol: `create table public.students`):
  `profile_id uuid references public.profiles (id)`, **nullable** (a student may have
  no account yet).
- A **shared** `GuardianLinkRow` type already exists at `src/lib/supabase/types.ts ::
  GuardianLinkRow` (`id`, `parentProfileId`, `studentId`, `relationship`,
  `createdAt`). **Do not use it here.** `parents.ts`'s own module doc ("Trap #3")
  already made and documented the same call for a sibling page: this codebase's
  established convention (`OutreachDetail.tsx`'s own `RsvpRow`/`RosterStudent`/
  `TeamOption`/`ProfileOption`, all page-local) is that `OutreachDetail.tsx` declares
  its own row shapes, sized to what it needs and field-matched to the sibling
  component it feeds, and `outreach.ts` maps DB rows into them. Follow that, not the
  shared type — see §6.

## 5. Allowed / Forbidden files

**Allowed (write access):**
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`
- `src/lib/supabase/loaders/outreach.ts`
- `src/lib/supabase/loaders/outreach.test.ts`

**Forbidden (no write access — read for reference only):**
- `src/pages/outreach/ParentRsvp.tsx`, `ParentRsvp.test.tsx` — finished, tested,
  read-only. Do not modify. Its own test file is the authority for its internal
  status-mapping/attribution/lock-boundary behavior — do not duplicate that coverage
  here.
- `src/pages/outreach/RsvpControl.tsx`, `RsvpControl.test.tsx` — not in scope (§2).
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx` — T155 has a worker/gate
  actively running against these.
- `src/lib/supabase/client.ts`, `client.test.ts`, `src/app/ThemeModeProvider.tsx`,
  `ThemeModeProvider.test.tsx` — T154 has a checker actively running against these.
- `src/app/guards.tsx` — read-only reference for `useAuth()`/`AuthUser`/`Role`. You
  are reading existing role-derivation, not changing it (§7's role check is the exact
  shape `OutreachDetail.tsx :: isStaffViewer` already uses; do not touch `guards.tsx`).
- `docs/swarm/**`, `.claude/**` — standard, every task.
- Any file not listed above as Allowed.

If you find a genuine defect or gap outside these files, **do not fix it and do not
only note it in a comment.** Report it in your output doc using the exact template in
§10 — the foreman creates the ledger row; you cannot (`task-ledger.md` is Forbidden to
you).

## 6. Design — loader side (`outreach.ts`)

All of the following is a design **prescription**, not yet code — adapt as needed if
you find a concrete conflict, but report any deviation and why.

**6a. Extend `RosterStudent` (in `OutreachDetail.tsx`) with one field:**
```ts
export interface RosterStudent {
  id: string;
  name: string;
  teamId: string;
  /** T157: that student's own profiles.id (students.profile_id), or null when the
   * student has no linked account yet. Threaded through so ParentRsvp's own
   * self-vs-guardian attribution (module doc #2(b)) can be computed correctly. */
  profileId: string | null;
}
```
This is the same "page-local type grows one new field for a real need" move
`OutreachDetailEvent` already made for T101 (its own module doc cites the identical
precedent from `loaders/students.ts :: TeamRow.archived`) — cite that precedent in
your own comment rather than inventing new justification prose.

**6b. Extend `StudentDbRow` and `queryAllStudents` (in `outreach.ts`) to carry
`profile_id`:**
```ts
interface StudentDbRow {
  id: string;
  display_name: string;
  team_id: string;
  profile_id: string | null;
  goal_hours_override: number | null;
}
```
`queryAllStudents`'s `.select(...)` string grows to include `profile_id`. This
function and `StudentDbRow` are shared with `makeLoadOutreachData` (the `OutreachList`
loader, via `mapStudentDbRowToOutreachStudentFixture`) — confirm (read, then verify by
running `tsc`/the existing suite) that adding an unused extra column there is a no-op
for that path. My own read found no test anywhere that asserts an exact/exhaustive
`.select()` string for `queryAllStudents`, so this should be additive-only, but verify
rather than assume.

Update `mapStudentDbRowToRosterStudent` to map the new field:
`profileId: row.profile_id`.

**6c. Add a new page-local type to `OutreachDetail.tsx`, field-matched to
`ParentRsvp.tsx`'s own `GuardianLinkRow` so it passes straight through with zero
reshaping (this is literally what `ParentRsvp.tsx`'s own module doc #4 asked for):**
```ts
export interface GuardianLinkRow {
  id: string;
  parentProfileId: string;
  studentId: string;
  relationship: string;
}
```

**6d. New loader in `outreach.ts`** — same `createLoader`/`getClient` DI convention
every other factory in this file already uses (cite `makeLoadOutreachDetail` as your
structural template):
```ts
export type LoadGuardianLinksForParentFn = (
  parentProfileId: string,
) => Promise<readonly GuardianLinkRow[]>;

interface GuardianLinkDbRow {
  id: string;
  parent_profile_id: string;
  student_id: string;
  relationship: string;
}

async function queryGuardianLinksForParent(
  client: SupabaseClient,
  parentProfileId: string,
): Promise<LoaderQueryResult<GuardianLinkDbRow[]>> {
  const result = await client
    .from('guardian_links')
    .select('id, parent_profile_id, student_id, relationship')
    .eq('parent_profile_id', parentProfileId);
  return { data: (result.data as GuardianLinkDbRow[] | null) ?? null, error: result.error };
}

function mapGuardianLinkDbRowToGuardianLinkRow(row: GuardianLinkDbRow): GuardianLinkRow {
  return {
    id: row.id,
    parentProfileId: row.parent_profile_id,
    studentId: row.student_id,
    relationship: row.relationship,
  };
}

export function makeLoadGuardianLinksForParent(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadGuardianLinksForParentFn {
  const loadLinks = createLoader<string, GuardianLinkDbRow[]>(
    queryGuardianLinksForParent,
    getClient,
  );
  return async (parentProfileId: string): Promise<readonly GuardianLinkRow[]> =>
    ((await loadLinks(parentProfileId)) ?? []).map(mapGuardianLinkDbRowToGuardianLinkRow);
}

export const loadGuardianLinksForParent: LoadGuardianLinksForParentFn =
  makeLoadGuardianLinksForParent();
```
Import `GuardianLinkRow` into `outreach.ts` from `OutreachDetail.tsx`'s existing
type-import block (alongside the existing `RosterStudent`/`RsvpRow as
DetailRsvpRow`/etc. import).

**Why filtered server-side rather than fetched unfiltered and filtered client-side:**
matches the RLS policy's own scoping exactly (`.eq('parent_profile_id', ...)`), avoids
ever pulling another parent's rows into the client at all (defense in depth beyond
RLS, same posture `meetings.ts`'s own guardian_links queries already take), and
matches the one-query-per-real-need shape `queryFirstLinkedStudentId`
(`meetings.ts`) already established for this exact table.

## 7. Design — page side (`OutreachDetail.tsx`)

**7a. Role gate**, same shape `isStaffViewer` already uses (do not invent a new
pattern):
```ts
const isParentViewer = user !== null && user.role === 'parent';
```

**7b. New injectable prop**, mirroring `loadRoster` exactly (same separate-seam
posture, not baked into `loadData`):
```ts
loadGuardianLinksForParent?: LoadGuardianLinksForParentFn; // defaults to loadGuardianLinksForParent
```

**7c. New load state**, structurally identical to the existing `RosterLoadState` /
`rosterState` / `retryRosterLoad` machinery already in this file (reuse that pattern,
renamed — do not invent a different shape):
```ts
type GuardianLinksLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; guardianLinks: readonly GuardianLinkRow[] }
  | { status: 'error' };
```
Fetch **only when `isParentViewer`** — a non-parent viewer must never call
`loadGuardianLinksForParent` at all (same "no unneeded network calls for a role that
can't use the data" reasoning T155 already established, and directly test-provable —
see §8). On error, render an honest `Banner` with a real `Retry` action (same shape as
the existing roster-load-failure banner in this file) — never fall back to a fixture
or to `undefined`-read-as-fixture.

**7d. Which students get a control:** a new exported pure function, matching this
file's own established "the ONE place X is computed" convention
(`resolveEventRoster`, `groupSessionSignups`):
```ts
export function resolveParentLinkedRosterStudents(
  roster: readonly RosterStudent[],
  guardianLinks: readonly GuardianLinkRow[],
  parentProfileId: string,
): RosterStudent[] {
  const linkedStudentIds = new Set(
    guardianLinks
      .filter((link) => link.parentProfileId === parentProfileId)
      .map((link) => link.studentId),
  );
  return roster.filter((student) => linkedStudentIds.has(student.id));
}
```
Note this filters against `roster` (the already team-scoped roster from
`resolveEventRoster`), not `students` (the full unfiltered list) — a parent's linked
student who is outside this event's team scope must not get a control for this event,
matching every other section on this page's existing team-scope discipline (module
doc #3).

**7e. Placement:** render one `<ParentRsvp>` per (session × qualifying linked student),
inside the existing per-session loop (`orderedSessions.map(...)`), gated by
`isParentViewer && guardianLinksState.status === 'ready'`. Placing it per-session,
alongside `<SessionSignupList>`, matches this page's own established "OUT-04 is
per-session, not per-event" discipline (module doc #4) — an RSVP is a per-session
fact, and a parent with a multi-day event should see one control per day, not one
control for the whole event. Add a real accessible heading/label for the block (e.g.
"Your RSVP", sentence case per DES-14) so it's discoverable independent of
`ParentRsvp`'s own internal `controlLabel`. Exact JSX/heading level is your call;
don't break the existing per-session `Heading level={3}` (`formatSessionDateTime`).

Per-instance props:
```tsx
<ParentRsvp
  key={`${session.id}-${student.id}`}
  studentId={student.id}
  studentProfileId={student.profileId}
  session={session}
  eventTitle={event.title}
  currentRsvp={rsvps.find((r) => r.sessionId === session.id && r.studentId === student.id) ?? null}
  guardianLinks={
    guardianLinksState.status === 'ready'
      ? guardianLinksState.guardianLinks.filter((link) => link.studentId === student.id)
      : []
  }
  currentUserProfileId={user.id}
/>
```
Note `guardianLinks` is pre-filtered to the one student's own links, matching
`ParentRsvp.tsx`'s own prop doc ("the caller is expected to pass rows already scoped
to `studentId`").

**7f. Do not touch:** `isStaffViewer`'s existing branch, `SessionSignupList`,
`AttendancePanel`, `MarkEventCompleteDialog`, the Edit/Cancel dialog wiring, or
`FIXTURE_STUDENTS`/`FIXTURE_EVENTS`/`FIXTURE_RSVPS` beyond what §8's tests need (adding
`profileId` values to `FIXTURE_STUDENTS` and, if your test design needs it, adding new
`FIXTURE_RSVPS`/guardian-link test fixtures is expected and fine — matches this file's
own existing precedent of deliberately-constructed fixture rows, e.g. "Nina Ortiz +
Ravi Kapoor deliberately have NO rsvp row" — keep new fixture additions similarly
commented so a future reader knows they're deliberate).

## 8. Acceptance criteria — the reachability proofs, each with its mutation prescribed

**Every criterion below lives in `OutreachDetail.test.tsx`, never in
`ParentRsvp.test.tsx`.** A criterion satisfiable from `ParentRsvp`'s own test file
reproduces the exact blind spot this task exists to close.

For every mutation below: apply it, run the affected test(s), confirm the failure,
**paste the actual failure output (assertion diff / error message) into your output
doc**, then restore the file byte-identically and confirm the suite is green again
before moving on. "I predict this would fail" is not evidence; the executed failure
output is.

1. **Reachability (the central criterion).** With a `PARENT_USER` (new `AuthUser`
   fixture, `role: 'parent'`, mirroring the existing `COACH_USER`/`ADMIN_USER`/
   `STUDENT_USER` fixtures) who has a real linked student in the event's roster,
   assert `ParentRsvp`'s own accessible control is present — e.g. its `controlLabel`
   text (`"RSVP on behalf of your student for {eventTitle} on {date}"`,
   `ParentRsvp.tsx`'s own template) or its `[role="radiogroup"]`
   (`ParentRsvp.test.tsx`'s own `radiogroup()`/`segmentButton()` helpers are a
   precedent for locating it, not code to import — reimplement the query locally,
   same "Forbidden Files, independently reimplemented" posture every sibling
   component in this codebase already takes).
   **Mutation:** delete the parent-viewer JSX block (or its `isParentViewer` guard)
   entirely. Confirm the same test now fails. Restore. This is the proof that a
   `<ParentRsvp>` render actually exists and is load-bearing for this assertion — not
   satisfiable by `ParentRsvp.test.tsx`'s own tests, which is the whole point.

2. **Negative space — role gating**, mirroring the existing
   `<AttendancePanel> role gating` describe block's exact shape: assert an
   unauthenticated viewer, a `STUDENT_USER`, a `COACH_USER`, and an `ADMIN_USER` all
   render **no** `ParentRsvp` control anywhere on the page, **and** that
   `loadGuardianLinksForParent` (your mock/spy) is **never called** for any of them —
   same `expect(mocked...).not.toHaveBeenCalled()` shape
   `<AttendancePanel> role gating`'s own first test already uses for
   `mockedLoadAttendanceForSessions`.

3. **Real `currentUserProfileId` threading** (this is the "AttendancePanel data
   threading" idiom, applied to this component): render with `PARENT_USER`, locate the
   linked student's RSVP control, click a segment button (same
   `dispatchEvent(new MouseEvent('click', { bubbles: true }))` idiom this file's own
   `<AttendancePanel> data threading` test and `ParentRsvp.test.tsx` both already use),
   and assert your mocked `submitRsvpChange` was called with
   `expect.objectContaining({ respondedBy: PARENT_USER.id })`.
   **Mutation:** revert `currentUserProfileId={user.id}` on the `<ParentRsvp>` call
   site to an omitted prop. Confirm the assertion now fails (the call is recorded with
   `PLACEHOLDER_CURRENT_PARENT_PROFILE_ID`, not `PARENT_USER.id`, since that's
   `ParentRsvp.tsx`'s own default). Restore.

4. **Real `studentProfileId` threading (self-vs-misattribution proof).** Construct a
   fixture RSVP row for the linked student whose `respondedBy` equals that student's
   own real `profileId` (a self-answered RSVP). Assert the rendered control shows
   **no** attribution line at all — specifically, neither the generic
   `"Someone else recorded this response on your student's behalf"` string nor any
   `"{relationship} signed you up"` string appears for that student's instance
   (`ParentRsvp.tsx`'s own module doc #6: `kind: 'self'` renders no attribution line).
   **Mutation:** revert `studentProfileId={student.profileId}` to `null` (or omit
   6a's field entirely). Confirm the assertion now fails — with `studentProfileId`
   wrongly `null`, `resolveRsvpResponderAttribution` cannot match the self case, falls
   through to `guardianLinks`, finds no match either, and lands on `'unrecognized'`,
   so the "Someone else recorded..." string **wrongly appears**. This is the exact
   "optional prop, plausible default, silent misattribution" defect shape named in
   this task's own framing, reproduced and then closed. Restore.

5. **Real `guardianLinks` threading (relationship-label proof).** Construct a fixture
   RSVP row for the linked student whose `respondedBy` equals `PARENT_USER.id` (a
   parent-set RSVP), and a real fetched guardian-link row with a real, fabricated
   `relationship` value (e.g. `'Mom'`, matching PRD line 297's own literal example —
   constitution item 6, fabricated names only). Assert the rendered attribution line
   reads exactly `"Mom signed you up"` (or your chosen relationship string).
   **Mutation:** revert the `guardianLinks={...}` prop pass to `[]`. Confirm the
   assertion now fails (attribution falls to `'unrecognized'` or the wrong branch).
   Restore.

6. **Loader-side column guard**, in `outreach.test.ts`, matching T146's own
   established select-string-guard pattern (cite it by symbol, `queryAllTeams (via
   makeLoadOutreachDetail) -- T146 select-string guard` describe block, as your
   structural template — do not invent a different assertion shape): record
   `queryGuardianLinksForParent`'s `.select()` argument and assert it includes
   `relationship` (not just `id, parent_profile_id, student_id`), and assert
   `.eq('parent_profile_id', ...)` is called with the real supplied parent id. A
   revert to a narrower select (e.g. dropping `relationship`) must fail this test —
   confirm by mutation, same as above.

7. **Build/type safety:** `tsc` passes with the extended `RosterStudent`/`StudentDbRow`
   shapes flowing into `AttendancePanel`/`MarkEventCompleteDialog`'s own independently
   reimplemented types (§6a's note) — verify by actually running the compiler, not by
   reading the structural-typing rules and asserting it will be fine.

8. **Regression baseline — do not pin a number.** Before your change, run the full
   `OutreachDetail.test.tsx` and `outreach.test.ts` suites at your own dispatch SHA and
   record the pass count as your baseline. After your change, the same suites must
   pass at baseline-count-plus-your-new-tests, with zero baseline tests broken. Two
   stale pinned baselines have already produced false regression reports on this
   branch — compute your own, don't reuse a number from this packet or the ledger.

9. **No PII** (constitution item 6): any new fixture names/relationships are
   fabricated, matching every existing fixture in this file (`Amara Chen`, `Jordan
   Owens`, etc. — same register, no real names).

## 9. Worker tier and checker assignment

**Worker: `worker-implementer`, tier `sonnet`** (the pinned default — no override).
Reasoning against constitution item 18's four opus triggers, checked explicitly:
- Not a migration file.
- Not an RLS policy or `security definer` helper — this reads through an existing,
  already-correct RLS policy (`own_read` on `guardian_links`), it does not author or
  modify one.
- Not a SQL view / metric math.
- Does not change auth, session, role-resolution, or permission logic — `isParentViewer`
  reads `user.role` via the exact pattern `isStaffViewer` already established in this
  same file; `guards.tsx` itself is Forbidden and untouched. This is the same
  "wiring" shape T101/T117/T127 already shipped at sonnet tier, not the shape T154 was
  bumped to opus for (T154 changed `client.ts`'s own `createClient(...)` auth
  configuration itself — this task does not touch `client.ts` at all).

**Checker: `checker-reviewer`, tier `opus`.** This is a judgment call, not a
constitution-mandated trigger, so I'm stating the reasoning plainly: this packet
prescribes five distinct mutation-provable acceptance criteria (§8.1, 3, 4, 5, 6) each
requiring the checker to actually apply a mutation, run the suite, and read the
failure output — not just review the diff. Every case on this branch where a
mutation-proof criterion turned out broken (T147's four-round history, recorded in
`auto-mode-decisions.md`) was caught by execution, never by reading. Five criteria of
that shape in one task, touching a real Supabase query and PII-adjacent data
(guardian relationships for minors' families), is worth the opus tier even though no
constitution rule requires it here.

## 10. Deferral policy — exact text to report

If you discover, mid-task, a genuine out-of-scope defect or gap (not covered by
§2/§5's already-known exclusions), **do not fix it and do not only leave a code
comment** (constitution item 20). Report it in your output doc using exactly this
template, so the foreman can create the ledger row without re-deriving your finding:

```
FOLLOW-UP NEEDED (item 20):
- What: <one sentence>
- Why out of scope for T157: <one sentence>
- Suggested Allowed Files for the follow-up: <file list>
- Evidence: <symbol/citation>
```

One deferral I am making myself, disclosed here so you don't need to re-discover or
re-justify it: a `parent`-role viewer with **zero** linked students (no
`guardian_links` rows at all) sees no "Your RSVP" section anywhere on this page, with
no distinct empty-state message. This is a deliberate minimal choice (there is
nothing for them to RSVP for), not an oversight — do not add a dedicated empty-state
message for this case unless you find a concrete reason it's actually needed; if you
do, report it via the template above rather than silently adding new copy.

## 11. Required worker output

- Every commit states its SHA (constitution item 21); use explicit pathspecs only,
  never `git add -A`/`git add .` (item 22).
- Your output doc includes: files touched, the executed mutation output for each of
  §8's five mutation criteria, the `tsc` result, the before/after test counts for both
  suites (§8.8), and any `FOLLOW-UP NEEDED` items (§10).
- State plainly which of this packet's design prescriptions (§6/§7) you followed
  as-written vs. deviated from, and why, if any.
- Do not mark your own work complete (constitution Non-Negotiables) — a separate
  checker validates the actual artifact.

## 12. Constitution excerpts relevant to this task (full text at
`docs/swarm/constitution.md` — not reproduced here beyond what's load-bearing)

- Item 6: no PII in fixtures — fabricated names only.
- Item 10: existing tests must pass unless the boss explicitly approves a test
  update. Nothing in this task requires changing an existing test's assertion —
  you are only adding tests and adding fixture fields.
- Item 12: every async screen ships loading/empty/error/populated. The new
  `GuardianLinksLoadState` (§7c) must cover all four.
- Item 15: accessibility is a shipping requirement — the new "Your RSVP" section
  needs a real accessible heading/label, not just visual grouping.
- Item 20: a deliberate deferral must produce a follow-up task (§10), never just a
  comment.
- Item 21/22: commit SHA + explicit pathspecs (§11).

---

This packet has not yet been through `checker-premise` (constitution item 19). It
must return DISPATCH before this reaches a worker.
