# GAM-301 (T407) worker packet — STANDARD — round 3 (owner-directed, post-escalation)

Round 1 verdict: REVISE, 1 BLOCKER + 5 MAJOR + 3 MINOR.
Round 2 verdict: REVISE, 2 BLOCKER + 3 MAJOR + 5 MINOR + 2 NIT.

Per constitution item 19a the run escalated at round 2 rather than looping to a
round 3. **The human owner has directed the work forward**, accepting round 2's
own verification as sufficient in place of a third adversarial gate. This
round 3 packet applies round 2's two BLOCKER fixes and their consequences.

## Provenance limit — read this before trusting the finding list below

Round 2's **full verdict text was held in that run's transcript, which is
gone.** What survives is the run log's summary entry and the escalation comment
on GAM-301: both BLOCKERs in full detail, plus the note that the leaf-module
relocation, the re-export shape, `StudentHome.test.tsx` staying green, the
mutation replay, the BEH-04 semantics fix, and dropping the coach/admin badge
all checked out clean.

**The 3 MAJOR / 5 MINOR / 2 NIT items are not individually recoverable.** This
packet therefore applies the two BLOCKERs faithfully and re-derives what it can
from source. Treat the criteria below as necessary but possibly not sufficient;
the reviewer should look for small defects this packet could not know to name.
One such gap was already found while writing this round and is fixed below
(§"Relocation list" — the missing sixth name).

## What changed from round 2, and why

### BLOCKER 1 — the `AppShell` seam is impossible, not merely costly

Round 2 put the fetch in `AppShell.tsx` and threaded a prop down. That cannot
work: **`AppShell.tsx:159` renders `<SeasonProvider>`, and mounts both navs
inside it at `:162`/`:163`.** A hook calling `useActiveSeason()` from
`AppShell`'s own body sits *outside* the provider it renders, and throws.
Measured by the gate: `AppShell.test.tsx` **25/25 failed**,
`useActiveSeason() must be called within a <SeasonProvider>`. This would have
crashed the shell on every route in production.

Round 2 also justified the shell-level fetch with "both navs are mounted
simultaneously, so a single shared fetch is required." **That premise is
false.** Astryx mounts `sideNav` and `mobileNav` mutually exclusively, driven
by JS state (`isMobile` / `isMobileNavEnabled` in the shell context), not by a
CSS breakpoint over two live subtrees. There is no second concurrent consumer,
so there is no shared-fetch requirement and no refetch storm to avoid.

**Fix: each nav component calls the hook itself.** `SideNav` and `MobileNav`
each call `useOutreachBadgeCount()` at the same render position `KpiStrip`
already occupies — inside `SeasonProvider`, where `useActiveSeason()` is legal.
**`AppShell.tsx` is not edited at all.** The gate built and ran this shape:
`AppShell.test.tsx` + `TopNav.test.tsx` **34/34 green**.

### BLOCKER 2 — `loaders/meetings.ts` still drags lazy page code

Round 2 imported `resolveCurrentStudentId` from
`src/lib/supabase/loaders/meetings.ts`, believing no new import reached a lazy
page component. False: that module **value-imports** from two page modules —
`buildCoachMeetingRows`/`buildStudentMeetingsData` from `MeetingsList.tsx`
(`meetings.ts:163-176`) and `computeMeetingSeriesReconcilePlan` from
`ScheduleMeetingsDialog.tsx` (`:177-185`). Its own header discloses the cycle.
Importing *anything* from `meetings.ts` pulls both pages into eager chrome.
Measured: entry chunk 199.02 → **249.49 kB gz (+50.47 kB), 18 lazy chunks
collapsed** — round 1's BLOCKER at ~70% magnitude, not fixed.

**Fix: relocate `resolveCurrentStudentId` into a leaf module**, rather than
relocating the page functions. Verified while writing this packet:
`makeResolveCurrentStudentId` (`meetings.ts:1090-1117`) depends only on
`createLoader`, `getClient`, its two query helpers, and its two DB row types.
The `CurrentViewerIdentity` / `ResolveCurrentStudentIdFn` types it uses come
from `MeetingsList.tsx` as **`import type` only**, which is erased at runtime
and creates no bundle edge. So the function can move to a pure leaf module with
no page dependency, and `meetings.ts` re-exports it for its existing callers.
This is smaller than the escalation's suggested "relocate the two page
value-imports," and achieves the same result.

### Consequences of the two fixes

- The hook moves from `src/app/useOutreachBadgeCount.ts` to
  **`src/components/nav/useOutreachBadgeCount.ts`**. Round 2's least-confident
  #4 argued `src/app/` was right *because `AppShell` owned the call*. That
  reasoning inverts now that the nav components own it.
