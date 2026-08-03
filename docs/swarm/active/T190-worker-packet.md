# T190 — worker packet v1: rekey `OutreachList`'s fixtures off the placeholder so new tests discriminate by construction

**Tier: STANDARD** (constitution item 26). **Stated and defended:** no write path, no schema/RLS/auth,
one file pair. It is **not FAST** — this changes what ~100 existing tests see by default, which is the
opposite of "roughly ≤20 lines with a contained blast radius". Worker implements; the orchestrator
replays every mutation; no separate checker round.

**Branch:** `claude/t190-placeholder-student`, from `33c9e24`. **Measure your own baseline** — `main`
moved eight times on 2026-08-03.

---

## 1. The defect, and it is a hazard rather than a live bug

After T170, `PLACEHOLDER_CURRENT_STUDENT_ID` has **no runtime role** — it survives only as fixture
data. But the test harness default still returns it (`OutreachList.test.tsx:183`,
`resolveStudentId: async () => PLACEHOLDER_CURRENT_STUDENT_ID`) **and the shipped fixtures are still
keyed to it**, so every test that does not explicitly stub `resolveStudentId` gets
placeholder-in / placeholder-out.

**This is a future-authoring hazard, not a present coverage hole.** T170's own regression is guarded
by two dedicated tests that redden under the exact mutation regardless. The hazard is that a **new**
positive test omitting `resolveStudentId` would be silently non-discriminating by default — **which
is precisely how T170's own MAJOR happened.**

---

## 2. Allowed Files

```
src/pages/outreach/OutreachList.tsx
src/pages/outreach/OutreachList.test.tsx
```

**Forbidden:** everything else. In particular `OutreachDetail.tsx`, `OutreachEventDialog.tsx` and
`loaders/outreach.ts` — **T300 and T406 are in flight in this directory right now** on those exact
files. If you find yourself needing any of them, **stop and report**.

---

## 3. THE LEDGER ROW'S COST ESTIMATE IS WRONG — measured, not argued

The T190 row states: *"Measured cost: exactly 3 test assertions need their expected figures updated"*,
and names them. **The real number is 6.** The orchestrator applied the rekey and ran the suite before
writing this packet:

```
Tests  6 failed | 101 passed (107)
```

The three the row names, all present:
- `student/parent view > populated state: own goal bar …`
- `student/parent view > selecting a real RSVP segment updates the goal bar …`
- `student/parent view > BEH-01: milestone toast fires once per season+goal-bar …`

**And three it does not:**
- `getUnansweredRsvpCount (BEH-04 …) > the shipped fixture data produces the documented counts for both roles`
- **`T193 … > C3: a rejected write restores the previous (unanswered) status …`**
- **`T193 … > C6: the optimistic update is applied before the writer promise settles`**

**The last two are T193's own acceptance criteria** — a HEAVY-tier task merged earlier the same day.
Every failure is an **expected-figure** assertion (`expected 2 to be 1`,
`expected '…1 awaiting your RSVP…' to contain '0 awaiting your RSVP'`), not a behavioural one.

**All six citations in the row's source-line list are also stale** (T330 grew this file by ~150 lines).
Verified at `33c9e24`: the placeholder is declared at **`:971`**, and keyed at **`:992`** (students),
**`:1015`** (goal config), **`:1199`/`:1201`** and **`:1255`/`:1257`** (rsvps). The row's `:935`,
`:958`, `:1142`, `:1144`, `:1198`, `:1200` are all wrong. `OutreachList.test.tsx:183` is still correct.

---

## 4. What to build

**4.1** Give the viewer fixture a real id of its own — e.g. `'student-lena-osei'`, matching its own
`name: 'Lena Osei'` — and rekey `FIXTURE_STUDENTS` (`:992`),
`FIXTURE_GOAL_CONFIG.individualGoalHoursByStudentId` (`:1015`), and `FIXTURE_RSVPS`'s `studentId` and
`respondedBy` (`:1199`, `:1201`, `:1255`, `:1257`) onto it.

