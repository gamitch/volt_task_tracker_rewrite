/**
 * T046: `SubscribePopover.tsx` -- CAL-03, Epic E7. A "Subscribe" button that
 * opens a real Astryx `Popover` showing the user's personal ICS URL, a Copy
 * link button, the literal "Add to Google Calendar..." helper text, and a
 * Reset link action confirmed via a real `AlertDialog`. This is a
 * STANDALONE, injectable-seam widget per this task's packet -- it is NOT
 * wired into `CalendarPage.tsx`/any route by this task (that file is a
 * Forbidden, read-only reference here, the same not-yet-wired posture every
 * other standalone widget in this batch (`EndMeetingDialog.tsx`/T036,
 * `SeasonSettings.tsx`/T029) already disclosed).
 *
 * -----------------------------------------------------------------------
 * 1. Reset is one persisted lifecycle transition: revoke-old + create-new.
 * -----------------------------------------------------------------------
 *
 * `supabase/migrations/20260717000001_support_audit.sql` lines 45-52 (read
 * directly, not guessed):
 *
 *   create table public.calendar_feeds (
 *     id uuid primary key default gen_random_uuid(),
 *     profile_id uuid not null references public.profiles (id) on delete restrict,
 *     token uuid not null unique default gen_random_uuid(),
 *     revoked_at timestamptz,
 *     created_at timestamptz not null default now()
 *   );
 *
 * The lifecycle migration adds a partial unique index on `profile_id` where
 * `revoked_at is null`, so PostgreSQL enforces CAL-05's at-most-one-active
 * invariant under concurrent requests while still retaining every revoked
 * historical row. Reset can never be represented as a plain
 * `update calendar_feeds set token = gen_random_uuid() where id = ...` --
 * that would violate the soft-revoke convention every other status field in
 * this codebase already follows (`invites.status = 'revoked'` from T027,
 * cited by this task's own packet -- a revoked row STAYS queryable, it is
 * never overwritten or deleted) and it would silently invalidate the OLD
 * token without leaving an auditable trail of *which* token was ever issued
 * to this profile and when it stopped working. Instead, `ResetFeedTokenPayload`
 * below names BOTH real effects Reset must produce as ONE payload, the same
 * shape `SetActiveSeasonPayload` (`SeasonSettings.tsx`/T029) and
 * `EndMeetingPayload` (`EndMeetingDialog.tsx`/T036) already established for
 * "one coherent multi-part atomic action, not two independently-dispatchable
 * calls the UI could leave half-done between them":
 *   (a) `revokeFeedId` -- the CURRENTLY-active row's `id`. A real
 *       the RPC stamps that exact row's `revoked_at = now()` --
 *       never deletes it (soft-revoke, matching `invites.status='revoked'`).
 *   (b) `profileId` -- retained at the page seam for a defensive result
 *       consistency check. It is never sent as server authorization; the
 *       RPC derives the profile exclusively from `auth.uid()`.
 * `OnResetFeedTokenFn` takes this ONE payload and resolves with the newly
 * created row. This is a DISCLOSED, NECESSARY deviation from
 * `OnSetActiveSeasonFn`/`OnEndMeetingFn`'s own `Promise<void>` shape: those
 * two payloads named only ALREADY-CLIENT-KNOWN ids (season ids the caller
 * already had; student ids from the live roster), so local state could be
 * derived from the payload alone after the call resolved. Here, the new
 * row's `token` is DATABASE-GENERATED (`default gen_random_uuid()`, cited
 * above) -- the client cannot predict it, so the callback itself must be the
 * single source of truth for "what the new active row actually is." The
 * payload/callback pair still satisfies the same "one coherent action, not
 * two uncoordinated calls" contract those two precedents established; only
 * the return shape differs, and only because of this real, cited schema
 * fact (a DB `default`, not a design preference). `handleConfirmReset`
 * below computes the ONE payload from the current active row, awaits ONE
 * `onResetFeedToken(payload)` call, and only THEN replaces local `feed`
 * state with the resolved new row (mirroring `SeasonSettings.tsx`'s
 * `withActiveSeason` / `EndMeetingDialog.tsx`'s `applyEndMeetingResult` --
 * "the one place a derived mutation is ever applied to local state," only
 * ever run after the awaited call has already resolved, never optimistically).
 * The production default is `resetCalendarFeed`, which invokes
 * `reset_calendar_feed(p_revoke_feed_id)` once. PostgreSQL performs the
 * ownership check, soft revoke, replacement insert, and `returning *` in one
 * function transaction. If the response is lost, the component re-reads the
 * active feed before showing any URL as current.
 *
 * -----------------------------------------------------------------------
 * 2. The real ICS URL shape (Known Context/Traps #2) -- built from CAL-04's
 *    own literal spec, now wired to the REAL, deployed Functions base URL
 *    (T177).
 * -----------------------------------------------------------------------
 *
 * CAL-04 (PRD line 312, cited verbatim by this task's packet): "GET
 * `/functions/v1/ics?token=<uuid>`". `supabase/functions/ics/index.ts` is a
 * real, finished, deployed Edge Function (T047, landed) -- this file only
 * CONSTRUCTS and DISPLAYS the URL a caller would use, it never calls it
 * itself (an external calendar app does). `buildIcsUrl` below is a pure
 * function taking `(functionsBaseUrl, token)` so the shape is exercised
 * directly in tests without a real project ref.
 *
 * T177 replaced the original "not wired in yet" disclosure below with the
 * real convention: this repo's Functions-base-URL shape is
 * `${VITE_SUPABASE_URL}/functions/v1` (NOT the legacy
 * `https://<project-ref>.functions.supabase.co` domain form this doc
 * originally assumed) -- the same convention `CheckinResult.tsx`/
 * `StudentHome.tsx` already independently established and agree with each
 * other on, derived from the one `VITE_SUPABASE_URL` env var already
 * committed to `.env.example` and already read by `client.ts`.
 * `resolveFunctionsBaseUrl` below is a private `readViteEnvVar('VITE_SUPABASE_URL')`
 * read wrapped in an INJECTABLE-PARAMETER seam (matching
 * `CheckinResult.tsx`'s own `CallCheckinConfig.supabaseUrl?: string`
 * shape) -- not environment stubbing; tests call it with a plain string
 * argument. Passing `${VITE_SUPABASE_URL}/functions/v1` as
 * `functionsBaseUrl` makes `buildIcsUrl`'s final URL
 * `${VITE_SUPABASE_URL}/functions/v1/ics?token=...`, CAL-04's own literal
 * spec satisfied exactly, with zero change to `buildIcsUrl` itself.
 * `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` ("https://volt-placeholder-project.
 * functions.supabase.co") is KEPT as a named export (T105 precedent, packet
 * §3c) but is no longer the default `functionsBaseUrl` value -- it is now
 * only `resolveFunctionsBaseUrl`'s own defensive fallback for a blank/absent
 * `VITE_SUPABASE_URL`, unreachable in practice once `loadCalendarFeed` is
 * real (an unconfigured Supabase client already throws
 * `SupabaseNotConfiguredError` before this line is ever reached -- this
 * line only runs in the `'success'` branch, module doc section 10 below).
 *
 * -----------------------------------------------------------------------
 * 3. `Popover` -- real, documented component (Known Context/Traps #3),
 *    controlled via `isOpen`/`onOpenChange`.
 * -----------------------------------------------------------------------
 *
 * `content` is a read-only `Text type="code"` display of the URL (module
 * doc section 7's citation) -- NOT an editable `TextInput`, per the doc's
 * own "Popover" anatomy ("Body -- Yes -- Main content area") and this task's
 * own instruction that this is "a value to copy, not to type." The Popover
 * trigger `<Button label="Subscribe" />` carries NO `onClick` of its own --
 * `Popover` finds the `<button>` inside its `children` automatically and
 * attaches its own click handler + ARIA wiring (`Popover.tsx`, `attachTrigger`,
 * confirmed by reading the installed source directly), exactly matching the
 * doc's own controlled example (`<Popover isOpen={isOpen} onOpenChange=
 * {setIsOpen} label="Filter" content={<FilterForm />}><Button label="Filter"
 * /></Popover>` -- no `onClick` on that `Button` either).
 *
 * -----------------------------------------------------------------------
 * 4. Copy link (Known Context/Traps #4) -- `navigator.clipboard.writeText`
 *    + `pushToast('Link copied')`, NAV-08's literal toast text (cited
 *    verbatim from `T041-worker-packet.md` line 57, which quotes it from
 *    NAV-08 directly), handled gracefully when the Clipboard API is absent.
 * -----------------------------------------------------------------------
 *
 * `pushToast` is imported READ-ONLY from `../../app/guards` (this task's
 * own Forbidden Files clause explicitly permits this one import). T041
 * (`OutreachDetail.tsx`) has NOT landed yet as of this task's own read of
 * this repo (`Glob` confirms no `src/pages/outreach/OutreachDetail.tsx`
 * exists) -- so per this task's own packet ("reuse the exact pattern T041
 * established (if it's landed) or build it fresh"), `handleCopyLink` below
 * is built fresh, following the packet's own disclosed shape:
 * `navigator.clipboard.writeText(url)` on success -> `pushToast('Link
 * copied')`; when `navigator.clipboard`/`writeText` is unavailable (this
 * repo's jsdom test environment has no Clipboard API at all, confirmed by
 * running the test suite below) or the promise rejects, a local `copyError`
 * Banner inside the popover content discloses the failure instead of
 * silently doing nothing -- no exception escapes to an unhandled rejection.
 *
 * -----------------------------------------------------------------------
 * 5. Reset confirmation (Known Context/Traps #5) -- a real `AlertDialog`,
 *    BEH-09-compliant copy stating the old link will stop working.
 * -----------------------------------------------------------------------
 *
 * `RESET_CONFIRM_DESCRIPTION` below is the packet's own literal suggested
 * wording (Known Context/Traps #5): "Your old calendar link will stop
 * working. Any calendar app using it will need the new link." -- not a bare
 * "Are you sure?" (BEH-09's own "say what happens next" rule, the same
 * literal PRD behavioral rule `EndMeetingDialog.tsx`/`SeasonSettings.tsx`
 * both already satisfy for their own confirm dialogs). `AlertDialog`'s
 * `actionVariant` is left at its documented default (`'destructive'`,
 * astryx-api.md line 2527) -- UNLIKE `EndMeetingDialog.tsx`/T036 (which
 * deliberately overrode to `'primary'` because ending a meeting is a normal,
 * expected workflow completion, that file's own module doc says so
 * explicitly). Resetting a calendar feed token genuinely IS destructive-
 * shaped: it immediately breaks every calendar app that already subscribed
 * using the old URL, a real, disclose-worthy, hard-to-reverse-by-the-user
 * consequence -- the same class of action `MeetingsList.tsx`'s own
 * cancel-meeting `AlertDialog` (that file's own module doc) kept the
 * destructive default for. This is the disclosed, deliberate choice made
 * here, not an oversight or a blind copy of either sibling's own override
 * decision.
 *
 * -----------------------------------------------------------------------
 * 6. BEH-09 -- the Popover itself states what the feed contains (Known
 *    Context/Traps #6).
 * -----------------------------------------------------------------------
 *
 * `FEED_CONTENTS_DESCRIPTION` below: "Includes your meetings, outreach
 * events, and competitions -- from 30 days ago through all future sessions,
 * scoped to what you can see in the portal." Tailored to CAL-04's own real
 * scope (30 days past through all future, role-scoped, per this task's own
 * Known Context/Traps #6) rather than the packet's bare example sentence
 * copied verbatim, since the packet's own wording says "tailor to the real
 * CAL-04 scope," not "copy this exact sentence."
 *
 * -----------------------------------------------------------------------
 * 7. Both production defaults use real Supabase persistence.
 * -----------------------------------------------------------------------
 *
 * `loadCalendarFeed`'s default is now `../../lib/supabase/loaders/
 * calendarFeed`'s own real `loadCalendarFeed` export (`makeLoadCalendarFeed`,
 * built on `createLoader`/`getSupabaseClient` -- the same `loaders/*.ts`
 * shape `settings.ts` already established). `defaultLoadCalendarFeed` (the
 * original fixture stub, returning `FIXTURE_ACTIVE_FEED`) is KEPT as a named
 * export, no longer the default (T105 precedent, packet §3c) -- see its own
 * updated doc comment below.
 *
 * `onResetFeedToken` defaults to the same module's `resetCalendarFeed`, a
 * one-call RPC writer that sends only the active row id and returns the
 * database-created replacement. Profile-insert provisioning and migration
 * backfill ensure real profiles have an active row; no production path
 * fabricates ids or tokens in the browser.
 *
 * This file still does NOT read `useAuth()`/any auth context to discover
 * "the current profile" -- `profileId` is a required prop the caller
 * supplies (the same "caller-supplied id, not self-discovered" posture
 * `EndMeetingDialog.tsx`'s `sessionId` prop and `SubscribePopover`'s own
 * sibling widgets already take), since `src/app/guards.tsx` is import-only
 * for the single `pushToast` import this task's Forbidden Files clause
 * names -- not a general read-write reference for auth state.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    grepped live against `docs/swarm/astryx-api.md` for this task.
 * -----------------------------------------------------------------------
 *
 *  - `Popover` ("Popover" Props table, astryx-api.md lines 5295-5312):
 *    `content`, `isOpen`, `onOpenChange`, `label`, `width`, `children`
 *    used.
 *  - `AlertDialog` (Props table, lines 2518-2530): `isOpen`, `onOpenChange`,
 *    `title`, `description`, `actionLabel`, `onAction`, `isActionLoading`
 *    used (all required except `isActionLoading`). `actionVariant` is left
 *    UNSET (module doc section 5 -- the documented `'destructive'` default
 *    is kept deliberately).
 *  - `Button` (Props table, lines 1807-1827): `label`, `variant`, `onClick`
 *    used (never `onClick` on the Popover's own trigger Button, module doc
 *    section 3).
 *  - `Text` (Props table, lines 858-878): `type` (`'label'`, `'supporting'`,
 *    `'code'`) used -- `'code'` is the real, documented semantic type for a
 *    monospace-styled value display (module doc section 3), not a hand-rolled
 *    `fontFamily: 'monospace'` style.
 *  - `Banner` (Props table, lines 2749-2763): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `Spinner` (Props table, lines 5832-5840): `label` used. T081 (DES-12
 *    loading-state sweep) judgment call: kept as `Spinner`, NOT switched to
 *    `Skeleton`. This widget's entire loaded shape is one small trigger
 *    `Button` ("Subscribe") -- not a table/card-grid/list-row with a
 *    meaningfully previewable layout, the class of content Astryx's own
 *    Skeleton doc calls out ("tables, card grids, list rows"). A
 *    button-sized `Skeleton` block would offer no real layout-preview value
 *    over a `Spinner` here, so `Spinner` remains the better fit per
 *    Astryx's own "don't force a bad fit" guidance.
 *  - `VStack`/`HStack` ("Stack" section, lines 350-396): `gap`, `wrap` used.
 *
 * -----------------------------------------------------------------------
 * 9. Constitution item 13 -- no box-drawing/bracket characters rendered.
 * -----------------------------------------------------------------------
 *
 * The only non-ASCII punctuation this file renders in the DOM is the em
 * dash (`--`, ASCII, used throughout this comment block only, never in
 * rendered JSX) and the real right-arrow (`->`) inside the literal "Add to
 * Google Calendar: Settings -> Add calendar -> From URL" helper text, which
 * is CAL-03's OWN literal PRD wording (PRD line 311, cited verbatim by this
 * task's packet) -- not a box-drawing character (`+--+|` etc.) or a literal
 * bracket (`[`/`]`), the two things constitution item 13 actually bars.
 *
 * -----------------------------------------------------------------------
 * 10. DES-12 states -- loading / error / populated only, no separate
 *     "empty" state (disclosed scope decision, not an oversight). T177:
 *     this is the REAL state every real profile is in today.
 * -----------------------------------------------------------------------
 *
 * Unlike `CalendarPage.tsx` (whose data can genuinely be zero sessions),
 * this file assumes a `calendar_feeds` row already exists for `profileId`
 * by the time this widget renders. The lifecycle migration provisions
 * existing and future profiles. If `loadCalendarFeed`
 * rejects OR resolves in a way this file cannot use, the error Banner state
 * covers it; there is no third "no feed yet, create one" UI here.
 *
 * T177 wired `loadCalendarFeed`'s default to a real Supabase read
 * (`../../lib/supabase/loaders/calendarFeed.ts`), which fails loud (throws)
 * on zero active rows rather than fabricating fixture data (module doc
 * section 7 above). A missing row therefore remains an honest invariant-
 * failure state rather than a reason to synthesize a token in the browser.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Banner,
  Button,
  HStack,
  Popover,
  Spinner,
  Text,
  VStack,
} from '@astryxdesign/core';
import { pushToast } from '../../app/guards';
import {
  loadCalendarFeed as loadCalendarFeedReal,
  resetCalendarFeed as resetCalendarFeedReal,
} from '../../lib/supabase/loaders/calendarFeed';

// ---------------------------------------------------------------------------
// Ground truth -- module doc section 1. Re-derived locally, camelCase
// renames of `calendar_feeds` (`supabase/migrations/20260717000001_
// support_audit.sql` lines 45-52).
// ---------------------------------------------------------------------------

export interface CalendarFeedRow {
  id: string;
  profileId: string;
  /** `calendar_feeds.token`, uuid, `unique`, `default gen_random_uuid()`. */
  token: string;
  /** `calendar_feeds.revoked_at`, nullable timestamptz -- soft-revoke, never deleted. */
  revokedAt: string | null;
  createdAt: string;
}