- `AppShellProps.outreachBadgeCountProps` is **dropped entirely**. The T140
  injectable-props pattern is no longer the seam. Injection moves to an
  optional prop on each nav component (below), which preserves testability
  without touching `AppShell`.
- Round 2's acceptance criterion 9 (prove `AppShell.test.tsx`'s ready-season
  tests inject a fake loader) is replaced by a stronger one: **`AppShell.tsx`
  and `AppShell.test.tsx` must both be byte-identical** at the end of this
  task. See criterion 9.
- Allowed Files drops from 10 to 10 but changes membership: two `AppShell`
  entries out, two meetings-leaf entries in.

## Correct semantics (unchanged from round 2 — the gate passed this part)

Reuse, do not re-derive (constitution item 3). BEH-04
(`VOLT_Portal_PRD.md:248`) specifies *"a neutral count Badge of unanswered
**future** outreach sessions (**student: own; parent: linked kids
combined**)"* — and defines **no coach/admin badge at all**.
`getUnansweredOutreachOpportunities` implements exactly these semantics
(future cutoff, team scope, `type === 'outreach'`, unanswered-by-student);
`OutreachList.tsx`'s `getUnansweredRsvpCount` does **not** and must not be
used. Do not touch `OutreachList.tsx`.

### Relocation list — six names, not five

Move (do not copy) into a new leaf module
**`src/lib/outreach/unansweredOutreach.ts`** — pure, no React/Astryx import:

1. `isEventInTeamScope` (`StudentHome.tsx:727`)
2. `getUnansweredOutreachOpportunities` (`StudentHome.tsx:836`)
3. `HomeEventRow` (type, `:469`)
4. `HomeSessionRow` (type, `:480`)
5. `HomeRsvpRow` (type, `:488`)
6. **`SignupOpportunityRow`** (type) — round 2's list omitted this. It is
   `getUnansweredOutreachOpportunities`'s **return type**, so the move does not
   compile without it. Move it too, or type-import it — whichever the worker
   picks, it must not leave the new leaf module importing back from
   `StudentHome.tsx`, which would recreate exactly the cycle this relocation
   exists to prevent. State which you chose and why in the run log.

`StudentHome.tsx` re-exports all six from the new path. Both `export { … } from`
and `export type { … } from` are valid under this repo's `isolatedModules: true`
(`tsconfig.json:11`). **This must be a pure relocation**:
`StudentHome.test.tsx` already imports these names from `./StudentHome` and
must keep passing **completely unmodified** — that is the proof the move
changed nothing observable.

Also move into a new leaf module
**`src/lib/meetings/resolveCurrentStudentId.ts`**:

- `makeResolveCurrentStudentId`, `resolveCurrentStudentId`, their two query
  helpers (`queryStudentIdByProfileId`, `queryFirstLinkedStudentId`) and the two
  DB row types (`StudentIdDbRow`, `GuardianLinkStudentIdDbRow`).
- `meetings.ts` re-exports `resolveCurrentStudentId` (and
  `makeResolveCurrentStudentId` if anything else imports it — check) so its
  existing callers are untouched.
- The new module may `import type` from `MeetingsList.tsx`; it must not
  value-import from any page module.

Other reuse, unchanged: `loadStudentHomeData` and `resolveStudentScope`
(`src/lib/supabase/loaders/students.ts:1002` and `:537` — real production
defaults). The loader's real signature is `(studentId, seasonId)` — **student
id first**.

## Seam decision (round 3, final)

**Each nav component calls the hook itself. `AppShell.tsx` is not touched.**

```ts
// src/components/nav/useOutreachBadgeCount.ts
export interface UseOutreachBadgeCountOptions {
  loadStudentHomeData?: LoadStudentHomeDataFn;   // defaults to the real loadStudentHomeData
  resolveStudentScope?: ResolveStudentScopeFn;   // defaults to the real resolveStudentScope
  resolveStudentId?: ResolveCurrentStudentIdFn;  // defaults to the real resolveCurrentStudentId
  now?: () => number;                            // defaults to Date.now
}
// Returns `number | null`. `null` = render no badge (unknown/loading/error/
// not-applicable-role). A real, computed `0` is a NUMBER, not null.
export function useOutreachBadgeCount(options?: UseOutreachBadgeCountOptions): number | null
```

Behavior (unchanged from round 2 — the gate did not fault this logic):

1. Calls `useAuth()` and `useActiveSeason()` unconditionally (Rules of Hooks —
   the precedent `KpiStrip.tsx:150-151` already sets for this exact pair).
2. `user === null`, or `user.role` is `'admin'`/`'coach'` (the same
   `isStaffRole` check already at `SideNav.tsx:143`) → `null`.
