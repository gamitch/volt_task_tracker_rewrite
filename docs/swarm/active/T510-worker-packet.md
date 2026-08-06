# Worker Packet: T510 — series edit for scheduled meetings (shared fields + future-forward schedule)

**Packet v2 — REVISED after `checker-premise` round 1 of 2, verdict REVISE / BLOCKER** (3 blockers, 4
majors, 10 minors, all proven against a scratch Postgres cluster with all 24 migrations plus two
compiler experiments in an isolated worktree — treated as fact, not re-derived). **Item 19a: round 1 of
2 consumed by v1. If round 2 also returns REVISE, this escalates to `boss-arbiter` rather than a third
round.** v2 folds in every finding below. Attempt count: 0 — no worker has run against any version of
this packet.

**Row:** T510 (`task-ledger.md`, filed 2026-08-05) · **Tier: HEAVY** (constitution item 26) · **Worker
model: sonnet** (default — no item 18 trigger fires; see §3) · **Branch:**
`claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**.

## 0. Gate history (item 19)

- **Round 1 of 2:** `checker-premise` reviewed v1 and returned **REVISE, severity BLOCKER**, by
  building the prescription in a scratch cluster and in an isolated worktree rather than reading it.
  Three blockers (an unauthorized-but-impossible time prefill, an impossible always-editable rule for a
  fully-past series, and a future-forward invariant enforced only by a variable's name), four majors (a
  real data-loss path on the cancel fallback — the gate's own design error, not the foreman's; a
  client-clock-only future-forward guard; an undercounted `computeConfirmLabel` call-site list; and
  unresolved ambiguities left for the worker to invent answers to), and ten minors (a wrong type
  producing a real `TS2322`, two wrong fixture-literal counts, an unused existing `createLoader` seam,
  test ranges identified by line number rather than name/content, two prose errors, a duplicate-date
  gap, and a citation-completeness nit). Full findings folded into §2/§4/§8 below with their own labels
  (B1-B3, M1-M4, m1-m10) preserved so this revision is auditable against the round-1 report.
- **A separate boss-architect ruling landed in the same window**, `auto-mode-decisions.md:3843-3938`
  ("2026-08-06 — Boss ruling (constitution item 10): T510's test updates are AUTHORIZED, with exact
  bounds"), resolving §9's open authorization gate. **§9 is rewritten to match it exactly — Grant A (six
  required properties for the replacement test) and Grant B (the true `computeConfirmLabel` call-site
  count, five in the test file) are quoted, not paraphrased.**
- **Item 19 is not yet satisfied.** This v2 is submitted for round 2.

## 1. Objective

Wire a real series-edit path for scheduled meetings, replacing the honest "no edit mode" stub, per
George's fully-settled ruling in `docs/swarm/auto-mode-decisions.md` — read directly, not relayed:
*"George's T510 rulings: meeting edit is FUTURE-FORWARD"* (2026-08-05 later), *"T508 shipped but moved
no percentage; T510's team-scope lock is WITHDRAWN"* (2026-08-05 evening), and *"George closes out
T510's design: the last three questions"* (2026-08-05). **The full, closed rule set (verbatim from the
third section):**

1. Future-forward only. A series edit never touches a session whose `starts_at` has passed.
2. Title, location, description — always editable.
3. Team scope — freely editable (T509 removed the retroactivity hazard; the 5 August lock proposal is
   withdrawn and stays withdrawn).
4. Range, weekdays and time — future sessions only.
5. Dropped future sessions — RSVPs deleted, then the session; cancel as a fallback if attendance
   exists.
6. Confirmation before saving — counts always, plus the explicit list of removed dates whenever
   anything is being removed.

"Already happened" = `starts_at` in the past, **regardless of status** (owner's stricter option,
explicit: *"'already happened' means a start time passed, even if noone ended it"*). **This "regardless
of status" wording is the owner's, and it governs exactly one boundary: the future-forward time check.
It does not extend to §4's separate, foreman-made design decision to also exclude already-`'canceled'`
sessions from reconciliation — that is this packet's own call, justified on its own merits below, not
attributed to him** (round-1 minor m9).

**Explicitly OUT of scope, already split into their own rows — do not build any of this here:**
per-session date/time/notes editing and per-session cancel-from-the-edit-flow (**T605**), per-session
location (**T606**, needs a migration). **Do not widen `CreateMeetingsPayload` in place** — this is the
owner's own words in the ledger row (T510), quoted because it is the exact mistake to avoid: an edit
path that silently creates rather than updates. §4 explains the additive design chosen to satisfy this
literally.

## 2. Premises verified directly against the live tree (cite, don't re-derive)

**`ScheduleMeetingsDialog.tsx` genuinely has no edit mode today**:
- `resetForm()` (`:558-572`) always resets to the same hardcoded literals — no branch on any "existing
  meeting" input anywhere in the file.
- `ScheduleMeetingsDialogProps` (`:524-530`) has exactly four props, no `initialData` field of any kind.
- `handleSubmit` (`:606-631`) only ever builds a `CreateMeetingsPayload` (`:610-619`) and calls
  `onCreateMeetings(payload)` — no id-bearing branch anywhere.
- `CreateMeetingsPayload` (`:305-308`) is `{ event: CreateMeetingsEventPayload; sessions:
  CreateMeetingsSessionPayload[] }` — no `id` field in the shape.

**`MeetingsList.tsx`'s stub is exactly what its own comment says.** `showEditStub`
(`:2079-2084`) sets an info `Banner` reading *"Editing an existing meeting isn't supported yet"*, wired
at both `CoachMeetingsSection` mounts via `onEdit={showEditStub}` (`:2249`, `:2260`). `StubNotice`/
`StubBanner` (`:1380-1401`) and the `stubNotice` state (`:2031`, rendered `:2214-2216`) exist **only**
for this stub — grep-confirmed, no other caller.

**`loaders/meetings.ts`'s `makeCreateMeetings` is create-only** (`:670-722`): resolves the active
season, inserts one `events` row (`counts_participation: true`, `counts_volunteer_hours: false`
hardcoded, `:689-690`), then inserts one `event_sessions` row per date (`:696-709`). No update branch.

**The outreach edit path is the closest shipped precedent, and it has a bug this task must not
copy.** `updateOutreachEvent` (`loaders/outreach.ts:1537-1563`) reconciles sessions **by
`sessionDate`**: a matching date is updated in place (`:1546-1559`); a new date is inserted
(`:1560-1562`); **an existing date absent from the payload is left completely untouched — never
deleted** (module doc #5, `:254-274`, verbatim: *"A session date REMOVED from the payload … is
deliberately left UNTOUCHED — never deleted"*). **My own inference from that mechanism, not the doc's
own words** (round-1 NIT): changing a session's date this way doesn't move it — the old date's row
survives untouched (nothing matches it anymore) while a new row is inserted for the new date, so a
single intended change produces two sessions. T510 must genuinely **drop** dates removed from the new
schedule (rule 5), which is exactly the behavior outreach's own module doc discloses as missing.

**Real schema**, `supabase/migrations/20260717000000_scheduling_attendance.sql`:
`event_sessions` (`:53-63`, `event_id … on delete cascade`, `session_date date not null`, `starts_at`/
`ends_at timestamptz not null`, `status … check (… 'scheduled','completed','canceled')`, `notes text not
null`); `rsvps` (`:67-76`, `session_id … on delete restrict`); `attendance` (`:82-95`, `session_id … on
delete restrict`); `events` (`:33-48`, `title`/`description`/`location_name`/`address text not null`,
`team_ids uuid[]` nullable = all teams).

**The FK-restrict error-code convention already exists in this codebase**, fully qualified path:
`src/pages/roster/TeamsTab.test.tsx:1185-1195` proves the shape — a fake client whose `.delete().eq(...)`
resolves `{ data: null, error: { message: 'FK violation', code: '23503' } }`, asserting the mutation
**rejects** `.toMatchObject({ code: '23503' })`. `loader.ts`'s `runMutation`/`toLoaderError`
(`:116-121`, `:203-227`) turns that into a thrown `SupabaseLoaderError`; `isSupabaseLoaderError`
(`:125-133`) is the exported type guard.

**The "already happened" boundary reuses an established shape, not an import** —
`RsvpControl.tsx:320-329` (a different page, reimplemented locally per this file's own established
practice, e.g. module doc #3 on `parseDateOnly`):
```ts
export function isSessionTimeEditable(startsAt: string, now: Date): boolean {
  return now.getTime() < new Date(startsAt).getTime();
}
export function isRsvpEditable(session: RsvpControlSession, now: Date): boolean {
  return session.status === 'scheduled' && isSessionTimeEditable(session.startsAt, now);
}
```
`RsvpControl.tsx:324-326`'s own doc comment calls the status check *"a disclosed addition beyond the
bare time check"* — cited here as the precedent SHAPE for §4's own status exclusion, which is this
packet's design decision, not an owner ruling (round-1 m9, corrected from v1).

**The precedent for a pure, separately-testable decision function** is `resolveAttendanceWriteMethod`
(`loaders/attendance.ts:287-291`): *"pure, exported, directly tested without a fake `SupabaseClient`"*.
§4's `computeMeetingSeriesReconcilePlan` is built to the same shape.

**The precedent for "one dialog serves both create and edit"** is `OutreachEventDialog.tsx`:
`initialEvent?: ExistingOutreachEvent` (`:970-972`), `isEditMode = initialEvent !== undefined`
(`:985`); `resetForm()` (`:1016-1079`) branches on it; `computeConfirmLabel(isEditMode: boolean,
sessionCount: number): string` (`:935-938`, tested at `OutreachEventDialog.test.tsx:578-582`); caller
side `OutreachList.tsx` has one `editingTarget` state, one dialog mount, `initialEvent` computed by
ternary (`:3396-3399`).

**The inverse time converter this design needs (timestamptz → `'HH:MM'` America/Chicago) already
exists twice** (round-1 B1) — `OutreachList.tsx:1660-1665` and the identical `OutreachDetail.tsx:1449`
(`export function formatChicagoWallTime`), both `Intl.DateTimeFormat` `formatToParts` reads, tested at
`OutreachDetail.test.tsx:1178-1182`. The caller pattern is `OutreachList.tsx:1727-1728`:
`startTime: formatChicagoWallTime(session.startsAt), endTime: formatChicagoWallTime(session.endsAt)`.
§4a reimplements the identical function locally in `ScheduleMeetingsDialog.tsx`, per this file's own
established "reimplement, don't cross-import pages" convention.

**`AlertDialogProps` cannot render a list** (round-1, "also required"): read directly from
`node_modules/@astryxdesign/core/dist/AlertDialog/AlertDialog.d.ts` — `description: string` (a plain
string prop, linked via `aria-describedby`), and `AlertDialogProps extends BaseProps<HTMLDialogElement>`
carries no `children` slot. The component renders `description` inside one `<Text>` (confirmed by the
gate at `AlertDialog.tsx:165-167`). **§4a's confirmation therefore builds one joined string**, not a
child list — see §4a for the exact function.

**The batched-`.in()`-delete shape already exists** — `outreach.ts:1590-1597`:
```ts
const deleteRsvpsByIds = runMutation<readonly string[], void>(
  (client, ids) => client.from('rsvps').delete().in('id', [...ids]),
  getClient,
);
```
§4b reuses this exact shape, filtering on `session_id` instead of `id` where noted.

**`createLoader` already exists and must be used for the new read** (round-1 m3):
`loader.ts:159-179`, `export function createLoader<TArgs, TData>(query, getClient)`. §4b's new session
read is wrapped in it, matching every other query in this file.

**Fixture literal counts, corrected** (round-1 m2 — v1's counts were wrong, from a grep shape that
conflated `CoachMeetingRow.locationName`/`CoachMeetingRow.teamScopeLabel` with `FixtureEvent`'s
same-named fields): exactly **3** hand-built `CoachMeetingRow` literals exist in
`MeetingsList.test.tsx` (the `pastOnlyRow` object starting `:844`, one more starting near `:928`, and
the `T511_ROW` fixture starting near `:2390`), and exactly **3** `FIXTURE_EVENTS`-shaped literals exist
in `MeetingsList.tsx` (`:766-800`: `event-weekly-build`, `event-ravens-strategy`, `event-food-drive`).
§4c's optional-field design (`teamIds?`, `description?`) exists specifically so none of these six
literals need editing.

**No existing test encodes the create-only insert behavior in a way that blocks this design** — it
must simply keep passing. The tests that must NOT be touched, identified by **name and content, not by
line range** (round-1 m7, the T604 lesson — line ranges drift the moment this task inserts anything
above them):
- `'"Schedule meetings" opens the real ScheduleMeetingsDialog (module doc #7a)'`
  (`MeetingsList.test.tsx`, currently near `:884-917`).
- `'creating a meeting via the real dialog calls the injected onCreateMeetings seam and reloads the
  list'` and its sibling in the same `describe` block (currently near `:919-1063`).
