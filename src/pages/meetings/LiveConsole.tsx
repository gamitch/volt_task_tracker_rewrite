/**
 * T033: `/meetings/live/:sessionId` -- the coach's live attendance console
 * (MTG-05). PRD 4.2's own wireframe (reproduced verbatim in the worker
 * packet) is a two-pane layout: a header bar (back link, session title +
 * time range, "End meeting"), a QR panel (left), and a live roster (right --
 * search box, a live "N/M in" tally, one row per student with a roll-call
 * `SegmentedControl` [Present|Late|Excused|Absent], MTG-11). This is the
 * single most operationally critical screen in the app: a coach uses it
 * DURING an actual meeting to take attendance in real time, so DES-17's full
 * keyboard path (arrow through rows, 1-4 sets status on the focused row) is
 * this task's own packet's explicit BLOCKER-class requirement -- see section
 * 3 below.
 *
 * -----------------------------------------------------------------------
 * 1. Router reachability + role guard (packet Forbidden Files note) --
 *    same *reachability-only* gap class `Kiosk.tsx`/T034 and
 *    `RosterShell.tsx`/T021 already documented, re-confirmed live for this
 *    route rather than assumed.
 * -----------------------------------------------------------------------
 *
 * `src/app/router.tsx` (forbidden to edit, "import-only" per this task's
 * packet) wires `/meetings/live/:sessionId` (lines ~155-162) with
 * `RequireAuth` only -- confirmed by reading that file directly -- no
 * `RequireRole`, unlike its sibling `/kiosk/:sessionId` route. Since this
 * console is coach/admin-only (MTG-05's own text: "coach"), this component
 * nests `guards.tsx`'s `RequireRole` internally, one level lower, exactly
 * the mechanism `RosterShell.tsx`/T021 established for the identical gap
 * (`RequireRole` is a plain function component with no dependency on being
 * used inside a `<Route>`). `LiveConsolePage` (the default export) is the
 * gated wrapper; `LiveConsoleBody` (the real content) is exported
 * separately, ungated, specifically so MTG-12's defense-in-depth
 * excused-gating (section 4 below) can be exercised directly in a test
 * without also having to fight `RequireRole`'s redirect.
 *
 * Also per the same "import-only" allowance, `routePaths` (router.tsx's own
 * exported route-path table) is imported directly for this page's two real
 * links ("Back to meetings" -> `routePaths.meetings`, "Open kiosk view" ->
 * `routePaths.kioskSession(sessionId)`) -- the exact same
 * `import { routePaths } from '../../app/router'` idiom `SideNav.tsx` and
 * `MobileNav.tsx` already established, not a new import pattern.
 *
 * `router.tsx`'s own `/meetings/live/:sessionId` route still renders its
 * inline `MeetingLiveSessionPage()` placeholder, not an import of this file
 * -- the same *reachability* gap (distinct from the role-guard gap just
 * described, which genuinely is fixed here) every not-yet-built route has,
 * per T018's checker finding cited by every sibling task's own module doc.
 * Swapping that placeholder for a real import requires editing router.tsx,
 * a forbidden file here.
 *
 * `guards.tsx`'s exported `Role` union is still the stale
 * `'admin' | 'staff' | 'volunteer' | 'coach'` placeholder (not AUTH-05's
 * real `admin | coach | student | parent` vocabulary) -- the same
 * recurring, disclosed-not-fixed gap `RosterShell.tsx`/`MeetingsList.tsx`
 * already flagged. `'coach'`/`'admin'` happen to be spelled identically in
 * both vocabularies, which is why `allowedRoles={['coach', 'admin']}` below
 * still reads correctly today.
 *
 * -----------------------------------------------------------------------
 * 2. QR panel -- T032's exact HMAC/short-code scheme, re-derived from
 *    `hmac.ts` directly (packet Known Context/Traps #6), and the SAME
 *    two-gap disclosure treatment `Kiosk.tsx`/T034 already established for
 *    an identical problem -- cited, not re-solved differently.
 * -----------------------------------------------------------------------
 *
 * Verbatim re-derivation, sourced directly from
 * `supabase/functions/checkin/hmac.ts` lines 1-59 (read-only reference;
 * that whole directory is forbidden to edit here):
 *   1. `bucket = floor(unixSeconds / 60)` (hmac.ts line 15) -- a 60-second
 *      time bucket anchored to the Unix epoch, NOT the session's
 *      `starts_at`.
 *   2. Canonical message: `` `${sessionId}:${bucket}` `` (hmac.ts line 17,
 *      `digestFor` line 83).
 *   3. `digest = HMAC-SHA256(key = the server-only signing secret, message)`
 *      (hmac.ts lines 21, 72-79) -- 32 raw bytes. This secret can never
 *      exist in `src/` (constitution item 5) -- this file never types its
 *      literal env-var name anywhere, including in comments.
 *   4. QR token: the first 16 bytes of `digest`, lower-case hex (hmac.ts
 *      lines 24-25, `TOKEN_BYTE_LENGTH = 16`, `tokenFor` lines 87-90) -- 32
 *      hex chars.
 *   5. Short code: bytes [16..22) of the SAME digest (hmac.ts lines 26-36,
 *      `SHORT_CODE_BYTE_OFFSET = 16`, `SHORT_CODE_LENGTH = 6`,
 *      `shortCodeFor` lines 93-101), each byte mapped via `byte % 34` into
 *      `SHORT_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'` (hmac.ts
 *      line 54) -- 6 always-uppercase chars (both O/I are included; only
 *      digits 0/1 are excluded).
 *   6. QR encodes `https://portal.voltfrc.org/checkin?s=<sessionId>&t=<token>`
 *      (PRD MTG-06, mirrored by `Kiosk.tsx`'s own `buildCheckinUrl`;
 *      re-implemented independently below rather than imported, since
 *      `Kiosk.tsx` is a forbidden, not "import-only", file for this task).
 *   7. Validity window: current bucket OR the immediately previous one
 *      (hmac.ts lines 43-48, `verifyToken`/`verifyShortCode` lines
 *      118-145) -- an effective ~60-120s window.
 *
 * Computing step 3 requires the secret, which structurally cannot live in
 * this file. `checkin`'s Edge Function (T032) only VALIDATES a presented
 * token/code; there is still no endpoint anywhere in this repo that MINTS
 * one for a given `sessionId` -- the exact GAP #1 `Kiosk.tsx`/T034 already
 * identified and disclosed for its own QR panel. This file applies the
 * identical treatment `Kiosk.tsx` established (cited, not re-solved
 * differently, per the packet's explicit instruction): a real
 * `QRCodeSVG`-rendered QR + real short-code display, wired against an
 * injectable `loadDisplayToken` seam whose shipped default
 * (`fixtureLoadLiveConsoleDisplayToken`) resolves obviously-fake,
 * non-hex/non-alphabet-producible placeholder values
 * (`FIXTURE_QR_TOKEN`/`FIXTURE_SHORT_CODE` below), paired with a permanent,
 * non-dismissable `Banner` disclosing this is fixture data -- never made to
 * look production-real.
 *
 * The same "missing shared client, not fabricated" treatment
 * `Kiosk.tsx`'s GAP #2 established for ITS live tally applies here to BOTH
 * this console's live roster/attendance data (Known Context/Traps #1 --
 * no `createClient`/`supabase-js` usage anywhere in `src/` yet, grep-
 * confirmed) and its Realtime subscription (section 3 below) -- disclosed
 * via a second permanent Banner, with `defaultLoadLiveConsoleData` and
 * `notWiredSetAttendanceStatus` shipping honest fixture/no-op defaults
 * rather than fabricated network calls.
 *
 * -----------------------------------------------------------------------
 * 3. DES-17 keyboard path -- BLOCKER-class per this task's own packet.
 * -----------------------------------------------------------------------
 *
 * "Arrow through roster rows, 1-4 keys set Present/Late/Excused/Absent on
 * the focused row" -- WITHOUT tabbing into the row's own `SegmentedControl`
 * first. Implemented as a roving-tabindex list: exactly one roster row (the
 * `focusedRowIndex`'th) has `tabIndex={0}`; every other row has
 * `tabIndex={-1}`. `ListItem`'s own type (`ListItemProps extends
 * BaseProps<HTMLLIElement>`, `node_modules/@astryxdesign/core/dist/List/
 * ListItem.d.ts` line 19) confirms `tabIndex`/`onKeyDown`/`onFocus`/`ref`
 * are all real, pass-through props (`BaseProps`'s own doc comment,
 * `node_modules/@astryxdesign/core/dist/BaseProps.d.ts`, states explicitly:
 * "Keeps: event handlers, aria-*, role, tabIndex, ..."), NOT hallucinated
 * ones -- the same class of doc-precedented-but-not-table-listed prop
 * `Kiosk.tsx`/T034 already established for `aria-live` on `HStack`.
 * `ListItem`'s own runtime source (`ListItem.js`) further confirms these
 * land on the rendered root `<li>` unmodified via its trailing
 * `...restProps` spread.
 *
 * Each row's `onKeyDown` (bound on the `<li>` itself, so it fires
 * regardless of whether DOM focus is on the row or has drifted onto a
 * descendant, per normal event bubbling -- but is PROVEN below with focus
 * on the row itself, never the `SegmentedControl`, matching the packet's
 * literal "without requiring the user to tab into the SegmentedControl
 * itself" wording) handles:
 *   - `ArrowDown` / `ArrowUp`: moves the roving tab stop to the next/
 *     previous VISIBLE (post-search-filter) row and calls `.focus()` on it
 *     directly (`rowRefs` -- a `ref` array populated per filtered row).
 *   - `1` / `2` / `3` / `4`: calls `handleCoachSetStatus` for THIS row's
 *     student with Present/Late/Excused/Absent respectively (MTG-12 checked
 *     internally for `3`/Excused -- section 4).
 * This is proven with real, driven `KeyboardEvent`s dispatched at the row's
 * DOM node (never at the `SegmentedControl`'s own radio inputs) in
 * `LiveConsole.test.tsx` -- see that file's own header for the specific
 * assertions.
 *
 * -----------------------------------------------------------------------
 * 4. MTG-11 coach-override precedence + MTG-12 excused gating.
 * -----------------------------------------------------------------------
 *
 * `mergeAttendanceUpdate(existing, incoming)` is the SINGLE pure function
 * both write paths go through: a coach's own `SegmentedControl`/keyboard
 * action (`handleCoachSetStatus`, always `method: 'coach'`) and an incoming
 * simulated Realtime change (`subscribeToAttendanceChanges`'s `onChange`
 * callback, section 5, which can carry any `AttendanceMethod`). Its rule:
 * if a row's EXISTING record is `method === 'coach'` and the INCOMING one
 * is not, the existing (coach) value wins unconditionally -- incoming is
 * discarded. Every other combination (no existing record, existing is
 * itself non-coach, or incoming IS also `method: 'coach'`) applies the
 * incoming value. Because a coach's own action always constructs
 * `incoming.method === 'coach'`, it always "wins" against whatever was
 * there before (including a prior QR check-in) -- both directions of MTG-11
 * ("coach always wins") fall out of this one rule. Proven directly (unit
 * test on the pure function) AND end-to-end (coach sets Present via the
 * real keyboard path, then a fabricated incoming QR event for the same
 * student is fed through the exact same `subscribeToAttendanceChanges`
 * callback contract the component itself uses, asserting the row stays
 * unchanged) in `LiveConsole.test.tsx`.
 *
 * MTG-12 ("only coach/admin may set `excused`"): `canSetExcused` is
 * computed from `useAuth().user.role` independently of the
 * `RequireRole`-gated wrapper (section 1) -- the packet is explicit this is
 * "defense in depth", not redundant, since `LiveConsoleBody` is exported
 * and directly testable without that outer gate. When `false`, the
 * `SegmentedControlItem value="excused"` option is not rendered at all
 * (Present/Late/Absent only) AND `handleCoachSetStatus`/the `3` keyboard
 * shortcut both no-op for `status === 'excused'` regardless of how they are
 * invoked, so there is no code path (UI or keyboard) that lets a non-coach/
 * admin role ever set `excused` on this screen.
 *
 * -----------------------------------------------------------------------
 * 5. NFR-05 Realtime -- consumption logic proven, transport honestly not
 *    wired (packet Known Context/Traps #4).
 * -----------------------------------------------------------------------
 *
 * No shared Supabase client exists in `src/` yet (Known Context/Traps #1),
 * so a real `supabase.channel(...).on('postgres_changes', ...)`
 * subscription cannot be built here. Instead: `SubscribeToAttendanceChangesFn`
 * is a real, typed interface (`(sessionId, onChange) => () => void`,
 * mirroring the exact shape a real Realtime wrapper would need) with an
 * injectable default, `notWiredSubscribeToAttendanceChanges`, that is
 * honestly a no-op (never calls `onChange`, returns a no-op unsubscribe) --
 * disclosed via the same permanent Banner as section 2's second gap, not
 * silently pretending to be live. The component wires this seam's `onChange`
 * directly into `mergeAttendanceUpdate` (section 4) inside a `useEffect`
 * cleanup-returning subscription, so the *consumption* logic (an incoming
 * change correctly and immediately updating the affected row's local state)
 * is fully real and independently provable by calling a test's own injected
 * `onChange` callback directly with a fabricated `AttendanceChangeEvent` --
 * exactly the packet's prescribed proof strategy, and exactly what
 * `LiveConsole.test.tsx` does.
 *
 * -----------------------------------------------------------------------
 * 6. DES-17 `aria-live="polite"` tally -- same established pattern
 *    `Kiosk.tsx`/T034 already used for its own tally.
 * -----------------------------------------------------------------------
 *
 * The roster pane's "N/M in" count is wrapped in an `HStack
 * aria-live="polite"` region (the exact `Kiosk.tsx` idiom, itself justified
 * there by `VStack`/`HStack`'s `BaseProps<HTMLElement>` -> native
 * `React.HTMLAttributes` pass-through, re-confirmed independently here, not
 * assumed from that prior task's citation) so assistive tech announces
 * check-in count changes as they happen, without the coach needing to poll
 * the screen visually mid-meeting.
 *
 * -----------------------------------------------------------------------
 * 7. Search box (packet Known Context/Traps #7) -- a real, working
 *    client-side name-substring filter, not `PowerSearch`.
 * -----------------------------------------------------------------------
 *
 * `PowerSearch` (`astryx-api.md` lines 5323-5412) is a structured,
 * field/operator/value token filter bar explicitly meant for "complex
 * multi-dimensional filtering" -- its own doc's "Don't" line says plainly:
 * "Use PowerSearch for simple keyword searches; a standard text input is
 * more appropriate for single-field lookups." A roster search is exactly
 * that single-field lookup (name substring), so this file uses a plain
 * `TextInput` (`astryx-api.md` lines 1611-1682) instead -- a disclosed,
 * deliberate choice, not an oversight.
 *
 * -----------------------------------------------------------------------
 * 8. "End meeting" stub (packet Forbidden Files -- `EndMeetingDialog.tsx`
 *    is T036's out-of-scope deliverable).
 * -----------------------------------------------------------------------
 *
 * The header's real, clickable "End meeting" `Button` shows a dismissable
 * `Banner` disclosing that the real end-of-meeting summary dialog (T036)
 * has not shipped yet, rather than opening a fake dialog or silently doing
 * nothing -- the same `StubBanner`-shaped pattern `MeetingsList.tsx`/T030
 * already established for its own out-of-scope "Schedule meetings"/"Edit"
 * actions (re-implemented locally here since `MeetingsList.tsx` is a
 * forbidden, not "import-only", file).
 *
 * -----------------------------------------------------------------------
 * 9. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked against `docs/swarm/astryx-api.md` directly.
 * -----------------------------------------------------------------------
 *
 *  - `VStack`/`HStack`: "Stack" section (`astryx-api.md` lines 319-416).
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap`, `maxWidth`, `width` used
 *    per that table; `aria-live` passed through per section 6 above.
 *  - `Heading`: `astryx-api.md`'s own "Components > Heading" subsection
 *    (lines 882-884) is `undefined` -- the same disclosed CLI-cross-checked
 *    doc gap `RosterShell.tsx`/`Kiosk.tsx`/`MeetingsList.tsx` already hit.
 *    `npm run astryx -- component Heading`, re-run live for this task:
 *      | `level` | `1 | 2 | 3 | 4 | 5 | 6` | -- | Heading level... (required) |
 *      | `children` | `ReactNode` | -- | Heading content. (required) |
 *    Only `level` and `children` used below; levels never skip (h1 session
 *    title, then two sibling h2s: "Check-in" and "Roster").
 *  - `Text`: `astryx-api.md` lines 858-878. `type` (`'supporting' |
 *    'label' | 'code' | 'display-2'`), `size`, `hasTabularNumbers`, `color`
 *    used; no hallucinated `variant`.
 *  - `Banner`: `astryx-api.md` lines 2749-2763. `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `Button`: `astryx-api.md` lines 1807-1827. `label`, `variant`, `size`,
 *    `onClick` used. Per that doc's own "Don't: use a button for
 *    navigation" line, `Button` is used ONLY for real actions ("End
 *    meeting" and, per T072/NFR-06, the QR show/hide toggle -- section 10
 *    below); both real navigational links use `Link`, not `Button`.
 *    `aria-expanded` is also passed on the toggle -- a real, doc-confirmed
 *    `BaseProps`/`React.HTMLAttributes` pass-through prop (`BaseProps.d.ts`:
 *    "Keeps: event handlers, aria-*, ..."), the same class of prop this file
 *    already uses `aria-live` on `HStack` for (section 6).
 *  - `Link`: `astryx-api.md` lines 1959-1977. `as`, `href`, `children`
 *    used, with `as={RouterLink}` (react-router-dom's `Link`, aliased) --
 *    the exact `as={Link}` real-client-side-navigation idiom
 *    `SideNav.tsx`/`MobileNav.tsx` already established
 *    (`node_modules/@astryxdesign/core/dist/Link/useLinkComponent.js`
 *    confirms `as`+`href` auto-injects a `to={href}` prop too, so
 *    react-router-dom's `Link` receives the prop it actually needs).
 *  - `Icon`: `astryx-api.md` lines 604-611. `icon` (`'chevronLeft'` for the
 *    back link, `'externalLink'` for "Open kiosk view", `'search'` as
 *    `TextInput`'s `startIcon` -- all three are real, doc-listed semantic
 *    names, re-confirmed live via `npm run astryx -- docs icons`), `size`
 *    used.
 *  - `TextInput`: `astryx-api.md` lines 1652-1676. `label`, `value`,
 *    `onChange`, `isLabelHidden`, `placeholder`, `hasClear`, `startIcon`
 *    used (section 7 above).
 *  - `List`/`ListItem`: `astryx-api.md` lines 4574-4584 (`List` props) /
 *    `ListItem`'s own "Components > ListItem" subsection (line 4589) is
 *    `undefined` -- resolved directly by reading
 *    `node_modules/@astryxdesign/core/dist/List/ListItem.d.ts` (a real
 *    generation-source file, the same class of resolution
 *    `RosterShell.tsx` used for a sibling doc gap): `label` (required),
 *    `description`, `startContent`, `endContent`, plus everything
 *    `BaseProps<HTMLLIElement>` keeps (`tabIndex`, `onKeyDown`, `onFocus`,
 *    `ref`, `id`, `data-testid`) -- all used per section 3 above.
 *    `hasDividers`, `header` used on `List` itself.
 *  - `SegmentedControl`/`SegmentedControlItem`: `astryx-api.md` lines
 *    5599-5611 (`SegmentedControl` props). `SegmentedControlItem`'s own
 *    subsection (line 5617) is `undefined`; `npm run astryx -- component
 *    SegmentedControlItem`, re-run live for this task:
 *      | `value` | `string` | -- | Unique value... (required) |
 *      | `label` | `string` | -- | Accessible label... (required) |
 *    `value`, `onChange`, `label` (on the control; used as its aria-label
 *    per that prop's own doc line, never rendered visibly -- set to a
 *    per-row-unique string, "Attendance for <name>") used on
 *    `SegmentedControl`; `value`, `label` used on `SegmentedControlItem`.
 *  - `StatusDot`: `astryx-api.md` lines 5871-5879. `variant`
 *    (`'success'|'warning'|'error'|'neutral'`), `label` used -- DES-05's
 *    literal mapping (PRD line 195, same mapping `MeetingsList.tsx`'s own
 *    `ATTENDANCE_STATUS_BADGE` already established: present=success,
 *    late=warning, excused=neutral, absent=error), plus `neutral` for the
 *    genuinely-unset "not recorded yet" state.
 *  - `Spinner`: `astryx-api.md` lines 5832-5840. `label` used.
 *  - `EmptyState`: `astryx-api.md` lines 3991-4001. `title`, `description`
 *    used.
 *
 * -----------------------------------------------------------------------
 * 10. T072 fix -- NFR-06 responsive gap (checker-confirmed BLOCKER, T068).
 * -----------------------------------------------------------------------
 *
 * T068's audit found two concrete NFR-06 gaps ("coach console usable on a
 * phone (panes stack, QR collapses behind a button)"), both fixed here as a
 * narrow, surgical follow-up (T072), not a redesign:
 *   1. The roster `VStack` (module doc section 9's `VStack`/`HStack` prop
 *      list) now pairs `width={480}` with `maxWidth="100%"`, matching the
 *      established codebase convention (`LoginPage.tsx`, `NoAccessPage.tsx`,
 *      `AcceptInvitePage.tsx`, `CheckinResult.tsx`) so it can shrink to fit
 *      a narrow viewport instead of forcing overflow.
 *   2. A real `showQr` `useState(true)` toggle now gates `QrPanel`'s
 *      render (`{showQr && <QrPanel ... />}`), driven by a real Astryx
 *      `Button` (section 9's `Button` bullet). Toggling genuinely
 *      un/mounts `QrPanel` -- removing it from the DOM and the
 *      accessibility tree, not just visually hiding it with CSS -- matching
 *      this app's `AlertDialog`-style "hidden means removed from the
 *      accessible DOM" convention. Default is QR-visible, so no existing
 *      desktop behavior changes beyond the new button appearing; a coach on
 *      a phone can deliberately collapse the QR panel to reclaim space for
 *      the roster. Deliberately NOT viewport-conditional (no `matchMedia`):
 *      this repo's test toolchain is jsdom-only with no real layout engine
 *      (`clientWidth`/`scrollWidth`/`getBoundingClientRect` always return 0
 *      here), so a manual always-present toggle is both what NFR-06's
 *      literal text asks for (a button, not automatic breakpoint behavior)
 *      and what is actually provable in `LiveConsole.test.tsx`.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  Icon,
  Link,
  List,
  ListItem,
  SegmentedControl,
  SegmentedControlItem,
  Spinner,
  StatusDot,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import { RequireRole, useAuth } from '../../app/guards';
import { routePaths } from '../../app/router';

// ---------------------------------------------------------------------------
// Ground truth -- `attendance` real column shapes, camelCase renames cited
// directly from `src/lib/supabase/types.ts` lines 178-217 (read-only
// reference, same "define locally, don't import" convention
// `MeetingsList.tsx`/`ParticipationTab.tsx` already established -- no page
// imports the real client/types module yet, Known Context/Traps #1).
// ---------------------------------------------------------------------------

/** `attendance.status` check constraint (`types.ts` line 180). */
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
/** `attendance.method` check constraint (`types.ts` line 184). */
export type AttendanceMethod = 'qr' | 'coach' | 'import';

