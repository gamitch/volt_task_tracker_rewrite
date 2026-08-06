# Worker Packet: T510 — series edit for scheduled meetings (shared fields + future-forward schedule)

**Packet v3 — REVISED per `boss-arbiter` ruling D015** (`docs/swarm/dispute-log.md`, plus the dated
operative entry in `docs/swarm/auto-mode-decisions.md`, "2026-08-06 — Boss-arbiter ruling (Dispute
Rule / item 19a): T510 removes dropped sessions PER-SESSION-PAIRED"). **Item 19a's two rounds are now
spent** (round 1 REVISE, round 2 REVISE) — this did not loop to a third round; it escalated per the
Dispute Rule, D015 ruled, and v3 implements the ruling. **v3 does not get a third full premise round.**
Per D015 point 6, it goes to a **fresh** `checker-premise` instance for a **conformance-only** check
against D015 (does §4b step 6 match the ruled sequence; does AC9 match the ruled branches; did the
MAJOR land; does §0 carry the full disposition table below) — nothing settled by rounds 1-2 is
re-audited. Attempt count: 0 — no worker has run against any version of this packet.

**Row:** T510 (`task-ledger.md`, filed 2026-08-05) · **Tier: HEAVY** (constitution item 26) · **Worker
model: sonnet** (default — no item 18 trigger fires; see §3) · **Branch:**
`claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**.

## 0. Gate history (item 19) and D015 disposition table

- **Round 1 of 2** (`checker-premise` on v1): REVISE/BLOCKER — 3 blockers, 4 majors, 10 minors, proven
  in a scratch cluster and an isolated worktree. All folded into v2 and preserved in §2/§4/§8 with
  their labels (B1-B3, M1-M4, m1-m10): the impossible time prefill, the impossible always-editable
  rule for a fully-past series, the future-forward invariant enforced only by a variable's name, a
  batched cancel-fallback that (as first drafted) lost RSVPs, a client-clock-only future-forward guard,
  an undercounted `computeConfirmLabel` call-site list, unresolved §4a ambiguities, a wrong `readonly`
  type, two wrong fixture counts, an unused `createLoader` seam, tests identified by line range instead
  of name/content, two prose errors, a duplicate-date gap, and a citation-completeness nit.
- **Round 2 of 2** (`checker-premise` on v2): REVISE/BLOCKER, proven in a live scratch Postgres cluster.
  **The finding: v2's own fix for round 1's M1 (a batched cancel-fallback) WAS the data loss, not the
  fix for it.** Nothing under `supabase/migrations/` FK-references `rsvps`, so the `rsvps` delete can
  never raise `23503`; `23503` can only come from the session delete, by which point every batched
  session's RSVPs are already gone in a separately-committed PostgREST transaction. The fallback then
  canceled the WHOLE batch, leaving innocent sessions `canceled` with RSVPs destroyed. Reachable in
  ordinary use (`loaders/attendance.ts` has no `starts_at`/`now` guard anywhere — a coach can pre-mark
  attendance on a still-future session from the LiveConsole while another coach narrows the series).
  v2's own AC9 Branch D would have certified this defect green — it asserted only that the promise
  resolved, never that RSVPs survived.
- **Item 19a exhausted at round 2 → escalated per the Dispute Rule → `boss-arbiter` ruled D015.**
  **Ruled: PER-SESSION PAIRING** (§4b step 6's a-e stand; step f becomes per-id: delete that session's
  RSVPs, then that session; on `23503`, cancel that id only; any other error rejects the save).
  Rejected: capture-and-restore (the only live copy of removed RSVPs would be a browser tab's memory,
  and the restore-insert can collide with `rsvps`' `unique (session_id, student_id)`); a `security
  definer` RPC (the only fully atomic option, rejected for T510 on proportionality but **declared** to
  the owner with a veto path — it costs a migration, an opus worker, and an owner-applied cutover for a
  sub-second race whose worst case under pairing is already the owner's own ruled fallback outcome);
  cancel-only (would overturn the owner's explicit "dropped sessions vanish" ruling). **No migration,
  no design change to the owner's rule set, no owner input required to proceed.**

### D015 disposition table (every round-2 finding — required so this is auditable against records the
logs themselves do not itemize)

| # | Finding (round 2) | Disposition in v3 |
|---|---|---|
| BLOCKER | Batched cancel-fallback destroys innocent sessions' RSVPs (§0 above) | **Landed.** §4b step 6f rewritten to per-session pairing (D015 §2); AC9 rewritten to the ruled branches (D015 §4). |
| MAJOR (M2) | `queryStillFutureSessionIds` guarded with an app-computed `new Date().toISOString()` — still "the client clock," not the database's | **Landed.** Guard query now uses `.gt('starts_at', 'now')` — Postgres's own `'now'` timestamptz literal, evaluated server-side, verified by the gate over the wire — and the same `.gt('starts_at', 'now')` is chained onto the per-id `event_sessions` delete itself (§4b). **Stated explicitly, so no reader hunts for it: an equivalent guard on the `rsvps` delete is not expressible over PostgREST** — `rsvps` has no `starts_at` column, and PostgREST has no DELETE-on-embedded-resource filter. |
| MINOR 1 | v2's §0 attributed the flawed batched-fallback design to "the gate" | **Landed.** Corrected: the gate (round 1) *reported* the data-loss risk in the design; the batched-fallback design itself was the orchestrator's. Fixed here and in §4b's own comments. |
| MINOR 2 | v2 instructed reimplementing `parseDateOnly` inside `buildEditConfirmationDescription`'s helper note, duplicating a function that already exists in this exact file | **Landed.** Struck. `parseDateOnly` already exists, unexported, at `ScheduleMeetingsDialog.tsx:335` — call it directly; nothing about it changes. |
| MINOR 3 | v2's duplicate-`session_date` disclosure was incomplete/wrong for the "date not desired" case | **Landed.** Corrected in §4a: when the shared date IS still desired, `toUpdate`'s `Map` lookup silently favors one duplicate (unchanged claim). When the shared date is NOT desired, **both** duplicates independently pass `toRemove`'s array filter and both are removed — `toRemove` never went through the date-keyed `Map`, so v2's blanket "silently excluded from every list" claim was wrong for this branch. |
| MINOR 4 | The sixth `computeConfirmLabel` call site (the component's own internal render call) was never named, only "the internal render call" | **Landed.** Named explicitly: `ScheduleMeetingsDialog.tsx:599`, `const confirmLabel = computeConfirmLabel(sessionsPayload.length);` → `computeConfirmLabel(isEditMode, sessionsPayload.length)` — passes the real `isEditMode` value, not a literal `false` like the five test call sites. |
| MINOR 5 | `chicagoWallTimeToUtcIso` (existing, unmodified, reused as-is) is not round-trip-stable for wall times in `[02:00, 04:00)` on the March DST transition date | **Landed as a disclosed Known Risk**, not a fix — this task does not modify that pre-existing function. AC-B1 is scoped to exclude that window/date explicitly (§8). |
| MINOR 6 | v2's `startTime`/`endTime` derivation was not executable: `MeetingsList.tsx` (§4c) called `formatChicagoWallTime`, which §4a declared non-exported in `ScheduleMeetingsDialog.tsx` — a real `TS2614` | **Landed, cheaper path adopted.** `EditMeetingSeriesInitialData` no longer carries `startTime`/`endTime` at all. `resetForm()`'s edit branch derives them itself, inside `ScheduleMeetingsDialog.tsx`, from `initialData.sessions`, calling the same-file non-exported `formatChicagoWallTime` directly — no export needed, no cross-file call. |
| MINOR 7 | §9's citation of the MTG-02 field-order tripwire test used only a line range | **Landed.** Describe name added: `describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', …)`. |

