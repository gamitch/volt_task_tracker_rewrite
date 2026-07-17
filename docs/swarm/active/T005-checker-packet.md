# Checker Packet: T005 (Rework Re-check — Attempt 2)

## Task ID
T005 — Router skeleton + route guards + deep-link redirect

## Checker Agent
checker-reviewer

## Attempt
Check attempt 2 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").
Attempt 1 result: FAIL — BLOCKER-class (K1: `/kiosk/:sessionId` left unguarded). Full detail in
`docs/swarm/active/T005-latest-failure.md`.

## What This Re-check Covers
This is a **targeted re-check of a targeted fix**, not a full task redo. Attempt 1 already verified
correct and NOT to be re-litigated: all 13 PRD Section 7 routes present as stubs; `RequireAuth`/
`RequireRole` guard logic sound; NAV-08 intended-URL round-trip (both `login()` and
`loginWithGoogle()` paths); `main.tsx`/`App.tsx` correctly unwired; build/typecheck/lint clean;
`react-router-dom@7.18.1` the only new dependency, no `--legacy-peer-deps`. Do not re-test any of
that from scratch — only verify the two required fixes below, plus confirm nothing else regressed.

## Worker's Claimed Changes (do not trust — verify independently)
1. `guards.tsx`: added exactly `'coach'` to the `Role` union (now `'admin' | 'staff' | 'volunteer' |
   'coach'`), plus a doc-comment note. Claims nothing else in `guards.tsx` was touched — `RequireRole`'s
   toast-during-render pattern (K3) deliberately left as-is.
2. `router.tsx`: `/kiosk/:sessionId` now wrapped in `RequireAuth` + `RequireRole(allowedRoles=
   ['coach','admin'])`, same nesting pattern as `/settings`. Module doc comment corrected to cite the
   actual PRD Section 7 row and SEC-04 text instead of the previous incorrect "PRD is silent" claim.
3. Claims no other routes/guard logic/NAV-08 mechanism touched; `main.tsx`/`App.tsx` still unwired
   (empty diff); `package.json`/`package-lock.json` unchanged (no new dependency).
4. Claims build/typecheck/lint all still pass, lint showing the same 8 pre-existing non-blocking
   `react-refresh/only-export-components` warnings as before (no new warnings/errors).

## Required Verification Steps
1. **Read the files directly.** Open the current `src/app/router.tsx` and `src/app/guards.tsx` in
   full. Confirm the kiosk route is genuinely wrapped in `RequireAuth` + `RequireRole(['coach',
   'admin'])` in the actual JSX tree — not merely claimed in a comment.
2. **`Role` union diff check.** Confirm `Role` now includes `'coach'` and that this is the *only*
   substantive change to `guards.tsx` (union line + a comment). `RequireRole`'s actual logic (the
   `pushToast`-during-render call, K3) must be byte-identical to before — confirm this explicitly,
   do not just skim.
3. **Independent kiosk-route test.** Write a throwaway test (same technique as attempt 1:
   `createRoot`/jsdom/`MemoryRouter`/`AuthProvider`) mounting a route tree with `/kiosk/:id` guarded
   as claimed. At minimum assert:
   - (a) unauthenticated → redirects to `/login`, intended URL stored via `setIntendedUrl`/
     `getIntendedUrl` (full `pathname+search+hash`).
   - (b) authenticated as `'staff'` or `'volunteer'` → redirects to `/` and `pushToast` fires with
     exactly `"You don't have access to that page."`.
   - (c) authenticated as `'coach'` or `'admin'` → renders through to the kiosk page content.
   Delete the throwaway test file before finishing your check (do not leave scratch files in the tree).
4. **Regression check.** Confirm all 13 PRD Section 7 routes are still present (route list: `/login`,
   `/accept-invite`, `/`, `/meetings`, `/meetings/live/:sessionId`, `/kiosk/:sessionId`, `/checkin`,
   `/outreach`, `/outreach/:eventId`, `/calendar`, `/roster`, `/reports`, `/settings`). Confirm
   `src/main.tsx`/`src/App.tsx` still do not import from or wire in the router/guards (T006's job).
   Run `npm run build`, `npm run typecheck`, `npm run lint` yourself and quote real output — confirm
   0 errors. Pre-existing `react-refresh/only-export-components` warnings are expected/non-blocking;
   only flag lint output if a *new* warning category or any error appears.
5. **Forbidden-file check (D001 standing rule).** Do not use git commit history/diffs as evidence of
   authorship. Instead compare this task's Allowed Files (`src/app/router.tsx`, `src/app/guards.tsx`,
   `package.json`, `package-lock.json`) against the current file tree directly — confirm `src/app/`
   contains only these two files, no scratch/leftover files, and no changes under `src/theme/**`,
   `docs/swarm/**`, `.claude/**`.

## Known Context / Non-Issues (do not re-flag, do not fail the task over these)
- **K2 (Role union completeness):** minimally satisfied by `'coach'` existing in the union. Full
  reconciliation against the PRD's complete role vocabulary (admin/coach/student/parent, per AUTH-05)
  is explicitly deferred, not required this attempt.
- **K3 (`pushToast` called during render in `RequireRole`):** explicitly deferred to T006 per the
  attempt-1 failure doc. It must remain untouched in this attempt — do not fail the task if it's
  still present, and do not fail the task if the worker left it alone.
- Do not re-run or re-litigate anything already verified correct in attempt 1 (see "What This
  Re-check Covers" above) — this re-check is scoped to K1's fix plus a regression sweep only.

## Most Recent Failure
Attempt 1 — FAIL, BLOCKER-class. `/kiosk/:sessionId` stubbed as a fully public, unguarded route with
a doc comment incorrectly claiming the PRD is silent on kiosk auth. PRD Section 7's route table
assigns `/kiosk/:sessionId` to coach/admin; SEC-04 requires no public pages; constitution flags
SEC-04/kiosk surfaces as BLOCKER-class. Full text: `docs/swarm/active/T005-latest-failure.md`.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected (quote the actual current kiosk-route JSX block and the `Role` union line)
- exact commands run + real quoted output (not summarized/paraphrased)
- your own throwaway test's code and output (before you delete it)
- pass/fail per verification step above
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Inspect the actual files and generate your own independent
evidence via testing and command runs.
