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
 *    the designed seam. T102 (ED-1 Packet P13) partially closes this gap --
 *    see the "T102 -- Trap #3 investigation" section immediately below for
 *    the full reasoning and the exact boundary of what is now real vs. what
 *    remains an honest fallback.
 * -----------------------------------------------------------------------
 *
 * -----------------------------------------------------------------------
 * T102 (ED-1 Packet P13) -- Trap #3 investigation: is there a real,
 * meaningful substitute for "team contact" at all?
 *
 * The packet's own suggestion: query `profiles` for any row with
 * `role = 'admin'` and use its `display_name`, since "contact your coach or
 * team admin" is already this page's own fallback framing, and a real
 * admin's real name is a meaningfully better version of the same idea, not
 * a different concept. Investigated below; the schema/RLS side of that
 * suggestion checks out, but a second, independent ambiguity (already
 * flagged in `./types.ts`'s own module doc, restated and resolved here)
 * determines exactly how far this can honestly go.
 *
 * RLS check: `public.profiles`' `profiles_read` policy
 * (`supabase/migrations/20260717000002_rls.sql`, read-only reference) is
 * `for select to authenticated using (true)` -- ANY authenticated session,
 * including this page's own caller (signed-in but with no matching
 * `profiles`/`students`/`guardian_links` row at all -- the exact AUTH-04
 * case), can read every `profiles` row, `role` included. There is no
 * Trap-#1-style RLS block here (unlike `invites`' `staff_all`-only policy)
 * -- a query for `role = 'admin'` genuinely returns real data for this
 * caller, not a silent false-empty.
 *
 * The real, independent blocker is the ambiguity `./types.ts`'s own module
 * doc already names: nothing in the schema designates any one admin as
 * "the" contact -- `profiles` has no `is_primary`/`is_lead` flag, no
 * per-team admin assignment, nothing. A team with two or more admins
 * (entirely plausible -- a head coach and an assistant, say) gives this
 * page no principled way to prefer one over the other; picking one
 * arbitrarily (e.g. "just take the first row returned") would be inventing
 * a disambiguation rule the schema has no real concept of, exactly the
 * "fake single-contact concept" the packet warns against fabricating.
 *
 * DECISION (a middle path between the packet's two named outcomes, chosen
 * because it is honestly derivable without inventing anything): query
 * `profiles` for `role = 'admin'` rows. If EXACTLY ONE exists, its
 * `display_name` is unambiguously "the" admin -- no disambiguation was
 * needed, so using it is a real, meaningful, non-fabricated answer, not a
 * guess. If ZERO or TWO-OR-MORE exist, there genuinely is no way to name
 * one admin as "the" contact (zero: literally nothing to name; two-or-more:
 * the exact ambiguity above), so this falls back to the pre-existing,
 * honest, disclosed `FALLBACK_CONTACT_NAME` string -- never an arbitrary
 * pick. This is `makeLoadNoAccessData`/`loadNoAccessData` below; the
 * previous fixture (`defaultLoadNoAccessData`) is kept as a named export
 * for tests/disclosure, no longer this component's implicit default, same
 * "demoted fixture" pattern `../accept-invite/AcceptInvitePage.tsx`'s own
 * T102 change and `../roster/InvitesTab.tsx`'s T087 change already
 * established.
 *
 * DISCLOSED RISK: this page's own "Sign-out timing" decision below fires
 * `logout()` on mount, in a SEPARATE effect from the contact-name lookup,
 * with no explicit ordering/await between them. In a real browser, both
 * network calls fire close together; if the client-side sign-out
 * invalidates/clears the session before the `profiles` query's own request
 * lands, that query would run unauthenticated and (per `profiles_read`'s
 * `to authenticated` scoping) return zero rows -- indistinguishable, from
 * this page's perspective, from "no admin profiles exist" (both fall back
 * to `FALLBACK_CONTACT_NAME` via the same code path, never a crash or a
 * stuck loading state, per the "Loading"/"Error" reasoning below). This
 * means the real admin name may in practice often lose this race and never
 * actually display, degrading silently to the same fallback every visit --
 * a real, disclosed risk, not a correctness bug (the fallback framing is
 * itself accurate copy, "contact your coach or team admin," so degrading to
 * it is never wrong, only less specific than it could be). Deliberately NOT
 * fixed by reordering/gating the two effects against each other in this
 * task: the sign-out-on-mount timing itself is `NoAccessPage.tsx`'s own
 * pre-existing, already-decided architecture (see "Sign-out timing
 * decision" below, predates this task and is out of this packet's scope to
 * revisit), and its own reasoning already explicitly accepts that the
 * contact-name fetch's success is not security-relevant and may be sacrificed.
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
 *     offer (this screen has no button/affordance at all -- see the CLI
 *     cross-check note above -- so there is nowhere to surface one even
 *     now that T102 wires a real, sometimes-rejecting query behind this
 *     seam; see the T102 Trap #3 section above for that query and its own
 *     disclosed race-condition risk).
 *   - Populated/success: the ONE render this screen ever shows -- the
 *     `EmptyState` inside a `Card`, for this screen's entire lifetime, with
 *     `contactName` filled in from either the seam's resolved value or its
 *     generic fallback.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Card, Center, EmptyState, Heading, VStack } from '@astryxdesign/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '../../app/guards';
