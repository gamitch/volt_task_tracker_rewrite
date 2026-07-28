# Checker Packet: T018 (`/accept-invite` screen) — Check Attempt 1

## Task ID
T018 — `/accept-invite` screen (AUTH-03 step 3, DES-12)

## Checker Agent
checker-accessibility (per task-ledger.md T018 row)

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop
Limit"). First check on this task — no prior checker verdict exists. Full task context:
`docs/swarm/active/T018-worker-packet.md`. This mirrors T016's (`/login`) checker packet in rigor
— read `docs/swarm/archive/T016-checker-packet.md` for the established pattern/precedent this
packet builds on (T018 was explicitly told to mirror T016's approach).

## What This Check Covers
Full first-pass verification of a new task: `Login Card` template-as-is compliance (constitution
item 13), Astryx prop cross-check (re-verify every citation yourself, don't trust them), DES-12
four-state mapping (must be real, traced state, not a comment), independent live-render evidence
via your own temporary Playwright harness (page is not reachable through the running app yet —
see "Known Reachability Gap" below, not a defect), keyboard/focus verification in both modes,
`guards.tsx` submission wiring, no self-serve signup / no box-drawing characters, forbidden-file
boundary, and a standard build/typecheck/lint/format:check re-run. Also required: your own
independent read on the two dispute-candidate gaps and the AUTH-05/Role mismatch handling — **none
of these three are part of T018's own pass/fail verdict** (see "Dispute Candidates" section).

## Worker's Claimed Changes (do not trust — verify independently)
1. New `src/pages/accept-invite/AcceptInvitePage.tsx`, `types.ts`, `index.ts`. No other files
   touched.
2. Astryx `Login Card` template adapted (not invented) via `Center > VStack > [Heading "VOLT"] >
   Card > [Spinner | error Banner | status Banner | form]`, cross-checked against
   `npm run astryx -- template login-card --skeleton`. Claims AUTH-03 step 3's literal
   field/action list (one "Continue with Google" secondary button, no second TextInput+Link row,
   no generic footer sign-up affordance) correctly overrides the generic template skeleton's extra
   slots, and that omitting the generic footer specifically avoids reproducing a "Sign up" link
   (AUTH-01 forbids public signup).
3. Claimed DES-12 four-state mapping: Empty = invite resolved `'pending'`, blank fields, no
   banner; Loading = (a) initial `loadInvite` lookup on mount → `Spinner`, (b) submit-in-flight
   for either completion path → `Button isLoading` / `clickAction` pending; Error = (a) invite
   resolves `'expired'`/`'revoked'`/`'accepted'` → `Banner` replacing the form, (b) `loadInvite`
   itself rejects → `Banner` with a `Retry` action, (c) failed submit/Google → `Banner` inside the
   still-rendered form; Populated = matching password/confirm typed against a `'pending'` invite,
   no separate success render (navigates away via `consumeIntendedUrl`).
4. Data-loading seam: `types.ts` defines `AcceptInviteData { name, email, role: InviteRole,
   status: InviteStatus }` and `LoadInviteFn = (token) => Promise<AcceptInviteData>`, consumed via
   an optional `AcceptInvitePageProps.loadInvite` prop defaulting to an obviously-fake
   `defaultLoadInvite` (returns a hardcoded fixture after a simulated delay, never calls
   Supabase). Worker claims this was necessary because `invites` RLS is `staff_all`-only (no
   anon/non-staff read policy) and `invites` has no `name` column at all.
5. Submission wiring: `completeSignUp()` calls `login({ id, email: inviteData.email, role:
   PLACEHOLDER_SIGN_IN_ROLE })` then `navigate(consumeIntendedUrl('/'), { replace: true })`, called
   from both the password-form submit handler and the Google handler — both imported read-only
   from `../../app/guards`. `PLACEHOLDER_SIGN_IN_ROLE: Role = 'staff'` is used for every invite
   regardless of the invite's real displayed role (see AUTH-05/Role mismatch section below).
6. A disclosed, non-PRD `SIMULATED_ASYNC_LATENCY_MS = 350` constant, same category/reasoning as
   T016's identical constant.
7. Worker claims: no self-serve signup affordance anywhere; a temporary render-harness file (and
   two scratch driver scripts at repo root) were created for evidence, then deleted before
   handoff; `router.tsx`/`guards.tsx`/`AppShell.tsx`/nav components/`supabase/**` all untouched;
   build/typecheck/lint/format:check all exit 0.
8. Worker flags three items explicitly rather than working around them: (a) router.tsx wiring gap
   (dispute candidate), (b) invite-data-loading seam / no real backend channel exists (dispute
   candidate), (c) AUTH-05 `InviteRole` vs. `guards.tsx`'s stale `Role` type mismatch (handling
   decision, not a dispute — see below).

## Astryx Ground Truth — Re-verify Every Line Yourself (I independently opened these — cross-check again, don't trust this packet either)
Do not trust the worker's, this packet's, or any prior citations. Re-open
`docs/swarm/astryx-api.md` at each location below yourself. Flag any prop used in
`AcceptInvitePage.tsx` that you cannot find documented there as MAJOR (constitution item 2).

- **Center** (`astryx-api.md` "# Center" section, props table ~lines 76-87). Worker uses
  `axis="both"`, `height="100vh"`, `width="100%"`. `axis` line 80, `width` line 81, `height`
  line 82 — all present. Doc's own "Do: set a height when centering vertically" (line 71)
  satisfied via `height="100vh"`.
- **VStack** (`astryx-api.md:374-396`). Worker uses `gap={4}` / `gap={6}` / `gap={1}` (always a
  JSX number, never a string, per the doc's explicit warning at line 380) and `hAlign="center"`
  (outer stack only, line 389). Confirm no string-literal `gap` anywhere.
- **Heading** — doc's own `### Heading` entry literally says "undefined" (line 884, a known
  documentation gap, same class as T016's citation of this same gap). The only real ground truth
  for `level` is `Text`'s best-practices prose (line 856: "Use Heading with a `level` prop (1–6)
  for section titles and headings") and the "don't skip heading levels" rule (line 853). Worker
  uses `<Heading level={1}>VOLT</Heading>` (page's only h1) and, inside the ready/pending form
  branch, `<Heading level={2}>{inviteData.name}</Heading>`. **Verify independently**: does h1
  "VOLT" → h2 invitee-name violate or satisfy "go h1 then h2 then h3, never h1 then h3"? Render an
  explicit verdict (T016's checker faced the identical question for "VOLT" → "Reset your
  password" and ruled it acceptable as siblings-in-spirit, not a literal outline chain — decide if
  the same reasoning transfers here, or if using the invitee's actual *name* as a heading level 2
  changes the analysis).
- **Text** (`astryx-api.md:858-878`, `type` prop line 862). Worker uses
  `<Text type="supporting">`. Confirm `'supporting'` is a documented enum value (it is, line 862)
  and no `variant` prop is used anywhere (doc explicitly forbids it, line 855/875).
- **Card** (`astryx-api.md:2973-2983`). Worker uses `width={400}`, `maxWidth="100%"`,
  `padding={6}`, `variant="default"`. All four documented at lines 2977-2983; `padding={6}` is a
  valid enum member (line 2982); `variant="default"` is the explicit documented default.
- **TextInput** (`astryx-api.md:1652-1675`). Worker uses `type="password"` (both fields), `label`,
  `value`, `onChange`, `isRequired`, `hasAutoFocus` (password field only), `htmlName`, `status`.
  All at lines 1656-1675. Confirm `status`'s shape (`{type:'error'|'warning'|'success',
  message?}`, line 1672) matches how the worker constructs it
  (`{ type: 'error', message: fieldErrors.password }`) exactly, and that `hasAutoFocus` is set on
  exactly one field (password, not confirm-password) — confirm this doesn't fight the browser's
  own tab order.
- **Button** (`astryx-api.md:1807-1827`). Worker uses `type="submit"` (Set password),
  `variant="primary"`/`"secondary"`/`"ghost"`, `label`, `isLoading` (Set password only),
  `clickAction` (Google button and the load-error Retry button). All documented at lines
  1811-1827. Confirm the doc's "no more than one primary button per view" rule (line 1803) holds
  — exactly one `variant="primary"` Button ("Set password") should exist in any single rendered
  state; the Retry button (`variant="ghost"`) and Google button (`variant="secondary"`) never
  co-render with it simultaneously (Retry only shows in the `inviteLoadState==='error'` branch,
  which is mutually exclusive with the form branch) — verify this mutual exclusivity directly from
  the JSX branches, not by assumption.
- **Banner** (`astryx-api.md:2743-2757`). Worker uses `status="error"` (all three uses),
  `title`, `description`, `container="card"`, and `endContent` (only on the load-error Banner, a
  `Button variant="ghost" label="Retry"`). All documented at lines 2747-2757. Confirm `title` is
  always supplied (doc line 2748 marks it required) — check all three Banner call sites in the
  file. Confirm `container="card"` matches the doc's guidance (line 2737) since all three Banners
  render inside the page's `Card`, never full-page.
- **Divider** (`astryx-api.md:559-567`). Worker uses `label="or"` between the "Set password" and
  "Continue with Google" buttons. `label` documented at line 564.
- **Spinner** (`astryx-api.md:5826-5834`). Worker uses `label="Loading your invite…"` during the
  initial invite lookup. `label` documented at line 5832; confirm the string label auto-sets
  `aria-label` per the doc's own note (same line) — i.e. no separate `aria-label` prop was needed
  or added redundantly.

## `Login Card` Template-as-Is Compliance (constitution item 13, PRD 7.1)
The worker claims a CLI cross-check (`npm run astryx -- template login-card --skeleton`) confirmed
the Center/VStack/Card skeleton and primary-button→Divider→secondary-button(s) shape, and that it
deliberately dropped the generic template's second TextInput+Link row and outer footer
`VStack[Text, Link, Link]` slot, reasoning that (a) AUTH-03's literal 3-field spec (name+role
display, password+confirm, one Google button) overrides the generic skeleton's extra slots, and
(b) the footer slot is generically a "Sign up" affordance which AUTH-01 (public signup disabled)
forbids reproducing anywhere. **Re-run the CLI command yourself** and confirm the claimed skeleton
output is real, not fabricated. Then render an explicit verdict: is dropping those two slots a
legitimate "adapt content, not layout" application of AUTH-03's field list (constitution item 13
permits content adaptation), or does it cross into "inventing a custom layout" by structurally
removing template slots? Also confirm the VOLT wordmark choice (`Heading level={1}` above the
`Card`, not the CLI skeleton's `Icon+Text` logo row) is consistent with `LoginPage.tsx`'s own
established choice — re-open `src/pages/login/LoginPage.tsx` yourself to confirm this claim, don't
trust the worker's citation of its own prior work.

## No Self-Serve Signup / No Box-Drawing Characters — Full-Text Grep Required
Run an actual grep (not a skim) across the full text of all three new files for `Create account`,
`Sign up`, `Signup`, `Register`, `create an account`, and any case-insensitive variant, plus a
manual re-read of every visible string literal (headings, button labels, banner copy, helper text)
for anything that could function as a self-serve signup affordance even if not literally one of
those phrases — same AUTH-01/AUTH-02 concern T016 was held to. Separately grep for box-drawing/
bracket placeholder characters (`─│┌┐└┘├┤┬┴┼`, or bracketed placeholder-looking text like
`[TODO]`/`[PLACEHOLDER]`) rendered anywhere in JSX output (not in code comments, which are fine)
per constitution item 13. **Must be zero matches in rendered output for both categories.**

## DES-12 Four-State Mapping — Trace the Actual Code, Not the Module Doc Comment
The module doc atop `AcceptInvitePage.tsx` (lines 76-118) *describes* a four-state mapping, but a
comment is not evidence — trace the real state variables (`inviteLoadState`, `inviteData`,
`inviteStatusError`, `isSubmitting`, `formError`, `fieldErrors`) and their real conditional
renders (lines 370-472):
- **Loading, sub-case (a)**: confirm `inviteLoadState === 'loading'` genuinely renders the
  `Spinner` branch (line 376-380) and that this is the *only* render when true (i.e. the form/
  error branches are correctly gated to not also render).
- **Loading, sub-case (b)**: confirm `isSubmitting` drives the "Set password" Button's
  `isLoading` (line 456) and that the Google Button's `clickAction` binding means its own internal
  pending state covers its loading UI — re-verify from the Button ground truth above (line 1827:
  "Shows loading state while the returned promise is pending"), not from memory.
- **Error, sub-case (a)**: confirm `getInviteStatusError` (lines 230-254) is a real exhaustive
  switch over all four `InviteStatus` members, confirm `'pending'` returns `null` (not an error),
  and confirm the three non-null cases render via the `inviteLoadState==='ready' && inviteData &&
  inviteStatusError` branch (lines 394-401) which replaces the form entirely. Read the actual DES-16
  copy strings used (lines 236-247) and judge them yourself against DES-16 ("what happened + what
  to do", no apologies) — don't just trust the worker's own claim that they comply.
- **Error, sub-case (b)**: confirm the `runLoadInvite` `.catch()` block (lines 284-290) sets
  `inviteLoadError` and `inviteLoadState('error')` only on a genuine promise rejection from
  `loadInvite`, distinct from a domain-valid non-pending status answer (sub-case a) — these are
  two different render branches (lines 382-392 vs. 394-401), confirm they're correctly
  mutually-exclusive via the `inviteLoadState` discriminant.
- **Error, sub-case (c)**: confirm `formError` is cleared at the top of each new submit attempt
  (`setFormError(null)` at line 313 and 356) so it can't linger stale, and that both the password
  submit `catch` (lines 345-349) and Google `catch` (lines 360-365) set it on genuine failure only.
  Confirm the field-level validation failure path (lines 315-332) *also* sets a `formError` banner
  in addition to `fieldErrors` — read lines 326-331 directly and confirm this dual
  banner+field-status pattern is real, not just claimed.
- **Populated/success**: confirm there is no separate in-page "success" render — trace
  `completeSignUp()` (lines 299-309) and confirm both the password-submit success path and the
  Google success path call it, and that it navigates away via `consumeIntendedUrl` rather than
  rendering any in-page success UI (matches T016's identical pattern — re-confirm this claim
  against `LoginPage.tsx` yourself rather than trusting the citation).

## Required Verification Steps
1. **Read the actual files in full.** `AcceptInvitePage.tsx`, `types.ts`, `index.ts` — do not rely
   on the worker's packet, its own module-doc comments, or this checker packet's paraphrasing.
2. **Astryx prop cross-check.** Per the ground-truth section above — re-open `astryx-api.md`
   yourself at each cited line; flag any undocumented prop as MAJOR.
3. **`Login Card` template-as-is compliance.** Per the section above — re-run the CLI yourself,
   render an explicit verdict on the dropped-slots question.
4. **No self-serve signup / no box-drawing characters.** Per the grep instructions above — zero
   matches required.
5. **DES-12 four-state mapping.** Per the tracing instructions above — must be real, wired states,
   not narration.
6. **Independent live-render evidence (your own temporary Playwright harness).** The page is not
   reachable via `npm run dev` navigation (see "Known Reachability Gap" below — not this task's
   fault; `router.tsx` was correctly forbidden). Build your **own** standalone, temporary render
   harness (real browser via the pre-installed Playwright chromium, not jsdom-only) that mounts
   `<AcceptInvitePage loadInvite={...} />` wrapped in whatever minimal providers it needs
   (`AuthProvider` from `guards.tsx`, `MemoryRouter` with a `?token=` query param, `Theme`,
   `LayerProvider` — all read-only imports). Supply your **own** fixture `loadInvite`
   implementations (don't reuse the worker's `defaultLoadInvite` fixture verbatim) to independently
   reproduce every state: loading (never-resolving promise), load-error (rejecting promise),
   `pending`/ready-to-submit, `expired`, `revoked`, `accepted`, submit-in-flight, and a field-error
   case (mismatched passwords) — in both light and dark mode. **Do not just trust the worker's
   screenshot claims.** Declare the harness file's purpose in its own header comment and **delete
   it before finishing** — confirm deletion explicitly (e.g. `ls`/`find` showing it's gone) in your
   output, same standard the worker was held to. Also confirm the worker's own harness and two
   scratch driver scripts are genuinely gone (worker claims this — verify, don't trust).
7. **Keyboard walkthrough + visible focus, independently, both modes.** Using real `KeyboardEvent`
   dispatch (or equivalent Playwright real keyboard interaction) against your own harness in the
   `pending` ready-to-submit state: confirm Tab order Password (auto-focused first) → Confirm
   password → "Set password" button → "Continue with Google" button, Enter submits the form from
   either password field, and a visible focus indicator renders on every interactive element in
   both light and dark mode. BLOCKER if any keyboard path is broken or focus isn't visible
   (constitution item 15).
8. **`guards.tsx` submission-wiring verification.** Read `src/app/guards.tsx` directly (not a
   cached copy) and confirm `completeSignUp`/`handleSetPassword`/`handleGoogleSignIn` genuinely
   match the existing contract shape: `login(user: AuthUser)` is synchronous, takes an
   already-built object — worker calls `login({ id, email: inviteData.email, role:
   PLACEHOLDER_SIGN_IN_ROLE })`, matching; `loginWithGoogle(): Promise<AuthUser>` — worker `await`s
   it, matching; `consumeIntendedUrl(fallback='/')` — worker calls with `'/'` matching the default.
   Cross-check this against `LoginPage.tsx`'s established wiring pattern (T016, already Passed) to
   confirm this is a faithful mirror, not a divergent reinvention.
9. **AUTH-05/`Role` mismatch handling — render an explicit verdict.** The worker did not attempt a
   partial/silent role-vocabulary mapping; it used the flat `PLACEHOLDER_SIGN_IN_ROLE: Role =
   'staff'` (same constant class T016 already established) for every invite regardless of the
   invite's real displayed `InviteRole`, and documented this explicitly in both files' module docs
   rather than quietly coercing. Confirm this is genuinely disclosed (re-read the actual doc
   comments, lines 58-73 of `AcceptInvitePage.tsx` and lines 39-45 of `types.ts`) and render your
   own verdict: is "use the same placeholder every time, documented" an acceptable interim posture
   given `guards.tsx` is forbidden and has no `student`/`parent` vocabulary member at all, or does
   it warrant a MINOR/MAJOR finding of its own? (T018's packet explicitly pre-authorized this
   exact posture per Known Context/Traps #4 — confirm the worker's implementation matches what was
   pre-authorized, don't re-litigate whether the posture itself was wise.)
10. **D001-method forbidden-file check (file-tree comparison, never git history).** Compare the
    current file tree against T018's Allowed Files (`src/pages/accept-invite/**`). Confirm: only
    the three claimed files exist as new; `src/app/router.tsx`, `src/app/guards.tsx`,
    `src/app/AppShell.tsx`, `src/components/nav/**`, and `supabase/**` are all byte-unchanged (diff
    or checksum against the current Passed state, don't just eyeball). No leftover scratch files
    anywhere in the repo (the worker claims a harness file under
    `src/pages/accept-invite/__verification_harness__.tsx` plus two scratch driver scripts at repo
    root were all deleted — verify this directly). New `docs/swarm/active/*.md` packet files and a
    hook-appended `verification-log.md` line are always-expected background artifacts — do not
    file these as a per-task finding (standing calibration rule).
11. **Build/typecheck/lint/format:check.** Run all four yourself and quote real, unparaphrased
    output — confirm 0 errors. The same 8 pre-existing `react-refresh/only-export-components`
    warnings (if present) are expected/non-blocking; only flag a *new* warning category or error.

## Known Reachability Gap (context, not a T018 defect)
`/accept-invite` is not reachable via `npm run dev` navigation: `router.tsx`'s route still renders
its own inline `AcceptInvitePage()` placeholder (defined in `router.tsx` itself), not this task's
new component — `router.tsx` was correctly a forbidden file for T018, same as T016. Do not fail
T018 for this; T018's Allowed Files never included `router.tsx`, and the component is complete and
correct on its own terms regardless of whether anything currently imports it.

## Dispute Candidates — Note, Do Not Resolve, Not Blocking for T018's Verdict
Render your own independent read on each for the orchestrating session to use when routing, but
**none is a basis for failing T018** — its own Allowed Files never included `router.tsx` or a
backend data channel, and the component is correct and complete on its own terms:
1. **`router.tsx` wiring gap.** Same shape as T016's identical gap (T016a resolved it as a small
   follow-up task). Give your own view on whether T018 needs its own equivalent wiring task, or
   whether one combined task should wire both `/login` and `/accept-invite`'s remaining placeholder
   (T016's own gap was already resolved by T016a — confirm whether `/accept-invite`'s inline
   placeholder in `router.tsx` is the *only* remaining placeholder-wiring gap left, or if there are
   others).
2. **Invite-data-loading seam.** No mechanism exists anywhere in the repo to supply real
   "invitee name + role" data to this page (RLS forbids a direct frontend read of `invites`, and
   `invites` has no `name` column regardless — a real implementation needs a server-side join
   against `profiles`/`students`). Give your own view on whether this warrants a dedicated new
   ledger task (e.g. a read-only Edge Function keyed by invite token) now, or should stay a
   documented gap until something downstream needs it resolved.

## `guards.tsx` — Relevant Contract Surface (reference only; re-open the real file yourself)
```ts
export type Role = 'admin' | 'staff' | 'volunteer' | 'coach';
export interface AuthUser { id: string; email: string; role: Role; }
// login(user: AuthUser): void -- synchronous, in-memory placeholder (T005).
// loginWithGoogle(): Promise<AuthUser>
// consumeIntendedUrl(fallback = '/'): string
// useAuth(), RequireAuth, RequireRole -- full file is ~235 lines, read it directly.
```

## Relevant Constitution Excerpts
> **Non-Negotiables:** "The app must build successfully." / "No worker may mark its own work
> complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment.
> Conflicts are disputes for boss-arbiter — never improvised around.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR. The CLI is a cross-check, not a source.

> 12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12).
> Happy-path-only → MAJOR.

> 13. Wireframes are structural intent... Routes marked "template as-is" (PRD 7.1) get the named
> Astryx template; inventing custom layout there → MAJOR. No box-drawing/bracket placeholder
> characters may render in the DOM.

> 14. Copy follows PRD DES-14…16 (sentence case, named actions, prescribed empty/error text).

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

> **Failure Severity — BLOCKER:** cannot ship; violates a core requirement, breaks the build,
> corrupts data, breaks security, breaks accessibility, or modifies forbidden files. **MAJOR:**
> should not ship without boss approval. **MINOR:** acceptable now, becomes a follow-up task.
> **NIT:** cosmetic, does not block.

> **D001 standing rule:** never use git history as evidence of file authorship. Compare Allowed
> Files against the current file tree directly.

## PRD Ground Truth (verbatim)
> **AUTH-03 Invite flow (the only way in):**
> 1. Admin/Coach creates a roster entry... and clicks **Send invite**.
> 2. Edge Function `send-invite` creates an `invites` row and calls Supabase `inviteUserByEmail`...
> 3. Recipient lands on `/accept-invite`: shows their name + role, choice of "Set a password" or
>    "Continue with Google".
> 4. On first successful sign-in, a DB trigger matches `auth.users.email` to the pending invite...

> **AUTH-06** Invites expire after 14 days; `/roster` shows status (Pending / Accepted / Expired)...

> 7.1: "**Template as-is:** ... `/accept-invite` → `Login Card` pattern..."

> **DES-12** Every async screen has all four states specified: loading, empty, error, populated.

> **DES-16** Errors say what happened and what to do... No apologies, no "Oops".

## Most Recent Failure
None — this is check attempt 1 for T018.

## Required Checker Output (per constitution Evidence Requirements)
- Files inspected (quote actual current contents you relied on, not paraphrases).
- Exact commands run + real quoted output (build/typecheck/lint/format:check, your own Playwright
  harness session, your own CLI re-run of the template skeleton command).
- Your own screenshots/equivalent evidence for all 8 states listed in step 6, plus keyboard/focus,
  in both light and dark mode.
- Pass/fail per each of the 11 "Required Verification Steps" above.
- Explicit prop-by-prop cross-check table against `astryx-api.md`'s actual current line numbers.
- Explicit signup/box-drawing grep result (zero matches required).
- Explicit DES-12 four-state trace (state variable → conditional render, not narration).
- Explicit verdict on the `Login Card` dropped-slots question (constitution item 13).
- Explicit verdict on the Heading level={1}→level={2} nesting question.
- Explicit verdict on the AUTH-05/Role mismatch handling (step 9).
- Your own independent read on both dispute candidates — noted for the orchestrating session,
  explicitly not treated as blocking T018's own verdict.
- Confirmation your own temporary render harness was declared and deleted, with proof.
- Overall pass/fail result for T018 as a whole.
- Exact failure reason(s), if any, with severity classification.
- Recommended next action (pass; rework by this worker; new follow-up task; or dispute to
  boss-arbiter — say which, and why).

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Inspect the actual files and generate your own independent
evidence via testing, rendering, and command runs. Do not flip `task-ledger.md` yourself — report
your verdict back; foreman-planner updates the ledger. T018 stays "In Progress" until your verdict
is returned.

---
**ARCHIVED** 2026-07-19 — closed out as part of T018 PASS close-out.