/** The subset of an `attendance` row this console cares about, per student. */
export interface AttendanceRecordState {
  status: AttendanceStatus;
  method: AttendanceMethod;
  recordedBy: string | null;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// QR ground-truth constants -- module doc section 2. Only the DISPLAY-side
// constants that do not require the server-only secret live here.
// ---------------------------------------------------------------------------

/** hmac.ts step 6 (module doc section 2): the QR payload's URL shape. */
function buildCheckinUrl(sessionId: string, token: string): string {
  return `https://portal.voltfrc.org/checkin?s=${encodeURIComponent(sessionId)}&t=${encodeURIComponent(token)}`;
}

const QR_REFRESH_INTERVAL_MS = 45_000; // PRD MTG-06's ~45s client display refresh.

export interface LiveConsoleDisplayToken {
  qrUrl: string;
  shortCode: string;
}
export type LoadLiveConsoleDisplayTokenFn = (
  sessionId: string,
) => Promise<LiveConsoleDisplayToken | null>;

/** Obviously-fake: neither valid hex nor producible by the real `byte % 34`
 * alphabet mapping (module doc section 2 GAP #1). */
const FIXTURE_QR_TOKEN = 'FIXTURE-LIVE-CONSOLE-NOT-A-REAL-TOKEN';
const FIXTURE_SHORT_CODE = 'FXTURE';

async function fixtureLoadLiveConsoleDisplayToken(
  sessionId: string,
): Promise<LiveConsoleDisplayToken | null> {
  return {
    qrUrl: buildCheckinUrl(sessionId, FIXTURE_QR_TOKEN),
    shortCode: FIXTURE_SHORT_CODE,
  };
}

// ---------------------------------------------------------------------------
// Roster/session data seam -- module doc section 2's second gap (no shared
// Supabase client exists in `src/` yet).
// ---------------------------------------------------------------------------

export interface LiveConsoleSessionInfo {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
}

export interface LiveConsoleRosterEntry {
  studentId: string;
  name: string;
}

export interface LiveConsoleData {
  session: LiveConsoleSessionInfo;
  roster: LiveConsoleRosterEntry[];
  /** Keyed by `studentId`; a student with no entry has no attendance row yet. */
  attendance: Record<string, AttendanceRecordState>;
}

export type LoadLiveConsoleDataFn = (sessionId: string) => Promise<LiveConsoleData>;

export type SetAttendanceStatusFn = (
  sessionId: string,
  studentId: string,
  status: AttendanceStatus,
  method: AttendanceMethod,
  recordedBy: string | null,
) => Promise<void>;

/** Shipped default -- module doc section 2/5. No real `attendance` write
 * exists yet (no shared Supabase client in `src/`); this local state update
 * IS the real, provable behavior -- this seam is only where a real
 * `supabase.from('attendance').upsert(...)` call would go once a shared
 * client exists. */
export async function notWiredSetAttendanceStatus(): Promise<void> {
  // Intentional no-op -- see module doc section 2/5.
}

export interface AttendanceChangeEvent {
  studentId: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  recordedBy: string | null;
  updatedAt: string;
}
export type AttendanceChangeListener = (event: AttendanceChangeEvent) => void;
export type SubscribeToAttendanceChangesFn = (
  sessionId: string,
  onChange: AttendanceChangeListener,
) => () => void;

/** Shipped default -- module doc section 5 (NFR-05 GAP). Never calls
 * `onChange`; returns a no-op unsubscribe. Real callers (once a shared
 * Supabase client + Realtime channel exist) or a verification harness
 * should pass their own. */
export function notWiredSubscribeToAttendanceChanges(): () => void {
  return () => {};
}

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Names below are
// lifted directly from the PRD 4.2 wireframe itself ("Ada Q.", "Bea R.",
// "Cy T.") -- already-fabricated placeholders in the ground truth, not new
// PII, extended with a few more fabricated names for a workable roster.
// ---------------------------------------------------------------------------

const FIXTURE_SESSION_ID_FALLBACK = 'session-fixture-live-console';

const FIXTURE_ROSTER: readonly LiveConsoleRosterEntry[] = [
  { studentId: 'student-ada', name: 'Ada Q.' },
  { studentId: 'student-bea', name: 'Bea R.' },
  { studentId: 'student-cy', name: 'Cy T.' },
  { studentId: 'student-dee', name: 'Dee W.' },
  { studentId: 'student-eli', name: 'Eli M.' },
  { studentId: 'student-fay', name: 'Fay N.' },
  { studentId: 'student-gia', name: 'Gia P.' },
];

const FIXTURE_ATTENDANCE: Readonly<Record<string, AttendanceRecordState>> = {
  'student-ada': {
    status: 'present',
    method: 'qr',
    recordedBy: null,
    updatedAt: '2026-07-19T23:03:00.000Z',
  },
  'student-bea': {
    status: 'present',
    method: 'qr',
    recordedBy: null,
    updatedAt: '2026-07-19T23:04:00.000Z',
  },
  // student-cy: deliberately no entry -- "not yet checked in" (open circle
  // in the PRD wireframe).
  'student-dee': {
    status: 'late',
    method: 'coach',
    recordedBy: 'fixture-coach',
    updatedAt: '2026-07-19T23:20:00.000Z',
  },
  'student-eli': {
    status: 'excused',
    method: 'coach',
    recordedBy: 'fixture-coach',
    updatedAt: '2026-07-19T23:00:00.000Z',
  },
  'student-fay': {
    status: 'absent',
    method: 'import',
    recordedBy: null,
    updatedAt: '2026-07-19T22:00:00.000Z',
  },
};

/** Shipped default `LoadLiveConsoleDataFn` -- module doc section 2's second
 * gap. Real callers (once a shared Supabase client exists) or a
 * verification harness should pass their own. */
export async function defaultLoadLiveConsoleData(sessionId: string): Promise<LiveConsoleData> {
  return {
    session: {
      id: sessionId || FIXTURE_SESSION_ID_FALLBACK,
      title: 'Tuesday Build Meeting',
      startsAt: '2026-07-21T23:00:00.000Z', // 6:00 PM America/Chicago
      endsAt: '2026-07-22T01:00:00.000Z', // 8:00 PM America/Chicago
    },
    roster: [...FIXTURE_ROSTER],
    attendance: { ...FIXTURE_ATTENDANCE },
  };
}

// ---------------------------------------------------------------------------
// Pure helpers -- exported for direct testing (module doc sections 3/4).
// ---------------------------------------------------------------------------

/** MTG-11: a coach-recorded value always wins over any later non-coach
 * (e.g. QR) update for the same student. See module doc section 4. */
export function mergeAttendanceUpdate(
  existing: AttendanceRecordState | null,
  incoming: AttendanceRecordState,
): AttendanceRecordState {
  if (existing !== null && existing.method === 'coach' && incoming.method !== 'coach') {
    return existing;
  }
  return incoming;
}

export function filterRosterByQuery(
  roster: readonly LiveConsoleRosterEntry[],
  query: string,
): LiveConsoleRosterEntry[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return [...roster];
  return roster.filter((entry) => entry.name.toLowerCase().includes(normalized));
}

const CHECKED_IN_STATUSES: readonly AttendanceStatus[] = ['present', 'late'];

export interface AttendanceTally {
  checkedIn: number;
  total: number;
}

export function computeAttendanceTally(
  roster: readonly LiveConsoleRosterEntry[],
  attendanceByStudentId: Readonly<Record<string, AttendanceRecordState>>,
): AttendanceTally {
  const checkedIn = roster.filter((entry) => {
    const record = attendanceByStudentId[entry.studentId];
    return record != null && CHECKED_IN_STATUSES.includes(record.status);
  }).length;
  return { checkedIn, total: roster.length };
}

const CHICAGO_TIME_ZONE = 'America/Chicago';
const CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CHICAGO_TIME_ZONE,
});

