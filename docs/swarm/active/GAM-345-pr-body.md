Closes GAM-345

The W4 reporting surfaces had no end-to-end coverage, and they are the ones
where a wrong answer looks exactly like a right one. This adds one persona spec
that drives them in a real browser against a real cluster, reads the same
student's numbers off every screen that shows them, and compares each against a
direct `psql` read.

**Tier: HEAVY**, and the tier is defended rather than asserted. Item 26's
question is *can a mistake here lie to a user about their own data?* — and the
issue's own premise is that two screens already disagree. Every assertion this
spec makes is a claim about metric-view semantics (T509's no-rate vs. a real
zero), which item 19b names as requiring a full premise check. Nothing under
`src/` or `supabase/` changes: `git diff 398f505..6320933 -- src supabase
tests/e2e-harness .claude` is empty.

## What the run found

**Three of the issue's own statements did not survive measurement.** They are
listed in the packet under "Where this packet departs from the issue", and each
became a finding rather than a quiet scope reduction:

- There is **no CSV export control**. RPT-05/06's three builders ship in the
  bundle and no user path reaches them — and `GAM-69`/`T059` is marked **`Done`**
  against that surface. That is constitution item 27's exact shape, and it needs
  an owner decision, not a fix. Filed as **`GAM-357`**.
- The leaderboard, the Hours tab and the student's home page are **not three
  witnesses**. They share one `v_student_hours` read. The KPI strip carries no
  per-student figure at all. The criteria were rewritten so the comparison is
  one that could actually fail.
- **`GAM-300`'s floor is unreachable on this path.** A different, live defect
  sits there: `/meetings` renders `Participation: null%` with
  `aria-valuenow="0"` for a student who has no rate, while the other two
  surfaces correctly show an em dash. Filed as **`GAM-356`**, cross-referencing
  `GAM-300` rather than filed under it.

## The part worth reading

A claim about *where* `/meetings` gets that figure was asserted in the packet,
corrected by premise-gate round 1, and had its line numbers confirmed by round
2. All of that was reading, and all of it was wrong. The worker mutated
`meetings.ts:519` and the test stayed **green**; mutating `checkin.ts:363-365`
turned it red. The real path is `MeetingsList.tsx:2769` →
`<StudentMeetingView variant="own">` with no `loadStripData` →
`StudentMeetingView.tsx:1068`'s default → `loaders/checkin.ts`. The checker
reproduced both directions independently.

Item 26 says a gate that only reads is worth much less than one that runs. Two
rounds of careful reading *refined* a false claim instead of catching it; one
mutation settled it. The packet now carries that provenance so the next reader
sees why.

The underlying defect is one mistyped nullable column reached through three
loaders — `checkin.ts:239`, `meetings.ts:302`, `reports.ts:221` all declare
`participation_pct: number`. Only `ParticipationTab.tsx:838`'s runtime null
check guards any of them, which is exactly why one surface lies and two do not.

## Verification

Six gates at `6320933`, all exit 0: tsc · vite build · format:check · eslint
(0 errors, 378 warnings) · vitest 2443 tests · scoped vitest 112 tests.

**Eight mutation proofs**, each in an isolated worktree (item 23), none landed
on the branch. The checker did not take the worker's transcript on trust — it
stood up its own cluster and re-derived all six, plus two the worker never ran
(AC1 and AC5′, both red). The load-bearing one is `MC1`: deleting the
`student_teams` insert from the spec's seeding turns the all-excused assertion
red at `toHaveLength(1)`, proving the spec really distinguishes the NULL row
from the absent row — the precise silent mis-test the packet warned about.

## What this does not claim

**The persona suite is not green.** Five tests fail on this branch *without* the
new spec, confirmed by running the suite with the new file removed: two in
`coach-meeting.spec.ts` (one carrying an undiagnosed `42501` on `events`) and
three in `student-parent.spec.ts` that pin behaviour since fixed. They are
reported separately, filed as **`GAM-360`**, and deliberately not absorbed into
this row's result. The five new tests pass, twice, without a reseed.

Two defects are **pinned green on purpose** so the suite stays green —
`/meetings`' `null%` and the leaderboard's cosmetic `4 hrs`. Both carry a
comment naming the mechanism and what to change when fixed. If either is fixed
without reading the comment, the suite goes red for the right reason.

Not checked: the parent-facing `/meetings` strip, any non-student role there,
the KPI double-count in a browser (proven in SQL only), CSV *correctness* as
opposed to reachability, and any surface outside the three report tabs,
CoachHome, StudentHome and `/meetings`.

## Follow-ups filed before this row moved (item 20)

`GAM-356` (MAJOR) · `GAM-357` (MAJOR) · `GAM-358` (MINOR) · `GAM-359` (NIT) ·
`GAM-360` (MAJOR) · `GAM-361` (MINOR, e2e cleanup FK trap) · `GAM-362` (NIT,
`npm run lint` exits 1 whenever `playwright-report/` exists). All in `Backlog` —
promotion is the owner's call under item 28a.

Full run log: `docs/swarm/active/GAM-345-run-log.md`.
Verification entry: `docs/swarm/verification-log.md`.

Linear-Issue: GAM-345