**What round 2 confirmed clean — not reopened, per D015's own instruction not to churn it:** B1's
time-prefill round-trip fix (swept 366 days × 8 wall times, stable across both 2026 DST transitions,
outside the one narrow window MINOR 5 disclosed); B2's fully-past-series fix (introduces no create-mode
defect — create mode still cannot submit an empty series); B3's future-forward/duplicate-date
enforcement (verified against 11 adversarial inputs); the corrected fixture counts (3 and 3); Grant B's
five test call sites; the `readonly` type fix; the `AlertDialog` joined-string confirmation approach.

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
attributed to him.**

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
- `parseDateOnly` (`:335-338`) already exists in this file, unexported — reused directly by §4a's new
  code, never reimplemented (D015 disposition MINOR 2).

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
own words:** changing a session's date this way doesn't move it — the old date's row survives untouched
while a new row is inserted for the new date, so a single intended change produces two sessions. T510
must genuinely **drop** dates removed from the new schedule (rule 5), which is exactly the behavior
outreach's own module doc discloses as missing.

**Real schema**, `supabase/migrations/20260717000000_scheduling_attendance.sql`:
`event_sessions` (`:53-63`, `event_id … on delete cascade`, `session_date date not null`, `starts_at`/
`ends_at timestamptz not null`, `status … check (… 'scheduled','completed','canceled')`, `notes text not
null`); `rsvps` (`:67-76`, `session_id … on delete restrict`); `attendance` (`:82-95`, `session_id … on
delete restrict`); `events` (`:33-48`, `title`/`description`/`location_name`/`address text not null`,
`team_ids uuid[]` nullable = all teams). **`rsvps` is referenced by no foreign key anywhere under
`supabase/migrations/`** (D015's boss-verified premise — its own delete can never raise `23503`; only
the `event_sessions` delete can, from `attendance`'s or `rsvps`' own restrict FK against it). `rsvps`
carries `unique (session_id, student_id)` (`:75` — this is why capture-and-restore was rejected, D015
§2).

**`loaders/attendance.ts` has no time guard, which is why the race is reachable in ordinary use** (D015
boss-verified premise): zero occurrences of `starts_at`, `now(`, `new Date`, or `Date.now` in that file
— a coach can write attendance to a still-`'scheduled'`, still-future session from the LiveConsole at
any time, including while another coach is narrowing this series.

**The FK-restrict error-code convention already exists in this codebase**, fully qualified path:
`src/pages/roster/TeamsTab.test.tsx:1185-1195` proves the shape — a fake client whose `.delete().eq(...)`
resolves `{ data: null, error: { message: 'FK violation', code: '23503' } }`, asserting the mutation
**rejects** `.toMatchObject({ code: '23503' })`. `loader.ts`'s `runMutation`/`toLoaderError`
(`:116-121`, `:203-227`) turns that into a thrown `SupabaseLoaderError`; `isSupabaseLoaderError`
(`:125-133`) is the exported type guard.

