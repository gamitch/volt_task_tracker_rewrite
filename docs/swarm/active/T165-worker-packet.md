# T165 — worker packet v1: cover the untested exports of `loaders/outreach.ts`

**Tier: STANDARD** (constitution item 26). **Stated and defended:** test-only — **no production code
changes at all**. No write path is altered, no schema/RLS/auth, no signature change. It is **not
FAST**: this adds hundreds of lines across five distinct loader surfaces, which is nowhere near
FAST's "roughly ≤20 lines with a contained blast radius". Worker implements; the orchestrator replays
every mutation; no separate checker round.

**Branch:** `claude/t165-outreach-loader-coverage`, from current `main` **`b9742b8`**.

**Measure your own baseline.** For orientation, `outreach.test.ts` at `b9742b8` runs **19 tests,
exit 0**, and the full suite is **78 files / 1956 tests**. **Re-measure and report yours.**

---

## 1. THE LEDGER ROW'S NUMBERS ARE WRONG — measured, not argued

The row says *"21 of 23 exports untested"* and that T146 covers only
`makeLoadOutreachDetail`/`loadOutreachDetail`. **Both figures are stale.** Measured at `b9742b8`:

- **27 `export` statements, of which 9 are `type`/`interface`** → **18 value exports**, not 23.
- **7 are already exercised**, not 2 — T327, T402 and T406 all added coverage after this row was
  filed. In particular **`makeMarkDayComplete` is now heavily covered (13 references, two whole
  describe blocks)**, and the row names it as a target. **It is not one. Do not re-cover it.**
- **`loadOutreachData` is referenced but has ZERO call sites** — it is imported and named, never
  invoked. Being mentioned in a test file is not coverage. Check this for every symbol you count.

**The real remaining surface is FIVE symbols:**

| Symbol | At | Note |
|---|---|---|
| `computeExpectedAttendeeRsvpPlan` | `:1418` | **pure** — start here, it is the cheapest real coverage in the file |
| `makeSubmitRsvpChange` | `:1219` | single `rsvps` upsert |
| `makeSaveOutreachEvent` | `:1454` | **~200 lines, by far the largest** — carries T330's orphan-event work and its own `rsvps` upsert |
| `makeCancelOutreachEvent` | `:1657` | |
| `makeLoadOutreachEventRoster` | `:1698` | |

Their bare singleton bindings (`submitRsvpChange`, `saveOutreachEvent`, `cancelOutreachEvent`,
`loadOutreachEventRoster`, `loadOutreachDetail`, `loadGuardianLinksForParent`) are **one-line
`makeXxx()` calls**. Testing the factory is what has behavioural content. **Do not write a test whose
only content is that a singleton is defined** — that is a tautology, not a guard, and this packet
rejects it.

---

## 2. Allowed Files

```
src/lib/supabase/loaders/outreach.test.ts
```

**That is the ONLY file you may modify.** This task adds **no production code**. If you believe a
loader must change to be testable, **stop and report** — that is a finding, not a licence.

