# GAM-305 run log

**Issue:** [GAM-305](https://linear.app/gamitch/issue/GAM-305/t615-the-schedule-meetings-team-picker-offers-archived-teams-the) —
T615 — The schedule-meetings team picker offers archived teams; the roster picker excludes them
**Branch:** `claude/gam-305-archived-team-pickers`
**Run started:** 2026-08-12

Append-only. One line per milestone, pushed immediately. If the last line of
this file is a subagent *dispatch* with no matching *verdict*, the run died
holding that subagent — that is the failure signature AGENTS.md § "Two walls"
describes, not a mystery.

---

- `2026-08-12T19:31Z` — **Claimed.** `Todo → In Progress` via Linear GraphQL, read back and confirmed (`state.name = "In Progress"`, `updatedAt 2026-08-12T19:31:04.652Z`). Item 28c satisfied.
- `2026-08-12T19:32Z` — **Tiered HEAVY** (item 28d, item 26). Label `tier/unreviewed → tier/heavy`, read back and confirmed. Reasoning recorded below.
- `2026-08-12T19:33Z` — Branch `claude/gam-305-archived-team-pickers` created off `main` (item 28g / `WORKFLOWS.md` rule 2).

- `2026-08-12T19:45Z` — **Packet written** (`GAM-305-packet.md`), citations verified against `main` first (item 19c). Three corrections to the issue text found: `meetings.ts:392`→`:402` and the loader path is `src/lib/supabase/loaders/`; `coachHome.ts:39-40`→`:36-40`; criterion 5's "or a type error" is false (both loaders cast `as TeamDbRow[]`, so a select-string change compiles). Four sites the issue does not name found: `ScheduleMeetingsDialog.tsx:876,908` and `OutreachEventDialog.tsx:1048,1072` — the edit/open resets, which extend the criterion-4 sentinel hazard to the edit path.
- `2026-08-12T19:47Z` — **Dispatched `checker-premise` (round 1, opus) on the packet** (item 19, `run_in_background: false`). *If this line is the last one in this file, the run died holding this subagent.*

- `2026-08-12T19:57Z` — **`checker-premise` round 1 returned: REVISE.** Subagent completed; nothing left in flight. 1 BLOCKER, 3 MAJOR, 3 MINOR, 1 NIT. It ran real experiments in its own worktree (item 23) — `npx tsc --noEmit` ×4 and a purpose-built `gate305.test.tsx` driven across baseline / two mutations / full prescription — rather than only reading. Verdict summary:
  - **F1 BLOCKER** — packet §3b is not implementable inside its own Allowed Files. `outreach.ts:722`'s mapper returns `TeamOption` from `OutreachDetail.tsx:822` (a *cross-page* exported interface), and `MeetingsList.tsx:627` has its own `Team`. Measured cascade: 5 files outside Allowed Files fail `tsc`, in two waves.
  - **F2 MAJOR** — **my own headline claim in §2 was false.** I wrote that leaving `allTeamIds` unfiltered makes re-saving an all-teams event write an explicit array. Measured: it writes `null` on both paths, because `resolveTeamScope` compares against the same unfiltered list, and Astryx `MultiSelector` never prunes out-of-option values on mount. The real hazard is the inverse and is what criterion 7 already names.
  - **F3 MAJOR** — criterion 4's declared mutation leaves criterion 4 **green**. Exactly the "criterion that cannot fail" class criterion 3 exists to prevent.
  - **F4 MAJOR** — the prescription *introduces* a defect: an event already scoped to a since-archived team renders a raw uuid in the Team scope trigger while "Expected attendees" renders the same team's real name.
  - **F5-F8** — `groupStudentsByTeam` does not exist (it is `groupActiveRosterByTeam:901`); `queryAllTeams` has a second consumer at `outreach.ts:1131`; `StudentDialog.tsx:118-119` carries a second "ONLY place" claim; minor citation drift.
  - Confirmed: all 21 of §2's other citations exact, all three of my corrections to the issue text, HEAVY tier correct, item 18's four triggers correctly judged unmet, and the §3d out-of-scope list safe (`coachHome.test.ts:110` verified, and it refuted one live-fire risk it raised itself).
- `2026-08-12T20:05Z` — **Packet revised (round 2 submitted).** All five required revisions applied; kept `archived` required rather than taking the gate's cheaper optional path, and recorded that tradeoff explicitly as the gate asked.
- `2026-08-12T20:06Z` — **Dispatched `checker-premise` (round 2, opus).** *If this line is the last one in this file, the run died holding this subagent.*

- `2026-08-12T20:20Z` — **`checker-premise` round 2 returned: REVISE.** Subagent completed; nothing in flight. It drove four purpose-built probe renders and the full suite (93 files / 2408 tests) in its own worktree. **The gate's own round-2 prescription — the F4 remedy I wrote — was measured to destroy data:**
  - **R1 BLOCKER** — §3d's `!t.archived || selectedTeamIds.includes(t.id)` puts the archived team back into `options` as a **fully enabled row**, defeating `MultiSelector.handleSelectAll`'s deliberate protection (`MultiSelector.tsx:868-883`, which deselects only *enabled* items and keeps out-of-option values). Measured: on a legacy `[active, archived]` event, **two clicks of Select-all — the control criterion 4 itself mandates driving — rewrite the stored scope to `null`, the all-teams sentinel.** `STORED = ["1111…","2222…"]` → `SAVED = null`, while the trigger reads "Active Team". Unticking the archived team also strands it: the row vanishes and cannot be re-ticked. My §3d sentence "Nothing a coach has already saved is silently rewritten" was **false as measured**, and the round-1 pure filter it replaced did not have this defect.
  - **R2 MAJOR** — the all-teams-archived case is a **second regression the packet introduces**. `resolveTeamScope([], [])` returns `[]`, not `null`; `'{}'` matches no student under `rls.sql:159/187`, `metric_views.sql:26` and four more. An event stored `NULL`, opened and saved untouched, becomes invisible to every student and parent and drops out of every metric. Pre-fix this path wrote `null`.
  - **R3 MINOR** — criterion 1's mutation names a call site §3d deleted; criterion 9's clause 2 stays green under its own mutation.
  - **My doubt #3 was the expensive one.** I chose inclusion over `disabled` *specifically to avoid checking* `astryx-api.md`. The gate checked: `disabled` is documented at `astryx-api.md:4879` and typed at `Selector/types.ts:18`. Item 2 satisfied, better on every axis, and it fixes R1.
  - Confirmed good: **Allowed Files is now complete** — packet applied as written reaches `npx tsc --noEmit` exit 0 with **no sixth file**, and the full suite stays green (2408 tests, no currently-green test broken). Round 1's five revisions all verified applied. Criterion 4's repair confirmed genuinely reddening. Doubts #1 (required `archived`) and #5 (second `queryAllTeams` consumer) sound — the gate **withdrew its own round-1 cheaper path** on measurement.
- `2026-08-12T20:24Z` — **Round cap reached (item 19a): two rounds, two REVISE verdicts. Not running a third.** Applying the gate's own measured change set (R1/R2/R3) and dispatching on my own verification, on the gate's explicit recommendation that it is "small enough for you to apply and dispatch on your own verification". Reasoning and the one judgement call I had to make are recorded in the packet §8. **Flagged for the owner** on the issue and in the PR body: the gate ran to its cap, and both of its BLOCKERs were defects the *packet* introduced rather than defects in the original diagnosis.

## Tier decision — HEAVY, and why

Item 26's question is *can a mistake here corrupt data, or lie to a user about
their own data?* Both, and by the same mechanism:

1. **It is a write path.** `resolveTeamScope` decides what is stored in
   `events.team_ids`. The issue's own constraint (criterion 4) is that
   filtering the options list without narrowing `allTeamIds` silently changes
   the stored value from the `null` "all teams" sentinel to an explicit array —
   on *every* event created afterwards, with no visible symptom.
2. **`events.team_ids` is what RLS and metric SQL scope on** (`rls.sql:159`,
   `:187`; `metric_views.sql:26`). A wrong value there hides meetings from
   students and skews participation percentages. That is item 26's "lie to a
   user about their own data", verbatim.
3. **It is not a single module.** Two loaders, two dialogs, a widened row/option
   type, and a shared predicate whose home must be decided. STANDARD's "single
   module" condition fails outright; FAST's "≤20 lines, no write path" fails
   twice over.

Not-HEAVY was considered and rejected: the change adds no migration and no RLS
policy, so it *looks* like a UI filter. The filter is the smallest part of it.
Item 26 says take the heavier tier when two are arguable.

**Worker model tier: pinned default (sonnet), no `model: "opus"` override.**
Item 18's four triggers are `supabase/migrations/`, RLS policy or
`security definer` helper, metric-view SQL, and auth/session/role/permission
logic. This change touches none of them — it changes application data that a
policy later reads, which is not the same thing. Item 25 explicitly retires
bumping a worker because a topic *sounds* sensitive (T157 is the cited error).
HEAVY already buys a premise gate before dispatch and a reviewer after, which
item 18 names as the mechanism that catches the errors this tier makes.

---

- `2026-08-12T20:32Z` — **Packet finalised** with R1/R2/R3 applied; criteria now 1-11. Independently re-verified `disabled` at `astryx-api.md:4879` rather than taking the gate's word (item 2).
- `2026-08-12T20:33Z` — **Dispatched `worker-implementer` (pinned default model, per item 18/25).** *If this line is the last one in this file, the run died holding this subagent.*
- `2026-08-12T21:12Z` — **`worker-implementer` returned.** Subagent completed; nothing in flight. Commit **`dd6e166`**, 16 files, all inside Allowed Files (no sixth file — the gate's measurement held). Six gates all exit 0 (`tsc`, `vite build`, `format:check`, `eslint` 0 errors, full vitest 2431 tests vs 2408 baseline, scoped vitest). **10 of 11 criteria proven by mutation-replay; criterion 4 honestly reported as NOT falsifiable by its own named mutation**, with the worker declining to reword it — which is the behaviour the packet asked for. Verifying independently before accepting.
- `2026-08-12T21:16Z` — Orchestrator independently verified `dd6e166`: HEAD moved, change present in the committed blob (`git show`), 16 files all inside Allowed Files, and the core production diff read line by line — `excludeArchivedTeams`, the `selectableTeams`→`allTeamIds` split, the `teamOptions` memo declared after the `useState`, `disabled: team.archived` on the options mapping, and the `§3d-bis` empty/empty guard are all present and match the packet.
- `2026-08-12T21:17Z` — **Dispatched `checker-reviewer` (opus).** *If this line is the last one in this file, the run died holding this subagent.*
- `2026-08-12T21:29Z` — **`checker-reviewer` returned: FAIL** (1 MAJOR, 1 MINOR, 1 NIT; no BLOCKER). Subagent completed; nothing in flight. It re-ran all six gates itself (reproducing 2431/2408 exactly) and re-ran a 12-mutation battery in its own worktree rather than trusting the worker's table.
  - **MAJOR — a regression neither gate round found, and it is in the same family as the two they did.** Measured end to end on `dd6e166`: an event stored `team_ids = ['team-active']`, with one archived team on the roster, opened in edit mode and **saved without touching anything**, now writes **`null`**. Pre-fix it preserved `['team-active']`. `null` is the *all-teams* sentinel (`rls.sql:159`, `:187`; `metric_views.sql:26`), so students on the archived team gain read access to an event they were deliberately excluded from and start counting toward its participation, and the scope label flips to "All teams". Cause: narrowing `allTeamIds` to the active set makes `resolveTeamScope(['A'], ['A'])` collapse — `resolveTeamScope(['A'], ['A','B'])` was `['A']` before. Falls in the gap between criteria 7, 9 and 11; no test in the diff exercises it.
  - The checker notes, fairly, that this is a defect in **my prescription**, not in the worker's fidelity — §3c mandates that the seeding site and the comparison site use the same list, and the collapse is the mechanical consequence. It also verified that widening the comparison list back does **not** fix it (that just re-breaks criterion 7).
  - **Criterion 4 adjudicated: redundant, NOT a coverage hole.** The checker reproduced the worker's reasoning and confirmed the same mutation reddens criteria 1, 2, 3, 9-clause-2 and 10. Premise-gate round 1's prediction that criterion 2 carries it is confirmed. No rework owed, and it must not be reworded into a green tick it has not earned.
  - Clean on everything else: boundary exact (16/16 Allowed Files, no governed file touched, `groupActiveRosterByTeam` absent from the diff), item 2 satisfied (`disabled` is real, at `astryx-api.md:4884` not `:4879` — my citation drifted), **item 27 satisfied — it followed the data through `router.tsx` to the real loaders**, and the two dialogs' duplicated logic is now byte-identical. Item 25 respected: graded as correctness/data-integrity, not security.
- `2026-08-12T21:33Z` — **Dispatched `worker-implementer` fix round (attempt 2 of 3).** *If this line is the last one in this file, the run died holding this subagent.*
