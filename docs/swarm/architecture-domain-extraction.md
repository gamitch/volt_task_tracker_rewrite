# Domain extraction — scope, complexity, and schedule

**Status: proposal. Not triaged, no rows filed, nothing reserved.** This document exists to let
the owner decide whether the work is worth doing and when. If the answer is yes, the phases in
§6 become rows in `task-ledger.md` under W10's block (T1300–T1399) or are distributed to the
owning workflows per §7.

Written 2026-08-05 by W1, against `main` @ `dcd0dae`. Every number below is measured, not
estimated; the commands are given so they can be re-run when the tree moves.

---

## 1. The question this answers

> *"If I wanted to update the UI with different aesthetics and components, but keep the overall
> same business logic, do we have that separated in a good way to make that possible?"*

Two different questions wear that one sentence, and they have opposite answers.

**Re-theming** — different colours, type, corner radius, spacing — is already solved. It is one
file, `src/theme/volt.ts`, ~50 lines, from which the 311 CSS custom properties in
`src/theme/theme.css` are generated. Nothing in this document is required for that.

**Replacing the component library** — Astryx out, something else in — is currently blocked, and
this document is about the specific thing blocking it.

---

## 2. What blocks it

60 files import `@astryxdesign/core` — 50 under `src/pages/`, 6 under `src/components/`, 4 under
`src/app/`. That number is large but honest, and it is not the problem.

The problem is that **you cannot delete a page file and write a new one beside it**, because the
data layer reaches *up* into the presentation layer for both types and runtime functions. Deleting
`pages/outreach/OutreachList.tsx` breaks `lib/supabase/loaders/outreach.ts`. Deleting
`pages/meetings/MeetingsList.tsx` breaks `loaders/meetings.ts` at runtime, not just at `tsc`.

So a component swap is not "write new pages, flip the router, delete the old ones." It is
in-place surgery on 42 files — one of them 4,496 lines — where each rewrite must carefully preserve
a set of exports that something else depends on. That is the expensive shape, and it is the shape
we would be buying our way out of.

### The dependency inversion, measured

26 import statements in `src/lib/supabase/loaders/` resolve into `src/pages/`. **19 are type-only;
7 are runtime.** The runtime seven are the load-bearing ones — a type-only edge disappears at build
time, a runtime edge is a real module dependency:

| loader | imports at runtime from |
|---|---|
| `checkin.ts` | `buildConsistencyStripData` ← `meetings/StudentMeetingView` |
| `kiosk.ts` | `buildCheckinUrl`, `KIOSK_REFRESH_INTERVAL_SECONDS` ← `meetings/Kiosk` |
| `meetings.ts` | `buildCoachMeetingRows`, `buildStudentMeetingsData` ← `meetings/MeetingsList` |
| `parentHome.ts` | `buildNextEventsForStudent` ← `home/ParentHome` |
| `reports.ts` | `buildDisplayRows` ← `reports/ParticipationTab` **and** `reports/EventsTab` |
| `settings.ts` | `isValidThemeMode` ← `settings/SettingsPage` |

Reproduce with:

```
grep -rn "from '\.\./\.\./\.\./pages" src/lib/supabase/loaders/*.ts | grep -v test
```

### What is downstream of those edges

The reason the loaders reach upward is that the business logic lives in the page files:

| | count | note |
|---|---|---|
| Exported functions in non-test page files | **280** | across 34 files |
| Lines of those function bodies | **2,924** | ~6.6% of the 44,287 non-test page lines |
| …that contain **no** JSX and **no** React hooks | **274 of 280** | the six exceptions are listed in §5 |
| Exported types/interfaces in page files | **387** | across 39 files |

These are not view helpers. A representative sample from `home/CoachHome.tsx` (2,844 lines,
28 exported functions): `sumGoalHours`, `attendanceRatePercent`, `goalProjectionPercent`,
`crossedMilestones`, `buildActivityFeed`, `isSessionCheckInEligible`, `pickBusiestDay`. From
`outreach/OutreachList.tsx` (4,496 lines, 25 exported functions): `computeStudentHours`,
`deriveExpectedStudentIds`, `sumPeopleReached`, `confirmedPercent`, `computeEventRowStats`.

That is the domain model of the application. It is sitting inside files whose other job is to
render Astryx components.

---

## 3. What is already right

Worth stating plainly, because it changes the cost of the whole exercise. The hard parts of this
architecture were done correctly and do not need revisiting:

