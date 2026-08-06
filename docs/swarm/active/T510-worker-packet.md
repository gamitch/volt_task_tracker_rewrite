# Worker Packet: T510 — series edit for scheduled meetings (shared fields + future-forward schedule)

**Row:** T510 (`task-ledger.md`, filed 2026-08-05, split from the original "Edit is a stub" report) ·
**Tier: HEAVY** (constitution item 26) · **Worker model: sonnet** (default — no item 18 trigger fires;
see §0) · **Branch:** `claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**.

## 0. GATE STATUS — NOT YET CLEARED. Do not dispatch to a worker yet.

**Item 19 (`checker-premise`) has not run against this packet.** This packet is being submitted for
its **first** gate round now. Per the hard lesson recorded against T603 v1 — *"Self-certification by
the agent that wrote the packet is not a premise gate, and accepting it would have repeated the
original error one level up"* — nothing in this document should be read as already-verified just
because it cites file:line. Every citation below was read directly from the live tree (commands and
line numbers given), but the **design's implementability, the pure function's correctness, and the
delete/cancel-fallback mechanism must be independently built and mutation-tested by the gate**, not
taken on this packet's word. Attempt count: 0. No worker has run against any version of this packet.

**One item the gate must resolve before DISPATCH, not after (§9 has the full detail):**
`MeetingsList.test.tsx:1082-1095` asserts the OLD stub behavior this task deliberately removes.
Editing it requires the boss to explicitly approve a test update (constitution Non-Negotiables); no
such approval is recorded anywhere in `docs/swarm/auto-mode-decisions.md` as of this writing (searched:
no hit). This packet does **not** authorize touching that test. Per this project's own established
practice for exactly this situation (`auto-mode-decisions.md`, *"2026-07-29 — T149, authorizing the
`:1194-1196` test amendment (orchestrator, not George)"*), the orchestrator — not the foreman, not a
worker, not a checker — must add a dated entry to that file recording the authorization before a
worker touches that test. If the worker reaches that point with no such entry to cite, it must **stop
and dispute**, not edit the test on its own reasoning that "obviously it's now wrong."

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
explicit: *"'already happened' means a start time passed, even if noone ended it"*).

**Explicitly OUT of scope, already split into their own rows — do not build any of this here:**
per-session date/time/notes editing and per-session cancel-from-the-edit-flow (**T605**), per-session
location (**T606**, needs a migration). **Do not widen `CreateMeetingsPayload` in place** — this is the
owner's own words in the ledger row (T510), quoted because it is the exact mistake to avoid: an edit
path that silently creates rather than updates. §4 below explains the additive design chosen to satisfy
this literally.

## 2. Premises verified directly against the live tree (cite, don't re-derive)

**`ScheduleMeetingsDialog.tsx` genuinely has no edit mode today** — confirmed by reading the file, not
inferred from `MeetingsList.tsx`'s module doc about it:
- `resetForm()` (`ScheduleMeetingsDialog.tsx:558-572`) always resets to the same hardcoded literals
  (`DEFAULT_TITLE`, `allTeamIds`, `''`, `'single'`, `undefined`, `[]`, `DEFAULT_START_TIME`, …) — there
  is no branch on any "existing meeting" input anywhere in the file.
- `ScheduleMeetingsDialogProps` (`:524-530`) has exactly four props (`isOpen`, `onOpenChange`, `teams`,
  `onCreateMeetings`) — no `initialData`/`initialEvent`/"meeting to edit" field of any kind.
- `handleSubmit` (`:606-631`) only ever builds a `CreateMeetingsPayload` (`:610-619`) and calls
  `onCreateMeetings(payload)` — there is no id-bearing branch, no update path, nothing that could ever
  target an existing row.
- `CreateMeetingsPayload` (`:305-308`) is `{ event: CreateMeetingsEventPayload; sessions:
  CreateMeetingsSessionPayload[] }` — no `id` field anywhere in the shape.

**`MeetingsList.tsx`'s stub is exactly what its own comment says.** `showEditStub`
(`MeetingsList.tsx:2079-2084`) sets an info `Banner` reading *"Editing an existing meeting isn't
supported yet"*; it is wired at both `CoachMeetingsSection` mounts via `onEdit={showEditStub}`
(`:2249`, `:2260`). The row's own `Button` chip is `CoachMeetingRowActions` (`:1506-1524`,
`label={`Edit – ${row.title}`}`). **`StubNotice`/`StubBanner`** (`:1380-1401`) and the `stubNotice`
state (`:2031`, rendered `:2214-2216`) exist **only** for this stub — grep-confirmed, no other caller.

**`loaders/meetings.ts`'s `makeCreateMeetings`/`CreateMeetingsPayload` consumer is create-only** —
`makeCreateMeetings` (`loaders/meetings.ts:670-722`) resolves the active season, inserts one `events`
row (`type: 'meeting'`, `counts_participation: true`, `counts_volunteer_hours: false` — hardcoded,
`:689-690`), then inserts one `event_sessions` row per date (`status: 'scheduled'`, `:696-709`). There
is no update branch, no id-aware code path, nothing this task can reuse in place — matching
`MeetingsList.tsx`'s own citation of it (module doc #7b, `:216-226`).

**The outreach edit path is the closest shipped precedent, and it has a bug this task must not
copy.** `makeSaveOutreachEvent`'s `updateOutreachEvent` (`loaders/outreach.ts:1537-1563`) reconciles
sessions **by `sessionDate`**: an existing row whose date matches a payload date is updated in place
(`:1546-1559`); a payload date with no existing match is inserted (`:1560-1562`); **an existing date
absent from the payload is left completely untouched — never deleted** (module doc #5, `:254-274`,
verbatim: *"A session date REMOVED from the payload … is deliberately left UNTOUCHED — never
deleted"*). **The consequence, stated plainly by that same module doc and not to be repeated here:**
changing a session's date doesn't move it, it leaves the old date's row behind (nothing matches it
anymore, so it survives) **and** inserts a new row for the new date — two sessions where the coach
intended one. T510 must genuinely **drop** dates removed from the new schedule (rule 5 above), which is
exactly the behavior outreach's own module doc discloses as missing. `computeExpectedAttendeeRsvpPlan`
(`outreach.ts:1418-1437`) is unrelated (RSVP-checklist reconciliation, not session reconciliation) —
noted only so it isn't confused with the function this task builds.

**Real schema, read from the migration, not assumed:**
`supabase/migrations/20260717000000_scheduling_attendance.sql`:
- `event_sessions` (`:53-63`): `event_id … on delete cascade` (the one exception in the batch),
  `session_date date not null`, `starts_at timestamptz not null`, `ends_at timestamptz not null`,
  `status text … check (status in ('scheduled','completed','canceled'))`, `notes text not null`.
- `rsvps` (`:67-76`): `session_id uuid not null references public.event_sessions (id) on delete
  restrict`.
- `attendance` (`:82-95`): `session_id uuid not null references public.event_sessions (id) on delete
  restrict`.
- `events` (`:33-48`): `title text not null`, `description text not null`, `location_name text not
  null`, `address text not null`, `team_ids uuid[]` (nullable; `null` = all teams).

So **deleting a session that still has RSVPs throws** unless the RSVPs are deleted first (rule 5), and
**deleting a session that has attendance rows always throws** — there is no client-side way around the
restrict FK, and the design's own answer is "cancel instead" (rule 5's second half).

**The FK-restrict-then-fallback mechanism already has a precedent in this codebase, at the error-code
level.** `TeamsTab.test.tsx:1185-1195` proves the exact shape: a fake client whose `.delete().eq(...)`
resolves `{ data: null, error: { message: 'FK violation', code: '23503' } }`, asserting the mutation
**rejects** `.toMatchObject({ code: '23503' })`. `loader.ts`'s `runMutation`/`toLoaderError`
(`loader.ts:116-121`, `:203-227`) is what turns that Postgrest error into a thrown
`SupabaseLoaderError` with `.code` set from the raw error — `isSupabaseLoaderError` (`loader.ts:125-
133`) is the exported type guard to branch on it. §5 below uses this exact mechanism; §8's AC12/AC13
require you to prove both branches the same way `TeamsTab.test.tsx` does, not merely by reading the
code.

**The "already happened" boundary already has a codebase idiom to reuse the SHAPE of, not the
import.** `RsvpControl.tsx:320-329` (a different page — reimplement locally, do not cross-import,
matching this file's own established practice of reimplementing rather than importing across pages,
e.g. `ScheduleMeetingsDialog.tsx`'s own module doc #3 on `parseDateOnly`):
```ts
export function isSessionTimeEditable(startsAt: string, now: Date): boolean {
  return now.getTime() < new Date(startsAt).getTime();
}
export function isRsvpEditable(session: RsvpControlSession, now: Date): boolean {
  return session.status === 'scheduled' && isSessionTimeEditable(session.startsAt, now);
}
```
§4 below asks for the same two-part shape (a time check AND a status check), injectable `now: Date` for
testability — this repo already has that convention in three places (`RsvpControl.tsx`,
`ParentRsvp.tsx`, `InvitesTab.tsx:465`/`:487`'s `now: Date = new Date()` default-parameter pattern).

**The precedent for a pure, separately-testable decision function living beside its DB-driving wrapper**
is `resolveAttendanceWriteMethod` (`loaders/attendance.ts:287-291`): *"pure, exported, directly tested
without a fake `SupabaseClient`"*. §4's `computeMeetingSeriesReconcilePlan` must be built to the same
shape — no `SupabaseClient` parameter, no I/O, callable from a component test AND a loader test alike.

**The precedent for "one dialog serves both create and edit via an optional `initialEvent`/`isEditMode`
branch"** is `OutreachEventDialog.tsx`, read directly:
- `OutreachEventDialogProps.initialEvent?: ExistingOutreachEvent` (`:970-972`), `isEditMode =
  initialEvent !== undefined` (`:985`).
- `resetForm()` (`:1016-1079`) branches on `initialEvent !== undefined`: present → prefill every field
  from it, set `mode('custom')`, and seed `customDates` from `generateCustomSessionDates(initialEvent
  .sessions.map(s => s.sessionDate))` (`:1029-1037`); absent → the old pristine-defaults branch,
  byte-for-byte what it always did (`:1056-1077`).
- `computeConfirmLabel(isEditMode: boolean, sessionCount: number): string` (`:935-938`) — the SAME
  exported function now takes an extra leading boolean, tested at
  `OutreachEventDialog.test.tsx:578-582` (`false` → "Create event — N sessions", `true` → "Save changes
  — N sessions").
- The caller side (`OutreachList.tsx`): ONE `editingTarget` state (`null` = create), ONE
  `<OutreachEventDialog>` mount, `initialEvent` computed by ternary at the render call
  (`OutreachList.tsx:3396-3399`), `onOpenChange` clears `editingTarget` on close (implied by that same
  pattern; `OutreachDetail.tsx`'s own analogous mount always supplies `initialEvent` since that page
  only ever edits).

**No existing test encodes the create-only insert behavior in a way that blocks this design** — it
encodes it in a way you must **not accidentally change**: `MeetingsList.test.tsx:2294-2371`
(`describe('createMeetings …')`) and `ScheduleMeetingsDialog.test.tsx:351-586` construct/assert against
`CreateMeetingsPayload`/`onCreateMeetings` directly and must keep passing **unmodified** (§4's additive
design exists specifically so these do not need to change). The **one** test that must change is
`MeetingsList.test.tsx:1082-1095` (§0, §9).

## 3. Tier and model, justified

**HEAVY** (constitution item 26): this task adds a genuine write path that **deletes rows**
(`rsvps`, then `event_sessions`) and reconciles existing production data — squarely "a write path or
destructive operation," the item's own named trigger, independent of topic sensitivity (item 25).

**Sonnet, not opus** (item 18): none of the four triggers fire. No file under `supabase/migrations/`
is touched (§6 Forbidden Files) — this task needs no schema change, everything it writes to already
has the columns it needs. No RLS policy or `security definer` object is touched. No metric-view SQL is
touched (`v_student_participation` etc. are untouched; T509 already landed the metric change this task
depends on). No auth/session/role/permission logic changes. Per item 25, "touches a write path" alone
is not itself a trigger — T603 established this exact reasoning for the same file family.

## 4. Design — additive types, one pure function, one new loader function

**Do not modify `CreateMeetingsPayload`, `CreateMeetingsEventPayload`, `CreateMeetingsSessionPayload`,
`OnCreateMeetingsFn`, or `defaultOnCreateMeetings` in any way.** They stay byte-identical, and the
CREATE path (`onCreateMeetings`, unchanged prop, unchanged behavior) is untouched. This is the literal
way to satisfy "do not widen `CreateMeetingsPayload` in place": the edit path is **new, additive, and
separate**, not a shallow field bolted onto the create shape.

### 4a. New types/functions in `ScheduleMeetingsDialog.tsx` (additive)

```ts
export interface ExistingMeetingSeriesSession {
  sessionId: string;
  sessionDate: string;   // 'YYYY-MM-DD'
  startsAt: string;      // ISO timestamptz
  endsAt: string;        // ISO timestamptz
  status: 'scheduled' | 'completed' | 'canceled';
}

