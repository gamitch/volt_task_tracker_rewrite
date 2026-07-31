# T179 — worker packet (revision 2)

**Task:** `MarkDayCompleteDialog` is finished, tested, and mounted nowhere. Harden its
placeholder-defaulted props so a forgetful call site cannot compile, then mount it on
`OutreachDetail.tsx` per-session, staff-only.

**Worker tier:** `sonnet`. **Checker:** `checker-reviewer` (`opus`).

**Revision 2 supersedes revision 1 entirely.** A premise gate built the whole prescribed design
in an isolated worktree and ran 13 mutations
(`docs/swarm/active/T179-gate-round1-findings.md`, measured at `38def67`). It found **1 BLOCKER
and 4 MAJORs**, including a defect in revision 1's own prescribed code. Everything below reflects
those measurements. **Do not work from revision 1.**

**Tier reasoning, restated after the gate corrected it.** Item 18 trigger 4 ("permission logic")
is arguable. Graded non-firing because the role gate adds no new authorization concept — but note
the gate **disproved** revision 1's stated reason for that (see Trap 1), and the eligibility
predicate *is* genuinely new logic. The checker is **opus** because this opens a real
`attendance` write path. Item 25 applies to everything else.

---

## 1. Objective

Two halves, one commit.

**Part A — make the placeholder defaults impossible.** `MarkDayCompleteDialog`'s `eventTitle`,
`session`, `roster`, `rsvps` and `currentUserProfileId` all default to fixtures or a fake
`profiles.id`. Delete the defaults and make the props required, so a call site that forgets one
fails `tsc` instead of silently writing real `attendance` rows for **fixture students**. Same for
`MarkEventCompleteDialog`'s `currentUserProfileId`, which shares the exported placeholder.

**Part B — mount it.** Add a staff-only, per-session **"Mark day complete"** trigger inside
`OutreachDetail.tsx`'s existing Signups loop, driving one dialog instance with the page's real
already-fetched session/roster/rsvps and the real signed-in coach's `profiles.id`.

**Part C — one folded-in fix.** `OutreachDetail.tsx:1907-1909` leaks an unhandled promise
rejection. See Trap 6.

---

## 2. Allowed files

- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.test.tsx`
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`

**Forbidden — everything else**, and specifically:

- `src/pages/outreach/OutreachEventDialog.tsx` — its own independent copy of the placeholder
  (`:619`) and matching `user?.id` call site. **Filed as T300.** Do not fix. The gate confirmed
  deleting `MarkDayCompleteDialog`'s export leaves it compiling: `tsc` exit 0.
- The three stale `"LOAD-BEARING"` source comments at `OutreachDetail.tsx:1812-1818`, `:1850`,
  `:1858-1861`. **Filed as T301.** Do not fix, and do not copy their claim — see Trap 1.
- `src/lib/supabase/loaders/outreach.ts` — `markDayComplete` already exists and is correct (T101).
- `supabase/migrations/**` — no schema change is needed or permitted.
- `docs/swarm/**` — the orchestrator writes the ledger.

---

## 3. Known context and traps

### Trap 1 — the compile error at `OutreachDetail.tsx:1906` is the point; its stated cause was wrong

Making `MarkEventCompleteDialog`'s `currentUserProfileId` required produces:

```
src/pages/outreach/OutreachDetail.tsx(1906,9): error TS2322:
  Type 'string | undefined' is not assignable to type 'string'.
```

That is `currentUserProfileId={user?.id}` on a dialog **already mounted today**. A null `user`
silently substitutes `'profile-placeholder-current-coach'` into `attendance.recorded_by`, a real
FK to `profiles(id)`.

**Fix it with an explicit `user !== null` gate and `user.id`.** Not `?? ''`, not `!`.

