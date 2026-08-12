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
