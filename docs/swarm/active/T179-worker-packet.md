# T179 — worker packet (revision 1)

**Task:** `MarkDayCompleteDialog` is finished, tested, and mounted nowhere. Harden its
placeholder-defaulted props so a forgetful call site cannot compile, then mount it on
`OutreachDetail.tsx` per-session, staff-only.

**Worker tier:** `sonnet`. **Checker:** `checker-reviewer` (`opus`).

**Tier reasoning, stated so the checker can dispute it.** Constitution item 18 trigger 4
("permission logic") is arguable — this adds a role gate. It is graded non-firing because the
gate is a **verbatim copy of three gates already in the same file** (`isStaffViewer` at
`OutreachDetail.tsx:1673`, and the `isParentViewer`/`isStudentViewer` render gates at `:1819`
and `:1862`), not new authorization design; and the prop-hardening half is a mechanical rollout
of T151's already-proven mechanism. Item 25 applies. The **checker is opus** because the mount
opens a real `attendance` write path.

---

## 1. Objective

Two halves, one commit.

**Part A — make the placeholder defaults impossible.** `MarkDayCompleteDialog`'s `eventTitle`,
`session`, `roster`, `rsvps` and `currentUserProfileId` all default to fixtures or a fake
`profiles.id`. Delete the defaults and make the props required, so a call site that forgets one
fails `tsc` instead of silently writing real `attendance` rows for **fixture students**. Same
change for `MarkEventCompleteDialog`'s `currentUserProfileId`, which shares the exported
placeholder.

**Part B — mount it.** Add a staff-only, per-session **"Mark day complete"** trigger inside
`OutreachDetail.tsx`'s existing Signups loop, driving one dialog instance with the page's real
already-fetched session/roster/rsvps and the real signed-in coach's `profiles.id`.

**This closes a live latent bug, not only a hypothetical one.** See Trap 1.

---

## 2. Allowed files

- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.test.tsx`
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`

**Forbidden — everything else**, and specifically:

- `src/pages/outreach/OutreachEventDialog.tsx` — it declares its **own independent** copy of
  `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` at `:619` and has the same `user?.id` call-site defect
  at `OutreachDetail.tsx:1946`. **Deliberately out of scope**; filed as **T300**. Do not fix it,
  and do not let its existence stop you deleting `MarkDayCompleteDialog`'s export — the two
  consts are separate declarations, so nothing breaks. **Measured: `tsc` confirms it.**
- `src/lib/supabase/loaders/outreach.ts` — `markDayComplete` already exists and is already
  correct (T101). You are wiring it, not changing it.
- `supabase/migrations/**` — no schema change is needed or permitted here.
- `docs/swarm/**` — the orchestrator writes the ledger.

---

## 3. Known context and traps

### Trap 1 — the compile error at `OutreachDetail.tsx:1906` is the point, not an obstacle

Making `MarkEventCompleteDialog`'s `currentUserProfileId` required immediately produces:

```
src/pages/outreach/OutreachDetail.tsx(1906,9): error TS2322:
  Type 'string | undefined' is not assignable to type 'string'.
```

That line is `currentUserProfileId={user?.id}` on a dialog that is **already mounted and live
today**. When `user` is null it silently substitutes `'profile-placeholder-current-coach'` into
`attendance.recorded_by`, a real FK to `profiles(id)`.

**Do not "fix" this by writing `user?.id ?? ''` or a non-null assertion.** Fix it the way the
same file already fixes it three times over — wrap the mount in a `user !== null` gate and pass
`user.id`. `isStaffViewer` is a plain `boolean`, **not** a type predicate, so it does not narrow
`user` and will not satisfy the compiler on its own; `OutreachDetail.tsx:1812-1818` documents
exactly this and calls the extra check "LOAD-BEARING, not redundant."

Reachability, stated honestly so nobody overclaims it in the module doc: the dialog's only
trigger is the staff-only `MoreMenu` item, which requires `user !== null`, so a signed-out user
cannot open it today. **The bug is latent, not live-firing.** It is still worth closing, because
the required-prop change is what makes it *impossible* rather than *currently unreachable*.