- `describe('createMeetings (T096, Trap #3 real onCreateMeetings default)', …)` (currently near
  `:2294-2371`).
- `describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', …)`
  (`ScheduleMeetingsDialog.test.tsx`, currently `:364-387`) — renders CREATE mode and asserts the
  **exact** label array with no `'Description'` entry. This is a deliberate tripwire (boss ruling,
  §9): it must go red only if the Description field leaks into create mode, and the fix then is the
  code, never the test.

## 3. Tier and model, justified

**HEAVY** (constitution item 26): a genuine write path that **deletes rows** (`rsvps`, then
`event_sessions`) and reconciles existing production data — item 26's own named trigger, independent of
topic sensitivity (item 25).

**Sonnet, not opus** (item 18): no file under `supabase/migrations/` is touched; no RLS policy or
`security definer` object; no metric-view SQL; no auth/session/role/permission logic. Per item 25,
"touches a write path" alone is not a trigger — same reasoning already used for T603 in this file
family.

## 4. Design — additive types, one pure function, two new loader-side guard queries

**Do not modify `CreateMeetingsPayload`, `CreateMeetingsEventPayload`, `CreateMeetingsSessionPayload`,
`OnCreateMeetingsFn`, or `defaultOnCreateMeetings` in any way.** They stay byte-identical, and the
CREATE path is untouched.