3. `useActiveSeason()` `'loading'` → `null`. `'error'` → `null` (never fabricate
   a number). `'none'` → `0` (a real computed zero).
4. `'ready'`: call `resolveStudentId({ id: user.id, role: user.role })`.
   - Resolves `null` → `0` (real zero; matches `resolveCurrentStudentId`'s own
     documented `null` case).
   - Resolves a `studentId` → call `loadStudentHomeData(studentId, season.id)`
     and `resolveStudentScope(studentId)` in parallel, then
     `getUnansweredOutreachOpportunities(sessions, events, rsvps, studentId, teamIds, now()).length`.
     `teamIds` from the resolved `StudentScope`; mirror `StudentHome.tsx`'s own
     handling of a `null` scope exactly, do not invent new null-handling.
   - Either loader rejecting → `null`.
5. One effect, re-running only when
   `[user?.id, user?.role, seasonState.status, seasonState.status==='ready' ? seasonState.season.id : null, loadStudentHomeData, resolveStudentScope, resolveStudentId]`
   changes.

**Nav component changes.** Both `SideNav.tsx` and `MobileNav.tsx`:

```ts
interface SideNavProps {   // and MobileNavProps
  /** Test seam: injected options for the badge hook. Production passes nothing. */
  outreachBadgeCountOptions?: UseOutreachBadgeCountOptions;
}
const outreachBadgeCount = useOutreachBadgeCount(outreachBadgeCountOptions);
```

Remove `PLACEHOLDER_OUTREACH_BADGE_COUNT` from both files (it is duplicated
verbatim in each — `SideNav.tsx:117`, `MobileNav.tsx:133`). Render
`<Badge variant="neutral" label={outreachBadgeCount} data-testid="outreach-nav-badge" />`
for the Outreach item's `endContent` only when `outreachBadgeCount !== null`,
else `undefined`. No other behavior in either file changes. Delete the stale
`PLACEHOLDER_OUTREACH_BADGE_COUNT` module-doc paragraphs that reference "the
real count is wired by T038" (`SideNav.tsx:89` area, and `MobileNav.tsx:127-132`).

**Watch for this** (unproven, resolve it rather than assume): `AppShell.test.tsx`
renders `SideNav`, which now self-fetches. If those tests have a `'ready'`
season, the hook's *default* real loaders could fire an unmocked Supabase call
from a test. The gate reported 34/34 green for this shape, so it is probably
already handled by an existing global mock — but **verify it, don't infer it**.
If a real call does fire, the fix is a test-level injection, not an
`AppShell.tsx` edit. See criterion 9.

## Tier, re-affirmed: STANDARD

Item 26's enumerated HEAVY triggers — write path, RLS/auth/role logic, migration
or metric-view SQL, an export another session builds against — still do not
apply: every new read is a client-side query through an existing loader, nothing
is written, no SQL changes. Blast radius is 10 files, and item 26 names file
count explicitly as a non-trigger. Verification is widened to the full suite
plus a bundle measurement, as below.

## Allowed Files

1. `src/lib/outreach/unansweredOutreach.ts` — new. The six relocated names.
2. `src/pages/home/StudentHome.tsx` — edit. Delete the six definitions, replace
   with re-export lines. Nothing else changes.
3. `src/lib/meetings/resolveCurrentStudentId.ts` — new. The relocated resolver.
4. `src/lib/supabase/loaders/meetings.ts` — edit. Delete the relocated
   definitions, re-export from the new leaf module. Nothing else changes.
5. `src/components/nav/useOutreachBadgeCount.ts` — new. The hook.
6. `src/components/nav/useOutreachBadgeCount.test.ts` — new. Hook-level tests.
7. `src/components/nav/SideNav.tsx` — edit. Hook-driven badge, remove placeholder.
8. `src/components/nav/SideNav.test.tsx` — new (no such file exists today).
9. `src/components/nav/MobileNav.tsx` — edit. Same as SideNav.
10. `src/components/nav/MobileNav.test.tsx` — new (no such file exists today).

Nothing else. In particular: **do not edit `AppShell.tsx` or `AppShell.test.tsx`**
(criterion 9 asserts they are byte-identical), do not edit `OutreachList.tsx`,
`loaders/outreach.ts`, or `loaders/students.ts` (import from them only), no
migration, no new Supabase view.

## Acceptance criteria

Use one named fixture, defined once and reused across `SideNav.test.tsx` and
`MobileNav.test.tsx`: 2 outreach sessions in team scope, future, unanswered by
`studentId = 'student-1'`; 1 outreach session out of team scope; 1 meeting
session (never counted); 1 already-answered outreach session; 1 outreach session
in the **past** (excluded by the future cutoff — this is the BEH-04 clause
`getUnansweredRsvpCount` lacked, so it must be exercised). State the exact rows
in the test file. The expected badge count is a **literal `2`**, written as `2`,
never as a call to the function under test.

