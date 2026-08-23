# Standing decisions — George's rulings, consolidated

These are the product decisions George made during the first rewrite,
extracted from `docs/swarm/auto-mode-decisions.md`, the dispute log, the PRDs'
dated annotations, and the owner session records. They were expensive to
reach — several reversed shipped work — and they are **binding for the
rebuild unless George explicitly re-opens them**. Where a ruling was quoted
verbatim in the record, the quote is preserved.

Format: **ID — ruling** (date · original record).

## Identity & privacy

- **P-1 — Authentication is non-negotiable.** The old Lovable app's
  world-readable minors' data "is the single worst thing this rewrite exists
  to fix." Parity with the old app means *workflow* parity, never
  identity-model parity. (2026-07-20 · PRD v2 D-6)
- **P-2 — First name + last-initial is not PII** and is permitted anywhere a
  full name would not be. Students seeing other team members — leaderboards,
  event signups, any authenticated surface — "is the product, not a leak."
  (2026-08-21 · GAM-434, constitution item 6)
- **P-3 — No full student names, emails, or contact info** in logs, URLs,
  analytics, commit messages, or test fixtures; kiosk and leaderboard
  surfaces show "First L." at most; no public pages; robots noindex; no
  photos of minors in v1. (PRD v1 SEC-01..04)
- **P-4 — No engagement mechanics aimed at minors.** Streak pressure,
  countdowns, FOMO/scarcity, loss-aversion framing, guilt copy, and
  re-engagement hooks are banned. Honest progress signals only (milestones,
  planned-vs-confirmed, consistency strips). (PRD v1 §5.7 / constitution
  item 17)
- **P-5 — Proportionality.** Verbatim: *"let's not overcomplicate our
  application... This is a volunteer group, not a company. We store no PII,
  it is just a small team with me and thier parents. please keep it
  simple."* Security findings are graded against this threat model.
  (2026-07-30 · auto-mode-decisions.md)

## Domain semantics

- **D-1 — Meetings produce participation %; outreach produces volunteer
  hours; the two never mix** in any list or metric outside Calendar and
  Reports. (PRD v1 NAV-07 / MET family)
- **D-2 — Volunteer hours count by event `type`, never by event name.**
  `type='meeting'` yields participation %, never hours toward the goal.
  `type='outreach'` counts — and that *includes* "GG FLL Team Meetings" and
  "P3 FLL Team Meetings" despite the word Meetings, because students run
  those as community service. Retyping events by title was proposed once and
  was wrong. (2026-08-02 · T322 ruling, AUDIT-TRIAGE.md)
- **D-3 — One combined season for all teams.** Verbatim: "One season for all
  and reporting will handle the team metrics." Exactly one active season,
  enforced by partial unique index. (2026-07-20 · PRD v2 D-2)
- **D-4 — Hours double-count across team rollups, count once personally.**
  A dual-membership student's 10h shows as 10h in each of their teams'
  rollups and 10h (not 20h) in their personal total. (2026-07-20 · PRD v2
  D-3/SCH-03)
- **D-5 — The coach is ultimate authority.** Verbatim: "As coach I am
  ultimate authority." Staff edits may overwrite or delete student RSVPs and
  check-ins; earlier self-authored-protection rules were removed.
  (2026-07-20 · PRD v2 D-7/T119)
- **D-6 — Attendance is last-write-wins.** A student marked absent who then
  scans the kiosk becomes present. This *reversed* the PRD's original
  coach-precedence text. (2026-08-02 · MTG-11 supersession)
- **D-7 — Absent only on explicit coach action.** Verbatim: "only count
  'absent' if i click the pill." Ending a meeting must not backfill absent
  rows for unmarked students. (2026-08-05 · T508 ruling)
- **D-8 — Un-marking writes an `unmarked` sentinel, never deletes the row** —
  check-in timestamps and hour overrides survive. (2026-08-22 · GAM-479)
- **D-9 — Attendance corrections are not fraud.** No audit trigger on
  attendance edits; `recorded_by` + `updated_at` on the row is the right
  level of accountability for this team. (2026-08-03 · DATA-02 reversal)
