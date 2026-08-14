Closes GAM-290

`ScheduleMeetingsDialog` could persist a meeting whose `endsAt` was before its `startsAt`. It now cannot: the confirm button is gated on a wall-clock ordering guard, and the End field shows the same error copy its sibling dialog already used.

## The issue's own prescription would not have fixed the issue

GAM-290 is titled "The End time field has no lower bound" and prescribes `min={startTime}`. **`min` is a real Astryx prop and adding it does not fix the reported defect** — measured twice, in a worktree, driving the real dialog.

The issue's reproduction touches **only the Start field**. `min` constrains what may be *entered into* the End field; it never re-validates an End value already in state when Start moves past it. The premise gate added `min={startTime}` and re-ran the reproduction:

```
after Start edit: start='7:00 PM' end='5:30 PM' aria-invalid=null saveDisabled=false
INVERTED (endsAt < startsAt)? true   delta_minutes=-90      <-- byte-identical payload
```

So the load-bearing fix is a submit-time guard; `min` ships as a secondary affordance for typed entry. The two own disjoint cases and the code says so.

**The gate also closed the gap the issue left open.** GAM-290's own Verification note says the *effect* was never reproduced — only the missing-guard cause was read off the field. It is reproduced now: `startsAt 2026-09-15T00:00:00.000Z`, `endsAt 2026-09-14T22:30:00.000Z`, −90 minutes, through the real component and the real payload builder.

## Two claims in the issue are false, and are corrected rather than inherited

1. **`v_planned_rsvp_hours` does not receive negative planned hours from this dialog.** That view requires `e.counts_volunteer_hours`, and meetings are created with it `false` (`loaders/meetings.ts:1096`), so a meeting session cannot enter it — nor `v_student_hours`, `v_season_kpis`, or `computeStudentPlannedHours`. The real harm is the ICS feed, which has no such filter. Note the mechanism there is *also* milder than first written: `ical-generator@11` silently swaps an inverted pair, so subscribers get a wrong span rather than a malformed `VEVENT`.
2. **The meetings dialog was not the only unguarded writer.** `OutreachEventDialog` has the same defect — and outreach *does* carry `counts_volunteer_hours: true`, so the harm the issue attributed to meetings is real on the surface it excluded. Filed as **GAM-377**.

## Tier: HEAVY, and why (item 26 requires this be stated and defended)

The row arrived `tier/unreviewed`. HEAVY on item 26's **write path** trigger: `updateSessionTime` persists the interval. Note the tier does **not** rest on the metric claim above, which turned out to be false — the write-path trigger stands alone.

STANDARD was arguable on diff size (~78 production lines). Item 26 says take the heavier tier when two are arguable, and the two gate rounds earned their cost: they falsified two claims I had inherited, caught a fallback in my own packet that would have false-blocked a valid 07:00–08:00 meeting, and caught a create-branch hole that would have passed every other criterion.

Item 18's `model: "opus"` override was assessed and **not** triggered — no migration, RLS, metric SQL, or auth logic — so the worker ran on its pinned default.

## The implementation

`computeEndTimeError(startTime, endTime)` compares **minutes-since-midnight on the raw `HH:MM` values**, and deliberately does not call `chicagoWallTimeToUtcIso`. That helper probes the zone offset at the *naive-UTC* instant, putting the spring-forward discontinuity at wall 07:00–07:59 and collapsing 08:00 onto 07:00 — 16 disagreeing pairs enumerated on 2026-03-08. A UTC comparison would have **false-blocked an ordinary 07:00–08:00 meeting**. That underlying bug is real, out of scope, and filed as **GAM-378** (it is triplicated across three dialogs). AC 4c is the regression test pinning the correct comparison.

Both `isValid` branches are gated — create unconditionally, edit behind the existing `!timeFieldsTouched ||` shape so T611's untouched-session reuse is not reversed.

## Verification

Six gates green at `329193d` (`tsc`, `vite build`, `format:check`, `eslint` 0 errors, full suite 2458 vs a 2446 baseline, scoped 360 vs 348). The worker's first gate run was red on `format:check` and it reported that rather than hiding it.

**Five mutations, four of them beyond what the worker ran.** The checker replayed the worker's and added its own:

| Mutation | Result |
| -- | -- |
| `<=` → `>=` in the helper | exit 1, 16 failed, AC1 red |
| delete the guard from the **create** branch only | exit 1, both AC4b tests red |
| delete the guard from the **edit** branch only | exit 1, AC1 + AC2 red |
| delete the `status` prop | exit 1, 4 red — proves the copy comes from the End field |
| delete `min={startTime}` | **94/94 green** — `min` is untested, disclosed below |

Test diff is **271 insertions, 0 deletions**: no existing test was weakened, deleted or rewritten. 82 + 12 = 94.

## Closes Passed, not Partial (item 27)

The checker traced the real prop chain — `MeetingsList.tsx:2947-2948` → `:2979-2980` → `:2497/:2516` — into the one rendered dialog: real loaders, no fixture or stub on the user's path. The unguarded `OutreachEventDialog` is a *different surface*, not an unwired part of this one; treating it as item 27 would turn that item into a horizontal-completeness rule its own text forbids.

The honest scope claim is therefore narrow: **this dialog cannot persist an inverted interval**, not "inverted intervals cannot be persisted."

## Follow-ups filed under item 20, before this row moved

- **GAM-377** — the `OutreachEventDialog` ordering guard (the path that reaches the hours metric).
- **GAM-378** — the `chicagoWallTimeToUtcIso` spring-forward bug, triplicated across three dialogs. Trigger: before 2027-03-14.
- **GAM-379** — an `event_sessions` interval `CHECK` constraint **and an audit** for rows that may already be inverted. Audit first: a constraint added over a bad row fails at deploy.

Filed deliberately before this PR opened. GAM-290 exists only because an earlier relay of exactly this obligation was verbal and unrecorded, and *neither* party filed it.

## Known gaps, disclosed

- `min={startTime}` has no test — packet §3.5 forbids the natural one, because an out-of-range typed End is silently reverted on blur, so the error string never appears for that path.
- Error-copy assertions use `container.textContent` rather than scoping to the End field; the `status`-deletion mutation covers this in practice.
- The residual `!timeFieldsTouched` path — adding a new date to an already-inverted series can still write the shared displayed pair — is left open by design, since closing it would need a wider gate than this row scopes.

Run log and packet, including both premise-gate verdicts and every measurement quoted above: `docs/swarm/active/GAM-290-run-log.md`, `docs/swarm/active/GAM-290-packet.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
