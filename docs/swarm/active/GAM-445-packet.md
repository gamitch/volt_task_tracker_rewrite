# GAM-445 task packet — per-weekday times in weekly-mode meeting scheduling

Tier: **HEAVY** (item 26). Round 2 of the item 19a two-round gate cap.
Round 1 returned **REVISE (BLOCKER)**; all twelve required revisions are applied
below and each is marked `[R1-n]`. Line numbers were read from the working tree,
and round 1 found four of mine wrong — the corrected ones are marked
`[R1-verified]` and were re-read rather than carried over.

## 1. The defect

`ScheduleMeetingsDialog`'s weekly mode collects a set of weekdays and **one**
start/end time, and applies that single time to every generated date. So Weekly
P3 (Tue 6:00–8:00 PM **and** Sun 3:30–6:30 PM) and Weekly GG (Thu 6:00–8:00 PM
**and** Sun 12:30–3:30 PM) cannot be created in one pass — the coach must fall
back to per-date custom entry across seven months, roughly 56 dates per series.

## 2. Verified current state

| Fact | Site | Status |
| -- | -- | -- |
| Weekday set is one flat `string[]`, no times attached | `:940` | confirmed |
| `CheckboxList` "Repeat on"; weekly block is `:1350-1373` | `:1358-1371` | confirmed |
| The `TimeInput` pair is **shared across all three modes**, rendered outside every `mode === …` guard | `:1428-1454` | confirmed, and proven at runtime by round 1's probe |
| `computeScheduleSessionDates` returns `string[]` — dates only | `:428-441` | confirmed |
| `generateRecurringSessionDates` walks day-by-day, matching `dayIndex` against `cursor.getUTCDay()` | `:391-412` | confirmed |
| `buildEventSessionsPayload` maps ONE time over every date | `:487-500` | confirmed |
| `chicagoWallTimeToUtcIso` probes the offset **per call** | `:478-482`, `:449-474` | confirmed — **with the caveat in §5 criterion 2**, which is a real limit, not a nicety |
| `event_sessions` rows carry their own `starts_at`/`ends_at` — **no schema change** | `:310-316`, `supabase/migrations/20260717000000_scheduling_attendance.sql:53-63` | confirmed |
| Payload `{ event, sessions }` is an explicit session list | `:318-321` | confirmed |
| **`onCreateMeetings` needs no loader change** — `MeetingsList.tsx:2200` → `createMeetings` → `insertSessions` maps `s.startsAt`/`s.endsAt` per session | `src/lib/supabase/loaders/meetings.ts:1103-1116`, `:1130` | confirmed by round 1, following the data to its real sink |
| **Weekly mode IS reachable in edit mode, in two clicks** | see BLOCKER below | **`[R1-1]` corrects this packet's round-1 claim** |
| **Eight tests name weekly mode**, not one: `test.tsx:236-311` (six), `:338-348`, and the DOM-level `:979-1014` | | **`[R1-2]` corrects "only ONE"** |
| Baseline: **94 tests green** in `ScheduleMeetingsDialog.test.tsx` | | `[R1-2]` |
| One e2e covers weekly recurring | `tests/e2e-personas/coach-meeting.spec.ts:197-248` | confirmed |
| `buildEventSessionsPayload`, `computeScheduleSessionDates` and `generateRecurringSessionDates` have **zero importers outside the two Allowed dialog files** | `test.tsx:29` is the only external importer | **verified by round 1 — the worker does NOT need to re-grep** |

### The BLOCKER round 1 found, stated plainly `[R1-1]`

**Nothing gates weekly mode on create mode.** `SegmentedControl` (`:1336-1344`)
renders all three items unconditionally; `onChange` (`:1338`) is a bare
`setMode`; the weekly block (`:1350-1373`) has no `!isEditMode` guard; and the
mode-derived `sessionDates` (`:1032-1042`) feed
`buildEditDesiredFutureSessions(sessionDates, startTime, endTime, …)` at
`:1204-1210`.

