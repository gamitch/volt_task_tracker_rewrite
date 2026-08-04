# T190 — worker output

**Tier: STANDARD** (worker implements, orchestrator replays every mutation, no separate checker
round). Branch `claude/t190-work`, off `claude/t190-placeholder-student` (`64abca7`, based on
`33c9e24`). Worktree: `/tmp/claude-0/-home-user-volt-task-tracker-rewrite/03662208-7609-564c-8759-12b1ea7c2fbc/scratchpad/t190-work`
(isolated, per item 23 — the shared tree at `/home/user/volt_task_tracker_rewrite` was never
touched).

---

## 1. Commit SHAs, and proof the work is in the committed blob (item 21)

Two commits on `claude/t190-work`, HEAD at:

```
72648aa test(T190): add a direct C3 demonstration -- no-stub render sees an empty viewer
8a1e453 fix(T190): rekey OutreachList's fixtures off the placeholder so new tests discriminate by construction
64abca7 docs(T190): worker packet v1 -- rekey fixtures so new tests discriminate by construction (packet, not mine)
```

Both commits stage **named paths only** (item 22) — `git add src/pages/outreach/OutreachList.tsx
src/pages/outreach/OutreachList.test.tsx` for the first, `git add
src/pages/outreach/OutreachList.test.tsx` for the second. `git status` is clean at HEAD.

Proof the fix is in the **committed blob**, not just the working tree (`git show`, not `cat`):

```
$ git show 8a1e453:src/pages/outreach/OutreachList.tsx | grep -n "student-lena-osei\|profile-lena-osei"
1011:  { id: 'student-lena-osei', name: 'Lena Osei' },
1034:    'student-lena-osei': 12, // T190: rekeyed off PLACEHOLDER_CURRENT_STUDENT_ID
1220:    studentId: 'student-lena-osei',
1230:    respondedBy: 'profile-lena-osei',
1285:    studentId: 'student-lena-osei',
1288:    respondedBy: 'profile-lena-osei',

$ git show 72648aa:src/pages/outreach/OutreachList.test.tsx | grep -n "T190 regression guard"
1861:  it('T190 regression guard: a render with NO explicit resolveStudentId/viewerStudentId override sees a viewer with no RSVPs and no goal, not the placeholder fixture', async () => {
```

`git worktree` was never removed and the checkout is a real `git worktree add … -b claude/t190-work
claude/t190-placeholder-student`, so this is a genuine second worktree of the same repo, not a
detached copy.

Files changed (both Allowed Files, nothing else):
- `src/pages/outreach/OutreachList.tsx` — 49 insertions / 25 deletions (commit `8a1e453`)
- `src/pages/outreach/OutreachList.test.tsx` — 85 insertions / 25 deletions (commit `8a1e453`) + 24
  insertions (commit `72648aa`)

---

## 2. All six gates, `.env.local` absent, against my own measured baseline

`.env.local` confirmed absent (`ls .env.local` → "No such file or directory") before any measurement.

**Baseline, measured on my own worktree at `64abca7` before touching anything** (not quoted from a
doc):

| Gate | Command | Baseline | Final (HEAD `72648aa`) |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | exit **0** | exit **0** |
| 2 | `npx vite build` | exit **0** | exit **0** |
| 3 | `npm run format:check` | clean, exit **0** | clean, exit **0** |
| 4 | `npx eslint .` | **0 errors / 364 warnings**, exit **0** | **0 errors / 364 warnings**, exit **0** |
| 5 | `npx vitest run` | **78 files / 1944 tests**, exit **0** | **78 files / 1945 tests**, exit **0** |
| 6 | `npx vitest run src/pages/outreach/OutreachList.test.tsx` | **107 tests**, exit **0** | **108 tests**, exit **0** |

