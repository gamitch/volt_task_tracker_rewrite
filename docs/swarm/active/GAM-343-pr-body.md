Closes GAM-343

Drives the full W2 outreach lifecycle in a real browser — coach creates an event, a student answers and changes their answer, the coach records the day and completes it — and proves the volunteer hours that come out the end are the ones those actions should have produced. Every write is read back from Postgres.

`WORKFLOWS.md` calls this the most-worked path in the project and still the most defect-dense. Its three worst rows were all silent: an RSVP that wrote nothing (T193), unchecking a student in Mark day complete doing nothing (T309), and a non-atomic completion that could not recover (T327). All three are fixed. **None had ever been watched working.** Now they have.

## Tier: HEAVY — stated and defended, per item 26

The deliverable is test-only, which argues STANDARD. But item 26's question is whether a mistake can corrupt data or lie to a user about their own data, and this artifact's whole value is an assertion about a **write path** and an **RLS policy**. A vacuous spec here is a false green certifying that hours are right when they are not — the same lie, laundered through a test. Item 26's tiebreak is explicit: when two tiers are arguable, take the heavier one. Full chain run: packet → premise gate ×2 → worker → checker.

## The premise gate earned its cost

`checker-premise` ran **8 probe specs in its own worktree** (item 23) against the live cluster and browser, and returned REVISE with 6 BLOCKERs. Four were things no amount of reading would have found:

- **The journey as first written was impossible.** Completing a session flips it to `completed`, and the Mark-day-complete trigger requires `scheduled` — so the "re-open and uncheck" step could never run. Measured `MARK DAY TRIGGER COUNT 0`.
- **AC 3 was unfalsifiable.** Checking the student in Expected attendees makes `computeExpectedAttendeeRsvpPlan` write her RSVP row **authored by the coach** at save time, so her later click is a no-op on an already-selected control.
- **Cleanup could not work.** `rsvps_session_id_fkey` is `ON DELETE RESTRICT`; the prescribed cascade raises `23503` and kills `beforeEach` on run 2.
- **AC 4's mutation could not go red.** The `UNIQUE (session_id, student_id)` constraint turns `.insert()` into `23505`, so the row-count assertion stays green — the detector had to be the *status*.

Round 2 returned **DISPATCH**, and proved it by driving the whole journey green end to end, twice. It also caught a defect my own blocker-fix introduced: a `11:59 PM` start made the session zero-duration, so AC 6 read `delta == label == 0` and would have passed with the entire attendance write path deleted.

## Three of the issue's own premises were stale, and are corrected

The issue says `loaders/outreach.ts` "treats a student's own `responded_by` as never a deletion candidate during completion fan-out." Two errors in one sentence: that protection was **T118's and T119 removed it** (`outreach.ts:1398-1441` — *"`selfAuthoredKeys` … is gone"*), and it is not completion fan-out at all — `markDayComplete` never touches `rsvps`. The issue also says the student answers "Going"; `RsvpControl` has no such label (`Sign up` / `Maybe` / `Can't go`, asserted at `RsvpControl.test.tsx:100`). The RLS constraint it names **is** real, with a nuance that decides the test: `staff_all` ORs in for coaches, so the denial only fires for a student actor.

## Verification

| Gate | Result |
| -- | -- |
| tsc | exit 0 |
| vite build | exit 0 |
| format:check | exit 0 |
| eslint | exit 0 — 0 errors, 378 warnings (`main` returns the same 378) |
| vitest (full) | exit 0 — 95 files / 2443 tests |
| vitest (scoped) | **SKIPPED** — zero `src/` files changed, so no derivable scope |

**Five gates, and I say five.** Persona suite: **28 passed, 5 failed** against a measured baseline of 27/5 — the +1 is this spec, and the 5 are pre-existing and unchanged.

All four mutations were run by the worker in its own worktree and **two were independently replayed by the checker**, which added a third of its own:

| AC | Mutation | Real red |
| -- | -- | -- |
| 2 | drop the `rsvps` upsert | `Expected: 1 / Received: 0` |
| 3 | send the coach's id as `respondedBy` | same UI signature + independent `psql` `42501` |
| 4 | upsert → `.insert()` | `Expected: "declined" / Received: "going"` — row count stayed 1, exactly as the gate predicted |
| 5 | `buildAttendanceAbsenceRows` → `[]` | `Expected: "absent" / Received: "present"` — T309's exact defect |

## The checker falsified the worker's "no findings"

The worker reported an empty findings array. `checker-reviewer` found that the run's **own committed screenshot** `77-coach-mark-day-complete-confirmed.png` shows `AttendancePanel` still rendering Jordan checked at 1.5 h *after* the spec's assertions proved him `absent` — the page contradicting the database in front of the coach who just wrote it. Confirmed in source, not inferred from a race: the panel's load effect keys on `sessionIdsKey`/`retryToken` and `reloadDetail()` never reaches it. MINOR, since every spec assertion goes to Postgres — but "we found nothing" was incomplete.

Filed to Backlog under item 20, because a finding in a PR body is not a record:

- **GAM-363** — attendance panel stale after completion
- **GAM-364** — RSVP buckets stale after save
- **GAM-365** — `playwright-report/` is gitignored but missing from `eslint.config.js`'s ignores, so running the persona suite turns the lint gate red with 1124 errors in Playwright's own report bundle

## What I am not claiming

The spec pins current behaviour on one path through ten page files; it does not cover parent RSVP-on-behalf, event-level completion, multi-session events, or the `/outreach` list view's own RSVP control. No production code changed. Gate 6 did not run.

Linear-Issue: GAM-343
