# Checker Packet: T016 (`/login` screen) — Check Attempt 1

## Task ID
T016 — `/login` screen (AUTH-02, DES-08, DES-12)

## Checker Agent
checker-accessibility (per task-ledger.md T016 row)

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").
This is the first check on this task — no prior checker verdict exists. Full task context:
`docs/swarm/active/T016-worker-packet.md`.

## What This Check Covers
Full first-pass verification of a new task. Astryx prop cross-check (re-verify, don't trust
citations), AUTH-02 no-signup compliance, DES-12 four-state mapping (must be real, traced state —
not a comment), independent live-render evidence via your own temporary Playwright harness (the
page is not reachable through the running app yet — see "Known Reachability Gap" below, this is not
a defect), keyboard/focus verification via real keyboard events in both modes, guards.tsx submission
wiring, two explicit judgment-call verdicts the worker flagged, forbidden-file boundary, and a
standard build/typecheck/lint/format:check re-run. **Also required: your own independent read on the
two dispute-candidate gaps below — these are NOT part of T016's pass/fail verdict** (see that
section).

## Worker's Claimed Changes (do not trust — verify independently)
1. New `src/pages/login/LoginPage.tsx` and `src/pages/login/index.ts` (barrel export). No other
   files touched.
2. Astryx `Basic Login` template adapted (not invented) via `Center > VStack > [Heading "VOLT"] >
   Card > VStack > [form]`, per the worker's own CLI cross-check
   (`npm run astryx -- template login --skeleton`) plus AUTH-02's literal field list layered on top,
   since `astryx-api.md` has no `Basic Login` props table (confirmed known gap, same class as
   `Theme`/`TopNavHeading`).
3. Two form states in the same `Card`, toggled by `isResetPanelOpen`: the sign-in form (email,
   password, "Forgot password" `Link`, "Sign in" primary `Button`, "Continue with Google" secondary
   `Button`) and an inline "reset password" sub-panel (email field, "Send reset link" `Button`,
   "Back to sign in" `Link`) — "Forgot password" opens the sub-panel in-page rather than navigating,
   per the worker's documented design decision.
4. Claimed DES-12 four-state mapping: Empty = initial render (blank fields, no banner, panel closed);
   Loading = `isSubmitting`/Google `clickAction` pending / `resetStatus === 'sending'`; Error =
   `formError`/field-level `TextInput status` (sign-in) or `resetStatus === 'error'` (reset panel);
   Populated/success = resting filled-in state, no separate post-login render since success
   navigates away.
5. Submission wiring: `handleSubmit` calls `login({ id, email, role: PLACEHOLDER_SIGN_IN_ROLE })`
   then `navigate(consumeIntendedUrl('/'), { replace: true })`; `handleGoogleSignIn` calls
   `await loginWithGoogle()` then the same navigate/consumeIntendedUrl pattern — both imported from
   `../../app/guards` (read-only).
6. A disclosed, non-PRD `SIMULATED_AUTH_LATENCY_MS = 350` constant wraps both the sign-in and
   reset-email round trips in an artificial `setTimeout` delay, with an explicit module-doc comment
   stating why (guards.tsx's placeholder resolves instantly, which would make the Loading state
   invisible) and that it should be removed once real Supabase wiring lands.
7. Worker claims: no self-serve "Create account"/"Sign up" affordance anywhere; a temporary
   Playwright render-harness file was created to produce screenshot/keyboard evidence, then declared
   and deleted before handoff, confirmed clean via `ls`/`find`; `router.tsx`/`guards.tsx` untouched;
   build/typecheck/lint all exit 0.
8. Worker flags two dispute candidates in its output (see "Two Dispute-Candidate Gaps" section
   below) rather than working around them.

## Astryx Ground Truth — Re-verify Every Line Reference Yourself
Do not trust the worker's or this packet's citations. Re-open `docs/swarm/astryx-api.md` at each
line number below and confirm the prop is genuinely documented there with that name/type/default.
Flag any prop used in `LoginPage.tsx` that you cannot find documented anywhere in `astryx-api.md` as
MAJOR (constitution item 2).

- **TextInput** `astryx-api.md:1656-1675`. Worker uses `type` (`'email'`/`'password'`), `label`,
  `value`, `onChange`, `isRequired`, `hasAutoFocus`, `htmlName`, `status`. All six documented at
  those lines. Confirm `status`'s shape (`{type:'error'|'warning'|'success', message?}`) matches how
  the worker constructs it (`{ type: 'error', message: fieldErrors.email }`, etc.) exactly.
