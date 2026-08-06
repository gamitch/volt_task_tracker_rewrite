# Worker Packet: T605 — edit one meeting session (date, time, notes) and cancel it from the edit flow

**Packet v2 — REVISED per `checker-premise` round 1.** Attempt count: 0 — no worker has run against any
version of this packet. Per item 19a this gate is capped at two rounds; a second REVISE on v2 escalates to
`boss-arbiter`. **v2 still goes to a fresh `checker-premise` pass before any worker sees it** — this
revision does not self-certify. Do not commission a checker-reviewer packet in the same call as worker
dispatch (`swarm-run` steps 4→5 are separate commissions, written after the worker's own output exists).

**Row:** T605 (`task-ledger.md`, filed 2026-08-05) · **Tier: HEAVY** (constitution item 26 — real write
path to `event_sessions`) · **Worker model: sonnet** (no item 18 opus trigger fires) · **Branch:**
`claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**. *(Tier and model reasoning confirmed
exact by round 1 — not reopened.)*

**Dependency:** T510 (series edit) merged to `main`, PR #108. **T609 (dead Notes-field fix, see §3.6) is
independent of T605 and, per this gate round, already lands separately** — verify its state at dispatch
time (§8).

---

## 0. Gate round 1 (`checker-premise`, pinned `4ee5c02`, live PG 16.13 cluster + isolated worktree fixture
probes) — REVISE/BLOCKER. Disposition table.

**Confirmed exact, not reopened in v2:** the schema citations (§3.1), the three cancel-reuse ranges
(§3.4), the `:598-612` duplicate-date comment (§3.5), the D016 guard shape (§3.7), the tier/model
reasoning (header), and that `isMeetingSessionReconcilable` compiles when imported into `MeetingsList.tsx`.

| # | Severity | Finding | Disposition in v2 |
|---|---|---|---|
| B1 | BLOCKER | The DB guard reads the **pre-update** `starts_at` — a coach mistyping the new date/time into the past passes `status='scheduled' AND starts_at > now`, writes successfully, and the row becomes permanently unreachable from both this surface and T510's series edit, with a silent `v_planned_rsvp_hours` change | **Landed.** `computeMeetingSessionEditPayload` (§6.5) now validates the **candidate** `startsAt` is strictly future, mirroring `ScheduleMeetingsDialog.tsx:619-621`, returning `null` (surfaced as an inline field message) rather than ever reaching the mutation. §6.3's enforcement-split framing corrected: for *this* hazard the DB guard cannot help (it cannot see the value being written), so the app-level check is the **sole** enforcement point, stated explicitly. |
| B2 | BLOCKER | All 6 default fixture sessions (`FIXTURE_SESSIONS`, `MeetingsList.tsx:841-891`) are dated July 2026 — `isMeetingSessionReconcilable` returns false for all of them against any real clock, so required tests 2-5 have no reconcilable session to exercise and test 6 is self-contradictory (demands Edit-button access to a session that has none) | **Landed.** §7 now requires an explicit, additive, per-describe-block fixture (custom `loadCoachData`, not an edit to shared `FIXTURE_SESSIONS`) anchored to a frozen clock (`vi.setSystemTime`, fallback below) so it never rots. Test 8 rewritten against that fixture's own session plus an assertion through the existing `cancelTarget`/`onCancelSession` seam, not the July fixture's copy. |
| M1 | MAJOR | §3.2 (v1 §2.2) widened "the meetings UI has never surfaced `notes`" into "nothing in this codebase currently threads `event_sessions.notes` anywhere" — false; `loaders/outreach.ts` selects/types/maps it | **Landed.** Scope restored; counterexample cited (§3.2). |
| M2 | MAJOR | §5.3 (v1) called the in-place `event_sessions` UPDATE "fresh, no in-repo precedent" — `loaders/outreach.ts:1497-1512` (doc at `:254-262`) is exactly this mutation shape and states the same id/RSVP-preservation rationale | **Landed.** Cited as precedent (§3.8); column-set discipline copied; one real difference disclosed (outreach's version never rewrites `session_date` itself — it matches existing rows by date, so it never needs to; this task's mutation does, since moving a session to a new calendar day is the point). |
| M3 | MAJOR | T605 makes per-session time divergence reachable for the first time; T510's own `resetForm`/`handleSubmit`/`isValid` (`ScheduleMeetingsDialog.tsx:811-827`, `:932`, `:879-881`) silently collapses it back to one shared time the next time **anyone** saves the series, even a title-only save, with no warning | **Landed as Known Risk 4 (§9), ruled explicitly: accepted-and-disclosed for T605's own ship, AND flagged for a follow-up ledger row** — the real fix lives entirely inside `ScheduleMeetingsDialog.tsx`'s already-arbitrated (D015/D016) territory, which is Forbidden here, and this packet does not authorize reopening it. Not silently absorbed: called out to the orchestrator/boss in this packet and in my reply, matching the severity class D015 was arbitrated at. |
| M4 | MAJOR | T609 (owner-ordered, independent) already fixes the dead-Notes-field issue v1's §2.6/§7.1/§8.3 were built around; v1's §7.1 would have made the worker re-report an already-filed-and-fixed defect | **Landed.** §3.6/§8/§9 rewritten: T609 and T605 ruled independent/complementary (T605's own dialog has its own `TextArea`, never touches the series dialog's Notes field); worker instructed to confirm T609's landed state and NOT re-report/re-fix it; polarity noted (`:1021` gates Description **on** `isEditMode`; T609 gates Notes **on** `!isEditMode`). |
| m1 | MINOR | §2.7 (v1) citation should be `:761-770`, not `:745-770` | **Landed** (§3.7). |
| m2 | MINOR | Add `MeetingsList.tsx:1815` and `:1881` to the `onCancelRequest` thread — both are real call sites inside `buildCoachMeetingColumns` (narrow + wide) | **Landed**, verified directly — both lines call `renderMeetingSessionDetailCell(row, onCancelRequest)` (§6.2). |
| m3 | MINOR | `PAST_SESSION` (`ScheduleMeetingsDialog.test.tsx:921-927`) is `status: 'completed'`, so it cannot serve test 2(c)'s "scheduled but expired" case; also convert line-range test citations to name/content per §6/§7's own rule | **Landed.** §7 test 2(c) gets its own fixture (status `'scheduled'`, past `startsAt`) distinct from a completed/canceled one. All test citations in §7 converted to describe/it/fixture names. |
| m4 | MINOR | `SaveMeetingSessionPayload` defined in both §5.3 and §5.4 (v1) — pick one home | **Landed.** Owned solely by the new dialog file (§6.4), mirroring `SaveMeetingSeriesPayload`'s ownership by `ScheduleMeetingsDialog.tsx`. `loaders/meetings.ts` imports it via `import type` only. |
| m5 | MINOR | The rejection message ("it may have already started") is not always true — an RLS-blocked (non-staff) UPDATE also returns zero rows | **Landed.** Reworded to cover both causes honestly (§6.3). |
| m6 | MINOR | No `end > start` validation — the DB accepts a negative interval and `v_planned_rsvp_hours` would carry negative hours | **Landed** in `computeMeetingSessionEditPayload` (§6.5). |
| m7 | MINOR | `FIXTURE_SESSIONS` is `:841-891`, not the range previously implied | **Landed** (§3.9). |
| m8 | MINOR | Give the full path for `StudentDialog.tsx` | **Landed** — `src/pages/roster/StudentDialog.tsx` everywhere. |
| m9 | MINOR | Require `import type` on new cross-file type imports — `loaders/meetings.ts` ↔ `MeetingsList.tsx` is already a runtime value cycle; the new dialog file must not close a third edge | **Landed** — mandated explicitly in §6.3/§6.4. |
| — | Named risk | `maxAffected()` (shipped in installed `postgrest-js@2.110.7`) must not be adopted — depends on a PostgREST version this repo has not verified against hosted Supabase | **Landed** as an explicit "do not use" note in §6.3/§8. |

---

## 1. Scope, in one sentence

Add a per-session **Edit** action (date, start time, end time, notes) reachable from each scheduled
session inside `MeetingsList.tsx`'s coach view, backed by a real, guarded, in-place `event_sessions`
update, with a **Cancel this meeting** action inside that same dialog that reuses the session Cancel
mechanism T096/T122 already built — nothing new invented for Cancel itself.

**Explicitly NOT this task:** per-session **location** (T606 — needs an additive migration, HEAVY,
owner-applied cutover). Do not touch `event_sessions`' location handling.

---

## 2. Authority — why this row exists, verified against the log, not relayed

`docs/swarm/auto-mode-decisions.md`, section **"2026-08-05 (later) — George's T510 rulings: meeting edit
is FUTURE-FORWARD, and two hazards were caught before building"**, subsection **"3. Per-session
editing — all four, and one needs a migration"**:

> He selected every option: **date and time · notes · its own location · cancel just that one.**
> - **date / time / notes** — `event_sessions` already owns `session_date`, `starts_at`, `ends_at`,
>   `notes` (verified against the table definition). `notes` exists and the meetings UI has never
>   surfaced it.
> - **cancel just that one** — exists today as the per-session Cancel button; he wants it reachable
>   from the edit flow too.
> - **its own location** — `event_sessions` has NO location column... filed separately as T606.

Governing principle, verbatim from George, same section:

> *"If i am narrowing a date range or drop a weekday, those 'cancelled' events should go away... This
> should not, however happen to past meetings that have occured in the series. If those meetings have
> occured they should stay and the series edit is only future forward."*

And the strict form of "already happened," **"2026-08-05 — George closes out T510's design"**, Check 03,
verbatim: *"'already happened' means a start time passed, even if noone ended it."*

**This task inherits that same rule, not a looser one**, via the pure function T510 already built —
reuse it, do not reimplement it:

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
task** — it governs `v_student_participation`/T509, not session editing.

---

## 3. Verified facts against the live tree

**3.1 Schema — no migration needed; confirmed exact by round 1.**
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
`notes` is `text not null`, no default — every write must supply a real string.

**3.2 `notes` has never been surfaced in the *meetings UI* — corrected scope (fixes M1).**
`loaders/meetings.ts:360-368`'s `querySessions` selects
`'id, event_id, session_date, starts_at, ends_at, status'` — no `notes`. Neither
`CoachMeetingSessionDetail` (`MeetingsList.tsx:677-696`) nor `FixtureEventSession` (`:635-642`) has a
`notes` field, and no meetings-surface dialog has a notes input bound to a real session today. **This
claim is scoped to the meetings UI only.** Outreach's own loader already threads the identical column at
runtime: `loaders/outreach.ts:457` (`EventSessionDbRow.notes: string`), `:682`
(`mapSessionDbRowToOutreachDetailSession` maps it), and `:767`/`:778` (`querySessionsForEvents`/
`querySessionsForEvent` both select it). Outreach reads and writes the column; it has never given a human
a way to *edit* its value (§3.3) — that is the narrower, correct claim.

**3.3 Outreach has no notes-*editing* UI precedent either — checked, not assumed.** Both
`OutreachEventDialog.tsx:877` and `OutreachDetail.tsx:1043/1053/1063` hard-code `notes: ''` on every
session payload they build; OUT-02 has no notes field in its own spec. There is no existing UI pattern in
this app for a human to edit `event_sessions.notes` — design it fresh (§6.4).

**3.4 Cancel already exists and is reusable as-is.** `loaders/meetings.ts:963-974`'s
`makeCancelMeetingSession` does exactly `update event_sessions set status = 'canceled' where id =
:sessionId`. `MeetingsList.tsx` wires it at three points this task reuses unchanged:
- Trigger button, per-session, inside `CoachMeetingSessionRow` (`:1679-1688`), gated on
  `session.status === 'scheduled'`.
- Confirmation `AlertDialog`, owned by `CoachMeetingsView` (`:2312-2327`) — title
  `` `Cancel "${eventTitle}" on ${date}?` ``, description *"This marks the session canceled. Students
  won't be expected to attend, and no attendance will be recorded for it."*, `actionLabel="Cancel
  session"`.
- Mutation + optimistic flip/rollback, `handleConfirmCancel` (`:2115-2163`).
"Reachable from the edit flow" means: a button inside the new dialog triggers the SAME `cancelTarget`
state `CoachMeetingsView` already owns. No second `AlertDialog`, no second copy of that text, no second
call to `onCancelSession`.

**3.5 T510's own module doc names this exact task and this exact hazard**, `ScheduleMeetingsDialog.tsx:598-612`:
> "Duplicate `session_date` among reconcilable sessions -- not possible via any existing create-mode
> path today... disclosed limitation for whoever builds T605 next (per-session date edits are where a
> genuine duplicate could first appear)."
**This makes the duplicate-date guard (§6.5) required, not optional hardening** — T605 is the change
that comment predicted would first make a duplicate reachable.

**3.6 T609 already fixes the series dialog's dead Notes field — ruled independent of T605, not stale
(fixes M4).** v1 of this packet found (and this remains true as a historical fact): `ScheduleMeetingsDialog.tsx`'s
"Notes" `EventFormSection` used to render unconditionally in both create and edit mode, with
`handleSubmit`'s edit-mode branch hard-coding `notes` to `''` regardless of what a coach typed — a dead
control. **Per this gate round: T609 was ordered fixed immediately and is independent of, and
complementary to, T605** — T605's own new dialog (§6.4) has its own `TextArea` and never touches the
series dialog's Notes field at all, so nothing here needs "un-hiding." Note the polarity: `:1021` gates
the series dialog's **Description** field **on** `isEditMode` (shown only in edit mode); T609 gates the
series dialog's **Notes** field **on** `!isEditMode` (hidden in edit mode, since per-session notes are
now this task's job). **The worker must verify T609 has actually landed in the tree before starting** (a
quick check: does `ScheduleMeetingsDialog.tsx`'s Notes `EventFormSection` render conditionally?). If it
has **not** landed, that is a blocking premise mismatch to report, not something to silently fix or
silently ignore — T609 is not this packet's territory (`ScheduleMeetingsDialog.tsx` is Forbidden, §5)
regardless of its landing state. **Do not re-report the dead-Notes-field finding as if it were new** —
it is already filed and, per this ruling, already fixed.

**3.7 The D016 guard pattern this task's write must copy** (citation corrected, fixes m1),
`loaders/meetings.ts:761-770`:
```
const deleteSessionIfStillFuture = runMutation<string, DeletedSessionIdRow[]>(
  (client, sessionId) =>
    client
      .from('event_sessions')
      .delete()
      .eq('id', sessionId)
      .gt('starts_at', 'now')
      .select('id'),
  getClient,
);
```
Load-bearing per its own doc comment: *"an empty array means the guard fired... The return value is
LOAD-BEARING."* This task's own update mutation (§6.3) copies the identical shape: guard chained onto the
write, `.select('id')`, zero-length result handled explicitly, never silently treated as success.

**3.8 The in-place-UPDATE precedent this task's write is NOT inventing (fixes M2).**
`loaders/outreach.ts:1497-1512`:
```ts
const updateSession = runMutation<
  { id: string; session: SaveOutreachEventPayload['sessions'][number] },
  void
>(
  (client, args) =>
    client
      .from('event_sessions')
      .update({
        starts_at: args.session.startsAt,
        ends_at: args.session.endsAt,
        notes: args.session.notes,
        people_reached: args.session.peopleReached,
      })
      .eq('id', args.id),
  getClient,
);
```
Its own doc comment, `loaders/outreach.ts:254-262`, states this task's own §6.3 rationale nearly
verbatim: matching by `session_date` and updating **in place** *"preserving its `id`, so any
`rsvps`/`attendance` rows already attached to it stay correctly attached"*, reached by the same
`on delete restrict` reasoning T605 relies on. **Copy this column-set discipline** (name every written
column explicitly in the `.update({...})` object, nothing implicit). **One real difference, disclosed
rather than hidden:** outreach's version never rewrites `session_date` — it matches an existing row *by*
`session_date`, so a date change there is handled as a different row entirely (remove/insert territory,
same shape T510's own `computeMeetingSeriesReconcilePlan` uses). This task's mutation explicitly **does**
rewrite `session_date` in place, because moving one session to a different calendar day while preserving
its identity/RSVPs is the entire point of an "edit," not a limitation to route around.

**3.9 Fixture reality, verified (fixes B2).** `FIXTURE_SESSIONS` (`MeetingsList.tsx:841-891`) has six
sessions, all dated July 2026 (`2026-07-08` through `2026-07-25`). Against any real wall clock from that
month onward, **zero** of them satisfy `isMeetingSessionReconcilable` — the default fixture data used by
`defaultLoadCoachMeetingsData` (and by every existing test that renders coach data without overriding
`loadCoachData`) has **no session the new Edit affordance would ever appear on**. Required tests (§7)
must supply their own additive fixture; they cannot reuse `FIXTURE_SESSIONS` for the reconcilable case.

---

## 4. Allowed Files

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/pages/meetings/EditMeetingSessionDialog.tsx` (**new file**)
- `src/pages/meetings/EditMeetingSessionDialog.test.tsx` (**new file**)
- `src/lib/supabase/loaders/meetings.ts`

## 5. Forbidden Files

- `src/pages/meetings/ScheduleMeetingsDialog.tsx` and `ScheduleMeetingsDialog.test.tsx` — T510's
  already-arbitrated (D015/D016) territory, and now also T609's. Read-only reference for
  `isMeetingSessionReconcilable` (import it) and layout/precedent citations. **Do not fix or touch
  anything related to T609** (§3.6) — verify its landing state, do not act on it. **Do not attempt to fix
  the M3 hazard (§9, Known Risk 4)** — it lives entirely in this file's already-arbitrated logic.
- `src/pages/meetings/LiveConsole*.tsx`, `LiveConsole*.test.tsx`, `Kiosk.tsx`, `EndMeetingDialog.tsx`.
- `supabase/migrations/**` — no migration in this task.
- `src/lib/supabase/loader.ts` — shared seam, import only (`runMutation`, `createLoader`,
  `isSupabaseLoaderError`).
- `src/pages/outreach/**` — read-only precedent only (§3.3, §3.8), never edited.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`.
- `package.json` / lockfiles (unless a genuine new dependency is required — not expected).

---

## 6. Design requirements

### 6.1 Type/data threading for `notes` — additive only, optional at every app-level layer

Mirrors T510's own established precedent for exactly this situation — `CoachMeetingRow.teamIds?`/
`.description?` (`MeetingsList.tsx:708-715`) were made **optional** for the identical reason, stated in
their own doc comments (*"the 3 existing hand-built ... literals ... need no edit"*):

- `loaders/meetings.ts`'s `EventSessionDbRow` gains `notes: string` (**required** — the real column is
  `not null`). Add `notes` to `querySessions`'s `.select(...)` string.
- `mapSessionDbRow` maps `notes: row.notes`.
- `MeetingsList.tsx`'s `FixtureEventSession` gains `notes?: string` (**optional**).
- `MeetingsList.tsx`'s `CoachMeetingSessionDetail` gains `notes?: string` (**optional**).
- `buildCoachMeetingRows`'s per-session mapping (`:1034-1044`) sets `notes: session.notes ?? ''`.
- **Do not** touch `queryEditableSessionsForEvent`/`ExistingMeetingSeriesSession`/
  `EditMeetingSeriesInitialData` (T510's series-edit path) — no use for `notes` there, and Forbidden
  regardless.

**Proof required, not a manual count:** `npm run typecheck` exits 0 (bare command, never piped) with
these fields added.

### 6.2 New per-session "Edit" affordance in `MeetingsList.tsx`

Inside `CoachMeetingSessionRow` (`:1597-1694`), within the existing
`{session.status === 'scheduled' && (<>...)}` fragment (already rendering "Go live" and "Cancel"), add:

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

- `isMeetingSessionReconcilable` **imported** from `./ScheduleMeetingsDialog` (already exported,
  `:562`) — not reimplemented. Deliberate exception to this codebase's cross-dialog reimplementation
  convention for date helpers (contrast `chicagoWallTimeToUtcIso`, §6.3): the future-forward rule itself
  must be shared, so the series dialog and this surface can never silently disagree about "already
  happened."
- Label mirrors Cancel's own naming exactly (`` `Cancel ${formatWeekdayDate(session.sessionDate)} session` ``,
  `:1686`), structurally distinct from the series-level `` `Edit – ${row.title}` `` chip (`:1533`, en
  dash) already on the same expanded row.
- Gating on `isMeetingSessionReconcilable` (stricter than Cancel's `status === 'scheduled'` alone) is
  deliberate: a `scheduled`-but-expired session keeps Cancel (George's "still cancellable individually"
  fallback) but must not show Edit.

**Threading `onEditRequest` — five sites, corrected to include both column-factory call sites (fixes
m2):** same signature shape as `onCancelRequest`, `(eventId: string, eventTitle: string, session:
CoachMeetingSessionDetail) => void`, added alongside it at every one of:
1. `CoachMeetingSessionRow` props (`:1607-1612`).
2. `renderMeetingSessionDetailCell`'s own signature (`:1746-1763`).
3. `BuildCoachMeetingColumnsArgs` / `buildCoachMeetingColumns`'s destructured args (`:1765-1799`).
4. **Both** `renderMeetingSessionDetailCell(row, onCancelRequest)` call sites inside
   `buildCoachMeetingColumns` — the narrow-viewport card branch (`:1815`) **and** the wide-viewport
   `title` column (`:1881`). Verified directly: these are two distinct call sites, not one.
5. `CoachMeetingsSection` (`:1926-1975`, including its `useMemo` deps at `:1974`) and the two
   `<CoachMeetingsSection>` call sites in `CoachMeetingsView` (`:2287-2308`).

**In `CoachMeetingsView`:**

```ts
interface EditSessionTarget {
  eventId: string;
  eventTitle: string;
  session: CoachMeetingSessionDetail;
  otherSessionDates: readonly string[]; // every OTHER session's sessionDate on this same event, any status
}
const [editSessionTarget, setEditSessionTarget] = useState<EditSessionTarget | null>(null);

// passed as onEditRequest to both <CoachMeetingsSection> instances:
(eventId, eventTitle, session) => {
  const row = rows.find((r) => r.eventId === eventId);
  const otherSessionDates = (row?.sessions ?? [])
    .filter((s) => s.sessionId !== session.sessionId)
    .map((s) => s.sessionDate);
  setEditSessionTarget({ eventId, eventTitle, session, otherSessionDates });
}
```

`rows` is already in scope (`:2049`) — no new query, no widening of `CoachMeetingSessionDetailTableRow`.

Drive the new dialog the same way the existing Cancel `AlertDialog` is driven (`cancelTarget !== null` IS
its own `isOpen`, `:2312-2316`) — not the two-state (`isScheduleDialogOpen` + `editTarget`) pattern the
series dialog uses (that pattern exists only because ONE `ScheduleMeetingsDialog` instance serves both
create and edit modes; this new dialog has exactly one mode):

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
injected mutation, reload via `loadData()` (full reload, matching that function's own documented
reasoning), matching success/reload-failure feedback copy.

### 6.3 New loader mutation: `makeSaveMeetingSession` / `saveMeetingSession`, `loaders/meetings.ts`

**Why an in-place UPDATE, not a call into `makeSaveMeetingSeries`/`computeMeetingSeriesReconcilePlan`:**
that function's `toUpdate` path only ever changes `starts_at`/`ends_at` for a session matched **by its
existing `session_date`** — a date change there is remove-old+insert-new (new `id`, RSVPs deleted per
D015). Editing one session in place must **preserve its `id` and its existing RSVPs**. This is not
invented from nothing — `loaders/outreach.ts:1497-1512`/`:254-262` (§3.8) is the same shape, same
rationale, one disclosed difference (§3.8's last paragraph). State this reasoning in a code comment; a
checker will look for it.

```ts
import type { SaveMeetingSessionPayload, OnSaveMeetingSessionFn } from '../../pages/meetings/EditMeetingSessionDialog';
// `import type` only (fixes m9) -- MeetingsList.tsx <-> loaders/meetings.ts is already a mutual runtime
// value-import cycle (buildCoachMeetingRows/buildStudentMeetingsData imported one way,
// cancelMeetingSession/createMeetings/loadCoachMeetingsData/loadStudentMeetingsData/
// resolveCurrentStudentId/saveMeetingSeries the other). EditMeetingSessionDialog.tsx must not close a
// third edge into that cycle at the value level -- only its types cross into this file, fully erased at
// compile time.

interface UpdatedMeetingSessionIdRow {
  id: string;
}

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
      // REJECT, never silently succeed (D016's own honesty-bar reasoning, applied to an update
      // instead of a delete). Two real, indistinguishable-over-PostgREST causes collapse into this
      // one branch: (a) the pre-update row no longer matched status='scheduled'/starts_at>now (it
      // started, or changed, between dialog-open and save), or (b) RLS silently filtered the row
      // because the caller lacks permission -- a non-staff UPDATE also returns zero matched rows,
      // not an error (fixes m5: do not assert a single specific cause).
      throw new Error(
        "This meeting session couldn't be updated. It may have already started, your permissions may " +
          "have changed, or your changes may be out of date. Refresh the page and try again.",
      );
    }
  };
}

export const saveMeetingSession: OnSaveMeetingSessionFn = makeSaveMeetingSession();
```

**Enforcement split, corrected (fixes B1's framing error):** this task has **two distinct hazards**, with
**two distinct enforcement points** — do not conflate them.
1. *"The session changed state between dialog-open and save"* (started, canceled, completed, deleted) —
   the DB-level guard above (`.eq('status','scheduled').gt('starts_at','now').select('id')`) is real
   enforcement, because it reads the row's live pre-update state at write time, the same defense-in-depth
   split D015/D016 established for the series path's delete guard.
2. *"The coach's own new value is nonsensical"* (a mistyped date/time that lands in the past, or an end
   time before the start time) — **the DB guard structurally cannot catch this**, because a `WHERE`
   clause only ever evaluates a row's existing column values, never the values being written in the same
   statement's `SET`. There is no CHECK constraint on `event_sessions` for this (adding one is a
   migration, out of scope). **For hazard 2, the app-level validation in `computeMeetingSessionEditPayload`
   (§6.5) is the ONLY enforcement point that exists.** This is corrected from v1, which incorrectly
   described the client-side check as UX-only for both hazards.

**Do not adopt `postgrest-js`'s `maxAffected()`** even though it ships in the installed
`@supabase/postgrest-js@2.110.7` — it depends on a PostgREST server version this repo has not verified
against hosted Supabase. If a worker finds it while reading the installed package, do not use it here.

Wall-time ↔ UTC conversion (`chicagoWallTimeToUtcIso` and its reverse) belongs in the **new dialog file**
(§6.4), reimplemented locally per this codebase's established convention (`OutreachEventDialog.tsx`/
`OutreachDetail.tsx` each reimplement the identical pair independently) rather than importing
`ScheduleMeetingsDialog.tsx`'s copies. Prove behavioral parity against the same two cases
`ScheduleMeetingsDialog.test.tsx`'s own `describe('chicagoWallTimeToUtcIso', ...)` block proves
(`'2026-07-22'+'18:00' → '2026-07-22T23:00:00.000Z'` CDT; the January CST case).

### 6.4 New file: `src/pages/meetings/EditMeetingSessionDialog.tsx`

Layout precedent: **`src/pages/roster/StudentDialog.tsx`** (full path; fixes m8), not
`ScheduleMeetingsDialog.tsx`'s fullscreen `EventFormLayout`. Plain `Dialog purpose="form"` (no
`variant="fullscreen"`), `Layout` + `LayoutContent` + `FormLayout`, same as `StudentDialog.tsx`. Argued
from the code: `ScheduleMeetingsDialog.tsx` carries a series-wide schedule-mode model (`SegmentedControl`
of Single/Weekly/Custom, `DateRangeInput`, weekday `CheckboxList`, per-mode generators) a single
fixed-identity session edit has no use for — a second, smaller, single-purpose component is the correct
shape, matching this codebase's existing "one dialog per distinct editing shape" pattern.

This file **owns** `SaveMeetingSessionPayload`/`OnSaveMeetingSessionFn` (fixes m4 — not redefined in
`loaders/meetings.ts`, which only imports them via `import type`), mirroring exactly how
`ScheduleMeetingsDialog.tsx` owns `SaveMeetingSeriesPayload`/`OnSaveMeetingSeriesFn`:

```ts
export interface SaveMeetingSessionPayload {
  sessionId: string;
  sessionDate: string; // 'YYYY-MM-DD'
  startsAt: string; // ISO timestamptz
  endsAt: string; // ISO timestamptz
  notes: string; // always a real string -- event_sessions.notes is `not null`, no default
}
export type OnSaveMeetingSessionFn = (payload: SaveMeetingSessionPayload) => Promise<void>;
export const defaultOnSaveMeetingSession: OnSaveMeetingSessionFn = async (payload) => {
  console.warn('[EditMeetingSessionDialog] No Supabase client wired in -- stub only.', payload);
};

export interface EditMeetingSessionInitialData {
  eventId: string;
  eventTitle: string; // read-only context, not editable here
  session: {
    sessionId: string;
    sessionDate: string;
    startsAt: string;
    endsAt: string;
    notes?: string;
  };
  otherSessionDates: readonly string[];
}

export interface EditMeetingSessionDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialData: EditMeetingSessionInitialData | null;
  onSaveMeetingSession?: OnSaveMeetingSessionFn;
  onRequestCancelSession: () => void;
}
```

If `initialData.session`'s shape is instead expressed by importing `SessionStatus` or other types
directly from `MeetingsList.tsx` (an equally reasonable choice), that import **must** be `import type`
(fixes m9) — never a plain runtime import — for the same cycle reason as §6.3's note.

Fields, in this order: `DateInput` (date), `TimeInput` × 2 (start/end), `TextArea` (notes, `isOptional`).
No Title, Team scope, Location, or Description field — those remain exclusively the series dialog's
territory.

Read-only context (event title + the session's own date) so a coach editing one occurrence of a
recurring series can tell which one.

Footer buttons, three distinct accessible names, none the bare word "Cancel" (mirrors
`MeetingsList.tsx:1683-1686`'s own reasoning about ambiguous Cancel labels when several could be on
screen):
- Dismiss without saving — e.g. `label="Close"`.
- Primary submit — `label="Save changes"`, disabled until valid (§6.5).
- Destructive — `label="Cancel this meeting"`, `variant="destructive"` (real Astryx variant,
  `docs/swarm/astryx-api.md:1812`/`:1777`) — calls `onRequestCancelSession()` only, never
  `onCancelSession` directly (this dialog does not own that mutation, §3.4).

Source every prop against `docs/swarm/astryx-api.md` directly — do not assume parity with
`src/pages/roster/StudentDialog.tsx`'s own prop list without checking each one still applies.

### 6.5 Pure, separately testable validate/build functions

Two pure functions, exported directly from the new file, no React and no fake `SupabaseClient` needed —
same shape `resolveAttendanceWriteMethod` (`loaders/attendance.ts:287-291`) and
`computeMeetingSeriesReconcilePlan` already established:

```ts
/** Mirrors buildEventSessionsPayload's "incomplete inputs -> no payload" shape, singular, PLUS two
 * required validations that function does not need (a single session has no per-mode date generator to
 * gate this at, unlike the series dialog):
 *  - B1 fix: the CANDIDATE startsAt must be strictly future, mirroring
 *    ScheduleMeetingsDialog.tsx:619-621's own `desiredFuture` filter -- this is the ONLY enforcement
 *    point for a coach's own bad new value (see loaders/meetings.ts's corrected enforcement-split note,
 *    §6.3). The DB guard reads the OLD row and cannot see this.
 *  - m6 fix: endsAt must be strictly after startsAt -- nothing else in this codebase validates this for
 *    event_sessions (buildEventSessionsPayload/the create path do not either), and a negative interval
 *    would surface as negative hours in v_planned_rsvp_hours. */
export function computeMeetingSessionEditPayload(
  sessionId: string,
  date: string | undefined,
  startTime: string | undefined,
  endTime: string | undefined,
  notes: string,
  now: Date,
): SaveMeetingSessionPayload | null {
  if (date === undefined || startTime === undefined || endTime === undefined) return null;
  const startsAt = chicagoWallTimeToUtcIso(date, startTime); // local reimplementation, §6.3
  const endsAt = chicagoWallTimeToUtcIso(date, endTime);
  if (new Date(startsAt).getTime() <= now.getTime()) return null;
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) return null;
  return { sessionId, sessionDate: date, startsAt, endsAt, notes };
}

/** T605's own required guard -- see §3.5. `otherDates` is every OTHER session's own sessionDate on this
 * same event, any status (mirrors computeMeetingSeriesReconcilePlan's allExistingDates -- ANY status,
 * not just scheduled). */
export function sessionDateCollidesWithSibling(
  candidateDate: string,
  otherDates: readonly string[],
): boolean {
  return otherDates.includes(candidateDate);
}
```

`isValid` in the dialog component is `computeMeetingSessionEditPayload(...) !== null &&
!sessionDateCollidesWithSibling(date, initialData.otherSessionDates)` — Save stays natively `disabled`
(no `tooltip` prop, matching `ScheduleMeetingsDialog.tsx`'s own module doc #5 reasoning) when either is
false. Surface *which* validation failed as an inline message near the relevant field(s) — the coach
needs to know why, not just that Save is disabled.

---

## 7. Verification requirements

- `npm run typecheck` and the project's real test-runner script (check `package.json` for the actual
  name) must both **exit 0 on the bare command**, never through a pipe.
- Identify every test by **name and content**, never by line range (all §7 test citations below are
  fixed to comply — this was violated in v1 and flagged by the gate).
- Any count of affected call sites must be **settled by the compiler** (`npm run typecheck`), not a
  single grep shape.

### Required tests (add to `MeetingsList.test.tsx` unless noted)

**Fixture prerequisite (fixes B2) — additive, does not touch `FIXTURE_SESSIONS`, does not engage the
existing-tests rule:** the new describe block below builds its own coach data via a custom
`loadCoachData` (same pattern already used elsewhere in this file, e.g. the existing Cancel tests' own
`renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession })` call),
constructed with `buildCoachMeetingRows` (or a hand-built `CoachMeetingsData` object) over a small,
dedicated set of event/session fixtures that include at least one genuinely reconcilable session.

**Anti-rot requirement (fixes B2):** do not hardcode a future calendar date the way
`ScheduleMeetingsDialog.test.tsx`'s own `RECONCILABLE_SESSION_A`/`_B` fixtures do (`'2026-08-10'`/
`'2026-08-17'`, both close enough to this task's own filing date to rot within days) — that file's own
comment on its `PAST_SESSION` fixture shows the author was careful about rot only on the *past* side
(*"deliberately NOT `new Date()`-relative, so this fixture never flips reconcilable"*), not the future
side. Use `vi.setSystemTime` to freeze the clock at a fixed instant for this describe block
(`beforeEach`/`afterEach` with `vi.useRealTimers()` restoring it), and derive the reconcilable fixture's
`startsAt` as an offset from that SAME frozen instant (e.g. +7 days), so the test is correct forever
regardless of when it actually runs. If `vi.useFakeTimers()` proves incompatible with this file's own
`flushMicrotasks`/async render helpers, fall back to computing the fixture date as an offset from the
real `Date.now()` at test-run time (e.g. `+30` days) — never a bare hardcoded calendar-date string.

1. `buildCoachMeetingRows` threads a fixture session's real `notes` value into the built
   `CoachMeetingSessionDetail` — extend the existing `describe('buildCoachMeetingRows (NAV-07, T122
   module doc #10a)', ...)` block.
2. The new "Edit … session" button is present/absent correctly:
   (a) absent for a `completed` session,
   (b) absent for a `canceled` session,
   (c) absent for a **`scheduled`** session whose `startsAt` is in the past — this needs its own fixture
   distinct from `ScheduleMeetingsDialog.test.tsx`'s `PAST_SESSION` fixture, which is `status:
   'completed'` and cannot exercise this branch (fixes m3),
   (d) present for the new reconcilable fixture session.
3. Clicking Edit opens `EditMeetingSessionDialog` prefilled with the real session's date/time/notes —
   prove by **value**, not presence (the same "prefill, not presence" standard the T510 boss ruling
   required for the series dialog's own Grant A property 2).
4. Saving a valid change calls `onSaveMeetingSession` with the exact expected payload, then reloads via
   `loadData()` and shows the success `Banner` — mirror `handleSaveMeetingSeriesSubmit`'s own tested
   shape.
5. **Future-value guard, both directions (new, fixes B1):** entering a date/time that computes to a past
   `startsAt` disables Save with an inline message; a genuinely future value enables it. Named mutation:
   removing the `now`-comparison from `computeMeetingSessionEditPayload` must turn the rejection case
   from a real proof into a false pass.
6. **End-after-start guard (new, fixes m6):** an end time at or before the computed start time disables
   Save. Named mutation: removing that comparison must turn the rejection case into a false pass.
7. **Duplicate-date guard, both directions:** retargeting onto a sibling session's existing date is
   rejected; retargeting onto a free date succeeds. Named mutation: removing
   `sessionDateCollidesWithSibling` must turn the rejection case into a false pass.
8. **Cancel reuses the existing mechanism, proven against the new fixture (rewritten, fixes B2's self-
   contradiction and m3):** open the edit dialog for the new reconcilable fixture session, click "Cancel
   this meeting," assert the same confirmation-copy shape already proven in the existing test named
   `'Cancel (inline, per-session) + AlertDialog (DES-11) really calls the injected onCancelSession
   mutation'` (`` `Cancel "${eventTitle}" on ${date}?` ``, built from THIS fixture's own event title/date,
   not the July fixture's), confirm it, and assert `onCancelSession` was called exactly once with this
   session's id via the pre-existing `cancelTarget` seam — not a second, independently-built
   confirmation flow.
9. **The write-side guard, fake-client, full chain depth** — precedent: the `buildAC9FakeClient` helper
   function in `MeetingsList.test.tsx` (T510, AC9), whose own doc comment explains why a shallow mirror
   is insufficient (its mock does not resolve `{data, error}` until `.select(...)` is actually reached).
   Build an equivalent fake client whose `event_sessions.update` branch does not resolve until
   `.select('id')` is reached, covering the full `update → eq → eq → gt → select` chain. Assert: (a) the
   `.update(...)` argument object has exactly the keys `session_date`, `starts_at`, `ends_at`, `notes`;
   (b) a non-empty result resolves without throwing; (c) an empty-array result **rejects** with a real
   error. Named mutation: dropping `.select('id')` from the production chain must break assertion (c).
10. `computeMeetingSessionEditPayload` and `sessionDateCollidesWithSibling` get direct unit tests in
    `EditMeetingSessionDialog.test.tsx` (no React, no fake client): the incomplete-input → `null` case,
    the past-`startsAt` → `null` case, the end-before-start → `null` case, and the two
    `chicagoWallTimeToUtcIso` conversion-parity cases named in §6.3.
11. Confirm explicitly in the worker's own output that no existing test anywhere under
    `src/pages/meetings/` currently asserts "a session's date/time/notes cannot be edited," and that
    this task's changes required zero edits to any existing test's assertions. If the worker believes an
    existing test's assertion is forced to change, it **stops and files a dispute** — see §8.

---

## 8. What this worker must NOT do, and where genuine judgment calls stop

1. **T609 is not this packet's territory.** Verify it has landed (§3.6); do not re-fix or re-report the
   dead-Notes-field finding regardless of what you find — if it has not landed, report the mismatch and
   stop rather than acting on `ScheduleMeetingsDialog.tsx` yourself (Forbidden either way, §5).
2. **Do not build per-session location editing** — that is T606, gated on a migration.
3. **Do not modify any existing test's assertions.** If this task's own required behavior seems to force
   an existing test's assertion to change, stop, state exactly which test (by name and content) and why,
   and file a dispute. The rule this invokes is quoted **verbatim from `docs/swarm/constitution.md`'s
   "Non-Negotiables" section**: *"Existing tests must pass unless the boss explicitly approves a test
   update."* **Numbering flag, unresolved, do not pick a side:** this project's own log has referred to
   that rule as "constitution item 10" in a recent entry (2026-08-06), but the constitution's own current
   numbered "Project-Specific Standards" list (1-26) reserves item 10 for the additive-migrations rule
   (`:53`). Cite the rule by section and verbatim quote, never by that numeral, and if it becomes
   load-bearing, escalate rather than resolve the ambiguity yourself.
4. **This packet does not authorize any test amendment.** Only a `boss-architect` ruling (recorded in
   `docs/swarm/auto-mode-decisions.md`, citable by name) can authorize changing an existing test. None is
   anticipated (§7, test 11), and none is granted here.
5. **Do not attempt to fix Known Risk 4 (§9)** — the per-session-time-divergence hazard T605 creates for
   T510's series edit to silently destroy. The fix lives inside `ScheduleMeetingsDialog.tsx`'s
   already-arbitrated logic (Forbidden). Disclose it in the worker's own output; do not touch it.
6. **Do not adopt `postgrest-js`'s `maxAffected()`** (§6.3) even if found while reading the installed
   package — unverified against this repo's actual hosted PostgREST version.

---

## 9. Known risks (disclose in the worker's own output verbatim or improved, never weakened)

1. **Residual race, same class D015/D016 already accepted for the series path:** if a session's
   `starts_at` crosses `now`, or its status changes, in the window between the dialog opening and Save,
   the write's own DB-level guard (§6.3) makes the save **reject with an explicit error** — never a
   silent no-op, never a corrupted write.
2. **Duplicate-date guard is application-level only.** No unique constraint exists on
   `(event_id, session_date)`, so two coaches concurrently retargeting two different sessions of the same
   series onto the identical date could both pass the app-level check and both write — reproducing, for
   real, the exact `computeMeetingSeriesReconcilePlan` ambiguity §3.5 cites. Narrow; accepted rather than
   closed with a migration, consistent with this task's no-migration boundary. A schema-level fix belongs
   with T606's migration wave.
3. **T609 (§3.6) is independent and, per this gate round, already resolves the dead Notes-field issue** —
   not a residual risk of this task; recorded here only so a reader of this section does not go looking
   for it as one.
4. **NEW (M3) — T605 makes per-session time divergence reachable for the first time, and T510's series
   edit silently destroys it.** Every session in a series today shares one wall time by construction.
   Once a coach uses this task's dialog to give one session a genuinely different time,
   `ScheduleMeetingsDialog.tsx`'s `resetForm()` derives a single shared `startTime`/`endTime` from only
   the *earliest* reconcilable session (`:811-827`), and `handleSubmit` reapplies that ONE time to every
   date via `buildEventSessionsPayload(sessionDates, startTime, endTime, '')` (`:932`) — so the next time
   **anyone** saves the series (even a title-only save; `isValid` in edit mode is title-only per
   `:879-881`), the coach's per-session time edit is silently overwritten back to the shared time, with
   the confirmation copy reporting only "N session(s) kept," no warning that a time changed. **Ruled
   here, not silently absorbed:** accepted-and-disclosed for T605's own ship — the alternative would
   block a small, high-value fix behind reopening `ScheduleMeetingsDialog.tsx`'s already-arbitrated
   (D015/D016) design, which this packet does not authorize. **This is flagged to the boss/owner as a
   required follow-up ledger row**, at a severity matching D015's own bar (silent, undisclosed
   state loss from an interaction between two shipped features) — not something the worker or this
   packet closes out unilaterally.

---

## 10. Required Worker Output

- Files changed (exact paths).
- Confirmation that T609 was found already landed in the tree before starting (§3.6), or a stopped/
  reported mismatch if not.
- Commit SHA, and confirmation `git log`/`git diff` against the merge base shows the work landed in the
  commit (constitution item 21).
- Summary of changes, keyed to §6's numbered subsections.
- Every command run, with its real exit code captured on the bare command.
- The five named-mutation proofs from §7 (tests 5, 6, 7, 9), with real before/after output.
- Explicit confirmation of §7 test 11 (no existing test needed modification) OR a filed dispute per §8.3.
- The §9 known risks, restated or improved with anything discovered during implementation — Known Risk 4
  in particular, restated for the boss/owner's attention, not softened.
- Whether a dispute is needed, and if so, exactly which packet section it concerns.
