# GAM-448 task packet — month-tab `SchedulePanel` with in-place attendance editing

Tier: **HEAVY** (item 26 — write path + destructive operation).
Worker model: **opus override NOT required.** Item 18's four triggers are
migrations, RLS/`security definer`, metric-view SQL, and auth/session/role
logic. This packet touches none: it adds three presentational components under
`src/pages/meetings/coach/` that *call injected function props*. Item 25's
second obligation is explicit that a topic sounding sensitive is not a trigger.
Tier stays the pinned default; the checker round is what catches call-site
errors here.

---

## §0. What the orchestrator measured before writing this, and what it changes

Every claim below was read from `main` at branch point `8b4cbcd5`. Four of the
five contradict the issue.

**0a. `SchedulePanel` has no caller, and that is correct.** `grep -rn
"SchedulePanel" src/` matches only its own file. **GAM-452** ("Assemble the
redesigned meetings page — wire cards, panel and rail together") is the wiring
ticket and is still `Backlog`. Consequence: **this task closes `Partial` under
item 27, not `Passed`**, with GAM-452 as the named wiring row. Do not attempt
to wire it — `CoachMeetingsView.tsx` is forbidden below.

**0b. Adding optional props to this stub is authorized precedent, not a freeze
violation.** GAM-447 shipped exactly this reasoning for the sibling stub, in
`SeriesCard.tsx:9-14`: *"`SeriesCard` has no callers anywhere in the tree yet
… which is why this file is safe to add additive, optional props to without a
freeze violation."* Follow it: **every prop you add is optional.** A required
prop would put an obligation on GAM-452's unwritten caller.

**0c. The roster the chips need does not exist on `main`.** The frozen
`CoachMeetingSessionDetail` (`src/lib/meetings/types.ts:78-103`) carries
`attendeeNames: readonly string[]` — display names of *present/late* students
only. **No `studentId`. No per-student status. No absent or excused students.**
`makeSetAttendanceStatus` requires a `studentId`, so nothing on `main` can
address a chip write. GAM-471 independently records that `student_teams` has no
writer on `main` to build a roster from. **Do not widen
`CoachMeetingSessionDetail`** — the `meetings-design` skill forbids reshaping a
frozen type and `types.ts` is outside Allowed Files. Instead the roster arrives
as an **optional injected prop** typed locally (§2, `SessionRosterEntry`), and
the loader that fills it is a filed follow-up.

**0d. The Overlap badge cannot be built here.** `src/lib/meetings/overlap.ts`
and `buildOverlapIndex` **do not exist** — GAM-450 owns them and is `Backlog`.
Accept an optional `overlapIndex?: OverlapIndex` prop (the *type* is frozen and
real, `types.ts:350-356`) and render the badge only when it is supplied. **Do
not write your own overlap builder** — that duplicates a frozen name.

**0e. ⚠ The issue names the wrong write seam, and using it would ship a lie.**
The issue says to wire `makeOnEditAttendance` (`loaders/endMeeting.ts:489`).
That factory emits a bare `UPDATE attendance … WHERE session_id AND student_id`
(`:496-499`) **with no insert path**, and `types.ts:143` records that since
T508 an unmarked student normally has **no attendance row at all**. Correcting
an unmarked student through it updates zero rows *and resolves successfully* —
the optimistic chip would show the new status and the database would keep
nothing. It is also documented at `:476-488` as deliberately unreachable by
owner ruling T601.

> **Every chip write goes through `makeSetAttendanceStatus`**
> (`loaders/attendance.ts:506-528`) — a real upsert on
> `onConflict: 'session_id,student_id'` that deliberately omits
> `hours_override` so an existing coach-set override survives a status change.
> `makeOnEditAttendance` is **not** used by this task.

**0f. ⚠ THE `meetings-design` SKILL IS NARROWER THAN THE PRD, AND THE PRD
WINS.** Constitution item 1 puts PRD requirement IDs above every other
document, and the skill's own preamble says so: *"Where the two disagree, the
PRD wins and this file is the bug — say so rather than following it."* Round 1
of the premise gate found four places where following the skill would have
shipped a defect. **Code against MTG-01g (`docs/swarm/VOLT_Portal_PRD.md:370-384`),
not against the skill's summary of it:**

- **The cycle has FIVE stops, not four.** MTG-01g:382 verbatim: *"Cycle order
  is Present → Late → Excused → Absent → (unset), `Shift`-activation
  reverses."* `(unset)` means **removing the attendance row**, and the seam for
  that already exists: `makeRemoveAttendance` / `RemoveAttendanceFn`
  (`loaders/attendance.ts:544-562`). Inject it; do not design around a `null`.
- **The four a11y requirements are ADDITIVE and explicitly NOT exhaustive.**
  MTG-01g:375-380 verbatim: *"These four requirements are ADDITIVE and are NOT
  exhaustive. This ruling narrows nothing: DES-17, NFR-07 and constitution item
  15 apply in full, including DES-17's direct-set roll-call keys (`1`–`4` set
  Present / Late / Excused / Absent on the focused row), which a cycling
  control must not remove — forward-only traversal with no reverse is a
  keyboard-path failure, and item 15 makes that a BLOCKER."*
