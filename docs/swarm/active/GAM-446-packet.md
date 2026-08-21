# GAM-446 task packet — revision 1

**Tier: HEAVY.** Base commit `3d27d8a` (`origin/main`). Branch
`claude/gam-446-coach-card-loader-data`.

Every line number below was re-read against `3d27d8a` on 2026-08-21, after a
rebase off a stale base (item 19c — the run log records the correction).

## Goal

Read-side only. Give the coach meetings loader the three things the redesigned
cards need and the data layer does not return:

1. per-event attendance from `v_event_attendance`,
2. per-series roster size (expected roster) beside the existing RSVP counts,
3. a parent's full list of linked children, via a new `listGuardianChildren`.

This ticket is the sole owner of loader-layer change for the redesign; no other
redesign ticket touches `loaders/meetings.ts`.

## Ground truth (verified, not assumed)

**The view.** `supabase/migrations/20260821000000_meetings_event_attendance_view.sql`
defines `public.v_event_attendance`, one row per `events.id`, columns:

| Column | Meaning |
| -- | -- |
| `event_id` | grain — one row per event, **including zero-session events** |
| `held_ct` | counts SESSIONS (`count(distinct es.id)`, `status='completed'`) |
| `graded_marks_ct` | counts MARKS on held sessions, incl. excused |
| `excused_ct` | excused marks |
| `attended_marks_ct` | present + late (MET-05) |
| `attendance_pct` | `numeric`, **NULL never 0** when the denominator is 0 |

**The loader.** `src/lib/supabase/loaders/meetings.ts:899-936` —
`makeLoadCoachMeetingsData` builds six `createLoader` closures and awaits them
in one `Promise.all`, then calls `buildCoachMeetingRows(...)` and threads
`teams` through. Each query is a small named `async function query*` returning
`LoaderQueryResult<T>` (`:395-445`).

**The select-string guard precedent.** `src/lib/supabase/loaders/meetings.test.ts:72`,
`describe('queryTeams (via makeLoadCoachMeetingsData) -- GAM-305 criterion 5
select-string guard')`. Copy that shape.

**The parent resolver.** `src/lib/meetings/resolveCurrentStudentId.ts` holds
`queryFirstLinkedStudentId`, which is exactly:

```ts
.from('guardian_links').select('student_id')
.eq('parent_profile_id', parentProfileId)
.order('created_at', { ascending: true }).limit(1)
```

`guardian_links` is `(id, parent_profile_id, student_id, relationship,
created_at)` with `unique (parent_profile_id, student_id)`
(`supabase/migrations/20260716000000_identity_roster.sql:72-79`). RLS
`own_read` already scopes a parent to their own links
(`20260717000002_rls.sql:114`).

## Three corrections to the issue text — read these before coding

**(A) `graded_marks_ct` is mandatory and the issue omits it.** The view's own
catalog comment states, in capitals, that a consumer rendering `attendance_pct`
without also rendering `graded_marks_ct` reintroduces D014's known inverted
failure mode (forgetting to mark someone *inflates* the percentage; measured at
100% for an event 60% of the roster skipped). GAM-460 (Backlog) owns the render
side. **The loader must carry `gradedMarksCt` through**, or GAM-460 cannot be
built. Carry `attendedMarksCt` and `excusedCt` too — they are free, they come
from the same row, and re-querying later costs another ticket.

**(B) The frozen `SeriesCardModel` has nowhere to put these fields.**
`src/lib/meetings/types.ts:268-306` freezes `SeriesCardModel` with
`attendancePct: number | null` — and no `heldCt`, no `gradedMarksCt`, no roster
field. `CoachMeetingRow` (`:108-123`) has none either. So the issue's
instruction to use "exact field names per the frozen `types.ts` contracts"
names fields that **do not exist**.

*Resolution for this packet:* `src/lib/meetings/types.ts` is **added to Allowed
Files, additively only** — new optional fields on `CoachMeetingRow`, no
existing field changed, removed, or re-typed. It is not on the issue's
Forbidden list (that list is `loaders/attendance.ts`, `loaders/endMeeting.ts`,
`src/pages/**`), and the alternative — inventing a second row type inside the
loader — would give the redesign two competing contracts, which is the exact
thing GAM-444 froze this file to prevent. **`SeriesCardModel` itself is NOT
touched**: it is MTG-01a's copied field list and belongs to the card tickets.

