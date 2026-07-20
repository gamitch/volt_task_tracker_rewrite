/**
 * T035: `/checkin` result screen (MTG-06..MTG-12, DES-01/DES-02, DES-16).
 *
 * Renders the three end states a student lands on after scanning the
 * check-in QR code (MTG-06's QR-encoded URL, `?s=<sessionId>&t=<token>`) or,
 * later, after T054's manual short-code entry calls the same
 * `callCheckin()` path (`?s=<sessionId>&code=<shortCode>`):
 *
 *   1. success       -- `already_checked_in: false` -- the DES-01
 *                        "Check-in Bolt": bolt draws in (~400ms), the
 *                        surface flashes to the accent color and settles,
 *                        "You're in" + a `Timestamp`.
 *   2. already-in     -- `already_checked_in: true` -- MTG-09: "Duplicate
 *                        check-in is idempotent -- show 'Already checked in
 *                        at 6:04 PM', no error."
 *   3. error          -- any non-200 response -- MTG-08: "Errors per
 *                        DES-16 (expired code, session not live, not on
 *                        this team's roster)." `error.message` is rendered
 *                        VERBATIM (DES-16 copy was already authored by
 *                        T032, upstream of this component -- see
 *                        `callCheckin` below) -- never rewritten or
 *                        paraphrased.
 *
 * Ground truth for the exact request/response contract this screen
 * consumes was read directly from `supabase/functions/checkin/index.ts`
 * and `supabase/functions/checkin/attendance_upsert.ts` (read-only
 * reference, not modified by this task -- both files are in this task's
 * Forbidden Files):
 *
 *   POST /functions/v1/checkin
 *   Authorization: Bearer <caller's own Supabase session JWT>
 *   { "session_id": "<uuid>", "token": "<32-char hex>" }
 *   -- or --
 *   { "session_id": "<uuid>", "code": "<6-char short code>" }
 *
 *   200 (either already_checked_in value):
 *   { already_checked_in: boolean,
 *     attendance: { status: 'present'|'late'|'excused'|'absent',
 *                   check_in_at: string | null,
 *                   method: 'qr'|'coach'|'import' } }
 *
 *   non-200:
 *   { error: { code: string, message: string } }
 *
 * -----------------------------------------------------------------------
 * ONE remaining known, explicitly-flagged gap -- full detail in this task's
 * worker output, summarized here for anyone reading this file later. A
 * SECOND gap that used to be documented here (no real Supabase auth
 * session/JWT existed anywhere in `src/`) was closed by T100 (ED-1 Packet
 * P9) -- see immediately below.
 *
 * 1. T100 (ED-1 Packet P9): REAL `getAccessToken`, ASYNC SIGNATURE
 *    (pre-approved widening). A real, shared Supabase client now exists
 *    (`../../lib/supabase/client.ts`, T071) and `guards.tsx`'s own
 *    `AuthProvider` is wired to a real, async, two-step Supabase auth flow
 *    (T073b2) -- so the ORIGINAL version of this gap ("no real session/JWT
 *    exists anywhere in `src/` yet") no longer holds. `getAccessToken`'s
 *    type is widened from the old synchronous `() => string | null` to
 *    `GetAccessTokenFn = () => Promise<string | null>` (real session tokens
 *    are retrieved asynchronously, `client.auth.getSession()`) -- every call
 *    site below now `await`s it. The real default,
 *    `../../lib/supabase/loaders/checkin.ts`'s `getAccessToken` (built by
 *    `makeGetAccessToken`), calls that exact `client.auth.getSession()` call
 *    and resolves `access_token` when a real session exists.
 *
 *    A narrower version of the same honest gap remains, disclosed rather
 *    than hidden: that real default still resolves `null` (never rejects)
 *    when Supabase is unconfigured OR `getSession()` itself fails for any
 *    reason -- see `loaders/checkin.ts`'s own module doc for the full
 *    reasoning already established there. `callCheckin` below is unchanged
 *    by this task and still handles a `null` token exactly as it always
 *    has: the request is sent with NO `Authorization` header, and the real
 *    deployed function's own real 401 `UNAUTHENTICATED` ("Sign in and try
 *    again.") response is handled by this component's ordinary
 *    error-rendering path, not a special no-op case.
 *
 * 2. THE DES-01 "RUNNING TALLY" ('14th in tonight') HAS NO DATA SOURCE IN
 *    THE ACTUAL, ALREADY-PASSED BACKEND CONTRACT. DES-01's wireframe shows
 *    a running tally under the success state, but `CheckinResponsePayload`
 *    (reproduced above, confirmed by reading T032's actual code, not
 *    guessed) has no tally/count field, and `attendance` RLS
 *    (`staff_all` + `own_or_linked_read`, confirmed by reading T032's own
 *    file-header comments) gives a student no permitted way to query a
 *    same-session count themselves. This is NOT fixable within this task's
 *    Allowed Files (`supabase/functions/checkin/**` is forbidden, and no
 *    other data source exists). Handling chosen: OMIT the running-tally
 *    line from the real UI entirely (no fake number, ever) -- an
 *    `import.meta.env.DEV`-only marker documents the gap in a dev context
 *    without ever shipping in a production build (see `RunningTallyGapNote`
 *    below). FLAGGED PROMINENTLY as a dispute candidate: most likely
 *    resolution is that T032's `checkin` function needs a small extension
 *    to compute and return a same-session count (reopening a Passed task,
 *    or a new small corrective task) -- recommended, not decided here.
 * -----------------------------------------------------------------------
 *
 * DES-02 scope discipline: the bolt draw-in + surface flash below is the
 * ONLY orchestrated animation on this screen (and in the whole app, per
 * DES-01's own description). The already-in and error states use zero
 * custom motion/gradients/glows -- plain Astryx defaults only.
 *
 * Astryx component props used below are cross-checked prop-by-prop against
 * `docs/swarm/astryx-api.md` (constitution item 2) -- see this task's
 * worker output for the full citation list. One deliberate exception: the
 * installed `@astryxdesign/core@0.1.6` `Card` component's *runtime* happens
 * to accept `className`/`style`/`xstyle` (verified by reading
 * `node_modules/@astryxdesign/core/dist/Card/Card.js` directly), but
 * `astryx-api.md`'s own Card Props table does NOT list any of the three --
 * per constitution item 2 ("a prop absent from that file is presumed
 * hallucinated"), this file treats them as unavailable and never passes
 * them to `<Card>`. The one-shot success-state "surface flashes to the
 * accent color" effect is instead achieved by wrapping `<Card>` in a plain
 * `<div>` and targeting Card's own DOCUMENTED stable `astryx-card` class
 * name (astryx-api.md Card Theming table: "Component class: `astryx-card`")
 * from this file's own scoped `<style>` block -- this only relies on a
 * documented, stable class name, never an undocumented prop.
 *
 * The bolt glyph itself is deliberately NOT rendered through Astryx's
 * `<Icon>`: `Icon`'s component-mode spreads `...props` (including any
 * `className` passed to it) LAST onto the underlying SVG component, AFTER
 * its own computed size/color StyleX classes (verified by reading
 * `node_modules/@astryxdesign/core/dist/Icon/Icon.js`) -- passing a custom
 * `className` through `<Icon>` for the draw-in animation would silently
 * clobber Icon's own size/color styling rather than compose with it. The
 * bolt is instead a small bespoke inline SVG, sized/colored via this
 * file's own CSS referencing the same theme tokens Icon itself resolves
 * `color="accent"` to (`--color-accent`), so it visually matches an
 * `Icon size="lg" color="accent"` without fighting a component whose
 * documented API has no animation hook.
 */
