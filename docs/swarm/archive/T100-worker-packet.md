# Worker Packet: T100

## Task ID
T100 — ED-1 Packet P9: real student check-in path (`StudentMeetingView.tsx` +
`CheckinResult.tsx`).

## Objective
Wire the student/parent-facing consistency-strip view and the check-in-result page to
real Supabase data. Unlike most ED-1 packets so far, this one is NOT about finding a
hidden dialog-wiring gap — both components already correctly call their own seams, they
just default to fixtures.

## Allowed Files
- `src/lib/supabase/loaders/checkin.ts` (new)
- `src/pages/meetings/StudentMeetingView.tsx`, `StudentMeetingView.test.tsx`
- `src/pages/checkin/CheckinResult.tsx`, `CheckinResult.test.tsx`

## Forbidden Files
- `src/lib/supabase/loaders/meetings.ts` — already correct (T096), read-only import
  (you will reuse one of its exports — see Trap #1).
- `supabase/functions/checkin/**` — the check-in Edge Function itself is out of scope;
  `CheckinResult`'s `checkin` prop already correctly defaults to the real `callCheckin`
  function that calls it (verify this is genuinely already wired, don't touch it either
  way).
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. `StudentMeetingView`'s `studentId` placeholder — reuse T096's real resolver, don't
reimplement it.** `StudentMeetingViewProps.studentId` defaults to
`PLACEHOLDER_CONSISTENCY_STUDENT_ID` (same disclosed-gap class `MeetingsList.tsx` had
before T096). T096 already built and Passed `resolveCurrentStudentId` in
`src/lib/supabase/loaders/meetings.ts` — a generic student/parent "which student is
this session's own" resolver, not meetings-specific in its actual logic. Import and
reuse it directly here rather than writing a second implementation. Wire it the same way
T096 wired it into `MeetingsList` (an injectable prop, only invoked when the caller
doesn't supply an explicit `studentId`, preserving every existing fixture-driven
test/caller unchanged).

**2. Real load — two seams.** `LoadConsistencyStripDataFn = (studentId: string) =>
Promise<ConsistencyStripData>` (real query: last-5-completed sessions' attendance
status for that student, plus their `VStudentParticipationRow`-derived metric — read
`ConsistencyStripData`'s exact shape in the file). `LoadLinkedStudentsFn = () =>
Promise<LinkedStudentSummary[]>` (for the `variant === 'linked'` parent view — real
`guardian_links` query joined to `students`, matching the shape
`ParentHome.tsx`/T096's own parent-resolution precedent already established, though
this one returns the full list, not just the first).

**3. `CheckinResult`'s `getAccessToken` — approved seam-type widening.** Currently
`() => string | null` (synchronous), defaulting to a stub that always returns `null`
(module doc gap #1, already disclosed as needing real wiring). Real session tokens are
retrieved asynchronously (`client.auth.getSession()`). Widen the type to `() =>
Promise<string | null>` and make the default implementation call the real Supabase
client's session getter. This is a pre-approved signature change (not a design decision
you need to re-litigate) — update every call site in the file to `await` it.

**4. Do not touch `checkin`'s own call mechanics.** `CheckinResultProps.checkin`
already defaults to the real `callCheckin` (verify this yourself, don't assume) — your
job is only the token it's given, not how the call itself works.

**5. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet, applied to both files.

## Acceptance Criteria
- `StudentMeetingView`'s both load seams are real; `studentId` resolves via T096's
  reused resolver, not a second implementation.
- `CheckinResult`'s `getAccessToken` is real and async, matching the pre-approved
  signature widening.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T100 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Confirmation of how you reused T096's `resolveCurrentStudentId` (import path, wiring).
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
