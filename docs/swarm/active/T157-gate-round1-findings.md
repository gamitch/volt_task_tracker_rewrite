# T157 — premise gate round 1 findings (verbatim required revisions)

**Gate:** `checker-premise`, 2026-07-30, measured at `0b932d0`.
**Verdict:** REVISE — 4 MAJOR, 6 MINOR, 3 NIT. **Round 2 of 2 remains available** (item 19a).

Recorded here because the gate's report existed only in an agent transcript, and
revision 2 must not be written from a summary. The ledger row for T157 carries the
analysis; this file carries the actionable list.

## Baselines measured at `0b932d0`

`OutreachDetail.test.tsx` 43 passed · `outreach.test.ts` 1 passed · `ParentRsvp.test.tsx`
22 passed = **66/66**. `tsc --noEmit` exit 0. Restored-tree re-run identical.

## The twelve required revisions

1. **§9 — resolve the tier contradiction with the ledger.** The packet says worker tier
   `sonnet` "no override"; `task-ledger.md`'s T157 row says opus. A dispatcher reads the
   packet. State **opus**, and restate item 18 as **arguable on trigger 4**
   ("permission logic", `constitution.md:78`) rather than clearly non-firing — the task
   adds a role gate (§7a) and a new client-side authorization predicate over minors'
   family linkage (§7d). T154's row is precedent for a sonnet→opus bump under item 18
   for comparable auth *configuration*. Opus checker is already well justified.

2. **Add a criterion for §7d, with a prescribed mutation.** Currently **no criterion
   detects a broken cross-family scoping filter** — the gate traced a mutation removing
   `linkedStudentIds.has(student.id)` (returning all 5 roster students) against all six
   criteria and every one still passes; the team-scope half is equally undetected.
   Required: assert a roster student *not* linked to `PARENT_USER` renders **no**
   `ParentRsvp` control, and that a linked student outside the event's team scope renders
   none either. Mutation: drop the filter, confirm red. Add a direct unit describe block
   for `resolveParentLinkedRosterStudents`, matching the file's own convention for the two
   comparable pure functions (`OutreachDetail.test.tsx:292`, `:338`), which §8 breaks for
   the one function with a security rationale.

3. **Resolve criterion 3's clock dependency — it self-expires on 2026-08-02.** §7e
   prescribes no `now` prop, so `ParentRsvp` uses the real clock. `isRsvpEditable` locks
   once `now >= session.startsAt` and `handleChange` early-returns when locked, so
   `submitRsvpChange` is never called. Fixture sessions: `session-food-bank-day1` starts
   2026-08-02T14:00Z (the first radiogroup on the page), `day2` 2026-08-09T14:00Z,
   `park-cleanup` 2026-07-26T15:00Z (**already locked**). The criterion goes permanently
   red in days with no code change, and criterion 8's baseline comparison would then
   report a false regression. Either authorize a `now` seam on the `<ParentRsvp>` call
   site (§4 currently discourages injection props by analogy) or authorize moving
   `FIXTURE_SESSIONS` `startsAt` forward (§7f currently restricts it). **Make the choice
   explicitly; do not leave it.**

4. **Add criteria for §7c's four-state machine, and reconcile §12 with §10.** §7c
   prescribes `idle | loading | ready | error` plus an error `Banner` with a real `Retry`;
   §8 has **no** criterion for loading, error, retry or empty. §12 cites item 12 to make
   all four mandatory while §10 **waives** the empty state — a direct contradiction. State
   which governs. Precedent: the file's own T147 Part A2 tests, measured green.

5. **§8.1 — drop the `controlLabel`-as-text locator.** Measured: Astryx
   `SegmentedControl.js:199-200` emits `role="radiogroup"` + `aria-label={label}`; the
   label is never `textContent`. Specify `[role="radiogroup"]` and require a per-instance
   scoping strategy — `ParentRsvp.test.tsx:71-76`'s `radiogroup()` helper is
   `container.querySelector` (first match only) and does not generalize to §7e's
   one-control-per-session × linked-student placement.

6. **§6a/§7f — name all 10 `profileId` construction sites.** Measured blast radius of
   making `RosterStudent.profileId` required: `OutreachDetail.tsx:514-518`
   (`FIXTURE_STUDENTS`) plus `OutreachDetail.test.tsx:294-296` and `:340-341`. §7f names
   only `FIXTURE_STUDENTS`. Required (not optional) is the right call — optional would
   reintroduce the exact defect family this task closes — the packet just must name all
   ten and state that editing those existing fixtures is authorized.

