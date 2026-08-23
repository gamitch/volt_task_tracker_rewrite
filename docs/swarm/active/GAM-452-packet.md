# GAM-452 — worker packet (HEAVY)

**Issue:** GAM-452 — Assemble the redesigned meetings page.
**Branch:** `claude/gam-452-assemble-meetings-page`
**Tier:** HEAVY (write path + attendance figures on screen + deletion of a
shipped surface). Packet → `checker-premise` → worker → `checker-reviewer`.

Read `.claude/skills/meetings-design/SKILL.md` **first**. It is the frozen
contract six sibling tickets already coded against; where this packet and that
skill disagree, the skill wins and you say so rather than following this file.

---

## §0. What the issue got wrong — corrections measured against `main` today

The issue body is from 2026-08-21. Four of its claims are now false. **These
corrections are binding; do not implement the issue's version.**

**0a. `listGuardianChildren` does not exist and must not be built.** The issue
says "wire real loaders: … `listGuardianChildren`". GAM-446's own premise gate
cut it: `src/lib/supabase/loaders/meetings.ts:216-220` records *"a second
`listGuardianChildren` loader (`makeLoadLinkedStudents`/`loadLinkedStudents`,
`loaders/checkin.ts`, already provides this shape — filed as GAM-472)"*.
`grep -rn listGuardianChildren src/` returns exactly that comment and no
definition. The parent child-switcher **is already wired** to the real
`loadLinkedStudents` at `src/pages/meetings/student/StudentMeetingsView.tsx:4`
and `:201`. **Action: none.** Do not add a loader; do not rename the existing
one.

**0b. `MeetingsList.tsx` has no `focusRequest` state.** The issue's file table
claims the decomposition left one there. It did not — the file is 193 lines and
holds only the role switch, the seam defaults and the back-compat re-exports.
**Put the focus state in `CoachMeetingsView.tsx`, not the shell.** The rail and
the cards are both coach-only; lifting focus into the role switch would thread
coach state through the student branch that can never use it.

**0c. The series palette does not exist yet.** `--color-series-1…8` is GAM-466,
which has not merged (`grep -rn 'color-series-' src/theme/` → no matches).
Per GAM-449's handoff, swatches render neutral and carry
`data-series-palette-index` until it lands. **Do not invent hex values** — the
skill calls that "a blocker to raise, not a gap to fill".

**0d. `SeriesCardModel` has no `gradedMarksCt` field and you must not add one.**
GAM-460 (Backlog, *related*, not a blocker) wants `graded_marks_ct` rendered
beside `attendance_pct`. `CoachMeetingRow` carries `gradedMarksCt?: number`
(`types.ts:149`) but `SeriesCardModel` (`types.ts:329-…`) deliberately does not.
The type is frozen by GAM-444 and a sibling codes against it. Render the card
from the frozen model, leave `gradedMarksCt` to GAM-460, and **disclose it** in
your completion report as a known gap.

---

## §1. The one piece of genuinely new logic — read this before estimating

`SeriesCardModel.scheduleChips` must come from `buildScheduleChips(rules)`
(`src/lib/meetings/format.ts:328`), whose input is
`ScheduleRule[] = { dow: Dow; startMinutes: number; endMinutes: number }`
(`format.ts:241-248`).

**`CoachMeetingRow` does not carry `ScheduleRule[]`, and nothing in the
repository derives one.** Verified: `grep -n ScheduleRule src/lib/meetings/*.ts`
finds only the type, its re-export and `buildScheduleChips` itself.
`buildRecurrenceChips` (`format.ts:158`) is a *different* output shape
(`"TUE (12)"`) and is not a substitute.

So the model builder you write must derive the rules from
`row.sessions[].{sessionDate, startsAt, endsAt}`:

