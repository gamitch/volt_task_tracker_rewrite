# GAM-439 — worker packet (HEAVY)

**Issue:** <https://linear.app/gamitch/issue/GAM-439/inline-season-goal-editor-on-the-coach-dashboard-updateseason-is-a>
**Branch:** `claude/gam-439-inline-season-goal-editor`
**Tier:** HEAVY (item 26 — write path). Packet → `checker-premise` → worker → `checker-reviewer`.
**Author:** orchestrator (Claude, Opus 5), 2026-08-21.
**Revision 2**, after `checker-premise` round 1 returned REVISE (2 MAJOR,
6 MINOR, 2 NIT). Every line number below has been re-checked; the round-1
corrections are folded in and called out where they change a decision.

---

## 1. The task in one sentence

Put an **admin-only inline editor for the active season's default goal hours**
on the coach dashboard (`src/pages/home/CoachHome.tsx`), writing through a
**new column-scoped loader** that touches only `seasons.default_goal_hours` —
never `name`, `starts_on` or `ends_on`.

## 2. The hazard this packet exists to prevent

`updateSeason` is a full-row write. Verified:

```
src/lib/supabase/loaders/seasons.ts:267-283   makeUpdateSeason() ->
  .update({ name, starts_on, ends_on, default_goal_hours }).eq('id', payload.id)
src/lib/supabase/loaders/seasons.ts:286       export const updateSeason: OnUpdateSeasonFn = makeUpdateSeason()
src/pages/settings/SeasonSettings.tsx:376-378 UpdateSeasonPayload extends CreateSeasonPayload { id }
src/pages/settings/SeasonSettings.tsx:362-367 CreateSeasonPayload { name; startsOn; endsOn; defaultGoalHours } — all four required
```

`SeasonProvider` caches the season object once per mount and only re-fetches
when `refresh()` is called (`src/app/SeasonProvider.tsx:177-204`). So
`activeSeason.season.name` on the dashboard is arbitrarily stale. Reusing
`updateSeason` from the dashboard would ship exactly the corruption the issue
names: saving a number reverts the season's name and dates to whatever the tab
loaded, silently, last-write-wins.

## 3. The five decisions, made — not left to the worker

### D1. Column-scoped write, not full-row, and not read-then-write

**Decision: add `updateSeasonGoal`, a new loader that writes only
`default_goal_hours`.**

Why this and not "re-read the season immediately before writing":

* Re-read-then-write **still races**. It narrows the window; it does not close
  it. The issue says so itself and asks for a deliberate choice.
* Column-scoped write **removes the window entirely** for the three columns
  this control does not edit. Concurrent renames in Season settings and goal
  edits on the dashboard become non-conflicting writes to disjoint columns.
* The "more code" objection is ~14 lines, and **this is the codebase's
  existing pattern for `seasons`, not a new one.** Two precedents, both
  `runMutation`-based single-column updates on this same table:
  - `makeTogglePrivacy`, `src/lib/supabase/loaders/leaderboard_privacy.ts:172-186`
    — `.update({ leaderboard_privacy_enabled: nextValue })`. **This is the
    closest precedent** (round-1 finding): one column, chosen deliberately,
    with nothing else forcing the choice.
  - `makeSetActiveSeason`, `src/lib/supabase/loaders/seasons.ts:298-301`
    (`{ is_active: false }`) and `:302-305` (`{ is_active: true }`). Weaker as
    a "we chose this discipline" precedent, because `seasons_single_active_idx`
    (`supabase/migrations/20260716000000_identity_roster.sql:53-55`) forces the
    two-step shape.
* `makeUpdateSeason`'s own doc comment already states the principle: it
  *"[d]eliberately never touches `is_active`"* (`seasons.ts:261-265`). The new
  loader is the same rule applied to the three columns the dashboard has no
  business writing.

**`updateSeason` is not modified.** `SeasonSettings` legitimately edits all
four fields from a form that shows all four; its full-row write is correct
there.

**Confirmed safe by round 1:** `seasons` has no `updated_at` column, no
triggers, and no CHECK constraints, so a single-column write skips no
bookkeeping a full-row write would have done.
`seasons_single_active_idx` is on `is_active` only and cannot be violated by
this write. `runMutation` (`src/lib/supabase/loader.ts:203-227`) handles a
`.select()`-less `.update()` correctly, resolving `undefined` for
`TResult = void`.

