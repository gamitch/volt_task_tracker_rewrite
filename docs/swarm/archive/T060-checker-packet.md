# Checker Packet: T060 (`/settings` screen) — Check Attempt 1

## Task ID
T060 — `/settings` screen (SET-01/02/03), Epic E9 (last piece of this epic).

## Checker Agent
checker-accessibility (per task-ledger.md T060 row).

## Objective
Verify five SET-01 sections in exact literal order (Profile, Appearance, Notifications, Calendar
feed, Danger zone), a real `Theme`-component doc-gap resolution, a genuinely distinct "Sign out
everywhere" action from `guards.tsx`'s single-device `logout()`, and a correct per-role
Notifications category mapping.

## Allowed Files (worker's literal permitted edit)
- `src/pages/settings/SettingsPage.tsx` (new)

**Scope flag**: worker also created `SettingsPage.test.tsx`, outside the literal Allowed Files line
— same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree — do NOT infer authorship from commit
messages. Confirm `SeasonSettings.tsx`, `SubscribePopover.tsx` (imported/rendered, not edited),
`App.tsx`, `src/theme/volt.ts`, `router.tsx`, `guards.tsx` (import-only) all untouched.

## IMPORTANT CONTEXT — a CI-caught bug was already fixed post-dispatch, orchestrator-side
After this worker's dispatch, a GitHub Actions CI run on the pushed commit caught a real test bug:
the `headingTexts()` helper in `SettingsPage.test.tsx` queried all `h1`/`h2` elements in the
container, but Astryx's `AlertDialog` mounts its title heading in the DOM even while CLOSED (the
same always-mounted pattern already independently noted for `Popover` in
`SubscribePopover.test.tsx`) — so "Reset your calendar link?" and "Sign out of every device?" (both
real `AlertDialog` titles, not page sections) were leaking into the section-order assertion. This
was fixed by scoping the query to exclude headings inside a `<dialog>` element, verified locally
(864/864 repo-wide) before being pushed. **Confirm this fix is present and correct as part of your
own verification** — it is not itself a defect requiring rework, but re-derive that the fix is
genuine and doesn't paper over any deeper problem.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`Theme` doc-gap resolution (Trap #2)** — claims `grep "^# Theme\b" astryx-api.md` returns zero
   matches (confirmed no doc section exists), resolved via `npm run astryx -- component Theme`:
   `theme: DefinedTheme` (required), `mode: 'light'|'dark'|'system'` (default `'system'`),
   `children` (required). Claims the Appearance `RadioList` persists to `profiles.theme_mode` via
   an injectable seam only — does NOT reach into the live `<Theme>` provider (forbidden `App.tsx`).
2. **"Sign out everywhere" (Trap #3)** — claims `guards.tsx`'s `logout()` is a one-line
   `setUser(null)`, no other-device concept. Claims the Danger zone's own
   `OnSignOutEverywhereFn` seam is AWAITED FIRST inside the confirm handler; only after it resolves
   does the code additionally call `logout()` as a disclosed CHAINED second step (since
   "everywhere" includes this device too) — never conflating the two, never silently calling only
   `logout()`. Claims a real `AlertDialog` with BEH-09 copy, `'destructive'` default kept.
3. **Per-role Notifications mapping (Trap #5)** — claims: student → 4 categories (no invite, no
   weeklyDigest/digestEnabled); parent → 5 (signupConfirm/eventReminder48h/eventReminder3h/
   weeklyDigest/digestEnabled, both digest columns rendered as distinct `Switch`es per T051's still-
   open ambiguity — **note**: George has since confirmed `digest_enabled` is vestigial/unused, this
   does not require rework, just note it for context); coach/admin → EMPTY array, claimed as a real,
   cited PRD gap (no EML-02 row names either role as a recipient) disclosed via an info `Banner`,
   not fabricated switches. Claims role sourced from loaded `profiles.role` (real `role_enum`), NOT
   `useAuth()` (whose stale `Role` type can't represent `student`/`parent`).
4. **"Settings template" investigation (Trap #8)** — claims no template literally named "Settings"
   exists; ran the real "Settings Form" CLI scaffold, found it uses `Layout`/`Grid`/`Divider`/
   `CheckboxInput`/`Typeahead`, NOT `Section`/`FormLayout`/`Switch`/`RadioList`, conflicting with
   PRD line 375's own literal component list for this route. Claims resolved per the established
   T016/T056 precedent (PRD's specific list wins over a conflicting generic CLI scaffold) — built
   with real `Section`/`FormLayout`/`Switch`/`RadioList` instead.
5. **`SubscribePopover` genuinely rendered, not reimplemented** — claims the real, already-Passed
   component is imported and used for the Calendar feed section.
6. Claims 24/24 own tests pass (post-fix); 864/864 repo-wide. typecheck/lint/build clean;
   `format:check` failure disclosed as isolated to pre-existing, untouched `Kiosk.tsx`.

## Required Verification Steps
1. **Read `SettingsPage.tsx` and `SettingsPage.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **Confirm the post-dispatch CI fix (see IMPORTANT CONTEXT above) is genuinely present and
   correct** — re-derive that excluding `<dialog>`-scoped headings is the right fix, not a
   workaround that hides a different real bug.
3. **`Theme` doc-gap — reproduce the CLI investigation yourself** (`npm run astryx -- component
   Theme`) and confirm the claimed prop shape is accurate.
4. **"Sign out everywhere" — the central safety-adjacent check.** Confirm by source read that the
   injectable seam is genuinely awaited BEFORE `logout()` is called, and that a rejection genuinely
   prevents `logout()` from firing (reproduce the test). Confirm `guards.tsx`'s real `logout()`
   implementation matches the worker's "one-line `setUser(null)`" characterization.
5. **Per-role Notifications mapping — cross-check against the PRD's real EML-02 table yourself**
   (read it directly, don't trust the worker's transcription), including confirming the coach/admin
   empty-set finding is genuine (re-derive from the table, don't just accept the claim) and that
   `invite` is correctly never shown for any role.
6. **"Settings template" investigation — reproduce the CLI scaffold check yourself** and confirm
   the claimed component mismatch (Layout/Grid/etc. vs. Section/FormLayout/Switch/RadioList) is
   real, and that the resolution (PRD's specific list wins) is consistent with the established
   T016/T056 precedent.
7. **`SubscribePopover` — confirm it's genuinely imported and rendered**, not a parallel
   reimplementation (grep for a second `SubscribePopover`-shaped component defined locally).
8. **Astryx prop citations** — spot-check `Section`, `FormLayout`, `FileInput`, `Switch`,
   `RadioList`, `AlertDialog`, `Banner` against `astryx-api.md`.
9. **Test-file scope question** — render an explicit verdict, independently re-derived.
10. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts
    without your own run. Confirm the `format:check` failure is genuinely isolated to `Kiosk.tsx`.
11. **Accessibility read of the actual UI** (this task's checker is checker-accessibility): keyboard
    navigation through all five sections and both `AlertDialog`s; visible focus; no hardcoded hex
    colors; the `id="notifications"` anchor target genuinely present and correctly placed for
    EML-04's hash-link requirement.
12. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface. *(Cited because Traps
  #2 and #8 are exactly this rule in action.)*
- Item 13: templates used as-is; adapt content only, do not invent a custom layout.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the "Sign out everywhere" seam-before-logout ordering
- explicit verdict on the per-role Notifications mapping's PRD-fidelity (incl. the coach/admin gap)
- explicit verdict on the "Settings template" resolution
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
