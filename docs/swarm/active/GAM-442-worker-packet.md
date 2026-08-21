# GAM-442 — worker packet (HEAVY)

**Issue:** <https://linear.app/gamitch/issue/GAM-442>
**Branch:** `claude/gam-442-event-attendance-view` · draft PR #222
**Tier:** HEAVY (item 26: "a migration or metric-view SQL" — this is both).
**Worker model:** `opus` (item 18 triggers: creates a file under
`supabase/migrations/`; creates a SQL view containing metric math).

---

## 1. The task, in one sentence

Add **one new additive migration** creating a view `v_event_attendance` that
reports attendance per **event** (one row per `events.id`), so the coach series
card's "Attendance 96.5% across 21 held" figure comes from SQL and not from a
division in TypeScript (constitution item 3 / PRD DATA-01).

## 2. Allowed Files

Exactly three **new** files. No existing file may be edited, created-over, or
deleted.

1. `supabase/migrations/20260821000000_meetings_event_attendance_view.sql`
2. `supabase/tests/gam442_event_attendance_assertions.sql`
3. `supabase/tests/run_gam442_event_attendance.sh` (mode `755`)

**Forbidden:** every existing migration (item 10 — editing an applied migration
is a BLOCKER), all of `src/**`, all of `docs/**`, `.claude/**`,
`.github/workflows/**`.

> **Deviation from the issue text, stated deliberately.** GAM-442 says "Allowed
> files: exactly one new file". This packet widens that to three because the
> issue *also* makes `scratch-postgres` mandatory and requires four proofs in
> the PR, and the skill's own closing rule is that assertions worth keeping live
> under `supabase/tests/`. Every sibling assertion set there has a runner
> (`run_t509_explicit_marks.sh`, `run_t205_anon_grant.sh`,
> `run_volunteer_hours_outreach_only.sh`); `run_t509_explicit_marks.sh`'s header
> records that shipping assertions *without* a runner was T509's own defect.
> Both added files are new, additive, and test-only. The widening is recorded
> here and in the PR body rather than done silently.

## 3. Verified premise — measured against `main` at `789e58b`, not taken from the issue

Every claim below was re-checked by the orchestrator before this packet was
written (item 19c). Citations are current.

| Claim | Status |
| -- | -- |
| No view aggregates attendance per event; `v_event_attendance` does not exist anywhere in `supabase/` or `src/` | **TRUE** (grep, 0 hits; 16 existing `v_*` views enumerated, none per-event) |
| `attendance.status` is `check (status in ('present','late','excused','absent'))`, `unique (session_id, student_id)` | **TRUE** — `20260717000000_scheduling_attendance.sql:79-93` |
| `event_sessions.status` is `check (status in ('scheduled','completed','canceled'))`, `event_id` FK `on delete cascade` | **TRUE** — same file, `:53-63` |
| `events.type` is `check (type in ('meeting','outreach','competition'))`; `team_ids uuid[]` nullable; `counts_participation boolean not null` | **TRUE** — same file, `:33-48` |
| The explicit-marks denominator convention is `count(*) - count(*) filter (where status='excused')`, returning **NULL** (not 0) when that is zero | **TRUE** — `20260806000000_met01_explicit_marks.sql:117-130`, and its `:38-61` states the rule and why the T509 row's literal phrasing would double-subtract |
| No view in this schema sets `security_invoker`, so every view executes as its **owner** and does **not** apply the querying session's RLS to base tables | **TRUE** — `20260805000000_dashboard_views_comment_corrections.sql:41-49`, measured there rather than reasoned |

**Three corrections to the issue's framing, found while measuring:**

1. **PRD 8.2 defines no per-event attendance metric.** MET-01…MET-05 are
   per-student and per-team, season-scoped. So there is **no 8.4 verbatim SQL to
   copy** for this view — item 3's "copy, do not re-derive" has no source text
   here. That is not a licence to improvise: see §5 for what governs instead.
2. **Two attendance conventions coexist on `main` today.** T509 moved
   `v_student_participation` / `v_team_participation` to explicit marks + NULL.
   It did **not** move `v_season_attendance_rate`, which still uses the old
   eligibility cross-product and `greatest(count(*),1)`
   (`20260723000001_dashboard_views.sql:197-222`). The issue names the T509
   convention and this packet holds it to that; the divergence is pre-existing,
   out of scope, and is **not** to be "fixed" here.
3. **The `held_ct` the card needs is per-event, but T509's convention counts
   marks, not sessions.** Both numbers are required and they are different
   things — see §4's column contract. Do not let one imply the other.

## 4. The column contract

One row per `events.id`, **all event types** (the issue permits this; restricting
to meetings would make the view useless to a later outreach surface for no gain).

| Column | Meaning |
| -- | -- |
| `event_id` | `events.id` — the grain. One row per event, always. |
| `held_ct` | count of that event's `event_sessions` with `status = 'completed'`. Counts **sessions**, not marks. |
| `graded_marks_ct` | count of `attendance` rows on those held sessions — every explicit mark, including excused. |
| `excused_ct` | of those, the ones with `status = 'excused'`. |
| `attended_marks_ct` | of those, the ones with `status in ('present','late')`. MET-05: late **is** present for every metric. |
| `attendance_pct` | `round(100.0 * attended_marks_ct / (graded_marks_ct - excused_ct), 1)`, or **NULL** when that denominator is `0`. |

