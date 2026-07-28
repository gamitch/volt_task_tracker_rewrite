# Worker Packet: T068

## Task ID
T068 — Responsive sweep 375–1440px (NFR-06), Epic E11.

**Status note**: real ledger dependency is `T053–T060` — as of this packet being written, T060 is
still In Progress. Do NOT dispatch against this packet until the full range shows Passed. Pre-built
now per the swarm's "write ahead, dispatch when unblocked" practice.

## Objective
Verify every screen's layout across the 375px→1440px viewport range, with specific attention to
the live check-in console being genuinely usable on a phone-width viewport (panes stack, QR
collapses behind a button). Audit task — produces no new page code.

## Allowed Files
None. This task's deliverable is its own structured audit report (see Required Worker Output),
returned in your response — not a file. If you find a real defect, do NOT fix it yourself; name it
precisely (file, line, screen, breakpoint) as a candidate follow-up task instead.

## Forbidden Files
Every file in the repository is read-only reference for this task — you are auditing, not editing.

## Known Context / Traps

**1. Same reachability constraint as T067 (a sibling audit task) — most screens have no live
route yet.** Render each page component directly (reuse the `createRoot`/`act` harness pattern
already established in each page's own `*.test.tsx` file) inside a viewport-constrained container
at each of the four checkpoint widths (375/768/1024/1440px), rather than trying to navigate a real
browser through `router.tsx`. State this methodology explicitly.

**2. "No horizontal scroll/clipping at any breakpoint in the range" — the literal acceptance bar.**
Check computed layout (`scrollWidth` vs `clientWidth` on the root container, or equivalent) at each
of the four checkpoints, not just a visual glance — a subtle 1-2px overflow is a real finding a
screenshot alone might not catch, but a computed-width check will.

**3. `LiveConsole.tsx` (T033) — the one screen with an EXPLICIT, PRD-named phone-specific
requirement.** NFR-06's own literal text: "coach console usable on a phone, panes stack, QR
collapses behind a button." Read `LiveConsole.tsx` (read-only) directly and confirm: (a) whatever
multi-pane layout it has genuinely stacks (not just shrinks/clips) below some real breakpoint, and
(b) there is a genuine, real interactive "show QR" toggle button at phone width, not just a QR that
happens to be present but visually broken. This is the single most important, most specifically-
named check in this entire audit — treat it as the primary finding, not one row among many.

**4. Dense-table screens deserve specific scrutiny at 375px** — `HoursTab.tsx`, `EventsTab.tsx`,
`ParticipationTab.tsx` (real `Table` components with many columns) are the screens most likely to
genuinely overflow or become unusable at phone width; check whether they have any real
responsive/horizontal-scroll-container strategy or whether they're simply unusable below tablet
width (a real, disclosable finding either way — not every screen necessarily NEEDS full phone
usability if it's realistically coach/admin-only and used at a desk, but state your reasoning
rather than silently passing or failing it).

**5. Dialog/modal screens at narrow widths** — confirm dialogs (Schedule meetings, Season settings,
Mark day complete, End meeting, etc.) don't overflow their own viewport at 375px, and that their
internal `FormLayout`/field grids collapse to single-column appropriately.

## Acceptance Criteria (of the audit itself)
- Full per-screen checklist covering all four checkpoint widths (375/768/1024/1440px), with a
  computed-overflow check at each, not just visual inspection.
- `LiveConsole.tsx`'s phone-specific requirement (pane-stacking + QR-behind-a-button) given an
  explicit, evidenced pass/fail verdict — the primary finding of this audit.
- Dense-table screens' phone-width behavior explicitly characterized and reasoned about (genuinely
  usable vs. defensibly desk-only-in-practice vs. genuinely broken).
- Any real overflow/clipping finding named with exact reproduction steps (screen, breakpoint,
  computed values).

## Relevant Constitution Excerpts
> NFR-06: Responsive 375px → 1440px; coach console usable on a phone (panes stack, QR collapses
> behind a button). *(This task's own literal, PRD-cited acceptance bar.)*

## Most Recent Failure
None. This is attempt 1 for T068 (attempt count: 0) — not yet dispatched.

## Required Worker Output
- Full per-screen × per-breakpoint audit table, with computed-overflow evidence (not just
  screenshots) at each cell.
- Explicit, evidenced verdict on `LiveConsole.tsx`'s pane-stacking and QR-collapse-behind-a-button
  behavior at phone width.
- Explicit reasoning on dense-table screens' phone-width usability.
- Your rendering methodology (Trap #1) stated explicitly.
- Any findings, each with severity and a candidate follow-up task description.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
