# Worker Packet: T324 — Replace the live calendar's fixture data

## Dispatch

- Process tier: **STANDARD** (constitution item 26)
- Worker: Codex Balanced tier — `gpt-5.6-terra`, high reasoning
- Branch: `codex/t324-calendar-real-data`
- Worktree: `/private/tmp/volt-t324`
- Base: `origin/main` at `e422123`
- No premise-checker round: this is a bounded, read-only data-loading change;
  it changes no write path, schema, migration, RLS, auth, role resolution, or
  cross-workflow export.
- Checker: the primary orchestrator independently inspects the diff and
  replays the named mutations and gates.

## Objective

Make `/calendar` load the active season's real, role-visible `events` and
`event_sessions` from Supabase. Remove fixture data as the production default
while preserving the existing calendar, filters, links, date handling, and
DES-12 states.

## Verified current facts

Re-check these in your worktree before relying on them:

1. `CalendarPage.tsx` defines `FIXTURE_EVENTS` and `FIXTURE_SESSIONS` and
   defaults `CalendarPage.loadSessions` to `defaultLoadCalendarSessions`, which
   returns those fixtures. This is the live-route defect.
2. `CalendarPage` already has an injectable loading seam and complete
   loading/error/empty/populated rendering. Its loader currently takes no
   season id.
3. `SeasonProvider.tsx` is the sole active-season resolution mechanism.
   Consumers use `useActiveSeason()` and branch on loading/none/error/ready;
   do not query `seasons` again inside the new loader.
4. `events.season_id`, `type`, `title`, and `location_name` plus
   `event_sessions.event_id`, `session_date`, `starts_at`, `ends_at`, and
   `status` are the real schema fields in
   `20260717000000_scheduling_attendance.sql`.
5. Existing RLS policies already scope `events` and `event_sessions` by role:
   staff see all; students and parents see own/linked team events. The loader
   must not reproduce permission logic in TypeScript.
6. The established loader pattern is `createLoader` + injectable
   `getSupabaseClient`, with dependent event-then-session queries. See the
   bounded read paths in `loaders/reports.ts`, `loaders/meetings.ts`, and
   `loaders/outreach.ts` as read-only precedents.
7. The baseline targeted suite is 31/31 green at `e422123`:
   `npm run test -- --run src/pages/calendar/CalendarPage.test.tsx`.

## Allowed files

- `src/pages/calendar/CalendarPage.tsx`
- `src/pages/calendar/CalendarPage.test.tsx`
- `src/lib/supabase/loaders/calendar.ts` (new)
- `src/lib/supabase/loaders/calendar.test.ts` (new)

The two new loader files are an explicit T324 extension to W6's older ownership
list. Keeping database access out of the page matches the repository's shipped
loader architecture.

## Forbidden files

- All W1 and W2 files
- `src/pages/calendar/SubscribePopover.tsx` and its test
- `src/lib/supabase/loaders/calendarFeed.ts` and its test
- `supabase/functions/ics/**`
- `supabase/migrations/**`
- `src/app/SeasonProvider.tsx`
- `src/app/router.tsx`
- `.claude/**`, `docs/swarm/**`, `AGENTS.md`
- `package.json`, `package-lock.json`, `node_modules/**`
- Every file not explicitly listed under Allowed files

## Required implementation

### 1. Calendar loader

Create a calendar-specific loader module using the real shared client pattern.

- Export the calendar row/result types and `LoadCalendarSessionsFn` from the
  loader module. Preserve the existing public type surface by importing and,
  where useful, re-exporting those types from `CalendarPage.tsx`.
- Change the loader signature to `(seasonId: string) =>
  Promise<CalendarLoadResult>`.
- Query `events` first, explicitly filtered with
  `.eq('season_id', seasonId)`.
- Select and map only the fields the screen uses:
  `id, season_id, type, title, location_name`.
- If no events are visible, return `{ events: [], sessions: [] }` without an
  empty `.in(...)` query.
- Otherwise query `event_sessions` for the returned event ids, selecting
  `id, event_id, session_date, starts_at, ends_at, status`, ordered by
  `starts_at` ascending.