- **Button** `astryx-api.md:1807-1827` (props table begins at 1809). Worker uses `type="submit"`,
  `variant` (`'primary'`/`'secondary'`), `label`, `isLoading`, `clickAction`. Confirm the doc's own
  "Don't: use a button for navigation" note (line 1805) is not violated — the sign-in/reset-link
  buttons are real submit actions, not navigation, so this should be a non-issue; confirm it
  yourself rather than assuming. Confirm only one `variant="primary"` button exists per rendered form
  state (doc's "no more than one primary button per view" rule) — check both the sign-in form and the
  reset panel independently, since they render in the same `Card` but never simultaneously.
- **Link** `astryx-api.md:1957-1971`. Worker uses `isStandalone` and `onClick` only (no `href`, no
  `label`, no `children`-plus-`label` conflict — text content is the link text itself, e.g.
  `<Link isStandalone onClick={openResetPanel}>Forgot password</Link>`). Confirm this is a legitimate
  use per the doc: `onClick` is documented (line 1968), `isStandalone` is documented (line 1970,
  "applies base font sizing" — appropriate since these links sit outside body text), and `href` is
  optional (not required) so omitting it for an in-page action is not itself a hallucination. See the
  separate judgment-call verdict required below on whether `Link` (vs. `Button variant="ghost"`) is
  the *right* choice here — that is a design-judgment question, not a prop-hallucination question.
- **Card** `astryx-api.md:2960-2966`. Worker uses `width={400}`, `maxWidth="100%"`, `padding={6}`,
  `variant="default"`. All four documented at those lines; `padding` accepts `6` per the documented
  enum (line 2965); `variant="default"` is the documented default value, explicitly set (not a
  hallucination to state it explicitly).
- **Center** `astryx-api.md:78-87`. Worker uses `axis="both"`, `height="100vh"`, `width="100%"`. All
  three documented (`axis` line 80, `height` line 82, `width` line 81). Confirm the doc's own "Do: set
  a height when centering vertically" guidance (line 71) is satisfied — it is, via `height="100vh"`.
- **VStack** `astryx-api.md:374-396`. Worker uses `gap={4}` / `gap={6}` and `hAlign="center"` (outer
  stack only). Confirm `gap` is passed as a JSX number expression per the doc's explicit warning (line
  380: "NOT a string like gap=\"4\"") — it is (`gap={6}`, `gap={4}`), not a string.