import { useCallback, useEffect, useState, type ReactNode, type SVGProps } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Center,
  Heading,
  Icon,
  Spinner,
  Text,
  Timestamp,
  VStack,
} from '@astryxdesign/core';
import { getAccessToken as loadAccessTokenFromSupabase } from '../../lib/supabase/loaders/checkin';

// ---------------------------------------------------------------------------
// Contract types -- mirror `supabase/functions/checkin/attendance_upsert.ts`
// `CheckinResponsePayload` and `supabase/functions/checkin/index.ts`'s
// `errorResponse()` shape exactly (see module doc "Ground truth" above).
// ---------------------------------------------------------------------------

/** One `attendance` row status, per the DB check constraint T032 reads/writes against. */
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

/** How the row was recorded, per the DB check constraint T032 reads/writes against. */
export type AttendanceMethod = 'qr' | 'coach' | 'import';

export interface AttendanceInfo {
  status: AttendanceStatus;
  /** ISO timestamp, or `null` -- see module doc gap #1's sibling edge case
   * (T032's own worker output, deferred to this task): a coach-recorded row
   * (`method: 'coach'`) may legitimately have no `check_in_at`. */
  check_in_at: string | null;
  method: AttendanceMethod;
}

/** The exact 200-response payload shape from `attendance_upsert.ts`'s `resolveResponse`. */
export interface CheckinResponsePayload {
  already_checked_in: boolean;
  attendance: AttendanceInfo;
}

