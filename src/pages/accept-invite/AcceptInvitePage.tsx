/**
 * T018: `/accept-invite` screen (AUTH-03 step 3), built from the Astryx
 * `Login Card` template as-is (PRD 7.1: "`/accept-invite` -> `Login Card`
 * pattern"), per constitution item 13 (adapt content only, do not invent a
 * custom layout). Mirrors `../login/LoginPage.tsx`'s established pattern
 * (T016, read-only reference, NOT imported from here): real Astryx
 * components, an explicit DES-12 state mapping, and `guards.tsx`
 * placeholder wiring, plus the same "flag the gap, don't invent
 * architecture" posture T016 used.
 *
 * AUTH-03 step 3 (verbatim): "Recipient lands on `/accept-invite`: shows
 * their name + role, choice of 'Set a password' or 'Continue with
 * Google'."
 *
 * CLI cross-check (constitution item 2: the CLI is a cross-check, never a
 * source): `npm run astryx -- template login-card --skeleton` (the
 * template's actual display name, "Login Card", resolves directly as a
 * CLI id here, unlike T016's "Basic Login") outputs:
 * `Center > VStack > [Icon+Text logo row] > Card > VStack > [VStack[
 * Heading+Text header], VStack[TextInput, VStack[TextInput, Link]],
 * Button variant="primary", Divider, VStack[Button variant="secondary",
 * Button variant="secondary"], Text, Link] > VStack[Text, Link, Link]`.
 * This confirms the Center/VStack/Card skeleton and the
 * primary-button-then-Divider-then-secondary-button(s) shape used below.
 * AUTH-03 is definitive over the generic CLI skeleton for the exact
 * fields/actions it requires: this page needs one "Continue with Google"
 * secondary button (not two), no second TextInput+Link row (no "forgot
 * password" concept applies to an invite that hasn't been accepted yet),
 * and no outer footer `VStack[Text, Link, Link]` (that slot is generically
 * a "don't have an account? Sign up" affordance in the generic template --
 * AUTH-01 disables public signup, so reproducing it here would be the
 * exact "Create account" violation T016 was explicit about avoiding on
 * `/login`). The VOLT wordmark treatment (`Heading level={1}` above the
 * `Card`, not the CLI skeleton's generic `Icon+Text` logo row -- no logo
 * asset exists anywhere in the repo, confirmed empty `public/**`) is kept
 * consistent with `LoginPage.tsx`'s established choice, per this task's
 * Acceptance Criterion 1.
 *
 * -----------------------------------------------------------------------
 * THREE known, explicitly-flagged structural/architecture gaps -- full
 * detail in this task's worker output, summarized here for anyone reading
 * this file later:
 *
 * 1. `router.tsx`'s `/accept-invite` route still renders its own inline
 *    `AcceptInvitePage()` placeholder (defined in that file itself).
 *    `router.tsx` is a forbidden file for this task, so this component is
 *    not reachable at `/accept-invite` in the running app yet -- the exact
 *    gap T016 hit for `/login`, predicted by T016's own worker output to
 *    recur here.
 *
 * 2. Invite-data-loading seam: see `./types.ts`'s module doc in full. In
 *    short, `invites` RLS (`staff_all` only) forbids the read this page
 *    would need to perform, so "invitee name + role" is supplied via the
 *    `loadInvite` prop / `LoadInviteFn` seam below, not a live Supabase
 *    query. `defaultLoadInvite` in this file is an obviously-fake
 *    placeholder, not a real data source.
 *
 * 3. `guards.tsx`'s `Role` union previously (`'admin' | 'staff' |
 *    'volunteer' | 'coach'`, a stale T005 placeholder per that file's own
 *    doc comment) did not match AUTH-05's real `role_enum` (`'admin' |
 *    'coach' | 'student' | 'parent'`) -- T073a reconciled the two, so
 *    `guards.tsx`'s `Role` now IS AUTH-05's vocabulary verbatim. This page
 *    displays the invite's real AUTH-05 role via `InviteRole`
 *    (`./types.ts`), still completely independent of `guards.tsx`'s
 *    `Role` -- when *completing* sign-up (calling `login({ id, email,
 *    role })`), this file still does NOT attempt to carry the invite's
 *    real displayed role through to the login call: no real
 *    credential-to-role resolution exists yet (no Supabase client wired
 *    into `guards.tsx`'s placeholder `login()`), so mapping `InviteRole`
 *    to a real session role would be inventing unearned precision. Per
 *    this task's Known Context/Traps #4, this file uses the same flat
 *    placeholder role `LoginPage.tsx` already established
 *    (`PLACEHOLDER_SIGN_IN_ROLE: Role = 'coach'`, T073a's chosen shared
 *    placeholder value) for every invite regardless of the invite's actual
 *    displayed role, and says so here explicitly rather than silently
 *    coercing.
 * -----------------------------------------------------------------------
 *
 * DES-12 four-state mapping for this (non-list) screen -- see this task's
 * worker output for the full reasoning; restated here for future
 * maintainers:
 *   - Empty: once the invite has loaded and its status is `'pending'`,
 *     the resting state before the user has typed anything -- both
 *     password fields blank, no banner. Same interpretation as
 *     `LoginPage.tsx`'s "Empty" (a form's untouched initial render, not a
 *     dedicated `EmptyState` component -- this is not a list screen).
 *   - Loading: TWO distinct async waits both fold into this bucket,
 *     because from the user's perspective both are simply "the screen is
 *     waiting on a network round trip it cannot skip": (a) the initial
 *     invite lookup via the `loadInvite` seam on mount (`inviteLoadState
 *     === 'loading'`, rendered as a `Spinner` in place of the form, since
 *     there is nothing to show yet -- name/role/status are literally
 *     unknown), and (b) submit-in-flight for the chosen completion action
 *     ("Set password" `Button`'s `isLoading`, or "Continue with Google"'s
 *     `clickAction`-driven pending state) once the invite is known-good.
 *   - Error: covers (a) the invite resolving to a non-actionable status --
 *     `'expired'`/`'revoked'`/`'accepted'` -- via `Banner status="error"`
 *     replacing the form entirely (nothing here would help by retrying),
 *     DES-16 copy ("what happened + what to do", no apologies); (b) the
 *     `loadInvite` call itself rejecting (a genuine network/lookup
 *     failure, distinct from a domain-valid "expired" answer) via
 *     `Banner status="error"` with a `Retry` action, since retrying a
 *     transient failure IS useful, unlike (a); and (c) a failed
 *     "Set password"/"Continue with Google" submission, via
 *     `Banner status="error"` inside the still-rendered form, mirroring
 *     `LoginPage.tsx`'s `formError` pattern exactly.
 *   - Populated/success: the normal resting state once the user has typed
 *     matching password/confirm values into an invite that resolved
 *     `'pending'` -- ready to submit. No separate in-page "success" render
 *     exists beyond this, since a successful completion navigates away via
 *     `consumeIntendedUrl`, same interpretation as `LoginPage.tsx`.
 *
 * The `'accepted'` case is not explicitly called out by AUTH-03/this
 * task's packet (only expired/revoked are), but `invites.status`'s check
 * constraint has four members, not two, and this file's `InviteStatus`
 * type mirrors it exactly -- so `getInviteStatusError` below is written as
 * an exhaustive switch (a `never`-checked default) rather than only
 * special-casing two of the four. This is a defensive completeness choice
 * confined entirely to this task's own Allowed Files, not new invented
 * scope; it is called out explicitly in this task's worker output.
 *
 * `SIMULATED_ASYNC_LATENCY_MS` below is a deliberate, disclosed
 * implementation choice, not a PRD requirement -- same category and same
 * reasoning as `LoginPage.tsx`'s identical constant: `guards.tsx`'s
 * `login()`/`loginWithGoogle()` placeholders resolve essentially
 * instantly, and this file's own placeholder `defaultLoadInvite` has
 * nothing real to await either, which would make the Loading state
 * (correctly wired) visually imperceptible. Remove once real async calls
 * with real latency replace these placeholders.
 */
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Center,
  Divider,
  Heading,
  Spinner,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import { consumeIntendedUrl, useAuth } from '../../app/guards';