**The "already happened" boundary reuses an established shape, not an import** —
`RsvpControl.tsx:320-329` (a different page, reimplemented locally per this file's own established
practice, e.g. its own `parseDateOnly`):
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
packet's design decision, not an owner ruling.

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
exists twice** — `OutreachList.tsx:1660-1665` and the identical `OutreachDetail.tsx:1449`
(`export function formatChicagoWallTime`), both `Intl.DateTimeFormat` `formatToParts` reads, tested at
`OutreachDetail.test.tsx:1178-1182`. §4a reimplements the identical function locally in
`ScheduleMeetingsDialog.tsx` (unexported — D015 disposition MINOR 6; it is called only from inside this
same file's `resetForm()`, never from `MeetingsList.tsx`).

**`AlertDialogProps` cannot render a list**: read directly from
`node_modules/@astryxdesign/core/dist/AlertDialog/AlertDialog.d.ts` — `description: string` (a plain
string prop, linked via `aria-describedby`), and `AlertDialogProps extends BaseProps<HTMLDialogElement>`
carries no `children` slot. The component renders `description` inside one `<Text>`. **§4a's
confirmation therefore builds one joined string**, not a child list.

**The batched-`.in()`-delete shape already exists** — `outreach.ts:1590-1597`:
```ts
const deleteRsvpsByIds = runMutation<readonly string[], void>(
  (client, ids) => client.from('rsvps').delete().in('id', [...ids]),
  getClient,
);
```
§4b reuses this exact shape for the **batched** parts of step 6 (a/c/e — the still-future guard, the
attendance pre-check, and the attendance-bearing cancel). **Step 6f is per-id, not batched** — see §4b
and D015 for why.

**`createLoader` already exists and must be used for the new read**: `loader.ts:159-179`,
`export function createLoader<TArgs, TData>(query, getClient)`. §4b's new session read is wrapped in
it, matching every other query in this file.

**Fixture literal counts**: exactly **3** hand-built `CoachMeetingRow` literals exist in
`MeetingsList.test.tsx` (the `pastOnlyRow` object starting `:844`, one more starting near `:928`, and
the `T511_ROW` fixture starting near `:2390`), and exactly **3** `FIXTURE_EVENTS`-shaped literals exist
in `MeetingsList.tsx` (`:766-800`: `event-weekly-build`, `event-ravens-strategy`, `event-food-drive`).
§4c's optional-field design (`teamIds?`, `description?`) exists specifically so none of these six
literals need editing.

**No existing test encodes the create-only insert behavior in a way that blocks this design** — it
must simply keep passing. The tests that must NOT be touched, identified by **name and content, not by
line range** (the T604 lesson — line ranges drift the moment this task inserts anything above them):
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

## 4. Design — additive types, one pure function, per-session-paired removal (D015)

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
 * `now` (a strict `>`, not `>=`, on THIS function's own condition). The
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
 * cross-page practice.
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
 * by a variable's name:
 *
 * 1. **A desired session whose own computed `startsAt` is not strictly
 *    after `now` is dropped before any matching happens** — regardless of
 *    what mode/range/weekday/date inputs produced it. (This is an
 *    application-level, in-memory filter — it is NOT the database-level
 *    guard; see §4b for why a second, independent, database-evaluated
 *    guard also exists for the destructive path.)
 * 2. **`toInsert` never creates a same-calendar-date duplicate of ANY
 *    existing session**, not only a reconcilable one. A desired date that
 *    coincides with an existing PAST session's date, or an existing
 *    already-`'canceled'`/`'completed'` future session's date, is silently
 *    absorbed: excluded from `toUpdate` (not reconcilable — protected) AND
 *    excluded from `toInsert` (a same-date row already exists), so no
 *    action is taken for that date at all. Disclosed, accepted
 *    simplification — no existing UI path can produce this collision.
 *
 * **Duplicate `session_date` among reconcilable sessions** — not possible
 * via any existing create-mode path today (`generateCustomSessionDates`
 * dedupes; `single`/`weekly` modes cannot repeat a date within one event),
 * so this is a disclosed limitation for whoever builds T605 next (per-
 * session date edits are where a genuine duplicate could first appear),
 * corrected here from an earlier draft that got the "date not desired"
 * branch wrong:
 *   - If the shared date IS still desired: `toUpdate`'s `Map`-keyed lookup
 *     (`reconcilableByDate`) silently picks ONE of the duplicates (last
 *     one inserted into the `Map` wins); the other is excluded from every
 *     list — neither updated nor removed, silently orphaned as a stale
 *     `'scheduled'` row.
 *   - If the shared date is NOT desired: `toRemove` is built by filtering
 *     the raw `reconcilable` ARRAY (never the date-keyed `Map`), so **both**
 *     duplicates independently satisfy the filter and **both** are removed.
 *   T605 must revisit this the moment per-session date edits make
 *   duplicates reachable.
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
  /** `readonly`, matching `FixtureEvent.teamIds`/`CoachMeetingRow.teamIds`'s own type (§4c) — a plain
   * `string[]` here produces a real `TS2322` at the `MeetingsList.tsx` call site. */
  teamIds: readonly string[] | null;
  locationName: string;
  description: string;
  /** The FULL session list (past + future + canceled) — the dialog itself filters to
   * `isMeetingSessionReconcilable` for pre-filling "Custom dates" AND for deriving `startTime`/
   * `endTime` (below); it does not trust a caller-side pre-filter, and `MeetingsList.tsx` supplies
   * none of the time derivation (D015 disposition MINOR 6 — `startTime`/`endTime` are NOT fields on
   * this interface; deriving them requires calling this file's own unexported `formatChicagoWallTime`,
   * which cannot cross a file boundary). */
  sessions: readonly ExistingMeetingSeriesSession[];
}

export interface SaveMeetingSeriesPayload {
  eventId: string;
  /** Reuses `CreateMeetingsEventPayload`'s shape. `address` is ALWAYS IGNORED by the update mutation
   * (§4b) — construct with `address: ''`, matching the create path's own existing default. */
  event: CreateMeetingsEventPayload;
  /** The coach's full desired FUTURE schedule, post schedule-mode computation. The loader does not
   * trust this to already be future-only (§4a's `computeMeetingSeriesReconcilePlan` re-derives it, and
   * §4b's destructive path re-derives it AGAIN at the database boundary). */
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

/** Reimplemented locally from `OutreachList.tsx:1660-1665`/`OutreachDetail.tsx:1449` (both named
 * `formatChicagoWallTime`), per this file's own cross-page-reimplementation convention.
 * DELIBERATELY NOT EXPORTED (D015 disposition MINOR 6): it is called only from this file's own
 * `resetForm()`, never from `MeetingsList.tsx` — `EditMeetingSeriesInitialData` carries raw
 * `startsAt`/`endsAt` timestamps, and the wall-time derivation happens entirely inside this file. */
function formatChicagoWallTime(isoDateTime: string): string {
  const parts = CHICAGO_24H_TIME_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}
// (CHICAGO_24H_TIME_FORMATTER: same `Intl.DateTimeFormat('en-US', { hour: '2-digit', minute:
// '2-digit', hourCycle: 'h23', timeZone: CHICAGO_TIME_ZONE })` shape as both existing copies.)

/** `AlertDialogProps.description` is a plain string with no `children` slot
 * (`node_modules/@astryxdesign/core/dist/AlertDialog/AlertDialog.d.ts`) — builds ONE joined string
 * satisfying rule 6: counts always; the actual removed dates listed, comma-joined, ONLY when
 * `plan.toRemove.length > 0`. Reuses this file's own existing `parseDateOnly` (`:335`) directly —
 * not reimplemented. */
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
// 'short', day: 'numeric', timeZone: 'America/Chicago' })`; `parseDateOnly` is the EXISTING function
// at `:335`, reused directly.)
```

**Deliberately NOT built:** the confirmation copy above does not distinguish "removed and deleted" from
"removed and canceled because attendance exists" — both mean "no longer appears as upcoming" to the
coach, and the distinction is accurate either way. Surfacing it would need a new field threaded onto an
existing, widely-fixture-literal'd exported type for a UI nuance the owner never asked for. **Do not
build this speculatively.**

**Component changes** (`ScheduleMeetingsDialog`/`ScheduleMeetingsDialogProps`):
- Add `initialData?: EditMeetingSeriesInitialData` and `onSaveMeetingSeries?: OnSaveMeetingSeriesFn =
  defaultOnSaveMeetingSeries`. `isEditMode = initialData !== undefined`.
- New local state: `description` (rendered **only when `isEditMode`** — create mode's Basics section
  stays byte-identical to today; `ScheduleMeetingsDialog.test.tsx`'s
  `describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', …)` (currently
  `:364-387`) is the tripwire and must stay green **unedited**).
