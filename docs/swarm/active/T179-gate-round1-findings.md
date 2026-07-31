# T179 — premise gate round 1 (actionable findings, verbatim where it matters)

**Gate:** general-purpose agent with Write+Edit, 2026-07-31, measured at `38def67` in an
isolated worktree (constitution item 23). **Shared tree never modified** — `git status` clean,
HEAD unmoved, stash list unchanged.
**Verdict:** REVISE — 1 BLOCKER, 4 MAJOR, 6 MINOR. **Round 2 of 2 remains available** (item 19a).

It built the full prescribed design — Part A on both dialogs, Part B's per-session trigger +
single dialog instance + composed `onMarkComplete` — wrote A1–A4/B1–B7, ran **13 mutations**,
and reverted. **Every mutation the packet names goes red except where noted below.** Gates on
the finished reference tree: `tsc --noEmit` exit 0 · `vite build` ✓ · `prettier --check` clean ·
`eslint` 0 errors / **359** warnings (base 358, **+1** — see MINOR 8) · `vitest` **70 files /
1681 tests**, base 70/1668, **+13**, zero pre-existing failures.

Recorded here so revision 2 is not written from a summary.

---

## BLOCKER 1 — the prescribed `void reloadDetail()` makes the suite exit 1, and B6 is the test that triggers it

Trap 6 prescribes, verbatim:

```tsx
onMarkComplete={async (payload) => {
  await markDayComplete(payload);
  void reloadDetail();
}}
```

and says *"`void` on the reload so a **refetch* failure cannot masquerade as a *write* failure"*.
`void` does not do that. It discards the promise **value**; the **rejection** is still unhandled.
`reloadDetail` is `await loadData(eventId); setData(fresh)` (`OutreachDetail.tsx:1535-1538`) — it
rejects whenever the refetch rejects, which is exactly the condition B6 tells the worker to
construct.

Measured, with the packet's shape and B6's own rejecting-reload test, **all 86 tests in the file
passing**:

```
 Test Files  1 passed (1)
      Tests  86 passed (86)
     Errors  1 error

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: refetch exploded
 ❯ loadData src/pages/outreach/OutreachDetail.test.tsx:2760:29
 ❯ reloadDetail src/pages/outreach/OutreachDetail.tsx:1536:25
 ❯ onMarkComplete src/pages/outreach/OutreachDetail.tsx:1960:18
 ❯ handleSubmit src/pages/outreach/MarkDayCompleteDialog.tsx:653:7
```

```
$ npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null; echo $?
1
```

**Green tests, red suite.** Vitest also warns *"This might cause false positive tests."*

The one-character fix, measured:

```tsx
await markDayComplete(payload);
reloadDetail().catch(() => {});   //  ->  Tests 86 passed, exit 0, no Errors line
```

```
 Test Files  1 passed (1)
      Tests  86 passed (86)
exit=0
```

Two consequences for revision 2:

1. **Prescribe `.catch()` (or a try/catch), not `void`.** The *intent* Trap 6 states is right and
   worth keeping — the write already committed, so a refetch failure must not be reported as a
   write failure. `void` is simply the wrong mechanism for it.
2. **`OutreachDetail.tsx:1907-1909` has the identical defect today**, in the
   `MarkEventCompleteDialog` mount the packet points at as the pattern to mirror. It does not
   fire in the current suite only because no existing test rejects the reload. Either fold it in
   (it is inside an Allowed file) or file it — item 20.

---

## MAJOR 2 — B1 mandates three buttons with one accessible name; item 15

Part B puts the trigger inside `orderedSessions.map(...)`, so a multi-day event renders N of
them. B1 requires *"a control named **"Mark day complete"** is present"*. Following that
literally, measured on a three-session fixture:

```
GATE-PROBE accessible names: ["Mark day complete","Mark day complete","Mark day complete"]
GATE-PROBE distinct count: 1 of 3
```

