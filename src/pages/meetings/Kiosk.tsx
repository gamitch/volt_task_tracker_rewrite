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
 * THE critical architecture gap this task cannot resolve within
 * `Kiosk.tsx` alone -- read in full before touching the QR/code code below
 * -----------------------------------------------------------------------
 * The QR token and short code this screen must display are HMAC-SHA256
 * outputs keyed by a server-only secret that must never appear in frontend
 * code or any client bundle (constitution item 5, BLOCKER-class -- this
 * component deliberately never types that secret's literal env-var name
 * anywhere in this file, including in comments, so a grep for it across
 * `src/` stays clean). The exact derivation scheme, cited verbatim from
 * `supabase/functions/checkin/hmac.ts`'s header comment (read-only
 * reference; that whole directory is forbidden to edit here) is:
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
 *      (PRD MTG-06).
 *   7. Client-side display refresh cadence: ~45 seconds -- independent of
 *      the 60s server-side bucket; a display refresh, not a security
 *      boundary (the server accepts the current AND previous bucket
 *      regardless of when the display last refreshed).
 *
 * Computing step 3 requires the secret, which per constitution item 5 can
 * NEVER exist in `src/` -- so this page structurally cannot derive the real
 * token/short code itself. `checkin`'s Edge Function (T032, already built)
 * only *validates* a presented token/code; it has no endpoint that *mints*
 * one for a given `sessionId`, and there is currently NO Edge Function
 * anywhere in this repo that can safely hand this screen a display-ready
 * token/code without exposing the secret. This is GAP #1 below -- a real,
 * unresolved infrastructure gap, not solvable inside this file's Allowed
 * Files (a new/extended Edge Function is out of scope here; `supabase/
 * functions/checkin/**` is a forbidden directory for this task).
 *
 * What this file does instead, per the worker packet's explicit
 * instruction not to fabricate a fake network call or silently invent a
 * workaround: builds the COMPLETE real UI -- real `qrcode.react` QR
 * rendering (`QRCodeSVG`, the constitution-item-9-allowlisted dependency;
 * no hand-rolled QR encoding anywhere in this file), a real short-code
 * display, a real `aria-live="polite"` tally region, and a real ~45s
 * client-side refresh cadence (`usePolling` below, independently testable
 * with fake timers regardless of what the loader returns) -- wired against
 * an explicit, obviously-a-placeholder data-fetching seam
 * (`useKioskDisplayToken`/`useKioskTally`, mirroring the exact `loadData`
 * prop-injection pattern `NoAccessPage.tsx`/T020 already established in
 * this codebase). The QR/short-code seam's SHIPPED default
 * (`fixtureLoadKioskDisplayToken`) returns clearly-fixture-labeled,
 * obviously-fake values (`FIXTURE_QR_TOKEN`/`FIXTURE_SHORT_CODE` below --
 * neither is valid hex nor a value the real alphabet-mapping algorithm
 * could ever produce from a real digest) so the QR-rendering pipeline
 * itself is genuinely exercised end-to-end, paired with a permanent,
 * non-dismissable `Banner` disclosing that this is fixture data, not a
 * live token -- exactly the packet's "clearly-fixture-labeled data from a
 * local stub" option, not the "make it look production-real" one it
 * explicitly forbids.
 *
 * -----------------------------------------------------------------------
 * GAP #2 -- the live tally, treated deliberately DIFFERENTLY from GAP #1
 * -----------------------------------------------------------------------
 * `attendance`'s RLS is `staff_all` (full access) + `own_or_linked_read`
 * (own rows only). Since this route is coach/admin-only, a real
 * implementation of `useKioskTally` COULD legitimately read a full
 * per-session checked-in/expected count once a real Supabase client
 * exists -- there is no RLS gap on this specific screen. The only reason
 * this cannot be wired live today is that no shared Supabase client exists
 * anywhere in `src/` yet (grep-confirmed below: zero hits for
 * `createClient`/`supabase-js` under `src/`). This is a fundamentally
 * different, much shallower gap than GAP #1 (a missing shared client, not
 * a missing secure endpoint), so it is flagged separately here.
 *
 * Precisely BECAUSE this gap is "just" a missing client (not a missing
 * secure primitive), this file deliberately does NOT fabricate plausible-
 * looking placeholder integers for the tally (e.g. "0 of 0" or "12 of 18")
 * the way GAP #1's fixture QR/code do -- two bare numbers on a real kiosk
 * screen are far more likely to be mistaken for a genuine live count than
 * an already-gibberish-looking QR/short code is. Instead,
 * `notWiredLoadKioskTally` (the shipped default `useKioskTally` loader)
 * resolves to `null`, and the tally's `aria-live="polite"` region renders
 * an explicit "Live count not available yet" message in that case instead
 * of any number.
 *
 * The same "missing shared client, not fabricated" treatment is applied to
 * the page's session-title heading (`useKioskSessionTitle`, a small
 * natural extension of this same gap, not a third distinct one): its
 * default loader also resolves to `null`, and the heading falls back to a
 * generic, non-specific page-purpose label ("Meeting Check-In") rather
 * than a fabricated-sounding specific meeting name.
 *
 * Recommendation for the foreman/boss (the worker packet is explicit this
 * is a recommendation, not a decision made here): schedule (a) a small
 * new/extended Edge Function for GAP #1 (token/short-code minting for a
 * given `sessionId`, returning ONLY the current bucket's token/code, never
 * the secret itself) and (b) a separate shared-Supabase-client task for
 * GAP #2 -- the latter is also blocking `useKioskSessionTitle` here and is
 * already independently needed by T035/T056 and eventually T033/T053-T060
 * per this task's worker packet.
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
 *    `isDismissable` is deliberately omitted/left `false` -- these are
 *    standing engineering-gap disclosures meant to stay visible for as
 *    long as the underlying gap is real, not a transient message a viewer
 *    should be able to dismiss away.
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
 *  - Empty: `token === null` (GAP #1's fixture loader is written to
 *    always resolve non-null, but a future *real* loader legitimately
 *    could resolve `null`, e.g. before the session opens for check-in) or
 *    `tally === null` (GAP #2's shipped default, always) or
 *    `sessionTitle === null` (same) -- each rendered as its own explicit,
 *    honest "not available" message in its own region, never silence and
 *    never a fabricated number/token standing in for missing data.
 *  - Error: seam rejections are caught and folded into the same `null` /
 *    "not available" empty-state rendering as a genuinely-empty resolve --
 *    there is no user-triggered retry action anywhere on this screen (it
 *    is a passive, unattended shop-TV display, not an interactive form),
 *    so a distinct error banner with nothing actionable to offer would add
 *    noise without adding capability; the polling loop itself already
 *    retries automatically every ~45s regardless of state.
 *  - Populated/success: `token`/`tally`/`sessionTitle` all non-null --
 *    renders the real QR/short-code/tally-number/title content.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Banner, Center, Heading, HStack, Text, VStack } from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Ground-truth constants (PRD MTG-06 / hmac.ts's header comment -- cited in
// full in the module doc above). Only the DISPLAY-side constants that do not
// require the server-only secret live here.
// ---------------------------------------------------------------------------

/** PRD MTG-06: "QR/code refresh client-side every 45 s." */
export const KIOSK_REFRESH_INTERVAL_SECONDS = 45;
export const KIOSK_REFRESH_INTERVAL_MS = KIOSK_REFRESH_INTERVAL_SECONDS * 1000;

/** hmac.ts step 6 (see module doc): the QR payload's URL shape. */
function buildCheckinUrl(sessionId: string, token: string): string {
  return `https://portal.voltfrc.org/checkin?s=${encodeURIComponent(sessionId)}&t=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Data-fetching seams -- GAP #1 (token) / GAP #2 (tally, session title).
// See module doc above for the full reasoning behind each default.
// ---------------------------------------------------------------------------

/** What a real token-minting endpoint (GAP #1, not yet built) would return. */
export interface KioskDisplayToken {
  qrUrl: string;
  shortCode: string;
  refreshesInSeconds: number;
}
export type KioskDisplayTokenLoader = (sessionId: string) => Promise<KioskDisplayToken | null>;

/** What a real per-session attendance count (GAP #2) would return. */
export interface KioskTallyState {
  checkedIn: number;
  expected: number;
}
export type KioskTallyLoader = (sessionId: string) => Promise<KioskTallyState | null>;

/** What a real per-session title lookup (GAP #2) would return. */
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
 * Shipped default `KioskDisplayTokenLoader` -- see module doc GAP #1. Does
 * NOT call any HTTP endpoint (none exists yet that could safely answer
 * this). Real callers (once a minting Edge Function exists) or a
 * verification harness should pass their own loader.
 */
async function fixtureLoadKioskDisplayToken(sessionId: string): Promise<KioskDisplayToken | null> {
  return {
    qrUrl: buildCheckinUrl(sessionId, FIXTURE_QR_TOKEN),
    shortCode: FIXTURE_SHORT_CODE,
    refreshesInSeconds: KIOSK_REFRESH_INTERVAL_SECONDS,
  };
}

/**
 * Shipped default `KioskTallyLoader` -- see module doc GAP #2. Always
 * resolves `null` ("not available") rather than fabricating plausible-
 * looking attendance numbers. Real callers (once a shared Supabase client
 * exists) or a verification harness should pass their own loader.
 */
async function notWiredLoadKioskTally(): Promise<KioskTallyState | null> {
  return null;
}

/**
 * Shipped default `KioskSessionTitleLoader` -- see module doc GAP #2.
 * Always resolves `null`; the component falls back to a generic label.
 * (Deliberately takes no `sessionId` parameter -- a function with fewer
 * parameters than `KioskSessionTitleLoader` declares is still a valid
 * implementation of it; the loader never needs the id since it always
 * resolves `null` regardless.)
 */
async function notWiredLoadKioskSessionTitle(): Promise<KioskSessionTitle | null> {
  return null;
}

// ---------------------------------------------------------------------------
// ~45s polling -- the cadence logic itself (MTG-06), real and independently
// testable (e.g. with fake timers) regardless of what `load` resolves to.
// ---------------------------------------------------------------------------

function usePolling<T>(sessionId: string, load: (sessionId: string) => Promise<T | null>, intervalMs: number): T | null {
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

/** ~45s-refreshing QR/short-code seam (MTG-06). See module doc GAP #1. */
export function useKioskDisplayToken(
  sessionId: string,
  loadDisplayToken: KioskDisplayTokenLoader = fixtureLoadKioskDisplayToken,
): KioskDisplayToken | null {
  return usePolling(sessionId, loadDisplayToken, KIOSK_REFRESH_INTERVAL_MS);
}

/** ~45s-refreshing tally seam. See module doc GAP #2. */
export function useKioskTally(
  sessionId: string,
  loadTally: KioskTallyLoader = notWiredLoadKioskTally,
): KioskTallyState | null {
  return usePolling(sessionId, loadTally, KIOSK_REFRESH_INTERVAL_MS);
}

/** ~45s-refreshing session-title seam. See module doc GAP #2. */
export function useKioskSessionTitle(
  sessionId: string,
  loadSessionTitle: KioskSessionTitleLoader = notWiredLoadKioskSessionTitle,
): KioskSessionTitle | null {
  return usePolling(sessionId, loadSessionTitle, KIOSK_REFRESH_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface KioskPageProps {
  /** GAP #1 seam override -- defaults to the obviously-fake fixture stub. */
  loadDisplayToken?: KioskDisplayTokenLoader;
  /** GAP #2 seam override -- defaults to the "not wired" `null` stub. */
  loadTally?: KioskTallyLoader;
  /** GAP #2 seam override -- defaults to the "not wired" `null` stub. */
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
        <Banner status="warning" title="No session selected" description="This kiosk URL is missing a session id." />
      </Center>
    );
  }

  const tallyText =
    tally === null ? 'Live count not available yet' : `${tally.checkedIn} of ${tally.expected} checked in`;

  return (
    <Center axis="both" height="100vh" width="100%">
      <VStack gap={8} hAlign="center" padding={8} maxWidth={960}>
        <Banner
          status="warning"
          title="Check-in QR/code below use fixture data"
          description="No Edge Function exists yet that can safely mint a live token/short code without exposing the server-only signing secret to the browser (constitution item 5). The QR and code shown here are clearly-labeled placeholder fixture values, not a real, scannable check-in token."
        />
        <Banner
          status="warning"
          title="Live tally not wired"
          description="attendance's RLS would allow a coach/admin-only real count once a shared Supabase client exists in src/ -- this is not an access-control gap, only a missing client (no createClient/supabase-js usage exists anywhere in src/ yet). No fabricated numbers are shown below."
        />

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
