# GAM-196 — task packet (HEAVY, round 1)

**Issue:** GAM-196 — *T188 — two different "confirmed hours" numbers exist in the app and can legitimately disagree*
**Tier:** HEAVY (defended in `GAM-196-run-log.md`)
**Branch:** `claude/gam-196-confirmed-hours-divergence`
**Base:** `main` @ `b9396c9`
**Author:** orchestrator. Every citation below was opened and read on this branch
before this packet was written (item 19c) — line numbers are current, not
inherited from the issue.

---

## 0. What the row claims, and what is actually true today

The row was diagnosed 2026-08-05 and filed 2026-08-09. This packet is written
2026-08-20. **Three of its four divergences survive re-measurement; the fourth —
the one the row leans hardest on — is falsified as written, and a different,
unnamed divergence sits behind it.**

### Verified: the core finding holds

| Claim | Status | Evidence read today |
| -- | -- | -- |
| `v_student_hours` computes confirmed hours from `attendance` | **holds** | `supabase/migrations/20260717000003_metric_views.sql:3-21` — `from attendance a`, `where a.status in ('present','late')`, `join event_sessions es … es.status='completed'`, `join events e … and e.counts_volunteer_hours` |
| `computeStudentHours` computes them from RSVP `going` + session `completed`, and never touches `attendance` | **holds** | `src/pages/outreach/OutreachList.tsx:1380-1399` — the whole body is `rsvps.find(… r.status === 'going')` then `session.status === 'completed'` → `sessionHours(session)`. No `attendance` reference in the function. |
| A `going`-but-absent student accrues hours on `/outreach` and none in `v_student_hours` | **holds** | Direct consequence of the two above. The file's own fixtures were *built* to encode it: `FIXTURE_ATTENDANCE` (`OutreachList.tsx:1347-1353`) has Cole `absent` on `session-food-bank-past` while `FIXTURE_RSVPS` has him `going`. |
| (2) `hours_override` is invisible to `computeStudentHours` | **holds** | `hours_override` is first in the view's `coalesce` (`metric_views.sql:8`); `computeStudentHours` calls `sessionHours(session)` = raw `endsAt - startsAt` (`OutreachList.tsx:1369-1372`). Grep: `hours_override`/`hoursOverride` appears nowhere in `OutreachList.tsx`. |
| (3) check-in/check-out clamping is invisible to it | **holds** | View clamps via `least(check_out_at, es.ends_at) - greatest(check_in_at, es.starts_at)` (`metric_views.sql:9-11`); `sessionHours` uses the full session span. |
| The divergence is disclosed only in source, not on screen | **holds** | `OutreachList.tsx:715-720` discloses it in a module doc and names T188. Nothing renders that disclosure. |

**Scale of the disagreement, which the row does not state and which matters for
priority:** `/outreach` is the *only* surface computing confirmed hours from
RSVPs. `v_student_hours` is read by `StudentHome.tsx`, `ParentHome.tsx`,
`CoachHome.tsx`, `Leaderboard.tsx`, `reports/HoursTab.tsx`, `reports/csvExport.ts`,
`roster/StudentDialog.tsx` and `emails/templates/weekly-digest.tsx`. So a student
sees the attendance-backed number everywhere in the app **except** `/outreach`,
and the outreach page is the one whose subject is volunteer hours.

### Falsified as written: divergence (4)

The row states: *"it counts NON-OUTREACH events — MEASURED, not inferred… the
loader queries `events` for the season with no type filter, with no JS filter
between."* It flags its own limit honestly: *"the probe proves the FUNCTION
counts a meeting… It does not render the live page."*

