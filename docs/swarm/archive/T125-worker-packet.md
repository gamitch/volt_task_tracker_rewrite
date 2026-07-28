# Worker Packet: T125

## Task ID
T125 — UXP-09: event create/edit form re-layout per UXD-06.

## Objective
Reference figures (binding): capability map "New event form" and "Edit event
dialog". Both `OutreachEventDialog` and `ScheduleMeetingsDialog` currently
present as cramped modals; UXD-06 requires page-like layouts (full-height
panel or routed page) with labeled sections and room to breathe for any flow
with more than ~6 fields.

ARCHITECT DECISION (supersedes the PRD's "prefer one shared editor page"
note): do NOT retire or merge the dialogs. Re-layout each into a full-height
sectioned panel, extracting shared layout primitives (e.g.
`src/components/forms/EventFormLayout.tsx` + section/row components — naming
yours) consumed by both. Rationale: `OutreachEventDialog` carries
checker-verified T101 session reconciliation and T118/T119 RSVP-plan logic;
a unification rewrite risks regressing it for zero functional gain (§8
simplicity). The shared primitives ARE the convergence step; a future wave
can fold both onto one editor if George asks.

Sections to establish (adapt to each dialog's real fields): Basics
(title/type/badge), Schedule (dates/times/recurrence or per-day rows),
Location, Teams & attendees (the UXP-02 roster checklist gets a full-width
labeled section — it is the worst-crowded region today), Hours/goal fields.
Small confirmations stay dialogs — only these two editors re-lay.

## Allowed Files
- `src/pages/outreach/OutreachEventDialog.tsx`, `OutreachEventDialog.test.tsx`
- `src/pages/meetings/ScheduleMeetingsDialog.tsx`, `ScheduleMeetingsDialog.test.tsx`
- `src/components/forms/**` (new)

## Forbidden Files
- ALL host pages (`OutreachList`, `OutreachDetail`, `MeetingsList`,
  `AttendancePanel`, `MarkDayCompleteDialog`, homes) — the dialogs' props
  contracts MUST NOT change, so hosts need zero edits. If you believe a prop
  change is unavoidable, STOP and flag; do not touch a host.
- `src/lib/supabase/loaders/**` (layout task — zero data-layer changes),
  `supabase/**`, `docs/swarm/**`.

## Traps
1. **Logic preservation is the acceptance bar.** Mutation handlers, the
   T101 reconciliation, `computeExpectedAttendeeRsvpPlan` usage, payload
   discipline, and `initialEvent`/`expectedStudentIds` prefill behavior must
   be functionally byte-equivalent. The checker will diff handler code paths
   and re-run the T118/T119 plan tests; any weakened logic assertion in the
   test files is a MAJOR. Structural/layout test queries may be updated;
   logic tests may not be diluted.
2. **Astryx-only.** Investigate what the installed `@astryxdesign/core`
   Dialog actually offers (size/full-height/sheet variants) against installed
   source or `docs/swarm/astryx-api.md` — do not invent props. If no
   full-height variant exists, compose the page-like layout inside the
   largest legitimate container and document honestly.
3. **A11y (UXD-09):** focus trap intact, labeled sections are real
   headings/fieldsets, keyboard order follows the visual order, both themes.
4. **Three siblings mid-flight** (T126: OutreachList/StudentHome/new loader +
   migration; T127: OutreachDetail/MarkDayCompleteDialog/loaders/outreach.ts;
   T128: meetings list labels/docs) — your files are disjoint from theirs;
   attribute any test noise honestly; never `git stash`.

## Required Output
Full diff; figure comparison per dialog (honest); Astryx variant
investigation notes; proof logic tests unweakened (list every test you
touched and why); gate output; risks.