/** The exact error shape from `index.ts`'s `errorResponse()`. */
export interface CheckinErrorInfo {
  code: string;
  message: string;
}

/** What this page constructs the request body from -- either a QR token or a manual short code. */
export interface CheckinCredential {
  sessionId: string;
  token?: string;
  code?: string;
}

export type CheckinCallResult =
  { ok: true; data: CheckinResponsePayload } | { ok: false; error: CheckinErrorInfo };

/** T100 (module doc gap #1, pre-approved widening) -- was
 * `() => string | null` (synchronous). Real session tokens are retrieved
 * asynchronously (`client.auth.getSession()`), so this seam's return type is
 * now a `Promise`. Exported so `../../lib/supabase/loaders/checkin.ts`'s real
 * default implementation can type-check against this exact shape. */
export type GetAccessTokenFn = () => Promise<string | null>;

export interface CallCheckinConfig {
  /** Defaults to `VITE_SUPABASE_URL` (see `.env.example`). */
  supabaseUrl?: string;
  /** Defaults to `VITE_SUPABASE_ANON_KEY` (see `.env.example`). */
  anonKey?: string;
}

/**
 * Reads a Vite-injected `import.meta.env` var without requiring a new
 * `vite-env.d.ts` ambient-types file (out of this task's Allowed Files --
 * only `CheckinResult.tsx` is allowed). `import.meta.env` is a real object
 * Vite injects at both dev and build time (not merely a static string
 * replace), so bracket access on a locally-typed reference works correctly
 * in both environments.
 */
function readViteEnvVar(key: string): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.[key];
}

/** Same casting rationale as `readViteEnvVar` above -- `import.meta.env.DEV`
 * is a real, statically-known-at-build-time Vite boolean (tree-shaken to a
 * literal `false` in production builds), read here without a new ambient
 * `vite-env.d.ts` file (out of this task's Allowed Files). */
function isDevBuild(): boolean {
  return Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);
}

/**
 * Real, typed `fetch()` call shaped exactly like the Ground Truth contract
 * above. See module doc gap #1: this function is fully real and testable
 * (mock `fetch` to exercise every branch below), but has never been
 * exercised against a live deployed function with a live JWT, because none
 * exists anywhere in this repo yet.
 */
export async function callCheckin(
  credential: CheckinCredential,
  accessToken: string | null,
  config: CallCheckinConfig = {},
): Promise<CheckinCallResult> {
  const supabaseUrl = (config.supabaseUrl ?? readViteEnvVar('VITE_SUPABASE_URL') ?? '').replace(
    /\/+$/,
    '',
  );
  const anonKey = config.anonKey ?? readViteEnvVar('VITE_SUPABASE_ANON_KEY') ?? '';

  if (!supabaseUrl) {
    // Client-side configuration problem, not a caller problem -- distinct
    // from any server-authored error code (see module doc "Ground truth").
    return {
      ok: false,
      error: {
        code: 'CHECKIN_CLIENT_NOT_CONFIGURED',
        message:
          'The check-in service is not configured for this environment. Contact an administrator.',
      },
    };
  }

  const body: Record<string, string> = { session_id: credential.sessionId };
  if (credential.token) {
    body.token = credential.token;
  } else if (credential.code) {
    body.code = credential.code;
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/functions/v1/checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { apikey: anonKey } : {}),
        // See module doc gap #1 -- `accessToken` is `null` until a real
        // Supabase session exists anywhere in this repo. Omitting the
        // header entirely (rather than sending "Bearer null") lets the
        // real deployed function's own real 401 UNAUTHENTICATED path
        // handle this honestly.
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    return {
      ok: false,
      error: {
        code: 'CHECKIN_NETWORK_ERROR',
        message: 'Could not reach the check-in service. Check your connection and try again.',
      },
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      error: {
        code: 'CHECKIN_INVALID_RESPONSE',
        message: 'The check-in service returned an unexpected response. Try again.',
      },
    };
  }

  if (!response.ok) {
    const maybeError = (payload as { error?: Partial<CheckinErrorInfo> } | null)?.error;
    if (
      maybeError &&
      typeof maybeError.code === 'string' &&
      typeof maybeError.message === 'string'
    ) {
      // Server-authored, DES-16-compliant error -- rendered verbatim by
      // <CheckinResult>, never rewritten here.
      return { ok: false, error: { code: maybeError.code, message: maybeError.message } };
    }
    // Generic fallback for a non-200 response that doesn't match the known
    // `{ error: { code, message } }` shape -- "do not assume you'll always
    // get a recognized code" (T035 worker packet Ground Truth).
    return {
      ok: false,
      error: {
        code: 'CHECKIN_UNKNOWN_ERROR',
        message: 'Something went wrong checking you in. Try again in a moment.',
      },
    };
  }

  return { ok: true, data: payload as CheckinResponsePayload };
}

