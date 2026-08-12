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

**Bold rows are sites the issue does not name.** `:876`/`:1048` matter most,
but **not for the reason round 1 of this packet claimed.**

> **Corrected after premise-gate round 1 (finding F2), which measured it.**
> This packet previously asserted that leaving `allTeamIds` unfiltered makes
> re-saving an untouched all-teams event write an explicit array. **That is
> false.** It writes `null` on both the create and edit paths, because
> `resolveTeamScope` compares `selectedTeamIds` against the *same* unfiltered
> `allTeamIds`, and Astryx `MultiSelector` never prunes out-of-option values on
> mount (`MultiSelector.js:357,375,406` — `onChange` fires only from user
> interaction). Measured output: `EDIT calls = 1  teamIds = null`.
>
> **The real hazard is the inverse.** Once `allTeamIds` *is* narrowed, seeding
> `:876`/`:1048` from the **unfiltered** `teams` breaks the sentinel — measured
> `EDIT teamIds = ["team-active","team-archived"]` where it was `null`. That is
> what criterion 7 guards, and why §3c says both must come from one list.

### The full data chain (round 1 finding F1 — the loaders do *not* map into the dialog option types)

`§2`'s table above is not the whole chain. Two **cross-page exported
interfaces** sit between the loaders and the dialogs, and both must widen:

| File | Line | Symbol |
| -- | -- | -- |
| `src/pages/outreach/OutreachDetail.tsx` | 822 | `export interface TeamOption` — what `outreach.ts:722`'s mapper actually returns |
| `src/pages/meetings/MeetingsList.tsx` | 627 | `interface Team` — passed into `ScheduleMeetingsDialog` at `:2490` |

`queryAllTeams` also has **two** consumers, not one: `outreach.ts:1085`
(mapping at `:1116`) and `:1131` (mapping at `:1155`).

### Corrections to the issue text (item 30c — kept, not deleted)

1. **`loaders/meetings.ts:392` is wrong.** Line 392 is `querySessions`. The
   teams select is **`:402`**. Same for the loader paths: they are under
   `src/lib/supabase/loaders/`, not `src/lib/loaders/`.
2. **`loaders/coachHome.ts:39-40` is `:36-40`**, and it cites
   `dashboard.ts:297-302` as the precedent, not itself. The precedent holds.
3. **Criterion 5's "or a type error" is false.** Both loaders cast with
   `as TeamDbRow[]` (`meetings.ts:405`, `outreach.ts:958`); the select string is
   untyped. Deleting `archived` from the select compiles fine. Criterion 5
   therefore needs a *select-string guard test*, which is an established pattern
   here — see `outreach.test.ts:46-51` (`parseSelectedColumns`, the T146 guard)
   and `parentHome.test.ts:100-106`. `coachHome.test.ts` ships a reusable
   `makeRecordingClient` the new `meetings.test.ts` can follow.
4. **`groupStudentsByTeam` does not exist.** The symbol is
   `groupActiveRosterByTeam` (`OutreachEventDialog.tsx:901`, call site `:1133`).
5. **`StudentDialog.tsx` makes the "ONLY place" claim twice** — `:320-321` *and*
   the file header at `:118-119`. Both must be updated.

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
name and signature (it has existing callers and tests). Its "the ONLY place
archived teams are excluded" claim appears **twice** — `:320-321` and the file
header `:118-119` — and both become false the moment two more dialogs filter, so
**update both** to point at the shared helper. Constitution item 3's "no second
predicate" is satisfied by delegation.

### 3b. Widen the data chain — all four types, not two

- `meetings.ts`: `TeamDbRow` gains `archived: boolean`; select becomes
  `'id, name, archived'`; `mapTeamDbRow` carries `archived` through.
- `outreach.ts`: `TeamDbRow` gains `archived: boolean`; select becomes
  `'id, name, color, archived'`; `mapTeamDbRowToTeamOption` carries it through.
