# Checker Packet: T021 (`/roster` shell + TabList) — Check Attempt 1

## Task ID
T021 — `/roster` shell + TabList (ROS-01), Epic E4

## Checker Agent
checker-accessibility (per task-ledger.md T021 row).

## Attempt
Check attempt 1 of 3. First check on this task — the first real content-page task in the entire
ledger. Full task context: `docs/swarm/active/T021-worker-packet.md`.

## What This Check Covers
Role-guard mechanism correctness (a novel pattern — `RequireRole` nested inside a page component
rather than at the route level, since `router.tsx` is forbidden), `TabList`/`Tab` Astryx prop
cross-check (including two claimed CLI-cross-checked doc gaps), keyboard navigation of the tab
strip in both modes, DES-12 reasoning for a dataless shell, no fabricated roster data, forbidden-
file boundary, and standard build/typecheck/lint/format:check.

## Worker's Claimed Changes (do not trust — verify independently)
1. New `src/pages/roster/RosterShell.tsx` only. No other files touched.
2. `RosterShell` wraps its entire return in `<RequireRole allowedRoles={['coach', 'admin']}>`
   (imported read-only from `../../app/guards`) — nested inside the component's own render tree,
   not at the `<Route>` level (since `router.tsx`'s current `/roster` route only wraps in
   `RequireAuth`, no role restriction, and is forbidden to edit here). Claims this produces
   byte-identical guard behavior to `router.tsx`'s own `/kiosk/:sessionId`/`/settings` routes,
   which use the same `RequireRole` component at the route level instead.
3. `TabList`/`Tab` render four tabs in the literal PRD order Students | Parents | Teams | Invites,
   `orientation` left at documented default (`'horizontal'`).
4. Each tab panel renders an `EmptyState` naming this task (T021/ROS-01) and pointing at
   "a later roster task (T022-T028)" for real content — no fabricated roster rows.
5. Claims a live Playwright-based role-guard test: `student`/`parent` roles → TabList never
   renders, exact `ACCESS_DENIED_TOAST_MESSAGE` fires; no-user case → same toast fires (captured
   via a module-scope `subscribeToast` listener registered before render, to catch a synchronous
   first-render toast a DOM-readout-based check reportedly missed); `coach`/`admin` → all four
   tabs render.
6. Claims a live keyboard walkthrough: Tab focuses the tab strip as one stop (roving tabindex),
   ArrowRight moves focus tab-by-tab, Enter activates and changes the panel; visible focus
   confirmed via `getComputedStyle` and screenshots in both modes.
7. Claims a DOM text sweep found zero box-drawing characters and no fabricated roster data.
8. Claims two Astryx doc gaps (`Tab`, `Heading` — both `astryx-api.md`'s own "Components" entries
   read literally `undefined`) resolved via `npm run astryx -- component Tab` /
   `... component Heading` CLI cross-checks, verbatim-quoted in the file's module doc.
9. Claims build/typecheck/lint/format:check all exit 0; temporary Playwright harness files
   (`src/harness-roster-entry.tsx`, `harness-roster.html`, a scratch driver script) all deleted
   before handoff.

## Astryx Ground Truth — Re-verify Every Line Yourself
- **TabList** (`astryx-api.md:2044-2055`, props table). Confirm `value` (2048, required),
  `onChange` (2049, required), `children` (2054, required) are documented as claimed. Confirm
  `orientation` (2053) defaults to `'horizontal'` and that leaving it unset is a legitimate
  "use the default" choice, not an omission — read the doc's own guidance on when
  vertical/horizontal applies and judge whether a single page-level row of 4 tabs is correctly
  horizontal (it should be — this is the doc's own primary/default use case).
- **Tab** — confirm the doc's own "### Tab" subsection (around lines 2059-2062) is genuinely
  `undefined` (a real doc-generation gap, not the worker glossing over an existing table). Then
  **re-run `npm run astryx -- component Tab` yourself** and confirm the worker's verbatim-quoted
  `value`/`label` rows are real CLI output, not fabricated — this is the sole ground truth for
  this component absent a props table. Confirm only `value` and `label` are used in the file (no
  hallucinated additional prop).
- **Heading** — same doc-gap situation (confirm `### Heading`, lines ~882-884, reads `undefined`).
  **Re-run `npm run astryx -- component Heading` yourself** and confirm the `level`/`children`
  rows are real. Confirm `level={1}` is the page's only heading (no skipped levels — trivially
  true with one heading, but confirm no other `Heading`/raw HTML heading tag exists anywhere else
  in the file).
