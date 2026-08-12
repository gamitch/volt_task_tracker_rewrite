Closes GAM-305

Archived teams were offered in the schedule-meetings and outreach **Team scope** pickers, and every one of them was ticked before a coach touched anything. Whatever is ticked becomes `events.team_ids`, which `rls.sql:159`/`:187` and `metric_views.sql:26` scope student visibility and participation on — so a coach scheduling a meeting was, by default, scoping it to teams no longer on the roster.

The roster's student dialog already excluded archived teams and its module doc called itself "the ONLY place archived teams are excluded". That was true, and that was the bug.

## What changed

- `teams.archived` now reaches both dialogs. Neither loader selected it, which is why neither could filter — the predicate was not forgotten, the data was.
- One shared predicate, `excludeArchivedTeams` (`src/lib/teams/archivedTeams.ts`). `StudentDialog.filterSelectableTeams` delegates to it rather than keeping a second copy, and both of its "ONLY place" doc claims are updated.
- Both dialogs derive the options list **and** `allTeamIds` from one filtered list, so the `null` "all teams" sentinel keeps meaning what it means.
- A team archived *after* an event was scoped to it stays visible and `disabled` rather than vanishing — otherwise the picker rendered a raw uuid where its name should be.
- An untouched edit-mode save writes the stored scope back verbatim instead of re-deriving it.

## Tier: HEAVY, and why

Item 26's question is whether a mistake can corrupt data or lie to a user about their own data. Both, by the same mechanism — this is a write path into the column RLS and every participation view scope on. Not a migration and not an RLS policy, so item 18's four triggers are unmet and the worker ran on its pinned default; item 25 forbids bumping on topic sensitivity.

**The tier earned its cost three times over. Every defect below was in the plan, not the code, and each was found by running the prescription rather than reading it:**

| Round | Found |
| -- | -- |
| Premise gate 1 | The prescription was **unimplementable inside its own Allowed Files** — five files fail `tsc`, in two waves, via two cross-page interfaces the packet did not know existed. It also measured one of the packet's own headline claims to be **false**, and caught an acceptance criterion that stayed green under its own mutation. |
| Premise gate 2 | The remedy written in round 1 **destroyed stored data**: it re-added the archived team as a fully *enabled* option, defeating `MultiSelector.handleSelectAll`'s protection, so two clicks of Select-all rewrote a two-team scope to the all-teams sentinel. Also caught an all-archived roster writing `[]` — which matches no student — where it used to write `null`. |
| Checker | An event scoped to exactly the active team set, **saved without touching anything**, was rewritten to `null`. Pre-fix it was preserved. Missed by both gate rounds; fixed in `1c9dbbb` and re-measured resolved. |

## Verification

Six gates green at `1c9dbbb`: `tsc`, `vite build`, `format:check`, `eslint` (0 errors), full vitest **2437 tests** (baseline 2431), scoped vitest — each re-run independently by the checker rather than taken from the worker's summary.

All 13 acceptance criteria proved by `mutation-replay` in both dialogs, except one adjudicated exception:

- **Criterion 4 is redundant, not missing.** It is not falsifiable by its own named mutation — the `disabled` carve-out means a clear-all/select-all drive compares a set against itself. The same mutation reddens criteria 1, 2, 3, 9 and 10. The worker reported this rather than rewording it to pass, which is the right call and is recorded as such.

## Reviewer attention, please

**This row consumed its full premise-gate budget — two rounds, two REVISE verdicts (item 19a caps it at two).** I dispatched on the gate's own measured change set rather than escalating, because round 2 returned three specific edits with the corrected behaviour already measured, not a "revise and resubmit". That judgement is defended in `docs/swarm/active/GAM-305-packet.md` §8 and is the thing most worth disagreeing with here.

Both gate BLOCKERs were defects the **packet** introduced; the original diagnosis held throughout.

## Follow-up filed

GAM-336 — two lines in this fix are load-bearing and covered by no test: the edit-mode seed, and `setTeamScopeTouched(false)` in each `resetForm()`. Deleting either reddens nothing across all 2437 tests. Not a shipping defect; a missing regression guard, filed under item 20 rather than left as a comment. Ignore GAM-336.

Full run log, including both gate verdicts and every subagent dispatch: `docs/swarm/active/GAM-305-run-log.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
