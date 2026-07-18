# Worker Packet: T016

## Task ID
T016

## Objective
Build the real `/login` screen using the Astryx `Basic Login` template (DES-08, AUTH-02): email + password fields, "Continue with Google" secondary button, "Forgot password" link (triggers a Supabase password-reset email), VOLT wordmark above the card, and **no self-serve "Create account" link** (AUTH-02 is explicit on this last point). Template used as-is — adapt content only, do not invent a custom layout (constitution item 13, PRD 7.1 "template as-is").

## Allowed Files
- `src/pages/login/**` (new directory — nothing currently exists here, confirmed via `Glob` before this packet was written)

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- `src/app/router.tsx` — **read-only, and do not attempt to fix the wiring gap described below by editing it.**
- `src/app/guards.tsx` — **read-only** (import `useAuth`, `Role`, `AuthUser`, `consumeIntendedUrl` from here; do not edit).
- `src/app/AppShell.tsx`, `src/components/nav/**` — not this task (T016 is chromeless per `AppShell.tsx`'s existing `routePaths.login` bypass; you don't need to touch or reason about AppShell at all).
- Anything outside `src/pages/login/**`.

## CRITICAL — Open Scope Question: the current `/login` placeholder does NOT live under `src/pages/login/**`

I checked `src/app/router.tsx` directly before writing this packet. The current `/login` route is wired to an inline `LoginPage()` function **defined directly inside `router.tsx` itself** (lines 36–71), not to any component under `src/pages/login/**` — that directory does not exist yet at all. `router.tsx`'s route table (line 157) is:
```tsx
<Route path="/login" element={<LoginPage />} />
```
where `LoginPage` is the module-local placeholder function in the same file.

**This means:** even after you build a complete, correct `Basic Login` page component under `src/pages/login/**`, nothing will actually render it at `/login` in the running app — `router.tsx` will keep rendering its own inline placeholder — unless someone edits `router.tsx` to import your component and swap it in. `router.tsx` is forbidden to you.

**Do not** try to work around this by:
- editing `router.tsx` yourself (forbidden file, no exceptions),
- duplicating routing logic somewhere else,
- guessing that this is fine to leave unwired and silently shipping only the component with no way to actually view it live at `/login`.

**What you should do instead:**
1. Build the complete, real `LoginPage` component (and any subcomponents) under `src/pages/login/**` exactly per this packet's acceptance criteria, as if it were going to be wired in immediately.
2. Produce your required evidence (screenshots, keyboard walkthrough) via a **standalone render harness** — e.g. a temporary test file within `src/pages/login/**` that mounts `<LoginPage />` directly (wrapped in whatever minimal providers it needs, e.g. `AuthProvider`/`MemoryRouter`/`Theme`/`LayerProvider`, all read-only imports) without going through the real router. Clearly label any such file in its own header comment as a temporary verification harness, and **delete it before handing back your worker output** (same pattern T005 used for its own self-declared scratch test file — see `docs/swarm/state-summary.md`'s "Session-limit interruption" note for that precedent if useful context, though you don't need to read the whole file).
3. In your **Required Worker Output** (see below), explicitly flag this as a dispute candidate: `router.tsx` needs a follow-up edit (swap the inline `LoginPage`/`AcceptInvitePage` placeholders for real imports from `src/pages/login/**` and `src/pages/accept-invite/**`) that only a task with `router.tsx` in its Allowed Files can make. State plainly whether you believe this should be a new small ledger task or folded into T018 (`/accept-invite`, which will hit the identical gap) — this is a recommendation, not a decision you get to make yourself.

Do not treat this note as permission to skip building the real component — build it completely. The gap is about final wiring, not about whether the artifact itself should exist.

## Second Open Scope Note — real Supabase authentication is likely NOT achievable within this task's Allowed Files, and that's expected