- **EmptyState** (`astryx-api.md:3991-4001`, props table). Confirm `title` (3995, required) and
  `description` (3996) are documented. Confirm the doc's own "Don't: use a generic message like
  'No data'" guidance (line 3987/3988 area) is satisfied — read the actual four `emptyTitle`/
  `emptyDescription` strings in the file and judge whether they're specific enough (they claim to
  name the section and point at a future task range) or too generic/internal-jargon-y for an
  end-user-facing empty state (a real question worth an explicit verdict, not a formality — is
  "T021, ROS-01" / "T022-T028" appropriate end-user copy, or should it be reworded before this
  ships to a real user, even though no real user reaches this page yet given the router gap?).
- **VStack** (`astryx-api.md:374-396`). Confirm `gap`/`padding` (lines 380-381) are documented and
  passed as JSX numbers (not strings). Confirm the worker's claim about `AppShell`'s
  `contentPadding` defaulting to `0` (astryx-api.md line ~2594) — re-open that line yourself
  rather than trusting the citation, since `AppShell.tsx` is a forbidden file here and the worker's
  reasoning for supplying its own padding depends on that claim being accurate.

## Required Verification Steps

1. **Read `RosterShell.tsx` in full** — do not rely on the worker's module-doc comments or this
   packet's paraphrasing.

2. **Role-guard mechanism — the core question of this check.** Confirm by direct code reading that
   `RequireRole` (re-open `guards.tsx` yourself) genuinely produces the claimed behavior when
   nested inside a page component's render tree rather than at the `<Route>` level: it calls
   `useAuth()` internally (no dependency on route context), and its redirect/toast logic is purely
   a function of `user`/`allowedRoles` — confirm there is nothing in `RequireRole`'s implementation
   that assumes it's being rendered by React Router's route-matching machinery specifically (e.g.
   no reliance on route params, no assumption about being the top-level element of a `<Route>`).
   Then **independently reproduce the worker's claimed test** via your own temporary Playwright
   harness (real Chromium, not jsdom-only) mounting `<RosterShell />` under `MemoryRouter` +
   `AuthProvider` + `LayerProvider` + `Theme`, and drive at minimum: (a) `student` role → confirm
   zero `TabList`/tab content renders and the exact toast string fires; (b) `parent` role → same;
   (c) `coach` role → all four tabs render; (d) `admin` role → all four tabs render; (e) no user at
   all → confirm the toast still fires and nothing renders (the worker flagged a timing subtlety
   here involving StrictMode double-invoke and a module-scope listener registered before first
   render — independently confirm this case yourself since it's the trickiest one, don't just
   accept the worker's account of why their first check attempt missed it).

3. **Astryx prop cross-check + CLI re-verification.** Per the ground-truth section above — re-run
   both `npm run astryx -- component Tab` and `npm run astryx -- component Heading` yourself and
   confirm the worker's verbatim quotes match your own output exactly.

4. **Keyboard walkthrough + visible focus, independently, both modes.** Using real `KeyboardEvent`
   dispatch (or equivalent Playwright real keyboard interaction) against your own harness: Tab
   reaches the tab strip, ArrowRight/ArrowLeft move focus between tabs (confirm both directions,
   not just the one the worker described), Enter (or Space, per whatever the Astryx `Tab`
   component's real activation key is — check, don't assume) activates a focused tab and the
   `EmptyState` content below updates to match. Visible focus indicator on the focused tab in both
   light and dark mode. BLOCKER if any keyboard path is broken or focus isn't visible (constitution
   item 15).

5. **DES-12 reasoning verdict.** The worker argues that with zero data-fetching in this component,
   only the "empty" state is reachable and inventing loading/error/populated branches would be
   fabricated content. Render your own explicit verdict on whether this reasoning is sound for a
   shell task, or whether constitution item 12 ("every async screen ships all four states...
   happy-path-only → MAJOR") should be read more strictly here regardless of the "shell task, no
   data yet" framing. (For context: T016/T018 — both genuinely async/data-bearing pages — did
   implement all four states; this task is claiming an exemption specifically because it has no
   data source at all yet, not because it skipped implementing states it could have had.)