- Let Supabase RLS define role visibility. Add no client-side role or team
  authorization rules.
- Export both `makeLoadCalendarSessions(getClient)` for tests and the real
  `loadCalendarSessions` default.
- Fail loudly through the repository's normal `createLoader` error semantics;
  never catch-and-return fixture or empty data on a query error.

### 2. Active-season wiring

- `CalendarPage` must resolve the active season through `useActiveSeason()`.
- Handle provider `loading`, `none`, and `error` explicitly using existing
  Astryx components and copy conventions. The error action calls
  `activeSeason.refresh`.
- Only the `ready` state may invoke the calendar data loader, passing
  `activeSeason.season.id`.
- Keep `loadSessions` injectable for tests, but default it to the real loader.
- Do not add a placeholder season id or fallback season.
- Preserve the existing data loading state machine and visible calendar
  behavior after a season is ready.

### 3. Remove production fixtures

- Remove `PLACEHOLDER_SEASON_ID`, `FIXTURE_EVENTS`, `FIXTURE_SESSIONS`, and
  `defaultLoadCalendarSessions` from production code.
- Move deterministic calendar fixture data into `CalendarPage.test.tsx`.
- Update stale production module documentation that says the fixture default
  is deliberate. Do not broadly rewrite unrelated historical documentation.

### 4. Tests

Update `CalendarPage.test.tsx` so its harness provides:

- a deterministic ready active season through `SeasonProvider`;
- a deterministic injected or mocked calendar loader backed by test-only
  events/sessions;
- explicit coverage that the production-default loader seam is invoked with
  the resolved active-season UUID;
- loading, none, error/retry, and ready active-season states;
- all existing calendar/filter/link/date assertions without production
  fixtures.

Add `calendar.test.ts` covering at minimum:

- exact events select and `.eq('season_id', suppliedId)`;
- snake_case-to-camelCase mapping for events and sessions;
- the dependent session query receives only returned event ids and orders by
  `starts_at` ascending;
- zero visible events skips the sessions query and returns two empty arrays;
- an events or sessions query failure rejects rather than returning fixtures.

Tests must distinguish behavior, not merely assert that headings exist.

## Acceptance criteria

1. A production render of `/calendar` cannot obtain any hard-coded event or
   session from `CalendarPage.tsx`.
2. A ready active season loads its real UUID through the real default loader.
3. No active season produces an honest non-fixture state and no data query.
4. A season-resolution error and a calendar-query error remain distinguishable
   and retryable.
5. Supabase query tests prove the season filter and dependent event-id filter.
6. Existing calendar interaction behavior remains green.
7. No forbidden file changes and no dependency changes.

## Required mutation evidence

Commit the candidate implementation before mutating. In this isolated
worktree, apply and then fully restore each mutation:

1. Remove the loader's `.eq('season_id', seasonId)` filter. The loader test
   that pins the season scope must fail.
2. Replace `CalendarPage`'s real default loader with a fake empty loader (or
   otherwise disconnect the production default while leaving the injectable
   seam intact). The production-default/ready-season test must fail.

Capture failing test names and exit codes. After restoring both mutations,
re-run the targeted tests green and confirm the worktree diff matches the
candidate commit.

## Verification commands

Run and report exit codes for:

1. `npm run test -- --run src/lib/supabase/loaders/calendar.test.ts src/pages/calendar/CalendarPage.test.tsx`
2. `npm run typecheck`
3. `npm run format:check`
4. `npm run lint`
5. `npm run test`
6. `npm run build`

The existing noisy React `act(...)` stderr is baseline behavior; do not present
it as a new failure if counts and exit codes remain green.

## Commit and response

- Stage only the four Allowed files, using explicit pathspecs.
- Commit the implementation to `codex/t324-calendar-real-data`.
- Do not push or open a PR; the orchestrator owns those steps.
- Report the commit SHA, files changed, implementation summary, commands with
  exit codes, mutation results, known risks, and any dispute.
- Do not mark T324 complete and do not edit swarm records.
