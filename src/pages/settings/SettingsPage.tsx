/**
 * T060: `/settings` (SET-01/02/03), Epic E9 -- the last piece of this epic.
 * Five sections in SET-01's own literal order: Profile (display name, avatar
 * upload via `FileInput`), Appearance, Notifications, Calendar feed, Danger
 * zone (Sign out everywhere).
 *
 * This is a STANDALONE component per this task's packet: `router.tsx` is a
 * forbidden, read-only file here and `/settings` is not wired to this
 * component by this task -- the same not-yet-built-route reachability gap
 * every other standalone page in this batch (`SeasonSettings.tsx`/T029,
 * `SubscribePopover.tsx`/T046) already disclosed, not re-derived here.
 *
 * -----------------------------------------------------------------------
 * 1. SET-01's own literal section order (Known Context/Traps #1).
 * -----------------------------------------------------------------------
 *
 * PRD line 354/385 (`VOLT_Portal_PRD.md`), cited verbatim: "`/settings`
 * sections (`Section` + `FormLayout`): Profile (display name, avatar upload
 * via `FileInput` -> Supabase Storage), Appearance, Notifications, Calendar
 * feed, Danger zone (Sign out everywhere)." and "**Template as-is:** ...
 * `/settings` -> Settings template (sections in SET-01 order)." The five
 * `<Section>` elements below are emitted in exactly that order and never
 * reordered for any other reason (e.g. Danger zone is NOT moved to the top
 * even though some design conventions favor that -- SET-01's own text is
 * explicit, matching this task's packet's own instruction).
 *
 * -----------------------------------------------------------------------
 * 2. THE `Theme` COMPONENT DOC GAP -- Trap #2, the packet's own
 *    highest-flagged risk. Investigated via the CLI and installed source,
 *    never guessed.
 * -----------------------------------------------------------------------
 *
 * `grep -n "^# Theme\b" docs/swarm/astryx-api.md` returns ZERO matches --
 * confirmed directly, not taken on the packet's word. `Theme` is imported
 * and rendered in `App.tsx` (forbidden, read-only) with no `mode` prop wired
 * at all, and this project's `docs/swarm/astryx-api.md` has no `# Theme`
 * props-table section anywhere to check that usage against.
 *
 * Resolved via `npm run astryx -- component Theme` (the CLI cross-check,
 * never a source per constitution item 2 -- if it ever disagreed with a
 * documented prop, the doc would win; here there is no doc to disagree
 * with, so the CLI output is the only real prop-shape evidence available):
 *
 *   Props: `theme: DefinedTheme` (required), `mode: 'light' | 'dark' |
 *   'system'` (default `'system'`), `children: ReactNode` (required).
 *   Import: `import {Theme} from '@astryxdesign/core/theme';`
 *
 * This matches exactly what `src/theme/volt.ts`'s own `defineTheme(...)`
 * export (`voltTheme`, a `DefinedTheme`) already produces, and confirms
 * `App.tsx`'s `<Theme theme={voltTheme}>` (no `mode`) is currently pinned to
 * the documented `'system'` default, not "broken" -- just not yet exposing a
 * user-controllable override anywhere in the running app.
 *
 * This file's own Appearance `RadioList` (module doc #6 below) writes to
 * `profiles.theme_mode` via the injectable `onChangeTheme` seam -- it does
 * NOT itself reach into the live `<Theme mode={...}>` provider, because
 * doing so would require editing `App.tsx` (this task's own Forbidden Files,
 * confirmed read-only), the same disclosed "control built, real live-wiring
 * is a future task" gap every prior settings-adjacent task in this project
 * has already taken this exact posture on. A future wiring task now has the
 * real, CLI-verified `mode` prop shape to work from instead of having to
 * re-derive it from scratch.
 *
 * -----------------------------------------------------------------------
 * 3. "Sign out everywhere" vs. `guards.tsx`'s `logout()` -- Trap #3, a real,
 *    deliberately NOT-conflated distinction.
 * -----------------------------------------------------------------------
 *
 * `src/app/guards.tsx`'s `AuthContextValue.logout` (read directly, import-
 * only per this task's Forbidden Files) is a one-line `setUser(null)` --  it
 * only clears THIS device's in-memory placeholder auth state. It has no
 * concept whatsoever of any OTHER device's session; there is no Supabase
 * client wired in anywhere in this repo yet to make a real
 * `supabase.auth.signOut({scope: 'global'})`-style call that would revoke
 * sessions on every device. Silently calling `logout()` and presenting that
 * as satisfying SET-01's "Sign out everywhere" would be a real correctness
 * bug (a checker MAJOR, per this task's own packet) -- a user on a second
 * device would remain fully logged in.
 *
 * This file's Danger zone therefore uses its OWN injectable
 * `onSignOutEverywhere: () => Promise<void>` seam (`OnSignOutEverywhereFn`
 * below) -- a distinct type from `guards.tsx`'s `logout`, defaulting to an
 * obviously-fake `console.warn` stub (module doc #9) that a real
 * implementation would back with the actual global-scope Supabase Auth
 * sign-out call. `handleConfirmSignOutEverywhere` below awaits that real
 * seam FIRST; only once it resolves does this file additionally call the
 * imported `logout()` (via `useAuth()`, a permitted import per this task's
 * Forbidden Files clause) as a disclosed, SECOND, chained step -- because
 * "everywhere" necessarily includes THIS device too, so the local placeholder
 * auth state must also be cleared once the real revoke succeeds. This is
 * never presented as `logout()` alone satisfying the requirement; it is
 * always `onSignOutEverywhere()` (the real, distinct, awaited action) THEN
 * `logout()` (local cleanup only), confirmed via a real `AlertDialog` before
 * either runs (BEH-09-compliant copy stating this affects every device, not
 * a bare "Are you sure?").
 *
 * -----------------------------------------------------------------------
 * 4. Notifications -- per-role `Switch` set per EML-02's own literal
 *    trigger/recipient table, plus the parent-only digest toggle -- Trap #5.
 * -----------------------------------------------------------------------
 *
 * EML-02 (PRD line 318-326, cited verbatim):
 *   | ID | Trigger | To |
 *   | invite | AUTH-03 | invitee |
 *   | signup-confirm | RSVP set to going | student (+ linked parents) |
 *   | event-reminder-48h | 48h before outreach/competition session | going
 *     students + their parents |
 *   | event-reminder-3h | 3h before same | same |
 *   | meeting-reminder-3h | 3h before meeting session | students in scope
 *     (pref-gated, default on) |
 *   | weekly-digest | Sundays 5pm CT | parents (default on) |
 *
 * Reading that table's own "To" column literally against `role_enum`'s real
 * vocabulary (`admin | coach | student | parent`, Ground Truth):
 *
 *   - `invite` -- recipient is "invitee", someone who by definition does not
 *     yet have a profile/settings page at send time. EML-04's own literal
 *     text additionally states outright: "Transactional invite emails are
 *     not gated by preferences." So even though `notification_prefs.invite`
 *     is a real column (Ground Truth), NO role's Notifications section below
 *     renders a `Switch` for it -- a real, disclosed schema/UI mismatch
 *     (the column exists; no meaningful toggle for it could ever apply to a
 *     logged-in viewer of this page), not a silently dropped category.
 *   - `signup-confirm`, `event-reminder-48h`, `event-reminder-3h` -- "student
 *     (+ linked parents)" / "going students + their parents": relevant to
 *     BOTH `student` and `parent` roles.
 *   - `meeting-reminder-3h` -- "students in scope" only, no parent framing:
 *     relevant to `student` only.
 *   - `weekly-digest` -- "parents" only: relevant to `parent` only. This is
 *     SET-02's own literal "parents additionally choose digest on/off."
 *   - `coach` / `admin` -- no EML-02 row names either as a recipient at all.
 *     This is a genuine, cited PRD-level gap, not an oversight in this file:
 *     `getNotificationCategoriesForRole` below returns an EMPTY array for
 *     both, and the render path shows a real, disclosed `Banner` explaining
 *     why, rather than fabricating switches for categories no EML-02 row
 *     actually names those roles as recipients of.
 *
 * `weekly_digest` vs. `digest_enabled` (Ground Truth's own flagged note):
 * T051's checker left open "a real, still-open ambiguity about what
 * `digest_enabled` is for versus `weekly_digest`" -- this file does not
 * resolve that ambiguity (not this task's job, per the packet), it renders
 * BOTH as real, distinctly-labeled `Switch` controls, never collapsed into
 * one, only for the `parent` role (the only role `weekly-digest`'s own
 * EML-02 row names a recipient for -- `digest_enabled` is shown alongside it
 * on the same "only role where a digest master-toggle would ever be
 * meaningful" reasoning, disclosed as this file's own resolution, not a
 * cited spec fact).
 *
 * Trap #5's role source: NOT `useAuth()`. `guards.tsx`'s exported `Role`
 * union now matches AUTH-05's real `admin | coach | student | parent`
 * vocabulary exactly (fixed by T073a; previously a stale T005 placeholder
 * that could not even represent `'student'`/`'parent'` at all, the same
 * gap `SeasonSettings.tsx`/`AdminToggles.tsx` already flagged). Even so,
 * `useAuth().user?.role` is not the right source for this page: the
 * viewer's role is read from the REAL, loaded `profiles.role` column
 * (`role_enum`: `admin | coach | student | parent`, Ground Truth) via
 * `loadSettingsData`'s resolved `profile.role` -- the actual source of
 * truth this page already has to load regardless, sidestepping
 * `guards.tsx`'s session-level role entirely rather than coincidentally
 * relying on it.
 *
 * -----------------------------------------------------------------------
 * 5. "Settings template" investigation (constitution item 13) -- Trap #8.
 * -----------------------------------------------------------------------
 *
 * PRD line 375/385's route-table row: "`/settings` | all | Settings template
 * | `FormLayout`, `Switch`, `RadioList` | SET-01...04" and "`/settings` ->
 * Settings template (sections in SET-01 order)" -- `/settings` IS marked
 * "template as-is" (7.1's own "Routes marked *template as-is* ... emit the
 * named template and adapt content only; inventing custom layout there is a
 * checker MAJOR").
 *
 * `npm run astryx -- template --list` was run directly (not guessed): there
 * is no template literally named "Settings" alone, but THREE close matches
 * exist -- "Settings Dialog" ("Account settings in a modal dialog..."),
 * "Settings Form" ("Account settings as a single scrolling form with
 * profile, password, and advanced configuration sections"), and "Settings
 * Panels" ("...nav-switched panels..."). "Settings Form" is the correct
 * match: SET-01 describes a single scrolling page, not a modal (rules out
 * "Settings Dialog") and not nav-switched panels (rules out "Settings
 * Panels"). Its internal CLI slug is `settings` (found via `grep -rn
 * "Settings Form" node_modules/@astryxdesign/cli/templates/` ->
 * `templates/pages/settings/template.doc.mjs`); `npm run astryx --
 * template settings` was then run to get its REAL scaffold, not just the
 * one-line catalog description.
 *
 * That real scaffold uses `Layout`/`LayoutHeader`/`LayoutPanel` (a nav
 * sidebar of unrelated settings categories: Profile/Account/Members/
 * Billing/Invoices/API), `Grid`, `List`/`ListItem`, `TabList` (mobile-only
 * nav collapse), `Divider`, `TextInput`, `CheckboxInput`, `Typeahead` (a
 * settings-search box) -- it does NOT use `Section`, `FormLayout`, `Switch`,
 * or `RadioList` ANYWHERE. This is a real, disclose-worthy conflict: the
 * PRD's OWN route-table row for this exact `/settings` entry explicitly
 * names "Key components: `FormLayout`, `Switch`, `RadioList`" for the
 * "Settings template" -- but the CLI's own actual "Settings Form" scaffold
 * (the closest literal name match) uses none of those three.
 *
 * Resolution, following the SAME precedent `Basic Login`/T016 and `Grouped
 * Table`/T056 already established for this exact class of gap ("the CLI's
 * scaffold output is a cross-check, never a source -- constitution item 2;
 * if it disagrees with a more specific, literal PRD spec for this exact
 * route, the PRD's own literal spec wins"): this file composes the real,
 * documented `Section` (top-level `astryx-api.md` entry, NOT the
 * `Layout`-nested "undefined" `Section` components-subsection stub),
 * `FormLayout`, `Switch`, and `RadioList` primitives directly -- matching
 * SET-01/02/03's own literal per-section component call-outs -- rather than
 * reproducing the CLI scaffold's unrelated nav-sidebar/Grid/Divider/
 * CheckboxInput/Typeahead shape wholesale. Structural intent is still kept
 * comparable to "a real settings page" (one vertical scroll, `Section`s
 * separated by `dividers`, matching the "Section — With Dividers" block
 * template's own explicit "like a settings page" framing, `astryx-api.md`'s
 * `Section` Best Practices: "Add dividers between same-background sections
 * that need separation") -- this is adapting CONTENT to the more specific,
 * literal SET-01/02/03 spec, not inventing an unrelated custom layout; 7.1
 * has no ASCII wireframe for `/settings` either (it is in the "template
 * as-is" list, not the wireframed list), so there is no structural diagram
 * this deviates from.
 *
 * -----------------------------------------------------------------------
 * 6. Appearance -- `RadioList` System/Light/Dark, client-side validated
 *    (Known Context/Traps #6).
 * -----------------------------------------------------------------------
 *
 * `profiles.theme_mode` is `text not null default 'system'` (Ground Truth)
 * -- NOT an enum-typed column at the DB level, so nothing stops an
 * arbitrary string being written. `isValidThemeMode` below is a pure,
 * exported function restricting the three literal values SET-03 names
 * (`'system' | 'light' | 'dark'`) client-side before ever calling the
 * injectable `onChangeTheme` seam. Unlike `Switch`/`TextInput`/`FileInput`,
 * `RadioList`'s own documented Props table (`astryx-api.md` lines
 * 1220-1299) has no `changeAction`/async seam of its own -- persistence here
 * is fire-and-forget (`onChangeTheme(...).catch(...)`) with a real error
 * `Banner` fallback instead of a built-in loading affordance, a disclosed
 * difference from this file's other controls, not an oversight.
 *
 * -----------------------------------------------------------------------
 * 7. EML-04 addressability -- a real DOM `id="notifications"` -- Trap #7.
 * -----------------------------------------------------------------------
 *
 * `src/emails/layout/constants.ts`'s `MANAGE_PREFERENCES_PATH` (read-only,
 * cited verbatim) is the literal string `'/settings#notifications'`. The
 * Notifications `<Section>` below carries a real `id="notifications"` so a
 * future route-wiring task's hash-scroll-to behavior targets the correct
 * element once `/settings` is actually mounted at a route (this file cannot
 * prove the full hash-navigation flow end-to-end itself -- `router.tsx` is
 * forbidden/not wired here, the same disclosed gap every not-yet-built route
 * in this batch already has).
 *
 * `id` is NOT listed in `Section`'s own `astryx-api.md` Props table (grepped
 * directly, confirmed absent) -- ANOTHER doc gap, same class as `Theme`/
 * `Heading`/`RadioListItem` below, resolved via the installed source, not
 * guessed: `node_modules/@astryxdesign/core/dist/BaseProps.d.ts`'s own
 * header comment states plainly "Keeps: event handlers, aria-*, role,
 * tabIndex, hidden, draggable, inert, dir, className, style, id, xstyle,
 * data-*", and EVERY Astryx component's props interface (including
 * `SectionProps`, confirmed by reading `dist/Section/Section.d.ts` directly:
 * `export interface SectionProps extends BaseProps<HTMLElement>`) extends
 * `BaseProps<T>`. `id` therefore passes straight through to the root DOM
 * element on every Astryx component used in this file, confirmed via source,
 * not assumed.
 *
 * -----------------------------------------------------------------------
 * 8. Avatar upload -- T105: real `FileInput`, now backed by a real Storage
 *    bucket (updated from this file's original T060 disclosure, which is
 *    now stale and has been removed -- this section replaces it).
 * -----------------------------------------------------------------------
 *
 * `../../lib/supabase/loaders/settings.ts`'s `uploadAvatar` (T105) is this
 * file's real default `onUploadAvatar`: a genuine upload to the `avatars`
 * Storage bucket (`supabase/migrations/20260720000001_avatar_storage.sql`,
 * new, additive-only, this same task) under the caller's own
 * `{auth.uid()}/...` folder, RLS-scoped so no other caller can write into
 * it, followed by a real `profiles.avatar_url` UPDATE. See that migration's
 * own header comment for the full bucket-visibility (public vs. private)
 * investigation and RLS-policy reasoning -- not repeated here. `FileInput`'s
 * own documented `accept`/`maxSize` props (`astryx-api.md` lines 4095-4118)
 * are still used with the same real values (`accept="image/*"`,
 * `maxSize={5 * 1024 * 1024}`, i.e. 5 MB) T060 originally chose -- NOT
 * sourced from any migration or PRD line (none specifies a limit; disclosed
 * as a reasonable UI default, not a cited spec fact), unchanged by this task.
 *
 * `profiles.avatar_url` (Ground Truth) was originally `text NOT NULL`, but
 * `supabase/migrations/20260718000000_invite_trigger.sql` (lines 44-45,
 * landed before this task, read-only reference) later widened it to
 * NULLABLE for the invite-acceptance case (a brand-new profile legitimately
 * has no avatar yet). `SettingsProfile.avatarUrl` below is widened to
 * `string | null` to match the real column honestly (T105) -- the same
 * "widen the type when wiring real data" decision `src/pages/roster/
 * ParentsTab.tsx`'s own already-Passed T094 wiring already made for this
 * exact column, cited as this task's direct precedent. The one `<Avatar
 * src={...}>` usage below falls back to `undefined` for a `null` value
 * (`Avatar`'s own documented `src` prop already accepts `undefined`,
 * falling back to initials -- same idiom `ParentsTab.tsx` already uses).
 *
 * -----------------------------------------------------------------------
 * 9. T105: real Supabase client wired in -- updated from this file's
 *    original T060 disclosure ("no shared Supabase client wired in"),
 *    which is now stale and has been removed.
 * -----------------------------------------------------------------------
 *
 * `loadSettingsData`/`onUpdateProfile`/`onUploadAvatar`/`onChangeTheme`/
 * `onToggleNotificationPref`/`onSignOutEverywhere` are all still injectable
 * props (unchanged shape), but now default to the REAL implementations
 * exported by `../../lib/supabase/loaders/settings.ts` (T105) -- real
 * `profiles`/`notification_prefs` reads/writes, a real Storage upload
 * (module doc #8 above), and a real global-scope Supabase Auth sign-out
 * (module doc #3). The original T060 fixture/`console.warn`-stub
 * implementations (`defaultLoadSettingsData`/`defaultOnUpdateProfile`/etc.,
 * below) are KEPT as named exports -- same "no longer the default, kept for
 * tests/future callers that want this fixture explicitly" precedent `
 * SeasonSettings.tsx`'s own T091 wiring already established for its
 * equivalent `defaultOnCreateSeason`/`defaultOnUpdateSeason`/
 * `defaultOnSetActiveSeason` -- their own doc comments/`console.warn` text
 * are updated below to say so accurately, rather than left claiming "not
 * wired anywhere" now that they no longer are the default.
 *
 * -----------------------------------------------------------------------
 * 10. Calendar feed -- T046's `SubscribePopover` imported and rendered
 *     directly, NOT reimplemented (Dependencies).
 * -----------------------------------------------------------------------
 *
 * `import { SubscribePopover } from '../calendar/SubscribePopover'` (a
 * Forbidden File to EDIT here, per this task's own Dependencies section --
 * "import it directly ... the established, expected reuse pattern"). This
 * file passes only the one prop it can genuinely supply without inventing
 * an auth-context lookup this page doesn't otherwise need: `profileId={
 * profile.id}` (`SubscribePopover`'s own module doc section 7: "caller-
 * supplied, not self-discovered"). `SubscribePopover`'s own
 * `loadCalendarFeed`/`onResetFeedToken`/`functionsBaseUrl` props are left at
 * their own already-Passed, already-disclosed defaults -- this file does not
 * re-decide or override any of `SubscribePopover`'s own internal seams.
 *
 * -----------------------------------------------------------------------
 * 11. DES-12 states -- loading / error / populated only, no separate
 *     "empty" state (disclosed scope decision, matching `SubscribePopover
 *     .tsx`'s own module doc section 10 precedent for the identical reason).
 * -----------------------------------------------------------------------
 *
 * This file assumes a `profiles` row (and a `notification_prefs` row) already
 * exist for the current viewer by the time this page renders -- the same
 * "provisioned elsewhere" assumption every one-row-per-profile precedent in
 * this codebase already relies on. There is no third "no profile yet, create
 * one" UI here; the error `Banner` state covers a rejected/unusable load.
 *
 * -----------------------------------------------------------------------
 * 12. Constitution item 13 -- no box-drawing/bracket characters rendered.
 * -----------------------------------------------------------------------
 *
 * The only non-ASCII punctuation this file renders in the DOM is the em dash
 * (used sparingly in supporting copy, never a box-drawing character or a
 * literal `[`/`]`).
 *
 * -----------------------------------------------------------------------
 * 13. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     grepped live against `docs/swarm/astryx-api.md` for this task, or
 *     resolved via the CLI/installed source where the doc itself is gapped
 *     (module docs #2/#7 above).
 * -----------------------------------------------------------------------
 *
 *  - `Section` (top-level "Section" Props table, `astryx-api.md` lines
 *    5527-5564, NOT the `Layout`-nested "undefined" stub at lines 300-304):
 *    `variant`, `children`, `dividers`, `id` (module doc #7's
 *    `BaseProps`-sourced passthrough) used.
 *  - `Layout`/`LayoutContent` ("Layout" Props table, lines 167-266):
 *    `header`, `content` (`Layout`); `children`, `padding` (`LayoutContent`,
 *    resolved via `dist/Layout/LayoutContent.d.ts`, same posture
 *    `SeasonSettings.tsx`/T029 already took for this identical "undefined"
 *    Components-subsection gap).
 *  - `LayoutHeader` (own "undefined" Components subsection, lines 270-274) --
 *    resolved via `dist/Layout/LayoutHeader.d.ts`: `children`, `hasDivider`
 *    used.
 *  - `FormLayout` ("FormLayout" Props table, lines 4158-4164): `children`
 *    used (default `direction="vertical"`).
 *  - `TextInput` ("TextInput" Props table, lines 1652-1675): `label`,
 *    `value`, `onChange`, `isRequired`, `type="email"` (read-only email
 *    display) used.
 *  - `FileInput` ("FileInput" Props table, lines 4095-4118): `label`,
 *    `value`, `onChange`, `changeAction`, `accept`, `maxSize`, `description`
 *    used (module doc #8).
 *  - `Avatar` ("Avatar" Props table, lines 464-473): `src`, `name`, `size`
 *    used.
 *  - `RadioList`/`RadioListItem` ("RadioList" Props table, lines 1262-1281;
 *    `RadioListItem`'s own "undefined" Components subsection, lines
 *    1285-1288, resolved via `npm run astryx -- component RadioListItem`:
 *    `label`, `value`, `description` used): `label`, `value`, `onChange`,
 *    `children` (`RadioList`); `label`, `value`, `description`
 *    (`RadioListItem`) used.
 *  - `Switch` ("Switch" Props table, lines 1506-1529): `label`,
 *    `description`, `value`, `onChange`, `changeAction` used (module doc #4
 *    -- same `onChange`-optimistic-then-`changeAction`-persists idiom
 *    `AdminToggles.tsx`/T028 already established for this exact pattern).
 *  - `Button` ("Button" Props table, lines 1807-1827): `label`, `variant`,
 *    `isDisabled`, `isLoading`, `onClick`, `clickAction` used.
 *  - `AlertDialog` ("AlertDialog" Props table, lines 2518-2530): `isOpen`,
 *    `onOpenChange`, `title`, `description`, `actionLabel`, `onAction`,
 *    `isActionLoading` used. `actionVariant` left at its documented default
 *    (`'destructive'`) -- signing out of every device is a genuinely
 *    destructive-shaped, hard-to-reverse-by-the-user action (every other
 *    device's session ends immediately), the same reasoning
 *    `SubscribePopover.tsx`/T046's own Reset-link `AlertDialog` already used
 *    for keeping this same documented default.
 *  - `Banner` ("Banner" Props table, lines 2749-2763): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this page's fixed, always-identical
 *    five-section layout (Profile / Notifications / etc., never data-
 *    dependent in shape), replacing `Spinner`'s prior use here per Astryx's
 *    own guidance (known-dimension content). `VisuallyHidden` + the
 *    wrapping `VStack`'s `aria-busy` carry the "Loading settings…"
 *    announcement `Spinner`'s `label` used to provide.
 *  - `Heading`: own "Components > Heading" subsection (lines 882-884) is
 *    `undefined` -- the same disclosed CLI/source-cross-checked gap every
 *    other content page in this batch already resolved identically
 *    (`dist/Heading/Heading.d.ts`: `level` (1-6, required), `children`
 *    (required)). `level={1}` used once (this page's only h1); `level={2}`
 *    for each of the five section headings (no level-skip: 1 -> 2 throughout).
 *  - `Text` ("Text" Props table, lines 858-878): `type`, `color` used.
 *  - `HStack`/`VStack` ("Stack" section, lines 350-396): `gap`, `vAlign`
 *    used.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Avatar,
  Banner,
  Button,
  FileInput,
  FormLayout,
  Heading,
  HStack,
  Layout,
  LayoutContent,
  LayoutHeader,
  RadioList,
  RadioListItem,
  Section,
  Skeleton,
  Switch,
  Text,
  TextInput,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import { useAuth, pushToast } from '../../app/guards';
import { SubscribePopover } from '../calendar/SubscribePopover';
import {
  changeTheme,
  loadSettingsData as loadSettingsDataReal,
  signOutEverywhere,
  toggleNotificationPref,
  updateProfile,
  uploadAvatar,
} from '../../lib/supabase/loaders/settings';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of the real `profiles` /
// `notification_prefs` columns (Ground Truth). `role_enum`'s real vocabulary
// (module doc #4), NOT `guards.tsx`'s stale `Role` union.
// ---------------------------------------------------------------------------

export type ProfileRole = 'admin' | 'coach' | 'student' | 'parent';

export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

/** Module doc #6: `profiles.theme_mode` is `text`, not enum-typed at the DB
 * level -- this is the real client-side gate on the three literal values
 * SET-03 names. */