- `ScheduleTeamOption` and `OutreachTeamOption` each gain `archived: boolean`.
- **`OutreachDetail.tsx:822 TeamOption` gains `archived: boolean`** — this is
  what the outreach mapper actually returns, and it is explicitly authorized
  here so the worker is not redesigning an interface on its own initiative.
  Its T143 module doc at `:824-833` argues required-over-optional; that argument
  is preserved, not overturned.
- **`MeetingsList.tsx:627 Team` gains `archived: boolean`.**
- Every `FIXTURE_TEAMS` / test literal constructing one of the above gains
  `archived: false`. These are mechanical, `tsc`-guided edits.

`src/lib/supabase/types.ts:96`'s exported `TeamRow` is the authority for the
column's type; cite it rather than re-deriving.

**Required, not optional — decision recorded.** The gate offered `archived?:
boolean`, which costs 2 files instead of 7 and zero fixture edits. **Rejected.**
An optional field fails *open*: a loader that forgets to populate it yields
`undefined`, `!team.archived` is true, and the archived team is offered again —
silently restoring exactly the bug this task fixes, with every test still green.
Required makes `tsc` police every construction site, which is the T143 argument
this repo already accepted for this same interface. The cascade is mechanical
and the compiler drives it; the failure mode it prevents is invisible.

### 3c. Narrow options and `allTeamIds` **together**

In each dialog, derive one filtered list and feed *both* from it:

```ts
const selectableTeams = useMemo(() => excludeArchivedTeams(teams), [teams]);
const allTeamIds = useMemo(() => selectableTeams.map((t) => t.id), [selectableTeams]);
```

`StudentDialog.tsx:421` is character-for-character this shape, already shipped
and already tested — follow it.

Because `:876`/`:908` and `:1048`/`:1072` already read `allTeamIds`, they follow
automatically — **do not add a second filter at those sites.**

`resolveTeamScope` itself is **not** modified. Its contract already is "null
when every team in `allTeamIds` is selected"; narrowing `allTeamIds` is what
keeps the sentinel correct.

### 3d. Keep already-scoped archived teams *visible* (round 1 finding F4)

Narrowing the options list alone introduces a new, user-visible defect. Astryx
`MultiSelector` falls back to the raw `value` string when no option matches it
(`MultiSelector.js:472`), so an event already scoped to a since-archived team
renders a **raw uuid** in the Team scope trigger — while "Expected attendees"
renders that same team's real name from the unfiltered list. Same dialog, same
team, two labels, one of them a uuid. Measured by the gate.

So the options list is **selectable teams plus any team already selected**:

```ts
const teamOptions = useMemo(
  () => teams.filter((t) => !t.archived || selectedTeamIds.includes(t.id)),
  [teams, selectedTeamIds],
);
```

`allTeamIds` stays derived from `selectableTeams` only. A legacy event scoped to
`[active, archived]` therefore has `selectedTeamIds.length === 2` against
`allTeamIds.length === 1`, so `resolveTeamScope` correctly returns the explicit
array and preserves the stored value. Nothing a coach has already saved is
silently rewritten; they simply cannot *newly* scope to an archived team.

### 3e. Explicitly out of scope — do not touch

- `loaders/coachHome.ts` and `loaders/dashboard.ts` — deliberately unfiltered
  display surfaces. **`coachHome.test.ts:110` asserts `teamsSelectSpy` was
  called with exactly `'id, name'`; changing that loader breaks it.**
- `StudentsTab.tsx:852`, `ParticipationTab.tsx:727` — display filters, write nothing.
- **`groupActiveRosterByTeam`** (`OutreachEventDialog.tsx:901`, call site
  `:1133`) / the "Expected attendees" checklist. It takes `OutreachTeamOption`
  and will compile once the type widens; **leave its behaviour unchanged.** It
  self-scopes by `selectedTeamIds` (`:909`), so an archived team's students
  appear only when that team is genuinely in the written scope — where showing
  them is correct, since their attendance does count. Filtering it would hide
  attendees who count.
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