- **Heading** — `astryx-api.md`'s `## Components > ### Heading` entry literally says "undefined"
  (line 884, confirmed gap, same class as `TopNavHeading`/`Basic Login`). The only ground truth for
  `level` is `Text`'s best-practices prose at line 856 ("Use Heading with a `level` prop (1–6) for
  section titles and headings") and the "don't skip heading levels" rule at line 853. Worker uses
  `<Heading level={1}>VOLT</Heading>` (page's only h1) and `<Heading level={2}>Reset your password
  </Heading>` inside the reset sub-panel. **Verify independently**: does a level-2 heading nested
  under a level-1 "VOLT" heading, with no level between them anywhere else on the page, violate "go
  h1 then h2 then h3, never h1 then h3"? Reason through whether "VOLT" (page identity) and "Reset your
  password" (a sub-panel's own section title) are siblings-in-spirit rather than a literal outline
  chain, and render an explicit verdict — don't just assume it's fine because line 853 nominally
  reads "h1 then h2" is satisfied.
- **Text** `astryx-api.md:862` (type prop, in the props table starting line 858). Worker uses
  `<Text type="supporting">` for the reset-panel helper copy. Confirm `'supporting'` is a documented
  `type` enum value (it is, line 862) and that no `variant` prop is used anywhere (doc explicitly
  says Text has no `variant` prop, line 855).
- **Banner** `astryx-api.md:2730-2737`. Worker uses `status` (`'error'`/`'success'`), `title`,
  `description`, `container="card"` across three call sites (sign-in error, reset-panel success,
  reset-panel error). Confirm `title` is treated as required per the doc (line 2731) — it is always
  supplied. Confirm `container="card"` matches the doc's guidance that `'card'` is for banners living
  inside a card (line 2737) — correct here since the Banner renders inside the login `Card`, not
  full-page. `isDismissable` is not set anywhere (defaults `false`) — confirm this matches AUTH-02/
  DES-16's "errors stay visible until fixed" expectation cited in the worker packet.

## AUTH-02 Compliance — Full-Text Grep Required
Run an actual grep (not a skim) across the full text of `src/pages/login/LoginPage.tsx` and
`src/pages/login/index.ts` for `Create account`, `Sign up`, `Signup`, `Register`, `create an account`,
and any case-insensitive variant, plus a manual re-read of every visible string literal in the file
(button labels, link text, banner copy) for anything that could function as a self-serve signup
affordance even if not literally one of those phrases. **Must be zero matches and zero implied
affordances.** This is explicitly called out per AUTH-02/AUTH-01 (public signup disabled at the
Supabase level) — a UI path implying otherwise is BLOCKER-class per the worker packet's own framing
("a real correctness bug, not cosmetic").

## DES-12 Four-State Mapping — Trace the Actual Code, Not the Comment
The module doc (lines 47–63 of `LoginPage.tsx`) *describes* a four-state mapping, but a comment is
not evidence — trace the real state variables and their real conditional renders:
- **Empty**: confirm this is genuinely just the absence of any special-case render — no dedicated
  `EmptyState` component exists or is expected (a login form is not a list screen); confirm the
  worker's packet-level reasoning for omitting a literal `EmptyState` render is sound, not just
  asserted.
- **Loading**: confirm `isSubmitting` actually drives the sign-in `Button`'s `isLoading` prop (it
  does, line 325: `isLoading={isSubmitting}`), confirm `handleGoogleSignIn`'s `clickAction` binding
  means the Google button's own internal pending state covers its loading UI (Button's `clickAction`
  is documented to show a spinner while the returned promise is pending — re-verify this from the
  Button ground truth above, not from memory), and confirm `resetStatus === 'sending'` drives the
  reset-panel's "Send reset link" button's `isLoading` (line 274).
- **Error**: confirm `formError` is set only on genuine failure paths (field-validation failure at
  submit, and the `catch` block around the simulated round trip) and cleared at the start of each new
  submit attempt (`setFormError(null)` at the top of `handleSubmit`, line 140) — i.e. it is not a
  stale error that could linger incorrectly. Confirm the same for `resetStatus === 'error'` in the
  reset panel. Confirm both error paths render via `Banner status="error"` with DES-16-compliant copy
  (say what happened + what to do, no apologies) — read the actual banner title/description strings
  used (lines 152–155, 168–171, 183–186, 246–253) and judge them against DES-16 yourself.
- **Populated/success**: confirm the worker's claim that there is no separate "success" render state
  is accurate — trace `completeSignIn()` and `handleGoogleSignIn`'s success path and confirm both
  navigate away via `consumeIntendedUrl` rather than rendering any in-page success UI, which is
  consistent with the claim. One exception exists inside the reset sub-panel: `resetStatus === 'sent'`
  DOES render an in-page `Banner status="success"` (lines 237–244) — this is a *sub-flow* success
  state, not the login form's own DES-12 "populated" state; confirm the worker's mapping didn't
  conflate or omit this, and render your own verdict on whether the reset panel's `sent` state should
  have been called out as a fifth/sub-state in the worker's explicit mapping (a documentation
  completeness question — decide if this is a defect worth flagging at all, and at what severity if
  so).

## Required Verification Steps
1. **Read the actual files in full.** `src/pages/login/LoginPage.tsx`, `src/pages/login/index.ts` —
   do not rely on the worker's packet or its own summary.
2. **Astryx prop cross-check.** Per the ground-truth section above — re-open `astryx-api.md`
   yourself at each cited line; flag any undocumented prop as MAJOR.
3. **AUTH-02 no-signup compliance.** Per the grep instructions above — zero matches required.
4. **DES-12 four-state mapping.** Per the tracing instructions above — must be real, wired states,
   not narration.
5. **Independent live-render evidence (own temporary Playwright harness).** The page is not reachable
   through `npm run dev` navigation yet (see "Known Reachability Gap" below — not this task's fault).
   Build your **own** standalone, temporary render harness — same category of approach the worker
   used (a real browser via the pre-installed Playwright chromium, not jsdom-only) — that mounts
   `<LoginPage />` wrapped in whatever minimal providers it needs (`AuthProvider` from `guards.tsx`,
   `MemoryRouter`, `Theme`, `LayerProvider` — all read-only imports, same as the worker's approach).
   Use it to independently reproduce: (a) the empty/loading/error/populated-equivalent states
   rendering correctly in both light and dark mode, (b) the reset-panel toggle and its own
   loading/error/success sub-states, (c) that no "Create account"/"Sign up" text renders anywhere in
   the actual DOM (not just the source file). **Do not just trust the worker's screenshots** — this
   must be your own independent reproduction. Declare the harness file's purpose in its own header
   comment, and **delete it before finishing** — explicitly confirm deletion (e.g. `ls`/`find`
   showing it's gone) in your output, the same standard the worker was held to.
6. **Keyboard walkthrough + visible focus, independently, both modes.** Using real `KeyboardEvent`
   dispatch (or equivalent real keyboard interaction via Playwright) against your own harness — not
   just reading the JSX and assuming DOM order matches visual/tab order — confirm: Tab order Email →
   Password → "Forgot password" link → "Sign in" button → "Continue with Google" button (this is the
   worker's claimed order per the packet's Required Worker Output — confirm the actual rendered DOM
   order matches, since `Link`/`Button` positions in JSX at lines 294–331 should produce this order
   but verify, don't assume); Enter submits the form from either text field; visible focus indicator
   on every interactive element in both light and dark mode. Also verify the reset sub-panel's own
   tab order (Email → "Send reset link" → "Back to sign in") when open. BLOCKER if any keyboard path
   is broken or focus isn't visible (constitution item 15).
7. **guards.tsx submission-wiring verification.** Read `src/app/guards.tsx` yourself (already
   provided in full below for convenience, but re-open it directly rather than trusting this
   packet's copy) and confirm `LoginPage.tsx`'s `completeSignIn`/`handleSubmit`/`handleGoogleSignIn`
   genuinely match the existing contract shape: `login(user: AuthUser)` is synchronous and takes an
   already-built user object (confirmed at guards.tsx line 57) — worker calls
   `login({ id: ..., email, role: PLACEHOLDER_SIGN_IN_ROLE })`, matching the shape; `loginWithGoogle()`
   returns `Promise<AuthUser>` (line 68) — worker `await`s it, matching; `consumeIntendedUrl(fallback
   = '/')` (line 153) — worker calls `consumeIntendedUrl('/')` matching the default fallback
   explicitly. Cross-check this against the *existing* inline placeholder in `router.tsx` (lines
   36–71, especially the `signInAs`/`continueWithGoogle` functions) which the worker packet directed
   it to mirror — confirm the new component's wiring pattern is a faithful match, not a divergent
   reinvention.
8. **Two judgment-call verdicts — render an explicit ruling on each, do not skip:**
   - **(a) `Link` + `onClick` for "Forgot password" vs. `Button variant="ghost"`.** The worker
     packet's Astryx Ground Truth section explicitly sanctioned either choice ("Either is defensible;
     just be explicit") and the worker chose `Link isStandalone onClick={...}`. The raw
     `astryx-api.md` Link section (around line 1805, in the `Button` doc's own "Don't" — re-verify the
     actual location and exact wording yourself) has a general "don't use a button for navigation,
     use Link instead" framing, and separately the worker packet quotes a general "don't use Link for
     actions that don't navigate" caution. Read both the `Button` and `Link` sections' full "Do"/
     "Don't" guidance yourself (not just the excerpted lines above — read the surrounding prose too)
     and render an **explicit verdict**: is `Link` with `onClick` (no `href`) an acceptable choice
     here, or does it cross into "Link used for a non-navigating action" territory that should have
     been a `Button variant="ghost"` instead? Justify your answer either way — this is a real design
     question the worker flagged for checker awareness, not a rhetorical formality.
   - **(b) `SIMULATED_AUTH_LATENCY_MS = 350`.** This is a disclosed, non-fabricated timing-only
     addition — it does not invent any real authentication logic, does not touch `guards.tsx`, and is
     confined to `LoginPage.tsx`'s own Allowed Files. Render an **explicit BLOCKER/MAJOR/MINOR/NIT
     severity verdict** per the constitution's Failure Severity rubric (quoted in full below) on
     whether this specific addition is acceptable scope for this task or a defect requiring rework.
     Consider: it does not violate any Non-Negotiable (build/tests/no-forbidden-files all still
     hold), it is transparently disclosed with a removal note in the module doc rather than hidden,
     and its purpose (making the already-correctly-wired Loading state observable/testable, since
     `guards.tsx`'s placeholder resolves synchronously/near-instantly) is a reasonable engineering
     judgment call absent any PRD requirement forbidding it — but also weigh whether introducing any
     artificial delay not requested by any acceptance criterion is itself scope the worker shouldn't
     have added unilaterally. Give a reasoned verdict, not just a restatement of these considerations.
9. **D001-method forbidden-file check (file-tree comparison, never git history — standing rule from
   D001, see below).** Compare the current file tree directly against T016's Allowed Files
   (`src/pages/login/**`). Confirm: only `src/pages/login/LoginPage.tsx` and
   `src/pages/login/index.ts` exist as new files under `src/`; `src/app/router.tsx`,
   `src/app/guards.tsx`, `src/app/AppShell.tsx`, `src/components/nav/**` are all byte-unchanged
   (re-read them directly and compare against the T005/T006-verified content already on record, or at
   minimum confirm mtimes/content show no edit). No scratch/leftover files anywhere in `src/` — the
   worker's temporary Playwright harness must be confirmed genuinely gone, not just claimed gone. New
   `docs/swarm/active/*.md` packet files and a hook-appended `verification-log.md` line are always-
   expected background swarm-process artifacts — do not file these as a per-task finding (standing
   calibration rule from T004's close-out, see below).
10. **Build/typecheck/lint/format:check.** Run all four yourself and quote real, unparaphrased
    output — confirm 0 errors. Pre-existing `react-refresh/only-export-components` warnings (if any)
    are expected/non-blocking; only flag a *new* warning category or any error.

## Known Reachability Gap (context, not a T016 defect)
`/login` is not reachable via `npm run dev` navigation in the running app: `router.tsx`'s `/login`
route still renders its own inline `LoginPage()` placeholder (defined in `router.tsx` itself, lines
36–71), not this task's new component — `router.tsx` was correctly a forbidden file for T016. This is
why step 5 above requires you to build your own independent harness rather than navigating the live
app. Do not fail T016 for this reachability gap; T016's Allowed Files never included `router.tsx`,
and the component is complete and correct on its own terms regardless of whether anything currently
imports it.

## Two Dispute-Candidate Gaps — Note, Do Not Resolve, Not Blocking for T016's Verdict
The worker flagged two structural gaps in its output. Render your own independent read on each in
your checker output (the orchestrating session will use both reads to decide how to route them), but
**neither is a basis for failing T016** — T016's Allowed Files never included `router.tsx` or
`guards.tsx`, and this component is correct and complete on its own terms:
1. **`router.tsx` wiring gap.** Nothing currently imports `LoginPage` from `src/pages/login/**` into
   the live route table. Give your own view on whether this should be a small new ledger task or
   folded into T018 (`/accept-invite`, which will hit the identical gap when it's built).
2. **No real Supabase auth client exists anywhere in `src/`.** `guards.tsx`'s `login()`/
   `loginWithGoogle()` remain T005's synchronous/instant in-memory placeholders; no
   `@supabase/supabase-js` client has been instantiated by any task yet (grep confirmed zero hits for
   `createClient`/`supabase-js` under `src/`). Give your own view on whether this is adequately
   flagged as a future-task gap or needs escalation now.

## `guards.tsx` — Full Current Contents (for reference; re-open the real file yourself, do not trust this copy for your verdict)
```ts
export type Role = 'admin' | 'staff' | 'volunteer' | 'coach';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (user: AuthUser) => void;
  loginWithGoogle: () => Promise<AuthUser>;
  logout: () => void;
}
// ... AuthProvider (self-contained in-memory placeholder), useAuth(), setIntendedUrl/
// getIntendedUrl/clearIntendedUrl/consumeIntendedUrl(fallback = '/'), toast pub/sub,
// RequireAuth, RequireRole — see the real file for full bodies; this excerpt covers the
// contract surface LoginPage.tsx touches. Full file is 235 lines; read it directly.
```

## Relevant Constitution Excerpts

> **Non-Negotiables:** "The app must build successfully." / "Existing tests must pass unless the
> boss explicitly approves a test update." / "No worker may mark its own work complete." / "Every
> checker must inspect the actual artifact, not just the worker's summary."

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment.
> Conflicts are disputes for boss-arbiter — never improvised around.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR. The CLI is a cross-check, not a source.

> 12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12).
> Happy-path-only → MAJOR.

> 13. Wireframes are structural intent... Routes marked "template as-is" (PRD 7.1) get the named
> Astryx template; inventing custom layout there → MAJOR.

> 14. Copy follows PRD DES-14…16 (sentence case, named actions, prescribed empty/error text).

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

> **Failure Severity — BLOCKER:** "Cannot ship. Violates a core requirement, breaks the build,
> corrupts data, breaks security, breaks accessibility, or modifies forbidden files."
> **MAJOR:** "Should not ship without boss approval. Important functional, architectural, UX, or
> correctness issue." **MINOR:** "Acceptable for the current task but should become a follow-up
> task." **NIT:** "Cosmetic or preference-level issue. Does not block completion."

> **Decision rules:** BLOCKER fails the task. MAJOR fails the task unless the boss explicitly
> approves deferral. MINOR passes with a follow-up task. NIT passes and is logged only.

> **Definition of Done:** a task is done only when (1) the worker produces the requested change,
> (2) the checker validates the actual artifact, (3) the checker records evidence, (4) the foreman
> updates the task ledger, (5) the boss or foreman accepts the checked result.

> **D001 standing rule:** never use git history/commit diffs as evidence of which agent touched a
> file. Compare the task's Allowed Files list against the current file tree state directly.

> **T004 close-out calibration rule:** new `docs/swarm/active/*.md` packet files and hook-appended
> `verification-log.md` completion lines are always-expected background swarm-process artifacts —
> do not file these as a per-task finding.

## PRD Ground Truth (verbatim)

> **DES-08** Page scaffolding: start from Astryx **templates**, then adapt — Coach Home from
> `Analytics Dashboard`; `/login` from `Basic Login`; Reports tables from `Grouped Table`. Emit with
> `npx astryx template <name>`.

> **DES-12** Every async list screen has all four states specified: loading (`Skeleton`), empty
> (`EmptyState` with one action), error (`Banner status="error"` with retry), populated. Workers must
> implement all four; checkers verify.

> **AUTH-01** Supabase Auth with providers: email/password and Google OAuth. Public signups
> **disabled** in Supabase settings.

> **AUTH-02** `/login` (from `Basic Login` template): email + password fields, "Continue with Google"
> `Button variant="secondary"`, "Forgot password" link (Supabase reset email). No self-serve "Create
> account" link.

> Route table (Section 7): `/login | public | Basic Login | TextInput type="email/password", Button
> | AUTH-02`

> 7.1: "**Template as-is:** `/login` → `Basic Login` (fields per AUTH-02, VOLT wordmark above the
> card)..."

> **DES-14** Sentence case everywhere. Plain verbs. Buttons say what happens... never "Submit" or
> "OK".

> **DES-16** Errors say what happened and what to do... No apologies, no "Oops".

> **DES-17** WCAG 2.1 AA. ...Visible focus, labels on all inputs...

## Most Recent Failure
None — this is check attempt 1 for T016.

## Required Checker Output (per constitution Evidence Requirements)
- Files inspected (quote actual current contents of `LoginPage.tsx`, `index.ts`, and the relevant
  lines of `guards.tsx`/`router.tsx` you cross-checked).
- Exact commands run + real quoted output (not summarized/paraphrased) — including your own
  build/typecheck/lint/format:check re-run and your own Playwright harness session.
- Your own screenshots or equivalent independent evidence for the four DES-12 states, keyboard/focus,
  and both light/dark mode — not a re-statement of the worker's.
- Pass/fail per each of the 10 "Required Verification Steps" above.
- Explicit prop-by-prop cross-check table against `astryx-api.md`'s actual current line numbers.
- Explicit AUTH-02 grep result (must show zero matches).
- Explicit DES-12 four-state trace (state variable → conditional render, not narration).
- **Explicit verdict on judgment call (a)** — `Link`+`onClick` vs. `Button variant="ghost"` for
  "Forgot password" — acceptable or not, with reasoning.
- **Explicit BLOCKER/MAJOR/MINOR/NIT severity verdict on judgment call (b)** — the
  `SIMULATED_AUTH_LATENCY_MS` addition — with reasoning per the constitution's rubric.
- Your own independent read on both dispute-candidate gaps (router.tsx wiring, no Supabase client) —
  noted for the orchestrating session, explicitly not treated as blocking T016's own verdict.
- Confirmation your own temporary render harness was declared and deleted before finishing, with
  proof (e.g. `ls`/`find` showing it's gone).
- Overall pass/fail result for T016 as a whole.
- Exact failure reason(s), if any, with severity classification.
- Recommended next action (pass; rework by this worker; new follow-up task; or dispute to
  boss-arbiter — say which, and why).

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Inspect the actual files and generate your own independent
evidence via testing, rendering, and command runs. Do not flip `task-ledger.md` yourself — report
your verdict back; foreman-planner updates the ledger. T016 stays "In Progress" in the ledger until
your verdict is returned.
