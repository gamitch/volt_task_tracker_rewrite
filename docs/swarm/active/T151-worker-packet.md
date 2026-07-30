# Worker Packet: T151 — make the dialog `teams` prop required, delete the three `DEFAULT_TEAMS` fixtures

## Header — read before anything else

**Branch tip `03efe47` on `claude/swarm-plan-zl575z`.** This packet is
authored directly against that commit by `foreman-planner`, reading the live
working tree (no Bash available to this role — every line citation below was
confirmed with `Read`/`Grep`, not assumed, and is marked **read-verified**).
Figures attributed to "the orchestrator" are **measured**, not read-verified
by me — the orchestrator ran the actual change in a throwaway worktree and
ran `tsc`. Where the two provenances matter I say so explicitly.

**This packet was NOT premise-gated.** T151 is mechanical and
compiler-enforced, and the owner has twice flagged process churn from
over-gating simple work — so this goes to you directly, with the caveat that
anything below marked "unverified" has not been through a second pair of
eyes yet. Attempt count: 0 (first dispatch).

**FIRST ACTION.** Your worktree was almost certainly cut from `main`
(`f7ff055`), which does not contain this packet or any of today's work:

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. If it conflicts, stop and report rather than resolving it
yourself.

**Re-derive the numbers in this packet at your own dispatch SHA before
trusting them.** The orchestrator measured 34 `tsc` errors (all `TS2741`) at
its own throwaway-worktree commit, and an earlier independent probe recorded
in the ledger measured the same shape at `af28914`. Both predate your actual
starting commit. Run the same experiment yourself first (see "Step 0" below)
and treat a mismatch as a signal that something changed underneath this
packet, not as your own mistake.

## The bug this task closes

Three dialogs each declare an optional `teams` prop backed by a module-level
`DEFAULT_TEAMS` fixture, with no compiler-level guarantee that a caller
supplies real data. This exact shape shipped three of the owner's four
production bugs (`task-ledger.md` T151/T155/T158/T159/T170 rows — the same
family, seven instances total). T147 (merged `a44fb31`) fixed the
*instances* by passing real teams at all three production call sites. T151
fixes the *mechanism*: make `teams` required and delete the fixtures, so the
next call site that forgets cannot silently fall back to fixture data.

Three declarations, all read-verified just now against `03efe47`:

**`ScheduleMeetingsDialog.tsx`**
```ts
// :319-322 (fixture)
const DEFAULT_TEAMS: readonly ScheduleTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];
// :539-540 (prop + its doc comment)
/** Defaults to `DEFAULT_TEAMS` (fixture, module-level doc). */
teams?: readonly ScheduleTeamOption[];
// :548 (default)
teams = DEFAULT_TEAMS,
```
A banner comment sits directly above the fixture, `:312-317` ("Fixture teams
… Standalone default … deliberate, independent duplicate, not a shared
import"). It is deleted along with the fixture — no action needed beyond
deleting it as part of the block.

**`StudentDialog.tsx`**
```ts
// :281-286 (fixture)
const DEFAULT_TEAMS: readonly StudentDialogTeamOption[] = [
  { id: 'team-ironclad', name: 'Ironclad', archived: false },
  { id: 'team-voltage', name: 'Voltage', archived: false },
  // Module doc #4 -- proves `filterSelectableTeams` actually excludes this.
  { id: 'team-legacy-forge', name: 'Legacy Forge', archived: true },
];
// :411-412 (prop + its doc comment)
/** Defaults to `DEFAULT_TEAMS` (fixture, module-level doc). */
teams?: readonly StudentDialogTeamOption[];
// :423 (default)
teams = DEFAULT_TEAMS,
```
**A dangling comment reference you must fix, not just the prop doc.**
`:122-124` (module doc, well above the fixture): *"`DEFAULT_TEAMS` fixture
below deliberately includes one archived team specifically to prove the
exclusion is real, not vacuous (see this task's worker output / test
file)."* Read-verified: `StudentDialog.test.tsx:137-141` already declares
its own `TEST_TEAMS` with an identical archived-team case, and
`:196-202`'s `filterSelectableTeams (module doc #4)` test already exercises
it against `TEST_TEAMS`, not `DEFAULT_TEAMS`. So the archived-exclusion
proof already lives in the test file and does not depend on
`DEFAULT_TEAMS` surviving. Reword `:122-124` to point at
`StudentDialog.test.tsx`'s `TEST_TEAMS` instead of a fixture that will no
longer exist "below."

**`OutreachEventDialog.tsx`**
```ts
// :610-613 (fixture)
const DEFAULT_TEAMS: readonly OutreachTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];
// :963-964 (prop + its doc comment)
/** Defaults to `DEFAULT_TEAMS` (fixture, module-level doc). */
teams?: readonly OutreachTeamOption[];
// :981 (default)
teams = DEFAULT_TEAMS,
```
**A second dangling comment reference, more consequential than
`StudentDialog`'s because the fixture it names is NOT being deleted.**
`:375-380` is part of the `students` prop's own module doc (11e), and reads:
*"same 'independent duplicate, not a shared import' precedent this file's
own `DEFAULT_TEAMS` already established (module doc above `DEFAULT_TEAMS`'s
own declaration…)."* `DEFAULT_TEAMS` is being deleted; `DEFAULT_STUDENTS`
(the `students` prop's fixture, `:618-623`) is **not** — it is a separate,
explicitly out-of-scope instance of the same defect family (see "Out of
scope" below). Reword this citation so it doesn't point at a fixture that no
longer exists — e.g. cite the pattern itself ("independent duplicate, not a
shared import — the same posture `ScheduleMeetingsDialog.tsx`'s fixtures
used to follow") rather than a specific declaration you are deleting.

## Step 0 — reproduce the premise yourself, in your own worktree only

Per constitution item 23, mutation experiments run in the agent's own
worktree, never the shared tree — you already have your own, so this is
satisfied by construction, but do not run this against any other checkout.

Before writing the real fix: make all three props required
(`teams: readonly XTeamOption[]` — no `?`, no default), delete all three
`DEFAULT_TEAMS` fixtures, and run `npx tsc --noEmit`. Confirm you see
errors clustered in exactly two files —
`OutreachEventDialog.test.tsx` and `ScheduleMeetingsDialog.test.tsx` — all
`TS2741` ("Property 'teams' is missing…"), and zero errors anywhere in
`src/` production source (every production render site already passes
`teams` — `OutreachList.tsx:3194`, `OutreachDetail.tsx:1825`,
`StudentsTab.tsx:1374`, `MeetingsList.tsx:2221`, all read-verified as
already passing a `teams=`/`teams={…}` prop). Report your own counts even if
they differ from the orchestrator's 34/24/10 — a changed number since
`af28914`/the orchestrator's own probe is expected and not itself a
problem, but explain the delta.

If your numbers are structurally different (errors outside the two test
files, or errors in production source), **stop and report** — that means
something in the tree has changed since this packet was written and the
premise needs re-checking before you build the rest of the fix on top of it.

## The fix

1. In all three dialog source files: change `teams?: readonly X[]` to
   `teams: readonly X[]` (drop the `?`), drop the `= DEFAULT_TEAMS` default
   from the destructured props, delete the `DEFAULT_TEAMS` constant and its
   banner comment, and fix the two dangling comment references described
   above (`StudentDialog.tsx:122-124`, `OutreachEventDialog.tsx:375-380`).
   Also drop the now-stale `/** Defaults to `DEFAULT_TEAMS`... */` doc
   comment on each prop (it no longer defaults to anything).

2. In `OutreachEventDialog.test.tsx` and `ScheduleMeetingsDialog.test.tsx`:
   add **one** module-level shared local fixture per file and pass it at
   every render site that currently omits `teams`. **Do not write 34
   separate inline arrays** — that reproduces the exact fixture-proliferation
   problem this task exists to close, just relocated into the test files.
   One `const TEST_TEAMS = [...]` (or whatever name matches this file's own
   convention — `StudentDialog.test.tsx` already calls its equivalent
   `TEST_TEAMS`, follow that if there's no reason not to) referenced at
   every call site is the whole deliverable for this part.

   **`OutreachEventDialog.test.tsx` — preserve the exact ids, this is not
   optional.** `DEFAULT_STUDENTS` (`OutreachEventDialog.tsx:618-623`, NOT
   being deleted — see "Out of scope") hardcodes
   `teamId: 'team-ravens'` / `'team-titans'`, and
   `groupActiveRosterByTeam` (`:905`) matches
   `student.teamId === team.id`. Today, tests that omit `teams` get
   `DEFAULT_TEAMS`'s matching ids for free via the fixture default. Once
   `teams` is required, any test that still relies on `students` defaulting
   to `DEFAULT_STUDENTS` (i.e. doesn't override `students` itself) needs its
   explicit `teams` fixture to use the **same ids**
   (`'team-ravens'`/`'team-titans'`) or the roster-matching tests break with
   an error that reads like a harness bug — `No label found for "Riley
   Chen"` — rather than an obviously-related fixture mismatch. The simplest
   correct move: port `DEFAULT_TEAMS`'s exact contents
   (`[{id:'team-ravens',name:'Ravens'},{id:'team-titans',name:'Titans'}]`)
   into the test file as its shared fixture. You are not required to do this
   if you've confirmed every affected render site also overrides `students`
   with matching ids — but state which approach you took and why in your
   output doc.

   `ScheduleMeetingsDialog.test.tsx` has no `students` prop or roster
   matching (`ScheduleMeetingsDialogProps` is `isOpen`/`onOpenChange`/
   `teams`/`onCreateMeetings` only — confirmed, `ScheduleMeetingsDialog.tsx:
   536-543`), so there's no id-coupling constraint there. Porting
   `DEFAULT_TEAMS`'s exact contents is still the simplest choice (already
   fabricated per constitution item 6, no new names to invent) but not
   load-bearing the way it is for `OutreachEventDialog.test.tsx`.

3. **Prove the mechanism actually closed — this is the actual point of the
   task, not a formality.** A green suite on the current tree only proves
   today's call sites compile; it does not prove a *future* omission would
   be caught. In your own worktree: add one temporary render at each of the
   three dialogs that omits `teams` entirely, run `npx tsc --noEmit`,
   confirm it fails with `TS2741` naming the missing `teams` property, then
   remove the temporary render and confirm `tsc` is clean again. Do this for
   all three dialogs, not just one — they are three separate `props`
   interfaces and nothing guarantees the same result at all three just
   because it held at one. Report the exact error text you saw at each.

## Out of scope — read before touching anything adjacent

**`StudentDialog.season` and `DEFAULT_SEASON_INFO` are explicitly NOT part
of this task.** `StudentDialog.tsx` declares a fourth
optional-prop-with-fixture-default in the exact same shape:
`season?: ActiveSeasonGoalInfo` (`:413-414`) defaulting to
`DEFAULT_SEASON_INFO` (`:290`, `{ defaultGoalHours: 100 }`). It sits four
lines below `DEFAULT_TEAMS` under an identical "Fixture data" banner
comment (`:275-279`) — you will see it while editing this file and it will
look like it belongs to the same cleanup. **It does not.** T159
(`task-ledger.md`) is the task that threads a real season value in; making
`season` required now would be a breaking change with nothing to pass it,
and T159 depends on this NOT having happened yet. Leave `season`,
`DEFAULT_SEASON_INFO`, and the default assignment `season =
DEFAULT_SEASON_INFO` byte-unchanged. State in your output doc that you
confirmed this (a diff of the surrounding lines showing only `teams`-related
changes is sufficient evidence).

**`OutreachEventDialog.students`/`DEFAULT_STUDENTS` are also NOT part of
this task** — same defect family, different prop, not this ticket. Leave
the `students?`/`DEFAULT_STUDENTS` declaration and default untouched. You
will need to *read* `DEFAULT_STUDENTS`'s exact contents (see fix step 2
above) but not modify it.

**Do not touch any production call site.** `OutreachList.tsx`,
`OutreachDetail.tsx`, `StudentsTab.tsx`, `MeetingsList.tsx` already pass real
`teams` at their one render site each (confirmed by direct grep against
`03efe47` — this packet does not ask you to re-verify that, but if `tsc`
surfaces an error in any of these four files, stop and report rather than
editing a file outside your Allowed Files).

**Do not edit `StudentDialog.test.tsx` unless the required change forces
it.** It should not: every render site there already passes
`teams={TEST_TEAMS}` (confirmed, `:299`/`:322`/`:336`/`:354` and others —
grep the file for `teams={TEST_TEAMS}` to see the full set), and `tsc`
against the fully-applied change produced zero errors in this file. If your
own Step 0 run disagrees, report exactly what broke before touching this
file.

## Acceptance Criteria

1. All three dialogs: `teams` is a required prop (no `?`), no default value,
   `DEFAULT_TEAMS` deleted, in `ScheduleMeetingsDialog.tsx`,
   `StudentDialog.tsx`, `OutreachEventDialog.tsx`. `season`/
   `DEFAULT_SEASON_INFO` in `StudentDialog.tsx` and `students`/
   `DEFAULT_STUDENTS` in `OutreachEventDialog.tsx` byte-unchanged — show a
   diff scoped to just the `teams`-related lines as evidence.
2. The two dangling comment references (`StudentDialog.tsx:122-124`,
   `OutreachEventDialog.tsx:375-380`) no longer cite a fixture that doesn't
   exist. The three stale `/** Defaults to `DEFAULT_TEAMS`... */` prop-doc
   comments are removed or corrected.
3. **The mechanism proof (Step 0's post-fix repeat, all three dialogs):** a
   temporary render omitting `teams` fails `tsc` with `TS2741` naming
   `teams`, at each of the three dialogs, independently. Removed afterward,
   `tsc` clean. This is the one criterion that a currently-green suite would
   not otherwise prove — do not skip it or treat it as redundant with
   criterion 6.
4. Exactly one new shared test fixture per touched test file (expect 2 new
   fixtures total: one in `OutreachEventDialog.test.tsx`, one in
   `ScheduleMeetingsDialog.test.tsx`), not per-site inline arrays. State the
   fixture name(s), the exact ids used, and — for
   `OutreachEventDialog.test.tsx` specifically — whether you preserved
   `'team-ravens'`/`'team-titans'` and why (see fix step 2). Names may be
   fabricated freely (constitution item 6); ids matter only where the
   `DEFAULT_STUDENTS` coupling applies.
5. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint
   .`, `npx vitest run` all clean (0 errors on each). **Baseline for
   orientation only, re-measure your own**: current branch state is
   reported as 67 files / 1591 tests, eslint 0 errors / 357 warnings.
   **Expect the test count to change** — you're adding fixtures, not
   necessarily new `it(` blocks, so the count may hold steady or shift
   slightly depending on whether you add any assertions beyond passing the
   new prop. Report your actual numbers and explain any delta; do not treat
   a changed number as automatically wrong.
6. Every existing test in the two touched test files still exercises the
   same behavior it did before — you are adding a prop to existing render
   calls, not rewriting assertions. If any existing `it(` body needed a
   change beyond adding `teams={TEST_TEAMS}` to a render call, explain why.
7. No forbidden-file violations (see below). No leftover scratch files.

## Allowed Files

- `src/pages/meetings/ScheduleMeetingsDialog.tsx`
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx`
- `src/pages/roster/StudentDialog.tsx`
- `src/pages/roster/StudentDialog.test.tsx` (expected zero-diff per "Out of
  scope" above — only touch if `tsc` forces it, and report why if you do)
- `src/pages/outreach/OutreachEventDialog.tsx`
- `src/pages/outreach/OutreachEventDialog.test.tsx`
- `docs/swarm/active/T151-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- `src/pages/outreach/OutreachList.tsx`, `OutreachDetail.tsx`,
  `src/pages/roster/StudentsTab.tsx`, `src/pages/meetings/MeetingsList.tsx`
  — all four already pass real `teams`; if `tsc` disagrees, stop and report
  rather than editing
- `src/pages/home/**` — T176 landed here today, unrelated and in flux
- `src/lib/supabase/**`
- `node_modules/`

## Relevant Constitution Excerpts

- **Item 6** — fixture data must use fabricated names. Both `DEFAULT_TEAMS`
  declarations you're deleting already followed this; any test fixture you
  add must too (trivially satisfied by reusing the same fabricated
  `Ravens`/`Titans`/`Ironclad`/`Voltage`/`Legacy Forge` style names already
  in this codebase).
- **Item 18** — worker tier: this task fires none of the four opus triggers
  (no migration, no RLS/`security definer`, no metric-SQL view, no
  auth/session/role/permission logic) — it is prop-signature and test-file
  editing. You are dispatched at the default (sonnet) tier.
- **Item 23** — mutation experiments (Step 0 and criterion 3's temporary
  renders) run in your own worktree only, never a shared tree. You have
  one; use it.
- **Item 25 (new today)** — proportionality. This task has no security or
  privacy dimension (no PII, no RLS, no auth). Do not manufacture ceremony
  around it — the compiler enforces the actual guarantee this task delivers,
  and the acceptance criteria are written to lean on that rather than on
  elaborate proof-construction.
- **Item 22** — explicit pathspecs only. Stage named paths in every commit,
  never `git add -A`/`git add .`.
- **Item 21** — state the commit SHA your work lands in; the orchestrator
  verifies existence, not just a clean working tree.

## Most Recent Failure

None — first dispatch of this task, no premise-gate rounds behind it.

## Required Worker Output

Create `docs/swarm/active/T151-worker-output.md` covering:

- Step 0's reproduction: your own error count/location, and whether it
  matched the orchestrator's 34/24/10 — if not, what differed and why.
- The exact diff at each of the three dialogs (prop signature, default
  removal, fixture deletion, the two comment fixes).
- Which approach you took for `OutreachEventDialog.test.tsx`'s fixture ids
  (ported `DEFAULT_TEAMS` verbatim, or confirmed every site overrides
  `students` too) and why.
- The exact `TS2741` error text observed at each of the three
  temporary-omission proofs (criterion 3), and confirmation each was
  removed and `tsc` returned clean afterward.
- Full command output for `tsc`/`build`/`format:check`/`eslint`/`vitest`,
  with your own final numbers and an explanation of any delta from the
  67-file/1591-test/357-warning baseline.
- Confirmation `season`/`DEFAULT_SEASON_INFO` (`StudentDialog.tsx`) and
  `students`/`DEFAULT_STUDENTS` (`OutreachEventDialog.tsx`) are
  byte-unchanged.
- The commit SHA your work lands in (item 21).
- Anything you could not verify, stated plainly as unverified — do not
  paper over a gap.

Do not mark this task complete. A checker verifies it.
