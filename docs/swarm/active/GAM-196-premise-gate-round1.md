# GAM-196 — `checker-premise` round 1 (of a maximum 2, item 19a)

**Artifact under gate:** `docs/swarm/active/GAM-196-packet.md`
**Verdict: REVISE.** 1 BLOCKER, 4 MAJOR, 4 MINOR.
**Cost:** 62 tool calls, ~10 minutes, 115.6K tokens — inside item 19a's
~105-130K-per-round measured range.

This gate **ran**, it did not read (item 26): a scratch PostgreSQL cluster with
the migrations applied in order, `pg_get_viewdef` against the live view, its own
`git worktree` (item 23 — the shared tree was verified clean before and after),
`tsc --noEmit`, the real 108-test suite, and a behaviour probe with fabricated
inputs. Every refutation below is a measurement, not a reading.

**The orchestrator independently re-verified the two load-bearing refutations
before accepting them** — a subagent's verdict is evidence, not a ruling. Both
held; see "Orchestrator's own re-verification" at the bottom.

---

## The one finding that ends the packet

**BLOCKER — divergence (4′), the packet's entire shipped slice, is a state no
application path can produce.**

The packet asserted that an event with `type = 'outreach'` and
`counts_volunteer_hours = false` contributes confirmed hours on `/outreach` and
none to `v_student_hours`, and called that a live wrong number on screen.

At the database level the combination is legal — the gate inserted such a row
into a real cluster (`INSERT 0 1`); `events` carries only `events_type_check`
(`type in ('meeting','outreach','competition')`), no coupling constraint, no
trigger, no default. **But no writer in the repository can create it:**

| Writer | Behaviour |
| -- | -- |
| `src/pages/outreach/OutreachEventDialog.tsx:660-674` | `OUTREACH_FIXED_FLAGS = { countsParticipation: false, countsVolunteerHours: true }`; `resolveEventTypeFlags` returns those fixed flags for anything that is not `competition`. Retyping a competition event to outreach also forces `true`. |
| `src/lib/supabase/loaders/meetings.ts:1086-1097` | hard-codes `type: 'meeting', counts_volunteer_hours: false` |
| `scripts/migrate/transform.ts:109-110` | legacy import maps `outreach → counts_volunteer_hours: true`, so no migrated row has it either |

`git log -S OUTREACH_FIXED_FLAGS` shows the constant present since the dialog's
creating commit `569a5d9` — there is no historical window in which outreach was
written `false`.

**The repository already knew this, in the same directory as the packet:**
`T322-worker-packet.md:40-42` tabulates `outreach | true, fixed | correct`;
`GAM-377-packet.md:40` says outreach events are "created with
`countsVolunteerHours: true` (`OUTREACH_FIXED_FLAGS`)"; and
`supabase/tests/volunteer_hours_outreach_only_assertions.sql:206-213` calls the
mirror-image case "structurally frozen … would require a hand-run UPDATE no UI
can issue."

So the packet's work would have changed no reachable number. It is defensive
hardening against a Supabase-Studio hand edit, not the divergence the row is about.

---

## The rest of the findings

**MAJOR — the packet cited a superseded migration as the live view.** All of the
packet's `20260717000003_metric_views.sql` citations describe a view replaced on
2026-08-04 by `20260804000000_volunteer_hours_outreach_only.sql:44-60`. Measured
with `pg_get_viewdef`, the live join is:

```sql
join events e on e.id = es.event_id and e.counts_volunteer_hours and e.type = 'outreach'
```

So the packet's central contrast — "a **boolean flag** versus a **type**… not the
same predicate" — is wrong. The live predicates are `(type AND flag)` versus
`(type)`, differing by the flag alone and in one direction. Reading the correct
file would have settled the whole packet: that migration's own header at `:27-34`
already records that the flag is "fixed `true` for `outreach`".

**MAJOR — the "precedent" was misread, and the *reachable* divergence is
elsewhere.** The packet claimed `HoursTab.tsx` and `StudentHome.tsx` "already add
the flag for exactly this reason" and that `/outreach` is "the holdout". They add
it because they are **not type-scoped** (`HoursTab.tsx:63-67` says so verbatim).
Neither applies any `type` test — both are literally
`if (!event || !event.countsVolunteerHours) continue;`
(`StudentHome.tsx:872`, `HoursTab.tsx:481`). Post-T322 the view requires *both*,
so **those two files are now under-filtered relative to the view**, and that gap
is reachable through a real admin control: the `Counts toward volunteer hours`
Switch on a **competition** event (`OutreachEventDialog.tsx:1432-1437`, default
off). Filed as a follow-up; outside this packet's Allowed Files.

