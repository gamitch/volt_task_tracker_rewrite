# Worker Packet: T114

## Task ID
T114 — PRD v2 SCH-04: staff write policies on `rsvps` and `attendance` (the RLS
enabler for coach-managed attendance, UXP-01/02).

## Objective
Today a coach literally cannot add a student to an event: `rsvps` allows only
own/linked writes (`own_or_linked_write`/`own_or_linked_update`), and
`attendance` deliberately has **no client write policy at all** (v1 posture:
"student self-check-ins happen only inside the `checkin` Edge Function under
the service role"). PRD v2 §3 SCH-04 **consciously amends that posture**: staff
(`is_staff()` = admin or coach) gain full insert/update/delete on both tables,
alongside the existing policies, which remain untouched and continue to power
student/parent RSVP and the Edge Function path. Migration + verification only —
the UI that uses these policies is UXP-01/02, later packets.

## Allowed Files
- `supabase/migrations/20260721000001_staff_attendance_rsvps.sql` (new — use
  exactly this filename; timestamp chosen to avoid colliding with sibling task
  T113's migration)

## Forbidden Files
- Every existing migration and `supabase/functions/**` (read-only).
- All of `src/**`. Everything else. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Read the real current policies first** (`20260717000002_rls.sql`): quote
them in your report. Add-only: new `create policy` statements (e.g.
`staff_write on rsvps for insert/update/delete to authenticated using/with
check (is_staff())` — or a single `for all` policy if you verify it composes
correctly with the existing own/linked policies; Postgres policies are
permissive-OR by default, verify and state this explicitly). Do not modify or
drop any existing policy.

**2. `attendance` extras.** Verify column-level realities a staff UI will rely
on: `hours_override` exists (the metric views already honor it), and
`recorded_by`/`method` columns — your report must state (from the real DDL)
what a staff-written attendance row should carry so UXP-01's packet can cite
it (e.g. `method` value for coach entry — check the check-constraint's allowed
values; if `'manual'`/`'coach'` isn't among them, DO NOT alter the shipped
constraint in this task — flag it in your report as a follow-up decision with
the add-new-drop-old pattern from the backlog §2, and scope your policies to
work with the existing values).

**3. Scratch-Postgres verification with NEGATIVE tests (the point of this
task).** Using the T104/T105 harness precedent: as a coach session — insert an
RSVP for an unrelated student (succeeds), update/delete it (succeeds), insert
an attendance row with `hours_override` (succeeds); as a student session —
write another student's RSVP (RLS-denied), write ANY attendance row (still
denied — this task adds no student attendance writes; UXP-03's own-write
policy is a separate later migration per PRD §3); as a parent session — write
an unlinked student's RSVP (denied), linked student's RSVP (still allowed,
pre-existing policy intact). Include the transcript.

**4. Cite PRD v2 §3 SCH-04 in the migration's header comment** as the
authority consciously amending v1's no-client-writes posture on `attendance`,
so a future reader doesn't "fix" it back.

**5. Gates.** SQL-only change: `npm run typecheck/lint/test/build/format:check`
all clean, zero `src/**` diffs.

## Acceptance Criteria
- Additive-only policies; every pre-existing policy byte-untouched.
- All positive AND negative session tests pass in scratch Postgres.
- `attendance` column realities documented for UXP-01 (Trap #2), including the
  `method` check-constraint finding.
- All gates clean.

## Relevant Constitution Excerpts
> Item 10: additive-only migrations. RLS changes are BLOCKER-class review
> territory; checker must verify with a real scratch-Postgres harness.

## Most Recent Failure
None. Attempt 1 (attempt count: 0).

## Required Worker Output
- Full migration SQL; quoted before/after policy inventory for both tables.
- Full positive+negative scratch-Postgres transcript.
- The Trap #2 column/constraint findings.
- Full gate output. Known risks; dispute flag if needed.
