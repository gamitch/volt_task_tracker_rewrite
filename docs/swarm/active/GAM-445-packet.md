# GAM-445 task packet — per-weekday times in weekly-mode meeting scheduling

Tier: **HEAVY** (item 26). Gate: `checker-premise` must return DISPATCH before
any worker sees this (item 19). Every line number below was read from working
tree `967170c` on 2026-08-21, not copied from the issue (item 19c).

## 1. The defect

`ScheduleMeetingsDialog`'s weekly mode collects a set of weekdays and **one**
start/end time, and applies that single time to every generated date. So Weekly
P3 (Tue 6:00–8:00 PM **and** Sun 3:30–6:30 PM) and Weekly GG (Thu 6:00–8:00 PM
**and** Sun 12:30–3:30 PM) cannot be created in one pass — the coach must fall
back to per-date custom entry across seven months, roughly 56 dates per series.

## 2. Verified current state

| Fact | Site | Verified |
| -- | -- | -- |
| Weekday set is one flat `string[]`, no times attached | `ScheduleMeetingsDialog.tsx:940` | yes |
| `CheckboxList` "Repeat on" is the only weekly-specific input besides the range | `:1358-1371` | yes |
| The `TimeInput` pair is **shared across all three modes**, rendered outside every `mode === …` guard | `:1428-1454` | yes |
| `computeScheduleSessionDates` returns `string[]` — dates only, no times | `:428-441` | yes |
| `generateRecurringSessionDates(range, weekdayValues)` walks day-by-day, matching `WEEKDAY_OPTIONS.dayIndex` against `cursor.getUTCDay()` | `:391-412` | yes |
| `buildEventSessionsPayload(dates, startTime, endTime, notes)` maps ONE time over every date | `:487-500` | yes |
| `chicagoWallTimeToUtcIso(dateStr, timeStr)` probes the offset **per call**, so it is already correct per-date across a DST boundary | `:478-482`, offset helper `:449-474` | yes |
| `event_sessions` rows carry their own `starts_at`/`ends_at` — **no schema change** | payload type `:310-316` | yes |
| Payload shape `{ event, sessions }` is an explicit session list already | `:318-321` | yes |
| Weekly mode is create-mode-only *in practice*: `resetForm()` forces `mode = 'custom'` for edit mode | `:973` | yes |
| Only ONE existing unit test names weekly mode | `ScheduleMeetingsDialog.test.tsx:338-341` | yes |
| One e2e test covers weekly recurring | `tests/e2e-personas/coach-meeting.spec.ts:197-248` | yes |

**Two things the issue did not mention and the worker must not trip over:**

- The shared `TimeInput` pair at `:1428-1454` also serves single and custom
  mode, and carries T611/GAM-290 machinery — `endTimeError`/`status` (`:1448`),
  `min={startTime}` (`:1447`), and `handleStartTimeChange`/`handleEndTimeChange`
  latching `timeFieldsTouched` (`:963`, `:1123`). Anything done to that pair
  lands on all three modes.
- Edit mode has a **separate** build path, `buildEditDesiredFutureSessions`
  (`:829-857`), plus the `timesDivergeAcrossSessions` disclosure (`:1420-1426`).
  This task must not touch either. Weekly mode is reachable in edit mode only if
  the coach switches the `SegmentedControl` by hand.

## 3. What to build

**3.1 State.** Add per-weekday time state keyed by the existing
`WEEKDAY_OPTIONS.value` strings (`'mon'`…`'sun'`, `:330-338`). Do not invent a
second weekday vocabulary and do not reorder `WEEKDAY_OPTIONS` — its Sun-last
order is what the checkbox list renders.

**3.2 Render.** In weekly mode, when `recurringWeekdays.length > 1`, render one
row per selected weekday: the weekday label plus a start/end `TimeInput` pair.
Each newly-selected weekday defaults to the **first row's** current times, so the
common same-time-every-day case costs the coach zero extra input. Rows follow
`WEEKDAY_OPTIONS` order, not click order.

**3.3 Single-weekday behaviour is byte-identical.** With zero or one weekday
selected, weekly mode renders and behaves exactly as it does today — the shared
pair, one time. This is an acceptance criterion, not a nicety.

**3.4 Generation.** `computeScheduleSessionDates`/`buildEventSessionsPayload`
consume the per-day times. Every conversion still goes through
`chicagoWallTimeToUtcIso` **per (date, time) pair** — NFR-09, and the reason a
DST-crossing series works: the offset is probed per date, never cached. A series
spanning 2026-11-01 must emit a different UTC offset before and after that date
for the same wall time.

**3.5 Validation.** The end-after-start guard must hold **per row**. A row whose
end is not strictly after its start is an error, and the dialog must not submit.
Reuse `computeEndTimeError` (`:534`) rather than writing a second comparison.

