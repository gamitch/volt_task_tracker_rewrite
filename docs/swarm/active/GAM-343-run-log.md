# GAM-343 run log

**Issue:** [GAM-343 — E2E — W2 Run an outreach event: create → RSVP → attend → complete → hours land](https://linear.app/gamitch/issue/GAM-343/e2e-w2-run-an-outreach-event-create-rsvp-attend-complete-hours-land)
**Branch:** `claude/gam-343-e2e-w2-outreach-lifecycle`
**Run:** GitHub Actions, dispatched from Linear on GAM-343 entering `Todo`.

Append-only. One line per milestone, pushed immediately — this file is the only
thing that survives if the container is killed.

## Milestones

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 18, 19, 22, 26, 28) before opening any
  other file. Fetched GAM-343 live from Linear; body was `tier/unreviewed`.
- **Tiered HEAVY** (item 28d — judged *before* `In Progress`, not after).
  Reasoning: the deliverable is test-only, which argues STANDARD, but item 26's
  question is whether a mistake can corrupt data or lie to a user about their
  own data. The artifact's whole value is an assertion about a **write path**
  and an **RLS policy** (`rsvps.responded_by = auth.uid()`), on the path
  `WORKFLOWS.md` calls the most defect-dense in the project, whose three worst
  bugs (T193, T309, T327) were all invisible from the screen. A vacuous spec is
  a false green certifying that volunteer hours are right when they are not —
  the same lie, laundered through a test. Item 26's tiebreak is explicit: when
  two tiers are arguable, take the heavier one. Labels set
  `tier/unreviewed → tier/heavy`.
- **Moved `Todo → In Progress` and re-read to confirm the claim** (item 28c;
  Linear has no compare-and-set). Read-back at 2026-08-13T03:36:36Z:
  `state = In Progress`, labels `w2 / other / heavy`, assignee null. Claim held.

- **Premise measurement, before any packet.** Three of the issue's operative
  claims checked against the tree at `b365a71`:
  - ✅ **TRUE** — `rsvps` write policies require `responded_by = auth.uid()`:
    `supabase/migrations/20260717000002_rls.sql:205-211`, on both
    `own_or_linked_write` (INSERT) and `own_or_linked_update` (UPDATE). AC 3 is
    achievable. Nuance the packet must carry: `staff_all` (`:197-199`) is `for
    all` with `check (is_staff())`, and policies are OR'd, so the RLS denial
    only fires for a **student-role** actor. A coach may write any
    `responded_by`. The mutation in AC 3 is therefore only red when driven as
    the student.
  - ❌ **FALSE / STALE** — the issue's constraint that `loaders/outreach.ts`
    "treats a student's own `responded_by` as never a deletion candidate during
    completion fan-out". That was **T118**, and T119 (PRD v2 D-7, George's
    2026-07-20 override) explicitly reversed it:
    `src/lib/supabase/loaders/outreach.ts:1398-1441` — *"`selfAuthoredKeys`
    (T118's protection mechanism) is gone -- there is no longer any row this
    fan-out skips."* Two errors in one sentence: the protection no longer
    exists, and the fan-out is in `saveOutreachEvent`'s expected-attendee
    reconciliation, not in completion — `markDayComplete` (`:1281-1377`) never
    touches `rsvps` at all. Does **not** block the work: the true current rule
    ("the checklist wins") is more interesting and is what will be tested.
  - ✅ **TRUE, and sharper than stated** — AC 5 / T309. The uncheck writes
    `status: 'absent'` rather than deleting
    (`src/pages/outreach/MarkDayCompleteDialog.tsx:494-515, 831`), and it only
    changes the database for a student who **already has a recorded attending
    row**. Unchecking a never-recorded student is a legitimate no-op. A packet
    omitting this buys the worker a wasted round or a vacuous test.


- **Dispatched `Explore` (terrain survey, read-only)** — mapping the accessible
  names/roles of every control the journey touches across
  `src/pages/outreach/**`, so the packet carries selectors the worker does not
  have to guess. *If this line is the last one in this file, the run died
  holding this subagent.* Dispatched `run_in_background: false`.
