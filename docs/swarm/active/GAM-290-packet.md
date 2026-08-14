# GAM-290 task packet (HEAVY)

**T614 — The End time field has no lower bound, so a series edit can persist a
meeting whose end is before its start**

Tier: **HEAVY** (item 26 — **write path**; corrected in round 2, the original
"feeds metric SQL" half was false and is retracted in §1).
Author: orchestrator. Gate: `checker-premise` must return **DISPATCH** before
any worker sees this (item 19). Round 1: REVISE — see §8.

## 1. Defect

`ScheduleMeetingsDialog` can persist an `event_sessions` row whose `endsAt` is
earlier than its `startsAt`. Nothing in the dialog forbids it:

- `src/pages/meetings/ScheduleMeetingsDialog.tsx:1376-1381` — the "End time"
  `TimeInput` carries `label`, `value`, `onChange`, `isRequired` and **no**
  `min` (verified by reading the file at HEAD `a633f8b`, 2026-08-14).
- `:1045-1048` — `isValid` gates edit mode on `title.trim() !== ''` and, when
  `timeFieldsTouched`, on both times merely being **defined**. It never compares
  them. **Note the two branches are separate expressions** (`:1046-1047` edit,
  `:1048` create) — §3.4 depends on this.
- `buildEditDesiredFutureSessions` (`:784-812`) writes
  `startsAt: chicagoWallTimeToUtcIso(date, startTime)` / `endsAt: …(date,
  endTime)` with no ordering check, and `updateSessionTime`
  (`src/lib/supabase/loaders/meetings.ts:701-711`) persists it.

**Measured, by the round-1 premise gate, driving the real dialog** — this closes
the gap the issue's own Verification note left open ("What was NOT re-verified:
the effect"). Edit mode, a 16:00–17:30 session, typing into **Start only**:

```
desiredFutureSessions=[{ "sessionDate":"2026-09-14",
  "startsAt":"2026-09-15T00:00:00.000Z", "endsAt":"2026-09-14T22:30:00.000Z" }]
INVERTED (endsAt < startsAt)? true   delta_minutes=-90
```

### Consequence — corrected against the issue's own text, and measured

⚠ **The issue's stated harm is false, and this packet no longer repeats it.**
The issue says `v_planned_rsvp_hours` receives negative planned hours. It cannot:
that view requires `e.counts_volunteer_hours`
(`supabase/migrations/20260724000001_planned_hours_future_guard.sql:71`), and
every meeting event is created with `counts_volunteer_hours: false`
(`src/lib/supabase/loaders/meetings.ts:1096`; importer `scripts/migrate/transform.ts:108`).
The series-edit update never writes that column. **A meeting session cannot enter
that metric**, nor `v_student_hours`, `v_season_kpis`, or
`computeStudentPlannedHours`.

**The real, measured harm is the calendar feed.** `supabase/functions/ics/index.ts:230-238`
selects `event_sessions` filtered only by `event_id` and `starts_at`, with **no
`counts_volunteer_hours` filter**, and `ics_builder.ts:65` passes `endsAt`
straight to `ical-generator`. An inverted row emits a `VEVENT` whose `DTEND`
precedes its `DTSTART`, into a calendar a student or parent has subscribed to —
plus a nonsense range wherever the session is displayed.

**The HEAVY tier is unaffected.** It rests on item 26's *write path* trigger,
which stands on its own; the metric claim was never load-bearing for tiering.
There is **no `CHECK` constraint** on `event_sessions` guarding the interval
(confirmed: no `check (` in `20260717000000_scheduling_attendance.sql`).

## 2. The issue's own prescription is incomplete — read this before implementing

The issue is titled "The End time field has no lower bound" and says the field
"carries no `min={startTime}`". **`min` is a real Astryx prop** — verified at
`docs/swarm/astryx-api.md:1747`, `min: ISOTimeString`, "Values outside the range
are rejected" — so adding it is feasible under constitution item 2, and is not a
hallucinated prop.

**But `min={startTime}` alone does not fix the reproduction this issue
records — this is now measured, not reasoned.** The round-1 gate added
`min={startTime}` to the End field and re-ran the reproduction above:

