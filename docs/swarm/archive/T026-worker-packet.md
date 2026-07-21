# Worker Packet: T026

## Task ID
T026

## Objective
Build `src/pages/roster/TeamsTab.tsx` — the Teams tab (ROS-06): manage teams (name, short_name,
program FRC/FTC/Other, color chip from Astryx variants, sort order). Teams are **archived**, not
deleted, by default. Hard delete only via `AlertDialog`, and only when a team has no students or
history.

## Dependencies (status)
- T021 (`/roster` shell) — Passed. Read `RosterShell.tsx` (read-only) for the placeholder slot and
  the established `RequireRole`-nesting pattern.
- T022 (Students tab) — Passed. Read `StudentsTab.tsx` (read-only) for the established
  reversible-state-flip `AlertDialog` idiom (relevant here since Archive is a similar reversible
  flip, while Hard Delete is genuinely destructive and irreversible).

## Allowed Files
- `src/pages/roster/TeamsTab.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `TeamsTab.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/roster/RosterShell.tsx`, `StudentsTab.tsx` — already-Passed sibling tasks' files,
  read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadData`-style seam with obviously-fake fixture defaults.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`teams`: `id`, `name` (unique), `short_name`, `program` (nullable, `check in ('FRC','FTC','Other')`),
`color`, `archived` (default `false`), `sort_order` (default `0`) —
`20260716000000_identity_roster.sql` lines 27-35.

## Known Context / Traps

**1. Archive vs. Hard Delete are two structurally different actions — do not conflate them.**
Archive (`archived: true`) is the default, safe, **reversible** action — same posture as
`StudentsTab.tsx`'s Deactivate/Reactivate: the team row stays visible in this table with an
"Archived" indicator, disappears from selectors/expected rosters elsewhere in the app, but keeps
history. Hard delete is genuinely destructive and **irreversible** — it must be blocked (button
disabled or hidden, your call, disclose it) whenever the team has any students or history, and even
when allowed, must confirm via a real `AlertDialog` with unambiguous "this cannot be undone" copy
(distinct from Archive's reversible-sounding copy).

**2. "No students or history" — define this concretely against your fixture data, don't hand-wave
it.** A team blocks hard-delete if any `students.team_id` row references it (active OR inactive —
even a deactivated student who was once on the team counts as "history"), or if any historical
`event_sessions`/`attendance` data references the team (through its students). Since you're working
against fixture data with no shared Supabase client, model this as a simple boolean/count your
fixture loader supplies per team (e.g. `hasStudentsOrHistory: boolean`), and prove your UI correctly
disables/blocks hard-delete when that flag is true and allows it when false — the point is the UI
logic correctness, not a real cross-table query (that's a future wiring task's job).

**3. Program `check in ('FRC','FTC','Other')`** — use a real, closed selector (`Selector`, per
Astryx's documented component — cite it) with exactly these three options, not a free-text field.
`program` is nullable — decide and disclose how you represent "no program set" in the UI (e.g. an
empty/placeholder state, not a fabricated fourth option).

**4. "Color chip from Astryx variants"** — the real `teams.color` column is free-text (not a
constrained enum), same gap `StudentsTab.tsx` already found and disclosed for its own team-`Badge`
rendering (it deliberately used a neutral variant rather than mapping free-text to a closed enum).
This task, however, is the CRUD surface itself — you need a real color picker/selector for creating
a team's `color` value. Investigate what Astryx actually offers here (a documented color-swatch
selector component, or just a closed set of variant strings presented as swatches) and disclose your
approach; do not invent a component that isn't documented (constitution item 2).

**5. Sort order** — a real, working reorder mechanism (drag-and-drop is not required unless Astryx
has a documented, easy-to-use pattern for it; a simple up/down control or a `NumberInput` per row is
acceptable — your call, disclose it) that updates `sort_order` and is reflected in the displayed
order.

**6. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Full team CRUD: name, short_name, program (closed 3-option selector), color, sort order.
- Archive is the default, reversible action; archived teams stay visible here (with an indicator)
  but are disclosed as disappearing from selectors/expected rosters elsewhere.
- Hard delete is blocked whenever a team has students or history (fixture-modeled, UI logic proven
  correct), confirms via a real, unambiguously-destructive-worded `AlertDialog` when allowed.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T026 (attempt count: 0).

## Required Worker Output
- Full contents of `TeamsTab.tsx`.
- Explicit write-up of the Archive-vs-Hard-Delete distinction and the "no students or history" gate
  logic, with real test proof of the block/allow boundary.
- Explicit write-up of the color-chip/selector investigation and approach chosen.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