Hard rules on this contract:

- **NULL, never a fabricated 0.** No `greatest(..., 1)` floor anywhere. An event
  with held sessions and zero marks has `attendance_pct = NULL`, and so does an
  event whose every mark is excused. The UI renders NULL as an em dash.
- **Every event gets a row, including one with zero held sessions** (`held_ct =
  0`, all mark counts `0`, `attendance_pct` NULL). The card must be able to say
  "0 held" rather than find no row and guess. Use `left join`s from `events`.
- **Marks on non-held sessions do not count**, anywhere, in any column. A
  `scheduled` or `canceled` session contributes nothing even if attendance rows
  exist against it.
- **No student-level filtering.** Do **not** join `students`, `student_teams`,
  or filter on `s.is_active` / `st.left_on` / `e.counts_participation`. See §5.2
  — this is the packet's most consequential decision and it is deliberate.
- Column types: the `*_ct` columns are whatever `count(*)` returns (`bigint`);
  `attendance_pct` is `numeric` from `round(..., 1)`. Do not cast them to
  narrower types.

Also required in the migration file:

- `comment on view public.v_event_attendance is '…'` carrying: the grain, the
  explicit-marks denominator rule, the NULL-not-zero rule, that `held_ct` counts
  sessions while every other count counts marks, and the owner-executes /
  `security_invoker`-is-off fact in the shape
  `20260805000000_dashboard_views_comment_corrections.sql` uses.
- `comment on column public.v_event_attendance.held_ct` and
  `…​.graded_marks_ct`, because those two are the pair a reader will confuse.
- `revoke all on public.v_event_attendance from anon;` — grounded in **PRD 8.3**
  ("no `anon` access except the `ics` and `checkin` Edge Functions"), which is
  normative text, and following T205's measured finding
  (`20260803000001_revoke_anon_leaderboard_students.sql:18-35`) that `revoke
  select` alone is insufficient because Supabase's stock default privileges
  grant `all`. **Verify in the cluster that this is needed and that it works**
  (§6 proof (e)); if the scratch harness shows the grant never existed, say so
  and keep the statement anyway — it is idempotent and it is what production
  needs.
- A header comment in the house style: what, why, what was measured, what was
  deliberately **not** done (the two divergences in §3).

## 5. What governs the SQL, given there is no 8.4 source text

### 5.1 Authority chain, stated so the checker can test it

Item 3 requires metric SQL to be copied from PRD 8.4 rather than re-derived.
**PRD 8.2/8.4 contain no per-event attendance metric**, so there is nothing to
copy. `boss-arbiter`'s ruling in `dispute-log.md:1873-1878` states the operative
rule this repository actually runs on: a dispute-log entry is required when the
**8.3 matrix grant** moves (D013) or an **8.4 normative formula** moves (D014).

Adding a new view for a metric the PRD never defined moves **neither**. It does
not redefine MET-01…MET-05, it does not touch `v_student_participation`,
`v_team_participation`, `v_student_hours` or `v_season_attendance_rate`, and it
does not widen a matrix grant (the view is `revoke`d from `anon`, and staff read
was already `full` on events/sessions/attendance in the 8.3 matrix,
`VOLT_Portal_PRD.md:577-579`).

**Therefore: no dispute-log entry and no `gate/human` for this task.** That
conclusion is the premise gate's first target — if it is wrong, this packet is
wrong before any SQL is written.

### 5.2 Why no student-level filtering — the decision most likely to be attacked

`v_student_participation` filters `s.is_active`, `st.left_on is null`,
`e.counts_participation`, and team scope. This view deliberately does none of
that, for three reasons:

1. **Different subject.** That view answers "how much of what was expected of
   *this student* did they attend". This one answers "how well attended was
   *this event*". Filtering an event's attendance by which students are still
   active today makes a historical event's percentage **change over time as
   students leave** — the number would silently rewrite itself.
2. **`counts_participation` is a student-metric switch, not an attendance-
   happened switch.** An event with `counts_participation = false` still had
   people show up, and a coach's series card is reporting turnout.
3. **Denominator honesty.** The T509 convention's whole point is that the
   denominator is *the marks that exist*. Filtering which marks are allowed to
   exist reintroduces an eligibility judgement through the back door.

**What would make this wrong:** if the SeriesCard ticket in the
`meetings-redesign` group intends this percentage to be MET-01-consistent — i.e.
a coach expects the event percentages to roll up to the season participation
figure. They will not, and cannot, under this decision. The premise gate must
say whether that mismatch is acceptable. It is disclosed here rather than
discovered later.

## 6. Acceptance criteria — every one measured in a real cluster

Use the `scratch-postgres` skill. **Mandatory**, per the issue. The runner you
write models `supabase/tests/run_t509_explicit_marks.sh` — same scratch-DB
lifecycle, same platform stub, same "apply every migration unchanged" loop, same
`SKIPPED_MIGRATIONS` list. Fixtures use **fabricated names** (item 6).

