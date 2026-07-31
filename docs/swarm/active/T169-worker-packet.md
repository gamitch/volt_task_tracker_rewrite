# T169 worker packet — mount `RsvpControl` in `OutreachDetail.tsx` (student self-service half only)

**Scope note, read first.** T169's ledger row covers two surfaces: (1) `RsvpControl`
hosted on `OutreachDetail.tsx`, role-gated beside `ParentRsvp`, and (2) fixing
`OutreachList.tsx`'s local-only `handleRsvpChange` so it persists. **This packet is
(1) only.** (2) is out of scope for this packet, and `OutreachList.tsx` is not in this
packet's Allowed Files (§3), so there is no ambiguity about what this dispatch may
touch.

**Correction, round-1 gate MAJOR-1.** The prior revision of this note justified the
split by saying (2) was hard-blocked on T170 (`viewerStudentId` placeholder). **T170
has since merged** (`c201a3e`, "Merge T170 — /outreach resolves the real student,
repairing self check-off") — that block no longer exists, and (2) is now unblocked,
ready work in its own right. The real reason this packet covers only (1) is packet
size and review tractability (one surface, one Allowed-Files set, one focused review),
not a dependency between the two halves. `OutreachList.tsx` staying Forbidden here is
still correct — it just isn't because of T170 anymore. See §8 for the now-live
follow-up this unblocking creates, which this packet flags but does not fix.

**Pinned to branch tip `de6ae13` on `claude/swarm-plan-zl575z`** (round 2 re-pin; the
prior pin was `03efe47`, 24 commits back, which included T170's and T181's merges).
`git diff 03efe47 de6ae13 -- src/pages/outreach/OutreachDetail.tsx
src/pages/outreach/OutreachDetail.test.tsx src/pages/outreach/RsvpControl.tsx
src/pages/outreach/ParentRsvp.tsx supabase/migrations/20260717000002_rls.sql` is empty
— every page-side/component/RLS citation in this packet still holds unchanged across
that range. Re-verify against your own worktree before relying on any of it (item 19c).

**This is a test run.** The orchestrator will not merge this task's output or close the
ledger row after checking. Treat this packet as a normal, complete dispatch anyway —
everything below is written as if it proceeds through the pipeline in the ordinary way.

## 1. Objective

`RsvpControl.tsx` is a finished, tested, unreachable component — imported by exactly
one file, its own test (`RsvpControl.test.tsx:33`); zero production importers
(re-verified this session). Mount it in `OutreachDetail.tsx` so a signed-in **student**
viewing an outreach event's detail page sees a real, working self-service RSVP control
for each session, for their own roster row only — with a real `profiles.id` threaded
in, not the component's disclosed placeholder default.

## 2. Authority — read before touching scope

**George ruled, verbatim** (`auto-mode-decisions.md:886-887`, "2026-07-30 — George's
ruling on T169"): *"T169: the student can control belong on OutreachDetail alongside
the parent's (one screen, role-gated), AND on the student-facing outreach"* This
packet implements only
the first clause — `OutreachDetail.tsx`, role-gated beside `ParentRsvp`. The second
clause (`OutreachList.tsx`) is T169's other half, not this packet — see the scope note
above for why it is split out (packet size, not a block) and §8 for its now-live
follow-up.

**Everything else — whether any loader work is needed, the exact predicate shape, test
design, tier — is the orchestrator's call, not George's.** His ruling settles placement
only. If you disagree with a design choice below, say so in your output doc; do not
silently follow it if you find it wrong, and do not silently deviate either.

## 3. Allowed / Forbidden files

**Allowed (write access):**
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`

That's it. **No loader file is in this list, deliberately — §4 establishes why.**

**Forbidden (read-only reference):**
- `src/pages/outreach/RsvpControl.tsx`, `RsvpControl.test.tsx` — finished, tested,
  read-only. Do not modify. You will import the `RsvpControl` component (named export,
  `RsvpControl.tsx:456`, also has a default export at `:560` — use the named import,
  matching how this file already imports `ParentRsvp`:
  `import { ParentRsvp, type GuardianLinkRow } from './ParentRsvp';`). Its own test
  file is the authority for its internal lock-boundary/label/mutation behavior — do not
  duplicate that coverage here.
- `src/pages/outreach/ParentRsvp.tsx`, `ParentRsvp.test.tsx` — merged by T157, finished,
  read-only. Do not modify or re-verify its behavior; it is not this task's concern
  beyond reusing its established call-site pattern as a model (§5).
- `src/lib/supabase/loaders/outreach.ts`, `outreach.test.ts` — **not needed for this
  fix and therefore not Allowed.** §4 establishes that RsvpControl's read side is
  already fully satisfiable from data `OutreachDetail.tsx` already has post-T157, and
  its write side already defaults to the real `submitRsvpChange`. If your own reading
  finds this wrong, stop and report why before touching either file — do not silently
  expand Allowed Files.
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx` — the other half of
  T169, not this packet (§ scope note above). Do not mount, import, or reference
  anything from this task in that file.
- `src/app/guards.tsx` — read-only reference for `useAuth()`/`AuthUser`. (`Role` itself
  is defined at `src/lib/supabase/types.ts:33` — `export type Role = 'admin' | 'coach'
  | 'student' | 'parent'` — not in `guards.tsx`; harmless either way since §5a compares
  against a string literal, not the type, but cited correctly here.) You are reading
  existing role derivation, not changing it.
- `docs/swarm/**`, `.claude/**`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `constitution.md` — standard, every task.
- Any file not listed above as Allowed.

If you discover a genuine defect or gap outside these files, do not fix it and do not
only leave a code comment (item 20). Report it in your output doc using the template in
§9 — you cannot create the ledger row yourself.

## 4. Ground truth — the read-side question this packet is required to answer, not assume

The ledger row is explicit that the parallel claim for `ParentRsvp` ("purely placement,
no loader work") turned out **false** — T157 had to add `profile_id` to `queryAllStudents`
and build a new `guardian_links` loader. The row states plainly that the same has **not**
been checked for `RsvpControl` and instructs whoever packets this to enumerate its props
against available data before assuming anything. Done here, by reading both files
directly, re-confirmed unchanged at `de6ae13` (see the pin note above):

**`RsvpControlProps`** (`RsvpControl.tsx:430-454`):
```ts
export interface RsvpControlProps {
  studentId: string;
  session: RsvpControlSession;
  eventTitle: string;
  currentRsvp: RsvpRow | null;
  currentUserProfileId?: string;  // defaults to PLACEHOLDER_CURRENT_USER_PROFILE_ID
  onRsvpChange?: OnRsvpChangeFn;  // defaults to the real submitRsvpChange
  now?: () => Date;               // defaults to the real system clock
}
```
Compare directly against `ParentRsvpProps` (`ParentRsvp.tsx:459-481` — the interface
opens at `:459`; T157's own packet cited `:467`/`:481` for two individual fields, not
the interface's own opening line): that one additionally requires `studentProfileId: string | null` and
`guardianLinks: readonly GuardianLinkRow[]` — the two fields that forced T157's loader
work. **`RsvpControlProps` has neither.** It is the student's own single control, not a
guardian-on-behalf-of-N-children control, so there is no linkage data to fetch at all.

**Verdict, checked against `OutreachDetail.tsx`'s current (post-T157) data shape, field
by field:**
- `studentId` — satisfied by `RosterStudent.id` (`OutreachDetail.tsx:518-536`), already
  present, always was.
- `session` — `OutreachDetailSession` (`:563-572`) is a structural superset of
  `RsvpControlSession` (`RsvpControl.tsx:254-262`; same seven required fields — `id`,
  `eventId`, `sessionDate`, `startsAt`, `endsAt`, `status`, `peopleReached` — plus an
  extra `notes` field on the page's own type, which is harmless passed as a typed
  variable rather than an
  object literal — the exact same relationship `ParentRsvp`'s own `session={session}`
  call site already relies on, structurally unchanged here). Already present.
- `eventTitle` — `event.title`, already present.
- `currentRsvp` — `rsvps.find((r) => r.sessionId === session.id && r.studentId ===
  <the student's id>) ?? null`, the exact expression already used verbatim at the
  `<ParentRsvp>` call site (`:1751-1755`). Already present.
- `currentUserProfileId` — the signed-in **student's own** `profiles.id`. Module doc
  #11 (`:301-306`) already establishes `AuthUser.id === profiles.id` for this exact
  auth system; that proof is role-agnostic, so it holds for a student viewer exactly as
  it does for the parent and staff viewers already wired. `user.id` is real, already in
  scope, already used this way three times on this page: `:1609`
  (`resolveParentLinkedRosterStudents(roster, guardianLinksState.guardianLinks,
  user.id)`), `:1759` (`<ParentRsvp currentUserProfileId={user.id}>`), `:1778`
  (`<AttendancePanel currentUserProfileId={user.id}>`). Needs zero new data.
- `onRsvpChange` — leave at its default. `RsvpControl.tsx:462` already bakes in the
  real `submitRsvpChange` (`outreach.ts:1092`, the exported instance —
  `makeSubmitRsvpChange` itself is `:1068`) as its own default, the same posture
  `ParentRsvp` has and the same posture `MarkEventCompleteDialog`'s mutation prop
  already has on this page (module doc #12, cited by T157). Do not add an override
  prop to `OutreachDetailProps` for this — no established need, and it would deviate
  from this file's own precedent for no benefit.
- `now` — `OutreachDetailProps.nowFn` (`:1275`) **already exists**, already defaults to
  the real clock, and is already threaded to `<ParentRsvp now={nowFn} />` (`:1760`).
  Module doc #13(g) (`:411-421`) explicitly anticipates this: *"A future task adding
  another `<ParentRsvp>` render site on this page must pass `now={nowFn}` too, or it
  reintroduces the coupling."* The same sentence applies verbatim to a new
  `<RsvpControl now={nowFn}>` site — reuse the existing seam, do not build a second one.

**Conclusion, stated plainly because it is the opposite of T157's finding: no loader
work is needed for either the read or the write side of this task.** Every prop
`RsvpControl` needs is already real data on this page today, post-T157. This is why
`loaders/outreach.ts` is not in this packet's Allowed Files (§3) — unlike T157, where
the equivalent claim was checked and found false, here it is checked and holds. If your
own read disagrees, stop and report before writing code; do not silently add a loader
file to your working set.

**What *is* new: a predicate that does not exist yet.** Nothing on this page currently
answers "which roster row, if any, belongs to the signed-in student." §5 designs it.

**The placeholder this task closes**, restated from the ledger row and re-verified
directly: `currentUserProfileId = PLACEHOLDER_CURRENT_USER_PROFILE_ID`
(`RsvpControl.tsx:461`, constant defined `:287` = `'profile-placeholder-current-viewer'`).
Whoever mounts this component must pass the real value explicitly, or a real
`rsvps.responded_by` row gets attributed to a profile id that does not exist — the same
defect class T157's §4 closed for `ParentRsvp`.

**A stale doc comment this task must fix, not leave standing.** `OutreachDetail.tsx`'s
own module doc #13 currently states (`:349-350`): *"(`RsvpControl.tsx`, the
STUDENT-facing self-service counterpart, is deliberately NOT mounted here — separate
task, separate host ruling.)"* After this task lands, that sentence is false. Update it
(or remove it and let the new subsection below supersede it) as part of this change —
leaving it would be exactly the kind of drifted comment item 20 exists to prevent from
being the only record of a decision, except worse here because it would be an actively
wrong record, not just a missing one.

## 5. Design — page side only (no loader section; §4 established why)

All of the following is a design **prescription**, not yet code. Adapt if you find a
concrete conflict; report any deviation and why (§9's output requirements).

**5a. Role gate**, same shape `isParentViewer`/`isStaffViewer` already use on this page
(`:1358`, `:1601` respectively — `isParentViewer` is computed earlier, per its own
comment, "because the guardian-links fetch effect below depends on it") — do not
invent a new pattern:
```ts
const isStudentViewer = user !== null && user.role === 'student';
```

**5b. The new predicate — an explicit decision, and why it is a narrower thing than
T157's.** T157's `resolveParentLinkedRosterStudents` (`:885-896`) answers "which of
*potentially several other people's* roster rows is this parent authorized to act on" —
a genuine cross-person authorization question, which the ledger recorded as arguably
tripping item 18 trigger 4. This task's predicate answers a narrower question: "which
roster row, if any, *is the signed-in student's own*." Self-to-self matching, not
person-to-person. Proposed, matching this file's existing exported-pure-function
convention (`resolveEventRoster`, `resolveParentLinkedRosterStudents`, both exported,
both with a dedicated describe block in the test file):

```ts
/** T169: which roster row, if any, is the signed-in STUDENT's own. Composed over
 * the ALREADY team-scoped `roster` (module doc #3), not the full `students` list —
 * same reasoning as `resolveParentLinkedRosterStudents` (module doc #13(e)): a
 * student's own record for a team outside this event's scope must not surface a
 * control for this event. `AuthUser.id === profiles.id` (module doc #11), so
 * `userProfileId` here is the signed-in student's own `user.id`. */
export function resolveOwnRosterStudent(
  roster: readonly RosterStudent[],
  userProfileId: string,
): RosterStudent | null {
  return roster.find((student) => student.profileId === userProfileId) ?? null;
}
```
Name/shape are proposed, not mandatory — if you find a better name or a reason to
return an array instead (there should not be one: a student maps to exactly one
roster row, never several), say so in your output rather than silently diverging.

**Why not reuse `resolveCurrentStudentId` (`loaders/meetings.ts:664`), the sibling
identity-resolution seam `StudentHome.tsx:386`, `StudentMeetingView.tsx:307`, and
T170's own `OutreachList.tsx` (`:639`/`:3813`) all already use? Two independent
reasons, not one, not just "different file":** (a) it is an **async** Supabase query
— reusing it here would add a new fetch and, with it, a new DES-12 loading/error state
machine, directly contradicting §5f's "no new state machine" decision below; (b) it
resolves a bare `students.id` with **no team-scoping at all**, which would defeat
criterion 4's team-scope proof — this page needs the *team-scoped roster row*, not
just any matching student id. `OutreachDetail.tsx` already holds a team-scoped
`roster` (with `profileId`) in memory from its own existing load, which
`OutreachList.tsx` does not have available the same way — a synchronous local `.find`
is both cheaper and more correct **specifically because of that difference**, not
because the async seam is wrong in general; T170 was right to use it on
`OutreachList.tsx` for the identical reason this task is right not to.

**5c. Compute once, outside the per-session loop** (same placement as
`parentLinkedStudents`, `:1607-1610` — that value also doesn't vary per session):
```ts
const ownRosterStudent =
  isStudentViewer && user !== null ? resolveOwnRosterStudent(roster, user.id) : null;
```

**5d. Call site, inside the existing per-session loop** (`orderedSessions.map(...)`,
`:1722`), alongside `<SessionSignupList>` and the `parentLinkedStudents.map(...)` block
— same OUT-04 per-session placement this file already establishes for RSVP controls.
**The `user !== null &&` is load-bearing, not redundant, for the identical reason
already documented at this file's two existing gates** (`:1734-1735` for `ParentRsvp`,
`:1773` for `AttendancePanel`): `isStudentViewer` is a plain `boolean`, not a type
predicate, so it does not narrow `user: AuthUser | null` and `currentUserProfileId=
{user.id}` will not compile without the separate null check.

```tsx
{isStudentViewer && user !== null && ownRosterStudent !== null && (
  <RsvpControl
    studentId={ownRosterStudent.id}
    session={session}
    eventTitle={event.title}
    currentRsvp={
      rsvps.find(
        (rsvp) => rsvp.sessionId === session.id && rsvp.studentId === ownRosterStudent.id,
      ) ?? null
    }
    currentUserProfileId={user.id}
    now={nowFn}
  />
)}
```

**5e. Locator — deliberately simpler than `ParentRsvp`'s, and here is the reasoning,
not an assumption carried over from T157.** `ParentRsvp` needed a page-owned `Heading`
because its own `controlLabel` (`ParentRsvp.tsx:568`) carries the event
title and session date but not the student's name, so two *different linked students*
in the same session produced byte-identical `aria-label`s. **That ambiguity does not
exist here** — a student only ever sees their own single control, never another
student's, so there is no cross-student collision to disambiguate. `RsvpControl`'s own
`controlLabel` (`RsvpControl.tsx:508`): `` `Your RSVP for ${eventTitle} on
${formatSessionDateOnly(session)}` `` already carries the event title AND the session
date, which is sufficient to disambiguate across this event's own multiple sessions
(distinct dates) without any new page-owned markup. Locate directly:
`container.querySelector('[role="radiogroup"][aria-label="Your RSVP for <event title>
on <date label>"]')`.

**Convenience note:** `OutreachDetail.tsx`'s own `formatSessionDateOnly` (`:1016`) is
byte-identical in implementation to `RsvpControl.tsx`'s own copy (`:374`) — safe to
compute your expected date-label text using either one when writing the locator
string in your tests; they will always agree.

**Known, disclosed limitation, not this task's to fix.** If a future event ever has two
sessions on the exact same calendar date (`formatSessionDateOnly` truncates to date-only,
`RsvpControl.tsx:374`), their `aria-label`s would collide. This is a latent
property of `RsvpControl.tsx` itself, which is Forbidden here, not something this
mounting task introduces or can fix in scope. Avoid the hazard in your own test fixtures
by giving any multi-session test event distinct dates (mirroring `ParentRsvp`'s own test
fixtures, `OutreachDetail.test.tsx:1553-1577`, which already made this same choice for
the same reason) — do not construct a same-day two-session fixture and then work around
the resulting ambiguity.

**5f. No new DES-12 state machine (item 12) — explicit decision.** Unlike T157, which
added a brand-new `guardianLinksState` fetch and therefore owed its own
loading/error/ready states, this task adds no new fetch. `RsvpControl`'s render is
driven entirely by data the page's existing top-level `loadState`/`rosterState`
machinery already resolves before any session renders at all. Item 12 is satisfied by
that pre-existing machinery, not by anything new here — state this plainly in your
output doc rather than leaving it to be inferred, the same way T157's revision 2 had to
resolve a real contradiction the round-1 gate caught on this exact point.

**5g. Empty case — a synchronous analogue of T157's "zero linked students" deferral.**
A student viewer with no matching roster row (`ownRosterStudent === null` — not on this
event's team, or no `students` row at all) sees no self-RSVP control anywhere on this
page, with no distinct empty-state message, for the same reason T157 made this call for
parents: there is nothing to RSVP for. Deliberate, not an oversight — cover it with a
criterion (§6) rather than leaving it implicit.

**5h. Module doc.** Add a new numbered subsection to `OutreachDetail.tsx`'s module doc
(next number after T157's `13.`, i.e. `14.`), same lettered-item convention items
13(a)-(g) already use, recording: what was mounted, why no loader work was needed (§4's
conclusion, in your own words, cited by symbol), the self-vs-cross-person distinction
from `resolveParentLinkedRosterStudents` (§5b), and the locator reasoning (§5e). Update
or remove the now-false `:349-350` sentence (§4) as part of the same edit.

## 6. Acceptance criteria — mutation-provable proofs, matching this file's established discipline

Every criterion lives in `OutreachDetail.test.tsx`, never in `RsvpControl.test.tsx` — a
criterion satisfiable from `RsvpControl`'s own test file reproduces the exact
"green suite, unreachable feature" blind spot this task exists to close (the same
reasoning the ledger row gives for why every gate missed this for as long as it did).

Run every mutation in your own worktree (item 23), revert with
`git checkout -- <file>` after each, re-confirm green before the next.

**A fixture trap to avoid before you design test data.** The existing `STUDENT_USER`
fixture (`OutreachDetail.test.tsx:228-232`, `id: 'profile-student-1'`) does not match
any existing `RosterStudent.profileId` in either `FIXTURE_STUDENTS` (source file,
**`OutreachDetail.tsx:627-658`** — not the test file; `OutreachDetail.test.tsx:627-661`
is the unrelated `clickMenuItem` helper) or `ParentRsvp`'s own test-local roster fixtures
(`LINKED_STUDENT` etc., `:1512-1533`, also `profile-amara-chen`-family ids). That is
**good** for the negative-space criteria below (STUDENT_USER already renders nothing
new against every pre-existing fixture, so this task cannot silently break an existing
`STUDENT_USER`-based test — worth confirming by measurement, not just asserting it). It
means you need a **new**, dedicated student-role fixture set for the positive-path
criteria — construct your own self-contained event/session/roster/rsvp fixtures (own
event id, own `AuthUser`, own pinned clock), the same architecture `ParentRsvp`'s own
test block already uses (`PARENT_EVENT_ID`, `PARENT_SESSIONS`, `LINKED_STUDENT`, etc.,
`:1503-1610`) — do not repurpose `STUDENT_USER` or its id for this, since other
existing tests already rely on it never matching any roster row.

1. **Reachability.** A student viewer whose own roster row exists in this event's
   (team-scoped) roster sees a real `RsvpControl` for each of the event's sessions,
   located via §5e's aria-label locator. **Mutation:** delete the whole JSX block, or
   invert §5c's `isStudentViewer` condition. **Do not merely delete the JSX-level
   `isStudentViewer &&` guard by itself** — §5c's `ownRosterStudent` computation
   already gates on `isStudentViewer` separately, so removing only the JSX guard
   leaves the block still effectively gated and the suite stays green, which could be
   misread as this criterion being vacuous — the same confusion class as T170's
   BLOCKER-1. Confirm RED. Restore.

2. **`resolveOwnRosterStudent` — direct unit `describe` block**, matching this file's
   convention for its comparable pure functions:
   - a roster of 3+ students where exactly one has `profileId === userProfileId` →
     that one is returned.
   - zero matches → `null`.
   - a near-miss (a different roster student whose `profileId` is a different, similar
     string) → excluded, not matched.
   **Mutation:** loosen the predicate (e.g. return `roster[0]` unconditionally, or drop
   the equality check). Confirm the near-miss and zero-match cases now wrongly return a
   student. Restore.

3. **Integration — self-only, not cross-student (the real proof, since this feeds
   `rsvps.student_id`).** A session's roster has 2+ students; the signed-in student
   viewer's `user.id` matches only one of their `profileId`s. **This describes a state
   RLS makes production-unreachable — see §7's tier note — but it is still tested here
   as an authorization predicate in its own right, same posture already documented for
   the parent case at `OutreachDetail.tsx:876-883`.** Assert (a) exactly one
   `[role="radiogroup"]` self-RSVP control renders per session — count equals session
   count, not double — and (b) clicking it and reading the `submitRsvpChange` spy's
   call arguments shows `studentId` equal to the viewer's own roster row's `id`, never
   the other student's. **`RsvpControl` emits no `studentId` into the DOM** — there is
   no `@testing-library/*`/enzyme/react-test-renderer in this repo (raw `createRoot`
   harness, confirmed), so the spy-argument check in (b) is the only way to observe
   which student the control actually targets; do not reach for a testing-library-only
   technique that does not exist in this codebase. **Mutation:** same
   predicate-loosening as criterion 2, applied at the call site (or pass a
   hardcoded/different roster index). Confirm the spy's `studentId` argument now reads
   the wrong student's id. Restore.

4. **Team-scope composition order.** The signed-in student's own roster row belongs to
   a team **not** in this event's `teamIds` (i.e., already filtered out of
   `resolveEventRoster`'s output before `resolveOwnRosterStudent` ever runs). **Same
   RLS-unreachability caveat as criterion 3** — for a real student viewer, `students`'
   `own_or_linked_read` policy (`rls.sql:102`) already limits what `students` can even
   contain to `my_student_ids()`'s result, so this fixture's "student present in
   `students` but filtered by team scope" shape is a defence-in-depth test, matching
   the parent-case precedent at `OutreachDetail.tsx:876-883`, not a state a real student
   viewer's client could construct on its own. Assert no control renders anywhere on
   the page. **Mutation:** call `resolveOwnRosterStudent` against the full unfiltered
   `students` array instead of the team-scoped `roster`. Confirm the out-of-scope
   student's control now wrongly appears. Restore.

5. **Role gating, paired with a positive control (per T170's BLOCKER-1 lesson — a
   spy/absence assertion alone is not proof).** Render as `COACH_USER`, `ADMIN_USER`,
   `PARENT_USER`, and unauthenticated (`user = null`), each against a **populated,
   successful** load whose roster genuinely includes a row matching that viewer's own
   id in the `profileId` sense (to prove absence is really role-gating, not just "no
   match anyway") — **except for the `user = null` case, where this precondition is
   waived: there is no viewer id to match, so nothing can be constructed to satisfy it.
   Its positive-control clause (b) still applies** — assert the signed-out render's
   other expected content is present. Assert (a) no `RsvpControl` renders for any of
   them, **and** (b) the page's other expected content for that role genuinely rendered
   (e.g. `AttendancePanel` for staff, the `ParentRsvp` control for the parent, the
   roster/session list content for the signed-out case) — proving the page did not
   simply fail to render.

6. **Real `currentUserProfileId` threading.** With a matching student fixture, click a
   segment button on the control (same `dispatchEvent(new MouseEvent('click', {bubbles:
   true}))` idiom this file already uses for `AttendancePanel`/`ParentRsvp`), and assert
   the already-mocked `mockedSubmitRsvpChange` (`:154`, already wired since T157 — no
   new mock setup needed) was called with `expect.objectContaining({respondedBy:
   <the student AuthUser's id>, studentId: <the own roster row's id>})`. **Mutation:**
   revert `currentUserProfileId={user.id}` to an omitted prop. Confirm the call now
   carries `PLACEHOLDER_CURRENT_USER_PROFILE_ID` instead. Restore.

7. **Clock seam wired.** With `nowFn` pinned strictly before a session's start, assert
   the control is genuinely editable (segment buttons not disabled); with a second
   session/fixture pinned strictly after its start, assert it is locked
   (`isRsvpEditable`'s own boundary, `RsvpControl.tsx:327-329`, unmodified — you are
   proving the seam is wired, not re-testing the component's own lock logic).
   **Mutation:** drop `now={nowFn}` from the call site. Confirm the editable/locked
   assertions now depend on the real system clock instead (demonstrate by, e.g., a
   session dated far in the past that should be locked under the real clock rendering
   as editable under the pinned `nowFn` before the mutation, and locked after — or an
   equivalent proof). Restore.

8. **Empty case (§5g).** A student viewer whose own roster row does not exist for this
   event (no team match) sees no self-RSVP section anywhere on the page, with no stray
   loading/error UI, and nothing else on the page (roster, signups, other sections)
   disturbed. Inspection-level, not mutation-provable in the revert-and-fail sense — say
   so rather than forcing a mutation onto it. **Required stub, or this criterion fails
   for the wrong reason:** as this file's own `renderParentDetail` precedent already
   established (`OutreachDetail.test.tsx:1620-1626`), pass `loadRoster: async () => []`
   in your new student test block. Left at its real default, `loadRoster` rejects in
   this environment (no configured Supabase client) and renders the unrelated T147
   roster-failure `Banner` instead of the state this criterion is actually testing.

9. **§3's Allowed-Files scoping held (proof by diff, not proof of §4's conclusion).**
   Diff-based: confirm `loaders/outreach.ts` and `RsvpControl.tsx`/`ParentRsvp.tsx` are
   byte-unchanged by your diff — i.e. you stayed inside this packet's Allowed Files.
   **This criterion is not, by itself, the evidence for §4's "no loader work needed"
   conclusion — criteria 1 and 6 are:** criterion 1 proves a real control genuinely
   renders and criterion 6 proves it writes a real profile id and real student id, both
   with zero new fetch added anywhere. A clean diff alone is equally consistent with the
   feature simply not working; it is criteria 1 and 6 together with this one that make
   the "no loader work, and it still works" claim actually proven.

10. **Stale doc comment fixed (§4).** Confirm `:349-350`'s now-false sentence no longer
    reads as written — either removed or corrected, and the new module doc subsection
    (§5h) is present.

11. **Build/type safety and full-repo gates** — this file class has a measured
    regression history (T157's own merge needed a MINOR fix because `format:check`
    regressed). `npm run typecheck` exits 0; `npm run lint` reports 0 errors (one new
    `react-refresh/only-export-components` warning on the newly exported
    `resolveOwnRosterStudent` is EXPECTED and correct — matching T157's identical +1
    precedent for its own new exported pure function; do not "fix" this by
    un-exporting it); `npm run format:check` is clean. Record the full-repo
    `npm run test` count alongside criterion 12's per-file count, not only the
    per-file number.

12. **Regression baseline.** The round-1 `checker-premise` gate measured
    `OutreachDetail.test.tsx` = **60 passing tests at `de6ae13`** — record this as your
    starting reference, but re-measure it yourself at your own dispatch SHA rather than
    trusting this number verbatim (it may have moved by the time you start). After your
    change, the same file must pass at baseline-plus-your-new-tests with zero baseline
    tests broken. Confirm
    specifically that no pre-existing `STUDENT_USER`-based test's rendered output
    changed (§6's fixture-trap note) — this should hold by construction, but measure it,
    don't assume it.

13. **No PII (item 6).** Any new fixture names are fabricated, matching this file's
    existing register.

14. **Accessibility (item 15).** Keyboard path to the new control is unaffected
    (`RsvpControl`'s own accessibility is pre-verified in its own test file, Forbidden
    here); confirm your page-side wiring introduces no new keyboard trap or unlabeled
    element. If you judge a page-owned heading is needed after all (contrary to §5e's
    reasoning), say why and add it — your call to make and disclose, not silently follow
    or silently override.

## 7. Worker tier and checker assignment

**Worker: `worker-implementer`, tier `sonnet`.** Item 18's four opus triggers, checked
explicitly:
- Not a migration file.
- Not an RLS policy or `security definer` helper — reads through already-correct,
  unmodified RLS (`rsvps`' `own_or_linked_write`/`own_or_linked_update`,
  `student_id in (select my_student_ids()) and responded_by = auth.uid()`, re-cited
  from T157's own read of `rls.sql:205-212`).
- Not a SQL view / metric math.
- **Trigger 4, weighed explicitly against T157's tier rather than assumed to match it —
  and correcting my own prior mischaracterization of T157's tier.** T157's ledger row
  records its sonnet→opus bump as **"a judgement call, not an item 18 trigger"** —
  item 18 explicitly did **not** fire for T157 either; the bump was the orchestrator's
  discretionary call over `resolveParentLinkedRosterStudents`'s genuinely new
  **cross-person** authorization shape (one signed-in parent determining which of
  *potentially several other people's* — their children's — records they may act on,
  over guardian-relationship data), not a mechanical trigger-4 firing. This packet's
  earlier revision wrongly described that as trigger 4 firing; corrected here.
  **This task's predicate, `resolveOwnRosterStudent` (§5b), is self-to-self matching**
  — does this roster row belong to the signed-in user themself — the same kind of check
  `isStaffViewer`/`isParentViewer` already make (`user.role === X`) with one added
  equality against `AuthUser.id === profiles.id`, a fact this file already established
  and reuses, not a new relationship it discovers. There is no third party's data in
  the decision at all.
  **Two independent backstops, not one, make a broken predicate here strictly
  lower-consequence than T157's case:**
  1. **Read side.** For a real student viewer, `students`' `own_or_linked_read` RLS
     policy (`rls.sql:102`, `using (id in (select my_student_ids()))`) already narrows
     what `students` rows that viewer's client can receive. **`my_student_ids()`
     itself is role-agnostic — a single UNION (`rls.sql:20-26`), not a branch on
     role:** `select id from students where profile_id = auth.uid()` union `select
     student_id from guardian_links where parent_profile_id = auth.uid()`. **The
     reduction to "exactly their own row" below is my own inference for the
     student-viewer case, not a quote of the function's literal branching (it has
     none):** a signed-in student's `auth.uid()` is not expected to also appear as a
     `parent_profile_id` in `guardian_links` (distinct role identities in this
     schema), so in practice only the first branch of the union contributes rows for
     a student session, narrowing the result to that student's own `students` row. In
     production, `roster` on this page cannot contain another student's row for a
     student viewer at all — a broken client-side predicate has no cross-student data
     available to leak in the first place. (The
     multi-student-roster fixtures in criteria 3/4 test a state that is real for the
     *pure function in isolation* but production-unreachable for a real student
     session — defence in depth, the same posture already documented for the parent
     case at `OutreachDetail.tsx:876-883`.)
  2. **Write side.** `rsvps`' `own_or_linked_write`/`own_or_linked_update`
     (`student_id in (select my_student_ids()) and responded_by = auth.uid()`,
     `rls.sql:205-212`) independently blocks a wrong `studentId` from ever reaching the
     database even if (1) somehow didn't hold.
  This read-side argument is materially stronger than a write-side-RLS-only case: it
  is not just "a bad write gets rejected," it is "the wrong data is never in the
  client to act on." **Per item 25's second, narrower obligation — do not bump tier
  because a topic sounds sensitive — and given both backstops, I judge trigger 4 does
  not fire here.** This is a judgment call, not a mechanical one; if you (the
  dispatcher or a checker) read §5b's predicate differently, say so rather than
  silently overriding the tier.

**Checker: `checker-reviewer`, tier `opus`.** Matching this exact page's established
checker tier for RSVP-mounting work (T157) and T170's own reasoning for the identical
choice: not because the topic is sensitive, but because the artifact class — a live
route, multiple mutation-provable criteria, a documented history of vacuous
absence-only assertions in this project (T170's own BLOCKER-1) — warrants it regardless
of the worker's tier.

**Premise gate scoping (item 19b) — recommendation, not this packet's call.** This task
rolls out an already-verified pattern (T157's role-gated-mount shape) to a second,
structurally similar surface on the same file, with a narrower predicate and zero new
loader work. A light premise check looks appropriate under 19b's own example ("applying
a proven pattern to a second surface"). `checker-premise` decides this, not the
foreman — flagged here as a recommendation only.

## 8. Deferral policy — exact text to report

If you discover a genuine out-of-scope defect or gap not already named in §3/§4, do not
fix it and do not only leave a code comment (item 20). Report it in your output doc
using exactly this template:

```
FOLLOW-UP NEEDED (item 20):
- What: <one sentence>
- Why out of scope for T169 (OutreachDetail half): <one sentence>
- Suggested Allowed Files for the follow-up: <file list>
- Evidence: <symbol/citation>
```

One deliberate deferral is pre-authorized by this packet: §5g's empty-case
non-message, which is already covered by criterion 8 rather than left implicit.

**A second item, flagged here per item 20 (round-1 gate MAJOR-1) — do not silently
drop this, and do not fix it in this packet.** T170 merged (`c201a3e`, "Merge T170 —
/outreach resolves the real student, repairing self check-off") since this packet's
first pin, which removes the reason T169's own ledger row gave for treating the
`OutreachList.tsx` half as blocked. `OutreachList.tsx:3656-3661`'s `handleRsvpChange`
is still local-only — its own code comment (module doc #8b, `:3659`) still says the
real persisted flow is "currently Blocked," which is now false a second time. This packet does not fix it (`OutreachList.tsx` is not in this packet's
Allowed Files, §3) and does not need a *new* ledger row — T169's own row already names
this exact gap — but its "blocked on T170" status is now wrong and should be corrected
to Ready/unblocked, and the stale comment corrected, whenever that surface is next
picked up:

```
FOLLOW-UP NEEDED (item 20):
- What: OutreachList.tsx's handleRsvpChange is local-only (no Supabase write); its
  own code comment still says "currently Blocked," which is now false since T170
  merged.
- Why out of scope for T169 (OutreachDetail half): different file, not in this
  packet's Allowed Files (§3); this packet covers OutreachDetail.tsx only.
- Suggested Allowed Files for the follow-up: src/pages/outreach/OutreachList.tsx,
  OutreachList.test.tsx.
- Evidence: OutreachList.tsx:3656-3661 (handleRsvpChange), :3659 (the stale
  "currently Blocked" comment).
```

## 9. Required worker output

- Every commit states its SHA (item 21); explicit pathspecs only, never
  `git add -A`/`git add .` (item 22).
- Output doc includes: files touched, the executed mutation output for every
  mutation-marked criterion in §6 (1, 2, 3, 4, 6, 7 — criteria 5, 8, 9, 10, 11, 12, 13,
  14 are explicitly non-mutation structural/inspection/diff checks, say so rather than
  forcing a mutation onto them), the `tsc` result, before/after test counts for
  `OutreachDetail.test.tsx` (§6.12), and any `FOLLOW-UP NEEDED` items.
- State plainly which of §5's design prescriptions you followed as-written vs. deviated
  from, and why.
- State the fixed instant(s) you chose for any new `nowFn` fixtures and confirm they sit
  on the correct side of your test sessions' start times.
- Do not mark your own work complete (constitution Non-Negotiables) — a separate
  checker validates the actual artifact.

## 10. Constitution excerpts relevant to this task

- Item 6: no PII in fixtures — fabricated names only.
- Non-Negotiable #2 (`constitution.md:10`): existing tests must pass unless the boss
  explicitly approves a test update; nothing here requires editing an existing `it(`
  body — only new tests and, if you touch it at all, the module doc (§5h/§4).
- Item 12: every async screen ships loading/empty/error/populated — §5f states why this
  task adds no new async state machine and relies on the page's existing one.
- Item 15: accessibility is a shipping requirement — §5e's locator reasoning doubles as
  the accessibility argument for why no new heading is prescribed.
- Item 18: worker tier is `sonnet` (§7) — trigger 4 judged non-firing for a self-to-self
  predicate, explicitly distinguished from T157's cross-person one.
- Item 19b: light premise check recommended (§7), `checker-premise`'s call.
- Item 20: a deliberate deferral must produce a follow-up task (§8), never just a
  comment — applies both to §5g's empty-case choice and to the now-unblocked
  `OutreachList.tsx` gap (T170 merged; §8 flags it explicitly rather than dropping it
  silently).
- Item 21/22: commit SHA + explicit pathspecs (§9).
- Item 23: mutation experiments run in your own worktree.
- Item 25: do not bump tier because a topic sounds sensitive (§7); security findings
  are graded against Volt's actual threat model, not manufactured.

## 11. Process note

Recommend worktree isolation for this dispatch (`git worktree add`), matching T157's
and T170's standard practice for this class of task.
