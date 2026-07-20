/**
 * T034: `/kiosk/:sessionId` fullscreen kiosk display (MTG-07) -- shop
 * TV/iPad screen showing a rotating QR code + 6-character short code + a
 * live numeric tally ("12 of 18 checked in"). This is a PUBLIC-FACING
 * shared display (PRD SEC-04/ROS-08): it must never render a student name,
 * email address, or any other PII -- only the page's own generic heading,
 * the QR, the short code, and a numeric tally are ever rendered.
 *
 * -----------------------------------------------------------------------
 * Router reachability (read-only-confirmed, not this task's job to change)
 * -----------------------------------------------------------------------
 * `src/app/router.tsx`'s `/kiosk/:sessionId` route (lines ~127-136) already
 * wraps its element in `RequireAuth` + `RequireRole(['coach', 'admin'])`,
 * matching PRD Section 7's route table exactly -- confirmed by reading that
 * file (read-only; it is a forbidden file for this task). That guard is
 * correct and this component intentionally does NOT re-guard itself (unlike
 * e.g. `RosterShell.tsx`/T021, which had to nest its own `RequireRole`
 * because ITS route had no role guard at all yet -- not the case here).
 *
 * However, that same route's `element` still renders router.tsx's own
 * inline `KioskSessionPage()` placeholder function (`<div>Kiosk
 * (placeholder) - sessionId: {sessionId}</div>`), not an import of this
 * file -- confirmed by reading router.tsx directly. So while the ROLE GUARD
 * is already correct (nothing to fix there), this component is still not
 * actually reachable at `/kiosk/:sessionId` in the running app: swapping
 * the inline placeholder for `import { KioskPage } from
 * '../pages/meetings/Kiosk'` requires editing `router.tsx`, which is a
 * forbidden file for this task. This is the same *reachability-only* gap
 * `RosterShell.tsx`/T021 documented for `/roster` (itself citing T018's
 * checker finding that this applies to every not-yet-built route) -- a
 * distinct, narrower issue than a missing/wrong role guard, which is why it
 * does not contradict the worker packet's "no router-wiring gap to flag
 * here" framing (that framing is specifically about the guard/role matrix,
 * which is indeed already correct).
 *
 * -----------------------------------------------------------------------
 * T103 (ED-1 Packet P8) -- both previously-disclosed gaps below are now
 * CLOSED. Kept in full (not deleted) because the ground-truth HMAC
 * derivation scheme and the historical reasoning both remain load-bearing
 * for understanding `loaders/kiosk.ts` and `supabase/functions/
 * checkin-token/index.ts` (the new Edge Function this task added).
 * -----------------------------------------------------------------------
 * GAP #1 (now closed) -- the live QR token and short code this screen
 * displays are HMAC-SHA256 outputs keyed by a server-only secret that must
 * never appear in frontend code or any client bundle (constitution item 5,
 * BLOCKER-class -- this component deliberately never types that secret's
 * literal env-var name anywhere in this file, including in comments, so a
 * grep for it across `src/` stays clean). The exact derivation scheme,
 * cited verbatim from `supabase/functions/checkin/hmac.ts`'s header
 * comment (read-only reference; that whole directory remains forbidden to
 * edit) is:
 *
 *   1. `bucket = floor(unixSeconds / 60)` -- a 60-second time bucket
 *      anchored to the Unix epoch (not to the session's `starts_at`).
 *   2. Canonical message: `` `${sessionId}:${bucket}` `` (UTF-8).
 *   3. `digest = HMAC-SHA256(key = <the server-only secret>, message)`
 *      -- 32 raw bytes.
 *   4. QR token = first 16 bytes of `digest`, lower-case hex (32 chars).
 *   5. Short code = bytes [16..22) of the SAME `digest` (one HMAC
 *      computation, two views into it -- not two independent secrets),
 *      each byte mapped via `byte % 34` into the alphabet
 *      `ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789` (6 uppercase chars; note O
 *      and I ARE included -- only the digits 0/1 are excluded).
 *   6. QR encodes `https://portal.voltfrc.org/checkin?s=<sessionId>&t=<token>`
 *      (PRD MTG-06) -- `buildCheckinUrl` below, exported specifically so
 *      `loaders/kiosk.ts` can build the same URL from a real minted token
 *      without re-deriving this shape a second time.
 *   7. Client-side display refresh cadence: ~45 seconds -- independent of
 *      the 60s server-side bucket; a display refresh, not a security
 *      boundary (the server accepts the current AND previous bucket
 *      regardless of when the display last refreshed).
 *
 * Computing step 3 requires the secret, which per constitution item 5 can
 * NEVER exist in `src/` -- this page still structurally cannot derive the
 * real token/short code itself, which is exactly why T103 added a new,
 * dedicated Edge Function (`supabase/functions/checkin-token/index.ts`) --
 * a coach/admin's authenticated browser session calls it, and it mints
 * step 3's digest server-side (reusing, read-only, `checkin/hmac.ts`'s own
 * `tokenFor`/`shortCodeFor`/`bucketFor` -- see that new function's own
 * module doc for the full cross-directory-import investigation), returning
 * only the already-derived token/short code, never the secret itself.
 * `loaders/kiosk.ts`'s `loadKioskDisplayToken` (this page's real default
 * `loadDisplayToken`, wired in below) calls that function and maps its
 * response into this page's own `KioskDisplayToken` shape.
 *
 * The `useKioskDisplayToken`/`useKioskTally`/`useKioskSessionTitle` seams
 * below (mirroring the exact `loadData` prop-injection pattern
 * `NoAccessPage.tsx`/T020 already established in this codebase) are
 * unchanged in shape by T103 -- only their SHIPPED DEFAULTS moved from the
 * fixture/`null`-returning stubs below (`fixtureLoadKioskDisplayToken`/
 * `notWiredLoadKioskTally`/`notWiredLoadKioskSessionTitle`, all three still
 * exported, unchanged, for tests and any future harness that wants an
 * explicit stub -- same "the fixture function itself is untouched and
 * still exported for tests" precedent `loaders/invites.ts`'s own module doc
 * already establishes for its analogous fixture/real-default swap) to the
 * real `loaders/kiosk.ts` functions.
 *
 * -----------------------------------------------------------------------
 * GAP #2 (now closed) -- the live tally and session title.
 * -----------------------------------------------------------------------
 * `attendance`'s RLS is `staff_all` (full access) + `own_or_linked_read`
 * (own rows only). Since this route is coach/admin-only, `useKioskTally`
 * can legitimately read a full per-session checked-in/expected count --
 * there was never an RLS gap on this specific screen, only a missing
 * shared Supabase client anywhere in `src/` (now built, T071/T086/etc.).
 * `loaders/kiosk.ts`'s `loadKioskTally`/`loadKioskSessionTitle` (this
 * page's real default `loadTally`/`loadSessionTitle`, wired in below)
 * supply the real counts/title; see that file's own module doc for the
 * exact query shapes (active-roster team-scoping, `present`/`late`
 * "checked-in" definition, etc.).
 *
 * -----------------------------------------------------------------------
 * Astryx prop sourcing (constitution item 2) -- every prop below cross-
 * checked against `docs/swarm/astryx-api.md` directly:
 * -----------------------------------------------------------------------
 *  - `Center`: `astryx-api.md` lines 49-94 (Props table). `axis="both"`
 *    (line 80, the default, set explicitly for clarity), `height="100vh"`,
 *    `width="100%"` (lines 81-82) are used for the fullscreen kiosk frame,
 *    matching this doc's own "loading screens"/full-viewport guidance and
 *    the exact `Center axis="both" height="100vh" width="100%"` idiom
 *    `NoAccessPage.tsx`/T020 already established for this class of screen.
 *  - `VStack`/`HStack`: `astryx-api.md` lines 348-416 (Stack section,
 *    "Components > VStack"/"HStack" subsections). `gap`, `padding`,
 *    `hAlign`, `vAlign`, `wrap`, `maxWidth` are used per that table.
 *    `StackProps extends BaseProps<HTMLElement>` (verified directly against
 *    `node_modules/@astryxdesign/core/dist/Stack/Stack.d.ts`, which is
 *    itself the generation source for this doc) and `BaseProps`
 *    (`node_modules/@astryxdesign/core/dist/BaseProps.d.ts`) extends
 *    `React.HTMLAttributes`, whose own doc comment states it explicitly
 *    "Keeps: event handlers, aria-*, role, ...". `astryx-api.md`'s own
 *    `VisuallyHidden` section (lines 6588-6618) independently demonstrates
 *    this exact pass-through pattern in its own documented example
 *    (`<VisuallyHidden as="div" aria-live="polite">`) -- so passing
 *    `aria-live="polite"` directly on the tally `HStack` below is a real,
 *    doc-precedented prop, not a hallucinated one, even though the
 *    per-component tables (being auto-generated from component-specific
 *    props only) do not re-list every inherited native HTML attribute.
 *  - `Heading`: `astryx-api.md`'s own "Components > Heading" subsection
 *    (lines 882-884) is `undefined` -- a real doc-generation gap (the same
 *    class already disclosed in `RosterShell.tsx`/T021 and
 *    `LoginPage.tsx`/T016), not a prop-table omission worked around here.
 *    Per the mandated CLI cross-check, `npm run astryx -- component
 *    Heading` output (verbatim, relevant rows), re-run independently for
 *    this task rather than assumed from a prior task's output:
 *      | `level` | `1 | 2 | 3 | 4 | 5 | 6` | -- | Heading level... (required) |
 *      | `children` | `ReactNode` | -- | Heading content. (required) |
 *    Only `level={1}` (this page's one and only heading) and `children`
 *    are used below.
 *  - `Text`: `astryx-api.md` lines 829-895 (Props table). `type` (`'body'
 *    | 'supporting' | 'label' | 'code' | 'display-2'`), `size` (`'4xl'`),
 *    `hasTabularNumbers`, `color`, `as` are used per that table -- no
 *    hallucinated `variant` prop (the doc's own "Don't" explicitly warns
 *    against that).
 *  - `Banner`: `astryx-api.md` lines 2694-2772 (Props table). `status`
 *    (`'warning'`, required), `title` (required), `description` are used;
 *    `isDismissable` is deliberately omitted/left `false`. T103 removed the
 *    two standing "fixture data"/"not wired" engineering-gap disclosure
 *    `Banner`s this file used to render permanently (both gaps are now
 *    closed, per the module doc above) -- the one remaining `Banner` below
 *    ("No session selected") is a genuine, still-real DES-12 empty/error
 *    state for a missing route param, not a stale disclosure.
 *
 * -----------------------------------------------------------------------
 * DES-12 four-state mapping
 * -----------------------------------------------------------------------
 *  - Loading: the brief window before each seam's first `.then()`
 *    resolves (`token`/`tally`/`sessionTitle` all start `null`). Not
 *    given a distinct spinner -- the "not available yet" / fallback-label
 *    renders already ARE this state's honest visual (see Empty below),
 *    and a spinner would flicker uselessly given a resolve time measured
 *    in microseconds against an in-memory stub today.
 *  - Empty: `token === null` (a real `checkin-token` response never
 *    resolves `null` on success, but the session/event may legitimately
 *    not exist, e.g. a stale/mistyped kiosk URL -- `SESSION_NOT_FOUND`
 *    folds into this same state via the Error bucket below) or
 *    `tally === null`/`sessionTitle === null` (`loaders/kiosk.ts`'s real
 *    loaders resolve `null` when the session/event cannot be found, module
 *    doc above) -- each rendered as its own explicit, honest "not
 *    available" message in its own region, never silence and never a
 *    fabricated number/token standing in for missing data.
 *  - Error: seam rejections (a real network/auth/authorization failure from
 *    `checkin-token`, or a transport error from a table read) are caught
 *    and folded into the same `null` / "not available" empty-state
 *    rendering as a genuinely-empty resolve -- there is no user-triggered
 *    retry action anywhere on this screen (it is a passive, unattended
 *    shop-TV display, not an interactive form), so a distinct error banner
 *    with nothing actionable to offer would add noise without adding
 *    capability; the polling loop itself already retries automatically
 *    every ~45s regardless of state.
 *  - Populated/success: `token`/`tally`/`sessionTitle` all non-null --
 *    renders the real QR/short-code/tally-number/title content.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Banner, Center, Heading, HStack, Text, VStack } from '@astryxdesign/core';
// T103: real defaults for this page's three seams (module doc above). This
// import is circular with `loaders/kiosk.ts` (that file imports
// `buildCheckinUrl`/`KIOSK_REFRESH_INTERVAL_SECONDS`/types back from this
// same file) -- the same "two files import from each other, safe because
// nothing is called at module-evaluation time" pattern already established
// and working between `MeetingsList.tsx`/`loaders/meetings.ts` and
// `StudentMeetingView.tsx`/`loaders/checkin.ts` (both read-only references
// here). Every value used below is only ever called lazily, inside a
// function body invoked well after both modules finish evaluating.
import {
  loadKioskDisplayToken as loadKioskDisplayTokenFromSupabase,
  loadKioskSessionTitle as loadKioskSessionTitleFromSupabase,
  loadKioskTally as loadKioskTallyFromSupabase,
} from '../../lib/supabase/loaders/kiosk';

// ---------------------------------------------------------------------------
// Ground-truth constants (PRD MTG-06 / hmac.ts's header comment -- cited in
// full in the module doc above). Only the DISPLAY-side constants that do not
// require the server-only secret live here.
// ---------------------------------------------------------------------------

/** PRD MTG-06: "QR/code refresh client-side every 45 s." */
export const KIOSK_REFRESH_INTERVAL_SECONDS = 45;
export const KIOSK_REFRESH_INTERVAL_MS = KIOSK_REFRESH_INTERVAL_SECONDS * 1000;