export function isValidThemeMode(value: string): value is ThemeMode {
  return (THEME_MODES as readonly string[]).includes(value);
}

export interface SettingsProfile extends Record<string, unknown> {
  id: string;
  displayName: string;
  email: string;
  role: ProfileRole;
  /** `profiles.avatar_url` -- nullable (widened by
   * `20260718000000_invite_trigger.sql`; module doc #8) -- `null` for a
   * brand-new profile that hasn't uploaded an avatar yet. */
  avatarUrl: string | null;
  themeMode: ThemeMode;
}

export interface NotificationPrefsRow {
  profileId: string;
  invite: boolean;
  signupConfirm: boolean;
  eventReminder48h: boolean;
  eventReminder3h: boolean;
  meetingReminder3h: boolean;
  weeklyDigest: boolean;
  digestEnabled: boolean;
}

export type NotificationPrefKey = Exclude<keyof NotificationPrefsRow, 'profileId'>;

export interface SettingsData {
  profile: SettingsProfile;
  notificationPrefs: NotificationPrefsRow;
}

export type LoadSettingsDataFn = () => Promise<SettingsData>;

export interface UpdateProfilePayload {
  displayName: string;
}

export type OnUpdateProfileFn = (payload: UpdateProfilePayload) => Promise<void>;

