# T189 — premise gate, round 1: REVISE / BLOCKER

Gate run against `main` = `83a85e5` on packet v1. **Two BLOCKERs, two MAJORs, plus citation drift.**
Recorded because the reasoning is reusable, not just the verdict. Packet v2 folds all of it in.

## BLOCKER 2 (the important one) — v1's detection mechanism was unsound

v1 said to reuse T184's inference: `resolveStudentScope` returning `null` ⇒ inactive. The gate read
the view and found v1 had described it wrongly. `v_student_goal_projection`
(`dashboard_views.sql:322-334`) is **not** "a projection over `students` with `left join`s" — line
`:331` is **`join seasons se on se.is_active`**, an *inner* join.

**With zero active seasons the view returns no row for any student, active or not.** So
`null ⇒ inactive` is false in a state the app explicitly models: `SeasonProvider.tsx:118-121` treats
`'none'` as a real user-visible state, and `seasons_single_active_idx`
(`identity_roster.sql:53`) guarantees *at most* one active season — not at least one.

`StudentHome` is not exposed to this because `StudentHome.tsx:1791-1830` only mounts the resolved
view when `activeSeason.status === 'ready'`. **`MeetingsList.tsx` consumes no season context at
all** (zero grep hits for `useActiveSeason`/`SeasonProvider`), so that gate does not carry over.

Shipping v1 would have told **every** student their account was deactivated the moment a season
lapsed — strictly worse than the defect being fixed.

**Resolution in v2: read `students.is_active` directly.** The column exists
(`identity_roster.sql:65`), a student may read their own row (`rls.sql:100-102`), and the read has
no season coupling and no false-positive state. **The lesson: following a precedent past the point
where its preconditions hold is not consistency, it is copying.** T184's inference was sound *for
`StudentHome`*, which gates on an active season; it was never sound in general.

## BLOCKER 1 — the prescription broke five green tests, undisclosed

Measured: implementing v1 faithfully took `MeetingsList.test.tsx` from **76 passed** to
**5 failed | 71 passed**. Those five take the *resolved* path (`resolveStudentId` supplied, no
explicit `studentId`), so a newly defaulted loader prop reaches the **real** loader, which rejects
with `.env.local` absent (`loader.ts:168-175`) and lands the tier in its error state.

`DashboardPage.test.tsx:39-42` documents this exact trap verbatim, and `OutreachList.test.tsx:158-165`
records the same lesson. **This is the third repeat of a seam shape already written down twice** —
the same failure noted in RESUME-HERE after T180. One of the five is T302's own test (merged
`3fb44a7`), whose entire purpose was to make `isEmpty`'s participation clause assertable.

v1's §6 also demanded the targeted file exit `0` while silently requiring five of its tests to
break — two sections that could not both be satisfied. v2 §7 names the five call sites, authorizes
the injection as a seam addition, and requires the file pinned back to 76 before any new test.
**Gate-verified remedy: 76/76 restored, `tsc` clean.**

## MAJOR 3 — the `isEmpty` branch swallowed the fix

`isEmpty` (`:2359`) returns the "No meeting history yet" `EmptyState` at `:2365-2370` *before*
reaching the block v1 named at `:2384-2395`. A deactivated student with zero history rows would
never see the honest copy. Measured red by the gate. v2 §5 puts the branch **above** the ternary and
adds **C6** to pin it.

## MAJOR 4 — four of five criteria did not discriminate

Expressed against the real harness and run both ways: **C1 red on base, C2–C5 green on base.** They
are legitimate regression guards, but v1 claimed every criterion was falsifiable by a named
mutation while naming none for C2/C4/C5, and naming a *fixture-level* mutation for C3 that proves
nothing about the defect. v2 names a production-code mutation for each and states plainly that only
C1 discriminates against today's behaviour.

## Confirmed sound

Blast radius: `MeetingsListProps` has exactly one consumer (`router.tsx:220`, zero props passed);
`StudentMeetingsViewProps` has no consumer outside the file; the three inner components are
module-private; `loaders/students.ts`'s page imports are type-only, so no runtime cycle. Prop
injection is testable — **contra T181's loader-singleton finding**, because injection never touches
the singleton.

## Citation drift corrected in v2

`ResolveStudentScopeFn` is declared at `StudentHome.tsx:505`, not in `students.ts`; T184's copy is at
`:1692-1693`; `StudentIdentityOutcome`/`resolveStudentIdentity` at `:1560-1593`; `MeetingsListProps`
at `:2495-2516`; the explicit-`studentId` branch at `:2479-2481`; `v_student_participation` spans
`:59-81` with `where s.is_active` closing the CTE rather than the view; and `ParentHome.tsx:376`
imports **`ConsistencyStrip`**, not `StudentMeetingView` — v1 conflated the two.
