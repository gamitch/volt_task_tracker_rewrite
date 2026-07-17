# T005 — Latest Check Failure (Attempt 1)

Checker: checker-reviewer
Result: FAIL — MAJOR finding, BLOCKER-class per constitution (SEC-04 / kiosk surfaces are explicitly called out as BLOCKER-class)

This was T005's first real check. No worker self-report ever existed for this attempt — the
original worker session died on a session usage limit before producing one; checker-reviewer
derived every finding independently from the artifacts on disk and its own throwaway test suite.
That is not itself a defect and is not part of what needs fixing.

## What's already verified correct — do not touch, do not redo

- All 13 PRD Section 7 routes present as stub `<Route>` elements.
- `RequireAuth`/`RequireRole` guard logic independently verified correct via the checker's own
  6-test suite: redirects to `/login` when unauthenticated; redirects to `/` with the exact toast
  "You don't have access to that page." on wrong role.
- NAV-08 intended-URL round-trip verified: full `pathname+search+hash` stored, consumed exactly
  once, works for both the normal `login()` path and the `loginWithGoogle()` placeholder path.
- `src/main.tsx`/`src/App.tsx` confirmed NOT wired to the router/guards — correctly deferred to
  T006, not a defect.
- `react-router-dom@7.18.1` confirmed the only new dependency; peer range satisfied by React 19
  with no `--legacy-peer-deps`.
- `npm run build` / `npm run typecheck` / `npm run lint` all exit 0 (lint warnings are only the
  expected non-blocking `react-refresh/only-export-components` category).

This attempt is a **targeted fix**, not a redo of the task. Only the items below need work.

## K1 — `/kiosk/:sessionId` incorrectly left public (BLOCKER-class, must fix)

`router.tsx` currently stubs `/kiosk/:sessionId` as a fully public, unguarded route. Its module
doc comment claims "PRD doesn't spell out kiosk auth requirements." This is factually wrong.

**PRD Section 7 route table (ground truth, verbatim row):**
```
| `/kiosk/:sessionId` | coach/admin | fullscreen | QR, tally | MTG-07 |
```
This explicitly assigns `/kiosk/:sessionId` to roles **coach/admin** — it is not public.

**PRD SEC-04 (verbatim):**
> SEC-04 All students are minors: no public pages, no indexing (robots noindex), no photos in v1,
> no last names in kiosk/leaderboard surfaces by default.

The constitution flags kiosk/SEC-04 surfaces as BLOCKER-class explicitly. Leaving `/kiosk/:sessionId`
unguarded directly contradicts both the Section 7 role assignment and SEC-04's "no public pages"
rule.

**Required fix:**
1. Wrap the `/kiosk/:sessionId` route the same way other coach/admin routes are guarded:
   `RequireAuth` + `RequireRole(allowedRoles=['coach','admin'])` (nesting pattern already
   established and verified sound for `/settings`).
2. Correct the module doc comment — it must not claim the PRD is silent on kiosk auth when it
   isn't. Replace with an accurate note citing the Section 7 row and SEC-04, or simply remove the
   incorrect claim.

## K2 — `guards.tsx` Role union missing 'coach' (minor, but required for K1 to compile)

`guards.tsx`'s `Role` union type is currently `'admin' | 'staff' | 'volunteer'`. This does not
match the PRD's actual role vocabulary (admin|coach|student|parent, per AUTH-05) and, more
immediately, does not include `'coach'` — which K1's fix needs in order to express
`allowedRoles={['coach','admin']}`.

**Minimum required for this attempt:** add `'coach'` to the `Role` union so K1's fix type-checks.
Full reconciliation of the Role union against the complete PRD role vocabulary (admin/coach/
student/parent) is left open — the checker did not require it for this task, only that `'coach'`
exist. Do not expand scope beyond what's needed unless it's trivial to do correctly; if in doubt,
add only `'coach'` and flag the broader reconciliation question in your output rather than
resolving it unilaterally.

## K3 — RequireRole calls pushToast during render (NIT, log only — no action this attempt)

`RequireRole` currently calls `pushToast` during render rather than inside an effect. The checker
classified this as a NIT and explicitly deferred it to T006, when real toast UI lands. **Do not
fix this in this attempt** — it is not part of the required rework and touching it is out of
scope for a targeted fix.

## Summary of required changes this attempt

1. `src/app/router.tsx`: guard `/kiosk/:sessionId` with `RequireAuth` + `RequireRole(['coach','admin'])`; fix the doc comment.
2. `src/app/guards.tsx`: add `'coach'` to the `Role` union type.
3. Nothing else in this task's Allowed Files needs to change. All other verified-correct items above must be left as-is.