export interface UploadAvatarResult {
  avatarUrl: string;
}

export type OnUploadAvatarFn = (file: File) => Promise<UploadAvatarResult>;

export interface ChangeThemePayload {
  themeMode: ThemeMode;
}

export type OnChangeThemeFn = (payload: ChangeThemePayload) => Promise<void>;

export interface ToggleNotificationPrefPayload {
  profileId: string;
  key: NotificationPrefKey;
  value: boolean;
}

export type OnToggleNotificationPrefFn = (payload: ToggleNotificationPrefPayload) => Promise<void>;

/**
 * Module doc #3: deliberately `Promise<void>`, a DIFFERENT, real function
 * type from `guards.tsx`'s `logout: () => void` (synchronous, no return
 * value, no async backend call at all).
 */
export type OnSignOutEverywhereFn = () => Promise<void>;

// ---------------------------------------------------------------------------
// Pure helpers -- exported for direct testing.
// ---------------------------------------------------------------------------

/**
 * Module doc #4 -- the ONE place the per-role EML-02 category mapping is
 * computed. See module doc #4 above for the full citation of EML-02's own
 * trigger/recipient table this is built from.
 */
export function getNotificationCategoriesForRole(role: ProfileRole): NotificationPrefKey[] {
  switch (role) {
    case 'student':
      return ['signupConfirm', 'eventReminder48h', 'eventReminder3h', 'meetingReminder3h'];
    case 'parent':
      return [
        'signupConfirm',
        'eventReminder48h',
        'eventReminder3h',
        'weeklyDigest',
        'digestEnabled',
      ];
    case 'coach':
    case 'admin':
      return [];
    default:
      return [];
  }
}

