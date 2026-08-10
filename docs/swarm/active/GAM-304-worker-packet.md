<!-- SALVAGED FROM AN EXPIRING ARTIFACT. Not hand-authored.

Recovered 2026-08-10 from the execution transcript of dispatch run 31354278407
(job 93350880663, session 13cca3b1-84f1-490b-b71c-0034e854520b), which produced
this and then exited before pushing anything. The artifact
`claude-run-GAM-304-31354278407` has 30-day retention and expires 2026-09-09.

The run reported `success` at 44 turns of 200, having said "Round 2 is running
in the background" -- background work the process took with it. No branch was
pushed and no PR opened, so without this file the work below is lost.
-->

# GAM-304 (T809) — worker packet

**Issue:** `GAM-304` · **Tier: HEAVY** · **Branch:** `claude/gam-304-wire-rsvp-controls`

> ## ⚠ THIS PACKET IS NOT CLEARED FOR DISPATCH (constitution items 19 + 19a)
>
> **Revision 3 has never been through the premise gate, and cannot be.** Both
> rounds item 19a allows are spent, and both returned REVISE:
>
> | Round | Verdict | Record |
> | -- | -- | -- |
> | 1 | REVISE — 1 BLOCKER, 3 MAJOR, 4 MINOR, 1 NIT | `GAM-304-premise-gate-round1.md` |
> | 2 | REVISE — 1 BLOCKER, 4 MINOR, 1 NIT | `GAM-304-premise-gate-round2.md` |
>
> Item 19 forbids any packet reaching a worker without a **DISPATCH** verdict,
> and 19a forbids a third round ("*a plan still failing after two rounds has
> something wrong with the plan, not the wording*"). **GAM-304 is therefore
> escalated to the human owner.** No worker has been dispatched and none may be
> until the owner rules.
>
> Revision 3 exists so the owner's decision is a yes/no rather than homework: it
> applies all six of round 2's required revisions, each backed by that round's
> executed measurements. It is the author's fix to a gate finding, not a gated
> artifact — treat every line added by revision 3 as unverified by anyone who
> did not write it, which is precisely the exception item 19 exists to close.

**Revision 2** — round 1 of the item 19 gate returned REVISE (1 BLOCKER, 3
MAJOR, 4 MINOR, 1 NIT). Every finding is folded in below; the gate's executed
results are quoted rather than re-derived, so round 2 need not re-measure them.

**Revision 3** — round 2 returned REVISE on a BLOCKER confined to §1d, which was
text revision 2 newly introduced (and introduced in response to round 1's own
"cheaper paths" suggestion). Round 2 confirmed **all nine** of round 1's
required revisions were genuinely fixed, and verified criteria 1-6, the
corrected citations, and the entire `ParentHome` half of §2 as sound. Revision 3
changes only: §1d (rewritten — `clickAction` removed), §3(i)'s insertion point
(an off-by-one with teeth), three further citations, criterion 7, the no-prop
test's mechanism, and the least-confident list.

Two RSVP controls flip a button and throw the answer away. Connect both to the
`rsvps` upsert that already exists, using the responder identity RLS requires.

## Tier justification (item 26 — stated and defended)

**HEAVY.** Item 26's first named trigger fires literally: the change **adds a
write path** where none exists (`rsvps` insert/update). It is not merely
touching one — it creates the app's newest one on two surfaces at once, and a
wrong `responded_by` is silently rejected by RLS while the optimistic UI says
"saved." That is the "lie to a user about their own data" test.

**Not STANDARD**, even though the write function is already built and already
has three callers: STANDARD forbids a write path outright, and this crosses two
page files with independent identity plumbing.

**Worker tier: sonnet, the pinned default — deliberately not bumped.** None of
item 18's four triggers fires: no migration, no RLS policy or `security
definer` helper, no metric-view SQL, and **no change to auth, session, or
role-resolution logic** — the change *consumes* an already-resolved
`useAuth().user.id` and forwards it. Item 25's second obligation retires the
"the topic sounds sensitive" bump that this task would otherwise attract (T157
is the named error). The RLS-facing risk is real but is fully discharged by
evidence, not by model tier: the gate has already **executed** every policy
path (below), and criterion 2 pins the one mistake that matters.

## Linear state (item 28) — recorded because round 1 asked

Claimed live: read `Todo`, moved `Todo → In Progress`, re-read and confirmed
`In Progress`. **The generated export (`linear-export.md:328`) reads `Done`, and
that is expected, not a contradiction** — the export was generated at
`04:02:17Z` (`:7`), about 63 seconds *before* the owner moved the issue into
`Todo`, which is what dispatched this work. Item 29c states the export goes
stale by definition on exactly this transition and heals on a schedule rather
than gating.

**Re-claimed 2026-08-10 at `04:58:28Z` by the current session**, which is the
claim in force. The prior run (dispatch 31354278407) claimed at `04:03:43Z` and
then exited without pushing a branch or opening a PR, leaving the issue in
`In Progress` with no work attached; the read-back this session performed
returned `In Progress`, `tier/heavy`, `area/w5`, no competing comments. The
earlier timestamp is kept above rather than overwritten because it is the
evidence that the first claim happened (item 30c).

**Baseline re-verified at HEAD `5562e48`.** The round-1 gate measured against
`f2ca7e5`; `git diff --name-only f2ca7e5..HEAD` returns only
`docs/swarm/active/GAM-304-*.md` and the two `linear-export.*` files, and
`git diff --stat f2ca7e5..HEAD -- src/ supabase/ package.json package-lock.json`
is empty. **No source drift**, so every executed measurement below still holds
at HEAD. The defect is provably still present.

## What is already true — verified against `main` (`f2ca7e5` ≡ HEAD `5562e48` for all source), twice

Re-read at this branch point by the author, then independently re-verified by
the round-1 gate. Every row below is CONFIRMED exact.

| Fact | Location |
| -- | -- |
| Student handler is local-only, and says so | `StudentHome.tsx:1442-1445` |
| Parent handler is local-only, same shape | `ParentHome.tsx:1255-1257` |
| The one real `rsvps` upsert | `loaders/outreach.ts:1219` (`makeSubmitRsvpChange`), `:1243` (`submitRsvpChange`) |
| Its params require a `profiles.id` responder | `outreach.ts:1204-1214` |
| RLS: insert needs `responded_by = auth.uid()` | `20260717000002_rls.sql:205-207` (`own_or_linked_write`) |
| RLS: update needs the same | `rls.sql:209-212` (`own_or_linked_update`) |
| `my_student_ids()` covers own row **and** a parent's linked children | `rls.sql:20-26` (guardian arm `:25`) |
| `profiles.id` **is** the auth user id | `20260716000000_identity_roster.sql:16-17` |
| Planned hours read through the RSVP view | `20260723000001_dashboard_views.sql:71-80`, `:95-98`, `:112-116` |
| The verified precedent to copy | `OutreachList.tsx:3930-3951` (T193) |
| Both override helpers append when no row exists | `StudentHome.tsx:907-918`, `ParentHome.tsx:946-959` |
| Both test harnesses render under `LoginAs` | `StudentHome.test.tsx:152`, `ParentHome.test.tsx:66` |

**Four citations from revision 1 were wrong and are corrected here** (item 19c
— the corrections are kept rather than quietly deleted):

- `ParentHomeProps` is `ParentHome.tsx:1346-1353`. Revision 1 said `:1346-1358`,
  which runs into `WEEKLY_SUMMARY_FOOTER_NOTE`.
- `ParentRsvp` is **rendered** at `OutreachDetail.tsx:2363`. `:807` is its
  `import`. **Revision 1 inherited this error from the Linear issue itself**,
  which cites `:807` as the render site.
- T193's precedent `Banner` is `OutreachList.tsx:3972-3980`, not `:3968-3976`
  (that range starts in the comment and truncates before
  `isDismissable`/`onDismiss`).
- `ParentHome.tsx:1363` destructures `user`, and `user.id` is read nowhere in
  the file today. The load-bearing fact is the **`user === null` early return
  at `:1366`**, which is what makes `user.id` non-null at the `:1434` render
  site.

**Three facts the gate proved, so you need not re-derive them:**

1. **No two `ParentHome` cards can target the same `(session_id, student_id)`.**
   `guardian_links` carries `unique (parent_profile_id, student_id)`
   (`identity_roster.sql:78`) and `makeLoadLinkedStudentsForParentHome` maps
   students 1:1 off `linkRows` (`loaders/parentHome.ts:426-436`). Per-card
   in-flight state is therefore safe.
2. **The parent-on-behalf disclosure already exists, verbatim.** D013's own
   migration header
   (`20260804000001_widen_rsvp_read_all_authenticated.sql:43-50`) discloses
   "*widening read also reveals WHO answered … e.g. that a parent answered on a
   child's behalf rather than the student answering themselves*". No new
   disclosure is needed, and item 25 puts it outside the security threat model.
3. **The consequence is executed, not inferred.** On a scratch cluster carrying
   these migrations, the fixture student's `v_planned_rsvp_hours` moved
   `declined → 0 rows / 0 h` and `going → 1 row / 2.0 h`, with the downstream
   chain confirmed at `dashboard_views.sql:333` and
   `loaders/dashboard.ts:256-257`.

**RLS is proven executably, on PostgreSQL 16.14 with these migrations applied,
as role `authenticated` with `request.jwt.claim.sub` set per identity, using
statements byte-equivalent to `makeSubmitRsvpChange`'s (`outreach.ts:1224-1233`):**

```
PASS A student self INSERT leg          rows=1  responded_by = own profiles.id
PASS B student self CONFLICT/UPDATE leg rows=1  status=declined
PASS C studentId as respondedBy         DENIED  sqlstate=42501, no row written
PASS D parent on behalf, insert         rows=1  responded_by = parent
PASS E parent overwrites child's row    rows=1  responded_by = parent
PASS F unlinked child                   DENIED  sqlstate=42501
```

Leg B is the **dominant repeat case** and revision 1 never mentioned it: a
student changing an existing answer takes the `on conflict do update` path and
`own_or_linked_update`, not the insert policy.

**Two identity facts that decide the whole task:**

1. `useAuth().user.id` **is** `session.user.id` (`guards.tsx:205`), which is
   `auth.uid()`, which is `profiles.id`. It is the correct `respondedBy`.
2. `studentId` on both surfaces is a `students` row id. Passing it as
   `respondedBy` is **denied** (`42501`, PASS C above), not saved wrong. This
   is T174's exact defect and `OutreachList.tsx:3941` carries a comment naming
   it.

## What to do

Copy T193's shape (`OutreachList.tsx:3916-3951`). Do not invent a second one.

### 1. `src/pages/home/StudentHome.tsx`

**a. New injectable seam.** Add `onRsvpChange?: SubmitRsvpChangeFn` to
`StudentHomeProps` (`:1822-1847`), defaulting in the `StudentHome` signature
(`:1849-1857`) to the real `submitRsvpChange` imported from
`../../lib/supabase/loaders/outreach`. Same posture as `submitCheckinCode`
directly above it.

**b. Thread the responder.** `viewer.id` is already in scope at `:1718` and
passed at `:1900`. Add `viewerProfileId: string` to `StudentHomeContentProps`
(`:1339-1362`) and forward it — plus `onRsvpChange` — through
`ResolvedStudentHomeViewProps` (`:1673-1684`) and the render site (`:1783`).
Nothing new is resolved; one field is forwarded.

**c. Rewrite `handleRsvpChange` (`:1442-1445`)** as T193's async handler:
in-flight guard → snapshot the **whole `rsvps` array** → optimistic
`withLocalRsvpOverride` → `await onRsvpChange({ sessionId, studentId, status,
respondedBy: viewerProfileId })` → on rejection restore the snapshot array and
set an error message. A `Promise<void>` handler assigns cleanly to the existing
`=> void` prop types (`:1236`, `:1261`) — the gate compiled this.

**Snapshot the array, not a previous status.** `withLocalRsvpOverride`
(`:903`) takes a concrete `RsvpStatus` and **appends** a row when none exists
(`:907-918`), so it cannot express "back to unanswered." A scalar
`previousStatus` would be `undefined` in the dominant case — a student
answering for the first time — and restoring it would leave a stuck phantom
RSVP row, which is worse than today's bug. `OutreachList.tsx:3920-3929`
documents this reasoning; do not re-derive it.

**Keep the component-wide in-flight flag** even though (d) adds a per-button
one. It is what makes the snapshot-array rollback concurrency-safe
(`OutreachList.tsx:3885-3889` states this): the two sections share one handler,
so without it a click on a second row could snapshot an array already mutated
by a first in-flight write.

**d. Pending affordance — decided, and rewritten in revision 3 because round 2
proved revision 2's version could not work.**

**Do NOT use `clickAction`.** Revision 2 prescribed swapping the two `Button`s
to Astryx's `clickAction`; round 2 executed that prescription and found it
breaks two things silently. `Button.tsx:601-610` (`@astryxdesign/core@0.1.6`)
runs `clickAction` inside `startTransition(async () => …)`, and under React 19
Action semantics **every `setState` inside that action is deferred until the
action settles** — so the optimistic `setRsvps(...)` never paints during the
flight, and `setIsRsvpSubmitting(true)` is invisible to its own handler, leaving
the cross-row concurrency guard inert (measured: two concurrent writes, not one
swallowed click). Full evidence in `GAM-304-premise-gate-round2.md`. This note
stays in the packet so the mechanism is not rediscovered the hard way.

**Use plain `onClick` and drive the affordance from state you already have**
(round 2's measured cheaper path 1). This also keeps §'s "copy T193's shape"
promise literally true — T193 ships a plain handler with an ordinary state flag
(`OutreachList.tsx:3930-3951`). Two documented Astryx props, no escalation, no
custom CSS:

- On the two `Button`s in `SignupOpportunityRowItem` (`:1267-1276`), pass
  **`isLoading`** (`astryx-api.md:1818` — "*Shows a loading spinner and disables
  interaction. Announces "Loading" via a live region*") driven by
  `isRsvpSubmitting && pendingSessionId === row.sessionId`, and **`isDisabled`**
  (`:1820`) driven by `isRsvpSubmitting` alone. The clicked button spins; every
  other control disables. Track `pendingSessionId` alongside the existing
  in-flight flag.
- On `NextUpRowItem` (`:1231`), the control is **not a `Button`** — it is a
  `MoreMenu` over `DropdownMenuOption[]` (`:1242-1249`). Disable it with
  **`MoreMenu.isDisabled`** (`astryx-api.md:4822`) or per-entry
  **`DropdownMenuOption.isDisabled`** (`:1884`). Revision 2 mis-cited
  `Button.isDisabled` (`:1820`) here; that prop is real but belongs to the other
  row component.

Measured working under `onClick`: optimistic `status=going` during flight,
`siblingDisabledDuringFlight=true`, correct rollback and error copy on reject.

**NIT from round 2, worth doing while you are here:** widen the row prop types
`onCantGo` (`:1236`) and `onRespond` (`:1261`) from `=> void` to
`=> void | Promise<void>`. Nothing depends on it under `onClick`, but the
current typing makes any future async wiring work only by a type-erased
accident.

**e. Error surface.** Render an error `Banner` when a write is rejected, in the
`VStack` at `:1448`, above the sections that own the controls. Match
`OutreachList.tsx:3972-3980`'s shape and its copy — `'Something went wrong
saving your RSVP.'` for a non-`Error` rejection.

**The copy is deliberately row-agnostic, and that is the decision** (revision
1's doubt 4, which the gate graded MINOR and left to the author): both control
sites funnel into one handler (`:1519`, `:1545`), so a page-level banner cannot
name the failing row. It does not need to — the rollback visibly restores the
exact row the student just clicked, and T193 shipped page-level copy against
multiple rows. Inventing per-row wording on two more surfaces would fragment
the phrasing for one fact, against DES-14/16. Do not interpolate a session
title.

**f. Fix module doc #7 (`:206-209`).** It currently states "no Supabase write
happens / anywhere in this file" (the sentence wraps across `:207-208`). After
this change that is false. Rewrite it to say what now happens and cite
`submitRsvpChange`. A doc left asserting the old premise is the
documentation-trap class that cost T176 a full round.

### 2. `src/pages/home/ParentHome.tsx`

Same moves, with the parent-on-behalf differences:

- `onRsvpChange?: SubmitRsvpChangeFn` on `ParentHomeProps` (`:1346-1353`),
  defaulting to `submitRsvpChange` in the signature (`:1359-1362`).
- `user` is destructured at `:1363` and the `user === null` early return at
  `:1366` guarantees it is non-null at the `:1434` render site. Pass `user.id`
  into `StudentHomeCard` there as a new `viewerProfileId: string` prop on
  `StudentHomeCardProps` (`:1169-1186`), with `onRsvpChange`. No non-null
  assertion is needed.
- Rewrite `handleRsvpChange` (`:1255-1257`) the same way. `applyRsvpOverride`
  (`:939`) has the same append-when-absent behaviour (`:946-959`), so the array
  snapshot rule is identical.
- `studentId` stays the **card's** student (the child being answered for);
  `respondedBy` is the **parent's** `user.id`. PASS D/E above prove RLS permits
  this, including overwriting a row the student wrote themselves.
- **Per-card in-flight and error state. Do not hoist a shared flag to
  `ParentHome`** — a parent with three children must be able to answer for one
  while another card's write is in flight, and the gate proved no two cards can
  collide on the same `(session_id, student_id)`.
- Pending affordance: the card's control is a `SegmentedControl` (`:1147`), so
  use **`isDisabled`** plus **`disabledMessage`** (`astryx-api.md:5614-5615`)
  while that card's write is in flight. `disabledMessage` is required with
  `isDisabled` here because a bare disabled `SegmentedControl` swallows the
  hover events a tooltip would need, and the prop exists precisely for that.
- Error `Banner` at **card** level, not page level. The asymmetry with
  `StudentHome` is deliberate: a page-level banner here could not say *which
  child's* answer failed, which is a materially worse ambiguity than not naming
  a row.
- **Its deferral note has expired** (`:194-196`): it defers the write to
  "`ParentRsvp.tsx`/T043, currently Blocked, a Forbidden File never imported
  here." T043 passed (`task-ledger.md:97`) and `ParentRsvp` is rendered at
  `OutreachDetail.tsx:2363`. Rewrite that paragraph; do not leave it standing.

### 3. Tests — and read this section before you touch either test file

Both harnesses render under `LoginAs user={...}`, so the signed-in id is real
and assertable, and it is **already distinct** from the fixture student id:
`STUDENT_USER.id = 'user-student'` (`StudentHome.test.tsx:83-87`) against the
harness's resolved `student-fixture-harness-default` (`:99`);
`PARENT_USER.id = 'user-parent'` (`ParentHome.test.tsx:56`) against fixture
children. Criterion 2's inequality is measurable with today's fixtures.

**Two pre-existing tests are affected. Both remedies are pre-authorized here,
with their precedents — you do not need to stop and ask.**

**(i) `StudentHome.test.tsx:1106` will go RED and this fixes it.** That test
injects no `onRsvpChange`, so after §1a the click reaches the real module
default, `getSupabaseClient()` throws `SupabaseNotConfiguredError`
(`lib/supabase/client.ts:101-103`), the rollback restores the array and the
opportunity reappears. The gate measured it: `1 failed | 2155 passed`, exit 1,
against a `2156 passed` baseline.

**Remedy — add `onRsvpChange: async () => {}` to `renderAsUser`'s
`mergedProps`, on the line immediately after `loadData:
defaultLoadStudentHomeData,` (which is `:142`), i.e. BEFORE `...props,` (which
is `:143`).** This is a *harness default*, not an edit to any `it(` body, and it
is exactly the mechanism T183 already established for `loadData` at
`:132-141` — read that comment and follow it. The gate measured the remedy
restoring `src/pages/home/` to 219/219, exit 0.

**Revision 3 correction, and this one has teeth:** revision 2 said "immediately
after `:143`", which is *after* the `...props,` spread. Placing the default
there would override every per-test `onRsvpChange` spy and silently break the
new payload tests below. The file's own comment at `:141` states the rule — "An
individual test's own `props.loadData` (spread after, below) always wins."
**The default must go above the spread, not below it.**

**(ii) `ParentHome.test.tsx:1175` would stay green for the wrong reason.** It
asserts `aria-checked` immediately after a synchronous `act(() => click)` with
no flush (`:1188-1197`), so after this change it passes only by racing the
rejection. The gate proved it: adding one `await flushMicrotasks()` turns it
red (`1 failed | 47 passed`).

**Remedy — inject a *resolving* spy for that test and add `await
flushMicrotasks()` after the click.** T193 hit this identical trap and its
remedy is at `OutreachList.test.tsx:1885-1890`; the ruling is recorded at
`task-ledger.md:246`: *"one test passed only by racing the rejection … count-delta
pinning answers 'did anything break', not 'is anything passing for the wrong
reason'."*

**(iii) Rename two `describe` titles** that encode the retired premise:
`StudentHome.test.tsx:1105` ("real local-state update, not persisted") and
`ParentHome.test.tsx:1138` ("OUT-06 preview, real local state").

**No other existing test may change.** If you believe one must, stop and say
so — that needs the owner's approval under the Non-Negotiables.

**New tests to add.** Inject `onRsvpChange` as a spy and assert the **payload**,
not merely that it fired:

- Student sign-up calls the seam once with `respondedBy` equal to the logged-in
  user's id and `studentId` equal to the student row id, **and asserts those two
  are different values.** That inequality is the whole defect class; an
  assertion that only checks `respondedBy` is truthy would pass with T174's bug.
- A rejecting seam rolls the control back to its pre-click state **and** renders
  the error text. Flush before asserting (see (ii)).
- The parent card passes the child's `studentId` with the parent's id as
  `respondedBy`.
- **One test that renders with NO `onRsvpChange` prop**, clicks "Sign up",
  flushes, and asserts the error `Banner` carries `SupabaseNotConfiguredError`'s
  copy. This is the only assertion available that proves the *real module
  default* is wired to the real client path rather than a fixture (item 27), now
  that the harness injects a fake everywhere else.

  **How it gets "no prop", since (i) just made the harness inject one:** call
  `renderAsUser(STUDENT_USER, { onRsvpChange: undefined })`. A JS default
  parameter fires on `undefined`, so the real `submitRsvpChange` is restored for
  that one test. (Rendering `<StudentHome />` outside `renderAsUser` also works
  but loses the `LoginAs` wrapper, so prefer the first.) The copy to match is
  `client.ts:32-34` — "*Supabase isn't configured yet. Set VITE_SUPABASE_URL …*"
  — which reaches the banner because `makeSubmitRsvpChange`'s returned function
  is `async` (`outreach.ts:1236-1238`), so `getSupabaseClient()`'s synchronous
  throw (`client.ts:101-103`) surfaces as a rejection your `catch` turns into
  `error.message`. Round 2 graded this a fair item-27 check rather than a
  tautology, and noted `vite.config.ts:16-24` records seven existing tests of
  the same shape.

**Do not rebuild loader-level assertions.** `RsvpControl.test.tsx:477-519`
already tests `makeSubmitRsvpChange` for `responded_by` verbatim, for
`onConflict: 'session_id,student_id'`, and for a `42501` rejection. Duplicating
that here is wasted work.

## Allowed files — nothing else

```
src/pages/home/StudentHome.tsx
src/pages/home/StudentHome.test.tsx
src/pages/home/ParentHome.tsx
src/pages/home/ParentHome.test.tsx
```

**Explicitly forbidden**, each for its own reason:

- `src/lib/supabase/loaders/outreach.ts` — `makeSubmitRsvpChange` already does
  exactly what is needed and has three callers (`RsvpControl.tsx:462`,
  `ParentRsvp.tsx:506`, `OutreachList.tsx:4437`). Changing it would put shipped
  surfaces at risk for no gain. If you believe it must change, that is a
  dispute, not an edit.
- `supabase/migrations/**` — no schema change is needed and editing an applied
  migration is a BLOCKER (item 10).
- `src/pages/outreach/**` — `RsvpControl.tsx`, `ParentRsvp.tsx` and
  `OutreachList.tsx` are the working precedent. Read them; do not touch them.
- `docs/swarm/**`, `.claude/**` — orchestrator-owned.

## Acceptance criteria — each names a mutation that must turn it red

Item 27 applies: criterion 1 names the **real source the surface writes to**,
so the check follows the data instead of watching a button flip.

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | With no injected seam, a sign-up reaches the **real** `submitRsvpChange` and its failure surfaces | Point the default at a local no-op → the `SupabaseNotConfiguredError`-copy assertion FAILS |
| 2 | `respondedBy` is the auth/profile id, and provably **not** `studentId` | Pass `studentId` as `respondedBy` (T174's defect, DB-proven `42501`) → the inequality assertion FAILS |
| 3 | A rejected write rolls the control back to its exact pre-click state | Delete `setRsvps(previousRsvps)` → the post-rejection state assertion FAILS |
| 4 | A rejected write says so on screen | Delete the error `Banner` → the error-text assertion FAILS |
| 5 | The parent card writes for the child with the parent as responder | Swap `respondedBy` to the child's `studentId` → the parent payload assertion FAILS |
| 6 | Neither module doc still claims the file never writes | Restore the deleted sentence → a grep for `no Supabase write happens` (`StudentHome.tsx:207`, wrapping to `:208`) and `no Supabase write/persistence` (`ParentHome.tsx:196`) MATCHES and the criterion fails |
| 7 | During an in-flight write: the **clicked** button shows `isLoading`, **and** a **different** row's control is `isDisabled` — both asserted, and both named here so the checker measures the same thing the packet argues for | Remove the `isDisabled` threading → the *sibling-row* assertion FAILS (this is the half revision 2 could not make passable at all) |

Criterion 6 is inverted from revision 1, which the gate proved was **already
green on unfixed code** because it quoted a string that appears nowhere: grep
the real strings above, and the mutation is *restoring* the sentence.

**A criterion whose mutation leaves the suite green is not evidence — report
that instead of shipping it.** Run every mutation in your own worktree, commit
before mutating, and paste the real red output with exit codes (item 23, and
item 26's working rule about `git checkout --` reverting your own uncommitted
fix).

## Six gates — assert exit codes directly, not through a pipe

```
npx tsc --noEmit ; echo $?
npx vite build ; echo $?
npm run format:check ; echo $?
npx eslint . ; echo $?
npx vitest run ; echo $?
npx vitest run src/pages/home/ ; echo $?
```

Baseline measured by the gate at this branch point: full suite **83 files /
2156 tests**, exit 0; `src/pages/home/` **219 tests**, exit 0; eslint 0 errors.

**A green count delta is not sufficiency.** Revision 1's rule — "the count goes
up and nothing goes red" — is exactly the count-delta pinning
`task-ledger.md:246` names as inadequate, and finding (ii) above is a live
example: a test can stay green by racing a rejection. **The standard is: every
pre-existing RSVP-interaction test must still assert a state the app actually
holds after the write settles.** Name the RSVP-interaction tests you checked
against that standard, not just the totals.

## Least confident decisions (item 19d) — attack these first

**Revision 2's four are all resolved, two of them by being proven wrong** —
which is the mechanism working exactly as item 19d intends. Round 2 measured
doubt 1 (`clickAction` composes with the in-flight guard) and doubt 2 (sibling
`isDisabled` is worth the props) as **WRONG**, and worse than their authors'
own falsifying conditions: the guard is not merely noisy, it is inert. §1d is
rewritten accordingly. Doubt 3 (the no-prop item-27 test) and doubt 4
(asymmetric banner placement) were both graded **SOUND** and stand as decisions.

Revision 1's five were resolved in revision 2 and remain so.

**These three are revision 3's own, and no gate round remains to attack them —
which is the substance of what the owner is being asked to accept:**

1. **That `isLoading` + `isDisabled` under plain `onClick` really does deliver
   the affordance, on the actual components rather than round 2's probe rig.**
   Round 2 measured `siblingDisabledDuringFlight=true` and an optimistic
   `status=going` during flight, but it measured that on a purpose-built probe,
   not on `SignupOpportunityRowItem` and `NextUpRowItem` as they are written.
   Wrong if something in the real row components — `ListItem`'s `endContent`
   slot, or `MoreMenu`'s trigger — swallows or overrides either prop.
2. **That `MoreMenu.isDisabled` is the right lever for the Next-up row rather
   than per-entry `DropdownMenuOption.isDisabled`.** I chose the menu-level prop
   because it matches "every other control disables," but the doc line
   (`astryx-api.md:4822`, "*Whether the menu trigger is disabled*") describes
   disabling the **trigger**, which may read to a user as the whole row going
   dead rather than one action being unavailable. Wrong if disabling the trigger
   hides the "Going" badge affordance context or traps focus; the per-entry prop
   would then be correct and is a one-line change.
3. **That criterion 7's sibling-row assertion is actually writable against these
   fixtures.** It now asserts that clicking row A disables row B's control. That
   requires the default fixture to render **at least two** rows across the
   Next-up and Sign-up sections simultaneously. I have not confirmed the default
   `buildDataFixture` does so on a single render. Wrong if it does not — in which
   case the criterion needs a fixture with two rows, and adding one is a test
   change the packet has not pre-authorized.

## Rules

Item 22 — named pathspecs only, never `git add -A` / `git add .`. Item 23 —
mutate only in your own worktree. Item 21 — your report states the commit SHA;
the orchestrator verifies HEAD moved and the change is in the committed blob.
You do **not** self-certify. If this packet is wrong, impossible, or asks for
something the code contradicts, **say so** rather than quietly picking a side.
