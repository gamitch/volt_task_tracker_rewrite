# Current App Capability Map — volt-timetracker.lovable.app

Surveyed live via automated browser on 2026-07-20 (public app, no login, read-only
navigation — no data was created or modified). A richer HTML companion with embedded screenshots and the full capability matrix lives at `docs/swarm/current-app-capability-map.html` (self-contained, open in any browser) — keep the two in sync. This document is the ground-truth
reference for scoping the coach-workflow parity epic in the VOLT Team Portal
rewrite. Screenshots archived in the session scratchpad; key findings inlined
here so this doc stands alone.

## Identity model (foundational difference)

The current app has **no authentication at all**. It is a public URL; anyone with
the link sees everything. Students identify via `/me` — a "Who are you?" name
picker ("That's me" buttons, honor system). A "Coach view" link returns to the
full coach UI, also ungated. Practical consequence the rewrite must respect:
**students (especially FLL-age) do not manage accounts** — any workflow that
requires a student login to record attendance will not survive contact with
reality. Also a real safety gap the rewrite fixes: children's first names, teams,
and hour totals are world-readable, including a public leaderboard of full first
names (VOLT's SEC-04 anonymization + RLS is a genuine improvement, not
gold-plating).

## Coach surfaces

### Dashboard
- KPI strip, always visible: Outreach hours (337.75, with Meetings/Competitions
  breakdown), Active students (20, per-team split), Events logged (15, most
  recent named), % toward season goal (19%, 337.75/1800h target).
- Settings gear opens an inline **Default season goal** hours editor
  ("applies to every student unless overridden in Roster").
- Second stat row: Avg hours per active student (16.89h), Students at goal
  (0 of 10 contributing), Session days logged (28, completed only), Attendance
  rate (14% of active roster per session), Upcoming commitment (19h planned next
  30 days), Busiest day (Sat, by offered hours).
- **Next up** (3 upcoming sessions).
- **Recent signup activity feed**: "<Student> signed up for / dropped <event>"
  with dates, relative timestamps, and a `Self` badge when the student did it
  themselves via `/me`. "Show all 66."
- **Hours by team** bars (Gear Girls 201.50h, P3 136.25h).
- **Leaderboard top 10**: full first name + team chip + hours + % of goal.
- **Goal projection per student**: stacked confirmed+planned bars against the
  90h goal line, with "156% · On track" / "18h short" annotations; All /
  Below-goal filter.
- **Top events by student hours**.

### Events tab
- Category filter (All / Outreach / Meetings / Competitions); Upcoming + Past.
- **Dense rows**: date range + weekday-occurrence chips ("MON (18) · THU (18)"),
  title + category badge, location, PLANNED/LOGGED hours + "offered" hours,
  EXPECTED/ATTENDED student counts, Reached count, inline **EDIT** and **×
  delete** buttons, and a **"+" expander** that opens per-session detail in
  place (date, time, hours, RSVP names, reached) without leaving the list.

### Upcoming Events tab
- Action-focused cards per session: **Edit / RSVP**, **Mark day complete**,
  **Mark whole event complete**; expected count + planned hours; RSVP'd student
  names grouped by team chips.

### New event form (single well-spaced page)
- Name, location, category buttons, start/end times with computed duration
  badge.
- Schedule modes: **Single/multi-day** (with multi-day checkbox), **Recurring**
  (weekday-pattern series — generates e.g. 18 Mondays + 18 Thursdays), **Custom
  dates**.
- Per-day **People reached** inputs; Notes; **Adult volunteers** count.
- **Expected attendees**: full-roster checklist grouped by team chips, All/Clear
  shortcuts. Future-dated events: checked students are recorded as planned
  (RSVP); "hours won't count toward goals until you Mark complete."

### Edit event dialog
- Name/category/notes/adult volunteers/location; status badge (Planned).
- **Days & attendance**, per day: date, start/end, hours, people reached,
  **Remove day**, and an **Attendance checklist with a per-student hours
  field** — the coach checks who attended and can adjust each student's hours
  individually. This is the workflow heart of the whole app.

### Data tab
- Download events CSV; download roster CSV. (VOLT's Reports already has CSV
  export machinery — parity here is small.)

### Roster tab
- Not captured in the automated survey (tab switch no-ops in headless); known
  from references elsewhere: student list with team assignment, active flag, and
  per-student goal override; add-student via header icon.

## Student surface (`/me`)

- "SIGNED IN AS <name>" after the honor-system picker; Team + **My hours** (48,
  across 9 events, 76h planned).
- **"Check off the events you volunteered at"**: a card grid of all events; tap
  a card to self-report attendance (default hours applied); multi-day events
  open a day-picker panel ("6 of 6 days · 19.50h") with shortcuts like
  "Upcoming only"; per-event "My hours" shown on each card.
- My profile link. Self-actions surface in the coach dashboard's activity feed
  with the `Self` badge.

## Model comparison vs. VOLT portal

Current app: coach-records-attendance + student self-reports (both honor-system,
both retroactive-friendly). VOLT today: student/parent RSVP (authenticated) +
live QR/short-code check-in, with no coach-side "add student to event" UI (the
RLS has always permitted staff writes via `staff_all` — T114 corrected this
doc's earlier claim) and no retroactive self-report.

## Capability gaps in VOLT (ranked, from George's live testing + this survey)

1. **Coach-managed attendance with per-student hours** (edit-dialog parity) —
   pure UI work: T114 (PRD v2) proved staff writes on `rsvps`/`attendance` have
   existed since v1 (`staff_all`); the earlier "needs a policy decision" note
   here was wrong.
2. **Expected-attendees at event creation** (coach pre-marks planned RSVPs).
3. **Dense event rows + expand-in-place + inline Edit/× on lists.**
4. **Dashboard analytics parity**: per-student goal projection, signup activity
   feed, avg-hours/attendance-rate/busiest-day tiles, hours-by-team, top events.
5. **"Mark whole event complete"** bulk action (VOLT has per-day only).
6. **Retroactive attendance path usable by young students** (the current app's
   check-off flow; VOLT's live-QR-only model assumes real-time check-in).
7. **Persistent KPI strip** across coach pages.
8. **Create-form spacing** (dialog is cramped vs. the current app's page).

## What VOLT already has that the current app lacks entirely

Real auth + roles + RLS (minors' data no longer world-readable), parent accounts
with linked students, anonymized-by-default leaderboard, rotating HMAC QR
check-in + kiosk, email invites/reminders, ICS calendar feeds, calendar UI,
meetings/consistency tracking, audit log, per-role dashboards, season
management, reports with CSV export.
