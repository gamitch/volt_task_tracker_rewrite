# T157 worker packet — mount `ParentRsvp` in `OutreachDetail.tsx`

**Revision 2 — this is the version that ships. Read this note before anything
else.** Revision 1 gated REVISE at `checker-premise` round 1
(`0b932d0`; 4 MAJOR, 6 MINOR, 3 NIT — full verbatim list in
`docs/swarm/active/T157-gate-round1-findings.md`). **Constitution item 19a
caps the premise gate at two rounds. This is round 2 of 2 — if this revision
also gates REVISE, the cap is spent and the next dispatch goes straight to a
worker regardless.** I have written it accordingly: every one of the twelve
required revisions is resolved below, not restated as an open question.

**Epistemic status.** I have no Bash tool — I cannot execute anything.
Everything below is one of three things, and I have kept them distinguishable
rather than blending them into one voice:
- **Read-verified by me, this revision**, by opening the file directly. This
  is most of the packet, including all four of the explicit decisions the
  orchestrator asked me to make (the `now` seam, the §12/§10 read, the
  `GuardianLinkRow` reuse, and `parseSelectedColumns` reuse) — I did not defer
  any of those to "verify at dispatch," I confirmed the underlying facts
  myself before deciding. Specifically I opened and read: `ParentRsvp.tsx`
  (props, `isRsvpEditable`, `GuardianLinkRow`'s export, the `controlLabel`
  template), `RsvpControl.tsx` (`isRsvpEditable`'s lock semantics),
  `OutreachDetail.tsx` (`FIXTURE_SESSIONS` dates, `FIXTURE_STUDENTS`,
  `RosterLoadState`, `isStaffViewer`, the two comparable-pure-function
  describe blocks' shape), `OutreachDetail.test.tsx` (the `vi.mock` factory at
  :124-131, the `afterEach` clear block at :167-182, both cited fixture
  literal sites), `outreach.ts` (`StudentDbRow`, `queryAllStudents`,
  `mapStudentDbRowToRosterStudent`, the existing page-type import block),
  `outreach.test.ts` (`parseSelectedColumns`, unexported, same file as the
  new criterion), `checkin.ts` (`queryGuardianLinksForParent` at :393, its
  full query shape), `meetings.ts` (`queryFirstLinkedStudentId` at :504 — the
  gate's "own_read is a disjunction" and "meetings.ts's queries (plural)"
  claims — I confirm there is exactly **one** `guardian_links` query in
  `meetings.ts`, `.limit(1)`-shaped), `rls.sql` (`own_read` on
  `guardian_links`, `own_or_linked_read`/`_write`/`_update` on
  `students`/`rsvps`), and the Astryx `SegmentedControl.js` source directly
  (lines 199-200: `role: "radiogroup"`, `"aria-label": label` — confirmed
  character-for-character against the gate's citation).
- **Carried forward as the round-1 gate's own executed measurement**, relayed
  by the coordinator and not re-derived: the two `perl -pi` mutation results
  for §6a/§6b (10-site blast radius, additive-select no-op), and the baselines
  (66/66, `tsc` exit 0) at `0b932d0`.
- **Not executable by me at all**, stated plainly at each spot: whether the
  worker's eventual six mutations actually produce the predicted failure text
  (only an executed run proves that), and whether the full suite stays green
  after the new criteria land.

Where my own read disagreed with anything relayed, I used my own read and say
so at that spot rather than quietly reconciling it (see §6d, §7c, §9).

---

## 1. Objective

`ParentRsvp.tsx` is a finished, tested, unreachable component. Mount it in
`OutreachDetail.tsx` so a signed-in parent viewing an outreach event's detail
page sees a real, working RSVP-on-behalf control for each of their linked
students, with real data threaded through — not fixture defaults.

## 2. Authority — read this before touching scope

**George ruled, verbatim** (`docs/swarm/auto-mode-decisions.md`, section "2026-07-30 —
George's rulings on T157/T158"): *"embed the leaderboard in the dashboard, ParentRsvp
in OutreachDetail."* This settles **one thing only**: `ParentRsvp` is hosted by
`OutreachDetail.tsx`. Cite that document for the host-screen decision. Do not cite him
for anything else in this packet.

**Everything else below — the loader design, which props get which real values, where
in the page the control sits, the test shape, the tiering, and all four decisions the
foreman was asked to make explicitly in this revision (the tier, the clock seam, the
§12/§10 read, the type-reuse call, the reuse-vs-copy call) — is the orchestrator's call,
not George's.** Round 1's gate graded this scoping exemplary and it stays that way here:
three packets on this branch have already mis-attributed an orchestrator decision to
George; this is not a fourth. If you disagree with a foreman-level design choice here,
say so in your output doc — do not silently follow it if you find it wrong, and do not
silently deviate either. Flag it.

**`RsvpControl` (the student-facing self-service control) is explicitly NOT in this
task.** It is `T169`, blocked on a separate ruling about which screen hosts it (and, for
its student-facing half, hard-blocked on `T170`). Do not mount it, do not import it, do
not reference it as in-scope, and do not let anything you write invite a future reader
to "while I'm here" it in. It is not in your Allowed Files (see §5).

## 3. Correction to the ledger's own framing — read before designing the loader side

The ledger row and this task's source audit both said **"the mutation path is real...
no loader work is needed — this is placement plus data threading."** That claim is
**correct for the RSVP submission itself** (`submitRsvpChange`,
`outreach.ts :: makeSubmitRsvpChange`, needs zero changes) but **wrong about the read
side**:

- `ParentRsvp.tsx :: ParentRsvpProps` requires `studentProfileId: string | null` and
  `guardianLinks: readonly GuardianLinkRow[]`. Neither exists anywhere in
  `OutreachDetail.tsx`'s current data shape:
  - `OutreachDetail.tsx :: RosterStudent` carries only `id`/`name`/`teamId` — no
    `profileId`.
  - `OutreachDetail.tsx :: OutreachDetailData` carries no `guardianLinks` field at
    all, and nothing in `outreach.ts` queries the `guardian_links` table for this
    page's purposes today.
- Re-confirmed (read, not executed): `outreach.ts`'s only students query,
  `queryAllStudents`, selects `'id, display_name, team_id, goal_hours_override'` —
  no `profile_id` — and no query anywhere in `outreach.ts` touches `guardian_links`.
- This is real, bounded loader work, not "just wiring." §6 below designs it. It is
  in scope for this task (not a deferral) because without it, the only way to satisfy
  §8's acceptance criteria would be to pass fixture/empty values into `ParentRsvp`,
  which is exactly the defect class (optional prop, plausible default, caller passes
  nothing) that produced three of the owner's four production bugs this session.

## 4. Ground truth, re-verified against the live tree

- `ParentRsvp.tsx` is imported by exactly one file, its own test
  (`ParentRsvp.test.tsx`, symbol: the `import { ParentRsvp, ... } from './ParentRsvp'`
  line). Zero production importers.
- `ParentRsvp.tsx :: ParentRsvp` (its own module doc #4, symbol-cited) states:
  *"A future page (`ParentHome.tsx`, `OutreachDetail.tsx`) is expected to render one
  `<ParentRsvp>` per linked student, passing each student's own
  `studentId`/`studentProfileId`/`guardianLinks` slice — not built here."* You are
  that future task, for `OutreachDetail.tsx` only.
- `ParentRsvpProps` (full shape, `ParentRsvp.tsx`, correct citations
  `:467`/`:481` — not `:334-335`, which is `resolveRsvpResponderAttribution`'s
  parameter list; the gate confirmed this symbol-based citation was right and the
  ledger's line-based one was wrong): `studentId: string`,
  `studentProfileId: string | null`, `session: RsvpControlSession`,
  `eventTitle: string`, `currentRsvp: RsvpRow | null`,
  `guardianLinks: readonly GuardianLinkRow[]`, `currentUserProfileId?: string`
  (defaults to a disclosed placeholder), `onRsvpChange?: OnRsvpChangeFn` (defaults to
  the real `submitRsvpChange`), **`now?: () => Date`** (defaults to the real clock —
  load-bearing for §7's clock-seam decision below; do not read past this).
- `submitRsvpChange` (`outreach.ts :: makeSubmitRsvpChange` / its default export
  `submitRsvpChange`) is real, Supabase-backed, and already the default `onRsvpChange`
  baked into `ParentRsvp.tsx` at its own import time — same posture
  `MarkEventCompleteDialog`'s `onMarkSessionComplete` already has relative to
  `OutreachDetail.tsx` (module doc #12: "not given its own injectable override prop
  here... the dialog's own default already uses the real mutation internally"). Do
  **not** add an `onRsvpChange` override prop to `OutreachDetail`'s own props — that
  would deviate from this established, already-precedented pattern for no benefit.
  This reasoning is scoped to the mutation seam specifically; it does **not** extend
  to the clock seam — see §7's explicit decision, which is a different kind of prop
  for a different reason.
- `guardian_links` table (`supabase/migrations/20260716000000_identity_roster.sql`,
  symbol: `create table public.guardian_links`): `id`, `parent_profile_id` (FK
  `profiles`, not null), `student_id` (FK `students`, not null), `relationship` (text,
  **not null**), `created_at`.
- **RLS, corrected (revision required #8) — read-verified directly against
  `rls.sql:114-116`:** `own_read` on `guardian_links` is
  `parent_profile_id = auth.uid() or student_id in (select my_student_ids())` — a
  **disjunction**, and strictly **broader** than a query filtered
  `.eq('parent_profile_id', <the signed-in parent's own id>)`: its second disjunct
  admits co-guardian rows carrying a *different* `parent_profile_id` (a second parent
  linked to the same student). The filtered query is strictly **narrower** than RLS,
  which is the correct posture for this feature — but "matches the RLS policy's own
  scoping exactly" (revision 1's wording) is wrong and is corrected in §6d. A parent
  should see and act on their own guardian-link rows, not every co-guardian's, so
  narrower-than-RLS is deliberate, not accidental.
- `students` table (same migration, symbol: `create table public.students`):
  `profile_id uuid references public.profiles (id)`, **nullable** (a student may have
  no account yet).
- **The BLOCKER the orchestrator originally hypothesized does NOT hold, and this
  packet does not imply otherwise.** `students`' `own_or_linked_read`
  (`rls.sql:101-103`) is `id in (select my_student_ids())`, so `queryAllStudents` is
  already server-scoped to the parent's own linked students. `rsvps`'
  `own_or_linked_write`/`own_or_linked_update` (`:205-212`) require
  `student_id in (select my_student_ids()) and responded_by = auth.uid()`. A wrong
  *client-side* filter in §7d therefore cannot surface or write another family's data
  — the server is the primary control. §7d is **defence-in-depth**, not the last
  line of defense, and the missing-criterion gap (§8 criterion 2 below) is MAJOR
  because an untested authorization predicate is a real defect class regardless of
  whether a second layer happens to catch its failure mode — not because cross-family
  data exposure is actually reachable here. Do not let a future reader conclude the
  opposite from this packet.
- **Three read queries against `guardian_links` exist in the repo, not one**, and
  none selects `relationship`: `parents.ts:190`
  (`select('id, parent_profile_id, student_id')`), `checkin.ts:393`
  (`select('student_id')`, ordered `created_at` ascending, no limit — **this is your
  structural template, see §6d**), and `meetings.ts:504`
  (`queryFirstLinkedStudentId`, `select('student_id')` + `.limit(1)` — **not** a
  structural template for this task; its `.limit(1)` shape answers a different
  question, "the parent's *first* linked child," not "all of this parent's links").
  Plus a delete at `parents.ts:252`. None can be reused as-is because none selects
  `relationship`, which `ParentRsvp`'s attribution line needs.
- **A shared `GuardianLinkRow` type already exists in two places, and this revision
  adopts one of them rather than adding a third — see §6c's rewritten decision.**

## 5. Allowed / Forbidden files

**Allowed (write access):**
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`
- `src/lib/supabase/loaders/outreach.ts`
- `src/lib/supabase/loaders/outreach.test.ts`

**Forbidden (no write access — read for reference only):**
- `src/pages/outreach/ParentRsvp.tsx`, `ParentRsvp.test.tsx` — finished, tested,
  read-only. Do not modify. **You will type-import from `ParentRsvp.tsx`** (see §6c)
  — a type-only `import type` from a Forbidden file is not a write; `outreach.ts`
  already imports page types across this exact boundary (`:334-358`, three existing
  sites). Its own test file is the authority for its internal
  status-mapping/attribution/lock-boundary behavior — do not duplicate that coverage
  here.
- `src/pages/outreach/RsvpControl.tsx`, `RsvpControl.test.tsx` — not in scope (§2).
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx`,
  `src/pages/home/DashboardPage.test.tsx` — **T155 has a worker actively dispatched
  against these three files right now** (its packet's Allowed Files are exactly
  these plus its own output doc). No overlap with this task's files, but noted so you
  understand why these are Forbidden rather than assuming it's arbitrary.
- `src/lib/supabase/client.ts`, `client.test.ts`, `src/app/ThemeModeProvider.tsx`,
  `ThemeModeProvider.test.tsx` — T154 has landed (merged `9586c35`); listed here for
  continuity with revision 1, no longer an active-conflict concern, but still not
  this task's files.
- `src/app/guards.tsx` — read-only reference for `useAuth()`/`AuthUser`/`Role`. You
  are reading existing role-derivation, not changing it (§7's role check is the exact
  shape `OutreachDetail.tsx :: isStaffViewer` already uses; do not touch `guards.tsx`).
- `docs/swarm/**`, `.claude/**` — standard, every task.
- Any file not listed above as Allowed.

**Files-in-flight note, required by revision 11.** `T165` is filed to extend the
*same* `src/lib/supabase/loaders/outreach.test.ts` file you are editing, and its own
ledger row instructs its future worker to "keep T146's column-guard test byte-intact."
Your new loader test (§8 criterion 7) adds to that same file without touching T146's
existing describe block — if T165 dispatches while or after this task lands, its
worker inherits your new `queryGuardianLinksWithRelationshipForParent` describe block
as a second thing to leave byte-intact, the same way it must leave T146's. This is not
a blocking dependency in either direction (T165 is `not yet packeted`), but name it in
your output doc if you land first, so the coordinator can pass this note forward.

If you find a genuine defect or gap outside these files, **do not fix it and do not
only note it in a comment.** Report it in your output doc using the exact template in
§10 — the foreman creates the ledger row; you cannot (`task-ledger.md` is Forbidden to
you).

## 6. Design — loader side (`outreach.ts`)

All of the following is a design **prescription**, not yet code — adapt as needed if
you find a concrete conflict, but report any deviation and why.

**6a. Extend `RosterStudent` (in `OutreachDetail.tsx`) with one field, required, not
optional:**
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
**Required, not optional-with-a-default, is the deliberate choice** — optional would
reintroduce the exact "plausible default, silent misattribution" defect this task
exists to close (§3). This makes the field mandatory at every existing construction
site of `RosterStudent`. **Measured blast radius, confirmed by my own direct read
(not relayed): exactly ten sites**, matching the round-1 gate's count exactly:
- `OutreachDetail.tsx:513-517` — the five `FIXTURE_STUDENTS` entries (Amara Chen,
  Marcus Bello, Nina Ortiz, Sofia Delgado, Ravi Kapoor).
- `OutreachDetail.test.tsx:294-296` — the three-entry roster inside the
  `groupSessionSignups` describe block.
- `OutreachDetail.test.tsx:340-341` — the two-entry roster inside the
  `resolveEventRoster` describe block.

**Editing all ten of these existing fixture/test literals to add a `profileId` value
is authorized by this packet** — it is required by the type change, not incidental
scope creep, and it is the entire reason §6a chooses "required" over "optional." Use
a distinctive non-null string per student (e.g. `'profile-amara-chen'`) for the five
production fixtures so criteria that need a real self-vs-guardian distinction have
something concrete to assert against; the two test-local rosters
(`groupSessionSignups`/`resolveEventRoster`) may use `null` or a placeholder string —
those two describe blocks don't touch `ParentRsvp` attribution logic at all, so the
exact value is immaterial there, only its presence (satisfying the type) matters.
Note this precedent by symbol in your own comment, matching this file's own already-
established "page-local type grows one new field for a real need" move
(`OutreachDetailEvent`'s own module doc cites `loaders/students.ts :: TeamRow.archived`
for the identical shape of change) — cite that, don't invent new justification prose.

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
loader, via `mapStudentDbRowToOutreachStudentFixture`) — **the round-1 gate measured
this directly with a single-line `perl -pi` mutation and confirmed it end-to-end: an
unused extra column is a no-op for that path.** No test anywhere asserts an
exact/exhaustive `.select()` string for `queryAllStudents`, so this is additive-only —
measured, not merely predicted.

Update `mapStudentDbRowToRosterStudent` to map the new field:
`profileId: row.profile_id`.

**6c. `GuardianLinkRow` — reuse, do not declare a third copy. This is one of the
four explicit decisions this revision makes.**

Revision 1 prescribed a *new*, page-local `GuardianLinkRow` interface in
`OutreachDetail.tsx`, field-matched to `ParentRsvp.tsx`'s own type. The round-1 gate
found this unnecessary: `ParentRsvp.tsx:258-263` already **exports** `GuardianLinkRow`
with exactly the four fields needed (`id`, `parentProfileId`, `studentId`,
`relationship` — I re-read this directly, confirmed), and `OutreachDetail.tsx` must
import the `ParentRsvp` *component* from that file anyway. **Decision: reuse it.**

```ts
// OutreachDetail.tsx — add the type to the existing value import:
import { ParentRsvp, type GuardianLinkRow } from './ParentRsvp';
```
```ts
// outreach.ts — add alongside the existing page-type import block (:334-358),
// which already imports page types across this exact loader→page boundary:
import type { GuardianLinkRow } from '../../../pages/outreach/ParentRsvp';
```
No new interface is declared anywhere. `outreach.ts`'s loader maps DB rows directly
into `ParentRsvp.tsx`'s own shape.

**Why this doesn't fall under the `parents.ts` Trap #3 precedent revision 1 leaned
on, and I want to be explicit that I am declining that precedent rather than silently
ignoring it:** Trap #3 concerns the **page↔loader boundary** — a loader should not
import a *page's* row shape, because a page's shape is sized to that one page's needs
and a loader serving multiple pages would take on an inappropriate dependency. That
reasoning has no third consumer to protect against here. This case is different in
the way that matters: `GuardianLinkRow`'s origin is `ParentRsvp.tsx`, a **component**,
not a page, and `OutreachDetail.tsx` (the page) is already a required, direct
consumer of that same component's props — reusing its exported type is reusing the
contract of a thing you're already calling, not reaching across an unrelated
page/loader seam. Declaring a third structurally-identical interface
(`types.ts:179`'s existing shared `GuardianLinkRow`, `ParentRsvp.tsx:258`'s, and a
new one) would mean three places to keep in sync by hand with no compiler check
between them — exactly the failure mode T143/T146 already demonstrated for a select
string. Reuse removes that class of drift structurally.
(Note: `src/lib/supabase/types.ts :: GuardianLinkRow` is a *different*, third
declaration with the same name and same fields, used by `parents.ts`. Still do not
use that one — it is a different type unrelated to this task's specific boundary,
kept separate deliberately by that file's own Trap #3. This task's reuse target is
`ParentRsvp.tsx`'s export specifically, not `types.ts`'s.)

**6d. New loader in `outreach.ts`.** Same `createLoader`/`getClient` DI convention
every other factory in this file already uses (cite `makeLoadOutreachDetail` as your
structural template for that machinery). **Structural template for the query itself,
corrected from revision 1: `checkin.ts:393`'s `queryGuardianLinksForParent`, not
`meetings.ts`.** `checkin.ts`'s version already answers the shape of question this
task needs — all of a parent's `guardian_links` rows, ordered `created_at` ascending,
no limit — where `meetings.ts:504`'s `queryFirstLinkedStudentId` deliberately answers
a narrower one (`.limit(1)`, the parent's *first* linked child only) and is the wrong
model to copy.

**Name, corrected from revision 1:** `checkin.ts:393` already **owns** the name
`queryGuardianLinksForParent` as a module-private function in its own file. There is
no compile-time collision (different files, not exported), but reusing an identical
name for two functions with different `.select()` shapes in the same loaders
directory is exactly the kind of greppability trap this project has already paid for
once (T146's `select`-string class). This task's function additionally selects
`relationship`, which is the actual functional difference — name it accordingly:

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

async function queryGuardianLinksWithRelationshipForParent(
  client: SupabaseClient,
  parentProfileId: string,
): Promise<LoaderQueryResult<GuardianLinkDbRow[]>> {
  const result = await client
    .from('guardian_links')
    .select('id, parent_profile_id, student_id, relationship')
    .eq('parent_profile_id', parentProfileId)
    .order('created_at', { ascending: true });
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
    queryGuardianLinksWithRelationshipForParent,
    getClient,
  );
  return async (parentProfileId: string): Promise<readonly GuardianLinkRow[]> =>
    ((await loadLinks(parentProfileId)) ?? []).map(mapGuardianLinkDbRowToGuardianLinkRow);
}

export const loadGuardianLinksForParent: LoadGuardianLinksForParentFn =
  makeLoadGuardianLinksForParent();
```
The exported names (`LoadGuardianLinksForParentFn`, `makeLoadGuardianLinksForParent`,
`loadGuardianLinksForParent`) are unchanged from revision 1 and do not collide with
anything — only the internal, module-private query function is renamed. The `.order`
clause is new relative to revision 1's draft (added to match `checkin.ts`'s own
structural template exactly, since that's now the cited precedent); it is a harmless,
deterministic ordering choice, not behaviorally required by anything in this task.

**Why filtered server-side rather than fetched unfiltered and filtered client-side,
corrected (revision required #8):** it is strictly **narrower** than the `own_read`
RLS policy, not a match to it — `own_read` is a disjunction
(`parent_profile_id = auth.uid() or student_id in (select my_student_ids())`) that
also admits co-guardian rows under a *different* `parent_profile_id`, so RLS alone
would let this query return more than this feature needs. Filtering
`.eq('parent_profile_id', <this parent's own id>)` is deliberately narrower — a
parent should only see and act on their own guardian-link rows here — and this is
defence-in-depth on top of RLS, not a demonstration that RLS alone would suffice (see
§4's BLOCKER correction). This also avoids ever pulling another parent's rows into the
client at all, and matches the one-query-per-real-need shape
`queryGuardianLinksForParent` (`checkin.ts`) already established for this exact table
— `meetings.ts` has exactly **one** `guardian_links` query
(`queryFirstLinkedStudentId`), singular, corrected from revision 1's "queries."

Import `GuardianLinkRow` into `outreach.ts` from `ParentRsvp.tsx` directly (§6c) —
not from `OutreachDetail.tsx`.

## 7. Design — page side (`OutreachDetail.tsx`)

**7a. Role gate**, same shape `isStaffViewer` already uses (do not invent a new
pattern), re-verified directly at `OutreachDetail.tsx:1346`:
```ts
const isParentViewer = user !== null && user.role === 'parent';
```

**7b. New injectable prop**, mirroring `loadRoster` exactly (same separate-seam
posture, not baked into `loadData`):
```ts
loadGuardianLinksForParent?: LoadGuardianLinksForParentFn; // defaults to loadGuardianLinksForParent
```

**7c. New load state, and the §12/§10 contradiction resolved — the second of this
revision's four explicit decisions.**

Revision 1's §12 cited constitution item 12 to make loading/empty/error/populated all
mandatory, while its own §10 waived the empty state — a direct contradiction the gate
correctly flagged. **Ruling: item 12 governs; it is not waivable by a task packet's
own text (precedence rule 1: PRD > constitution > ledger > packet judgment).** But
this does not require a fourth, distinct state variant. I re-read this file's own
already-passed precedent directly (`RosterLoadState`, `OutreachDetail.tsx:1143-1146`,
shipped and checker-verified under **T147 Part A2**, whose own module comment
explicitly frames it as "a real, honest DES-12 load-state"): that state machine is
`loading | ready | error` — exactly three variants — and a **zero-result `ready`**
(`{status:'ready', students:[]}`) is how this file already represents "empty" for an
async fetch, with no dedicated fourth variant and no distinct empty-state banner. That
precedent already satisfies item 12 in this codebase (it is the file's own shipped,
checked example of DES-12 compliance for a comparable fetch), so the same mapping is
correct here, not a second waiver:

```ts
type GuardianLinksLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; guardianLinks: readonly GuardianLinkRow[] }
  | { status: 'error' };
```
- **loading** → a real state, `#8` criterion below.
- **error** → an honest `Banner` with a real `Retry` action (matches the existing
  roster-load-failure banner shape in this file) — never a silent fallback to a
  fixture or to `undefined`-read-as-fixture. `#9` criterion below.
- **ready, `guardianLinks` resolves such that `resolveParentLinkedRosterStudents`
  (§7d) returns zero students** → this IS the empty state, not a gap in one. §10's
  "no distinct empty-state message" stands, but is now a *tested*, deliberate choice
  (`#10` criterion below), not an unwaived contradiction.
- **ready, non-empty** → the populated state, `#1`/reachability criterion below.

Fetch **only when `isParentViewer`** — a non-parent viewer must never call
`loadGuardianLinksForParent` at all (directly test-provable — see §8 criterion 3).

**7d. Which students get a control — and the cross-family/team-scope MAJOR closed.**
Same exported pure function as revision 1, unchanged in its own body:
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
This filters against `roster` (the already team-scoped roster from
`resolveEventRoster`), not `students` (the full unfiltered list) — a parent's linked
student who is outside this event's team scope must not get a control for this event.
**What changed from revision 1 is not this function's body — it is that §8 now
contains criteria that actually exercise it**, matching this file's own established
convention of a dedicated `describe` block per comparable pure function
(`groupSessionSignups`, `OutreachDetail.test.tsx:292`; `resolveEventRoster`, `:338` —
re-read both directly to confirm the shape: construct fixture inputs inline, call the
function, assert the output array's ids). See §8 criterion 2.

**7e. Placement, plus the clock seam — the third of this revision's four explicit
decisions, and it closes revision 3's self-expiring criterion.**

**The problem, read-verified directly:** `ParentRsvp.tsx`'s own `now?: () => Date`
prop (§4) defaults to the real system clock when omitted. `isRsvpEditable`
(`RsvpControl.tsx:327-329`, the same function `ParentRsvp.tsx` reuses) locks once
`now >= session.startsAt`. `OutreachDetail.tsx`'s own `FIXTURE_SESSIONS`
(read-verified directly at `:559-582`) has `session-food-bank-day1` starting
`2026-08-02T14:00:00.000Z`, `session-food-bank-day2` starting `2026-08-09T14:00:00.000Z`,
and `session-park-cleanup` starting `2026-07-26T15:00:00.000Z` — **already locked as
of today, 2026-07-30**. Today is 2026-07-30; `day1` locks in **three days**. Any
criterion that clicks a segment button on an unlocked control and asserts the
resulting mutation call will go permanently red on 2026-08-02 with zero code change,
purely from wall-clock advancing — and it would do so silently, reported as a
regression rather than what it actually is: a test that was never deterministic.

**Decision: authorize a `now` seam on the `<ParentRsvp>` call site, not moving
`FIXTURE_SESSIONS`' dates.** Reasoning: `ParentRsvp.tsx` already supports this exact
seam natively (`now?: () => Date`, §4) — there is no new capability to build, only a
value to thread, the same shape as every other prop in §7e's call site. Moving fixture
dates forward instead would (a) not actually fix the underlying problem, only push the
expiry date further out — it is still wall-clock-coupled, just with a longer runway,
and (b) risks disturbing other, unrelated pre-existing assertions on this page that
may depend on `session-park-cleanup`'s *already-locked* status or on the sessions'
relative ordering/labels elsewhere in this file, which I did not exhaustively trace
and am not willing to risk for a fix that doesn't actually solve the problem. The
`now`-seam path touches zero existing fixture semantics and removes wall-clock
dependency **entirely**, not just for the three days until the next expiry.

Add one new optional prop to `OutreachDetail`'s own component props, matching the
already-established `nowFn` naming/default convention used elsewhere in this
codebase for the identical purpose (`CoachHome.tsx`'s own `nowFn = () => new Date()`)
— disclosed as a new pattern *for this file specifically*, since `OutreachDetail.tsx`
has no existing clock seam of its own to point to as an in-file precedent:
```ts
nowFn?: () => Date; // defaults to () => new Date()
```
Pass it straight through on every `<ParentRsvp>` instance: `now={nowFn}`.

**All new tests in §8 that render an editable `<ParentRsvp>` control must inject
`nowFn` pinned to a fixed instant** — e.g. `() => new Date('2026-07-30T12:00:00.000Z')`
— safely between `park-cleanup`'s already-past start and both food-bank sessions'
future starts, so `day1`/`day2` are deterministically editable and `park-cleanup`
deterministically locked, **forever, independent of wall-clock time at whatever
future date this suite actually runs.** Existing, pre-existing tests in this file
never pass `nowFn` and are unaffected (default remains the real clock, unchanged
behavior).

**What this means for criterion 8 (revision 3's second half, the baseline
question):** with every new §8 test pinning its own `nowFn`, none of this task's new
assertions are wall-clock-coupled at all, so criterion 8's regression baseline is not
at risk of becoming a false regression at any future dispatch or check date — the
self-expiry problem is closed structurally, not deferred. If a future task adds a
*new* `<ParentRsvp>` render site on this page without also pinning `nowFn`, that
would reintroduce the coupling — worth a one-line note in your own output doc if you
notice it, but not this task's problem to solve pre-emptively beyond disclosing it.

**Placement and per-instance test-scoping.** Render one `<ParentRsvp>` per
(session × qualifying linked student), inside the existing per-session loop
(`orderedSessions.map(...)`), gated by
`isParentViewer && guardianLinksState.status === 'ready'`. Placing it per-session,
alongside `<SessionSignupList>`, matches this page's own established "OUT-04 is
per-session, not per-event" discipline (module doc #4).

**Locator fix, closing revision 5.** Do not use `ParentRsvp`'s `controlLabel` text as
a locator. Read-verified directly against the installed vendor source
(`node_modules/@astryxdesign/core/dist/SegmentedControl/SegmentedControl.js:199-200`):
`SegmentedControl` emits `role: "radiogroup"` and `"aria-label": label` — the label
is an ARIA attribute, **never** `textContent`, so any assertion reading rendered text
for it would silently never match. Additionally, `controlLabel`
(`ParentRsvp.tsx:568`, `` `RSVP on behalf of your student for ${eventTitle} on
${formatSessionDateOnly(session)}` ``) does **not** include the student's name or id
— two students in the same session render `[role="radiogroup"]` elements with the
**identical** `aria-label`, so an `aria-label`-based locator cannot disambiguate them
either, and `ParentRsvp.test.tsx`'s own `radiogroup()` helper
(`container.querySelector('[role="radiogroup"]')`, first match only) does not
generalize to this page's one-per-(session×student) placement.

**Fix: give each instance a real, page-owned accessible heading that already carries
the disambiguating information §7's own item-15 requirement needs anyway, and use it
as the test-scoping anchor too — one piece of markup satisfying both jobs.** Wrap
each `<ParentRsvp>` in a small container with its own `Heading level={4}` reading
`` `Your RSVP for ${student.name}` `` (fabricated fixture names only, same register
as the rest of this file's roster — not a new PII surface, this page already displays
these same names elsewhere):
```tsx
<VStack key={`${session.id}-${student.id}`} gap={2}>
  <Heading level={4}>{`Your RSVP for ${student.name}`}</Heading>
  <ParentRsvp
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
    now={nowFn}
  />
</VStack>
```
A test locates the instance by finding the heading with the expected text (raw DOM —
this file has no `@testing-library/react`, confirmed directly; use
`Array.from(container.querySelectorAll('h4')).find((h) => h.textContent === 'Your RSVP for Amara Chen')`
or equivalent), then scopes into its sibling via
`heading.parentElement?.querySelector('[role="radiogroup"]')` — the heading and the
`<ParentRsvp>` share the same `VStack` parent by construction. This does not require
any change to `ParentRsvp.tsx` (Forbidden, untouched) and does not require inventing a
`data-testid` convention this file has never used (confirmed: zero existing
`data-testid` occurrences in `OutreachDetail.tsx`).

Note `guardianLinks` is pre-filtered to the one student's own links, matching
`ParentRsvp.tsx`'s own prop doc ("the caller is expected to pass rows already scoped
to `studentId`").

**7f. Do not touch:** `isStaffViewer`'s existing branch, `SessionSignupList`,
`AttendancePanel`, `MarkEventCompleteDialog`, the Edit/Cancel dialog wiring, or
`FIXTURE_EVENTS`/`FIXTURE_RSVPS` beyond what §8's tests need. **`FIXTURE_STUDENTS`
and the two test-file rosters named in §6a ARE authorized to change** (each existing
entry gains a `profileId` value) — this supersedes revision 1's narrower "adding
`profileId` values to `FIXTURE_STUDENTS`" phrasing, which named only one of the ten
sites. Adding new `FIXTURE_RSVPS`/guardian-link test fixtures as your test design
needs is expected and fine — matches this file's own existing precedent of
deliberately-constructed fixture rows (e.g. "Nina Ortiz + Ravi Kapoor deliberately
have NO rsvp row") — keep new fixture additions similarly commented so a future
reader knows they're deliberate.

## 8. Acceptance criteria — the reachability proofs, each with its mutation prescribed

**How this gate runs, stated explicitly per the round-2 remediation decision.**
Round 1's `checker-premise` could not execute any of the six prescribed mutations —
it has no Write or Edit tool, and the sandbox refused every file-creation workaround
it tried. It could only apply single-line `perl -pi` edits (used for §6a/§6b above)
and reason from measured source for the rest. **For round 2, this gate is not being
given write access; instead, the worker's own executed failure output is the
evidence of record for every mutation criterion below, and it is load-bearing, not
incidental — do not treat "paste the output" as a formality.** `checker-premise`
round 2 verifies this packet's *feasibility and internal consistency* by reading, by
single-line `perl -pi` probes where that suffices, and by running the existing suite
— it is not expected to and should not attempt to apply any of the six multi-line
mutations below itself. After dispatch, **you (the worker) execute all six mutations
yourself** and paste the actual output. After that, **`checker-reviewer` (opus, §9)
independently re-executes each mutation against your landed commit** as its own
verification — it does not take your pasted output at face value merely because it
is present. This is the same posture item 23 already establishes for mutation
experiments generally (run them in your own worktree) — nothing new is being asked of
you beyond what §11 already required; this is here so you understand why it matters
that you actually run these rather than predict them.

**Every criterion below lives in `OutreachDetail.test.tsx`, never in
`ParentRsvp.test.tsx`.** A criterion satisfiable from `ParentRsvp`'s own test file
reproduces the exact blind spot this task exists to close.

For every mutation-marked criterion: apply the mutation, run the affected test(s),
confirm the failure, **paste the actual failure output (assertion diff / error
message) into your output doc**, then restore the file byte-identically and confirm
the suite is green again before moving on. "I predict this would fail" is not
evidence; the executed failure output is.

1. **Reachability (the central criterion).** With a `PARENT_USER` (new `AuthUser`
   fixture, `role: 'parent'`, mirroring the existing `COACH_USER`/`ADMIN_USER`/
   `STUDENT_USER` fixtures) who has a real linked student in the event's roster,
   with `nowFn` pinned per §7e, assert `ParentRsvp`'s own accessible control is
   present using the heading-then-sibling-radiogroup locator from §7e — not
   `controlLabel` text, not an unscoped `container.querySelector('[role="radiogroup"]')`.
   **Mutation:** delete the parent-viewer JSX block (or its `isParentViewer` guard)
   entirely. Confirm the same test now fails. Restore.

2. **Cross-family and team-scope authorization — the MAJOR this revision closes,
   with a direct unit describe block plus two integration proofs.**

   **2a. Direct unit `describe` block for `resolveParentLinkedRosterStudents`**,
   matching this file's own convention for its two comparable pure functions
   (`groupSessionSignups`/`resolveEventRoster`, constructed fixture inputs, no
   rendering):
   - a roster of 3+ students, `guardianLinks` linking `parentProfileId` to only one
     of them → the function returns exactly that one student.
   - a `guardianLinks` row with the target student's id but a **different**
     `parentProfileId` → excluded (this is the direct proof of the client-side
     defence-in-depth predicate itself, independent of whether the server-side RLS
     policy would also have caught it — see §4's BLOCKER correction for why this is
     still MAJOR to leave untested even though it is not the primary control).
   - zero `guardianLinks` → empty result.
   **Mutation:** remove the `linkedStudentIds.has(student.id)` filter (return
   `roster` unchanged). Confirm the first and second cases now fail (wrongly include
   the unlinked/other-family student). Restore.

   **2b. Integration proof — cross-family, rendered.** A session's roster has at
   least two students; `PARENT_USER` is linked (via a real fetched `GuardianLinkRow`)
   to only one of them. Assert a `<ParentRsvp>` control (§7e's locator) exists for
   the linked student and does **not** exist for the other. **Mutation:** same as
   2a's, applied at the call site (or drop `resolveParentLinkedRosterStudents`'s
   result and pass `roster` straight through). Confirm both students now get a
   control. Restore.

   **2c. Integration proof — team-scope composition order.** `PARENT_USER`'s linked
   student belongs to a team **not** included in this event's `teamIds` (i.e. that
   student is filtered out of `resolveEventRoster`'s output already, before
   `resolveParentLinkedRosterStudents` ever runs). Assert no control renders for
   that student anywhere on the page. **Mutation:** call
   `resolveParentLinkedRosterStudents` against the full unfiltered `students` array
   instead of the team-scoped `roster` (i.e. swap which array is passed in at the
   call site). Confirm the out-of-team-scope linked student's control now wrongly
   appears. Restore. This is the proof that catches the specific composition-order
   defect the round-1 gate traced — a filter that's correct in isolation but wired
   against the wrong upstream array.

3. **Negative space — role gating**, mirroring the existing
   `<AttendancePanel> role gating` describe block's exact shape: assert an
   unauthenticated viewer, a `STUDENT_USER`, a `COACH_USER`, and an `ADMIN_USER` all
   render **no** `ParentRsvp` control anywhere on the page, **and** that
   `loadGuardianLinksForParent` (your mock/spy) is **never called** for any of them —
   same `expect(mocked...).not.toHaveBeenCalled()` shape
   `<AttendancePanel> role gating`'s own first test already uses for
   `mockedLoadAttendanceForSessions`.

4. **Real `currentUserProfileId` threading** (the "AttendancePanel data threading"
   idiom, applied here). With `nowFn` pinned (§7e), render with `PARENT_USER`, locate
   the linked student's RSVP control via §7e's locator, click a segment button
   (same `dispatchEvent(new MouseEvent('click', { bubbles: true }))` idiom this
   file's own `<AttendancePanel> data threading` test and `ParentRsvp.test.tsx` both
   already use), and assert your mocked `submitRsvpChange` was called with
   `expect.objectContaining({ respondedBy: PARENT_USER.id })`.
   **Mutation:** revert `currentUserProfileId={user.id}` on the `<ParentRsvp>` call
   site to an omitted prop. Confirm the assertion now fails (the call is recorded with
   `PLACEHOLDER_CURRENT_PARENT_PROFILE_ID`, not `PARENT_USER.id`, since that's
   `ParentRsvp.tsx`'s own default). Restore.
   **Test-infrastructure edit this criterion requires, disclosed explicitly (closes
   revision 7):** mocking `submitRsvpChange` this way requires editing the existing
   module-level `vi.mock('../../lib/supabase/loaders/outreach', ...)` factory
   (`OutreachDetail.test.tsx:124-131`, currently mocks only `markDayComplete`) to add
   `submitRsvpChange: vi.fn(async () => ({ id: 'rsvp-generated', ... }))` (shape to
   match `RsvpRow`) to its returned object, **and** adding a
   `mockedSubmitRsvpChange.mockClear()` line to the existing `afterEach` block
   (`:167-182`) alongside the three calls already there. This is real shared-
   infrastructure editing, not "only adding tests and adding fixture fields" — §12
   below is corrected accordingly.

5. **Real `studentProfileId` threading (self-vs-misattribution proof).** With
   `nowFn` pinned, construct a fixture RSVP row for the linked student whose
   `respondedBy` equals that student's own real `profileId` (a self-answered RSVP).
   Assert the rendered control shows **no** attribution line at all — specifically,
   neither the generic `"Someone else recorded this response on your student's
   behalf"` string nor any `"{relationship} signed you up"` string appears for that
   student's instance (`ParentRsvp.tsx`'s own module doc #6: `kind: 'self'` renders
   no attribution line).
   **Mutation:** revert `studentProfileId={student.profileId}` to `null` (or omit
   6a's field entirely). Confirm the assertion now fails — with `studentProfileId`
   wrongly `null`, `resolveRsvpResponderAttribution` cannot match the self case, falls
   through to `guardianLinks`, finds no match either, and lands on `'unrecognized'`,
   so the "Someone else recorded..." string **wrongly appears**. Restore.

6. **Real `guardianLinks` threading (relationship-label proof).** With `nowFn`
   pinned, construct a fixture RSVP row for the linked student whose `respondedBy`
   equals `PARENT_USER.id` (a parent-set RSVP), and a real fetched guardian-link row
   with a real, fabricated `relationship` value (e.g. `'Mom'`, matching PRD line
   297's own literal example — constitution item 6, fabricated names only). Assert
   the rendered attribution line reads exactly `"Mom signed you up"` (or your chosen
   relationship string).
   **Mutation:** revert the `guardianLinks={...}` prop pass to `[]`. Confirm the
   assertion now fails (attribution falls to `'unrecognized'` or the wrong branch).
   Restore.

7. **Loader-side column guard**, in `outreach.test.ts`, matching T146's own
   established select-string-guard pattern (cite it by symbol, `queryAllTeams (via
   makeLoadOutreachDetail) -- T146 select-string guard` describe block, as your
   structural template): record `queryGuardianLinksWithRelationshipForParent`'s
   `.select()` argument and assert it includes `relationship` (not just
   `id, parent_profile_id, student_id`), and assert `.eq('parent_profile_id', ...)`
   is called with the real supplied parent id. **Reuse decision, closing revision
   10:** call the existing, unexported `parseSelectedColumns` helper already
   declared in this same file (`outreach.test.ts:29-33`) — do not write a second
   copy of the same column-splitting logic. Since your new describe block lives in
   the same file that already declares this helper, this is a same-file reuse, not
   a cross-file extraction decision; it does not resolve or pre-empt the separate,
   genuinely open question `T161`'s ledger row names (whether a *future* task
   covering a *different* loader file's test — `checkin.test.ts`, `meetings.test.ts`,
   etc. — should extract this helper into `src/test-utils/` on first cross-file
   need). Leave that decision to whichever of T161–T165 lands first, as T161's row
   already says; do not extract it here. A revert to a narrower select (e.g.
   dropping `relationship`) must fail this test — confirm by mutation, same as above.

8. **Loading state.** While `loadGuardianLinksForParent`'s returned promise is
   unresolved, for a `PARENT_USER` with a real linked student, assert (a) no
   `<ParentRsvp>` control renders yet, and (b) a real, observable loading indicator
   is present for the "Your RSVP" region — an `aria-busy="true"` container with a
   `VisuallyHidden role="status"` announcement, matching this page's own top-level
   DES-12 loading convention (`:1282-1300`) at a smaller scope, not a full re-use of
   that exact markup. This is not a mutation-provable criterion in the revert-and-fail
   sense (there's no single line whose deletion makes "does it show a loading
   state" true or false in an interesting way) — state it as an inspection/behavioral
   assertion in your output doc, not force a mutation onto it.

9. **Error + Retry state.** With `loadGuardianLinksForParent` mocked to reject,
   assert an honest `Banner` renders with a real `Retry` action (same shape as the
   existing roster-load-failure banner in this file), and that clicking Retry
   re-invokes `loadGuardianLinksForParent` (spy call count increments) and, on a
   subsequent resolved call, transitions to the ready/populated state with the
   control now present. **Mutation:** remove the retry token's re-fetch effect
   dependency (or hardcode `guardianLinksState` to stay `'error'` after retry).
   Confirm the test now fails to see the transition. Restore.

10. **Ready-empty state — documents §10's deliberate choice, tested rather than
    left as an unwaived contradiction.** A `PARENT_USER` whose fetched
    `guardianLinks` is genuinely empty (no `guardian_links` rows at all) sees no
    "Your RSVP" heading or section anywhere on the page — assert its absence
    explicitly, plus that no stray loading/error UI is left behind, and that nothing
    else on the page (roster, other sections) is disturbed. This is the intentional,
    tested version of the deferral revision 1 disclosed in §10 below — no separate
    empty-state message is added; this criterion proves the omission is deliberate
    and stable, not an oversight.

11. **Build/type safety:** `tsc` passes with the extended `RosterStudent`/`StudentDbRow`
    shapes flowing into `AttendancePanel`/`MarkEventCompleteDialog`'s own independently
    reimplemented types (§6a's note) — verify by actually running the compiler, not by
    reading the structural-typing rules and asserting it will be fine.

12. **Regression baseline — do not pin a number.** Before your change, run the full
    `OutreachDetail.test.tsx` and `outreach.test.ts` suites at your own dispatch SHA
    and record the pass count as your baseline. After your change, the same suites
    must pass at baseline-count-plus-your-new-tests, with zero baseline tests broken.
    **Per §7e, none of this task's new tests are wall-clock-coupled** (all pin
    `nowFn`), so this baseline comparison itself will not go stale — compute your own
    number regardless, don't reuse one from this packet or the ledger, but you are
    not racing a clock to do so.

13. **No PII** (constitution item 6): any new fixture names/relationships are
    fabricated, matching every existing fixture in this file (`Amara Chen`, `Jordan
    Owens`, etc. — same register, no real names).

## 9. Worker tier and checker assignment

**Worker: `worker-implementer`, tier `opus`.** This is the fourth explicit decision
this revision makes, and it reverses revision 1's `sonnet` recommendation — resolving
the direct contradiction the round-1 gate found between this packet's own §9 and the
ledger row, both of which a dispatcher reads. **State plainly: `opus` is correct, and
`sonnet` was not clearly wrong on the letter of item 18, but arguable-and-losing on
its fourth trigger.** Item 18's four opus triggers, checked explicitly against this
task:
- Not a migration file.
- Not an RLS policy or `security definer` helper — this reads through an existing,
  already-correct RLS policy (`own_read` on `guardian_links`); it does not author or
  modify one.
- Not a SQL view / metric math.
- **Trigger 4, "changes auth, session, role-resolution, or permission logic" — this
  is arguable, not clearly non-firing, and the arguable case loses.** This task adds
  a role gate (§7a, `isParentViewer`) and, more materially, a **new client-side
  authorization predicate over minors' family linkage** (§7d,
  `resolveParentLinkedRosterStudents`) that determines which students a given signed-
  in user is permitted to see and act on behalf of. Revision 1 argued this was "the
  same 'wiring' shape T101/T117/T127 already shipped at sonnet tier" because it reuses
  `isStaffViewer`'s established pattern — true for §7a alone, but §7d is a genuinely
  new authorization decision over PII-adjacent data (guardian relationships for
  minors), not a reuse of an existing checked predicate the way `isStaffViewer` is.
  `T154`'s row is direct precedent for a sonnet→opus bump under item 18 for
  comparable auth *configuration* work in this same session. The reasoning that
  actually holds is narrower than revision 1's four-point case suggested: this task
  does not touch migrations/RLS-authoring/metric-SQL, but it does write new
  permission-adjacent logic, which is enough on its own for trigger 4.

**Checker: `checker-reviewer`, tier `opus`.** Unchanged from revision 1. This packet
prescribes nine mutation-provable acceptance criteria (§8, criteria 1, 2a, 2b, 2c, 4,
5, 6, 7, 9) each requiring the checker to actually apply a mutation, run the suite,
and read the failure output — not just review the diff, and not just trust the
worker's pasted output (§8's preamble makes this explicit as this revision's round-2
remediation). Every case on this branch where a mutation-proof criterion turned out
broken (T147's four-round history) was caught by execution, never by reading. This
many mutation criteria in one task, touching a real Supabase query and PII-adjacent
data (guardian relationships for minors' families), is worth the opus tier even
though item 18 doesn't independently mandate the *checker's* tier the way it does the
worker's.

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

One deferral made by this packet itself, disclosed here so you don't need to
re-discover or re-justify it, and now covered by a test rather than left implicit
(§8 criterion 10): a `parent`-role viewer with **zero** linked students sees no
"Your RSVP" section anywhere on this page, with no distinct empty-state message.
This is a deliberate minimal choice (there is nothing for them to RSVP for), not an
oversight.

## 11. Required worker output

- Every commit states its SHA (constitution item 21); use explicit pathspecs only,
  never `git add -A`/`git add .` (item 22).
- Your output doc includes: files touched, the executed mutation output for **all
  nine** mutation-marked criteria in §8 (1, 2a, 2b, 2c, 4, 5, 6, 7, 9 — corrected
  count from revision 1's five; criteria 3, 8, and 10 are explicitly non-mutation
  structural/behavioral checks, not revert-and-fail proofs — say so in your output
  doc rather than forcing a mutation onto them), the `tsc` result, the before/after
  test counts for both suites (§8.12), and any `FOLLOW-UP NEEDED` items (§10).
- State plainly which of this packet's design prescriptions (§6/§7) you followed
  as-written vs. deviated from, and why, if any.
- State the fixed instant you chose for `nowFn` in your tests and confirm it sits
  strictly before `session-food-bank-day1`'s start and strictly after
  `session-park-cleanup`'s start.
- If you land before T165 dispatches, note in your output doc (per §5's files-in-
  flight note) that T165's future worker must also keep your new
  `queryGuardianLinksWithRelationshipForParent` describe block byte-intact, alongside
  T146's.
- Do not mark your own work complete (constitution Non-Negotiables) — a separate
  checker validates the actual artifact.

## 12. Constitution excerpts relevant to this task

- Item 6: no PII in fixtures — fabricated names only.
- Item 10: existing tests must pass unless the boss explicitly approves a test
  update. Nothing in this task requires changing an existing test's *assertion* —
  you are adding tests, adding fixture fields (§6a, ten sites, authorized), and
  **editing the shared `vi.mock` factory and `afterEach` clear block** to add
  `submitRsvpChange` (§8 criterion 4) — corrected from revision 1, which understated
  this as "only adding tests and adding fixture fields."
- Item 12: every async screen ships loading/empty/error/populated. §7c resolves how
  this maps onto `GuardianLinksLoadState`'s three variants (empty is a `ready` case
  with zero results, matching this file's own `RosterLoadState`/T147 precedent) —
  item 12 governs over any packet-level waiver, and §8 now carries a criterion for
  each of the three states plus the reachability/populated case.
- Item 15: accessibility is a shipping requirement — the new "Your RSVP" heading
  (§7e) is both the accessibility requirement and the test-locator anchor.
- Item 18: worker tier is `opus` (§9) — trigger 4 (permission logic) is arguable and
  resolved in favor of firing, given §7d's new authorization predicate over minors'
  family linkage.
- Item 20: a deliberate deferral must produce a follow-up task (§10), never just a
  comment.
- Item 21/22: commit SHA + explicit pathspecs (§11).
- Item 23: mutation experiments run in your own worktree.

---

This packet has been through `checker-premise` once (round 1, REVISE). It is
submitted here for round 2 — the last round available under item 19a. It must
return DISPATCH before this reaches a worker; if it returns REVISE again, the cap is
spent and this packet dispatches to a worker as-is regardless, per the orchestrator's
standing instruction for this task.