/** Injectable data-loading seam (module doc section 7). Resolves the
 * caller's CURRENTLY-active (non-revoked) row. */
export type LoadCalendarFeedFn = (profileId: string) => Promise<CalendarFeedRow>;

/**
 * Module doc section 1 -- the atomicity contract. Names BOTH the row being
 * revoked (`revokeFeedId`) and the profile the new row is created for
 * (`profileId`) in ONE payload, so "reset" is a property of the TYPE (one
 * coherent action), not just of how this file happens to call things today.
 */
export interface ResetFeedTokenPayload {
  profileId: string;
  /** The currently-active row's `id` -- the one whose `revoked_at` gets
   * stamped `now()` by a real implementation (soft-revoke, never deleted). */
  revokeFeedId: string;
}

/**
 * Module doc section 1's disclosed deviation from `OnSetActiveSeasonFn`/
 * `OnEndMeetingFn`: resolves with the newly created row (its `token` is
 * DB-generated, not client-predictable), rather than `Promise<void>`.
 */
export type OnResetFeedTokenFn = (payload: ResetFeedTokenPayload) => Promise<CalendarFeedRow>;

// ---------------------------------------------------------------------------
// Pure helpers -- exported for direct testing.
// ---------------------------------------------------------------------------

/** Module doc section 2 -- CAL-04's own literal URL shape,
 * `${SUPABASE_FUNCTIONS_URL}/ics?token=${token}`. */