**Correction the gate measured, which you must not propagate.** Revision 1 claimed
`isStaffViewer` "is a plain boolean, not a type predicate, so it does not narrow `user` and will
not satisfy the compiler." **That is false.** TypeScript 4.4+ narrows through *aliased
conditions*, and `user` is a `const` destructured binding (`const { user } = useAuth();`,
`:1380`). The gate deleted all three existing "LOAD-BEARING" null checks at once and got
`tsc exit=0`.

So: write the explicit check because it is **defensive and matches the file's three existing
gates**, and say exactly that in any module doc you add. **Do not write that the compiler
requires it.** The three existing source comments making that claim are pre-existing and are
filed as T301 — leave them alone. Propagating a false claim into source is the failure shape that
produced T176's and T181's MAJORs.

**Reachability, stated honestly.** The dialog's only trigger is the staff-only `MoreMenu` item,
which requires `user !== null`, so this cannot be reached signed-out today. **Latent, not
live-firing.** It is worth closing because the required prop makes it *impossible* rather than
*currently unreachable*.

### Trap 2 — the measured blast radius

Measured against a clean tree, then independently re-measured by the gate — **both agree exactly**:

| Change | `tsc` errors | Where |
|---|---:|---|
| Part A, `MarkDayCompleteDialog` only | 14 | 10 in its own test, 4 `TS6133` unused consts |
| Part A, both dialogs | 24 | +8 in `MarkEventCompleteDialog.test.tsx`, +1 unused import, +1 `OutreachDetail.tsx:1906` |

**Zero errors outside the six Allowed files.** The 10 `MarkDayCompleteDialog.test.tsx` sites
already pass `session`/`roster`/`rsvps` — only `eventTitle` and `currentUserProfileId` are
missing (`TS2739`). The 8 `MarkEventCompleteDialog.test.tsx` sites are missing
`currentUserProfileId` only (`TS2741`).

### Trap 3 — the four fixture consts are already dead