```
after Start edit: start='7:00 PM' end='5:30 PM' end.aria-invalid=null saveDisabled=false
body contains error copy? false
INVERTED (endsAt < startsAt)? true   delta_minutes=-90     <-- byte-identical payload
```

The cause is in the installed component: `TimeInput` consults `min` in exactly
four places (`handleInputChange:474`, `handleBlur:511`, `handleInputKeyDown:552`,
`isInputValid:440-451`) and **all four are user-entry paths**. No effect, memo or
reducer re-checks `value` against `min`; `clampTime` exists in
`utils/timeParser.ts:324` and `TimeInput` never imports it. So moving Start past
an untouched End consults no bound at all.

Therefore the load-bearing fix is a **submit-time ordering guard**, and `min` is
a secondary affordance. A worker that adds only `min` produces a green diff over
a live defect.

## 3. Prescription — reuse the sibling dialog's already-shipped pattern

`EditMeetingSessionDialog` solved this exact problem already. Do not invent a
second approach; mirror it.

`src/pages/meetings/EditMeetingSessionDialog.tsx:300-323`, verbatim shape:

```ts
if (endTime !== undefined) {
  const endsAt = chicagoWallTimeToUtcIso(date, endTime);
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    errors.endTime = 'End time must be after the start time.';
  }
}
```

surfaced through the End `TimeInput`'s `status` prop (`:487-496`) and gating the
confirm button.

Required in `ScheduleMeetingsDialog`:

1. **A pure, separately testable helper** — e.g.
   `computeEndTimeError(startTime, endTime): string | undefined` — placed with
   the file's existing pure helpers (the `:222-227` "Pure, separately testable
   validate/build functions" block in the sibling is the house pattern). It
   returns the message when both values are defined and end is not after start,
   and `undefined` otherwise. **Two undefined values are not an error** — the
   existing `isValid` already handles undefined-ness, and duplicating it here
   would change unrelated behaviour. (This is also what keeps `:1927`'s
   "clearing a touched time field disables Save" green.)

   ⚠ **Compare wall-clock, NOT UTC — do not route this guard through
   `chicagoWallTimeToUtcIso`.** Compare the raw `HH:MM` values as
   minutes-since-midnight (lexical is provably equivalent here — every value is
   zero-padded `HH:MM`: `timeParser.ts:81-89`, `hasSeconds` is never set,
   `formatChicagoWallTime:710-715` — but write minutes-since-midnight so a
   future `hasSeconds` cannot silently break it). This is *simpler* than the
   sibling's UTC round-trip: no `date`, no `Date` allocation, no DST exposure.

   **Why this is not a preference.** The round-1 gate enumerated every
   15-minute pair on four dates and found the UTC comparison disagrees with
   wall-clock on **16 pairs on 2026-03-08**, because
   `chicagoWallTimeToUtcIso` (`:476-480`) probes the zone offset at the *naive-UTC*
   instant, putting the spring-forward discontinuity at wall **07:00–07:59**:

   ```
   wall 07:00 -> 2026-03-08T13:00:00.000Z
   wall 08:00 -> 2026-03-08T13:00:00.000Z    <-- collapses onto 07:00
   ```

   A UTC comparison would therefore raise "End time must be after the start
   time." on an ordinary **07:00–08:00 Chicago meeting** — a false block on a
   valid entry. That underlying offset bug is real, is **out of scope here**,
   and is filed separately (§4).