Round 1 drove this in its own worktree and captured the payload: **12 Tue/Thu
sessions written onto an EXISTING series, all at one shared 21:00–22:30Z**,
without any time field being touched. My round-1 claim that weekly mode was
"create-mode-only in practice" was false, and building on it would have shipped
per-day inputs that render in edit mode and are silently discarded — which this
very file already calls unacceptable in its own T609 comment (`:1457-1465`:
*"a control that accepts input, shows it applied, and silently discards it is
worse than no control at all"*).

**`resetForm()` forcing `mode = 'custom'` (`:973`) is real but only sets the
opening mode. It is not a guard.**

## 3. What to build

**3.1 State and types `[R1-5]`.** Per-weekday time state keyed by the existing
`WEEKDAY_OPTIONS.value` strings (`'mon'`…`'sun'`, `:330-338`); do not invent a
second weekday vocabulary and do not reorder `WEEKDAY_OPTIONS`.

**Import `Dow` from `src/lib/meetings/format.ts:201`** and use it for the
weekday index. `WEEKDAY_OPTIONS.dayIndex` is already `Dow`-compatible, so this
is nearly free. Importing is allowed and is not a §4 violation: `src/lib/meetings/**`
is forbidden **to edit**, and being frozen is exactly what makes it importable.

**Do NOT adopt `ScheduleRule` (`format.ts:204-211`) as the form-state shape, and
this is a deliberate call the gate should attack (§7.1).** `ScheduleRule` carries
`startMinutes`/`endMinutes` as minutes-since-midnight; the form's live state is
the `HH:MM` `ISOTimeString` that `TimeInput` produces and that
`computeEndTimeError` (`:534`) consumes. Making it the state shape would add a
lossy round-trip and a second validation vocabulary on every keystroke. Also
note `validateScheduleRule` (`format.ts:228-256`) **throws `RangeError` by
design** and is unsuitable for live form validation. `ScheduleRule` is GAM-443's
*rendering* vocabulary; this ticket's form state is not required to be it, and
nothing in this ticket produces a `ScheduleRule`.

`src/lib/meetings/types.ts` **does not exist yet** (verified — the directory
holds only `format.ts`, `format.test.ts`, `resolveCurrentStudentId.ts`), so
nothing may be imported from it. Do not create it; GAM-444 owns that file.

**3.2 Render `[R1-3]` `[R1-9]`.** Per-day rows appear when **all** of:
`mode === 'weekly'`, `recurringWeekdays.length > 1`, **and `!isEditMode`**
(the gate required by `[R1-1]`; see §3.8).

In that state render **exactly N rows for N selected weekdays** — not N−1 — and
**hide the shared `TimeInput` pair**, because a visible control that no longer
contributes a session time is the T609 failure above. The shared pair's current
values **seed** row 1 and every newly-added row, so the same-time-every-day case
still costs zero extra input. Rows follow `WEEKDAY_OPTIONS` order, not click
order.

Rows render as a **sibling block below the `CheckboxList`**, never inside
`CheckboxListItem`. `docs/swarm/astryx-api.md:3337-3339` documents
`### CheckboxListItem` with a literal `undefined` body — **zero props** — so
under constitution item 2 any `children` or `endContent` on it is presumed
hallucinated → MAJOR.

**3.3 Single-weekday behaviour is byte-identical `[R1-7]`.** With zero or one
weekday selected, weekly mode renders and behaves exactly as today. Mechanism in
§5 criterion 3 — this is measured, not asserted.

**3.4 Generation `[R1-10]`.** `computeScheduleSessionDates` **keeps returning
`string[]` and keeps its current signature**; its single/custom dispatch is
pinned by `test.tsx:326-336` and `:350-360`, and `generateRecurringSessionDates`
is called directly by `test.tsx:1009`. Per-day times are applied at the
**payload-building** step, not the date-generation step:
`buildEventSessionsPayload` gains an **additive, optional** per-day time
argument and keeps its existing behaviour when that argument is absent.

Every conversion still goes through `chicagoWallTimeToUtcIso` **per (date, time)
pair** — NFR-09. The offset is probed per date and never cached, which is what
makes a DST-crossing series correct.

**3.5 Validation.** The end-after-start guard holds **per row**, reusing
`computeEndTimeError` (`:534`) rather than a second comparison. `isValid`
(`:1103-1107`) must gain the per-row term, so a bad row blocks submission.

**3.6 Payload shape is frozen.** Keep `onCreateMeetings`'s `{ event, sessions }`
shape (`:318-321`). Round 1 followed it to `insertSessions`
(`loaders/meetings.ts:1103-1116`) and confirmed per-session times already flow
through untouched — **no loader change is needed**. If you nonetheless conclude
the shape must change, **STOP** and say so on GAM-445; a sibling ticket owns the
loader.

**3.7 Accessibility `[R1-8]`.** Each row's inputs must be distinguishable by
accessible name. `TimeInput.label` is a required `string`
(`docs/swarm/astryx-api.md:1736`) and is the accessible name; there is no
`aria-label` prop and none is needed.

**Pin the label form as weekday-FIRST — `"Tue start time"`, `"Tue end time"`.**
Not `"Start time (Tue)"`. `getFieldControl` (`test.tsx:141-154`) matches labels
by **`startsWith`**, so a trailing qualifier would make every existing
`getFieldControl('Start time')` call bind to whichever input happens to render
first — silently rebinding tests to the wrong control.

Per-day rows at 375px must not overflow, and tap targets stay ≥44px. Measure
with `layout-measurement`; do not reason about it from the CSS.

**3.8 Edit mode is gated, not threaded `[R1-1]`.** Of round 1's two options this
packet chooses **(a) gate**: per-day rows render only when `!isEditMode`, so edit
mode keeps exactly today's single-shared-time weekly behaviour and
`buildEditDesiredFutureSessions` (`:829-857`) is **not touched**. Option (b)
(threading per-day times through the edit path) is rejected for this ticket: it
would pull T611's reconcile machinery and its tests (`test.tsx:1944-1983`,
`:1985+`, `:2101`) into scope, and the issue asks for series *creation*.