The task-ledger context asks you to "wire the actual login submission to call `AuthProvider`'s `login()` function... so the existing redirect-after-login flow in `guards.tsx` actually works." Read `guards.tsx` (read-only) before you start — its actual exported contract is:
```ts
login: (user: AuthUser) => void;           // synchronous, takes an already-known user object
loginWithGoogle: () => Promise<AuthUser>;  // placeholder round trip, returns a hardcoded user
```
`login()` does **not** accept email/password and does **not** perform any credential verification — it is still T005's self-contained in-memory placeholder (see its own module doc). There is no Supabase JS client wired into the frontend anywhere in the repo yet (`@supabase/supabase-js` is on the dependency allowlist, but no task has instantiated a shared client — checked via grep, zero hits for `createClient`/`supabase-js` anywhere under `src/`). No task currently in the ledger has `guards.tsx` in its Allowed Files except the already-Passed T005 (not being reopened).

**What this means for you:** you can and should build a fully real-looking, fully functional login *form* (validation, loading/error/success UI, keyboard path, all the real Astryx components) — but the actual "authenticate" step, when the form submits, should call the existing placeholder contract the same way the current inline `LoginPage` in `router.tsx` already does (collect email/password, then call `login({ id, email, role })` with a role you determine however the current placeholder does — read its `signInAs` helper for the exact pattern — and `consumeIntendedUrl()` for the post-login redirect), rather than inventing a real Supabase `signInWithPassword`/`signInWithOAuth` integration from scratch inside `src/pages/login/**`. Building a one-off Supabase client scoped only to this page would very likely be reworked once a real shared auth-wiring task lands, and is exactly the kind of unanticipated-architecture risk the constitution's dispute mechanism exists for.

**Flag this explicitly too** in your Required Worker Output: real Supabase email/password + Google OAuth wiring into `AuthProvider` (`guards.tsx`) is not yet owned by any ledger task and is a second dispute-worthy gap, distinct from the `router.tsx` wiring gap above. Do not silently build a shadow Supabase client to route around it.

If, after reading `guards.tsx` yourself, you believe there is a clean way to satisfy "the login submission actually authenticates" without touching `guards.tsx` or inventing throwaway architecture, you're free to propose it in your worker output — but the default expectation is: build the full UI, wire the submit handler to the existing placeholder contract, and flag the rest as a dispute.

## Astryx Ground Truth — Props (from `docs/swarm/astryx-api.md`; do not use any prop not listed here or there — constitution item 2)

