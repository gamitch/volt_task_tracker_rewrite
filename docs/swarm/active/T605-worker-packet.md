# Worker Packet: T605 — edit one meeting session (date, time, notes) and cancel it from the edit flow

**Packet v1.** Attempt count: 0 — no worker has run against this packet yet. This packet has NOT been
premise-gated. Per constitution item 19 and the explicit correction recorded in
`docs/swarm/auto-mode-decisions.md` ("2026-08-05 — the orchestrator kept doing worker and foreman work
itself" and "T603 was re-run ... self-certification by the agent that wrote the packet is not a premise
gate"), **this packet goes to `checker-premise` next. No worker is dispatched until it returns DISPATCH.**
Do not commission a checker-reviewer packet in the same call as the worker dispatch — `swarm-run` steps
4→5 are separate commissions, written after the worker's own output exists.

**Row:** T605 (`task-ledger.md`, filed 2026-08-05) · **Tier: HEAVY** (constitution item 26 — this task
writes directly to `event_sessions`, a genuine write path: "can a mistake here corrupt data, or lie to a
user about their own data?") · **Worker model: sonnet** (default — none of item 18's four opus triggers
fire: no migration, no RLS/`security definer` change, no metric-SQL view, no auth/session/role logic) ·
**Branch:** `claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**.

**Dependency:** T510 (series edit) is merged to `main` via PR #108. This packet builds directly on
`isMeetingSessionReconcilable`, `EditMeetingSeriesInitialData`, and the `saveMeetingSeries` loader
pattern T510 shipped — verified against the live tree below, not assumed.

---

## 0. Scope, in one sentence

Add a per-session **Edit** action (date, start time, end time, notes) reachable from each scheduled
session inside `MeetingsList.tsx`'s coach view, backed by a real, guarded, in-place `event_sessions`
update, with a **Cancel this meeting** action inside that same dialog that reuses the session Cancel
mechanism T096/T122 already built — nothing new invented for Cancel itself.

**Explicitly NOT this task:** per-session **location** (T606 — needs an additive migration to
`event_sessions`, HEAVY, owner-applied cutover). Do not touch `event_sessions`' location handling and do
not add a location field to any dialog built here.

---

## 1. Authority — why this row exists, verified against the log, not relayed

`docs/swarm/auto-mode-decisions.md`, section **"2026-08-05 (later) — George's T510 rulings: meeting edit
is FUTURE-FORWARD, and two hazards were caught before building"**, subsection **"3. Per-session
editing — all four, and one needs a migration"** (verified, this is the section's own text):

> He selected every option: **date and time · notes · its own location · cancel just that one.**
> - **date / time / notes** — `event_sessions` already owns `session_date`, `starts_at`, `ends_at`,
>   `notes` (verified against the table definition). `notes` exists and the meetings UI has never
>   surfaced it.
> - **cancel just that one** — exists today as the per-session Cancel button; he wants it reachable
>   from the edit flow too.
> - **its own location** — `event_sessions` has NO location column... filed separately as T606.

And the **governing principle**, same section, quoted verbatim from George:

> *"If i am narrowing a date range or drop a weekday, those 'cancelled' events should go away... This
> should not, however happen to past meetings that have occured in the series. If those meetings have
> occured they should stay and the series edit is only future forward."*

And the strict form of "already happened," from **"2026-08-05 — George closes out T510's design: the
last three questions"**, Check 03, verbatim:

> *"'already happened' means a start time passed, even if noone ended it."*

**This task inherits that same rule, not a looser one.** T510 built the enforcement mechanism as a pure,
exported function — reuse it (§4 below), do not reimplement it:

```
src/pages/meetings/ScheduleMeetingsDialog.tsx:562-567
export function isMeetingSessionReconcilable(
  session: Pick<ExistingMeetingSeriesSession, 'status' | 'startsAt'>,
  now: Date,
): boolean {
  return session.status === 'scheduled' && new Date(session.startsAt).getTime() > now.getTime();
}
```

`docs/swarm/auto-mode-decisions.md`'s **D014** entry (2026-08-05, "George rules on absence marking and
MET-01") concerns the participation-percentage formula and is **not directly load-bearing for this
task** — it governs `v_student_participation`/T509, not session editing. Read in full per the brief; not
reproduced here because nothing in it changes this packet's design.

---

## 2. Verified facts against the live tree (not assumed)

1. **Schema — no migration needed, all four columns already exist:**
   `supabase/migrations/20260717000000_scheduling_attendance.sql:53-63`:
   ```
   create table public.event_sessions (
     id uuid primary key default gen_random_uuid(),
     event_id uuid not null references public.events (id) on delete cascade,
     session_date date not null,
     starts_at timestamptz not null,
     ends_at timestamptz not null,
     status text not null check (status in ('scheduled', 'completed', 'canceled')),
     people_reached integer,
     notes text not null,
     created_at timestamptz not null default now()
   );
   ```
   `notes` is `text not null` with **no default** — every write must supply a real string (never
   `undefined`/`null`), same discipline `ScheduleMeetingsDialog.tsx`'s own module doc #1 and
   `OutreachEventDialog.tsx`'s module doc #3 already established for this exact column.

2. **`notes` has never been read out of the database anywhere in this file tree.**
   `loaders/meetings.ts:360-368`'s `querySessions` selects
   `'id, event_id, session_date, starts_at, ends_at, status'` — no `notes`. T510's own
   `queryEditableSessionsForEvent` (`loaders/meetings.ts:558-571`, added for the series dialog) selects
   the same five columns, also no `notes`. Neither `CoachMeetingSessionDetail`
   (`MeetingsList.tsx:677-696`) nor `FixtureEventSession` (`MeetingsList.tsx:635-642`) has a `notes`
   field. **Confirmed: nothing in this codebase currently threads `event_sessions.notes` anywhere.**

3. **Outreach has no notes-editing precedent either — checked, not assumed.** Both
   `OutreachEventDialog.tsx:877` and `OutreachDetail.tsx:1043/1053/1063` hard-code
   `notes: ''` on every session payload; OUT-02 has no notes field in its own spec. There is no existing
   UI pattern in this app for editing `event_sessions.notes` to copy. Design it fresh (§5).

4. **Cancel already exists and is reusable as-is — verified, not merely cited.**
   `loaders/meetings.ts:963-974`'s `makeCancelMeetingSession` does exactly
   `update event_sessions set status = 'canceled' where id = :sessionId`. `MeetingsList.tsx` wires it at
   three points that must NOT be duplicated:
   - The trigger button, per-session, inside `CoachMeetingSessionRow` (`:1679-1688`), gated on
     `session.status === 'scheduled'`.
   - The confirmation `AlertDialog`, owned by `CoachMeetingsView` (`:2312-2327`) — title
     `` `Cancel "${eventTitle}" on ${date}?` ``, description *"This marks the session canceled. Students
     won't be expected to attend, and no attendance will be recorded for it."*, `actionLabel="Cancel
     session"`.
   - The mutation + optimistic flip/rollback, `handleConfirmCancel` (`:2115-2163`).
   **This task reuses all three unchanged.** It does not add a second `AlertDialog`, a second copy of
   that confirmation text, or a second call to `onCancelSession`. "Reachable from the edit flow" means:
   a button inside the new dialog this task builds triggers the SAME `cancelTarget` state
   `CoachMeetingsView` already owns.

5. **T510's own module doc names this exact task and this exact hazard**, verified at
   `ScheduleMeetingsDialog.tsx:598-612` (`computeMeetingSeriesReconcilePlan`'s doc comment):
   > "Duplicate `session_date` among reconcilable sessions -- not possible via any existing create-mode
   > path today... disclosed limitation for whoever builds T605 next (per-session date edits are where a
   > genuine duplicate could first appear)." If the shared date is not desired at a future series edit,
   > **both** duplicate-dated sessions get removed by `toRemove`'s array filter; if it is desired, the
   > `Map`-keyed `toUpdate` silently drops one.

   **This makes the duplicate-date guard in §5.4 below a required part of this task, not optional
   hardening** — T605 is literally the change T510's own comment predicted would first make a duplicate
   reachable, and shipping it without the guard reopens a data-integrity hole T510's checker already
   spent two gate rounds closing for the series path.

6. **Where the series dialog's own "Notes" field goes (pre-existing, found during investigation, NOT
   this task's to fix — see §7).** `ScheduleMeetingsDialog.tsx`'s "Notes" `EventFormSection` renders
   unconditionally in both create and edit mode (`:1142-1144`), but `handleSubmit`'s edit-mode branch
   hard-codes `notes` to `''` when building `desiredFutureSessions` (`:930-932`, its own comment:
   *"`notes` is fixed to `''` here regardless of this dialog's own `notes` state -- per-session notes are
   T605's scope"*). A coach typing into that box today while editing a series has it silently discarded.
   **This packet does not touch `ScheduleMeetingsDialog.tsx` to fix that** (see Forbidden Files and §7) —
   flagging it is this packet's job; fixing it is a separate, already-anticipated follow-up.

7. **The `runMutation`/D016 guard pattern this task's own write must copy**, verified at
   `loaders/meetings.ts:745-770`:
   ```
   const deleteSessionIfStillFuture = runMutation<string, DeletedSessionIdRow[]>(
     (client, sessionId) =>
       client.from('event_sessions').delete().eq('id', sessionId).gt('starts_at', 'now').select('id'),
     getClient,
   );
   ```
   with the load-bearing rule from its own doc comment: *"an empty array means the guard fired... The
   return value is LOAD-BEARING."* `.select()` after a filtered mutation is real in the installed
   `@supabase/postgrest-js` (already relied on here); without it, Postgrest never surfaces whether the
   `WHERE` clause matched zero rows, and a client-clock-only future-forward check is exactly the class of
   defect `docs/swarm/dispute-log.md` D015/D016 spent two arbitration rulings closing for the series path.
   **This task's own update mutation (§5.3) must use the identical shape** — guard chained onto the
   write itself, `.select('id')`, zero-length result handled explicitly, never silently treated as
   success.

---

## 3. Allowed Files

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/pages/meetings/EditMeetingSessionDialog.tsx` (**new file**)
- `src/pages/meetings/EditMeetingSessionDialog.test.tsx` (**new file**)
- `src/lib/supabase/loaders/meetings.ts`

## 4. Forbidden Files

- `src/pages/meetings/ScheduleMeetingsDialog.tsx` and `ScheduleMeetingsDialog.test.tsx` — T510's territory,
  already through two arbitrated gate rounds (D015/D016). Read-only reference for
  `isMeetingSessionReconcilable` (import it) and layout precedent. **Do not fix the dead Notes-field issue
  in §2.6 here** — see §7.
- `src/pages/meetings/LiveConsole*.tsx`, `LiveConsole*.test.tsx`, `Kiosk.tsx`, `EndMeetingDialog.tsx` —
  unrelated surfaces.
- `supabase/migrations/**` — no migration in this task.
- `src/lib/supabase/loader.ts` — shared seam, import only (`runMutation`, `createLoader`,
  `isSupabaseLoaderError`).
- `src/pages/outreach/**` — read-only precedent only (§2.3), never edited.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`.
- `package.json` / lockfiles (unless a genuine new dependency is required — it is not expected to be).

---

## 5. Design requirements

### 5.1 Type/data threading for `notes` — additive only, optional at every app-level layer

To avoid forcing edits across the fixture literals this field predates (`MeetingsList.tsx`'s own
`FIXTURE_SESSIONS` array, six hand-built session literals at `:841-889`, and every hand-built
`CoachMeetingSessionDetail`/`FixtureEventSession` literal in `MeetingsList.test.tsx`), follow T510's own
established precedent for exactly this situation — `CoachMeetingRow.teamIds?`/`.description?`
(`MeetingsList.tsx:708-715`) were both made **optional** for the identical reason, stated in their own
doc comments (*"the 3 existing hand-built ... literals ... need no edit"*):

- `loaders/meetings.ts`'s `EventSessionDbRow` gains `notes: string` (**required** — the real DB column is
  `not null`, so a real query always returns it). Add `notes` to `querySessions`'s `.select(...)` string.
- `mapSessionDbRow` maps `notes: row.notes` into the app-level shape.
- `MeetingsList.tsx`'s `FixtureEventSession` gains `notes?: string` (**optional**).
- `MeetingsList.tsx`'s `CoachMeetingSessionDetail` gains `notes?: string` (**optional**).
- `buildCoachMeetingRows`'s per-session mapping (`:1034-1044`) sets `notes: session.notes ?? ''` on each
  constructed `CoachMeetingSessionDetail`.
- **Do not** touch `queryEditableSessionsForEvent`/`ExistingMeetingSeriesSession`/
  `EditMeetingSeriesInitialData` (T510's series-edit path) — it has no use for `notes` (§2.6) and is
  Forbidden territory regardless.

**Proof required, not a manual count:** `npm run typecheck` exits 0 (captured on the bare command, never
through a pipe — see §6's note) with these fields added. A passing typecheck against the real fixture
files, not a grep-based count of literals, is what settles whether this stayed additive.

### 5.2 New per-session "Edit" affordance in `MeetingsList.tsx`

Inside `CoachMeetingSessionRow` (`:1597-1694`), within the existing
`{session.status === 'scheduled' && (<>...)}` fragment that already renders the "Go live" `Link` and the
"Cancel ... session" `Button`, add a third control:

```tsx
{isMeetingSessionReconcilable(session, new Date()) && (
  <Button
    variant="ghost"
    size="sm"
    style={MIN_TOUCH_TARGET_STYLE}
    label={`Edit ${formatWeekdayDate(session.sessionDate)} session`}
    onClick={() => onEditRequest(eventId, eventTitle, session)}
  />
)}
```

- `isMeetingSessionReconcilable` is **imported** from `./ScheduleMeetingsDialog` (already exported,
  `:562`) — do not reimplement it. This is the one deliberate exception to this codebase's usual
  cross-dialog-helper reimplementation convention (contrast `chicagoWallTimeToUtcIso`/
  `formatChicagoWallTime`, §5.3): the brief is explicit that the future-forward rule itself must be
  shared, not re-derived, so the series dialog and this new surface can never silently disagree about
  what "already happened" means.
- The label mirrors the Cancel button's own naming convention exactly
  (`` `Cancel ${formatWeekdayDate(session.sessionDate)} session` ``, `:1686`) so it is unambiguous both
  visually and to assistive tech, and is **structurally distinct** from the series-level
  `` `Edit – ${row.title}` `` chip (`:1533`, en dash) that already exists on the same expanded row —
  two different "Edit" affordances on screen at once must never share an accessible name.
- Gating on `isMeetingSessionReconcilable` (not merely `status === 'scheduled'`, which is all Cancel
  checks) is deliberate: a `scheduled` session whose `startsAt` has already passed keeps its Cancel
  button (George's own "still cancellable individually" fallback, "George closes out T510's design" Check
  03) but must NOT show Edit.

**Threading `onEditRequest` down to this component** mirrors `onCancelRequest`'s existing five-site
thread exactly — same signature shape `(eventId: string, eventTitle: string, session:
CoachMeetingSessionDetail) => void`, added alongside (not replacing) `onCancelRequest` at every one of:
`CoachMeetingSessionRow` props (`:1607-1612`), `renderMeetingSessionDetailCell` (`:1746-1763`),
`BuildCoachMeetingColumnsArgs`/`buildCoachMeetingColumns` (`:1765-1799`), `CoachMeetingsSection`
(`:1926-1975`, including its `useMemo` deps at `:1974`), and the two `<CoachMeetingsSection>` call sites
in `CoachMeetingsView` (`:2287-2308`).

**In `CoachMeetingsView`**, add:

```ts
interface EditSessionTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
  otherSessionDates: readonly string[]; // every OTHER session's sessionDate on this same event, any status
}
const [editSessionTarget, setEditSessionTarget] = useState<EditSessionTarget | null>(null);
```

populated by the new `onEditRequest` handler passed to both `<CoachMeetingsSection>` instances:

```ts
onEditRequest={(eventId, eventTitle, session) => {
  const row = rows.find((r) => r.eventId === eventId);
  const otherSessionDates = (row?.sessions ?? [])
    .filter((s) => s.sessionId !== session.sessionId)
    .map((s) => s.sessionDate);
  setEditSessionTarget({ eventId, eventTitle, session, otherSessionDates });
}}
```

`rows` is already in scope in `CoachMeetingsView` (`:2049`) — this needs no new query and no widening of
`CoachMeetingSessionDetailTableRow`'s own shape.

The new dialog is driven the same way the existing Cancel `AlertDialog` is (`cancelTarget !== null` IS
its own `isOpen`, `:2312-2316`) — not the two-state (`isScheduleDialogOpen` + `editTarget`) pattern the
series dialog uses, because that pattern exists only because ONE `ScheduleMeetingsDialog` instance serves
both create and edit modes. This new dialog has exactly one mode, so:

```tsx
<EditMeetingSessionDialog
  isOpen={editSessionTarget !== null}
  onOpenChange={(isOpen) => { if (!isOpen) setEditSessionTarget(null); }}
  initialData={editSessionTarget}
  onSaveMeetingSession={handleSaveMeetingSessionSubmit}
  onRequestCancelSession={() => {
    if (editSessionTarget === null) return;
    setCancelTarget({
      eventId: editSessionTarget.eventId,
      eventTitle: editSessionTarget.eventTitle,
      session: editSessionTarget.session,
    });
    setEditSessionTarget(null);
  }}
/>
```

`handleSaveMeetingSessionSubmit` mirrors `handleSaveMeetingSeriesSubmit` (`:2192-2215`) exactly: call the
injected mutation, then reload via `loadData()` (full reload, not an optimistic merge — same reasoning
that function already documents), with matching success/reload-failure feedback copy
("Meeting session updated" / "... Refresh the page to see the change.").

### 5.3 New loader mutation: `makeSaveMeetingSession` / `saveMeetingSession`, `loaders/meetings.ts`

**Why this is a fresh in-place `UPDATE` and not a call into `makeSaveMeetingSeries` /
`computeMeetingSeriesReconcilePlan`:** that function's `toUpdate` path only ever changes `starts_at`/
`ends_at` for a session matched **by its existing `session_date`** — it has no path that changes a
session's own `session_date`, because a date change is modeled as remove-old + insert-new (new `id`,
RSVPs deleted per D015). Editing one session in place must **preserve its `id` and therefore its
existing RSVPs** — that is strictly better for a coach correcting a typo'd date/time than a
delete-and-recreate would be, and is the actual reason this needs its own mutation rather than reusing
the series machinery. State this reasoning in a code comment; a checker will look for it.

```ts
interface UpdatedMeetingSessionIdRow {
  id: string;
}

export interface SaveMeetingSessionPayload {
  sessionId: string;
  sessionDate: string; // 'YYYY-MM-DD'
  startsAt: string; // ISO timestamptz
  endsAt: string; // ISO timestamptz
  notes: string; // always a real string -- event_sessions.notes is `not null`, no default
}
// (Type owned by the new dialog file, per §5.4 -- loaders/meetings.ts imports it, mirroring how it
// already imports SaveMeetingSeriesPayload from ScheduleMeetingsDialog.tsx, :177-185.)

export function makeSaveMeetingSession(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnSaveMeetingSessionFn {
  const updateSession = runMutation<SaveMeetingSessionPayload, UpdatedMeetingSessionIdRow[]>(
    (client, payload) =>
      client
        .from('event_sessions')
        .update({
          session_date: payload.sessionDate,
          starts_at: payload.startsAt,
          ends_at: payload.endsAt,
          notes: payload.notes,
        })
        .eq('id', payload.sessionId)
        .eq('status', 'scheduled')
        .gt('starts_at', 'now')
        .select('id'),
    getClient,
  );

  return async (payload: SaveMeetingSessionPayload): Promise<void> => {
    const updatedRows = await updateSession(payload);
    if ((updatedRows ?? []).length === 0) {
      // The row didn't match at write time (already started, or status/starts_at changed
      // concurrently) -- REJECT. Do not resolve as success: a save that silently no-ops fails the
      // same honesty bar D016 (docs/swarm/dispute-log.md) ruled for the series-edit's own delete path.
      throw new Error(
        "This meeting can no longer be edited (it may have already started). Refresh the page to see its current details.",
      );
    }
  };
}

export const saveMeetingSession: OnSaveMeetingSessionFn = makeSaveMeetingSession();
```

Notes on this exact shape, load-bearing, not stylistic:
- `.eq('status', 'scheduled')` **and** `.gt('starts_at', 'now')` in the `WHERE` clause are both evaluated
  against the row's **pre-update** values (Postgres/PostgREST semantics), so this correctly guards on the
  session's state *before* this write, even though the same statement's `SET` clause is changing
  `starts_at`. This is the server-side enforcement point; the app-level `isMeetingSessionReconcilable`
  check (§5.2) that hides the Edit button is UX convenience only, exactly the same "client filter is UX,
  DB guard is enforcement" split D015/D016 established for the series path.
- `.select('id')` is load-bearing (§2.7) — without it there is no way to distinguish "matched and
  updated" from "matched zero rows," and the guard becomes decorative.
- Wall-time → UTC conversion (`chicagoWallTimeToUtcIso`) and its reverse
  (`formatChicagoWallTime`-equivalent, for prefilling the dialog's `TimeInput`s from `session.startsAt`/
  `endsAt`) belong in the **new dialog file**, not the loader, matching every existing convention in this
  codebase — reimplement locally rather than importing `ScheduleMeetingsDialog.tsx`'s copies (that file's
  own `formatChicagoWallTime` is deliberately not exported, `:683-686`; its `chicagoWallTimeToUtcIso` IS
  exported but importing it would be the one place this task would depend on Forbidden-file internals
  rather than the codebase's established reimplementation convention — `OutreachEventDialog.tsx`/
  `OutreachDetail.tsx` reimplement the identical pair independently of each other and of
  `ScheduleMeetingsDialog.tsx`, and this file should follow that same precedent). Whichever is chosen,
  prove behavioral parity against the SAME two cases `ScheduleMeetingsDialog.test.tsx:290-298` already
  proves (`'2026-07-22'+'18:00' → '2026-07-22T23:00:00.000Z'` CDT; the January CST case).

### 5.4 New file: `src/pages/meetings/EditMeetingSessionDialog.tsx`

Layout precedent: **`StudentDialog.tsx` (`:481-490`)**, not `ScheduleMeetingsDialog.tsx`'s fullscreen
`EventFormLayout`. This is a small, single-entity edit dialog — plain `Dialog purpose="form"` (no
`variant="fullscreen"`), `Layout` + `LayoutContent` + `FormLayout`, same as `StudentDialog.tsx`. Argued
from the code, not asserted: `ScheduleMeetingsDialog.tsx` already carries a series-wide schedule-mode
model (`SegmentedControl` of Single/Weekly/Custom, a `DateRangeInput`, a weekday `CheckboxList`, per-mode
generators) that a single fixed-identity session edit has no use for and should not inherit — folding
this into that component would mean threading a THIRD mode (`isEditMode` already distinguishes
create/series-edit) through a state model that assumes zero-or-many computed dates, for a feature that
always edits exactly one already-identified row. A second, smaller, single-purpose component is the
correct shape, matching this codebase's own existing "one dialog per distinct editing shape" pattern
(`StudentDialog` vs. `ScheduleMeetingsDialog` vs. `OutreachEventDialog`).

Required contents:

```ts
export interface EditMeetingSessionInitialData {
  eventId: string;
  eventTitle: string; // read-only context, not editable here
  session: CoachMeetingSessionDetailLikeShape; // sessionId, sessionDate, startsAt, endsAt, notes
  otherSessionDates: readonly string[];
}

export interface SaveMeetingSessionPayload { /* see §5.3 -- owned here, imported by the loader */ }
export type OnSaveMeetingSessionFn = (payload: SaveMeetingSessionPayload) => Promise<void>;
export const defaultOnSaveMeetingSession: OnSaveMeetingSessionFn = async (payload) => { /* console.warn stub, mirrors defaultOnSaveMeetingSeries */ };

export interface EditMeetingSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialData: EditMeetingSessionInitialData | null;
  onSaveMeetingSession?: OnSaveMeetingSessionFn;
  onRequestCancelSession: () => void;
}
```

Fields, in this order: `DateInput` (date), `TimeInput` × 2 (start/end), `TextArea` (notes, `isOptional`).
No Title, Team scope, Location, or Description field — those remain exclusively the series dialog's
territory; duplicating any of them here would let a coach change series-wide data from a
session-scoped surface, which is exactly the confusion T510's own "series edit only" ruling exists to
prevent.

Read-only context (event title + the session's own date, e.g. in the `DialogHeader`/subtitle) so a coach
editing one occurrence of a recurring series can tell which one.

Footer buttons, **three distinct accessible names, none of them the bare word "Cancel"** (this dialog's
own comment should say why, mirroring `MeetingsList.tsx:1683-1686`'s existing reasoning about ambiguous
Cancel labels when several could be on screen):
- Dismiss without saving — e.g. `label="Close"`.
- Primary submit — `label="Save changes"`, disabled until valid (§5.5).
- Destructive — `label="Cancel this meeting"`, `variant="destructive"` (real Astryx variant,
  `docs/swarm/astryx-api.md:1812`/`:1777`) — calls `onRequestCancelSession()` (never `onCancelSession`
  directly; this dialog does not own that mutation, §2.4).

Source every prop against `docs/swarm/astryx-api.md` directly (constitution: *"Astryx component props
come only from `docs/swarm/astryx-api.md`... A prop absent from that file is presumed hallucinated"*) —
do not assume parity with `StudentDialog.tsx`'s own prop list without checking each one still applies.

### 5.5 Pure, separately testable validate/build functions (precedent: `computeMeetingSeriesReconcilePlan`)

Two pure functions, exported directly from the new file, no React and no fake `SupabaseClient` needed to
test either — same shape `resolveAttendanceWriteMethod` (`loaders/attendance.ts:287-291`) and
`computeMeetingSeriesReconcilePlan` already established:

```ts
/** Mirrors buildEventSessionsPayload's "incomplete inputs -> no payload" shape, singular. */
export function computeMeetingSessionEditPayload(
  sessionId: string,
  date: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  notes: string,
): SaveMeetingSessionPayload | null {
  if (date === undefined || startTime === undefined || endTime === undefined) return null;
  return {
    sessionId,
    sessionDate: date,
    startsAt: chicagoWallTimeToUtcIso(date, startTime), // local reimplementation, §5.3
    endsAt: chicagoWallTimeToUtcIso(date, endTime),
    notes,
  };
}

/** T605's own required guard -- see §2.5. `otherDates` is every OTHER session's own sessionDate on
 * this same event, any status (mirrors computeMeetingSeriesReconcilePlan's allExistingDates -- ANY
 * status, not just scheduled). */
export function sessionDateCollidesWithSibling(
  candidateDate: string,
  otherDates: readonly string[],
): boolean {
  return otherDates.includes(candidateDate);
}
```

`isValid` in the dialog component is `computeMeetingSessionEditPayload(...) !== null &&
!sessionDateCollidesWithSibling(date, initialData.otherSessionDates)` — Save stays natively `disabled`
(no `tooltip` prop, matching `ScheduleMeetingsDialog.tsx`'s own module doc #5 reasoning for why an absent
`tooltip` keeps a button genuinely non-interactive) when either is false. Surface the collision as an
inline validation message near the Date field, not just a silently-disabled button — the coach needs to
know *why*.

---

## 6. Verification requirements

- `npm run typecheck` and the project's real test-runner script (check `package.json` for the actual
  name — do not assume `npm test`/`npm run test` without checking) must both **exit 0 on the bare
  command**, never through a pipe. Constitution/log precedent, verbatim:
  *"`npm run typecheck 2>&1 | tail -5` reports the exit status of `tail`, not of `tsc`... Every npm
  criterion in the packets written since captures `$?` on the bare command."*
- Identify every test by **name and content**, never by line range, in both the packet's own citations
  above and the worker's own output — line ranges drift the moment the worker's own insertions land.
- Any count of affected call sites (e.g., how many places reference `CoachMeetingSessionDetail`,
  `FixtureEventSession`, or `notes`) must be **settled by the compiler** (a clean `npm run typecheck`),
  not asserted from a single grep shape. This project has miscounted the same class of thing three times
  in two days (four vs. seven, four vs. six, six vs. seven) — verify on more than one search shape if a
  specific number is stated anywhere in the worker's own output.

### Required tests (add to `MeetingsList.test.tsx` unless noted; mirror cited precedent exactly)

1. `buildCoachMeetingRows` threads a fixture session's real `notes` value into the built
   `CoachMeetingSessionDetail` (mirrors the existing describe block at `:469-551`).
2. The new "Edit … session" button is present for a reconcilable session and absent for (a) a
   `completed` session, (b) a `canceled` session, and (c) a `scheduled` session whose `startsAt` is in
   the past (mirror the `PAST_SESSION` fixture shape already established at
   `ScheduleMeetingsDialog.test.tsx:921-927`).
3. Clicking Edit opens `EditMeetingSessionDialog` prefilled with the real session's date/time/notes
   (prove by **value**, not by presence — same "prefill, not presence" standard the T510 boss ruling
   required for the series dialog's own Grant A property 2).
4. Saving a valid change calls `onSaveMeetingSession` with the exact expected payload, then reloads via
   `loadData()` and shows the success `Banner` — mirror `handleSaveMeetingSeriesSubmit`'s own tested shape.
5. **Duplicate-date guard, both directions:** attempting to retarget a session onto a sibling session's
   existing date is rejected (Save stays disabled / an inline message appears); retargeting onto a free
   date succeeds. Named mutation: removing the `sessionDateCollidesWithSibling` check must turn the
   rejection test from a real proof into a false pass.
6. **Cancel reuses the existing mechanism, proven, not asserted:** open the edit dialog, click "Cancel
   this meeting," assert the SAME confirmation copy already tested at `MeetingsList.test.tsx:1153`
   (`` `Cancel "${eventTitle}" on ${date}?` ``) appears, confirm it, and assert `onCancelSession` was
   called exactly once with the session's id — via the pre-existing seam, not a new one. A test that
   would also pass against a second, independently-built confirmation flow does not satisfy this
   criterion; assert on the specific existing copy/state, not merely "a confirmation appeared."
7. **The write-side guard, fake-client, full chain depth** (precedent: `MeetingsList.test.tsx`'s own
   `buildAC9FakeClient`, `:2490-2603`, and its own citation of why a shallow mirror is insufficient —
   *"not a one-filter-deep mirror... this mock's own `event_sessions.delete()` branch does not resolve
   anything until `.select(...)` is actually called"*). Build a fake client whose `event_sessions.update`
   branch does not resolve `{data, error}` until `.select('id')` is reached, covering the full
   `update → eq → eq → gt → select` chain. Assert: (a) the `.update(...)` argument object has exactly the
   keys `session_date`, `starts_at`, `ends_at`, `notes`; (b) a non-empty result resolves without throwing;
   (c) an empty-array result **rejects** with a real error (never resolves as success). Named mutation:
   dropping `.select('id')` from the production chain must break assertion (c) (the mock cannot resolve a
   real `{data, error}` shape without it), proving the test would have caught that specific regression.
8. `computeMeetingSessionEditPayload` and `sessionDateCollidesWithSibling` get direct unit tests in
   `EditMeetingSessionDialog.test.tsx` (no React, no fake client), including the incomplete-input →
   `null` case and the two conversion-parity cases named in §5.3.
9. Confirm — state this explicitly in the worker's output, don't just imply it by omission — that no
   existing test anywhere under `src/pages/meetings/` currently asserts "a session's date/time/notes
   cannot be edited," and that this task's changes required zero edits to any existing test's
   assertions. If the worker believes an existing test's assertion is forced to change by this work, it
   **stops and files a dispute** rather than editing it — see §7.

---

## 7. What this worker must NOT do, and where genuine judgment calls stop

1. **Do not touch `ScheduleMeetingsDialog.tsx`** to fix the dead-Notes-field issue found in §2.6, even
   though it is real and even though this task makes it more likely to mislead a coach. That file is
   Forbidden (§4). State the finding in the worker's own output exactly as it is stated here so the
   foreman can log it as its own follow-up task — do not fix it opportunistically "while in the area"
   (constitution item 20's own rationale: a comment-only deferral is not a substitute for a ledger row,
   and a silent fix outside Allowed Files is worse than a comment).
2. **Do not build per-session location editing.** That is T606, gated on an additive migration this task
   must not attempt.
3. **Do not modify any existing test's assertions.** If, in the course of this work, the worker concludes
   an existing test's assertion must change to make this task's own required behavior true, it stops,
   states exactly which test (by name and content) and why, and files a dispute rather than editing it.
   The Non-Negotiables rule this invokes, quoted verbatim from `docs/swarm/constitution.md`'s own
   "Non-Negotiables" section: *"Existing tests must pass unless the boss explicitly approves a test
   update."* **Flag for the record:** this project's own log has referred to that rule as "constitution
   item 10" in at least one recent entry (2026-08-06, the T510 test-amendment boss ruling), but the
   constitution's own current numbered "Project-Specific Standards" list (1-26) reserves item 10 for the
   additive-migrations rule (`:53`, *"Database changes are additive migrations via the Supabase CLI..."*)
   — a different rule entirely. This packet cites the existing-tests rule **by section and verbatim
   quote**, not by a numeral, specifically to avoid repeating that drift. **A worker or checker must not
   resolve this ambiguity by picking whichever reading is convenient** — if it becomes load-bearing (i.e.,
   a test genuinely needs to change), stop and escalate exactly as this task's own §6 item 9 and this
   item require; do not self-authorize under either numbering.
4. **This packet does not authorize any test amendment.** Per the T148/T149 false-authorization history
   and the T510 foreman's correct refusal to self-authorize its own test edit, only a `boss-architect`
   ruling (recorded in `docs/swarm/auto-mode-decisions.md`, citable by name) can authorize changing an
   existing test. None is anticipated to be needed (§6 item 9), and none is granted here.

---

## 8. Known risks (disclose in the worker's own output verbatim or improved, not weakened)

1. **Residual race, same class D015/D016 already accepted for the series path, disclosed rather than
   eliminated with a migration:** if a session's `starts_at` crosses `now`, or its status changes, in the
   window between the dialog opening and Save, the write's own DB-level guard (§5.3) makes the save
   **reject with an explicit error** — never a silent no-op, never a corrupted write. This is the correct,
   honest outcome and requires no further mitigation.
2. **Duplicate-date guard is application-level only.** No unique constraint exists on
   `(event_id, session_date)` in the schema, so two coaches concurrently retargeting two different
   sessions of the same series onto the identical date could both pass the app-level check and both
   write — reproducing, for real, the exact `computeMeetingSeriesReconcilePlan` ambiguity §2.5 cites.
   Narrow (requires two staff editing the same series at the same instant); accepted rather than closed
   with a migration, consistent with this task's own no-migration scope boundary. A schema-level fix
   belongs with T606's migration wave, the same way D015 declared (rather than silently absorbed) the
   proportionality trade-off against a fully atomic RPC for the series path.
3. **The dead Notes field in `ScheduleMeetingsDialog.tsx`'s edit mode (§2.6/§7.1)** is not fixed by this
   task and becomes more confusing once real per-session notes editing ships elsewhere in the same app.
   Flagged for a follow-up task, not fixed here.

---

## 9. Required Worker Output

- Files changed (exact paths).
- Commit SHA, and confirmation `git log`/`git diff` against the merge base shows the work landed in the
  commit (constitution item 21 — existence is verified, not assumed; "clean" and "committed" are
  different claims).
- Summary of changes, keyed to §5's numbered subsections.
- Every command run, with its real exit code captured on the bare command (§6).
- The three named-mutation proofs from §6 (items 5, 6, 7), with real before/after output, not a
  description of what they would show.
- Explicit confirmation of §6 item 9 (no existing test needed modification) OR a filed dispute per §7.3.
- The §8 known risks, restated or improved with anything discovered during implementation.
- Whether a dispute is needed, and if so, exactly which packet section it concerns.
