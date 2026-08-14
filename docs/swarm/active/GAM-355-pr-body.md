Closes GAM-355

Five persona tests were written as witnesses to bugs. All three bugs shipped. The tests still asserted the broken behaviour, so they were red against a correct application — and one of them was red-or-green depending on which spec ran first.

| Test | Was asserting | Shipped fix that made it stale |
| -- | -- | -- |
| `coach-meeting.spec.ts:88`, `:115` | archived `Volt Legacy 2201` is offered in the scope picker | GAM-305 |
| `student-parent.spec.ts:27`, `:121` | hours render as a raw float | GAM-303 |
| `student-parent.spec.ts:66` | an RSVP "never reaches the database" | GAM-304 |

**No production file changed.** Two test files, 12 tests now green in isolation and inside the full suite.

## Tier: HEAVY, and here is the defence (item 26)

On file shape alone this reads STANDARD — two Playwright specs, no `src/**`. But the deliverable is not the task. The task was a **verdict on five red tests: stale or real**, and that verdict fails asymmetrically. Three of the five assert user-facing correctness this project has already been burned on: raw float hours shown to students and parents, and an RSVP control that wrote nothing while saying it did. Relabelling a *live* regression as "stale" edits the test until the suite is green over a defect that lies to a user about their own data. That is item 26's trigger question answered yes, one level of indirection out — and the issue's own body disclaimed its premise (*"Re-verify before acting"*), which is the paradigm case for item 19's gate. Item 26 also says take the heavier tier when two are arguable.

**The tier earned its cost twice over.** Details below.

## Re-verifying the premise changed the answer twice, in opposite directions

The first full-suite baseline said the filing was **wrong**: four of five named failures reproduced, `student-parent.spec.ts:66` *passed*, and two unfiled failures appeared. Running each spec in isolation on a fresh seed reversed that. `:66` fails; its full-suite green came from `outreach-lifecycle.spec.ts` creating an opportunity that took the slot `getByRole('button', {name:'Sign up'}).first()` grabs — so the click RSVP'd to a different session and "no write happened" was satisfied **by querying a row the user never touched**. The filing was right; the instrument was lying, which is worse than what was filed. The rewrite pins the click to the seeded event rather than to list position, and the checker proved the pin holds by watching a full-suite run where the foreign RSVP landed first and this one still hit the right session.

**The second reversal was mine.** My run log recorded `outreach-lifecycle.spec.ts:149` as *"a write path that records nothing … a candidate production defect."* The premise gate queried the database after a run where that line failed with `[]` and found the row present, exactly as the next two lines assert — the spec polls for the `events` row and then reads `rsvps` synchronously, racing a second write. A test-side race, not a product defect. Filing it as written would have put a nonexistent defect in the queue. The error is left standing in the run log rather than edited out.

## The mutation that changed the outcome

The checker passed the first commit with a MINOR and demonstrated it rather than argued it: with the hours formatter mutated to `(value / 2).toFixed(1)`, the page rendered **`3.2 / 100.0 h`** against a database value of **`6.4999991188888889`**, and **both rewritten hours tests stayed green**. The rewrite had kept the shape check and the not-the-raw-float check and dropped the positive screen-to-database comparison the old test had.

I graded that MAJOR and sent it back rather than accepting it as a follow-up. `6d1e7bf` adds `expect(label.split(' ')[0]).toBe(raw.toFixed(1))` on both surfaces. **The checker then re-ran the mutation itself and found a hole in the worker's proof** — the worker had mutated only `StudentHome.tsx`, and `ParentHome.tsx` carries a separate copy of the same format string, so that run never exercised the parent guard. Halving both turned both tests red at their own new lines, `Expected "4.0" / Received "2.0"`. The mutated string was `2.0 / 100.0 h (4%)`, which still satisfies both pre-existing assertions — so the failure landing on the new line, and only there, is what proves the addition carries the teeth.

## Where my packet was wrong and the worker was right

I specified a percentage matcher of `\d+%` from one observed render. The worker widened it to `\d+(\.\d)?%` and declared the deviation. It was correct — `hoursVsGoalPercent` is `Math.min(100, round1(...))`, so a decimal is reachable by construction, and `(6.5%)` was observed live. My own packet said "do not over-fit" two paragraphs after I had over-fitted a locator to a single observation.

The premise gate's round 2 also caught a wrong line number **inside the paragraph correcting the previous wrong claim**, plus an elided `student_id = '…'` in a prescribed `beforeEach` that would have failed all seven tests with an opaque uuid error. Item 19c's failure class, twice in a row, in a packet whose author had just written about it.

## Gates at `de00818`, clean tree

tsc 0 · vite build 0 · format:check 0 · eslint 0 errors (378 warnings) · vitest 95 files / 2443 tests exit 0 · scoped vitest **SKIPPED**.

**Five of six, and I am saying five** — gate 6 had no derivable scope because no `src/` file changed. No baseline for gate 5 and none is needed: `vite.config.ts` excludes `tests/e2e-personas/**` from vitest discovery, so this change cannot move that count by construction.

The eslint gate first returned 1124 errors, all inside `playwright-report/personas` — the HTML report the persona suite writes, gitignored but invisible to eslint's ignore config. Already tracked; not re-filed.

## The suite still exits 1, and that is expected

`36 passed / 2 failed`. Both failures are outside this branch's scope and were unfiled before this run; they now have rows of their own — a read-after-write race coupled to a hours-accounting spec, and a test pinning hardcoded calendar dates against a `current_date`-relative seed. See GAM-367 and GAM-368. Anyone reading "the persona suite is not green" as a regression from this branch should read those two first.

GAM-360 is this same issue filed twice, from a different run. It has a comment recommending it be treated as a duplicate; I did not change its state, since an agent should not close a row it did not work (item 28e).

## Record

Full run log: `docs/swarm/active/GAM-355-run-log.md` · packet and its two gate rounds: `docs/swarm/active/GAM-355-packet.md` · verification log entry appended in `de00818`.

Linear-Issue: GAM-355