1. `PLACEHOLDER_OUTREACH_BADGE_COUNT` is gone repo-wide (grep-clean), from both
   `SideNav.tsx` and `MobileNav.tsx`.
2. A student viewer with the fixture renders the Outreach badge with literal
   `2`, in both `SideNav` and `MobileNav`.
3. A parent viewer renders identically to criterion 2 (this repo resolves
   exactly one linked student per parent today — a disclosed existing
   simplification; do not attempt "linked kids combined").
4. A student/parent viewer whose `resolveStudentId` resolves `null` renders a
   literal `0` badge (not absent, not the old placeholder).
5. `useActiveSeason()` `'loading'` or `'error'`, or a rejected
   `loadStudentHomeData`/`resolveStudentScope`, each render **no** Outreach
   badge in either nav — assert absence via the `data-testid`, not by asserting `0`.
6. `useActiveSeason()` `'none'` renders literal `0`.
7. An admin or coach viewer renders **no** Outreach badge in either nav,
   regardless of season/data state (BEH-04 defines no staff badge).
8. `useOutreachBadgeCount.test.ts` covers states 3/4/5/6/7 directly at the hook
   level, asserting the returned `number | null`.
9. **`AppShell.tsx` and `AppShell.test.tsx` are byte-identical to their state at
   `a19cbb3`** (`git diff --exit-code a19cbb3 -- src/app/AppShell.tsx src/app/AppShell.test.tsx` exits 0),
   **and** `AppShell.test.tsx` passes unmodified, **and** no test performs a real
   unmocked Supabase call through the new hook. If proving the last part
   requires a change, report it and stop rather than editing `AppShell`.
10. `StudentHome.test.tsx` passes **unmodified** (byte-identical) — the
    relocation must be invisible to that file's own suite. Same for any existing
    test covering `resolveCurrentStudentId` via `meetings.ts`.
11. All six gates exit 0: `npm run typecheck`, `npm run lint`,
    `npm run format:check`, full `npm run test`, `npm run build`, plus a scoped
    run. Baseline to report against: **89 files / 2363 tests green on
    `3190342`, build exit 0, eager entry chunk 199.02 kB gz.**
12. **Bundle proof — this is the criterion two rounds died on.** Report the new
    eager entry chunk gzip size explicitly, and the lazy chunk count. It must
    not regress materially: round 1 measured +71.5 kB / 25 chunks collapsed,
    round 2 measured +50.47 kB / 18 chunks collapsed. **If the entry chunk grows
    by more than 5 kB gz, or any lazy chunk count drops, stop and report — do
    not proceed.** Both relocations exist specifically to keep this flat.
13. **Mutation replay (item 26 — commit real work before mutating):** commit the
    finished change first. Then, in `unansweredOutreach.ts`, invert
    `getUnansweredOutreachOpportunities`'s `!rsvps.some(...)` to
    `rsvps.some(...)`. Confirm `SideNav.test.tsx`'s criterion-2 assertion goes
    red, **and** that `StudentHome.test.tsx` also reddens (it exercises the same
    now-relocated function) — report both. Revert, confirm the suite is green.

## Least confident decisions

1. **Coach/admin viewers get no Outreach badge at all** — a visible change from
   today's always-shown placeholder `0`. Wrong if the owner wants a staff-facing
   roster count despite BEH-04 not specifying one. Round 1 flagged the
   session×student pair-count as fabricated and un-clearable; removing it beats
   fixing its scope when no spec exists to fix it *to*.
2. **The `SignupOpportunityRow` handling** (move vs type-import) is left to the
   worker. Wrong if one of those choices recreates the page cycle — which is why
   criterion 12 measures rather than trusts.
3. **Parent = same single-student resolution as student**, not "linked kids
   combined" despite BEH-04's literal wording. Real multi-child aggregation
   would require changing `resolveCurrentStudentId` itself
   (`rows[0].student_id`) — a pre-existing gap this task inherits rather than
   introduces, same as `OutreachList.tsx`'s `StudentParentOutreachView` already does.
4. **`0` for "no linked student" and `0` for "no active season"** rather than two
   distinguishable states. Round 2's gate called this SOUND as a declared
   judgement, not a factual error. Kept.
5. **The three unrecoverable MINOR/NIT tiers.** See the provenance note at the
   top: round 2 raised 10 findings below BLOCKER and only some are reconstructable.
   This is the packet's weakest point and the reviewer should treat it as such.
