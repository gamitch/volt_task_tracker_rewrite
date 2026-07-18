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
 * `SIMULATED_AUTH_LATENCY_MS` below is a deliberate, disclosed
 * implementation choice, not a PRD requirement: `guards.tsx`'s current
 * placeholder `login()`/`loginWithGoogle()` resolve essentially
 * instantly, which would make the DES-12 Loading state (wired correctly)
 * visually imperceptible. This constant stands in for the network
 * latency a real Supabase call will have once a later task wires one up,
 * so the Loading state is actually observable/testable today. It should
 * be removed once `guards.tsx` (or its replacement) performs a real async
 * network call with its own real latency.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { consumeIntendedUrl, useAuth, type Role } from '../../app/guards';

/** See module doc above -- placeholder-latency disclosure, not a PRD value. */
const SIMULATED_AUTH_LATENCY_MS = 350;

/**
 * Role assigned to a successful email/password or Google sign-in.
 *
 * `guards.tsx`'s placeholder `login()` requires a `role` up front and has
 * no real credential-to-role lookup (no Supabase client, no `profiles`
 * table read from the frontend yet -- see module doc gap #2 above). This
 * matches the role already used by `guards.tsx`'s own
 * `PLACEHOLDER_GOOGLE_USER` constant (`role: 'staff'`), so both sign-in
 * paths on this page resolve to the same placeholder role until a real
 * backend can supply the actual one.
 */
const PLACEHOLDER_SIGN_IN_ROLE: Role = 'staff';

interface FieldErrors {
  email?: string;
  password?: string;
}

interface FormBannerError {
  title: string;
  description: string;
}

type ResetStatus = 'idle' | 'sending' | 'sent' | 'error';

export function LoginPage(): ReactNode {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

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

  const completeSignIn = () => {
    login({ id: `placeholder-${PLACEHOLDER_SIGN_IN_ROLE}`, email, role: PLACEHOLDER_SIGN_IN_ROLE });
    navigate(consumeIntendedUrl('/'), { replace: true });
  };

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
      // Placeholder round trip -- see module doc gap #2. Once a real
      // Supabase `signInWithPassword` call replaces this, this block is
      // exactly where the `catch` below would surface a real
      // invalid-credentials error via the same Banner/status wiring.
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_AUTH_LATENCY_MS));
      completeSignIn();
    } catch {
      setFormError({
        title: 'Sign-in failed',
        description: 'We could not sign you in. Check your email and password and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setFormError(null);
    try {
      await loginWithGoogle();
      navigate(consumeIntendedUrl('/'), { replace: true });
    } catch {
      setFormError({
        title: 'Google sign-in failed',
        description: 'We could not complete sign-in with Google. Try again.',
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
      // Placeholder round trip -- no Supabase client is wired into the
      // frontend yet (module doc gap #2). This simulates the
      // "reset email sent" outcome so the panel's state machine is fully
      // built and ready for a real
      // `supabase.auth.resetPasswordForEmail(resetEmail)` call to replace
      // this body.
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_AUTH_LATENCY_MS));
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
