# Worker Packet: T611 — stop a series edit from silently rewriting per-session meeting times

**Packet v1.** Attempt count: 0 — no worker has run against this packet yet.

**Row:** T611 (`task-ledger.md`, filed 2026-08-06) · **Tier: HEAVY** (constitution item 26 — see §0 for
the full justification) · **Worker model: sonnet** (default — none of item 18's four opus triggers fire:
no migration, no RLS/`security definer` change, no metric-SQL view, no auth/session/role logic; item 25's
second obligation also applies — "silent data loss" sounds serious but is not on item 18's trigger list,
so this does not get bumped to opus on vibes). **Branch:** `claude/w3-meeting-workflow-0bl669`, HEAD
`b6870ab`. This machine holds **W1 + W3**.

**Ledger "Deps" column reads `T605` — this is provenance, not a blocking prerequisite, and the two must
not be conflated.** T611 was *found by* T605's foreman and *confirmed by* T605's own `checker-premise`
round 1 (see §1.1's independent corroboration) — that is what the Deps cell is recording. T605 itself is
still mid-gate (v2 packet, not yet dispatched to a worker — `docs/swarm/active/T605-worker-packet.md`
header) and its own packet explicitly **forbids** its worker from touching `ScheduleMeetingsDialog.tsx`
because that file is "already through two arbitrated gate rounds (D015/D016)" — this row is what discharges
that disclosed gap. **The owner has ordered this row ahead of T605.** This packet does not require T605 to
exist, does not touch any file T605's own packet claims, and constructs its trigger state entirely through
fixtures (§4) rather than through any UI T605 would build.

**HEAVY tier means a `checker-premise` round is required on this packet before any worker sees it.** That
gate is **not run by this document and not self-certified by the foreman that wrote it** — send this packet
to `checker-premise` next; do not dispatch to a worker on the strength of this packet alone. A separate
`checker-reviewer` round is commissioned after the worker's own diff exists — do not write that packet now
and do not treat its absence here as this task being unchecked.

---

## 0. Tier — stated and defended, not asserted

**HEAVY**, per item 26's own test: *"can a mistake here corrupt data, or lie to a user about their own
data?"* — yes on both halves. A mistake in this fix's logic changes what `desiredFutureSessions` carries
into `onSaveMeetingSeries` → `makeSaveMeetingSeries` → `updateSessionTime`
(`src/lib/supabase/loaders/meetings.ts:698-708`), a real `update event_sessions set starts_at = …, ends_at
= …` against production Postgres. The row is filed as "Defect (silent data loss, cross-row interaction)" —
the same class item 26 names T305 and T189 for: **"invisible to reading the code,"** proven only by running
a fixture that actually diverges, which is exactly what §4-§6 below require.

This is HEAVY even though, as verified in §2, **no line in `src/lib/supabase/loaders/meetings.ts` needs to
change.** Item 26's trigger is "touches a write path," not "edits the file containing the mutation call" —
the defect corrupts data that a real `UPDATE` statement will faithfully persist; the fact that the bug lives
one file upstream of that statement does not make it safer to under-process. Do not let "the loader is
unchanged" become an argument for downgrading tier — it is exactly why the loader is Forbidden (§7), not
why this task is lighter.

**Worker model: sonnet.** Confirmed against item 18's four triggers — none apply (no
`supabase/migrations/`, no RLS/`security definer`, no metric SQL view, no auth/session/role logic). Item 25
is on point: do not bump to opus because "data loss" sounds sensitive.

---

## 1. The defect, re-verified against the live tree at `b6870ab` (not relayed from the ledger)

The ledger row's five citations were written against `4ee5c02`, and T609 has since merged (12 lines
inserted at the Notes-field gate). **Re-verified directly against `b6870ab` below — all five sit above
T609's insertion point (`:1142`) and are confirmed byte-identical, not merely re-trusted.**

### 1.1 `resetForm()` derives ONE `startTime`/`endTime` from the earliest reconcilable session

`src/pages/meetings/ScheduleMeetingsDialog.tsx:811-827` (exact, current content):

