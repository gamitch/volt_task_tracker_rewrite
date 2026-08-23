# GAM-452 — worker packet (HEAVY), revision 2

**Issue:** GAM-452 — Assemble the redesigned meetings page.
**Branch:** `claude/gam-452-assemble-meetings-page`
**Tier:** HEAVY. Packet → `checker-premise` → worker → `checker-reviewer`.

Revision 2 folds in `checker-premise`'s round-1 REVISE (2 BLOCKER, 4 MAJOR,
7 MINOR, 2 NIT). **Round 1's §2 stated a false fact about shipped code and its
§3 asserted a seam that does not exist; both are corrected below.** Every line
citation in this revision was re-verified after the gate corrected four of mine.

Read `.claude/skills/meetings-design/SKILL.md` **first**. Where it and this
packet disagree, the skill wins and you say so. One stale citation in it:
`SKILL.md:155` says `ConsistencyStrip` is imported by `MeetingsList.tsx:602` —
that file is now 193 lines. The bullet's point still stands; the line does not.

---

## §0. What the issue got wrong — measured against `main`

**0a. `listGuardianChildren` does not exist and must not be built.** GAM-446's
own gate cut it (`src/lib/supabase/loaders/meetings.ts:216-220`:
*"`loadLinkedStudents`, `loaders/checkin.ts`, already provides this shape —
filed as GAM-472"*). The parent child-switcher **is already wired to the real
loader** on the real user path: `student/StudentMeetingsView.tsx:4` (import),
`:201` (default), `:274` (pass), `:126` (`useLoadState`), `:159`
(`<ChildSwitcher>`). **Action: none.**

**0b. `MeetingsList.tsx` has no `focusRequest` state** — 193 lines, role switch
+ seams + re-exports only. **Focus state goes in `CoachMeetingsView.tsx`.** The
rail and cards are coach-only; PRD MTG-01d (`:343-346`) scopes this to rail↔card
focus, and NAV-08's `/meetings/:sessionId` is recorded at PRD `:90` as never
built.

**0c. `--color-series-1…8` does not exist** (GAM-466 unmerged; `grep -rn
"color-series-" src/` → three prose comments only). Swatches render neutral with
`data-series-palette-index`. **Do not invent hex values.** Note
`auto-mode-decisions.md:4348-4350` claims GAM-444 pre-declared these slots in
`volt.ts` — **that decision record is stale and wrong**; trust the grep.

**0d. Attendance % — ESCALATED TO THE OWNER, do not decide this yourself.**
`v_event_attendance.attendance_pct` carries D014's inverted failure mode:
since T508 an unmarked student has no attendance row, so forgetting to mark
someone **inflates** the percentage — measured **100.0% for an event 60% of the
roster skipped**. The mitigation is rendering `graded_marks_ct` beside it, and
`types.ts:139-147` calls that *"mandatory whenever `attendancePct` is rendered"*.

You cannot do it: `SeriesCardModel` (`types.ts:302`) is frozen without the field
and `SeriesCard.tsx` belongs to merged GAM-447. GAM-460 owns the fix and sits in
`Backlog`.

**Interim, binding unless the orchestrator tells you the owner ruled
otherwise:** the model builder sets **`attendancePct: null`**, so the card
renders `—` (`SeriesCard.tsx:368`). Put a comment at that exact line of the
builder naming GAM-460 and D014 as the reason, so the next reader does not
"fix" it back to a passthrough. **Do not** pass the real number, and **do not**
widen the frozen type.

---

## §1. The one piece of genuinely new logic

`SeriesCardModel.scheduleChips` comes from `buildScheduleChips(rules)`
(`format.ts:328`), input `ScheduleRule = { dow: Dow; startMinutes; endMinutes }`
(`format.ts:241-248`).

**No stored recurrence exists** — the gate proved this: `public.events`
(`20260717000000_scheduling_attendance.sql:33-48`) has no recurrence column,
and `ScheduleMeetingsDialog` materialises dates and discards the rule. So the
rules must be derived from `row.sessions`.

- **Bucket by the stored Chicago values, never by re-deriving from the UTC
  instant.** `sessionDate` is already a Chicago calendar date — take `dow` from
  it via `parseDateOnly` (`format.ts:73`). The live trap is in the repo already:
  fixture `2026-07-22T23:00:00.000Z` is 6 PM CDT on `sessionDate '2026-07-22'`
  (`coachModel.ts:170-173`).
- `startMinutes`/`endMinutes` are minutes from Chicago midnight — derive via an
  `Intl.DateTimeFormat` pinned to `CHICAGO_TIME_ZONE` (`format.ts:47`).
- **You are reimplementing `formatChicagoWallTime`** (`ScheduleMeetingsDialog.tsx:793-805`,
  deliberately unexported per `:790`, used at `:1053-1064` and `:1164-1181`).
  Declare the new copy as a disclosed reimplementation in your report; the
  orchestrator files the unification follow-up.
- **Dedupe** to one rule per distinct `(dow, startMinutes, endMinutes)`,
  first-seen order. **Exclude canceled sessions.**
- **Midnight-spanning rules must be DROPPED, never clamped or fabricated.**
  `format.ts:217-220` says such a rule is unrepresentable; a 10 PM–1 AM session
  derives `{startMinutes: 1320, endMinutes: 60}` and `validateScheduleRule`
  (`:287-291`) throws a `RangeError` that `RouteErrorBoundary` turns into a
  whole-page error. The schedule form blocks creating one (`computeEndTimeError`,
  `ScheduleMeetingsDialog.tsx:579-588`) but `event_sessions` has **no**
  `check (ends_at > starts_at)` (`20260717000000:53-63`), so the data can exist.
  **Unit-test this case.**
- A session ending at Chicago midnight is `endMinutes: 1440`, not `0`
  (`format.ts:245-247`, `:308-309`).

Put the builder in **`src/lib/meetings/coachModel.ts`**, export it, unit-test it
there.

**Palette — inject, do not import.** Give the builder a
`paletteIndexFor: (eventId: string) => number` parameter and pass
`paletteIndexForEventId` (`MeetingsRail.tsx:279`) at the `CoachMeetingsView`
call site. Importing it directly would drag a page component — which does
`import './MeetingsRail.css'` (`:208`) and pulls in `@astryxdesign/core` — into
a pure model unit test. **Do not write a second hash** (GAM-476).

---

## §2. Active / Finished — reuse the shipped predicate, do not rewrite it

**Round 1 of this packet was wrong here.** `partitionCoachMeetingRows`
(`coachModel.ts:415-427`) already partitions on
`hasUpcomingSession = sessions.filter(s => s.status === 'scheduled').length > 0`
(`:378`, `:392`) — **exactly** the Active/Finished rule, already unit-tested for
the fully-canceled case at `coachModel.test.ts:250-264`. It is **not** a date
split. **Reuse it**; rename the buckets at the call site. Writing a second
predicate is the divergence class this repo has already paid for twice
(`formatWeekdayDate` → GAM-443; two palette hashes → GAM-476).

Header subtitle: `"N active series · M sessions in the next 7 days"` — plain
counts, Chicago calendar days, computed once at render, singular/plural handled.
**No countdown, no urgency copy** (item 17, BLOCKER).

---

## §3. Composition, focus wiring, and what is genuinely missing

Replace the `CoachMeetingsSection` call sites (`CoachMeetingsView.tsx:1607-1630`)
with a card grid of `<SeriesCard>` (`SeriesCard.tsx:382`), `<MeetingsRail>`
(`MeetingsRail.tsx:502`) beside it, and `<SchedulePanel>`
(`SchedulePanel.tsx:306`) as the drill-out.

**3a. Do not hand-build the grid or the splitter.** PRD MTG-01a (`:311-313`) is
binding: *"start from the installed Astryx `Card Grid` template … and adapt it —
do not hand-build the grid."* PRD MTG-01d (`:357-359`) adds the `Grouped Table`
template's resizable detail panel as the in-repo precedent for the rail split.
Try `npx astryx template <name>` first. **If the template does not emit against
the installed package, stop and report it** — that is a DES-21 escalation for
the orchestrator, not something you route around. The documented fallback is
Astryx `Grid`/`GridSpan` (`astryx-api.md:98-151`: *"Don't: write manual CSS grid
… Don't: use HStack with wrapping for grids"*). **Never hand-rolled CSS grid.**

**3b. Focus, end to end.** `MeetingsFocusRequest = { eventId; sessionId?;
monthKey? }` — frozen, do not reshape. Rail `onFocusChange` → `focus` state →
owning card `isSelected` → its `SchedulePanel` gets `focusRequest={focus}`. The
panel **already** opens that month tab and expands that session
(`SchedulePanel.tsx:363-378`, guarded on `focusRequest.eventId === eventId`), so
**only the scroll is new work**.

**Pair the scroll with real programmatic focus.** `StudentHome.tsx:1608-1615` is
the precedent and states why: `scrollIntoView` alone does not move focus, which
strands keyboard and screen-reader users. Item 15 makes a keyboard-path failure
on a core flow a **BLOCKER**. jsdom has no `Element.prototype.scrollIntoView` —
**stub it locally in your test file**; `src/test-setup.ts` forbids new global
mocks and is not in Allowed Files.

**3c. Season props — and the test harness they break.** `/meetings` **does**
render inside `<SeasonProvider>` in production (`App.tsx:74` →
`AppShell.tsx:158-168`; `/meetings` is absent from `CHROMELESS_PATTERNS`,
`:137-142`). **But `CoachMeetingsView.test.tsx:73-85` renders `<MeetingsList>`
with no provider, and `useActiveSeason()` throws outside one
(`SeasonProvider.tsx:217`) — every test in that 1279-line file would throw on
mount.** Wrap them with `<SeasonProvider loadActiveSeason={…}>` using the
injected seam, following `CalendarPage.test.tsx:154`/`:168`. **This is
authorised work under §6.** Pass `seasonStartsOn`/`seasonEndsOn` only when
`status === 'ready'`; pass `undefined` for `loading`/`none`/`error` and accept
the documented fallback (`computeNavWindow`, `MeetingsRail.tsx:334-341`).
Omitting them silently degrades season-bounded nav to session-span-bounded nav —
GAM-449's handoff comment exists to prevent exactly that.

**3d. Attendance — round 1 asserted a seam that does not exist.** There is **no**
attendance write seam on `MeetingsList`/`CoachMeetingsView`. The real ones are
`setAttendanceStatus` (`src/lib/supabase/loaders/attendance.ts:588`) and
`clearAttendanceStatus` (`:653`).

**And there is no roster producer at all.** `SchedulePanel` needs
`roster?: ReadonlyMap<string, readonly SessionRosterEntry[]>` (`:208-209`);
nothing in `src/lib/**` builds that shape, and `SessionRow.tsx:50` already
recorded the gap. Loaders are Forbidden here.

**Decision, taken at the planning layer so you do not discover it:** ship
**without** `roster`. `SessionRow.tsx:368-375`'s `"No roster recorded"` empty
state is the **intended** render. The tap-to-cycle chips are therefore **inert
this ticket**, `recordedBy` is still passed from `useAuth()` so the wiring is
real the moment a roster exists, and **item 27 makes this surface `Partial`, not
`Passed`.** The orchestrator files the roster-loader ticket. Say all of this in
your completion report.

**3e. Overlap.** Build the index once and pass it to rail, panel and card.
`overlap.ts:7-10` ships the exact call site — use it verbatim rather than
re-deriving the adapter:
`buildOverlapIndex(rows.flatMap((r) => r.sessions.map((s) => ({ ...s, eventId: r.eventId }))))`.
**Three badge sites only. No page-level banner** — owner ruling; adding one is a
defect, not a courtesy.

---

## §4. Teardown — and the one thing that must survive it

### The link that must not die (BLOCKER, round 1 got this wrong)

`CoachMeetingsView.tsx:938-944` is **T511's only entry point** to
`/meetings/live/:sessionId` — the file's own comment at `:915-918` says
`routePaths.meetingLiveSession` had zero call sites before it. `SessionRow.tsx`
renders **no** such link and is Forbidden.

**Render the Go-live link from `CoachMeetingsView` alongside each card/panel
session, and re-point the existing assertions' DOM queries.**
`CoachMeetingsView.test.tsx:1199-1245` (C1, C2, C3) **must stay green.** They
are explicitly **NOT** covered by the "test deleted because the surface is gone"
clause below. If you cannot keep them green without touching a Forbidden file,
**stop and report** — do not delete them.

### Delete

`CoachMeetingsSection`, `buildCoachMeetingColumns`, `CoachMeetingExpanderButton`,
`CoachMeetingRowActions`, `CoachMeetingDateCell`, `CoachMeetingTitleCell`,
`CoachMeetingSessionRow`, `renderMeetingSessionDetailCell`,
`sessionDetailAnchorId` — the gate confirmed **none is reachable outside
`CoachMeetingsView.tsx`** (the `sessionDetailAnchorId` hits in
`OutreachList.tsx:2415` are that file's own local copy).

Also delete, both used only inside `CoachMeetingSessionRow` and both **outside**
the range round 1 cited: `SESSION_STATUS_BADGE` (`:636`) and
`formatPastAttendanceSummary` (`:642`). Then the newly-unused imports: `StatCell`
(`:70`), `useIsNarrowViewport` (`:76`), `Table`/`TableColumn` (`:51`, `:57`) —
and `routePaths` (`:64`) **only if** the Go-live link above did not end up
needing it (it should).

**Leave in place and disclose:** `buildCoachMeetingTableRows`
(`coachModel.ts:433`) and `CoachMeetingTableRow` (`types.ts:281`) are in
`MeetingsList.tsx`'s back-compat block (`:84`, `:66`). After teardown that
re-export is their only importer. **Do not delete them** — that is a separate
decision about a public surface.

Migrate or retire affected tests **deliberately** and **count every removed or
changed assertion**; the number goes in your report. A test deleted because the
surface is gone is fine. A test deleted because it turned red is not.

---

## §5. DES-12 at the page level

All four states for the composed **coach** page: loading skeletons, error banner
+ retry, empty, populated. `useLoadState` (`CoachMeetingsView.tsx:652-681`)
gives you three branches. The empty state (`:1593-1605`) is **PRD DES-15
verbatim — its copy must not change.** The student branch already satisfies this
and is out of scope.

---

## §6. Allowed files

- `src/pages/meetings/coach/CoachMeetingsView.tsx` (+ `.test.tsx`)
- `src/pages/meetings/MeetingsList.tsx` (+ `MeetingsList.test.tsx`)
- `src/lib/meetings/coachModel.ts` (+ `coachModel.test.ts`)
- deletions of files under `src/pages/meetings/` orphaned by §4

**Forbidden:** `SeriesCard.tsx`, `SchedulePanel.tsx`, `MeetingsRail.tsx`,
`SessionRow.tsx`, `AttendanceChips.tsx`, all of `src/pages/meetings/student/`,
all loaders, `types.ts`, `format.ts`, `overlap.ts`, `src/test-setup.ts`,
`docs/swarm/**`, `.claude/**`, and `.github/workflows/**` (you cannot push it —
AGENTS.md wall 1). If a sibling's own test breaks, **disclose and stop**.

Explicit pathspecs only, never `git add -A` (item 22). No mutation experiments
in the shared tree (item 23).

---

## §7. Acceptance criteria

1. Rail agenda item → **one click** → owning card selected, panel open on the
   right month tab, session expanded, **scrolled into view and focused**.
   Asserted in a test with a **local** `scrollIntoView` stub.
2. `MeetingsRail` receives real `seasonStartsOn`/`seasonEndsOn` when the season
   is `ready`, `undefined` otherwise; `CoachMeetingsView.test.tsx` wrapped in
   `<SeasonProvider loadActiveSeason={…}>` per `CalendarPage.test.tsx:154`.
3. Active/Finished tabs **reuse `partitionCoachMeetingRows`**; the existing
   fully-canceled test still passes.
4. Subtitle renders real counts. **Pin the clock with `vi.useFakeTimers`** —
   fixtures are absolute July 2026, so "next 7 days" is 0 under a real clock.
   `CoachMeetingsView.test.tsx` already uses fake timers.
5. Schedule chips match `buildScheduleChips` for a two-weekday series with an
   en dash and collapsed meridiem. **Hand-build the row in `coachModel.test.ts`
   — no repo fixture is Tue/Sun** (`coachModel.ts:167-216` is Wed + Sat).
6. `attendancePct` renders `—` per §0d, and the builder comment names GAM-460.
7. Old table code grep-provably gone **except** the §4 Go-live link and the two
   disclosed back-compat exports; removed/changed assertion count reported.
8. A test asserts no **overlap-specific** page-level banner copy. Do **not**
   assert on `Banner` absence — the page legitimately renders feedback and
   DES-12 error banners (`:1582-1590`).
9. Page-level DES-12, all four states, coach role.
10. Six gates green via `/gate-run`; report the **commit SHA** (item 21).

**Report, do not self-certify.** Give the SHA, the assertion count, every
disclosure, and anything you were told to stop on.

---

## §8. Least confident decisions (item 19d)

1. **§0d's em-dash interim may be the wrong half of the trade.** Rendering `—`
   where real data exists conflates "withheld pending D014's mitigation" with
   the metric view's own "no completed sessions yet" — item 3's conflation,
   pointed the other way. It is wrong if the owner rules that a disclosed bare
   percentage is better than a value that looks like missing data.
2. **§4's "render the Go-live link from `CoachMeetingsView`" is my choice among
   three the gate offered**, and it is the one that keeps every file boundary
   intact. It is wrong if the link only makes sense on a session row, in which
   case the honest move is escalating to widen `SessionRow.tsx`.
3. **§3a assumes the Astryx `Card Grid` / `Grouped Table` templates actually
   emit** against the installed package. Neither I nor the gate could verify it
   (`node_modules` was absent for the gate). If they do not, §3a's fallback is a
   guess about what the PRD would want.
4. **§3d ships a user-visible control that does nothing.** Inert chips over a
   "No roster recorded" empty state is defensible under item 27 and indefensible
   under DES-12 if a coach reads the empty state as "nobody came". It is wrong
   if the right call was to not mount the panel's roster region at all.
5. **§1 drops midnight-spanning sessions from chip derivation.** Silent
   omission. It is wrong if such a series exists in real data, because then a
   card shows fewer chips than the series actually meets — a quiet lie rather
   than a loud crash. I chose the quiet failure because the loud one takes the
   whole page down via `RouteErrorBoundary`.

---

# §9. DISPATCH ADDENDUM — round 2's corrections. **This section outranks every section above it.**

`checker-premise` round 2 returned **REVISE (3 MAJOR, 8 MINOR, 6 NIT)** and
graded the remainder **category (b)**: *"none justifies burning the item-19a
escalation … orchestrator folds the corrections below into the dispatch message
and sends it, rather than a round 3."* Item 19a caps the gate at two rounds, and
both are spent. These corrections are therefore applied by the orchestrator
here, not by a third gate round.

**9a. Attendance % — §0d's em-dash interim is WITHDRAWN. Pass the real value.**

Round 2 proved my interim was the worse half of the trade, and it is right.
`PRD:312-313` (MTG-01a) binds: *"The attendance % is **DATA-01 passthrough**
from the metric view (null → '—'), never computed in TypeScript."* Constitution
item 1 puts a PRD requirement id above this packet. Emitting `null`
unconditionally would (i) break that binding requirement, (ii) reverse
GAM-446's already-passed delivered value at the assembly point, which the
Definition of Ready item 5 forbids without authorization I do not have, and
(iii) overload `SeriesCard.tsx:362-368`'s `null`, which that file's own comment
defines as *"no completed sessions yet … never conflated with 'no data'"*.

**So: `attendancePct: row.attendancePct ?? null` — a true passthrough.** Never
`?? 0`, never arithmetic. Put a comment at that line naming **D014** and
**GAM-460**: the `graded_marks_ct` mitigation that `types.ts:139-147` calls
mandatory cannot be rendered from a frozen `SeriesCardModel`, so this ticket
ships the percentage with that mitigation missing — a **disclosed, accepted
risk which the migration itself assigns to the consuming ticket**
(`20260821000000_meetings_event_attendance_view.sql:162-163`). The escalation
to the owner stays open; if the owner promotes GAM-460, that ticket removes the
risk. Disclose this prominently in your completion report.

**9b. `Grouped Table` does not exist. Do not look for it.** §3a's second
directive is deleted. Round 2 established this four separate ways in this
repository — `ParticipationTab.tsx:137-160`, `HoursTab.tsx:218-222`,
`EventsTab.tsx:228-232`, `CoachHome.tsx:21` (*"which does not exist anywhere,
CLI or installed"*) — and `/roster` and `/reports` have **no** resizable detail
panel. `PRD:357-359` is a **PRD defect**; report it, do not chase it.
Compose the rail split from Astryx `Grid`/`GridSpan` (`astryx-api.md:98-151`),
with shipped precedents in `HoursTab.tsx` and `CoachHome.tsx`. Never
hand-rolled CSS grid.
**`Card Grid` is different — it is verified installed** (GAM-441's gate ran
`astryx template --list`, `GAM-441-run-log.md:172`, `:203`). §3a's `Card Grid`
directive stands.

**9c. T511 — the danger is a vacuous green, not a red.** Corrected ranges: the
link is `CoachMeetingsView.tsx:938-949`; the T511 `describe` is
`CoachMeetingsView.test.tsx:1199-1279` (§4 truncated C3 by 33 lines).
`expandRow('Build Night')` — used by C1, C2, and inside **C3's `try/catch` at
`:1252-1257`** — clicks the coach-table expander this teardown deletes.
Re-point it at the new card-select → month-tab → session-expand path.
**If you do not, C3's `catch` swallows the failure and C3 goes vacuously
green** — the exact failure C3's own comment at `:1232-1240` records having
happened once already ("left this test green while turning 23 others red").
In C3, assert the coach fixture actually rendered **before** asserting the
absence of links.

**9d. No dead control ships — §3d and §8.4 were wrong on the fact.** With
`roster` undefined, `SessionRow.tsx:368-375` **returns** the "No roster
recorded" empty state *instead of* the roster rows, so `AttendanceChips`
(`:398`, `:412`) never mounts. Say it that way, not "inert chips".
**Wire the seams anyway** — `SchedulePanel` already declares
`onSetAttendanceStatus` (`:204`), `onClearAttendance` (`:207`) and `recordedBy`
(`:229`). Pass all three now from `loaders/attendance.ts:588`/`:653` and
`useAuth()`. Three lines, and the roster ticket then needs no edit here.

**9e. Two criteria added, one made non-vacuous.**
- **Criterion 8 rewritten:** using a fixture containing at least one genuine
  cross-series overlap pair, assert the three badge sites render **and** that
  no overlap-specific copy appears at page level. Do not assert on `Banner`
  absence (`:1582-1590`) — feedback and DES-12 banners are legitimate.
- **Criterion 11:** a `coachModel.test.ts` case proving a 10 PM–1 AM session
  yields no chip and throws nothing (§1 required the test; no criterion pinned
  it).
- **Criterion 12:** `nextSessionLabel`, `sessionsCompleted`/`sessionsTotal` and
  `teamScopeLabel` match MTG-01a's literal example (`PRD:306-308`). Round 2
  found five `SeriesCardModel` fields specified by nothing.

**9f. Criterion 7's grep caveat.** `SESSION_STATUS_BADGE` is **also** exported
by `EventsTab.tsx:491` and pinned green by `EventsTab.test.tsx:258-259`. Scope
criterion 7's grep to `src/pages/meetings/**`; that hit is not yours.

**9g. Citation fixes** (round 2 re-verified every line and found these):
`auto-mode-decisions.md:4348-4350` → `:4345-4346`; `coachModel.ts:392` → `:393`;
`coachModel.ts:167-216` → `:167-217`; `CoachMeetingsView.tsx:915-918` →
`:916-936`; `PRD:90` → `:89`; §3a's quote begins `PRD:310`. GAM-449's handoff
comment is `MeetingsRail.tsx:57-71`.

**9h. The preamble's SKILL.md note was itself wrong.** `MeetingsList.tsx` has
**zero** `ConsistencyStrip` references — that importer is gone entirely, not
renumbered — and `ParentHome.tsx` imports it at `:396`/`:400`. `.claude/**` is
Forbidden for you; the orchestrator owns that fix.

**9i. Precedents to copy rather than invent.** The jsdom stub pattern is
already in your own test file — `CoachMeetingsView.test.tsx:31-46` scopes an
`HTMLDialogElement.showModal` gap with exactly the "not `src/test-setup.ts`"
reasoning. And `formatChicagoWallTime` is the **third** copy already
(`ScheduleMeetingsDialog.tsx:788-789` cites `OutreachList.tsx:1660-1665` and
`OutreachDetail.tsx:1449`), so yours is the fourth — say "fourth" in the
disclosure.

**9j. Tooling limit, stated because it lands on you.** `node_modules` was
absent for **both** gate rounds. No gate has been able to run `npm ci`, the
vitest suite, or `astryx template --list` against this packet. **You are the
first to execute anything here.** A template that fails to emit is a
stop-and-report, not a route-around.