Gate 5's final count is baseline + 1 (the one new test added in commit `72648aa`). Gate 6's final
count is likewise baseline + 1 for the same reason. No other test file or count moved. Full raw
output for every gate is in `/tmp/t190-baseline-*.log` and `/tmp/t190-final-*.log` /
`/tmp/t190-g*.log` in this session's scratchpad; exit codes were captured explicitly with `echo $?`
immediately after each command, not inferred from a pass count (the project's own documented trap).

---

## 3. §5 mutations, run, with real red output — plus C4's diff-grep

All mutations were made and reverted in this worktree only (item 23), each preceded by a clean
commit (item 26's fast-tier working rule, applied here too — never `git checkout --` over
uncommitted work).

### C1 — "No fixture in `OutreachList.tsx` is keyed to `PLACEHOLDER_CURRENT_STUDENT_ID`"
Mutation: re-key `FIXTURE_STUDENTS`' Lena Osei entry back to
`{ id: PLACEHOLDER_CURRENT_STUDENT_ID, name: 'Lena Osei' }`.

```
FAIL  … > getUnansweredRsvpCount (BEH-04 …) > the shipped fixture data produces the documented counts for both roles
FAIL  … > <OutreachList /> coach view > populated state: dense per-event Upcoming/Past rows (UXD-02), expected/attended counts, unanswered badge, NAV-07 exclusion
FAIL  … > <OutreachList /> coach view > UXD-05/UXC-08 (T136): exactly one "Team season goal" heading …
FAIL  … > <OutreachList /> coach view > BEH-01: the team goal bar fires milestone toasts once confirmed hours cross them (first render only)
Test Files  1 failed (1)
     Tests  4 failed | 104 passed (108)
```
Exit **1**. Reverted (`git checkout -- src/pages/outreach/OutreachList.tsx`).

### C2 — "The harness default still returns the placeholder, and it now matches no fixture student"
Mutation: point `renderAsUser`'s default at `'student-lena-osei'` instead of
`PLACEHOLDER_CURRENT_STUDENT_ID`.

```
FAIL  … > <OutreachList /> student/parent view > T190 regression guard: a render with NO explicit resolveStudentId/viewerStudentId override sees a viewer with no RSVPs and no goal, not the placeholder fixture
FAIL  … > <OutreachList /> T193: real RSVP writer wiring (packet §5) > C1/C2: changing an RSVP calls the injected writer exactly once, with studentId=viewerStudentId and respondedBy=viewerProfileId (the PROFILE id, not the student id)
Test Files  1 failed (1)
     Tests  2 failed | 106 passed (108)
```
Exit **1**. Reverted.

### C3 — "A test that does not stub `resolveStudentId` sees a viewer with no RSVPs and no goal"
**The packet's own named mutation for C3 ("re-key `FIXTURE_STUDENTS` back to the placeholder") does
NOT actually turn this property red** — see §6 finding below. I ran it anyway, for the record:

```
$ (revert FIXTURE_STUDENTS' Lena entry to PLACEHOLDER_CURRENT_STUDENT_ID)
Test Files  1 failed (1)
     Tests  4 failed | 104 passed (108)   [identical failure set to C1's mutation above]
```
My new C3-demonstrating test is **not** in that failure list. The mutation that actually reddens the
literal C3 property ("viewer sees no RSVPs and no goal") is reverting `FIXTURE_RSVPS`'s `studentId`
fields (rsvp-4/rsvp-10) back to the placeholder, leaving `FIXTURE_STUDENTS` untouched:

```
$ (revert FIXTURE_RSVPS' studentId fields to PLACEHOLDER_CURRENT_STUDENT_ID)
FAIL  … > <OutreachList /> student/parent view > T190 regression guard: a render with NO explicit resolveStudentId/viewerStudentId override sees a viewer with no RSVPs and no goal, not the placeholder fixture
AssertionError: expected 'Outreach1 awaiting your RSVP…' to contain '2 awaiting your RSVP'
```
Exit **1**, 1 failed | 107 passed against just this one field reverted (10 failed | 98 passed when
`FIXTURE_GOAL_CONFIG` was reverted at the same time as part of a broader check — full log in
`/tmp/t190-final-c3-real.log`). Both experiments reverted.

### C4 — no-diff criterion for T193's C3/C6
```
$ git diff -- src/pages/outreach/OutreachList.test.tsx | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'
-    expect(
-    ).toBe(1);
```
This is **not empty** as literally run against the whole file, but both matched lines come from the
**BEH-04 pure-function test**, not from T193's C3/C6 — confirmed by hunk header:
```
$ git diff -U2 64abca7..HEAD -- …test.tsx | grep -B6 "^-    expect($"
@@ -1079,7 +1101,5 @@ describe('getUnansweredRsvpCount (BEH-04 / Known Context/Traps #3)', () => {
     // Viewer alone: unanswered only on session-food-bank-upcoming …
-    expect(
-      getUnansweredRsvpCount(outreachSessions, data.rsvps, [PLACEHOLDER_CURRENT_STUDENT_ID]),
-    ).toBe(1);
```
Checked independently for the T193 describe block specifically — its two hunks each remove exactly
one line, the old `renderAsUser(...)` call, never an `expect`/`toBe`/`toEqual`/`toHave` line:
```
@@ -2020 +2082,9 @@ describe('<OutreachList /> T193: real RSVP writer wiring (packet §5)', () => {
-    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData, onRsvpChange: spy });
+    // T190: explicit real-viewer stub -- the harness default
@@ -2065 +2135,8 @@ describe('<OutreachList /> T193: real RSVP writer wiring (packet §5)', () => {
-    renderAsUser(STUDENT_OR_PARENT_USER, { loadData: defaultLoadOutreachData, onRsvpChange: spy });
+    // T190: explicit real-viewer stub -- see the C3 test above for why.
```
**T193's C3 and C6 assert exactly what they asserted before** — verbatim, byte-identical
`expect(...)` bodies. (See §6 for why the literal grep-the-whole-file version of C4 needs the manual
per-hunk check.)

### C5 — "`respondedBy` holds a `profiles.id`-shaped value, not a `students.id` one"
Mutation: set both rekeyed `respondedBy` fields to `'student-lena-osei'` (a `students.id`).

```
$ npx vitest run src/pages/outreach/OutreachList.test.tsx
Test Files  1 passed (1)
     Tests  108 passed (108)
```
Exit **0** — **the mutation does not turn anything red.** `grep -n "\.respondedBy\b" …tsx …test.tsx`
returns **zero matches** in either file: nothing in `OutreachList.tsx` or its test file ever *reads*
`FIXTURE_RSVPS[].respondedBy`. It is write-only fixture data here — see §6 finding 3.

---

## 4. §4.1 — what `respondedBy` was keyed to, and why

Kept the two fields **distinct on purpose**, matching the packet's instruction exactly:

- `studentId`: `'student-lena-osei'` — a `students.id`, matching the viewer fixture's own new id
  (`FIXTURE_STUDENTS`).
- `respondedBy`: `'profile-lena-osei'` — a disclosed `profiles.id`-shaped stand-in, deliberately
  **not** `'student-lena-osei'`.

Why not just reuse `student-lena-osei` for both (the pre-fix pattern every OTHER `FIXTURE_RSVPS` row
in this file already uses, e.g. `respondedBy: 'student-amara-webb'`)? Because that is precisely
T174's defect (`respondedBy` is a `profiles.id` column; using a `students.id`-shaped literal there
confuses the two id-spaces), and the packet explicitly forbids reintroducing it
(`Do not rekey respondedBy to a student-* id`). Why not add a real `profileId` field to
`FIXTURE_STUDENTS` and reference it? Because the packet explicitly forbids that too — "nothing in
this file reads one, and inventing an unused field is the kind of speculative shape this codebase
rejects" — and I confirmed that instruction is accurate: `OutreachStudentFixture` is
`{ id: string; name: string }` with no third field, and `grep "profile-"
src/pages/outreach/OutreachList.tsx` (before my edit) returned nothing. So the only compliant move
was a disclosed literal, with a comment explaining the two id-spaces are deliberately distinct —
which is what I added at both call sites (rsvp-4's comment is the full explanation; rsvp-10's is a
one-line pointer back to it, to avoid duplicating the same paragraph twice).

