# T151 Worker Output — make the dialog `teams` prop required, delete the three `DEFAULT_TEAMS` fixtures

## Merge result

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```
Fast-forwarded cleanly `f7ff055..dcfa6e0`, no conflicts. `npm ci` ran clean (340 packages).

Packet revision check:
```
git log -1 --format=%H -- docs/swarm/active/T151-worker-packet.md
```
returned `dcfa6e0f27648b2d08343a692324b051adba54c1` — matches the pinned commit exactly.

All line-number citations in the packet (`ScheduleMeetingsDialog.tsx:312-322/539-540/548`,
`StudentDialog.tsx:110-124/275-291/404-425`, `OutreachEventDialog.tsx:375-380/601-624/949-983`)
were read-verified against the merged tree before editing and matched byte-for-byte.

## Step 0 — premise reproduction (own worktree, on branch `t151-work`)

Applied the full mechanical change (prop required, defaults dropped, fixtures deleted, both
dangling comments fixed) and ran `npx tsc --noEmit`.

**My own count: 34 errors, all `TS2741`, in exactly two files:**
- `src/pages/outreach/OutreachEventDialog.test.tsx`: 24 errors
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx`: 10 errors
- Zero errors in production source.
- Zero errors in `StudentDialog.tsx`/`StudentDialog.test.tsx`.

This is an exact match to the packet's stated 34/24/10 figures (measured by the orchestrator at
a different throwaway-worktree commit) and to the earlier `af28914` probe. No delta to explain —
the tree had not shifted underneath the premise between those measurements and my own dispatch
commit.

Verification commands used:
```
npx tsc --noEmit 2>&1 | tee <scratch>/step0-tsc.txt
grep -oE "^src/[^(]+" <scratch>/step0-tsc.txt | sort | uniq -c
grep -c "TS2741" <scratch>/step0-tsc.txt      # -> 34
grep -v "TS2741" <scratch>/step0-tsc.txt      # -> (empty)
```

## The fix — diffs at each of the three dialogs

### `ScheduleMeetingsDialog.tsx`
- Deleted the `// Fixture teams ...` banner comment block and the `DEFAULT_TEAMS` constant
  (`:312-322` in the pre-fix tree).
- `teams?: readonly ScheduleTeamOption[]` -> `teams: readonly ScheduleTeamOption[]` (dropped the
  `?` and the stale `/** Defaults to \`DEFAULT_TEAMS\`... */` doc comment).
- Destructured default `teams = DEFAULT_TEAMS` -> `teams` (no default).
- No dangling comment references pointed at this file's `DEFAULT_TEAMS` from elsewhere (it was
  never cited outside its own module doc), so no additional comment fix was needed here.