```tsx
      // `startTime`/`endTime` are DERIVED here, not read off `initialData` (that
      // interface deliberately carries no `startTime`/`endTime` fields -- see its
      // own doc comment): the earliest-`startsAt` reconcilable session's own wall
      // time, or this file's existing `DEFAULT_START_TIME`/`DEFAULT_END_TIME` for
      // a fully-past series (none reconcilable).
      const earliest = reconcilableSessions
        .slice()
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      if (earliest !== undefined) {
        setStartTime(
          createISOTimeString(formatChicagoWallTime(earliest.startsAt)) ?? DEFAULT_START_TIME,
        );
        setEndTime(createISOTimeString(formatChicagoWallTime(earliest.endsAt)) ?? DEFAULT_END_TIME);
      } else {
        setStartTime(DEFAULT_START_TIME);
        setEndTime(DEFAULT_END_TIME);
      }
```

### 1.2 `handleSubmit`'s edit branch applies that ONE time to every date

`:932` (exact):

```tsx
      const desiredFutureSessions = buildEventSessionsPayload(sessionDates, startTime, endTime, '');
```

`buildEventSessionsPayload` (`:475-488`) maps a single `startTime`/`endTime` pair across every date in
`dates` — there is no per-date time input anywhere in this call.

### 1.3 `isValid` in edit mode is `title.trim() !== ''` alone

`:879-881` (exact):

```tsx
  const isValid = isEditMode
    ? title.trim() !== ''
    : title.trim() !== '' && sessionsPayload.length > 0;
```

### 1.4 `buildEditConfirmationDescription` reports counts only, never a time diff

`:716-723` (exact):

```tsx
export function buildEditConfirmationDescription(plan: MeetingSeriesReconcilePlan): string {
  const base = `${plan.toInsert.length} session(s) added · ${plan.toRemove.length} session(s) removed · ${plan.toUpdate.length} session(s) kept.`;
  if (plan.toRemove.length === 0) return base;
  const removedDates = plan.toRemove
    .map((item) => WEEKDAY_DATE_FORMATTER.format(parseDateOnly(item.sessionDate)))
    .join(', ');
  return `${base} Removed: ${removedDates}.`;
}
```

Nothing here reads `session.startsAt`/`session.endsAt` at all — a save that silently rewrites every
session's time produces the exact same string as one that changes nothing.

### 1.5 The doc comment that predicted this, for the symmetric field (`session_date`, not time)

`:598-612` (exact, unchanged, **must stay unchanged — see §7**):

```
 * **Duplicate `session_date` among reconcilable sessions** -- not possible
 * via any existing create-mode path today (`generateCustomSessionDates`
 * dedupes; `single`/`weekly` modes cannot repeat a date within one event),
 * so this is a disclosed limitation for whoever builds T605 next (per-
 * session date edits are where a genuine duplicate could first appear):
 *   - If the shared date IS still desired: `toUpdate`'s `Map`-keyed lookup
 *     (`reconcilableByDate`) silently picks ONE of the duplicates (last
 *     one inserted into the `Map` wins); the other is excluded from every
 *     list -- neither updated nor removed, silently orphaned as a stale
 *     `'scheduled'` row.
 *   - If the shared date is NOT desired: `toRemove` is built by filtering
 *     the raw `reconcilable` ARRAY (never the date-keyed `Map`), so **both**
 *     duplicates independently satisfy the filter and **both** are removed.
 *   T605 must revisit this the moment per-session date edits make
 *   duplicates reachable.
```

This is the same root cause (a series-shaped model applied to per-session data) on the opposite field
(`session_date` there, `starts_at`/`ends_at` here). **Do not fold a fix for this into your work** — it
describes a different, still-open problem that is explicitly T605's, not T611's.

