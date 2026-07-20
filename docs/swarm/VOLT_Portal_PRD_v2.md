# VOLT Team Portal — PRD v2: UX Parity & Schema Foundations

**Status:** Draft for George's sign-off · **Author:** Fable (requirements designer &
architect, session `claude/swarm-plan-zl575z`) · **Date:** 2026-07-20

**Inputs:** `docs/swarm/VOLT_Portal_PRD.md` v1.6 (remains authoritative for
everything not amended here) · `docs/backlog.html` (B1–B15 + org ground truth) ·
`docs/swarm/current-app-capability-map.md` / `.html` (live survey of
volt-timetracker.lovable.app, the **binding UX reference standard** for this PRD) ·
`docs/swarm/constitution.md` (unchanged; all items still BLOCKER-class) ·
`docs/swarm/task-ledger.md` (state at drafting: 112 tasks Passed, ED-1 real-data
epic complete, app live-tested by George).

**Relationship to v1:** v1 built the platform (auth, RLS, roles, seasons, events,
check-in, email, reports). ED-1 wired it to real data. George's live testing plus
the capability-map survey then established that the platform's *coach experience*
is materially worse than the spreadsheet-replacement app it must retire, and that
two schema decisions (multi-team membership, overlapping seasons) must land
**before real data accumulates**. This PRD covers exactly that: making the portal
the tool George's coaches prefer to open, on a schema that matches how his
program actually runs.

---

## 0. Decision register

Each decision below has a **default** chosen by the architect. Defaults are
binding on the swarm **unless George overrides them in review of this document**.
Do not re-litigate these in worker packets; cite `D-n`.

| ID | Question | Default (binding unless vetoed) | Rationale |
|---|---|---|---|
| **D-1** | Scope of this swarm | **UX parity epic + schema foundations (B2 + B3) + venues (B6 folded in)**. FLL/student-coaches (B4), mentors (B5), Impact export (B8) deferred to the next swarm. | B2/B3 are "before data accumulates" decisions; UX parity is George's stated priority; venues is S-sized and required for row-density parity (current-app rows show location). B4/B5 build *on* B2/B3 — sequencing them later avoids a design pass against a moving schema. |
| **D-2** | Season scoping (B3) | **Per program** (`FRC`, `FTC`, `Other` now; `FLL` arrives with B4). One active season per program; e.g. "25-26 FTC" and "25-26 FRC" active simultaneously. | Matches FIRST's structure and George's "'25-26' nomenclature for all seasons" note. Per-team goal variance is already handled by `students.goal_hours_override`. Per-team seasons would multiply admin work every year for no identified need. |
| **D-3** | Dual-membership hours (B2) | **Credit where earned + combined student total.** Hours attach to the (team, session) where earned; each team's reports count only its own sessions; the student's personal view and future Impact/grant exports show the combined figure. Never double-counted into two teams' totals. | Keeps per-team reports honest, states a dual-member student's real contribution, and gives B8 the number it will need. |
| **D-4** | Attendance model | **All three paths:** (a) coach-managed attendance with per-student hours (primary, edit-dialog parity), (b) retroactive check-off by authenticated students, (c) existing live QR/kiosk check-in. | This is how the teams demonstrably operate today (capability map, student `/me` flow + coach edit dialog). QR-only failed George's live test on day one. |
| **D-5** | Are student self-reports trusted or approved? | **Trusted-but-visible.** A student's retroactive check-off takes effect immediately, is labeled `self` in the record and the activity feed, and a coach can amend or remove it from the same attendance UI. No approval queue. | Matches the current app's model (Self badges on the dashboard feed) and the constitution's no-surveillance posture; an approval queue adds coach workload the teams never asked for. Coach edit-ability is the integrity backstop. |
| **D-6** | Identity floor | **Unchanged from v1: authentication stays.** No honor-system name-picker is ported. The retroactive path (D-4b) requires a signed-in student/parent account; students too young to hold accounts are covered by the coach-managed path (D-4a). | The current app's world-readable minors' data is the single worst thing this rewrite exists to fix. Parity means workflow parity, never identity-model parity. |

