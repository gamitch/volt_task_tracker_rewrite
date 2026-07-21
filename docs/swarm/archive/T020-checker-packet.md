# Checker Packet: T020 (AUTH-04 no-access screen + RLS-denial test) — Check Attempt 1

## Task ID
T020 — AUTH-04 uninvited path + RLS-denial test (NFR-02), Epic E3

## Checker Agent
checker-tests (per task-ledger.md T020 row). Note: this task has an unusual mixed deliverable (a
React page + a SQL/shell test suite) — verify both halves fully; do not let the SQL-heavy half
crowd out the page-side Astryx/DES-12/keyboard checks, or vice versa.

## Attempt
Check attempt 1 of 3. First check on this task. Full task context:
`docs/swarm/active/T020-worker-packet.md`.

## What This Check Covers
Two independent deliverables, checked independently: (1) `src/pages/no-access/**` — Astryx prop
cross-check, DES-12 reasoning for a near-stateless screen, sign-out wiring, no fabricated data,
keyboard/focus (even though the page claims zero focusable elements — verify that claim, don't
assume it), forbidden-file boundary, build/typecheck/lint. (2) `tests/rls/**` — independently
reproduce the RLS-denial results from a fresh scratch Postgres, not trust the worker's captured
output; confirm the methodology genuinely proves what NFR-02/AUTH-04 require.

## Worker's Claimed Changes (do not trust — verify independently)
1. New `src/pages/no-access/{NoAccessPage.tsx,types.ts,index.ts}` and
   `tests/rls/{auth_stub.sql,grants.sql,seed.sql,assertions.sql,run.sh}`. No other files touched.
2. Page built from `Center > VStack[Heading "VOLT", Card > EmptyState]`, matching
   `LoginPage.tsx`/`AcceptInvitePage.tsx`'s established outer shell; claims a CLI cross-check
   (`npm run astryx -- template EmptyStateContainer --skeleton`) confirmed the `Card > EmptyState`
   pairing, and deliberately omits both `Button`s the generic skeleton includes (no action exists
   on this screen; session is already being signed out).
3. Sign-out fires unconditionally on mount via a `useEffect` calling `guards.tsx`'s real
   `logout()`, once — claims this was empirically verified (a temporary harness logged a fake user
   in via the real `AuthProvider` contract, confirmed non-null before mount, null after).
4. Team-contact data seam: `types.ts` defines `NoAccessData { contactName: string }` /
   `LoadNoAccessDataFn = () => Promise<NoAccessData>`, consumed via an optional
   `NoAccessPageProps.loadData` prop defaulting to `defaultLoadNoAccessData` (returns a hardcoded
   generic fallback string, `'your coach or team admin'`, never calls Supabase). Claims this is
   necessary because no table anywhere in the schema has a contact-person column, compounded by a
   "which team?" ambiguity since AUTH-04's caller by definition has no team association.
5. DES-12 reasoning: claims this screen has fewer than the usual four buckets because its one
   permanent render already *is* an empty-state render; Loading is not modeled as a branch (the
   seam only ever swaps the secondary `contactName` detail, never page structure); Error is N/A
   (no user-triggered action exists to fail; the seam degrades silently to the fallback string on
   rejection).
6. Claims zero focusable elements exist on this page (no button/link at all) — confirmed via
   `document.querySelectorAll` over standard focusable selectors returning count 0, and Tab
   leaving focus on `<body>`.
7. Claims a DOM text sweep found zero box-drawing characters.
8. RLS test: scratch Postgres, all 6 real migration files applied in order, then a stub `auth`
   schema/`auth.uid()` implementation, table grants, seed data (an orphan authenticated user with
   no `profiles` row, plus two real students with profiles), and three assertion scenarios (A:
   orphan → zero rows from `students`/`events`/`attendance`; B: a real-profile session sees exactly
   its own `students` row, as a sanity contrast proving A isn't a broken-always-deny policy; C: a
   real-profile student reading `attendance` sees only their own row, never another student's —
   the NFR-02-literal wording case). Claims all 6 sub-assertions PASS.