- `resetForm()` branches on `initialData !== undefined`, mirroring `OutreachEventDialog.tsx:1016-1079`:
  present → `title`/`selectedTeamIds` (`initialData.teamIds !== null ? [...initialData.teamIds] :
  allTeamIds` — the `[...]` spread is required, `selectedTeamIds` state is `string[]`, `initialData
  .teamIds` is `readonly string[] | null`)/`location`/`description` from it directly; **`startTime`/
  `endTime` are DERIVED here, not read off `initialData`** (D015 disposition MINOR 6): find the
  earliest-`startsAt` session in `initialData.sessions.filter(s => isMeetingSessionReconcilable(s, new
  Date()))`; if one exists, `setStartTime(createISOTimeString(formatChicagoWallTime(that.startsAt)) ??
  DEFAULT_START_TIME)` and the equivalent for `endTime`/`endsAt`; if none exists (a fully-past series),
  fall back to this file's own existing `DEFAULT_START_TIME`/`DEFAULT_END_TIME` (`:314-315`). **Disclosed
  behavior for heterogeneous times** (not reachable via any existing UI path today, since
  `buildEventSessionsPayload` always applies one shared time to every date it generates — but not
  database-enforced, so state it anyway): saving without touching these fields writes every `toUpdate`
  row back with this SAME single derived time-of-day — a no-op for a series that already had one
  uniform time (§8 AC-B1, with its DST-window exception per MINOR 5), a normalizing write for one that
  somehow did not. `mode('custom')`; `customDates` seeded from
  `generateCustomSessionDates(initialData.sessions.filter(s => isMeetingSessionReconcilable(s, new
  Date())).map(s => s.sessionDate))` (reuses the ALREADY-EXPORTED, untouched `generateCustomSessionDates`);
  absent → the existing pristine-defaults branch, **byte-for-byte unchanged**.
- **`isValid`.** Today: `title.trim() !== '' && sessionsPayload.length > 0` (`:598`). **This makes
  "title/location/description always editable" (rule 2) impossible for a series with zero future
  sessions** — a fully-past series could never be saved at all, contradicting an owner-facing rule.
  **Fix: in edit mode, `isValid = title.trim() !== ''` — no session-count requirement.** Create mode's
  `isValid` is UNCHANGED. This deliberately ALSO permits narrowing an edited series down to zero future
  sessions in one save (every remaining future session moves to `toRemove`) — a coherent action, not a
  bug to guard against.