// ---------------------------------------------------------------------------
// URL query-param parsing -- MTG-06's QR-encoded URL shape (`?s=&t=`), plus
// a `code` fallback for T054's future manual-entry sub-path.
// ---------------------------------------------------------------------------

const MISSING_CREDENTIAL_ERROR: CheckinErrorInfo = {
  code: 'CHECKIN_MISSING_CREDENTIAL',
  message:
    'This check-in link is missing information. Scan the QR code again or ask your coach for the current short code.',
};

/** Client-side-only parsing -- never a server-authored error (see `MISSING_CREDENTIAL_ERROR`). */
export function parseCheckinCredential(searchParams: URLSearchParams): CheckinCredential | null {
  const sessionId = searchParams.get('s');
  const token = searchParams.get('t') ?? undefined;
  const code = searchParams.get('code') ?? undefined;
  if (!sessionId || (!token && !code)) {
    return null;
  }
  return { sessionId, token, code };
}

// ---------------------------------------------------------------------------
// prefers-reduced-motion -- real `window.matchMedia` check (T035 worker
// packet Known Context/Traps #3: "test this via a real media-query check
// ... not just a visual judgment call").
// ---------------------------------------------------------------------------

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Real `matchMedia` subscription, not a one-time read -- reacts to a live OS-setting toggle. */
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState<boolean>(getPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
    setPrefersReducedMotion(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }
    // Safari < 14 fallback API.
    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, []);

  return prefersReducedMotion;
}

// ---------------------------------------------------------------------------
// The Check-in Bolt (DES-01) -- the app's ONE sanctioned orchestrated
// animation. See module doc above for why this bespoke glyph bypasses
// Astryx's `<Icon>`.
// ---------------------------------------------------------------------------

/** Lightning-bolt glyph path (standard "zap" mark, 24x24 viewBox). */
function BoltGlyph(props: SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      width={28}
      height={28}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
    </svg>
  );
}

/**
 * `<style>` block scoping the bolt draw-in + surface flash keyframes. Not
 * wrapped in any `@layer` -- unlayered rules always win over the
 * `reset`/`astryx-base`/`app` layers declared in `theme.css` (NFR-08),
 * regardless of specificity or source order, so this reliably overrides
 * Card's own default background during the flash without a specificity
 * fight. `--duration-medium-max` (400ms) is the project's own existing
 * design token (`src/theme/volt.ts` -> `theme.css`) that happens to be the
 * exact DES-01 duration ("~400ms") -- reused here rather than a new
 * hardcoded literal, with a literal `400ms` fallback for resilience if the
 * token is ever renamed.
 */
const BOLT_ANIMATION_STYLE = `
@keyframes checkin-bolt-draw-in {
  from { clip-path: inset(0 0 100% 0); opacity: 0; }
  to { clip-path: inset(0 0 0% 0); opacity: 1; }
}
@keyframes checkin-bolt-surface-flash {
  0% { background-color: var(--color-accent-muted, transparent); }
  60% { background-color: var(--color-accent-muted, transparent); }
  100% { background-color: var(--color-background-card, transparent); }
}
.checkin-bolt-glyph--animate {
  animation: checkin-bolt-draw-in var(--duration-medium-max, 400ms) ease-out both;
}
.checkin-bolt-surface--animate .astryx-card {
  animation: checkin-bolt-surface-flash var(--duration-medium-max, 400ms) ease-out both;
}
`;