export function buildIcsUrl(functionsBaseUrl: string, token: string): string {
  const trimmedBase = functionsBaseUrl.replace(/\/+$/, '');
  return `${trimmedBase}/ics?token=${token}`;
}

/** Module doc section 1 -- the ONE payload representing both Reset effects. */
export function buildResetFeedTokenPayload(
  profileId: string,
  activeFeed: CalendarFeedRow,
): ResetFeedTokenPayload {
  return { profileId, revokeFeedId: activeFeed.id };
}

/**
 * Module doc section 2 -- reads a Vite-injected `import.meta.env` var
 * without requiring a new `vite-env.d.ts` ambient-types file (out of this
 * task's Allowed Files). Independently authored, same idiom
 * `CheckinResult.tsx`/`StudentHome.tsx` each already established for
 * themselves (that file's own module doc: "INDEPENDENTLY-AUTHORED... never
 * imported from... same envs") -- not a new shared helper module.
 */
function readViteEnvVar(key: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[key];
}

/**
 * Module doc section 2 -- the real Functions-base-URL convention this repo
 * already established, twice, independently (`CheckinResult.tsx`/
 * `StudentHome.tsx`): `${VITE_SUPABASE_URL}/functions/v1`. An
 * INJECTABLE-PARAMETER seam (matching `CheckinResult.tsx`'s own
 * `CallCheckinConfig.supabaseUrl?: string`), not environment stubbing --
 * `vi.stubEnv` does not reach this module's `import.meta.env` read (measured
 * directly). Trims the input and strips a trailing slash (same
 * `.replace(/\/+$/, '')` treatment `CheckinResult.tsx` already applies to
 * its own raw `VITE_SUPABASE_URL` value, avoiding a double slash before
 * `/functions/v1` -- a distinct concern from `buildIcsUrl`'s own separate
 * trailing-slash strip on the FINAL `functionsBaseUrl`, right before
 * appending `/ics`, above). Falls back to
 * `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` for a blank/absent env var
 * (defensive; unreachable in practice once `loadCalendarFeed` is real -- see
 * module doc section 2).
 */
