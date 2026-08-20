# GAM-389 task packet (HEAVY)

Issue: <https://linear.app/gamitch/issue/GAM-389>
Tier: **HEAVY** — item 26 (`supabase/migrations/` file + grant/RLS surface).
Worker model: **opus**, required by item 18 (creates a file under
`supabase/migrations/`; modifies grants guarding RLS-bypassing views).

## The task in one sentence

Add one additive migration that revokes `anon` privileges on the five
student-hours views that currently answer unauthenticated requests, so all six
sibling views hold the same, already-owner-ruled posture, and record in the
migration's own comment why that posture was chosen.

## Why revoke rather than document-and-keep

The issue offers two resolutions and asks for one recorded posture. **Only one
of the two is available to an agent**, and this is the packet's central claim:

- "Keep public read and write down why" is not neutral. The issue itself says
  that if it is chosen, "the leaderboard revoke should probably be reconsidered
  too — it is currently the odd one out." That revoke is a **recorded human
  owner ruling**: `20260803000001:10-16` cites `auto-mode-decisions.md`
  :1297-1316, 2026-07-31, where George was shown "leave as-is (T185 precedent)
  vs. close it off" and selected **"Close it off."** Reversing it is outside
  every agent's authority (constitution "Authority Boundaries"; item 28e).
- Revoking the five **extends** that same ruling to its own siblings. It needs
  no new authority, and it is the reading that makes acceptance criterion 1
  ("all six agree") reachable without a human in the loop.

So: revoke. If the owner wants the opposite posture, that is a one-line
`grant` migration and a decision only he can make — and the migration comment
this packet requires says exactly that, so the option stays open and legible.

## Verified facts (item 19c — checked against current `main`, not inherited)

| Claim | Status |
|---|---|
| Six views exist with the names the issue gives | **verified**, all six `create or replace view` sites located |
| `security_invoker` set as a real clause anywhere in `supabase/` | **verified absent** — appears only in prose comments; `20260805000000:47-49` states the same |
| `20260803000001` revoked `anon` on `v_leaderboard_students` | **verified**, `revoke all ... from anon` at line 59 |
| The five views carry student **names** | **FALSE — corrected below** |
| `v_event_student_hours` is a per-student view | **FALSE — corrected below** |
| Any unauthenticated app surface reads these views | **FALSE — none** |

### Correction 1 — no names are exposed, and this is decision-relevant

The issue flags this as its own open question: *"Not verified: exactly which
columns each view exposes — whether names, or only identifiers and figures.
Enumerate that before deciding, because it may change the answer."* Enumerated:

| View | Columns | Name? |
|---|---|---|
| `v_student_hours` | `student_id, season_id, confirmed_hours` | no |
| `v_student_participation` | `student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct` | no |
| `v_student_planned_hours` | `student_id, season_id, planned_hours` | no |
| `v_student_goal_projection` | `student_id, season_id, team_id, goal_hours, confirmed_hours, planned_hours` | no |
| `v_event_student_hours` | `event_id, season_id, title, starts_on, ends_on, student_count, total_hours` | no |
| `v_leaderboard_students` | `id, display_name` (`loaders/leaderboard.ts:147`) | **yes — and it is the one already revoked** |

The five expose opaque UUIDs and figures. The exposure is therefore materially
smaller than the issue's "Real names may be joined in depending on the view"
allows for — nobody can put a name to a row without separately defeating the
`students` RLS that the issue itself measured returning zero rows.

**This lowers the severity and does not change the action.** Item 25 already
says this is not a corporate threat model, and the issue never claimed a
compliance problem. The reason to ship is item 25's *other* half — the one it
leaves untouched — plus the issue's own stated cost: "nobody knows which
position is correct, so the next person to look either 'fixes' something
deliberate or leaves something accidental."

### Correction 2 — `v_event_student_hours` is per-event, not per-student

Despite its name it groups by `e.id, e.season_id, e.title`
(`20260723000001_dashboard_views.sql:269-292`). Its 11 rows are event totals.
The issue's summary — "Hours, participation percentages, planned hours and goal
projections for 22 team members" — does not describe this view. Include it in
the revoke anyway (criterion 1 is about all six agreeing), but do not repeat the
mischaracterisation in the migration comment.

### Correction 3 — the leaderboard's `DELETE` hazard does not apply here

`20260803000001:18-38` shipped `revoke all` rather than the ruling's literal
`revoke select` because `v_leaderboard_students` is auto-updatable, so an
unqualified `DELETE` needs no `SELECT` privilege — measured `DELETE 2`,
emptying `students`. That migration also records it is "the only such view in
the whole schema, all 16 surveyed."

Consistent with that: all five here are aggregate (`group by`) or multi-table
(`v_student_goal_projection` selects from `students` joined to `seasons` and two
views), and Postgres makes neither auto-updatable. **So there is no open write
path to close.** Use `revoke all` regardless — it matches the precedent
verbatim, costs nothing, and survives a future redefinition that might make one
of them simple. Do not claim in the comment that a write path was measured
open here; it was measured **closed**.

## Allowed Files

- `supabase/migrations/20260820000000_revoke_anon_student_hours_views.sql` — **create only**

Nothing else. Explicitly **not** allowed: any existing migration (item 10 —
editing an applied migration is a BLOCKER), any file under `src/`, and anything
under `.github/workflows/**` (AGENTS.md wall 1). No application code changes;
the issue says so and the reader audit confirms it.

## The change

A new additive migration containing, for each of the five views, a
`revoke all on public.<view> from anon;`, preceded by a comment block that
records the decision in the words of whoever made it, per acceptance criterion 2.