### Trap 2 — the measured blast radius, so you do not discover it one file at a time

Applied and measured against a clean tree (`tsc --noEmit` exit 0 before, at `c7098e0`):

| Change | `tsc` errors | Where |
|---|---:|---|
| Part A, `MarkDayCompleteDialog` only | 14 | 10 in its own test, 4 unused-const in itself |
| Part A, both dialogs | 24 | +8 in `MarkEventCompleteDialog.test.tsx`, +1 unused import, +1 `OutreachDetail.tsx:1906` |

**Zero errors in any file outside the six Allowed files.** The 10 `MarkDayCompleteDialog.test.tsx`
sites already pass `session`, `roster` and `rsvps` explicitly — **only `eventTitle` and
`currentUserProfileId` are missing.** The 8 `MarkEventCompleteDialog.test.tsx` sites are missing
`currentUserProfileId` only.

### Trap 3 — the four fixture consts are already dead

`DEFAULT_EVENT_TITLE`, `DEFAULT_SESSION`, `DEFAULT_ROSTER` and `DEFAULT_RSVPS`
(`MarkDayCompleteDialog.tsx:438-470`) go straight to `TS6133: declared but its value is never
read` the moment the defaults are removed — **nothing else in the repo references them.** They
carry no current value and pure hazard. Delete all four. Same for the now-unused
`PLACEHOLDER_CURRENT_COACH_PROFILE_ID` **import** in `MarkEventCompleteDialog.tsx:124`.

`MarkDayCompleteDialog.tsx:430`'s **export** of `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` is still
referenced by its own test (`:34`, `:476`). Delete the export **and** rewrite that test's
assertion to the real profile id the test now passes explicitly — see criterion A4.

### Trap 4 — this dialog is per-session; its sibling is per-event

`MarkEventCompleteDialog` (already mounted) takes `sessions` plural and processes the whole
event from one `MoreMenu` item. `MarkDayCompleteDialog` takes **one** `session`. Its trigger
therefore belongs **inside** the existing per-session loop
(`OutreachDetail.tsx:1806`, `orderedSessions.map((session) => ...)`), **not** in `menuItems`.
Adding it to `menuItems` would be a per-event control wired to a per-session dialog.

### Trap 5 — one dialog instance, not one per session

Follow the file's own convention: `MarkEventCompleteDialog` is a **single** instance driven by a
state variable. Do the same with a `markDayCompleteSessionId: string | null`, and resolve the
selected session by id at render. **Do not** render N dialogs inside the loop — that is N mounted
`Dialog` subtrees, N sets of duplicated `aria` labels, and N copies of the form state.

Because `session` is now **required**, the single instance must not render at all when nothing
is selected. Gate the whole element, not just `isOpen`.

### Trap 6 — the dialog has no `onFinished`; compose the reload into `onMarkComplete`

`MarkEventCompleteDialog` has an `onFinished` seam. `MarkDayCompleteDialog` **does not** — it
closes itself on success (`:740`) and surfaces failures in its own `Banner` (`:741`). So the page
refetch must be composed into the `onMarkComplete` prop.

Prescribed shape, mirroring the `void reloadDetail()` already at `OutreachDetail.tsx:1906-1908`:

```tsx
onMarkComplete={async (payload) => {
  await markDayComplete(payload);
  void reloadDetail();
}}
```

**The `await` and the `void` are both deliberate and both load-bearing.** `await` on the write so
a real failure still rejects and the dialog shows its error banner. `void` on the reload so a
*refetch* failure cannot masquerade as a *write* failure — the write already committed, and
telling the coach it failed would invite a duplicate attempt. Check whether `markDayComplete` is
already imported in `OutreachDetail.tsx`; add the import only if it is not.

### Trap 7 — eligibility, and the clock seam that already exists

The dialog's own `isSessionEligible = session.status === 'scheduled'` (`:660`) renders an
informational `Banner` for anything else. That is a correct backstop, but a trigger that opens a
dialog only to say "this isn't eligible" is a poor control.