**That honesty was warranted — the inference does not survive.** The loader half
is still true (`src/lib/supabase/loaders/outreach.ts:740-744` selects `events`
by `season_id` with no `type` predicate; the row's `:739` is one line off). But
**there is a JS filter between**, and it is on the render path:

```
src/pages/outreach/OutreachList.tsx:4254-4258
  // Module doc #2 -- the only place events are filtered by type; every
  // session below is reached exclusively through an outreach event id.
  const outreachEvents = filterOutreachEvents(data.events);
  const outreachEventIds = new Set(outreachEvents.map((event) => event.id));
  const outreachSessions = data.sessions.filter((s) => outreachEventIds.has(s.eventId));
```

`filterOutreachEvents` (`OutreachList.tsx:1360-1362`) is `events.filter((e) => e.type === 'outreach')`.
`outreachSessions` is what reaches `computeStudentHours` at `OutreachList.tsx:3918`.
**A meeting's session cannot reach the function on the live page.** The fixture
set encodes the same intent deliberately — `event-team-meeting` carries the
comment *"This event's own session must NEVER appear anywhere this file renders"*
(`OutreachList.tsx:1121-1136`).

So T322's ruling (*volunteer hours = `type='outreach'` only*) is **already
satisfied** by `/outreach`, and the row's suggested divergence-(4) fix would be
re-implementing a filter that exists.

### Unnamed, and this packet's actual work: divergence (4′)

The two numbers do not filter on the same column.

- `v_student_hours` joins `events e on … and e.counts_volunteer_hours` — a
  **boolean flag**.
- `/outreach` filters on `event.type === 'outreach'` — a **type**.

These are not the same predicate. An event with `type = 'outreach'` and
`counts_volunteer_hours = false` **contributes confirmed hours on `/outreach`
and contributes none to `v_student_hours`** — a fourth-and-a-half divergence
that survives even for a student who RSVP'd `going`, attended, checked in on
time and has no override. It is invisible in fixtures today only because no
fixture event has that combination (`OutreachList.tsx:1064,1078,1092,1117` are
all `countsVolunteerHours: true`; the one `false` is the meeting at `:1134`,
already excluded by type).

**This is the slice that needs no owner ruling**, and the codebase has already
ruled on it twice in the same situation. `reports/HoursTab.tsx:64-78` records
the precedent verbatim:

> `OutreachList.tsx` itself only ever receives already-outreach-filtered sessions
> … so it never needed an explicit `events.counts_volunteer_hours` check on top
> of that. This tab is NOT outreach-scoped … so `computeStudentPlannedHours`
> below adds the one extra condition `StudentHome.tsx`'s own `computePlannedHours`
> (T054) already established … `event.countsVolunteerHours` must also be true —
> the same flag `v_student_hours`'s own join uses for confirmed hours, **so a
> session that could never contribute confirmed hours once completed never
> contributes planned hours either.**

Two other files already add the flag for exactly this reason. `/outreach` is the
holdout, on a premise (*"only ever receives already-outreach-filtered sessions"*)
that is true and **insufficient** — `type='outreach'` does not imply
`counts_volunteer_hours`.

### What is NOT in scope, and why

Divergences (1) RSVP-vs-attendance, (2) `hours_override`, and (3) clamping are
**not fixable without settling the row's (a)/(b) product question**, which is the
owner's and not this run's:

- (a) *name them differently on screen* changes user-facing copy and concedes two
  permanent numbers.
- (b) *make `/outreach` read the attendance-backed number* deletes the page's
  planned-vs-confirmed-from-RSVP purpose (PRD 5.7 / BEH-02), which attendance
  cannot express — a `going` RSVP on a *scheduled* session is what "planned"
  means, and there is no attendance row for a session that has not happened.

The row itself pre-authorizes this split: *"Divergence (4) may be separable from
the product question … could ship without settling (a)/(b)."* This packet takes
that split, on the corrected divergence.

---

## 1. Task

Make `/outreach`'s confirmed **and** planned hours honour
`events.counts_volunteer_hours`, matching `v_student_hours`'s own join condition
and the precedent already set by `StudentHome.tsx` and `reports/HoursTab.tsx`.

## 2. Allowed Files

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`

**Explicitly forbidden** (not merely out of scope):
`supabase/**` (no migration; the view is correct and item 3 forbids re-deriving
metric SQL), `.github/workflows/**` (AGENTS.md wall 1 — a dispatched run cannot
push these), `docs/swarm/**`, `.claude/**`, and every other `src/**` file. If the
change appears to require a file outside this list, **stop and report** rather
than widening.

## 3. Prescription

`computeStudentHours(studentId, sessions, rsvps)` has no access to event fields,
so the flag must arrive from outside it. **Do not filter `outreachSessions` at
`OutreachList.tsx:4256-4258`** — that array feeds the whole page (event lists,
RSVP controls, upcoming/past), and dropping a non-hours outreach event from it
would *hide the event*, which is a user-visible behaviour change far beyond
hours and is not authorized here.

Instead, thread the eligibility in the same shape `HoursTab.tsx` already uses:

1. Add a parameter carrying the set of session ids (or event ids) whose event has
   `countsVolunteerHours === true`. Prefer a `ReadonlySet<string>` computed once
   at the call sites over passing the whole `events` array, so `computeGroupHours`'
   per-student loop does not re-scan events.
2. `computeStudentHours` skips any session not in that set — for **both** the
   confirmed and the planned branch. The `HoursTab` precedent quoted above is
   explicit that planned must match confirmed: *"a session that could never
   contribute confirmed hours once completed never contributes planned hours
   either."*
3. Update `computeGroupHours` (`OutreachList.tsx:1403-1416`) to pass it through.
4. Update every call site. Known: `OutreachList.tsx:1411` (inside
   `computeGroupHours`), `OutreachList.tsx:3918` (the viewer's own breakdown).
   **Find the rest yourself with grep — do not trust this list to be complete.**
5. Update the module doc. `OutreachList.tsx:41` currently asserts
   `filterOutreachEvents` is *"the ONLY `event.type` predicate in this file"* —
   that stays true (the new predicate is on a boolean flag, not on `type`), but
   the doc must now say why the type filter alone was not sufficient for hours.
   `OutreachList.tsx:715-720` mentions T188; leave the T188/GAM-196 disclosure in
   place — divergences (1)(2)(3) are unresolved and the comment must not imply
   otherwise. **Amend it to say what this change did and did not fix.**

**No signature may change outside these two files.** No external module imports
`computeStudentHours` or `computeGroupHours` — verified by grep across `src/`;
`reports/HoursTab.tsx:59,77,129` reference them in *comments* only and must not
be edited.

## 4. Acceptance criteria

Each must be *measurable today* with fixtures that exist or that you add.

1. **New test, red before the fix.** A completed session on an event with
   `type: 'outreach'` and `countsVolunteerHours: false`, with a `going` RSVP for
   the student, contributes **0** confirmed hours from `computeStudentHours`.
   No such fixture event exists today — add one.
2. **Planned branch, same rule.** A *scheduled* session on that same
   `countsVolunteerHours: false` outreach event, with a `going` RSVP, contributes
   **0** planned hours.
3. **No regression on the eligible path.** Every existing assertion in
   `describe('computeStudentHours / computeGroupHours (BEH-02: never summed)')`
   (`OutreachList.test.tsx:399+`) still passes unchanged. If one must change, that
   is a **finding to report, not an edit to make** — constitution non-negotiable:
   existing tests pass unless the boss approves the update.
4. **`computeGroupHours` inherits it** — a group total excludes the ineligible
   session for every member.
5. **Item 27 — real path, not a stub.** The viewer's on-screen confirmed-hours
   figure at `OutreachList.tsx:3918` reads through the same eligibility set,
   sourced from `data.events` (the real loader's rows), **not** from
   `FIXTURE_EVENTS`. Name the prop chain from `data.events` to the call site in
   your report. A criterion green only against the fixture array is MAJOR.
6. **The type filter is untouched.** `filterOutreachEvents` and lines
   `4256-4258` behave identically; a non-volunteer-hours outreach *event* still
   renders in the page's event and session lists. Prove this — do not assert it.
7. **All six gates green.** Use the `gate-run` skill; paste its evidence block
   verbatim. Do not pipe test output through `tail`/`grep`/`wc`.

## 5. Evidence required

- The commit SHA the work landed in (item 21). "Clean" is not "committed".
- The `gate-run` evidence block, verbatim.
- **A real mutation replay** (`mutation-replay` skill): revert the eligibility
  check, show criterion 1's test turning **red** with its real output and exit
  code, restore, show green. **Commit the fix before mutating** (item 26's
  fast-tier working rule — T323 lost its fix to `git checkout --`), and mutate in
  **your own worktree**, never the shared tree (item 23).
- The grep output proving no file outside Allowed Files changed.
- For criterion 5, the literal prop chain, file:line at each hop.

## 6. Least confident decisions (item 19d) — attack these first

1. **That divergence (4) is genuinely dissolved and I am not misreading the
   render path.** I traced `data.events` → `filterOutreachEvents` (`:4256`) →
   `outreachEventIds` → `outreachSessions` (`:4258`) → the `sessions` prop →
   `computeStudentHours` (`:3918`). **What would make me wrong:** a *second*
   call site that receives `data.sessions` unfiltered, a path where
   `overrideData` (`:4252`) is populated by something other than
   `reloadOutreachData`, or a coach-side component that re-derives sessions from
   the loader instead of taking the prop. I did not enumerate all of
   `CoachOutreachView`'s internals. If such a path exists, the row's divergence
   (4) is live after all and this packet is scoped wrong.
2. **That (4′) needs no owner ruling.** I am treating "align `/outreach` with the
   flag `v_student_hours` already uses, as two other files already do" as
   conformance rather than a product decision. **What would make me wrong:** if
   the owner intends `/outreach` to show *effort* rather than *creditable hours*,
   then a non-creditable outreach event's hours belong on that page and removing
   them is a silent product change, not an alignment.
3. **That (4′) is reachable in production at all.** It requires a real event with
   `type='outreach'` **and** `counts_volunteer_hours=false`. I did **not** query
   any database — no fixture has that combination and I have no evidence a real
   row does. **What would make me wrong:** if that combination is impossible in
   practice (a UI that forces the flag true whenever type is outreach, or a DB
   constraint), this fix is defensive hardening against an unreachable state and
   its priority is far lower than the packet implies. **Check `OutreachEventDialog`
   / the event-create path and the `events` table definition for a constraint or
   a forced default — this is the single cheapest thing that could invalidate the
   whole packet.**
4. **That the planned branch should get the same treatment.** I took it from the
   `HoursTab.tsx:64-78` precedent. **What would make me wrong:** planned hours on
   `/outreach` may be intended as "what you signed up for" irrespective of credit,
   in which case criterion 2 changes a number the owner wanted.
5. **That leaving (1)(2)(3) unfixed and escalating them is the right split rather
   than a run declining the hard half.** **What would make me wrong:** if a cheap
   honest on-screen label (route (a)) is uncontroversial enough that shipping it
   here would have been better than another round-trip to the owner.

## 7. Known limits, disclosed rather than discovered later

- **No database was queried.** Every claim above is from source. The `scratch-postgres`
  skill exists and was not used; `v_student_hours`'s behaviour is read from its
  migration text, which item 25's own rationale warns can lie about itself.
- **No browser render was observed.** Same honest limit the row itself declared.
- The row's `metric_views.sql:3-19` citation is `:3-21` today, and its
  `loaders/outreach.ts:739` is `:740`. Both are drift, not error.