6. **No fabricated data / no box-drawing characters.** Independently sweep the rendered DOM text
   (not just the source file) for any string that could be mistaken for real roster data (a name,
   an email, a row of numbers) — must be zero; only the four tab labels, the page heading, and the
   disclosed placeholder `EmptyState` copy should appear. Separately confirm zero box-drawing/
   bracket-placeholder characters (constitution item 13) — use a Unicode-aware method, not a naive
   grep (T018's checker hit a locale/byte-matching false positive with naive grep — learn from
   that).

7. **D001-method forbidden-file check (file-tree comparison, never git history).** Confirm only
   `src/pages/roster/RosterShell.tsx` exists as new; `router.tsx`, `guards.tsx`,
   `src/components/nav/**`, `src/app/AppShell.tsx`, `supabase/**` all byte-unchanged. No leftover
   scratch files anywhere (worker claims `src/harness-roster-entry.tsx`, `harness-roster.html`,
   and a scratch driver script were deleted — verify directly via `find`/`git status`).

8. **Build/typecheck/lint/format:check.** Run all four yourself, quote real unparaphrased output —
   confirm 0 errors, same 8 pre-existing warnings, no new ones.

## Known Reachability Gap (context, not a T021 defect)
`/roster` is not reachable via `npm run dev` navigation with this real component: `router.tsx`'s
route still renders its own inline `RosterPage()` placeholder, and (separately) that route isn't
even role-restricted the way ROS-01 requires — both are `router.tsx`-side gaps, and `router.tsx`
was correctly forbidden here. Do not fail T021 for this. Note for your own read (not blocking):
this is the same recurring wiring gap already logged for T016/T018 — no new dispute needed, just
confirm the worker correctly referenced the existing tracked risk rather than re-litigating it.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR. The CLI is a cross-check, not a source.

> 12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12).
> Happy-path-only → MAJOR.

> 13. Wireframes are structural intent... No box-drawing/bracket placeholder characters may render
> in the DOM.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

> **D001 standing rule:** never use git history as evidence of file authorship. Compare Allowed
> Files against the current file tree directly.

## PRD Ground Truth (verbatim)
> **ROS-01** `/roster` with `TabList`: **Students | Parents | Teams | Invites**.

> Route table (Section 7): `/roster | coach/admin | Grouped Table | Table, PowerSearch, TabList |
> ROS-01…09`

> **NAV-06** Route guards: unauthenticated → `/login`; authenticated but role lacks route →
> redirect to `/` with `Toast` "You don't have access to that page."

## Most Recent Failure
None — this is check attempt 1 for T021.

## Required Checker Output
- Files inspected (quote actual current contents relied on).
- Exact commands run + real quoted output (build/typecheck/lint/format:check, both `astryx --
  component` CLI re-runs, your own Playwright harness session for the role-guard matrix and
  keyboard walkthrough).
- Your own screenshots/equivalent evidence for all four tabs, the role-guard redirect, and
  keyboard focus, in both light and dark mode.
- Pass/fail per each of the 8 "Required Verification Steps" above.
- Explicit prop-by-prop cross-check table against `astryx-api.md`'s current line numbers, plus
  your own re-run confirmation of the two CLI-sourced (`Tab`/`Heading`) doc gaps.
- Explicit verdict on the DES-12 "shell task, no data, only empty state reachable" reasoning.
- Explicit verdict on whether the `EmptyState` copy naming task IDs (T021/T022-T028) is acceptable
  end-user-facing copy or should be reworded.
- Confirmation your own temporary render harness was declared and deleted, with proof.
- Overall pass/fail result for T021 as a whole.
- Exact failure reason(s), if any, with severity classification.
- Recommended next action (pass; rework; new follow-up task; or dispute to boss-arbiter).

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Do not flip `task-ledger.md` yourself — report your verdict
back; the orchestrating session updates the ledger. T021 stays "In Progress" until your verdict is
returned.
