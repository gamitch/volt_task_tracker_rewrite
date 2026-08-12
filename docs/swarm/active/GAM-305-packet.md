# GAM-305 task packet (HEAVY)

**Issue:** GAM-305 (legacy `T615`) — the schedule-meetings and outreach team
scope pickers offer archived teams and tick them by default; the roster's
student dialog is the only picker that excludes them.
**Tier:** HEAVY (write path into `events.team_ids`; RLS and metric SQL scope on it).
**Branch:** `claude/gam-305-archived-team-pickers`
**Worker model:** `worker-implementer` pinned default. Item 18's four triggers
are not met (no migration, no RLS policy, no `security definer`, no metric-view
SQL, no auth/role logic); item 25 forbids bumping on topic sensitivity.

---

## 1. The defect

`teams.archived` exists (`supabase/migrations/20260716000000_identity_roster.sql`,
`not null default false`) but never reaches either scheduling dialog, because
neither loader selects it:

- `src/lib/supabase/loaders/meetings.ts:402` — `queryTeams` does `select('id, name')`
- `src/lib/supabase/loaders/outreach.ts:955` — `queryAllTeams` does `select('id, name, color')`

So both dialogs render every team and, worse, **seed the default selection from
every team**. Whatever is ticked becomes `events.team_ids`, which `rls.sql`
and `metric_views.sql` scope student visibility and participation on.

## 2. Verified map of every site (checked against `main` on 2026-08-12)

| File | Line | What it is |
| -- | -- | -- |
| `src/lib/supabase/loaders/meetings.ts` | 257-260 | `TeamDbRow` = `{id, name}` |
| `src/lib/supabase/loaders/meetings.ts` | 344-346 | `mapTeamDbRow` drops everything else |
| `src/lib/supabase/loaders/meetings.ts` | 402 | `select('id, name')` |
| `src/lib/supabase/loaders/outreach.ts` | 550-554 | `TeamDbRow` = `{id, name, color}` |
| `src/lib/supabase/loaders/outreach.ts` | 722-724 | `mapTeamDbRowToTeamOption` |
| `src/lib/supabase/loaders/outreach.ts` | 955 | `select('id, name, color')` |
| `src/pages/meetings/ScheduleMeetingsDialog.tsx` | 282-285 | `ScheduleTeamOption` = `{id, name}` |
| `src/pages/meetings/ScheduleMeetingsDialog.tsx` | 492-501 | `resolveTeamScope` — the `null` sentinel |
| `src/pages/meetings/ScheduleMeetingsDialog.tsx` | 832 | `allTeamIds` from every team |
| `src/pages/meetings/ScheduleMeetingsDialog.tsx` | 838 | initial `selectedTeamIds` = `allTeamIds` |
| `src/pages/meetings/ScheduleMeetingsDialog.tsx` | **876** | edit-mode reset: `initialData.teamIds !== null ? [...] : allTeamIds` |
| `src/pages/meetings/ScheduleMeetingsDialog.tsx` | **908** | create-mode reset on open: `setSelectedTeamIds(allTeamIds)` |
| `src/pages/meetings/ScheduleMeetingsDialog.tsx` | 1160 | unfiltered `options` |
| `src/pages/outreach/OutreachEventDialog.tsx` | 513-516 | `OutreachTeamOption` = `{id, name}` |
| `src/pages/outreach/OutreachEventDialog.tsx` | 886-895 | `resolveTeamScope` (duplicate) |
| `src/pages/outreach/OutreachEventDialog.tsx` | 984 | `allTeamIds` |
| `src/pages/outreach/OutreachEventDialog.tsx` | 1006 | initial `selectedTeamIds` |
| `src/pages/outreach/OutreachEventDialog.tsx` | **1048** | edit-mode reset: `initialEvent.teamIds ?? allTeamIds` |
| `src/pages/outreach/OutreachEventDialog.tsx` | **1072** | create-mode reset on open |
| `src/pages/outreach/OutreachEventDialog.tsx` | 1493 | unfiltered `options` |
| `src/pages/roster/StudentDialog.tsx` | 238-242, 320-326 | `StudentDialogTeamOption` + `filterSelectableTeams` |

**Bold rows are sites the issue does not name.** `:876`/`:1048` matter most: an
existing event stored with `team_ids = null` re-seeds its selection from
`allTeamIds` on open, so if `allTeamIds` is not narrowed, **re-saving an
untouched all-teams event starts writing an explicit array.** That is the
issue's criterion-4 hazard on the *edit* path, which the issue only describes
on the create path.

