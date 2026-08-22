# GAM-479 — run log

Issue: <https://linear.app/gamitch/issue/GAM-479/cycling-an-attendance-chip-to-unset-deletes-the-whole-row-the-qr-check>
Branch: `claude/gam-479-attendance-unset-preserve`
Runtime: Claude (dispatch run), started 2026-08-22 03:02Z.

Credential deadline read at minute ~1 (AGENTS.md wall 3): the `ghs_` App token's
JWT payload is `iat 1787367738`, `exp 1787371338` — 3600s, expiring
**2026-08-22 04:02:18Z**. `gh pr create` must happen well before that; `git push`
uses the long-lived PAT and survives.

## Log

- **03:03Z — claimed.** `Todo → In Progress` via `issueUpdate`, then read back:
  `state=In Progress`, labels `meetings-redesign`, `heavy`. Item 28c satisfied
  (read-after-write), item 28d satisfied (tiered before the move).
- **03:03Z — tier judged HEAVY** (`tier/unreviewed` → `tier/heavy`). Defence:
  item 26 names "a write path or destructive operation" as a HEAVY trigger, and
  the whole subject of this issue *is* a destructive write path — the fifth stop
  of the attendance cycle issues a row `DELETE` that takes `check_in_at`,
  `check_out_at`, `hours_override`, `method` and `recorded_by` with it. A
  mistake here corrupts data a coach cannot recover, which is item 26's own
  deciding question answered "yes". Any fix that preserves the row instead of
  deleting it also plausibly needs a schema change (nullable status /
  constraint), which is a second independent HEAVY trigger and an item 18
  `model: "opus"` trigger for the worker. Two tiers are not arguable here; even
  if they were, item 26 says take the heavier.
- **03:08Z — draft PR #238 opened** (<https://github.com/gamitch/volt_task_tracker_rewrite/pull/238>),
  ~minute 6, with `docs/swarm/active/GAM-479-pr-body.md` written before the API
  call. Wall 3 satisfied with ~54 minutes of credential left.
- **03:09Z — claim comment posted to Linear** (`**Run log · Claude · claim ·
  2026-08-22**`), carrying the branch, the tier defence and the one thing known
  to be unresolved: the issue asks for a *decision* (undo affordance vs. null-status
  preservation) and does not pick one.
- **03:10Z — measuring the premise before anything else.** If it does not hold,
  this run stops and the issue goes back to `Todo` with the measurement recorded.

## Premise measurement (orchestrator, against `main` @ `00a22ac7`)

Verdict: **the premise HOLDS**, with four corrections the issue does not carry.
None of them makes the defect go away; two of them kill a remedy the issue
suggested, and one makes the exposure larger than filed.

| # | Claim in GAM-479 | Measured |
| -- | -- | -- |
| 1 | The un-mark is a row `DELETE` | **True.** `makeRemoveAttendance` — `src/lib/supabase/loaders/attendance.ts:546-561` (the issue cites `:544-562`; the exported `interface` starts at `:539`, the function at `:546`). |
| 2 | The row carries `check_in_at`, `check_out_at`, `hours_override`, `method`, `recorded_by` | **True.** `AttendanceDbRow` `:240-252`, mapper `:254-268` (the issue cites `:247,255-267`, off by one at both ends of the mapper). |
| 3 | `makeSetAttendanceStatus` omits `hours_override` on purpose | **True, exactly.** `:506-528`, and its doc `:496-505` says why. |
| 4 | The cycle's fifth stop calls it | **True but NOT ON `main`.** `AttendanceChips.tsx`/`SessionRow.tsx` exist only on `origin/claude/gam-448-schedule-panel` (**PR #234, still OPEN**). On `main`, `SchedulePanel.tsx` is a 38-line stub returning `null`. The issue said so in its provenance table; recording it here because it decides where a fix can land. |
| 5 | "No user can reach this today" | **False as a statement about the destructive path.** `makeRemoveAttendance` has a second, live caller: `src/pages/outreach/AttendancePanel.tsx:642,725` — unchecking a student in the staff-only outreach panel (mounted by `OutreachDetail.tsx:290`) runs the same unconditional DELETE. That panel also *owns the hours `NumberInput`* (`:620-629`), so a coach can set `hours_override` there and destroy it with the next click. Only the meetings *chip* is unreachable. |
| 6 | "There is no undo" | **True, and stronger than filed.** The attendance audit trigger was deliberately dropped — `supabase/migrations/20260803000000_simplify_attendance_audit.sql:38-39` — so a deleted attendance row leaves no trace anywhere. |

**Correction A — the issue's own suggested remedy "preserving the row with a
null status" is not viable, and this is measured, not argued.**
`attendance.status` is `text not null check (status in ('present','late',
'excused','absent'))` (`supabase/migrations/20260717000000_scheduling_attendance.sql:86`),
so it needs a migration. Worse, T509/D014 defines *row existence* as *an
explicit mark exists*: the participation denominator is "(marks that exist) -
(excused marks)" (`20260806000000_met01_explicit_marks.sql:117-130`, restated
verbatim in `20260821000000_meetings_event_attendance_view.sql:193`). A
null-status row is a row that exists, so it would silently enter the
denominator of at least two metric views and change every affected student's
attendance percentage. Constitution item 3 makes re-deriving that SQL a
BLOCKER. This option is dead.

**Correction B — "an undo affordance" is not free either, and the reason is
the exact column the issue leads with.** `makeUpsertAttendance` deliberately
never writes `check_in_at`/`check_out_at` (`attendance.ts:436-446` says so and
why). So an undo built from the seams that exist today would restore the
status and the hours override and **silently drop the QR check-in timestamp**.
Any real undo needs a new restore write path.
