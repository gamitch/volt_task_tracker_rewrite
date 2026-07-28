# Worker Packet: T127

## Task ID
T127 — UXP-07: mark whole event complete (bulk day completion).

## Objective
PRD verbatim: "One action completes every remaining session of an event
(each getting the same treatment as the existing per-day Mark Day Complete,
including people-reached entry where applicable), with a clear per-day
summary in the confirmation."

Staff-only action on `OutreachDetail` (and only there): "Mark event
complete". It opens a confirmation surface listing every REMAINING session
(not completed, not canceled) with its date/time and, where the existing
per-day flow collects people-reached, a per-day people-reached input.
Confirming applies the existing Mark-Day-Complete treatment to each listed
session. Already-completed and canceled sessions are listed as skipped in
the summary (read-only), never re-processed.

## Allowed Files
- `src/pages/outreach/OutreachDetail.tsx`, `OutreachDetail.test.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.tsx`,
  `MarkDayCompleteDialog.test.tsx` (extend, or add a sibling
  `MarkEventCompleteDialog.tsx` + test in the same directory — your call,
  document it)
- `src/lib/supabase/loaders/outreach.ts` (+ its existing test coverage)

## Forbidden Files
- `OutreachEventDialog.*`, `ScheduleMeetingsDialog.*`,
  `src/components/forms/**` (T125); `OutreachList.*`, `StudentHome.*`,
  `ParentRsvp.*`, `loaders/selfCheckoff.ts`, `supabase/**` (T126 owns the
  only outreach migration this wave); `AttendancePanel.*`,
  `loaders/attendance.ts` (T117, read-only); all meetings files;
  `docs/swarm/**`.

## Traps
1. **Reuse, don't re-derive.** Locate the existing per-day completion
   mutation (Mark Day Complete path in `loaders/outreach.ts` /
   `MarkDayCompleteDialog`) and apply THAT code path per session — same
   status write, same people-reached persistence, same payload discipline.
   A parallel "bulk" implementation with its own field list is a MAJOR.
   Batching the loop is fine; new semantics are not. Zero metric math in TS
   (constitution item 3) — completion feeds the views; you compute nothing.
2. **Partial-failure honesty.** N sequential writes can fail midway. Design
   the confirmation result to report per-day outcome honestly (done /
   failed / skipped) and leave the page state consistent (refetch or
   per-session state flip mirroring the real writes). No optimistic "all
   done" banner before the writes land.
3. **D-7 / roster interplay:** completing a day does NOT invent attendance —
   only the same writes the per-day flow already does. If the per-day flow
   prompts for people-reached only for outreach-type events, mirror that
   conditionality exactly.
4. **Small confirmation stays a dialog** (UXD-06). Astryx props verified
   against installed source or `docs/swarm/astryx-api.md`; keyboard + both
   themes (UXD-09); neutral copy (constitution item 17).
5. Three siblings mid-flight (T125 dialogs/forms; T126
   OutreachList/StudentHome/migration; T128 meetings/docs). Attribute test
   noise honestly; never `git stash`.

## Required Output
Full diff; reuse evidence (point to the exact shared code path the bulk
action drives); partial-failure design notes; per-day summary screenshot-in-
words vs the PRD sentence; gate output; risks.