/** Returns `null` when `draft` is blank -- callers gate the Save button on this. */
export function buildUpdateProfilePayload(draft: string): UpdateProfilePayload | null {
  const trimmed = draft.trim();
  return trimmed === '' ? null : { displayName: trimmed };
}

// ---------------------------------------------------------------------------
// Copy -- per-category label/description (module doc #4). `invite` is kept
// for type completeness only (`NotificationPrefKey` includes it) but is
// NEVER rendered by any role branch below (module doc #4's own citation).
// ---------------------------------------------------------------------------

const NOTIFICATION_CATEGORY_COPY: Record<
  NotificationPrefKey,
  { label: string; description: string }
> = {
  invite: {
    label: 'Invite emails',
    description:
      'Not shown here -- EML-04 states invite emails are not gated by preferences, and the ' +
      'recipient (the invitee) does not have a settings page yet at send time.',
  },
  signupConfirm: {
    label: 'Signup confirmations',
    description: 'Sent when an RSVP is set to Going, to the student and any linked parents.',
  },
  eventReminder48h: {
    label: '48-hour event reminders',
    description:
      'Sent 48 hours before an outreach or competition session to students who are Going, ' +
      'and their parents.',
  },
  eventReminder3h: {
    label: '3-hour event reminders',
    description: 'Sent 3 hours before the same outreach or competition session.',
  },
  meetingReminder3h: {
    label: '3-hour meeting reminders',
    description: 'Sent 3 hours before a build meeting, to students in scope. On by default.',
  },
  weeklyDigest: {
    label: 'Weekly digest',
    description:
      "Sundays at 5:00 PM CT: last week's attendance, hours vs. goal, and next week's " +
      'schedule for each linked student. On by default.',
  },
  digestEnabled: {
    label: 'Enable digest emails',
    description:
      'Master toggle for weekly digest emails, distinct from the Weekly digest category ' +
      'above (a real, still-open ambiguity between these two columns -- see this file’s ' +
      'module doc #4).',
  },
};

