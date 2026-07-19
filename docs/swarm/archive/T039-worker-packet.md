# Worker Packet: T039

## Task ID
T039

## Objective
Build `src/pages/outreach/OutreachEventDialog.tsx` — New/edit outreach event `Dialog` (OUT-02),
fields in this exact order: title, description, location name + address, category, schedule mode
(single/multi-day/recurring/custom dates → `event_sessions`), per-session start/end times, expected
people-reached placeholder per day, adult volunteers (`NumberInput` ×2: count and hours), team
scope, "Share to calendar feed" (default ON). A type `Selector` exposes `counts_participation`/
`counts_volunteer_hours` flags only for competitions (CMP-01/02). Disabled "Create event" until
title + ≥1 dated session.

## Dependencies (status)
- T038 (`/outreach` list) — Passed. Read `OutreachList.tsx` (read-only) for established
  `events`/`event_sessions` fixture conventions.
- T031 (Schedule meetings dialog) — Passed. **This task shares a resolved cross-task question with
  T031: the `event_sessions.notes` NOT NULL nullability gap.** T031 already resolved this (choosing
  to always supply an empty-string value in its INSERT payload rather than shipping a migration) —
  read `docs/swarm/archive/T031-worker-packet.md`'s "Known Context/Traps #1" and
  `ScheduleMeetingsDialog.tsx` itself (read-only) for the exact precedent. **Match that same
  resolution here** (always supply a value, never `undefined`/`null`) — do not independently
  re-decide this or ship a redundant/conflicting migration; the coordination note in this task's own
  ledger amendment ("whichever task lands first should do the migration once, not twice") is now
  moot since T031 already landed and chose the no-migration path.

## Allowed Files
- `src/pages/outreach/OutreachEventDialog.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `OutreachEventDialog.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/outreach/OutreachList.tsx`, `RsvpControl.tsx` (if it exists by dispatch time) —
  already-Passed/sibling tasks' files, read-only reference only.
- `src/pages/outreach/OutreachDetail.tsx`, `MarkDayCompleteDialog.tsx`, `ParentRsvp.tsx`,
  `Leaderboard.tsx` — separate, not-yet-built tasks. Do not build their content here.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `onCreateEvent`-style callback seam with an obviously-fake default.
- `supabase/migrations/**` — read-only. **Do not write a migration** — T031 already resolved the
  shared `notes` question without one.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
`events`: `id`, `season_id`, `type` (`'meeting'|'outreach'|'competition'`), `title`, `description`,
`location_name`, `location_address` (confirm exact column names yourself), `team_ids` (nullable
array), `created_by`, `counts_participation`, `counts_volunteer_hours`, adult-volunteers
count/hours columns (confirm exact names) —
`20260717000000_scheduling_attendance.sql` lines 33-48. `event_sessions`: `starts_at`, `ends_at`,
`notes` (`not null`, no default), `people_reached` (nullable) — same file, lines 53-63.

## Known Context / Traps

**1. THE CENTRAL SPEC TENSION — "category fixed outreach" vs. the type Selector.** OUT-02's own
literal PRD text says this dialog's category is "**category fixed `outreach`**" — but this task's
own ledger Objective explicitly requires "a type `Selector` exposes `counts_participation`/
`counts_volunteer_hours` flags only for competitions," which presupposes the dialog CAN create
competition-type events, and CMP-01 independently confirms "Competitions are... created from
Calendar or Outreach's **New event** dialog via a type `Selector` (admin/coach)." These two PRD
statements are in real tension for this specific file. **Investigate and disclose your resolution**
— the more defensible reading, given the ledger's own explicit Objective and CMP-01's explicit
naming of this dialog, is that the type `Selector` DOES exist and DOES include `'outreach'`
(default) and `'competition'` as real options (with `'meeting'` excluded, since meetings have their
own separate dialog, T031) — "category fixed outreach" in OUT-02's raw text is best read as
describing the *common case*, not a hard technical constraint contradicting CMP-01 and this task's
own Objective. State your reasoning explicitly rather than picking one silently.

**2. CMP-02 flag defaults — real, specific, checker-scrutinized.** `counts_participation`/
`counts_volunteer_hours` default to `false` for competitions, and are fixed `true`/`false`
respectively for meetings/outreach per their type (not user-editable for non-competition events).
The UI exposes the flag TOGGLES only when `type === 'competition'` — for `type === 'outreach'`, the
flags exist on the row but are hardcoded to their fixed values, never shown as editable controls.

**3. `event_sessions.notes` nullability** — see Dependencies above. Match T031's resolution exactly
(always supply a value, e.g. `''`).

**4. BEH-07 confirm button** — "Create event" (or an edit-mode equivalent), never a bare
"Submit"/"OK", same discipline as every dialog in this batch.

**5. "Disabled until title + ≥1 dated session"** — same testable, non-visual-only disabled-state
discipline `ScheduleMeetingsDialog.tsx`/T031 already established (a real `disabled` attribute, not
just a styled-to-look-disabled button).

**6. Adult volunteers count/hours — persisted on `events` for grant reporting.** These are
event-level (not per-session) `NumberInput` fields.

**7. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Field order matches OUT-02 exactly.
- The type-Selector spec tension (Known Context/Traps #1) explicitly investigated and disclosed.
- CMP-02 flags correctly gated to competition-type events only.
- `event_sessions.notes` nullability resolved identically to T031's precedent, no migration shipped.
- BEH-07 confirm button states the computed outcome, never bare "Submit"/"OK".
- Disabled state genuinely non-interactive until title + ≥1 valid dated session.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration
> file → BLOCKER. *(Cited because this task must NOT ship a redundant/conflicting migration for the
> `notes` question T031 already resolved without one.)*

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 13. Templates are used as-is; OUT-02's dialog field order is exact, not a suggestion.

## Most Recent Failure
None. This is attempt 1 for T039 (attempt count: 0).

## Required Worker Output
- Full contents of `OutreachEventDialog.tsx`.
- Explicit write-up of the type-Selector spec-tension resolution and reasoning.
- Explicit confirmation the `notes` field matches T031's precedent, no migration shipped.
- Real test proof of CMP-02 flag visibility gating (competition vs. outreach) and the BEH-07/
  disabled-state behavior.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