**Reported per the packet's instruction**: this file (`OutreachList.tsx`) has its OWN, wider instance
of T174's exact defect that this task does not fix — every *other* `FIXTURE_RSVPS` row (rsvp-1,
rsvp-2, rsvp-3, rsvp-5 through rsvp-9, rsvp-11) sets `respondedBy` to the same `student-*` literal as
its own `studentId`, e.g. `respondedBy: 'student-amara-webb'`. That is out of scope here — my task
was only to rekey the two rows that were keyed to the placeholder, and the packet's own §4.1 scopes
the fix to exactly those two rows, not a file-wide cleanup. I did **not** touch the other nine rows.
Whether that's worth its own follow-up ledger row (per constitution item 20 — a disclosed deferral
needs a filed task, not just a comment) is the orchestrator's call, as the packet itself says
("the orchestrator will decide whether the remaining id-space gap here warrants its own row"). I've
now given it the concrete list (9 rows, `rsvp-1/2/3/5/6/7/8/9/11`) to make that decision without
re-deriving it. Consistent with §6 finding 3, `OutreachList.tsx` has no live consumer of
`respondedBy` on its static fixture rows at all right now (its own real writer, `handleRsvpChange`,
sets `respondedBy: viewerProfileId` on every NEW write — the fixture rows are display-only), so this
gap is presently a hygiene/consistency issue, not a demonstrated behavioral defect the way T174's
`OutreachDetail.tsx` instance was.