### D2. Types live in the loader module, not in the page

`UpdateSeasonPayload` / `OnUpdateSeasonFn` are declared in
`src/pages/settings/SeasonSettings.tsx` (a page). Do **not** import from that
page into `CoachHome.tsx`.

**Decision: the new payload and function types are declared in
`src/lib/supabase/loaders/seasons.ts`** and exported from there.

**Round-1 correction, and the worker must not "fix" it:** the reverse import
already exists and is load-bearing — `seasons.ts:115-124` imports
`CreateSeasonPayload` / `UpdateSeasonPayload` / `OnUpdateSeasonFn` **from the
page**. So declaring the new types in the loader is a *new* convention for the
new type, not the file's existing one. Leave every existing import alone.

**Do not move the existing `UpdateSeasonPayload`/`OnUpdateSeasonFn`.** That is
a refactor of a passed, unrelated surface with real blast radius, and item 26
does not license it here. The page-to-page import is avoided by *not creating
one*. If a future task consolidates the season types, it does so as its own
row.

### D3. Admin-only — the control, not just the write

`/settings/season` is admin-only: `SeasonSettings` wraps **all three** of its
return branches in `RequireRole(['admin'])` —
`src/pages/settings/SeasonSettings.tsx:888-904`, `:910-919`, `:924-1057` — and
`src/app/router.tsx:322-330` records that the external wrap was removed
*because* the page nests its own.

The dashboard is **less** gated than the issue assumed. Route `/` carries
`RequireAuth` **only, with no `RequireRole`** (`src/app/router.tsx:239-246`);
`DashboardPage` dispatches on `user.role`, and both `admin` and `coach` land on
the same `CoachHome` (`src/pages/home/DashboardPage.tsx:117-124`).

RLS will **not** stop a coach: `create policy staff_all on seasons ... using
(is_staff())` (`supabase/migrations/20260717000002_rls.sql:74-76`) and
`is_staff()` is `auth_role() in ('admin','coach')`
(`20260717000002_rls.sql:15-17`). A coach's write would **succeed**.

**Decision: render the editor only when `user.role === 'admin'`.** A coach sees
the goal figure exactly as today, with no control.