- **MTG-12 does not mean "no cycle for students".** MTG-01g:383-384: a
  student-facing surface **skips the excused stop** — it does not lose the
  control. The shipped shape to mirror is `LiveConsole.tsx:908/987/1073`
  (`canSetExcused` prop + a defence-in-depth no-op).
- **UXC-07's ≤72px cap does NOT bind these rows.**
  `docs/swarm/VOLT_UX_Craft_PRD_v3.md:82` verbatim: *"Whether the ≤72px cap
  binds MTG-01b's schedule-panel session rows is explicitly NOT ruled on here…
  Treat it as a MINOR target on those rows, and where it conflicts with
  MTG-01g's ≥44px tap target, ≥44px wins; GAM-448 raises a dispute if it turns
  out to bind."* So: aim for ≤72px collapsed, **never at the cost of the 44px
  target**, and if the two genuinely collide, say so in your report — this
  ticket is the named dispute-raiser.

**0g. `expectedCt` must NOT be rendered on a meeting session.** It is a count
of RSVPs with `status === 'going'` (`src/lib/meetings/coachModel.ts:324-326`),
and **MTG-03 (`VOLT_Portal_PRD.md:403`) says meetings do not use RSVP** —
"Expected attendees = active roster of the scoped team(s) as of the session
date." So `expectedCt` is structurally `0` on every meeting session, and
putting "0 expected" in front of a coach is precisely item 26's *lie to a user
about their own data*. The scheduled-state expander shows no expected count
until a real one is injected (§6 files the gap).

---

## §1. Allowed Files

Create or edit **only**:

- `src/pages/meetings/coach/SchedulePanel.tsx`
- `src/pages/meetings/coach/SessionRow.tsx`
- `src/pages/meetings/coach/AttendanceChips.tsx`
- `src/pages/meetings/coach/SchedulePanel.css` (only if DES-21 escalation
  genuinely reaches step 4 — component → theme token → `xstyle` → custom CSS)
- `src/pages/meetings/coach/SchedulePanel.test.tsx`
- `src/pages/meetings/coach/SessionRow.test.tsx`
- `src/pages/meetings/coach/AttendanceChips.test.tsx`

**Forbidden, and there is no exception:** every loader (`src/lib/supabase/**` —
*inject, never edit*), `src/lib/meetings/types.ts`, `format.ts`,
`CoachMeetingsView.tsx`, `MeetingsList.tsx`, `.claude/**`, `docs/swarm/**`,
`.github/workflows/**`. If the task appears to need one of these, **stop and
report it** — do not edit it and do not route around it.

## §2. What to build

**`SchedulePanel.tsx`** — keeps its four frozen props (`eventId`, `sessions`,
`selectedMonthKey`, `onMonthChange`) unchanged, and adds these **optional**
ones:

```ts
onCancelSession?: CancelMeetingSessionFn;          // types.ts:207, frozen
onSetAttendanceStatus?: SetAttendanceStatusFn;     // loaders/attendance.ts:494
onRemoveAttendance?: RemoveAttendanceFn;           // loaders/attendance.ts:544 — the (unset) stop
roster?: ReadonlyMap<string, readonly SessionRosterEntry[]>;  // keyed by sessionId
isRosterLoading?: boolean;                         // DES-12 loading channel
rosterError?: string;                              // DES-12 error channel
overlapIndex?: OverlapIndex;                       // types.ts:356, frozen
focusRequest?: MeetingsFocusRequest;               // types.ts:286, frozen
onEditSession?: (sessionId: string) => void;       // MTG-01b per-row Edit chip
recordedBy?: string;                               // acting coach profiles.id
canSetExcused?: boolean;                           // default FALSE — see MTG-12 below
```

`SessionRosterEntry` is declared **locally in this file and exported from it**
(`{ studentId: string; displayName: string; status: AttendanceStatus | null }`)
— it is this ticket's own shape, not a frozen one, so it does not belong in
`types.ts`. `displayName` is **first name + last initial** (item 6); the shipped
shortener to look at is `formatDisplayName` (`src/pages/outreach/Leaderboard.tsx:365`)
— but do **not** import it and do **not** copy it wholesale: its
`isPrivacyOn === false` branch returns `ANONYMIZED_STUDENT_LABEL`, which is
kiosk-privacy behaviour and wrong here. Restate only the first-name +
last-initial derivation locally, or take an already-shortened string.

`isRosterLoading` / `rosterError` follow the precedent GAM-447 already shipped
on the sibling stub (`docs/swarm/active/GAM-447-packet.md:158-167`) — copy that
shape rather than inventing one.

- **Month tabs** — Astryx `TabList` + `Tab` (`astryx-api.md:2003`; props
  `value`, `onChange`, `children` required — verify any other prop against that
  file, item 2). One tab per month in the series' own window, `YYYY-MM`.
  **Default = the current month in `America/Chicago`**, falling back to the
  nearest month that has sessions when today's month has none. Bucket sessions
  **by the stored session date, never by re-deriving from the UTC instant** —
  the skill is explicit that a session stored at 11 PM Chicago is the next day
  in UTC. Pin every `Intl.DateTimeFormat` to `timeZone: 'America/Chicago'`.
- **Row line** — **the achievable string is `"Thu, Oct 1 · 4:00–6:00 PM · 2h"`,
  and that is what you build.** `formatTimeRangeWithDuration`
  (`src/lib/meetings/format.ts:157-165`, `CLOCK_TIME_FORMATTER` at `:56-60`)
  returns `"4:00–6:00 PM · 2h"` — the `:00`-dropping rule belongs to
  `buildScheduleChips`, not to this function. The issue's `"4–6 PM"` example is
  therefore **not producible** from the formatters you are required to import,
  and re-deriving one to get it is forbidden (GAM-443's entire reason for
  existing). Import `formatWeekdayDate` / `formatTimeRangeWithDuration` from
  `format.ts` and render exactly what they return.
  Status badge: `scheduled` → `info`, `completed` → `success`, `canceled` →
  `error`. (All five variant names verified present at `astryx-api.md:531`.)
  Overlap badge only when `overlapIndex` is supplied (§0d).
  **UXC-07 does not bind these rows** — §0f. Aim for ≤72px collapsed as a
  MINOR target; **≥44px wins any conflict**; report a genuine collision rather
  than silently choosing.
- **Expand in place** — hand-rolled `useState`. `useTableRowExpansion` is
  **forbidden** and these are not `Table` rows.
  - `scheduled` → **no expected count** (§0g — `expectedCt` is RSVP-derived and
    structurally `0` on a meeting) + **"Cancel this session"** confirmed via
    Astryx **`AlertDialog`**, calling `onCancelSession(sessionId)`. DES-11
    (`VOLT_Portal_PRD.md:219`) names cancel-session explicitly and has **no
    inline form**; MTG-01 (`:401`) repeats it. **Mirror the shipped, green
    `cancelTarget` + `AlertDialog` pair at
    `src/pages/meetings/coach/CoachMeetingsView.tsx:1634`** (its props verified
    at `:453`) — do not hand-roll one.
  - `completed` → roster rows with tap-to-cycle chips. All four DES-12 states
    (`VOLT_Portal_PRD.md:220`): `isRosterLoading` → `Skeleton`; `rosterError` →
    `Banner status="error"` with a retry; roster present but empty →
    `EmptyState` with one action; populated → the chips.
  - `canceled` → exactly `"Canceled — no attendance recorded."`