### 4a. New types/functions in `ScheduleMeetingsDialog.tsx` (additive)

```ts
export interface ExistingMeetingSeriesSession {
  sessionId: string;
  sessionDate: string;   // 'YYYY-MM-DD'
  startsAt: string;      // ISO timestamptz
  endsAt: string;        // ISO timestamptz
  status: 'scheduled' | 'completed' | 'canceled';
}

/**
 * Rule 1: a session is eligible for a series edit's reconciliation only
 * while it is still `'scheduled'` AND its `startsAt` is STRICTLY after
 * `now` (a strict `>`, not `>=`, on THIS function's own condition —
 * round-1 m8 corrected a prior draft's confused prose here). The
 * consequence, restated because it is the more useful way to read it: a
 * session is "already happened" (protected -- this function returns
 * `false`) when `now >= startsAt`, a NON-STRICT/inclusive boundary on the
 * protection side -- so a session whose `startsAt` exactly equals `now` is
 * already protected, matching the owner's stricter ruling that "already
 * happened" is a start time that has passed, checked inclusively.
 *
 * The status half of this check (excluding `'canceled'`/`'completed'`
 * sessions even when still future-dated) is THIS PACKET'S OWN design
 * decision, not the owner's "regardless of status" wording -- that wording
 * governs only the time boundary above. Precedent for the shape (a status
 * check layered on top of a bare time check): `RsvpControl.tsx:324-326`'s
 * own doc comment, "a disclosed addition beyond the bare time check."
 * Reimplemented locally (not imported) per this file's own established
 * cross-page practice (module doc #3).
 */
export function isMeetingSessionReconcilable(
  session: Pick<ExistingMeetingSeriesSession, 'status' | 'startsAt'>,
  now: Date,
): boolean {
  return session.status === 'scheduled' && new Date(session.startsAt).getTime() > now.getTime();
}

export interface MeetingSeriesReconcilePlan {
  toUpdate: Array<{ sessionId: string; session: CreateMeetingsSessionPayload }>;
  toInsert: CreateMeetingsSessionPayload[];
  toRemove: Array<{ sessionId: string; sessionDate: string }>;
}

/**
 * Pure, exported, directly testable without a fake `SupabaseClient` — same
 * shape `resolveAttendanceWriteMethod` (`loaders/attendance.ts:287-291`)
 * already established.
 *
 * TWO invariants are enforced BY THIS FUNCTION ITSELF, not by the caller or
 * by a variable's name (round-1 B3 — v1 relied on a parameter literally
 * named `desiredFutureSessions` to already be future-only, which nothing
 * enforced):
 *
 * 1. **A desired session whose own computed `startsAt` is not strictly
 *    after `now` is dropped before any matching happens** — regardless of
 *    what mode/range/weekday/date inputs produced it. This is the single
 *    source of truth for "future sessions only" on the write side; the UI
 *    additionally SHOULD prevent picking past dates (§4a component notes),
 *    but correctness never depends on that.
 * 2. **`toInsert` never creates a same-calendar-date duplicate of ANY
 *    existing session**, not only a reconcilable one. A desired date that
 *    coincides with an existing PAST session's date, or an existing
 *    already-`'canceled'`/`'completed'` future session's date, is silently
 *    absorbed: it is excluded from `toUpdate` (not reconcilable — protected)
 *    AND excluded from `toInsert` (a same-date row already exists), so no
 *    action is taken for that date at all. This is a disclosed, accepted
 *    simplification — no UI surfaces the collision to the coach, because no
 *    existing schedule-generation path can currently produce it (every
 *    create-mode date is picked against today's calendar, and edit mode's
 *    own custom-dates picker is the same component), and building detection
 *    UI for an unreachable case is out of scope.
 *
 * **Duplicate `session_date` among reconcilable sessions** (round-1 m10, a
 * question for whoever builds T605 next, since per-session date edits are
 * where a genuine duplicate could first appear): not possible via any
 * existing create-mode path today (`generateCustomSessionDates` dedupes;
 * `single`/`weekly` modes cannot repeat a date within one event), so this
 * function's `Map`-keyed-by-`sessionDate` matching has an untested,
 * disclosed limitation if it ever occurs — the LAST reconcilable session
 * with a given date wins the `toUpdate` match; any earlier one sharing that
 * date is silently excluded from every list (neither updated nor removed).
 * T605 must revisit this the moment per-session date edits make duplicates
 * reachable.
 */
export function computeMeetingSeriesReconcilePlan(
  existingSessions: readonly ExistingMeetingSeriesSession[],
  desiredFutureSessions: readonly CreateMeetingsSessionPayload[],
  now: Date,
): MeetingSeriesReconcilePlan {
  const desiredFuture = desiredFutureSessions.filter(
    (s) => new Date(s.startsAt).getTime() > now.getTime(),
  );

  const reconcilable = existingSessions.filter((s) => isMeetingSessionReconcilable(s, now));
  const reconcilableByDate = new Map(reconcilable.map((s) => [s.sessionDate, s] as const));
  const allExistingDates = new Set(existingSessions.map((s) => s.sessionDate));
  const desiredByDate = new Map(desiredFuture.map((s) => [s.sessionDate, s] as const));

  const toUpdate = desiredFuture
    .filter((s) => reconcilableByDate.has(s.sessionDate))
    .map((s) => ({
      sessionId: (reconcilableByDate.get(s.sessionDate) as ExistingMeetingSeriesSession).sessionId,
      session: s,
    }));
  const toInsert = desiredFuture.filter((s) => !allExistingDates.has(s.sessionDate));
  const toRemove = reconcilable
    .filter((s) => !desiredByDate.has(s.sessionDate))
    .map((s) => ({ sessionId: s.sessionId, sessionDate: s.sessionDate }));

  return { toUpdate, toInsert, toRemove };
}

export interface EditMeetingSeriesInitialData {
  eventId: string;
  title: string;
  /** `readonly` (round-1 m1 — a plain `string[]` here produces a real
   * `TS2322` at the `MeetingsList.tsx` call site, since `FixtureEvent
   * .teamIds`/`CoachMeetingRow.teamIds` are themselves `readonly string[] |
   * null`; see §4c). */
  teamIds: readonly string[] | null;
  locationName: string;
  description: string;
  /**
   * `'HH:MM'` America/Chicago wall-clock (round-1 B1), derived from the
   * EARLIEST `isMeetingSessionReconcilable` session in `sessions` below —
   * if there is none (a fully-past series, §4a "always-editable" note),
   * fall back to this file's own existing `DEFAULT_START_TIME`/
   * `DEFAULT_END_TIME` (`:314-315`), matching create mode's defaults.
   * **Disclosed behavior for heterogeneous times** (not reachable via any
   * existing UI path today, since `buildEventSessionsPayload` always
   * applies one shared time to every date it generates — but not
   * database-enforced, so state it anyway): if a save is submitted WITHOUT
   * touching these fields, every `toUpdate` row is written back with this
   * SAME single time-of-day, which is a no-op for a series that already had
   * one uniform time and a NORMALIZING write for a series that somehow did
   * not. §8 AC-B1 pins the no-op case.
   */
  startTime: string;
  endTime: string;
  /** The FULL session list (past + future + canceled) — the dialog itself
   * filters to `isMeetingSessionReconcilable` for pre-filling "Custom
   * dates"; it does not trust a caller-side pre-filter. */
  sessions: readonly ExistingMeetingSeriesSession[];
}

export interface SaveMeetingSeriesPayload {
  eventId: string;
  /** Reuses `CreateMeetingsEventPayload`'s shape. `address` is ALWAYS
   * IGNORED by the update mutation (§4b) — construct with `address: ''`,
   * matching the create path's own existing default. */
  event: CreateMeetingsEventPayload;
  /** The coach's full desired FUTURE schedule, post schedule-mode
   * computation. The loader does not trust this to already be future-only
   * (§4a's `computeMeetingSeriesReconcilePlan` re-derives it). */
  desiredFutureSessions: CreateMeetingsSessionPayload[];
}

export type OnSaveMeetingSeriesFn = (payload: SaveMeetingSeriesPayload) => Promise<void>;

export const defaultOnSaveMeetingSeries: OnSaveMeetingSeriesFn = async (payload) => {
  console.warn(
    '[ScheduleMeetingsDialog] No Supabase client wired in yet -- this stub only logs the ' +
      'events/event_sessions reconciliation that would have been applied.',
    payload,
  );
};

/** Round-1 "also required" — reimplemented locally from `OutreachList.tsx:1660-1665`/
 * `OutreachDetail.tsx:1449` (both named `formatChicagoWallTime`), per this file's own
 * cross-page-reimplementation convention. */
function formatChicagoWallTime(isoDateTime: string): string {
  const parts = CHICAGO_24H_TIME_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}
// (CHICAGO_24H_TIME_FORMATTER: same `Intl.DateTimeFormat('en-US', { hour: '2-digit', minute:
// '2-digit', hourCycle: 'h23', timeZone: CHICAGO_TIME_ZONE })` shape as both existing copies.)

/** Round-1 "also required" (AlertDialog cannot render a list — `AlertDialogProps.description:
 * string`, no `children`, `node_modules/@astryxdesign/core/dist/AlertDialog/AlertDialog.d.ts`).
 * Builds ONE joined string satisfying rule 6: counts always; the actual removed dates listed,
 * comma-joined, ONLY when `plan.toRemove.length > 0`. */
export function buildEditConfirmationDescription(plan: MeetingSeriesReconcilePlan): string {
  const base = `${plan.toInsert.length} session(s) added · ${plan.toRemove.length} session(s) removed · ${plan.toUpdate.length} session(s) kept.`;
  if (plan.toRemove.length === 0) return base;
  const removedDates = plan.toRemove
    .map((item) => WEEKDAY_DATE_FORMATTER.format(parseDateOnly(item.sessionDate)))
    .join(', ');
  return `${base} Removed: ${removedDates}.`;
}
// (WEEKDAY_DATE_FORMATTER: reimplement this file's own local copy of
// `MeetingsList.tsx:1198-1228`'s `Intl.DateTimeFormat('en-US', { weekday: 'short', month:
// 'short', day: 'numeric', timeZone: 'America/Chicago' })` + `parseDateOnly`, per this file's
// established reimplement-don't-import practice.)
```

**Deliberately NOT built** (round-1 M1's "also required" opportunity, declined explicitly rather than
silently skipped): the confirmation copy above does not distinguish "removed and deleted" from "removed
and canceled because attendance exists" — both mean "no longer appears as upcoming" to the coach, and
the distinction is accurate either way. Surfacing it would need `hasRecordedAttendance` threaded onto
`CoachMeetingSessionDetail` (a new field on an existing, widely-fixture-literal'd exported type) for a
UI nuance the owner never asked for. **Do not build this speculatively.**

**Component changes** (`ScheduleMeetingsDialog`/`ScheduleMeetingsDialogProps`):
- Add `initialData?: EditMeetingSeriesInitialData` and `onSaveMeetingSeries?: OnSaveMeetingSeriesFn =
  defaultOnSaveMeetingSeries`. `isEditMode = initialData !== undefined`.
- New local state: `description` (rendered **only when `isEditMode`** — create mode's Basics section
  stays byte-identical to today; `ScheduleMeetingsDialog.test.tsx:364-387`'s exact-label-array test is
  the tripwire, per §2/§9, and must stay green **unedited**).
- `resetForm()` branches on `initialData !== undefined`, mirroring `OutreachEventDialog.tsx:1016-1079`:
  present → `title`/`selectedTeamIds` (`initialData.teamIds !== null ? [...initialData.teamIds] :
  allTeamIds` — the `[...]` spread is required, `selectedTeamIds` state is `string[]`, `initialData
  .teamIds` is `readonly string[] | null`)/`location`/`description`/`startTime`/`endTime` from it (the
  latter two via `createISOTimeString`, same as `DEFAULT_START_TIME`/`DEFAULT_END_TIME`'s own
  construction, `:314-315`); `mode('custom')`; `customDates` seeded from
  `generateCustomSessionDates(initialData.sessions.filter(s => isMeetingSessionReconcilable(s, new
  Date())).map(s => s.sessionDate))` (reuses the ALREADY-EXPORTED, untouched `generateCustomSessionDates`);
  absent → the existing pristine-defaults branch, **byte-for-byte unchanged**.
- **`isValid`, round-1 B2 fix.** Today: `title.trim() !== '' && sessionsPayload.length > 0` (`:598`).
  **This makes "title/location/description always editable" (rule 2) impossible for a series with zero
  future sessions** — a fully-past series could never be saved at all, contradicting an owner-facing
  rule. **Fix: in edit mode, `isValid = title.trim() !== ''` — no session-count requirement.** Create
  mode's `isValid` is UNCHANGED (`title.trim() !== '' && sessionsPayload.length > 0`, still required
  there, since a brand-new series with zero sessions is meaningless). This deliberately ALSO permits
  narrowing an edited series down to zero future sessions in one save (every remaining future session
  moves to `toRemove`) — a coherent action (e.g. winding a recurring meeting down while keeping its
  title/location/history correct), not a bug to guard against. §8 has the ACs for both directions.
- Dialog title: `isEditMode ? 'Edit meeting series' : 'Schedule meetings'`.
- `computeConfirmLabel` gains a **leading required** `isEditMode: boolean` parameter — see §9 Grant B
  for the authorized, corrected call-site count (five in the test file, not four). Create-mode output
  stays pixel-identical: `computeConfirmLabel(false, 0) === 'Create 0 meetings'`, etc. Edit-mode output:
  the literal string `'Save changes'`, regardless of count (precedent: `StudentDialog.tsx:299`,
  `computeConfirmLabel('edit') === 'Save changes'` — no count suffix; simpler than Outreach's
  `"Save changes — N sessions"` since this dialog's own confirmation step already shows counts in
  detail immediately before the real save).
- A `TextArea` "Description" field (matching `OutreachEventDialog.tsx:1259-1261`'s own `label` wiring),
  rendered only when `isEditMode`.
- If `initialData.sessions` contains any session that is not `isMeetingSessionReconcilable`, render a
  short disclosure line, e.g. `${count} session(s) have already happened and are not affected by this
  edit.` — present only when that count is > 0 (§8 AC10 checks both directions).
- **Submit branches on `isEditMode`:**
  - `false` (create): **byte-identical to today.**
  - `true` (edit): build `desiredFutureSessions` via the SAME `computeScheduleSessionDates`/
    `buildEventSessionsPayload(dates, startTime, endTime, '')` used for create (`notes` fixed to `''`
    — per-session notes are T605's scope). Compute `const plan = computeMeetingSeriesReconcilePlan(
    initialData.sessions, desiredFutureSessions, new Date())`. **Do not call `onSaveMeetingSeries`
    yet.** Open an `AlertDialog` confirmation (add the import; cross-check props against
    `astryx-api.md`'s "AlertDialog" section per this file's own module doc #8 discipline) with
    `description={buildEditConfirmationDescription(plan)}` — this is what satisfies rule 6 given
    `AlertDialogProps.description` is a plain string (§2). Confirming triggers the real
    `onSaveMeetingSeries({ eventId: initialData.eventId, event: {...}, desiredFutureSessions })` call,
    then `resetForm()` + close. Declining/closing returns to the form with all field state intact.

### 4b. New loader-side code in `loaders/meetings.ts` (additive; `makeCreateMeetings`/`createMeetings`
untouched)

```ts
interface EditableMeetingSessionDbRow {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
}

/** Round-1 m3: routed through the existing `createLoader` seam, matching
 * every other read in this file — v1 hand-rolled this instead. */
async function queryEditableSessionsForEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<LoaderQueryResult<EditableMeetingSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, session_date, starts_at, ends_at, status')
    .eq('event_id', eventId);
  return { data: (result.data as EditableMeetingSessionDbRow[] | null) ?? null, error: result.error };
}

interface FutureSessionIdDbRow { id: string; }

/** Round-1 M2 — defense in depth. The future-forward guard up to this point
 * is `computeMeetingSeriesReconcilePlan`'s own `now`-based filter, which is
 * an APPLICATION-level check (the gate's own framing: "the future-forward
 * guard is the client clock"). This query re-enforces the SAME invariant at
 * the database boundary, independent of whether the pure function is ever
 * wrong: given a candidate id list, it returns only the subset that is
 * STILL, right now, strictly in the future. The result of this query — not
 * `plan.toRemove` directly — is what actually reaches the destructive
 * calls below. */
async function queryStillFutureSessionIds(
  client: SupabaseClient,
  candidateIds: readonly string[],
): Promise<LoaderQueryResult<FutureSessionIdDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id')
    .in('id', [...candidateIds])
    .gt('starts_at', new Date().toISOString());
  return { data: (result.data as FutureSessionIdDbRow[] | null) ?? null, error: result.error };
}