- **D-10 — Three attendance paths, in priority order:** coach-managed with
  per-student hour overrides (primary), retroactive student/parent self
  check-off recorded as `method='self'`, trusted but visibly badged (no
  approval queue), and live QR/short-code check-in. QR-only failed George's
  live test on day one. (2026-07-20 · PRD v2 D-4/D-5)
- **D-11 — Dashboards are season-wide; there is no per-coach team scoping.**
  Verbatim: "yes, season-wide is fine option b." (2026-08-03 · T198)
- **D-12 — Goal resolution:** `students.goal_hours_override` ??
  `seasons.default_goal_hours`. Planned hours (future `going` RSVPs ×
  duration) are always displayed separately and **never summed** into
  confirmed hours. (PRD v1 MET-04 / BEH-02)
- **D-13 — RSVPs are readable by every authenticated user.** Seeing who
  signed up is the product. (owner ruling D013 · migration 20260804000001)
- **D-14 — Sessions have two buckets (upcoming/past); the coach closes days
  by hand.** Accepted risk: unclosed days never reach the hours views.
  Recorded with the cheaper middle ground on T304 if it bites. (T304)
- **D-15 — Excused shrinks the participation denominator** and never renders
  as failure; late counts as present in every metric and exists only as a
  visible flag. (PRD v1 MET-01/MET-05/BEH-06)
- **D-16 — Participation shows an em-dash / NULL when no completed meetings
  exist — never a fabricated 0%.** (PRD v1 MET-01; meetings design contract)
- **D-17 — Weekly digest is gated on `notification_prefs.weekly_digest`
  alone**; `digest_enabled` is vestigial. (2026-07-19)

## Design & stack

- **S-1 — Tracker Orange is the brand accent** (`#A8560A` light /
  `#f79a4a` dark, with measured on-accent pairs), replacing Volt Violet.
  Consequence: competition badges moved orange → teal so a badge doesn't
  read as *selected*. (2026-08-21 · D020)
- **S-2 — lucide-react is an approved icon source** (Astryx's closed 26-name
  set couldn't name four of seven nav destinations). (2026-08-21 · D021)
- **S-3 — `/meetings` is a series-card page**, not a session table: one card
  per series, Active/Finished tabs, calendar rail, month-tab schedule panel.
  This superseded the Table mandate for that page only. (2026-08-21 ·
  MTG-01a-h)
- **S-4 — The old tracker (volt-timetracker.lovable.app) is the visual craft
  reference**: dense rows that answer when/what/where/how-much/who inline,
  expand-in-place, inline Edit/×, persistent KPI strip, page-like forms for
  >6 fields. Reference figures live in `docs/swarm/figures/ux-craft/`.
  (PRD v2 §1, PRD v3.1)
- **S-5 — Leaderboard proportional bars + "% of goal" are approved** (facts
  only; anonymization per P-3 unchanged). (2026-07-21)
- **S-6 — React 19** (Astryx requires it at runtime). (D002)
- **S-7 — Timezone regime:** store UTC instants; `session_date` is a Chicago
  calendar date; display America/Chicago everywhere. (PRD v1 NFR-09)

## Process rulings that carry forward

- **PR-1 — Metric formulas exist only in SQL views**; re-deriving one in
  TypeScript is a defect wherever it appears. (constitution item 3 — the one
  process rule with a perfect record)
- **PR-2 — A deliberate deferral files a tracked issue, not a code comment.**
  Comments are not triaged. (constitution item 20 — paid for three times in
  one day)
- **PR-3 — A surface reading from a fixture is not done** — it is Partial at
  best, and the wiring is part of the work. (constitution item 27; the
  rebuild's C-2 makes this stronger: fixture defaults don't exist at all)
- **PR-4 — Explicit pathspecs when staging commits; never `git add -A`.**
  (constitution item 22)

## Open questions the rebuild PRD puts back to George

See `PRD.md` §12 ("Decisions needed from George") — the questions the first
rewrite never answered, each with a proposed default so work can proceed.