const NO_CATEGORIES_TITLE = 'No notification categories apply to your role yet';
const NO_CATEGORIES_DESCRIPTION =
  "EML-02's own trigger/recipient table doesn't name coach or admin as a recipient for any " +
  'current email template (invitee, student, parent are the only named recipients) -- a ' +
  'real, cited PRD-level gap, not an oversight in this page.';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only, no PII). Exists
// ONLY as the default argument to `defaultLoadSettingsData` (module doc #9).
// `role: 'parent'` is picked as the richest default for demoing every
// control this file renders, including the parent-only weekly-digest pair.
// ---------------------------------------------------------------------------

const FIXTURE_PROFILE_ID = 'profile-fixture-current';

const FIXTURE_PROFILE: SettingsProfile = {
  id: FIXTURE_PROFILE_ID,
  displayName: 'Jordan Rivera',
  email: 'jordan.rivera@example.com',
  role: 'parent',
  // Module doc #8: `avatar_url` is `text not null` -- an obviously-fake,
  // non-empty placeholder, never an empty string a real row could not have.
  avatarUrl: 'https://volt-placeholder-project.example/avatars/fixture.png',
  themeMode: 'system',
};

const FIXTURE_NOTIFICATION_PREFS: NotificationPrefsRow = {
  profileId: FIXTURE_PROFILE_ID,
  invite: true,
  signupConfirm: true,
  eventReminder48h: true,
  eventReminder3h: true,
  meetingReminder3h: true,
  weeklyDigest: true,
  digestEnabled: true,
};

