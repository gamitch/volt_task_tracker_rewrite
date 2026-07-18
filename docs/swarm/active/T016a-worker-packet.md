# Worker Packet: T016a

## Task ID
T016a

## Objective
Wire the real, already-Passed `LoginPage` component (`src/pages/login/LoginPage.tsx`, barrel-exported from `src/pages/login/index.ts`, built and verified by T016) into `src/app/router.tsx`'s `/login` route, replacing the inline placeholder `LoginPage()` function that currently lives in `router.tsx` itself. This is a small, low-risk, purely mechanical wiring swap — flagged by both T016's worker and checker as a standalone follow-up task, not new feature work. It does **not** touch `guards.tsx` and does **not** attempt to build real Supabase auth (that is a separate, larger, deliberately-deferred gap, also flagged at T016 close-out but out of scope here).

## Current State (read directly from the file — confirm before editing)
`src/app/router.tsx` currently defines its own inline placeholder, lines 36-71:

```tsx
function LoginPage(): ReactNode {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const signInAs = (role: Role) => {
    login({ id: `placeholder-${role}`, email: `placeholder.${role}@example.com`, role });
    navigate(consumeIntendedUrl('/'), { replace: true });
  };

  const continueWithGoogle = () => {
    void loginWithGoogle().then(() => {
      navigate(consumeIntendedUrl('/'), { replace: true });
    });
  };

  return (
    <div>
      <h1>Login (placeholder)</h1>
      ... (two "sign in as" buttons + "Continue with Google" button)
    </div>
  );
}
```

It is registered at line 157: `<Route path="/login" element={<LoginPage />} />`.

`router.tsx` imports `useAuth` from `./guards` (line 30) solely to power this placeholder's `signInAs`/`continueWithGoogle` helpers. The real `LoginPage` component does its own `useAuth()`/`consumeIntendedUrl()` calls internally (see `src/pages/login/LoginPage.tsx`), so once the placeholder and its helpers are removed, check whether `router.tsx` still needs `useAuth`, `useNavigate`, or `Role` imported for anything else in the file (`useNavigate` is also used by `MeetingLiveSessionPage`/`KioskSessionPage` via `useParams`, not `useNavigate` — verify import usage yourself rather than assuming; do not leave unused imports, and do not remove imports still used elsewhere in the file).

`src/pages/login/index.ts` already documents the expected import for whoever wires this in:
```ts
// expected import: import { LoginPage } from '../pages/login';
```
From `src/app/router.tsx`, the correct relative path is `'../pages/login'` (resolves to `src/pages/login/index.ts` → `src/pages/login/LoginPage.tsx`).

## Allowed Files
- `src/app/router.tsx` — only this file.

## Forbidden Files
- `src/pages/login/**` — T016's own deliverable. Do not touch or reinterpret it in any way, even if you think something could be improved.
- `src/app/guards.tsx` — the placeholder `login()`/`loginWithGoogle()`/`consumeIntendedUrl()` auth contract is explicitly out of scope; this task is a wiring swap only, not an auth implementation task.
- `src/app/AppShell.tsx`.
- `docs/swarm/**`, `.claude/**`.
- Everything else not listed under Allowed Files.