interface AttendanceExistsDbRow { session_id: string; }

/** Round-1 M1's fix. One batched read, given the (already `now`-and-
 * `startsAt`-guarded) candidate ids, returns which of them have at least
 * one `attendance` row. */
async function queryAttendanceExistsForSessions(
  client: SupabaseClient,
  sessionIds: readonly string[],
): Promise<LoaderQueryResult<AttendanceExistsDbRow[]>> {
  const result = await client
    .from('attendance')
    .select('session_id')
    .in('session_id', [...sessionIds]);
  return { data: (result.data as AttendanceExistsDbRow[] | null) ?? null, error: result.error };
}
```

`makeSaveMeetingSeries(getClient = getSupabaseClient): OnSaveMeetingSeriesFn` does, in order:

1. **Partial `events` update** — `title`, `team_ids`, `location_name`, `description` **only**.
   `address`, `counts_participation`, `counts_volunteer_hours`, `adult_volunteers_count`,
   `adult_volunteer_hours` are **never named** in the update's column set (unlike `outreach.ts`'s own
   full-row `updateEvent`, whose dialog collects every one of those fields and can safely resend all of
   them — this dialog collects only four).
2. Load fresh sessions via `queryEditableSessionsForEvent(eventId)` (via `createLoader`, round-1 m3) —
   fresh, not the page's stale in-memory rows (mirrors `outreach.ts`'s `loadExistingSessions`
   re-read-before-reconciling pattern, `:1543`).
3. Map to `ExistingMeetingSeriesSession[]`, call `computeMeetingSeriesReconcilePlan(existing,
   payload.desiredFutureSessions, new Date())` — a **fresh** `now`, independent of the dialog's
   confirmation-preview `now` (disclosed race: if enough wall-clock time passes between confirmation and
   the real save that a session crosses from future to past, the server-side plan may differ slightly
   from what the coach was shown — same disclosed-non-atomicity class as this file's own existing
   "events insert succeeds, sessions insert fails" risk, `:115-121`).
4. `plan.toUpdate` → `Promise.all`-parallelized per-row updates of `starts_at`/`ends_at` **only** (id
   preserved; `notes`/`session_date`/`people_reached` untouched) — matches `outreach.ts:1553-1559`'s own
   handling of per-row-DISTINCT-value updates (not batched — Postgrest cannot batch a single statement
   into per-row-different values without an RPC).
5. `plan.toInsert` → one batched insert (`status: 'scheduled'`, `notes: ''`), same shape
   `makeCreateMeetings`'s own `insertSessions`.
6. **`plan.toRemove` → the M1/M2 layered sequence, only if `plan.toRemove.length > 0`:**
   a. `safeIds = await queryStillFutureSessionIds(plan.toRemove.map(r => r.sessionId))` (M2's guard —
      drop, don't touch, any candidate id that is no longer strictly future).
   b. If `safeIds.length === 0`, stop here (nothing left to remove).
   c. `attendanceIds = new Set((await queryAttendanceExistsForSessions(safeIds)).map(r =>
      r.session_id))` (M1's pre-check, deduplicated).
   d. `toCancel = safeIds.filter(id => attendanceIds.has(id))`; `toDelete = safeIds.filter(id =>
      !attendanceIds.has(id))`.
   e. If `toCancel.length > 0`: one batched `update event_sessions set status = 'canceled' where id in
      (:toCancel)` — **RSVPs for these are NOT touched**, fixing M1's proven data loss (the gate's own
      cluster measurement: deleting RSVPs unconditionally before the delete-vs-cancel decision left
      `session_rsvps_left = 0` on the fallback path — a real, silent data-loss bug in the design, not
      the foreman's implementation, per the gate's own words).
   f. If `toDelete.length > 0`: batched `delete from rsvps where session_id in (:toDelete)`
      (`outreach.ts:1590-1597`'s shape, filtered on `session_id`), THEN batched `delete from
      event_sessions where id in (:toDelete)`. **Residual safety net** (a TOCTOU race narrower than
      M1's original bug — the window between step c's read and this delete, not the whole
      confirmation-to-save window): on a caught `SupabaseLoaderError` with `.code === '23503'`, fall
      back to canceling the WHOLE `toDelete` batch instead of re-throwing. A false cancel on a session
      that turned out fine is harmless and visible (same disclosed-limitation posture as the per-session
      Cancel button's own existing behavior); silently losing RSVPs is not, which is exactly what this
      fallback avoids repeating.

`export const saveMeetingSeries: OnSaveMeetingSeriesFn = makeSaveMeetingSeries();`

### 4c. `MeetingsList.tsx` wiring

- `CoachMeetingRow` (`:671-678`) gains **two optional** fields (optional so the 3 existing hand-built
  `CoachMeetingRow` literals need no mechanical edit — round-1 m2 corrected this count from 7):
  `teamIds?: readonly string[] | null;` (round-1 m1 — `readonly`, matching `FixtureEvent.teamIds`'s own
  type at `:597`, or `buildCoachMeetingRows`'s assignment produces `TS2322` at `:1014`) and
  `description?: string;`.
- `FixtureEvent` (`:592-603`) gains `description?: string;` (optional — the 3 existing `FIXTURE_EVENTS`
  literals, `:766-800`, round-1 m2, need no edit).
- `buildCoachMeetingRows`'s `rows.push({...})` (`:1009-1015`) gains `teamIds: event.teamIds ?? null,
  description: event.description ?? ''`.
- `loaders/meetings.ts`: `EventDbRow` (`:183-195`) gains `description: string;`; `queryEvents`'s select
  string (`:338`) gains `, description`; `mapEventDbRow` (`:275-286`) gains `description: row
  .description,`.
- Delete `StubNotice` (`:1380-1383`), `StubBanner` (`:1385-1401`), `stubNotice` state (`:2031`),
  `showEditStub` (`:2079-2084`), and its render site (`:2214-2216`) — genuinely dead code once real
  edit exists.
- New state: `editTarget: CoachMeetingRow | null` (mirrors `OutreachList.tsx`'s `editingTarget`).
  `openScheduleDialog()` (`:2069-2071`) additionally sets `editTarget(null)`. New `openEditDialog(row:
  CoachMeetingRow): void` sets `editTarget(row)` and opens the dialog.
- `onEdit={showEditStub}` → `onEdit={openEditDialog}` at both `CoachMeetingsSection` mounts (`:2249`,
  `:2260`).
- Compute `initialData` by ternary at the render call (mirrors `OutreachList.tsx:3396-3399`):
  `editTarget !== null ? { eventId: editTarget.eventId, title: editTarget.title, teamIds: editTarget
  .teamIds ?? null, locationName: editTarget.locationName, description: editTarget.description ?? '',
  startTime/endTime: derived per §4a's fallback rule, sessions: editTarget.sessions.map(s => ({
  sessionId: s.sessionId, sessionDate: s.sessionDate, startsAt: s.startsAt, endsAt: s.endsAt, status: s
  .status })) } : undefined`.
- New `handleSaveMeetingSeriesSubmit(payload: SaveMeetingSeriesPayload): Promise<void>` mirrors
  `handleCreateMeetingsSubmit`'s (`:2145-2167`) reload-and-feedback shape.
- `<ScheduleMeetingsDialog>` mount (`:2296-2301`) gains `initialData={initialData}`,
  `onSaveMeetingSeries={onSaveMeetingSeries}` (threaded, default `saveMeetingSeries`), and its
  `onOpenChange` clears `editTarget` on close (mirrors `OutreachList.tsx:3505-3508`).
- `CoachMeetingsViewProps` (`:1999-2009`) and `MeetingsListProps`/`MeetingsList` (`:2646-2686`, `:2712`)
  each gain `onSaveMeetingSeries?: OnSaveMeetingSeriesFn` threaded/defaulted the same way
  `onCreateMeetings` already is.

## 5. Allowed Files

```
src/pages/meetings/ScheduleMeetingsDialog.tsx
src/pages/meetings/ScheduleMeetingsDialog.test.tsx
src/pages/meetings/MeetingsList.tsx
src/pages/meetings/MeetingsList.test.tsx     (see §9 for the ONE authorized pre-existing-test change)
src/lib/supabase/loaders/meetings.ts
docs/swarm/active/T510-worker-output.md      (create — your evidence doc)
```

## Forbidden Files

- Everything under `supabase/migrations/`.
- `src/pages/meetings/LiveConsole.tsx`, `EndMeetingDialog.tsx`, `Kiosk.tsx`, `StudentMeetingView.tsx`
  and their test files.
- `src/pages/outreach/**` and its loaders — read-only precedent only.
- `src/lib/supabase/loaders/outreach.ts`, `endMeeting.ts`, `attendance.ts`, `students.ts`, `client.ts`,
  `loader.ts` (import from `loader.ts`; do not edit it), `src/lib/supabase/types.ts`.
- `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/constitution.md`,
  `docs/swarm/dispute-log.md`, `docs/swarm/auto-mode-decisions.md`, `.claude/agents/`,
  `.claude/skills/`, `.claude/settings.json`.
- Any other file in `src/` not listed in §5.

## 6. Rules (constitution)

Item 10 — no migration is touched. Item 20 — genuine out-of-scope defects go in your output doc as a
named follow-up. Item 21 — completion report states a commit SHA. Item 22 — stage named paths only.
Item 23 — mutation experiments run in your own worktree. Non-Negotiables — existing tests pass unless
explicitly approved (§9 names the one exception and its exact authorized bounds); no
self-certification; a checker inspects the real artifact.

## 7. Six gates — capture `$?` on the BARE command, never through a pipe

```
npm run typecheck; echo "EXIT:$?"
npm run format:check; echo "EXIT:$?"
npm run lint; echo "EXIT:$?"
npm test; echo "EXIT:$?"
```
Report file/test totals against a named baseline SHA (`git rev-parse HEAD` before your change).

## 8. Acceptance Criteria — each individually checkable by file/line, exact command, or test name

- **AC1 — additive-only guarantee, correct count (round-1 M3 / §9 Grant B).** `git diff` on
  `ScheduleMeetingsDialog.tsx` shows no changed line inside the existing `CreateMeetingsEventPayload`,
  `CreateMeetingsSessionPayload`, `CreateMeetingsPayload`, `OnCreateMeetingsFn`,
  `defaultOnCreateMeetings` declarations. `computeConfirmLabel` gains a leading required `isEditMode:
  boolean`. **Exactly five call sites in `ScheduleMeetingsDialog.test.tsx` gain `false` as a new
  leading argument** — identify by test/describe name, not line number (round-1 m7): the four
  assertions inside `describe('computeConfirmLabel (BEH-07)', …)` and the one inside the
  Weekly-recurring test's `findButtonByText(computeConfirmLabel(expected.length))` call. **Zero
  asserted strings change.**
- **AC-B1 — heterogeneous-time no-op proof (round-1 B1).** Open edit on a series whose reconcilable
  future sessions all share one time-of-day (e.g. 16:00–17:30 Chicago). Save with no schedule change.
  Assert every `toUpdate` row's `starts_at`/`ends_at` is byte-identical to its pre-save value.
- **AC-B2a — fully-past series stays editable (round-1 B2).** `initialData` with zero
  `isMeetingSessionReconcilable` sessions and a nonempty title → the confirm button is enabled
  (`isValid` true) with an empty/whatever-custom-dates schedule.
- **AC-B2b — narrowing to zero is permitted (round-1 B2).** `initialData` with reconcilable future
  sessions; save with an empty desired schedule → `isValid` stays true, `plan.toRemove` contains every
  reconcilable session, `plan.toInsert`/`toUpdate` are empty, and the save completes (does not throw
  for having "no sessions").
- **AC-B3a — a desired date matching an existing PAST session is absorbed, not inserted.** Build
  `existingSessions` with one past `'scheduled'` session on date D; `desiredFutureSessions` with an
  entry also dated D (constructed with a future `startsAt`, since the function itself filters on
  `startsAt`, not `sessionDate`, for the leading future-filter — see design note). Assert D appears in
  neither `toInsert` nor `toUpdate`.
- **AC-B3b — a desired date matching an existing CANCELED future session is absorbed, not inserted.**
  Same shape, existing session is `'canceled'` and future-dated. Assert the same absorption.
- **AC-B3c — a desired session whose own `startsAt` is not strictly future is dropped before matching.**
  A `desiredFutureSessions` entry with a past `startsAt` never appears in `toInsert`, `toUpdate`, or
  affects `toRemove`, regardless of what existing sessions are present.
- **AC2 — `isMeetingSessionReconcilable` boundary, prose corrected (round-1 m8).** A `'scheduled'`
  session with `startsAt` exactly equal to `now` → `false` (the function's own condition is strict `>`;
  the protection boundary this produces is the non-strict `>=` — do not describe the function's own
  operator as non-strict). One millisecond in the future → `true`. `'canceled'` with a future `startsAt`
  → `false`.
- **AC3/AC4/AC5 — core reconcile behavior**: a reconcilable session whose date persists → `toUpdate`;
  one whose date is dropped → `toRemove`; a desired date with no reconcilable match (and no existing
  match of any status, per AC-B3a/b) → `toInsert`.
- **AC6 — past sessions never touched.** A past-dated session whose date is absent from the desired
  schedule does not appear in `toRemove`.
- **AC7 — already-canceled sessions never touched**, presented as this packet's own design decision
  (round-1 m9) — do not cite the owner's "regardless of status" words for this specific exclusion.
- **AC8 — partial `events` update.** The `.update({...})` argument object has **exactly** the keys
  `title`, `team_ids`, `location_name`, `description` — `address`/`counts_participation`/
  `counts_volunteer_hours`/`adult_volunteers_count`/`adult_volunteer_hours` absent.
- **AC9 — the M1/M2 layered removal sequence, every branch proven with a fake client** (mirror
  `src/pages/roster/TeamsTab.test.tsx:1185-1195`'s exact shape):
  - Branch A (clean, no attendance): `queryStillFutureSessionIds` called with the candidate ids;
    `queryAttendanceExistsForSessions` returns none of them; `rsvps.delete().in('session_id', …)` is
    called BEFORE `event_sessions.delete().in('id', …)`; no `event_sessions.update` call happens.
  - Branch B (M1's fix, attendance exists): `queryAttendanceExistsForSessions` returns the id;
    `event_sessions.update({ status: 'canceled' })` is called for it; **`rsvps.delete` is NEVER called
    for this id** (M1's data-loss fix — assert the RSVPs are not targeted, not merely that the session
    survives).
  - Branch C (M2's guard): a candidate id absent from `queryStillFutureSessionIds`'s result set is
    never passed to any subsequent delete/cancel/attendance-check call.
  - Branch D (residual fallback): `event_sessions.delete().in('id', …)` for the `toDelete` batch
    rejects with `{ code: '23503' }` → `event_sessions.update({ status: 'canceled' })` is called for
    that whole batch, and the overall promise **resolves**.
  - Branch E: a non-`'23503'` error on that same delete → the promise **rejects**.
- **AC10 — the "already happened" disclosure, both directions.**
- **AC11 — confirmation, pure-addition case.** `buildEditConfirmationDescription` on a plan with
  `toRemove.length === 0` produces a string with counts and **no** "Removed:" segment.
- **AC12 — confirmation, removal case.** `toRemove.length > 0` → the string contains "Removed:"
  followed by each removed date in human-readable form (weekday + month + day).
- **AC13 — Edit opens the real dialog, prefilled** — see §9 Grant A for the full, authorized
  replacement-test spec; this AC is satisfied by that test passing.
- **AC14 — dead code removed.** `grep -rn "StubNotice\|StubBanner\|showEditStub\|stubNotice"
  src/pages/meetings/MeetingsList.tsx` returns zero matches.
- **AC15 — create path unchanged, frozen by NAME (round-1 m7), not line range:**
  `'"Schedule meetings" opens the real ScheduleMeetingsDialog (module doc #7a)'`,
  `'creating a meeting via the real dialog calls the injected onCreateMeetings seam and reloads the
  list'` (and its sibling in the same block), `describe('createMeetings (T096, Trap #3 real
  onCreateMeetings default)', …)`, and `describe('<ScheduleMeetingsDialog /> field order (MTG-02 /
  constitution item 13)', …)` all pass **without modification to their assertions**.
- **AC16 — §9's authorized test change, exactly as Grant A specifies**, no more and no less.
- **AC17-AC20 — the four gates from §7**, each `EXIT:0`, reported against a named baseline SHA.

## 9. The one pre-existing test that changes — Boss ruling, quoted, not paraphrased

**Cite `auto-mode-decisions.md:3843-3938`, "2026-08-06 — Boss ruling (constitution item 10): T510's
test updates are AUTHORIZED, with exact bounds." This is settled; no further authorization is needed,
and no other test is in this position.**

**The ruling:** *"Re-derivation of `MeetingsList.test.tsx:1082-1095` is AUTHORIZED. Deletion is NOT."*
Precedent cited by the ruling: `OutreachDetail.test.tsx:1058-1065` (stub → real edit dialog:
re-derived, old stub copy asserted absent) — not a deletion, because the Edit affordance survives with
new behavior.

**Grant A — the replacement test must (verbatim, six properties):**
1. Find the Edit control by its real accessible name — `aria-label` starting with `Edit – Weekly Build
   Meeting` (en dash).
2. Prove edit mode by prefill, not by presence — after the click, the real dialog is open with the
   edit-mode title (`Edit meeting series`) AND Title/Location prefilled from the clicked row's own
   values.
3. Keep the negative space, widened by one — `container.textContent` does NOT contain `"Editing an
   existing meeting isn't supported yet"` and does NOT contain `'not built yet'`.
4. Inherit the stub's real duty — assert `onCreateMeetings` is NOT called by the edit interaction.
5. No net loss — one `it` replaced by at least one `it`; the file's test count must not decrease
   against baseline. The provenance comment above the test (T096/T135) is re-derived to add T510 and
   cite this ruling entry — not deleted.
6. Prove it can fail — RED under a named mutation (reverting `onEdit={openEditDialog}` to a stub/no-op
   at both `CoachMeetingsSection` mounts, or removing the `initialData` ternary).

**Grant B — `computeConfirmLabel`'s true call-site count: five in the test file** (packet §4a/AC1) —
`:353`, `:354`, `:355`, `:356` (the BEH-07 describe block) and **`:480`** (inside the Weekly-recurring
test, invisible to a describe-block-shaped search). **Exactly five call sites gain `false` as a new
leading argument. Zero asserted strings change.**

**Explicitly NOT authorized:** deleting the stub test without Grant A's replacement; any edit to
`ScheduleMeetingsDialog.test.tsx:364-387` (the MTG-02 field-order tripwire — it goes red only if
Description leaks into create mode, and the fix is then the code, never the test); any edit to the
create-path tests §8 AC15 freezes; any other existing-test modification anywhere. **If a worker
believes one is forced, it stops and files a dispute citing this entry** — it does not reason its way
to "obviously also covered."

## Required Worker Output (`docs/swarm/active/T510-worker-output.md`)

- Files changed (exact list, matching §5).
- Confirmation that `CreateMeetingsPayload`'s family is byte-identical (AC1), with the diff excerpt.
- Every new/changed exported symbol's final signature.
- Every command from §7/§8 run directly, with real captured exit codes and outputs.
- The AC9 fake-client test's actual mock call sequence for all five branches (A-E).
- Baseline SHA and before/after lint warning count + vitest file/test totals against it.
- Commit SHA (item 21) and confirmation of explicit pathspecs (item 22).
- Confirmation that the Grant A replacement test satisfies all six numbered properties, and the
  mutation used for property 6.
- Any genuine out-of-scope defect found, named as a follow-up per item 20.
- Known risks: the disclosed confirmation-preview-vs-real-save race (§4b step 3); the disclosed
  duplicate-`session_date` limitation (§4a, m10) for T605's attention; the deliberately-not-built
  cancel-vs-delete confirmation-copy distinction (§4a).