/** hmac.ts step 6 (see module doc): the QR payload's URL shape. Exported
 * (T103) so `loaders/kiosk.ts`'s real `loadKioskDisplayToken` can build the
 * same URL from a real minted token without re-deriving this shape a
 * second time -- the only place this URL shape is constructed anywhere in
 * this codebase. */
export function buildCheckinUrl(sessionId: string, token: string): string {
  return `https://portal.voltfrc.org/checkin?s=${encodeURIComponent(sessionId)}&t=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Data-fetching seams -- GAP #1 (token) / GAP #2 (tally, session title),
// both closed by T103. See module doc above for the full reasoning behind
// each real default (`loaders/kiosk.ts`) and each fixture stub below (still
// exported, for tests/harness use).
// ---------------------------------------------------------------------------

/** What the real `checkin-token`-backed loader (GAP #1) returns. */
export interface KioskDisplayToken {
  qrUrl: string;
  shortCode: string;
  refreshesInSeconds: number;
}
export type KioskDisplayTokenLoader = (sessionId: string) => Promise<KioskDisplayToken | null>;

/** What the real per-session attendance count (GAP #2) returns. */
export interface KioskTallyState {
  checkedIn: number;
  expected: number;
}
export type KioskTallyLoader = (sessionId: string) => Promise<KioskTallyState | null>;

/** What the real per-session title lookup (GAP #2) returns. */
export interface KioskSessionTitle {
  title: string;
}
export type KioskSessionTitleLoader = (sessionId: string) => Promise<KioskSessionTitle | null>;

/**
 * Obviously-fake placeholder value: neither valid lower-case hex (the real
 * QR token's shape per hmac.ts step 4) nor producible by the real
 * `byte % 34` alphabet mapping -- see module doc GAP #1.
 */
const FIXTURE_QR_TOKEN = 'FIXTURE-NOT-A-REAL-CHECKIN-TOKEN';
/** Obviously-fake placeholder short code -- see module doc GAP #1. */
const FIXTURE_SHORT_CODE = 'PLACEH';

/**
 * T103: no longer the shipped default (see `loaders/kiosk.ts`'s real
 * `loadKioskDisplayToken`, wired in below) -- kept, exported, and unchanged
 * for tests/harness use, the same "the fixture function itself is
 * untouched and still exported for tests" precedent `loaders/invites.ts`'s
 * own module doc already establishes for its analogous fixture/real-default
 * swap. Does NOT call any HTTP endpoint; a verification harness that wants
 * a deterministic, offline stub should pass this explicitly.
 */
export async function fixtureLoadKioskDisplayToken(
  sessionId: string,
): Promise<KioskDisplayToken | null> {
  return {
    qrUrl: buildCheckinUrl(sessionId, FIXTURE_QR_TOKEN),
    shortCode: FIXTURE_SHORT_CODE,
    refreshesInSeconds: KIOSK_REFRESH_INTERVAL_SECONDS,
  };
}

/**
 * T103: no longer the shipped default (see `loaders/kiosk.ts`'s real
 * `loadKioskTally`, wired in below) -- kept, exported, and unchanged for
 * tests/harness use (same precedent as `fixtureLoadKioskDisplayToken`
 * above). Always resolves `null` ("not available") rather than fabricating
 * plausible-looking attendance numbers.
 */
export async function notWiredLoadKioskTally(): Promise<KioskTallyState | null> {
  return null;
}

/**
 * T103: no longer the shipped default (see `loaders/kiosk.ts`'s real
 * `loadKioskSessionTitle`, wired in below) -- kept, exported, and unchanged
 * for tests/harness use (same precedent as `fixtureLoadKioskDisplayToken`
 * above). Always resolves `null`; the component falls back to a generic
 * label. (Deliberately takes no `sessionId` parameter -- a function with
 * fewer parameters than `KioskSessionTitleLoader` declares is still a
 * valid implementation of it; the loader never needs the id since it
 * always resolves `null` regardless.)
 */
export async function notWiredLoadKioskSessionTitle(): Promise<KioskSessionTitle | null> {
  return null;
}

// ---------------------------------------------------------------------------
// ~45s polling -- the cadence logic itself (MTG-06), real and independently
// testable (e.g. with fake timers) regardless of what `load` resolves to.
// ---------------------------------------------------------------------------

function usePolling<T>(
  sessionId: string,
  load: (sessionId: string) => Promise<T | null>,
  intervalMs: number,
): T | null {
  const [value, setValue] = useState<T | null>(null);
  // Keeps the effect below from needing `load` in its dependency array (so
  // passing a fresh inline default function on every render never resets
  // the interval), while still always calling the latest `load` passed in.
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let isMounted = true;

    function refresh(): void {
      loadRef
        .current(sessionId)
        .then((result) => {
          if (isMounted) setValue(result);
        })
        .catch(() => {
          // DES-12 "Error" bucket -- see module doc: folded into the same
          // `null`/"not available" rendering as a genuine empty resolve.
          if (isMounted) setValue(null);
        });
    }

    refresh(); // immediate load on mount / sessionId change
    const intervalId = setInterval(refresh, intervalMs);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [sessionId, intervalMs]);

  return value;
}

/** ~45s-refreshing QR/short-code seam (MTG-06). GAP #1 -- T103 real default
 * (`loaders/kiosk.ts`'s `loadKioskDisplayToken`, calling the new
 * `checkin-token` Edge Function). See module doc GAP #1. */
export function useKioskDisplayToken(
  sessionId: string,
  loadDisplayToken: KioskDisplayTokenLoader = loadKioskDisplayTokenFromSupabase,
): KioskDisplayToken | null {
  return usePolling(sessionId, loadDisplayToken, KIOSK_REFRESH_INTERVAL_MS);
}

/** ~45s-refreshing tally seam. GAP #2 -- T103 real default
 * (`loaders/kiosk.ts`'s `loadKioskTally`). See module doc GAP #2. */
export function useKioskTally(
  sessionId: string,
  loadTally: KioskTallyLoader = loadKioskTallyFromSupabase,
): KioskTallyState | null {
  return usePolling(sessionId, loadTally, KIOSK_REFRESH_INTERVAL_MS);
}

/** ~45s-refreshing session-title seam. GAP #2 -- T103 real default
 * (`loaders/kiosk.ts`'s `loadKioskSessionTitle`). See module doc GAP #2. */
export function useKioskSessionTitle(
  sessionId: string,
  loadSessionTitle: KioskSessionTitleLoader = loadKioskSessionTitleFromSupabase,
): KioskSessionTitle | null {
  return usePolling(sessionId, loadSessionTitle, KIOSK_REFRESH_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface KioskPageProps {
  /** GAP #1 seam override -- defaults to the real `checkin-token`-backed
   * loader (T103). Tests/harnesses that want a deterministic offline stub
   * should pass `fixtureLoadKioskDisplayToken` explicitly. */
  loadDisplayToken?: KioskDisplayTokenLoader;
  /** GAP #2 seam override -- defaults to the real Supabase-backed loader
   * (T103). Tests/harnesses that want a deterministic "not available" stub
   * should pass `notWiredLoadKioskTally` explicitly. */
  loadTally?: KioskTallyLoader;
  /** GAP #2 seam override -- defaults to the real Supabase-backed loader
   * (T103). Tests/harnesses that want a deterministic "not available" stub
   * should pass `notWiredLoadKioskSessionTitle` explicitly. */
  loadSessionTitle?: KioskSessionTitleLoader;
}

const FALLBACK_SESSION_TITLE = 'Meeting Check-In';

export function KioskPage({
  loadDisplayToken,
  loadTally,
  loadSessionTitle,
}: KioskPageProps = {}): ReactNode {
  const { sessionId } = useParams<{ sessionId: string }>();

  // `sessionId` is a route param, never user PII -- an opaque
  // `event_sessions.id` uuid, not a name or email (PRD SEC-04/ROS-08 scopes
  // PII to student names/emails, which never appear on this screen).
  const safeSessionId = sessionId ?? '';

  const token = useKioskDisplayToken(safeSessionId, loadDisplayToken);
  const tally = useKioskTally(safeSessionId, loadTally);
  const sessionTitle = useKioskSessionTitle(safeSessionId, loadSessionTitle);

  if (!sessionId) {
    return (
      <Center axis="both" height="100vh" width="100%">
        <Banner
          status="warning"
          title="No session selected"
          description="This kiosk URL is missing a session id."
        />
      </Center>
    );
  }

  const tallyText =
    tally === null
      ? 'Live count not available yet'
      : `${tally.checkedIn} of ${tally.expected} checked in`;

  return (
    <Center axis="both" height="100vh" width="100%">
      <VStack gap={8} hAlign="center" padding={8} maxWidth={960}>
        <Heading level={1}>{sessionTitle?.title ?? FALLBACK_SESSION_TITLE}</Heading>

        <HStack gap={10} hAlign="center" vAlign="center" wrap="wrap">
          <VStack gap={2} hAlign="center">
            {token === null ? (
              <Text type="supporting">QR not available yet.</Text>
            ) : (
              <QRCodeSVG value={token.qrUrl} size={240} level="M" title="Check-in QR code" />
            )}
            <Text type="supporting">Scan to check in</Text>
            {token !== null && (
              <Text type="supporting">Refreshes every {token.refreshesInSeconds}s</Text>
            )}
          </VStack>

          <VStack gap={2} hAlign="center">
            <Text type="label">Or enter code:</Text>
            <Text type="code" size="4xl" hasTabularNumbers>
              {token === null ? '------' : token.shortCode}
            </Text>
            {token !== null && (
              <Text type="supporting">Refreshes every {token.refreshesInSeconds}s</Text>
            )}
          </VStack>
        </HStack>

        <HStack aria-live="polite" hAlign="center">
          <Text type="display-2" hasTabularNumbers>
            {tallyText}
          </Text>
        </HStack>

        <Text type="supporting">No student names are shown on this screen.</Text>
      </VStack>
    </Center>
  );
}

export default KioskPage;