import type { AcceptInviteData, InviteRole, InviteStatus, LoadInviteFn } from './types';

/** See module doc above -- placeholder-latency disclosure, not a PRD value.
 * T073b2: only `defaultLoadInvite`'s own fixture-loading delay still uses
 * this -- the "Set a password" submit round trip that used to reuse it was
 * migrated to a real `login()` call (see `handleSetPassword` below), which
 * has its own real latency and no longer needs a borrowed fake delay. */
const SIMULATED_ASYNC_LATENCY_MS = 350;

/**
 * Surfaces a real error's own `.message` when available, falling back to a
 * generic description otherwise. Same helper/reasoning as
 * `../login/LoginPage.tsx`'s identical function -- duplicated locally
 * rather than factored into a shared module, since these are this task's
 * only two call sites and neither file may introduce a new shared utility
 * module outside its own Allowed Files.
 */
function describeAuthError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Minimum password length enforced by this form. Not a PRD requirement --
 * no AUTH-0x excerpt available to this task specifies one -- a reasonable
 * engineering default disclosed here rather than silently assumed. */
const MIN_PASSWORD_LENGTH = 8;

const INVITE_ROLE_LABELS: Record<InviteRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  student: 'Student',
  parent: 'Parent',
};

/** Sentence-case-friendly "a Coach" / "an Admin" article helper. */
function withArticle(label: string): string {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}