- **Per-row `Edit` chip — build it.** MTG-01b (`VOLT_Portal_PRD.md:314-317`)
  and this stub's own header (`SchedulePanel.tsx:5-7`) both retain the
  2026-07-28 deviation's per-row `Edit` affordance. Surface it as an optional
  `onEditSession?: (sessionId: string) => void` that the row calls; this ticket
  owns the affordance, **not** the dialog behind it (`EditMeetingSessionDialog`
  is outside Allowed Files and GAM-452 wires it).
- **`AttendanceChips.tsx`** — a pure presentational component.
  - **Cycle order is FIVE stops: `Present → Late → Excused → Absent → (unset)
    → Present`** (MTG-01g, `VOLT_Portal_PRD.md:382`). `(unset)` **removes the
    attendance row** via the injected `onRemoveAttendance`
    (`loaders/attendance.ts:544`) — it is a real stop, not an edge case.
    **No confirm dialog on this stop.** DES-11's confirm set
    (`VOLT_Portal_PRD.md:219`) does not include an attendance un-mark, T119 /
    PRD-v2 D-7 already ruled the un-mark an unconditional DELETE
    (`loaders/attendance.ts:272-276`), and a confirm inside the loop would make
    criterion 3's full-loop walk untestable. Keep the pre-delete status in
    local state so the next tap restores it, announce the un-mark through the
    same `aria-live` region, and roll back on rejection like any other write.
    ⚠ **Disclose this in your report:** `makeRemoveAttendance`
    (`attendance.ts:546-562`) deletes the **entire row**, which carries
    `check_in_at`, `check_out_at`, `hours_override`, `method` and `recorded_by`
    (`:247,255-267`). So the fifth tap discards a QR check-in timestamp and a
    coach-set hours override — the very values `makeSetAttendanceStatus`
    (`:506-528`) goes out of its way to preserve. That asymmetry is real and
    undocumented. It is **not** grounds to invent a confirm (nothing is wired
    yet, §0a), but say so plainly; §6 files it.
  - **`Shift`-activation reverses the cycle** (same line). Forward-only is a
    keyboard-path failure and item 15 makes that a **BLOCKER**.
  - **DES-17 direct-set roll-call keys `1`–`4`** set Present / Late / Excused /
    Absent on the focused row (`VOLT_Portal_PRD.md:234`). MTG-01g:375-380 says
    the four a11y rules are *"ADDITIVE and are NOT exhaustive"* and that a
    cycling control **must not remove** these keys.
    **The roving tabindex and the key handler live on the ROW, not the chip** —
    round 2 of the premise gate settled this against the shipped
    implementation. `LiveConsole.tsx:937,940-941` binds
    `tabIndex={isFocused ? 0 : -1}` and `onKeyDown` on the `<li>` itself, and
    `handleRowKeyDown` (`:1144-1164`) does ArrowUp/ArrowDown over `rowRefs`
    plus `DIGIT_KEY_TO_STATUS[event.key]`. Its module doc (`:161-186`) records
    *why* the handler sits on the `<li>`: so it fires "regardless of whether
    DOM focus is on the row or has drifted onto a descendant, per normal event
    bubbling" — which means a `1` pressed while focus is on the chip still
    works. So: `SessionRow` (or the roster list inside it) owns
    `focusedRowIndex` + `rowRefs` + the key handler; **`AttendanceChips` stays
    purely presentational** — it renders the `<button>`, calls injected
    handlers, and adds no key handling of its own. Key `3`/Excused routes
    through the same `canSetExcused` guard as the cycle (`:1073`).
  - The four named rules still hold in full: a real `<button>`; accessible name
    = student name + current status ("Ada L., present"); every change announced
    via `aria-live`; target **≥44px**.
  - DES-05 colors via Astryx semantic variants only: present `success`, late
    `warning`, excused `neutral`, absent `error`.
- **Optimistic update with rollback** — set local state, call the seam, and on
  rejection restore the prior status and surface the failure. **LAST WRITE
  WINS** (2026-08-02 ruling) — invent no optimistic-concurrency check, no
  version column, no conflict dialog.