> **`respondedBy` is a `profiles.id` column, not `students.id`** — this is T174's defect, which was
> just fixed in `OutreachDetail.tsx`'s sibling fixture. **Do not rekey `respondedBy` to a
> `student-*` id.**
>
> **Answered before dispatch so you do not have to discover it:** this file has **no `profile-*`
> fixtures at all** — `grep "profile-" src/pages/outreach/OutreachList.tsx` returns **nothing**, and
> `FIXTURE_STUDENTS` here carries only `{ id, name }`, with no `profileId` (unlike
> `OutreachDetail.tsx`'s, which is why T174 could do a clean 1:1 rename there). **So this file is a
> second instance of T174's defect, in a file T174 never touched.**
>
> **What to do:** key `respondedBy` to a `profile-`-shaped literal that plainly corresponds to the
> student (e.g. `'profile-lena-osei'` beside `'student-lena-osei'`), and add a short comment saying
> the two id-spaces are deliberately distinct and why. **Do not add a `profileId` field to
> `FIXTURE_STUDENTS`** — nothing in this file reads one, and inventing an unused field is the kind of
> speculative shape this codebase rejects. **Report this in your output**; the orchestrator will decide
> whether the remaining id-space gap here warrants its own row.

**4.2** Leave the harness default (`test:183`) returning the placeholder. After 4.1 the placeholder
keys **nothing**, so a test that does not stub `resolveStudentId` gets a viewer with no fixture data —
**that is the entire point**: new non-discriminating tests now fail loudly instead of passing.

**4.3 Fix the six tests by making them ASK for the viewer they need — do not edit their expected
figures.** Each should stub explicitly:

```ts
resolveStudentId: async () => 'student-lena-osei',
```

**This is the better fix and the packet requires it**, because it satisfies 4.2's goal (every test that
needs a real viewer says so) while leaving every `expect(...)` byte-identical. **Editing expected
figures instead would silently weaken T193's C3 and C6**, whose whole subject is what a rejected write
restores — and this repo does not edit a passed task's assertions to accommodate a later one.

**If a given test genuinely cannot be fixed by stubbing** and its figures must change, that is a
finding: **report it with the reasoning, do not just change the number.**

---

## 5. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | No fixture in `OutreachList.tsx` is keyed to `PLACEHOLDER_CURRENT_STUDENT_ID` | re-key any one fixture back to it |
| **C2** | The harness default still returns the placeholder, and it now matches no fixture student | point the default at `'student-lena-osei'` |
| **C3** | A test that does **not** stub `resolveStudentId` sees a viewer with **no** RSVPs and **no** goal — the discriminating property this task exists to create | re-key `FIXTURE_STUDENTS` back to the placeholder |
| **C4** | T193's C3 and C6 still assert exactly what they asserted before | — see below |
| **C5** | `respondedBy` holds a `profiles.id`-shaped value, not a `students.id` one (T174's rule, applied here) | set it to a `student-*` id |

**C4 is a no-diff criterion, not a mutation criterion.** Demonstrate it with
`git diff -- src/pages/outreach/OutreachList.test.tsx | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'`
returning **nothing** for those two tests. **If it returns anything, this task has weakened a merged
HEAVY task's evidence and must stop and report.**

**C3 is the criterion that captures the point of the task.** Without it, every other criterion is
satisfiable by a rekey that leaves the hazard exactly where it was.

---

## 6. Harness facts

`OutreachList.test.tsx` (3300+ lines) uses raw `createRoot`/`act`; there is **no
`@testing-library/react`**. Its only `vi.mock` is a partial mock of `loaders/selfCheckoff`.
`loaders/outreach` is **not** mocked. **Confirm all of that yourself** — four consecutive tasks in this
project wrote criteria against an imagined harness.

Note also that several tests reference the placeholder deliberately and must keep doing so — e.g. one
asserts `STUDENT_OR_PARENT_USER.id` is **not** the placeholder, and another documents *"deliberately NO
rsvp row for `PLACEHOLDER_CURRENT_STUDENT_ID`"*. **Those are discriminating assertions. Do not
"clean them up".**

---

## 7. Required worker output

`docs/swarm/active/T190-worker-output.md`:

1. **Commit SHA** plus proof the work is in the **committed blob** (item 21).
2. **All six gates** against your own measured baseline, `.env.local` absent. Assert the **exit code**
   of the targeted run.
3. **Every mutation in §5, run, with real red output pasted**, plus C4's diff-grep output.
4. **§4.1**: what you keyed `respondedBy` to, and why.
5. **The final count of tests you touched**, against this packet's measured 6 — if it differs, say so.
6. **Anything in this packet that is wrong.** The ledger row this packet is built on had a wrong cost
   estimate and six stale citations, both caught by measuring. Assume this packet has its own.
