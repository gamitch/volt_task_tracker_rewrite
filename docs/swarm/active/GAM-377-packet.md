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

**Revision 2** — `checker-premise` round 1 returned **REVISE** with two BLOCKERs,
neither of them on my declared-doubt list. Both are folded in below: §3-bis is
new (the state-seeding behaviour that made my original acceptance criteria
unfalsifiable), §6 now admits one more file, and AC2/AC3/AC4/AC7 are rewritten to
name the only interaction order that actually reaches the guard. The gate's
round-1 report also **reproduced the defect on this surface** — which the issue's
own Verification note said had never been done — and **verified the negative-hours
chain at the SQL** rather than inheriting it from GAM-290. Both results are in §1.

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

**Both halves of that are now measured, not reasoned** (round-1 gate):

- **The inverted persist is reproduced on this surface.** The issue's own
  Verification note said it had not been. It has now: driving the pristine
  dialog, the confirm button read `Create event — 1 session`, was **enabled**,
  and `onSaveEvent` was called once with
  `startsAt: 2026-07-22T19:00:00.000Z` / `endsAt: 2026-07-22T15:00:00.000Z` —
  a **−4 hour** interval.
- **The negative hours are verified at the SQL, not inherited from GAM-290.**
  `supabase/migrations/20260724000001_planned_hours_future_guard.sql:69` is
  `extract(epoch from (es.ends_at - es.starts_at)) / 3600.0 as planned_hours`
  with **no clamp, no `abs()`, no `greatest(0, …)`**. Its join requires
  `e.counts_volunteer_hours` (satisfied by `OUTREACH_FIXED_FLAGS`) and
  `r.status = 'going'` (this dialog's own RSVP fan-out writes those), and its
  `where … es.starts_at >= now()` filters on `starts_at` — the **later** value
  in an inverted pair — so a future inverted session passes the filter rather
  than being screened out by it.

## 2. The near-miss — and how it differs on THIS dialog

**`min={startTime}` alone is not the fix, and neither is the comparison alone.
On this dialog they guard disjoint interaction orders.** This corrects
revision 1, which imported GAM-290's "`min` is merely secondary" framing; the
round-1 gate measured that framing false here.

| Order the coach types in | What guards it | What does NOT |
| -- | -- | -- |
| Start first, then an **earlier** End | **`min`** — the out-of-range End is rejected before it commits | the comparison never sees two defined values |
| End first, then a **later** Start | **the comparison** gating `isValid` | `min` is bound to the *current* `startTime` and is never re-consulted when Start moves |

Measured consequences the worker must not trip over:

- Deleting the `isValid` clause leaves the **first** row fully guarded. So
  "delete the clause and watch a test go red" is only falsifiable on the
  **second** row — see AC7, which now names that order explicitly.
- GAM-290's own measurement ("moving Start past an already-settled End never
  consults `min`") is **confirmed here** and is exactly the second row.

**Ship both.** Neither is decorative on this surface; each is the sole guard on
one order. `ScheduleMeetingsDialog.tsx:1440-1452` carries a comment on this —
mirror its intent, but state the disjointness as the table above does rather
than copying its "secondary" wording, which is not true here.

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

## 3-bis. The default-wipe — read this before writing a single test

**The first edit to either per-session time field wipes the other field's
default.** This is pre-existing behaviour of the dialog, it is not yours to fix,
and it is the reason revision 1's acceptance criteria were unfalsifiable.

The mechanism, verified by reading and measured by the round-1 gate:

1. `sessionDetails` starts `{}` (`:1027`).
2. `effectiveSessionDetails` therefore shows the BEH-07 defaults 09:00/12:00
   (`DEFAULT_START_TIME`/`DEFAULT_END_TIME`, `:641-642`) via `syncSessionDetails`.
3. `updateSessionDetail` (`:1203-1211`) seeds a fresh entry
   `{startTime: undefined, endTime: undefined, peopleReached: null}` **before**
   applying its patch.
4. `syncSessionDetails` (`:852-867`) is `prevDetails[date] ?? {…defaults}` — and
   the entry now **exists**, so the `??` never falls back. The untouched field's
   default is gone.

Measured on the pristine tree: edit Start alone → End renders `""`, the date
drops out of `sessionsPayload`, and the button reads
**`Create event — 0 sessions`, disabled**. Same, mirrored, for End alone.

**Three consequences that are binding on your tests:**

- A `0 sessions` disabled button is the **pre-existing** `sessionsPayload.length
  > 0` block, **not** your new guard. A test that asserts only "disabled" passes
  identically before and after your change and proves nothing.
- The **only** order that reaches the guard is **End first, then a later Start**
  (§2's second row). Setting End *after* Start is rejected by `min` and never
  commits; setting either field alone leaves the other `undefined`, and §4a's
  both-defined rule then correctly returns `undefined`.
- The round-1 gate ran AC7's mutation on the intuitive Start-then-End order and
  measured it a **survivor** — byte-identical before and after. Getting this
  order wrong does not produce a failing test; it produces a green one that
  guards nothing.

**Do not fix the default-wipe.** It is a genuine defect on the same write path —
a coach who adjusts one time silently loses that day — and it is being filed as
its own row under item 20. Fixing it here would widen this task and entangle two
independent changes.

## 4. What to change

### 4a. Port the helper

`ScheduleMeetingsDialog.tsx:534` exports `computeEndTimeError`, and
`:512` defines its private dependency `timeStringToMinutesSinceMidnight`.
**`timeStringToMinutesSinceMidnight` is module-private and is NOT exported** —
so a cross-import of `computeEndTimeError` alone would work, but **no cross-page
import of a value *function* exists in this codebase** (component and `import
type` cross-page imports do exist — `SettingsPage.tsx:448`,
`StudentHome.tsx:454` — so the narrower claim is the true one). The gate
confirmed no shared time utility exists anywhere under `src/lib/`: repo-wide
`HH:MM` parsing lives at exactly two sites, both inside
`ScheduleMeetingsDialog.tsx`. `OutreachEventDialog.tsx:802-803` states the
in-file convention outright — "reimplemented (not imported) for the same reason
as the date helpers above". **Define a local copy of both in
`OutreachEventDialog.tsx`**,
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
dropping it would accept input, show it applied, and discard it — the shape
`auto-mode-decisions.md:900-908` describes as "worse than an absent UI"
(reached via `ScheduleMeetingsDialog.tsx:1457-1465`). **Precision, per the
round-1 gate:** that passage is a *measured finding by the investigating
orchestrator*, not the owner's ruling — `auto-mode-decisions.md:893-894` says
the owner's words authorized placement only. It is persuasive precedent, not
binding authority. It is still the right call: blocking the whole save loses
nothing, because the coach sees which day is red and fixes it, and the gate
measured that attribution working (one error in the DOM, on the offending day's
field only, with the valid day untouched).

**A third option was considered and is not distinct:** "block the whole save but
let the coach remove the bad date." Custom-dates mode already lets a coach remove
a date, so that capability exists today at no cost.

## 5-bis. The shipped e2e spec this fix breaks, and exactly how to fix it

**This is the round-1 gate's BLOCKER-1, and it would have shipped silently.**

`tests/e2e-personas/outreach-lifecycle.spec.ts:191-192` drives this very dialog
and fills **an equal pair**:

```ts
await createDialog.getByLabel(/^Start time/).fill('11:59 PM');
await createDialog.getByLabel(/^End time/).fill('11:59 PM');
```

Under §4a's `<=`, that becomes an error, `isValid` goes false, and the spec's
`submit.click()` at `:213` hits a disabled button — failing the whole W2
lifecycle chain (RSVP → attend → complete → hours).

**Why it would have shipped silently: the six `gate-run` gates do not run
Playwright.** `vite.config.ts:42-58` excludes `tests/e2e-personas/**` from
vitest discovery and `ci.yml` has no e2e job. **AC8 going green is therefore not
evidence that the persona suite survives**, and you must not report it as such.

**The ruling — make exactly this change, do not improvise:**

```ts
await createDialog.getByLabel(/^Start time/).fill('11:58 PM');
await createDialog.getByLabel(/^End time/).fill('11:59 PM');
```

The spec's own comment at `:187-189` says the late start is load-bearing —
"start late in the Chicago day so `RsvpControl` (now < starts_at) and 'Mark day
complete' (date >= session_date) are both true on the same session, for as much
of the day as possible." Moving **Start** back one minute preserves that intent
at a cost of one minute; moving **End** later is impossible, since there is no
wall time after 23:59 on the same calendar day. Add a brief comment naming
GAM-377 as the reason the pair is no longer equal, so the next reader does not
"tidy" it back.

**Do not weaken `<=` to `<` to save this spec.** Both sibling dialogs use `<=`
(`ScheduleMeetingsDialog.tsx:539`, `EditMeetingSessionDialog.tsx:318`), nothing
in the repo, PRD or schema treats a zero-length session as valid, and the equal
pair here is incidental to what the spec is actually testing — its comment cares
only that the *start* is late.

## 6. Allowed Files

- `src/pages/outreach/OutreachEventDialog.tsx`
- `src/pages/outreach/OutreachEventDialog.test.tsx`
- `tests/e2e-personas/outreach-lifecycle.spec.ts` — **only** the two-line change
  ruled in §5-bis plus its explanatory comment. Nothing else in that file.

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
**The interaction order for AC2–AC4 and AC7 is prescribed, not incidental.**
Per §3-bis, set that day's **End first** (e.g. `'10:00 AM'`), then set that day's
**Start later** (e.g. `'2:00 PM'`). Any other order either never commits (`min`
rejects it) or leaves one value `undefined` (the default-wipe), and in both cases
your test goes green while guarding nothing.

2. **AC2 — the error renders on the offending day.** Render the dialog, select
   a date, drive the End-then-later-Start order above, and assert the copy
   string is in the DOM.
3. **AC3 — the save is actually blocked, by the NEW guard.** With one inverted
   session: the injected create/persist seam (the `onSaveEvent` prop — already
   used ~15× in `OutreachEventDialog.test.tsx`) is **not** called, and the
   confirm button is disabled. **Anti-criterion, and it is the point of this
   AC: the button must read `Create event — 1 session`, not `0 sessions`.** A
   `0 sessions` disabled button is the pre-existing presence check (§3-bis),
   passes identically without your change, and AC7's mutation survives it.
4. **AC4 — multi-session attribution.** With two selected dates, one valid and
   one inverted: the copy string appears exactly **once** in the DOM, the
   offending day's End control carries `aria-invalid` and an `aria-describedby`
   pointing at the copy, the **valid** day's End control carries neither, and
   the button reads `Create event — 2 sessions` and is disabled.
5. **AC5 — no false block.** An ordinary valid multi-session form still saves,
   and the payload passed to `onSaveEvent` is unchanged from before this task.
   This is the criterion that catches an over-broad guard.
6. **AC6 — the connection, not the render** (item 27). Name, in your report,
   the real path from the guarded field to `event_sessions`:
   `TimeInput` → `updateSessionDetail` → `sessionDetails` →
   `effectiveSessionDetails` → `buildOutreachSessionsPayload` →
   `startsAt`/`endsAt`. The guard must sit on that path, not beside it.
7. **AC7 — a named mutation turns a test red.** Delete the new `isValid` clause
   (4c) and confirm **AC3 fails**. **Commit your work before mutating, and run
   the mutation in your own worktree** (items 23 and 26). Report the real red
   output and its exit code. **This is only falsifiable on the End-then-Start
   order** — the round-1 gate ran it on the intuitive order and measured the
   mutation a survivor (byte-identical before and after). If your mutation does
   not turn AC3 red, the bug is in your test's interaction order, not in the
   packet.
8. **AC8 — all six gates green.** Use the `gate-run` skill; do not run tsc,
   eslint and vitest as separate calls and do not pipe them through `tail`.
   **Baseline on this branch, measured by the round-1 gate: 2505 tests across
   98 files.** Any drop is a regression to explain, not a rounding error.
   **AC8 does not cover the e2e persona suite** — Playwright is excluded from
   vitest and has no CI job (§5-bis). Do not report green gates as evidence
   that `outreach-lifecycle.spec.ts` survives; report the §5-bis edit instead.

### Harness facts you would otherwise discover the expensive way

All measured by the round-1 gate against this branch:

- The `TimeInput` DOM control is `type="text"` holding a **12-hour display
  string** — drive `'2:00 PM'`, **not** `'14:00'`. `'14:00'` does nothing.
  Precedent to copy: `ScheduleMeetingsDialog.test.tsx:1160-1191`, which already
  encodes this trap and the order-matters trap in its comments.
- **`input.value` is not a proxy for committed state.** A value rejected by
  `min` is retained as `pendingInput` and still renders
  (`TimeInput.tsx:474`), so the control can read `"10:00 AM"` while the
  committed value is `undefined`. Assert against `onSaveEvent`/the button label,
  never against `.value`.
- `isRequired` and `status` on the same `TimeInput` do not conflict: `status`
  drives border/icon/`aria-describedby`, `isRequired` drives `aria-required` and
  the label suffix. Independent, measured on a rendered field.

## 8. Evidence required

Commit SHA (item 21 — "clean" and "committed" are different claims), files
changed, the AC7 mutation's real red output and exit code, the `gate-run`
evidence block, and the AC6 data path stated in your own words. **You do not
certify your own completion** — a separate `checker-reviewer` grades this.


## 9. Least confident decisions (item 19d) — revision 2

Revision 1's five entries all came back **SOUND** from the round-1 gate, and are
retired: no shared time helper exists (verified across `src/lib/`); the
whole-save ruling holds and was measured working; the negative-hours chain is now
verified at the SQL; `isRequired` + `status` was rendered-measured, not merely
precedent; and `<=` is right on the merits. Both actual BLOCKERs were things I
had **not** declared — which is the honest result to record, not one to bury.

These are the doubts that remain after the revision. They are new; this is not a
re-list.

1. **Editing the shipped persona spec's times (§5-bis) rather than deferring
   it.** *What would make it wrong:* if `11:58 PM` breaks a timing assumption I
   have not found — the spec deliberately maximises the window where
   `now < starts_at`, and I am narrowing it by a minute on the reasoning that a
   minute is immaterial. If that suite is ever run near midnight Chicago, or if
   something downstream keys on the start and end being the same instant, the
   edit trades a loud failure for a flaky one. I could not run Playwright to
   check: it is excluded from the gates and has no CI job, which is the same
   blind spot that let BLOCKER-1 exist.
2. **Ruling `<=` over `<` when the only shipped in-repo usage of this dialog's
   time fields is an equal pair.** *What would make it wrong:* the spec author
   typed `11:59 PM` twice, which is weak evidence that an equal pair reads as
   natural to someone using this form. If a coach legitimately logs a drop-in
   appearance as a single instant, `<=` blocks a real workflow and `<` would
   have cost nothing (a zero-length session contributes zero hours, so it is not
   an hours-honesty hazard). I chose sibling-consistency over that evidence.
3. **Declaring the default-wipe out of scope (§3-bis) while relying on it to
   write the tests.** *What would make it wrong:* the two are more entangled
   than I am admitting — the guard's only reachable path exists *because* of the
   wipe, so whoever fixes the wipe will change which orders reach the guard and
   may invalidate AC2–AC4 and AC7's mutation. That is a landmine for the next
   row rather than a defect in this one, but if the reviewer thinks the two must
   ship together, now is the time to say so, not after both are merged.
4. **Prescribing the interaction order rather than fixing the seam that makes it
   necessary.** *What would make it wrong:* a test that only passes when driven
   in one counter-intuitive order is a test the next maintainer will "simplify"
   into uselessness. I have mitigated with §3-bis and AC3's `1 session`
   anti-criterion, but a comment is a weaker guarantee than a design that cannot
   be got wrong.
5. **Assuming `min={detail?.startTime}` is safe when the per-session Start can
   be `undefined`.** *What would make it wrong:* `min` is typed
   `ISOTimeString | —`, and §3-bis says the first edit leaves one field
   `undefined`. Passing `undefined` should mean "no minimum", and the meetings
   dialog does the same thing at `:1447` — but the meetings dialog's `startTime`
   has a different lifecycle, and I have not measured this dialog's
   `undefined`-Start case against a rendered `min`.