- **The write payload has FIVE required fields**, not three.
  `SetAttendanceStatusParams` (`loaders/attendance.ts:482-492`) requires
  `sessionId`, `studentId`, `status`, `method: AttendanceMethod`, and
  `recordedBy: string`.
  - **`method` is always `'coach'` here** — settled by owner ruling 2026-08-02
    and implemented at `src/pages/meetings/LiveConsole.tsx:1080-1093`, where
    `resolveAttendanceWriteMethod` (`attendance.ts:287`) is **deliberately not
    called** because a coach tap is always a coach write. Do not call it; do
    not re-litigate the ruling.
  - **`recordedBy` is optional on the panel but required by the seam.** When it
    is absent the chip renders **disabled with an explanatory title** and emits
    **no write** — never send a fabricated or empty `recordedBy`.
- **`focusRequest`** — when passed and `eventId` matches, open that
  `monthKey`'s tab and expand that `sessionId`.
- **MTG-12 — read the ruling, it is not what it sounds like.** MTG-01g:383-384:
  a student-facing surface **skips the excused stop**; it does not lose the
  control. Gate it with `canSetExcused?: boolean` **defaulting to `false`**,
  mirroring the shipped `LiveConsole.tsx:908` prop, plus `:1073`'s
  defence-in-depth no-op (a write with `status: 'excused'` while
  `canSetExcused` is false must not be emitted even if something calls the
  handler directly). **Do NOT call `useAuth()` inside these components** — a
  role read here would engage item 18's fourth trigger and change the worker
  tier mid-task.
- **No page-level overlap banner** (owner ruling). **No countdowns, streaks or
  urgency copy** (item 17, BLOCKER). **No internal jargon in user copy** —
  no `GAM-nnn`, no `SessionRosterEntry` in a label (UXC-10, BLOCKER).

## §3. Acceptance criteria — each measurable today with fixtures that exist

**Read this before writing the tests:** criteria 3, 4 and 5 walk a cycle that
includes the Excused stop, so they are asserted with **`canSetExcused` set**
(the coach case). Criterion 16 asserts the **default** (`false`), where that
stop is skipped. A checker reading 3 or 5 against the default would otherwise
see them fail — and criterion 3 is a `mutation-replay` target, so the
distinction has to be explicit in the test names.

1. Month tab default is the current **Chicago** month; a test that pins a fake
   clock to a UTC instant which is the *previous* day in Chicago still selects
   the Chicago month.
2. A session stored at 11 PM Chicago buckets into its **Chicago** month, not
   the UTC one.
3. Cycle order is exactly **Present → Late → Excused → Absent → (unset) →
   Present** — five stops, asserted by walking the full loop back to the start.
4. **`Shift`-activation reverses** the cycle, asserted across at least one
   wrap boundary.
5. **DES-17 keys `1`–`4`** set Present / Late / Excused / Absent directly on
   the focused chip, without cycling through the intermediate stops.
6. Chip is a real `<button>`, accessible name contains student name **and**
   current status, change is announced via `aria-live`.
7. A chip write calls the injected `onSetAttendanceStatus` **exactly once**
   with **all five** params — `sessionId`, `studentId`, `status`,
   `method: 'coach'`, `recordedBy` — asserted on a `vi.fn()` with
   `toHaveBeenCalledWith`, not a partial match.
8. Reaching the `(unset)` stop calls the injected `onRemoveAttendance` exactly
   once — **not** `onSetAttendanceStatus` with some sentinel value.
9. **Optimistic rollback:** a rejecting `onSetAttendanceStatus` restores the
   previous status in the DOM.
10. With `recordedBy` absent the chip is disabled and **no** write is emitted.
11. "Cancel this session" calls the injected `onCancelSession` exactly once with
    that `sessionId`, and only after the **`AlertDialog`** is confirmed.
12. A `canceled` session renders `"Canceled — no attendance recorded."` and no
    chips.
13. **Zero new mutation code, grep-provable:** no `.from(`, `.upsert(`,
    `.update(`, `.insert(`, `.delete(` and no `getSupabaseClient` in any of the
    three new components.
