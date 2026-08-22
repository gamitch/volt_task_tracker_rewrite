Closes GAM-448

**DRAFT — opened at minute ~4 of the run, per `AGENTS.md` wall 3.** The PR
credential expires at `2026-08-22T01:53:38Z`; this body is finalized in place
before the draft flag clears. If this text is still what you are reading when
the run ends, the run was killed and
`docs/swarm/active/GAM-448-run-log.md` is the record of how far it got.

## What changed

Builds the coach series-card drill-out: a month-tabbed `SchedulePanel` on
`/meetings` where a session expands in place — expected roster and "Cancel this
session" for a scheduled one, tap-to-cycle attendance chips for a completed one
— so correcting a past session no longer requires hand-typing the live-console
URL.

## Tier, stated and defended

**HEAVY.** Item 26's first trigger, hit twice: the panel drives a **write path**
(attendance status corrections) and a **destructive operation** (cancel a
scheduled session). A mistake here lies to a coach about a student's recorded
attendance, or cancels the wrong session. The losing argument was STANDARD on
the grounds that this ticket writes **zero new mutation code** — it injects
`makeSetAttendanceStatus` / `makeOnEditAttendance` / `onCancelSession` as props
and calls existing, already-verified seams. That is a real mitigation and it is
why the risk is *call-site* risk rather than *SQL* risk, but item 26 asks
whether a mistake can lie to a user about their own data, and a wrong student
bound to a chip does exactly that without touching a loader. The row arrived
`tier/unreviewed`; the judgement above is this run's, not the issue's.

## Verification

_Pending — the `gate-run` evidence block and the mutations table are pasted here
verbatim before the draft flag clears._

## Scope

_Pending item 27 assessment: whether the shipped panel reads real data on the
real path a coach takes, or renders from fixtures._

Linear-Issue: GAM-448
