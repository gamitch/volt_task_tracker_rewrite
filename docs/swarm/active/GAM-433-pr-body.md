Closes GAM-433

## What changed

The competition **"Counts toward volunteer hours"** switch is gone. `counts_volunteer_hours` is now pinned `false` for competitions in code, the same way `loaders/meetings.ts:1096` already pins it for meetings.

The switch promised something the database refuses to deliver. Ruling 2 of 2026-08-03 (`20260804000000_volunteer_hours_outreach_only.sql`, header) set **volunteer hours = `type = 'outreach'` ONLY**, and `v_student_hours`'s join requires `counts_volunteer_hours` **and** `type = 'outreach'`. A coach could tick the switch, save, and the hours would never appear anywhere they counted — with no error and nothing on screen explaining it.

Five references removed or repinned in `OutreachEventDialog.tsx`:

| Site | Change |
| -- | -- |
| `useState` declaration | deleted |
| `resolveEventTypeFlags` call | `competitionCountsVolunteerHours` → `false` |
| the `<Switch>` JSX | deleted |
| hydrate-from-`initialEvent` setter | deleted |
| reset-on-close setter | deleted |

**`competitionCountsParticipation` is untouched.** It is a different flag, still honoured, and its switch still renders — the two sat adjacent in the same `VStack` and deleting both together was the obvious mistake here. A test now asserts the participation switch is still present in the same breath as asserting the volunteer-hours one is gone.

## What the issue got wrong

**GAM-433 said "three references total in the dialog". It is five.** My own filing grep matched only `competitionCountsVolunteerHours` and missed both `setCompetitionCountsVolunteerHours` call sites — the hydrate-from-`initialEvent` effect (`:1133`) and the reset-on-close block (`:1170`). The first build after the edit failed on exactly that: 39 of 95 tests red, all on the missing setter. Recorded rather than quietly fixed, because a filing that undercounts its own blast radius is the kind of error the next reader inherits.

The row also gave the sibling switch's label as *"Counts toward participation percentage"*. That string is its `description`; the `label` is **"Counts toward participation %"**. Both corrected on the row.

## Tier, stated and defended

**STANDARD** (item 26). None of the four HEAVY triggers applies: no write path is added or changed in shape, no RLS/auth/role logic, no migration or metric-view SQL, no export another session builds against. `resolveEventTypeFlags`'s exported signature is deliberately unchanged — the flag is pinned at the call site instead — so no importer sees a different contract.

The losing argument was FAST: it is a deletion, and deletions look free. It is not FAST because the change alters what reaches a persisted column, and the interesting behaviour is what the *save payload* carries, not what renders. That needed a new test seam, which is STANDARD's line.

## Verification

```
GATE RUN — 20b8942 on claude/gam-433-remove-competition-volunteer-hours-switch — tree clean

  1 tsc                                                     exit 0  PASS
  2 vite build                                              exit 0  PASS
  3 format:check                                            exit 0  PASS
  4 eslint                                                  exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)                                           exit 0  PASS       101 files / 2588 tests  baseline 2587 (+1)
  6 vitest OutreachEventDialog.test.tsx                     exit 0  PASS       1 files / 95 tests  baseline 94 (+1)

VERDICT: PASS — all six gates exit 0
```

Baselines measured on `main` @ `99f3967` in a separate worktree before the change: **2587 full, 94 scoped**. Not estimated, not carried over from another PR's figures.

**Mutation replay**, run in a detached worktree at `20b8942` (item 23 — the shared tree was never modified):

| Mutation | Result |
| -- | -- |
| `countsVolunteerHours: false` → `true` at the `resolveEventTypeFlags` call site | **RED, exactly 1 failure**, and it is the new test: `GAM-433: a competition saves countsVolunteerHours false, with no control able to set it true` |

The first attempt at this replay was invalid and is disclosed: the worktree silently stayed on `main` because the branch was already checked out elsewhere, so the mutation regex matched nothing and 94 tests passed — a green result that proved nothing. Re-run with `--detach` at the branch SHA, with a control grep confirming the unmutated line was present before mutating and the mutated line after.

**The test asserts the payload, not the render.** `expect(payload.event.countsVolunteerHours).toBe(false)` follows the value through `onSaveEvent`, so a regression that re-pinned the flag to `true` in code — with no switch anywhere — still turns it red. Asserting only that the switch text is absent would have missed that entirely.

## Scope (item 27)

The dialog under test is the real component with its real save path; `onSaveEvent` is the same prop `OutreachList.tsx` and `OutreachDetail.tsx` inject the real `saveOutreachEvent` loader into. No fixture stands in for the surface being changed.

**Not observed in a browser.** The consequence is established from the payload assertion and the component tree, not from watching a coach create a competition. The removed control's absence is asserted through `document.body.textContent` in jsdom.

## Known gaps, disclosed

- **Existing rows are not cleaned up by this PR.** A competition already stored with `counts_volunteer_hours = true` keeps it until someone edits and re-saves that event, at which point it now writes `false`. That behaviour is deliberate and is commented at the hydrate site. Whether any such row exists was **not** measured — no live database was queried. The owner has stated the app is pre-launch, so any such row is test or migrated data.
- **`v_planned_rsvp_hours` still lacks the `type` filter** (GAM-430). This PR makes that view's gap unreachable through the UI rather than fixing the view. If a stale row exists, or if a future writer sets the flag another way, the view would still compute a wrong planned figure. GAM-430 is de-scoped by this change, not closed by it.
- **GAM-428's PR (#213) is independent.** It corrects the Reports → Hours predicate, which stays correct whether or not this switch exists. Neither PR blocks the other.
- **The `counts_volunteer_hours` column is untouched.** Outreach events still set it `true`, and every view still reads it. Only the UI's ability to set it on a competition is removed.

Linear-Issue: GAM-433