---

## 5. Final count of tests touched vs. the packet's measured 6

**7 tests touched: the packet's measured 6, plus 1 new test I added.**

The 6 (all fixed by stubbing, per §4.3, or — for the one that couldn't be — by the narrowest possible
non-`.toBe()` change):
1. `getUnansweredRsvpCount (BEH-04 …) > the shipped fixture data produces the documented counts for both roles`
2. `<OutreachList /> student/parent view > populated state: own goal bar …`
3. `<OutreachList /> student/parent view > selecting a real RSVP segment updates the goal bar …`
4. `<OutreachList /> student/parent view > BEH-01: milestone toast fires once per season+goal-bar …`
5. `<OutreachList /> T193 … > C3: a rejected write restores the previous (unanswered) status …`
6. `<OutreachList /> T193 … > C6: the optimistic update is applied before the writer promise settles`

Plus 1 new test (commit `72648aa`), added because no *existing* test gave C3 — the criterion the
packet itself calls "the criterion that captures the point of the task" — a direct, literal
demonstration (see §6 finding 1 for why):
7. `<OutreachList /> student/parent view > T190 regression guard: a render with NO explicit resolveStudentId/viewerStudentId override sees a viewer with no RSVPs and no goal, not the placeholder fixture`

Difference from the packet's "6," explained: the packet's §4.3 only discusses fixing the six broken
tests; it does not mention adding a new one. I added exactly one, narrowly scoped to prove C3 by
construction rather than by inspection, because measuring (§6 finding 1) showed the acceptance table
had no test that actually exercised C3's literal claim.