**Independent corroboration, not just this ledger row:** T605's own `checker-premise` round 1 (a live-cluster
gate, `docs/swarm/active/T605-worker-packet.md` §0, finding **M3**) independently found and confirmed the
identical citations (`:811-827`, `:932`, `:879-881`) against `4ee5c02`, and ruled explicitly that
"the real fix lives entirely inside `ScheduleMeetingsDialog.tsx`'s already-arbitrated (D015/D016) territory,
which is Forbidden [to T605's worker]." This packet is that fix.

---

## 2. What does NOT need to change — verified, not assumed

### 2.1 `computeMeetingSeriesReconcilePlan` (`:614-640`) is already correct and must not change

Read in full. It matches `desiredFutureSessions` to `existingSessions` **purely by `sessionDate` string
equality** and carries whatever `session.startsAt`/`session.endsAt` each desired item already has straight
into `toUpdate` (`:628-633`):

```tsx
  const toUpdate = desiredFuture
    .filter((s) => reconcilableByDate.has(s.sessionDate))
    .map((s) => ({
      sessionId: (reconcilableByDate.get(s.sessionDate) as ExistingMeetingSeriesSession).sessionId,
      session: s,
    }));
```

It never reads or compares a *previous* time — it has no opinion on where `s.startsAt` came from. Given a
`desiredFutureSessions` array whose entries genuinely diverge, this function already reconciles them
correctly today. **The defect is entirely upstream, in how the dialog builds that array.** Do not touch this
function. Your own diff must show it byte-identical (§8).

### 2.2 `loaders/meetings.ts`'s `updateSessionTime` is already correct and must not change

`src/lib/supabase/loaders/meetings.ts:698-708` (exact, current content):

```ts
  const updateSessionTime = runMutation<
    { sessionId: string; session: CreateMeetingsSessionPayload },
    void
  >(
    (client, args) =>
      client
        .from('event_sessions')
        .update({ starts_at: args.session.startsAt, ends_at: args.session.endsAt })
        .eq('id', args.sessionId),
    getClient,
  );
```

and it is invoked per-item, not once for the whole plan (`:839`):

```ts
    await Promise.all(plan.toUpdate.map((item) => updateSessionTime(item)));
```

**This already writes each `toUpdate` item's OWN `session.startsAt`/`session.endsAt`.** It has supported
genuinely divergent per-session times since it was written — nothing here forces uniformity. The uniformity
is manufactured earlier, by `ScheduleMeetingsDialog.tsx` always handing it a `desiredFutureSessions` array
where every entry was computed from the same two shared `startTime`/`endTime` values. **`loaders/meetings.ts`
does not change, and does not need to.** This is answered explicitly because the row asked for it by name:
the fix is **entirely a dialog-side fix.** `loaders/meetings.ts` is Forbidden (§7) precisely because nothing
in it is wrong.

### 2.3 No new write sequence, so no new partial-failure question

This fix changes only the **content** of a value (`desiredFutureSessions`) computed client-side, before any
network call. It introduces no new mutation, no new ordering of existing mutations, and no new sequential
write pair. `makeSaveMeetingSeries`'s existing disclosed partial-failure risks (D015/D016, the events-then-
sessions non-atomicity) are untouched and out of this task's scope. State this explicitly in your own output
rather than silently — "no new write sequence; N/A" is a real, checkable answer, not an omission.

---

## 3. Design decision — chosen, and why the alternative was rejected

Two shapes were sketched in the ledger row. **Chosen: refuse to rewrite a session's time unless the coach
affirmatively edited the shared time fields during this edit session** (option 2). Rejected: carrying a
fully independent per-session time *through the UI* (option 1, in the sense of building per-row time
inputs) — reasons below.

### 3.1 Why not option 1 (full per-session time UI)

