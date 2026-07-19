# Worker Packet: T060

## Task ID
T060 — `/settings` screen (SET-01/02/03), Epic E9 (last piece of this epic).

## Objective
Build `src/pages/settings/SettingsPage.tsx`: sections per SET-01's own literal order — Profile
(display name, avatar upload via `FileInput`), Appearance, Notifications, Calendar feed, Danger
zone (Sign out everywhere).

## Dependencies (status)
- T029 (Season management) — Passed. Read `src/pages/settings/SeasonSettings.tsx` (read-only) —
  it already lives under `src/pages/settings/` and establishes conventions for this directory
  (admin-only gating pattern, `AlertDialog`-confirmed destructive actions, `DateRangeInput`/
  `NumberInput` citations). This task is `all`-role (per PRD's own route table, line 375 — no role
  restriction), so do NOT copy its `RequireRole` gating — only its file-organization conventions.
- T046 (Subscribe popover + reset link) — Passed. **Read `SubscribePopover.tsx` in full
  (read-only)** — SET-01's own literal text says "Calendar feed section reuses T046's Subscribe
  control." That component is a self-contained widget (not a page) — import it directly (it is a
  Forbidden File to EDIT, but importing/rendering an already-Passed sibling component is the
  established, expected reuse pattern this exact task calls for, distinct from the "read-only,
  reimplement don't import" posture used for files this task would otherwise conflict with).
- T048 (Resend integration) — Passed. Read `src/emails/layout/constants.ts` (read-only) for
  `MANAGE_PREFERENCES_PATH = '/settings#notifications'` — EML-04 requires every email footer link
  to land here; confirm your Notifications section is addressable via that exact hash fragment
  (a real `id="notifications"` on the right section, or equivalent anchor target).

## Allowed Files
- `src/pages/settings/SettingsPage.tsx` (new)
- A colocated `SettingsPage.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/settings/SeasonSettings.tsx` — read-only reference only.
- `src/pages/calendar/SubscribePopover.tsx` — import and render directly (see Dependencies above);
  do not edit its source.
- `src/App.tsx`, `src/theme/volt.ts` — read-only reference only. `App.tsx` currently mounts
  `<Theme theme={voltTheme}>` with NO `mode` prop wired at all (confirmed by reading it) — this
  task builds the Appearance control but does NOT wire real live theme-switching into the running
  app (that requires editing `App.tsx`, forbidden here); disclose this gap explicitly, same posture
  as every prior settings-adjacent task's "control built, real backend wiring is a future task" gap.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only, `useAuth`/`logout`/`pushToast` imports
  permitted) — read-only. Not wired into any route by this task.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against
  injectable `loadSettingsData`/`onUpdateProfile`/`onChangeTheme`/`onToggleNotificationPref`/
  `onSignOutEverywhere`-style seams with obviously-fake fixture defaults.
- `supabase/migrations/**` — read-only. No Supabase Storage bucket exists/is configured anywhere in
  this repo — the avatar `FileInput`'s real upload target is out of scope; build the control with an
  injectable `onUploadAvatar`-style seam, disclosed as not-yet-backed-by-real-storage.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
- `profiles`: `id`, `display_name`, `email`, `role`, `avatar_url`, `theme_mode` (text, not null,
  default `'system'`) — `20260716000000_identity_roster.sql` lines 16-24.
- `notification_prefs`: `profile_id` (fk, unique), `invite`, `signup_confirm`,
  `event_reminder_48h`, `event_reminder_3h`, `meeting_reminder_3h`, `weekly_digest`,
  `digest_enabled` (all boolean, default true) — `20260717000001_support_audit.sql` lines 26-41.
  **Note**: T051's checker flagged a real, still-open ambiguity about what `digest_enabled` is
  for versus `weekly_digest` — this task doesn't need to resolve that ambiguity, just render both
  as real, distinctly-labeled `Switch` controls (don't collapse them into one control or silently
  drop either).

## Known Context / Traps

**1. SET-01's literal section order — Profile, Appearance, Notifications, Calendar feed, Danger
zone.** Cite this order verbatim; don't reorder for any other reason (e.g. don't put Danger zone
first even though some design conventions favor that — SET-01's own text is explicit).

**2. `Theme` component's real `mode`/theme-switching prop shape is UNDOCUMENTED in
`astryx-api.md` — confirmed by direct grep, zero `# Theme` section exists anywhere in that file,**
even though `Theme` is already imported and used in `App.tsx` (forbidden, read-only). This is the
same class of doc-gap trap as `Tab`/`Heading`/`SegmentedControlItem` in prior tasks — resolve it via
`npm run astryx -- component Theme` and/or reading the installed `node_modules/@astryxdesign/core`
source directly, never guess a prop name. Cite exactly what you find. This task's own Appearance
control (`RadioList` System/Light/Dark) writes to `profiles.theme_mode` via your injectable
callback — it does NOT need to itself control the live `<Theme>` provider (that's the forbidden-file
wiring gap disclosed above), but you should still know and cite the real prop shape so a future
wiring task has accurate information to work from.