**3.6 Payload shape is frozen.** Keep `onCreateMeetings`'s `{ event, sessions }`
shape (`:318-321`) exactly as it is, so **no loader change is needed**. If you
conclude the shape must change, **STOP** and say so on GAM-445 rather than
proceeding — a sibling ticket in the `meetings-redesign` label group owns the
loader and is coding against this shape right now.

**3.7 Accessibility.** Multiple `TimeInput`s named "Start time" on one screen is
an accessible-name collision. Each row's inputs must be distinguishable by
accessible name (weekday-qualified). Per-day rows at 375px must not overflow and
tap targets stay ≥44px — measure, do not reason about it.

## 4. Allowed files (worker may edit ONLY these)

- `src/pages/meetings/ScheduleMeetingsDialog.tsx`
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx`
- `tests/e2e-personas/coach-meeting.spec.ts`

**Forbidden**, and each for a reason: `src/pages/meetings/MeetingsList.tsx` and
everything else under `src/pages/meetings/` (a parallel decomposition ticket owns
it — a collision here loses someone's work), `src/lib/supabase/**`,
`src/lib/meetings/**` (GAM-443/GAM-444 froze those names), `supabase/**`,
`.github/workflows/**` (wall 1 — unpushable by this run's credentials, checked at
packet time rather than at push time), and everything under `docs/swarm/**` and
`.claude/**` (orchestrator-owned).

**No file in Allowed Files is under `.github/workflows/`** — wall 1 is clear.

## 5. Acceptance criteria (measurable today)

1. A P3-shaped series — Tue 6:00–8:00 PM **and** Sun 3:30–6:30 PM over a
   multi-week range — is creatable in one dialog pass, and the emitted
   `sessions[]` carries the correct distinct UTC pair for each weekday.
2. A DST-crossing range (spanning 2026-11-01) emits the same *wall* time and a
   *different* UTC offset either side of the boundary, per weekday.
3. Zero- and one-weekday weekly mode behaves exactly as before.
4. Single mode and custom mode are untouched — their shared time pair still
   works, including `endTimeError` and `min`.
5. Per-row end-before-start blocks submission.
6. Every unit test in `ScheduleMeetingsDialog.test.tsx` passes; any weekly-mode
   assertion deliberately updated is **counted and named** in the PR.
7. The e2e spec's weekly test is extended to create a two-different-times series
   through the real UI and read the `event_sessions` rows back, asserting both
   UTC pairs — not asserting on what the dialog rendered.

## 6. Required skills

`gate-run` (all six gates, one evidence block), `mutation-replay` (prove the
per-day payload test actually guards per-day times — mutate the generator to
reuse row 1's time for every row and watch it go red), `layout-measurement`
(per-day rows at 375px; 44px targets), `e2e-personas` (create the series as
coach; read `event_sessions` back). `meetings-design` before touching anything
under `src/pages/meetings/**`.

## 7. Least confident decisions (item 19d) — attack these first

1. **The shared `TimeInput` pair stays put and per-day rows appear *in addition*
   when >1 weekday is selected.** The alternative is that the shared pair is
   *replaced* by the per-day rows in that state. I chose "first row is the shared
   pair" reading of the issue's "defaulting each new row to the first row's
   times". **What would make this wrong:** if leaving the shared pair visible
   creates a control that appears to set a time but sets nothing — that is an
   item 27-shaped lie to the user, and worse than a slightly larger diff.
2. **`buildEventSessionsPayload` gains per-day times without breaking its
   exported signature.** It is exported and imported by the test file, and the
   edit path's sibling `buildEditDesiredFutureSessions` deliberately mirrors its
   posture (`:824`). I assumed an additive/optional parameter is safe. **What
   would make this wrong:** if any caller outside the Allowed Files imports it —
   the worker must grep before changing it, not assume.
3. **Weekly mode in edit mode is out of scope.** `resetForm()` forces `'custom'`
   (`:973`), so I treated weekly-in-edit as unreachable-in-practice. **What would
   make this wrong:** the coach *can* switch the `SegmentedControl` by hand
   mid-edit, and if per-day times then feed `buildEditDesiredFutureSessions`
   (which knows nothing about them), the edit path could write the wrong times to
   an existing series. That is a data-corruption path and is exactly why this row
   is HEAVY — **the gate should check this specifically.**
4. **`computeEndTimeError` is reusable per row unchanged.** It compares
   wall-clock `HH:MM` minutes and its doc comment (`:517-533`) explains at length
   why it is deliberately NOT routed through `chicagoWallTimeToUtcIso`. **What
   would make this wrong:** if per-row reuse changes when it fires for the
   *shared* pair and turns `:1927`'s "clearing a touched time field disables
   Save" test red.
5. **Per-weekday times need no persistence across a mode switch.** If the coach
   sets per-day times, switches to custom, and switches back, I assumed resetting
   to defaults is acceptable. **What would make this wrong:** silently discarding
   entered times is data loss from the coach's point of view, even though nothing
   was written.