`DEFAULT_EVENT_TITLE`, `DEFAULT_SESSION`, `DEFAULT_ROSTER`, `DEFAULT_RSVPS` — spanning
`MarkDayCompleteDialog.tsx:438` through **`:491`** (`DEFAULT_RSVPS` ends at `:491`, not `:470`) —
all go to `TS6133` the moment the defaults are removed. Nothing else in the repo references them
(`SelfCheckoffDialog.tsx:286`'s `DEFAULT_SESSIONS` is an unrelated separate name). Delete all
four, plus the now-unused import at `MarkEventCompleteDialog.tsx:124`.

The **export** of `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` (`:430`) is referenced only by
`MarkDayCompleteDialog.test.tsx:34` and `:476`. Delete it, rewrite that assertion (criterion A4),
**and delete the prose mention at `MarkDayCompleteDialog.tsx:271`** — A3 requires zero
occurrences in the file and the prose counts.

### Trap 4 — per-session dialog, per-event sibling

`MarkEventCompleteDialog` takes `sessions` plural and runs the whole event from `menuItems`.
`MarkDayCompleteDialog` takes **one** `session`, so its trigger goes **inside** the existing loop
at `OutreachDetail.tsx:1806` (`orderedSessions.map(...)`), **never** in `menuItems`.

### Trap 5 — one dialog instance, gate the whole element

Follow the file's own convention: a single instance driven by
`markDayCompleteSessionId: string | null`, resolved to a session by id at render. Not N dialogs
in the loop — that is N mounted subtrees, N duplicated labels, N copies of form state.

Because `session` is now **required**, gate the whole element, not just `isOpen`. The gate
verified this works end to end: the dialog's own `onOpenChange(false)` on success unmounts it and
resets state, and its reset-on-open `useEffect` still fires on mount.

### Trap 6 — `void` does NOT swallow a rejection. Use `.catch()`

**This is revision 1's own defect, measured.** `MarkDayCompleteDialog` has no `onFinished` seam —
it closes itself on success (`:740`) and surfaces failures in its own `Banner` (`:741`) — so the
page refetch must compose into `onMarkComplete`. Revision 1 prescribed `void reloadDetail()` and
claimed it prevents a refetch failure from masquerading as a write failure. **`void` discards the
promise's *value*, not its *rejection*.** With B6's rejecting-reload test the gate measured:

```
 Test Files  1 passed (1)
      Tests  86 passed (86)
     Errors  1 error

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: refetch exploded
```

```
$ npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null; echo $?
1
```

**Green tests, red suite.** Vitest also warns *"This might cause false positive tests."*

**Prescribed shape:**

```tsx
onMarkComplete={async (payload) => {
  await markDayComplete(payload);
  reloadDetail().catch(() => {});
}}
```

The `await` and the `.catch()` are both load-bearing. `await` on the write so a real failure still
rejects and the dialog shows its banner. `.catch()` on the reload so a refetch failure cannot be
reported as a write failure — the write already committed, and telling the coach it failed invites
a duplicate attempt. Measured with `.catch()`: `86 passed`, **exit 0**, no `Errors` line.

**Part C — fix the same defect at `OutreachDetail.tsx:1907-1909`.** The existing
`MarkEventCompleteDialog` mount does `onFinished={() => { void reloadDetail(); }}`. Identical
latent leak; it just has no test that rejects the reload today. It is inside an Allowed file and
it is one line. Change it to `.catch(() => {})` too, and **do not** add a test for it — B6 already
covers the mechanism, and item 25 says not to spend a second test on the same proof.

Check whether `markDayComplete` is already imported in `OutreachDetail.tsx`; add the import only
if not.

### Trap 7 — eligibility: the PRD says *date*, and that is what you gate on

**OUT-05 is at `docs/swarm/VOLT_Portal_PRD.md:318`**, not 296. (Line 296 is MTG-03. The stale
`:296` citation is inherited from `MarkDayCompleteDialog.tsx`'s own module doc, which carries the
same error — leave that file's citation alone, it is out of this task's stated scope.) It reads:

> **OUT-05 Mark day complete (coach):** on/after a session **date**, **Mark day complete** opens
> a `Dialog` …

Revision 1 gated on `startsAt` and presented it as a quotation of OUT-05. It is not — that is a
**narrowing**, and it would hide the trigger from a coach at 8 AM on the session's own morning.
Constitution item 1: the PRD outranks the packet.

**Gate on `sessionDate`, in America/Chicago, by ISO string comparison:**

```ts
export function isSessionMarkDayCompleteEligible(
  session: OutreachDetailSession,
  now: Date,
): boolean {
  return session.status === 'scheduled' && formatChicagoDateOnly(now) >= session.sessionDate;
}
```

`event_sessions.session_date` is a SQL `date` serialised as `YYYY-MM-DD`, which sorts correctly
as a string, so this needs no `Date` arithmetic and has no DST edge case. Build
`formatChicagoDateOnly` with `Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TIME_ZONE })` —
`en-CA` yields `YYYY-MM-DD` directly. **`CHICAGO_TIME_ZONE` already exists at
`OutreachDetail.tsx:1068`; reuse it, do not redeclare it.**

**Export the predicate**, matching this file's own convention (`sortSessionsByStart`,
`groupSessionSignups`, `resolveOwnRosterStudent` are all exported and all have their own
`describe` blocks). The gate measured the cost: **+1 eslint warning**
(`react-refresh/only-export-components`), `OutreachDetail.tsx` 17 → 18. That is the expected
delta — see Gates.

**Use the page's existing `nowFn` seam** (`:1347`, `:1357`, already threaded at `:1844` and
`:1874`). Module doc section (g) (`:414-423`) requires it. **Never call `new Date()` directly.**

The dialog's own `isSessionEligible` (`:660`) stays as the backstop; you are not changing it.

### Trap 8 — no reshaping is needed, and introducing any is a finding

Verified by the gate with `tsc` exit 0: the page's `OutreachDetailSession` (`:619-628`) is
field-for-field the dialog's `MarkDayCompleteSession`, and the page's `RosterStudent` carries an
extra `profileId` that assigns fine. Pass all four props straight through. Any `as unknown as`,
cast, or hand-written mapper at this call site is a defect.

