# GAM-301 (T407) worker packet — STANDARD — round 2 (revised after premise gate round 1)

Round 1 verdict: REVISE, 1 BLOCKER + 5 MAJOR + 3 MINOR. Full verdict text is
in the run log's premise-gate entry. Every finding is addressed below; this
is a redesign, not a patch, so read it whole rather than diffing against
round 1.

## What changed and why (maps to round-1 findings)

- **BLOCKER 1 (bundle regression, T093 code-splitting reversed):** the round-1
  design value-imported `getUnansweredRsvpCount`/`filterOutreachEvents` from
  `src/pages/outreach/OutreachList.tsx`, a lazy-loaded page component, into
  always-eager chrome — measured +71.5 kB gz on the entry chunk, 25 lazy
  chunks collapsed into it. **Fixed by not touching `OutreachList.tsx` at
  all.** See "Correct semantics" below — the badge now reuses a different,
  more correct existing function that lives on a page which needed the same
  extraction anyway.
- **MAJOR 4 (semantics)**\+**MAJOR 5 (undefined coach/admin badge):**
  `getUnansweredRsvpCount` (`OutreachList.tsx:1459`) has no future-only filter
  and no team scope — it does not match PRD BEH-04 (`VOLT_Portal_PRD.md:248`,
  quoted verbatim): *"a neutral count Badge of unanswered **future** outreach
  sessions (**student: own; parent: linked kids combined**)."* BEH-04 defines
  **no coach/admin badge at all.** `StudentHome.tsx:836`'s
  `getUnansweredOutreachOpportunities` already implements the *correct*
  BEH-04 semantics (future cutoff at :852, team scope via `isEventInTeamScope`
  at :846) and is already tested (`StudentHome.test.tsx`). **This packet
  switches to that function and drops the coach/admin case entirely** — a
  coach/admin viewer sees no Outreach badge, matching the spec instead of
  inventing an unspecified roster-wide pair-count.
- **MAJOR 3 (MobileNav has the identical defect, was out of scope) +
  MAJOR 6 (broken T140 testability seam) + cheaper-path #5 (refetch storm
  risk if SideNav and MobileNav each fetch independently):** all three are
  solved by one change — **the fetch moves up to `AppShell.tsx`**, which
  calls a new hook exactly once and threads the resolved count down as a
  plain prop to both `<SideNav>` and `<MobileNav>` (both are mounted
  simultaneously — Astryx swaps which one is visible by CSS breakpoint, not
  by mount/unmount — so a single shared fetch is required, not two). This
  also completes T140's own pattern (`AppShell.tsx:92-114`,
  `seasonProviderProps`/`kpiStripProps`) with a third injectable
  `outreachBadgeCountProps`, rather than reopening the gap T140 closed.
- **MAJOR 2 (self-referential acceptance criteria):** criteria below now
  specify literal hand-computed integers against a named fixture, not a call
  to the function under test.
- **Least-confident #5 (tier):** STANDARD is kept — see "Tier, re-affirmed"
  below — but the packet now touches more files, so orchestrator replay is
  widened to a full-suite regression proof, not a spot check.

## Correct semantics (supersedes round 1 entirely)

Reuse, do not re-derive (constitution item 3):

- `isEventInTeamScope` and `getUnansweredOutreachOpportunities`
  (`src/pages/home/StudentHome.tsx:727` and `:836`), plus the three row types
  they take (`HomeEventRow` :469, `HomeSessionRow` :480, `HomeRsvpRow` :488).
  **Move** (not copy) all five into a new leaf module,
  `src/lib/outreach/unansweredOutreach.ts` — pure, dependency-free, no
  Astryx/React import, safe to statically import from eager chrome without
  reopening BLOCKER 1. `StudentHome.tsx` re-exports every one of them from
  the new path (`export { isEventInTeamScope, getUnansweredOutreachOpportunities } from '../../lib/outreach/unansweredOutreach';`
  and `export type { HomeEventRow, HomeSessionRow, HomeRsvpRow } from '../../lib/outreach/unansweredOutreach';`
  — both forms are valid under this repo's `isolatedModules: true`,
  confirmed in `tsconfig.json:11`). **This must be a pure relocation**:
  `StudentHome.test.tsx:48,50,62-64` already imports these five names from
  `./StudentHome` and must keep passing completely unmodified — that is the
  proof the move changed nothing observable.