export function resolveFunctionsBaseUrl(
  rawSupabaseUrl: string | undefined = readViteEnvVar('VITE_SUPABASE_URL'),
): string {
  const trimmedBase = (rawSupabaseUrl ?? '').trim().replace(/\/+$/, '');
  return trimmedBase ? `${trimmedBase}/functions/v1` : PLACEHOLDER_SUPABASE_FUNCTIONS_URL;
}

// ---------------------------------------------------------------------------
// Literal copy -- module doc sections 5/6/9.
// ---------------------------------------------------------------------------

/** BEH-09 -- module doc section 6, tailored to CAL-04's real scope. */
export const FEED_CONTENTS_DESCRIPTION =
  'Includes your meetings, outreach events, and competitions — from 30 days ago through ' +
  'all future sessions, scoped to what you can see in the portal.';

/** CAL-03's own literal helper text (PRD line 311, cited verbatim), module
 * doc section 9. */
export const GOOGLE_CALENDAR_HELPER_TEXT =
  'Add to Google Calendar: Settings → Add calendar → From URL';

/** BEH-09 -- module doc section 5, the packet's own literal suggested
 * wording for "what happens next." */
export const RESET_CONFIRM_DESCRIPTION =
  'Your old calendar link will stop working. Any calendar app using it will need the new link.';