/**
 * T105: no longer the component's default `loadSettingsData` (that's now
 * `loadSettingsData` from `../../lib/supabase/loaders/settings`, module doc
 * #9) -- kept as a named export, fixture literal unchanged, for tests (and
 * any future caller) that want fixture behavior explicitly rather than
 * relying on it being the implicit default. Same precedent
 * `SeasonSettings.tsx`'s own `defaultLoadSeasons` (T091) already established.
 */
export async function defaultLoadSettingsData(): Promise<SettingsData> {
  return {
    profile: { ...FIXTURE_PROFILE },
    notificationPrefs: { ...FIXTURE_NOTIFICATION_PREFS },
  };
}

/**
 * T105: no longer the component's default `onUpdateProfile` (that's now
 * `updateProfile`, module doc #9) -- kept as a named export for tests/future
 * callers that want this fixture explicitly.
 */
export const defaultOnUpdateProfile: OnUpdateProfileFn = async (payload) => {
  console.warn(
    '[SettingsPage] defaultOnUpdateProfile: fixture-only stub (module doc #9) -- logs the ' +
      'profiles UPDATE payload a real update would have sent instead of actually updating ' +
      'anything.',
    payload,
  );
};

/**
 * T105: no longer the component's default `onUploadAvatar` (that's now
 * `uploadAvatar`, module doc #8/#9) -- kept as a named export for tests/
 * future callers that want this fixture explicitly.
 */
export const defaultOnUploadAvatar: OnUploadAvatarFn = async (file) => {
  console.warn(
    '[SettingsPage] defaultOnUploadAvatar: fixture-only stub (module doc #8/#9) -- fabricates ' +
      'a placeholder avatar URL from the selected file instead of actually uploading it to the ' +
      'real "avatars" Storage bucket.',
    file.name,
  );
  return {
    avatarUrl: `https://volt-placeholder-project.example/avatars/${encodeURIComponent(file.name)}`,
  };
};

/**
 * T105: no longer the component's default `onChangeTheme` (that's now
 * `changeTheme`, module doc #9) -- kept as a named export for tests/future
 * callers that want this fixture explicitly.
 */
export const defaultOnChangeTheme: OnChangeThemeFn = async (payload) => {
  console.warn(
    '[SettingsPage] defaultOnChangeTheme: fixture-only stub (module doc #9) -- logs the ' +
      'profiles.theme_mode UPDATE payload a real update would have sent instead of actually ' +
      'updating anything.',
    payload,
  );
};

/**
 * T105: no longer the component's default `onToggleNotificationPref`
 * (that's now `toggleNotificationPref`, module doc #9) -- kept as a named
 * export for tests/future callers that want this fixture explicitly.
 */
export const defaultOnToggleNotificationPref: OnToggleNotificationPrefFn = async (payload) => {
  console.warn(
    '[SettingsPage] defaultOnToggleNotificationPref: fixture-only stub (module doc #9) -- logs ' +
      'the notification_prefs UPDATE payload a real update would have sent instead of actually ' +
      'updating anything.',
    payload,
  );
};

/**
 * T105: no longer the component's default `onSignOutEverywhere` (that's now
 * `signOutEverywhere`, module doc #4/#9) -- kept as a named export for
 * tests/future callers that want this fixture explicitly.
 */
