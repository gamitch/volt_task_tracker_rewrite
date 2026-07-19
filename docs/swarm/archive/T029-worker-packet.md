# Worker Packet: T029

## Task ID
T029

## Objective
Build `src/pages/settings/SeasonSettings.tsx` — `/settings/season` (SET-04), admin-only:
create/edit seasons (name, start/end `DateRangeInput`, default goal hours `NumberInput`), set active
season. Exactly one active season enforced; switching the active season confirms via `AlertDialog`
(DES-11).

## Dependencies (status)
- T021 (`/roster` shell) — Passed. Not directly consumed (this page lives under `/settings`, not
  `/roster`), but T028's admin-toggles shortcut link (a separate, parallel task) is expected to
  navigate here — no coordination needed beyond both citing the same real route path.
- T009 (identity/roster migration) — Passed. **The exactly-one-active-season constraint already
  exists at the DB level** — read `supabase/migrations/20260716000000_identity_roster.sql` lines
  41-53 before writing any UI logic: `seasons.is_active boolean not null` plus a real, applied
  **partial unique index** (`create unique index seasons_single_active_idx on public.seasons
  (is_active) where is_active = true`). This means the DB itself will reject a second
  `is_active=true` row — your UI's job is to make switching feel correct and confirmed (the
  `AlertDialog`), not to reinvent the single-active enforcement from scratch. Cite this index
  directly in your output.

## Allowed Files
- `src/pages/settings/SeasonSettings.tsx` (new — confirm via `Glob` that `src/pages/settings/`
  doesn't exist yet)
- A colocated `SeasonSettings.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/roster/**` — read-only reference only (e.g. for the admin-only gating pattern).
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only. `/settings/season` is not
  yet wired to any real component (same recurring, already-disclosed reachability gap every
  not-yet-built route has) — this task does not wire itself in.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadData`/`onCreateSeason`/`onSetActiveSeason`-style seam with obviously-fake fixture
  defaults.
- `supabase/migrations/**` — read-only. **Do not write a migration** — the constraint already exists
  (see Dependencies above); if you find it insufficient for some reason, flag that as a dispute
  candidate rather than editing/adding a migration yourself.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`seasons`: `id`, `name`, `starts_on` (date), `ends_on` (date), `default_goal_hours` (numeric,
default 100), `is_active` (boolean, not null) — `20260716000000_identity_roster.sql` lines 40-49,
plus the partial unique index at lines 51-53.

## Known Context / Traps

**1. "Exactly one active season" — dual-layer enforcement, both layers real.** The DB layer
(partial unique index) already exists and is real — a real INSERT/UPDATE attempting to set a second
season `is_active=true` would fail at the database. Your UI layer's job is the **user experience**
around switching: when an admin activates a different season, the previous active season must be
deactivated as part of the same logical operation (your injectable `onSetActiveSeason` callback
should represent this as one atomic-feeling action, e.g. "deactivate old, activate new" — not two
separate calls the UI leaves half-done), confirmed via a real `AlertDialog` (DES-11) before it
happens. State clearly in your output how your callback contract represents this atomicity, even
though the real backend transaction logic is a future wiring task's job.

**2. `DateRangeInput` for start/end, `NumberInput` for default goal hours** — cite the real documented
props from `astryx-api.md` (both components are already used by sibling tasks in this batch —
`ScheduleMeetingsDialog.tsx`/T031 used `DateRangeInput` for its own recurring-range picker; check its
citation for a consistent starting point, though don't just copy it blindly — re-verify against the
docs yourself).

**3. Create AND edit, one form or two?** SET-04's text doesn't specify whether create/edit share one
dialog/form component or are separate flows — your call, disclose your reasoning (a single reusable
form component pre-filled for edit is the more common pattern and is likely the right one, but state
it explicitly rather than assuming silently).

**4. Season date-range validation** — a season's `starts_on` must be before its `ends_on` (basic
sanity the UI should enforce before allowing submission, even though the DB schema itself doesn't
have a `CHECK` constraint for this per the migration file — confirm this yourself by reading the
file, and disclose whether you think a DB-level check constraint is also warranted as a future
follow-up, without adding one yourself since migrations are forbidden here).

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Create/edit seasons with all four fields (name, start/end `DateRangeInput`, default goal hours
  `NumberInput`).
- Set-active-season flow confirms via a real `AlertDialog` (DES-11) before switching.
- The DB-level exactly-one-active constraint is cited and understood, not re-implemented from
  scratch; the UI's switching callback represents the old-deactivate + new-activate as one coherent
  action.
- Basic start-before-end date validation enforced client-side.
- Admin-only gating (same posture as T028 — SET-04 says "admin only").
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration
> file → BLOCKER. *(Cited because the exactly-one-active constraint already exists — do not add a
> redundant or conflicting migration.)*

## Most Recent Failure
None. This is attempt 1 for T029 (attempt count: 0).

## Required Worker Output
- Full contents of `SeasonSettings.tsx`.
- Explicit citation of `seasons_single_active_idx` and how your UI's switching flow relates to it.
- Real test proof of the AlertDialog-confirmed active-season switch and the date-range validation.
- Explicit write-up of your create-vs-edit form-reuse decision.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
