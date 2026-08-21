# GAM-439 — worker packet (HEAVY)

**Issue:** <https://linear.app/gamitch/issue/GAM-439/inline-season-goal-editor-on-the-coach-dashboard-updateseason-is-a>
**Branch:** `claude/gam-439-inline-season-goal-editor`
**Tier:** HEAVY (item 26 — write path). Packet → `checker-premise` → worker → `checker-reviewer`.
**Author:** orchestrator (Claude, Opus 5), 2026-08-21.

All citations below were read from the working tree at
`e1c49b8` before this packet was written (item 19c).

---

## 1. The task in one sentence

Put an **admin-only inline editor for the active season's default goal hours**
on the coach dashboard (`src/pages/home/CoachHome.tsx`), writing through a
**new column-scoped loader** that touches only `seasons.default_goal_hours` —
never `name`, `starts_on` or `ends_on`.

## 2. The hazard this packet exists to prevent

`updateSeason` is a full-row write. Verified:

```
src/lib/supabase/loaders/seasons.ts:268-282   makeUpdateSeason() ->
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

## 3. The four decisions, made — not left to the worker

### D1. Column-scoped write, not full-row, and not read-then-write

**Decision: add `updateSeasonGoal`, a new loader that writes only
`default_goal_hours`.**

Why this and not "re-read the season immediately before writing":

* Re-read-then-write **still races**. It narrows the window; it does not close
  it. The issue says so itself and asks for a deliberate choice.
* Column-scoped write **removes the window entirely** for the three columns
  this control does not edit. Concurrent renames in Season settings and goal
  edits on the dashboard become non-conflicting writes to disjoint columns.
* The "more code" objection is ~14 lines, and **the exact pattern already
  exists in this same file**: `makeSetActiveSeason` performs single-column
  updates (`.update({ is_active: false })`,
  `src/lib/supabase/loaders/seasons.ts:302-305`), deliberately. This is not a
  new pattern being invented on a write path; it is the file's existing one.
* `makeUpdateSeason`'s own doc comment already establishes the principle:
  it *"[d]eliberately never touches `is_active`"* (`seasons.ts:260-266`). The
  new loader is the same rule applied to the three columns the dashboard has
  no business writing.

**`updateSeason` is not modified.** `SeasonSettings` legitimately edits all
four fields from a form that shows all four; its full-row write is correct
there.

### D2. Types live in the loader module, not in the page

`UpdateSeasonPayload` / `OnUpdateSeasonFn` are declared in
`src/pages/settings/SeasonSettings.tsx` (a page). Do **not** import from that
page into `CoachHome.tsx`.

**Decision: the new payload and function types are declared in
`src/lib/supabase/loaders/seasons.ts`** and exported from there. `CoachHome`
imports its type from the loader module it already sits below in the
dependency graph.

**Do not move the existing `UpdateSeasonPayload`/`OnUpdateSeasonFn`.** That is
a refactor of a passed, unrelated surface with real blast radius
(`SeasonSettings.tsx` and its tests), and item 26 does not license it here. The
page-to-page import is avoided by *not creating one*, not by relocating
existing types. If a future task consolidates the season types, it does so as
its own row.

### D3. Admin-only — the control, not just the write

`/settings/season` is admin-only: `SeasonSettings` wraps **every** return
branch in `RequireRole(['admin'])` — three of them, at
`src/pages/settings/SeasonSettings.tsx:888-904`, `910-919` and `924-1057` —
and `src/app/router.tsx:312, 323-324` records that the external wrap was
removed *because* the page nests its own.

The dashboard is **less** gated than the issue assumed, not more. Route `/`
carries `RequireAuth` **only, with no `RequireRole` at all**
(`src/app/router.tsx:239-246`); `DashboardPage` dispatches on `user.role`, and
both `admin` and `coach` land on the same `CoachHome`
(`src/pages/home/DashboardPage.tsx:117-124`). So role separation on this
surface has to be done *inside* `CoachHome` — and **that pattern already
exists in this exact file**: the HOME-04 season-setup card is gated by
`user.role === 'admin' && …` at `src/pages/home/CoachHome.tsx:2433`, with the
reasoning in its module doc at `:201-206`. The new control follows it.

RLS will **not** stop a coach: `create policy staff_all on seasons ... using
(is_staff())` (`supabase/migrations/20260717000002_rls.sql:74-76`) and
`is_staff()` is `auth_role() in ('admin','coach')`
(`20260717000002_rls.sql:14-16`). So a coach's write would **succeed**.

**Decision: render the editor only when `useAuth().user.role === 'admin'`.**
A coach sees the goal figure exactly as today, with no control. Rationale: the
Settings surface deliberately withholds this capability from coaches, and
adding it on the dashboard would be a silent privilege expansion decided by an
omission rather than by anyone. Changing who may set every student's goal
denominator is the owner's call, not this task's — if the owner wants coaches
to have it, that is a one-line follow-up with a decision attached.

The gate is **UI-only and is not claimed as a security control** (item 25 —
this is a small volunteer team, and RLS already permits staff). It is
consistency with `/settings/season`, stated as such.

### D4. Concurrency with Season settings

Two surfaces edit one row. With D1 they edit **disjoint columns**, so the
corruption case is closed. Residual: after a successful save the dashboard's
cached season is stale for its own `defaultGoalHours`.

**Decision: call `activeSeason.refresh()` after a successful save**
(`src/app/SeasonProvider.tsx:202-204, 133`). This re-fetches the season for
every consumer in the session, so the dashboard's derived goal figures
(`sumGoalHours`, `CoachHome.tsx:1093-1101`) recompute against the value that
is actually in the database rather than against what the user typed.

**Known Risk, disclosed:** a Season-settings tab open elsewhere still holds a
stale `defaultGoalHours` and would write the old number back if its form is
submitted. That is the *pre-existing* behaviour of `SeasonSettings` and is out
of scope here; this task does not make it worse, because before this task the
dashboard could not write the column at all. Not filed as a follow-up — no
user-visible defect is being deferred, and item 20 governs deferred defects,
not disclosed pre-existing behaviour of another surface.

## 4. Allowed Files

| Path | Why |
| -- | -- |
| `src/lib/supabase/loaders/seasons.ts` | new `makeUpdateSeasonGoal` / `updateSeasonGoal` + its two types |
| `src/lib/supabase/loaders/seasons.test.ts` | loader tests. **This file does not exist today** — verified 2026-08-21; `seasons.ts` has no sibling test, and the existing coverage of `makeUpdateSeason` lives in `src/pages/settings/SeasonSettings.test.tsx`. Create it, following the harness an existing loader test uses (e.g. `src/lib/supabase/loaders/coachHome.test.ts`). |
| `src/pages/home/CoachHome.tsx` | the control, its prop seam, and the module-doc entry |
| `src/pages/home/CoachHome.test.tsx` | component tests |

**Forbidden, explicitly:** `supabase/migrations/**` (no schema change is
needed — `default_goal_hours numeric not null default 100` already exists,
`supabase/migrations/20260716000000_identity_roster.sql:47`),
`.github/workflows/**` (AGENTS.md wall 1), `src/pages/settings/SeasonSettings.tsx`,
`docs/swarm/**`, `.claude/**`.

## 5. Implementation

### 5a. `src/lib/supabase/loaders/seasons.ts`

Add, next to `makeUpdateSeason`:

```ts
/**
 * GAM-439: the goal-only write path. Deliberately touches ONE column, so a
 * caller holding a stale copy of the season cannot revert `name`,
 * `starts_on` or `ends_on` — the corruption GAM-439 was filed for.
 * Same single-column discipline `makeSetActiveSeason` below already uses,
 * and the write-side counterpart of `makeUpdateSeason`'s own "never touches
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

Match the file's existing import set and `runMutation` usage exactly
(`src/lib/supabase/loader.ts:203-227`); add no new imports if `runMutation`,
`getSupabaseClient` and `SupabaseClient` are already imported there (they are —
`makeUpdateSeason` uses all three).

### 5b. `src/pages/home/CoachHome.tsx`

1. **Seam.** Add `updateSeasonGoal?: OnUpdateSeasonGoalFn` to `CoachHomeProps`,
   defaulting to the real `updateSeasonGoal`, and thread it into
   `CoachHomeContent` as a required prop — the same injectable-seam convention
   every `loadData` prop in this file already uses (`CoachHome.tsx:2256-2262`).
2. **Thread what the write needs.** `CoachHomeContent` already receives
   `seasonId` and `defaultGoalHours` (`CoachHome.tsx:2328-2342`). Also thread
   `onSeasonChanged: () => void` wired to `activeSeason.refresh` from the outer
   `CoachHome` wrapper (`activeSeason` is already in scope at
   `CoachHome.tsx:2264`). Do **not** call `useActiveSeason()` a second time
   inside `CoachHomeContent`.
3. **Placement.** In the header `HStack` (`CoachHome.tsx:2490-2518`), below the
   eyebrow/title `VStack` or as its own row directly beneath — a compact
   labelled control, not a new full-width panel. It must sit above the "Hours
   vs. team goal" card it explains.
4. **The control.** `NumberInput` from `@astryxdesign/core`, exactly as
   `SeasonSettings` uses it (`SeasonSettings.tsx:1007-1015`), with a `Button`
   to commit:
   - `label="Default season goal"`, `units="hrs"`, `min={0}`, `isRequired`.
   - Local state seeded from the `defaultGoalHours` prop.
   - Save is **explicit** (a `Save` button and/or `onEnter`), never on every
     keystroke — this writes a row the whole app divides by.
   - Save is disabled while the value is unchanged, `null`, negative, or a
     request is in flight.
   - Supporting copy naming the semantics, sentence case (item 14 / PRD
     DES-14): `Applies to every student unless overridden in Roster.`
5. **All four states** (item 12 / PRD DES-12) for the *write*:
   - idle/populated — the current value;
   - in-flight — `isLoading` on the Button, input disabled;
   - error — a `Banner status="error"` with the `SupabaseLoaderError.message`,
     title `Couldn't save the season goal`, and the typed value **preserved**
     in the input so the user does not retype it;
   - success — call `onSeasonChanged()`; a brief confirmation is fine but must
     not be a countdown, streak, or any other item-17 mechanic.
6. **Props come only from `docs/swarm/astryx-api.md`** (item 2). `NumberInput`'s
   table is `astryx-api.md:1179-1209`; a prop not in it is presumed
   hallucinated. Note `onChange` is `(value: number) => void` and `value`
   accepts `number | null | undefined`.
7. **Module doc.** This file's module doc is the record of every prior change
   (`CoachHome.tsx:504-620`). Add a numbered GAM-439 entry in the same voice:
   what was added, why the write is column-scoped, and why it is admin-only.

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
| A2 | `updateSeasonGoal` issues `.update()` with **exactly one key**, `default_goal_hours`. | Loader test asserting the object passed to `.update()` has `Object.keys(...)` of length 1. **A test that only asserts `default_goal_hours` is present would pass while the bug ships** — assert the key set, not the key. |
| A3 | Saving a new goal leaves `name`, `starts_on` and `ends_on` unchanged in the row. | `e2e-personas` write-then-read-back of all four columns (§7). |
| A4 | A coach (role `coach`) sees **no** editor on the dashboard; an admin does. | `CoachHome.test.tsx` renders under both roles via the existing auth harness (`src/test-utils/authHarness.tsx`), the same way the HOME-04 admin card at `CoachHome.tsx:2433` is already covered. |
| A5 | All four write states render: idle, in-flight, error (with the typed value preserved), success. | Component tests, one per state, with a rejecting seam for error. |
| A6 | A successful save calls `activeSeason.refresh()`. | Component test asserting the injected refresh/`onSeasonChanged` seam fired. |
| A7 | No new dependency; `NumberInput` props all appear in `astryx-api.md:1179-1209`. | `package.json` diff is empty; props checked against that table. |
| A8 | Six gates green. | `gate-run`, pasted verbatim. |

## 7. Verification the issue requires — do all three

* **`mutation-replay`** on A2's loader test. Mutate `makeUpdateSeasonGoal` to
  the full-row payload (i.e. re-add `name`/`starts_on`/`ends_on`) and confirm
  the test goes **red**, with the real output and exit code. A green suite
  nobody has watched fail is not evidence. Commit before mutating; mutate in
  your own worktree, never the shared tree (items 23, 26).
* **`e2e-personas`** as **admin**: change the goal, then **read the row back**
  and assert all four columns — `default_goal_hours` changed, `name`,
  `starts_on`, `ends_on` identical. Then as **coach**: confirm the control is
  absent.
* **`scratch-postgres`** is **not required**: this packet proposes no new SQL
  path, no migration, and no policy change — it reuses the existing
  `seasons` table through the existing `runMutation` helper. The issue scopes
  that skill to "if the packet proposes a new SQL path." Recorded here so the
  omission is a decision, not a gap.

## 8. Least confident decisions (item 19d)

1. **Admin-only (D3) is the right call.** Wrong if the owner's intent for the
   production tracker's equivalent row is that coaches edit it — the issue
   quotes the tracker putting this control at the top of *its* dashboard, and
   does not say who may use it there. What would settle it: the owner saying
   so. I chose the conservative side because expanding a capability by
   omission is unrecoverable-by-default, while granting it later is one line.
2. **Column-scoped write (D1) needs no `updated_at` bookkeeping.** Wrong if
   anything derives freshness from a row-level timestamp. I checked
   `seasons` and it has **`created_at` only** — no `updated_at` column and no
   trigger (`20260716000000_identity_roster.sql:42-50`) — so there is nothing
   a full-row write would have maintained that this one skips. If the checker
   finds an `updated_at` I missed, D1 needs a second column in the payload.
3. **Placing the control in the GAM-438 header `HStack`** (§5b.3). Wrong if
   that row is already at its wrap limit at narrow viewports and a fourth
   element makes it illegible — it currently holds a title block and up to two
   buttons with `wrap="wrap"`. Measure with `layout-measurement` at 768px
   before settling on the exact slot; moving it to its own row beneath the
   header is the pre-approved fallback and needs no further sign-off.
4. **Not moving `UpdateSeasonPayload` out of `SeasonSettings.tsx`** (D2).
   Wrong if the checker judges that leaving two season-update payload types in
   two different modules is more confusing than one relocation — a real
   argument. I weighted "don't refactor a passed surface inside a write-path
   task" higher, and the new type is named distinctly
   (`UpdateSeasonGoalPayload`) precisely so the two do not read as duplicates.
5. **`refresh()` after save (D4) is sufficient, and optimistic local state is
   not needed.** Wrong if `refresh()`'s documented behaviour — it sets
   `status: 'loading'` again on every run (`SeasonProvider.tsx:128-131,
   182-184`) — makes the **whole dashboard flash back to its skeleton** after
   every save. `CoachHome` returns `<CoachHomeLoadingSkeleton />` on
   `activeSeason.status === 'loading'` (`CoachHome.tsx:2279-2280`), so this is
   a live risk, not a theoretical one. **The worker must check this and say
   what happened.** If it does flash, keep the write and the `refresh()` and
   report it — do not paper over it with local-only state that would leave the
   rest of the app reading the old goal.
