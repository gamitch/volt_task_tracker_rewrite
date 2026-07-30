# T181 — premise gate round 1 (verbatim required revisions)

**Gate:** general-purpose agent with Write+Edit, 2026-07-30, measured at `1a4fbf0`.
**Verdict:** REVISE — 2 BLOCKER, 5 MAJOR, 5 MINOR. **Round 2 of 2 remains available** (item 19a).

It built the prescribed design (`parentHome.ts` + all of build-plan step 2), wrote the C1–C6/C10
tests, ran every prescribed mutation, and reverted. Baseline confirmed at 67 files / 1605 tests,
eslint 0/357 — no drift. Recorded here so revision 2 is not written from a summary.

## BLOCKER 1 — C1's regression proof cannot fail, in the criterion written to prevent exactly that

The packet engineers C1 against vacuity in its own words: *"State this ordering explicitly so the
criterion cannot pass by accident."* **Measured: with `loadLinkedStudents = defaultLoadLinkedStudents`
restored — the entire fabrication bug back — the no-props render asserting fixture names absent
PASSED.**

The DOM under that mutation:

```
"HomeCouldn't load this student's Home card…Retry" ×3
```

Three fixture students → three cards → each card's loader hits the unconfigured client →
`StudentHomeCard`'s error branch (`ParentHome.tsx:1150-1160`) renders a `Banner` and **never renders
`displayName`**. So the names never reach the DOM, "fixture names are gone" is green, and the bug is
fully restored.

**This is the seventh instance of the absence-only shape on this project**, and the first to occur
inside a criterion explicitly written to prevent it. An absence assertion is not made safe by
declaring an ordering — it is made safe by pairing it with a positive.

**Replacement, measured red under the same mutation:** assert the page-level `"Couldn't load Home"`
banner — the real default's actual observable behaviour in a test environment.

## BLOCKER 2 — C3 and C5 cannot run as prescribed

The build plan and the Forbidden-files section both say to import the **singletons**
`loadConsistencyStripData` / `resolveStudentScope`. Both are pre-bound to the real
`getSupabaseClient`, so an injected `getClient` never reaches them:

```
Caused by: SupabaseNotConfiguredError: Supabase isn't configured yet…
 ❯ getSupabaseClient src/lib/supabase/client.ts:102:11
 ❯ Module.<anonymous> src/lib/supabase/loaders/students.ts:426:23
 ❯ src/lib/supabase/loaders/parentHome.ts:186:7
```

C3's whole point — stubbing `v_student_goal_projection` to return `goal_hours = 63` — is
unreachable.

**Fix is cheap and available:** import the factories `makeLoadConsistencyStripData`
(`checkin.ts:426`) and `makeResolveStudentScope` (`students.ts:418`) and bind them to the injected
`getClient`. With that one change every criterion runs, and C3's mutation goes red:
`expected 999 to be 63`.

## MAJOR 3 — the prescription does not remove the false claim it exists to remove

After applying **every** prescribed code change, measured — `ParentHome.tsx:40-47` still reads:

```
 *   - MET-04's denominator (PRD line 541: `goal_hours_override ??
 *     season default_goal_hours`) has no SQL view for the ratio itself, only
 *     the numerator is a view column -- `studentGoalHours`/`hoursVsGoalPercent`
```

The false claim survives verbatim **and now cites `studentGoalHours`, which the packet has you
delete**. `:20` likewise still lists `goalHoursOverride` as a `LinkedStudentRow` field. Neither the
five-bullet "Required fix" nor build-plan step 2 mentions the module doc.

The packet's stated reason for existing is that this exact claim caused T176's attempt-1 MAJOR.
Following it leaves the claim in source, pointing at a deleted function.

**Deleting `studentGoalHours()` / `goalHoursOverride` / `defaultGoalHours` is safe — measured.**
`ParentHome.tsx`'s `studentGoalHours` has exactly one importer, `ParentHome.test.tsx`.
`weekly-digest.tsx:211`, `HoursTab.tsx:450`, `StudentHome.tsx:816` and `CoachHome.tsx:982` each hold
their own independent copies; none imports ParentHome's.

## MAJOR 4 — undisclosed blast radius outside the Allowed list

```
FAIL src/pages/home/DashboardPage.test.tsx > DashboardPage role dispatch > renders ParentHome for role "parent"
AssertionError: expected 'Couldn't load HomeSomething went wro…' to contain 'Ada R.'
  ❯ src/pages/home/DashboardPage.test.tsx:196:35
```

`DashboardPage.test.tsx:196-198` uses **ParentHome's fixture names as its role-dispatch
discriminator**, and that file is **neither Allowed nor Forbidden**. C9's enumeration is scoped to
`ParentHome.test.tsx` only. The packet's "`DashboardPage.tsx` needs no edit" is true of the component
and misleading about the pair. Additionally `:179`/`:188`'s `not.toContain('Ada R.')` negative
discriminators for the coach and student cases go **vacuous**.

## MAJOR 5 — C2's mutation prediction is false

"No props supplied → must show fixture figures/titles." **Measured: no props renders the page-level
error banner** (`"Couldn't load HomeSomething went wrong loading your linked students…"`) — zero
cards, zero figures. The per-card default swap is observable **only** with the outer seam injected
and stubbed, a shape the packet never describes.

## MAJOR 6 — C5's mutation has no target