7. **§8.3/§12 — acknowledge the test-infrastructure edits.** Mocking `submitRsvpChange`
   without an override prop requires editing the existing `vi.mock` factory at
   `OutreachDetail.test.tsx:124-131` **and** the `afterEach` clear block at `:175-180`.
   Precedented by `markDayComplete`, but §12 item 10's "only adding tests and adding
   fixture fields" understates it.

8. **§6d — correct the RLS rationale.** §6d claims the query "matches the RLS policy's own
   scoping exactly". Measured `rls.sql:114-116`: `own_read` is a **disjunction** and
   strictly broader — its second disjunct `student_id in (select my_student_ids())` admits
   co-guardian rows with a *different* `parent_profile_id`. The filtered query is strictly
   **narrower** than RLS, which is the correct posture but not "matching exactly". Correct
   it so no future reader concludes RLS alone suffices.

9. **§6c — address the cheaper path.** `ParentRsvp.tsx:258-263` already **exports**
   `GuardianLinkRow` with exactly the four fields §6c prescribes, and `OutreachDetail.tsx`
   must import the component from that file anyway (a type-only import from a
   write-Forbidden file is not a write; `outreach.ts:334-353` already imports page types
   across this boundary). Either adopt `import type { GuardianLinkRow } from './ParentRsvp'`
   or record why a **third** structurally identical declaration (`types.ts:179`,
   `ParentRsvp.tsx:258`, new) is preferred. The cited `parents.ts` Trap #3 precedent
   concerns the page↔loader boundary, where no third consumer existed.

10. **§8.6 — decide reuse-vs-copy for `parseSelectedColumns`** (`outreach.test.ts:29-33`).
    T161's ledger row already names T157 as the second call site T146's
    keep-it-inline decision was waiting for. The packet says "do not invent a different
    assertion shape" but never says reuse or copy.

11. **§5 — add a files-in-flight note for T165**, which is filed to extend the same
    `loaders/outreach.test.ts` and instructs "keep T146's column-guard test byte-intact".

12. **§6d — rename `queryGuardianLinksForParent`**; `checkin.ts:393` already owns that
    name. Also fix §6d's "queries" (plural) for `meetings.ts` — there is one
    (`meetings.ts:503-517`).

## What the gate could NOT do, and why round 2 must differ

**It did not run the six prescribed mutations.** `checker-premise` has no Write or Edit
tool, and the sandbox refused every file-creation route (heredoc to source, heredoc-authored
script, multi-line `perl` insertion). It applied §6a and §6b via single-line `perl -pi` and
measured those end-to-end; everything else is **reasoned from measured source**, which it
stated rather than concealing.

**This was the orchestrator's dispatch error** — instructing a read-only role to build a
prescription. For round 2 either grant write-in-own-worktree, or require the worker's
executed failure output (which §8 already demands) with the opus checker re-running each.

## Corrections the gate made to the orchestrator

- The BLOCKER the brief hypothesized does **not** hold. `students`' `own_or_linked_read`
  (`rls.sql:101-103`) is `id in (select my_student_ids())`, so `queryAllStudents` is
  already server-scoped to the parent's own linked students; `rsvps`'
  `own_or_linked_write`/`own_or_linked_update` (`:205-212`) require
  `student_id in (select my_student_ids()) and responded_by = auth.uid()`. A wrong client
  filter cannot surface or write another family's data. §7d is defence-in-depth. The
  missing criterion is still MAJOR; cross-family exposure is not.
- **"The repo's only `guardian_links` query, `parents.ts:190`" is false** — there are three
  reads: `parents.ts:190` (`select('id, parent_profile_id, student_id')`),
  `checkin.ts:398` (`select('student_id')`), `meetings.ts:509` (`select('student_id')`
  + `.limit(1)`), plus a delete at `parents.ts:252`. The conclusion survives and
  strengthens: **none of the three selects `relationship`**, so none is reusable.
- The brief's `ParentRsvp.tsx:334-335` prop citation is wrong; those lines are
  `resolveRsvpResponderAttribution`'s parameter list. The props are `:467` and `:481`.
  The packet's symbol-based citation was correct.

## Graded exemplary

Authority scoping: the packet attributes **only** the host screen to George
(`auto-mode-decisions.md:854-880`) and explicitly disclaims the rest. No
authority-promotion finding. §8.6's select guard is "the strongest criterion in the
packet". Baselines are expressed by reference with no pinned numbers.
