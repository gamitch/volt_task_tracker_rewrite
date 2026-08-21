Closes GAM-439

Adds an **admin-only inline editor for the active season's default goal hours**
to the coach dashboard, writing through a **new column-scoped loader** that
touches only `seasons.default_goal_hours`.

## The bug this had to avoid, and how it avoids it

`updateSeason` is a full-row write —
`.update({ name, starts_on, ends_on, default_goal_hours })`
(`src/lib/supabase/loaders/seasons.ts`) — and `UpdateSeasonPayload` requires all
four fields. `SeasonProvider` caches the season once per mount and only
re-fetches on `refresh()`, so `activeSeason.season.name` on the dashboard is
arbitrarily stale. Reusing `updateSeason` from a dashboard control would have
saved a number and **silently reverted the season's name and dates** to whatever
that tab happened to load. No error, no conflict, last write wins — on the row
every hours-vs-goal figure in the app divides by.

The packet considered read-then-write and rejected it: re-reading immediately
before writing **narrows** the race, it does not close it. This ships
`updateSeasonGoal`, which writes one column, so the three columns the dashboard
has no business editing are outside the write entirely and a concurrent rename
in Season settings is a non-conflicting write to a disjoint column. That is the
existing discipline on this table, not a new one — `makeTogglePrivacy`
(`loaders/leaderboard_privacy.ts`) does the same, and `makeUpdateSeason`'s own
doc comment already records the principle ("deliberately never touches
`is_active`").

`updateSeason` is **not** modified. `SeasonSettings` edits all four fields from a
form showing all four; its full-row write is correct there.

## What changed

| File | Change |
| -- | -- |
| `src/lib/supabase/loaders/seasons.ts` | `+35` — `UpdateSeasonGoalPayload`, `OnUpdateSeasonGoalFn`, `makeUpdateSeasonGoal`, `updateSeasonGoal`. No new imports. |
| `src/lib/supabase/loaders/seasons.test.ts` | `+77`, new file — the key-set assertion, plus resolve and reject cases. |
| `src/pages/home/CoachHome.tsx` | `+270/-14` — the `SeasonGoalEditor` control, its injectable seam, the D5 retention, `key={season.id}`, module-doc entry #17. |
| `src/pages/home/CoachHome.test.tsx` | `+232` — role gating, all four write states, the post-save re-fetch, and the real-default seam. |

No dependency was added; `package.json` is unchanged. No migration: the column
`default_goal_hours numeric not null default 100` already exists.

### Four decisions the packet made rather than drifted into

1. **Column-scoped write, not full-row and not read-then-write** (above).
2. **Types live in the loader module.** `CoachHome.tsx` does not import from
   `SeasonSettings.tsx`; the page-to-page import is avoided by not creating one.
   The existing `UpdateSeasonPayload` is deliberately **not** relocated — that
   is a refactor of a passed, unrelated surface, and it would be its own row.
3. **Admin-only, and the gate is UI-only.** `/settings/season` is admin-gated,
   but `/` carries `RequireAuth` with no `RequireRole`, and RLS would let a coach
   write this column (`staff_all` / `is_staff()`). The control renders only for
   `user.role === 'admin'`, following the `AdminToggles` precedent — which also
   records *why* `RequireRole` is wrong for an embedded widget: it would eject a
   coach from the whole dashboard. **This is consistency with Settings, not a
   security control** (item 25), and it is stated as such rather than implied.
4. **A save re-fetches the season, and the dashboard no longer unmounts to do
   it.** See below — this is the part the premise gate rewrote.

### D5: the reason `refresh()` did not work as first specified

The premise gate did not merely read the plan; it probed it, and the probe
falsified the packet. `activeSeason.refresh()` re-enters `status: 'loading'`
synchronously, which returns `<CoachHomeLoadingSkeleton />` and **unmounts
`CoachHomeContent` entirely** — measured `hasDashboard=false, hasSkeleton=true`
immediately after `refresh()`, with `loadData` and `loadDashboardData` each
called twice per save. The packet's "success" state was *impossible as written*:
the component that would render the confirmation is destroyed in the same tick.

The fix is stale-while-revalidate retention inside `CoachHome`'s own wrapper —
keep rendering the last `'ready'` season while a refresh is in flight, so the
whole app still gets the new value and `SeasonProvider`'s **eight** other
consumers are untouched. First mount is unchanged. Round 2 then built it and
measured the success state rendering (`hasSuccess=true, hasSkeleton=false`) with
the double-fetch gone.

Round 2 also found a real defect the retention introduced: because
`CoachHomeContent` no longer unmounts, `useMilestoneToasts` state survives a
genuine season *switch*, and toast ids carry no `seasonId`, so React logged
`Encountered two children with the same key, 'team-hours-goal-25'`. Fixed by
`key={season.id}` — retention spans a refresh, not a change.

**Disclosed, not discovered later:** a *failed* post-save refresh now replaces a
working dashboard with the season-error banner. The save has already committed
and Retry recovers, but it is a new transition and it is on the record here.

## Tier, stated and defended

**HEAVY** (item 26). Trigger: **write path**. The losing argument was STANDARD on
size — "one input, one existing loader." Item 26 says tier follows risk, not the
size of the control, and this is the T305 shape: a small-looking write whose
payload corrupts a column nobody was editing. The tier paid for itself. The
premise gate's probe is what proved the specified success state could not render
and what produced D5 and the key collision; reading the render code could not
have found either.

Process actually run: packet → `checker-premise` round 1 (**REVISE** — 2 MAJOR,
6 MINOR, 2 NIT) → revision → round 2 (**DISPATCH** — 3 MINOR, 3 NIT, at the
item-19a two-round cap) → `worker-implementer` → `checker-reviewer`.

**Worker model tier: sonnet, no `model: "opus"` override, deliberately.** Item
18's four triggers are a migration file, an RLS policy or `security definer`,
metric-view SQL, and auth/session/role-resolution logic. This hits none:
migrations are forbidden by the packet, no policy is touched, there is no metric
SQL, and the admin gate is a render condition on a prop the component already
receives — not a change to how roles are resolved. Item 26's write-path trigger
sets the *process* tier, which this got in full; item 25 expressly retires
bumping a worker because a topic sounds sensitive.

## Verification

_Gate block, mutation-replay and the `e2e-personas` read-back are pasted below
before the draft flag is cleared._

## Run record

This branch carries two runs. The first opened this PR, wrote the packet and
closed the premise gate at **DISPATCH**, then died at the moment it dispatched
its worker — the failure AGENTS.md wall 2 describes, leaving a run log whose
last line was a dispatch with no verdict, exactly as that file was worded to do.
The second run recovered the branch, verified the first run's worker had
produced **nothing** (`git diff main...HEAD -- src/` empty, no orphan worktree),
and resumed at the worker rather than re-opening a gate already closed at its
two-round cap. `docs/swarm/active/GAM-439-run-log.md` is the contemporaneous
record of both.

Linear-Issue: GAM-439