export const defaultOnSignOutEverywhere: OnSignOutEverywhereFn = async () => {
  console.warn(
    '[SettingsPage] defaultOnSignOutEverywhere: fixture-only stub (module doc #9) -- logs that ' +
      'a real global-scope sign-out would have been called here instead of actually calling ' +
      'one. This is DISTINCT from guards.tsx’s logout() -- module doc #3.',
  );
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- same shape every prior content page in
// this batch already establishes locally (module doc #11).
// ---------------------------------------------------------------------------

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the caller-supplied `deps` semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list; `retryToken` is an additional internal trigger.
  }, [...deps, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SettingsPageProps {
  /** Injectable data-loading seam (module doc #9). Defaults to the real
   * `loadSettingsData` (`../../lib/supabase/loaders/settings`). */
  loadSettingsData?: LoadSettingsDataFn;
  /** Injectable profile-save seam (module doc #9). Defaults to the real
   * `updateProfile`. */
  onUpdateProfile?: OnUpdateProfileFn;
  /** Injectable avatar-upload seam (module doc #8/#9). Defaults to the real
   * `uploadAvatar`. */
  onUploadAvatar?: OnUploadAvatarFn;
  /** Injectable theme-persist seam (module doc #6/#9). Defaults to the real
   * `changeTheme`. */
  onChangeTheme?: OnChangeThemeFn;
  /** Injectable per-category persist seam (module doc #4/#9). Defaults to the
   * real `toggleNotificationPref`. */
  onToggleNotificationPref?: OnToggleNotificationPrefFn;
  /**
   * Injectable, DISTINCT-from-`logout()` global sign-out seam (module doc
   * #3/#4/#9). Defaults to the real `signOutEverywhere`.
   */
  onSignOutEverywhere?: OnSignOutEverywhereFn;
}

export function SettingsPage({
  loadSettingsData = loadSettingsDataReal,
  onUpdateProfile = updateProfile,
  onUploadAvatar = uploadAvatar,
  onChangeTheme = changeTheme,
  onToggleNotificationPref = toggleNotificationPref,
  onSignOutEverywhere = signOutEverywhere,
}: SettingsPageProps = {}): ReactNode {
  const loadState = useLoadState(loadSettingsData, [loadSettingsData]);
  const { logout } = useAuth();

  const [profile, setProfile] = useState<SettingsProfile | null>(null);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefsRow | null>(null);
  const [displayNameDraft, setDisplayNameDraft] = useState('');

  useEffect(() => {
    if (loadState.status === 'success') {
      setProfile(loadState.data.profile);
      setNotificationPrefs(loadState.data.notificationPrefs);
      setDisplayNameDraft(loadState.data.profile.displayName);
    }
  }, [loadState]);

  // ---- Profile section state ----
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  // T082 (DES-12 retry sweep): `handleAvatarChangeAction`'s `finally` always
  // clears `avatarFile` (both success and failure), so the `FileInput`
  // itself is empty again once `avatarError` renders -- there is no
  // still-populated control a user could just "click again" the way a
  // dirty form's own Save button works elsewhere on this page. This keeps
  // the actual failed `File` object (still a valid in-memory reference)
  // purely so the error Banner's "Retry" action can re-attempt the SAME
  // upload without making the user re-browse for the file.
  const [lastFailedAvatarFile, setLastFailedAvatarFile] = useState<File | null>(null);

  async function handleSaveProfile(): Promise<void> {
    const payload = buildUpdateProfilePayload(displayNameDraft);
    if (payload === null || profile === null) return;
    setIsSavingProfile(true);
    setProfileError(null);
    try {
      await onUpdateProfile(payload);
      setProfile((prev) => (prev === null ? prev : { ...prev, displayName: payload.displayName }));
      pushToast('Profile updated');
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : 'Something went wrong saving your profile.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleAvatarChangeAction(files: File | File[] | null): Promise<void> {
    if (files === null || Array.isArray(files) || profile === null) {
      // `isMultiple` is not set below, so `files` is always `File | null` in
      // practice -- the array branch is a type-safety guard only.
      return;
    }
    setAvatarError(null);
    try {
      const result = await onUploadAvatar(files);
      setProfile((prev) => (prev === null ? prev : { ...prev, avatarUrl: result.avatarUrl }));
      pushToast('Avatar updated');
      setLastFailedAvatarFile(null);
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : 'Something went wrong uploading your avatar.',
      );
      setLastFailedAvatarFile(files);
    } finally {
      setAvatarFile(null);
    }
  }

  // ---- Appearance section state ----
  const [themeError, setThemeError] = useState<string | null>(null);

  // T082 (DES-12 retry sweep): `handleThemeChange` optimistically writes the
  // new value into `profile.themeMode` BEFORE the persist call resolves and
  // never rolls it back on failure (module doc #6's own disclosed choice --
  // the theme visibly applies immediately either way). That means the
  // `RadioList` this drives already shows the target option selected once
  // `themeError` renders, so re-clicking that SAME already-selected option
  // would not fire `onChange` again -- unlike `RsvpControl`/`ParentRsvp`'s
  // rollback-then-reselect idiom, there is no reliable existing control
  // action that resubmits this exact attempt. `persistTheme` is the one
  // place the actual persist call + error handling lives, so both the real
  // `onChange` handler and the error Banner's "Retry" action call the exact
  // same function.
  function persistTheme(value: ThemeMode): void {
    setThemeError(null);
    onChangeTheme({ themeMode: value }).catch((error: unknown) => {
      setThemeError(
        error instanceof Error
          ? error.message
          : 'Something went wrong saving your theme preference.',
      );
    });
  }

  function handleThemeChange(value: string): void {
    if (!isValidThemeMode(value)) return; // module doc #6
    setProfile((prev) => (prev === null ? prev : { ...prev, themeMode: value }));
    persistTheme(value);
  }

  // ---- Notifications section state ----
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  function handleNotificationPrefChange(key: NotificationPrefKey, value: boolean): void {
    setNotificationPrefs((prev) => (prev === null ? prev : { ...prev, [key]: value }));
  }

  async function handleNotificationPrefPersist(
    key: NotificationPrefKey,
    value: boolean,
  ): Promise<void> {
    if (profile === null) return;
    setNotificationsError(null);
    try {
      await onToggleNotificationPref({ profileId: profile.id, key, value });
    } catch (error) {
      // Real revert-on-failure: the optimistic flip from `onChange` above is
      // undone if the injected persist seam rejects.
      setNotificationPrefs((prev) => (prev === null ? prev : { ...prev, [key]: !value }));
      setNotificationsError(
        error instanceof Error
          ? error.message
          : 'Something went wrong saving your notification preference.',
      );
    }
  }

  // ---- Danger zone state ----
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState(false);
  const [isSigningOutEverywhere, setIsSigningOutEverywhere] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleConfirmSignOutEverywhere(): Promise<void> {
    setIsSigningOutEverywhere(true);
    setSignOutError(null);
    try {
      // Module doc #3: the REAL, distinct, multi-device revoke -- awaited FIRST.
      await onSignOutEverywhere();
      // Only once the real revoke succeeds do we ALSO clear THIS device's
      // local placeholder auth state -- a disclosed, chained SECOND step,
      // never a substitute for the real seam above.
      logout();
      pushToast('Signed out of every device');
      setIsSignOutConfirmOpen(false);
    } catch (error) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : 'Something went wrong signing out of every device.',
      );
    } finally {
      setIsSigningOutEverywhere(false);
    }
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={4} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading settings…
        </VisuallyHidden>
        <Skeleton width={110} height={28} index={0} />
        {[0, 1, 2, 3, 4].map((section) => (
          <VStack key={section} gap={2}>
            <Skeleton width={140} height={20} index={section * 2 + 1} />
            <Skeleton width="100%" height={16} index={section * 2 + 2} />
          </VStack>
        ))}
      </VStack>
    );
  }

  if (loadState.status === 'error' || profile === null || notificationPrefs === null) {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load settings"
          description="Something went wrong loading your settings. Try refreshing the page."
          endContent={
            loadState.status === 'error' ? (
              <Button variant="ghost" label="Retry" onClick={loadState.retry} />
            ) : undefined
          }
        />
      </VStack>
    );
  }

  const isProfileDirty =
    displayNameDraft.trim() !== '' && displayNameDraft.trim() !== profile.displayName;
  const notificationCategories = getNotificationCategoriesForRole(profile.role);

  return (
    <>
      <Layout
        header={
          <LayoutHeader hasDivider>
            <Heading level={1}>Settings</Heading>
          </LayoutHeader>
        }
        content={
          <LayoutContent padding={4}>
            <VStack gap={0}>
              {/* -----------------------------------------------------------
                1. Profile -- SET-01 order, first section.
               ----------------------------------------------------------- */}
              <Section dividers={['bottom']}>
                <VStack gap={4}>
                  <Heading level={2}>Profile</Heading>

                  {profileError !== null && (
                    <Banner
                      status="error"
                      title="Couldn't save your profile"
                      description={profileError}
                      isDismissable
                      onDismiss={() => setProfileError(null)}
                    />
                  )}
                  {avatarError !== null && (
                    <Banner
                      status="error"
                      title="Couldn't upload your avatar"
                      description={avatarError}
                      isDismissable
                      onDismiss={() => setAvatarError(null)}
                      endContent={
                        lastFailedAvatarFile !== null ? (
                          <Button
                            variant="ghost"
                            label="Retry"
                            clickAction={() => handleAvatarChangeAction(lastFailedAvatarFile)}
                          />
                        ) : undefined
                      }
                    />
                  )}

                  <HStack gap={3} vAlign="center">
                    <Avatar
                      src={profile.avatarUrl ?? undefined}
                      name={profile.displayName}
                      size="large"
                    />
                    <FileInput
                      label="Avatar"
                      description="PNG, JPG, or GIF, up to 5 MB."
                      value={avatarFile}
                      onChange={(files) => setAvatarFile(Array.isArray(files) ? null : files)}
                      changeAction={handleAvatarChangeAction}
                      accept="image/*"
                      maxSize={5 * 1024 * 1024}
                    />
                  </HStack>

                  <FormLayout>
                    <TextInput
                      label="Display name"
                      value={displayNameDraft}
                      onChange={setDisplayNameDraft}
                      isRequired
                    />
                    <TextInput
                      label="Email"
                      type="email"
                      value={profile.email}
                      onChange={() => {}}
                      isDisabled
                    />
                  </FormLayout>

                  <HStack gap={2}>
                    <Button
                      label="Save changes"
                      variant="primary"
                      isDisabled={!isProfileDirty || isSavingProfile}
                      isLoading={isSavingProfile}
                      clickAction={handleSaveProfile}
                    />
                  </HStack>
                </VStack>
              </Section>

              {/* -----------------------------------------------------------
                2. Appearance -- SET-01 order, second section.
               ----------------------------------------------------------- */}
              <Section dividers={['bottom']}>
                <VStack gap={4}>
                  <Heading level={2}>Appearance</Heading>

                  {themeError !== null && (
                    <Banner
                      status="error"
                      title="Couldn't save your theme preference"
                      description={themeError}
                      isDismissable
                      onDismiss={() => setThemeError(null)}
                      endContent={
                        <Button
                          variant="ghost"
                          label="Retry"
                          onClick={() => persistTheme(profile.themeMode)}
                        />
                      }
                    />
                  )}

                  <RadioList label="Theme" value={profile.themeMode} onChange={handleThemeChange}>
                    <RadioListItem
                      label="Match system"
                      value="system"
                      description="Follows your device's light/dark setting."
                    />
                    <RadioListItem label="Light" value="light" />
                    <RadioListItem label="Dark" value="dark" />
                  </RadioList>
                  <Text type="supporting" color="secondary">
                    This sets your saved preference. Live theme switching in the running app is a
                    separate, not-yet-wired step -- module doc #2.
                  </Text>
                </VStack>
              </Section>

              {/* -----------------------------------------------------------
                3. Notifications -- SET-01 order, third section. Real DOM
                   id="notifications" for EML-04 addressability -- module doc #7.
               ----------------------------------------------------------- */}
              <Section id="notifications" dividers={['bottom']}>
                <VStack gap={4}>
                  <Heading level={2}>Notifications</Heading>

                  {notificationsError !== null && (
                    <Banner
                      status="error"
                      title="Couldn't save your notification preference"
                      description={notificationsError}
                      isDismissable
                      onDismiss={() => setNotificationsError(null)}
                    />
                  )}

                  {notificationCategories.length === 0 ? (
                    <Banner
                      status="info"
                      title={NO_CATEGORIES_TITLE}
                      description={NO_CATEGORIES_DESCRIPTION}
                    />
                  ) : (
                    <VStack gap={3}>
                      {notificationCategories.map((key) => (
                        <Switch
                          key={key}
                          label={NOTIFICATION_CATEGORY_COPY[key].label}
                          description={NOTIFICATION_CATEGORY_COPY[key].description}
                          value={notificationPrefs[key]}
                          onChange={(checked) => handleNotificationPrefChange(key, checked)}
                          changeAction={(checked) => handleNotificationPrefPersist(key, checked)}
                        />
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Section>

              {/* -----------------------------------------------------------
                4. Calendar feed -- SET-01 order, fourth section. Reuses
                   T046's SubscribePopover directly -- module doc #10.
               ----------------------------------------------------------- */}
              <Section dividers={['bottom']}>
                <VStack gap={3}>
                  <Heading level={2}>Calendar feed</Heading>
                  <Text type="supporting" color="secondary">
                    Subscribe to a personal calendar feed of your meetings, outreach events, and
                    competitions.
                  </Text>
                  <SubscribePopover profileId={profile.id} />
                </VStack>
              </Section>

              {/* -----------------------------------------------------------
                5. Danger zone -- SET-01 order, fifth and LAST section. Sign
                   out everywhere is a real, distinct callback from
                   guards.tsx's logout() -- module doc #3.
               ----------------------------------------------------------- */}
              <Section variant="muted">
                <VStack gap={4}>
                  <Heading level={2}>Danger zone</Heading>

                  {signOutError !== null && (
                    <Banner
                      status="error"
                      title="Couldn't sign out of every device"
                      description={signOutError}
                      isDismissable
                      onDismiss={() => setSignOutError(null)}
                    />
                  )}

                  <Text type="supporting" color="secondary">
                    This signs you out of every device where you're currently logged in -- not just
                    this one.
                  </Text>
                  <HStack gap={2}>
                    <Button
                      label="Sign out everywhere"
                      variant="destructive"
                      onClick={() => setIsSignOutConfirmOpen(true)}
                    />
                  </HStack>
                </VStack>
              </Section>
            </VStack>
          </LayoutContent>
        }
      />

      <AlertDialog
        isOpen={isSignOutConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsSignOutConfirmOpen(false);
        }}
        title="Sign out of every device?"
        description="This immediately signs you out everywhere you're currently logged in, including this device. You'll need to log in again on each device."
        actionLabel="Sign out everywhere"
        onAction={() => {
          void handleConfirmSignOutEverywhere();
        }}
        isActionLoading={isSigningOutEverywhere}
      />
    </>
  );
}
