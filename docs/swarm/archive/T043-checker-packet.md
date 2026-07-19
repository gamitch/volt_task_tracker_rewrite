# Checker Packet: T043 (Parent RSVP-on-behalf) — Check Attempt 1

## Task ID
T043 — Parent RSVP-on-behalf (OUT-06), Epic E6.

## Checker Agent
checker-reviewer (per task-ledger.md T043 row).

## Objective
Verify a real, single-student-scoped parent RSVP control where `responded_by` is correctly
attributed as the acting parent's own real `profiles.id` (never a literal role string), and the
read-side "Mom signed you up" attribution is correctly resolved by cross-referencing
`guardian_links`, with an honest fallback for the case where `responded_by` matches neither the
student nor any of their guardians.

## Allowed Files (worker's literal permitted edit)
- `src/pages/outreach/ParentRsvp.tsx` (new)

**Scope flag**: worker also created `ParentRsvp.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`428a1f3`) — do NOT
infer authorship from commit messages. Confirm `RsvpControl.tsx`, `OutreachList.tsx`,
`OutreachEventDialog.tsx`, `OutreachDetail.tsx`, `router.tsx`, `guards.tsx` untouched. Note: the
working tree may show other concurrently-running tasks' files (`OutreachDetail.tsx`,
`SubscribePopover.tsx`, `supabase/functions/ics/**`, `supabase/functions/send-reminders/**`) — not
this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`responded_by` — a real `profiles.id` FK, the central correctness check.** Claims confirmed by
   direct migration read (`20260717000000_scheduling_attendance.sql` line 72). Claims the write
   path uses an injectable `currentUserProfileId` prop (a real profile id, deliberately a different
   placeholder shape than `RsvpControl.tsx`'s own, so the two are never interchangeable) — never a
   literal `'parent'` string anywhere (claims a test asserts `!== 'parent'`, `!== studentId`,
   `!== studentProfileId`).
2. **`resolveRsvpResponderAttribution` — a real `guardian_links` cross-reference, exhaustive
   4-outcome type.** Claims: `{kind:'none'}` (no RSVP), `{kind:'self'}` (responded_by equals the
   student's OWN profile id — a separate prop from `students.id`, deliberately not conflated),
   `{kind:'guardian', relationship, guardianLink}` (matches a real `guardian_links` row for this
   student, renders the row's real `relationship` text, e.g. "Mom"/"Dad" — never hardcoded), and
   `{kind:'unrecognized', respondedByProfileId}` (matches neither — claims this DISCLOSED edge case
   renders a deliberately generic line, "Someone else recorded this response on your student's
   behalf," never fabricating an unbacked relationship label).
3. **Single-student scoping** — claims this component takes one student's props at a time
   (studentId/studentProfileId/currentRsvp/guardianLinks all single-student-shaped), matching
   `RsvpControl.tsx`'s established shape and the repo-wide "one reusable component rendered once per
   linked student by a future page" precedent, not built here.
4. **Same universal lock boundary as `RsvpControl.tsx`** — claims reused (independently
   reimplemented, not imported, since that file is Forbidden) `isSessionTimeEditable`/
   `isRsvpEditable` logic, not an ADDITIONAL parent-only lock layered on top.
5. Claims 22/22 new tests pass; 816/816 repo-wide in a clean isolated re-run (disclosed transient
   flakiness from concurrent workers in earlier runs, isolated and explained). typecheck/lint/build
   clean.

## Required Verification Steps
1. **Read `ParentRsvp.tsx` and `ParentRsvp.test.tsx` in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **`responded_by` real-profile-id claim — the single most important check in this packet.**
   Confirm by source read/grep that no literal `'parent'` string is ever written to `responded_by`
   anywhere in the file.
3. **`guardian_links` cross-reference — reproduce the four outcome cases yourself.** Confirm by
   source read that `resolveRsvpResponderAttribution` genuinely queries `guardian_links` for the
   matching row rather than inferring the relationship some other way. Independently verify the
   `'unrecognized'` case renders the disclosed generic copy and NEVER a fabricated relationship
   label — this is the specific trap this task's packet was written to prevent, scrutinize it
   directly.
4. **Single-vs-multi-student scoping — render your own explicit verdict** on whether this is the
   correct scope boundary given the task's narrow Allowed Files (a single new file) and the
   established repo-wide "one component per linked student, rendered by a future page" pattern.
5. **Lock-boundary reuse — confirm by source read** that this is genuinely the same universal
   boundary `RsvpControl.tsx` established (via T040's own hard-won fix for the int32 `setTimeout`
   overflow — confirm this component's own lock logic, if it uses a live re-lock timer, ALSO
   correctly guards against that same overflow, since it's an independent reimplementation, not an
   import, and could have silently reintroduced the bug).
6. **Astryx prop citations** — spot-check `SegmentedControl`/`SegmentedControlItem`, `Text`,
   `Timestamp`, `Banner`, `VStack`/`HStack` against `astryx-api.md`.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
   your own run.
9. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 6: no PII; test fixtures use fabricated names only.
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the `responded_by` real-profile-id attribution
- explicit verdict on the `guardian_links` cross-reference and the `'unrecognized'` fallback's
  honesty
- explicit verdict on whether the independently-reimplemented lock logic reintroduced the T040
  `setTimeout` overflow bug or correctly avoided it
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