- `loadStudentHomeData` and `resolveStudentScope`
  (`src/lib/supabase/loaders/students.ts:1002` and `:537` — real, already the
  production defaults, no fixture). Note the loader's real signature is
  `(studentId, seasonId)` — **student id first**, resolved before this call,
  not after.
- `resolveCurrentStudentId` (`src/lib/supabase/loaders/meetings.ts:1120`,
  input `CurrentViewerIdentity = { id, role }`, output `string | null`) —
  same shared resolver round 1 already cited correctly.

None of `loaders/students.ts`, `loaders/meetings.ts`, or the new leaf module
import React/Astryx or any lazy-loaded page component, so none of this
touches the eager/lazy boundary beyond what `AppShell.tsx` (already eager)
already crosses today for `SeasonProvider`/`KpiStrip`.

## Seam decision (revised)

**`AppShell.tsx` owns the one fetch, via a new hook
`useOutreachBadgeCount` (`src/app/useOutreachBadgeCount.ts`, new file), and
threads the result to `SideNav`/`MobileNav` as a plain prop.** Neither nav
component fetches anything itself.

```ts
// src/app/useOutreachBadgeCount.ts
export interface UseOutreachBadgeCountOptions {
  loadStudentHomeData?: LoadStudentHomeDataFn;   // defaults to the real loadStudentHomeData
  resolveStudentScope?: ResolveStudentScopeFn;   // defaults to the real resolveStudentScope
  resolveStudentId?: ResolveCurrentStudentIdFn;  // defaults to the real resolveCurrentStudentId
  now?: () => number;                            // defaults to Date.now
}
// Returns `number | null`. `null` = do not render a badge (unknown/loading/
// error/not-applicable-role). A real, computed `0` is a NUMBER, not null.
export function useOutreachBadgeCount(options?: UseOutreachBadgeCountOptions): number | null
```

Behavior:

1. Calls `useAuth()` and `useActiveSeason()` unconditionally (Rules of
   Hooks — same precedent `KpiStrip.tsx:150-151` already establishes for
   exactly this pair of hooks).
2. `user === null`, or `user.role` is `'admin'`/`'coach'` (same
   `isStaffRole` check already at `SideNav.tsx:143`) → return `null`. BEH-04
   defines no staff badge; do not invent one.
3. `useActiveSeason()` status `'loading'` → `null`. `'error'` → `null` (never
   fabricate a number). `'none'` → `0` (a real computed zero: no active
   season means nothing to RSVP to).
4. `'ready'`: call `resolveStudentId({ id: user.id, role: user.role })`.
   - Resolves `null` (no linked student yet) → `0` (real zero, not an error;
     matches `resolveCurrentStudentId`'s own documented `null` case,
     `loaders/meetings.ts:1103-1116`).
   - Resolves a `studentId` → call `loadStudentHomeData(studentId, season.id)`
     and `resolveStudentScope(studentId)` (parallel), then
     `getUnansweredOutreachOpportunities(sessions, events, rsvps, studentId, teamIds, now()).length`.
     `teamIds` from the resolved `StudentScope` — mirror `StudentHome.tsx`'s
     own handling of a `null` scope (`StudentHome.tsx:1725` area) exactly;
     do not invent new null-handling.
   - Either loader rejecting → `null` (no crash, no fabricated number).
5. One effect, re-running only when `[user?.id, user?.role, seasonState.status, seasonState.status==='ready' ? seasonState.season.id : null, loadStudentHomeData, resolveStudentScope, resolveStudentId]`
   changes — not on every render, matching `KpiStrip`'s own "one fetch per
   page load" property (`KpiStrip.tsx:61-72`), now genuinely satisfied for
   both nav surfaces at once since there is exactly one call site.

`AppShell.tsx` changes:

```ts
export interface AppShellProps {
  // ...existing...
  outreachBadgeCountProps?: UseOutreachBadgeCountOptions; // new, mirrors seasonProviderProps/kpiStripProps (T140, AppShell.tsx:92-114)
}
// inside the component:
const outreachBadgeCount = useOutreachBadgeCount(outreachBadgeCountProps);
// ...
sideNav={<SideNav outreachBadgeCount={outreachBadgeCount} />}
mobileNav={{ content: <MobileNav outreachBadgeCount={outreachBadgeCount} /> }}
```