**MAJOR — acceptance criterion 3 was unsatisfiable as written.** §3 prescribed a
new required parameter on `computeStudentHours`; §4.3 froze the existing
assertions and told the worker that changing one is "a finding to report, not an
edit to make". The gate applied the change in its worktree:

```
src/pages/outreach/OutreachList.test.tsx(478,23): error TS2554: Expected 4 arguments, but got 3.
src/pages/outreach/OutreachList.test.tsx(483,12): error TS2554: Expected 4 arguments, but got 3.
src/pages/outreach/OutreachList.test.tsx(502,19): error TS2554: Expected 4 arguments, but got 3.
```

All three are inside the frozen `describe`. The worker would have deadlocked in
minute five. This is item 19's stated purpose working exactly as intended.

**MAJOR — a strictly cheaper seam existed and §3 forbade it.** A helper
`filterHoursEligibleSessions(events, sessions)` applied at the four call sites,
plus one *optional* trailing parameter on `computeEventRowStats`, was measured
green: `tsc --noEmit` clean, 108/108 existing tests passing with **zero** edits to
`OutreachList.test.tsx`, and `computeStudentHours` left byte-identical as
`OutreachList.tsx:715-716` records it should be. Recorded here because it remains
the right shape if the owner's ruling ever makes this work live.

**MINOR ×4** — §3.4's call-site list named 2 of 4 (`:1411`, `:3918`; it omitted
`:1939` and `:3235`); the packet's claim that `hours_override` "appears nowhere in
`OutreachList.tsx`" is false (`:62`, in a module doc — the *code* claim holds);
`HoursTab.tsx:64-78` is really `:63-75`; and the `:4254-4258` block was presented
as verbatim but was paraphrased.

---

## What the gate UPHELD

**Divergence (4) is genuinely dissolved.** The gate enumerated all four call
sites by grep rather than by eye — `:1411` (inside `computeGroupHours`), `:1939`
(inside `computeEventRowStats`), `:3235` (`CoachOutreachView.teamHours`), `:3918`
(`StudentParentOutreachView.myHours`) — traced each argument to its source, went
inside both view components, and confirmed there is only one data load
(`:4164`) and that `overrideData` (`:4252`) is consumed *before* the type filter
at `:4256-4258`, so both sources pass through it. **No path feeds unfiltered
`data.sessions` to the hours computation.** The Linear row's central "it counts
meetings" claim is falsified at the render layer, exactly as the packet said —
and the row itself had flagged that its own probe could not see the render path.

Criterion 5's item-27 prop chain was also verified end to end and is real:
`loaders/outreach.ts:742` → `:611`/`:668` → `OutreachList.tsx:4164` → `:4252` →
`:4256` → `:4265`/`:4283` → `:3916-3919`, with the component's default
`loadData` being the real `loadOutreachData` (`:4441`), not the fixture loader.

---

## Orchestrator's own re-verification

Two claims decided the outcome, so the orchestrator opened the files itself
rather than accepting the report:

- `src/pages/outreach/OutreachEventDialog.tsx:660-674` — `OUTREACH_FIXED_FLAGS`
  and `resolveEventTypeFlags` read as described. **Confirmed.**
- `supabase/migrations/20260804000000_volunteer_hours_outreach_only.sql:44-60` —
  the live view joins `and e.counts_volunteer_hours and e.type = 'outreach'`.
  **Confirmed**, and the packet's citation was indeed of the superseded file.
- `src/pages/home/StudentHome.tsx:872` and `src/pages/reports/HoursTab.tsx:481` —
  both are `if (!event || !event.countsVolunteerHours) continue;` with no `type`
  test. `OutreachEventDialog.tsx:1432-1437` is a real, admin-editable Switch.
  **Confirmed** — the follow-up divergence is reachable.

---

## Disposition

**No round 2.** A round 2 is for a packet whose *wording* is wrong. This packet's
premise is wrong: the slice it proposed to ship is unreachable, and the slice the
Linear row proposed as separable (`type = 'outreach'`) is already implemented.
Rewriting the packet cannot manufacture work that does not exist, and item 19a's
cap exists precisely so a gate is not spent proving that twice.

The run therefore stops rather than implements, and GAM-196 returns to `Todo`
carrying `gate/human` — the owner's (a)/(b) ruling is the only thing that can
unblock it. See `GAM-196-run-log.md` for the release and the follow-up filed.
