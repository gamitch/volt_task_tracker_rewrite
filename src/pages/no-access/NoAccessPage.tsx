/**
 * T020: `/no-access` screen (AUTH-04's "You're not on the roster yet"
 * screen), the fourth member of the `/login`+`/accept-invite` auth-entry-
 * point family (T016, T018, this task). Built from the Astryx
 * `EmptyStateContainer` block template (`Card > EmptyState`, plus optional
 * `Button` actions this page deliberately omits -- see below), wrapped in
 * the same outer `Center > VStack[Heading level=1 "VOLT", Card]` shell
 * `LoginPage.tsx`/`AcceptInvitePage.tsx` already established for this exact
 * family of screens, per constitution item 13 ("adapt content only, do not
 * invent a custom layout"): the design system's own sanctioned `Card >
 * EmptyState` composition is reused as-is, not invented, and the outer
 * chrome match is a brand-consistency choice already precedented by this
 * screen's two siblings, not a custom layout either.
 *
 * CLI cross-check (constitution item 2: the CLI is a cross-check, never a
 * source): `npm run astryx -- template EmptyStateContainer --skeleton` (the
 * template's real id; its display name in `astryx template --list` is
 * "EmptyState — Container") outputs: `Card > [EmptyState, Button
 * variant="secondary", Button variant="primary"]`. This confirms the `Card >
 * EmptyState` pairing used below. This page deliberately omits BOTH
 * `Button`s the generic skeleton shows: AUTH-04's literal requirement is
 * "name of team contact, no data access" plus an automatic sign-out -- no
 * PRD excerpt available to this task calls for any action button on this
 * screen, and the session is already being signed out on mount (see below),
 * so there is nothing left for the user to *do* here. Adding a CTA anyway
 * would be unrequested scope, not a template-fidelity requirement (the
 * skeleton's own Anatomy table lists `actions` as No/optional on
 * `EmptyState` itself -- see `docs/swarm/astryx-api.md` line 3980/3998).
 *
 * -----------------------------------------------------------------------
 * TWO known, explicitly-flagged gaps -- full detail in this task's worker
 * output, summarized here for anyone reading this file later:
 *
 * 1. No `/no-access` route exists anywhere in `router.tsx` -- not even an
 *    inline placeholder (unlike T016/T018's gap, where a placeholder
 *    function already existed and just needed swapping for the real
 *    component). `router.tsx` is a forbidden/read-only file for this task
 *    (confirmed by reading it directly), so this component is not reachable
 *    at any URL in the running app yet. Wiring a brand-new `<Route>` (not
 *    merely swapping an import) is a follow-up task's job.
 *
 * 2. Team-contact data-loading seam: see `./types.ts`'s module doc in full.
 *    In short, `teams` (and every other table in the schema) has NO contact
 *    person/email/phone column anywhere -- this is a schema gap, not merely
 *    a missing Edge Function/RLS fix, and it is compounded by a "which
 *    team?" ambiguity specific to this screen (its caller by definition has
 *    no team association at all). `loadData`/`LoadNoAccessDataFn` below is
 *    the designed seam; `defaultLoadNoAccessData` is an obviously-fake
 *    placeholder, not a real data source.
 * -----------------------------------------------------------------------
 *
 * Sign-out timing decision (this task's Acceptance Criterion 1: "decide and
 * document when the sign-out fires"): ON MOUNT, unconditionally, via a
 * `useEffect` that calls `logout()` from `guards.tsx` exactly once. Reasoning:
 * this screen's entire reason to exist is "this session should have zero
 * access from here on" -- there is no affordance on this screen for the user
 * to reconsider, retry, or otherwise interact before the sign-out should
 * happen (unlike, say, a destructive-action confirmation dialog, where
 * waiting for an explicit click is correct). Firing immediately removes any
 * window where a client-side session object lingers uselessly (RLS already
 * independently guarantees zero data access regardless -- see this task's
 * companion `tests/rls/**` suite -- but there is no reason for the client's
 * own auth state to disagree with that guarantee any longer than necessary).
 *
 * DES-12 state mapping for this screen -- deliberately has FEWER than the
 * usual four buckets, per this task's Acceptance Criterion 2's explicit
 * instruction to document why rather than skip the exercise:
 *   - Empty: N/A as a DISTINCT bucket. Unlike a list screen (where "Empty"
 *     is one of several possible renders once data has loaded) or a form
 *     (where "Empty" is the untouched initial state before either Loading
 *     or Error can occur), this screen's one and only visible render
 *     ALREADY IS an empty-state render (literally the `EmptyState`
 *     component) for its entire lifetime -- there is no other structural
 *     state it could be in instead.
 *   - Loading: deliberately NOT modeled as a distinct branch/spinner. The
 *     `loadData` seam's resolution only ever affects one secondary detail
 *     within the single, already-fully-formed render below (`contactName`,
 *     defaulted to a generic fallback string until/unless the seam
 *     resolves to something more specific) -- it never gates which
 *     structure renders, unlike `AcceptInvitePage.tsx`'s invite lookup
 *     (which gates an entire Spinner-vs-form-vs-error branch). Blocking
 *     this whole screen behind a spinner for that one detail would also
 *     cut against the sign-out-on-mount decision above: the page's
 *     security-relevant guarantees (sign-out, RLS) do not depend on this
 *     fetch succeeding or even completing, so there is no correctness
 *     reason to make the user wait for it visually.
 *   - Error: N/A. No user-triggered action exists anywhere on this screen
 *     that can fail (no submit, no retry, no button at all -- see the CLI
 *     cross-check note above on why both template `Button`s were omitted).
 *     The one async operation this page performs (the `loadData` seam)
 *     degrades silently to its generic fallback string on rejection rather
 *     than surfacing a `Banner` -- a deliberate choice given how low the
 *     stakes of that specific missing detail are relative to what this
 *     screen actually guarantees (the sign-out and the independent RLS
 *     denial), and given there is nothing actionable a "Retry" would even
 *     offer (no real backend implementation exists to retry against yet;
 *     see gap #2 above).
 *   - Populated/success: the ONE render this screen ever shows -- the
 *     `EmptyState` inside a `Card`, for this screen's entire lifetime, with
 *     `contactName` filled in from either the seam's resolved value or its
 *     generic fallback.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Card, Center, EmptyState, Heading, VStack } from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import type { LoadNoAccessDataFn, NoAccessData } from './types';

/**
 * Generic fallback used both before `loadData` resolves and if it rejects --
 * see module doc's "Loading"/"Error" reasoning above for why this page does
 * not gate its render on the seam's outcome. NOT a real team/org contact;
 * an obviously-generic placeholder, disclosed here rather than left
 * unexplained.
 */