Three tab stops, one accessible name, nothing distinguishing them. This is **the same defect this
file's own module doc #13(f) (`:402-412`) already identifies and solves** for `ParentRsvp`:

> *"two linked students in one session render two `[role="radiogroup"]` elements with
> byte-identical accessible names, indistinguishable to a screen reader user and to a test
> locator alike … Dropping the date would leave a two-session single-student event with two
> identical headings — the same defect one level up."*

The packet cites that module doc twice for other reasons and never applies it here. Worse, B1's
wording actively pushes toward the broken shape: a worker who disambiguates the label breaks a
test that matches `textContent === 'Mark day complete'`.

**A fix exists entirely inside documented Astryx props** (item 2). `astryx-api.md:1810` (Button
props): *"`children` … Optional override for visible text. When provided, displayed instead of
label, but **label is still required (it provides the accessible name)**."* Measured:

```tsx
<Button
  label={`Mark day complete — ${formatSessionDateOnly(session)}`}
  variant="secondary"
  onClick={() => setMarkDayCompleteSessionId(session.id)}
>
  Mark day complete
</Button>
```

```
GATE-PROBE2 aria-labels: ["Mark day complete — Mon, Jun 1","Mark day complete — Mon, Jun 8","Mark day complete — Mon, Jun 15"]
GATE-PROBE2 visible text: ["Mark day complete","Mark day complete","Mark day complete"]
```

`formatSessionDateOnly` is already exported from `OutreachDetail.tsx` and already used for exactly
this purpose at `:1828`. `tsc` clean, no new eslint.

**B1 must then locate by `aria-label` or `startsWith`, not exact `textContent`.**

---

## MAJOR 3 — Trap 1's central TypeScript claim is false, measured

Trap 1 states, as fact:

> *"`isStaffViewer` is a plain `boolean`, **not** a type predicate, so it does not narrow `user`
> and will not satisfy the compiler on its own; `OutreachDetail.tsx:1812-1818` documents exactly
> this and calls the extra check 'LOAD-BEARING, not redundant.'"*

Measured on the reference tree: replacing `{user !== null && markDayCompleteSession !== null && (`
with `{isStaffViewer && markDayCompleteSession !== null && (`, keeping
`currentUserProfileId={user.id}` inside:

```
--- tsc ---
tsc exit=0
```

And, going further, deleting **all three** of the existing "LOAD-BEARING" `user !== null` checks
(the `isParentViewer` gate at `:1818-1819`, the `isStudentViewer` gate at `:1862`, and the
`isStaffViewer` `AttendancePanel` gate at `:1886`) at once:

```
parent changed: True student changed: True staff changed: True
tsc exit=0 (0 == the three 'LOAD-BEARING' null checks are NOT required by the compiler)
```

TypeScript 4.4+ narrows through **aliased conditions**: `const isStaffViewer = user !== null &&
(...)` narrows `user` at every use of `isStaffViewer`, because `user` is a `const` destructured
binding (`const { user } = useAuth();`, `:1380`).

The **prescribed code is still fine** — an explicit null check is defensive and matches the file's
convention. What is wrong is the stated mechanism, and the packet instructs the worker to write a
new module doc section citing it. That reproduces T176/T181's failure shape: a false claim
propagated into source because a packet asserted it as measured.