**Forbidden:** everything else, including `src/lib/supabase/loaders/outreach.ts` itself,
`loaders/attendance.ts` (W1's), `supabase/migrations/**`, `src/pages/**`.

**Do not fork a second test file.** Extend the existing one, as the ledger row requires.

---

## 3. Five existing blocks must survive BYTE-INTACT

`outreach.test.ts` already carries five describe blocks, every one of them mutation-proven by a
merged task. **Do not refactor, re-indent, deduplicate, or "tidy" any of them** while extending the
file:

| Line | Block | Why it is load-bearing |
|---|---|---|
| `:43` | `queryAllTeams … T146 select-string guard` | the only thing between a dropped `select` column and a green suite |
| `:127` | `asks the students table for profile_id …` (T157, **nested inside T146's block**) | same guard, other column |
| `:228` | `queryGuardianLinksWithRelationshipForParent … T157 select-string + filter guard` | |
| `:466` | `makeMarkDayComplete (T327) — completion write ordering` | attendance before flip, adult totals last |
| `:643` | `makeMarkDayComplete (T406) — narrowed write survives a concurrent scan` | the stateful fake and its union-of-keys semantics |
| `:951` | `queryAttendanceForSessions pagination (T402)` | |

**Prove they survived**: `git diff -- src/lib/supabase/loaders/outreach.test.ts | grep '^-'` must show
**no deletions inside those ranges**. Report the command and its output.

**Reuse, do not re-invent.** T406's stateful fake (`:643`ff) and T402's paging fake (`:951`ff) are
the established client-fake shapes in this file. Extend or copy their pattern rather than inventing a
third.

---

## 4. THE RISK THAT DEFINES THIS TASK

**A coverage task is exactly where vacuous tests get written.** This project has shipped at least
seven assertions that passed for the wrong reason, and **three separate criteria this session whose
named mutation did not actually remove the guard** (T401's row count, T190's C3, T300's C2).

So the rule is absolute:

> **Every test you add must name a mutation to the PRODUCTION file that turns it red, and you must
> RUN that mutation and paste the real red output.** A test you cannot redden is not coverage; delete
> it and say so.

Specifically forbidden as the *only* content of a test:
- asserting a function is defined / is a function;
- asserting only the **shape of a call** (`toHaveBeenCalledWith`) where the outcome is what matters —
  T406's C2 exists because a shape assertion proved nothing about the result;
- asserting a singleton binding exists.

**Report your mutation-to-test ratio.** If a test has no mutation, it does not ship.

---

## 5. What each target actually needs

**5.1 `computeExpectedAttendeeRsvpPlan` (pure).** Do this one first and thoroughly — pure functions
give the strongest guards per line. Cover the real branches (which students are added, which are
removed, what happens with an empty set), not just one happy path.

**5.2 `makeSubmitRsvpChange`.** One `rsvps` upsert under `{ onConflict: 'session_id,student_id' }`.

> **T157's standing warning, and it still applies:** `makeSubmitRsvpChange` is the mutation behind
> what was once an unreachable RSVP UI. **A green test here must NOT be read as evidence the feature
> is reachable from the UI.** Say so in a comment beside the block, so a future reader does not draw
> that conclusion.

**5.3 `makeSaveOutreachEvent` — the big one.** ~200 lines. It carries **T330's orphan-event
transactionality** (a failed session insert must not leave an event the coach cannot see) and its own
`rsvps` upsert. **Read T330's verification-log entry before writing anything here**, and do not write
a test that contradicts what T330 established.

**5.4 `makeCancelOutreachEvent`** and **5.5 `makeLoadOutreachEventRoster`.** Straightforward; cover
the error path as well as the success path.

**If the five do not fit in one sensible change**, cover them in the order above and **say plainly
which you did not reach.** Partial coverage honestly reported beats five shallow tests. **Do not pad
the count.**

---

## 6. Acceptance criteria

| # | Criterion | Mutation |
|---|---|---|
| **C1** | `loaders/outreach.ts` is **unmodified** | `git diff --stat -- src/lib/supabase/loaders/outreach.ts` must be **empty**; if it is not, this task has exceeded its scope |
| **C2** | Each of the five targets has at least one test that reddens under a named production mutation | run each; paste real red output |
| **C3** | The five existing blocks in §3 are byte-intact | the diff-grep in §3, output pasted |
| **C4** | `computeExpectedAttendeeRsvpPlan`'s branches are covered, not just one path | break one branch at a time; each must redden something |
| **C5** | No test asserts only that a symbol is defined or only a call shape | self-audit; list every test you wrote and the mutation that reddens it |

**C1 is the criterion that keeps this task honest.** A coverage task that quietly edits the code it is
covering is not measuring the shipped behaviour.

---

## 7. Harness facts — verify before writing

`outreach.test.ts` uses raw vitest with hand-rolled client fakes; **there is no
`@testing-library/react`** and `loaders/outreach` is **not** `vi.mock`ed — the tests inject a fake
client through each factory's `getClient` parameter. **Confirm that yourself.** Four consecutive
tasks in this project wrote criteria against an imagined harness, and on T309 a packet had two test
files inverted despite the trap being documented verbatim in both.

---

## 8. Required worker output

`docs/swarm/active/T165-worker-output.md`:

1. **Commit SHA**, plus proof the work is in the **committed blob** (item 21).
2. **All six gates** against your own measured baseline, `.env.local` absent. Assert the **exit code**
   of the targeted run.
3. **Every criterion in §6, run, with real red output pasted** — plus, for §4, **the full list of
   tests you added and the mutation that reddens each one.**
4. **Which of the five targets you reached**, and which you did not.
5. **Anything in this packet that is wrong.** This packet already corrected the ledger row's own
   numbers by measuring (23 → 18 exports, 21 → 11 untested, and `makeMarkDayComplete` wrongly listed
   as a target). Assume it carries its own errors. Finding one is a success, not an objection.