**Use the `user` prop `CoachHomeContent` already receives
(`CoachHome.tsx:2329`), not a second `useAuth()` call** — round-1 correction;
an added hook call would contradict §5b.2's own "do not call the context hook
twice" rule. This mirrors the HOME-04 gate in this same file
(`user.role === 'admin' && …`, `CoachHome.tsx:2433`, reasoning in module doc
entry **#6 at `:174-192`**).

**The governing precedent is `AdminToggles`**, and it is worth reading before
writing this: `src/pages/roster/AdminToggles.tsx:124-147` is an admin-only
widget on a coach-reachable page, writing a `seasons` column RLS lets coaches
write, disclosed as a deliberate UI-stricter-than-RLS decision. It also records
**why `RequireRole` must not be used for an embedded widget**: `RequireRole`
navigates the user away from the *whole page*, so a coach would be ejected from
the dashboard by the mere presence of an admin-only control. Render nothing
instead.

Rationale for admin-only: the Settings surface deliberately withholds this
capability from coaches, and adding it on the dashboard would be a silent
privilege expansion decided by an omission rather than by anyone. The gate is
**UI-only and is not claimed as a security control** (item 25 — small
volunteer team, no PII, RLS already permits staff). It is consistency with
`/settings/season`, stated as such.

### D4. Concurrency with Season settings

**Round-1 correction: three surfaces write `seasons` today**, not two —
`makeUpdateSeason` and `makeSetActiveSeason` (`seasons.ts`) and
`makeTogglePrivacy` (`leaderboard_privacy.ts:172-186`). Four after this task.
The row also carries `leaderboard_privacy_enabled`
(`supabase/migrations/20260720000000_leaderboard_privacy.sql:66-67`), so the
full column set is `id, name, starts_on, ends_on, default_goal_hours,
is_active, leaderboard_privacy_enabled, created_at`.

This **strengthens** D1 rather than complicating it: with column-scoped writes,
all four surfaces touch disjoint columns and none can revert another's.

**Known Risk, disclosed:** a Season-settings tab open elsewhere still holds a
stale `defaultGoalHours` and would write the old number back if its form is
submitted. That is the *pre-existing* behaviour of `SeasonSettings`, out of
scope here, and this task does not make it worse — before this task the
dashboard could not write the column at all. Not filed as a follow-up: item 20
governs deferred *defects*, not disclosed pre-existing behaviour of another
surface.

### D5. Refresh after save — and the skeleton flash, which is real

**This decision replaces revision 1's D4 refresh clause, which round 1 proved
was impossible as written.**

Round 1 measured, in its own worktree, what `activeSeason.refresh()` actually
does:

```
BEFORE refresh:                    hasDashboard= true   hasSkeleton= false  loadActiveSeasonCalls= 1
IMMEDIATELY AFTER refresh (sync):  hasDashboard= false  hasSkeleton= true   loadActiveSeasonCalls= 2
AFTER refresh settles:             hasDashboard= true   hasSkeleton= false  loadActiveSeasonCalls= 2
loadData calls= 2  loadDashboardData calls= 2
```

`SeasonProvider.tsx:182-184` sets `status: 'loading'` unconditionally on every
effect run and `refreshToken` is in the dep array (`:200`), so `refresh()`
always re-enters `'loading'`; `CoachHome.tsx:2278-2280` then returns
`<CoachHomeLoadingSkeleton />`. **`CoachHomeContent` unmounts.** Every goal
save would be a full dashboard reload — `loadData` and `loadDashboardData`
twice each, plus the leaderboard's own fetches — and any "saved" confirmation
would be destroyed in the tick it was created.

**Decision: keep `refresh()`, and make the dashboard render stale-while-
revalidate inside `CoachHome`'s own wrapper.**

Concretely, in `CoachHome` (`CoachHome.tsx:2256-2317`): retain the last
`'ready'` season in a ref or state, and when `activeSeason.status === 'loading'`
**and** a ready season has already been seen this mount, keep rendering
`CoachHomeContent` with the retained season instead of returning the skeleton.
First mount is unchanged — no ready season has been seen, so the skeleton still
shows.

Why this and not "accept the reload":
* It keeps `refresh()`, so **the whole app stays consistent** — every
  `useActiveSeason()` consumer gets the new value.
* It is confined to `CoachHome.tsx`, already an Allowed File. **`SeasonProvider`
  is not modified**, so `TopNav`, `KpiStrip`, `CalendarPage` and `StudentHome`
  keep their current behaviour exactly.
* It restores all four write states (item 12), which the reload made
  impossible.
* It removes the double-fetch: `CoachHomeContent` never unmounts, so its
  `useLoadState`s do not re-run.

**Bound it — this is not a licence to restructure the season-status boundary.**
The `'none'`, `'error'` and first-mount `'loading'` branches keep their current
behaviour byte for byte. Round 1 confirmed the two tests that guard the
first-mount skeleton (`CoachHome.test.tsx:1165-1174` and `:1284-1285`) drive
loading from mount and so are unaffected — **verify that yourself rather than
trusting this line.**

**Disclosed consequence:** while a refresh is in flight the dashboard shows the
previous season object. If an admin elsewhere activated a *different* season,
the dashboard renders the old one for the duration of one fetch and then
corrects itself. That is the ordinary stale-while-revalidate trade and it is
self-correcting.

## 4. Allowed Files

| Path | Why |
| -- | -- |
| `src/lib/supabase/loaders/seasons.ts` | new `makeUpdateSeasonGoal` / `updateSeasonGoal` + its two types |
| `src/lib/supabase/loaders/seasons.test.ts` | loader tests. **This file does not exist today** (verified; `seasons.ts` has no sibling test, and `makeUpdateSeason`'s coverage lives in `src/pages/settings/SeasonSettings.test.tsx:987`). Create it. |
| `src/pages/home/CoachHome.tsx` | the control, its prop seam, the D5 retention, and the module-doc entry |
| `src/pages/home/CoachHome.test.tsx` | component tests |

**Forbidden, explicitly:** `supabase/migrations/**` (no schema change is
needed — `default_goal_hours numeric not null default 100` already exists,
`supabase/migrations/20260716000000_identity_roster.sql:47`),
`.github/workflows/**` (AGENTS.md wall 1), `src/app/SeasonProvider.tsx`,
`src/pages/settings/SeasonSettings.tsx`, `docs/swarm/**`, `.claude/**`.

**`node_modules` is absent from this tree.** Run `npm ci` before any gate,
test or mutation-replay command (round-1 finding).

## 5. Implementation

### 5a. `src/lib/supabase/loaders/seasons.ts`

Add, next to `makeUpdateSeason`:

```ts
/**
 * GAM-439: the goal-only write path. Deliberately touches ONE column, so a
 * caller holding a stale copy of the season cannot revert `name`,
 * `starts_on` or `ends_on` — the corruption GAM-439 was filed for.
 * Same single-column discipline `makeTogglePrivacy`
 * (`./leaderboard_privacy.ts`) already uses on this table, and the
 * write-side counterpart of `makeUpdateSeason`'s own "never touches
 * `is_active`" rule above.
 *
 * NOT a replacement for `updateSeason`: `SeasonSettings` edits all four
 * fields from a form that shows all four, and its full-row write is correct
 * there.
 */
export interface UpdateSeasonGoalPayload {
  id: string;
  defaultGoalHours: number;
}

export type OnUpdateSeasonGoalFn = (payload: UpdateSeasonGoalPayload) => Promise<void>;

export function makeUpdateSeasonGoal(
  getClient: () => SupabaseClient = getSupabaseClient,
): OnUpdateSeasonGoalFn {
  return runMutation<UpdateSeasonGoalPayload, void>(
    (client, payload) =>
      client
        .from('seasons')
        .update({ default_goal_hours: payload.defaultGoalHours })
        .eq('id', payload.id),
    getClient,
  );
}

export const updateSeasonGoal: OnUpdateSeasonGoalFn = makeUpdateSeasonGoal();
```

`runMutation`, `getSupabaseClient` and `SupabaseClient` are already imported in
this file (`seasons.ts:111-113`) — add no new imports.

### 5b. `src/pages/home/CoachHome.tsx`

1. **Seam.** Add `updateSeasonGoal?: OnUpdateSeasonGoalFn` to `CoachHomeProps`
   (`CoachHome.tsx:2162-2198`), defaulting to the real `updateSeasonGoal`, and
   thread it into `CoachHomeContent` — the same injectable-seam convention
   `loadDashboardData` and `loadLeaderboardData` already use there. All props
   on that interface are optional with real-loader defaults, so the existing
   `CoachHome.test.tsx` call sites stay green.
2. **Thread what the write needs.** `CoachHomeContent` already receives `user`,
   `seasonId` and `defaultGoalHours` (`CoachHome.tsx:2328-2342`). Also thread
   `onSeasonChanged: () => void` wired to `activeSeason.refresh` from the outer
   wrapper (`activeSeason` is in scope at `CoachHome.tsx:2264`). Do **not**
   call `useActiveSeason()` or `useAuth()` a second time inside
   `CoachHomeContent`.
3. **D5 retention.** Implement the stale-while-revalidate retention in the
   outer `CoachHome` wrapper as specified in D5.
4. **Placement.** In the header `HStack` (`CoachHome.tsx:2490-2518` — a
   `hAlign="between" wrap="wrap"` row holding a title `VStack` and an inner
   button `HStack`), or as its own row directly beneath it. It must sit above
   the "Hours vs. team goal" card it explains. Measure at 768px with
   `layout-measurement` before settling on the in-row slot; **the own-row
   fallback is pre-approved and needs no further sign-off.**
5. **The control.** `NumberInput` from `@astryxdesign/core`, as `SeasonSettings`
   uses it (`SeasonSettings.tsx:1007-1015`), with a `Button` to commit:
   - `label="Default season goal"`, `units="hrs"`, `min={0}`, `isRequired`.
   - Local state seeded from the `defaultGoalHours` prop.
   - Save is **explicit** (a `Save` button and/or `onEnter`), never on every
     keystroke — this writes a row the whole app divides by.
   - Save is disabled while the value is unchanged, `null`, negative, or a
     request is in flight.
   - Supporting copy naming the semantics, sentence case (item 14 / PRD
     DES-14): `Applies to every student unless overridden in Roster.`
6. **All four states** (item 12 / PRD DES-12) for the *write*:
   - idle/populated — the current value;
   - in-flight — `Button isLoading`, `NumberInput isDisabled`;
   - error — a `Banner status="error"`, title `Couldn't save the season goal`,
     with the typed value **preserved** in the input so the user does not
     retype it;
   - success — a brief confirmation, then `onSeasonChanged()`. D5 is what makes
     this reachable; without it the component would unmount before it rendered.
     No countdown, streak, or other item-17 mechanic.
7. **Error copy — round-1 trap, read this before writing the error branch.**
   `SupabaseLoaderError.message` is **not** the database's message.
   `toLoaderError` (`src/lib/supabase/loader.ts:116-121`) discards it and
   substitutes the fixed `DEFAULT_LOADER_ERROR_MESSAGE`, `"Couldn't load this
   data. Check your connection and try again."` (`loader.ts:93-94`) — *load*
   copy under a *save* title. **Write hand-authored save copy for the Banner
   `description` instead of passing `.message` through.**
   Second half of the same trap: `SupabaseLoaderError` is a **plain object,
   not an `Error` instance**, so `error instanceof Error` is `false` (the trap
   `SeasonSettings.tsx:815-817` already fell into). Use `isSupabaseLoaderError`
   (`loader.ts:125`) if you need to narrow it.
8. **Props come only from `docs/swarm/astryx-api.md`** (item 2). Round 1
   verified every prop this packet prescribes is real: `NumberInput` `label`
   (`:1183`), `value` (`:1184`, `number | null | undefined`), `onChange`
   (`:1185`, `(value: number) => void`), `isRequired` (`:1190`), `isDisabled`
   (`:1191`), `status` (`:1197`), `min` (`:1198`), `units` (`:1201`), `onEnter`
   (`:1209`); `Button isLoading` (`:1818`). Any prop you add beyond these,
   check yourself — absent from that file is presumed hallucinated → MAJOR.
9. **Module doc.** This file's numbered module doc (`CoachHome.tsx:5-660`,
   entries 1-16) is the record of every prior change. Add a numbered GAM-439
   entry in the same voice: what was added, why the write is column-scoped,
   why it is admin-only, and what D5's retention does and does not change.

### 5c. Accessibility (item 15 / PRD DES-17)

The label is real, not a placeholder. The whole path — focus the input, type,
Tab to Save, Enter — works from the keyboard, and the error Banner is
reachable and announced. Do not hide the label without `isLabelHidden` plus an
equivalent accessible name.

## 6. Acceptance criteria — each measurable today

Item 27: criterion **A1 names the real source**, not the render.

| # | Criterion | How it is measured |
| -- | -- | -- |
| A1 | The control writes through `updateSeasonGoal` from `src/lib/supabase/loaders/seasons.ts` — the real loader, no fixture, no stub — reached on the real user path (`/` as an admin). Its default prop value is the real export. | Read the prop chain end to end; the injected seam's *default* must be the real function. |
| A2 | `updateSeasonGoal` issues `.update()` with **exactly one key**, `default_goal_hours`. | Loader test asserting `Object.keys(...)` of the object passed to `.update()` has length 1. **A test that only asserts `default_goal_hours` is present would pass while the bug ships** — assert the key set, not the key. **Harness:** copy `makeFakeUpdateClient` from `src/pages/settings/SeasonSettings.test.tsx:973-984`, which fakes exactly `.from('seasons').update({...}).eq('id', ...)` and at `:1001-1008` already asserts a key-set property; or `makeFakeUpdateEqClient`, `src/pages/roster/AdminToggles.test.tsx:285-298`, which adds the `{data:null,error:null}` and error-rejection cases. **Do not model this on `coachHome.test.ts` — it has no `update` spy** (round-1 finding). |
| A3 | Saving a new goal leaves `name`, `starts_on` and `ends_on` unchanged in the row. | `e2e-personas` write-then-read-back of all four columns (§7). |
| A4 | A coach (role `coach`) sees **no** editor on the dashboard; an admin does. | `CoachHome.test.tsx` under both roles — the harness exists and is already in use: `src/test-utils/authHarness.tsx:131-150` exports `LoginAs`/`LoginAsDeferred`, and `CoachHome.test.tsx:111-112, 133-168` already renders as both `COACH_USER` and `ADMIN_USER`. |
| A5 | All four write states render: idle, in-flight, error (with the typed value preserved), **and success**. | Component tests, one per state, with a rejecting seam for error. The success leg is only reachable because of D5 — if it is not, D5 is not implemented correctly. |
| A6 | A successful save re-fetches the active season. | **Assert `SeasonProvider`'s injected `loadActiveSeason` was called a second time** (1 → 2). `CoachHome.test.tsx:133-137` already threads this seam as `renderAsUser`'s third parameter, and round 1 proved the assertion works. This tests the real wiring rather than a prop being called. `CoachHomeContent` is **not** exported, so do not write a criterion that requires injecting into it directly (round-1 finding). |
| A7 | No new dependency; every Astryx prop used appears in `astryx-api.md`. | `package.json` diff is empty; props checked against the tables cited in §5b.8. |
| A8 | D5 does not change first-mount behaviour: the season-loading skeleton, the `'none'` banner and the `'error'` banner all render as they do today. | The existing tests at `CoachHome.test.tsx:1165-1174` and `:1284-1285` stay green **unmodified** — if either needs editing to pass, D5 was implemented too broadly and that is a failure, not a test to update. |
| A9 | Six gates green. | `gate-run`, pasted verbatim. |

## 7. Verification the issue requires — do all three

* **`mutation-replay`** on A2's loader test. Mutant: add a second key to the
  `.update()` object — a **literal**, e.g. `name: 'x'`, because
  `UpdateSeasonGoalPayload` has no `name` field and `payload.name` would fail
  to compile rather than fail the assertion (round-1 finding). Confirm the test
  goes **red**, with real output and exit code. A green suite nobody has
  watched fail is not evidence. Commit before mutating; mutate in your own
  worktree, never the shared tree (items 23, 26).
* **`e2e-personas`** as **admin**: change the goal, then **read the row back**
  and assert all four columns — `default_goal_hours` changed, `name`,
  `starts_on`, `ends_on` identical. Then as **coach**: confirm the control is
  absent.
* **`scratch-postgres`** is **not required**: this packet proposes no new SQL
  path, no migration, and no policy change — it reuses the existing `seasons`
  table through the existing `runMutation` helper. The issue scopes that skill
  to "if the packet proposes a new SQL path." Round 1 independently confirmed
  no schema change is needed. Recorded so the omission is a decision, not a
  gap.

## 8. Least confident decisions (item 19d)

Revision-2 list. Round 1 resolved the previous entries 2 and 5 by measurement;
entries 1 and 4 survived as sound and are not re-litigated here.

1. **D5's stale-while-revalidate is the right call over simply accepting the
   reload.** Wrong if the retention interacts badly with a *season switch* —
   an admin activating a different season elsewhere while this dashboard is
   mounted, where rendering the previous season's data for one fetch could show
   figures attributed to the wrong season name. I judged this acceptable
   because it is one fetch long and self-correcting, and because the
   alternative ships a full dashboard reload on every save. What would change
   my mind: the checker finding that `CoachHomeContent`'s children key off
   `seasonId` in a way that makes the intermediate render *wrong* rather than
   merely stale.
2. **D5 belongs in `CoachHome.tsx` rather than in `SeasonProvider`.** Wrong if
   the checker judges that a provider-level `keepPreviousData` is the correct
   home for this and that solving it per-consumer is duplication waiting to
   happen. I chose the local fix because `SeasonProvider` has four other
   consumers whose behaviour I would be changing without a task, and because it
   keeps this task inside its Allowed Files. If the checker disagrees, the
   remedy is a follow-up row against `SeasonProvider`, not a widened scope
   here.
3. **Admin-only (D3).** Unchanged from revision 1 and still my least confident
   *product* call: wrong if the owner's intent is that coaches edit this, as
   the production tracker's own dashboard row might imply. What would settle
   it: the owner saying so. I chose the conservative side because expanding a
   capability by omission is unrecoverable-by-default, while granting it later
   is one line.
4. **A5's success leg is genuinely testable once D5 lands.** Wrong if
   `onSeasonChanged()` still tears the component down through some path I have
   not traced — round 1 measured the unmount under revision 1's design, not
   under D5's. **The worker must confirm the success state actually renders in
   a test, and if it does not, stop and report rather than deleting the
   criterion.** This is the one place where revision 2 is relying on a
   prediction rather than a measurement.
5. **Placing the control in the header row (§5b.4).** Wrong if that
   `wrap="wrap"` row is already at its limit at narrow viewports and a fourth
   element makes it illegible. Measure at 768px; the own-row fallback is
   pre-approved.
