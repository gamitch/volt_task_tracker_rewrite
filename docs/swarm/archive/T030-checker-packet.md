# Checker Packet: T030 (`/meetings` list) — Check Attempt 1

## Task ID
T030 — `/meetings` list (MTG-01), Epic E5.

## Checker Agent
checker-accessibility (per task-ledger.md T030 row).

## Objective
Verify a two-role-variant meetings list page (coach: Upcoming/Past with actions; student/parent:
own history + participation %) with all four DES-12 states, correct BEH-08 date rendering, and
zero NAV-07 cross-contamination with outreach content.

## Allowed Files (worker's literal permitted edit)
- `src/pages/meetings/MeetingsList.tsx` (new)

**Scope flag**: worker also created `src/pages/meetings/MeetingsList.test.tsx`, outside the literal
Allowed Files line, self-disclosed as the same class of addition T035's `CheckinResult.test.tsx`
made (co-located test file, required to produce the packet's own demanded DOM-text proof). Judge
explicitly whether this is in-scope or a forbidden-file violation — precedent from T035's checker
(ruled in-scope) is directly applicable but re-derive the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`8706839`) — do NOT
infer authorship from commit messages. Confirm `src/pages/meetings/Kiosk.tsx` (a separate, already-
Passed task's file) is byte-unchanged. Confirm `router.tsx`, `guards.tsx`, `src/lib/supabase/**`,
`src/components/nav/SideNav.tsx` are all untouched.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Coach view**: `Section`-shaped (actually built via `Heading`+`List`/`ListItem`, worker claims
   `Section` itself wasn't structurally needed) Upcoming/Past groupings, each row with weekday+date,
   computed time range+duration, team scope, a real `event_sessions.status`-vocabulary `Badge`
   (`scheduled`/`completed`/`canceled`), past-row attendance tally text. Page-level "Schedule
   meetings" button (stub — shows disclosure Banner) and per-row `MoreMenu` with Edit (stub) and
   Cancel (**claims fully real**: opens `AlertDialog`, DES-11, confirm sets row status to
   `canceled`).
2. **Student/parent view**: own Upcoming/Past history (own `AttendanceStatus` badge per session, or
   "Not yet held" for future sessions) plus a `ProgressBar` participation %, sourced from a
   `StudentParticipationMetric` fixture claimed to be a verbatim camelCase rename of
   `v_student_participation`'s 7 real columns — never computed by the component (claims zero
   `100.0 *`/`/ greatest(`/division anywhere in the file). A labeled placeholder stands in for
   BEH-06's "consistency strip" (disclosed as T037's job, no `StatusDot` usage).
3. Both variants exercise all four DES-12 states via an injectable `loadCoachData`/`loadStudentData`
   seam defaulting to fixture data.
4. **NAV-07 claim**: test suite explicitly asserts an outreach-shaped fixture item
   (`"Community Food Drive"`) never appears in either role variant's rendered output.
5. Claims 21/21 new tests pass (83/83 total repo-wide), typecheck/build/lint(scoped)/format(scoped)
   all exit 0. Notes two **pre-existing, unrelated** whole-repo failures it did not cause: 3
   `no-undef` errors in an untracked `scripts/migrate/uuid.ts` (a different, concurrently-running
   worker's file — T062), and 2 pre-existing format warnings in files it didn't touch.
6. Claims it added a jsdom `HTMLDialogElement.showModal()` polyfill scoped to its own test file
   only (not the shared `src/test-setup.ts`), since this is the first `AlertDialog`/native
   `<dialog>` usage in the codebase and jsdom 29.x doesn't implement `showModal()`.
7. Flags four known gaps: stale `guards.tsx` `Role` union (relies on `admin`/`coach` literal
   overlap, not a fixed vocabulary), a `PLACEHOLDER_CURRENT_STUDENT_ID` stand-in (no real
   student/parent linkage exists yet), the jsdom `showModal` polyfill placement question, and the
   pre-existing router-wiring gap (route still renders `router.tsx`'s inline placeholder).

## Required Verification Steps
1. **Read `MeetingsList.tsx` and `MeetingsList.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **NAV-07 — re-verify yourself, don't trust the test assertion alone.** Grep the file directly
   for any outreach-shaped field/type/import. Independently confirm the fixture data genuinely
   contains zero outreach-type content, not just that one specific string is absent.
3. **BEH-08 — confirm every date/duration rendered carries a weekday name and a computed
   duration**, by direct source read, for both role variants and both Upcoming/Past sections. Spot
   an actual rendered date string in the test assertions or component logic and verify it's not a
   bare ISO string.
4. **Participation-% sourcing (constitution item 3) — re-derive against the real view.** Open
   `supabase/migrations/20260717000003_metric_views.sql` yourself and confirm the fixture's
   `StudentParticipationMetric` type is a faithful column rename with no computed field. Grep the
   file yourself for any arithmetic operator on a percentage/count value in executable code.
5. **DES-12 four states — confirm all four are genuinely distinct and reachable** for BOTH role
   variants (not just built once and assumed to cover both) — read the loader-seam wiring and the
   test file's coverage of each state × each variant.
6. **Cancel/`AlertDialog` flow — the one "fully real" (not stubbed) interactive feature.** Confirm
   by source read that it's a genuine `AlertDialog` usage (open/confirm/cancel), not a fake modal,
   and that the confirm action actually updates the row's displayed status. Reproduce the worker's
   test for this flow yourself or verify it via your own equivalent.
7. **Test-file scope question** — render an explicit verdict (see Scope flag above), informed by
   but not just copying the T035 precedent.
8. **jsdom `showModal` polyfill** — read where exactly it's scoped (test file only, not shared
   setup) and judge whether that's appropriate or whether it risks silently masking a real runtime
   gap (i.e., would `AlertDialog` actually work in a real browser without this polyfill? — it
   should, since `showModal()` is a real browser API; the polyfill is purely a jsdom test-environment
   limitation, not a production code path — confirm this understanding is correct).
9. **Stub disclosures — confirm "Schedule meetings" and Edit are genuinely inert** (no real
   dialog/navigation, just a disclosure Banner) and not silently faking functionality.
10. **Astryx prop citations** — spot-check `List`/`ListItem`, `Badge`, `MoreMenu`, `AlertDialog`,
    `ProgressBar`, `EmptyState` against `astryx-api.md` (grep, don't read the whole file).
11. **Re-run typecheck/build/lint(scoped to this file)/format(scoped)/test yourself** — don't accept
    "exit 0" without your own run. Confirm the two disclosed whole-repo failures (uuid.ts lint
    errors, 2 unrelated format warnings) are genuinely pre-existing/unrelated, not caused by this
    task — check they're outside this task's Allowed Files and untouched by this commit.
12. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 3: no re-deriving RLS/metric SQL formulas in TypeScript — the participation percentage must
  be a passthrough of the fixture's view-shaped data, never computed.
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 12 (DES-12): all four async states required, happy-path-only is a MAJOR.
- Item 13: no box-drawing/bracket-character fake structure.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the test-file scope question
- explicit verdict on the jsdom `showModal` polyfill placement
- explicit verdict on whether the two disclosed whole-repo failures are genuinely unrelated
- required rework if failed
- follow-up tasks if passed with minor issues
