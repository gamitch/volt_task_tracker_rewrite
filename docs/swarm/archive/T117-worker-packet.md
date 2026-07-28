# Worker Packet: T117

## Task ID
T117 — PRD v2 UXP-01: coach-managed attendance with per-student hours (the
edit-dialog-parity core, pure frontend — T114 proved the RLS already permits
staff writes).

## Objective
From an outreach event's detail page, a coach can, per session day: see the
roster (scoped to the event's `team_ids`, grouped by team chips), toggle each
student's attendance, and set a per-student hours override. The reference
standard is the capability map's "Edit event dialog" figure
(`docs/swarm/current-app-capability-map.html`) — per-day attendance checklist
with an hours field per attending student and a running total. UXD-06 applies:
this is a spacious page-level panel/section on the detail page, not a cramped
modal.

## Allowed Files
- `src/lib/supabase/loaders/attendance.ts` (new)
- `src/pages/outreach/AttendancePanel.tsx`, `AttendancePanel.test.tsx` (new)
- `src/pages/outreach/OutreachDetail.tsx`, `OutreachDetail.test.tsx` (wiring)

## Forbidden Files
- `src/pages/outreach/OutreachEventDialog.tsx`, `src/lib/supabase/loaders/outreach.ts`
  — sibling task T118 is editing BOTH concurrently; read-only imports, expect
  mid-flight noise in their tests and attribute honestly.
- `supabase/**` (T116 is adding a views migration concurrently). `loaders/students.ts`
  read-only import. Everything else.

## Known Context / Traps
**1. Banked DDL facts (T114, verified):** `attendance` has
`unique (session_id, student_id)`; `status in
('present','late','excused','absent')`; `method in ('qr','coach','import')` —
write `'coach'`; `hours_override numeric` nullable; `recorded_by` nullable FK
→ set to the acting staff's own id; `check_in_at`/`check_out_at` may stay
null (the `v_student_hours` coalesce then uses `hours_override`, else full
session duration). Upsert `onConflict: 'session_id,student_id'`. Staff writes
work under the existing `staff_all` policy — no new RLS.
**2. Un-mark semantics.** Unchecking an attended student: investigate whether
to DELETE the row or set `status='absent'` — prefer DELETE for a coach
correcting a mistake (matches the reference app's checkbox model), but check
what the metric views/`checkin` Edge Function assume about absent rows and
document the choice. A QR-originated row (`method='qr'`) being edited by a
coach: preserve honest history where cheap (e.g. keep `check_in_at`, update
`hours_override`/`status`, set `recorded_by` to the coach) — document.
**3. Roster source.** Event's `team_ids` (null = all teams) → active students
grouped by team chips. Reuse patterns/types from `loaders/students.ts`
(read-only import) or query directly in the new loader — investigate which is
cleaner; do not duplicate mapping logic that already exists exportable.
**4. Per-day model.** `OutreachDetail` already loads the event's sessions
(T101). The panel renders per-session (day) sections with the roster
checklist + hours inputs + a running per-day and event-total hours indicator
(reference: "48h total"). Persist per student on toggle/blur or via an
explicit save — pick one, justify against BEH/DES rules (no silent data
loss; honest pending/error states per DES-12; optimistic-with-rollback
precedent from T101 is fine).
**5. Coach/admin only.** Render the panel only for staff viewers (same
role-derivation `OutreachDetail` already uses). Non-staff see the page
unchanged.
**6. Tests.** Seam-injected as always: stubbed `SupabaseClient` loader tests
(assert exact upsert payloads incl. `method:'coach'`, `recorded_by`,
`onConflict`) + component tests for checklist render/toggle/hours-edit/
role-gating. UXD-09: keyboard/a11y hold; every Astryx prop verified per
constitution item 2.

## Acceptance Criteria
Staff can record/adjust/remove per-student attendance with hours per session
from `OutreachDetail`; running totals shown; non-staff unaffected; all five
gates clean, zero regressions (sibling noise attributed honestly).

## Most Recent Failure
None. Attempt 1.

## Required Worker Output
Full diff; Trap #2 semantics decision; full gate output; risks/dispute flag.
