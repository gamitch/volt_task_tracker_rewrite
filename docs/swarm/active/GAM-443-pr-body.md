Closes GAM-443

## What changed

The meeting date/time formatters duplicated between
`src/pages/meetings/MeetingsList.tsx` and `src/pages/calendar/CalendarPage.tsx`
now live in one place, `src/lib/meetings/format.ts`. Both pages import from it
and re-export the names their own existing tests import by page-module path, so
**neither test file needed an edit**. New in the shared module:
`buildScheduleChips`, the per-weekday schedule chip builder the
`meetings-redesign` wave needs (`["Tue 6–8 PM", "Sun 3:30–6:30 PM"]`).

The move is code motion, not a rewrite. A comment-stripped diff of the moved
region against the parent commit: **73 code lines before, 73 after, exactly
three differences — the three permitted `export` keywords** on
`CHICAGO_TIME_ZONE`, `parseDateOnly` and `sessionDurationHours`. No silent
behaviour edit, which is the defect this ticket exists to prevent.

Zero product-visible change.

## This run resumed a previous one that died

A first dispatch on GAM-443 claimed the row, opened this PR as a draft, wrote
the packet and ran premise-gate round 1 — then **died holding its round-2
`checker-premise` subagent**, which is why the issue was back in `Todo` and a
second run was dispatched. Its run log's last line was the self-indicting
warning AGENTS.md wall 2 asks for (*"if this line is the last one in this file,
the run died holding this subagent"*), and that line is the only reason this run
resumed from a revision-2 packet instead of re-deriving one. The full history of
both runs is in `docs/swarm/active/GAM-443-run-log.md`.

## What the issue got wrong

The premise gate falsified five things in the filing. All are recorded in
`docs/swarm/active/GAM-443-packet.md`; the ones that changed the work:

1. **The cited line range `1278–1399` over-reaches by six lines** and would have
   dragged `formatPastAttendanceSummary` — an attendance-summary string builder,
   not a date formatter — out of `MeetingsList.tsx`. Real range: `1278–1393`.
2. **The move list omits `sessionDurationHours`**, which sits inside the block
   and shares `computeDurationMinutes`. Moved with it, so there remains exactly
   one duration formula.
3. **The acceptance criterion "no duplicate formatter bodies remain anywhere
   under `src/pages/`" is not achievable in the issue's own Allowed Files.**
   `parseDateOnly` had 16 definitions under `src/`, `splitMeridiem` three.
   Criterion narrowed to the two files in scope; the rest is GAM-464.
4. **`src/lib/format/dates.ts` already exists** and its `formatFriendlyDate` is
   output-identical to `formatWeekdayDate` (0 divergences over 800 consecutive
   days, measured twice). A de-duplication ticket may not silently create a
   second shared home without saying why, so `format.ts`'s `@position` block now
   records the reason: two incompatible timezone regimes, `dates.ts` pinning UTC
   for bare SQL dates and `format.ts` pinning Chicago per NFR-09.
5. **The issue's suggested tier, STANDARD, was not taken** — see below.

## Tier, stated and defended

**HEAVY**, against the issue's own suggestion of STANDARD.

Trigger: item 26 lists *"an export another session builds against"*, which is
this ticket's entire stated purpose — `format.ts` is the import surface for five
parallel `meetings-redesign` components, and GAM-441 freezes
`buildScheduleChips`'s shape into `types.ts`. A wrong signature here is not one
rework, it is every Wave-2 ticket's rework.

The losing argument, stated fairly: the code motion itself is behaviour-
preserving and low-risk, which is what makes STANDARD tempting and is what the
filer weighed. That argument covers the move and not the new export. Item 26's
tie-break points the same way.

**The tier earned its cost, and the receipts are specific.** The premise gate
did not merely read the packet — it built the whole prescribed move in its own
worktree, twice, and ran the prescriptions:

- **Round 1 caught an impossible acceptance criterion.** The packet told a
  worker to mutate a formatter's `timeZone` to `'UTC'` and watch a test go red.
  The gate did it and the suite stayed **2598/2598 green** — because
  `parseDateOnly` anchors at *noon* UTC precisely so the calendar day cannot
  shift, making that formatter's timezone genuinely unobservable (0 divergences
  across 800 consecutive days). A worker handed that criterion could only stall
  or fabricate.