Pass the **same page-level `rsvps` array** the sibling mount passes — the dialog's
`computeInitialAttendedStudentIds` filters by `sessionId` itself (its module doc #6), so
pre-filtering would be a second place for the filter to drift.

### Trap 9 — N triggers in a loop need N distinguishable accessible names (item 15)

Measured by the gate, following revision 1 literally on a three-session fixture:

```
GATE-PROBE accessible names: ["Mark day complete","Mark day complete","Mark day complete"]
GATE-PROBE distinct count: 1 of 3
```

Three tab stops, one name. **This is the exact defect this file's own module doc #13(f)
(`:402-412`) already identifies and solves for `ParentRsvp`** — and revision 1 cited that module
doc twice without applying it here.

Fix with Astryx `Button`'s documented split (`astryx-api.md:1810`: *"`children` … Optional
override for visible text. When provided, displayed instead of label, but **label is still
required (it provides the accessible name)**"*):

```tsx
<Button
  label={`Mark day complete — ${formatSessionDateOnly(session)}`}
  variant="secondary"
  onClick={() => setMarkDayCompleteSessionId(session.id)}
>
  Mark day complete
</Button>
```

Measured: three distinct `aria-label`s, identical visible text. `formatSessionDateOnly` is already
exported (`:1088`) and already used for this purpose at `:1828`.

### Trap 10 — four `<dialog>` elements are mounted; `querySelector('dialog')` returns the wrong one

After this task the page mounts `MarkEventCompleteDialog`, `MarkDayCompleteDialog`,
`OutreachEventDialog` and `AlertDialog`, all in the DOM open or not. The gate hit this:

```
AssertionError: expected 'Mark event completeRiverside Trail Bu…' to contain 'Wren Quill'
```

**Every test that reaches into the dialog must scope like this:**

```ts
const dayDialog = Array.from(container.querySelectorAll('dialog')).find((d) =>
  d.textContent?.trim().startsWith('Mark day complete'),
);
```

Note what an absence-only assertion would have done here: **passed against the wrong element.**

### Trap 11 — the page's own fixture roster collides with the deleted one

`OutreachDetail.tsx:683-714`'s `FIXTURE_STUDENTS`, reached via `defaultLoadOutreachDetail` —
**the loader every existing test in `OutreachDetail.test.tsx` uses** — contains `Amara Chen`,
`Marcus Bello`, `Nina Ortiz` and `Sofia Delgado` **verbatim**, the same four names as the deleted
`DEFAULT_ROSTER`. Measured: `[true, true, true, true]`.

So any test asserting "the dialog shows no fixture names" while using the default loader will
fail for a reason that has nothing to do with your wiring. **Your new tests must inject a loader
with distinct names.** This is why criterion B4 is written the way it is.

---

## 4. Build plan

1. **`MarkDayCompleteDialog.tsx`** — make the five props required; remove the five defaults;
   delete the four consts (`:438`–`:491`), the `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` export
   (`:430`) and its prose mention (`:271`). Module doc corrections, with the **corrected**
   citations: the paragraph at **`:19-25`** (not `:22-27`) saying `OutreachDetail.tsx` "is NOT
   wired to this dialog by this task; a future wiring task connects that page's own
   (currently-stubbed) 'Mark day complete' action" is now false twice over — this *is* that task,
   **and no such stub ever existed** (`grep "Mark day complete" src/pages/outreach/OutreachDetail.tsx`
   returns nothing at base). Rewrite it. Also update the **code comment at `:434`** (*"Fixture data
   … standalone-render defaults"*) — that phrase is at `:434`, **not** in module doc section #7,
   whose actual wording is *"defaulting to a disclosed, obviously-fake placeholder"* and which also
   needs updating.
2. **`MarkDayCompleteDialog.test.tsx`** — add `eventTitle` + `currentUserProfileId` at the 10
   render sites; rewrite `:476` (criterion A4). Change no other `expect`.
3. **`MarkEventCompleteDialog.tsx`** — `currentUserProfileId` required; drop the `:124` import.
   Also update the now-false prop doc at **`:262-263`** (*"same disclosed placeholder
   `MarkDayCompleteDialog.tsx` already established"*). Its `DEFAULT_EVENT_TITLE` (`:246`,
   `'This event'`) is **out of scope** — a generic label, not fabricated data.
4. **`MarkEventCompleteDialog.test.tsx`** — add `currentUserProfileId` at the 8 render sites.
5. **`OutreachDetail.tsx`** — fix `:1906` (Trap 1) and `:1907-1909` (Trap 6 / Part C); add
   `formatChicagoDateOnly` + the exported `isSessionMarkDayCompleteEligible`; add
   `markDayCompleteSessionId` state, the per-session trigger (Trap 9), and the single gated dialog
   instance; add a module doc section in the file's numbered style — **honest about Trap 1's
   mechanism**.
6. **`OutreachDetail.test.tsx`** — the criteria in §5.

---

## 5. Acceptance criteria

Every criterion names the mutation that must turn it **red**. Run each, record the real failure
output, revert. A criterion whose mutation leaves the suite green is not evidence and must be
rebuilt — **three of the last four tasks shipped a criterion that passed against a broken
implementation.** Absence assertions must be paired with a positive, and must use `textContent`,
never `innerHTML`.

### Part A

- **A1 — the props are required.** `tsc --noEmit` exit 0, and all five props non-optional.
  **Mutation:** restore `session = DEFAULT_SESSION` → `TS2304: Cannot find name 'DEFAULT_SESSION'`.
- **A2 — the compiler catches the omission.** Delete `currentUserProfileId` from **one**
  `MarkDayCompleteDialog` render site → `TS2739`/`TS2741` naming that prop. Restore.
  *This is the criterion that proves the mechanism.*
- **A3 — the fixtures are gone.**
  `git grep -n "DEFAULT_SESSION\|DEFAULT_ROSTER\|DEFAULT_RSVPS\|DEFAULT_EVENT_TITLE"
  src/pages/outreach/MarkDayCompleteDialog.tsx` prints nothing, and
  `git grep -n PLACEHOLDER_CURRENT_COACH_PROFILE_ID src/pages/outreach/MarkDayCompleteDialog.tsx
  src/pages/outreach/MarkEventCompleteDialog.tsx` prints nothing (**exit 1, no output — `git grep`
  does not print "0"**; revision 1's `-c … returns 0` wording was wrong). Remember this includes
  the `:271` prose.
  Paired positive: the dialog still renders all four roster names when passed explicitly.
- **A4 — `recordedBy` carries the real id.** Rewrite `MarkDayCompleteDialog.test.tsx:476` to
  assert the **specific profile id the test now passes**, using a distinctive value that is not
  also a student id.
  **Mutation:** hardcode the **top-level `payload.recordedBy` in `handleSubmit`** to a different
  id → `expected 'profile-someone-else' to be '<your id>'`. **Not** inside
  `buildAttendanceWriteRows` — that reddens a different, pre-existing test and leaves `:476` green.

### Part B

- **B1 — the trigger exists, staff-only, with distinct accessible names.** As a coach with a
  scheduled, on-or-past-date session, a control whose `aria-label` **starts with** "Mark day
  complete" is present. **Locate by `aria-label`, never exact `textContent`** (Trap 9). With three
  sessions, assert **three distinct** accessible names. As parent, as student, and signed-out:
  zero such controls **and** the Signups section rendered (so absence cannot pass on a failed load).
  **Mutation:** drop `isStaffViewer` → parent/student cases go `expected 3 to be +0`.
- **B2 — eligibility, both halves proven separately.** With `nowFn` injected: a `scheduled`
  session whose `sessionDate` is **tomorrow** shows no trigger; the same session with `nowFn` on
  that date shows one; a `completed` session shows none regardless of clock.
  **Mutation (a):** drop the `status === 'scheduled'` half → the completed case reddens.
  **Mutation (b):** drop the date half → the future case reddens.
  The gate confirmed each mutation reddens exactly one test and leaves the other green. **Both
  must be run and both outputs recorded.**
  Add a direct `describe` block for `isSessionMarkDayCompleteEligible`, matching the file's
  convention for its other exported pure functions.
- **B3 — the right session reaches the dialog.** With **three** sessions, activate the trigger on
  the **second** and assert the dialog shows that session's date, scoped per Trap 10.
  **Mutation:** resolve with `orderedSessions[0]` instead of the id lookup → red.
  *Why three and not two: the gate measured that two also reddens under this mutation, so
  revision 1's "two could pass by luck" was false. Use three because it additionally catches
  last-element and off-by-one resolutions.*
- **B4 — real page data reaches the dialog.** Inject a loader whose roster names are **distinct
  from `OutreachDetail.tsx:683-714`'s `FIXTURE_STUDENTS`** (Trap 11). Assert the checklist shows
  those injected names.
  **Mutation:** pass `eventDialogRoster` (`OutreachDetail.tsx:1510`, a real, different roster array
  on this same page) instead of `roster` at the call site → red. *This replaces revision 1's
  absence list, which had no mutation and could not be made red: after Part A there is no fixture
  branch left to break, so it tested the test fixture rather than the implementation.*
- **B5 — the real coach id is threaded.** Complete the flow and assert the payload's `recordedBy`
  is the signed-in user's `profiles.id`.
  **Seam:** there is no `onMarkComplete` override prop on `OutreachDetail` by design (Trap 6) —
  use the existing `vi.mock('../../lib/supabase/loaders/outreach')` / `mockedMarkDayComplete`.
  **Mutation:** pass a literal string instead of `user.id` →
  `expected 'profile-placeholder-current-coach' to be '<real id>'`.
- **B6 — two tests, one per half.**
  (a) A **rejecting write** surfaces the dialog's error banner.
  **Mutation:** `await markDayComplete(payload)` → `void markDayComplete(payload)` → red
  (`expected '…' to contain "Couldn't mark this day complete"`).
  (b) A **rejecting reload after a successful write** does **not** surface as a write failure,
  **and the suite exits 0**.
  **Mutation:** `.catch(() => {})` → `void` → the assertion passes but the run reports
  `Errors 1 error` and **exit code 1**. Record the exit code explicitly; this is the BLOCKER the
  gate found and green tests alone do not prove it.
- **B7 — no reshaping.** `git grep -n "as unknown as" src/pages/outreach/OutreachDetail.tsx`
  shows nothing **new** versus the base commit. (It is not empty at base — it matches the comment
  at `:331` in both trees.)

### Gates (all measured with `.env.local` **absent**)

`npx tsc --noEmit` exit 0 · `npx vite build` ✓ · `npm run format:check` clean ·
`npx eslint .` — **0 errors**, warnings **359** (base 358, **+1 expected**: exporting
`isSessionMarkDayCompleteEligible` costs one `react-refresh/only-export-components`; the gate
measured `OutreachDetail.tsx` 17 → 18, every other touched file unchanged. Deleting the
placeholder recovers nothing) · `npx vitest run` — base **70 files / 1668 tests** at `c7098e0`;
report the exact delta and justify each added test.

**Report all five, plus the B6(b) exit code.** A gate omitted from the report is treated as not
run.

---

## 6. Deferral

Anything you find and do not fix goes in your output doc under **"Deferred — for the ledger"**
with file, line, what is wrong, and why it was out of scope (item 20). Do not silently widen
scope. **T300** (`OutreachEventDialog`'s placeholder) and **T301** (the three stale
"LOAD-BEARING" comments) are already filed — do not touch either.