/** Rule 1/3: a session is eligible for a series edit's reconciliation only
 * while it is still `'scheduled'` AND its `startsAt` has not yet passed.
 * "Already happened" = `starts_at` in the past, REGARDLESS of status (owner
 * ruling, `auto-mode-decisions.md`, "George closes out T510's design", check
 * 03) -- a `>=` boundary (not `>`) so a session starting AT `now` is already
 * protected, never silently dropped. Same two-part shape (time check AND
 * status check) as `RsvpControl.tsx`'s `isSessionTimeEditable`/`isRsvpEditable`
 * (`:320-329`), reimplemented locally per this file's own established
 * practice (module doc #3) rather than imported across pages. */
export function isMeetingSessionReconcilable(
  session: Pick<ExistingMeetingSeriesSession, 'status' | 'startsAt'>,
  now: Date,
): boolean {
  return session.status === 'scheduled' && new Date(session.startsAt).getTime() > now.getTime();
}

export interface MeetingSeriesReconcilePlan {
  /** Existing reconcilable sessions whose date persists in the desired
   * schedule -- id preserved, times updated in place. */
  toUpdate: Array<{ sessionId: string; session: CreateMeetingsSessionPayload }>;
  /** Desired dates with no reconcilable existing match -- brand-new sessions. */
  toInsert: CreateMeetingsSessionPayload[];
  /** Existing reconcilable sessions whose date is absent from the desired
   * schedule -- dropped (rule 5; the actual delete-vs-cancel-fallback
   * mechanism lives in the loader, not here -- this function only decides
   * WHICH sessions are being dropped, from real data, not the reverse). */
  toRemove: Array<{ sessionId: string; sessionDate: string }>;
}