### Corrections to the issue text (item 30c — kept, not deleted)

1. **`loaders/meetings.ts:392` is wrong.** Line 392 is `querySessions`. The
   teams select is **`:402`**. Same for the loader paths: they are under
   `src/lib/supabase/loaders/`, not `src/lib/loaders/`.
2. **`loaders/coachHome.ts:39-40` is `:36-40`**, and it cites
   `dashboard.ts:297-302` as the precedent, not itself. The precedent holds.
3. **Criterion 5's "or a type error" is false.** Both loaders cast with
   `as TeamDbRow[]`; the select string is untyped. Deleting `archived` from the
   select compiles fine. Criterion 5 therefore needs a *select-string guard
   test*, which is an established pattern here — see
   `outreach.test.ts:36-52` (`parseSelectedColumns`, the T146 guard) and
   `parentHome.test.ts:100-102`.

## 3. Prescription

### 3a. One shared predicate, in a new module

Create **`src/lib/teams/archivedTeams.ts`**:

```ts
/** The ONE place archived teams are excluded from a selectable option list. */
export function excludeArchivedTeams<T extends { archived: boolean }>(
  teams: readonly T[],
): T[] {
  return teams.filter((team) => !team.archived);
}
```

`StudentDialog.filterSelectableTeams` **delegates to it** and keeps its exported
name and signature (it has existing callers and tests). Its module doc claim —
"the ONLY place archived teams are excluded" — becomes false the moment two more
dialogs filter, so **update that comment** to point at the shared helper.
Constitution item 3's "no second predicate" is satisfied by delegation.

### 3b. Widen the data chain, both sides

- `meetings.ts`: `TeamDbRow` gains `archived: boolean`; select becomes
  `'id, name, archived'`; `mapTeamDbRow` carries `archived` through.
- `outreach.ts`: `TeamDbRow` gains `archived: boolean`; select becomes
  `'id, name, color, archived'`; `mapTeamDbRowToTeamOption` carries it through.
- `ScheduleTeamOption` and `OutreachTeamOption` each gain `archived: boolean`.

### 3c. Narrow options and `allTeamIds` **together**

In each dialog, derive one filtered list and feed *both* from it:

```ts
const selectableTeams = useMemo(() => excludeArchivedTeams(teams), [teams]);
const allTeamIds = useMemo(() => selectableTeams.map((t) => t.id), [selectableTeams]);
```

and render `options={selectableTeams.map(...)}`. Because `:876`/`:908` and
`:1048`/`:1072` already read `allTeamIds`, they follow automatically — **do not
add a second filter at those sites.**

`resolveTeamScope` itself is **not** modified. Its contract already is "null
when every team in `allTeamIds` is selected"; narrowing `allTeamIds` is what
keeps the sentinel correct.

### 3d. Explicitly out of scope — do not touch

- `loaders/coachHome.ts` and `loaders/dashboard.ts` — deliberately unfiltered
  display surfaces. **`coachHome.test.ts:110` asserts `teamsSelectSpy` was
  called with exactly `'id, name'`; changing that loader breaks it.**
- `StudentsTab.tsx:852`, `ParticipationTab.tsx:727` — display filters, write nothing.
- `groupStudentsByTeam` / the "Expected attendees" checklist
  (`OutreachEventDialog.tsx:903-907`). It takes `OutreachTeamOption` and will
  compile once the type widens; **leave its behaviour unchanged.** Filtering it
  is a separate decision about attendee display, not about written scope.
- `supabase/**`, `.github/workflows/**`, `docs/swarm/**`, `.claude/**`.

## 4. Allowed Files

```
src/lib/teams/archivedTeams.ts                      (new)
src/lib/teams/archivedTeams.test.ts                 (new)
src/lib/supabase/loaders/meetings.ts
src/lib/supabase/loaders/meetings.test.ts           (new — no such file today)
src/lib/supabase/loaders/outreach.ts
src/lib/supabase/loaders/outreach.test.ts
src/pages/meetings/ScheduleMeetingsDialog.tsx
src/pages/meetings/ScheduleMeetingsDialog.test.tsx
src/pages/outreach/OutreachEventDialog.tsx
src/pages/outreach/OutreachEventDialog.test.tsx
src/pages/roster/StudentDialog.tsx
```