- Dialog title: `isEditMode ? 'Edit meeting series' : 'Schedule meetings'`.
- **`computeConfirmLabel` gains a leading required `isEditMode: boolean` parameter — SIX call sites
  change, not five** (D015 disposition MINOR 4): five in `ScheduleMeetingsDialog.test.tsx` gain a
  literal `false` (see §9 Grant B for the exact list), and the component's own internal render call,
  currently `ScheduleMeetingsDialog.tsx:599` (`const confirmLabel =
  computeConfirmLabel(sessionsPayload.length);`), changes to pass the REAL `isEditMode` variable —
  `computeConfirmLabel(isEditMode, sessionsPayload.length)` — not a literal `false`. Create-mode output
  stays pixel-identical: `computeConfirmLabel(false, 0) === 'Create 0 meetings'`, etc. Edit-mode
  output: the literal string `'Save changes'`, regardless of count (precedent: `StudentDialog.tsx:299`,
  `computeConfirmLabel('edit') === 'Save changes'`).
- A `TextArea` "Description" field (matching `OutreachEventDialog.tsx:1259-1261`'s own `label` wiring),
  rendered only when `isEditMode`.
- If `initialData.sessions` contains any session that is not `isMeetingSessionReconcilable`, render a
  short disclosure line, e.g. `${count} session(s) have already happened and are not affected by this
  edit.` — present only when that count is > 0.
- **Submit branches on `isEditMode`:**
  - `false` (create): **byte-identical to today.**
  - `true` (edit): build `desiredFutureSessions` via the SAME `computeScheduleSessionDates`/
    `buildEventSessionsPayload(dates, startTime, endTime, '')` used for create (`notes` fixed to `''`
    — per-session notes are T605's scope). Compute `const plan = computeMeetingSeriesReconcilePlan(
    initialData.sessions, desiredFutureSessions, new Date())`. **Do not call `onSaveMeetingSeries`
    yet.** Open an `AlertDialog` confirmation (add the import; cross-check props against
    `astryx-api.md`'s "AlertDialog" section) with `description={buildEditConfirmationDescription(plan)}`.
    Confirming triggers the real `onSaveMeetingSeries({ eventId: initialData.eventId, event: {...},
    desiredFutureSessions })` call, then `resetForm()` + close. Declining/closing returns to the form
    with all field state intact.

### 4b. New loader-side code in `loaders/meetings.ts` (additive; `makeCreateMeetings`/`createMeetings`
untouched) — **per-session-paired removal, D015**

```ts
interface EditableMeetingSessionDbRow {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: SessionStatus;
}

/** Routed through the existing `createLoader` seam, matching every other read in this file. */
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

/**
 * D015 MAJOR fix. The future-forward guard up to this point is
 * `computeMeetingSeriesReconcilePlan`'s own `now`-based filter, an
 * APPLICATION-level check. This query re-enforces the SAME invariant at
 * the DATABASE boundary using Postgres's own `'now'` timestamptz literal
 * (a string Postgres parses as "the current instant, evaluated when this
 * statement runs on the server" — NOT a client-computed `new Date()
 * .toISOString()`, which is still an app-clock value even though it is
 * accurate). Given a candidate id list, returns only the subset that is
 * STILL, right now (server time), strictly in the future. The result of
 * THIS query — not `plan.toRemove` directly — is what reaches the
 * destructive calls below.
 */
async function queryStillFutureSessionIds(
  client: SupabaseClient,
  candidateIds: readonly string[],
): Promise<LoaderQueryResult<FutureSessionIdDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id')
    .in('id', [...candidateIds])
    .gt('starts_at', 'now');
  return { data: (result.data as FutureSessionIdDbRow[] | null) ?? null, error: result.error };
}

interface AttendanceExistsDbRow { session_id: string; }

/** One batched read: given the (already `'now'`-guarded) candidate ids, returns which of them have at
 * least one `attendance` row. */
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
   `adult_volunteer_hours` are **never named** in the update's column set.
2. Load fresh sessions via `queryEditableSessionsForEvent(eventId)` (via `createLoader`) — fresh, not
   the page's stale in-memory rows.
3. Map to `ExistingMeetingSeriesSession[]`, call `computeMeetingSeriesReconcilePlan(existing,
   payload.desiredFutureSessions, new Date())` — a **fresh** `now`, independent of the dialog's
   confirmation-preview `now` (disclosed race, same non-atomicity class as this file's own existing
   "events insert succeeds, sessions insert fails" risk, `:115-121`).
4. `plan.toUpdate` → `Promise.all`-parallelized per-row updates of `starts_at`/`ends_at` **only**
   (matches `outreach.ts:1553-1559`'s own handling of per-row-DISTINCT-value updates — not batched,
   Postgrest cannot batch one statement into per-row-different values without an RPC).
5. `plan.toInsert` → one batched insert (`status: 'scheduled'`, `notes: ''`), same shape
   `makeCreateMeetings`'s own `insertSessions`.