Each proof below must appear in your completion report as the SQL **and** its
real output. Not a description of the output.

**(a) Hand-computed percentage.** Seed one event with **2 held** (`completed`)
sessions, **1 `scheduled`**, **1 `canceled`**. Place `present`, `late`,
`excused` and `absent` marks across the held sessions, **and at least one mark
on the scheduled or canceled session that must not count**. State the
hand-computed expected value before showing the query, then show the view
agreeing with it. The `late` mark must be visibly counted as attended (MET-05)
and the `excused` mark visibly removed from the denominator.

**(b) NULL, twice.** An event with held sessions and **zero** marks →
`attendance_pct IS NULL`. An event whose **every** mark is `excused` →
`attendance_pct IS NULL`. Neither may be `0.0`. Assert `IS NULL`, not `= NULL`
and not a string comparison.

**(c) Zero-session event.** An event with no sessions at all still produces a
row: `held_ct = 0`, `attendance_pct IS NULL`. Assert the row **count is 1** for
that `event_id` — this is the `left join` proof and a plain `select` that
returns nothing would pass a careless check.

**(d) Coach read under RLS, and the weaker case.** A coach-role session
`SELECT`s the view successfully. Then re-run the ownership question the way the
skill's "Does the result generalise?" section requires: if your proof depends on
the object owner being a superuser, re-run it with a `NOSUPERUSER NOBYPASSRLS`
owner and report which case actually holds. Do not generalise silently.

**(e) `anon` grant.** Show the privilege state on the new view before and after
the `revoke` (`has_table_privilege('anon', …)` or the `information_schema`
route T205's assertions use). Report honestly if the scratch harness does not
reproduce Supabase's stock default privileges — that is a finding, not a
failure.

**(f) Nothing else moved.** Snapshot `v_student_hours`, `v_student_participation`,
`v_team_participation` and `v_season_attendance_rate` output **before** applying
the new migration and **after**, and diff. Split the migration loop as the skill
requires — applying everything at once cannot show what this migration changed.
`v_student_hours` must be **byte-identical**: meetings contribute **zero**
volunteer hours (`20260804000000_volunteer_hours_outreach_only.sql`) and that
must remain true.

**(g) A mutation proof, per item 26.** Commit the migration first, then break it
in your own worktree and watch the assertions go red. Run **two** mutations, and
report the real red output and exit code for each:
   - replace the NULL branch with `greatest(denominator, 1)` → proof (b) must fail.
   - drop the `es.status = 'completed'` restriction → proof (a) must fail.
   Restore, re-run green. **Commit before mutating** (item 26's fast-tier rule,
   which cost T323 its fix).

**(h) Gates.** Run the `gate-run` skill and paste its evidence block verbatim.

## 7. Reporting

Your completion report must state **the commit SHA** your work landed in
(item 21) — "clean" and "committed" are different claims and only the second one
survives. List every file you touched. If you touched anything outside §2, say
so plainly; do not tidy it away.

You do **not** certify your own work. A separate `checker-reviewer` grades this
against §4 and §6.

## 8. Least confident decisions (item 19d)

Attack these first.

1. **That no dispute-log entry and no `gate/human` is required (§5.1).** Wrong
   if `boss-arbiter`'s "8.4 formula moves / 8.3 grant moves" rule was meant to
   describe *sufficient* conditions rather than the *complete* test, or if
   creating any new metric view is itself an item-3 event regardless of whether
   the PRD defines the metric. If wrong, this task is owner-gated and no SQL
   should be written today.
2. **That the view must not filter by `counts_participation`, student activity,
   or team scope (§5.2).** Wrong if the SeriesCard consumer expects these
   percentages to be consistent with MET-01 season participation. They are not,
   by construction. A gate that reads the `meetings-redesign` sibling issues can
   settle this; I have not read them.
3. **That an event with zero held sessions should produce a row rather than be
   absent (§4).** Wrong if the loader ticket intends `no row` to mean "nothing
   to show" — T509 deliberately made "no marks" mean *no row at all* for
   `v_student_participation`, and this packet takes the opposite convention one
   level up. Both are defensible; they are inconsistent with each other, and I
   chose the one that lets the card render "0 held" instead of failing a join.
4. **That `revoke all … from anon` belongs in this migration (§4).** Wrong if
   the prevailing pattern is deliberate — 15 of the 16 existing views carry no
   revoke at all, and only T205's leaderboard view (which exposes names) got
   one. Item 25 explicitly warns against manufacturing a security finding by
   extending a rule. I am relying on PRD 8.3's `anon` sentence being normative
   text rather than on extending item 4. If the gate judges this out of scope,
   the statement comes out and becomes an item-20 follow-up covering **all**
   views, not just this one.
5. **That widening Allowed Files to three (§2) is correct** rather than a packet
   quietly enlarging its own scope. Wrong if the issue's "exactly one new file"
   was a deliberate boundary the owner set. Both extra files are test-only and
   new; the alternative is proofs that exist only in a transcript that is not
   saved when a run is cancelled.
