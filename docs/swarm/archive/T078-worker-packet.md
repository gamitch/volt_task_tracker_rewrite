# Worker Packet: T078

## Task ID
T078 — Update 3 pre-existing test files' stale `RequireRole`-denial assertions (fallout from T076),
Epic E3.

## Objective
T076 (Passed) correctly fixed `RequireRole`'s role-mismatch case to render the new
`AccessDeniedPage` instead of `NoAccessPage`. T076's own Allowed Files did not include three
pre-existing test files, each written by an earlier task, before this behavior change — each has
one or two assertions checking for `NoAccessPage`'s specific old copy ("You're not on the roster
yet.") in a scenario that is now legitimately a role-mismatch, not a no-profile case. These 4
assertions are now stale, not indicative of a real defect — this task updates them to match the
corrected, intentional behavior.

Confirmed failing exactly as described (`npm run test`, current `HEAD`):
- `src/pages/meetings/LiveConsole.test.tsx:539` — `'renders NoAccessPage for a non-coach/admin
  role, not a redirect'`, assertion at line 543.
- `src/pages/roster/ParentsTab.test.tsx:485` — `'renders NoAccessPage for a non-coach/admin role,
  not a redirect'`, assertion at line 489.
- `src/pages/settings/SeasonSettings.test.tsx:392` — `'renders NoAccessPage for an unauthenticated
  viewer, not a redirect'`, assertion at line 396.
- `src/pages/settings/SeasonSettings.test.tsx:400` — `'renders NoAccessPage for a non-admin (coach)
  viewer, not a redirect'`, assertion at line 404.

## Allowed Files
- `src/pages/meetings/LiveConsole.test.tsx`
- `src/pages/roster/ParentsTab.test.tsx`
- `src/pages/settings/SeasonSettings.test.tsx`

## Forbidden Files
- `src/app/guards.tsx`, `src/pages/no-access/AccessDeniedPage.tsx`, `NoAccessPage.tsx` — all
  already correct (T076, Passed), read-only reference.
- Every non-test page component file.
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. This is a pure test-assertion update, not a behavior change.** `RequireRole`'s actual behavior
is already correct (T076, Passed) — these tests are simply asserting the OLD expected text. Update
each assertion to check for `AccessDeniedPage`'s real copy instead
(`src/pages/no-access/AccessDeniedPage.tsx`, read-only reference — read it for the exact current
title/description text rather than guessing). Also consider renaming each `it(...)` description
string from `'renders NoAccessPage for ...'` to something accurate (e.g. `'renders AccessDeniedPage
for ...'`) — the test names are documentation too, don't leave them lying about what they verify.

**2. `SeasonSettings.test.tsx`'s "unauthenticated viewer" test (line 392) needs a closer look, not
a blind copy-paste of the other three.** Read the surrounding test code first: this specific test
appears to exercise `RequireRole` in isolation (without a wrapping `RequireAuth`) to check its
defensive fallback for the `!user` case (per `RequireRole`'s own module doc in `guards.tsx`: "it
still degrades safely... if used standalone with no authenticated user"). `AccessDeniedPage`'s real
copy states "You're signed in and your account is fine" — which is **factually inaccurate** for a
genuinely unauthenticated visitor (there is no session at all in that case). This is a real, if
low-impact, gap: `RequireRole` is always nested inside `RequireAuth` in the actual running app, so
this exact standalone scenario never occurs in production — but the test still exercises it
directly. **Do not silently update this one assertion to expect technically-wrong copy without
comment.** Options, your judgment: (a) update the assertion to match `AccessDeniedPage`'s real
copy anyway, with an explicit code comment disclosing that the copy is imprecise for this specific
standalone-only edge case and citing why it's low-impact (never reachable in the real app); or (b)
if you find a cleaner characterization while reading the actual test, describe it in your output
instead of guessing. Either way, this exact tension must be disclosed in your Required Worker
Output, not silently smoothed over.

**3. Do not touch any other test in these 3 files.** Each file has many other passing tests
unrelated to this change — leave them untouched.

## Acceptance Criteria
- All 4 stale assertions updated to match `AccessDeniedPage`'s real, current copy.
- The `SeasonSettings.test.tsx` "unauthenticated viewer" case's copy-accuracy tension (Known Context
  #2) is explicitly addressed and disclosed, not silently papered over.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean — full repo-wide test suite green (910/910), zero remaining failures.
- No other test or file touched.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T078 (attempt count: 0) — first dispatch.

## Context Note
This gap exists because the orchestrator's original T076 packet did not anticipate that other
already-Passed tasks' own test suites had assertions coupled to `RequireRole`'s specific old
denial-screen copy — both T076's and T077's own workers independently noticed and correctly did not
touch these files (outside their Allowed Files), flagging it for a follow-up. This task is that
follow-up.

## Required Worker Output
- Full diff of all 3 files.
- Your resolution of the `SeasonSettings.test.tsx` "unauthenticated viewer" copy-accuracy tension
  (Known Context #2) and your reasoning.
- Full test/typecheck/lint/build output, confirming 910/910 passing with zero failures anywhere.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
