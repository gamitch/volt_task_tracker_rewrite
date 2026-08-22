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
(`:496-505`) **with no insert path**, and `types.ts:138-148` records that since
T508 an unmarked student normally has **no attendance row at all**. Correcting
an unmarked student through it updates zero rows *and resolves successfully* —
the optimistic chip would show the new status and the database would keep
nothing. It is also documented at `:479-488` as deliberately unreachable by
owner ruling T601.

> **Every chip write goes through `makeSetAttendanceStatus`**
> (`loaders/attendance.ts:506-528`) — a real upsert on
> `onConflict: 'session_id,student_id'` that deliberately omits
> `hours_override` so an existing coach-set override survives a status change.
> `makeOnEditAttendance` is **not** used by this task.

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
roster?: ReadonlyMap<string, readonly SessionRosterEntry[]>;  // keyed by sessionId
overlapIndex?: OverlapIndex;                       // types.ts:356, frozen
focusRequest?: MeetingsFocusRequest;               // types.ts:286, frozen
recordedBy?: string;                               // acting coach profiles.id
```

`SessionRosterEntry` is declared **locally in this file and exported from it**
(`{ studentId: string; displayName: string; status: AttendanceStatus | null }`)
— it is this ticket's own shape, not a frozen one, so it does not belong in
`types.ts`. `displayName` is **first name + last initial** (item 6).

- **Month tabs** — Astryx `TabList` + `Tab` (`astryx-api.md:2003`; props
  `value`, `onChange`, `children` required — verify any other prop against that
  file, item 2). One tab per month in the series' own window, `YYYY-MM`.
  **Default = the current month in `America/Chicago`**, falling back to the
  nearest month that has sessions when today's month has none. Bucket sessions
  **by the stored session date, never by re-deriving from the UTC instant** —
  the skill is explicit that a session stored at 11 PM Chicago is the next day
  in UTC. Pin every `Intl.DateTimeFormat` to `timeZone: 'America/Chicago'`.
- **Row line** — `"Thu, Oct 1 · 4–6 PM"` via `formatWeekdayDate` /
  `formatTimeRangeWithDuration` **imported from `src/lib/meetings/format.ts`**.
  Do not re-derive a formatter (GAM-443's entire reason for existing).
  Status badge: `scheduled` → `info`, `completed` → `success`, `canceled` →
  `error`. Overlap badge only when `overlapIndex` is supplied (§0d).
  **UXC-07's ≤72px row-height cap still applies to these rows** — the skill
  lifts it for cards only.
- **Expand in place** — hand-rolled `useState`. `useTableRowExpansion` is
  **forbidden** and these are not `Table` rows.
  - `scheduled` → expected count (`expectedCt`; it is a count, not names —
    there are no names to show) + **"Cancel this session"** behind an inline
    confirm with DES-11 semantics, calling `onCancelSession(sessionId)`.
  - `completed` → roster rows with tap-to-cycle chips, when `roster` is
    supplied; when it is not, the **empty state** for the roster region (item
    12 / DES-12 — all four states, no happy path only).
  - `canceled` → exactly `"Canceled — no attendance recorded."`
- **`AttendanceChips.tsx`** — a pure presentational component. Cycle order is
  **exactly** `Present → Late → Excused → Absent → Present`. DES-05 colors via
  Astryx semantic variants only: present `success`, late `warning`, excused
  `neutral`, absent `error`. **The a11y contract is binding, all four:** a real
  `<button>`; accessible name = student name + current status ("Ada L.,
  present"); every change announced via `aria-live`; target **≥44px**.
- **Optimistic update with rollback** — set local state, call
  `onSetAttendanceStatus`, and on rejection restore the prior status and
  surface the failure. **LAST WRITE WINS** (2026-08-02 ruling) — invent no
  optimistic-concurrency check, no version column, no conflict dialog.
- **`focusRequest`** — when passed and `eventId` matches, open that
  `monthKey`'s tab and expand that `sessionId`.
- **MTG-12** — excused is coach/admin-only. This panel renders only under the
  coach view; the chip cycle must not be reachable by a student/parent role.
  **Assert it in tests.**
- **No page-level overlap banner** (owner ruling). **No countdowns, streaks or
  urgency copy** (item 17, BLOCKER). **No internal jargon in user copy** —
  no `GAM-nnn`, no `SessionRosterEntry` in a label (UXC-10, BLOCKER).

## §3. Acceptance criteria — each measurable today with fixtures that exist

1. Month tab default is the current **Chicago** month; a test that pins a fake
   clock to a UTC instant which is the *previous* day in Chicago still selects
   the Chicago month.
2. A session stored at 11 PM Chicago buckets into its **Chicago** month, not
   the UTC one.
3. Cycle order is exactly Present → Late → Excused → Absent → Present.
4. Chip is a real `<button>`, accessible name contains student name **and**
   current status, change is announced via `aria-live`.
5. A chip write calls the injected `onSetAttendanceStatus` **exactly once**
   with the right `sessionId`/`studentId`/`status` — asserted on a `vi.fn()`.
6. **Optimistic rollback:** a rejecting `onSetAttendanceStatus` restores the
   previous status in the DOM.
7. "Cancel this session" calls the injected `onCancelSession` exactly once with
   that `sessionId`, only after the inline confirm.
8. A `canceled` session renders `"Canceled — no attendance recorded."` and no
   chips.
9. **Zero new mutation code, grep-provable:** no `.from(`, `.upsert(`,
   `.update(`, `.insert(`, `.delete(` and no `getSupabaseClient` in any of the
   three new components.
10. `makeOnEditAttendance` appears **nowhere** in the new files (§0e).
11. All four states present for the roster region (loading, empty, error,
    populated).
12. A student/parent role cannot reach the chip cycle.
13. Every Astryx prop used is present in `docs/swarm/astryx-api.md` (item 2).

## §4. Evidence required

- All six gates via the **`gate-run`** skill, exit codes reported, pasted
  verbatim — not retyped, not summarized as "all green".
- **`mutation-replay`** on criteria **3, 5 and 6** — the three that carry the
  write. A passing test is not evidence until you have watched it go red.
  Commit before mutating (item 26's fast-tier working rule), mutate in **your
  own worktree** (item 23), restore, re-verify green.
- **`layout-measurement`** for the ≥44px chip target at both viewports.
- Report the **commit SHA** your work landed in (item 21). "Clean" is not
  "committed".
- `e2e-personas` is **out of reach for this task** and you should not attempt
  it: with no caller (§0a) there is no real path a coach can walk to this
  panel. Say so; do not fake it.

## §5. Least confident decisions (item 19d)

1. **That optional props on this stub are not a freeze violation.** Rests
   entirely on the GAM-447 precedent (§0b) and on `SchedulePanel` having no
   caller. *Wrong if* a sibling ticket already codes against
   `SchedulePanelProps` in an unmerged branch, or if the freeze was meant to
   cover the props type by name rather than by consumer.
2. **That injecting the roster is better than shipping without chips.** The
   alternative reading is that §0c blocks the attendance half outright and this
   task should ship month tabs + cancel only, with chips moving wholesale to
   the issue's pre-approved `AttendanceChips.tsx` split. *Wrong if* a checker
   grades an unreachable chip surface as MAJOR under item 27 rather than
   Partial — the a11y and cycle logic would then have been built against a prop
   nobody fills.
3. **That `makeSetAttendanceStatus` alone is sufficient** and no roster-status
   read is needed for a correct initial chip state. *Wrong if* the roster prop's
   `status: null` (unmarked) must render as something other than a fourth
   visual state — the cycle has four statuses and `null` is a fifth condition
   this packet has not designed a chip appearance for.
4. **That `expectedCt` satisfies "see who's expected."** It is a count; the
   issue's wording implies names. *Wrong if* the owner meant a named roster on
   scheduled sessions too — which §0c makes unbuildable either way, so the
   consequence is a bigger deferral, not a different design.
5. **That UXC-07's ≤72px cap applies to a row's collapsed height only**, not to
   the expanded region. *Wrong if* the cap is meant to bound the expanded
   session block as well, which would force the roster into its own scroll
   container.

## §6. Follow-ups this task must file (item 20), before the PR opens

To `Backlog`, carrying `unreviewed`, via the `linear-task-writing` skill:

- **The roster gap (§0c)** — nothing on `main` can fill `SchedulePanel.roster`.
  Name `makeLoadAttendanceForSessions` (`loaders/attendance.ts:356`) as the
  existing read seam and GAM-471 as the related roster-source row.
- **The overlap badge (§0d)** — blocked on GAM-450; reference, do not duplicate.
- **The wrong-seam correction (§0e)** is recorded *here and in the PR body*,
  not filed: it is resolved inside this task, not deferred.
