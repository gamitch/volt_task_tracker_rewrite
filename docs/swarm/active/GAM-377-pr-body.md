Closes GAM-377

## What changed

The outreach event dialog now refuses to save a session whose end time is at or
before its start time. A pure `computeEndTimeError` helper — ported from
`ScheduleMeetingsDialog.tsx:534`, not re-derived — runs **per selected date**,
gates `isValid`, and surfaces `End time must be after the start time.` on the
offending day's End field via `status`. The End field also gains
`min={detail?.startTime}`.

Before this, `isValid` was `title.trim() !== '' && sessionsPayload.length > 0` —
it checked the times were *present*, never *ordered*. Outreach events carry
`counts_volunteer_hours: true`, so an inverted interval reached
`v_planned_rsvp_hours` as negative planned hours.

## What the issue got wrong, and what the gate falsified in my own packet

**The issue was right about the defect and understated its own evidence.** Two
things it listed as unverified are now measured:

- **It said the inverted persist had never been reproduced on this surface.** It
  has now: the pristine dialog produced an **enabled** `Create event — 1 session`
  button and called `onSaveEvent` with `startsAt 19:00Z` / `endsAt 15:00Z` — a
  **−4 hour** interval.
- **It said the negative-hours chain was "reasoned" and inherited from GAM-290's
  measurement of the meetings side.** Verified at the SQL instead:
  `20260724000001_planned_hours_future_guard.sql:69` is
  `extract(epoch from (es.ends_at - es.starts_at)) / 3600.0` with **no clamp**,
  and its `where … es.starts_at >= now()` filters on `starts_at` — the *later*
  value in an inverted pair — so an inverted future session passes the filter
  rather than being screened out by it.

**Two things my own packet got wrong, both caught by the premise gate before a
worker saw them:**

1. **I inherited GAM-290's "`min` is merely a secondary affordance" framing, and
   it is false on this dialog.** Measured: `min` is the *only* guard when Start
   is typed first and an earlier End follows; the comparison is the *only* guard
   when End is typed first and a later Start follows. They cover **disjoint**
   interaction orders. Deleting the `isValid` clause leaves the first order fully
   guarded — which is why the mutation proof had to be written against the
   second.
2. **I wrote that only one interaction order could reach the guard.** Astryx's
   `isTimeInRange` is *inclusive*, so a Start-then-**equal**-End also reaches it.
   That correction matters because it is precisely why the e2e spec below broke —
   my own two sections had been contradicting each other.

## Tier: HEAVY, and it earned it

Item 26's trigger is met on the nose: the change guards a **write path**, and the
value it guards feeds metric SQL. The full chain ran — packet → `checker-premise`
→ worker → `checker-reviewer`.

**The losing argument was STANDARD.** The production change is ~12 lines of pure
comparison plus two props, with no schema change, no migration and no exported
signature — that reads FAST-to-STANDARD by size. Size is not a trigger, and item
26 says to take the heavier tier when two are arguable. **The gate is what
justified the cost**, and it did so twice, both times by *running* the
prescription rather than reading it:

- It found that the fix silently breaks a shipped e2e persona spec that the six
  gates do not execute.
- It found that my acceptance criteria named an interaction order that cannot
  reach the guard, and **measured the mutation surviving** on it. Without that,
  this PR would have shipped a green test suite that guarded nothing.

Neither was on my declared least-confident list. Both were invisible to reading
the code.

## Verification

```
GATE RUN — c1a8123 on claude/gam-377-outreach-end-ordering-guard — tree clean

  1 tsc                         exit 0  PASS
  2 vite build                  exit 0  PASS
  3 format:check                exit 0  PASS
  4 eslint                      exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)               exit 0  PASS       98 files / 2514 tests  baseline 2505 (+9)
  6 vitest src/pages/outreach/  exit 0  PASS       10 files / 523 tests  (no baseline given — regression not checked)

VERDICT: PASS — all six gates exit 0
```

Run independently by the worker, the checker and the orchestrator. **All three
blocks agree** at 2514/98 — that agreement is the evidence, not any one figure.

### Mutations

| Mutation | Expected | Real result |
| -- | -- | -- |
| Delete `&& !hasSessionTimeError` from `isValid` | AC3 red | **RED, exit 1.** Checker ran the **full** suite under mutation: **exactly 2 failures across all 98 files**, both the new ACs — `expected false to be true` at `OutreachEventDialog.test.tsx:2196` and `:2260`. AC1/AC2/AC5 stayed green, which is correct: `status` is not gated by `isValid`. |

The full-suite run is what makes this meaningful — it rules out a red that merely
reflects collateral breakage.

## Scope (item 27) — Passed, not Partial

The guard sits **on** the real write path, not beside it. `sessionTimeErrors` and
`buildOutreachSessionsPayload` read the *identical* `sessionDates` and
`effectiveSessionDetails`, so the payload's emitted set is a strict subset of the
error map's domain — `isValid` cannot go true while the builder would emit an
inverted pair. The checker confirmed there is **no bypass**: `onSaveEvent` has one
call site, inside a `handleSubmit` that early-returns on `!isValid`. The
`console.warn` default is a test seam; the user's real path is `OutreachList.tsx`
and `OutreachDetail.tsx` injecting the real `saveOutreachEvent` loader.

Accessibility was verified programmatically rather than visually: `aria-invalid`
and an `aria-describedby` resolving to the copy on the offending day's control,
**neither** on the valid day's, and `aria-required` still present.

## Follow-ups filed

- **GAM-423** — editing one of an outreach session's two time fields wipes the
  other, silently dropping that whole day from the event. Filed to `Backlog` as
  `unreviewed` (item 20 + item 30). **Arguably the more important of the two:**
  this row's defect needs a coach to type an inverted pair — a typo — whereas
  GAM-423 fires on changing a start time, an ordinary edit, and the day then
  vanishes with no message beyond the button re-reading `Create event — 0
  sessions`. It is deliberately not fixed here: the two are independent, and
  entangling a guard with a state-seeding change would have made both harder to
  verify. **They are coupled in one direction** — fixing GAM-423 changes which
  interaction orders reach this guard and will likely require adjusting the
  tests added here. That is stated on the row.

## Known gaps, disclosed

- **The e2e persona spec edit is reasoned, not executed.** This change breaks
  `tests/e2e-personas/outreach-lifecycle.spec.ts`, which filled Start and End
  both `11:59 PM` — an equal pair, which `<=` now rejects. The fix is Start
  `11:58 PM`, preserving that spec's stated "start as late as possible" intent at
  a cost of one minute; End cannot move later, as there is no wall time after
  23:59 on the same day. **The six gates do not run Playwright** (excluded from
  vitest, no CI job), so nothing in the block above is evidence that this spec
  survives. Its first real run is the confirmation. The checker did verify that
  **no assertion in that file depends on session duration** — every hours
  assertion keys on an explicit override or an exclusion.
- **`<=` was kept rather than weakened to `<`**, so a zero-length session is an
  error. The honest counter-evidence: the only shipped in-repo use of this
  dialog's time fields *was* an equal pair. It was incidental — that spec's own
  comments call the zero-duration session a hazard needing an override, not a
  workflow — and both sibling dialogs use `<=`.
- **One comment correction beyond the minimum.** CAVEAT 2 in that spec still said
  the confirm label and view delta "would both read 0 either way". With a
  one-minute session the label half stays true (`formatHours` rounds 1/60 h to
  `"0"`) and the view half does not (it sums unrounded). Graded NIT by the
  checker and folded in rather than filed.

Linear-Issue: GAM-377
