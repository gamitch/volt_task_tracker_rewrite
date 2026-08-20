Closes GAM-196

**This PR is being CLOSED WITHOUT MERGING, deliberately. Nothing here should
land, and GAM-196 must not close.** The `Closes GAM-196` line above is present
only because `scripts/linear-declaration-check.mjs` rule 3 requires line 1's
identifier to match the branch's, and it has no exemption. Treat it as a
formality of the gate, not as a claim that this work closes anything — the
branch is being abandoned unmerged precisely so that the automation never fires.

## What changed

**No source file was touched.** `git diff main...HEAD --stat` covers four
Markdown files under `docs/swarm/active/` and nothing else.

The run claimed GAM-196, tiered it HEAVY, wrote a packet, and put it through the
item-19 premise gate. **The gate returned REVISE and, more importantly, showed
there is no machine-shippable work in the row at all.** The run stopped rather
than manufacturing a change, per the dispatch prompt: *a correct refusal to
proceed, recorded on the issue, is a better outcome than a confident change built
on a premise nobody checked.*

## What the issue got wrong

GAM-196 named four divergences between `/outreach`'s RSVP-derived confirmed hours
and the attendance-backed `v_student_hours`. Re-measured against `main` @
`b9396c9` on 2026-08-20:

- **Divergences 1-3 hold** (RSVP-vs-attendance, `hours_override` invisible,
  check-in clamping invisible). All three are direct consequences of computing
  hours from RSVPs, so none can be fixed without settling the row's own (a)/(b)
  product question. That is the owner's call, not this run's.
- **Divergence 4 is falsified.** The row claimed `computeStudentHours` counts
  non-outreach events — and honestly flagged that its probe *"does not render the
  live page."* The caveat was warranted. `OutreachList.tsx:4254-4258` filters
  events to `type === 'outreach'` and derives the session list from those ids
  before any hours computation; all four call sites (`:1411`, `:1939`, `:3235`,
  `:3918`) were traced to that filtered array, inside both view components. A
  meeting cannot reach the function on the live page. T322's ruling is already
  satisfied.
- **The row's proposed escape hatch is therefore gone.** It suggested divergence
  4 *"could ship without settling (a)/(b)"*. It cannot — it is already shipped.
- **The substitute this run proposed was refuted too.** The packet tried aligning
  `/outreach` with `counts_volunteer_hours`, the other half of the view's join.
  The gate measured that no writer in the repository can produce
  `type='outreach' AND counts_volunteer_hours=false` —
  `OutreachEventDialog.tsx:660-673` pins outreach events to `true`. The fix would
  have guarded an unreachable state.

**The packet was also wrong twice, and both are recorded rather than deleted:**
it cited the superseded `20260717000003_metric_views.sql` instead of the live
`20260804000000_volunteer_hours_outreach_only.sql:44-60`, and it set the worker
an unsatisfiable acceptance criterion (a required new parameter plus a freeze on
the very call sites that parameter breaks — the gate reproduced the three
`TS2554` errors).

## Tier, stated and defended (item 26)

**HEAVY**, and it earned its cost. Item 26's deciding question — *"can a mistake
here corrupt data, or lie to a user about their own data?"* — is this row's
literal subject, and route (b) would have put `/outreach` on metric-view SQL, an
explicit HEAVY trigger.

The losing argument was STANDARD: read-only display code in one component, no
write path, no RLS, no migration. It loses on item 26's tie-breaker (*"if two
tiers are arguable, take the heavier one"*) and on the fact that the row's
load-bearing claim was self-declared as inferred rather than observed.

**This is the tier paying for itself.** A STANDARD run would have dispatched a
worker against a packet whose premise was unreachable and whose criterion 3 was
unsatisfiable, and would have burned three worker attempts discovering it. The
gate found both in ten minutes, before a worker existed — which is exactly what
item 19 was written for.

## Verification

**The six gates were not run, and that is not an omission to fix.** There is no
source change to verify: the diff is four Markdown files. Running `tsc`, `vite
build`, `eslint`, `format:check` and two vitest invocations against an unmodified
`src/` would produce a green evidence block that means nothing, and pasting one
here would imply a change was verified when none exists.

What was measured instead, by `checker-premise` in its own worktree (item 23,
shared tree verified clean before and after):

| Measurement | Result |
| -- | -- |
| Scratch PostgreSQL, migrations applied in order, `pg_get_viewdef('v_student_hours')` | join is `and e.counts_volunteer_hours and e.type = 'outreach'` |
| `insert into events (type, counts_volunteer_hours) values ('outreach', false)` | `INSERT 0 1` — legal at the DB level, no coupling constraint, no trigger |
| Every `events` writer in the repo | none can produce it: `OutreachEventDialog.tsx:660-673`, `loaders/meetings.ts:1086-1097`, `scripts/migrate/transform.ts:109-110` |
| `git log -S OUTREACH_FIXED_FLAGS` | present since `569a5d9`; no historical window where outreach was written `false` |
| Packet §3's prescription applied in a worktree, `tsc --noEmit` | 3 × `TS2554` inside the frozen `describe` — criterion 3 unsatisfiable |
| Cheaper seam applied instead | `tsc` clean, **108/108** existing tests green, zero test edits |

No mutation replay: there is no fix to mutate.

## Scope (item 27)

Not applicable — no user-visible surface was shipped, changed, or stubbed.

## Follow-ups filed (item 20)

- **GAM-428** — *Planned volunteer hours count competitions that can never become
  confirmed hours.* `StudentHome.tsx:872` and `HoursTab.tsx:481` both filter on
  `countsVolunteerHours` with no `type` test, so post-T322 they are under-filtered
  against the view. Reachable through a real admin control
  (`OutreachEventDialog.tsx:1432-1437`, defaults off). Filed to `Backlog` with
  `unreviewed`, per GAM-382 — promotion to `Todo` is the owner's signal.

**GAM-196 itself was released to `Todo` carrying `gate/human`**, its description
rewritten with the corrected measurement and the (a)/(b) decision stated as the
only thing that can unblock it. The original text is preserved verbatim in a
`<details>` block (item 30d). `gate/human` is what stops the `Todo` move from
simply re-dispatching another machine into the same wall.

## Known gaps, disclosed

- **No live database was queried** for either row. Whether a real competition
  event currently carries the volunteer-hours flag — the fact that decides
  whether GAM-428 is live or latent — is unknown and cheap for the owner to check.
- **No browser render was observed.** The same honest limit the original
  diagnosis declared. Divergence 4's dissolution rests on a complete static trace
  of all four call sites, not on watching a page.
- **Divergences 1-3 are left unfixed**, deliberately and with the reason stated:
  each requires the owner's (a)/(b) ruling.
- **The artifacts survive on this branch even though it will not merge:**
  `docs/swarm/active/GAM-196-run-log.md`, `-packet.md`,
  `-premise-gate-round1.md`, and this file. Both Linear rows link here.

Linear-Issue: GAM-196 (T188)
