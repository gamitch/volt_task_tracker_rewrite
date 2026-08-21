# GAM-446 task packet — revision 3 (GATED: `checker-premise` returned DISPATCH)

## Read first

`.claude/skills/meetings-design/SKILL.md` — mandatory before writing anything
under `src/pages/meetings/**` or `src/lib/meetings/**`, both of which are in
Allowed Files below. Also read the `gate-run` and `mutation-replay` skills;
this packet's evidence requirements are theirs.

**Reconciling §2 with that skill, because a checker will grade you against
it.** The skill's frozen-types table lists `CoachMeetingRow` and says *"Do not
reshape a frozen type to fit your component … do not widen it locally."*
Adding OPTIONAL fields is **not** what that sentence forbids, and this is
pre-approved rather than left for you to argue:

- "Widen" in this wave means *re-typing an existing field* — GAM-444's packet
  uses it that way twice (`:183`, `:429-430`).
- There is shipped precedent for additive-optional extension of **this exact
  interface**: `types.ts:115-122`, where T510 added `teamIds?` and
  `description?` precisely because optionality leaves every existing literal
  valid.
- `SeriesCardModel` is **not** touched. GAM-447's "do not add fields" was
  scoped to its own file grant, not a global ruling.
- Measured by the premise gate: `tsc --noEmit` exit 0 and 2633/2633 green with
  exactly these five fields applied.

**Tier: HEAVY.** Base `3d27d8a` (`origin/main`). Branch
`claude/gam-446-coach-card-loader-data`.

Revision 1 went to `checker-premise` and came back **REVISE** with 2 BLOCKERs
and 4 MAJORs. It found that **two of this ticket's three deliverables rest on
premises that do not hold**. Revision 2 cuts both, keeps the one that survives,
and files the cut work as its own rows. Every finding below was *measured* by
the gate — it built a worktree, applied revision 1's own prescription, and ran
the suite.

## What this ticket now builds, and what it no longer builds

| Issue deliverable | Revision 2 |
| -- | -- |
| Per-event attendance % from `v_event_attendance` | **BUILD** — premise sound |
| Per-series roster size / expected rosters | **CUT** — no PRD authority, no data on `main`, already ruled off the card |
| `listGuardianChildren(viewer)` | **CUT** — it already exists as `loadLinkedStudents` |

### Why the roster count is cut (gate findings 2, 3, 5, 6)

1. **No authority.** MTG-01a (`docs/swarm/VOLT_Portal_PRD.md:303-313`) lists the
   series card's contents exhaustively — title and team scope, schedule chips,
   season progress, attendance %, next-session line. **No roster count.**
2. **The consuming ticket was already told not to render it.** GAM-447's packet
   §3a: *"The issue asks for a supporting line 'location · team scope · N on
   roster' … Build MTG-01a's card from the fields that exist … Do not add
   fields."*
3. **The data is not there.** `student_teams` has **no writer on `main`** —
   its writer is PR #192 / GAM-340, still open. Students added since the
   `20260721` backfill have no membership row, and GAM-391 records a second
   broken population (re-teamed students holding an active row for the team
   they left). `rosterCt` would read "3 on roster" for a 12-student team —
   item 26's "lie to a user about their own data", exactly.
4. **It would break DATA-01.** The active-roster predicate already exists in
   SQL three times (`kpi_views.sql:252-257`,
   `met01_explicit_marks.sql:109-116`, `dashboard_views.sql:203-210`), and
   `v_team_kpis.active_students_count` is the figure any new count must agree
   with. Re-deriving it in TypeScript is a BLOCKER under constitution item 3.

→ Filed as **GAM-471** (Backlog, `tier/unreviewed`), blocked on GAM-340, rather than built here.

### Why `listGuardianChildren` is cut (gate finding 4)