*Hazard, disclosed:* PR #232 (GAM-447, SeriesCard) is open on a sibling branch
right now. Keep every added field optional so nothing downstream breaks, and
expect a possible merge conflict in `types.ts`.

**(C) "Roster size / expected rosters" is underspecified.** The existing
`CoachMeetingSessionDetail.expectedCt` (`types.ts:89`) is already the real RSVP
`status === 'going'` count, and `CoachMeetingRowSummary.expectedCt`
(`:212-214`) sums it across the series. Those are RSVP counts, **not roster
size**. "Roster size" means how many students the event is scoped to —
`student_teams` filtered by the event's `team_ids` (`null` = all teams).

## What to build

### 1. `queryEventAttendance` — a seventh parallel query

In `src/lib/supabase/loaders/meetings.ts`, beside the existing `query*`
functions, following their exact shape:

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

Add its `createLoader` closure and its slot in the existing `Promise.all` — a
seventh entry in the same batch, not a second round trip. Add a
`mapEventAttendanceDbRow` beside the other `map*DbRow` functions
(`:319-389`), camelCasing verbatim.

### 2. `queryEventRosterCounts` — roster size per event

Roster size is `student_teams` membership scoped by the event's `team_ids`.
Fetch the membership rows in the same batch and compute per-event counts in
the loader; a student on two of an event's teams counts **once** (de-duplicate
by `student_id`). An event with `team_ids === null` is scoped to all teams.

Exclude students who have left: `student_teams.left_on` is the existing
convention (`types.ts:60-65` and `v_student_participation` both rely on it).
**Confirm the real column set of `student_teams` before writing the select
string** rather than trusting this paragraph.

### 3. Attach to the row model

Add to `CoachMeetingRow` in `src/lib/meetings/types.ts`, **all optional**, each
with a doc comment naming its source column:

```ts
attendancePct?: number | null;   // v_event_attendance.attendance_pct — NULL is "—", never 0
heldCt?: number;                 // SESSIONS held, not marks
gradedMarksCt?: number;          // D014 mitigation — a card rendering attendancePct must render this
attendedMarksCt?: number;
excusedCt?: number;
rosterCt?: number;               // distinct active students in the event's team scope
```

An event with no `v_event_attendance` row cannot occur (the view left-joins, so
every event has one), but code defensively anyway: absent row → `attendancePct`
`null`, counts `0`.

### 4. `listGuardianChildren`

New sibling module `src/lib/meetings/listGuardianChildren.ts` (**not** an edit
to `resolveCurrentStudentId.ts`, whose behaviour is explicitly unchanged),
following that file's `makeX(getClient)` + `createLoader` shape exactly, and
its NFR-04 leaf-module discipline — it must import only from
`../supabase/loader` / `../supabase/client` and `import type` from `./types`,
never from `src/pages/**`.

```ts
listGuardianChildren(viewer: CurrentViewerIdentity):
  Promise<Array<{ studentId: string; displayName: string }>>
```

- `viewer.role !== 'parent'` → `[]` immediately, no query. (Students and
  coaches have no guardian links; the issue says empty for both.)
- Otherwise `guardian_links.parent_profile_id = viewer.id`, ordered
  `created_at` ascending — the same order `queryFirstLinkedStudentId` uses, so
  the first element of this list is by construction the child
  `resolveCurrentStudentId` already returns. **That invariant is an acceptance
  criterion.**
- `displayName` comes from `students.display_name`.
- Item 6: `display_name` is first name + last initial in this codebase's
  fixtures and is permitted; use fabricated names in tests regardless.

### 5. NULL discipline — the one rule that is not negotiable

`attendancePct` passes through as `null`. **Never** `?? 0`, never
`Number(x) || 0`, no `greatest(...,1)` equivalent in TypeScript. Constitution
item 3 / PRD DATA-01: re-deriving a metric in TypeScript is a BLOCKER. The
loader's job is passthrough, and `types.ts:285-294` already spells out why
widening this to a bare `number` is a BLOCKER.

## Allowed files

