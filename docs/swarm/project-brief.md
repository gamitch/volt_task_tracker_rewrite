# Project Brief

## Project Name
VOLT Team Portal (rewrite of volt-timetracker)

## Mission
A private, role-aware portal for VOLT (FRC Team 11195) that separates meeting attendance (participation %) from outreach attendance (volunteer hours toward season goals), makes check-in dead simple via rotating QR codes with coach override, and keeps students and parents informed through email reminders and a subscribable calendar feed. Full requirements: `VOLT_Portal_PRD.md` (requirement IDs are authoritative).

## Key Users
- Admin/head coach (desktop, technical): runs everything.
- Coaches/mentors (desktop + phone, semi-technical): schedule events, run check-in, read reports.
- Students 13–18 (phone, non-technical): check in, sign up for outreach, watch their own hours.
- Parents (phone + email, non-technical): see linked kids' events, attendance, and progress.

## Core Features
1. Supabase Auth (email/password + Google), closed roster, coach-sent invites, parent↔student linking (PRD AUTH, ROS).
2. Meetings module: recurring scheduling, live check-in console, rotating QR/6-char code, coach roll-call override, participation % (PRD MTG, MET-01/02).
3. Outreach module: events with multi-day sessions, student RSVPs, coach mark-day-complete, hours toward goals, leaderboard (PRD OUT, MET-03/04).
4. Calendar page + personal read-only ICS feed for Google Calendar (PRD CAL).
5. Email reminders and weekly parent digest via Resend + pg_cron (PRD EML).
6. Roster/teams/seasons management, reports with CSV export (PRD ROS, RPT, SET).
7. Full data migration from the existing Lovable Cloud app (source: github.com/gamitch/volt-timetracker; normative mapping in PRD Section 10.2).

## Out of Scope
Band-style posts/albums/files/chat, push notifications, two-way Google Calendar sync, payments, Facebook login, outreach QR check-in — all deferred per PRD Sections 12 and D-decisions.

## Success Criteria
The ten v1 acceptance criteria in PRD Section 14, including the four persona smoke tests (P-COACH, P-STUDENT, P-COACH2, P-PARENT) passing on production build in both color modes, and migration validation gates (MIG-04) signed off by George.

## Key Constraints
- Stack locked: Vite + React 18 + TypeScript strict SPA, Supabase backend (new project), Astryx design system with custom `volt` theme extending neutral; no Tailwind/shadcn (PRD D1–D3).
- UI vocabulary is Astryx only; workers consult `npm run astryx -- component <Name>` before using any component (PRD DES-18…21).
- RLS default-deny on every table; metric formulas exist only in SQL views (PRD Section 8, DATA-01).
- All students are minors: no public pages, contact info restricted to admin/coach, leaderboard shows "First L." by default (PRD SEC-01…04).
- Timezone display America/Chicago; storage UTC.
- Constitution additions listed in PRD Section 13 must be adopted verbatim.