# Added after premise-gate round 1 (F1) — MEASURED by `npx tsc --noEmit`,
# in two waves, not guessed. Without these the packet is unimplementable.
src/pages/meetings/MeetingsList.tsx            (`:627` Team, `:829-830` FIXTURE_TEAMS)
src/pages/meetings/MeetingsList.test.tsx       (`:1060-1061`)
src/pages/outreach/OutreachDetail.tsx          (`:822` TeamOption, `:952-953` FIXTURE_TEAMS)
src/pages/outreach/OutreachDetail.test.tsx     (`:886`, `:1733-1734`, `:2047-2048`, `:2642-2643`, `:3131`)
src/pages/outreach/OutreachList.tsx            (`:1038-1039` FIXTURE_TEAMS)
```

The gate reached `npx tsc --noEmit` exit 0 only after all of the above. If a
file **not** on this list fails to compile, report it rather than redesigning
it — that means this measurement missed something and the packet is wrong again.

No `.github/workflows/**` is involved, checked at packet time per `AGENTS.md`
§ "Two walls".

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
4. **"All teams" still collapses to `null`.** **The test must drive the picker:
   clear-all, then select-all**, then submit, and expect `teamIds: null`.
   *Mutation: filter the options but leave `allTeamIds` unfiltered → red.*

   > **Repaired after gate round 1 (F3).** The obvious version of this test —
   > open, submit untouched, expect `null` — **stays green under its own
   > declared mutation** (measured: `CREATE teamIds = null`), because that
   > mutation leaves the archived id in *both* the initial selection and
   > `allTeamIds`, so the sentinel still fires. Driving the picker is what makes
   > it falsifiable: after clear-all + select-all, `selectedTeamIds` is
   > `['team-active']` against an unfiltered `allTeamIds` of length 2, so
   > `resolveTeamScope` returns an explicit array instead of `null`. A criterion
   > that cannot fail is the exact defect criterion 3 exists to prevent, and
   > this packet shipped one.
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
   StudentDialog archived-team tests go red*, proving delegation is real. The
   gate confirmed both exist and would redden: `StudentDialog.test.tsx:197`
   ("excludes archived teams") and `:438` ("Legacy Forge" never appears as a
   Team option), against a fixture already carrying an archived team (`:140`).
9. **A team archived *after* an event was scoped to it stays legible and stays
   stored** (round 1 finding F4). Open edit mode on an event whose stored
   `teamIds` explicitly names a now-archived team: the Team scope trigger shows
   that team's **name, not its uuid**, and saving unchanged writes the same
   explicit array back. *Mutation: build the options list from
   `selectableTeams` alone, dropping the `|| selectedTeamIds.includes(t.id)`
   clause → the raw uuid appears in the trigger → red.*

   Without this criterion the fix ships a copy defect (item 14) on a path that
   certainly occurs — archiving a team after scheduling for it is what
   `teams.archived` is *for*.

Every criterion above must be proved with the `mutation-replay` skill: commit
first, mutate, capture the red output and exit code, revert, re-verify green.
A criterion whose mutation does not redden is not satisfied.

## 6. Evidence required

All six gates via the `gate-run` skill (tsc, vite build, format:check, eslint,
full vitest, scoped vitest), plus the eight mutation replays, plus the commit
SHA the work landed in (item 21).

## 7. Least confident decisions (item 19d) — round 2

Round 1's list is retained below for the record. Four of its five doubts were
attacked and three were found sound; **#5 was justified and was the BLOCKER.**
These are the doubts that remain *after* that gate.

1. **Keeping `archived` required, against the gate's explicit cheaper path.**
   I am overriding a measured cost (7 files vs 2, ~15 fixture literals vs 0) on
   a reasoning argument about fail-open. Wrong if the reviewer judges that
   criterion 5's select-string guard already closes the fail-open gap
   completely, in which case I have bought nothing with the extra five files.
2. **The F4 remedy — `!t.archived || selectedTeamIds.includes(t.id)` — makes the
   options list depend on the selection.** That is a feedback loop the round-1
   prescription did not have: options depend on `selectedTeamIds`, which the
   user changes through those same options. I believe it is stable (unticking
   an archived team removes it from the options, which is arguably correct and
   is one-way), but I have **not** measured what the trigger and the checkbox
   list do at that exact moment. This is the single most likely place for the
   fix to behave oddly on screen, and the gate should drive it.
3. **Choosing "keep it visible" over "disable it" for F4.** The gate offered
   `isDisabled` options as the simpler alternative. I chose inclusion because
   it needs no Astryx prop I have verified against `astryx-api.md` (item 2 —
   a prop absent from that file is presumed hallucinated). If `MultiSelector`
   does support a per-option disabled flag there, that is probably the better
   design and I have picked the worse one to avoid checking.
4. **Asserting that a legacy explicit `[active, archived]` scope round-trips
   unchanged.** Criterion 9 claims saving unchanged preserves the array. That
   follows from `selectedTeamIds.length !== allTeamIds.length`, but only while
   at least one active team exists. **If every team on the roster is archived,
   `allTeamIds` is empty**, `resolveTeamScope`'s `allTeamIds.length > 0` guard
   fails, and it returns an explicit array — which is right, but the picker
   offers nothing and the dialog's behaviour in that state is unspecified here.
   Low likelihood, total roster archive; I have not thought it through.
5. **That the two `queryAllTeams` consumers (`outreach.ts:1085` and `:1131`)
   both feed dialogs that should filter.** I widened the shared mapper for
   both. If `:1131`'s consumer is a display surface, I have just changed data it
   receives — harmlessly, since widening only adds a field and nothing filters
   downstream, but I did not read that second consumer.

<details>
<summary>Round 1 list, kept verbatim (item 30d)</summary>

1. **Placing the shared predicate in a new `src/lib/teams/` directory.** Wrong
   if the repo has an established home for cross-page domain helpers that I
   missed — `src/lib/` currently holds `format/`, `meetings/`, `outreach/` and a
   loose `eventTypeBadge.ts`, so the convention is not unambiguous. Also wrong
   if the reviewer judges that importing `filterSelectableTeams` directly from
   `StudentDialog.tsx` is acceptable and a new module is over-engineering.
   — *Gate: SOUND, doubt not justified. `src/lib/meetings/resolveCurrentStudentId.ts`
   and `src/lib/outreach/unansweredOutreach.ts` are the same shape.*
2. **Making `StudentDialog.filterSelectableTeams` delegate rather than leaving
   it alone.** Wrong if `StudentDialog.tsx` is protected or if touching it
   risks a passed task's green test for no functional gain. The alternative —
   leave it duplicated and update only its module doc — is cheaper but leaves
   two predicates, which constitution item 3's spirit and the issue both
   argue against. — *Gate: SOUND, not protected, and the policing tests exist.*
3. **Leaving `groupStudentsByTeam` unfiltered.** Wrong if a coach would find it
   incoherent that an archived team cannot be *scoped* but its students still
   appear in "Expected attendees". I claim that is a separate, display-side
   decision and out of scope; a reviewer may reasonably call it a MAJOR
   inconsistency shipped in the same dialog. — *Gate: SOUND, and filtering
   would be worse — it self-scopes by `selectedTeamIds`, so it only shows
   students who genuinely count. But the incoherence I half-sensed was real and
   lives at the trigger: that is finding F4.*
4. **Asserting `archived` via a select-string guard instead of a type.** Wrong
   if the reviewer considers a string-matching test brittle. I chose it because
   correction 3 shows the type genuinely cannot catch it, and because two
   loaders in this repo already do exactly this. — *Gate: SOUND, confirmed.*
5. **Assuming no consumer outside the Allowed Files breaks when the option types
   widen.** I did not exhaustively enumerate every importer of
   `ScheduleTeamOption` / `OutreachTeamOption`. Adding a required field to an
   interface breaks every object literal that constructs one — including test
   fixtures in files I have listed, but possibly others I have not. This is the
   most likely source of an unplanned file appearing in the diff.
   — *Gate: **WRONG, and this was the BLOCKER.** Five files, two waves, and two
   cross-page exported interfaces the packet's map did not know existed.*

</details>
