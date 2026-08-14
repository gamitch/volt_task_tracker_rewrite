# GAM-340 — run log

`student_teams` has no writer, so any student added since the 2026-07-21 backfill
has no membership row and returns zero rows from `v_student_participation`.

Orchestrator: Claude Code (Opus 5), dispatched from Linear 2026-08-14.
Branch: `claude/gam-340-student-teams-writer`. Base: `9d84bed`.

**How to read this file.** One line per milestone, appended and pushed as it
happens. A dispatch line with no matching verdict line beneath it means **the run
died holding that subagent** — not that the subagent is still working. This
container is ephemeral and the transcript is not saved when the job is cancelled,
so this file is the only thing that survives.

## Log

- **22:00Z — claimed.** GAM-340 fetched live from Linear: `Todo`, labels
  `area/w5` + `tier/unreviewed`, so it is ours under item 28b. Tiered **HEAVY**
  under item 26 before entering `In Progress` (item 28d): the change is a roster
  **write path**, it performs a destructive close (`left_on`) on an existing
  membership row, its output is **metric-view input** (`v_student_participation`
  INNER JOINs `student_teams`, so a bad row removes a student from the metric
  rather than skewing it), and the same rows become **RLS input** once GAM-299's
  migration is applied. Worker will carry `model: "opus"` under item 18.
  Moved `Todo → In Progress`, labels swapped to `tier/heavy`, reasoning posted as
  comment `336fb597`. **Read back: `In Progress`, `tier/heavy`, my comment last —
  claim confirmed, no competing agent.**
- **22:01Z — scope fixed.** This row takes **Part 1 only** (the writer). Part 2
  (drop the two legacy `own_or_linked_read` policies + seed `tests/rls/seed.sql`)
  is excluded on the issue's own constraint — *"Do not drop the legacy policies in
  the same change as the writer"* — and will be filed as its own row under item 20.
  The backfill decision for students created between 2026-07-21 and this fix is an
  **owner call** (`gate/human`), not decided here.
- **22:01Z — run log created and pushed.** Next: measure the premise before
  writing any packet. If `student_teams` turns out to have a writer on current
  `main`, this row goes back to `Todo` with the measurement recorded, per the
  dispatch instructions.