6. **`plan.toRemove` → steps a-e BATCHED (unchanged from the design D015 preserved); step f PER-ID
   PAIRED (D015's ruled fix), only if `plan.toRemove.length > 0`:**
   a. `safeIds = await queryStillFutureSessionIds(plan.toRemove.map(r => r.sessionId))` — the D015
      MAJOR-fixed guard, `'now'` evaluated server-side.
   b. If `safeIds.length === 0`, stop here.
   c. `attendanceIds = new Set((await queryAttendanceExistsForSessions(safeIds)).map(r =>
      r.session_id))` — batched, one query for the whole `safeIds` set.
   d. `toCancel = safeIds.filter(id => attendanceIds.has(id))`; `toDelete = safeIds.filter(id =>
      !attendanceIds.has(id))`.
   e. If `toCancel.length > 0`: ONE batched `update event_sessions set status = 'canceled' where id in
      (:toCancel)` — RSVPs for these are NOT touched (Branch B, unchanged from v2).
   f. **If `toDelete.length > 0`, PER ID, as an independent pair (D015 §2, replacing v2's batched
      step f entirely):**
      ```ts
      async function removeOneSession(sessionId: string): Promise<void> {
        // f1 -- RSVPs first (the owner's own ordering). ANY error here means this pair's
        // session delete is never attempted, and the error propagates (the save rejects) --
        // never caught, never swallowed.
        await deleteRsvpsForSession(sessionId);
        try {
          // f2 -- the SAME 'now' guard chained directly onto the delete itself: even if a stale
          // id somehow reached this point, the delete affects zero rows for it rather than
          // deleting a session that is not (or no longer) strictly future.
          await deleteSessionIfStillFuture(sessionId); // .eq('id', sessionId).gt('starts_at', 'now')
        } catch (error) {
          if (isSupabaseLoaderError(error) && error.code === '23503') {
            // Attendance (or a fresh RSVP) raced in between the batched pre-check (c) and THIS
            // id's own delete -- cancel THIS id only. If this cancel itself throws, it
            // propagates (never swallowed).
            await cancelSession(sessionId); // .eq('id', sessionId), no batching
          } else {
            throw error;
          }
        }
      }

      // Cross-pair sequencing: PARALLEL. Pairs touch disjoint rows and are independent (D015 §2
      // explicitly sanctions this choice). Consequence, disclosed: if one pair rejects,
      // `Promise.all` rejects (the save rejects) while sibling pairs already in flight may still
      // complete their own mutations against the database -- the same disclosed non-atomicity
      // class this file already carries for "events insert succeeds, sessions insert fails."
      await Promise.all(toDelete.map((id) => removeOneSession(id)));
      ```
   **An equivalent `starts_at`-guarded delete on `rsvps` is impossible to express over PostgREST**
   (D015 MAJOR disposition, stated so no reader goes hunting for it): `rsvps` has no `starts_at` column
   of its own, and PostgREST has no mechanism to filter a `DELETE` by a column on a different,
   embedded/joined table. The protection for `rsvps` comes entirely from `safeIds` already having
   passed the `'now'`-guarded query in step a before step f ever runs.

**The residual, disclosed exactly as D015 states it — a limitation, not a deferred defect (no item-20
ledger row required):** if attendance (or a fresh RSVP) lands in the sub-second window between step c's
batched pre-check and that ONE session's own step-f2 delete, that session ends `'canceled'` with its
own RSVPs already deleted by its own f1. This is bounded to **at most the one raced session** — never
the whole `toDelete` batch — and it satisfies the owner's own fallback ruling verbatim ("the delete
must fall back to cancelling rather than failing the coach's save"). **This MUST appear in the worker's
Known Risks output**, not just in this packet.

`export const saveMeetingSeries: OnSaveMeetingSeriesFn = makeSaveMeetingSeries();`

### 4c. `MeetingsList.tsx` wiring

- `CoachMeetingRow` (`:671-678`) gains **two optional** fields (optional so the 3 existing hand-built
  `CoachMeetingRow` literals need no mechanical edit): `teamIds?: readonly string[] | null;` and
  `description?: string;`.
- `FixtureEvent` (`:592-603`) gains `description?: string;` (optional — the 3 existing `FIXTURE_EVENTS`
  literals, `:766-800`, need no edit).
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
  sessions: editTarget.sessions.map(s => ({ sessionId: s.sessionId, sessionDate: s.sessionDate,
  startsAt: s.startsAt, endsAt: s.endsAt, status: s.status })) } : undefined`. **No `startTime`/
  `endTime` field is constructed here** (D015 disposition MINOR 6 — `MeetingsList.tsx` never calls
  `formatChicagoWallTime`; that derivation lives entirely inside `ScheduleMeetingsDialog.tsx`'s own
  `resetForm()`, §4a).
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
  and their test files. **`loaders/attendance.ts` is Forbidden even though §2 cites its missing time
  guard** — that guard's absence is out of this task's scope; D015's fix is entirely on the T510 write
  path, not on attendance-writing.
- `src/pages/outreach/**` and its loaders — read-only precedent only.
- `src/lib/supabase/loaders/outreach.ts`, `endMeeting.ts`, `attendance.ts`, `students.ts`, `client.ts`,
  `loader.ts` (import from `loader.ts`; do not edit it), `src/lib/supabase/types.ts`.
- `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`, `docs/swarm/constitution.md`,
  `docs/swarm/dispute-log.md`, `docs/swarm/auto-mode-decisions.md`, `.claude/agents/`,
  `.claude/skills/`, `.claude/settings.json`.
- Any other file in `src/` not listed in §5.

## 6. Rules (constitution)

Item 10 — no migration is touched. Item 20 — genuine out-of-scope defects go in your output doc as a
named follow-up (the residual race in §4b is a disclosed limitation per D015, NOT an item-20 deferral —
do not file it as one). Item 21 — completion report states a commit SHA. Item 22 — stage named paths
only. Item 23 — mutation experiments run in your own worktree. Non-Negotiables — existing tests pass
unless explicitly approved (§9 names the one exception and its exact authorized bounds); no
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

- **AC1 — additive-only guarantee, correct count.** `git diff` on `ScheduleMeetingsDialog.tsx` shows no
  changed line inside the existing `CreateMeetingsEventPayload`, `CreateMeetingsSessionPayload`,
  `CreateMeetingsPayload`, `OnCreateMeetingsFn`, `defaultOnCreateMeetings` declarations.
  `computeConfirmLabel` gains a leading required `isEditMode: boolean`. **Six call sites change, not
  five**: the five named in §9 Grant B (each gains a literal `false`) plus the component's own internal
  render call at `ScheduleMeetingsDialog.tsx:599`, which gains the real `isEditMode` variable, NOT a
  literal `false` — a test asserting `:599`'s call site passes a hardcoded `false` is itself wrong.
  **Zero asserted strings change.**
- **AC-B1 — heterogeneous-time no-op proof, scoped correctly.** Open edit on a series whose
  reconcilable future sessions all share one time-of-day, on dates OTHER than a March DST transition
  date and at times OUTSIDE `[02:00, 04:00)` local. Save with no schedule change. Assert every
  `toUpdate` row's `starts_at`/`ends_at` represents the **same instant** as its pre-save value —
  compare via `new Date(a).getTime() === new Date(b).getTime()`, not literal string equality (this
  repo's own fixtures happen to use the `.000Z` suffix consistently, but a real PostgREST response
  returns `+00:00`; pin the intent, not the string form). **Do not extend this proof to sessions dated
  on the DST transition date with a time in `[02:00,04:00)`** — see Known Risks; that combination is a
  disclosed, out-of-scope exception, since it exercises a pre-existing, unmodified conversion function
  this task does not touch.
- **AC-B2a — fully-past series stays editable.** `initialData` with zero `isMeetingSessionReconcilable`
  sessions and a nonempty title → the confirm button is enabled (`isValid` true).
- **AC-B2b — narrowing to zero is permitted.** `initialData` with reconcilable future sessions; save
  with an empty desired schedule → `isValid` stays true, `plan.toRemove` contains every reconcilable
  session, `plan.toInsert`/`toUpdate` are empty, and the save completes.
- **AC-B3a — a desired date matching an existing PAST session is absorbed, not inserted.**
- **AC-B3b — a desired date matching an existing CANCELED future session is absorbed, not inserted.**
- **AC-B3c — a desired session whose own `startsAt` is not strictly future is dropped before matching.**
- **AC-Bdup — duplicate `session_date`, both directions, corrected per D015 disposition MINOR 3:** two
  reconcilable sessions sharing one `sessionDate` where that date IS still desired → exactly one
  appears in `toUpdate`, the other in neither list. Two reconcilable sessions sharing one `sessionDate`
  where that date is NOT desired → **both** appear in `toRemove`.
- **AC2 — `isMeetingSessionReconcilable` boundary.** A `'scheduled'` session with `startsAt` exactly
  equal to `now` → `false` (the function's own condition is strict `>`; the protection boundary this
  produces is the non-strict `>=`). One millisecond in the future → `true`. `'canceled'` with a future
  `startsAt` → `false`.
- **AC3/AC4/AC5 — core reconcile behavior**: a reconcilable session whose date persists → `toUpdate`;
  one whose date is dropped → `toRemove`; a desired date with no existing match of any status →
  `toInsert`.
- **AC6 — past sessions never touched.**
- **AC7 — already-canceled sessions never touched** (this packet's own design decision — do not cite
  the owner's "regardless of status" words for this specific exclusion).
- **AC8 — partial `events` update.** The `.update({...})` argument object has **exactly** the keys
  `title`, `team_ids`, `location_name`, `description`.
- **AC9 — the D015-ruled per-session-paired removal sequence, every branch proven with a fake client**
  (mirror `src/pages/roster/TeamsTab.test.tsx:1185-1195`'s exact shape; sequencing is PARALLEL per §4b
  — align assertions accordingly):
  - **Branch A (clean, at least two ids, no attendance):** for EACH id independently, that id's OWN
    `rsvps.delete().eq('session_id', X)` call happens strictly before that SAME id's OWN
    `event_sessions.delete().eq('id', X)` call; no `event_sessions.update` call for either.
  - **Branch B (unchanged, batched):** `queryAttendanceExistsForSessions` returns an id →
    `event_sessions.update({ status: 'canceled' })` is called for it (batched, may include other
    `toCancel` ids); `rsvps.delete` is NEVER called for it.
  - **Branch C (unchanged, batched):** an id absent from `queryStillFutureSessionIds`'s result never
    reaches any subsequent delete/cancel/attendance-check call.
  - **Branch D — THE LOAD-BEARING ASSERTION, rewritten per D015, at least TWO pairs in flight:**
    session X's `event_sessions.delete()` rejects `{ code: '23503' }`; session Y's resolves cleanly.
    Assert, ALL of: (i) X receives `event_sessions.update({ status: 'canceled' }).eq('id', X)` and X
    ONLY (not Y, not a batch call covering both); (ii) Y's `event_sessions.delete().eq('id', Y)` is
    genuinely called and Y receives **no** update call; (iii) Y's `rsvps.delete().eq('session_id', Y)`
    is its own independent call, made regardless of X's outcome; (iv) at **no point** does any
    `event_sessions.update` call target both X and Y together (no `.in('id', [X, Y])` cancel); (v) the
    overall `saveMeetingSeries(...)` promise **resolves**. This is the assertion v2's Branch D lacked —
    Y's fate must be proven independent of X's failure, not merely that the overall call "succeeded."
  - **Branch E:** a non-`23503` error on EITHER half of any pair (its `rsvps` delete or its
    `event_sessions` delete) → the overall promise **rejects**. Given parallel sequencing, a sibling
    pair may have already completed its own mutations before the rejection surfaces — assert the
    rejection itself, not the absence of sibling side effects.
- **AC10 — the "already happened" disclosure, both directions.**
- **AC11 — confirmation, pure-addition case.** No "Removed:" segment when `toRemove.length === 0`.
- **AC12 — confirmation, removal case.** "Removed:" followed by each removed date, human-readable.
- **AC13 — Edit opens the real dialog, prefilled** — see §9 Grant A.
- **AC14 — dead code removed.** `grep -rn "StubNotice\|StubBanner\|showEditStub\|stubNotice"
  src/pages/meetings/MeetingsList.tsx` returns zero matches.
- **AC15 — create path unchanged, frozen by NAME, not line range** (the four tests/describe blocks
  listed in §2's last bullet list, all passing without modification to their assertions).
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

**Grant B — `computeConfirmLabel`'s call sites in the TEST FILE: five** (packet §4a/AC1) — `:353`,
`:354`, `:355`, `:356` (the BEH-07 describe block) and **`:480`** (inside the Weekly-recurring test,
invisible to a describe-block-shaped search). **Exactly five call sites in
`ScheduleMeetingsDialog.test.tsx` gain `false` as a new leading argument. Zero asserted strings
change.** (A **sixth** site exists in the component itself, `ScheduleMeetingsDialog.tsx:599` — not
covered by Grant B since it is not a test-file edit; it gains the real `isEditMode` value, per §4a/AC1.)

**Explicitly NOT authorized:** deleting the stub test without Grant A's replacement; any edit to
`describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', …)` (currently
`ScheduleMeetingsDialog.test.tsx:364-387` — the MTG-02 field-order tripwire; it goes red only if
Description leaks into create mode, and the fix is then the code, never the test); any edit to the
create-path tests §2/§8 AC15 freezes; any other existing-test modification anywhere. **If a worker
believes one is forced, it stops and files a dispute citing this entry** — it does not reason its way
to "obviously also covered."

## Known Risks (must also appear in the worker's own output doc)

1. **The D015 residual race**, stated exactly as the ruling states it: attendance (or a fresh RSVP)
   landing in the sub-second window between the batched attendance pre-check and one specific session's
   own paired delete leaves that ONE session `'canceled'` with its own RSVPs already deleted. Bounded to
   at most one session per save, never the whole batch. This is the owner's own ruled fallback outcome,
   disclosed as a limitation — not an item-20 deferral.
2. **`chicagoWallTimeToUtcIso` DST edge case** (existing, unmodified function, reused as-is): not
   proven round-trip-stable for wall-clock times in `[02:00, 04:00)` local on the calendar date of the
   March DST spring-forward transition (2026: March 8). If a series' derived start/end time falls in
   that window and a future session lands on that exact date, saving without touching the time fields
   can rewrite that session's stored `starts_at`/`ends_at` to a different instant than before, even
   though the intent was a no-op. Fixing the underlying function is out of this task's scope (it is
   shared, pre-existing, and used elsewhere unmodified) — AC-B1 is scoped to exclude this case rather
   than claim unconditional stability.
3. **Confirmation-preview vs. real-save race** (disclosed, §4b step 3): the dialog computes its
   confirmation preview against `now` at open/submit time; the loader re-derives everything against a
   fresh `now` at actual-save time. A long-idle confirmation dialog could see a slightly different
   outcome than what was shown.
4. **Cancel-vs-delete distinction not surfaced in the confirmation copy** (deliberate, §4a) — both
   outcomes read as "no longer upcoming" to the coach; building the distinction was declined as
   speculative scope growth.
5. **Duplicate `session_date` among reconcilable sessions** (§4a) — not reachable via any existing UI
   path today; disclosed for T605's attention since per-session date edits could make it reachable.

## Required Worker Output (`docs/swarm/active/T510-worker-output.md`)

- Files changed (exact list, matching §5).
- Confirmation that `CreateMeetingsPayload`'s family is byte-identical (AC1), with the diff excerpt.
- Every new/changed exported symbol's final signature.
- Every command from §7/§8 run directly, with real captured exit codes and outputs.
- The AC9 fake-client test's actual mock call sequence for all five branches (A-E), with Branch D's
  independence assertions (§8) called out explicitly.
- Baseline SHA and before/after lint warning count + vitest file/test totals against it.
- Commit SHA (item 21) and confirmation of explicit pathspecs (item 22).
- Confirmation that the Grant A replacement test satisfies all six numbered properties, and the
  mutation used for property 6.
- Any genuine out-of-scope defect found, named as a follow-up per item 20 — **the D015 residual race
  and the DST edge case are NOT such a follow-up; they are disclosed limitations already ruled/scoped,
  restate them in Known Risks, do not file them as new deferrals.**
- Known risks: all five items above, restated with your own verification evidence.