`src/lib/supabase/loaders/checkin.ts:517-547` already exports
`makeLoadLinkedStudents` / `loadLinkedStudents`, returning
`LinkedStudentSummary[]` = `{ studentId: string; displayName: string }` —
**byte-identical to the shape this issue asked for**. It reads
`guardian_links.select('student_id').eq('parent_profile_id', …)
.order('created_at', { ascending: true })` with **no `.limit()`** (all
children, earliest first) and joins `students.display_name` client-side via a
second `.in('id', ids)` query. It is green-tested at
`src/lib/supabase/loaders/checkin.test.ts:237`: *"joins display names
client-side and preserves guardian_links order (earliest-linked first)."*

Writing a second one would create the exact "two competing contracts" hazard
revision 1 invoked to justify editing `types.ts`. The only deltas are that it
resolves the parent from `client.auth.getSession()` rather than a
`CurrentViewerIdentity`, and it has no role short-circuit — and the gate proved
the role short-circuit would have been a **defect**, not a feature: `Role` is
single-valued (`identity_roster.sql:12,20`), `guardian_links.parent_profile_id`
is an unconstrained FK to `profiles(id)` (`:74`), the invite trigger inserts
links without checking role, and RLS `own_read` scopes purely by
`parent_profile_id`. So a coach who is also a parent **has readable links**,
and revision 1's `role !== 'parent' → []` would have silently hidden their
children.

→ No new module. The discovery is recorded on the issue and in the PR body so
the consuming ticket (GAM-451) knows what to import.

One thing the gate found and GAM-451 will need: `LinkedStudentSummary` is
declared in `src/pages/meetings/StudentMeetingView.tsx:370-373` — a **page**
module — and `checkin.ts:206-208` reaches it via `import type`, a `lib → pages`
edge of the class GAM-444 §5 removed. Erased at compile time, zero bundle
weight, so not a defect; filed as **GAM-472** so GAM-451 does not solve it by
declaring a second copy. **Out of scope for this ticket — do not fix it here.**

## The one thing to build

### 1. `queryEventAttendance` — a seventh query in the existing batch

In `src/lib/supabase/loaders/meetings.ts`, beside the existing `query*` helpers
(`:395-446`), in their exact shape:

```ts
async function queryEventAttendance(
  client: SupabaseClient,
): Promise<LoaderQueryResult<EventAttendanceDbRow[]>> {
  const result = await client
    .from('v_event_attendance')
    .select('event_id, held_ct, graded_marks_ct, excused_ct, attended_marks_ct, attendance_pct');
  return { data: (result.data as EventAttendanceDbRow[] | null) ?? null, error: result.error };
}
```

Declare `EventAttendanceDbRow` beside the other `*DbRow` types first (the gate
placed it next to `SeasonIdDbRow` at `meetings.ts:320`, `tsc` clean), and
`mapEventAttendanceDbRow` beside the other `map*DbRow` functions
(**`:334-389`** — revision 1 cited `:319` and was wrong). Add its
`createLoader` closure and a seventh slot in the **existing** `Promise.all`
(`:899-937`) — one batch, not a second round trip.

### 2. Merge onto the rows — inside `meetings.ts`, after the builder returns

`makeLoadCoachMeetingsData` does **not** construct `CoachMeetingRow`s; it
delegates to `buildCoachMeetingRows`, which lives at
`src/lib/meetings/coachModel.ts:303-310`. **`coachModel.ts` is NOT in Allowed
Files and must not be edited.** Merge the attendance fields onto the returned
array inside `makeLoadCoachMeetingsData`, keyed by `eventId`.

Add to `CoachMeetingRow` in `src/lib/meetings/types.ts` — **all optional,
purely additive** (the gate confirmed `tsc --noEmit` exit 0 with exactly these
six applied, breaking no construction site or test literal):

```ts
attendancePct?: number | null;   // v_event_attendance.attendance_pct — NULL is "—", NEVER 0
heldCt?: number;                 // counts SESSIONS held, not marks
gradedMarksCt?: number;          // D014 mitigation — see below; a card rendering attendancePct must render this
attendedMarksCt?: number;
excusedCt?: number;
```