/**
 * Fixture invite used by `defaultLoadInvite` below. Only meaningful if
 * this component is ever rendered without a `loadInvite` prop supplied
 * (e.g. before a real data-loading seam exists) -- see module doc gap #2.
 */
const DEFAULT_PLACEHOLDER_INVITE: AcceptInviteData = {
  name: 'Jordan Rivera',
  email: 'jordan.rivera@example.com',
  role: 'coach',
  status: 'pending',
};

/**
 * Placeholder, obviously-fake default implementation of `LoadInviteFn` --
 * see `./types.ts` module doc and this file's module doc gap #2. Does NOT
 * call Supabase. Exists only so this component has *something* to call by
 * default; real callers (a future task's real seam, or a verification
 * harness) should pass their own `loadInvite` prop.
 */
async function defaultLoadInvite(token: string | null): Promise<AcceptInviteData> {
  // `token` is intentionally unused -- this placeholder always returns the
  // same fixture invite regardless of what token (if any) was supplied.
  // A real implementation would use it to look up the actual invite.
  void token;
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_ASYNC_LATENCY_MS));
  return DEFAULT_PLACEHOLDER_INVITE;
}

type InviteLoadState = 'loading' | 'ready' | 'error';

interface PasswordFieldErrors {
  password?: string;
  confirmPassword?: string;
}

interface FormBannerError {
  title: string;
  description: string;
}

export interface AcceptInvitePageProps {
  /**
   * Data-loading seam (see `./types.ts`). Defaults to the obviously-fake
   * `defaultLoadInvite` placeholder when not supplied -- pass a real
   * implementation (or fixture data, e.g. from a verification harness)
   * here.
   */
  loadInvite?: LoadInviteFn;
}

/**
 * DES-16-compliant copy for a non-actionable invite status. Returns `null`
 * for `'pending'` (not an error at all). Exhaustive switch -- see module
 * doc note on the deliberately-included `'accepted'` case.
 */
