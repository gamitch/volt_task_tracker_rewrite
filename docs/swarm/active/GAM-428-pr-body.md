Closes GAM-428

## What changed

One predicate in `src/pages/reports/HoursTab.tsx`. `computeStudentPlannedHours`
tested only `event.countsVolunteerHours`, while `v_student_hours` — the view the
adjacent **Confirmed hrs** column comes from — requires
`counts_volunteer_hours` **and** `type = 'outreach'`:

```ts
-    if (!event || !event.countsVolunteerHours) continue;
+    if (!event || !event.countsVolunteerHours || event.type !== 'outreach') continue;
```

A competition whose admin-editable "Counts toward volunteer hours" Switch is on
therefore landed in **Planned hrs** and could never land in **Confirmed hrs**.
Both numbers sit in the same table row, so the gap needed no navigation to see.
Three stale comments in the same file are corrected alongside it, grounded in the
2026-08-03 owner ruling rather than in a view.

## What the issue got wrong

**Half of GAM-428's diagnosis was false, and the premise gate is what caught it.**
The issue named two files. The gate applied the prescribed fix to both in its own
worktree and ran the full suite: 2583/2583, *unchanged*.

`StudentHome.tsx`'s `computePlannedHours` **has no live caller.** T176 round 2
moved that card onto `v_student_goal_projection.planned_hours`
(`StudentHome.tsx:1536-1543`, `students.ts:531`); the rendered string at
`StudentHome.tsx:1647` reads a prop. Fixing it would have changed nothing a user
can see while letting the PR claim the student card was repaired. **It is left
byte-unchanged**, and this PR does not touch `src/pages/home/`.

**The real student-facing defect is in the database, and nobody had named it.**
`v_planned_rsvp_hours` joins on `e.counts_volunteer_hours` with no `type` test —
T322 fixed `v_student_hours` and `v_season_kpis` and left the *planned*-hours
views behind. That view feeds the student card **and** CoachHome's goal
projection (`CoachHome.tsx:1433/1439/2050`). It is metric-view SQL, which item 3
routes through PRD 8.4 and the owner, so it is out of reach here. Filed as
**GAM-430** — see Follow-ups.

Every line number in the issue was accurate. The error was the causal claim, not
the citations.

## Tier, stated and defended

**STANDARD** (item 26), judged before the claim per item 28d and recorded as a
comment on GAM-428 at claim time.

HEAVY's four triggers are a write path or destructive operation, RLS/auth/role
logic, a migration or metric-view SQL, or an export another session builds
against. **None applies** — precisely because the metric-view half was carved out
into GAM-430 rather than attempted here. What remains is one predicate and its
comments in a single display module, plus tests.

Not FAST: FAST is the orchestrator implementing directly with a mutation already
in hand; this needed new test seams and comment corrections whose accuracy is the
point.

**The losing argument, and a correction worth recording.** The packet's first
version defended STANDARD partly on "both call sites render into a student-facing
figure." That is false — `Reports` is `staffOnly: true` (`SideNav.tsx:129`,
`MobileNav.tsx:146`), so this is a **coach/admin-facing** number. The tier
survives, but on different grounds than it was first given.

**Process deviation, declared:** the premise gate ran one round, not two. v2 is a
strict subset of what round 1 already executed and measured green, minus the
falsified half; the only new material is comment text whose source round 1
quoted. Item 19b permits scoping the gate by risk and names re-auditing settled
ground as what it is not for. Recording the call so a wrong one is visible.

## Verification

```
GATE RUN — 3a22bb6 on claude/gam-428-planned-hours-competition-filter — tree clean

  1 tsc                                         exit 0  PASS
  2 vite build                                  exit 0  PASS
  3 format:check                                exit 0  PASS
  4 eslint                                      exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)                               exit 0  PASS       101 files / 2587 tests  baseline 2583 (+4)
  6 vitest src/pages/reports/HoursTab.test.tsx  exit 0  PASS       1 files / 39 tests  baseline 35 (+4)

VERDICT: PASS — all six gates exit 0
```

Baselines measured by the premise gate on the applied tree before the change
(2583 full, 35 scoped). The worker and the orchestrator ran the gates
independently and reported the same figures.

**Mutation replay** — run by the orchestrator in its own worktree (item 23); the
shared tree was never modified.

| Mutation | Result |
| -- | -- |
| `\|\| event.type !== 'outreach'` removed from `HoursTab.tsx:493` | **exit 1, 2 failed / 37 passed.** `GAM-428 criterion 1` (pure function) and `GAM-428 criterion 4` (through `buildStudentRows`) both red. |

Criterion 4 is the one that matters: it asserts through `buildStudentRows`, so it
follows the value into the row the table actually renders rather than stopping at
an exported function. The packet's first version had no such criterion — and
against `StudentHome.tsx` every one of its criteria would have gone green while
the surface stayed broken.

**Measured against a real database, not read from a comment.** The premise gate
stood up a scratch PostgreSQL cluster, applied 25 of 25 migrations in order, and
read the definitions back:

- `pg_get_viewdef('v_student_hours', true)` →
  `JOIN events e ON e.id = es.event_id AND e.counts_volunteer_hours AND e.type = 'outreach'::text`
- `events.type` is `text NOT NULL` with
  `CHECK (type = ANY (ARRAY['meeting','outreach','competition']))` — no enum, so
  the domain is closed at three and an allow-list on `'outreach'` cannot silently
  exclude a fourth type.

## Scope (item 27)

The fixed surface reads **real data on the real path**: `HoursTab`'s default
`loadData` is `loadHoursData` (`HoursTab.tsx:1177` → `reports.ts:577`), and
`reports.ts:437` selects `id, season_id, type, team_ids, counts_volunteer_hours`,
so `type` was already populated — no loader change was needed. Not a fixture.

This closes GAM-428's Reports surface completely. **It does not close the student
card**, which is a different mechanism and is GAM-430's work.

## Follow-ups filed

- **GAM-430** — `v_planned_rsvp_hours` is missing the `type = 'outreach'` filter,
  putting the same wrong Planned number on the student home card and CoachHome's
  goal projection. `Backlog`, `tier/unreviewed`, Medium, HEAVY under item 26.
  Filed before this PR left draft, per item 20.

## Known gaps, disclosed

- **The TypeScript number still differs from `v_planned_rsvp_hours`** by that
  view's `starts_at >= now()` future guard (`20260724000001`, T128), which this
  computation has no equivalent of. The corrected comment says so rather than
  claiming parity. Not fixed here; it is a second, older divergence.
- **`computePlannedHours` in `StudentHome.tsx` is now knowingly-dead code**
  carrying the un-fixed predicate. Left byte-unchanged deliberately. It is a trap
  for the next author who wires it up; GAM-430 names it.
- **No live database was queried.** Whether a competition currently carries the
  flag is unknown, so whether this bug is live or latent is unknown. One query by
  the owner settles it.
- **No browser render was observed.** The on-screen consequence is established
  from the loader and prop chain plus a test asserted through `buildStudentRows`,
  not from watching the page.

Linear-Issue: GAM-428
