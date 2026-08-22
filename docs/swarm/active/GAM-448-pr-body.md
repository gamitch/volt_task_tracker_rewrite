Closes GAM-448

Builds the coach series-card drill-out: a month-tabbed `SchedulePanel` where a
session expands in place — cancel a scheduled one, correct a completed one's
attendance with tap-to-cycle chips — so fixing a past session no longer means
hand-typing the live-console URL.

**This closes `Partial`, not `Passed`.** See _Scope_ and _Known gaps_.

## What changed

Three new components under `src/pages/meetings/coach/` (`SchedulePanel.tsx`,
`SessionRow.tsx`, `AttendanceChips.tsx`) plus their tests. **Zero new mutation
code** — every write goes through an existing loader seam injected as an
optional prop. 6 files, +2269/−18 at `4bc99293`, plus the rework at `371be9ca`.

## What the issue got wrong

The premise gate falsified five things. Recording them so the next reader does
not inherit them:

1. **The issue names the wrong write seam.** It says to wire
   `makeOnEditAttendance`. That factory is a bare
   `UPDATE attendance … WHERE session_id AND student_id`
   (`loaders/endMeeting.ts:496-499`) **with no insert path**, and since T508 an
   unmarked student normally has **no attendance row at all**
   (`types.ts:143`). Correcting an unmarked student through it updates zero
   rows _and resolves successfully_ — the optimistic chip would show the new
   status and the database would keep nothing. Every write here goes through
   `makeSetAttendanceStatus` (`loaders/attendance.ts:506-528`), a real upsert.
2. **The cycle has five stops, not four.** MTG-01g (`VOLT_Portal_PRD.md:382`)
   specifies `Present → Late → Excused → Absent → (unset)` with `Shift`
   reversing. The `meetings-design` skill the issue points at states no cycle
   order at all — filed as **GAM-481**, because sibling tickets are still
   reading it.
3. **The four a11y rules are not exhaustive.** MTG-01g:375-380 says so
   explicitly and requires DES-17's `1`–`4` roll-call keys, which a cycling
   control "must not remove". Forward-only traversal is an item-15 BLOCKER.
4. **`expectedCt` must not render.** It counts RSVPs with `status === 'going'`
   (`coachModel.ts:324-326`), and **MTG-03 says meetings do not use RSVP**
   (`:403`) — so it is structurally `0` on every meeting session. Rendering
   "0 expected" to a coach is item 26's _lie to a user about their own data_.
5. **The issue's `"4–6 PM"` row-line example is not producible** from the
   formatters this repo requires importing; `formatTimeRangeWithDuration`
   returns `"4:00–6:00 PM · 2h"`. Built as the formatter actually behaves.

The issue also asks for an Overlap badge and an expected roster. Neither is
buildable today: `buildOverlapIndex` does not exist (GAM-450 owns it), and no
loader can supply a roster (**GAM-478**). Both are accepted as optional props
and degrade to their empty state.

## Tier, stated and defended

**HEAVY.** Item 26's first trigger, hit twice: a write path (attendance
corrections) and a destructive operation (cancel a session; and the `(unset)`
stop deletes a row). The losing argument was STANDARD, on the grounds that this
ticket adds **zero new mutation code** — a real mitigation, and the reason the
risk is call-site risk rather than SQL risk. It loses because a wrong student
bound to a chip lies to a coach without touching a loader. The row arrived
`tier/unreviewed`; this judgement is the run's, not the issue's.

Full chain run: packet → premise gate (2 rounds) → worker → checker → rework.
**No `model: "opus"` worker override** — item 18's four triggers are
migrations, RLS, metric SQL and auth/role logic, and this packet touches none;
item 25 forbids bumping because a topic sounds sensitive. Both gate rounds
confirmed that call.

## Verification

Six gates, run by the checker independently of the worker and reproducing its
numbers exactly:

```
GATE RUN — 371be9ca on claude/gam-448-schedule-panel — tree clean

  1 tsc                              exit 0  PASS
  2 vite build                       exit 0  PASS
  3 format:check                     exit 0  PASS
  4 eslint                           exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)                    exit 0  PASS       112 files / 2726 tests  baseline 2666 (+60)
  6 vitest src/pages/meetings/coach  exit 0  PASS       5 files / 112 tests  baseline 52 (+60)

VERDICT: PASS — all six gates exit 0
```

Baselines (2666 / 52) were measured by the orchestrator on the branch point
after `npm ci`, and re-measured independently by the checker.

**Mutations — 26 run by the checker, 26 red.** The tests are not tautologies.
The checker then ran 7 more probing for gaps; 3 survived, and two of those
became the rework below.

