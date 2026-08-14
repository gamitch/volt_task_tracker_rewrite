# GAM-290 task packet (HEAVY)

**T614 — The End time field has no lower bound, so a series edit can persist a
meeting whose end is before its start**

Tier: **HEAVY** (item 26 — write path + the corrupted value feeds metric SQL).
Author: orchestrator. Gate: `checker-premise` must return **DISPATCH** before
any worker sees this (item 19).

## 1. Defect

`ScheduleMeetingsDialog` can persist an `event_sessions` row whose `endsAt` is
earlier than its `startsAt`. Nothing in the dialog forbids it:

- `src/pages/meetings/ScheduleMeetingsDialog.tsx:1376-1381` — the "End time"
  `TimeInput` carries `label`, `value`, `onChange`, `isRequired` and **no**
  `min` (verified by reading the file at HEAD `a633f8b`, 2026-08-14).
- `:1045-1048` — `isValid` gates edit mode on `title.trim() !== ''` and, when
  `timeFieldsTouched`, on both times merely being **defined**. It never compares
  them.
- `buildEditModeSessionsPayload` (`:786-810`) writes
  `startsAt: chicagoWallTimeToUtcIso(date, startTime)` / `endsAt: …(date,
  endTime)` with no ordering check, and `updateSessionTime`
  (`src/lib/loaders/meetings.ts`) persists it.

Consequence, quoted from the issue: `v_planned_rsvp_hours` derives from this
interval, so an inverted span reaches the metric as **negative planned hours**
for every RSVP'd student, and there is **no `CHECK` constraint** on
`event_sessions` to stop it. This is a lie told to a user about their own data,
which is item 26's HEAVY trigger.

## 2. The issue's own prescription is incomplete — read this before implementing

The issue is titled "The End time field has no lower bound" and says the field
"carries no `min={startTime}`". **`min` is a real Astryx prop** — verified at
`docs/swarm/astryx-api.md:1747`, `min: ISOTimeString`, "Values outside the range
are rejected" — so adding it is feasible under constitution item 2, and is not a
hallucinated prop.

**But `min={startTime}` alone does not fix the reproduction this issue
records.** The measured repro touched **only the Start field**. `min` constrains
what the coach may *enter into the End field*; it does not re-validate an End
value that is already in state when Start moves past it. Set Start to 19:00
against a pre-existing End of 17:30 and the End input is never interacted with,
so no bound of any kind is consulted and the inverted pair persists exactly as
before.

Therefore the load-bearing fix is a **submit-time ordering guard**, and `min` is
a secondary affordance. A worker that adds only `min` will produce a green diff
that leaves the reported defect live.

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
   the file's existing pure helpers (the `:223` "Pure, separately testable
   validate/build functions" block in the sibling is the house pattern). It
   returns the message when both values are defined and end is not after start,
   and `undefined` otherwise. **Two undefined values are not an error** — the
   existing `isValid` already handles undefined-ness, and duplicating it here
   would change unrelated behaviour.
2. **Reuse the sibling's exact copy string**: `End time must be after the start
   time.` Constitution item 14 (PRD DES-14…16) governs copy, and an identical
   condition in a sibling dialog must not acquire a second wording.
3. **Surface it on the End `TimeInput`** via
   `status={{ type: 'error', message }}` — `status` is a verified prop
   (`astryx-api.md:1755`). Item 12's four-states rule is unaffected; this is
   field validation, not a screen state.
4. **Gate `isValid`** (`:1045-1048`) on the helper returning `undefined`, so the
   confirm button disables rather than the dialog silently refusing on click.
5. **Add `min={startTime}` to the End `TimeInput`** as the secondary entry
   guard. Keep it — it is correct and cheap — but §2 is why it is not the fix.

**Edit-mode interaction that must be preserved.** When `timeFieldsTouched` is
`false`, untouched sessions reuse their own stored times
(`buildEditModeSessionsPayload:793`, `originalTimesByDate`) and the shared
fields' displayed values are not written. The new gate must therefore **not**
block a save on the displayed pair while `timeFieldsTouched` is `false` — that
would break T611's passed behaviour, which constitution Definition-of-Ready item
5 forbids reversing silently. Follow `isValid`'s existing
`!timeFieldsTouched || …` shape.

## 4. Scope boundaries

**In scope:** `ScheduleMeetingsDialog.tsx` and its test file.

**Out of scope, deliberately, each with its reason:**

- **A `CHECK` constraint on `event_sessions`.** It is the durable fix and this
  packet does not order it: it is a migration (constitution item 18 would force
  an opus worker and item 10 governs additive migrations), and it would fail
  against any inverted row already persisted, which needs a data audit this row
  has not scoped. **File it under item 20** rather than leaving it in a comment.
- **`EditMeetingSessionDialog`** — already guarded; touching it is unrequested.
- **The create path.** The issue notes create "inverts identically". The guard
  prescribed here lives in shared dialog state and covers both modes; the worker
  must not add a *separate* create-path mechanism.
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
5. **Mutation proof** (item 26): with the guard's comparison inverted or removed,
   criterion 1's test turns **red**. Report the real red output and exit code.
6. All six gates green via the `gate-run` skill.

Criterion 1 is the one that matters; the others stop it being satisfied cheaply.

## 7. Least confident decisions (item 19d) — attack these first

1. **That `min={startTime}` does not fix the recorded reproduction (§2).** This
   is the packet's central claim and it is reasoned from Astryx's prop
   documentation, **not measured**. What would make it wrong: if Astryx's
   `TimeInput` re-validates its controlled `value` against a changed `min` on
   re-render and fires `onChange(undefined)` or clamps, then moving Start would
   clear or correct End on its own and `min` alone would be sufficient. Read the
   component's source or drive it before accepting §2.
2. **That the pure helper may compare wall-clock `HH:MM` strings.** Both times
   apply to the same date, so a lexical compare is *probably* equivalent to the
   sibling's UTC round-trip and avoids needing a `date`. What would make it
   wrong: a DST-transition date, where `chicagoWallTimeToUtcIso` is not monotone
   in wall-clock time and a 02:00–03:00 pair does not exist (NFR-09 stores UTC,
   displays America/Chicago). If in doubt the worker takes the sibling's
   date-based UTC comparison — but the sibling *has* a `date` per session and
   this dialog has many, which is the whole reason the question exists.
3. **That a midnight-crossing meeting is not a supported case.** The guard makes
   an 22:00→00:30 session impossible to enter. The recorded measurement shows no
   next-day roll logic anywhere in this dialog, so such a session is already
   unrepresentable — but if the team schedules any competition build night that
   crosses midnight, this guard converts silent corruption into a blocked
   workflow, which is a worse trade for that user.
4. **That gating `isValid` is better than blocking in `handleSubmit`.** A
   disabled confirm button with an inline field error follows the sibling and
   DES-12/DES-14. What would make it wrong: if some caller drives submit
   programmatically past the button, the state gate protects nothing and the
   check belongs at the payload builder.
5. **That the `CHECK` constraint is correctly deferred (§4).** The UI guard
   stops the dialog and stops nothing else; any other writer of `event_sessions`
   remains free to invert an interval. What would make it wrong: evidence of a
   second write path to `event_sessions` in this codebase, which would make the
   UI-only fix a partial one and item 27's `Partial` status the honest outcome.