**3. "Sign out everywhere" — NOT the same as `guards.tsx`'s plain `logout()`.** Read `guards.tsx`
(read-only, import-only) yourself: `logout()` only clears this device's local auth state — it has
no concept of revoking sessions on OTHER devices (that would be a real Supabase Auth
`signOut({scope:'global'})`-style call, which requires the not-yet-wired shared Supabase client).
Your Danger zone's "Sign out everywhere" action must be built against its own injectable
`onSignOutEverywhere`-style callback, explicitly disclosed as distinct from `guards.tsx`'s
single-device `logout()` — do not silently call `logout()` and claim it satisfies "everywhere."
Confirm via a real `AlertDialog` (a real destructive, hard-to-undo action affecting every device).

**4. Avatar `FileInput` → Supabase Storage — no storage bucket exists anywhere in this repo yet**
(confirmed: no migration references `storage.buckets`, no `src/lib/supabase/**` storage helper
exists). Build the real `FileInput` control (real `accept`/`maxSize` props cited from
`astryx-api.md`) wired to an injectable `onUploadAvatar`-style callback with an obviously-fake
default — disclose this is a UI-only control today, same posture as every prior data-seam gap in
this batch.

**5. Notifications section — `Switch` per EML-02 category relevant to the ROLE, plus a
parent-only digest on/off toggle (SET-02's own literal wording).** This means the exact set of
`Switch` controls shown must vary by the viewer's role (a coach/admin/student wouldn't see a
"weekly digest" toggle framed as parent-specific the same way a parent would — decide and disclose
your exact per-role category mapping, citing EML-02's own trigger/recipient table for which
category is "relevant" to which role). Use your injectable auth/role seam (same pattern every
prior task in this batch uses) to drive this.

**6. Appearance — `RadioList` System/Light/Dark, persists to `profiles.theme_mode` (a real text
column, not an enum-typed one at the DB level, so validate the three literal string values
client-side).**

**7. EML-04 addressability — the Notifications section must be reachable via the literal
`/settings#notifications` hash** (cited from `src/emails/layout/constants.ts`,
`MANAGE_PREFERENCES_PATH`, read-only). Since this page isn't wired into `router.tsx` yet (same
recurring gap every not-yet-built route has), you can't prove the full hash-navigation flow
end-to-end — but the section's own DOM `id` should match exactly so a future wiring task's
hash-scroll-to behavior works correctly once the route exists. State this explicitly.

**8. Template fidelity (constitution item 13)** — PRD line 375/385 names a real "Settings template"
(`FormLayout`, `Switch`, `RadioList`) — investigate whether a real Astryx template by that name
exists (`npm run astryx -- template --list`, same cross-check discipline every prior template-named
task has used) and cite what you find; if no exact "Settings" template exists (same class of gap as
T016's "Basic Login"/T056's "Grouped Table"), compose the real, documented `FormLayout`/`Section`
primitives instead and disclose the resolution.

**9. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page; injectable `loadSettingsData` seam with an obviously-fake
fixture default covering all five sections' initial state.

## Acceptance Criteria
- Five sections in SET-01's exact literal order.
- Real `FileInput` avatar upload control (UI-only, disclosed), real display-name field.
- Real `RadioList` Appearance control writing to `profiles.theme_mode`, with the `Theme` component's
  real prop shape investigated and cited (even though live wiring is out of scope).
- Notifications section shows role-appropriate `Switch` controls per EML-02, plus the parent-only
  digest toggle; both `weekly_digest` and `digest_enabled` rendered as distinct real controls.
- Calendar feed section renders the real, imported `SubscribePopover` component, not a
  reimplementation.
- Danger zone "Sign out everywhere" is a real, distinct callback from `guards.tsx`'s `logout()`,
  confirmed via a real `AlertDialog`.
- Notifications section addressable via a real `id="notifications"` matching
  `MANAGE_PREFERENCES_PATH`.
- Template-fidelity investigation (constitution item 13) explicitly disclosed.
- No box-drawing/bracket characters (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR. *(Cited directly because of Trap #2's `Theme`-component doc
> gap — this is the highest-risk finding a checker will look for on this task.)*

> 13. Templates are used as-is; adapt content only, do not invent a custom layout. *(Cited because of
> Trap #8's "Settings template" investigation.)*

## Most Recent Failure
None. This is attempt 1 for T060 (attempt count: 0).

## Required Worker Output
- Full contents of `SettingsPage.tsx`.
- Explicit write-up of the `Theme` component doc-gap investigation and resolution (Trap #2).
- Explicit write-up of the "Sign out everywhere" vs. `logout()` distinction (Trap #3).
- Explicit write-up of the per-role Notifications category mapping (Trap #5).
- Explicit write-up of the "Settings template" investigation (Trap #8).
- Real test proof: section order, per-role Notifications `Switch` set, theme-mode persistence
  callback, `SubscribePopover` genuinely rendered (not reimplemented), Sign-out-everywhere
  `AlertDialog` flow.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
