# VOLT Portal — UX Craft PRD v3.1 (Wave 5) — agent companion

Drafted 2026-07-21 by Fable (architect). **Revised 2026-07-21 after an
independent review by Opus 5** that fact-checked every defect claim against the
code and audited the installed Astryx source for feasibility.
Status: **approved by George — ready to dispatch.**

Full PRD with embedded screenshots: `docs/swarm/VOLT_UX_Craft_PRD_v3.html`.
This file is the compact index for packet authors and checkers.

## What changed in v3.1 (read this before using any v3 notes)

- **UXC-02/03/04/07 re-specified**: migrate rows to Astryx **`Table`**, NOT a
  custom CSS grid. See F-1.
- **UXC-01's fix corrected**: dropping `List header` for `aria-label` does not
  work — `List` silently drops ARIA props (D-G). Would have been an a11y
  regression.
- **UXC-09 (toasts) WITHDRAWN** — both stated facts were false.
- **D-F (roster fixture seams) WITHDRAWN** — claim was inverted; seams exist.
- **D-C (calendar dots) re-scoped** — vendor-blocked, not an app omission.
- **UXC-10 scope ~10×** — ten rendered jargon strings, not one.
- **UXC-08 must disclose** that it reverses part of T121 and amends a green test.
- **UXC-13 (responsive) and UXC-14 (dark theme) added** — both were missing.
- **W5-P5 rescoped**: `/reports` and `/settings` layouts are constitutionally
  frozen (George's decision 1).
- **Three feasibility constraints (F-1..F-3) stated up front** so packets don't
  stall in dispute.

## The figures ARE the requirements evidence

Loose files in `docs/swarm/figures/ux-craft/`: `old-*.webp` = reference app
(binding craft standard — chiefly `old-events-tab.webp`,
`old-dashboard-full.webp`, `old-student-view.webp`); `new-*.webp` = portal
surveyed live 2026-07-21 (1440×900, light theme).

**Workers and checkers must open the relevant figures with the Read tool** and
judge at the mechanism level. "Directionally matching" is NOT a passing grade.
Ignore fixture-data magnitude and light-vs-dark palette; judge structure.

## Feasibility constraints — binding, verified against installed source

**F-1 · `Table` is the only primitive that can align columns across rows.**
`ListItem` wraps `Item`, a 3-slot flex (`start | content(flex:1) | end`) with
`flex: 0 0 auto` end caps (`src/Item/Item.tsx:156-275`) — no prop reaches it, so
sibling rows *cannot* align. `Grid` is equal-width only; `StackItem` is
`'static'|'fill'` only. `Table` supports `pixel()`/`proportional()` widths,
per-column `align`, `renderCell: (item) => ReactNode`, `useTableGroupedRows`,
`useTableRowExpansion`. **In-repo precedents: `StudentsTab.tsx:998-1049`,
`ParticipationTab.tsx:305-327`.**
*Known gap:* row expansion is inherited-columns only (no
`renderExpandedContent`). Per-session detail fits; free-text ("Going: …") needs
its own column or children-mode `colSpan` (which forfeits width resolution).
Decide per surface and disclose.

**F-2 · `xstyle` does not work here.** StyleX is compile-time and the app has no
StyleX plugin (`vite.config.ts` = `[react()]`); `stylex.create()` throws at
runtime. Effective DES-21 ladder is **component → theme token → custom CSS**.
`className`/`style` are merged (`src/utils/mergeProps.ts:62-107`); the sanctioned
CSS surface is the `astryx-*` class + `data-*` contract (precedent:
`src/theme/theme.css:492-522`).

**F-3 · `ProgressBar` cannot segment, tick, or mark a goal.** One scalar `value`,
one fill div (`ProgressBar.tsx:283,350-358`); its doc forbids stacked bars.
Recoloring the fill IS supported (5 semantic variants or theme CSS on
`.astryx-progressbar-fill[data-variant]`).
**Architect ruling (pre-approved, do not dispute):** one small custom bar
component — track, one or two fills, optional ticks — is approved under DES-21's
final rung **for UXC-05 and UXC-08 only**. Presentation only, no metric math, one
shared module, contrast verified in both themes. `Badge` needs no escalation (14
variants incl. 10 hue families).

## Global requirements

| ID | Rule | Severity |
|---|---|---|
| UXC-01 | One heading per section. **Do NOT use `aria-label` on a headerless `List`** (silently dropped — D-G). Use: (a) keep `List header`, drop the outer `Heading`; (b) wrap in a labelled region; or (c) migrate to `Table`. | MAJOR |
| UXC-02 | Coach event/meeting rows migrate `List`→**`Table`** with `pixel()`/`proportional()` tracks, grouped sections, expander. Zero x-drift. *Basis: PRD v1 §7.1 compact rows.* | MAJOR |
| UXC-03 | One shared three-tier `renderCell` stat helper (micro-label / value w/ `hasTabularNumbers` / secondary) across rows and tiles | with UXC-02 |
| UXC-04 | Compact affordances; visible control text NEVER repeats the row title (title → `aria-label` only). **AUTHORIZED CHANGE (2026-07-28, George) — supersedes the earlier exemption below.** The "View details – {title}" row link is replaced by the reference app's compact pair (`old-events-tab.webp`): short `Edit` chip + destructive `×`. **The link is not deleted, it moves onto the event title**, which becomes the `Link` to `routePaths.outreachEvent(event.id)` — that keeps a keyboard path to the detail page and gives the link real, distinguishing text (the event name), so no `label`/`aria-label` is permitted on it. Icon-only controls (the `×`) still require an `aria-label` carrying the title: Astryx's no-`label` rule governs **text links**, not icon buttons. Amends **one** T112 assertion, `OutreachList.test.tsx:1726` (the coach test). `:1759` is the student/parent test, whose rows render through `ListItem` rather than the coach `Table` and are **not** in scope — it must keep passing unchanged. `OutreachList` coach rows change first (T131); the student/parent rows (`OutreachList.tsx:3185-3187`) and the mirrored `CalendarPage.tsx:634` link with `CalendarPage.test.tsx:475-476,488` follow in T132, not before. | MAJOR |<br>*Superseded exemption (dated 2026-07-28 in its own text, added during the wave-5 planning pass), retained for audit:* "View details – {title}" row links keep their full visible text, because Astryx's Link guidance forbids `label`/`aria-label` on text links and forbids generic text like "read more". That reasoning was sound but assumed the only alternatives were a generic "Details" link or an unlabelled icon — the title-as-link resolution satisfies both constraints and was not considered at the time.<br>*Accepted limitation (2026-07-28, George): on `ListItem` surfaces the linked title does **not** truncate. `Item.tsx:353-360` applies its single-line truncate style only to **string** labels; a `ReactNode` label gets none, and `ListItem` does not expose `labelLines`. Measured: the anchor overruns the row at 1440px and 375px with no ellipsis, while page-level scroll and row height are unaffected. The only fix needs a TypeScript escape hatch to reach a non-public prop and clips rather than ellipsizes — judged not worth it. **Checkers must not flag absent truncation on a linked `ListItem` title as a defect.***
| UXC-05 | One semantic color system in `volt.ts`: confirmed=green, planned=purple, goal tick; type badges via Astryx hue variants; per-team hues; zero default-accent bars | MAJOR |
| UXC-06 | Content max-width ~1120px (forms stay 720); no full-bleed bars/controls; dashboard modules pair two-up via `Grid`. **Excludes `/reports` + `/settings`.** *Basis: PRD v1 §4.2 two-column Coach Home.* | MINOR |
| UXC-07 | Collapsed coach rows **≤72px measured** (not "≥8 rows" — only 5 fixtures exist); ONE separation system (default: bordered row-cards); expander never out-weighs titles | with UXC-02 |
| UXC-08 | Goal/milestone strip is a real bar (F-3 custom component). **Must disclose it reverses T121 and amends `OutreachList.test.tsx:1279-1298`; exactly ONE bar.** *Basis: PRD v1 §7.1 `▓▓▓▓▓▓░░░░ 812 / 1,500 h`.* | MAJOR |
| ~~UXC-09~~ | ~~Toast discipline~~ — **WITHDRAWN, claim false** (5s auto-hide present; not position:fixed) | — |
| UXC-10 | ZERO internal jargon in user-facing copy — **10 sites** (see below); update `MeetingsList.test.tsx:889` which asserts `'T037'` renders | BLOCKER |
| UXC-11 | Friendly dates everywhere (no raw `YYYY-MM-DD`) | MINOR |
| UXC-12 | Kiosk + live console chromeless. `AppShell.tsx:96-102` matches by `===` so params never match — needs pattern matching. *Basis: PRD v1 §7.1 "fullscreen", §4.2 wireframe.* | MAJOR |
| UXC-13 | **NEW.** Responsive behavior specified per layout requirement; ship 375px + 1440px shots; no h-scroll at 375px; 44px touch targets; T068 sweep re-run | MAJOR |
| UXC-14 | **NEW.** Dark-theme captures for every touched surface added to the figures dir | MINOR |

UXC-10's ten sites: `SettingsPage.tsx:1139` · `LiveConsole.tsx:776-777, 990,
1020-1021` · `MeetingsList.tsx:1568, 1932-1935` · `AdminToggles.tsx:391, 403-405`
· `OutreachEventDialog.tsx:1301, 1307`.

## Per-screen findings (details + figures in HTML §3)

- **OutreachList (coach)** — centerpiece: UXC-01/02/04/07/08.
  `new-outreach-expanded.webp` vs `old-events-tab.webp`.
- **MeetingsList** — UXC-01/02/03/07; inverted expander hierarchy; floating
  canceled badge. `new-meetings.webp`.
- **CoachHome** — UXC-01/05/06; two-tone projection bar + goal tick + right
  numeric column (`old-dashboard-full.webp`); module pairing; tile-grid orphan;
  scope captions. (Toast finding withdrawn.)
- **Reports** — the model to copy, not a target: it looks right *because* it is a
  template-as-is route using `Table`. **No work this wave.**
- **Calendar** — day dots dropped (vendor-blocked); legend/list workaround +
  UXC-04/01/06 only. `new-calendar.webp`.
- **Leaderboard** — bars/%-of-goal/team badges, approved. `new-leaderboard.webp`.
- **Student/Parent home** — UXC-01/05/06; legible consistency chips; card-grid
  worth considering (also the best UXC-13 answer). `old-student-view.webp`.
- **StudentMeetingView** — needs a page frame. `new-student-meetings.webp`.
- **OutreachDetail** — RSVP column equalization, drop fake-input underlines,
  width cap.
- **Settings** — **copy fix only** (UXC-10); layout frozen.
- **LiveConsole / Kiosk** — chromeless (UXC-12); banner copy stale *and*
  jargon-laden, but its conclusion is still true (genuinely fixture-wired) —
  fix the reason, keep the warning.
- **Fine as-is**: Login; T125 edit form (UXC-11 only); Reports tables; **Roster**
  (seams exist — re-capture, no code change).

## Packet map

P1 sweep (UXC-01/10/11) → **P2 proving ground: OutreachList → `Table`**
(UXC-02/03/04/07/13/14) → P3 rollout to meetings/calendar/student surfaces →
P4 color system + custom bar + dashboard/leaderboard composition
(UXC-05/06/08/14) → P5 page frames on non-frozen routes → P6 chromeless
projection routes + banner copy + roster re-capture.
P2 blocks P3. **P2 must prove the `Table` path at 1440px and 375px (zero
x-drift, working expansion) before P3/P4 rely on it** — F-1's expansion gap is
the one place the primitive may not fit. Next task ID: T129.

## Decisions & open items

**Decided by George (2026-07-21):** (1) `/reports` and `/settings` template
layouts stay untouched — wave 5 drops that work, keeps the Settings copy fix.
(2) Leaderboard bars + % of goal approved; recorded as an explicit constitution
item-17 ruling (facts only, no streaks/scarcity/guilt; SEC-04 unchanged) —
checkers should not re-litigate.

**Open:** (3) separation system — bordered row-cards (default) vs zebra.
(4) carried: bulk "Mark event complete" parity. (5) two process amendments the
review recommends: PRD v1 §7.1's "never ASCII fidelity" checker instruction is
what let density drift unchecked — amend for wave-5 surfaces; and constitution
item 2 (`astryx-api.md` as sole prop source) is stale — make installed source
authoritative when the doc is silent or wrong (precedent: D004, T125, T128).