The comment must state, at minimum:

1. That the posture chosen is **revoke**, and that it extends the owner's
   2026-07-31 "Close it off" ruling (`auto-mode-decisions.md:1297-1316`, cited
   through `20260803000001:10-16`) to that view's own siblings, rather than
   being a new decision of its own.
2. That the five views expose **no names** — UUIDs and figures only — so this
   is consistency and legibility work, not an exposure fix, and item 25's
   threat model is not being re-litigated.
3. That `revoke all` (not `revoke select`) is used to match `20260803000001`
   exactly, while noting that unlike the leaderboard **none of these five is
   auto-updatable**, so no live write path was open.
4. That the reverse posture — keeping public read — remains available to the
   owner as a one-line `grant` migration, and is his call, not an agent's.
5. That `security_invoker` is deliberately **not** touched. The issue's one
   explicit constraint.

Do **not** add `revoke ... from authenticated`. `20260803000001:40-58` added
that second line as an orchestrator scope extension against an auto-updatable
view with a measured live `DELETE 1` path. Neither condition holds here, and
copying it would revoke privileges no one showed to be a hazard.

## Acceptance criteria

Numbered to the issue's own list.

1. **All six views agree on anonymous access.** After this migration, `anon`
   holds no privilege on any of the six. Measure with a scratch cluster
   (`scratch-postgres`), not by reading the file: load every migration in
   order, then read `information_schema.role_table_grants` (or
   `has_table_privilege('anon', ...)`) for all six and show zero rows / false
   for `anon`.
2. **The choice is recorded in a migration comment** covering the five points
   above.
3. **Signed-in behaviour is unchanged.** `authenticated` retains `SELECT` on
   all five — measure it, do not assume it, because a mis-scoped `revoke ...
   from public` would strip it. The full vitest suite stays green.
4. **The base tables still refuse anonymous reads** — `students` in particular.
   RLS is untouched by this migration; confirm no policy changed.
5. **The 200→401 re-run.** The issue's measured table was taken against the
   live hosted project, which this run cannot reach and which item 16 reserves
   to the owner anyway. The scratch-cluster grant measurement in criterion 1 is
   the available substitute; say so plainly rather than implying the live table
   was re-run.

## Verification required

- `scratch-postgres`: all migrations load clean, in order, with the new file
  last. A migration that fails to apply is a BLOCKER.
- The grant matrix for all six views × (`anon`, `authenticated`), before and
  after the new file.
- All six gates via `gate-run`.
- A mutation: delete one of the five `revoke` lines, re-run the grant
  assertion, watch it go red, restore, watch it go green. Commit before
  mutating (item 26's fast-tier working rule) and mutate only in an isolated
  worktree (item 23).

## Least confident decisions (item 19d)

1. **Revoke is the right posture.** Wrong if the owner reads his 2026-07-31
   "Close it off" as scoped to the leaderboard *because* it carries names —
   in which case the five nameless views were deliberately left alone and this
   migration overturns an unstated intent. Correction 1 is what makes this
   doubt real rather than rhetorical: the name-carrying view is exactly the one
   he closed. Mitigated, not resolved, by the comment recording the reverse as
   a one-line change.
2. **`revoke all` rather than `revoke select`.** Wrong if any of the five is
   auto-updatable after all and some legitimate authenticated path writes
   through it — `revoke all` on `anon` cannot affect `authenticated`, so this
   is nearly safe, but I have not enumerated writes through views anywhere in
   `src/`. What would settle it: the `is_updatable` column for all five in the
   scratch cluster.
3. **No `revoke ... from authenticated` line.** Wrong if one of the five *is*
   auto-updatable, since then the `20260803000001:40-58` reasoning transfers
   intact and I am leaving open the exact hole that migration closed. Same
   measurement settles both 2 and 3.
4. **The migration filename/timestamp `20260820000000`.** Wrong if the repo
   orders migrations by something other than filename, or if a same-day
   migration lands first from another branch. Low cost, easy to rename.
5. **That this needs no application change at all.** Wrong if some loader is
   invoked before a session is established — e.g. a prefetch on the login route
   or an email/Edge Function path running under the publishable key rather than
   the service key. I checked the router (only `/login` and `/accept-invite`
   are public) and the direct `.from()` callers, but I did **not** trace the
   Edge Functions or the weekly-digest send path to the key each uses.

## Provenance

Written by the orchestrator for GAM-389 after claiming it, 2026-08-20.
Submitted to `checker-premise` under item 19 before any worker sees it.

---

# ROUND-1 OUTCOME: NOT DISPATCHED

`checker-premise` returned **REVISE** and its MAJOR is upheld — verified by the
orchestrator directly against `auto-mode-decisions.md:1297-1316` rather than
taken on the subagent's report.

The section "Why revoke rather than document-and-keep" above is **wrong** and is
left in place unedited as the record of the error. Its claim that revoking the
five "extends" the owner's ruling and "needs no new authority" is contradicted
by the ruling's own text, which names `v_student_hours` as already anon-readable
and not part of what was being closed, and which warns against exactly this
scope-creep-by-analogy.

No worker was dispatched. No migration was written. This packet did not reach
the Definition of Ready, and the correct outcome under item 19 is that the
author does not get to proceed on it.

The deliverable is `docs/swarm/active/GAM-389-decision-memo.md`.

The gate's other findings are recorded there or carried into the follow-up:
least-confident decisions 2, 3, 4 and 5 were all settled **in the packet's
favour** by measurement, so if the owner picks Option 2 the prescription above
is measured-correct as written — minus its rationale.