function splitMeridiem(formatted: string): { time: string; meridiem: string | null } {
  const match = /^(.*?)\s?([AP]M)$/i.exec(formatted);
  return match ? { time: match[1], meridiem: match[2] } : { time: formatted, meridiem: null };
}

/** NFR-09: displayed in America/Chicago. e.g. "6:00-8:00 PM" (PRD 4.2's own
 * wireframe wording, deduped meridiem -- the same technique
 * `MeetingsList.tsx`'s `formatTimeRangeWithDuration` uses, re-implemented
 * independently here since that file is forbidden to import from). */
export function formatSessionTimeRange(startsAt: string, endsAt: string): string {
  const start = splitMeridiem(CLOCK_TIME_FORMATTER.format(new Date(startsAt)));
  const end = splitMeridiem(CLOCK_TIME_FORMATTER.format(new Date(endsAt)));
  const startText =
    start.meridiem !== null && start.meridiem === end.meridiem
      ? start.time
      : CLOCK_TIME_FORMATTER.format(new Date(startsAt));
  return `${startText}-${CLOCK_TIME_FORMATTER.format(new Date(endsAt))}`;
}

/** DES-05's literal mapping (PRD line 195) -- module doc section 9. */
const ATTENDANCE_STATUS_DOT: Record<
  AttendanceStatus,
  { variant: 'success' | 'warning' | 'neutral' | 'error'; label: string }
