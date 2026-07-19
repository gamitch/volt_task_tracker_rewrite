# Worker Packet: T088

## Task ID
T088 — Fix `RosterShell.test.tsx` regression caused by T087's correct real-data wiring.
Small, immediate follow-up, ED-1-adjacent (not itself an ED-1 packet — a targeted test
fix for cross-packet fallout).

## Objective
T087 (Passed as far as its own scope goes, pending checker) correctly changed
`InvitesTab.tsx`'s default `loadData` from a fixture stub to a real Supabase query
(`loadInvitesTabData`, from the new `src/lib/supabase/loaders/invites.ts`, T086/T087).
This was explicitly required by T087's own acceptance criteria and is the whole point
of the ED-1 epic. A side effect: `RosterShell.test.tsx` (owned by T085, a different,
already-Passed task) has two tests that render `<RosterShell />` bare (no props into
`InvitesTab`, matching `RosterShell.tsx`'s own correct zero-props-per-tab design) and
assert the OLD fixture text (`briar.holloway.invite@example.com`) appears after
switching to the Invites tab. That assumption is now false — Supabase is unconfigured
in the test environment, so the real loader correctly rejects with
`SupabaseNotConfiguredError` → `SupabaseLoaderError`, and `InvitesTab` correctly shows
its DES-12 error state instead of fixture content. This is expected, foreseen fallout
(see the ED-1 design doc's own note: "Tests that rendered components bare and asserted
fixture content must now inject the fixture function explicitly through the same seam"),
not a bug in either T085 or T087.

**Do not change `RosterShell.tsx` itself** — rendering each tab with zero props is the
correct, already-Passed T085 pattern and must not change. The fix belongs entirely in
the test file.

## Allowed Files
- `src/pages/roster/RosterShell.test.tsx`

## Forbidden Files
- `src/pages/roster/RosterShell.tsx` (the shell's zero-props rendering is correct,
  do not touch it).
- `src/pages/roster/InvitesTab.tsx`, `src/lib/supabase/loaders/invites.ts` — T087's
  work, already correct, read-only.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The exact two failing tests, currently:**
- `<RosterShell /> real tab wiring (T085 acceptance criteria) > renders the real
  InvitesTab when the Invites tab is selected` (around line 221)
- `<RosterShell /> AdminToggles gating (T028, ROS-08) > keeps showing AdminToggles to
  an admin regardless of which tab is active` (around line 248 area)

Both assert `container.textContent` contains `'briar.holloway.invite@example.com'`
after switching to the Invites tab, relying on `InvitesTab`'s OLD fixture-backed
default.

**2. The fix: mock the Supabase-backed loader/mutation at the module boundary, exactly
mirroring the pattern already established this session in
`src/pages/roster/InviteParentDialog.test.tsx`** (read that file's `vi.mock` block
directly before writing yours — line ~63, `vi.mock('../../lib/supabase', async
(importOriginal) => {...})`, mocking only the one function needed and re-exporting
everything else via `importOriginal`). For this file, mock
`'../../lib/supabase/loaders/invites'` specifically (the exact module
`InvitesTab.tsx` imports `loadInvitesTabData`/`revokeInvite` from — verify the import
path yourself: `src/pages/roster/InvitesTab.tsx` line 334). Mock `loadInvitesTabData`
to resolve to a small, deterministic fixture object containing an invite row with the
email `briar.holloway.invite@example.com` (matching what the two tests already assert
— you can reuse the shape of `InvitesTab.tsx`'s own `FIXTURE_INVITES` constant, read
that file to get the exact row shape right, but do not import it — write a small local
fixture literal in the test file, since `FIXTURE_INVITES` itself isn't exported).

**3. Why mock the loader rather than the Supabase client directly.** Mocking at the
`loaders/invites.ts` boundary (one function) is more precise and less brittle than
stubbing a full `SupabaseClient`/`.from().select()...` chain — the loader's own unit
tests (`InvitesTab.test.tsx`'s new describe blocks from T087) already cover that the
loader queries Supabase correctly; this test file's job is only to prove `RosterShell`
wires the real component in (T085's actual acceptance criterion), not to re-prove the
data-fetching mechanics.

**4. Preserve every other assertion in both tests exactly as-is** — only the
data-sourcing mechanism changes (real default → explicitly mocked module), not what's
being proven. If either test also implicitly exercised revoke/other `InvitesTab`
behavior, keep that intact too (read both tests in full before editing).

**5. Do not silently loosen an assertion to make it pass** (e.g. don't change the
assertion to merely "doesn't crash" instead of "shows real invite content") — the
whole point of these two tests (T085's own stated acceptance criteria) is proving
`RosterShell` genuinely renders `InvitesTab`'s real, populated content, not a
placeholder. The mock lets you keep proving exactly that, just without depending on a
live Supabase project.

## Acceptance Criteria
- Both previously-failing tests pass again, still proving the same thing they always
  proved (real `InvitesTab` content renders inside `RosterShell`), now via an explicit
  mock instead of an implicit fixture default.
- No change to `RosterShell.tsx`, `InvitesTab.tsx`, or any `loaders/**` file.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, full repo-wide suite green (961/961, matching T087's
  reported count once these 2 are fixed).

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
This IS the fix for a failure disclosed by T087's own worker output (not a prior
attempt at this exact task) — attempt 1 for T088 (attempt count: 0).

## Required Worker Output
- Full diff of `RosterShell.test.tsx`.
- Confirmation both named tests pass, with their actual test output.
- Full repo-wide test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