### `StudentDialog.tsx`
- Module doc `:122-124` reworded: the old text ("`DEFAULT_TEAMS` fixture below deliberately
  includes one archived team specifically to prove the exclusion is real, not vacuous...") now
  reads: "`StudentDialog.test.tsx`'s own `TEST_TEAMS` fixture deliberately includes one archived
  team specifically to prove the exclusion is real, not vacuous (see that file's own
  `filterSelectableTeams` module doc #4 test)." This test-file fixture and its assertion already
  existed pre-T151 and needed no code change, only the citation was corrected.
- Deleted the `DEFAULT_TEAMS` constant (`:281-287` pre-fix). The surrounding "Fixture data" banner
  comment (`:276-280`) was **kept** because it also documents `DEFAULT_SEASON_INFO`, which stays.
- `teams?: readonly StudentDialogTeamOption[]` -> `teams: readonly StudentDialogTeamOption[]`
  (dropped `?` and the stale doc comment).
- Destructured default `teams = DEFAULT_TEAMS` -> `teams` (no default).
- `season`/`DEFAULT_SEASON_INFO`/`season = DEFAULT_SEASON_INFO` left byte-unchanged — confirmed via
  `git diff src/pages/roster/StudentDialog.tsx`, which shows only the two comment lines and the
  three `teams`-related lines touched; `season` does not appear in the diff at all.
- `StudentDialog.test.tsx`: confirmed zero diff (`git diff -- src/pages/roster/StudentDialog.test.tsx`
  produces no output) — every render site there already passed `teams={TEST_TEAMS}`, exactly as
  the packet predicted, and `tsc` needed no forcing edits to this file.

### `OutreachEventDialog.tsx`
- Module doc `11e` (`:375-380` pre-fix) reworded away from citing `DEFAULT_TEAMS`'s own
  declaration (which no longer exists) to instead naming the pattern's original precedent
  directly: "same 'independent duplicate, not a shared import' precedent
  `ScheduleMeetingsDialog.tsx`'s own team fixture used to follow before T151 made that dialog's
  `teams` prop required and deleted it".
- A second, closer dangling reference was also found and fixed: `DEFAULT_STUDENTS`'s own doc
  comment (immediately above its declaration, "same '...' precedent `DEFAULT_TEAMS` above already
  established") also pointed at the fixture being deleted. Reworded the same way. This second
  fixup was not explicitly named by line number in the packet but falls under "the three props'
  own doc comments... become false" and the general "no dangling reference to a deleted fixture"
  instruction, so it was corrected rather than left pointing at nothing.
- Deleted the `// Fixture teams ...` banner and the `DEFAULT_TEAMS` constant (`:601-613` pre-fix).
- `teams?: readonly OutreachTeamOption[]` -> `teams: readonly OutreachTeamOption[]` (dropped `?`
  and the stale doc comment).
- Destructured default `teams = DEFAULT_TEAMS` -> `teams` (no default).
- `students`/`DEFAULT_STUDENTS`/`students = DEFAULT_STUDENTS` left byte-unchanged — confirmed via
  `git diff src/pages/outreach/OutreachEventDialog.tsx`: the `DEFAULT_STUDENTS` array's own six
  content lines (`{ id: 'student-ravens-1', ... }` etc.) do not appear in the diff at all, only
  its preceding doc-comment citation and the unrelated `teams`-prop lines above/below it.

## Test-file fixture approach

### `ScheduleMeetingsDialog.test.tsx`
Added one shared module-level fixture, `TEST_TEAMS`, porting `DEFAULT_TEAMS`'s exact former
contents:
```ts
const TEST_TEAMS: readonly ScheduleTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];
```
This file has no `students`/roster id-coupling constraint (`ScheduleMeetingsDialogProps` is
`isOpen`/`onOpenChange`/`teams`/`onCreateMeetings` only, confirmed at `:524-529` post-fix), so any
fabricated ids would have worked; reusing the deleted fixture's own ids was simplest and required
inventing nothing new. Referenced at all 10 render sites that previously omitted `teams`
(`root.render`/`Harness` calls at what were lines 353/380/415/435/472/519/554/575/588/591
pre-edit). No `it(` body's assertions were changed — every edit is either a new `teams={TEST_TEAMS}`
prop on an existing render call, or a resulting multi-line JSX reformat of an existing render call
(Prettier-driven once the extra prop pushed the line over the width limit). Confirmed via
`git diff` review: every `-`/`+` pair is either the fixture declaration itself, or an unchanged
render call gaining `teams={TEST_TEAMS}`.

### `OutreachEventDialog.test.tsx`
Added one shared module-level fixture, `TEST_TEAMS`, again porting `DEFAULT_TEAMS`'s exact former
contents (`'team-ravens'`/`'team-titans'`) — **this was the load-bearing choice, not the simpler
one.** This file's `DEFAULT_STUDENTS` fixture (`OutreachEventDialog.tsx:618-623`, untouched,
out of scope) hardcodes `teamId: 'team-ravens'`/`'team-titans'`, and `groupActiveRosterByTeam`
(`:905` in the pre-fix numbering) matches on team id. Every one of the 24 flagged render sites in
this file omits `students` (i.e. still relies on the `students = DEFAULT_STUDENTS` default), so
every one of them needed a `teams` value whose ids line up with `DEFAULT_STUDENTS`'s roster ids —
confirmed directly by the field-order test's own assertion list, which expects "Riley Chen" /
"Jordan Blake" / "Sam Okafor" / "Casey Nguyen" to be visible at the default (all-teams-selected)
state. I did not attempt the "confirm every site overrides `students` too" alternative path the
packet allows, because it plainly does not hold here — porting the exact ids was both correct and
simpler. The one pre-existing render site that already supplied its own `teams`/`students`
override (the "scopes the visible roster... via the injectable students/teams props" test, using
locally-scoped `team-a`/`team-b`/`student-a`/`student-b`) was left untouched — it never needed
`TEST_TEAMS` and wasn't one of the 24 flagged errors.

Referenced `TEST_TEAMS` at all 24 previously-failing render sites. No `it(` body's assertions were
changed — same audit method as above (`git diff` reviewed line-by-line for anything beyond a new
`teams={TEST_TEAMS}` prop or the resulting multi-line reformat of an existing call).

## Mechanism-closure proof (criterion 3) — exact error text per dialog

For each dialog, a temporary component was appended to the end of its own test file, rendering
the dialog with `isOpen`/`onOpenChange` only (omitting `teams`), `tsc` was run, the exact error
text recorded, then the temporary block was removed and `tsc` re-run to confirm clean.

**`ScheduleMeetingsDialog.test.tsx`:**
```tsx
function TempMechanismProofScheduleMeetingsDialog(): ReturnType<typeof ScheduleMeetingsDialog> {
  return <ScheduleMeetingsDialog isOpen onOpenChange={() => {}} />;
}
```
`npx tsc --noEmit` output:
```
src/pages/meetings/ScheduleMeetingsDialog.test.tsx(622,10): error TS6133: 'TempMechanismProofScheduleMeetingsDialog' is declared but its value is never read.
src/pages/meetings/ScheduleMeetingsDialog.test.tsx(623,11): error TS2741: Property 'teams' is missing in type '{ isOpen: true; onOpenChange: () => void; }' but required in type 'ScheduleMeetingsDialogProps'.
```
(The `TS6133` unused-declaration error is a byproduct of the temporary function never being
referenced — expected noise, not part of the mechanism proof itself; the `TS2741` line is the
actual proof.) Removed the temporary block; `npx tsc --noEmit` filtered for this file returned no
output afterward.

**`StudentDialog.test.tsx`:**
```tsx
function TempMechanismProofStudentDialog(): ReturnType<typeof StudentDialog> {
  return <StudentDialog isOpen onOpenChange={() => {}} />;
}
```
`npx tsc --noEmit` output:
```
src/pages/roster/StudentDialog.test.tsx(600,10): error TS6133: 'TempMechanismProofStudentDialog' is declared but its value is never read.
src/pages/roster/StudentDialog.test.tsx(601,11): error TS2741: Property 'teams' is missing in type '{ isOpen: true; onOpenChange: () => void; }' but required in type 'StudentDialogProps'.
```
Removed the temporary block; confirmed the file's diff against the merge base returned to empty
(`git diff -- src/pages/roster/StudentDialog.test.tsx` -> no output), and a full `tsc` run
afterward was clean.

**`OutreachEventDialog.test.tsx`:**
```tsx
function TempMechanismProofOutreachEventDialog(): ReturnType<typeof OutreachEventDialog> {
  return <OutreachEventDialog isOpen onOpenChange={() => {}} />;
}
```
`npx tsc --noEmit` output:
```
src/pages/outreach/OutreachEventDialog.test.tsx(1624,10): error TS6133: 'TempMechanismProofOutreachEventDialog' is declared but its value is never read.
src/pages/outreach/OutreachEventDialog.test.tsx(1625,11): error TS2741: Property 'teams' is missing in type '{ isOpen: true; onOpenChange: () => void; }' but required in type 'OutreachEventDialogProps'.
```
Removed the temporary block; `npx tsc --noEmit` filtered for this file returned no output
afterward.

**Final full `npx tsc --noEmit` run (all three temporary blocks removed): exit code 0, zero
output.** All three dialogs independently proved to reject a future call site that omits `teams`,
and all three were confirmed clean again after the temporary render was removed.

## Full gate results (computed at own merge base, branch `t151-work` off `dcfa6e0`)

1. **`npx tsc --noEmit`** — clean, 0 errors, exit 0.
2. **`npx vite build`** — succeeded (`✓ built in 8.42s`). Only pre-existing warning
   (`index-CsdRWfIJ.js` > 500 kB chunk-size advisory, unrelated to this task, not a build failure).
3. **`npm run format:check`** — `All matched files use Prettier code style!`
4. **`npx eslint .`** — `✖ 357 problems (0 errors, 357 warnings)`. Exact match to the packet's
   orientation baseline (0 errors / 357 warnings) — the new `TEST_TEAMS` fixtures didn't trip any
   new lint rule.
5. **`npx vitest run`** — `Test Files 67 passed (67)`, `Tests 1591 passed (1591)`. Exact match to
   the packet's 67-file/1591-test orientation baseline — **no delta**, because this task added
   props to existing render calls and one new shared constant per touched test file, with zero
   new `it(`/`describe(` blocks.

## Confirmation: out-of-scope items untouched

- `StudentDialog.tsx`: `season`/`DEFAULT_SEASON_INFO`/`season = DEFAULT_SEASON_INFO` are
  byte-unchanged. `git diff src/pages/roster/StudentDialog.tsx` shows only the `:122-124` comment
  reword and the three `teams`-signature lines (doc comment removed, `?` dropped, default
  dropped) plus the `DEFAULT_TEAMS` constant deletion — `season`/`DEFAULT_SEASON_INFO` do not
  appear anywhere in the diff.
- `OutreachEventDialog.tsx`: `students`/`DEFAULT_STUDENTS`/`students = DEFAULT_STUDENTS` are
  byte-unchanged (the six roster-row content lines never appear in the diff). Only its preceding
  doc-comment citation of `DEFAULT_TEAMS` was reworded (see "The fix" above), which is a comment
  fix required by the task, not a change to the fixture or the prop itself.
- Production call sites (`OutreachList.tsx`, `OutreachDetail.tsx`, `StudentsTab.tsx`,
  `MeetingsList.tsx`) were not touched, and `tsc` raised zero errors against any of them, matching
  the packet's premise that all four already pass real `teams`.

## Commit

Staged and committed on branch `t151-work` (checked out from `dcfa6e0` after the merge), using
explicit pathspecs per constitution item 22 (no `git add -A`/`git add .`).

## Anything unverified

- I did not independently re-derive the "seven instances, three production bugs" framing from
  `task-ledger.md` — I took the packet's characterization of the defect family's history at face
  value, since the task itself (make three specific props required, delete three specific
  fixtures) does not depend on that count being exactly right.
- I did not run the full test suite under any environment other than this worktree's installed
  Node/npm toolchain (whatever `npm ci` resolved) — no cross-version check was performed or asked
  for.
- The `react-refresh/only-export-components` warnings in the eslint output are all in files this
  task did not touch (`StudentsTab.tsx`, `TeamsTab.tsx`, `SeasonSettings.tsx`, `SettingsPage.tsx`,
  etc.) — pre-existing, not introduced by this change; I did not attempt to enumerate every one of
  the 357 individually against a pre-merge eslint baseline, only confirmed the aggregate 0
  errors / 357 warnings figure matches the packet's stated orientation number exactly.