T605's own ledger row is titled *"Edit ONE meeting inside a series — its date, time and notes"* — building a
UI where an individual session's date/time is independently editable is **T605's named deliverable**, not
this row's. T605's own packet header confirms it is not yet dispatched. Pre-building that UI here would be
scope creep in the direction this project has already been burned by (constitution item 20's rationale).
There is also no way to test a full per-row UI today without first inventing UI T605 hasn't built yet —
directly contradicting "whatever you choose must be testable now, before T605 exists."

There is a second, structural reason option 1 is unreachable *as a UI concept* today: the dialog presents
exactly one shared `Start time`/`End time` `HStack` (`:1131-1139`) for the whole series. Without new per-row
inputs (T605's job), there is no affordance for a coach to specify two different desired times for two
different dates in one edit. "Carrying per-session times through the edit path" therefore reduces, absent
new UI, to internally remembering each session's own time and not overwriting it unless the coach uses the
one shared control that exists — which **is** option 2. Option 2 is not a lesser version of option 1; given
today's UI, it is the only version of option 1 that is buildable and testable without also building T605.

### 3.2 What `resetForm()` shows when reconcilable sessions disagree

**Unchanged**: still the earliest reconcilable session's own wall time (§1.1, `:811-827` stays exactly as it
is). Reasons, not just convenience:

- The `TimeInput`s carry `isRequired` (`:1132-1138`). Leaving them blank when sessions disagree would render
  as an unmet-required-field state for a form that has nothing wrong with it — worse UX than a single
  representative value, and inconsistent with DES-12 (an async screen's states must be honest, not merely
  present).
- Because of §3.3's disclosure, "one representative value is shown" is no longer a silent lie — the coach is
  told, in the same section, that sessions disagree and what leaving the field alone versus editing it each
  do.
- Changing what's displayed would touch `EDIT_INITIAL_DATA`-adjacent rendering that today's tests already
  exercise indirectly (the "opens prefilled..." test, §5) — keeping the displayed value's *derivation* fixed
  keeps that surface stable while the *consequence* of leaving it alone is what actually changes.

### 3.3 The confirmation/disclosure copy must say something when times differ — yes, in two places

1. **A new inline disclosure**, edit mode only, next to the Start/End time inputs, shown only while
   reconcilable sessions' times genuinely disagree with each other AND the coach has not yet touched either
   time field this session. Mirrors the existing "already happened" disclosure pattern exactly (`:1048-1052`,
   `Text type="supporting"` — no new Astryx prop lookup needed; `type="supporting"` is already sourced in
   this file's own module doc item 8). Suggested copy (sentence case, DES-14; refine wording if needed, but
   preserve both halves — what happens if the coach does nothing, and what happens if they type a new time):
   > "Sessions in this series currently have different times. Leave these fields unchanged to keep each
   > session's own time, or enter a new time to apply it to every upcoming session."
2. **`buildEditConfirmationDescription`** gains an **optional, additive** second parameter so a save that is
   actually about to overwrite times says so. See §6.3 for the exact backward-compatibility constraint (this
   must not break either of its two existing tests, §5).

### 3.4 "Touched" is an interaction event, not a value comparison — resolved explicitly, per the row's own question

Track a single boolean, e.g. `timeFieldsTouched`, set `true` the moment **either** the Start time or End
time `TimeInput`'s `onChange` fires (wrap `setStartTime`/`setEndTime` rather than calling them directly from
JSX), reset to `false` inside `resetForm()` (both branches, alongside the existing
`setSubmitError(null); setPendingEditSave(null)` reset at the bottom).