## Scope (exact steps)
1. Remove the inline placeholder `LoginPage()` function from `router.tsx` (lines ~36-71) and its two now-unused helper closures (`signInAs`, `continueWithGoogle`) — these are local consts inside the function body, so removing the function removes them; just confirm nothing else in the file references them.
2. Add `import { LoginPage } from '../pages/login';` (or whatever the verified-correct relative path actually is once you inspect the file tree — state it explicitly in your output).
3. Leave the `<Route path="/login" element={<LoginPage />} />` registration exactly as-is structurally (same path, same JSX shape) — it will now resolve to the imported real component instead of the local placeholder function, with no other change needed to that line.
4. Clean up now-unused imports in `router.tsx` (most likely candidates: `useAuth`, `useNavigate`, `Role`, `consumeIntendedUrl` from `./guards` — but verify each one's usage elsewhere in the file first; `KioskSessionPage`/`MeetingLiveSessionPage` use `useParams`, not `useNavigate`, so double-check rather than assume any particular import is safe to drop).
5. Update the module doc comment at the top of the file if it references the placeholder `LoginPage` in a way that's now inaccurate (e.g., the route protection matrix notes) — keep this edit minimal and factual, not a rewrite.
6. Do not touch any other route, placeholder page component, or the route table's structure beyond what's described above. `AcceptInvitePage` and all other placeholders stay untouched — this task is `/login` only.

## Acceptance Criteria
1. `npm run typecheck`, `npm run lint`, `npm run build`, `npm run format:check`, `npm run test` all exit 0.
2. `router.tsx` no longer defines its own `LoginPage` function anywhere; the `/login` route's `element` resolves to the real imported component from `src/pages/login`.
3. No unused imports left behind (ESLint/typecheck will catch most of this, but confirm by reading the final file, not just trusting the linter).
4. **Live verification required** — this is not just a build-passes check:
   - Run `npm run dev`.
   - Using Playwright (pre-installed Chromium at `/opt/pw-browsers`), navigate to `/login` in a real browser and confirm the real `LoginPage` renders: the VOLT wordmark, email field, password field, "Forgot password" link, "Sign in" button, and "Continue with Google" button are all present — not the old placeholder's "Login (placeholder)" heading and "Sign in as staff/admin" buttons.
   - Submit valid-looking email/password values through the real form and confirm the full sign-in round trip works: the placeholder `login()`/`loginWithGoogle()` contract in `guards.tsx` still resolves successfully (unchanged — you are not modifying it), and after submit the browser redirects to `/` (or the intended URL — see next bullet).
   - Confirm the NAV-08 intended-URL-preservation flow still works end-to-end: navigate directly (while unauthenticated, e.g. a fresh browser context with no prior sign-in) to a protected route such as `/roster`, confirm it redirects through `/login` (the real component, not the placeholder), sign in, and confirm the browser lands back on `/roster` (or wherever the intended URL pointed), not just `/`.
   - Confirm the `/kiosk/:sessionId` role-guard path is unaffected (spot-check only — this task does not change guard logic, just confirm nothing regressed by loading it unauthenticated and confirming it still redirects to `/login` correctly).
5. No other route or behavior in `router.tsx` regresses — diff the full file against its pre-change state and confirm only `/login`-related lines changed (the removed placeholder function/helpers, the new import, the route element reference, and any necessarily-related import cleanup). Every other `<Route>` entry, every other placeholder page component, and `routePaths` must be byte-identical to before.
6. `src/pages/login/**` confirmed untouched (diff or checksum, not eyeballed).

## Relevant Constitution Excerpts
> Item 13: Wireframes are structural intent... Routes marked "template as-is" (PRD 7.1) get the named Astryx template; inventing custom layout there → MAJOR. (Not directly applicable here since you are not building UI, but the spirit applies: use T016's component exactly as built, do not modify or "improve" it while wiring it in.)

> Non-Negotiables: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary." Your output below is evidence for checker-tests, not a self-certification. In particular, do not just claim the live browser walkthrough happened — produce concrete evidence (Playwright script/output, console logs, or equivalent) the checker can independently reproduce.

## Most Recent Failure
None — this is attempt 1 for T016a.

## Context Note
T016 (checker-accessibility, Passed 1st attempt with a MINOR finding) built and fully verified `LoginPage.tsx` but could not wire it into `router.tsx` because that file was forbidden to T016's own Allowed Files. Both T016's worker and its checker independently flagged this exact gap and recommended closing it now via a standalone task rather than deferring to whenever T018 (`/accept-invite`) would hit the identical wiring gap for `AcceptInvitePage` — the user has approved doing this now. T018 will need its own equivalent wiring task later; that is not part of this task's scope.

## Required Worker Output
- Files changed (must be exactly `src/app/router.tsx`, or fewer): full diff.
- `npm run typecheck` / `npm run lint` / `npm run build` / `npm run format:check` / `npm run test` output (exit codes).
- Playwright script(s) used for the live-browser verification, plus their actual output/logs — for: (a) `/login` rendering the real component, (b) full sign-in round trip redirecting to `/`, (c) unauthenticated deep-link to a protected route → redirect to `/login` → sign in → land back on the originally-requested URL, (d) `/kiosk/:sessionId` spot-check still redirecting unauthenticated users to `/login`.
- Full diff of `router.tsx` (old vs new), annotated to show every changed region maps to one of the Scope steps above — nothing extraneous.
- Confirmation `src/pages/login/**` is untouched (diff/checksum).
- Known risks.
- Whether a dispute is needed (should not be — this is a small, fully-prescribed mechanical task — but flag it if something unexpected turns up, e.g. the real `LoginPage`'s behavior genuinely diverging from the placeholder's contract in a way that breaks the redirect flow, rather than improvising a fix to `guards.tsx` or `LoginPage.tsx` yourself).
