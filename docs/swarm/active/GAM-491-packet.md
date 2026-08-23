# GAM-491 — worker packet (STANDARD)

Orchestrator-authored, repository-verified. Every citation below was read
against `5bf0cb78` (`origin/main`, the merge of GAM-452's PR #242) during this
run — not copied from the issue. Where the issue and the repository disagree,
this packet states the repository's answer and says so.

**Tier: STANDARD** with a required acceptance checker. Defence is in the Linear
claim comment (`GAM-491`, `comment-3863a292`) and in
`docs/swarm/active/GAM-491-pr-body.md`.

---

## 1. The measured defect

`SchedulePanel` is mounted at `src/pages/meetings/coach/CoachMeetingsView.tsx:760`
with `eventId`, `sessions`, `focusRequest`, `overlapIndex`, `onCancelSession`,
`onSetAttendanceStatus`, `onClearAttendance`, `recordedBy`, `onEditSession`,
`canEditSession` and `canSetExcused` — and **no `roster`, no `isRosterLoading`,
no `rosterError`** (verified: those three names do not appear in the mount
block, `:760-790`).

With `roster` undefined, `SessionRow.tsx:368` takes the
`if (!roster || roster.length === 0)` branch and returns the `EmptyState`
titled **"No roster recorded"**, so `AttendanceChips` never mounts. Every
session row on the redesigned coach page therefore reads "No roster recorded"
and no coach can mark anyone present.

Nothing in `src/lib/**` produces
`ReadonlyMap<string, readonly SessionRosterEntry[]>`. The two roster-ish
loaders build different shapes for different surfaces:
`loaders/endMeeting.ts:339` (`EndMeetingRosterEntry`) and
`loaders/kiosk.ts:460` (`LiveConsoleRosterEntry`) — both `{ studentId, name }`,
neither carrying per-student status.

**This ticket supplies only the read side.** The write seams
(`setAttendanceStatus` / `clearAttendanceStatus`,
`src/lib/supabase/loaders/attendance.ts`) and the coach's real `recordedBy`
(`user?.id`, `CoachMeetingsView.tsx:768`) are already connected and are
Forbidden Files here.

## 2. What the issue got wrong, corrected here

1. **`SessionRow.tsx:50` / `:253` / `:368-375` and `SchedulePanel.tsx:208-215`
   are approximately right but not exact on the current tree.** The live
   numbers are: `SchedulePanel.tsx:178` (`SessionRosterEntry`), `:209-215`
   (`roster` / `isRosterLoading` / `rosterError`), `SessionRow.tsx:181-190`
   (`buildInitialStatusMap`), `SessionRow.tsx:368-384` (the empty state).
   Use these; do not re-cite the issue's.
2. **`SchedulePanel.test.tsx:285-295` is the right region but the matchers are
   not what the issue implies.** They are a source-text grep on
   `SchedulePanel.tsx` only — `not.toContain('.from(')`, `'.upsert('`,
   `'.update('`, `'.insert('`, `'.delete('`, `'getSupabaseClient'`,
   `'makeOnEditAttendance'`. **`SchedulePanel.tsx` is a Forbidden File in this
   packet**, so these cannot break — but do not add a Supabase import to it in
   any circumstance.

## 3. The finding that decides this packet's correctness

**`makeLoadAttendanceForSessions` does NOT filter GAM-479's `'unmarked'`
sentinel, and it is the only attendance read in this directory that does not.**

- `attendance.ts:236` declares `UNMARKED_DB_STATUS = 'unmarked'`, the status a
  *cleared* mark is stored as (`clearAttendanceStatus` writes the sentinel; it
  is **not** a delete — `supabase/migrations/20260822000000_attendance_unmarked_sentinel.sql`).
- `attendance.ts:224-231` states the invariant: `'unmarked'` is a **storage**
  state, never an application state, and "every read in this directory filters
  it out", so above the loader boundary a cleared row is indistinguishable from
  no row at all. `excludeUnmarked` (`attendance.ts:267`) is that filter.
- `checkin.ts:322`, `coachHome.ts:344`, `dashboard.ts:565`, `kiosk.ts:251`,
  `meetings.ts:509` and `meetings.ts:552` all call it.
- **`queryAttendanceForSessionsPage` (`attendance.ts:391-402`) does not.** It
  `.select('*')` and returns the rows raw;
  `mapAttendanceDbRowToAttendanceRow` (`:308-322`) copies `row.status` straight
  through into `AttendanceRow.status`, whose declared type is
  `AttendanceStatus` (`:282`) — a four-value union that does not contain
  `'unmarked'`.

So `makeLoadAttendanceForSessions` can hand you a row whose `status` is
`'unmarked'` while the type says it cannot be. If this loader passes that value
into `SessionRosterEntry.status`, a student whose mark a coach *cleared* comes
back looking marked-with-an-unknown-value rather than `(unset)` — the exact
class of "materially misrepresent a user's own persisted records" the
constitution grades hardest.

**This packet's loader must map `'unmarked'` to `null` itself** (criterion 4),
and must not rely on the upstream filter. Do not edit `attendance.ts` to fix it
there — that file is Forbidden and the change would touch four other consumers.
The orchestrator files the upstream gap as an item 20 follow-up.

## 4. Allowed files

| Path | Status |
| -- | -- |
| `src/lib/supabase/loaders/sessionRoster.ts` | **new** |
| `src/lib/supabase/loaders/sessionRoster.test.ts` | **new** |
| `src/pages/meetings/coach/CoachMeetingsView.tsx` | edit |
| `src/pages/meetings/coach/CoachMeetingsView.test.tsx` | edit |

## 5. Forbidden files — non-exhaustive, but these are named

`src/pages/meetings/coach/SchedulePanel.tsx`, `SessionRow.tsx`,
`AttendanceChips.tsx` and their test files; `src/lib/meetings/types.ts`;
`src/lib/supabase/loaders/attendance.ts`, `endMeeting.ts`, `kiosk.ts`,
`meetings.ts`; `supabase/migrations/**`; `.github/workflows/**`;
`.claude/**`; `docs/swarm/**`; `AGENTS.md`. **Do not create a migration, an RLS
policy, or a SQL view.** If the work appears to need one, stop and escalate —
that makes the task HEAVY on its own (§9).

## 6. Contracts and consumers

Frozen, read but never reshaped:

- `SessionRosterEntry` — `SchedulePanel.tsx:178`:
  `{ studentId: string; displayName: string; status: AttendanceStatus | null }`.
  Import it **type-only** from `'../../../pages/meetings/coach/SchedulePanel'`.
  Its own doc: `status: null` means no attendance row exists yet, and
  `displayName` is "already first-name + last-initial shortened by whoever
  builds this map (item 6) — this component tree never re-derives it from a
  full name." **Building that shortened name is this loader's job.**
- `SchedulePanelProps.roster` — `SchedulePanel.tsx:209`:
  `ReadonlyMap<string, readonly SessionRosterEntry[]>`, keyed by `sessionId`.
  `isRosterLoading?: boolean` (`:211`), `rosterError?: string` (`:213`).
- `AttendanceStatus` — `src/lib/meetings/types.ts:55`,
  `'present' | 'late' | 'excused' | 'absent'`.
- `CoachMeetingRow` — `types.ts:108`, has `eventId` and `sessions`.

Reused, not rebuilt:

- `createLoader`, `LoaderQueryResult` from `'../loader'`;
  `getSupabaseClient` from `'../client'` — the injectable-`getClient`
  convention every module in `loaders/` follows.
- `makeLoadAttendanceForSessions`, `UNMARKED_DB_STATUS` from `'./attendance'`.
- `endMeeting.ts:255-345` is the **model to copy** for the queries: the
  `events`/`event_sessions`/`students` selects, the
  `teamIds === null || teamIds.includes(student.team_id)` scoping rule, and the
  `Promise.all` of the two independent reads.

## 7. What to build

### 7a. `src/lib/supabase/loaders/sessionRoster.ts`

```ts
export type LoadSessionRosterFn = (
  eventId: string,
) => Promise<ReadonlyMap<string, readonly SessionRosterEntry[]>>;

export function makeLoadSessionRoster(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadSessionRosterFn;

export const loadSessionRoster: LoadSessionRosterFn = makeLoadSessionRoster();
```

Behaviour:

1. Read `events.team_ids` for `eventId` (`.select('id, team_ids').eq('id', eventId).maybeSingle()`).
   Not found → **reject** with a plain `Error` naming the id, matching
   `endMeeting.ts`'s documented choice for a non-nullable return type.
2. Read this event's session ids:
   `.from('event_sessions').select('id').eq('event_id', eventId)`.
   Zero sessions → resolve an **empty `Map`**, and issue no attendance query
   (`makeLoadAttendanceForSessions` already short-circuits `[]`, but do not
   depend on that for the students query either).
3. Read active students: `.from('students').select('id, display_name, team_id').eq('is_active', true)`.
4. Read attendance via `makeLoadAttendanceForSessions(sessionIds)`.
   Steps 3 and 4 are independent — run them under one `Promise.all`, as
   `endMeeting.ts:337` does.
5. Scope the roster: keep a student when `teamIds === null || teamIds.includes(student.team_id)`.
6. Build the map: **one entry per (session, in-scope student)** — every session
   id from step 2 gets a key, even when no attendance row exists for it, so
   `status` is `null` rather than the session being absent from the map.
7. `status` resolution, in this order: the student's attendance row for that
   session if one exists **and** its `status !== UNMARKED_DB_STATUS`; otherwise
   `null` (§3).
8. `displayName` = first name + last initial, derived from
   `students.display_name` — see 7b.
9. Order each session's entries by `displayName`, then `studentId`, so the
   rendered roster is stable across loads (`SessionRow`'s roving-tabindex
   `focusedRowIndex` is positional).

### 7b. The name rule (constitution item 6) — BLOCKER if wrong

**No full last name may ever leave this loader.** There is no shared helper on
`main`; two independent private copies exist and are the precedent:

- `src/pages/outreach/Leaderboard.tsx:365-375` (`formatDisplayName`) — exported,
  but **do not import it**: it takes an `isPrivacyOn` flag and returns the
  fixed string `'Anonymous student'` when false, which is the wrong semantics
  here and would couple this loader to a leaderboard setting.
- `src/pages/meetings/student/StudentMeetingsView.tsx:44-48`
  (`firstNameLastInitial`) — module-private, cannot be imported.

Write a small module-private function in `sessionRoster.ts` with the same rule,
and cite both precedents in its doc comment:

- trim, split on `/\s+/`, drop empty parts;
- zero parts → `'Student'` (a non-identifying fallback; never an empty string,
  which would render a nameless row);
- one part → that part alone (never fabricate an initial);
- otherwise → `` `${first} ${last.charAt(0).toUpperCase()}.` ``.

### 7c. `CoachMeetingsView.tsx` wiring

- Add to `CoachMeetingsViewProps`:
  `loadSessionRoster?: LoadSessionRosterFn`, defaulting in the destructure to
  the real `loadSessionRoster` singleton — the identical additive-optional
  injectable convention `onSetAttendanceStatus = setAttendanceStatus` already
  uses at `:390`. Do **not** make it required: `MeetingsList.tsx:173` is a
  Forbidden File and must not need an edit, and `CoachMeetingsView.test.tsx`'s
  existing mounts must keep compiling.
- At most one series is expanded at a time — `isSelected` is
  `focus !== null && focus.eventId === row.eventId` (`:717`) — so one piece of
  state suffices. Load when the focused `eventId` changes; do not load on
  mount for unexpanded rows.
- Track three things and pass them straight through to `<SchedulePanel>`
  (`:760`): `roster`, `isRosterLoading`, `rosterError`.
  - While in flight: `isRosterLoading` true.
  - On rejection: `rosterError` set to a human sentence. Use
    `isSupabaseLoaderError` (already imported at `:65`) to prefer the
    normalized message, and fall back to a fixed string otherwise. Never leak a
    raw stack.
  - Guard against a stale response overwriting a newer one (a `mounted` /
    request-token guard — `useLoadState` at `:657` is the in-file precedent).
- **Do not reload the roster after a chip write.** `SessionRow` keeps its own
  optimistic `statusById` (`:239-244`); a reload would fight it.
- Do not touch the write props, `recordedBy`, `canSetExcused`,
  `canEditSession`, or anything else in the mount block.

## 8. Acceptance criteria — every one measurable today

1. `sessionRoster.ts` exports `makeLoadSessionRoster`, `loadSessionRoster` and
   `LoadSessionRosterFn`, and takes an injectable `getClient` defaulting to
   `getSupabaseClient`.
2. The returned map has **one key per session id of the event**, including
   sessions with zero attendance rows.
3. A student with no attendance row for a session appears in that session's
   entries with `status: null`.
4. **A student whose attendance row has `status: 'unmarked'` appears with
   `status: null`**, not `'unmarked'` (§3). Test this with a fixture row
   carrying the sentinel.
5. A student with a real row appears with that exact
   `'present' | 'late' | 'excused' | 'absent'`.
6. Team scoping: with `events.team_ids = ['team-a']`, only `team_id === 'team-a'`
   students appear; with `team_ids = null`, all active students appear.
   `is_active = false` students never appear.
7. **No `displayName` in the returned map contains a full last name.** A
   fixture student named `Jordan Rivera` yields `Jordan R.`; `Cher` yields
   `Cher`; `''` yields `Student`.
8. An event with zero sessions resolves an empty map without throwing.
9. An unknown `eventId` rejects with an `Error` naming the id.
10. `CoachMeetingsView` renders `<SchedulePanel>` with `roster`,
    `isRosterLoading` and `rosterError` supplied, sourced from
    `loadSessionRoster` — **the real loader by default**, not a fixture
    (constitution item 27: the criterion is the connection, not the render).
11. Expanding a series triggers exactly one `loadSessionRoster(eventId)` call
    for that event; collapsing and re-expanding a *different* series loads that
    one. Unexpanded rows load nothing.
12. A rejected load puts a message on `rosterError` and does not throw into the
    render tree; the panel's DES-12 error state is what the user sees.
13. `SchedulePanel.tsx`, `SessionRow.tsx`, `AttendanceChips.tsx`,
    `types.ts` and `attendance.ts` are **byte-identical** to `origin/main` in
    the final diff.
14. No new dependency; no file created under `supabase/migrations/`.

## 9. Escalation conditions — stop and report, do not improvise

- The roster genuinely needs a new SQL view, RLS policy, or migration.
- The only way to satisfy a criterion is to edit a Forbidden File.
- `students`, `events` or `event_sessions` turns out not to carry a column this
  packet names.

Any of these makes the task HEAVY on the constitution's own triggers and it
must come back to the orchestrator rather than be worked around.

## 10. Named deterministic tests and the mutation

Tests: `src/lib/supabase/loaders/sessionRoster.test.ts` (criteria 1-9) and
additions to `src/pages/meetings/coach/CoachMeetingsView.test.tsx`
(criteria 10-12). Follow `endMeeting.test.ts`'s hand-rolled query-builder stub
convention — **no real network calls**, and note `attendance.ts:243-250`'s
warning that these fakes are passthroughs that record arguments rather than
filter, which is exactly why criterion 4 must be asserted on the mapping and
not on a `.neq` clause.

**The named mutation (orchestrator replays it):** in `sessionRoster.ts`, delete
the `'unmarked'` guard so the sentinel maps straight through. The criterion-4
test must go **red**, naming `'unmarked'` where `null` was expected. Restore,
re-run green.

## 11. Repository gates

All six, via the `gate-run` skill, exit codes recorded verbatim: `tsc`,
`vite build`, `format:check`, `eslint`, the full `vitest` suite, and a scoped
`vitest` run over the two touched test files.

## 12. Verification ownership

The worker does **not** self-certify. A `checker-reviewer` inspects the
committed SHA, replays the §10 mutation and runs the §11 gates; the
orchestrator integrates. Report your commit SHA (item 21) — "clean" is not
"committed".