14. `makeOnEditAttendance` appears **nowhere** in the new files (§0e).
15. All four DES-12 states render for the roster region: `isRosterLoading` →
    `Skeleton`; `rosterError` → `Banner status="error"`; empty roster →
    `EmptyState`; populated → chips.
16. **`canSetExcused={false}` (the default) makes the cycle skip the excused
    stop**, and a direct handler call with `status: 'excused'` emits no write
    (defence in depth). This replaces the old, unverifiable "a student role
    cannot reach the cycle" — the component takes no role input, and MTG-01g
    :383-384 says a student surface keeps the control minus that one stop.
17. No `expectedCt` value is rendered anywhere (§0g).
18. Every Astryx prop used is present in `docs/swarm/astryx-api.md` (item 2).
    **Note:** the `Tab` / `TabMenu` props tables at `astryx-api.md:2068-2075`
    are literally the string `undefined`; the only admissible evidence for
    `Tab`'s `value`/`label` is the example block at `:2010-2030`. Cite that
    block, and cross-check anything else with
    `npm run astryx -- component Tab --json`.
19. Row line renders exactly what `formatWeekdayDate` /
    `formatTimeRangeWithDuration` return — `"Thu, Oct 1 · 4:00–6:00 PM · 2h"` —
    with no local re-formatting.
20. **The per-row `Edit` chip calls the injected `onEditSession` exactly once**
    with that `sessionId` (MTG-01b — the packet orders it built, so a criterion
    has to measure it).
21. **Item 27 source criterion** (`constitution.md:405-408`): a test asserts
    the panel renders roster rows **from the injected `roster` prop**, and the
    packet records that no loader on `main` fills it (§0c). This task's
    user-visible surface is deliberately fixture-fed and closes **Partial**.

## §4. Evidence required

- All six gates via the **`gate-run`** skill, exit codes reported, pasted
  verbatim — not retyped, not summarized as "all green". **Baselines, measured
  by the orchestrator on this branch point (`8b4cbcd5`, after `npm ci`):**

  ```
  --baseline-tests 2666 --baseline-scoped 52
  ```

  2666 tests across 109 files, all green; the scoped run is
  `src/pages/meetings/coach` at 52 tests across 2 files. Use exactly these.
- **`mutation-replay`** on criteria **3, 7 and 9** — the cycle order, the
  five-field write, and the optimistic rollback. Those are the three that carry
  the write, and a passing test is not evidence until you have watched it go
  red. **Commit before mutating** (item 26's fast-tier working rule — T323's
  `git checkout --` also reverted the uncommitted fix), mutate in **your own
  worktree** (item 23), capture the red output and exit code, restore,
  re-verify green.
- **`layout-measurement` for the ≥44px chip target — authorized method.** That
  skill needs a `--url` against a running dev server, and this component has no
  route (§0a), so it cannot be pointed at `/meetings`. **You are authorized to
  create a throwaway harness route in your own worktree** (item 23) purely to
  measure, and you must **not commit it** — the diff you report contains only
  Allowed Files. If that proves impractical, fall back to asserting the
  computed `min-block-size`/token in a test and say plainly in your report that
  browser measurement moved to GAM-452. Do not report a measurement you did not
  take.
- Report the **commit SHA** your work landed in (item 21). "Clean" is not
  "committed" — verify HEAD actually moved and the change is in the committed
  blob.
- `e2e-personas` is **out of reach for this task** and you should not attempt
  it: with no caller (§0a) there is no real path a coach can walk to this
  panel. Say so; do not fake it.

## §5. Least confident decisions (item 19d)

1. **That optional props on this stub are not a freeze violation.** Rests
   entirely on the GAM-447 precedent (§0b) and on `SchedulePanel` having no
   caller. *Wrong if* a sibling ticket already codes against
   `SchedulePanelProps` in an unmerged branch, or if the freeze was meant to
   cover the props type by name rather than by consumer.
   **Round 1 resolved this: DOES NOT HOLD.** The gate searched every remote
   ref (60+) for a `SchedulePanelProps` consumer and found none, merged or
   unmerged. Settled; do not re-open.