**This leaves a real, disclosed gap: a coach cannot edit an existing series into
per-day times.** That is a follow-up row (§8), not a silent omission.

## 4. Allowed files (worker may edit ONLY these)

- `src/pages/meetings/ScheduleMeetingsDialog.tsx`
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx`
- `tests/e2e-personas/coach-meeting.spec.ts`
- `tests/e2e-personas/screenshots/**` — **`[R1-4]`**, added because the
  `e2e-personas` skill makes `capture(page, …)` mandatory and those files are
  git-tracked; `coach-meeting.spec.ts` already calls `capture` at `:186` and
  `:195`. Without this the required e2e work could not be committed.

**Forbidden**, each for a reason: `src/pages/meetings/MeetingsList.tsx` and
everything else under `src/pages/meetings/` (a parallel decomposition ticket owns
it); `src/lib/meetings/**` (GAM-443/GAM-444 froze these — **importable, not
editable**); `src/lib/supabase/**`; `supabase/**`; `.github/workflows/**`
(wall 1 — unpushable by this run's credentials, checked at packet time rather
than at push time); `docs/swarm/**` and `.claude/**` (orchestrator-owned).

**No file in Allowed Files is under `.github/workflows/`** — wall 1 is clear.

## 5. Acceptance criteria

1. A P3-shaped series — Tue 6:00–8:00 PM **and** Sun 3:30–6:30 PM over a
   multi-week range — is creatable in one dialog pass, and the emitted
   `sessions[]` carries the correct distinct UTC pair for each weekday.
2. **DST, with the wall time pinned `[R1-6]`.** Unit-level criterion. A Sunday
   rule at **15:30–18:30** Chicago spanning 2026-11-01 emits
   `2026-10-25T20:30:00.000Z` (CDT) and `2026-11-01T21:30:00.000Z` (CST) — same
   wall time, different offset. **Guardrail:** any wall time before 07:00 on
   2026-11-01 fails for a pre-existing, out-of-scope reason already documented at
   `:526-533` (`chicagoWallTimeToUtcIso` probes the offset at the *naive-UTC*
   instant, so `06:00` → `11:00Z` rather than the true `12:00Z`). Do not pick a
   morning time and do not "fix" that here — if it matters, it is a follow-up.
3. **Byte-identical single-weekday, with a mechanism `[R1-7]`.** With ≤1 weekday
   selected the DOM contains **exactly two `TimeInput`s**, and
   `test.tsx:979-1014` passes **unedited**. If that test needs editing, that is a
   §3.3 violation, not a test to update.
4. Single mode and custom mode untouched — shared pair still works, including
   `endTimeError` and `min={startTime}`.
5. Per-row end-before-start blocks submission.
6. **All 94 tests in `ScheduleMeetingsDialog.test.tsx` green.** Any weekly-mode
   assertion deliberately updated is counted and named in the PR, measured
   against that 94 baseline.
7. **Edit mode is provably unaffected `[R1-1]`.** In edit mode with weekly
   selected and Tue+Thu checked, **no per-day time input is rendered at all**,
   and `onSaveMeetingSeries`'s `desiredFutureSessions` are exactly what they are
   today. *A per-day input that is rendered and then discarded is a failure.*
   This criterion must fail against an un-gated build.
8. The e2e weekly test is extended to create a two-different-times series through
   the real UI and **read the `event_sessions` rows back**, asserting both UTC
   pairs — not asserting on what the dialog rendered. Infrastructure exists:
   `sessionsFor(event.id)`/`eventsTitled(title)` at `spec.ts:239-246`, raw
   `starts_at`/`ends_at` assertions at `:183-184`, two-weekday selection at
   `:207-208`. Note the e2e picks dates by grid index (`:221-224`) and cannot
   reach 2026-11-01 without month navigation — **criterion 2 is a unit test, not
   an e2e one.**

## 6. Required skills

`gate-run` (all six gates, one evidence block), `mutation-replay` (mutate the
generator to reuse row 1's time for every row and watch the per-day test go red),
`layout-measurement` (per-day rows at 375px; 44px targets), `e2e-personas`
(create the series as coach; read `event_sessions` back), `meetings-design`
before touching anything under `src/pages/meetings/**`.

## 7. Least confident decisions (round 2) — attack these first

1. **`ScheduleRule` is deliberately NOT the form-state shape (§3.1).** I adopted
   `Dow` but kept `HH:MM` strings for state. **What would make this wrong:** if a
   sibling ticket needs this dialog to *emit* `ScheduleRule[]`, my local shape
   becomes the second re-derivation the `meetings-design` skill exists to stop —
   the exact mistake round 1 caught me making with `Dow`.
2. **Gate rather than thread for edit mode (§3.8).** **What would make this
   wrong:** if a coach editing P3/GG into per-day times is the actual September
   need, then shipping create-only solves the demo and not the job, and the
   follow-up row is a deferral of the real work rather than of an edge.
3. **Hiding the shared pair in weekly-multi is better than disabling or
   relabelling it (§3.2).** **What would make this wrong:** a control that
   vanishes on the second checkbox may read as a bug to the coach; a relabelled
   "default time for new days" might be clearer than absence.
4. **`buildEventSessionsPayload`'s optional argument keeps old callers correct
   (§3.4).** **What would make this wrong:** if any of the eight weekly tests
   asserts on the *absence* of a fourth/fifth argument or on exact arity, an
   additive parameter is not as invisible as I am claiming.
5. **Per-day times persist across a mode switch by doing nothing `[R1-12]`.**
   Round 1 established there is no mode-switch reset at all (`:1338` is a bare
   `setMode`; `recurringWeekdays`, `recurringRange` and `customDates` all
   survive), so persisting is free and consistent. **What would make this wrong:**
   stale per-day times surviving a weekday being unchecked and re-checked could
   resurrect a time the coach believed they had removed.

## 8. Follow-up to file before the PR opens (item 20)

Editing an existing series into per-day times is **out of scope by §3.8's
choice**, not by oversight. File it to `Backlog` carrying `unreviewed`, via the
`linear-task-writing` skill, before the PR leaves draft.