Plus any file that fails to compile solely because `ScheduleTeamOption` /
`OutreachTeamOption` / the loader row types widened — **report each such file
rather than redesigning it.** No `.github/workflows/**` is involved, checked at
packet time per `AGENTS.md` § "Two walls".

## 5. Acceptance criteria — each names its reddening mutation

Adopted from the issue, with criterion 5 repaired and 7-8 added.

1. **Archived teams absent from the options.** Fixture: one archived, one
   active. `ScheduleMeetingsDialog`'s Team scope offers only the active team.
   *Mutation: delete the `excludeArchivedTeams` call at the options site → red.*
2. **Archived teams absent from the default selection.** Dialog opens with the
   archived team unticked. *Mutation: restore `allTeamIds` to `teams.map(...)`
   while leaving options filtered → red.*
3. **Active teams survive.** The active team is offered **and ticked**.
   *Mutation: invert to `team.archived` → red.* (Without this, deleting the
   picker passes 1 and 2.)
4. **"All teams" still collapses to `null`.** Selecting every offered team
   produces `teamIds: null` in the create payload. *Mutation: filter options but
   not `allTeamIds` → red.*
5. **The column is fetched.** A select-string guard test asserts the recorded
   `.select()` argument for the `teams` table contains `archived`, in **both**
   loaders. *Mutation: remove `archived` from the select string → red.*
   Follow `outreach.test.ts`'s existing `parseSelectedColumns` seam. A type
   assertion does **not** satisfy this (see correction 3).
6. **`OutreachEventDialog` holds criteria 1-4** by its own tests.
7. **The edit path holds the sentinel.** Open an event whose stored
   `teamIds` is `null` in edit mode with an archived team present; saving
   unchanged still yields `teamIds: null`. *Mutation: at `:876`/`:1048` seed
   from the unfiltered `teams` list → red.* This is the site the issue misses.
8. **One predicate, not three.** `StudentDialog.filterSelectableTeams` delegates
   to `excludeArchivedTeams` and existing `StudentDialog` tests stay green.
   *Mutation: make `excludeArchivedTeams` return its input unchanged → the
   StudentDialog archived-team test goes red*, proving delegation is real.

Every criterion above must be proved with the `mutation-replay` skill: commit
first, mutate, capture the red output and exit code, revert, re-verify green.
A criterion whose mutation does not redden is not satisfied.

## 6. Evidence required

All six gates via the `gate-run` skill (tsc, vite build, format:check, eslint,
full vitest, scoped vitest), plus the eight mutation replays, plus the commit
SHA the work landed in (item 21).

## 7. Least confident decisions (item 19d)

1. **Placing the shared predicate in a new `src/lib/teams/` directory.** Wrong
   if the repo has an established home for cross-page domain helpers that I
   missed — `src/lib/` currently holds `format/`, `meetings/`, `outreach/` and a
   loose `eventTypeBadge.ts`, so the convention is not unambiguous. Also wrong
   if the reviewer judges that importing `filterSelectableTeams` directly from
   `StudentDialog.tsx` is acceptable and a new module is over-engineering.
2. **Making `StudentDialog.filterSelectableTeams` delegate rather than leaving
   it alone.** Wrong if `StudentDialog.tsx` is protected or if touching it
   risks a passed task's green test for no functional gain. The alternative —
   leave it duplicated and update only its module doc — is cheaper but leaves
   two predicates, which constitution item 3's spirit and the issue both
   argue against.
3. **Leaving `groupStudentsByTeam` unfiltered.** Wrong if a coach would find it
   incoherent that an archived team cannot be *scoped* but its students still
   appear in "Expected attendees". I claim that is a separate, display-side
   decision and out of scope; a reviewer may reasonably call it a MAJOR
   inconsistency shipped in the same dialog.
4. **Asserting `archived` via a select-string guard instead of a type.** Wrong
   if the reviewer considers a string-matching test brittle. I chose it because
   correction 3 shows the type genuinely cannot catch it, and because two
   loaders in this repo already do exactly this.
5. **Assuming no consumer outside the Allowed Files breaks when the option types
   widen.** I did not exhaustively enumerate every importer of
   `ScheduleTeamOption` / `OutreachTeamOption`. Adding a required field to an
   interface breaks every object literal that constructs one — including test
   fixtures in files I have listed, but possibly others I have not. This is the
   most likely source of an unplanned file appearing in the diff.