const RESET_CONFIRM_TITLE = 'Reset your calendar link?';

// ---------------------------------------------------------------------------
// Injectable defaults -- module doc section 2/7. Obviously-fake, fixture-only.
// ---------------------------------------------------------------------------

/** Module doc section 2 -- T177: KEPT as a named export (T105 precedent,
 * packet §3c), but this is NO LONGER the default `functionsBaseUrl` value.
 * `resolveFunctionsBaseUrl`'s own defensive fallback for a blank/absent
 * `VITE_SUPABASE_URL` env var, unreachable in practice once
 * `loadCalendarFeed` is real. */
export const PLACEHOLDER_SUPABASE_FUNCTIONS_URL =
  'https://volt-placeholder-project.functions.supabase.co';

const FIXTURE_ACTIVE_FEED: CalendarFeedRow = {
  id: 'feed-fixture-current',
  profileId: 'profile-fixture-current',
  token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  revokedAt: null,
  createdAt: '2026-07-01T12:00:00.000Z',
};

/** Module doc section 10 -- T177: KEPT as a named export (T105 precedent,
 * packet §3c), but this is NO LONGER the default `loadCalendarFeed` value
 * (see `../../lib/supabase/loaders/calendarFeed.ts`'s own real
 * `loadCalendarFeed` export for the current default). Still assumes a row is
 * already provisioned for `profileId`; not a real Supabase read. */