> = {
  present: { variant: 'success', label: 'Present' },
  late: { variant: 'warning', label: 'Late' },
  excused: { variant: 'neutral', label: 'Excused' },
  absent: { variant: 'error', label: 'Absent' },
};
const NOT_RECORDED_DOT = { variant: 'neutral' as const, label: 'Not recorded' };

/** DES-17's literal "1-4 keys set Present/Late/Excused/Absent" mapping. */
const DIGIT_KEY_TO_STATUS: Record<string, AttendanceStatus> = {
  '1': 'present',
  '2': 'late',
  '3': 'excused',
  '4': 'absent',
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook (same shape `MeetingsList.tsx`/`CoachHome.tsx`
// already established; re-implemented locally since those files are
// forbidden to import from).
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

function useLiveConsoleDisplayToken(
  sessionId: string,
  loadDisplayToken: LoadLiveConsoleDisplayTokenFn,
): LiveConsoleDisplayToken | null {
  const [token, setToken] = useState<LiveConsoleDisplayToken | null>(null);
  const loadRef = useRef(loadDisplayToken);
  loadRef.current = loadDisplayToken;

  useEffect(() => {
    let isMounted = true;
    function refresh(): void {
      loadRef
        .current(sessionId)
        .then((result) => {
          if (isMounted) setToken(result);
        })
        .catch(() => {
          if (isMounted) setToken(null);
        });
    }
    refresh();
    const intervalId = setInterval(refresh, QR_REFRESH_INTERVAL_MS);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [sessionId]);

  return token;
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface StubNotice {
  title: string;
  description: string;
}

function StubBanner({
  notice,
  onDismiss,
}: {
  notice: StubNotice;
  onDismiss: () => void;
}): ReactNode {
  return (
    <Banner
      status="info"
      title={notice.title}
      description={notice.description}
      isDismissable
      onDismiss={onDismiss}
    />
  );
}

function QrPanel({
  sessionId,
  token,
}: {
  sessionId: string;
  token: LiveConsoleDisplayToken | null;
}): ReactNode {
  return (
    <VStack gap={4} padding={4} hAlign="center" width={280}>
      <Heading level={2}>Check-in</Heading>
      <Banner
        status="warning"
        title="QR/code below use fixture data"
        description="No Edge Function exists yet that can safely mint a live token/short code without exposing the server-only signing secret to the browser (constitution item 5). These values are clearly-labeled placeholders, not a real, scannable check-in token."
      />
      {token === null ? (
        <Text type="supporting">QR not available yet.</Text>
      ) : (
        <QRCodeSVG value={token.qrUrl} size={160} level="M" title="Check-in QR code" />
      )}
      <VStack gap={1} hAlign="center">
        <Text type="label">Or enter code:</Text>
        <Text type="code" size="4xl" hasTabularNumbers>
          {token === null ? '------' : token.shortCode}
        </Text>
      </VStack>
      <Link as={RouterLink} href={routePaths.kioskSession(sessionId)}>
        Open kiosk view <Icon icon="externalLink" size="sm" />
      </Link>
    </VStack>
  );
}

function RosterRow({
  entry,
  record,
  index,
  isFocused,
  canSetExcused,
  onFocusRow,
  onKeyDownRow,
  onSetStatus,
  rowRef,
}: {
  entry: LiveConsoleRosterEntry;
  record: AttendanceRecordState | null;
  index: number;
  isFocused: boolean;
  canSetExcused: boolean;
  onFocusRow: (index: number) => void;
  onKeyDownRow: (
    event: ReactKeyboardEvent<HTMLLIElement>,
    index: number,
    studentId: string,
  ) => void;
  onSetStatus: (studentId: string, status: AttendanceStatus) => void;
  rowRef: (el: HTMLLIElement | null) => void;
}): ReactNode {
  const dot = record === null ? NOT_RECORDED_DOT : ATTENDANCE_STATUS_DOT[record.status];

  return (
    <ListItem
      ref={rowRef}
      label={entry.name}
      startContent={<StatusDot variant={dot.variant} label={dot.label} />}
      endContent={
        <SegmentedControl
          value={record?.status ?? ''}
          onChange={(value) => onSetStatus(entry.studentId, value as AttendanceStatus)}
          label={`Attendance for ${entry.name}`}
        >
          <SegmentedControlItem value="present" label="Present" />
          <SegmentedControlItem value="late" label="Late" />
          {canSetExcused && <SegmentedControlItem value="excused" label="Excused" />}
          <SegmentedControlItem value="absent" label="Absent" />
        </SegmentedControl>
      }
      tabIndex={isFocused ? 0 : -1}
      isSelected={isFocused}
      onFocus={() => onFocusRow(index)}
      onKeyDown={(event: ReactKeyboardEvent<HTMLLIElement>) =>
        onKeyDownRow(event, index, entry.studentId)
      }
      data-testid={`roster-row-${entry.studentId}`}
    />
  );
}

// ---------------------------------------------------------------------------
// Main content -- ungated (module doc section 1: `RequireRole` is applied
// one level up by the default export, so MTG-12 defense-in-depth can be
// tested directly against this component).
// ---------------------------------------------------------------------------

export interface LiveConsoleBodyProps {
  loadData?: LoadLiveConsoleDataFn;
  loadDisplayToken?: LoadLiveConsoleDisplayTokenFn;
  onSetAttendanceStatus?: SetAttendanceStatusFn;
  subscribeToAttendanceChanges?: SubscribeToAttendanceChangesFn;
}

export function LiveConsoleBody({
  loadData = defaultLoadLiveConsoleData,
  loadDisplayToken = fixtureLoadLiveConsoleDisplayToken,
  onSetAttendanceStatus = notWiredSetAttendanceStatus,
  subscribeToAttendanceChanges = notWiredSubscribeToAttendanceChanges,
}: LiveConsoleBodyProps): ReactNode {
  const { sessionId: rawSessionId } = useParams<{ sessionId: string }>();
  const sessionId = rawSessionId ?? '';
  const { user } = useAuth();

  // MTG-12 defense in depth -- module doc section 4. Only the two role
  // literals present in `guards.tsx`'s stale `Role` union are compared
  // directly (module doc section 1's disclosed vocabulary gap).
  const canSetExcused = user !== null && (user.role === 'coach' || user.role === 'admin');

  const loadState = useLoadState(() => loadData(sessionId), [loadData, sessionId]);
  const [session, setSession] = useState<LiveConsoleSessionInfo | null>(null);
  const [roster, setRoster] = useState<LiveConsoleRosterEntry[]>([]);
  const [attendanceByStudentId, setAttendanceByStudentId] = useState<
    Record<string, AttendanceRecordState>
  >({});
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [endMeetingStub, setEndMeetingStub] = useState<StubNotice | null>(null);
  // NFR-06 fix (T072): QR visible by default -- pure addition of a collapse
  // affordance so a coach on a phone can reclaim screen space for the
  // roster. `{showQr && <QrPanel .../>}` below genuinely un/mounts the
  // panel (not CSS-only hiding), matching this app's `AlertDialog`-style
  // "hidden means removed from the accessible DOM" convention.
  const [showQr, setShowQr] = useState(true);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (loadState.status === 'success') {
      setSession(loadState.data.session);
      setRoster(loadState.data.roster);
      setAttendanceByStudentId(loadState.data.attendance);
    }
  }, [loadState]);

  const displayToken = useLiveConsoleDisplayToken(sessionId, loadDisplayToken);

  // NFR-05 -- module doc section 5. Wires the injectable Realtime seam's
  // `onChange` straight into the same `mergeAttendanceUpdate` precedence
  // rule the coach's own writes use.
  useEffect(() => {
    const unsubscribe = subscribeToAttendanceChanges(sessionId, (event) => {
      setAttendanceByStudentId((prev) => {
        const existing = prev[event.studentId] ?? null;
        const merged = mergeAttendanceUpdate(existing, {
          status: event.status,
          method: event.method,
          recordedBy: event.recordedBy,
          updatedAt: event.updatedAt,
        });
        return { ...prev, [event.studentId]: merged };
      });
    });
    return unsubscribe;
  }, [sessionId, subscribeToAttendanceChanges]);

  const filteredRoster = useMemo(() => filterRosterByQuery(roster, query), [roster, query]);

  useEffect(() => {
    if (focusedIndex >= filteredRoster.length) {
      setFocusedIndex(Math.max(0, filteredRoster.length - 1));
    }
  }, [filteredRoster.length, focusedIndex]);

  const tally = computeAttendanceTally(roster, attendanceByStudentId);

  function handleSetStatus(studentId: string, status: AttendanceStatus): void {
    if (status === 'excused' && !canSetExcused) {
      // MTG-12 defense in depth -- module doc section 4. No-op: this
      // console never lets a non-coach/admin role set `excused`, however
      // the request was made (SegmentedControl click OR keyboard).
      return;
    }
    const incoming: AttendanceRecordState = {
      status,
      method: 'coach',
      recordedBy: user?.id ?? null,
      updatedAt: new Date().toISOString(),
    };
    setAttendanceByStudentId((prev) => {
      const existing = prev[studentId] ?? null;
      return { ...prev, [studentId]: mergeAttendanceUpdate(existing, incoming) };
    });
    onSetAttendanceStatus(sessionId, studentId, status, 'coach', user?.id ?? null).catch(() => {
      // Persistence seam rejection -- see module doc section 2/5; the local
      // state above is already the source of truth this UI shows.
    });
  }

  function focusRow(index: number): void {
    setFocusedIndex(index);
    rowRefs.current[index]?.focus();
  }

  function handleRowKeyDown(
    event: ReactKeyboardEvent<HTMLLIElement>,
    index: number,
    studentId: string,
  ): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusRow(Math.min(index + 1, filteredRoster.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusRow(Math.max(index - 1, 0));
      return;
    }
    const status = DIGIT_KEY_TO_STATUS[event.key];
    if (status !== undefined) {
      event.preventDefault();
      handleSetStatus(studentId, status);
    }
  }

  function handleEndMeetingClick(): void {
    setEndMeetingStub({
      title: 'End-meeting summary not built yet',
      description:
        "This opens the end-of-meeting summary dialog (T036). That dialog hasn't shipped yet, so this meeting has not been ended.",
    });
  }

  return (
    <VStack gap={6} padding={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <HStack gap={2} vAlign="center">
          <Icon icon="chevronLeft" size="sm" />
          <Link as={RouterLink} href={routePaths.meetings}>
            Back to meetings
          </Link>
        </HStack>
        {session !== null && (
          <VStack gap={0} hAlign="center">
            <Heading level={1}>{session.title}</Heading>
            <Text type="supporting">
              {formatSessionTimeRange(session.startsAt, session.endsAt)}
            </Text>
          </VStack>
        )}
        <Button label="End meeting" variant="secondary" onClick={handleEndMeetingClick} />
      </HStack>

      {endMeetingStub !== null && (
        <StubBanner notice={endMeetingStub} onDismiss={() => setEndMeetingStub(null)} />
      )}

      <Banner
        status="warning"
        title="Live sync not wired"
        description="attendance's RLS would allow a coach/admin-only real roster + Realtime feed once a shared Supabase client exists in src/ -- this is not an access-control gap, only a missing client (no createClient/supabase-js usage exists anywhere in src/ yet). Attendance changes made on this screen are local to this browser tab only."
      />

      {loadState.status === 'loading' && <Spinner label="Loading roster..." />}

      {loadState.status === 'error' && (
        <Banner
          status="error"
          title="Couldn't load this session"
          description="Something went wrong loading the roster for this session. Try refreshing the page."
        />
      )}

      {loadState.status === 'success' && roster.length === 0 && (
        <EmptyState
          title="No students on this roster"
          description="This session has no expected students yet."
        />
      )}

      {loadState.status === 'success' && roster.length > 0 && session !== null && (
        <>
          {/* NFR-06 fix (T072): a real, keyboard-accessible toggle button
              (Astryx `Button`, `astryx-api.md` lines 1807-1827 -- a real
              `<button>`, so Enter/Space activation is free) that genuinely
              adds/removes `QrPanel` from the DOM below, always rendered
              (never viewport-conditional, since this repo's jsdom-only test
              toolchain has no real layout engine to key off of -- module doc
              section 9). `aria-expanded` is a real `BaseProps`/
              `React.HTMLAttributes` pass-through prop (`BaseProps.d.ts`:
              "Keeps: event handlers, aria-*, ..."), the same class of
              doc-precedented-but-not-table-listed prop this file already
              uses for `aria-live` on `HStack` (module doc section 6). */}
          <HStack hAlign="end">
            <Button
              label={showQr ? 'Hide QR code' : 'Show QR code'}
              variant="ghost"
              size="sm"
              aria-expanded={showQr}
              onClick={() => setShowQr((previous) => !previous)}
              data-testid="qr-toggle-button"
            />
          </HStack>

          <HStack gap={6} wrap="wrap" vAlign="start">
            {showQr && <QrPanel sessionId={session.id} token={displayToken} />}

            <VStack gap={4} minHeight={200} width={480} maxWidth="100%">
              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
                <Heading level={2}>Roster</Heading>
                <HStack gap={4} vAlign="center" wrap="wrap">
                  <TextInput
                    label="Search roster"
                    isLabelHidden
                    value={query}
                    onChange={setQuery}
                    placeholder="Search students..."
                    hasClear
                    startIcon="search"
                  />
                  <HStack aria-live="polite" vAlign="center" data-testid="attendance-tally">
                    <Text type="body" hasTabularNumbers>
                      {tally.checkedIn}/{tally.total} in
                    </Text>
                  </HStack>
                </HStack>
              </HStack>

              {filteredRoster.length === 0 ? (
                <EmptyState
                  title="No students match your search"
                  description="Try a different name or clear the search box."
                />
              ) : (
                <List hasDividers header="Roster">
                  {filteredRoster.map((entry, index) => (
                    <RosterRow
                      key={entry.studentId}
                      entry={entry}
                      record={attendanceByStudentId[entry.studentId] ?? null}
                      index={index}
                      isFocused={index === focusedIndex}
                      canSetExcused={canSetExcused}
                      onFocusRow={setFocusedIndex}
                      onKeyDownRow={handleRowKeyDown}
                      onSetStatus={handleSetStatus}
                      rowRef={(el) => {
                        rowRefs.current[index] = el;
                      }}
                    />
                  ))}
                </List>
              )}
            </VStack>
          </HStack>
        </>
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Gated default export -- module doc section 1.
// ---------------------------------------------------------------------------

export function LiveConsolePage(props: LiveConsoleBodyProps = {}): ReactNode {
  return (
    <RequireRole allowedRoles={['coach', 'admin']}>
      <LiveConsoleBody {...props} />
    </RequireRole>
  );
}

export default LiveConsolePage;
