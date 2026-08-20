# GAM-389 — measurement and a two-option question for the owner

Status: **not implemented, deliberately.** The premise gate falsified the
packet's authority argument and I verified the falsification against the
primary source. This file is the deliverable in place of the migration.

## The short version

GAM-389 asks us to end an inconsistency: five student-hours views answer
unauthenticated requests, a sixth was deliberately revoked, and the issue's
position is that "one of the two is unintended."

**Measured: neither is unintended.** The line between them is principled, was
drawn knowingly, and is on the record. The five expose no names. The one that
was closed is the only one that exposes a name — and the ruling that closed it
says so in terms, while explicitly noting that the nameless siblings were
already open and were not what was being closed.

So the row's factual claims all hold, and its conclusion does not.

## What was measured, and how

Measurements A–D ran on a real PostgreSQL 16.14 cluster loaded with all 24
applicable migrations in filename order, not by reading migration comments —
this schema has already shipped one migration comment that stated the opposite
of the truth (`20260723000001_dashboard_views.sql:49-52`, corrected by
`20260805000000_dashboard_views_comment_corrections.sql`).

**1. The five expose no names. The sixth does.** This was the issue's own
declared open question — *"Not verified: exactly which columns each view
exposes… Enumerate that before deciding, because it may change the answer."*
It changed the answer.

| View | Columns | Name? |
|---|---|---|
| `v_student_hours` | `student_id, season_id, confirmed_hours` | no |
| `v_student_participation` | `student_id, team_id, season_id, expected_ct, present_ct, late_ct, excused_ct, participation_pct` | no |
| `v_student_planned_hours` | `student_id, season_id, planned_hours` | no |
| `v_student_goal_projection` | `student_id, season_id, team_id, goal_hours, confirmed_hours, planned_hours` | no |
| `v_event_student_hours` | `event_id, season_id, title, starts_on, ends_on, student_count, total_hours` | no |
| `v_leaderboard_students` | `id, display_name` | **yes — the revoked one** |

An anonymous caller gets opaque UUIDs and numbers. Putting a name to any row
means separately defeating the `students` RLS, which the issue itself measured
returning zero rows.

**2. `v_event_student_hours` is not a per-student view.** It groups by
`e.id, e.season_id, e.title` (`20260723000001_dashboard_views.sql:269-291`).
Its rows are per-event totals. The issue's summary — hours and projections "for
22 team members" — does not describe it.

**3. None of the five is auto-updatable; the leaderboard is.**
`information_schema.views.is_updatable` is `NO` for all five and `YES` for
`v_leaderboard_students` — the only `YES` among all 16 public views, which is
exactly what `20260803000001:22-24` claimed. Counterfactual in the other
direction: with DELETE granted, `delete from public.v_student_hours` raises
`SQLSTATE 55000: cannot delete from view`. So the anonymous-`DELETE`-without-
`SELECT` path that made the leaderboard revoke urgent — measured there as
`DELETE 2`, emptying `students` — **does not exist on these five.** They are
readable, not writable.

**4. Nothing breaks either way, and nothing anonymous reads them.** Only
`/login` and `/accept-invite` are public (`src/app/router.tsx:72-88`; PRD
SEC-04 forbids public pages). The one Edge Function that reads any of the five
is `supabase/functions/send-reminders/index.ts:512`, and it uses the
service-role `adminClient` (`:685`), which a revoke on `anon` cannot touch. The
anon-key clients in `checkin`, `checkin-token` and `send-invite` call only
`auth.getUser()`. The e2e persona harness never runs as `anon`.

**5. The `anon` grant comes from the platform, not from this repo.** With
Supabase's stock `alter default privileges` absent, no migration grants
anything to `anon` on any of the six. The exposure is inherited from hosted
Supabase's defaults; `20260803000001` is the only place this repo has ever
pushed back on that.

## Why this is not an agent's decision

The packet I wrote argued that revoking the five merely *extends* the owner's
2026-07-31 ruling and so needs no new authority. **That argument is wrong**, and
the ruling says why (`auto-mode-decisions.md:1297-1316`):

> …the first view in this schema to expose `display_name` that way (**the
> pre-existing `v_student_hours` was already `anon`-readable; not new**) …
> extending T185's disposition without asking would have repeated exactly the
> kind of **scope-creep-by-analogy** this project's process has flagged before.

> **What this authorizes:** … a new migration (`revoke select on
> public.v_leaderboard_students from anon;` or equivalent)

One view, named. The nameless views were visible to the owner at the moment he
ruled and were excluded from what he closed. Applying his answer to them now is
the specific move that ruling declined to make on its own, that constitution
item 25 forbids ("do not manufacture a security-class finding out of an
extension of a rule"), and that this project has already flagged twice
(`auto-mode-decisions.md:2102-2104`).

The honest reading is that GAM-389 found a real inconsistency in *appearance*
and a deliberate distinction in *fact* — and that the remaining work is a
decision, which is what the issue said it was in its first line.

## The question, structured the way T205 itself was asked

Both options are cheap. Neither is urgent: no names are exposed, nothing is
writable, nothing outside the team is known to have the URL, and item 25's
threat model is unchanged.

**Option 1 — leave it, and write the reason down.** The current posture becomes
explicit: names are closed to anonymous callers, aggregate figures keyed by UUID
are not. One documentation change; no migration; no behaviour change anywhere.
*Recommended*, on the grounds that this is what the record already says was
decided, and it is the only option that needs no new authority.

**Option 2 — close the five too.** One additive migration,
`revoke all on public.<view> from anon;` × 5. Measured to work: `anon` loses
everything on all six, `authenticated` keeps `SELECT` on all five, the repo's
own `t205` and `t700` SQL assertion suites stay green, and no app or Edge
Function path changes. Costs nothing to run and closes something that need not
be open — the same reasoning that carried T205. Choose this if the intent was
always "no anonymous reads at all" and the leaderboard was simply the first one
noticed.

Either way, one further thing is worth doing and is not blocked by the choice:

**A durable CI assertion.** T205's revoke *is* guarded
(`supabase/tests/run_t205_anon_grant.sh`, wired at `.github/workflows/ci.yml:238`).
Whichever posture is chosen, nothing currently asserts it for the other five, and
`t700`'s guard cannot catch a regression because it only fires on auto-updatable
views. A `drop view … create view` on any of the five silently restores the
platform default with no test going red. Filed separately rather than assumed.

## Not claimed

That anyone has read this data; that this is a compliance problem; that the
live hosted project was re-measured. Item 16 reserves the live project to the
owner and this run did not touch it — every number above is from a scratch
cluster or from source.
