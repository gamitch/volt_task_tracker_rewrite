# GAM-377 — worker packet

**Issue:** GAM-377 — the outreach event dialog has no start/end ordering guard,
so a coach can save an outreach session whose end is before its start.
**Tier:** HEAVY (item 26 — guards a **write path**, and the value it guards
feeds metric SQL via `counts_volunteer_hours: true`).
**Branch:** `claude/gam-377-outreach-end-ordering-guard`
**Prior art:** GAM-290 (`docs/swarm/active/GAM-290-packet.md`) shipped the
identical guard on the meetings dialog. **Port it; do not re-derive it.**

Every citation below was re-verified against this branch's base `debe8e4` by the
orchestrator before this packet was written (item 19c). Line numbers are current.

---

## 1. The defect

`OutreachEventDialog.tsx:1200` is, verbatim:

```ts
const isValid = title.trim() !== '' && sessionsPayload.length > 0;
```

That checks the per-session times are **present**, never that they are
**ordered**. The two per-session `TimeInput`s at `:1492-1503` carry neither a
`min` nor a `status` prop. So a coach who types an End earlier than that day's
Start gets an enabled confirm button and a persisted inverted interval.

`buildOutreachSessionsPayload` (`:873-892`) then writes both values straight
through to `starts_at`/`ends_at` with no comparison, and outreach events are
created with `countsVolunteerHours: true` (`OUTREACH_FIXED_FLAGS`, `:660-663`),
which is what puts the inverted interval into `v_planned_rsvp_hours` as
**negative planned hours**. That is the hours-honesty defect (PRD 5.7), and it
is why this row is HEAVY rather than a cosmetic validation nit.

## 2. The near-miss to avoid

**`min={startTime}` is not the fix.** GAM-290 measured this twice on the
meetings dialog: moving *Start* past an already-settled End never consults
`min`, and the persisted inverted payload was byte-identical with `min`
present. `min` is a worthwhile **secondary** affordance — it rejects an
out-of-range *typed* End before it commits — but the load-bearing guard is the
comparison that gates `isValid`. Ship both, and do not confuse which one is
doing the work. `ScheduleMeetingsDialog.tsx:1440-1452` carries a comment saying
exactly this; mirror that comment's intent.

## 3. The one hard constraint

**Compare wall-clock minutes-since-midnight. Do NOT route the comparison
through `chicagoWallTimeToUtcIso`** (this file's own copy is at `:835`, and
`buildOutreachSessionsPayload:885-886` uses it for the *payload* — that is
correct and stays). That helper resolves the America/Chicago offset at the
*naive-UTC* instant, which places the 2026-03-08 spring-forward discontinuity
at wall 07:00–07:59 and collapses 08:00 onto 07:00. A UTC-instant comparison
would therefore **false-block an ordinary, valid 07:00–08:00 session** on such
a date. That underlying offset bug is filed separately and is **not** this
row's work — just do not build on it.

## 4. What to change

### 4a. Port the helper

`ScheduleMeetingsDialog.tsx:534` exports `computeEndTimeError`, and
`:512` defines its private dependency `timeStringToMinutesSinceMidnight`.
**`timeStringToMinutesSinceMidnight` is module-private and is NOT exported** —
so a cross-import of `computeEndTimeError` alone would work, but importing one
page component's internals into another page component is not a seam this
codebase has. **Define a local copy of both in `OutreachEventDialog.tsx`**,
exported for test, carrying the same `<=` semantics (an *equal* pair is also an
error) and the same copy string, byte-for-byte:

```
End time must be after the start time.
```

Both `undefined` returns `undefined` — do **not** treat unset times as an
error. Presence is already `isValid`'s job via `sessionsPayload.length > 0`,
and duplicating it here would change unrelated behaviour.

Add a comment naming GAM-377, pointing at `ScheduleMeetingsDialog.tsx:534` as
the origin, and restating §3's DST reason for wall-clock comparison — the next
reader must not "simplify" it into `chicagoWallTimeToUtcIso`.