9. Claims all temporary harness files and scratch Postgres databases were deleted/dropped before
   handoff; build/typecheck/lint/test all exit 0; `tests/rls/**` contains zero JS/TS files so it's
   not swept into `npm run lint`/`npm run test`'s default scope (same reasoning as T014).

## Astryx Ground Truth — Re-verify Every Line Yourself
- **Center** (`astryx-api.md:80-87`). Worker uses `axis="both"`, `height="100vh"`, `width="100%"`.
  Confirmed at lines 80-82 in an earlier pass on this project — re-verify yourself.
- **VStack** (`astryx-api.md:374-396`). Worker uses `gap={6}` (number, not string) and
  `hAlign="center"`. Lines 380/389.
- **Heading** — confirm the worker's specific citation strategy: its own `### Heading` "Props"
  subsection genuinely reads `undefined` (a known doc-gen gap, same as T016/T018 already hit), and
  the worker cites the **Theming** table row instead (`astryx-heading | data-level, data-color |
  level, color`, around line 892) as indirect evidence `level` is a real prop. Confirm that row
  actually exists at/near that line, and render your own verdict: is citing the Theming table (which
  lists `level` as a prop that drives a `data-level` attribute) an acceptable substitute ground
  truth for a component whose own Props table is blank, or does this cross into "insufficiently
  sourced" territory (constitution item 2)? T016/T018 both used `Text`'s best-practices prose
  instead for this identical gap — decide whether the Theming-table approach here is equally solid,
  weaker, or actually stronger evidence, and say why.
- **Card** (`astryx-api.md:2983-2989`, props table). Worker uses `width={400}`, `maxWidth="100%"`,
  `padding={6}`, `variant="default"`. Confirm these land at lines 2983 (width), 2985 (maxWidth),
  2988 (padding), 2989 (variant) respectively.
- **EmptyState** (`astryx-api.md:3991-4001`). Worker uses `title` and `description` only —
  confirm both documented (lines 3995-3996), and confirm `actions` is genuinely omitted from the
  JSX (not merely unmentioned) — cross-check against the worker's own reasoning that no action
  exists to offer on this screen.
