# Worker Packet: T028

## Task ID
T028

## Objective
Build `src/pages/roster/AdminToggles.tsx` — admin-only toggles rendered on `/roster`: leaderboard
privacy toggle ("Show first name + last initial publicly", default ON) and a season default-goal
shortcut link (to `/settings/season`, T029's page).

## Dependencies (status)
- T021 (`/roster` shell) — Passed. Read `RosterShell.tsx` (read-only) for the placeholder slot.

## Allowed Files
- `src/pages/roster/AdminToggles.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `AdminToggles.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/roster/RosterShell.tsx` — already-Passed sibling task's file, read-only reference only.
- `src/pages/settings/SeasonSettings.tsx` — a separate, currently-being-drafted-in-parallel task
  (T029). The shortcut link should be a real `Link`/navigation to its real future route path (cite
  `routePaths` from `router.tsx`, read-only import), not a stub — but you are not building
  `SeasonSettings.tsx`'s content here.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**`, `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## THE CENTRAL TRAP — a real, genuine schema gap, investigate before writing any persistence logic
**Grep every migration file yourself**: there is no `privacy`/`show_full_name`/leaderboard-privacy-
shaped column anywhere in the current schema (`teams`, `seasons`, `profiles`, or any other table).
ROS-08 describes this as a real, persisted, season-or-team-or-global-scoped setting that T044's
leaderboard (a separate, not-yet-built task) is supposed to read — but there is currently no column
to store it in. This task's Allowed Files are UI-only (`AdminToggles.tsx`); you are **not**
authorized to write a migration to add a persistence column (that would be out of scope for this
task and could collide with T029 or a future dedicated settings task). Your job:
1. Confirm this gap yourself (grep the migrations, don't take this packet's word for it).
2. Build the real, working toggle UI against an injectable `loadPrivacySetting`/`onTogglePrivacy`-
   style seam, defaulting to `true` (ON) per ROS-08's stated default — same fixture/callback posture
   every prior content page in this batch has used for "no shared client yet," except here the gap
   is one level deeper (no *column* exists yet, not just no *client*).
3. **Flag this explicitly as a dispute candidate / follow-up need**: a future small migration task
   is needed to actually add a persistence column (most likely on `seasons`, since privacy plausibly
   varies per season, or `teams` if it's meant to be scoped per team — state your best guess and
   reasoning, but do not decide unilaterally which table it belongs on). This is the same class of
   finding T009's MINOR follow-ups (avatar_url, notes nullability) already established a precedent
   for in this project.

## Known Context / Traps

**1. SEC-04 default-on privacy** — the toggle must genuinely default to ON (private/initials-only
leaderboard display) in your fixture's initial state, not default OFF. This is a real,
checker-scrutinized acceptance criterion (SEC-04: "no last names in kiosk/leaderboard surfaces by
default").

**2. Admin-only, not coach-or-admin.** Re-read ROS-08's own phrasing: "rendered on Roster for admin
only." This is stricter than the coach/admin gate `RosterShell.tsx`/`StudentsTab.tsx` use for the
rest of the tab — gate this specific component on `role === 'admin'` alone (use `useAuth()` from
`guards.tsx`, read-only import).

**3. Season default-goal shortcut** — a real `Link`/`Button` navigating to `routePaths.settings +
'/season'` or whatever the real cited route path constant is (check `router.tsx`, read-only, for
the actual path string/constant name — do not guess or hardcode a raw string if a named constant
already exists).

## Acceptance Criteria
- Leaderboard privacy toggle defaults to ON (SEC-04), genuinely persists within the fixture/
  injectable-seam model, and the schema gap (no real column exists) is explicitly disclosed as a
  dispute candidate.
- Season default-goal shortcut link navigates to the real, cited settings/season route path.
- Component is gated admin-only (not coach-or-admin).
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 10. Database changes are additive migrations via the Supabase CLI. *(Cited because this task must
> NOT attempt its own migration to "solve" the missing persistence column — that decision belongs to
> a properly-scoped future task.)*

## Most Recent Failure
None. This is attempt 1 for T028 (attempt count: 0).

## Required Worker Output
- Full contents of `AdminToggles.tsx`.
- Explicit confirmation of the schema-gap investigation (grep output) and the dispute-candidate
  write-up with your best-guess reasoning on where the persistence column should eventually live.
- Real test proof of the default-ON state and the admin-only gate.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