### 4b. Compute the error **per session**

This is the one structural difference from GAM-290, which had a single shared
pair. This dialog holds a start/end pair **per date** in
`effectiveSessionDetails` (`:1167-1170`), edited through
`updateSessionDetail(date, …)` (`:1203-1211`). So the guard is a per-date map
or lookup derived from `effectiveSessionDetails`, not one scalar.

### 4c. Gate `isValid` on **every** session

`:1200` gains a clause meaning "no selected date has an inverted pair". One bad
day disables the save for the whole dialog.

### 4d. Surface the error on the offending day's End field

The `TimeInput` at `:1498-1503` gains `status={…}` built from *that date's*
error, in the shape `ScheduleMeetingsDialog.tsx:1448-1452` uses:

```tsx
status={error !== undefined ? { type: 'error', message: error } : undefined}
```

`status` (`InputStatus`) and `min` (`ISOTimeString`) are both documented
`TimeInput` props — `docs/swarm/astryx-api.md:1747` and `:1755`. Verified; item
2 is satisfied and neither is hallucinated.

The per-day labels (`` `End time (${formatFriendlyDate(date)})` ``, `:1499`)
already make the error attributable to the right day, which is what makes 4c's
whole-dialog block navigable rather than mysterious.

### 4e. Add `min` to the End field as the secondary affordance

`min={detail?.startTime}` on `:1498`'s `TimeInput`, with the §2 comment.

## 5. The decision this packet makes, and why

**An inverted pair blocks the WHOLE save, and additionally marks that day's End
field.** The issue explicitly left this open. Ruling, and the worker must not
quietly reverse it:

The rejected alternative is "skip the inverted day and save the rest", which
would look consistent with `buildOutreachSessionsPayload`'s existing behaviour
of skipping a date whose times are **unset** (`:880-882`). It is not the same
case. Unset means the coach has not filled that day in and no row *can* be
built. Inverted means the coach filled it in and got it wrong — silently
dropping it would accept input, show it applied, and discard it, which is
precisely the failure this codebase already has a ruling against
(`ScheduleMeetingsDialog.tsx:1457-1465` cites `auto-mode-decisions.md`'s
"2026-07-30 — George's ruling on T169", finding 1, for exactly that shape).
Blocking the whole save loses nothing: the coach sees which day is red and
fixes it.

## 6. Allowed Files

- `src/pages/outreach/OutreachEventDialog.tsx`
- `src/pages/outreach/OutreachEventDialog.test.tsx`

**Nothing else.** In particular: no `supabase/migrations/**`, no
`src/lib/supabase/loaders/**`, no `.github/workflows/**` (a dispatched run
cannot push that path at all — `AGENTS.md` § "Two walls", wall 1), no
`docs/swarm/**`, no `.claude/**`. The loader is deliberately out of scope: the
write path is unchanged and the guard belongs at the dialog, where the coach
can see and fix the error.

If you believe a fix requires a file outside this list, **stop and say so** —
that is an item 20 deferral and it becomes a filed row, not a code comment.

## 7. Acceptance criteria

Each is measurable with fixtures that exist today.

1. **AC1 — the helper is pure and correct.** Unit tests over the ported helper:
   both-undefined → `undefined`; one-undefined (each way) → `undefined`;
   ordered pair (`'09:00'`, `'12:00'`) → `undefined`; **equal** pair
   (`'09:00'`, `'09:00'`) → the copy string; inverted pair (`'12:00'`,
   `'09:00'`) → the copy string; and the **DST regression case**
   (`'07:00'`, `'08:00'`) → `undefined`, with a comment naming §3 as the reason
   that case exists. (Shape mirrors `ScheduleMeetingsDialog.test.tsx:426-455`.)
2. **AC2 — the error renders on the offending day.** Render the dialog, select
   a date, set that day's End before its Start, and assert the copy string is
   in the DOM.
3. **AC3 — the save is actually blocked.** With one inverted session, the
   confirm button is disabled, and the injected create/persist seam is **not**
   called. Asserting the button's disabled state alone is insufficient — AC3 is
   about the write not happening.
