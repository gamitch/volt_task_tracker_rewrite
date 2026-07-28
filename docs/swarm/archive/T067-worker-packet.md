# Worker Packet: T067

## Task ID
T067 — Accessibility sweep, all screens, both modes (NFR-07/DES-17), Epic E11.

**Status note**: real ledger dependency is `T053–T060` — as of this packet being written, T060 is
still In Progress. Do NOT dispatch against this packet until the full range shows Passed. Pre-built
now per the swarm's "write ahead, dispatch when unblocked" practice.

## Objective
A WCAG 2.1 AA sign-off audit across every screen built in E1–E9, both light and dark mode,
superseding/aggregating the per-screen checks each individual task's own checker already performed.
This is an AUDIT task, not a build task — it produces no new page code.

## Allowed Files
None. This task's deliverable is its own structured audit report (see Required Worker Output),
returned in your response — not a file. If you find a real defect, do NOT fix it yourself; name it
precisely (file, line, screen, mode) as a candidate follow-up task instead.

## Forbidden Files
Every file in the repository is read-only reference for this task — you are auditing, not editing.

## Known Context / Traps

**1. This is an aggregation/supersession audit, not a from-scratch discovery exercise — start from
the existing record.** Every one of the ~30 content-page tasks in E4–E9 already had its own
checker-accessibility (or equivalent) pass, and `docs/swarm/verification-log.md` already contains a
detailed account of what each one found (many explicitly logged MINOR/NIT accessibility findings —
e.g. heading-level skips on empty states, a systemic pattern flagged repeatedly across
`RosterShell.tsx`/`StudentsTab.tsx`/`ParentsTab.tsx`/`InvitesTab.tsx`). **Read
`verification-log.md` in full first** and compile the list of already-known, already-disclosed
findings before doing any fresh investigation — your job is to confirm these are still accurate
(nothing regressed since they were logged) and to find anything NEW that individual per-screen
checkers, each scoped to their own one task, might have missed by only looking at their own file in
isolation (e.g. an inconsistency that only becomes visible when comparing multiple screens
side-by-side, which no single-task checker was positioned to catch).

**2. "Every screen, both modes" — but most screens are not reachable via a live route yet (the
same `router.tsx`-wiring gap disclosed repeatedly throughout this project).** You cannot literally
navigate a browser through the running app to reach most pages. Audit each page component by
rendering it directly (the same `createRoot`/`act` harness pattern nearly every page's own
`*.test.tsx` file already establishes — reuse that technique, don't invent a different one) with
its own disclosed fixture data, in both a light-mode and dark-mode wrapper context. State this
methodology explicitly in your output.

**3. DES-17's specific, testable requirements, cited verbatim**: "WCAG 2.1 AA. Keyboard path for
every flow including the roll-call console (arrow through roster rows, 1–4 keys set
Present/Late/Excused/Absent on the focused row). Visible focus, labels on all inputs,
`aria-live="polite"` on the live check-in tally." The roll-call/keyboard path was already
extensively verified by T033's own checker (re-confirm, don't re-derive from scratch) — your
incremental value-add is everywhere ELSE this pattern needs to apply, plus catching any drift.

**4. "Keyboard path complete on every core flow (BLOCKER class per constitution if any core flow
fails)"** — this is the single highest-stakes finding category in this audit. A "core flow" means:
login, live check-in console, kiosk, any dialog with a primary confirm action (Schedule meetings,
Season settings, Mark day complete, End meeting, etc.), and any list page's row-level actions
(`MoreMenu`, RSVP controls). Test each with keyboard only — no mouse — for every one you can reach
per Trap #2's methodology.

**5. Contrast AA both modes** — this project already has ONE resolved, documented contrast defect
(D005: dark-mode primary-button text was 4.04:1, below the 4.5:1 AA minimum, fixed via T002b's
`volt.ts` token addition). Re-confirm that fix is still in effect and holds for every screen, and
specifically re-check any screen that introduced its OWN custom color usage rather than relying
purely on Astryx's theme tokens (grep for inline hex colors across the codebase as a fast first
pass — any hit is worth individual scrutiny).

**6. Visible focus everywhere** — confirm no screen suppresses the default focus ring
(`outline: none` with no replacement) anywhere; grep is a fast first pass, but confirm visually/via
computed styles for anything found.

## Acceptance Criteria (of the audit itself)
- Full per-screen checklist covering keyboard path, contrast (both modes), visible focus, and
  `aria-live` region correctness.
- Explicit confirmation (or contradiction, with evidence) of every already-logged finding in
  `verification-log.md`.
- Any BLOCKER-class keyboard-path failure named with exact reproduction steps.
- Any new finding beyond what individual per-screen checkers already caught, with a clear
  candidate-follow-up-task description (file, exact issue, suggested fix).

## Relevant Constitution Excerpts
> DES-17 / NFR-07: WCAG 2.1 AA, checker-accessibility signs off per screen, both modes.

> No worker self-certifies; every finding in this audit should be evidenced (screenshot, computed
> style value, or reproduction steps), not asserted without proof.

## Most Recent Failure
None. This is attempt 1 for T067 (attempt count: 0) — not yet dispatched.

## Required Worker Output
- Full per-screen audit table/checklist (screen × mode × keyboard-path × contrast × focus ×
  aria-live), with pass/fail/already-known-and-confirmed status for each cell.
- Explicit list of any NEW findings not already in `verification-log.md`, each with severity
  (BLOCKER/MAJOR/MINOR/NIT per the constitution's rubric) and a candidate follow-up task
  description.
- Explicit confirmation the D005 dark-mode contrast fix holds everywhere it applies.
- Your rendering methodology (Trap #2) stated explicitly.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
