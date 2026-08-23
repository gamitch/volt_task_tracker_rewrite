Closes GAM-479

## What changed

Un-marking a student's attendance is no longer a row DELETE. `attendance.status`
gains a fifth value, `'unmarked'`, written through the same upsert every other
status write uses — the one that omits `hours_override` and `check_in_at` so
`ON CONFLICT` cannot touch them. Both un-mark surfaces moved to it
(`SessionRow.tsx`'s tap-to-cycle chip and `AttendancePanel.tsx`'s checkbox), so
a QR check-in timestamp and a coach-set hours override now survive a clear.

With no callers left, `makeRemoveAttendance` was removed. There is no
`delete from attendance` anywhere in the application, and a test asserts it.

## What the issue got wrong

**The issue's own remedy was ruled dead, and the ruling was half wrong.**
GAM-479 proposed "preserve the row with a null status", and the prior
investigation (PR #238) rejected it three ways. Two of those three do not
survive a *sentinel* value, which is a different thing from null:

1. *"`attendance.status` is `not null`, so it needs a migration."* True, but the
   migration is widening one `CHECK` list. `status` stays `not null` — the
   sentinel is a real value, not an absence.
2. *"A null-status row corrupts `participation_pct`, `expected_ct`,
   `v_team_participation` and `graded_marks_ct`."* True of an unfiltered row,
   and it is the reason this PR touches two views. It is **two join predicates**,
   both located and both measured, not an unbounded blast radius. Every other
   live consumer was verified already safe.
3. *"It is the design the owner personally removed under D-7."* **This one is
   wrong.** D-7 (quoted at `attendance.ts:41-56`) struck down a coach *veto* —
   code that refused to clear `qr`/`import` rows, protecting them *from* the
   coach. A coach still clears any mark, of any `method`, in one action, with no
   permission check. Only where the cleared state is stored changed. D-7 is not
   reopened, and the un-mark tests still assert its rule.

**One further correction, to the prior run's framing rather than the issue's.**
PR #238 was built toward an undo affordance and stalled on two open questions
(undo placement; undo-vs-QR collision). Both are moot: nothing is destroyed, so
there is nothing to undo.

## Tier, stated and defended

**HEAVY.** Item 26's trigger is "a write path or destructive operation", and this
row's subject is one — plus a migration altering two metric views feeding
T509/D014's explicit-marks denominator. The losing argument was STANDARD, on the
grounds that the final diff is mostly one loader and two call sites; item 26 says
the number of files touched is not a trigger and the heavier tier wins a tie.

**Process deviation, declared rather than relabelled.** HEAVY's process is a
premise-checker subagent, a separate worker, and a separate checker. **None were
dispatched.** The owner directed this work interactively across several turns in
one session — choosing the sentinel design themselves after the alternatives were
laid out — and the session's operating instruction was not to spawn subagents.
The tier is stated as HEAVY because that is what the subject matter is; the
verification below is what was done in place of the ceremony, and it is stronger
than the tier requires in the one dimension that matters here (the database
claims are measured on a real cluster, in both directions).

## Verification

```
GATE RUN — 276f8ca on claude/attendance-cycle-looping-wl9pef — tree clean

  1 tsc                               exit 0  PASS
  2 vite build                        exit 0  PASS
  3 format:check                      exit 0  PASS
  4 eslint                            exit 0  PASS       0 errors, 382 warnings
  5 vitest (full)                     exit 0  PASS       114 files / 2779 tests  baseline 2768 (+11)
  6 vitest src/lib/supabase/loaders/  exit 0  PASS       15 files / 258 tests  baseline 248 (+10)

VERDICT: PASS — all six gates exit 0
```

Baselines measured, not assumed: 2768 full and 248 scoped come from a worktree
at `987bba2`, current `main`, re-measured after the merge below.

**CI caught a defect no local run here could have, and it was mine.** The first
push went red on `Typecheck, Lint, Format, Test, Build, Bundle Size`. GitHub
Actions tests the *merge result*; this container's `origin/main` was a
clone-time ref twelve commits stale, so every local gate run had been green
against a `main` that no longer existed. Merging `origin/main` @ `987bba2`
(GAM-451, PR #240) reproduced the failure in one run.

The cause: `excludeUnmarked` replaced the expression
`(result.data as SomeDbRow[] | null) ?? null`, and that `?? null` was
load-bearing. Postgrest can resolve `data` as `undefined`, and this repo's
query-builder fakes return a bare `{}` for a table a fixture never stubs —
GAM-451's new selected-child boundary test does exactly that. Dropping the
coercion made it `undefined.filter(...)`. The parameter is now
`T[] | null | undefined` with an `== null` check; the doc comment records that
narrowing it back would compile and break again, since every call site passes a
cast that hides `undefined` from the compiler. **Types could not have caught
this one.**

No migration landed in the merge, so `20260822000000` is still last and the
seven database assertions were re-run green on the merged tree.

An earlier gate run returned **UNTRUSTWORTHY** — three paths were passed to
`--scope`, which takes one, and gate 6 exited 1 with no summary. Those numbers
were discarded rather than recorded.

### Database assertions

`supabase/tests/run_gam479_unmarked_sentinel.sh` — seven assertions against a
scratch cluster carrying the full migration set (PostgreSQL 16.13). Every one is
a post-write row or view read; none asserts the shape of a statement.

| # | Claim | Result |
| -- | -- | -- |
| A1 | the `CHECK` widening applied, still naming exactly five values | PASS |
| A2 | the sentinel is accepted | PASS |
| A3 | a sixth value is still rejected (`check_violation` specifically) | PASS |
| A4 | **a cleared row keeps `check_in_at` and `hours_override`** | PASS |
| A5 | both views read a cleared row exactly as a missing one | PASS |
| A6 | **the counterfactual**: without the predicate, they do not | PASS |
| A7 | A6's rollback restored the shipped view bodies (re-runnable) | PASS |

A6 is what makes A5 mean anything. With the `<> 'unmarked'` predicate removed,
`v_event_attendance.attendance_pct` moves **100.0 → 50.0** and `graded_marks_ct`
1 → 2, and `v_student_participation` gains a phantom **0.0%** row. The view edits
are load-bearing, not decorative.

The first draft of that file was **not** re-runnable — A6 replaced the views and
never restored them, so a second run failed against its own leftovers. It now
rolls back, and A7 proves the restore. Both clusters were stopped and their data
directories deleted.

### Mutations

Nine, each reddening the test that claims to guard it. Tree verified clean after
each.

| Mutation | Result |
| -- | -- |
| clear seam sends `hours_override: null` | red — 1 failed / 21 passed |
| `excludeUnmarked` stops filtering | red — 2 failed / 20 passed |
| `excludeUnmarked` collapses `null` to `[]` | red — 1 failed / 21 passed |
| end-meeting sweep drops its `status` predicate | red — 2 failed / 21 passed |
| chip `(unset)` reverts to a row DELETE | red — 1 failed / 29 passed |
| uncheck hardcodes `'coach'`, losing qr provenance | red — 2 failed / 40 passed |
| uncheck demotes to `absent` instead of clearing (D-7) | red — 4 failed / 38 passed |
| a DELETE seam is reintroduced in the loader | red — 2 failed / 40 passed |
| `excludeUnmarked` checks `=== null`, not `== null` | red — 2 failed / 33 passed (its own regression test **and** GAM-451's boundary test) |

A6 above is the database-side mutation, built into the assertions file.

## Scope: what this does and does not close

**Partial, not Passed**, and the split is by surface.

- **`AttendancePanel.tsx`'s checkbox is on a user's real path** — staff-only at
  `OutreachDetail.tsx:2430`, `/outreach/:eventId`, no fixture in the way. This
  is the half a user can reach today, and it is closed.
- **`SessionRow.tsx`'s chip is still user-unreachable.** `SchedulePanel` has no
  external caller. GAM-479's own text says so and PR #238 re-confirmed it. The
  chip's clear path is proven by component tests and by the seam's own unit
  tests, not by use.
- **No browser run.** The database semantics are measured on a real cluster and
  the component behaviour in jsdom. Nobody has watched a coach untick a box and
  read the row back through the real stack. The narrow claim this PR supports is
  *"neither un-mark seam issues a DELETE, and a cleared row retains its
  columns"* — not *"the outreach panel is verified end-to-end"*.

## Follow-ups filed

Both to `Backlog` carrying `unreviewed`, before this PR opened.

- **GAM-487** — re-ticking an outreach checkbox nulls the `hours_override` the
  un-tick preserved (and resolves `method` to `'coach'`, losing qr provenance).
  Separate because fixing it means either a second opted-in read or swapping the
  re-tick's seam, and both need the "is a re-tick a fresh mark or a restoration?"
  question answered first — a product call, not a bug fix.
- **GAM-488** — a session that ever carried attendance can no longer be deleted,
  only cancelled. Separate because the likely resolution is "working as intended,
  fix the copy", and the alternative is a scoped purge, which is a new
  destructive write path and its own HEAVY row.

## Known gaps, disclosed

- **The chip half remains unreachable**, so this PR closes GAM-479's *mechanism*
  on both surfaces but only demonstrates it in use on one.
- **GAM-488's mechanism is reasoned, not measured.** The FK-restrict behaviour
  and the guard's branch selection are read from source and DDL; I did not watch
  a series-edit removal route a cleared-only session to `cancel`.
- **The re-tick `method` regression in GAM-487 has no test.** The
  `hours_override` half is documented in `AttendancePanel.tsx`'s module doc; the
  `method` half is stated from reading the call site.
- **Two stale claims in my own first commit** were corrected in the second: the
  migration header said `makeRemoveAttendance` survived for the checkbox, and
  described the read filter as `.neq('status', 'unmarked')` rather than the
  `excludeUnmarked` helper actually shipped. Both were leftovers from an approach
  abandoned mid-change — `.neq` broke 60 tests across 15 files, because this
  repo's query-builder fakes are passthrough chains that record arguments instead
  of filtering, so no fixture could ever have reached the filter.
- **Three module docs elsewhere described the old behaviour as live** and were
  corrected, not left: `AttendanceChips.tsx`'s "Disclosed asymmetry" block, and
  the hard-delete feed limitation in `dashboard.ts` and `CoachHome.tsx` — the
  latter two **narrowed**, since the RSVP-uncheck half is still an unconditional
  DELETE.
- **`supabase/tests/run_gam479_unmarked_sentinel.sh` is not wired into CI**, like
  every other assertion script in that directory (the T701 problem). It has a
  runner; nothing runs it automatically.
- **Every gate figure in the first two commits was measured against a stale
  `main`.** They were honest about the SHA they described and wrong about what
  that SHA would merge into. The numbers above are post-merge; the earlier ones
  should not be quoted.

Ignore GAM-487
Ignore GAM-488

Linear-Issue: GAM-479