Revision 2 should either drop the compiler claim or restate it honestly ("explicit, matching the
file's three existing gates; not required by the compiler"). The three existing source comments
are a separate pre-existing defect — file it under item 20, do not widen scope here.

---

## MAJOR 4 — B4 has no mutation, and its absence half cannot be made red

B4 is the only Part-B criterion with **no `Mutation:` line**, and there is no mutation available.
After Part A deletes `DEFAULT_ROSTER` and makes `roster` required, the only way `Amara Chen` /
`Marcus Bello` / `Nina Ortiz` / `Sofia Delgado` can reach that dialog is if the page passes them.
There is no fixture branch left to break. The absence half tests the *test fixture*, not the
implementation.

It is also the shape (a) the constitution's own record keeps hitting. Measured, absence-only,
against a page whose load rejected:

```
GATE-PROBE B4 dialog found? false
GATE-PROBE B4 page text: Couldn't load this eventSomething went wrong loading this outreach event. Try refreshing t
GATE-PROBE B4 absence-only assertions: PASSED against an error state
```

B4's paired positive ("the checklist shows the page's roster student names") does catch that, so
B4 is not fully vacuous — but as written it has no way to detect a wiring regression that its
positive half doesn't already cover. **Fold B4's positive into B3 or B5 and delete the absence
list**, or give it a mutation that exists (e.g. pass `students` instead of `roster` at the call
site, which is a real, plausible worker error and is observable).

### 4b — the collision B4 depends on is undisclosed, and it is total

The packet's whole mitigation is one clause: *"Use page fixture names that do **not** overlap that
set."* It never says why. The reason is that `OutreachDetail.tsx:683-714`'s own
`FIXTURE_STUDENTS`, reached by `defaultLoadOutreachDetail` — the loader **every existing test in
`OutreachDetail.test.tsx` uses** — contains those four names **verbatim**. Measured:

```
GATE-PROBE default-fixture triggers: 1
GATE-PROBE default-fixture dialog contains the 4 DEFAULT_ROSTER names: [ true, true, true, true ]
```

A worker who takes the path of least resistance gets a red B4 whose message says the wiring
leaked fixtures, when in fact the wiring is correct. Say this in the packet.

---

## MAJOR 5 — the packet attributes to OUT-05 a rule OUT-05 does not state, and cites the wrong line

Trap 7:

> *"PRD OUT-05 (line 296): **"on/after a session date, Mark day complete opens a `Dialog`."** So
> the trigger renders only when **both** `session.status === 'scheduled'` **and** the session has
> started."*

Two problems, both verified:

1. **Line 296 is not OUT-05.** `docs/swarm/VOLT_Portal_PRD.md:296` is
   `- **MTG-03** Meetings do not use RSVP…`. **OUT-05 is at line 318.** (The stale `:296` is
   inherited from `MarkDayCompleteDialog.tsx`'s own module doc, which carries the same error.)
2. **The quote does not support the prescription.** OUT-05 says *"on/after a session **date**"*.
   `event_sessions.session_date` is a `date`; `starts_at` is a `timestamptz`. B2 pins the gate to
   `startsAt`, so a coach on the session's own morning — 8 AM for a 9 AM session — sees no
   trigger, which "on/after a session date" plainly permits. Constitution item 1: PRD > packet.

The `startsAt` reading may well be the better product decision, but it is a **narrowing of a PRD
requirement** and must be argued as one, not presented as a quotation. Decide it, state which of
`sessionDate` / `startsAt` the gate uses and why, and make B2 assert that choice.

---

## MINORs

- **6 — B3's stated justification is false.** *"A two-session fixture can pass this by luck; use
  three."* Measured, two-session fixture, same `orderedSessions[0]` mutation the packet names:
  ```
  × TWO-SESSION VARIANT: activating the SECOND trigger opens the dialog for the SECOND session
  AssertionError: expected 'Mark day completeRiverside Trail Buil…' to contain 'Jun 8'
  ```
  It goes red. Three sessions is still worth requiring — it also catches last-element and
  off-by-one resolutions — but say *that*, because the stated reason is wrong and a worker who
  checks it will stop trusting the rest.

- **7 — `<dialog>` locator hazard, undisclosed, and it bit this gate.** The page now mounts
  **four** `<dialog>` elements (`MarkEventCompleteDialog`, `MarkDayCompleteDialog`,
  `OutreachEventDialog`, `AlertDialog`), all present in the DOM whether open or not.
  `container.querySelector('dialog')` returns the **first**, which is the wrong one:
  ```
  AssertionError: expected 'Mark event completeRiverside Trail Bu…' to contain 'Wren Quill'
  Received: "Mark event completeRiverside Trail BuildClose…Mark 3 sessions complete"
  ```
  Note what would have happened with an absence-only B4: it would have **passed** against that
  wrong element. Prescribe scoping by `Array.from(container.querySelectorAll('dialog')).find(d =>
  d.textContent?.trim().startsWith('Mark day complete'))`.

- **8 — the eslint gate as written fails a defensible implementation.** "warnings **must not
  increase** (base: 358)" — base confirmed 358. Exporting the eligibility predicate from
  `OutreachDetail.tsx` (matching the file's own convention: `sortSessionsByStart`,
  `groupSessionSignups`, `resolveOwnRosterStudent` are all exported) costs **+1**
  `react-refresh/only-export-components`; per-file measurement, base → after:
  `OutreachDetail.tsx: base=17 after=18`, every other touched file unchanged. Deleting
  `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` recovers nothing
  (`MarkDayCompleteDialog.tsx: base=8 after=8`). **Decide whether the predicate is exported and
  state the expected delta (0 if inlined, +1 if exported).**

- **9 — A3's `git grep -c` assertion cannot produce the output it names.** *"returns **0** for
  both"* — `git grep -c` prints nothing for a file with no matches and exits 1. Measured:
  ```
  $ git grep -c PLACEHOLDER_CURRENT_COACH_PROFILE_ID -- .../MarkDayCompleteDialog.tsx .../MarkEventCompleteDialog.tsx
  grep2 exit=1 (no output = no matches)
  ```
  Also: A3's count-zero requirement forces deleting the **prose** mention at
  `MarkDayCompleteDialog.tsx:271` as well as the export. The build plan never says so. Say it.

- **10 — module-doc citations are off, and one is misattributed.** The `:22-27` paragraph is
  actually at **`:19-25`** (quote itself accurate). *"section #7's 'standalone-render defaults'
  posture"* — that phrase is not in section #7 (`:255-283`); it is a **code comment at `:434`**
  above the fixture block. Section #7's actual wording is *"defaulting to a disclosed,
  obviously-fake placeholder"*. Also unflagged: the same paragraph calls the page's action
  *"currently-stubbed"*, and **no such stub exists** — `grep "Mark day complete"
  src/pages/outreach/OutreachDetail.tsx` returns nothing at base. Finally, `MarkDayCompleteDialog
  .tsx:438-470` covers only part of the four consts; `DEFAULT_RSVPS` ends at **`:491`**.

- **11 — two prescriptions are ambiguous enough to force a guess.**
  (a) **B5, "Stub `onMarkComplete`"** — there is no `onMarkComplete` override prop on
  `OutreachDetail`, by the packet's own Trap 6 design. The only seam is the existing
  `vi.mock('../../lib/supabase/loaders/outreach')` / `mockedMarkDayComplete`. Say that.
  (b) **A4, "hardcode `recordedBy` in the payload builder"** — two readings. Hardcoding the
  top-level `payload.recordedBy` in `handleSubmit` reddens the rewritten `:476` assertion
  (`expected 'profile-someone-else' to be 'profile-coach-quill-7f3a'`); hardcoding it inside
  `buildAttendanceWriteRows` reddens a *different, pre-existing* test
  (`expected 'profile-someone-else' to be 'profile-x'`) and leaves `:476` green. Name the one you
  mean — the first.
  (c) **B6 needs two tests, not one.** The packet names a mutation only for the `void` half. The
  `await` half needs its own: `await markDayComplete(payload)` → `void markDayComplete(payload)`
  reddens *"a REJECTING write surfaces the dialog error banner"*
  (`expected '…' to contain "Couldn't mark this day complete"`).

---

## What held up — do not re-litigate

- **The blast-radius table is exact.** Re-measured independently, both rows:
  ```
  Part A, MarkDayCompleteDialog only:      14 errors
       10 src/pages/outreach/MarkDayCompleteDialog.test.tsx
        4 src/pages/outreach/MarkDayCompleteDialog.tsx   (TS6133 on all four consts)
  Part A, both dialogs:                    24 errors
       10 MarkDayCompleteDialog.test.tsx · 4 MarkDayCompleteDialog.tsx
        8 MarkEventCompleteDialog.test.tsx · 1 MarkEventCompleteDialog.tsx (TS6133, the import)
        1 OutreachDetail.tsx(1906,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  ```
  **Zero errors outside the six Allowed files**, exactly as claimed. The 10 `MarkDayCompleteDialog
  .test.tsx` sites are indeed missing only `eventTitle` + `currentUserProfileId`
  (`TS2739: … is missing the following properties …: eventTitle, currentUserProfileId`); the 8
  `MarkEventCompleteDialog.test.tsx` sites are missing only `currentUserProfileId` (`TS2741`).

- **The baseline is exactly as stated.** `tsc` exit 0; `70 passed (70)` files / `1668 passed
  (1668)` tests; `358 problems (0 errors, 358 warnings)`. No drift between `c7098e0` and
  `38def67`.

- **Trap 3 is right on every count.** Nothing outside `MarkDayCompleteDialog.tsx` references the
  four consts (`SelfCheckoffDialog.tsx:286`'s `DEFAULT_SESSIONS` is an unrelated, separate name).
  The `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` export is referenced only by
  `MarkDayCompleteDialog.test.tsx:34,:476`. `OutreachEventDialog.tsx:619` really is an
  **independent declaration** (`export const PLACEHOLDER_CURRENT_COACH_PROFILE_ID =
  'profile-placeholder-current-coach';`) and its test imports from `'./OutreachEventDialog'`, so
  deleting the other export breaks nothing — `tsc` exit 0 confirms it. T300 is correctly reserved.

- **Trap 8 is right: no reshaping is needed and none was introduced.** The page's
  `OutreachDetailSession` (`:619-628`) is field-for-field the dialog's `MarkDayCompleteSession`;
  the page's `RosterStudent` carries an extra `profileId`, which assigns fine as a variable.
  `tsc` exit 0 with all four props passed straight through. B7's grep is stable and honest — note
  it is **not empty at base**, it matches the comment at `OutreachDetail.tsx:331` in both trees,
  which is why B7's "nothing **new** versus the base commit" phrasing is the correct one.

- **B6's core claim is true and this is the packet's strongest criterion.** Verified against
  `MarkDayCompleteDialog.tsx`'s real `handleSubmit` (`await onMarkComplete(payload)` inside
  `try`, `setSubmitError` in `catch`, `:720-748`), not from the packet's description: composing
  the reload into `onMarkComplete` **is** observable through the dialog's error banner, and the
  named mutation goes red:
  ```
  × T179 B6 > a REJECTING reload after a successful write does NOT surface as a write failure
  AssertionError: expected 'Riverside Trail BuildCopy linkActions…' not to contain "Couldn't mark this day complete"
  ```

- **B2's two halves genuinely separate.** Both mutations, run independently:
  ```
  B2(a) drop status half:  × (status half) a completed session shows no trigger …  expected 1 to be +0
  B2(b) drop clock half:   × (clock half) a scheduled session that has NOT started yet shows no trigger …  expected 1 to be +0
  ```
  Each reddens exactly one test and leaves the other green. The packet's insistence on separating
  them is correct and load-bearing.

- **Every other named mutation discriminates.** A1 → `TS2304: Cannot find name 'DEFAULT_SESSION'`
  plus the reintroduced grep line. A2 → `TS2741: Property 'currentUserProfileId' is missing …`.
  A3 greps clean. B1 → the parent/student/signed-out cases all go `expected 3 to be +0`. B3 →
  `expected '…' to contain 'Jun 8'`. B5 → `expected 'profile-placeholder-current-coach' to be
  'profile-coach-1'`.

- **No existing test breaks.** Full suite on the reference tree: `70 passed (70)` / `1681 passed
  (1681)`, +13 all mine. Additionally checked the wall-clock hazard: with the clock half of the
  gate removed — i.e. simulating every existing coach test after 2026-08-02, when
  `FIXTURE_SESSIONS`' dates pass — **only the T179 clock test failed**; zero pre-existing tests
  assert on the new trigger's absence.

- **Trap 1's reachability disclosure is honest.** `currentUserProfileId={user?.id}` at `:1906`
  really is latent, not live-firing: the dialog's only trigger is the `isStaffViewer` `MoreMenu`
  item, and `isStaffViewer` requires `user !== null`. The packet says exactly this and does not
  overclaim. Traps 4 and 5 are also correct — `MarkEventCompleteDialog` takes `sessions` plural
  from `menuItems`, `MarkDayCompleteDialog` takes one `session`, and the single-instance +
  gate-the-whole-element design works (the dialog's own `onOpenChange(false)` on success unmounts
  it and resets state; `useEffect`'s reset-on-open still fires on mount).

- **The `sonnet` tier is defensible** and item 25's second obligation applies. The added gate is
  role-shaped but adds no new authorization concept, the checker is opus, and the real risk in
  this task is the write path, which the checker covers. Note only that the packet's stated reason
  ("verbatim copy of three gates already in the same file") is weaker than claimed — see MAJOR 3 —
  and that the eligibility predicate is genuinely new logic. Tier stands.

---

## Not measured

Real Supabase behaviour of the `markDayComplete` write (no live DB; the loader is mocked in
`OutreachDetail.test.tsx` at module level, as the existing T127 tests already do). Whether
`nowFn` should read `sessionDate` in America/Chicago rather than `startsAt` in UTC — the DST/
timezone consequences of that choice are a product decision, not something this gate can settle
(MAJOR 5). Manual keyboard/screen-reader walkthrough beyond the accessible-name dump in MAJOR 2.

---

## Round-2 checklist

1. Replace `void reloadDetail()` with `reloadDetail().catch(() => {})` in Trap 6, and state that
   `void` leaves the rejection unhandled. Decide whether `OutreachDetail.tsx:1907-1909` is fixed
   in-task or filed (item 20). **BLOCKER 1.**
2. Disambiguate the N per-session triggers via `Button`'s documented `label` + `children` split;
   rewrite B1 to locate by `aria-label`/`startsWith`. **MAJOR 2.**
3. Drop or restate Trap 1's "will not satisfy the compiler" claim — measured false for all three
   existing gates. File the three stale source comments separately. **MAJOR 3.**
4. Give B4 a mutation that exists, or fold its positive into B3/B5 and delete the absence list;
   and disclose that `OutreachDetail.tsx:683-714`'s own fixture carries all four names.
   **MAJOR 4.**
5. Fix the OUT-05 citation to **line 318**, and argue `startsAt`-vs-`sessionDate` as a deliberate
   narrowing of the PRD rather than quoting OUT-05 as if it said so. **MAJOR 5.**
6. Replace B3's "two-session fixture can pass by luck" with the real reason (last-element /
   off-by-one resolutions).
7. Prescribe the `<dialog>` locator explicitly — four dialogs are mounted, `querySelector('dialog')`
   returns the wrong one.
8. Decide whether the eligibility predicate is exported and state the eslint delta (0 or +1).
9. Fix A3's `git grep -c` wording (no output, exit 1 — not "0"), and add the `:271` prose deletion
   to the build plan.
10. Correct the module-doc citations (`:19-25`, not `:22-27`; `:434` code comment, not section #7;
    `DEFAULT_RSVPS` ends `:491`); add `MarkEventCompleteDialog.tsx:262-263`'s now-false
    "same disclosed placeholder" prop doc to step 3; drop the nonexistent "currently-stubbed"
    action claim.
11. Name the B5 stub seam (`mockedMarkDayComplete`), pin A4's mutation to the top-level
    `payload.recordedBy`, and split B6 into two tests (one per half).
