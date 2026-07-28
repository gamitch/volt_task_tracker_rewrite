/**
 * T016: `/login` screen, built from the Astryx "Basic Login" template
 * per DES-08/AUTH-02/PRD 7.1 ("template as-is: `/login` -> `Basic Login`
 * (fields per AUTH-02, VOLT wordmark above the card)").
 *
 * AUTH-02 fields: email + password, "Continue with Google"
 * (`Button variant="secondary"`), "Forgot password" link (Supabase reset
 * email), VOLT wordmark above the card. No self-serve "Create account" /
 * "Sign up" affordance anywhere on this page -- public signup is disabled
 * at the Supabase level (AUTH-01), so a UI path implying otherwise would be
 * a real correctness bug (constitution item 2/AUTH-02).
 *
 * -----------------------------------------------------------------------
 * Two known, explicitly-flagged structural gaps (see T016 worker packet
 * "Open Scope Question" sections + this task's worker output for full
 * detail -- summarized here for anyone reading this file later):
 *
 * 1. `router.tsx`'s `/login` route still renders its own inline
 *    `LoginPage()` placeholder (defined in that file itself), not this
 *    component. `router.tsx` is a forbidden file for this task, so this
 *    component is not reachable at `/login` in the running app yet --
 *    wiring it in is a follow-up task's job.
 * 2. `guards.tsx`'s `AuthProvider` is still T005's self-contained
 *    in-memory placeholder: `login(user: AuthUser)` is synchronous and
 *    performs no real credential verification, and no Supabase JS client
 *    is wired into the frontend anywhere yet. This component's submit
 *    handler therefore calls the existing placeholder `login()` /
 *    `loginWithGoogle()` / `consumeIntendedUrl()` contract from
 *    `guards.tsx` exactly as the current inline placeholder does, rather
 *    than inventing a one-off Supabase client scoped to this page.
 * -----------------------------------------------------------------------
 *
 * CLI cross-check (constitution item 2: the CLI is a cross-check, never a
 * source): `npm run astryx -- template login --skeleton` (the closest
 * matching template ID; `astryx-api.md` has no dedicated "Basic Login"
 * props table, and `npm run astryx -- template --list` shows "Basic Login"
 * as a *display name* that does not resolve as a template ID) outputs:
 * `Center > VStack > [Icon+Text logo row] > Card > VStack > [Heading+Text
 * header, Banner, TextInput, TextInput, Button]`. This confirms the
 * Center/VStack/Card structural skeleton used below. It has no "Continue
 * with Google" button, no "Forgot password" link, and no divider --
 * AUTH-02 (PRD) is definitive over the generic CLI skeleton for the extra
 * fields it explicitly requires, so those are added; no *additional*
 * layout (e.g. a visual divider) beyond AUTH-02's literal field list was
 * added, per the CLI skeleton's own omission of one.
 *
 * DES-12 four-state mapping for this (non-list) screen -- see the worker
 * packet's Acceptance Criterion 3 for the required reasoning, restated
 * here for future maintainers:
 *   - Empty: the page's initial render -- both fields blank, no banner,
 *     the "reset password" panel closed. This is simply the resting state
 *     before any input; no separate empty-state affordance (e.g.
 *     `EmptyState`) applies to a login form.
 *   - Loading: `isSubmitting` (email/password submit in flight, drives
 *     the primary Button's `isLoading`) and the Google button's own
 *     `clickAction`-driven pending state.
 *   - Error: `formError` (rendered via `Banner status="error"`, DES-16
 *     copy: say what happened + what to do, no apologies) plus
 *     field-level `TextInput status` for the specific missing field(s).
 *   - Populated/success: the normal resting state once the user has
 *     typed values in -- a login form has no separate "success" render,
 *     since a successful sign-in navigates away via `consumeIntendedUrl`.
 *
 * T073b2 update: `SIMULATED_AUTH_LATENCY_MS` (the placeholder-latency
 * constant this module doc used to describe here) has been removed --
 * `guards.tsx`'s `login()`/`loginWithGoogle()` now call the real Supabase
 * auth module (`../../lib/supabase/auth.ts`, T071) and have their own real
 * network latency, so an artificial delay is no longer needed or honest.
 * The "Forgot password" panel's `handleSendReset` below still has no real
 * `supabase.auth.resetPasswordForEmail` call wired up (a separate,
 * still-open gap, out of this task's scope -- see that handler's own
 * comment) and now resolves immediately rather than after a borrowed fake
 * delay, since the shared constant it used to reuse is gone.
 *
 * T073b2 also replaces the inline `await loginWithGoogle(); navigate(...)`
 * pattern this module doc used to describe for both sign-in paths. With a
 * REAL Google OAuth round trip, `signInWithOAuth` redirects the browser
 * away -- the code after that `await` never runs on the way out, and the
 * "come back with a resolved session" leg happens on a LATER mount of this
 * same page (this component re-renders fresh after the OAuth redirect
 * back). This page now configures `loginWithGoogle`'s `redirectTo` to point
 * back at this same page (`/login`, via `useLocation()`, so it works
 * whether reached at `/login` or `/login` with any query string) and adds a
 * `useEffect` that watches `useAuth()`'s resolved `user`/`isLoading`/
 * `noProfile`, calling `navigate(consumeIntendedUrl())` once a real,
 * fully-resolved user is present. That single effect handles BOTH the
 * email/password path (after `login()`'s own promise resolves, `user`
 * updates, the effect fires) and the OAuth return-leg path (after the
 * browser comes back and `AuthProvider`'s `subscribeToAuthStateChange`
 * listener observes the resulting `SIGNED_IN` event) with one code path --
 * see the effect's own comment below for why the OLD inline
 * `navigate(consumeIntendedUrl())` call after `login()`/`loginWithGoogle()`
 * was deliberately removed rather than kept alongside the effect (it would
 * double-navigate).
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Center,
  Heading,
  Link,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import { consumeIntendedUrl, useAuth } from '../../app/guards';

interface FieldErrors {
  email?: string;
  password?: string;
}

interface FormBannerError {
  title: string;
  description: string;
}

type ResetStatus = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Surfaces a real error's own `.message` (e.g. a real Supabase `AuthError`,
 * or `SupabaseNotConfiguredError` -- `../../lib/supabase/client.ts`) when
 * available, per DES-16 ("say what happened"), falling back to a generic
 * description for non-`Error` rejections. `guards.tsx`'s `login()`/
 * `loginWithGoogle()` deliberately let the real, unwrapped error propagate
 * (see that file's own doc comment), so this page is the right place to
 * decide how much of it to show.
 */