2. **That injecting the roster is better than shipping without chips.**
   **Round 1 resolved this: Partial is correct, do NOT split.** Item 27's own
   scope paragraph (`constitution.md:394-398`) exempts *"work with no
   user-visible surface"*, and this panel has no route and no caller, so item
   27 barely engages — naming GAM-452 is already more than it requires.
   Settled; build the chips here.
3. **That the `(unset)` stop is safe to implement as a row delete.**
   `makeRemoveAttendance` (`attendance.ts:544-562`) is the shipped un-mark
   seam, so the mechanism is not in doubt — the design question is whether
   cycling *past* Absent into a silent row deletion is what a coach expects
   from a chip tap. *Wrong if* an accidental fifth tap destroys a real mark
   with no undo and no confirm; MTG-01g mandates the stop but says nothing
   about protecting it. **If you believe this needs a confirm, say so in your
   report rather than adding one** — DES-11 governs destructive confirms and
   inventing one here would contradict MTG-01g's cycle.
4. **That disabling the chip when `recordedBy` is absent is the right failure
   mode.** The alternative is rendering the chip enabled and surfacing the
   error only on click. *Wrong if* GAM-452 legitimately mounts this panel
   before auth resolves, in which case every chip would render disabled on
   first paint and look broken rather than loading.
5. **That the DES-17 `1`–`4` keys belong on the chip rather than on the roster
   row.** MTG-01g says "on the focused row"; this packet puts them on the
   focused chip because the chip is the focusable control. *Wrong if* the
   intended interaction is a roving-tabindex list where the ROW holds focus
   and the keys act on it — which is precisely how `LiveConsole.tsx` already
   implements roll-call. **Read `LiveConsole.tsx`'s roving-tabindex roster
   before choosing**, and match it if it fits.

## §6. Follow-ups (item 20)

**The ORCHESTRATOR files these, not the worker.** Workers may not write to
Linear or `docs/swarm/**`. Filed to `Backlog` carrying `tier/unreviewed`, via
the `linear-task-writing` skill, before the PR leaves draft:

- **The roster gap (§0c)** — nothing on `main` can fill `SchedulePanel.roster`,
  so the chips render only from an injected fixture. Name
  `makeLoadAttendanceForSessions` (`loaders/attendance.ts:356`) as the existing
  read seam, GAM-471 as the related roster-source row, and `formatDisplayName`
  (`src/pages/outreach/Leaderboard.tsx:365`) as the item-6 name shortener.
  **This is the row that makes GAM-448 `Partial` rather than `Passed`** under
  item 27, together with GAM-452.
- **The expected-attendee gap (§0g)** — MTG-03 defines expected attendees as
  the active roster of the scoped teams as of the session date, and nothing
  computes that; `expectedCt` is RSVP-derived and structurally `0` for
  meetings. Relate to GAM-471.
- **The overlap badge (§0d)** — blocked on GAM-450; reference it, do not
  duplicate `buildOverlapIndex`.
- **The `meetings-design` skill is narrower than the PRD (§0f)** — stated
  precisely, because round 2 corrected the first draft of this: the skill's
  tap-to-cycle section (`.claude/skills/meetings-design/SKILL.md:113-126`)
  **omits the cycle order entirely**, omits `Shift`-reverse, omits DES-17's
  `1`–`4` keys, and presents the four a11y rules as the complete binding
  contract ("these four are not suggestions"; "A chip missing any of the four
  **is** a finding") **without MTG-01g's "ADDITIVE and are NOT exhaustive"
  clause**. It does not teach a four-stop cycle; it teaches no cycle at all.
  Item 1 makes the skill the bug. Five sibling tickets are still coding against
  it, so file this promptly. `.claude/skills/**` is owner/orchestrator
  territory — file, do not edit from a worker.
- **`makeRemoveAttendance` destroys more than a status (§2's ⚠).** The
  `(unset)` stop deletes the whole `attendance` row, discarding `check_in_at`,
  `check_out_at` and `hours_override` — exactly what `makeSetAttendanceStatus`
  is written to preserve. Undocumented asymmetry between two seams a coach
  reaches from the same control. Worth a decision before GAM-452 makes the
  chip reachable.
- **The wrong-seam correction (§0e)** is **not** filed: it is resolved inside
  this task. It is recorded in the run log and the PR body so the next reader
  does not inherit the issue's version.