function getInviteStatusError(status: InviteStatus): FormBannerError | null {
  switch (status) {
    case 'pending':
      return null;
    case 'expired':
      return {
        title: 'This invite has expired',
        description: 'Ask your coach to send a new one.',
      };
    case 'revoked':
      return {
        title: 'This invite has been revoked',
        description: 'Ask your coach to send a new one.',
      };
    case 'accepted':
      return {
        title: 'This invite has already been accepted',
        description: 'Sign in instead if you already set up your account.',
      };
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled invite status: ${String(_exhaustive)}`);
    }
  }
}

export function AcceptInvitePage({
  loadInvite = defaultLoadInvite,
}: AcceptInvitePageProps = {}): ReactNode {
  const { login, loginWithGoogle, user, isLoading, noProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  // Invite lookup state (module doc "Loading"/"Error" bucket, sub-case (a)/(b)).
  const [inviteLoadState, setInviteLoadState] = useState<InviteLoadState>('loading');
  const [inviteData, setInviteData] = useState<AcceptInviteData | null>(null);
  const [inviteLoadError, setInviteLoadError] = useState<FormBannerError | null>(null);

  // "Set a password" form state.
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormBannerError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});

  const runLoadInvite = useCallback(() => {
    setInviteLoadState('loading');
    setInviteLoadError(null);
    loadInvite(token)
      .then((data) => {
        setInviteData(data);
        setInviteLoadState('ready');
      })
      .catch(() => {
        setInviteLoadError({
          title: "We couldn't load this invite",
          description: 'Refresh the page or ask your coach to send a new one.',
        });
        setInviteLoadState('error');
      });
  }, [loadInvite, token]);

  useEffect(() => {
    runLoadInvite();
    // Re-runs only when the seam function or token identity changes, not
    // on every render -- `runLoadInvite` is itself memoized against both.
  }, [runLoadInvite]);

  // T073b2 OAuth-redirect-leg design -- mirrors `../login/LoginPage.tsx`'s
  // identical `useEffect` (see that file's module doc for the full
  // double-navigate-avoidance reasoning, which applies verbatim here): the
  // single source of post-completion navigation for BOTH the "Set a
  // password" path and the Google OAuth return leg. Neither
  // `handleSetPassword` nor `handleGoogleSignIn` below calls
  // `navigate(consumeIntendedUrl())` inline for the same reason
  // `LoginPage.tsx` doesn't -- `consumeIntendedUrl()` both reads AND clears
  // the stored intended URL, so a second inline call after this effect's
  // own call would silently collapse to the `/` fallback instead of the
  // real destination.
  useEffect(() => {
    if (!isLoading && !noProfile && user) {
      navigate(consumeIntendedUrl('/'), { replace: true });
    }
  }, [user, isLoading, noProfile, navigate]);

  const handleSetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!inviteData) {
      return;
    }

    const nextFieldErrors: PasswordFieldErrors = {};
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      nextFieldErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (!confirmPassword) {
      nextFieldErrors.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      nextFieldErrors.confirmPassword = 'Passwords do not match';
    }
    setFieldErrors(nextFieldErrors);

    if (nextFieldErrors.password || nextFieldErrors.confirmPassword) {
      setFormError({
        title: "Couldn't set password",
        description: 'Fix the highlighted fields and try again.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // T073b2: migrated to the new `login(email, password)` contract (see
      // module doc gap #2/#3, further specified here). This attempts a
      // REAL Supabase sign-in with the password just chosen -- it does NOT
      // itself set that password on the backend. No `updateUser({ password
      // })` wrapper exists yet in `../../lib/supabase/auth.ts` (a
      // forbidden/read-only file for this task), and adding one is out of
      // this task's scope (this task's Allowed Files cover only
      // `login`/`loginWithGoogle`/`logout`'s own call sites, not a new
      // backend function). A complete real "accept invite" flow needs, in
      // order: (a) a session already established from the invite email's
      // own link/token (the Supabase client auto-parses that on load, the
      // same mechanism the Google OAuth return leg below relies on), then
      // (b) a real `updateUser({ password })` call while that session is
      // active to actually set the password -- only then would this
      // `login()` call have a real password to authenticate against. Until
      // (a)/(b) exist, this call will realistically fail against a live
      // backend, surfaced via the `catch` below exactly like any other
      // sign-in failure -- a disclosed, deferred gap, not a regression this
      // task introduced.
      await login(inviteData.email, password);
      // No inline `navigate()` here -- see the `useEffect` above.
    } catch (error) {
      setFormError({
        title: "Couldn't set password",
        description: describeAuthError(
          error,
          'We could not finish setting up your account. Try again.',
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError(null);
    try {
      // Redirects back to this exact page (path + query string, including
      // `?token=...`) once the OAuth round trip completes -- mirrors
      // `LoginPage.tsx`'s identical design. `AuthProvider`'s
      // `subscribeToAuthStateChange` listener picks up the resulting
      // `SIGNED_IN` event on that later mount; the `useEffect` above then
      // navigates once `user` resolves.
      const redirectTo = `${window.location.origin}${location.pathname}${location.search}`;
      await loginWithGoogle(redirectTo);
      // No inline action here either -- see the `useEffect` above.
    } catch (error) {
      setFormError({
        title: 'Google sign-in failed',
        description: describeAuthError(
          error,
          'We could not complete sign-in with Google. Try again.',
        ),
      });
    }
  };

  const inviteStatusError = inviteData ? getInviteStatusError(inviteData.status) : null;

  return (
    <Center axis="both" height="100vh" width="100%">
      <VStack gap={6} hAlign="center">
        <Heading level={1}>VOLT</Heading>

        <Card width={400} maxWidth="100%" padding={6} variant="default">
          {inviteLoadState === 'loading' ? (
            <VStack gap={4} hAlign="center">
              <Spinner label="Loading your invite…" />
            </VStack>
          ) : null}

          {inviteLoadState === 'error' && inviteLoadError ? (
            <Banner
              status="error"
              title={inviteLoadError.title}
              description={inviteLoadError.description}
              container="card"
              endContent={
                <Button variant="ghost" label="Retry" clickAction={() => runLoadInvite()} />
              }
            />
          ) : null}

          {inviteLoadState === 'ready' && inviteData && inviteStatusError ? (
            <Banner
              status="error"
              title={inviteStatusError.title}
              description={inviteStatusError.description}
              container="card"
            />
          ) : null}

          {inviteLoadState === 'ready' && inviteData && !inviteStatusError ? (
            <form onSubmit={handleSetPassword} noValidate>
              <VStack gap={4}>
                <VStack gap={1}>
                  <Heading level={2}>{inviteData.name}</Heading>
                  <Text type="supporting">
                    You&apos;ve been invited to VOLT as{' '}
                    {withArticle(INVITE_ROLE_LABELS[inviteData.role])}.
                  </Text>
                </VStack>

                {formError ? (
                  <Banner
                    status="error"
                    title={formError.title}
                    description={formError.description}
                    container="card"
                  />
                ) : null}

                <TextInput
                  type="password"
                  label="Password"
                  value={password}
                  onChange={(value) => setPassword(value)}
                  isRequired
                  hasAutoFocus
                  htmlName="password"
                  status={
                    fieldErrors.password
                      ? { type: 'error', message: fieldErrors.password }
                      : undefined
                  }
                />

                <TextInput
                  type="password"
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(value) => setConfirmPassword(value)}
                  isRequired
                  htmlName="confirmPassword"
                  status={
                    fieldErrors.confirmPassword
                      ? { type: 'error', message: fieldErrors.confirmPassword }
                      : undefined
                  }
                />

                <Button
                  type="submit"
                  variant="primary"
                  label="Set password"
                  isLoading={isSubmitting}
                />

                <Divider label="or" />

                <Button
                  variant="secondary"
                  label="Continue with Google"
                  clickAction={handleGoogleSignIn}
                />
              </VStack>
            </form>
          ) : null}
        </Card>
      </VStack>
    </Center>
  );
}

export default AcceptInvitePage;