**Why interaction-based, not value-based:** if a coach opens the field and re-types the exact value already
shown, that is a deliberate act on a control the file presents as "this series' time" — treating it as a
no-op because the string happens to match would silently reintroduce a value-comparison version of the same
class of bug this row exists to fix (a control that looks like it did something but didn't). Interaction-
based tracking is also trivially testable without needing to reason about coincidental string equality.

**Why one shared flag, not two independent ones (Start vs. End):** `updateSessionTime` (§2.2) always writes
`starts_at` and `ends_at` together, for the same session, in the same call — there is no code path that
persists one without the other. The UI already presents them as one paired control (one `HStack`, both
`isRequired`, both derived together in `resetForm()`). Splitting the dirty-tracking in two would let a coach
end up with a session whose start comes from "touched" state and whose end comes from "untouched, preserved"
state — a span that matches neither the original schedule nor anything the coach saw on screen. One flag
avoids inventing that hybrid, unrepresentable state.

**Consequence for `isValid`:** in edit mode, `isValid` must become `title.trim() !== '' && (!timeFieldsTouched
|| (startTime !== undefined && endTime !== undefined))`. Untouched fields never gate validity on a value
(untouched sessions reuse their own stored time regardless of what the shared fields currently display);
touched fields must still resolve to real values before the coach can save, because §3.5's resolver depends
on them for every date that needs the new value. This is a real, currently-absent edge case (today, in edit
mode, clearing the time field cannot ever disable the button) — cover it with a new component test (§5), not
a new exported pure function; the existing file tests every other edit-mode validity state
(`AC-B2a`) the same way, through the rendered button, not through a standalone `isValid` unit.

### 3.5 Required new pure, exported, independently testable function

This file's own convention (module doc item 3; `computeMeetingSeriesReconcilePlan`'s own doc: *"Pure,
exported, directly testable without a fake `SupabaseClient`"*) is: branching logic that decides what gets
persisted lives in a pure function, not inline inside a handler. Add one, alongside `buildEventSessionsPayload`
(do not modify that function — it stays exactly as-is and is still used unmodified by create mode, `:951`,
and by this new function for any date needing a freshly-computed time):

```ts
/** T611 -- for a series edit, resolves each desired date's own starts_at/ends_at. When
 * `timeFieldsTouched` is false, a date matching an existing RECONCILABLE session's own
 * `sessionDate` reuses THAT session's own starts_at/ends_at verbatim (no re-derivation,
 * no Chicago-wall-time round trip) -- preserving whatever value it already has, including
 * a value that diverges from every other session's. A date with no such match (newly
 * added), or every date once `timeFieldsTouched` is true, uses the currently displayed
 * startTime/endTime via the same chicagoWallTimeToUtcIso conversion buildEventSessionsPayload
 * already performs. Pure, exported, independently testable without a DOM -- same convention
 * computeMeetingSeriesReconcilePlan documents for itself. */
export function buildEditDesiredFutureSessions(
  dates: readonly string[],
  startTime: string | undefined,
  endTime: string | undefined,
  timeFieldsTouched: boolean,
  originalTimesByDate: ReadonlyMap<string, { startsAt: string; endsAt: string }>,
): CreateMeetingsSessionPayload[]
```

Exact name/signature is not sacred — the worker may refine it — but the decomposition itself (a pure,
exported function separate from `handleSubmit`, taking the divergent-time fixture as plain data) **is
required**, because it is what makes §4's "test it before T605 exists" instruction possible without a DOM.

`originalTimesByDate` should be built from `initialData.sessions` filtered to `isMeetingSessionReconcilable`
(the same filter `resetForm()` already applies, `:806-808`) keyed by `sessionDate` — inherits the same
last-one-wins duplicate-date behavior §1.5 already discloses for `computeMeetingSeriesReconcilePlan`'s own
`reconcilableByDate` map; do not invent new dedup handling, that is T605's territory.

`handleSubmit`'s edit branch (`:932`) becomes a call to this new function instead of a direct call to
`buildEventSessionsPayload`. Update the comment immediately above it (currently `:927-931`, "`notes` is
fixed to `''` here…") to also state, in this file's own established comment voice, why the time resolution
changed and cite this section.

**Precondition, document it on the function:** by the time `handleSubmit` calls this, §3.4's revised
`isValid` guarantees that if `timeFieldsTouched` is true, `startTime`/`endTime` are both defined — the
function does not need its own fallback-to-default branch for that case, but should not silently produce
wrong output if it is ever called outside that guarantee (e.g., drop the date rather than fabricate a
value) — mirror `buildEventSessionsPayload`'s own "extra guard; the button is already natively disabled"
posture (`:925`).

### 3.6 `buildEditConfirmationDescription` — additive signature only

Add an optional second argument (exact shape is the worker's call — e.g. a label string to append, or a
boolean plus the two new time strings) whose **absence must reproduce today's exact output, byte for byte.**
This is a hard constraint, not a suggestion — see §5's two existing tests that call this function with a
single argument.

---

## 4. Constructing the currently-unreachable trigger state — say exactly how (per the row's own demand)

The UI cannot produce two sessions with genuinely different wall-clock times today (§1's own premise). Build
the trigger state as **fixture data**, the same way `ScheduleMeetingsDialog.test.tsx`'s existing
`RECONCILABLE_SESSION_A`/`RECONCILABLE_SESSION_B`/`PAST_SESSION` constants already construct
`ExistingMeetingSeriesSession` objects by hand and feed them into `initialData.sessions` — bypassing the
create flow entirely, exactly as those constants already do.

**Concretely:** define at least one new fixture session whose Chicago wall-clock time genuinely differs from
both `RECONCILABLE_SESSION_B` (18:00–20:00 CDT, already in the file) and `DEFAULT_START_TIME`/
`DEFAULT_END_TIME` (also 18:00–20:00) — e.g. `starts_at: '2026-08-10T21:00:00.000Z'` / `ends_at:
'2026-08-10T22:30:00.000Z'` (16:00–17:30 CDT, same DST regime as the existing fixtures so the only variable
is wall time, not UTC-offset arithmetic). Reuse `RECONCILABLE_SESSION_B` verbatim as the second, divergent
session rather than inventing a duplicate value.

This construction technique is exactly what makes this task **testable now, before T605 exists**: real
sessions with genuinely different times can be handed to the pure function (§3.5) and to `initialData`
(exercising `resetForm()` and the full submit path) via plain object literals, with no dependency on any
per-session editing UI.

---

## 5. Required tests — by name and content, never by line range

**Do not modify any existing test's fixtures or assertions.** Add new tests only. Per-test rationale below;
exact wording of `it(...)` strings is the worker's call, but each bullet's *coverage* is mandatory.

**Pure-function level** (new `describe` block, e.g. `describe('buildEditDesiredFutureSessions (T611 per-
session time preservation)', ...)`), no DOM:
- Preserves each matching date's own original `starts_at`/`ends_at` when `timeFieldsTouched` is `false`,
  even when two dates' originals genuinely diverge (feed both fixture sessions from §4 directly).
- Applies the new shared `startTime`/`endTime` to every date when `timeFieldsTouched` is `true`, overriding
  any prior divergence.
- Uses the currently displayed `startTime`/`endTime` for a date with no entry in `originalTimesByDate`
  (a newly added custom date), regardless of `timeFieldsTouched`.

**Component level**, inside or alongside the existing `describe('<ScheduleMeetingsDialog /> T510 edit
mode', ...)` block, using the §4 fixtures via `initialData`:
- **The direct regression proof for this row:** submitting with no interaction with either time field
  preserves each session's own original time in the `onSaveMeetingSeries` payload — assert via `getTime()`
  equality per session, following the existing `"AC-B1: saving with no schedule change preserves every
  toUpdate session's starts_at/ends_at as the SAME instant (heterogeneous-time no-op proof)"` test's own
  shape, but with genuinely divergent fixture times (unlike that existing test — see the note below). This
  is the test the §6 mutation must redden.
- Explicitly changing the Start time and/or End time field, then submitting, applies the new time to every
  future session, including ones whose original times previously diverged from each other.
- The §3.3 disclosure text is present when the fixture sessions' times diverge and is **not** present once
  the coach has edited a time field (or, more simply, is never present in the unmodified `EDIT_INITIAL_DATA`
  fixture, whose two reconcilable sessions share the same wall time — pick whichever framing is cleaner, but
  cover both "shown when divergent" and "not shown when not divergent / after touch").
- Clearing a touched time field (dispatch a change resulting in `undefined`, mirroring how the existing
  `"Single mode: clicking title empty re-disables the button..."` test clears the Title field) disables the
  **Save changes** button in edit mode — the new `isValid` edge case from §3.4.

**A note on the existing `"AC-B1"` test, for your own understanding — do not edit it:** its two fixture
sessions (`RECONCILABLE_SESSION_A`/`RECONCILABLE_SESSION_B`) happen to share the exact same Chicago wall
time (both 18:00–20:00 CDT, only the calendar date differs), so despite its "heterogeneous-time" name it
does not actually exercise divergent times, and will not catch this row's regression on its own — that is
exactly why §4/§5 require a *new*, genuinely divergent fixture. `AC-B1` itself is expected to keep passing
unmodified under your fix (verified: your change makes it an exact passthrough of the original ISO strings,
which is a stronger guarantee than what it tests today, not a weaker one) — do not touch it, do not rename
it, just leave it green.

---

## 6. Mutation-replay requirement

In your own worktree (constitution item 23 — never the shared tree), after your fix is committed:

1. Revert `handleSubmit`'s edit branch to call `buildEventSessionsPayload(sessionDates, startTime, endTime,
   '')` directly again (i.e., undo §3.5's call-site change only — the smallest revert that reproduces the
   original defect).
2. Re-run the new "direct regression proof" test named in §5. It must go **red** with a real assertion
   failure (a `getTime()` mismatch on the divergent session), not a hang, not a false pass, not an
   `UNTRUSTWORTHY` verdict from `mutation-replay`'s `replay.py` (per **T612**, that tool has a known false-
   negative on focused `-t` runs as of 2026-08-06 — if it reports `UNTRUSTWORTHY` here, do not trust that
   verdict either way; re-run the file directly with `vitest run <path>` and read the real output yourself,
   exactly as T609's checker did).
3. Restore the fix and re-run to confirm green again.
4. Report the real red output from step 2 verbatim in your worker output — not a description of what it
   would show.

---

## 7. Allowed Files / Forbidden Files

**Allowed:**
- `src/pages/meetings/ScheduleMeetingsDialog.tsx` — §3's changes only (the new pure function, the
  `timeFieldsTouched` state + wrapped `onChange` handlers, `resetForm()`'s reset of that flag, `isValid`'s
  new condition, `handleSubmit`'s call-site swap, the new disclosure `Text`, `buildEditConfirmationDescription`'s
  additive parameter, and the doc-comment updates named in §3.5/§9). Every other line, including `:598-612`
  (§1.5) and `:614-640` (§2.1), stays byte-identical.
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — additions only, per §5. Zero existing lines change.
- `docs/swarm/active/T611-worker-output.md` (create — your evidence doc).

**Forbidden:**
- `src/lib/supabase/loaders/meetings.ts` — verified correct and unchanged in §2.2. If your own investigation
  disagrees and you believe this file must change, **stop and file a dispute** rather than editing it —
  that would also change this task's tier classification (a genuine loader edit is unambiguously HEAVY on
  its own terms and needs its own premise-gate scrutiny of the write path itself).
- `src/pages/meetings/MeetingsList.tsx` / `MeetingsList.test.tsx` — confirmed at `b6870ab:2361-2367` to pass
  each session's `startsAt`/`endsAt` straight through from the loader with no transformation of its own; not
  part of the defect, not part of this fix.
- `src/pages/meetings/EditMeetingSessionDialog.tsx` (does not exist) — do not create it; that is T605's file.
- `supabase/migrations/**` — no migration in this task.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`.
- `package.json` / lockfiles.
- Within `ScheduleMeetingsDialog.tsx` itself: `computeMeetingSeriesReconcilePlan` (§2.1), the `:598-612`
  doc comment (§1.5), `buildEventSessionsPayload`'s own body (reused, not modified), `handleConfirmEditSave`,
  and the top-of-file module doc block — all Forbidden even though the file as a whole is Allowed.

---

## 8. Verification requirements — every exit code captured on the bare command, never through a pipe

- **`npm run typecheck; echo "EXIT:$?"` → `EXIT:0`.**
- **`npm run format:check; echo "EXIT:$?"` → `EXIT:0`.**
- **`npm run lint; echo "EXIT:$?"` → `EXIT:0` errors.** Record the baseline warning count at `b6870ab` before
  changing anything, and the count after — this task adds one exported function and some component state; if
  the warning count moves, explain the delta, don't assert it away.
- **`npm test; echo "EXIT:$?"` → `EXIT:0`.** Record file/test totals at `b6870ab` and after your change, via
  **two independent shapes**, not one — e.g. `vitest run`'s own summary line AND a count of `it(`/`test(`
  occurrences added to `ScheduleMeetingsDialog.test.tsx` via `grep -c`. This project has had counts be wrong
  four times in three days because a single search shape couldn't see the real answer (per the current
  governing guidance) — do not repeat that with this task's own test-count claim.
- **§6's mutation, replayed in your own worktree, with real before/after output.**
- **`git diff` for `ScheduleMeetingsDialog.tsx`** is confined to the regions named in §7's Allowed bullet —
  no hunk anywhere in `computeMeetingSeriesReconcilePlan`, the `:598-612` comment, or `buildEventSessionsPayload`'s
  body.
- **`git diff` for `ScheduleMeetingsDialog.test.tsx`** contains only added lines — no existing test's content
  changes (confirm this with the diff itself, not by memory).
- Identify every test you discuss **by describe/it name and content**, never by line range — T609's own merge
  already proved how fast this file's line numbers drift.

---

## 9. If any existing test would need to change — stop, do not resolve it yourself

**Investigated in this packet, not left for the worker to discover cold.** Verified via two independent
search shapes across `ScheduleMeetingsDialog.test.tsx`: (1) `grep -n 'Start time|End time'` — the only hits
are the field-order label assertions (`'Start time ∙ Required'`, `'End time ∙ Required'`), not interactive
use; (2) every `setNativeInputValue(`/`getFieldControl(` call site in the file, enumerated exhaustively — none
targets a time input, in either mode. **Conclusion: no existing test currently interacts with the Start
time/End time controls at all**, and §3.6 requires `buildEditConfirmationDescription`'s signature change to
be additive so its two existing call sites (`"AC11: no \"Removed:\" segment when toRemove.length === 0"` and
`"AC12: \"Removed:\" followed by each removed date, human-readable"`) keep passing unmodified. On this
analysis, **zero existing tests require modification.**

**If your own implementation contradicts that** — if making this fix real would require changing any
existing test's assertions or fixtures to keep it green — **you must stop and file a request for a
`boss-architect` ruling. Neither you nor the foreman may grant this yourselves.**

Quote the governing rule **verbatim, not by number**, exactly as follows — this project has an open,
unresolved ambiguity (**T610**, filed 2026-08-06) where "item 10" resolves to two different rules depending
on which part of the constitution is read (the Non-Negotiables bullet below versus the numbered
Project-Specific Standards item, *"10. Database changes are additive migrations via the Supabase CLI;
editing an applied migration file → BLOCKER"* — a completely different rule, about migrations, not tests).
The rule that actually governs here is the **Non-Negotiables** section of `docs/swarm/constitution.md`,
verbatim:

> "Existing tests must pass unless the boss explicitly approves a test update."

Cite it exactly this way — by section name and verbatim text — never as "item 10," in either direction of
the ambiguity, until T610 resolves it.

---

## 10. Relevant Constitution Excerpts

- **Non-Negotiables:** "The app must build successfully." **"Existing tests must pass unless the boss
  explicitly approves a test update."** "No worker may mark its own work complete." "Every checker must
  inspect the actual artifact, not just the worker's summary."
- **Item 18 / 25:** worker tier stays sonnet — no migration/RLS/metric-SQL/auth trigger fires; do not bump
  for "sounds sensitive" (§0).
- **Item 19 / 19a / 19c:** this packet must clear `checker-premise` (DISPATCH) before any worker sees it —
  not self-certified here. Verify your own citations before submitting anything downstream of this packet
  (19c) — everything in §1/§2 was re-read against `b6870ab` directly, not relayed.
- **Item 21:** your completion report must give the commit SHA your work landed in; existence is verified,
  not assumed.
- **Item 22:** explicit pathspecs only — never `git add -A` or `git add .`.
- **Item 23:** mutation experiments (§6) run in your own worktree, never the shared tree.
- **Item 26** (HEAVY definition quoted and applied in §0).
- **Definition of Ready item 5:** "Any reversal of previously-passed work is explicit and authorized." This
  fix reverses previously-shipped T510 behavior (`isValid`'s edit-mode condition, the single-time submit
  path). Authorization is the ledger filing itself (T611, a Defect row, plus T605's own gate independently
  confirming the same defect) — this is a correctness fix, not a preference change, and needs no further
  owner sign-off beyond the ledger record already in place.

## Most Recent Failure

None. No worker has run against this packet yet.

## Required Worker Output

- Files changed (exact list, matching §7 — should be exactly two source-adjacent files plus this output
  doc).
- The new function's full text and signature actually used (§3.5), and confirmation it is exported.
- Confirmation of §2: `computeMeetingSeriesReconcilePlan` and `loaders/meetings.ts`'s `updateSessionTime`
  are byte-identical to `b6870ab` (paste the `git diff` — or its absence — for both).
- Confirmation of §9: either "no existing test needed modification" (expected, per this packet's own
  analysis) or a filed `boss-architect` ruling request, quoting the Non-Negotiables rule verbatim — never
  self-resolved.
- Every command from §8, with real captured exit codes and relevant output, including both independent
  test-count shapes.
- §6's mutation, replayed in your own worktree, with the real red output from step 2 and the real green
  output from step 3.
- Commit SHA (item 21) and confirmation of explicit pathspecs used (item 22).
- Known risks, if any.
- Whether a dispute is needed, and if so, exactly which packet section it concerns.