function describeAuthError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function LoginPage(): ReactNode {
  const { login, loginWithGoogle, user, isLoading, noProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Sign-in form state.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<FormBannerError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // "Forgot password" inline sub-state (see design-decision note below).
  const [isResetPanelOpen, setIsResetPanelOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<ResetStatus>('idle');

  // T073b2 OAuth-redirect-leg design (module doc above) -- the single
  // source of post-login navigation for BOTH the email/password path and
  // the Google OAuth return leg. Fires once a genuinely resolved user is
  // present (`!isLoading` rules out both the initial session check and any
  // in-flight resolution; `!noProfile` rules out AUTH-04's no-access case,
  // which never has anywhere useful to navigate to and is instead handled
  // in place by `RequireAuth`/`RequireRole` elsewhere, not by this page).
  // Deliberately the ONLY place this page calls `navigate(consumeIntendedUrl())`
  // -- `handleSubmit`/`handleGoogleSignIn` below do NOT also call it inline
  // after `login()`/`loginWithGoogle()` resolve, specifically to avoid a
  // double-navigate: `consumeIntendedUrl()` both reads AND clears the
  // stored intended URL, so a second call after this effect's own call
  // would silently fall back to `/` instead of the real intended
  // destination -- a real, easy-to-miss bug this design avoids by
  // construction (only one call site exists at all).
  useEffect(() => {
    if (!isLoading && !noProfile && user) {
      navigate(consumeIntendedUrl('/'), { replace: true });
    }
  }, [user, isLoading, noProfile, navigate]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const nextFieldErrors: FieldErrors = {};
    if (!email.trim()) {
      nextFieldErrors.email = 'Enter your email address';
    }
    if (!password) {
      nextFieldErrors.password = 'Enter your password';
    }
    setFieldErrors(nextFieldErrors);

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setFormError({
        title: 'Sign-in failed',
        description: 'Enter your email and password to continue.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      // No inline `navigate()` here -- see the `useEffect` above.
    } catch (error) {
      setFormError({
        title: 'Sign-in failed',
        description: describeAuthError(
          error,
          'We could not sign you in. Check your email and password and try again.',
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError(null);
    try {
      // Redirects back to this exact page (path + query string) once the
      // OAuth round trip completes -- see module doc above. `AuthProvider`'s
      // `subscribeToAuthStateChange` listener picks up the resulting
      // `SIGNED_IN` event on that later mount; the `useEffect` above then
      // navigates once `user` resolves.
      const redirectTo = `${window.location.origin}${location.pathname}${location.search}`;
      await loginWithGoogle(redirectTo);
      // No inline `navigate()` here either -- a real OAuth round trip
      // redirects the browser away before this line would even run; see
      // the `useEffect` above for the return-leg handling.
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

  const openResetPanel = () => {
    setResetEmail(email);
    setResetStatus('idle');
    setIsResetPanelOpen(true);
  };

  const closeResetPanel = () => {
    setIsResetPanelOpen(false);
    setResetStatus('idle');
  };

  const handleSendReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resetEmail.trim()) {
      setResetStatus('error');
      return;
    }

    setResetStatus('sending');
    try {
      // Placeholder round trip -- still no real
      // `supabase.auth.resetPasswordForEmail(resetEmail)` call wired up
      // (a separate, still-open gap; out of this task's scope, which is
      // limited to `login`/`loginWithGoogle`/`logout`). Previously borrowed
      // `SIMULATED_AUTH_LATENCY_MS` for an artificial delay here too; that
      // shared constant is gone (T073b2, module doc above), so this now
      // resolves immediately rather than after a fake delay -- a cosmetic
      // side effect of removing the constant, not a new feature.
      setResetStatus('sent');
    } catch {
      setResetStatus('error');
    }
  };

  return (
    <Center axis="both" height="100vh" width="100%">
      <VStack gap={6} hAlign="center">
        <Heading level={1}>VOLT</Heading>

        <Card width={400} maxWidth="100%" padding={6} variant="default">
          {isResetPanelOpen ? (
            <form onSubmit={handleSendReset} noValidate>
              <VStack gap={4}>
                <Heading level={2}>Reset your password</Heading>
                <Text type="supporting">
                  Enter your email address and we&apos;ll send you a link to reset your password.
                </Text>

                {resetStatus === 'sent' ? (
                  <Banner
                    status="success"
                    title="Reset email sent"
                    description="Check your inbox for a link to reset your password."
                    container="card"
                  />
                ) : null}

                {resetStatus === 'error' ? (
                  <Banner
                    status="error"
                    title="Couldn't send reset email"
                    description="Enter a valid email address and try again."
                    container="card"
                  />
                ) : null}

                <TextInput
                  type="email"
                  label="Email"
                  value={resetEmail}
                  onChange={(value) => setResetEmail(value)}
                  isRequired
                  hasAutoFocus
                  htmlName="resetEmail"
                  status={
                    resetStatus === 'error'
                      ? { type: 'error', message: 'Enter your email address' }
                      : undefined
                  }
                />

                <Button
                  type="submit"
                  variant="primary"
                  label="Send reset link"
                  isLoading={resetStatus === 'sending'}
                />

                <Link isStandalone onClick={closeResetPanel}>
                  Back to sign in
                </Link>
              </VStack>
            </form>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <VStack gap={4}>
                {formError ? (
                  <Banner
                    status="error"
                    title={formError.title}
                    description={formError.description}
                    container="card"
                  />
                ) : null}

                <TextInput
                  type="email"
                  label="Email"
                  value={email}
                  onChange={(value) => setEmail(value)}
                  isRequired
                  hasAutoFocus
                  htmlName="email"
                  status={
                    fieldErrors.email ? { type: 'error', message: fieldErrors.email } : undefined
                  }
                />

                <TextInput
                  type="password"
                  label="Password"
                  value={password}
                  onChange={(value) => setPassword(value)}
                  isRequired
                  htmlName="password"
                  status={
                    fieldErrors.password
                      ? { type: 'error', message: fieldErrors.password }
                      : undefined
                  }
                />

                <Link isStandalone onClick={openResetPanel}>
                  Forgot password
                </Link>

                <Button type="submit" variant="primary" label="Sign in" isLoading={isSubmitting} />

                <Button
                  variant="secondary"
                  label="Continue with Google"
                  clickAction={handleGoogleSignIn}
                />
              </VStack>
            </form>
          )}
        </Card>
      </VStack>
    </Center>
  );
}

export default LoginPage;