`SideNav`/`MobileNav` changes: add `outreachBadgeCount?: number | null` to
each props interface; remove
`PLACEHOLDER_OUTREACH_BADGE_COUNT` from both files (it is duplicated
verbatim in each, per `MobileNav.tsx:127-132`'s own module doc admission);
render `<Badge variant="neutral" label={outreachBadgeCount} />` only when
`outreachBadgeCount !== null && outreachBadgeCount !== undefined`, else
`undefined` (no badge) for the Outreach item's `endContent`. No other
behavior in either file changes.

## Tier, re-affirmed: STANDARD

Item 26's enumerated HEAVY triggers — write path, RLS/auth/role logic,
migration or metric-view SQL, an export another session builds against —
still do not apply: every new read is a plain client-side Supabase query
through an existing loader, nothing is written, no SQL changes. The blast
radius grew from round 1 (now 5 edits + 5 new files, up from 2), which is
exactly what item 26 says is *not* by itself a HEAVY trigger ("the number of
files touched" is explicitly named as a non-trigger) — but because the
radius grew, orchestrator verification below is widened accordingly: full
suite, not a spot check, plus an explicit proof that `StudentHome.tsx`'s
existing behavior is unchanged (its own full test file green, unmodified).

## Allowed Files

1. `src/lib/outreach/unansweredOutreach.ts` — new. Houses the five relocated
   names.
2. `src/pages/home/StudentHome.tsx` — edit. Delete the five definitions,
   replace with two re-export lines. Nothing else in this file changes.
3. `src/app/useOutreachBadgeCount.ts` — new. The hook.
4. `src/app/useOutreachBadgeCount.test.ts` — new. Hook-level tests.
5. `src/app/AppShell.tsx` — edit. Call the hook, thread the prop, add
   `outreachBadgeCountProps` to `AppShellProps`.
6. `src/app/AppShell.test.tsx` — edit. Extend existing coverage; the
   existing `T140_FIXTURE_SEASON` `'ready'`-season tests
   (`AppShell.test.tsx:298-320`) must supply a fake `outreachBadgeCountProps`
   loader so they do not newly perform a real, unmocked Supabase call.
7. `src/components/nav/SideNav.tsx` — edit. Prop-driven badge, remove
   placeholder.
8. `src/components/nav/SideNav.test.tsx` — new (no such file exists today).
9. `src/components/nav/MobileNav.tsx` — edit. Same as SideNav.
10. `src/components/nav/MobileNav.test.tsx` — new (no such file exists
    today).

Nothing else. In particular: do not edit `OutreachList.tsx`,
`loaders/outreach.ts`, `loaders/meetings.ts`, `loaders/students.ts` (import
from them only), no migration, no new Supabase view.

## Acceptance criteria

Use one named fixture (define once, reuse across `SideNav.test.tsx` and
`MobileNav.test.tsx`): 2 outreach sessions in team scope and unanswered by
`studentId = 'student-1'`, 1 outreach session out of team scope, 1 meeting
session (never counted — `getUnansweredOutreachOpportunities` filters
`event.type === 'outreach'` internally), 1 already-answered outreach
session. State the exact rows in the test file; the expected badge count for
this fixture is a **literal `2`**, written as `2` in the assertion, never as
a call to the function under test.

1. `PLACEHOLDER_OUTREACH_BADGE_COUNT` is gone from both `SideNav.tsx` and
   `MobileNav.tsx` (grep-clean, repo-wide — round 1's criterion 1 was
   wrongly scoped to one file only).
2. A student viewer with the fixture above renders the Outreach badge with
   literal `2` in both `SideNav` and `MobileNav`.
3. A parent viewer renders identically to criterion 2 (this repo resolves
   exactly one linked student per parent viewer today — a disclosed existing
   simplification, not something this task changes; do not attempt "linked
   kids combined").
4. A student/parent viewer whose `resolveStudentId` resolves `null` sees a
   literal `0` badge (not absent, not the old placeholder).
5. `useActiveSeason()` `'loading'` or `'error'`, or a rejected
   `loadStudentHomeData`/`resolveStudentScope`, each render **no** Outreach
   Badge in either nav component (assert absence via a `data-testid` you add
   to the `<Badge>` render in this task, not by asserting `0` — round 1's
   MINOR 8, now resolved by adding the id).
6. `useActiveSeason()` `'none'` renders literal `0`.
7. An admin or coach viewer renders **no** Outreach Badge, in both nav
   components, regardless of season/data state (BEH-04 defines no staff
   badge — assert this explicitly, it is new coverage round 1 lacked).
8. `useOutreachBadgeCount.test.ts` covers the same 3/4/5/6/7 states directly
   at the hook level (not just through the two nav components), asserting
   the returned `number | null` value.
9. `AppShell.test.tsx`'s existing `T140_FIXTURE_SEASON` ready-season tests
   (`:298-320`) stay green with an injected fake `outreachBadgeCountProps`
   loader — prove no real network call fires from them (a spy/counter on the
   injected loader, asserted called, is sufficient; a real
   `loadStudentHomeData` call from a test is itself a failure).
10. `StudentHome.test.tsx` passes **unmodified** (byte-identical diff on that
    file — the relocation must be behavior-invisible from that file's own
    test suite).
11. `npm run typecheck`, `npm run lint`, `npm run format:check`, full
    `npm run test`, and `npm run build` all exit 0. Report file/test counts
    against the measured baseline: **89 files / 2363 tests green on
    `3190342`, build exit 0, eager entry chunk 199.02 kB gz.** Report the new
    eager entry chunk gzip size explicitly — it must not regress materially
    (the new imports are all leaf/loader modules, so it should be
    approximately unchanged; if it grows by more than ~5 kB gz, stop and
    report why before proceeding).
12. **Mutation replay (constitution item 26 — commit real work before
    mutating):** commit the finished change first. Then, in
    `unansweredOutreach.ts`, invert `getUnansweredOutreachOpportunities`'s
    `!rsvps.some(...)` to `rsvps.some(...)`. Confirm `SideNav.test.tsx`'s
    criterion-2 assertion (literal `2`) goes red, and separately confirm
    `StudentHome.test.tsx` also reddens (it exercises the same function,
    now relocated) — report both. Revert, confirm the full suite is green
    again.

## Least confident decisions

1. **Coach/admin viewers get no Outreach badge at all**, a visible behavior
   change from today's always-shown placeholder `0`. What would make this
   wrong: if the human owner actually wants a staff-facing roster count
   despite BEH-04 not specifying one — round 1's MAJOR 5 flagged the
   session×student pair-count as a fabricated, un-clearable number, and I am
   now removing it rather than fixing its scope, since no spec exists to fix
   it *to*. Revisit if disputed.
2. **The fetch moves to `AppShell.tsx`, expanding this packet from 2 files to
   10.** What would make this wrong: if a reviewer judges this now belongs in
   HEAVY given the blast radius (see "Tier, re-affirmed" above for why I
   judge it doesn't) or if a smaller design existed I didn't find — the
   cheaper-path alternative (each nav component fetches independently) was
   explicitly rejected by round 1's own finding of a refetch-storm risk.
3. **Parent = same single-student resolution as student**, not "linked kids
   combined" despite BEH-04's literal wording. What would make this wrong:
   if multi-child parent support is more load-bearing than the existing
   precedent suggests — but implementing real multi-child aggregation here
   would mean `resolveCurrentStudentId` itself changing (`rows[0].student_id`,
   `loaders/meetings.ts:1111-1114`, a Forbidden File), which is a
   pre-existing gap this task inherits rather than introduces, same as
   `OutreachList.tsx`'s own `StudentParentOutreachView` already does.
4. **`useOutreachBadgeCount` is a new file under `src/app/`, not
   `src/components/nav/`**, even though its output is nav-domain. What would
   make this wrong: if this repo's own conventions place shell-owned
   fetch-hooks elsewhere — I judged `src/app/` correct because the hook is
   now owned and called by `AppShell.tsx`, matching where `SeasonProvider`
   (also `src/app/`) already lives, not where its *consumers* (`SideNav`,
   `TopNav`) live.
5. **`0` for "no linked student yet" and `0` for "no active season," rather
   than two visually distinguishable states.** What would make this wrong:
   same as round 1's least-confident #3 — a user reading "0 unanswered" as
   "you're caught up" when the true state is "we can't resolve who you are."
   Kept from round 1 since the checker's verdict called this SOUND as a
   declared judgement, not a factual error.
