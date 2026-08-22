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
- **03:04Z — draft PR #238 opened** (<https://github.com/gamitch/volt_task_tracker_rewrite/pull/238>),
  ~minute 2, with `docs/swarm/active/GAM-479-pr-body.md` written before the API
  call. Wall 3 satisfied with ~58 minutes of credential left.
- **03:04Z — claim comment posted to Linear** (`**Run log · Claude · claim ·
  2026-08-22**`), carrying the branch, the tier defence and the one thing known
  to be unresolved: the issue asks for a *decision* (undo affordance vs. null-status
  preservation) and does not pick one.
- **03:05Z — measuring the premise before anything else.** If it does not hold,
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

## Round 1

- **03:10Z — packet written** (commit `a1658c2c`), `docs/swarm/active/GAM-479-packet.md`. Proposes
  a new `makeRestoreAttendance` seam (the only write path that writes
  `check_in_at`) plus an `Undo un-mark` affordance on the live outreach
  `AttendancePanel`. No migration, no metric SQL, no reversal of D-7. Five
  least-confident decisions declared (item 19d), the fifth of which is that
  "no change" is still a legitimate close.
- **03:10Z — dispatching `checker-premise` (round 1), `run_in_background: false`,
  `model: "opus"`.** *If this line is the last one in this file, the run died
  holding this subagent.*

- **Timestamp correction.** Every clock time above from `03:08Z` onward was
  originally written from an estimate rather than read, and three of them were
  inflated by up to thirty minutes. They are now re-anchored to the real commit
  times (`git log --format='%h %cd'`): `95c7899a` 03:03Z, `c5d385dc`/`33b5803f`
  03:04Z, `833f17bb` 03:08Z, `a1658c2c` 03:10Z. Recorded rather than quietly
  fixed — the `pr-body` skill names "runs that wrote timestamps disagreeing with
  their own commit times" as a repeat failure, and this run was one of them.

- **03:19Z — `checker-premise` round 1 returned `VERDICT: REVISE`**
  (1 BLOCKER, 3 MAJOR, 7 MINOR, 3 NIT; ~112K tokens, 49 tool calls, 9m15s).
  The subagent was dispatched with `run_in_background: false` and this
  orchestrator blocked on it.

  **BLOCKER-1, and it is real — I re-measured it myself rather than taking the
  gate's word.** PR #234 **merged at 03:12:28Z**, *during* the gate run. My
  own check at 03:07Z read `OPEN` and was correct then; the packet's §0a was
  true when written and false by the time the gate read it. `origin/main` is
  now `0b06c9e7` (two merges ahead of the packet's base `00a22ac7`: #234, then
  #237), `git ls-tree origin/main src/pages/meetings/coach/` lists
  `AttendanceChips.tsx`/`SessionRow.tsx`/the real `SchedulePanel.tsx`, and
  `git grep -n SchedulePanel origin/main -- src/` still returns **no external
  caller** — so the chip is on `main` and still user-unreachable. The scoping
  argument survives; the stated reason for it does not.

  Other findings accepted in full: MAJOR-2 (the upsert restore can clobber a
  newer QR check-in — the fix reintroducing the defect), MAJOR-3 (§7.2's
  condition obtains: `SessionRow` holds only a bare status, so P1's payload has
  no caller that can populate it), MAJOR-4 (M1 cannot redden criterion 6),
  MINOR-5..11 and NIT-12..14. The gate also found DES-13 (`Toast` +
  `endContent`) — a PRD requirement the packet never named — and corrected
  §0c.2 upward from "at least two views" to three views and a rollup.

## Round 2

- **03:22Z — merged `origin/main` @ `0b06c9e7`** into the branch (`8f6d17c4`) and
  pushed, so the packet's base is the tree the gate measured. Baseline for the
  two allowed test files re-measured on that merge: **2 files, 56 tests, all
  green** (41 + 15).
- **03:38Z — packet round 2 written**, applying all 14 round-1 findings (§8 maps
  each). Three design changes the gate forced: `makeRemoveAttendance` now
  returns the row it deleted (answers MAJOR-3 — the chip holds only a bare
  status, so the seam has to hand it back); the restore uses `.insert()` not
  `.upsert()` (answers MAJOR-2 — an upsert would clobber a QR scan that
  re-created the row, reintroducing this ticket's own defect); and the
  affordance is an Astryx `Banner`, chosen over `Toast` because DES-13 assigns
  persistent conditions to `Banner` and because `astryx-api.md`'s `Toast` Props
  table is stale against installed 0.1.6 — every `Banner` prop used is
  documented, so no item-2b annotation enters this PR.
- **03:38Z — dispatching `checker-premise` (round 2 of 2), `run_in_background:
  false`, `model: "opus"`.** Item 19a: a third REVISE escalates to the owner
  rather than looping. *If this line is the last one in this file, the run died
  holding this subagent.*