/** Pure, exported, directly testable without a fake `SupabaseClient' -- same
 * shape `resolveAttendanceWriteMethod` (`loaders/attendance.ts:287-291`)
 * already established for this codebase. Sessions that are NOT
 * `isMeetingSessionReconcilable` (already happened, OR already
 * canceled/completed) never appear in any of the three lists -- they are
 * silently excluded, never touched, regardless of whether their date matches
 * the desired schedule (this is what makes the edit future-forward AND
 * non-destructive to a coach's own prior per-session Cancel). */
export function computeMeetingSeriesReconcilePlan(
  existingSessions: readonly ExistingMeetingSeriesSession[],
  desiredFutureSessions: readonly CreateMeetingsSessionPayload[],
  now: Date,
): MeetingSeriesReconcilePlan {
  const reconcilable = existingSessions.filter((s) => isMeetingSessionReconcilable(s, now));
  const reconcilableByDate = new Map(reconcilable.map((s) => [s.sessionDate, s] as const));
  const desiredByDate = new Map(desiredFutureSessions.map((s) => [s.sessionDate, s] as const));

  const toUpdate = desiredFutureSessions
    .filter((s) => reconcilableByDate.has(s.sessionDate))
    .map((s) => ({
      sessionId: (reconcilableByDate.get(s.sessionDate) as ExistingMeetingSeriesSession).sessionId,
      session: s,
    }));
  const toInsert = desiredFutureSessions.filter((s) => !reconcilableByDate.has(s.sessionDate));
  const toRemove = reconcilable
    .filter((s) => !desiredByDate.has(s.sessionDate))
    .map((s) => ({ sessionId: s.sessionId, sessionDate: s.sessionDate }));

  return { toUpdate, toInsert, toRemove };
}