**Note on the "Basic Login" template itself:** `astryx-api.md` has no `# Basic Login` (or any template-named) section with a props table — grepped and confirmed zero matches. DES-08 describes templates as something you scaffold via the CLI (`npx astryx template <name>` — this project's established equivalent invocation is `npm run astryx -- template <name>`, matching how T006 used `npm run astryx -- component <Name>` as a cross-check) and then adapt, not a documented component. Ground truth for what the template must contain comes from PRD AUTH-02 and the PRD 7.1/Section-7 excerpts below, built out of the documented components listed here. This is the same category of known gap T002/T006 hit with `Theme` — the CLI is a cross-check, never a source (constitution item 2), so if the CLI's scaffold output disagrees with AUTH-02's field list, AUTH-02 wins.

### TextInput (email + password fields)
| Prop | Type | Default | Description |
|---|---|---|---|
| `type` | `'text'\|'password'\|'email'` | `'text'` | HTML input type. Use `'email'` and `'password'` for the two fields. |
| `label` | `string` | — | **(required)** Label text, always rendered for accessibility. |
| `value` | `string` | — | **(required)** Current value. |
| `onChange` | `(value, e) => void` | — | Change callback. |
| `isRequired` | `boolean` | `false` | Shows "Required" indicator, sets `aria-required`. |
| `status` | `{type:'error'\|'warning'\|'success', message?}` | — | Validation status; error type sets `aria-invalid`. Use for field-level login errors if you choose field-level over/alongside a `Banner`. |
| `hasAutoFocus` | `boolean` | `false` | Auto-focus on mount — reasonable for the email field. |
| `htmlName` | `string` | — | HTML `name` attribute. |
| `isLoading` | `boolean` | `false` | Loading state with spinner + `aria-busy`. |
| `placeholder`, `description`, `size`, `isLabelHidden`, `isDisabled`, `disabledMessage`, `labelTooltip`, `startIcon`, `hasClear` | — | — | Available if useful; do not hide the label per the doc's own "Don't" guidance (placeholders are not a label substitute). |

### Button (submit + "Continue with Google")
| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | — | **(required)** Accessible label / visible text. Per DES-14/constitution item 14: sentence case, named action — "Sign in" or "Sign in with email", never bare "Submit"/"OK". |
| `variant` | `'primary'\|'secondary'\|'ghost'\|'destructive'` | `'secondary'` | Use `'primary'` for the main sign-in submit button, `'secondary'` for "Continue with Google" — AUTH-02 explicitly specifies `Button variant="secondary"` for the Google button. |
| `type` | `'button'\|'submit'\|'reset'` | `'button'` | Set `'submit'` on the sign-in button if you use a real `<form>`. |
| `isLoading` | `boolean` | `false` | Shows spinner, disables interaction, announces "Loading" via live region — use for the DES-12 loading state during submit. |
| `isDisabled` | `boolean` | `false` | — |
| `clickAction` | `(e) => void\|Promise<void>` | — | Async click handler — appropriate for "Continue with Google" (`loginWithGoogle()` returns a `Promise`). |
| `onClick` | `(e) => void` | — | Sync click handler. |

Don't (from the doc): place more than one primary button in the same view — only the email/password submit should be `variant="primary"`.

### Link ("Forgot password")
| Prop | Type | Default | Description |
|---|---|---|---|
| `href` | `string` | — | Destination. There is no dedicated "forgot password" route in PRD Section 7's route table — this is expected to trigger a Supabase reset-email action inline (e.g. open a small form/`Dialog` asking for the email, or reveal an inline sub-state on this same page), not navigate to a nonexistent route. Your call how to structure it; document the choice explicitly in your output. |
| `children` | `ReactNode` | — | **(required)** Link text — visible text is the accessible name; don't also set `label` (the doc is explicit: setting `label` on a text link overrides screen-reader text harmfully). |
| `onClick` | `MouseEventHandler` | — | Use this instead of (or alongside) `href` if you implement the reset flow as an in-page action rather than real navigation. |
| `isStandalone` | `boolean` | `false` | Set `true` since this link sits outside inline body text. |

Don't: use `Link` for actions that don't navigate — if "Forgot password" opens a `Dialog`/inline panel rather than navigating anywhere, consider whether `Button variant="ghost"` styled as a link-like affordance is more correct per the doc's own guidance, or document why `Link` with `onClick` is still the right call for this specific case. Either is defensible; just be explicit.

### Card (the login card itself)
| Prop | Type | Default | Description |
|---|---|---|---|
| `width`, `maxWidth` | `SizeValue` | — | Constrain the card to a login-form-appropriate width. |
| `padding` | `0\|0.5\|1\|1.5\|2\|3\|4\|5\|6\|8\|10` | `4` | Internal padding. |
| `variant` | `'default'\|'muted'\|...` | `'default'` | Use `'default'` — the color variants are for categorization, not this use case. |
| `children` | `ReactNode` | — | Form content. |

### Text / Heading (VOLT wordmark above the card)
`astryx-api.md`'s `Heading` subcomponent entry has no props table of its own (documented as "undefined" in the source doc — a known gap, same category as the `Basic Login` template gap above); its `level` prop (1–6) is only described in `Text`'s best-practices prose ("Use Heading with a `level` prop (1–6) for section titles"). `TopNav.tsx` (T006, read-only reference, do not import from it) renders the wordmark as plain text `"VOLT"` via `TopNavHeading heading="VOLT"` — but `TopNavHeading` is TopNav-specific and not usable on a chromeless page. For this page, use `Heading` with `level={1}` and the literal text `"VOLT"` (this page's only real top-level heading — DES-17/Text's own "don't skip heading levels" guidance), or `Text type="display-2"` if you judge a decorative (non-heading-semantic) treatment is more correct — document which you picked and why. Do not invent a logo/image asset; none exists anywhere in the repo (confirmed: `public/**` and `src/pages/**` are both currently empty).

### Banner (error state)
| Prop | Type | Default | Description |
|---|---|---|---|
| `status` | `'info'\|'warning'\|'error'\|'success'` | — | **(required)** Use `'error'` for failed sign-in. |
| `title` | `ReactNode` | — | **(required if no description)** Short, scannable — e.g. "Sign-in failed", not "There was a problem...". Per DES-16: say what happened and what to do, no apologies/"Oops". |
| `description` | `ReactNode` | — | Detail + next action. |
| `container` | `'card'\|'section'` | `'card'` | Use `'card'` — this banner lives inside the login card, not full-page. |
| `isDismissable` | `boolean` | `false` | Doc says error banners should stay visible until the user fixes the issue — likely `false` here, your call. |

## Acceptance Criteria
1. `Basic Login` template used as-is: email field, password field, "Continue with Google" `Button variant="secondary"`, "Forgot password" link, VOLT wordmark above the card, laid out via `Card` + a layout primitive (`Center`/`Stack`/`VStack` — all documented components, cite whichever you use). No box-drawing/bracket characters in the DOM (constitution item 13 — not directly relevant here since AUTH-02 has no ASCII wireframe, stated for completeness). No invented layout beyond adapting the template's content per AUTH-02's field list.
2. **AUTH-02 hard requirement:** no self-serve "Create account" / "Sign up" link or affordance anywhere on this page. This is explicitly called out because public signup is disabled at the Supabase level (AUTH-01) — a UI path that implies otherwise is a real correctness bug, not cosmetic.
3. All applicable DES-12 states are implemented. A login form is not a "list" screen, so map the four states deliberately rather than mechanically, and document your mapping explicitly in your output:
   - **Empty** → the page's initial/untouched state (fresh load, no values entered, no error shown yet).
   - **Loading** → sign-in submit in flight (`Button isLoading`) and/or "Continue with Google" in flight (`clickAction` pending).
   - **Error** → failed sign-in (bad credentials) and/or a failed Google round-trip, shown via `Banner status="error"` and/or field-level `TextInput status`, per DES-16 copy rules (say what happened + what to do, no apologies).
   - **Populated/success** → the normal ready-to-submit form state (this is effectively the resting state once the user has entered values) — a login form has no separate "success" render state beyond it, since a successful login navigates away; document that this is your interpretation.
   If you conclude "empty" genuinely doesn't apply and choose to omit it, you must say so explicitly and justify it — do not just silently skip it.
4. Every prop used on `TextInput`/`Button`/`Link`/`Card`/`Text`/`Heading`/`Banner` (and any other Astryx component you use) appears in the Astryx Ground Truth excerpts above or in `docs/swarm/astryx-api.md` directly — cite the exact section/line for each. A prop not present there is presumed hallucinated (constitution item 2, MAJOR).
5. Full keyboard path: Tab through email → password → "Forgot password" link → sign-in button → "Continue with Google" button (or your chosen tab order — document it), submit via Enter, visible focus indicator on every interactive element, in both light and dark mode (DES-17/NFR-07, constitution item 15 — BLOCKER if a keyboard path is broken or focus isn't visible).
6. Button/link copy follows DES-14 (sentence case, named actions — "Sign in", not "Submit"/"OK"; "Continue with Google" is prescribed verbatim by AUTH-02).
7. Submission wired to the existing placeholder `login()`/`loginWithGoogle()` contract from `guards.tsx` (read-only import) and `consumeIntendedUrl()` for post-login redirect, matching how the current inline `router.tsx` placeholder does it — see the "Second Open Scope Note" above. Do not build a one-off real Supabase client.
8. The `router.tsx` wiring gap (component built but not actually reachable at `/login` without a forbidden-file edit) and the Supabase-auth-wiring gap are both explicitly flagged in your Required Worker Output as dispute candidates, not silently worked around.
9. Build/typecheck/lint all exit 0.
10. Any temporary render-harness test file you create to produce evidence is deleted before you hand back your output, and you say so explicitly.

## Relevant Constitution Excerpts

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop absent from that file is presumed hallucinated → MAJOR. The CLI is a cross-check, not a source.

> 13. Wireframes are structural intent... Routes marked "template as-is" (PRD 7.1) get the named Astryx template; inventing custom layout there → MAJOR.

> 14. Copy follows PRD DES-14…16 (sentence case, named actions, prescribed empty/error text).

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on core flows → BLOCKER.

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around.

Definition of Done (constitution): no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## PRD Ground Truth (verbatim)

> **DES-08** Page scaffolding: start from Astryx **templates**, then adapt — Coach Home from `Analytics Dashboard`; `/login` from `Basic Login`; Reports tables from `Grouped Table`. Emit with `npx astryx template <name>`.

> **DES-12** Every async list screen has all four states specified: loading (`Skeleton`), empty (`EmptyState` with one action), error (`Banner status="error"` with retry), populated. Workers must implement all four; checkers verify.

> **AUTH-01** Supabase Auth with providers: email/password and Google OAuth. Public signups **disabled** in Supabase settings.

> **AUTH-02** `/login` (from `Basic Login` template): email + password fields, "Continue with Google" `Button variant="secondary"`, "Forgot password" link (Supabase reset email). No self-serve "Create account" link.

> **AUTH-08** Session persistence via Supabase client defaults; sign out from user menu.

> Route table (Section 7): `/login | public | Basic Login | TextInput type="email/password", Button | AUTH-02`

> 7.1: "**Template as-is:** `/login` → `Basic Login` (fields per AUTH-02, VOLT wordmark above the card)..."

> "Every route implements the four states of DES-12."

> **DES-14** Sentence case everywhere. Plain verbs. Buttons say what happens... never "Submit" or "OK".

> **DES-16** Errors say what happened and what to do... No apologies, no "Oops".

> **DES-17** WCAG 2.1 AA. ...Visible focus, labels on all inputs...

## Most Recent Failure
None — this is attempt 1 for T016.

## Related Completed Work (context, not new acceptance criteria)
- **T015** (Passed) — `supabase/config.toml` enables email/password + Google OAuth providers, public signup disabled. This is server-side config only; no frontend Supabase client exists yet (see Second Open Scope Note above) — do not assume T015 means real end-to-end auth is wireable from this task.
- **T006/T006a** (Passed) — `AppShell.tsx` already renders `/login` and `/accept-invite` chromeless (no TopNav/AppShell chrome) via a `routePaths.login`/`routePaths.acceptInvite` check. You don't need to touch or verify this; it already works for whatever ends up rendering at that route.
- `guards.tsx`'s `RequireAuth` (T005, Passed, read-only) stores the intended URL in `sessionStorage` and redirects unauthenticated users to `/login`; `consumeIntendedUrl()` reads and clears it, defaulting to `/`. Your submit handler should call this exactly as the current inline placeholder does.

## Required Worker Output
- Files created under `src/pages/login/**` — full contents.
- Explicit prop-by-prop cross-check: for every Astryx component prop used, cite which line of the Astryx Ground Truth section (or `astryx-api.md` directly, with a line reference) it comes from.
- Explicit statement of your DES-12 four-state mapping decision (per Acceptance Criterion 3), with reasoning.
- Explicit statement of your "Forgot password" flow design decision (inline panel/Dialog vs. something else) and why.
- Explicit statement of your VOLT wordmark treatment decision (`Heading level={1}` vs. `Text type="display-2"` or other) and why.
- Screenshots of the rendered login page in **both** light and dark mode, covering the empty, loading, error, and populated states you implemented.
- Keyboard walkthrough notes: step-by-step (Tab/Enter) through every interactive element, confirming focus visibility at each step in both modes.
- Confirmation that no "Create account"/"Sign up" affordance exists anywhere on the page (AUTH-02).
- Confirmation of how the submit handler is wired to `guards.tsx`'s existing `login()`/`loginWithGoogle()`/`consumeIntendedUrl()` contract (per Acceptance Criterion 7), with the exact code path shown.
- Explicit dispute-candidate flags for both open scope questions described above (the `router.tsx` wiring gap and the Supabase-auth-wiring gap), including your recommendation on how each should be resolved (new task vs. folded into an existing one) — this is a recommendation, not a decision you make yourself.
- Confirmation that any temporary render-harness test file was deleted before handoff.
- `npm run build` / `npm run typecheck` / `npm run lint` output.
- Known risks.