---

## 1. UX & Information Density requirements (UXD) — **first-class, binding on every coach/admin surface**

George's directive, verbatim intent: *the current app uses screen real estate
better and keeps great metrics persistent throughout; UX functionality is a
priority.* These are requirements, not polish. The reference standard is the
screenshot set in `docs/swarm/current-app-capability-map.html`; checkers for any
UXD-tagged task must compare the built surface against the referenced figure and
judge information density honestly, not just verify elements exist.

- **UXD-01 · Persistent KPI header.** Every coach/admin page renders a compact,
  always-visible KPI strip: season hours (with per-category breakdown), active
  students (per-team split), events logged (+ most recent), % toward season goal.
  One shared component; values from SQL metric views only (constitution item 3);
  scoped by the active season(s) per D-2. Loading state is a skeleton of the
  strip, never a blank band.
- **UXD-02 · Row-density standard for event lists.** An event row must answer,
  without navigation: when (date/range + recurrence chips like "MON (18) ·
  THU (18)"), what (title + category badge), where (location, UXP-08), how much
  (planned/logged hours), who (expected/attended counts; reached where
  applicable), plus inline actions per UXD-04. Reference: capability map
  "Events tab" figure. The current one-line title+time+badge rows fail this
  standard.
- **UXD-03 · Expand-in-place.** List rows offer progressive disclosure (an
  expander) showing per-session detail — dates, times, hours, attendee names —
  without leaving the list. Navigation to the full detail page remains available
  (T112's links) but must not be the *only* way to see who's coming.
- **UXD-04 · Inline primary actions.** Rows carry their primary actions (Edit,
  Cancel/×, role-permitting) directly. No dead ends: every entity a user can see
  offers its next action within one interaction. Astryx's non-interactive-
  ListItem constraint applies (actions live in `endContent` / an actions slot,
  not whole-row clicks) — the pattern T112 established.
- **UXD-05 · Screen-real-estate rules.** (a) No duplicated headings for one
  concept (the "Team season goal" triple-label on today's Outreach page is the
  named anti-example). (b) Empty states are compact when other content on the
  page has data — a section with no rows yields its space; it does not center a
  message in half a viewport. (c) Grouped stat tiles over stacked full-width
  bars where the reference app demonstrates the tile pattern.
- **UXD-06 · Form layout standard.** Creation/editing flows with more than ~6
  fields (event create, event edit/attendance) are page-like layouts (routed
  page or full-height panel) with labeled sections and room to breathe — not
  cramped modals. Small confirmations stay dialogs. Reference: capability map
  "New event form" and "Edit event dialog" figures.
- **UXD-07 · Dashboard analytics parity.** The coach/admin dashboard includes:
  secondary stat tiles (avg hours per active student, students at goal, session
  days logged, attendance rate, upcoming 30-day committed hours, busiest day);
  per-student **goal projection** (stacked confirmed + planned vs. goal line,
  honest "on track / N h short" annotations, Below-goal filter); **hours by
  team**; **top events by student hours**; and the **activity feed** (UXP-10).
  Every number from SQL views (new views enumerated in §4); no TypeScript
  re-derivation. Motivation-ethics rules apply verbatim: annotations state
  facts ("44h short"), never guilt/urgency copy; goal projection is
  coach/admin-facing — student-facing views keep v1's BEH-06 posture.
- **UXD-08 · Bulk actions.** Where the reference app offers a bulk action the
  portal offers it too — specifically "Mark whole event complete" (UXP-07).
- **UXD-09 · Density with accessibility.** Density never trades away the
  checker-accessibility bar: contrast, focus, keyboard paths, and both themes
  hold on every UXD surface. Astryx-only remains BLOCKER-class.
- **UXD-10 · Anonymization boundary unchanged.** Denser coach surfaces show
  full names (coaches are staff; v1 already permits this). Leaderboard/kiosk
  surfaces keep SEC-04 anonymization exactly as shipped. Nothing in this epic
  loosens a privacy posture to gain density.

---

## 2. Functional requirements — Epic UXP (UX & workflow parity)

- **UXP-01 · Coach-managed attendance with per-student hours.** From an event's
  edit surface, staff can, per session day: see the roster (scoped to the
  event's team(s), grouped by team chips), toggle each student's attendance,
  and override each attending student's credited hours (default = session
  hours; persisted via `attendance.hours_override`). Add day / remove day
  included; removal follows T101's FK-safe reconciliation (never orphans
  RSVP/attendance rows silently — surface the conflict honestly). A running
  event-total-hours indicator is visible while editing (reference: "48h total"
  badge). Requires SCH-04.
- **UXP-02 · Expected attendees at creation.** Event creation includes a roster
  checklist (grouped by team, All/Clear) whose checked students are recorded as
  planned RSVPs (`responded_by` = the coach, marked as staff-entered). Future
  events: planned hours count toward projection (UXD-07) but never toward
  confirmed totals until attendance lands — the reference app's own rule.
- **UXP-03 · Retroactive student check-off.** A signed-in student (or parent
  for a linked student) can mark past-event attendance from a "my events"
  surface: tap an event card, pick days for multi-day events, receive default
  hours; record is labeled `self` (D-5) and appears in the activity feed. A
  coach can amend or remove it via UXP-01. Constitution: copy stays neutral —
  no nagging about unreported events.
- **UXP-04 · Dense lists + expander + inline actions** for the Outreach and
  Meetings list pages (and Calendar's session list where applicable), per
  UXD-02/03/04.
- **UXP-05 · Persistent KPI strip** per UXD-01.
- **UXP-06 · Dashboard analytics** per UXD-07.
- **UXP-07 · Mark whole event complete.** One action completes every remaining
  session of an event (each getting the same treatment as the existing per-day
  Mark Day Complete, including people-reached entry where applicable), with a
  clear per-day summary in the confirmation.
- **UXP-08 · Event location (B6).** Additive `events.location` (free text now;
  a venues table only if reuse demands it later). Shown in: create/edit forms,
  event rows (UXD-02), detail pages, ICS `LOCATION` (the
  `supabase/functions/ics/location.ts` seam), and reminder-email templates.
  Email-template changes stay behind `RESEND_SEND_MODE` (constitution item 16).
- **UXP-09 · Event create/edit re-layout** per UXD-06, folding in UXP-01/02
  surfaces. Existing dialogs (`OutreachEventDialog`, `ScheduleMeetingsDialog`)
  may be retired or wrapped — architect's note: prefer one shared event-editor
  page serving both meeting and outreach types, since the reference app proves
  one form serves all categories.
- **UXP-10 · Activity feed.** Coach dashboard feed of RSVP/attendance changes:
  "<student> signed up / dropped / checked off <event · day>", relative
  timestamp, `self` / staff origin label (D-5). Derived from existing columns
  (`responded_by`, `recorded_by`, timestamps) — if a delete leaves no trace to
  feed from, prefer status transitions over hard deletes (schema note §4). No
  read-receipts, no student-facing surveillance surfaces (constitution).

## 3. Functional requirements — Epic SCH (schema foundations)

- **SCH-01 · Multi-team membership (B2).** Additive `student_teams(student_id,
  team_id, joined_on, left_on)` junction, backfilled from `students.team_id` in
  the same migration; `team_id` remains as legacy/primary-team until every
  reader migrates (tracked as an explicit follow-up list in the epic, not
  silently forever). Rosters show team chips; a student appears on each of
  their teams' rosters; invite flow can attach a student to ≥1 team.
- **SCH-02 · Per-program seasons (B3, D-2).** Additive `seasons.program` with
  the same value set as `teams.program`; replace the global
  one-active-season partial unique index with a per-program one (new index +
  drop old in one additive migration — index swaps are not shipped-migration
  edits). `SeasonProvider`/season resolution becomes per-program; the TopNav
  season control (still a hardcoded placeholder today) becomes the real
  program-aware season picker and is **in scope**. Every page keeps its
  `seasonId` threading; only the selection source changes. Reports/leaderboard/
  goal queries resolve the season for the team-in-context's program.
- **SCH-03 · Hours crediting (D-3).** Attendance/hours remain keyed to the
  session (whose event belongs to team(s)); per-team metric views count only
  that team's sessions; new combined-per-student view provides the cross-team
  total for personal views and future exports. Double-counting is a
  checker-verifiable failure (a dual-member fixture student must sum correctly
  in both team reports and the combined view).
- **SCH-04 · Staff attendance/RSVP write policies.** New additive RLS policies
  permitting `is_staff()` users to insert/update/delete `rsvps` and
  `attendance` rows for any student (enabling UXP-01/02), alongside the
  existing own/linked policies (which continue to power UXP-03 and existing
  RSVP flows). The `attendance` table's deliberate v1 posture ("no client
  writes; Edge Function only") is being consciously amended by this PRD —
  worker packets must cite this section, and the checker must verify the new
  policies against a real scratch Postgres with session-level tests
  (T104/T105/T012/T014 precedent), including negative tests (student cannot
  write another student's rows; parent cannot write unlinked rows).

## 4. Data-model & view deltas (all additive; constitution item 10)

Migrations (names indicative): `student_teams` junction + backfill (SCH-01);
`seasons.program` + per-program active index swap (SCH-02); `events.location`
(UXP-08); staff-write RLS policies on `rsvps`/`attendance` (SCH-04); RSVP
status-transition support if hard-deletes currently erase feed history
(UXP-10 — investigate before writing; prefer `status` over delete).
New/updated SQL views (sole source of metric math): per-program-season scoping
for `v_student_participation`/`v_student_hours`; combined per-student
cross-team hours (SCH-03); dashboard aggregates for UXD-07 (avg hours/active
student, students-at-goal, attendance rate, busiest day, upcoming committed
hours, top events, goal projection inputs). Traps carried forward: never edit a
shipped migration; check-constraint changes need add-new-drop-old in one
migration; `storage.objects`-class platform-owned objects are never ALTERed
(T110 lesson).

## 5. Out of scope (this swarm)

B4 (FLL teams + student-coach capability model — needs its own authorization
design pass on top of SCH-01/02), B5 (mentor role), B7 (parent volunteer
slots), B8 (Impact export — lands naturally after SCH-03's combined views),
B9–B15, scouting (permanently out), any identity-model loosening (D-6), any
change to email sending mode (George-only, T052), Vercel go-live (T070).

## 6. Sequencing & process

1. **Constitution/process unchanged.** Packet format, independent checkers,
   additive-only migrations, scratch-Postgres RLS verification, Astryx-only UI,
   motivation ethics — all as-is. Task IDs continue from the ledger.
2. **Spine:** SCH-02 (seasons) → SCH-01 (membership) → SCH-04 (policies) →
   SCH-03 (views) → UXP-08 (location) → UXP-01/02 (attendance core) →
   UXP-09 (forms) → UXP-04 (lists) → UXP-05/06/10 (KPI/dashboard/feed) →
   UXP-03 (self check-off) → UXP-07 (bulk complete). Schema first; UX parity
   surfaces consume it.
3. **Reference-standard checking:** every UXD-tagged packet names the
   capability-map figure it must be compared against; checkers judge density
   and layout against it explicitly.
4. **Data caution:** George's production project now has real rows. SCH
   migrations get the full live-verification treatment (scratch Postgres with
   real DDL + backfill dry-run against a copy of production shape), and George
   applies them via `supabase db push` with the T110-style honest-risk
   briefing.

## 7. Open items for George (beyond the D-register defaults)

1. Confirm or veto D-1 … D-6.
2. UXP-08: free-text location now, or the small venues table immediately
   (five recurring venues suggests a dropdown-with-add would serve)? Default:
   free text now, venues table only when reuse pain appears.
3. Activity feed retention: default is "current season" visibility. Veto if
   you want all-time.