export interface EditMeetingSeriesInitialData {
  eventId: string;
  title: string;
  /** `null` = all teams, matches `CreateMeetingsEventPayload.teamIds`. */
  teamIds: string[] | null;
  locationName: string;
  description: string;
  /** The FULL session list (past + future + canceled) -- the dialog itself
   * filters to `isMeetingSessionReconcilable` for pre-filling "Custom
   * dates" and for disclosing an "N sessions already happened" note; it
   * does not trust a caller-side pre-filter. */
  sessions: readonly ExistingMeetingSeriesSession[];
}

export interface SaveMeetingSeriesPayload {
  eventId: string;
  /** Reuses `CreateMeetingsEventPayload`'s shape for symmetry. `address` is
   * ALWAYS IGNORED by the update mutation (§4b) -- the existing row's
   * `address` is preserved via a partial-column update, since this dialog
   * collects no address field in either mode (module doc #1's existing
   * "not an MTG-02 field" reasoning, unchanged). Construct it with
   * `address: ''`, matching the create path's own existing default. */
  event: CreateMeetingsEventPayload;
  /** The coach's full desired FUTURE schedule, post schedule-mode
   * computation (reuse `computeScheduleSessionDates`/`buildEventSessionsPayload`
   * exactly as create mode does) -- NOT a diff, the reconciliation function
   * computes the diff against fresh server data (§4b). */
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
```

**Component changes** (`ScheduleMeetingsDialog`/`ScheduleMeetingsDialogProps`):
- Add `initialData?: EditMeetingSeriesInitialData` and `onSaveMeetingSeries?: OnSaveMeetingSeriesFn =
  defaultOnSaveMeetingSeries`. `isEditMode = initialData !== undefined`.
- New local state: `description` (string; **rendered only when `isEditMode` is true** — create mode's
  Basics section stays byte-identical to today, zero MTG-02 deviation for creation; the "always
  editable" ruling is about editing, and George's own wording never mentions creation).
- `resetForm()` branches on `initialData !== undefined`, mirroring `OutreachEventDialog.tsx:1016-1079`
  exactly: present → `title`/`selectedTeamIds` (`initialData.teamIds ?? allTeamIds`)/`location`/
  `description` from it; `mode('custom')`; `customDates` seeded from
  `generateCustomSessionDates(initialData.sessions.filter(s => isMeetingSessionReconcilable(s, new
  Date())).map(s => s.sessionDate))` (reuses the ALREADY-EXPORTED `generateCustomSessionDates`,
  untouched); absent → the existing pristine-defaults branch, **byte-for-byte unchanged**.
- Dialog title: `isEditMode ? 'Edit meeting series' : 'Schedule meetings'` (mirrors
  `OutreachEventDialog.tsx:1231`'s exact pattern).
- `computeConfirmLabel` gains a leading `isEditMode: boolean` parameter, mirroring
  `OutreachEventDialog.tsx:935-938` exactly. **Create-mode output must stay pixel-identical to today**:
  `computeConfirmLabel(false, 0) === 'Create 0 meetings'`, `(false, 1) === 'Create 1 meeting'`, `(false,
  14) === 'Create 14 meetings'` (the four existing assertions at
  `ScheduleMeetingsDialog.test.tsx:353-356`, updated to pass `false` as the first argument — this is an
  update to an EXISTING test file, but it is a mechanical signature-shape fix forced by an additive
  parameter, not a behavioral test-update requiring boss approval; the asserted STRINGS for create mode
  do not change). **Edit-mode output: the literal string `'Save changes'`, regardless of count** —
  simpler than Outreach's `"Save changes — N sessions"` deliberately: this dialog's own confirmation
  step (below) already shows the counts in detail immediately before the real save, so a redundant
  count on the button itself is not needed. (Precedent for a bare, count-free "Save changes" edit label:
  `StudentDialog.tsx:299`, `computeConfirmLabel('edit') === 'Save changes'`.)
- A `TextArea` "Description" field (matching `OutreachEventDialog.tsx:1259-1261`'s own `label`
  wiring) added to the Basics section, rendered **only when `isEditMode`**.
- If `initialData.sessions` contains any session that is NOT `isMeetingSessionReconcilable` (i.e. it
  has already happened, or is not `'scheduled'`), render a short disclosure line in the Schedule
  section, e.g. `${count} session(s) have already happened and are not affected by this edit.` — no
  exact copy is mandated, but it must be present whenever that count is > 0 and absent otherwise (§8
  AC10 checks this both ways).
- **Submit branches on `isEditMode`:**
  - `false` (create): **byte-identical to today** — build `CreateMeetingsPayload`, call
    `onCreateMeetings`. No confirmation step (unchanged from today; rule 6 is about editing).
  - `true` (edit): build `desiredFutureSessions` via the SAME `computeScheduleSessionDates`/
    `buildEventSessionsPayload(dates, startTime, endTime, '')` used for create — **`notes` fixed to
    `''`** for every regenerated/new session (per-session notes editing is T605's scope, not this
    task's; an existing matched session's own `notes` is never touched by the update, see §4b).
    Compute `const plan = computeMeetingSeriesReconcilePlan(initialData.sessions,
    desiredFutureSessions, new Date())`. **Do not call `onSaveMeetingSeries` yet.** Open a confirmation
    (`AlertDialog` — already used elsewhere in this same directory, e.g. `MeetingsList.tsx`; add the
    import to this file and cross-check props against `astryx-api.md`'s "AlertDialog" section, same
    discipline every prop in this file's own module doc #8 already follows) showing, **always**:
    `${plan.toInsert.length} session(s) added · ${plan.toRemove.length} session(s) removed · ${plan
    .toUpdate.length} session(s) kept`. **When and only when `plan.toRemove.length > 0`**, additionally
    render the actual list of removed dates (human-readable, e.g. reusing the same
    weekday+month+day+America/Chicago `Intl.DateTimeFormat` shape `MeetingsList.tsx`'s
    `WEEKDAY_DATE_FORMATTER`/`formatWeekdayDate` already establish, `:1198-1228` — reimplement locally
    in this file per its own established practice, do not import). Confirming triggers the real
    `onSaveMeetingSeries({ eventId: initialData.eventId, event: {...}, desiredFutureSessions })` call,
    then `resetForm()` + close, matching the create path's existing success handling shape
    (`:620-623`). Declining/closing the confirmation returns to the form with all field state intact
    (not reset).

### 4b. New loader function in `loaders/meetings.ts` (additive; `makeCreateMeetings`/`createMeetings`
untouched)

```ts
interface EditableMeetingSessionDbRow {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
}

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
```

`makeSaveMeetingSeries(getClient = getSupabaseClient): OnSaveMeetingSeriesFn` does, in order:

1. **Partial `events` update** — `title`, `team_ids`, `location_name`, `description` **only**.
   `address`, `counts_participation`, `counts_volunteer_hours`, `adult_volunteers_count`,
   `adult_volunteer_hours` are **never named in the update's column set** (a partial `.update({...})`,
   not a full-row replace like `outreach.ts`'s `toEventInsertPayload`/`updateEvent` — that file's dialog
   collects every one of those fields and can safely resend all of them; this one collects only four,
   so resending the others (which it never even receives real values for) would clobber them).
2. Load fresh sessions via `queryEditableSessionsForEvent(eventId)` — **fresh, not the page's stale
   in-memory rows** (mirrors `outreach.ts`'s own `loadExistingSessions` re-read-before-reconciling
   pattern, `:1543`).
3. Map to `ExistingMeetingSeriesSession[]` and call `computeMeetingSeriesReconcilePlan(existing,
   payload.desiredFutureSessions, new Date())` — **a fresh `now`**, independent of whatever the dialog
   computed for its confirmation preview (disclosed race, same class as this file's own existing
   "events insert succeeds, sessions insert fails" disclosed risk, `:115-121`): if enough time passes
   between confirmation and the real save that a session crosses from future to past, the server-side
   plan may differ slightly from what the coach was shown. Acceptable and disclosed, not engineered
   away.
4. `plan.toUpdate` → update each session's `starts_at`/`ends_at` **only** (id preserved; `notes`/
   `session_date`/`people_reached` untouched — this is what keeps any RSVPs/attendance correctly
   attached, exactly as outreach's own module doc explains for its own update-in-place branch).
5. `plan.toInsert` → insert new `event_sessions` rows (`status: 'scheduled'`, `notes: ''`), same shape
   `makeCreateMeetings`'s own `insertSessions` already uses.
6. `plan.toRemove` → **for each**: delete `rsvps` where `session_id` matches, THEN attempt to delete
   the `event_sessions` row; **on a caught `SupabaseLoaderError` whose `.code === '23503'`** (the
   foreign-key-restrict violation — `TeamsTab.test.tsx:1185-1195`'s exact convention, `isSupabaseLoaderError`
   imported from `../loader`), fall back to `update event_sessions set status = 'canceled' where id =
   :id` **instead of re-throwing**. Any other error re-throws (a genuine, disclosed failure the
   dialog's existing `submitError` `Banner` surfaces).

`export const saveMeetingSeries: OnSaveMeetingSeriesFn = makeSaveMeetingSeries();`

### 4c. `MeetingsList.tsx` wiring

- `CoachMeetingRow` (`:671-678`) gains **two optional** fields (optional specifically so the 7 existing
  hand-built `CoachMeetingRow` literals in `MeetingsList.test.tsx` need no mechanical edit): `teamIds?:
  string[] | null;` and `description?: string;`.
- `FixtureEvent` (`:592-603`, internal/unexported) gains `description?: string;` (optional, same
  reasoning — 6 existing `FIXTURE_EVENTS`-shaped literals in this file stay untouched).
- `buildCoachMeetingRows` (`:959-1018`)'s `rows.push({...})` (`:1009-1015`) gains `teamIds:
  event.teamIds ?? null, description: event.description ?? ''`.
- `loaders/meetings.ts`: `EventDbRow` (`:183-195`) gains `description: string;`; `queryEvents`'s
  select string (`:338`) gains `, description`; `mapEventDbRow` (`:275-286`) gains `description:
  row.description,`.
- Delete `StubNotice` (`:1380-1383`), `StubBanner` (`:1385-1401`), the `stubNotice` state (`:2031`),
  `showEditStub` (`:2079-2084`), and its render site (`:2214-2216`) — this is genuinely dead code once
  a real edit path exists, not a deferred concern.
- New state in `CoachMeetingsView`: `editTarget: CoachMeetingRow | null` (mirrors
  `OutreachList.tsx`'s `editingTarget`). `openScheduleDialog()` (`:2069-2071`) additionally sets
  `editTarget(null)`. A new `openEditDialog(row: CoachMeetingRow): void` sets `editTarget(row)` and
  opens the dialog.
- `onEdit={showEditStub}` → `onEdit={openEditDialog}` at both `CoachMeetingsSection` mounts (`:2249`,
  `:2260`).
- Compute `initialData` for the dialog by ternary at the render call (mirrors
  `OutreachList.tsx:3396-3399`): `editTarget !== null ? { eventId: editTarget.eventId, title:
  editTarget.title, teamIds: editTarget.teamIds ?? null, locationName: editTarget.locationName,
  description: editTarget.description ?? '', sessions: editTarget.sessions.map(s => ({ sessionId:
  s.sessionId, sessionDate: s.sessionDate, startsAt: s.startsAt, endsAt: s.endsAt, status: s.status }))
  } : undefined`.
- New `handleSaveMeetingSeriesSubmit(payload: SaveMeetingSeriesPayload): Promise<void>` mirrors
  `handleCreateMeetingsSubmit`'s (`:2145-2167`) reload-and-feedback shape: `await
  onSaveMeetingSeries(payload)`, then reload `rows`/`teams` from `loadData()`, success feedback banner.
- `<ScheduleMeetingsDialog>` mount (`:2296-2301`) gains `initialData={initialData}`,
  `onSaveMeetingSeries={onSaveMeetingSeries}` (threaded prop, default `saveMeetingSeries`), and its
  `onOpenChange` clears `editTarget` on close (mirrors `OutreachList.tsx:3505-3508`).
- `CoachMeetingsViewProps` (`:1999-2009`) gains `onSaveMeetingSeries: OnSaveMeetingSeriesFn`.
- `MeetingsListProps`/`MeetingsList` (`:2646-2686`, `:2712`) gains `onSaveMeetingSeries?:
  OnSaveMeetingSeriesFn` defaulting to `saveMeetingSeries`, threaded to `<CoachMeetingsView>` the same
  way `onCreateMeetings` already is.

## 5. Allowed Files

```
src/pages/meetings/ScheduleMeetingsDialog.tsx
src/pages/meetings/ScheduleMeetingsDialog.test.tsx
src/pages/meetings/MeetingsList.tsx
src/pages/meetings/MeetingsList.test.tsx     (see §9 for the ONE gated pre-existing-test exception)
src/lib/supabase/loaders/meetings.ts
docs/swarm/active/T510-worker-output.md      (create — your evidence doc)
```

## Forbidden Files

- Everything under `supabase/migrations/` — no migration is needed or authorized for this task.
- `src/pages/meetings/LiveConsole.tsx`, `EndMeetingDialog.tsx`, `Kiosk.tsx`, `StudentMeetingView.tsx`
  and their test files.
- `src/pages/outreach/**` and its loaders — read-only precedent only, never edited.
- `src/lib/supabase/loaders/outreach.ts`, `endMeeting.ts`, `attendance.ts`, `students.ts`,
  `client.ts`, `loader.ts` (import from `loader.ts`; do not edit it).
- `src/lib/supabase/types.ts`.
- `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/constitution.md`,
  `docs/swarm/dispute-log.md`, `docs/swarm/auto-mode-decisions.md`, `.claude/agents/`,
  `.claude/skills/`, `.claude/settings.json`.
- Any other file in `src/` not listed in §5.

## 6. Rules (constitution)

Item 10 — you are not touching any migration; everything you need is a read-only citation. Item 20 —
if you find a genuine out-of-scope defect, name it in your output doc as a follow-up, don't just
comment it. Item 21 — your completion report states a commit SHA; the orchestrator verifies HEAD moved.
Item 22 — stage named paths only, never `git add -A`/`git add .`. Item 23 — mutation experiments (e.g.
reproducing §2's cited pre-task behavior yourself) run in your own worktree. Non-Negotiables — existing
tests must pass unless explicitly approved otherwise (§9 names the one exception and its gate); no
self-certification; a checker inspects the real artifact.

## 7. Six gates — capture `$?` on the BARE command, never through a pipe

This project has already shipped one false-green from `npm run typecheck 2>&1 | tail -5` reporting
`tail`'s exit code instead of `tsc`'s (`auto-mode-decisions.md`, "George authorizes subagent dispatch in
the kickoff"). Every criterion below runs the bare command and captures `$?` immediately, or uses
`cmd; echo "EXIT:$?"`:

```
npm run typecheck; echo "EXIT:$?"
npm run format:check; echo "EXIT:$?"
npm run lint; echo "EXIT:$?"
npm test; echo "EXIT:$?"
```

Report file/test totals against a named baseline SHA (`git rev-parse HEAD` before your change), not
"a clean checkout."

## 8. Acceptance Criteria — each individually checkable by file/line or exact command

- **AC1 — additive-only guarantee.** `git diff -- src/pages/meetings/ScheduleMeetingsDialog.tsx` shows
  no changed line inside the existing `CreateMeetingsEventPayload`, `CreateMeetingsSessionPayload`,
  `CreateMeetingsPayload`, `OnCreateMeetingsFn`, or `defaultOnCreateMeetings` declarations, and
  `computeConfirmLabel`'s pre-existing four call sites in `ScheduleMeetingsDialog.test.tsx:353-356`
  still assert the exact strings `'Create 0 meetings'`/`'Create 1 meeting'`/`'Create 14 meetings'`/
  `'Create 2 meetings'` (now with `false` as the first argument).
- **AC2 — `isMeetingSessionReconcilable` boundary.** Unit test: a session with `status: 'scheduled'`
  and `startsAt` exactly equal to `now` → `false` (protected, non-strict `>` in the implementation).
  `startsAt` one millisecond in the future → `true`. `status: 'canceled'` with `startsAt` far in the
  future → `false`.
- **AC3 — `computeMeetingSeriesReconcilePlan`, kept.** A reconcilable session whose date is also in
  `desiredFutureSessions` appears in `toUpdate` with the correct `sessionId`, and does NOT appear in
  `toRemove` or `toInsert`. Mutation: swap the `reconcilableByDate` lookup for an always-empty map →
  this assertion must go RED (the session incorrectly lands in `toInsert` instead).
- **AC4 — dropped.** A reconcilable session whose date is absent from `desiredFutureSessions` appears
  in `toRemove` (not `toUpdate`). Mutation: remove the `!desiredByDate.has(...)` filter (drop
  everything unconditionally) → a session whose date DOES persist must go RED (wrongly appears in
  `toRemove` too).
- **AC5 — inserted.** A desired date with no reconcilable existing match appears in `toInsert`.
- **AC6 — past sessions are NEVER touched.** A session with `startsAt` in the past and a date absent
  from `desiredFutureSessions` does **not** appear in `toRemove`. Mutation: delete the
  `isMeetingSessionReconcilable` filter entirely (operate on all `existingSessions`) → this must go RED
  (the past session wrongly appears in `toRemove`).
- **AC7 — already-canceled sessions are never touched.** A `status: 'canceled'` session whose date is
  absent from `desiredFutureSessions` does not appear in `toRemove` (it is already gone from the
  coach's perspective; re-touching it would be meaningless per rule 5's own "keeps `'canceled'` meaning
  only 'a coach cancelled this on purpose'" reasoning).
- **AC8 — partial `events` update.** Read the diff / the fake-client test for `makeSaveMeetingSeries`:
  the `.update({...})` call's argument object has **exactly** the keys `title`, `team_ids`,
  `location_name`, `description` — `address`, `counts_participation`, `counts_volunteer_hours`,
  `adult_volunteers_count`, `adult_volunteer_hours` are absent from that object literal.
- **AC9 — delete-then-cancel-fallback, both branches proven with a fake client** (mirror
  `TeamsTab.test.tsx:1185-1195`'s exact shape):
  - Branch A: `rsvps.delete().eq('session_id', X)` is called before `event_sessions.delete().eq('id',
    X)` for a session in `plan.toRemove`, and when both resolve cleanly, no `event_sessions.update`
    call happens for that id.
  - Branch B: `event_sessions.delete().eq('id', X)` resolves `{ data: null, error: { message: ...,
    code: '23503' } }` → the function does NOT reject; instead `event_sessions.update({ status:
    'canceled' }).eq('id', X)` is called.
  - A non-`'23503'` error code on the same delete → the function DOES reject (no fallback for a
    genuinely different failure).
- **AC10 — the "already happened" disclosure.** A component test with an `initialData.sessions` entry
  that is not `isMeetingSessionReconcilable` renders a count/notice; an `initialData` with only
  reconcilable sessions renders no such notice (mutation: make the notice unconditional → this second
  half must go RED).
- **AC11 — confirmation counts, always.** Opening the confirmation for a save that only ADDS sessions
  shows a nonzero "added" count, a zero "removed" count, and **no rendered list of removed dates**
  (rule 6's "a pure addition shows no list").
- **AC12 — confirmation list, only when removing.** Opening the confirmation for a save that drops at
  least one session shows the same three counts **and** a rendered list containing the human-readable
  form of each specific removed date (assert the actual date strings appear, not just a count).
- **AC13 — Edit opens the real dialog, prefilled.** Clicking a row's `Edit – <title>` button
  (`CoachMeetingRowActions`, unchanged component) no longer shows the stub `Banner`
  (`"isn't supported yet"` must not appear anywhere in the rendered output after this task); it opens
  `ScheduleMeetingsDialog` with the Title field showing the row's `title`, the Location field showing
  `locationName`, and (edit mode only) a Description field showing the row's `description`.
- **AC14 — dead code removed.** `grep -rn "StubNotice\|StubBanner\|showEditStub\|stubNotice"
  src/pages/meetings/MeetingsList.tsx` returns zero matches.
- **AC15 — create path is behaviorally unchanged.** `MeetingsList.test.tsx:919-1063`'s existing
  "creating a meeting via the real dialog…" tests and `MeetingsList.test.tsx:2294-2371`'s
  `describe('createMeetings …')` block pass **without modification** (confirm by diff: these line
  ranges are untouched).
- **AC16 — the one gated test.** `MeetingsList.test.tsx:1082-1095` is rewritten **only if** an explicit
  orchestrator authorization entry exists in `docs/swarm/auto-mode-decisions.md` citing this packet and
  this file/line range (§0, §9); the replacement test asserts the new behavior (AC13's shape). If no
  such entry exists when you reach this point, **stop and file a dispute** rather than edit it.
- **AC17-AC20 — the four gates from §7**, each with `EXIT:0` captured on the bare command, reported
  against a named baseline SHA.

## 9. The one pre-existing test that must change, and why it is gated

`MeetingsList.test.tsx:1082-1095` (`it('Edit shows an honest stub explaining the dialog has no edit
mode (not the old misleading copy)', …)`) asserts `container.textContent` contains `"Editing an
existing meeting isn't supported yet"` after clicking Edit. **That assertion is the literal thing this
task deletes.** It is a genuine, load-bearing existing-test modification under the constitution's
Non-Negotiables ("existing tests must pass unless the boss explicitly approves a test update"), and per
this project's own established practice (T148/T149's false-authorization incidents, and the correction
that followed them) **the foreman does not have standing to grant that approval itself**, and neither
does a worker or a checker. The fact that George's design closure necessarily implies this test's
premise becomes false is not the same claim as "George approved rewriting this specific test" — those
are exactly the two claims T148 and T149 conflated, and the fix recorded afterward was to keep them
separate and cite whichever one is actually true.

**What must happen before this AC can be satisfied:** the orchestrator adds a dated entry to
`docs/swarm/auto-mode-decisions.md` (not this packet, not the worker's output doc) recording that it —
under its own standing delegated authority, or by relaying an explicit instruction from George — has
approved rewriting `MeetingsList.test.tsx:1082-1095`, citing this packet by name. `checker-premise`
should verify this citation exists (and actually says what this packet claims) before returning
DISPATCH; if it does not exist, the correct verdict is REVISE, not DISPATCH-with-a-caveat.

## Required Worker Output (`docs/swarm/active/T510-worker-output.md`)

- Files changed (exact list, matching §5).
- Confirmation that `CreateMeetingsPayload`'s family is byte-identical (AC1), with the diff excerpt
  proving it.
- Every new/changed exported symbol's final signature (so a checker can grep-verify without re-reading
  the whole diff).
- Every command from §7/§8 run directly, with real captured exit codes and outputs — no pasted
  summaries.
- The AC9 fake-client test's actual mock call sequence (which table, which method, in what order) for
  both the clean-delete and the `'23503'`-fallback branches.
- Baseline SHA and before/after lint warning count + vitest file/test totals against it.
- Commit SHA (item 21) and confirmation of explicit pathspecs (item 22).
- Whether the AC16/§9 authorization citation existed when you reached that point, and what it said (or
  that you stopped and filed a dispute because it did not exist).
- Any genuine out-of-scope defect found, named as a follow-up per item 20 (you do not have ledger write
  access — state it plainly so the orchestrator can create the row).
- Known risks (e.g. the disclosed confirmation-preview-vs-real-save race, §4b step 3).