- **CLI cross-check re-run.** Independently run `npm run astryx -- template EmptyStateContainer
  --skeleton` (and `npm run astryx -- template --list` to confirm the id/display-name claim) —
  confirm the worker's quoted skeleton output (`Card > [EmptyState, Button variant="secondary",
  Button variant="primary"]`) is real, not fabricated, before accepting the "omitted both Buttons"
  reasoning as template-fidelity-compliant rather than layout invention (constitution item 13).

## Required Verification Steps — Page Half

1. **Read `NoAccessPage.tsx`/`types.ts`/`index.ts` in full** — do not rely on module-doc comments
   or this packet's paraphrasing.

2. **Sign-out wiring — independently reproduce.** Build your own temporary render harness (real
   Chromium via Playwright, not jsdom-only) that logs a fake user into the real `AuthProvider` from
   `guards.tsx`, confirms the user is non-null, then mounts `<NoAccessPage />`, and confirms
   `useAuth().user` becomes null shortly after mount (e.g. via a test-only render prop, a
   `useEffect` in a wrapper component, or reading React DevTools-equivalent state — your call on
   mechanism, but it must be a real assertion against real `AuthProvider` state, not a code-reading
   inference). **Do not trust the worker's own harness output.**

3. **Contact-name seam — confirm no live query, confirm the "which team?" reasoning holds.**
   Re-open `supabase/migrations/20260716000000_identity_roster.sql` yourself and confirm `teams` (and
   spot-check at least the `profiles`/`students` tables from the same migration) genuinely has no
   contact-person/email/phone column anywhere. Confirm `defaultLoadNoAccessData` never imports or
   calls anything Supabase-related (grep the file).

4. **DES-12 reasoning — render your own explicit verdict**, not a rubber stamp. Is "this screen's
   one permanent render already IS the empty state, so there's no distinct Empty/Loading/Error
   bucket to build" a legitimate reading of constitution item 12 for this specific screen (compare
   against T018's/T016's genuinely-async, multi-branch pages — is the contrast principled, i.e. is
   the distinguishing factor really "no real async gate exists here" and not just "this task chose
   not to build one")? Specifically scrutinize the "Error: N/A" claim — the `loadData` seam IS an
   async operation that CAN reject (the worker's own `.catch()` handles a rejection case), so there
   is technically an error path; evaluate whether silently swallowing it (vs. e.g. logging it, or
   showing a barely-visible secondary indicator) is defensible given the stated reasoning (nothing
   actionable to retry) or whether it's cutting a corner that should have at least been surfaced
   more visibly for a future maintainer (a MINOR-level judgment call, not necessarily a fail).

5. **Keyboard/focus claim — independently verify the "zero focusable elements" claim**, don't
   accept it at face value. Render the page in your own harness and independently run the same class
   of check (query all standard focusable selectors, confirm the count), plus manually Tab from a
   fresh page load and confirm focus does not land on anything on this page (it's fine if it lands
   on browser chrome / nothing, but confirm there isn't a stray focusable element the selector-based
   check might have missed, e.g. something with a non-zero `tabIndex` that doesn't match a standard
   selector). Confirm both light and dark mode render correctly (screenshot or equivalent) even
   though there's no interactive/focus state to check visually beyond the static render.

6. **No fabricated data / no box-drawing characters.** Independently sweep rendered DOM text
   (Unicode-aware, not naive grep — T018's checker hit a locale/byte-matching false positive with
   naive grep, learn from that) for box-drawing/bracket-placeholder characters — zero expected.
   Confirm the displayed contact-name string is clearly a generic placeholder, not something that
   could be mistaken for a real name.

7. **D001-method forbidden-file check.** Confirm only the 3 claimed files exist as new under
   `src/pages/no-access/`; `router.tsx` (confirm directly: there is genuinely no `/no-access` route
   or placeholder anywhere in the file — this is a stronger claim than T016/T018's "placeholder
   exists but isn't wired," verify it's literally absent), `guards.tsx`, `AppShell.tsx`, nav
   components, `supabase/**` all byte-unchanged. No leftover scratch files anywhere (worker claims
   `src/harness-no-access-entry.tsx`, `src/harness-no-access-signout-entry.tsx`,
   `harness-no-access.html`, `harness-no-access-signout.html`, `scratch-verify-no-access.mjs` were
   all deleted — verify directly).

8. **Build/typecheck/lint/format:check/test.** Run all five yourself, quote real output, confirm 0
   errors, same pre-existing warnings only.

## Required Verification Steps — RLS Test Half

9. **Independently stand up your own scratch Postgres and re-run the entire suite from scratch** —
   do not trust the worker's captured PASS/FAIL table. Apply all 6 real migration files (read the
   real filenames/order yourself from `supabase/migrations/`, do not copy the worker's list
   uncritically) followed by the worker's `tests/rls/{auth_stub,grants,seed,assertions}.sql` via
   `tests/rls/run.sh`. Confirm all 6 sub-assertions (A ×3, B ×1, C ×2) PASS on your own run.

10. **Scrutinize the `auth_stub.sql` mechanism.** Read it directly and confirm it genuinely makes
    `auth.uid()` resolve to the impersonated UUID for the duration of each `SET LOCAL role
    authenticated; SET LOCAL request.jwt.claim.sub = '<uuid>'` block, in a way that's methodologically
    equivalent to how a real Supabase/PostgREST session would present to RLS policies (cross-check
    against how T012's/T014's own scratch-Postgres auth-stubbing worked, cited in
    `docs/swarm/verification-log.md`'s T012/T014 entries, for consistency — flag any meaningful
    divergence in method).

11. **Run your own negative control**, the same standard multiple prior checkers (T007, T013, T014)
    have been held to: deliberately break something that should make Scenario A fail (e.g.
    temporarily grant the orphan session a fake `profiles` row, or bypass RLS) and confirm the test
    suite correctly reports FAIL, then revert and reconfirm PASS. This validates the test
    methodology itself actually detects a real regression, not just that it happens to print "PASS"
    today.

12. **Render an explicit verdict on Scenario C's relationship to Scenario A.** The worker
    distinguishes these as testing different things (profile-less orphan vs. real-profile
    cross-student read) and claims both are now covered per NFR-02's literal wording plus this
    task's own ledger-row wording (profile-less primary requirement). Confirm this distinction is
    accurate and that Scenario C isn't redundant with (or a weaker restatement of) something T012's
    own already-Passed test matrix already proved — if it's genuinely new coverage, say so; if it's
    largely duplicative of T012's existing student1/parent1 tests, note that as a minor observation
    (not a defect).

13. **Confirm the suite adds no JS/TS files** (per Acceptance Criterion 8) and therefore doesn't
    need any root-config (`vite.config.ts`/`eslint.config.js`) exclusion, unlike `supabase/
    functions/**`'s Deno-file exclusion precedent — verify by listing `tests/rls/`'s actual file
    extensions yourself.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR. The CLI is a cross-check, not a source.

> 4. RLS is default-deny; any table without policies → BLOCKER; a policy subquerying its own table
> → BLOCKER. (This task independently proves the existing, already-Passed T012 policies work as
> intended — it does not change them.)

> 12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12).
> Happy-path-only → MAJOR.

> 13. Wireframes are structural intent... Routes/templates get the named Astryx template; inventing
> custom layout there → MAJOR. No box-drawing/bracket placeholder characters may render in the DOM.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

> **D001 standing rule:** never use git history as evidence of file authorship. Compare Allowed
> Files against the current file tree directly.

## PRD Ground Truth (verbatim)
> **AUTH-04** A Google sign-in with an email that has **no** pending invite or existing profile
> lands on a "You're not on the roster yet" screen (name of team contact, no data access) and the
> session is signed out. RLS independently guarantees zero data visibility for profile-less users.

> **NFR-02** Playwright smoke tests for the four persona flows... plus login and RLS-denial
> (student fetching another student's attendance gets zero rows).

## Most Recent Failure
None — this is check attempt 1 for T020.

## Required Checker Output
- Files inspected (quote actual current contents relied on) for both deliverables.
- Exact commands run + real quoted output: build/typecheck/lint/format:check/test, your own
  Playwright harness session for sign-out + keyboard/focus verification, your own from-scratch
  scratch-Postgres RLS-test run (full output table), your own negative-control run (both the
  induced-failure output and the reverted-and-reconfirmed-PASS output), your own CLI re-run of the
  `EmptyStateContainer` template skeleton.
- Pass/fail per each of the 13 "Required Verification Steps" above.
- Explicit prop-by-prop cross-check table against `astryx-api.md`'s current line numbers, plus an
  explicit verdict on the Heading Theming-table citation strategy.
- Explicit verdict on the DES-12 reasoning, especially the "Error: N/A" silent-swallow judgment
  call.
- Explicit verdict on Scenario C's relationship to T012's existing test coverage.
- Confirmation your own temporary render harness and scratch Postgres data were deleted/dropped,
  with proof.
- Overall pass/fail result for T020 as a whole.
- Exact failure reason(s), if any, with severity classification.
- Recommended next action (pass; rework; new follow-up task; or dispute to boss-arbiter).

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Do not flip `task-ledger.md` yourself — report your verdict
back; the orchestrating session updates the ledger. T020 stays "In Progress" until your verdict is
returned.

---
**ARCHIVED** 2026-07-19 — closed out as part of T020 PASS close-out.