import { getSupabaseClient } from '../../lib/supabase/client';
import { createLoader, type LoaderQueryResult } from '../../lib/supabase/loader';
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
 * Placeholder, obviously-fake implementation of `LoadNoAccessDataFn` -- see
 * `./types.ts` module doc and this file's module doc gap #2. Does NOT call
 * Supabase. T102: no longer this component's implicit default (that's now
 * `loadNoAccessData` below) -- kept as a named export for tests/disclosure,
 * same "demoted fixture" pattern this task's own
 * `../accept-invite/AcceptInvitePage.tsx` change and `../roster/InvitesTab.tsx`'s
 * (T087) `defaultLoadInvitesTabData` already established.
 */
export async function defaultLoadNoAccessData(): Promise<NoAccessData> {
  return { contactName: FALLBACK_CONTACT_NAME };
}

/** Minimal raw projection of `public.profiles` -- only `display_name`, the
 * one field `queryAdminProfiles`/`makeLoadNoAccessData` below need. */
interface AdminContactDbRow {
  display_name: string;
}

/**
 * T102 -- Trap #3's real query: every `profiles` row with `role = 'admin'`
 * (see module doc's "T102 -- Trap #3 investigation" section above for the
 * full RLS/ambiguity reasoning). `.limit(2)` is a deliberate micro-
 * optimization, not a correctness requirement: `makeLoadNoAccessData` below
 * only ever needs to know whether the count is exactly one, zero, or "two
 * or more" -- a second row is already enough to prove "two or more" without
 * fetching every admin row that exists.
 */
async function queryAdminProfiles(
  client: SupabaseClient,
): Promise<LoaderQueryResult<AdminContactDbRow[]>> {
  const result = await client
    .from('profiles')
    .select('display_name')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(2);
  return { data: (result.data as AdminContactDbRow[] | null) ?? null, error: result.error };
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every `loaders/*.ts` file in this codebase already established,
 * so tests can supply a stubbed transport with zero real network calls --
 * see `NoAccessPage.test.tsx`'s `loadNoAccessData (T102 real load, Trap #3)`
 * block.
 */
export function makeLoadNoAccessData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadNoAccessDataFn {
  const loadAdminProfiles = createLoader<void, AdminContactDbRow[]>(queryAdminProfiles, getClient);
  return async (): Promise<NoAccessData> => {
    const admins = (await loadAdminProfiles()) ?? [];
    // T102 Trap #3 decision: only an UNAMBIGUOUS single admin counts as a
    // real "the contact" answer -- zero or two-or-more both fall back to
    // the honest, disclosed FALLBACK_CONTACT_NAME rather than guessing (see
    // module doc above for the full reasoning).
    const contactName = admins.length === 1 ? admins[0].display_name : FALLBACK_CONTACT_NAME;
    return { contactName };
  };
}

/** Default `loadData` for `NoAccessPage` (T102) -- real `profiles` query,
 * degrading to `FALLBACK_CONTACT_NAME` whenever no single admin can be
 * unambiguously named (see module doc "T102 -- Trap #3 investigation"
 * above), and via this page's own pre-existing silent-rejection handling
 * (below) on any genuine query/transport failure too. */
export const loadNoAccessData: LoadNoAccessDataFn = makeLoadNoAccessData();

export interface NoAccessPageProps {
  /**
   * Data-loading seam (see `./types.ts`). T102: defaults to the real
   * `loadNoAccessData` above (a `profiles` query for an unambiguous single
   * admin, see module doc "T102 -- Trap #3 investigation") when not
   * supplied; tests pass a fake/fixture here instead of reaching a real
   * backend.
   */
  loadData?: LoadNoAccessDataFn;
}

export function NoAccessPage({ loadData = loadNoAccessData }: NoAccessPageProps = {}): ReactNode {
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
            headingLevel={2}
            title="You're not on the roster yet."
            description={`We couldn't find an invite or profile for your account. If you think this is a mistake, contact ${contactName}.`}
          />
        </Card>
      </VStack>
    </Center>
  );
}

export default NoAccessPage;
