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
 * 1. THE CENTRAL DESIGN QUESTION -- Reset is NOT an UPDATE, it's
 *    revoke-old + create-new, and `calendar_feeds` has NO uniqueness
 *    constraint on `profile_id` (Known Context/Traps #1, Ground Truth).
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
 * `token` is `unique` -- no two rows can ever share the same token -- but
 * `profile_id` carries NO uniqueness constraint of any kind, unlike
 * `notification_prefs.profile_id` (same migration, `unique`, "one row per
 * profile" enforced by Postgres itself) and unlike `seasons_single_active_idx`
 * (`SeasonSettings.tsx`/T029's own precedent -- a real partial unique index
 * enforcing "at most one `is_active=true` season" at the DATABASE layer).
 * This is a DELIBERATE difference this file must not paper over: a profile
 * CAN accumulate multiple `calendar_feeds` rows over time (one per reset),
 * and nothing in Postgres stops a caller from inserting a second
 * non-revoked row for the same profile. CAL-05's "tokens are UUIDv4,
 * revocable, one active per profile" requirement is therefore an
 * APPLICATION-level invariant this file's callback contract must maintain
 * by construction, not something a unique index guarantees for free the way
 * `SeasonSettings.tsx`/T029 could lean on `seasons_single_active_idx`.
 *
 * The consequence: Reset can NEVER be represented as a plain
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
 *       implementation stamps that exact row's `revoked_at = now()` --
 *       never deletes it (soft-revoke, matching `invites.status='revoked'`).
 *   (b) `profileId` -- the profile a brand-new row (fresh `token`,
 *       `revoked_at = null`) gets created for.
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
 * A real backend implementation (a future wiring task, not this one) is
 * expected to implement `onResetFeedToken` as a single transaction (an RPC
 * running the `update ... set revoked_at = now() where id = $revokeFeedId`
 * and the `insert into calendar_feeds (profile_id) values ($profileId)
 * returning *` together) so a real DB never observes a moment where either
 * zero or two non-revoked rows exist for this profile -- this file cannot
 * prove that transactional detail (no Supabase client is wired in here,
 * section 5 below), but the callback's own single-payload shape is
 * deliberately built so a real implementation CAN satisfy the "exactly one
 * active row" invariant atomically, the same disclosed-but-unprovable
 * posture `SeasonSettings.tsx`/`EndMeetingDialog.tsx` already took for their
 * own multi-statement atomic actions.
 *
 * -----------------------------------------------------------------------
 * 2. The real ICS URL shape (Known Context/Traps #2) -- built from CAL-04's
 *    own literal spec, not guessed, via an injectable base-URL seam.
 * -----------------------------------------------------------------------
 *
 * CAL-04 (PRD line 312, cited verbatim by this task's packet): "GET
 * `/functions/v1/ics?token=<uuid>`". `supabase/functions/ics/**` does not
 * exist yet (T047, a separate parallel task, and this task's own Forbidden
 * Files) -- this file only CONSTRUCTS and DISPLAYS the URL a caller would
 * use, it never calls it. The real Supabase Edge Function invocation shape
 * is `${SUPABASE_FUNCTIONS_URL}/ics?token=${token}` (a Supabase project's
 * Functions base URL, e.g. `https://<project-ref>.functions.supabase.co`,
 * with the literal `/ics` path CAL-04 names and the `token` query param).
 * `buildIcsUrl` below is a pure function taking `(functionsBaseUrl, token)`
 * so the shape is exercised directly in tests without a real project ref.
 * `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` ("https://volt-placeholder-project.
 * functions.supabase.co") is an OBVIOUSLY-fake default for the injectable
 * `functionsBaseUrl` prop -- the same "honest placeholder" posture
 * `MeetingsList.tsx`'s `PLACEHOLDER_CURRENT_SEASON_ID` and
 * `CalendarPage.tsx`'s `PLACEHOLDER_SEASON_ID` already established. A real
 * wiring task (not this one -- `src/lib/supabase/**` is this task's
 * Forbidden Files, read-only reference only) would supply the real
 * project's Functions URL, most likely via a build-time env var (e.g.
 * `import.meta.env.VITE_SUPABASE_FUNCTIONS_URL`) threaded down as this same
 * `functionsBaseUrl` prop -- this file does not read `import.meta.env`
 * itself (no such wiring exists in this repo yet), it only exposes the seam
 * a real caller would fill in.
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
 * 7. No shared Supabase client wired in (Known Context/Traps #7) -- same
 *    posture as every prior content page in this batch.
 * -----------------------------------------------------------------------
 *
 * `loadCalendarFeed`/`onResetFeedToken` are both injectable props, each
 * defaulting to an obviously-fake stub (`defaultLoadCalendarFeed` returns
 * fixture data; `defaultOnResetFeedToken` only `console.warn`s the payload
 * it would have sent, then fabricates a locally-generated new row via
 * `crypto.randomUUID()` -- the same injectable-default-generator idiom
 * `TeamsTab.tsx`'s own `generateId = () => \`team-${crypto.randomUUID()}\`\`
 * already established in this repo -- purely so this stub's own return
 * value is well-formed for local-state purposes; a real implementation
 * would return the DB's own `insert ... returning *` row instead). No
 * `src/lib/supabase/**` import exists anywhere in this file (that directory
 * is read-only/reference-only per this task's Forbidden Files). This file
 * also does NOT read `useAuth()`/any auth context to discover "the current
 * profile" -- `profileId` is a required prop the caller supplies (the same
 * "caller-supplied id, not self-discovered" posture `EndMeetingDialog.tsx`'s
 * `sessionId` prop and `SubscribePopover`'s own sibling widgets already
 * take), since `src/app/guards.tsx` is import-only for the single
 * `pushToast` import this task's Forbidden Files clause names -- not a
 * general read-write reference for auth state.
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
 *  - `Spinner` (Props table, lines 5832-5840): `label` used.
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
 *     "empty" state (disclosed scope decision, not an oversight).
 * -----------------------------------------------------------------------
 *
 * Unlike `CalendarPage.tsx` (whose data can genuinely be zero sessions),
 * this file assumes a `calendar_feeds` row already exists for `profileId`
 * by the time this widget renders -- the same "provisioned elsewhere"
 * assumption `notification_prefs`' own one-row-per-profile precedent
 * implies (a real app would provision the first `calendar_feeds` row at
 * signup/first-visit-to-`/calendar`, a separate, not-yet-built concern this
 * task's packet never asks this file to solve). If `loadCalendarFeed`
 * rejects OR resolves in a way this file cannot use, the error Banner state
 * covers it; there is no third "no feed yet, create one" UI here.
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

/** Module doc section 2. */
export const PLACEHOLDER_SUPABASE_FUNCTIONS_URL =
  'https://volt-placeholder-project.functions.supabase.co';

const FIXTURE_ACTIVE_FEED: CalendarFeedRow = {
  id: 'feed-fixture-current',
  profileId: 'profile-fixture-current',
  token: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  revokedAt: null,
  createdAt: '2026-07-01T12:00:00.000Z',
};

/** Module doc section 10 -- assumes a row is already provisioned for
 * `profileId`; not a real Supabase read. */
export async function defaultLoadCalendarFeed(profileId: string): Promise<CalendarFeedRow> {
  return { ...FIXTURE_ACTIVE_FEED, profileId: profileId || FIXTURE_ACTIVE_FEED.profileId };
}

/**
 * Module doc section 1/7. Represents "the real single transaction that
 * revokes the old row and inserts a new one happened" -- nothing else. Logs
 * the atomic payload it would have sent, then fabricates a well-formed new
 * row locally (via `crypto.randomUUID()`, the same idiom `TeamsTab.tsx`'s
 * own `generateId` already established) purely so this stub's return value
 * is usable by the caller; a real implementation returns the DB's own
 * `insert ... returning *` row instead.
 */
export const defaultOnResetFeedToken: OnResetFeedTokenFn = async (payload) => {
  console.warn(
    '[SubscribePopover] No Supabase client wired in yet (module doc section 7) -- this stub ' +
      'only logs the atomic reset payload (revoke old row + create new row, module doc ' +
      'section 1) a real single transaction would have applied.',
    payload,
  );
  return {
    id: `feed-fixture-${crypto.randomUUID()}`,
    profileId: payload.profileId,
    token: crypto.randomUUID(),
    revokedAt: null,
    createdAt: new Date().toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- same shape every prior content page in
// this batch already establishes locally (no shared hook module exists yet).
// ---------------------------------------------------------------------------

type LoadState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) setState({ status: 'error', error });
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list.
  }, deps);

  return state;
}

// ---------------------------------------------------------------------------
// Main component -- module docs #1 through #10.
// ---------------------------------------------------------------------------

export interface SubscribePopoverProps {
  /** The current profile's id (module doc section 7 -- caller-supplied, not
   * self-discovered from an auth context). */
  profileId: string;
  /** Injectable data-loading seam (module doc section 7). Defaults to fixture data. */
  loadCalendarFeed?: LoadCalendarFeedFn;
  /**
   * Injectable atomic reset seam (module doc section 1). Defaults to a
   * `console.warn` stub. See `ResetFeedTokenPayload` for the single-payload
   * revoke-old + create-new contract.
   */
  onResetFeedToken?: OnResetFeedTokenFn;
  /** Injectable Supabase Functions base URL (module doc section 2). Defaults
   * to an obviously-fake placeholder. */
  functionsBaseUrl?: string;
}

export function SubscribePopover({
  profileId,
  loadCalendarFeed = defaultLoadCalendarFeed,
  onResetFeedToken = defaultOnResetFeedToken,
  functionsBaseUrl = PLACEHOLDER_SUPABASE_FUNCTIONS_URL,
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
      setCopyError(null);
      setIsResetConfirmOpen(false);
    } catch (error) {
      setResetError(
        error instanceof Error ? error.message : 'Something went wrong resetting this link.',
      );
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

  if (loadState.status === 'error' || feed === null) {
    return (
      <Banner
        status="error"
        title="Couldn't load your calendar link"
        description="Something went wrong loading your subscription link. Try refreshing the page."
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