// ---------------------------------------------------------------------------
// Running-tally gap (module doc gap #2) -- dev-only, tree-shaken out of
// production builds by `import.meta.env.DEV` (a Vite-standard, statically
// known boolean at build time). Never renders a fabricated number.
// ---------------------------------------------------------------------------

function RunningTallyGapNote(): ReactNode {
  if (!isDevBuild()) {
    return null;
  }
  return (
    <Text type="supporting" color="secondary">
      [DEV ONLY] DES-01&apos;s running tally (&quot;14th in tonight&quot;) is intentionally omitted
      here: the checkin function&apos;s response has no tally field, and attendance RLS blocks a
      student-side count query. See CheckinResult.tsx module doc / T035 worker output -- flagged as
      a dispute candidate.
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Attendance status note -- PRD does not require differentiated copy for
// 'late' (or the coach-only 'excused'/'absent' statuses this student-facing
// screen could still theoretically see on an idempotent replay of a
// coach-recorded row); this file's own call, documented rather than
// silently added or silently omitted.
// ---------------------------------------------------------------------------

function AttendanceStatusNote({ status }: { status: AttendanceStatus }): ReactNode {
  if (status === 'present') {
    return null;
  }
  const copy: Record<Exclude<AttendanceStatus, 'present'>, string> = {
    late: 'Recorded as late.',
    excused: 'Recorded as excused.',
    absent: 'Recorded as absent.',
  };
  return (
    <Text type="supporting" color="secondary">
      {copy[status]}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type ResultState =
  | { status: 'loading' }
  | { status: 'success'; attendance: AttendanceInfo }
  | { status: 'already-in'; attendance: AttendanceInfo }
  | { status: 'error'; error: CheckinErrorInfo };

export interface CheckinResultProps {
  /** Seam for tests (and, later, swapping in a real implementation) -- defaults to the real `callCheckin`. */
  checkin?: typeof callCheckin;
  /** Seam for tests / real-auth wiring -- see module doc gap #1 (T100,
   * pre-approved async widening). Defaults to a real session lookup
   * (`../../lib/supabase/loaders/checkin.ts`'s `getAccessToken`). */
  getAccessToken?: GetAccessTokenFn;
  config?: CallCheckinConfig;
}

export function CheckinResult({
  checkin = callCheckin,
  getAccessToken = loadAccessTokenFromSupabase,
  config,
}: CheckinResultProps = {}): ReactNode {
  const [searchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const navigate = useNavigate();
  const [state, setState] = useState<ResultState>({ status: 'loading' });
  const prefersReducedMotion = usePrefersReducedMotion();

  const runCheckin = useCallback(() => {
    const credential = parseCheckinCredential(new URLSearchParams(searchParamsKey));
    if (!credential) {
      setState({ status: 'error', error: MISSING_CREDENTIAL_ERROR });
      return;
    }
    setState({ status: 'loading' });
    // T100 (module doc gap #1): `getAccessToken` is now async -- `await`ed
    // here, the one call site in this file. Any rejection (an
    // `getAccessToken` override that itself throws, e.g. a test double)
    // falls through to the same generic catch below as a `checkin()`
    // rejection always has -- the real default (`loaders/checkin.ts`'s
    // `getAccessToken`) never rejects (see that module's own doc).
    void (async () => {
      try {
        const accessToken = await getAccessToken();
        const result = await checkin(credential, accessToken, config);
        if (!result.ok) {
          setState({ status: 'error', error: result.error });
          return;
        }
        setState(
          result.data.already_checked_in
            ? { status: 'already-in', attendance: result.data.attendance }
            : { status: 'success', attendance: result.data.attendance },
        );
      } catch {
        setState({
          status: 'error',
          error: {
            code: 'CHECKIN_UNEXPECTED_ERROR',
            message: 'Something went wrong checking you in. Try again.',
          },
        });
      }
    })();
  }, [searchParamsKey, checkin, getAccessToken, config]);

  useEffect(() => {
    runCheckin();
  }, [runCheckin]);

  const handleDone = () => navigate('/', { replace: true });

  const shouldAnimateBolt = state.status === 'success' && !prefersReducedMotion;

  return (
    <Center axis="both" height="100vh" width="100%">
      <VStack gap={6} hAlign="center">
        <Heading level={1}>VOLT</Heading>

        {/* astryx-api.md Card Props (lines 2982-2988): width, maxWidth, padding only -- see module doc's `className`/`xstyle` note above for why this wraps Card in a plain div instead of passing either to Card directly. */}
        <div className={shouldAnimateBolt ? 'checkin-bolt-surface--animate' : undefined}>
          <style>{BOLT_ANIMATION_STYLE}</style>
          <Card width={420} maxWidth="100%" padding={6} variant="default">
            {state.status === 'loading' ? (
              <VStack gap={4} hAlign="center">
                {/* astryx-api.md Spinner Props: label (line 5836). T081
                    (DES-12 loading-state sweep) judgment call: kept as
                    `Spinner`, NOT switched to `Skeleton` -- this component's
                    eventual shape is genuinely unpredictable until the
                    check-in call resolves (a bolt-animated success card, an
                    "Already checked in" icon card, or an error Banner, three
                    structurally different renders -- see module doc above),
                    not a table/list/card-grid with one known dimension to
                    preview, so Astryx's own "for genuinely unknown-dimension
                    content, use Spinner" guidance applies. */}
                <Spinner label="Checking you in…" />
              </VStack>
            ) : null}

            {state.status === 'success' ? (
              <VStack gap={4} hAlign="center">
                <span
                  className={
                    shouldAnimateBolt
                      ? 'checkin-bolt-glyph checkin-bolt-glyph--animate'
                      : 'checkin-bolt-glyph'
                  }
                  style={{ color: 'var(--color-accent)', display: 'inline-flex' }}
                >
                  <BoltGlyph />
                </span>
                {/* astryx-api.md Heading usage matches LoginPage.tsx / AcceptInvitePage.tsx's established `level`-only pattern. */}
                <Heading level={2}>You&apos;re in</Heading>
                <Text type="body">
                  Checked in at{' '}
                  {state.attendance.check_in_at ? (
                    // astryx-api.md Timestamp Props: value, format (lines 5978-5979).
                    <Timestamp value={state.attendance.check_in_at} format="time" />
                  ) : (
                    'just now'
                  )}
                </Text>
                <AttendanceStatusNote status={state.attendance.status} />
                <RunningTallyGapNote />
                {/* astryx-api.md Button Props: label, variant, onClick (lines 1811-1812, 1826). */}
                <Button label="Done" variant="primary" onClick={handleDone} />
              </VStack>
            ) : null}

            {state.status === 'already-in' ? (
              <VStack gap={4} hAlign="center">
                {/* astryx-api.md Icon Props: icon="success" (semantic name, line 608), color="success" (line 609), size="lg" (line 610). */}
                <Icon icon="success" color="success" size="lg" />
                <Heading level={2}>Already checked in</Heading>
                {state.attendance.check_in_at ? (
                  <Text type="body">
                    Already checked in at{' '}
                    <Timestamp value={state.attendance.check_in_at} format="time" />
                  </Text>
                ) : (
                  // Known edge case (T032 worker output, explicitly deferred to this
                  // task -- see module doc): a coach-recorded row may have no
                  // check_in_at. Generic fallback copy, never "Already checked in
                  // at null" and never a crash.
                  <Text type="body">You&apos;re already checked in for this session.</Text>
                )}
                <AttendanceStatusNote status={state.attendance.status} />
                <Button label="Done" variant="primary" onClick={handleDone} />
              </VStack>
            ) : null}

            {state.status === 'error' ? (
              <VStack gap={4} hAlign="center">
                {/* astryx-api.md Banner Props: status, title, description, container (lines 2752-2760). `error.message` (server-authored, DES-16-compliant, from T032) is rendered VERBATIM as `description` -- never rewritten/paraphrased. */}
                <Banner
                  status="error"
                  title="Couldn't check you in"
                  description={state.error.message}
                  container="card"
                />
                <Button label="Try again" variant="primary" onClick={() => runCheckin()} />
              </VStack>
            ) : null}
          </Card>
        </div>
      </VStack>
    </Center>
  );
}

export default CheckinResult;