1. **No component talks to the database.** Of 42 non-test page files, exactly **one**
   (`pages/no-access/NoAccessPage.tsx:182-185`) constructs its own loader inline. The other 41
   receive `loadX` / `onY` function props with defaults wired in `src/lib/supabase/loaders/`
   (23 files, 10,894 lines). The dependency-injection seam that most projects never build is
   already here and already used by every test.

2. **The lib layer is UI-free.** One Astryx import exists in the entire `src/lib/` tree:
   `src/lib/eventTypeBadge.ts:18`, `import type { BadgeVariant }` — a string union, not a
   component. (`src/lib/supabase/auth.ts` mentions Astryx only in a comment explaining why it
   deliberately declares `ThemeMode` locally instead of importing it — T148 got this right.)

3. **The pattern already has precedent in-repo.** Two features already keep their types in a
   sibling module rather than in the page file: `pages/accept-invite/types.ts` (75 lines) and
   `pages/no-access/types.ts` (62 lines). This proposal is not a new idea being imported from
   outside; it is the generalisation of a decision this codebase has already made twice.

---

## 4. Why this is much cheaper than it looks

Three measured reasons.

### 4.1 The functions are already pure

274 of 280 exported page functions contain no JSX and call no React hooks. They are already
free-standing — they merely live in the wrong file. The move is `cut`, `paste`, fix the import
path. It is not a rewrite, and it is not a design exercise: the design was already done, just
filed in the wrong drawer.

### 4.2 The tests are already domain tests

This is the finding that most changes the estimate. Across the 42 page test files:

```
1,500  it() blocks
  843  render() calls
41,493 lines
```

**0.56 render calls per test.** Several of the largest are near-pure logic suites wearing a
`.test.tsx` extension:

| test file | `it()` | `render()` | lines |
|---|---|---|---|
| `outreach/OutreachList.test.tsx` | 108 | 66 | 3,792 |
| `home/CoachHome.test.tsx` | 103 | 46 | 2,236 |
| `meetings/MeetingsList.test.tsx` | 84 | 40 | 2,363 |

We already own a domain test suite. It does not need to be written, and it does not need to be
rewritten — it needs its import paths updated and, ideally, its file split in two. Which means
**the extraction is guarded by 1,500 existing assertions from the first commit onward.** A move
that breaks behaviour goes red immediately. This is as close to a safe refactor as this codebase
is capable of producing.

### 4.3 The work partitions along the existing workflow boundaries

This was the surprise. `src/domain/outreach/` would be carved out of `pages/outreach/*` and
consumed by `loaders/outreach.ts` — **both already W2's files.** The same holds nearly everywhere:

| domain module | carved from | consumed by | owning workflow |
|---|---|---|---|
| `domain/outreach/` | `pages/outreach/*` | `loaders/outreach.ts`, `leaderboard.ts` | W2 |
| `domain/meetings/` | `pages/meetings/*` | `loaders/meetings.ts`, `endMeeting.ts`, `kiosk.ts` | W3 |
| `domain/home/` | `pages/home/*` | `loaders/coachHome.ts`, `parentHome.ts` | W5 |
| `domain/reports/` | `pages/reports/*` | `loaders/reports.ts` | W4 |
| `domain/roster/` | `pages/roster/*` | `loaders/students.ts`, `teams.ts`, `parents.ts`, `invites.ts` | W7 |
| `domain/checkin/` | `pages/checkin/*`, `Kiosk.tsx` | `loaders/checkin.ts`, `kiosk.ts` | W1 |
| `domain/calendar/` | `pages/calendar/*` | `loaders/calendarFeed.ts` | W6 |
| `domain/settings/` | `pages/settings/*` | `loaders/settings.ts`, `seasons.ts` | W2/W10 |

This is not a cross-cutting sweep that has to freeze the tree. It is eight mostly-independent
rows that the machines can take in parallel inside the file ownership they already hold.

---

## 5. Why it is still not free

The honest column.

**A. Six functions are not pure.** `meetings/MeetingsList.tsx` has 2 exported functions returning
JSX; `meetings/Kiosk.tsx` has 3 calling hooks; `no-access/NoAccessPage.tsx` has 1 returning JSX.
These stay in the presentation layer — they are components with lowercase names, not domain logic.
They need to be identified and *not* moved, which means the extraction cannot be done by a blind
regex. Any worker packet must name them explicitly as exclusions.

**B. Five page→page imports cross feature directories.** Of 34 page→page imports, 29 are
same-directory composition (a shell importing its tabs, a page importing its dialogs) and are
fine. Five cross features:

