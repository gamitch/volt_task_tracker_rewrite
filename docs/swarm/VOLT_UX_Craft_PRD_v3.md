# VOLT Portal — UX Craft PRD v3 (Wave 5) — agent companion

Status: **awaiting George's review — do not dispatch packets until he approves.**
Author: Fable (architect), 2026-07-21.

The full PRD — with every embedded screenshot — is
`docs/swarm/VOLT_UX_Craft_PRD_v3.html` (self-contained; open in a browser).
This file is the compact index for packet authors and checkers.

## The figures ARE the requirements evidence

All figures exist as loose files in `docs/swarm/figures/ux-craft/`:

- `old-*.webp` — the reference app (volt-timetracker.lovable.app), the binding
  craft standard. Most important: `old-events-tab.webp` (list craft),
  `old-dashboard-full.webp` (module composition), `old-student-view.webp`
  (student card grid).
- `new-*.webp` — the portal surveyed live on 2026-07-21 (real components in
  real chrome, fixture data, 1440×900 light theme). One per routed screen.

**Workers and checkers must open the relevant figures with the Read tool**
(it renders images) and judge against them at the mechanism level.
"Directionally matching" is NOT a passing grade in wave 5; the acceptance
criteria below are the bar. Fixture-data magnitudes and light-vs-dark
palette are explicitly out of scope — judge structure. Every requirement
must hold in BOTH themes.

## Verdict (one paragraph)

George is right: the old app is the better visual instrument today. The new
portal wins on data correctness, permissions, a11y semantics, and honest
states; it loses on layout craft. Wave 5 closes that gap. No new features.
The five mechanisms behind the old app's superiority (PRD §1): M1 fixed
column grids · M2 column-locked three-tier type · M3 compact affordances ·
M4 card separation + density · M5 color as encoding.

## Global requirements (binding; severity = review outcome if violated)

| ID | Rule | Severity |
|---|---|---|
| UXC-01 | Exactly one heading per section — kill the app-wide `Heading` + List-`header` duplication; keep screen-reader names via aria attributes | MAJOR |
| UXC-02 | Coach event/meeting rows on ONE shared CSS-grid template; zero x-drift of stat/action columns across rows | MAJOR |
| UXC-03 | One shared three-tier stat cell (micro-label / value / secondary) used by all rows and tiles | with UXC-02 |
| UXC-04 | Compact affordances; visible control text NEVER repeats the row title (title goes in aria-label only) | MAJOR |
| UXC-05 | One semantic color system: confirmed=green, planned=purple, goal tick; type badges (outreach green / meeting blue-purple / competition orange); per-team hues; zero default-blue bars left | MAJOR |
| UXC-06 | Content max-width ~1120px (forms stay 720); no full-bleed controls; bars capped ~480px or column width | MINOR |
| UXC-07 | Density: collapsed coach rows ≤~72px, ≥8 rows visible at 1440×900; ONE separation system app-wide; expander never out-weighs titles | with UXC-02 |
| UXC-08 | Goal/milestone strips are real bar components (track+fill+ticks+labels), never floating text | MAJOR |
| UXC-09 | Toasts auto-dismiss, fixed corner, never overlap content | MINOR |
| UXC-10 | ZERO internal jargon in user-facing copy (found live: "module doc #2" in Settings) | BLOCKER |
| UXC-11 | Friendly date formatting everywhere (no raw `YYYY-MM-DD`) | MINOR |
| UXC-12 | Kiosk + live console become chromeless routes (pending George's confirm) | MAJOR |

Full text + acceptance criteria per requirement: PRD HTML §2.

## Per-screen findings index (details + figures in HTML §3)

- **OutreachList (coach)** — worst offender: UXC-01/02/04/07/08. Figure
  `new-outreach-expanded.webp` vs `old-events-tab.webp`.
- **MeetingsList** — UXC-01/02/03/07; inverted expander-vs-title hierarchy;
  floating canceled badge. `new-meetings.webp`.
- **CoachHome** — UXC-01/05/06/09; two-tone projection bars + goal tick +
  right-aligned numeric column (see `old-dashboard-full.webp`); module
  pairing; tile-grid orphan; scope captions. `new-coach.webp`,
  `new-coach-modules.webp`.
- **Reports** — tables are the app's best pattern (keep); consolidate the
  scattered filter/sort controls into one toolbar; toast overlap.
  `new-reports.webp`, `new-reports-hours.webp`.
- **Calendar** — day cells show NO session markers (D-C, real gap); verbose
  links; doubled heading; grid width. `new-calendar.webp`.
- **Leaderboard** — restore bars/%-of-goal/team badges (D-E, anonymization
  unchanged). `new-leaderboard.webp`.
- **StudentHome / ParentHome** — UXC-01/05/06; legible consistency chips;
  consider old app's card grid for student past events
  (`old-student-view.webp`). `new-student.webp`, `new-parent.webp`.
- **StudentMeetingView (strip page)** — unframed fragments at top edge;
  needs a page frame or folding into meetings. `new-student-meetings.webp`.
- **OutreachDetail** — minor: RSVP column equalization, drop fake-input
  underlines, width cap. `new-outreach-detail.webp`.
- **Settings** — BLOCKER copy leak ("module doc #2") + full-bleed width.
  `new-settings.webp`.
- **LiveConsole / Kiosk** — chromeless (UXC-12); stale dev banners (D-B:
  claims no supabase client exists — false since T071); kiosk QR
  placeholder is the known Edge-Function dependency (D-D, out of scope).
  `new-live-console.webp`, `new-kiosk.webp`.
- **Fine as-is**: Login; T125 edit form (only UXC-11 applies); Reports
  tables. Roster surveyed empty (no fixture seams — D-F, P6 adds them).

## Packet map (P1..P6 — see HTML §5 for scope detail)

P1 mechanical sweep (UXC-01/09/10/11) → P2 shared craft components proving
on OutreachList (UXC-02/03/04/07/08) → P3 rollout to meetings/calendar/
student surfaces → P4 dashboard+leaderboard composition (UXC-05/06) →
P5 page frames + calendar dots → P6 chromeless projection routes + banner
copy + roster seams. P2 blocks P3/P4. Task IDs will continue from the
ledger (next: T129).

## Open for George (HTML §6)

1. Approve/amend this PRD. 2. UXC-12 confirm (recommend yes). 3. Leaderboard
bars confirm. 4. Separation system: bordered cards (default) vs zebra.
5. (Carried) bulk-complete parity decision.