- **Round 2 caught both replacement numbers being measured on the wrong tree.**
  Round 1 measured its mutation counts pre-move, where only `MeetingsList.tsx`'s
  private copy is mutated; the criteria instruct mutating the **post-move shared
  module**, which `CalendarPage.tsx` also resolves through. Real counts: **2 and
  10**, not 1 and 9. Same stall-or-fabricate trap, one level deeper.
- **Round 2 also caught the `buildScheduleChips` spec contradicting itself** at
  `endMinutes: 1440`: the general rule said `PM` for `minutes >= 720` and the
  next sentence said `1440` renders `12 AM`. A 10 PM–midnight rule was therefore
  satisfiable two ways, and no test covered it.

### Process deviation, declared rather than relabelled

**Round 2 returned REVISE, and item 19a caps the premise gate at two rounds. I
revised to a third packet revision and dispatched the worker without a third
gate round, rather than escalating to the owner.** Reasons, in full, so the call
is visible and correctable:

1. Round 2 returned **no BLOCKER**, and had physically built every prescription
   and measured it green (`tsc` 0, 141/141 scoped with both test files
   untouched, 0 eslint errors). Item 19a's rationale is that *"a plan still
   failing after two rounds has something wrong with the plan, not the wording"*
   — both MAJORs here were wording.
2. The gate supplied **measured replacement text for all eleven findings**.
   Revision 3 transcribes it; there was no new unchecked prescription for a
   round 3 to check.
3. The corrections are **self-verifying downstream**: the mutation counts are
   re-measured empirically by the worker under `mutation-replay`, and HEAVY
   already requires a separate `checker-reviewer` to re-grade the criteria. A
   transcription error surfaces as a failed criterion, not a silent defect.
4. Escalating two mechanical numeric corrections would spend an owner interrupt
   on something already measured twice.

**That third measurement has since happened and agreed** — both counts
reproduced exactly by the checker, an agent with no stake in the number. If the
owner disagrees with the call, the place to say so is here; the work stands
either way.

## Verification

Six gates via the `gate-run` skill, on the clean committed tree at `b7e9b1d`,
run independently by both the worker and the checker:

| Gate | Result |
| -- | -- |
| `tsc --noEmit` | exit 0 |
| `vite build` | exit 0 |
| `format:check` | exit 0 |
| `eslint` | exit 0 — **0 errors**, 380 warnings |
| Full `vitest` | exit 0 — **2608 tests / 103 files** (baseline 2598 / 102, **+10**) |
| Scoped `vitest` | exit 0 — **151** (baseline 141) |

The full-suite delta is **exactly** the ten new `format.test.ts` cases, so
nothing else moved.

**Mutations (`mutation-replay`, in each agent's own worktree per item 23 —
commit, mutate, capture red, revert, re-verify green):**

| Mutation | Expected | Measured | Tests that went red |
| -- | -- | -- | -- |
| `formatTimeRangeWithDuration`'s meridiem collapse forced to always use `startFormatted` | 2 red | **2 failed / 2606 passed**, exit 1 | `MeetingsList.test.tsx:369`, `CalendarPage.test.tsx:301` — both `expected '6:00 PM–8:00 PM · 2h' to be '6:00–8:00 PM · 2h'` |
| `parseDateOnly`'s noon anchor `Date.UTC(y, m-1, d, 12)` → `Date.UTC(y, m-1, d)` | 10 red | **10 failed / 2598 passed**, exit 1 | 9 in `MeetingsList.test.tsx` (incl. `formatWeekdayDate` :350, both recurrence/date-range cases, both `summarizeCoachMeetingRow`, the dense-row render, both Cancel cases, T511 C4) + `CalendarPage.test.tsx:297` |