export async function defaultLoadCalendarFeed(profileId: string): Promise<CalendarFeedRow> {
  return { ...FIXTURE_ACTIVE_FEED, profileId: profileId || FIXTURE_ACTIVE_FEED.profileId };
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- same shape every prior content page in
// this batch already establishes locally (no shared hook module exists yet).
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
// Main component -- module docs #1 through #10.
// ---------------------------------------------------------------------------

export interface SubscribePopoverProps {
  /** The current profile's id (module doc section 7 -- caller-supplied, not
   * self-discovered from an auth context). */
  profileId: string;
  /** Injectable data-loading seam (module doc section 7). Defaults to the
   * real Supabase-backed `loadCalendarFeed` (`../../lib/supabase/loaders/
   * calendarFeed.ts`), T177. */
  loadCalendarFeed?: LoadCalendarFeedFn;
  /**
   * Injectable atomic reset seam (module doc section 1). Defaults to the
   * real `reset_calendar_feed` RPC writer. See `ResetFeedTokenPayload` for
   * the single-payload revoke-old + create-new contract.
   */
  onResetFeedToken?: OnResetFeedTokenFn;
  /** Injectable Supabase Functions base URL (module doc section 2). Defaults
   * to `resolveFunctionsBaseUrl()`, which reads the real `VITE_SUPABASE_URL`
   * env var (T177). */
  functionsBaseUrl?: string;
}

export function SubscribePopover({
  profileId,
  loadCalendarFeed = loadCalendarFeedReal,
  onResetFeedToken = resetCalendarFeedReal,
  functionsBaseUrl = resolveFunctionsBaseUrl(),
}: SubscribePopoverProps): ReactNode {
  const loadState = useLoadState(() => loadCalendarFeed(profileId), [loadCalendarFeed, profileId]);
  const [feed, setFeed] = useState<CalendarFeedRow | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') setFeed(loadState.data);
  }, [loadState]);

  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isResetStatusUnknown, setIsResetStatusUnknown] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleConfirmReset(): Promise<void> {
    if (feed === null) return;
    // Module doc section 1: ONE payload naming both Reset effects, computed
    // from the current live active row.
    const payload = buildResetFeedTokenPayload(profileId, feed);
    setIsResetting(true);
    setResetError(null);
    try {
      // Module doc section 1: ONE call. Local state is only ever replaced
      // below, after this awaited call has already resolved with the real
      // new row -- no optimistic half-flip, no client-guessed token.
      const newFeed = await onResetFeedToken(payload);
      setFeed(newFeed);
      setIsResetStatusUnknown(false);
      setCopyError(null);
      setIsResetConfirmOpen(false);
    } catch (error) {
      const resetMessage =
        error instanceof Error ? error.message : 'Something went wrong resetting this link.';

      // An HTTP rejection has unknown commit status: PostgreSQL may have
      // committed the reset before the response was lost. Read the active row
      // back before showing any URL as current.
      try {
        const authoritativeFeed = await loadCalendarFeed(profileId);
        setFeed(authoritativeFeed);
        setIsResetStatusUnknown(false);
        setCopyError(null);
        setIsResetConfirmOpen(false);
        setResetError(`${resetMessage} We refreshed the current link below.`);
      } catch {
        // Neither the old nor a replacement URL can be called current when
        // reconciliation also fails. Clearing the row hides copy/reset actions
        // until the page can load authoritative state again.
        setFeed(null);
        setResetError(null);
        setIsResetStatusUnknown(true);
        setCopyError(null);
        setIsResetConfirmOpen(false);
      }
    } finally {
      setIsResetting(false);
    }
  }

  async function handleCopyLink(url: string): Promise<void> {
    setCopyError(null);
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
      setCopyError('Clipboard access is not available in this browser. Copy the link manually.');
      return;
    }
    try {
      await clipboard.writeText(url);
      pushToast('Link copied');
    } catch (error) {
      setCopyError(error instanceof Error ? error.message : 'Could not copy the link.');
    }
  }

  if (loadState.status === 'loading') {
    return <Spinner label="Loading your calendar link..." />;
  }

  if (isResetStatusUnknown) {
    return (
      <Banner
        status="error"
        title="Couldn't confirm your calendar link"
        description="The reset request may have succeeded, but the current link status could not be confirmed. Refresh before copying or sharing a calendar link."
      />
    );
  }

  if (loadState.status === 'error' || feed === null) {
    return (
      <Banner
        status="error"
        title="Couldn't load your calendar link"
        description="Something went wrong loading your subscription link. Try refreshing the page."
        endContent={
          loadState.status === 'error' ? (
            <Button variant="ghost" label="Retry" onClick={loadState.retry} />
          ) : undefined
        }
      />
    );
  }

  const icsUrl = buildIcsUrl(functionsBaseUrl, feed.token);

  return (
    <VStack gap={3}>
      {resetError !== null && (
        <Banner
          status="error"
          title="Couldn't reset your calendar link"
          description={resetError}
          isDismissable
          onDismiss={() => setResetError(null)}
        />
      )}

      <Popover
        isOpen={isPopoverOpen}
        onOpenChange={setIsPopoverOpen}
        label="Subscribe to calendar"
        width={360}
        content={
          <VStack gap={3}>
            <Text type="label">Personal calendar feed</Text>
            <Text type="supporting">{FEED_CONTENTS_DESCRIPTION}</Text>
            <Text type="code">{icsUrl}</Text>

            {copyError !== null && (
              <Banner
                status="warning"
                title="Couldn't copy link"
                description={copyError}
                isDismissable
                onDismiss={() => setCopyError(null)}
              />
            )}

            <HStack gap={2} wrap="wrap">
              <Button
                label="Copy link"
                variant="secondary"
                onClick={() => {
                  void handleCopyLink(icsUrl);
                }}
              />
              <Button
                label="Reset link"
                variant="ghost"
                onClick={() => setIsResetConfirmOpen(true)}
              />
            </HStack>

            <Text type="supporting">{GOOGLE_CALENDAR_HELPER_TEXT}</Text>
          </VStack>
        }
      >
        <Button label="Subscribe" variant="secondary" />
      </Popover>

      <AlertDialog
        isOpen={isResetConfirmOpen}
        onOpenChange={(open) => {
          if (!open) setIsResetConfirmOpen(false);
        }}
        title={RESET_CONFIRM_TITLE}
        description={RESET_CONFIRM_DESCRIPTION}
        actionLabel="Reset link"
        onAction={() => {
          void handleConfirmReset();
        }}
        isActionLoading={isResetting}
      />
    </VStack>
  );
}

export default SubscribePopover;
