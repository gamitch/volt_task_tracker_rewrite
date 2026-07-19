# Worker Packet: T043

## Task ID
T043

## Objective
Build `src/pages/outreach/ParentRsvp.tsx` — parent RSVP-on-behalf (OUT-06): a parent sets their
linked student's RSVP (`responded_by='parent'`); the student sees "Mom signed you up"
(`Timestamp` + responder name) and may change it themselves afterward.

## Dependencies (status)
- T038 (`/outreach` list) — Passed. Read `OutreachList.tsx` (read-only) for established
  `rsvps`/`guardian_links` fixture conventions.
- T040 (RSVP control) — **listed as this task's ledger dependency; may or may not be Passed by the
  time you're dispatched.** If Passed, **read `RsvpControl.tsx` in full (read-only)** — this task is
  structurally the parent-facing counterpart of that student-facing control (same
  `SegmentedControl`/status-mapping shape, different `responded_by` value and different
  responder-attribution display). Reuse its established `RsvpRow` shape and status-label mapping
  (`'declined'` ↔ "Can't go") rather than inventing a divergent one. If T040 hasn't Passed yet, build
  against `OutreachList.tsx`'s existing shapes and disclose that you did so.

## Allowed Files
- `src/pages/outreach/ParentRsvp.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `ParentRsvp.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/outreach/OutreachList.tsx`, `RsvpControl.tsx`, `OutreachEventDialog.tsx`,
  `OutreachDetail.tsx` — already-Passed/sibling tasks' files, read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `onRsvpChange`-style callback seam with an obviously-fake default.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`rsvps`: `id`, `session_id`, `student_id`, `status` (`'going'|'maybe'|'declined'`), `responded_by`,
`updated_at` — `20260717000000_scheduling_attendance.sql` lines 67-76. `guardian_links`:
`parent_profile_id`, `student_id`, `relationship` — `20260716000000_identity_roster.sql` lines
71-79.

## Known Context / Traps

**1. `responded_by` values — this is the crux of the whole task.** The `rsvps.responded_by` column
is a plain reference/enum-shaped value (confirm its real type yourself — likely a role-shaped
string or a profile-id FK; read the migration line directly and cite the exact type). Your component
must correctly write `responded_by='parent'` when the parent sets/changes an RSVP, and must
correctly render the "Mom signed you up" attribution when displaying a row where
`responded_by='parent'` — but the actual *display name* ("Mom") is NOT literally stored anywhere;
it's derived from the `guardian_links.relationship` field (e.g. "Mom", "Dad", "Guardian") for the
specific parent who set it. If `responded_by` alone doesn't carry which specific parent (in a
multi-parent-per-student scenario), investigate and disclose how you determine which parent's
`relationship` label to show — do not fabricate a specific parent identity you can't actually derive
from the stored data.

**2. Student can override a parent-set RSVP.** This component renders the parent-facing view where a
parent sets/changes their student's RSVP; the acceptance criterion "student can override" refers to
the STUDENT-facing control (T040's `RsvpControl.tsx`, a separate file) correctly allowing a change
regardless of who set the RSVP last — you don't rebuild that here, but your own component's write
path must not somehow lock out a subsequent student-initiated change (e.g. don't add any
parent-only "locking" mechanism not called for by OUT-06's text).

**3. `Timestamp` + responder attribution rendering** — this is a **read-side display concern** this
component should also handle when showing the *current* RSVP state for a session (not just the
write control): if `responded_by='parent'`, show the relationship-labeled attribution + a real
`Timestamp` (from `rsvps.updated_at`); if `responded_by='student'` (or however the student's own
value is represented), show a plain/no-attribution display. Prove both render paths with real tests.

**4. Multiple linked students** — same structural requirement `ParentHome.tsx`/T055 and
`StudentMeetingView.tsx`/T037's parent variant already established: a parent may have more than one
linked student. Decide whether this component is scoped to one student-at-a-time (a reusable
per-student control, likely correct given its narrow Allowed-Files scope) or must itself handle
multiple — state your reasoning; the more likely-correct reading is a single-student-scoped
reusable component that a future page (`ParentHome.tsx`, `OutreachDetail.tsx`) renders once per
linked student.

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Parent can set/change a linked student's RSVP, correctly writing `responded_by='parent'`.
- "Mom signed you up" (or the correct relationship label) + `Timestamp` attribution renders
  correctly when `responded_by='parent'`, with real test proof.
- The specific-parent-identity question (Known Context/Traps #1) explicitly investigated and
  disclosed, not silently fabricated.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T043 (attempt count: 0).

## Required Worker Output
- Full contents of `ParentRsvp.tsx`.
- Explicit write-up of the `responded_by`-to-specific-parent-identity resolution.
- Real test proof of the attribution display (both `responded_by='parent'` and non-parent cases).
- Explicit write-up of the single-vs-multi-student scoping decision.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
