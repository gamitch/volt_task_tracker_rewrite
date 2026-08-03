# T500 — worker packet

**Row:** T500 (filed by W2 from T330's merge; targets W4-owned files) · **Tier: HEAVY** ·
**Branch:** `claude/t500-adult-volunteer-hours-filter` off `origin/main` (`2a8f237`)

## Scope — read this first, it is narrower than the row's own wording invites

Fix **only** the double-count: an event with **zero sessions** contributes its adult-volunteer
figures to the season totals. **Do not** change which *kinds* of event count.

**Why that boundary is hard.** The orchestrator's premise check found that including
non-outreach / `counts_volunteer_hours = false` events in these totals is **deliberate and
spec-compliant**, not a bug:

- **RPT-03** (`VOLT_Portal_PRD.md:370`) reads, in full: *"season totals for people reached and
  adult volunteers (count and hours)."* **Unqualified.** Constitution item 1 puts PRD requirement
  IDs above everything else.
- Module doc #6 (`HoursTab.tsx:134`) cites RPT-03 as its ground truth for summing "across every
  event this task's `loadData` returned for the given season".
- The fixture says so explicitly (`HoursTab.tsx:764-766`): *"proves … (b) season totals do NOT
  silently drop non-outreach events (module doc #6)"*.
- The existing green test is named *"sums adult volunteers across all event types"*
  (`HoursTab.test.tsx:327`).

Narrowing that scope is a **product question put to the owner as its own row — T702, now FILED in `task-ledger.md`** (it did
not exist when the premise gate read this packet; that was its MAJOR-1). It is not this task's to
decide. **A worker who "helpfully" filters on `countsVolunteerHours` or `type` here
is reversing a documented design decision and a literal spec reading.** Do not.

## The defect

`buildSeasonTotals` (`HoursTab.tsx:593-596`) reduces over **every** event, and `queryHoursEvents`
(`reports.ts:401-411`) filters on `season_id` alone. Event and session creation is **not
transactional** — that is T330's whole finding, now merged: a failed session insert leaves an event
row behind. A coach then retries successfully, producing a second event row carrying the **same**
adult-volunteer figures. Both are summed, so the season total double-counts a thing that happened
once.

T330 made the orphan visible and editable (Upcoming, pinned, "Needs dates" badge). **It did not
correct this arithmetic** — that deferral is why this row exists.

**An event with zero sessions did not happen.** Its adult-volunteer figures are aspirational or
orphaned, and they must not land in a season total that is used for grant reporting.

## Prescription

`buildSeasonTotals` **already receives `sessions`**, and `HoursSessionRow` carries `eventId`. So
this needs **no loader change and no new query** — the whole fix is local to that one function:

- Build the set of event ids that have at least one session.
- Sum `adultVolunteersCount` / `adultVolunteerHours` over only those events.
- Leave `peopleReachedTotal`, `sessionsMissingHeadcountCount` and `totalSessionCount` untouched —
  they are already session-derived and are not implicated.

Update module doc #6 to record the new predicate and why (T500, sessionless events excluded),
since that doc currently states the unfiltered behaviour as ground truth.

## Allowed files — nothing else

```
src/pages/reports/HoursTab.tsx          (buildSeasonTotals + module doc #6)
src/pages/reports/HoursTab.test.tsx     (new coverage)
```

**Do not touch** `src/lib/supabase/loaders/reports.ts` — no loader change is required, and adding
one widens the blast radius for no benefit. **Do not touch** `src/pages/outreach/**` (W2's) or any
migration.

## The harness — open it before writing a criterion

`HoursTab.test.tsx` already has `describe('buildSeasonTotals -- module doc #6')` at `:326`, running
against `defaultLoadHoursData`'s `FIXTURE_EVENTS` (`HoursTab.tsx:745-776`). **All three fixture
events have sessions**, so the existing assertions (`adultVolunteersCount` 6, `adultVolunteerHours`
18) are **unchanged by this fix and must stay green.** Constitution Non-Negotiables: existing tests
must pass unless the owner approves a test update. **You do not have that approval — if your change
turns `:327` red, you have done something wrong.**

**The existing fixture cannot prove this fix.** Every event in it has a session, so it exercises
neither branch of the new predicate. You must add a **new** sessionless event to a local fixture in
the test (not to `FIXTURE_EVENTS`, which other tests depend on) and assert its figures are excluded.

## Acceptance criteria — each names a mutation that turns it red

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | A sessionless event's adult figures are excluded from both totals | Revert `buildSeasonTotals` to the unfiltered reduce → the new test must FAIL on both `adultVolunteersCount` and `adultVolunteerHours` |
| 2 | The double-count scenario is fixed end to end | Build two events with identical figures where one has sessions and one does not; assert the total counts them once. Reverting the filter must FAIL it. |
| 3 | Events **with** sessions are still fully counted, regardless of type or `countsVolunteerHours` | Change the predicate to also filter on `countsVolunteerHours` or `type` → a test asserting the `meeting` event with sessions still contributes must FAIL |
| 4 | The pre-existing contract is untouched | `HoursTab.test.tsx:327` stays green **without editing it**, and `peopleReachedTotal` / `sessionsMissingHeadcountCount` / `totalSessionCount` are unchanged |

Criterion 3 is the guard against over-fixing. **A criterion whose mutation leaves the suite green is
not evidence — report that instead of shipping it.**

## What the premise gate measured that changes how you work

The gate BUILT this prescription and ran every mutation. It DISPATCHed the engineering unchanged —
`tsc` 0, `vite build` 0, `eslint` 0 errors, **1950/1950 tests pass**, and `HoursTab.test.tsx:327`
stays green **unedited**. Four things it found that you must not rediscover the hard way:

- **Do not trust `:327` as your over-fixing guard.** Its name says *"across all event types"*, but the
  gate mutated the predicate to filter on `countsVolunteerHours`, and separately on
  `type === 'outreach'`, and **`:327` stayed GREEN both times** — the fixture's meeting event is
  `0/0`, so it cannot detect the very regression its name advertises. **Criterion 3 is the only real
  guard.** (Filed as T703; do not fix it here.)
- **Split criterion 1 into two `it`s.** A single test halts at its first failed `expect`, so one test
  cannot demonstrate both `adultVolunteersCount` and `adultVolunteerHours` going red. The gate had to
  split them to observe both.
- **A canceled-only event still counts, and that is intentional here.** The predicate is "has a
  session", not "has a non-canceled session", so an event whose only session is `'canceled'` keeps
  contributing. Pre-existing, conservative (it can never under-report), and **out of scope** — it is
  recorded on T702. Note `HoursSessionStatus` is `'scheduled' | 'completed' | 'canceled'`
  (`HoursTab.tsx:319`) — one `l`.
- **The one real under-report vector is imported data.** `scripts/migrate/transform.ts` maps events
  and sessions independently, so an imported event that genuinely happened could carry real adult
  figures with zero session rows and would now be silently excluded. No agent can check this — say so
  in your report, and record that the owner should run, at cutover:
  ```sql
  select id, title from events
  where (adult_volunteers_count > 0 or adult_volunteer_hours > 0)
    and id not in (select event_id from event_sessions);
  ```

## Six gates, `.env.local` ABSENT — assert exit codes, not just counts

```
npx tsc --noEmit ; echo $?
npx vite build ; echo $?
npm run format:check ; echo $?
npx eslint . ; echo $?        (0 errors; report the warning count and explain any rise)
npx vitest run ; echo $?
npx vitest run src/pages/reports/HoursTab.test.tsx ; echo $?
```

Branch point `2a8f237`. Re-measure and report real numbers — `main` moves hourly with three other
machines merging.

## Rules

Item 22 — stage named paths only, never `git add -A`. Item 23 — your own worktree; **commit before
mutating**. Item 21 — report the commit SHA; the orchestrator verifies HEAD moved and that the
change is in the committed blob. You do **not** self-certify completion. If the packet is wrong,
contradictory, or impossible, **say so** rather than quietly picking a side.