PRD OUT-05 (line 296): **"on/after a session date, Mark day complete opens a `Dialog`."** So the
trigger renders only when **both** `session.status === 'scheduled'` **and** the session has
started.

Use the page's **existing** `nowFn` seam (`OutreachDetail.tsx:1347`, `:1357`, already threaded to
`ParentRsvp` at `:1844` and `RsvpControl` at `:1874`). Module doc section (g) at `:414-423` is
explicit that any new render site on this page must reuse it or it "reintroduces a test that was
never deterministic." **Do not call `new Date()` directly anywhere in this task.**

### Trap 8 — no reshaping is needed, and introducing any is a finding

`OutreachDetail.tsx`'s own `OutreachDetailSession` / `RosterStudent` / `RsvpRow` are
field-for-field structurally identical to the dialog's, which is why the sibling mount passes them
straight through (module doc #12, `:325-331`). Pass them straight through here too. Any
`as unknown as`, cast, or hand-written field-mapping function introduced at this call site is a
defect, and it is grep-provable.

`rsvps` should be the **same page-level array** the sibling mount passes — the dialog's
`computeInitialAttendedStudentIds` filters by `sessionId` itself (its module doc #6), so
pre-filtering is unnecessary and would be a second place for the filter to drift.

---

## 4. Build plan

1. **`MarkDayCompleteDialog.tsx`** — make `eventTitle`, `session`, `roster`, `rsvps`,
   `currentUserProfileId` required in `MarkDayCompleteDialogProps`; remove the five defaults from
   the destructure; delete `DEFAULT_EVENT_TITLE`, `DEFAULT_SESSION`, `DEFAULT_ROSTER`,
   `DEFAULT_RSVPS` and the `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` export. Update the module doc:
   section #7's "standalone-render defaults" posture is **gone**, and the `:22-27` paragraph
   saying `OutreachDetail.tsx` "is NOT wired to this dialog by this task; a future wiring task
   connects that page's..." is now **false** — that future task is this one. Rewrite both.
2. **`MarkDayCompleteDialog.test.tsx`** — add `eventTitle` and `currentUserProfileId` at the 10
   render sites. Rewrite the `:476` assertion (criterion A4). Do **not** change what any other
   `expect` checks.
3. **`MarkEventCompleteDialog.tsx`** — same treatment for `currentUserProfileId` only; drop the
   now-unused import at `:124`. Its `DEFAULT_EVENT_TITLE` (`:246`, the string `'This event'`) is
   **not** in scope — it is a generic label, not fabricated data.
4. **`MarkEventCompleteDialog.test.tsx`** — add `currentUserProfileId` at the 8 render sites.
5. **`OutreachDetail.tsx`** — fix `:1906` to a `user !== null` gate; add the
   `markDayCompleteSessionId` state, the per-session trigger, and the single dialog instance;
   add a module doc section for the mount in the file's existing numbered style.
6. **`OutreachDetail.test.tsx`** — the criteria in §5.

---

## 5. Acceptance criteria

Every criterion names the mutation that must turn it **red**. Run each mutation, record the
actual failure output, and revert. A criterion whose mutation leaves the suite green is not
evidence and must be rebuilt — **three of the last four tasks shipped a criterion that passed
against a broken implementation.** Absence assertions must be paired with a positive: assert what
*is* rendered, never only that something is gone.

### Part A

- **A1 — the props are required.** `tsc --noEmit` exit 0 on the finished tree, and every one of
  the five props is non-optional in `MarkDayCompleteDialogProps`.
  **Mutation:** restore `session = DEFAULT_SESSION`. Expect a `tsc` error at the deleted const,
  and `git grep DEFAULT_SESSION` to return the reintroduced line.
- **A2 — the compiler catches the omission.** Delete `currentUserProfileId` from **one**
  `MarkDayCompleteDialog` render site in the test file. Expect `TS2739`/`TS2741` naming that
  prop. Restore. *This is the criterion that proves the mechanism, not the wiring.*
- **A3 — the fixtures are gone.** `git grep -n "DEFAULT_SESSION\|DEFAULT_ROSTER\|DEFAULT_RSVPS"
  src/pages/outreach/MarkDayCompleteDialog.tsx` returns **nothing**, and
  `git grep -c PLACEHOLDER_CURRENT_COACH_PROFILE_ID src/pages/outreach/MarkDayCompleteDialog.tsx
  src/pages/outreach/MarkEventCompleteDialog.tsx` returns **0** for both.
  Paired positive: the dialog still renders all four fixture-era student names when they are
  passed explicitly, proving the roster still comes through.
- **A4 — `recordedBy` carries the real id.** `MarkDayCompleteDialog.test.tsx:476` currently
  asserts `payload.recordedBy` equals the placeholder. Rewrite it to assert the **specific
  profile id that test now passes**, and use a distinctive value (not a value that also appears
  as a student id).
  **Mutation:** hardcode `recordedBy` in the payload builder to a different id. Expect red.
  Without this the assertion would be satisfied by any string.

### Part B

- **B1 — the trigger exists, and only for staff.** Render `OutreachDetail` as a coach with a
  scheduled, already-started session: a control named "Mark day complete" is present. Render as
  parent, as student, and signed-out: it is absent **and** the assertion also confirms the
  Signups section itself rendered (so absence cannot pass by the page having failed to load).
  **Mutation:** drop `isStaffViewer` from the gate. Expect the parent/student cases red.
- **B2 — the trigger respects eligibility.** With `nowFn` injected: a `scheduled` session whose
  `startsAt` is in the **future** shows no trigger; the same session with `nowFn` moved past
  `startsAt` shows one. A `completed` session shows none regardless of clock.
  **Mutation (a):** drop the `status === 'scheduled'` half — expect the completed case red.
  **Mutation (b):** drop the clock half — expect the future case red.
  **Both halves must be proven separately.** A single combined test can pass with one half gone.
- **B3 — the right session reaches the dialog.** With **at least three** sessions rendered,
  activate the trigger on the **second**, and assert the dialog shows that session's date.
  **Mutation:** resolve the selected session with `orderedSessions[0]` instead of the id lookup.
  Expect red. *A two-session fixture can pass this by luck; use three.*
- **B4 — real data, not fixtures.** On open, the dialog's checklist shows the page's roster
  student names, and shows **none** of the four names that were in the deleted `DEFAULT_ROSTER`
  (`Amara Chen`, `Marcus Bello`, `Nina Ortiz`, `Sofia Delgado`) — assert on `textContent`, never
  `innerHTML`, which matches generated class names.
  Use page fixture names that do **not** overlap that set.
- **B5 — the real coach id is threaded.** Stub `onMarkComplete`, complete the flow, and assert
  the payload's `recordedBy` is the **signed-in user's** `profiles.id`.
  **Mutation:** pass a literal string instead of `user.id`. Expect red.
- **B6 — the write is awaited and the reload is not.** Assert `onMarkComplete`'s promise is
  awaited before the dialog closes, and that a **rejecting reload** does not surface as a write
  failure.
  **Mutation:** change `void reloadDetail()` to `await reloadDetail()` and make it reject —
  expect the error banner to appear despite a successful write. That is the defect Trap 6 exists
  to prevent, and it must be demonstrated red.
- **B7 — no reshaping.** `git grep -n "as unknown as" src/pages/outreach/OutreachDetail.tsx`
  returns nothing new versus the base commit.

### Gates (all measured with `.env.local` **absent**)

`npx tsc --noEmit` exit 0 · `npx vite build` ✓ · `npm run format:check` clean ·
`npx eslint .` — **0 errors**, warnings **must not increase** (base: 358) ·
`npx vitest run` — base is **70 files / 1668 tests** at `c7098e0`; report the exact delta and
justify every added test.

Report all five. A gate omitted from the report is treated as not run.

---

## 6. Deferral

Anything you find and do not fix goes in your output doc under a heading **"Deferred — for the
ledger"**, with the file, the line, what is wrong, and why it was out of scope. Constitution item
20: the orchestrator files it as a row. **Do not silently widen scope**, and do not fix
`OutreachEventDialog.tsx` — T300 is already reserved for it.