**`gradedMarksCt` is mandatory, not optional value-wise** (gate finding
confirmed verbatim). The view's own catalog comment states in capitals: *"A
CONSUMER THAT RENDERS attendance_pct WITHOUT ALSO RENDERING graded_marks_ct
REINTRODUCES D014's KNOWN REGRESSION."* Since T508 an unmarked student normally
has no attendance row, so forgetting to mark someone *inflates* the percentage
— measured at 100% for an event 60% of the roster skipped. GAM-460 owns the
render side; this loader must carry the value or GAM-460 cannot be built.

**Real edge case, replacing revision 1's wrong one.** Revision 1 worried about
an event with no `v_event_attendance` row; that cannot happen (the view LEFT
joins, so every event gets a row). The real edge is the inverse:
`coachModel.ts:321` — `if (eventSessions.length === 0) continue;` — so a
**zero-session event never becomes a row at all**, and only `type === 'meeting'`
events become rows. Extra view rows with no matching row are simply unused. A
row whose event is somehow absent from the view keeps `attendancePct`
undefined; do not fabricate `0`.

### 3. Extend the two test-client table whitelists

This is the fix for the gate's BLOCKER 1. Revision 1 was **unsatisfiable**:
adding a seventh table turned a currently-green test red in a file revision 1
forbade. Measured — baseline 42/42 exit 0, after the patch 3 failed / 2630
passed exit 1.

- `src/lib/supabase/loaders/meetings.test.ts:51` — extend `OTHER_TABLES` so
  `makeRecordingClient` (`:47-62`) stops throwing at `:61`. Without this the
  new select-string guard cannot even run.
- `src/pages/meetings/MeetingsList.test.tsx:182` — extend the `fromSpy` table
  whitelist. **This file is added to Allowed Files for this narrow purpose
  only: add `'v_event_attendance'` to the whitelist at `:182` and return an
  empty result for it. Change no assertion, no fixture, and nothing else in
  the file.**

  **`:246` is NOT to be touched** — an earlier revision said "`:182` and
  `:246`" and that was wrong. `:246` is inside
  `describe('loadStudentMeetingsData …')` (opens `:231`), which calls
  `makeLoadStudentMeetingsData`; a query added to the COACH loader cannot
  reach it. Adding the view there would be dead code implying the student
  loader reads the view. The premise gate patched `:182` alone and measured
  the full suite green.

### 4. NULL discipline — not negotiable

`attendancePct` passes through as `null`. **Never** `?? 0`, never
`Number(x) || 0`. Constitution item 3 / PRD DATA-01: re-deriving a metric in
TypeScript is a BLOCKER, and `types.ts:285-294` already spells out why widening
this to a bare `number` is one. Precedent for the nullable shape:
`StudentParticipationMetric.participationPct: number | null` (`types.ts:164`).

## Allowed files

- `src/lib/supabase/loaders/meetings.ts`
- `src/lib/supabase/loaders/meetings.test.ts`
- `src/lib/meetings/types.ts` — **additive only**, exactly the five optional
  fields above; no existing field changed, removed or re-typed;
  `SeriesCardModel` **not touched**
- `src/pages/meetings/MeetingsList.test.tsx` — **table whitelists at `:182`
  and `:246` ONLY**

**Forbidden:** `src/lib/meetings/coachModel.ts`,
`src/lib/meetings/resolveCurrentStudentId.ts`,
`src/lib/supabase/loaders/attendance.ts`,
`src/lib/supabase/loaders/endMeeting.ts`, `src/lib/supabase/loaders/checkin.ts`,
everything else under `src/pages/**`, `supabase/migrations/**`,
`docs/swarm/**`, `.claude/**`, `.github/workflows/**`. This ticket adds **no
write path**; `saveMeetingSeries` / `cancelMeetingSession` semantics unchanged.

## Acceptance criteria

1. **Select-string guard** for `v_event_attendance` naming all six columns, in
   the shape of `meetings.test.ts:72`'s `queryTeams` guard (`parseSelectedColumns`
   at `:24-28`), and it must actually **run** — i.e. `OTHER_TABLES` extended.