Of the 6, **5 were fixed exactly as prescribed** — stub `resolveStudentId: async () =>
'student-lena-osei'` in the render call, touching **zero** `expect(...)` lines. The 6th (test 1,
`getUnansweredRsvpCount`'s BEH-04 test) **could not** be fixed that way — see §6 finding 2 — and
required a narrowly-scoped change described there.

---

## 6. Findings — things wrong in the packet (as instructed, finding these is a success)

**Finding 1 — C3's named mutation does not test C3's own stated property.** The packet's §5 table
says C3 turns red under "re-key `FIXTURE_STUDENTS` back to the placeholder." Measured directly (§3
above): that mutation reddens 4 tests, but they are **all coach-view/whole-roster aggregation
tests** (`FIXTURE_STUDENTS` only feeds the coach roster and per-student goal-sum loop,
`computeGroupHours`/`sumIndividualGoals`) — none of them is the student/parent viewer's own
RSVP/goal figures, which is what C3's prose actually describes ("a viewer with no RSVPs and no
goal"). The individual viewer's RSVPs and goal are read from `FIXTURE_RSVPS`/`FIXTURE_GOAL_CONFIG`
by `studentId`/`viewerStudentId`, never by cross-referencing `FIXTURE_STUDENTS`. I confirmed this
by running the mutation the packet actually names (no effect on any student/parent-view figure) and
the mutation that should have been named — reverting `FIXTURE_RSVPS`'s `studentId` fields — which
does produce exactly the described symptom (`1 awaiting your RSVP` instead of `2`, the pre-fix
figure). **Consequence for my work**: I added a new test (§5, item 7) that gives C3 a literal,
correct demonstration, independent of which fixture the packet named — but the packet's own named
mutation, if used by a checker to verify C3, would pass for the wrong reason (coach-roster breakage,
not viewer-empties-out breakage) unless the checker also inspects which tests actually failed, not
just that *something* failed.

**Finding 2 — one of the "six" cannot be fixed by stubbing at all, and the packet's own framing
("leaving every `expect(...)` byte-identical") does not hold for it.** Test 1
(`getUnansweredRsvpCount (BEH-04) > the shipped fixture data produces the documented counts for both
roles`) never renders `OutreachList` and has no `resolveStudentId` prop to stub — it calls
`defaultLoadOutreachData` directly and computes `getUnansweredRsvpCount(…, [PLACEHOLDER_CURRENT_STUDENT_ID])`
inline. The identifier that needs to change (the placeholder → the real viewer id) is embedded
**inside** the `expect(...)` call's argument list, not in a separate stub location. Per the packet's
own escape hatch ("If a test genuinely cannot be fixed by stubbing… that is a finding: report it with
the reasoning, do not just change the number"), I fixed it by hoisting a local `const
viewerStudentId = 'student-lena-osei'` above the assertions and referencing that instead of the
placeholder inside the `expect(...)` call — **the two asserted numbers (`.toBe(4)`, `.toBe(1)`) are
completely unchanged**, only the identifier meaning "the viewer" changed, and I verified that
substitution preserves the exact same true count (traced by hand and confirmed by the passing test).
This is **not** one of C4's two protected tests (T193's C3/C6), so C4's no-diff rule does not apply
to it — but it does mean the packet's blanket claim that all six fixes leave "every `expect(...)`
byte-identical" is not quite true; five do, one required a minimal, value-preserving change to the
`expect(...)` line's *shape* (not its asserted values). Flagged explicitly rather than silently
absorbed into the "5/6 stubbed cleanly" framing.

**Finding 3 — C5 is not currently mutation-provable inside this file's Allowed scope, unlike T174's
original fix.** `grep -n "\.respondedBy\b" src/pages/outreach/OutreachList.tsx
src/pages/outreach/OutreachList.test.tsx` returns **zero matches** — nothing in either file reads
`FIXTURE_RSVPS[].respondedBy`. Confirmed with the actual mutation (§3, C5): setting both rekeyed
`respondedBy` fields to a `student-*` id changes nothing observable; the full targeted suite still
passes 108/108. T174's own fix (cited by this packet as precedent) had a real consumer available —
`resolveRsvpResponderAttribution` in `ParentRsvp.tsx`, exercised by `OutreachDetail.test.tsx` — to
write a genuine behavioral test against. `OutreachList.tsx` has no such consumer for its own static
fixture data (its real write path sets `respondedBy: viewerProfileId` fresh on every submit, never
reading the fixture's stored value). I did not invent a synthetic prefix-check test for this, on the
same principle the packet itself invokes for the `profileId` field: manufacturing a test with no real
consumer to justify it is exactly the "speculative shape this codebase rejects." This is disclosed
here rather than silently fixed with a weak test.

**Finding 4 (minor, already flagged by the packet itself but worth confirming independently)**: the
packet's §3 line-number citations (`:971`, `:992`, `:1015`, `:1199`/`:1201`, `:1255`/`:1257`) were
verified **exactly correct** against my own worktree at `33c9e24`/`64abca7` before any edits — all
seven matched on the first grep, no drift found beyond what the packet already disclosed.

No other errors found in the packet's prescriptions, acceptance criteria wording (beyond Findings 1–2
above), or Known Context/Traps section — §6's claims about the harness (raw `createRoot`/`act`, no
`@testing-library/react`, only `selfCheckoff` mocked, `loaders/outreach` unmocked) were all confirmed
directly by reading the file, not assumed.

---

## 7. Commands run (representative; full logs in this session's scratchpad `/tmp/t190-*.log`)

```
git worktree add …/t190-work -b claude/t190-work claude/t190-placeholder-student
ln -s /home/user/volt_task_tracker_rewrite/node_modules node_modules
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .
npx vitest run
npx vitest run src/pages/outreach/OutreachList.test.tsx
git add src/pages/outreach/OutreachList.tsx src/pages/outreach/OutreachList.test.tsx
git commit -m "fix(T190): …"
git add src/pages/outreach/OutreachList.test.tsx
git commit -m "test(T190): …"
git diff -- src/pages/outreach/OutreachList.test.tsx | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'
git diff -U0/-U2 64abca7..HEAD -- src/pages/outreach/OutreachList.test.tsx
(mutation/revert cycles for C1–C5, each: edit → vitest run (capture exit code + FAIL list) → git checkout --)
```

---

## 8. Known risks

- The new `respondedBy` id-space gap in the other 9 `FIXTURE_RSVPS` rows (§4/Finding 3) is disclosed,
  not fixed — pre-existing, out of scope for this task's Allowed Files/§4.1 instruction, but real.
- C5 ships with no test coverage of its own (Finding 3) — a future change that regressed
  `respondedBy`'s shape again would not be caught by this suite. This mirrors T174's own honest
  finding for its file; unlike T174, no in-scope consumer exists here to test against.
- The new test (item 7, §5) is additive and passed at 108/108 with the full suite still at 1945/1945
  — no existing behavior was changed to make it pass.

## 9. Dispute

None. The packet was implementable as specified, with the two findings above (§6) reported rather
than acted on unilaterally beyond what §4.1/§4.3's own escape hatches already authorized.