"Drop the `type` filter from the query-composition path (not from `buildNextEventsForStudent`)."
**Measured: there is no `type` filter in the composition path.** The events query is unfiltered;
competition exclusion lives entirely inside `buildNextEventsForStudent`, which the packet forbids
touching. A substituted mutation — mis-map `type` in the row mapper — does work:
`expected [ 'Regional Showdown', …(2) ] to deeply equal [ Array(2) ]`.

## MAJOR 7 — `innerHTML` absence assertions produce false failures

The packet mandates dumping `container.innerHTML` and names bare numbers to assert absent
("not 62, not 100, **not 5**, **not 20**, not 87, not 75"). Measured false failures:
`not.toContain('5')` hits `style="width: 65.07936507936508%"`; `not.toContain('41')` hits the astryx
class `x141an7d`. **Use `textContent`** (which excludes class names) **plus `aria-valuetext` on
`[role="progressbar"]`**. C3's `'999'` passing is luck, not design.

## MINORs

- **8 — the self-resolving design's own cost.** A null session returns `{students: [], teams: []}` →
  the page renders *"No linked students yet — Once a student is linked to your account, their Home
  card will show up here."* A signed-in parent whose session fails to resolve is told something
  **false about their account** — the exact class the T184 record condemns. `checkin.ts` does the
  same `return []`, but there it feeds a sub-list, not a terminal page state. Decide what an
  unresolved session should render.
- **9 — the hook-ordering hazard is real; the dichotomy is not.** Measured both halves: passing
  `user.id` gives `TS18047: 'user' is possibly 'null'`; reordering the null check before
  `useLoadState` passes `tsc` but gives a hard **eslint error** —
  `react-hooks/rules-of-hooks: React Hook "useLoadState" is called conditionally`. So the hazard is
  genuine, **and only eslint catches it**. But "either reorder or use an unsafe `user!.id`" is a
  false dichotomy: a null-guarded closure, or an inner authed component, are both safe and need no
  reorder. Argue the design on its merits.
- **10 — the cited test range over-deletes.** `ParentHome.test.tsx:107-118` spans **both** the
  `studentGoalHours` `it` (108-111) and the `hoursVsGoalPercent` `it` (113-117), which the packet
  separately says stays untouched.
- **11 — undisclosed query fan-out.** Measured tables per card:
  `["event_sessions","attendance","v_student_participation","v_student_goal_projection","events","event_sessions","rsvps"]`
  — 7 round trips, with **`event_sessions` scanned twice** (once inside the reused strip loader, once
  by the new fuller query). A parent with 3 children: 21 per-card queries plus 4 outer-seam. The
  reuse is real; this cost is not disclosed.
- **12 — `nowMs` unmentioned.** `buildNextEventsForStudent(sessions, events, teamId, nowMs)` needs a
  clock; the build plan never mentions it. An injectable one is required for C5 to be deterministic.

## What held up — do not re-litigate

- **The reuse claim is TRUE, measured by wiring both with `tsc --noEmit` clean.**
  `loadConsistencyStripData` → `ConsistencyStripData.entries`/`.participation` assign directly to
  `StudentHomeCardData.consistencyEntries`/`.participation`, types identical, no adapter.
  `resolveStudentScope` → `goalHours`/`confirmedHours`, no shape mismatch on wiring. The
  genuinely-new set is exactly as enumerated.
- **The two same-named contracts are genuinely incompatible and the existing one cannot be widened.**
  `checkin.ts:405-411`'s `queryStudentsByIds` selects `id, display_name` only; its one production
  consumer, `StudentMeetingView.tsx:1054`, wants neither `team_id` nor `is_active`.
- **C10 is the strongest criterion in the packet** and produces a real compiler error, not a
  hand-written claim:
  ```
  error TS2322: Type '…StudentMeetingView").LoadLinkedStudentsFn' is not assignable to
  type '…ParentHome").LoadLinkedStudentsFn'.
    Type 'LinkedStudentSummary[]' is not assignable to type 'LinkedStudentsResult'.
  ```
- **The `isActive` attribution is accurate — no misattribution finding.** `auto-mode-decisions.md:974`
  records the owner's ruling complete, and it is about a deactivated student signing in **as
  herself**; nothing addresses a parent's view. The packet explicitly flags the factual-indicator
  design as *"the foreman's design call, not the owner's."* Copy is clean against item 17.
- **eslint delta is −1, not 0.** Deleting `studentGoalHours` removes one export → 357 → **356**
  warnings (one fewer `react-refresh/only-export-components`). C8 must expect −1.

## Round-2 checklist

1. Import the **factories**, not the singletons — unblocks C3 and C5.
2. Rewrite C1's regression proof to assert the page-level error banner.
3. Rewrite C2's mutation to the outer-seam-injected shape; drop the bare-number absence list.
4. Give C5 a mutation that exists (mis-map `type` in the row mapper).
5. Mandate `textContent` / `aria-valuetext`, never `innerHTML`, for absence assertions.
6. Add module doc #2 (`:40-47`) and #1 (`:20`) to the required edits.
7. Add `DashboardPage.test.tsx` to Allowed with a prescribed non-fixture discriminator; widen C9.
8. Disclose the double `event_sessions` scan; specify the clock injection.
9. Re-argue the self-resolving design honestly and decide what an unresolved session renders.