2. **Single batch:** all seven `from()` calls fire before the first await
   settles. The gate proved this is assertable — its probe recorded
   `SYNC_FROM_CALLS = 7, TOTAL = 7`.
3. **NULL passthrough:** a stubbed view row with `attendance_pct: null` yields
   `attendancePct === null`. A second case proves a real `0` survives as `0`
   and is not conflated with null.
4. **`held_ct` is not read as a mark count:** a fixture where `held_ct` and
   `graded_marks_ct` differ, asserting each lands in its own field.
5. **`gradedMarksCt` is carried** and reaches the row model — GAM-460 depends
   on it.
6. **Merge is keyed by `eventId`**, not array position: a fixture whose view
   rows arrive in a different order from the event rows still lands each value
   on the right row.
7. `buildCoachMeetingRows` and `coachModel.ts` are **unmodified**
   (`git diff --stat` shows neither).
8. `resolveCurrentStudentId`'s behaviour is byte-identical; its existing tests
   pass unmodified.
9. All six gates green via the `gate-run` skill, **and** the **three**
   previously red tests in two files are green again — `meetings.test.ts:73`
   and `:101` (via `makeRecordingClient`'s throw at `:61`) plus
   `MeetingsList.test.tsx:124` (throw at `:182`).

   **Baselines, measured on clean `main` by the premise gate — a test count
   means nothing without one:** full suite **2633 tests / 108 files**; scoped
   `src/lib/supabase/loaders/` **238 tests / 15 files**; eslint **0 errors,
   380 warnings**. Your run must show 2633 + your new tests, and **380
   warnings is the baseline, not a regression** (the `gate-run` skill's own
   doc text says 377 and is stale by 3).
10. **Two mutations replayed with real red output** (`mutation-replay`,
    item 23 — your own worktree, candidate fix committed first):
    (i) change the NULL passthrough to `?? 0` → criterion 3 goes red;
    (ii) change the merge to key by array index → criterion 6 goes red.

## Evidence required

`gate-run`'s evidence block verbatim with exit codes; the mutation table with
real red output and exit codes; the commit SHA your work landed in (item 21).
Do not self-certify — a `checker-reviewer` grades this against these criteria.

## Least confident decisions (round 2)

1. **Cutting the roster count entirely rather than shipping it disclosed.**
   *What would make it wrong:* if the owner considers the roster count part of
   what they authorized in GAM-446 and would rather have a disclosed-wrong
   number than none. I judged a knowingly-wrong count worse than an absent one
   under item 26, and MTG-01a plus GAM-447 §3a both point the same way — but
   this narrows a row the owner promoted to `Todo`, so it is their call to
   reverse.
2. **Adding the five fields to `CoachMeetingRow` when nothing consumes them
   yet.** The gate noted `buildSeriesCardModel` does not exist anywhere, so
   these fields currently reach no card. *What would make it wrong:* if the
   integration ticket intends to build `SeriesCardModel` straight from loader
   output, these belong on that path instead and this is dead weight.
   **The gate answered this: the falsifier does not fire.**
   `CoachMeetingsView.tsx:1269` already takes `loadData: LoadCoachMeetingsDataFn`,
   so "straight from loader output" and "from `CoachMeetingRow`" are the same
   path. `gradedMarksCt` is additionally a hard prerequisite for GAM-460.
3. **Editing `MeetingsList.test.tsx` at all.** *What would make it wrong:* if
   the right fix is to make that whitelist tolerant of unknown tables generally
   rather than enumerate a seventh — which would be a better fix and a
   different ticket's business. I chose the minimal enumeration because a
   tolerant stub silently stops catching unexpected queries, which is what the
   whitelist is for.
4. **Keeping HEAVY after the scope shrank to one query plus a merge.** On
   revision 2's contents alone this now reads STANDARD. *What would make it
   wrong:* nothing much — it costs one checker round. I kept HEAVY because the
   premise gate has already run and found real BLOCKERs, and re-tiering
   downward after a gate found defects would look like relabelling the row to
   match what I felt like doing (item 26 forbids exactly that).