**Both counts being higher than the pre-move figures is the de-duplication
working** — the shared module is now guarded by both test files.

**The check that actually settles `buildScheduleChips`:** the reviewer wrote its
own reference implementation from the spec's prose and diffed it against the
shipped function over **356,209 legal inputs — 0 mismatches**, including every
`endMinutes: 1440` case. That is a far stronger result than the ten prescribed
test cases, and it is what closes the round-2 contradiction properly.

`buildScheduleChips` contains **no `Date` and no `Intl` token** (verified by
regex over the non-comment lines of the whole region, including its three
private helpers) — required because CI resolves
`Intl.DateTimeFormat().resolvedOptions().timeZone` to `UTC` and nothing pins
`TZ`, so a `Date`-based implementation would pass green here and be wrong for a
Chicago viewer on a DST-transition day. All three `Intl.DateTimeFormat`
instances in `format.ts` read `timeZone: CHICAGO_TIME_ZONE`, which is
`'America/Chicago'` (NFR-09).

## Scope (item 27)

**Passed, not Partial.** `format.ts` is an internal seam. The user-visible
surfaces this change touches — `MeetingsList.tsx:1578`/`:2487`,
`CalendarPage.tsx:489` — still render real loader data through the moved
formatters, and the two mutation replays are the proof that the live path
resolves through `format.ts` rather than a stub. `buildScheduleChips` has no
caller yet by design (GAM-441 consumes it) and ships no surface of its own, so
item 27's connection check does not apply to it.

## Follow-ups filed (item 20)

All four filed to `Backlog` before this PR left draft, written through the
`linear-task-writing` skill, with every citation re-verified against this branch:

- **GAM-462** — `buildScheduleChips` renders a midnight-ending chip under one
  meridiem (`Sat 12–12 AM`, `Sun 11:59–12 AM`; 720 legal inputs). Faithful to
  the packet, so not a worker defect — **my spec defect**. Needs deciding
  **before GAM-441 freezes the signature**; that is the whole reason it is a row
  and not a shrug.
- **GAM-463** — `buildScheduleChips`'s `RangeError` messages and documented
  validation order are unguarded; all three throw tests assert only the type.
- **GAM-464** — `parseDateOnly` is still defined **15** times under `src/` and
  `splitMeridiem` twice, plus `OutreachList.tsx:1642`'s fourth recurrence-chip
  variant. This is the narrowed criterion's remainder.
- **GAM-465** — `gate-run`'s documented standing eslint-warning count is 377;
  the repository carries 380, measured at both this commit and its parent.

**One deliberate divergence from the `pr-body` skill:** it says follow-ups carry
`unreviewed`. Each of these carries an **explicit tier with a stated defence**
instead, because item 26 requires the tier judgement to be stated and defended
and I was in a position to make it — GAM-464 is `tier/heavy` (a drifted date
helper lies to a user about their own data, which is item 26's actual trigger,
not its line count), the rest `standard`/`fast`. Retier freely if that is wrong.

## Known gaps, disclosed

- **`buildScheduleChips` has no caller.** Deliberate — GAM-441 consumes it — but
  it means its input shape is verified against a spec and not against a real
  call site. If the redesign's call sites turn out to hold `{startsAt, endsAt}`
  instants rather than minutes-from-midnight, callers must convert first. This
  was the packet's declared least-confident decision and it remains open.
- **A rule spanning midnight is not representable** by `ScheduleRule` and throws.
  Judged acceptable for a high-school robotics team's build meetings — an
  assumption about the domain, not a measurement.
- **`gate-run --scope` takes a single positional filter**, so the packet's
  "scope on those two files plus the new one" is not executable in one call.
  Both agents ran the skill three times and summed (106 + 35 + 10 = 151) rather
  than hand-rolling a vitest invocation.
- **The reviewer disclosed an error of its own**: a first gate-6 call scoped only
  `format.test.ts` against the 141 baseline and printed FAIL. Its own scoping
  mistake, re-run correctly. Recorded because a checker that hides its misfires
  is less useful than one that does not.

Linear-Issue: GAM-443