- **Bucket by the stored Chicago values, never by re-deriving from the UTC
  instant** (skill: "A session stored at 11 PM Chicago is the *next day* in
  UTC"). `sessionDate` is already a Chicago calendar date — take `dow` from it
  via `parseDateOnly` (`format.ts:73`), which is the module's own noon-anchor
  idiom.
- `startMinutes`/`endMinutes` are minutes from Chicago midnight, so format
  `startsAt`/`endsAt` **through an `Intl.DateTimeFormat` pinned to
  `America/Chicago`** — `CHICAGO_TIME_ZONE` is exported at `format.ts:47`.
- **Dedupe** to one rule per distinct `(dow, startMinutes, endMinutes)` triple,
  preserving first-seen order. A 38-session Tue/Sun series yields two chips.
- **Exclude canceled sessions** from rule derivation. A fully-canceled series
  has no chips and is Finished (§2).
- `buildScheduleChips` **throws** on an invalid rule (`validateScheduleRule`).
  Do not feed it a rule where `endMinutes <= startMinutes` — a session ending at
  Chicago midnight is `1440`, not `0`. Cover this with a test.

Put the builder in **`src/lib/meetings/coachModel.ts`** (it is the existing home
of the pure `CoachMeetingRow` builders and already has a test file), export it,
and unit-test it there. Call `paletteIndexForEventId`
(`src/pages/meetings/coach/MeetingsRail.tsx:279`) for `paletteIndex` — **do not
write a second hash** (GAM-476; a second hash gives a series one color on its
card and a different one in the legend beside it).

`attendancePct` is `row.attendancePct ?? null` — **passthrough**. Never `?? 0`,
never computed in TypeScript (constitution item 3, BLOCKER).

---

## §2. Active / Finished

`TabList`. **Active = the series has ≥1 session with `status === 'scheduled'`.**
A fully-canceled series is Finished (recorded ruling, and the skill agrees:
"A series with no scheduled sessions remaining is Finished").

This is **not** the same partition as the existing `partitionCoachMeetingRows`
(`coachModel.ts`), which splits Upcoming/Past by date. Do not reuse it for the
tabs; write the predicate explicitly and test the fully-canceled case.

Header subtitle: `"N active series · M sessions in the next 7 days"` — plain
counts, Chicago calendar days, computed once at render. **No countdown, no
urgency copy** (constitution item 17, BLOCKER). Singular/plural handled.

---

## §3. Composition and the focus wiring

Inside `CoachMeetingsView`, replace the `CoachMeetingsSection` table rendering
(currently `CoachMeetingsView.tsx:1605-1632`) with:

- a card grid of `<SeriesCard>` (`coach/SeriesCard.tsx:382`), one per row in the
  selected tab, fed from your new builder;
- `<MeetingsRail>` (`coach/MeetingsRail.tsx:502`) beside it;
- `<SchedulePanel>` (`coach/SchedulePanel.tsx:306`) as the drill-out for the
  selected card.

**Focus, end to end** (`MeetingsFocusRequest = { eventId; sessionId?; monthKey? }`,
frozen — do not reshape):

`MeetingsRail.onFocusChange(request)` → store in `focus` state →
the owning `SeriesCard` gets `isSelected` → its `SchedulePanel` mounts with
`focusRequest={focus}` → the panel already opens that `monthKey`'s tab and
expands that `sessionId` (its `focusRequest` prop, `SchedulePanel.tsx:222-224`)
→ **scroll it into view.** The panel does not scroll; that is yours. One click
from the agenda item must reach an expanded, visible session.

**Pass `seasonStartsOn`/`seasonEndsOn` to `MeetingsRail`.** They are optional,
so omitting them compiles and silently degrades season-bounded calendar nav to
session-span-bounded nav — GAM-449's handoff comment on the issue says so in as
many words. `CalendarPage.tsx:570` is the in-repo precedent: `useActiveSeason()`
returns a `SeasonRow` with `startsOn`/`endsOn`. **That hook throws outside a
`<SeasonProvider>`**, so read it in `CoachMeetingsView` behind whatever the
router already provides and pass the values down as props — and if no provider
wraps `/meetings`, **stop and say so** rather than omitting the props silently.

`SchedulePanel` needs `recordedBy` (the acting coach's `profiles.id`) or **every
attendance chip renders disabled** rather than writing with a fabricated
identity. Get it from `useAuth()`. Wire `onCancelSession`, `onEditSession` (to
the existing `handleEditRequest`/`EditMeetingSessionDialog`) and the attendance
write seams that already exist on this view.

Overlap badges come from `buildOverlapIndex` (`src/lib/meetings/overlap.ts:28`)
— build the index once from every row's sessions and pass it to **both** the
rail and the panel, and the per-series count to the card. **Three sites only.
No page-level banner** — owner ruling; adding one is a defect.

---

## §4. Teardown

Delete the old table rendering and everything that becomes unreachable:
`CoachMeetingsSection`, `buildCoachMeetingColumns`, `CoachMeetingExpanderButton`,
`CoachMeetingRowActions`, `CoachMeetingDateCell`, `CoachMeetingTitleCell`,
`CoachMeetingSessionRow`, `renderMeetingSessionDetailCell`,
`sessionDetailAnchorId`, and their now-unused imports and helpers
(`CoachMeetingsView.tsx:684-1261`).

**Check every export before deleting it.** `MeetingsList.tsx:58-104` re-exports
a large back-compat surface for 11 external importers, and
`buildCoachMeetingTableRows`/`CoachMeetingTableRow` may be among them. `grep`
for each name across `src/` before removal; if something outside
`src/pages/meetings/**` still imports it, **leave it and disclose**, do not
chase the edit into a file this packet does not allow.

Migrate or retire the affected tests **deliberately**, and **count each removed
or changed assertion** — the number goes in the completion report. A test
deleted because the surface is gone is fine; a test deleted because it turned
red is not.

---

## §5. DES-12 at the page level (the one constraint)

Loading skeletons, error banner + retry, empty state, populated — **for the
composed coach page as a whole**, not per component. `useLoadState`
(`CoachMeetingsView.tsx:657`) already gives you the three branches; the empty
state (`:1592-1604`) is PRD DES-15 verbatim and **its copy must not change**.
The student branch already satisfies this (`student/StudentMeetingsView.tsx`)
and is out of your Allowed Files.

---

## §6. Allowed files

- `src/pages/meetings/coach/CoachMeetingsView.tsx` (+ `.test.tsx`)
- `src/pages/meetings/MeetingsList.tsx` (+ `MeetingsList.test.tsx`)
- `src/lib/meetings/coachModel.ts` (+ `coachModel.test.ts`) — the new builder
- deletions of files under `src/pages/meetings/` that this teardown orphans

**Forbidden:** `SeriesCard.tsx`, `SchedulePanel.tsx`, `MeetingsRail.tsx`,
`SessionRow.tsx`, `AttendanceChips.tsx`, everything under
`src/pages/meetings/student/`, all loaders, `src/lib/meetings/types.ts`,
`format.ts`, `overlap.ts`, and `.github/workflows/**`. If a sibling component's
own test breaks, **disclose it and stop** — do not fix it from here.

Do not run `git add -A` (item 22). Do not mutate the shared tree for an
experiment (item 23); the orchestrator replays mutations.

---

## §7. Acceptance criteria

1. Rail agenda item → **one click** → owning card selected, its `SchedulePanel`
   open on the right month tab, the session expanded **and scrolled into view**.
   Asserted in a test.
2. `MeetingsRail` receives real `seasonStartsOn`/`seasonEndsOn`, or the packet's
   §3 escalation is raised instead.
3. Active/Finished tabs partition by "has ≥1 scheduled session", with a test for
   the fully-canceled series.
4. Subtitle renders `"N active series · M sessions in the next 7 days"` from
   real counts.
5. Schedule chips on a card match `buildScheduleChips` output for a Tue/Sun
   series (`Tue 6–8 PM`, `Sun 3:30–6:30 PM`) — en dash, collapsed meridiem.
6. `attendancePct === null` renders `—`, and a real `0` renders `0%`.
7. Old table code is **grep-provably gone**; removed/changed assertions counted.
8. A test asserts **no page-level overlap banner** exists.
9. Page-level DES-12: all four states for the coach role.
10. Six gates green (`/gate-run`), and the report states the commit SHA
    (item 21).

**Report, do not self-certify** (constitution: no worker marks its own work
complete). Give the SHA, the assertion count, and every disclosure.

---

## §8. Least confident decisions (item 19d)

1. **Deriving `ScheduleRule[]` from sessions (§1) is invented here.** No
   sibling ticket froze it and no precedent exists. It would be wrong if
   `buildScheduleChips` was never intended to be fed from sessions at all — if
   MTG-01a expects the rules to come from the *schedule form's* stored
   recurrence rather than being reverse-engineered from materialised rows. If
   `events` carries a recurrence column I did not find, this whole section is
   the wrong approach.
2. **Focus state in `CoachMeetingsView`, not `MeetingsList` (§0b),** contradicts
   the issue's own file table. Wrong if some other consumer — a route, a deep
   link, the student view — is expected to set focus, in which case the shell is
   the right home after all.
3. **`useActiveSeason()` is reachable from `/meetings` (§3).** I verified the
   hook exists and throws outside its provider; I did **not** verify that
   `/meetings` renders inside `<SeasonProvider>`. If it does not, criterion 2 is
   unsatisfiable as written and the rail silently degrades — which is exactly
   the failure GAM-449 wrote its handoff comment to prevent.
4. **Active = "≥1 scheduled session" (§2)** treats a series whose only remaining
   sessions are in the past but still `status: 'scheduled'` as Active. That may
   read as wrong on screen (a series that ended in June sitting under "Active"
   because nobody marked it complete). The date-based alternative disagrees with
   the recorded ruling, so I followed the ruling — but this is the call I would
   most like challenged.
5. **The teardown list in §4 is derived from a function-name outline, not from
   an import graph.** If any of those names is reachable from outside
   `src/pages/meetings/**` through `MeetingsList.tsx`'s back-compat re-exports,
   deleting it breaks a module this packet never names.