| edge | kind | verdict |
|---|---|---|
| `outreach/OutreachList` → `meetings/MeetingsList` | type-only | resolves itself once types move to `domain/` |
| `home/StudentHome` → `meetings/MeetingsList` | type-only | same |
| `settings/SettingsPage` → `calendar/SubscribePopover` | runtime, **component** | legitimate reuse — leave alone |
| `home/CoachHome` → `outreach/Leaderboard` | runtime, **component** | legitimate reuse — leave alone |
| `home/ParentHome` → `meetings/StudentMeetingView` | runtime, **mixed** | `ConsistencyStrip` is a component (leave); `selectLastCompletedAttendance` is a pure function (move) |

Only the last one needs a judgement call, and it is a small one.

**C. `loaders/attendance.ts` is already a known collision magnet** across W1/W2/W3
(`WORKFLOWS.md:36`). Any phase touching it needs the usual coordination, not a parallel dispatch.

**D. The transition style is a real decision.** Two options, and they have different risk profiles:

- **Shim** — move the function to `domain/`, leave a `export { x } from '../../domain/...'`
  re-export in the page file. Every step is tiny and nothing outside the moved file changes. But
  the inversion technically survives until a cleanup pass deletes the shims, and cleanup passes
  are exactly the kind of thing that gets skipped.
- **Cut** — move the function and update all importers in the same commit. Bigger diffs, no
  lingering debt, and `tsc --noEmit` proves completeness at every step.

I recommend **cut**, for the reason that makes this codebase's constitution what it is: a shim
that is never removed reads as done while leaving the original failure in place. With 1,500
existing tests and a strict compiler, the bigger diff is not meaningfully riskier.

**E. This does not by itself re-skin anything.** It makes the re-skin possible. Sequencing it
immediately before a component swap is worth much more than doing it now and swapping in six
months, because the value is in the option it creates, and options decay.

---

## 6. Proposed phases

Ten rows. Sized so each is one worker packet, tiered per constitution item 26.

| # | Row | Tier | What | Files touched |
|---|---|---|---|---|
| 0 | Scaffold | **FAST** | Create `src/domain/`, its README stating the one rule (*domain imports nothing from `pages/` or `@astryxdesign`*), and an ESLint `no-restricted-imports` rule enforcing it. Rule lands first so every later phase is machine-checked. | 3 new |
| 1 | `domain/checkin` | STANDARD | `CheckinResult`, `Kiosk`, `StudentMeetingView`, `LiveConsole` logic + types. Excludes Kiosk's 3 hook-using fns. Unblocks `loaders/checkin.ts`, `kiosk.ts`. | ~10 |
| 2 | `domain/meetings` | STANDARD | `MeetingsList` (2,685 ln), `EndMeetingDialog`, `ScheduleMeetingsDialog`. Excludes MeetingsList's 2 JSX fns. Touches `attendance.ts` — coordinate. | ~10 |
| 3 | `domain/outreach` | **HEAVY** | Largest by far: `OutreachList` (4,496 ln, 25 fns), `OutreachDetail`, `OutreachEventDialog`, `AttendancePanel`, `MarkDayCompleteDialog`, the two `*Complete` dialogs, `ParentRsvp`, `RsvpControl`, `Leaderboard`. Worth splitting into 3a/3b if a worker stalls. | ~20 |
| 4 | `domain/home` | STANDARD | `CoachHome` (28 fns), `StudentHome`, `ParentHome`. Resolves the `selectLastCompletedAttendance` cross-edge from §5B. | ~10 |
| 5 | `domain/reports` | STANDARD | `HoursTab`, `EventsTab`, `ParticipationTab`. Note the two same-named `buildDisplayRows` — aliased at the import site today, must be disambiguated at the definition site. | ~8 |
| 6 | `domain/roster` | STANDARD | `StudentsTab`, `TeamsTab`, `ParentsTab`, `InvitesTab`, the two dialogs. | ~12 |
| 7 | `domain/calendar` + `domain/settings` | STANDARD | Small; bundled. `CalendarPage`, `SubscribePopover` types, `SettingsPage`, `SeasonSettings`. | ~8 |
| 8 | Test split | STANDARD | Split each `*.test.tsx` into `domain/**/*.test.ts` (logic) and `pages/**/*.test.tsx` (render). Mechanical, but this is where the 41,493 test lines get their permanent home. Can be folded into 1–7 instead — see §8. | ~40 |
| 9 | Close the loop | **FAST** | `NoAccessPage`'s inline loader → `loaders/`. Assert zero `pages/` imports under `lib/`, and turn that assertion into the CI check that keeps it true. | ~4 |

