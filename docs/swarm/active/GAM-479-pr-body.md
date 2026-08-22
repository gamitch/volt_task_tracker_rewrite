Closes GAM-479

> ## ⛔ DO NOT MERGE — this PR ships no fix, and merging it would close GAM-479
>
> GAM-479 is **escalated to the owner** and sits in `Needs Attention`. Line 1
> above is required verbatim by `scripts/linear-declaration-check.mjs` rule 3
> (the branch identifier and the declared identifier must match exactly, and
> there is no non-closing form the check accepts), so it is a CI obligation, not
> a claim that the work is done. This PR is a **draft** carrying the
> investigation so the next run does not repeat it. Two questions in §"Decisions
> for the owner" have to be answered before a worker can be dispatched.

## What changed

No source change. The branch carries `docs/swarm/active/GAM-479-run-log.md`,
`docs/swarm/active/GAM-479-packet.md` (round 2 plus §9's round-2 verdict), and a
merge of `origin/main` @ `0b06c9e7`.

## Why it stopped

Constitution item 19a caps the premise gate at two rounds. Round 1 returned
`REVISE` (1 BLOCKER, 3 MAJOR, 7 MINOR, 3 NIT); the packet was rewritten applying
all 14 findings; round 2 returned `REVISE` (0 BLOCKER, 4 MAJOR, 8 MINOR, 3 NIT).
Definition of Ready item 1 permits a dispatch only on a `DISPATCH` verdict, so
no worker was dispatched and no third round was run. The remaining findings look
mechanical, which is precisely the judgement item 19a exists to overrule.

## What the issue got wrong

GAM-479's core claim holds — the un-mark is an unconditional row `DELETE`, it
takes `check_in_at`, `check_out_at`, `hours_override`, `method` and
`recorded_by` with it, and the attendance audit trigger was deliberately dropped
(`supabase/migrations/20260803000000_simplify_attendance_audit.sql:38-39`) so
nothing recovers them. Five corrections, all measured:

1. **The chip is on `main` now.** GAM-448 merged as PR #234 at 03:12:28Z on
   2026-08-22 — *during* round 1's gate, after this run had read it as `OPEN`.
   It is still **user-unreachable**: `SchedulePanel` has no external caller.
2. **The defect is reachable anyway, on a surface the issue never mentions.**
   `makeRemoveAttendance`'s second caller is
   `src/pages/outreach/AttendancePanel.tsx:725`, mounted staff-only at
   `src/pages/outreach/OutreachDetail.tsx:2430` on `/outreach/:eventId`. That
   panel also owns the hours `NumberInput` (`:620-629`), so a coach can set
   `hours_override` and destroy it with the next click on the same row. "No user
   can reach this today" is true of the chip and false of the defect.
3. **The issue's own remedy "preserve the row with a null status" is dead,
   three times over.** `attendance.status` is `not null check (...)` so it needs
   a migration; a null-status row enters T509/D014's explicit-marks denominator
   and corrupts `participation_pct`, `expected_ct`, `v_team_participation` and
   `graded_marks_ct` (constitution item 3 → BLOCKER); and it is the design the
   human owner personally removed under D-7, quoted verbatim in
   `src/lib/supabase/loaders/attendance.ts:41-44`.
4. **An undo is not free either, for the exact column the issue leads with.**
   `makeUpsertAttendance` deliberately never writes `check_in_at`
   (`attendance.ts:436-446`), so an undo built from today's seams would silently
   drop the QR check-in timestamp. A real undo needs a new write path.
5. **The chip cannot supply what an undo needs.** `SessionRow.tsx:267-274`
   captures only a bare status, so the seam has to hand the deleted row back.

The surviving design — return the row the DELETE destroyed and reinstate it with
a new `.insert()` seam — is fully specified in the packet's §1.

## Tier, stated and defended

**HEAVY.** Item 26's trigger is "a write path or destructive operation", and the
subject of this issue *is* one. Item 26's deciding question — can a mistake here
corrupt data, or lie to a user about their own data? — answers yes: the row
carries a QR check-in timestamp and a coach-set hours override with no audit
trail behind them. The losing argument was STANDARD, on the grounds that the
change is small and touches one loader plus one panel; item 26 says explicitly
that the number of files touched is not a trigger, and that where two tiers are
arguable the heavier one wins. The gate vindicated the call: round 2 found two
MAJORs that would each have shipped a broken undo, and both were found by
*running* code rather than reading it.

## Verification

**No gates were run, and that is not an omission to fill in later.** There is no
source change on this branch, so there is nothing for `tsc`, `eslint`, `vite
build` or the suite to say about it that they do not already say about
`origin/main`. The one measurement that matters is the baseline the packet's §5
records for whoever does the work, taken on this branch at `8f6d17c4`:

```
$ npx vitest run src/pages/outreach/AttendancePanel.test.tsx \
                src/lib/supabase/loaders/attendance.test.ts
 Test Files  2 passed (2)
      Tests  56 passed (56)      # 41 in AttendancePanel.test.tsx, 15 in attendance.test.ts
```

The premise gate ran its own instrumented experiments in its own worktree (item
23) and reported exit codes: `tsc --noEmit` exit 0 with the proposed signature
change applied, `grep -n setTimeout src/pages/outreach/AttendancePanel.tsx` exit
1 (zero hits), and a reproduction of the baseline above. Its two decisive
measurements were a real `TypeError` from the packet's literally-worded null
path and a DOM probe showing an Astryx `Banner` never returns after dismissal.

**No mutations were run**, because no code was written to mutate. The packet's
§4 specifies four (M1, M1b, M2, M3) and round 2 confirmed each reddens the
criterion it claims.

## Decisions for the owner

**Q1 — where does the undo live: one combined `Banner`, or a per-row control?**
The packet chose a combined `Banner` on DES-13's persistent-vs-short-lived
split. The gate found that this same file already ruled against "a Banner the
coach has to visually hunt for across a multi-day, multi-student panel"
(`AttendancePanel.tsx:115-116`, a passed task), that `astryx-api.md:6050`
prescribes `endContent` for undo, and that a per-row control removes a real
dismissed-state defect for free. This is a judgement about a coach's attention;
nobody has watched a coach use either shape.

**Q2 — when an undo collides with a real new QR check-in, should it fail, and
what should the coach see?** `.insert()` makes the collision a visible error
rather than silently clobbering a genuine scan — but the coach then taps Undo
and gets an error where nothing is actually wrong. The alternative always
succeeds and can destroy a real check-in. The packet chose the visible failure;
DES-16 requires the message to name what happened and what to do, and that
string is the owner's to approve.

## Follow-ups filed

- **GAM-484** — `astryx-api.md`'s `Toast` Props table documents three props that
  do not exist (`uniqueID`, `collisionBehavior`, `onHide`) and omits the
  required `onDismiss`, so item 2a forbids the only correct call. Filed to
  `Backlog` with `unreviewed`. Four shipped files had each recorded this in a
  module-doc comment and none had filed a row — item 20's failure shape, four
  times over.
- The chip's own undo is **not** filed yet: it depends on Q1's answer, and
  filing a row that prescribes a shape the owner may reject would be the
  "prescriptions that outlived their premise" anti-pattern.

## Known gaps, disclosed

- **GAM-479 is not fixed.** A coach using the outreach attendance panel can
  still destroy a QR check-in timestamp and an hours override with one click.
- The packet's §9a lists twelve concrete revisions a round-3 packet needs. They
  are written to be applied without re-reading the gate transcript, but they
  have not been applied, and applying them does not by itself make the packet
  dispatchable — item 19a's cap means the owner has to authorize the next move.
- This run's own run log carried estimated timestamps twice before they were
  re-anchored to commit times; both corrections are recorded in the log rather
  than silently fixed.

Linear-Issue: GAM-479