const FALLBACK_CONTACT_NAME = 'your coach or team admin';

/**
 * Placeholder, obviously-fake default implementation of
 * `LoadNoAccessDataFn` -- see `./types.ts` module doc and this file's
 * module doc gap #2. Does NOT call Supabase (no real mechanism exists
 * anywhere in the schema to call -- see gap #2). Exists only so this
 * component has *something* to call by default; real callers (a future
 * task's real seam, once the underlying schema gap is resolved, or a
 * verification harness) should pass their own `loadData` prop.
 */
async function defaultLoadNoAccessData(): Promise<NoAccessData> {
  return { contactName: FALLBACK_CONTACT_NAME };
}

export interface NoAccessPageProps {
  /**
   * Data-loading seam (see `./types.ts`). Defaults to the obviously-fake
   * `defaultLoadNoAccessData` placeholder when not supplied -- pass a real
   * implementation (or fixture data, e.g. from a verification harness)
   * here.
   */
  loadData?: LoadNoAccessDataFn;
}

export function NoAccessPage({
  loadData = defaultLoadNoAccessData,
}: NoAccessPageProps = {}): ReactNode {
  const { logout } = useAuth();
  const [contactName, setContactName] = useState(FALLBACK_CONTACT_NAME);

  // Sign-out-on-mount decision -- see module doc above. Runs exactly once;
  // `logout` is a `useCallback`-memoized, stable function from
  // `guards.tsx`'s `AuthProvider`, so this effect never re-fires on
  // unrelated re-renders.
  useEffect(() => {
    logout();
  }, [logout]);

  // Contact-name seam -- see module doc "Loading"/"Error" reasoning above.
  // Silently keeps the generic `FALLBACK_CONTACT_NAME` on rejection; never
  // surfaces an error banner (see module doc for why).
  useEffect(() => {
    let isMounted = true;
    loadData()
      .then((data) => {
        if (isMounted) {
          setContactName(data.contactName);
        }
      })
      .catch(() => {
        // Deliberate no-op -- see module doc "Error" bucket reasoning.
      });
    return () => {
      isMounted = false;
    };
  }, [loadData]);

  return (
    <Center axis="both" height="100vh" width="100%">
      <VStack gap={6} hAlign="center">
        <Heading level={1}>VOLT</Heading>

        <Card width={400} maxWidth="100%" padding={6} variant="default">
          <EmptyState
            title="You're not on the roster yet."
            description={`We couldn't find an invite or profile for your account. If you think this is a mistake, contact ${contactName}.`}
          />
        </Card>
      </VStack>
    </Center>
  );
}

export default NoAccessPage;
