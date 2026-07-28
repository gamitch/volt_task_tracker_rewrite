# Worker Packet: T092

## Task ID
T092 — Fix `RosterShell.test.tsx` regression from T089's real Students-tab data wiring.
Small immediate follow-up, exact same class as T088.

## Objective
T089 (its own scope correct and complete, pending its own checker) changed
`StudentsTab.tsx`'s default `loadData` from a fixture stub to a real Supabase query
(`loadStudentsTabData`, from `src/lib/supabase/loaders/students.ts`). One test in
`RosterShell.test.tsx` (owned by the already-Passed T085, later touched by T088 for the
identical Invites-tab issue) asserts the OLD fixture text (`'Amara Voss'`) appears after
switching to the Students tab. That assumption is now false — Supabase is unconfigured
in the test environment, so the real loader correctly rejects and `StudentsTab` shows
its error state instead of fixture content. This is the exact same situation T088 already
solved for `InvitesTab`/`briar.holloway.invite@example.com` — read
`docs/swarm/archive/T088-worker-packet.md` and the current `RosterShell.test.tsx`
(it already contains T088's `vi.mock('../../lib/supabase/loaders/invites', ...)` block,
lines ~61-66) as your direct template. Do the same thing, one module over.

**Do not change `RosterShell.tsx` itself** — zero-props-per-tab rendering is correct and
must not change.

## Allowed Files
- `src/pages/roster/RosterShell.test.tsx`

## Forbidden Files
- `src/pages/roster/RosterShell.tsx`, `StudentsTab.tsx`, `src/lib/supabase/loaders/students.ts`
  — all correct, read-only.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The failing test:** `<RosterShell /> real tab wiring (T085 acceptance criteria) >
renders the real StudentsTab (fixture data) on the initially-active Students tab`
(around line 238), asserting `container.textContent` contains `'Amara Voss'`.

**2. The fix — add a second `vi.mock` block, sibling to T088's existing one.** Mock
`'../../lib/supabase/loaders/students'`, specifically `loadStudentsTabData` (re-export
`setStudentActive`/`createStudent`/`updateStudent` and everything else via
`importOriginal`, exactly matching the existing invites mock's structure). Add a small
local fixture object containing a student row with `displayName: 'Amara Voss'` (check
`StudentsTab.tsx`'s own local `StudentDisplayRow`/loader result shape — `{ students,
teams, invites }` — to get the exact structure right; you'll need at least one
`TeamRow` for the student's `teamId` to resolve to a real team name, since
`buildDisplayRows` maps `teamId` through the teams list).

**3. Students tab is now the INITIALLY-ACTIVE tab** (per the test name itself — Students
is `ROSTER_TABS[0]`), unlike Invites which required switching tabs first. Check whether
this changes anything about when/how the mock needs to resolve (e.g., does the test
already `await` for content the same way the Invites one does, or does it check
immediately on initial render — read the actual test body, don't assume it mirrors T088's
test shape exactly).

**4. Wire the mock into the shared `beforeEach`** (same file already has one, extended
by T088) so any other test in the file that happens to render/visit the Students tab
also gets deterministic data rather than hitting an unmocked `vi.fn()` — same reasoning
T088 used and documented.

**5. Preserve the exact assertion** (`toContain('Amara Voss')`) — don't loosen it.

## Acceptance Criteria
- The previously-failing test passes again, still proving the same thing (real
  `StudentsTab` content renders inside `RosterShell`), now via an explicit mock.
- No change to `RosterShell.tsx`, `StudentsTab.tsx`, or `loaders/students.ts`.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, full repo-wide suite green (1010/1010, matching T089's
  reported count once this one is fixed).

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
This IS the fix for a failure disclosed by T089's own worker output — attempt 1 for
T092 (attempt count: 0).

## Required Worker Output
- Full diff of `RosterShell.test.tsx`.
- Confirmation the named test passes, with actual output.
- Full repo-wide test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