**Row 3 is HEAVY** not because it is dangerous but because it is large enough that a worker will
be tempted to summarise rather than finish, and the premise gate is what catches an incomplete
move before it lands.

**Acceptance criterion, every row.** Same for all of them, which is why this is cheap to specify:

> After the move, `npx tsc --noEmit` exits 0 and `npm test` exits 0 with no change to the
> assertion count. **Mutation:** delete any single moved function's body and replace with
> `throw new Error('x')` — at least one test must go red at a non-zero exit code. A row where
> every moved function can be gutted at exit 0 has moved dead code, and that is a finding about
> the row, not a pass.

---

## 7. How fast

The controlling constraint is not total work, it is that rows 1–7 are independent.

**Serial, one machine:** rows 0 and 9 are an hour together. Rows 1, 2, 4, 5, 7 are half-day
STANDARD packets each. Row 6 slightly more. Row 3 is a day on its own, possibly split. Row 8
depends on the choice in §8. That is roughly **4–5 working days** of one machine's attention.

**Three machines, partitioned per §4.3:** rows 1–7 have almost no file overlap, so:

```
day 1   row 0 (any machine, ~1h)  →  then rows 1, 2, 3 dispatched in parallel
day 2   rows 4, 5, 6 in parallel  ·  row 3 likely still running
day 3   row 7, row 9, and whatever of row 3 remains
```

**Realistically 2–3 days wall-clock** with the current three-machine setup, assuming rows land
and merge the same day they are dispatched — which has been this project's actual cadence.

The two things that would blow that estimate:

- Row 3 (`outreach`) proving to be more entangled than the function-purity scan suggests. Mitigate
  by dispatching row 3 **first**, on day 1, so a bad surprise surfaces while there is still
  schedule to absorb it.
- Trying to run this concurrently with feature work in the same files. Don't. These rows rewrite
  import blocks in nearly every page file; anything rebasing across them will conflict constantly.
  **This wants a quiet window, not a freeze** — the machines can still work, just not in `pages/`.

---

## 8. Two decisions for the owner

**1. Does row 8 (test split) happen inside rows 1–7, or after?**

*Inside* means each feature row moves its functions and its tests together, and the tree is never
in a half-state. It makes each row noticeably bigger — row 3 would carry `OutreachList.test.tsx`'s
3,792 lines with it.

*After* keeps the moves small and reviewable, at the cost of a window where `pages/*.test.tsx`
imports from `domain/` — which is legal and harmless, just untidy.

My recommendation: **after**, as its own row, and accept the untidy window. The moves are the risky
part and they should be reviewed without 40,000 lines of test churn in the same diff.

**2. Do we do this at all right now?**

The case for now: it is unusually cheap for what it unlocks (274 pure functions, 1,500 tests
already guarding them, partitions cleanly across the machines), and every feature row that lands
in the meantime adds more logic to the wrong files. The case for later: it delivers no user-visible
change, and W1–W7 still have open functional rows that do.

The case for *never* is weak, but real: if the Astryx component library is not actually going to be
replaced, this buys an option nobody exercises. **The honest trigger is a decision about Astryx,
not a decision about architecture.** If a component swap is genuinely on the table for this season,
do this first and do it now. If it is not, this belongs in AUDIT-TRIAGE as a known, quantified,
deliberately-deferred debt — which is a perfectly good place for it to sit, and the reason this
document leads with measurements rather than a recommendation.

---

## 9. Reproducing the measurements

```
# 26 loader→page edges, and the 7 that are runtime
grep -rn "from '\.\./\.\./\.\./pages" src/lib/supabase/loaders/*.ts | grep -v test

# 60 files importing Astryx (50 pages / 6 components / 4 app); exactly 1 under src/lib
grep -rl "@astryxdesign" src/pages src/components src/app | wc -l
grep -rn "^import.*@astryxdesign" src/lib/

# exported page functions, and how many are JSX/hook-free
grep -rn "^export function [a-z]" src/pages --include='*.tsx' | grep -v '\.test\.' | wc -l

# test suite shape
grep -rho "\bit(" src/pages --include='*.test.tsx' | wc -l
grep -rho "\brender\w*(" src/pages --include='*.test.tsx' | wc -l
```