| Mutation                                        | Result         |
| ----------------------------------------------- | -------------- |
| Swap `excused`/`absent` in the cycle            | RED            |
| Drop the `(unset)` stop                         | RED (4 failed) |
| Ignore `shiftKey` (forward-only)                | RED (3 failed) |
| `method: 'coach'` → `'qr'` in the write payload | RED            |
| Fabricate `recordedBy`                          | RED            |
| Remove optimistic rollback                      | RED            |
| Route `(unset)` through the status write        | RED            |
| Remove MTG-12 defence-in-depth                  | RED            |
| Bucket months from the UTC instant              | RED (7 failed) |
| Ignore the injected roster                      | RED            |
| _…16 more, all red_                             | RED            |

**One MAJOR was found by the checker and fixed.** `SessionRow.tsx` read
`statusById[id] ?? entry.status`, and `null` is this ticket's `(unset)`
sentinel — so `??` fell back to the _server_ value. Probed against the real
assembled component, tapping to unset a student marked `absent` left the chip
reading **"Ada L., absent"** while the row was deleted, and a second tap fired
the destructive call _again_. The same failure class item 26 exists to catch,
arriving through a different door, and invisible to every test because the
cycle was asserted against `AttendanceChips` in isolation with a hand-fed prop.
Fixed at `371be9ca` with a `readLocalStatus()` helper keyed on `in`; the probe
now reads `not recorded` then `present`, and the new full-loop test was
mutation-replayed red before being trusted.

**`layout-measurement`: not run — 5 of 6, with the reason.** Playwright has no
Chromium binary in this container and the skill forbids `playwright install`.
The ≥44px target is asserted on computed `minHeight`/`minWidth` instead. Real
browser measurement moves to GAM-452, when the component has a route to be
measured on. `e2e-personas` likewise: with no caller there is no path a coach
can walk to this panel.

## Scope — item 27, Partial

`SchedulePanel` is imported by nothing. That is by design: **GAM-452** is the
wiring ticket. Every roster row a coach would see comes from an injected
fixture, because **GAM-478** records that no loader on `main` can build one.
Those two rows are what hold this at `Partial`; it becomes `Passed` when they
land.

The owner's approval of GAM-480 removes the _unapproved-MAJOR_ reason for
`Partial`, but **not** `Partial` itself — item 27 required it independently
(checker finding F7) because no user can reach this surface yet. Approval
changed the grade's reason, not the grade.

## Follow-ups filed

| Row         | What                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAM-478** | Nothing on `main` can fill `SchedulePanel.roster` — the wiring gap that makes this Partial                                                    |
| **GAM-479** | The `(unset)` stop deletes the whole attendance row, discarding `check_in_at` and `hours_override` — decide before GAM-452 makes it reachable |
| **GAM-480** | The native-`<button>` MAJOR — escalated, and approved by the owner on 2026-08-22                                                              |
| **GAM-481** | The `meetings-design` skill is narrower than MTG-01g, and sibling tickets are still reading it                                                |

## Known gaps, disclosed

**One MAJOR ships unfixed, and it is now APPROVED rather than deferred:
GAM-480.** `AttendanceChips.tsx` uses a native `<button>` rather than Astryx
`Button`. The checker verified the worker's technical reason is true
(`BaseProps` omits `title`; `Button.js:341` swaps native `disabled` for
`aria-disabled` when a tooltip is present) but ruled the conclusion does not
follow — the criterion only needed "disabled and no write", and the price is
UA-default chrome on the first raw `<button>` in this repo's JSX.

The implementing run correctly refused to self-approve it: item 11 routes a
DES-21 escalation through boss approval, a human gate no agent run holds.
**The owner took that decision on 2026-08-22 and accepted the native
`<button>`**, which is what cleared this PR to leave draft. Recorded on
GAM-480, which stays open as the row that owns the consequence.

Two things a reviewer should still know, because approval settles the process
question and not the engineering one. There is **no bare-button reset** in
`theme.css` or `astryx.css` — verified, zero matches — so these chips render
with UA-default browser chrome until someone adds one. And this is genuinely
the first raw `<button>` in the repo's JSX: every other `<button>` on `main` is
prose inside a comment describing what Astryx `Button` renders, which is worth
knowing before it gets cited as precedent by a sibling ticket.

Also open: the Overlap badge (blocked on **GAM-450**) and the expected-attendee
count (**MTG-03**, folded into GAM-478) both degrade to their empty state.

Full run record, including both premise-gate verdicts:
`docs/swarm/active/GAM-448-run-log.md`.

Linear-Issue: GAM-448