2. **Reuse the sibling's exact copy string**: `End time must be after the start
   time.` Constitution item 14 (PRD DES-14…16) governs copy, and an identical
   condition in a sibling dialog must not acquire a second wording.
3. **Surface it on the End `TimeInput`** via
   `status={{ type: 'error', message }}` — `status` is a verified prop
   (`astryx-api.md:1755`). Item 12's four-states rule is unaffected; this is
   field validation, not a screen state.
4. **Gate `isValid` — BOTH branches, and they are not symmetric** (`:1045-1048`).
   The **create** branch (`:1048`) gets the guard **unconditionally**. The
   **edit** branch (`:1046-1047`) gets it in the existing
   `!timeFieldsTouched || …` shape. Gating only the edit branch satisfies most
   of §6 while leaving create inverting — measured: create with `22:00→00:30`
   persists **−1290 minutes**, and `18:00→18:00` persists a zero-length session.
   Confirmed sufficient: `handleSubmit` has exactly one caller
   (`clickAction={handleSubmit}` at `:1421`), there is no `<form>` and no
   Enter-to-submit, Astryx `Button` returns early on `disabled` before
   `clickAction`, and `handleSubmit` re-guards at `:1130`.
5. **Add `min={startTime}` to the End `TimeInput`** as the secondary entry
   guard. Keep it — it is correct and cheap — but §2 is why it is not the fix.
   **The two mechanisms own different cases and do not compose:** with `min`
   set, an out-of-range *typed* End is announced as "Invalid time" while typing
   and then **silently reverted on blur** (`TimeInput.tsx:510-518` never commits
   it), so `endTime` never changes and the §3.2 message never appears for that
   path. `min` owns typed entry; the guard owns "Start moved past a settled
   End". Do not expect the error string in both, and do not write a test that
   types an invalid End and asserts the message.

**Edit-mode interaction that must be preserved.** When `timeFieldsTouched` is
`false`, untouched sessions reuse their own stored times
(`buildEditDesiredFutureSessions:793`, `originalTimesByDate`) and the shared
fields' displayed values are not written. The new gate must therefore **not**
block a save on the displayed pair while `timeFieldsTouched` is `false` — that
would break T611's passed behaviour, which constitution Definition-of-Ready item
5 forbids reversing silently. Follow `isValid`'s existing
`!timeFieldsTouched || …` shape.

**One residual path this carve-out cannot cover, and you must not "fix" it.**
With `timeFieldsTouched === false`, adding a *new* date writes the shared
displayed pair for that date (`:803-809`, no `original` to reuse), so an
already-inverted series can still propagate. Closing that would require gating
on untouched fields, which breaks T611. Leave it; it is named in §4.

## 4. Scope boundaries

**In scope:** `ScheduleMeetingsDialog.tsx` and its test file.

**Out of scope, deliberately, each with its reason:**

- **A `CHECK` constraint on `event_sessions`.** It is the durable fix and this
  packet does not order it: it is a migration (constitution item 18 would force
  an opus worker and item 10 governs additive migrations), and it would fail
  against any inverted row already persisted, which needs a data audit this row
  has not scoped. **Filed under item 20** — see below.
- **`EditMeetingSessionDialog`** — already guarded; touching it is unrequested.
- **`OutreachEventDialog`.** The round-1 gate falsified this packet's original
  claim that the meetings dialog is the only unguarded writer.
  `OutreachEventDialog.tsx:1492-1503` → `src/lib/supabase/loaders/outreach.ts:1484`
  (insert) and `:1500-1515` (update) write `starts_at`/`ends_at` with the same
  missing guard — **and outreach events do carry `counts_volunteer_hours: true`**
  (`outreach.ts:1452`), so the negative-planned-hours harm the issue wrongly
  attributed to meetings **is real on that surface**. Out of scope here, filed
  under item 20, and it is why this packet's honest claim is narrow: *the
  meetings dialog cannot persist an inverted interval*, not *inverted intervals
  cannot be persisted*.
- **The create path is IN scope** (contrary to this packet's round-1 wording).
  The guard lives in shared dialog state, but `isValid`'s two branches are
  separate expressions, so §3.4 requires the create branch be gated explicitly.
  The worker must not add a *separate* create-path mechanism — one helper, two
  call sites.

**Item 20 follow-ups the orchestrator files (not the worker):** (a) the
`event_sessions` interval `CHECK` constraint plus an audit for
already-persisted inverted rows; (b) the `OutreachEventDialog` ordering guard;
(c) the `chicagoWallTimeToUtcIso` spring-forward offset bug measured in §3.1,
which persists a valid 07:00–08:00 meeting on 2026-03-08 as a zero-length
session an hour late.
- **`.github/workflows/**`** — not in Allowed Files, and a dispatched run cannot
  push it (`AGENTS.md` § "Two walls"). Checked at packet time, per that section.

## 5. Allowed Files

- `src/pages/meetings/ScheduleMeetingsDialog.tsx`
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx`

Nothing else. `.claude/**`, `docs/swarm/**`, `supabase/**` and workflow files are
forbidden to the worker.

## 6. Acceptance criteria

1. Moving **Start** past an untouched pre-existing **End** — the issue's own
   reproduction — leaves the confirm button disabled and shows `End time must be
   after the start time.` on the End field. A test asserts this **through the
   Start field only**, because a test that types into End would pass against a
   `min`-only implementation and prove nothing (§2).
2. Equal start and end is an error (the sibling uses `<=`, not `<`).
3. A valid pair (end after start) submits and produces an unchanged payload —
   no regression to `buildEventSessionsPayload` output.
4. Edit mode with `timeFieldsTouched === false` still saves, with per-session
   original times, even when the displayed shared pair would be invalid (§3).
4b. **Create mode** (§3.4): an inverted pair (`22:00`/`00:30`) and an equal pair
   (`18:00`/`18:00`) each leave the confirm button disabled and show the error;
   a valid pair still produces unchanged `buildEventSessionsPayload` output.
   Without this criterion a worker can gate the edit branch only and pass
   everything else.
4c. A **07:00–08:00 session on `2026-03-08`** is accepted, not blocked. This is
   the DST regression test for §3.1's wall-clock requirement: it fails if the
   worker routes the comparison through `chicagoWallTimeToUtcIso`.
5. **Mutation proof** (item 26): with the guard's comparison inverted or removed,
   criterion 1's test turns **red**. Report the real red output and exit code.
6. All six gates green via the `gate-run` skill.

Criterion 1 is the one that matters; the others stop it being satisfied cheaply.

## 6b. Setup note

`node_modules/` is empty in a fresh clone of this tree — run `npm ci` first.
Nothing in this packet is measurable without it.

## 7. Least confident decisions (item 19d) — round-1 outcomes recorded

**Round-1 status: #1 SOUND (measured), #3 SOUND (measured), #4 SOUND (measured),
#2 WRONG, #5 WRONG.** Item 19d says declaring a doubt is not held against the
author; two of these five were wrong and both were caught because they were
declared. The original text is kept below with its verdict, per item 30d's
principle that deleting the error deletes the evidence the check happened.
Round-2 doubts are listed after them.

1. **That `min={startTime}` does not fix the recorded reproduction (§2).** This
   is the packet's central claim and it is reasoned from Astryx's prop
   documentation, **not measured**. What would make it wrong: if Astryx's
   `TimeInput` re-validates its controlled `value` against a changed `min` on
   re-render and fires `onChange(undefined)` or clamps, then moving Start would
   clear or correct End on its own and `min` alone would be sufficient. Read the
   component's source or drive it before accepting §2.
   → **SOUND, measured.** The falsifying condition does not exist in the
   installed source and does not occur when driven. §2 carries the evidence.
2. **[WRONG — and wrong in the dangerous direction; see §3.1]** ~~That the pure
   helper may compare wall-clock `HH:MM` strings.~~ Both times
   apply to the same date, so a lexical compare is *probably* equivalent to the
   sibling's UTC round-trip and avoids needing a `date`. What would make it
   wrong: a DST-transition date, where `chicagoWallTimeToUtcIso` is not monotone
   in wall-clock time and a 02:00–03:00 pair does not exist (NFR-09 stores UTC,
   displays America/Chicago). If in doubt the worker takes the sibling's
   date-based UTC comparison — but the sibling *has* a `date` per session and
   this dialog has many, which is the whole reason the question exists.
   → **The premise was right and the fallback was wrong.** Wall-clock is
   correct; the UTC fallback this text recommends would false-block a valid
   07:00–08:00 meeting on 2026-03-08. The discontinuity is not at 02:00 as
   guessed — `chicagoWallTimeToUtcIso` probes the offset at the naive-UTC
   instant, moving it to wall 07:00–07:59. **§3.1 now forbids that fallback.**
3. **That a midnight-crossing meeting is not a supported case.** The guard makes
   an 22:00→00:30 session impossible to enter. The recorded measurement shows no
   next-day roll logic anywhere in this dialog, so such a session is already
   unrepresentable — but if the team schedules any competition build night that
   crosses midnight, this guard converts silent corruption into a blocked
   workflow, which is a worse trade for that user.
   → **SOUND, measured.** `22:00→00:30` today persists **−1290 minutes**; no
   next-day roll exists in either builder. The trade is accepted knowingly: the
   blocked coach gets an error and no alternative, so "overnight sessions" is
   filed as a follow-up rather than left implicit.
4. **That gating `isValid` is better than blocking in `handleSubmit`.** A
   disabled confirm button with an inline field error follows the sibling and
   DES-12/DES-14. What would make it wrong: if some caller drives submit
   programmatically past the button, the state gate protects nothing and the
   check belongs at the payload builder.
   → **SOUND, measured.** One caller, no `<form>`, no Enter-to-submit, Astryx
   `Button` returns early on native `disabled`, and `handleSubmit` re-guards at
   `:1130`. No escape path.
5. **[WRONG — the falsifying condition is present]** ~~That the `CHECK`
   constraint is correctly deferred (§4).~~ The UI guard
   stops the dialog and stops nothing else; any other writer of `event_sessions`
   remains free to invert an interval. What would make it wrong: evidence of a
   second write path to `event_sessions` in this codebase, which would make the
   UI-only fix a partial one and item 27's `Partial` status the honest outcome.
   → **There is one:** `OutreachEventDialog` → `loaders/outreach.ts:1484/:1500`,
   unguarded, and on the `counts_volunteer_hours: true` path that genuinely
   reaches `v_planned_rsvp_hours`. The **deferral of the `CHECK` constraint
   still stands** (it is a migration needing a data audit), but its *rationale*
   was wrong and §4 now says so. GAM-290's honest claim is narrowed
   accordingly — see §8 for why this is not item 27 `Partial`.

### Round-2 least confident decisions

6. **That this row closes `Passed`, not `Partial` (item 27).** GAM-290's own
   surface — the meetings dialog — reads and writes real data and is fully
   guarded by this change, so item 27's test ("does the surface this task ships
   read real data, on the real path a user takes?") is satisfied. What would
   make it wrong: reading GAM-290's scope as "inverted intervals cannot be
   persisted" rather than "this dialog cannot persist one", in which case the
   unguarded outreach path makes it `Partial` pending follow-up (b).
   The checker should rule on this explicitly rather than inherit my reading.
7. **That the residual `!timeFieldsTouched` propagation path (§3) is acceptable
   to leave open.** It is genuinely unclosable without reversing T611, but it
   means an already-inverted series can still spread its bad pair to a newly
   added date. What would make it wrong: if inverted rows already exist in
   production, this is a live spreader and follow-up (a)'s audit becomes urgent
   rather than routine.
8. **That no test asserts the ICS consequence.** §1's corrected harm is the
   calendar feed, but the ACs stop at the payload. What would make it wrong: if
   a reviewer holds that a harm named in §1 must be covered by a criterion —
   defensible, though the Edge Function is outside Allowed Files and asserting
   it would need the `scratch-postgres` or persona harness for a one-line
   consequence of an interval the guard now makes unreachable from this dialog.

## 8. Round-1 gate record (item 19, "Record the verdict alongside the plan")

Round 1: **REVISE** — 3 MAJOR, 4 MINOR, 1 NIT, no BLOCKER. All eight required
revisions applied above. The gate's own summary of the core: *"The packet's
central §2 claim is correct and now measured — do not weaken §3."*

What the gate changed, in order of consequence:

1. The stated **harm** was false (metric unreachable from meetings) and is
   replaced with a measured one (ICS `DTEND < DTSTART`). The tier is unchanged.
2. The **comparison** was under-specified and the declared fallback was actively
   wrong on a DST date.
3. The **create branch** needed explicit gating and a criterion of its own.
4. A **second write path** exists, falsifying LCD #5's rationale.

What it confirmed by running rather than reading: the defect reproduces
(−90 min), `min` alone does not fix it (byte-identical payload), midnight
crossing persists −1290 min, `isValid` has no escape path, and no currently-green
test breaks (82 passing baselined).

This is round 1 of the two permitted by item 19a. A round-2 REVISE is expected to
be short; a third escalates to the human owner rather than looping.