- `src/lib/supabase/loaders/meetings.ts`
- `src/lib/supabase/loaders/meetings.test.ts`
- `src/lib/meetings/listGuardianChildren.ts` (new)
- `src/lib/meetings/listGuardianChildren.test.ts` (new)
- `src/lib/meetings/types.ts` — **additive only** (see correction B)

**Forbidden:** `src/lib/supabase/loaders/attendance.ts`,
`src/lib/supabase/loaders/endMeeting.ts`, all of `src/pages/**`,
`supabase/migrations/**`, `docs/swarm/**`, `.claude/**`,
`.github/workflows/**`. `resolveCurrentStudentId.ts` is read-only reference.
`saveMeetingSeries` / `cancelMeetingSession` semantics are unchanged — this
ticket adds no write path.

## Acceptance criteria (each independently measurable today)

1. **Select-string guard** for `v_event_attendance` naming all six columns, in
   the shape of `meetings.test.ts:72`'s `queryTeams` guard.
2. **Select-string guard** for the roster-count query.
3. `loadCoachMeetingsData` still issues **one** `Promise.all` batch — assert
   the added queries are in it, not sequential after it.
4. **NULL passthrough:** a stubbed view row with `attendance_pct: null` yields
   `attendancePct === null` on the row model. A separate case proves `0` is
   preserved as `0` and not confused with null.
5. **`held_ct` is not read as a mark count** — a fixture where `held_ct` and
   `graded_marks_ct` differ, asserting each lands in its own field.
6. **Multi-child parent:** `listGuardianChildren` returns *all* children in
   `created_at` order for a parent with ≥2 links.
7. **Order invariant:** for the same fixture, `listGuardianChildren(...)[0]
   .studentId === await resolveCurrentStudentId(...)`.
8. **Non-parent:** student and coach viewers each return `[]` **and issue no
   query** (assert the stub client was never called).
9. `resolveCurrentStudentId`'s own behaviour is byte-identical — its existing
   tests pass unmodified.
10. All six gates green (`gate-run`), and **two mutations replayed with real
    red output**: (i) change the NULL passthrough to `?? 0` → criterion 4 goes
    red; (ii) change `listGuardianChildren`'s order to `descending` →
    criterion 6 or 7 goes red.

## Evidence required

`gate-run`'s evidence block verbatim with exit codes; the mutation table with
real red output and exit codes, run in **your own worktree** (item 23), with
the candidate fix committed first (item 26's fast-tier working rule applies to
any mutation). Report the commit SHA your work landed in (item 21).

## Least confident decisions (item 19d) — attack these first

1. **Widening Allowed Files to `types.ts` (correction B).** The issue did not
   list it. I judged that additive optional fields on `CoachMeetingRow` are
   safer than a competing row type defined in the loader. *What would make it
   wrong:* if GAM-447's open PR #232 or another live redesign ticket already
   adds these exact fields, this duplicates a contract instead of extending
   one — or if the owner intends `SeriesCardModel`, not `CoachMeetingRow`, to
   be where the card reads them, in which case the fields belong to a card
   ticket and this one should stop at the loader's return value.
2. **Roster size defined as `student_teams` scoped by `team_ids`
   (correction C).** *What would make it wrong:* if "expected roster" in the
   redesign actually means the RSVP `going` count that already exists as
   `expectedCt`, this whole query is redundant work against a number the
   summary already computes. I could not find MTG-01a text settling it.
3. **`student_teams.left_on` as the active-membership filter.** Asserted from
   convention, **not** read from the migration during packet authoring. *What
   would make it wrong:* the column is named differently, or active membership
   is expressed some other way — in which case criterion 2's guard string is
   wrong and the roster count silently includes departed students.
4. **A seventh and eighth query in the same `Promise.all`.** *What would make
   it wrong:* if the roster query's result is large enough that fetching whole
   `student_teams` is a real cost, this trades a round trip for a payload;
   the existing loader already fetches whole `attendance` and `rsvps` tables,
   so I judged it consistent — but consistent with an existing cost is not the
   same as cheap.
5. **`role !== 'parent'` → `[]` with no query.** *What would make it wrong:* a
   coach who is also a parent of a team member. If `Role` is single-valued and
   a coach-parent's role reads `coach`, this silently denies them the child
   switcher. I did not verify whether that case exists in this data model.