4. **AC4 — multi-session attribution.** With two selected dates, one valid and
   one inverted: the copy string appears (AC2), the save is blocked (AC3), and
   the **valid** day's own End field does not carry the error.
5. **AC5 — no false block.** An ordinary valid multi-session form still saves,
   and the persisted payload is unchanged from before this task. This is the
   criterion that catches an over-broad guard.
6. **AC6 — the connection, not the render** (item 27). Name, in your report,
   the real path from the guarded field to `event_sessions`:
   `TimeInput` → `updateSessionDetail` → `sessionDetails` →
   `effectiveSessionDetails` → `buildOutreachSessionsPayload` →
   `startsAt`/`endsAt`. The guard must sit on that path, not beside it.
7. **AC7 — a named mutation turns a test red.** Delete the new `isValid`
   clause (4c) and confirm AC3 fails. **Commit your work before mutating, and
   run the mutation in your own worktree** (items 23 and 26). Report the real
   red output and its exit code.
8. **AC8 — all six gates green.** Use the `gate-run` skill; do not run tsc,
   eslint and vitest as separate calls and do not pipe them through `tail`.

## 8. Evidence required

Commit SHA (item 21 — "clean" and "committed" are different claims), files
changed, the AC7 mutation's real red output and exit code, the `gate-run`
evidence block, and the AC6 data path stated in your own words. **You do not
certify your own completion** — a separate `checker-reviewer` grades this.

## 9. Least confident decisions (item 19d)

Attack these first.

1. **Duplicating `computeEndTimeError` into the outreach dialog rather than
   extracting a shared helper.** *What would make it wrong:* if a shared
   time-utility module already exists that both dialogs import from, then
   copying is the wrong call and I have missed the seam. I searched
   `timeStringToMinutesSinceMidnight` and found exactly two hits, both inside
   `ScheduleMeetingsDialog.tsx` — but I did not search for a differently-named
   equivalent elsewhere under `src/lib/`. If one exists, use it and say so.
2. **Blocking the whole save (§5) rather than the offending day.** *What would
   make it wrong:* if a coach realistically fills a 15-date recurring range and
   one typo strands the entire batch, per-day blocking might be kinder. I judged
   the silent-discard hazard to outrank it and cited a standing ruling — but the
   ruling is about discarding input, and a *blocked* save discards nothing, so
   the argument is against **skipping**, not strictly *for* whole-save blocking.
   A third option I did not take: block the whole save but let the coach remove
   the bad date. If the reviewer thinks that is materially better, say so now.
3. **Asserting the negative-hours consequence without measuring it.** *What
   would make it wrong:* the chain "inverted interval → `v_planned_rsvp_hours`
   → negative planned hours" is **inherited from GAM-290's premise gate, which
   measured the meetings side.** I verified the flag that makes it applicable
   here (`OUTREACH_FIXED_FLAGS:660-663`); I did **not** run the view against a
   cluster from this surface. If the view filters outreach differently, or
   clamps at zero, the *severity* argument weakens — the ordering defect itself
   is independent of it, so this changes the priority, not the fix.
4. **`isRequired` + the new `status` may conflict.** *What would make it
   wrong:* if Astryx's `TimeInput` already renders its own required-ness status
   and a supplied `status` overrides or double-renders it, AC2's DOM assertion
   could pass while the field looks wrong to a human. `ScheduleMeetingsDialog`
   ships `isRequired` and `status` on the same element (`:1439`/`:1448`), which
   is my evidence that the combination is fine — but that is precedent, not a
   rendered measurement.
5. **The equal-pair case (`<=`, not `<`).** *What would make it wrong:* if a
   zero-length outreach session is legitimately meaningful — a drop-in
   appearance logged at a single instant — then treating `09:00`/`09:00` as an
   error blocks a real workflow. I took the meetings dialog's `<=` for
   consistency. A zero-length session contributes zero hours, so it is not an
   hours-honesty hazard; the argument for `<=` is consistency, not correctness.
