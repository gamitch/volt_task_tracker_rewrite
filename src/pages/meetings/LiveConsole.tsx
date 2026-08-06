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
 * 1. Role guard (packet Forbidden Files note) -- reachability is NOT a gap
 *    here (see below); only the role restriction needs this component's own
 *    nested guard.
 * -----------------------------------------------------------------------
 *
 * `src/app/router.tsx` (forbidden to edit, "import-only" per this task's
 * packet) wires `/meetings/live/:sessionId` (`:225`, element at `:228`) with
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
 * That same route's `element` (`:225`/`:228`) genuinely imports and renders
 * THIS file's default export (T074 wired it; `router.tsx:124` lazy-imports
 * it) -- this component is actually reachable at `/meetings/live/:sessionId`
 * in the running app; there is no reachability gap to disclose here. An
 * earlier draft of this comment (superseded) claimed router.tsx still
 * rendered an inline placeholder at this route; that was stale even before
 * T134 and has been corrected.
 *
 * T134 (UXC-12): until this task, this route rendered inside the full app
 * chrome (`AppShell.tsx`'s chromeless check only matched exact static
 * paths, never a parameterised route) even though PRD 7.1/4.2 describe this
 * page as a fullscreen projection surface. `AppShell.tsx` now pattern-matches
 * this route (via `matchPath`) into its chromeless set, so this page renders
 * with no top nav / side nav / KPI strip, same as `/login`/`/accept-invite`.
 * That also means this page no longer inherits `SeasonProvider` or
 * `role="main"`/skip-link from the chrome (see `AppShell.tsx`'s own module
 * doc, and T134's worker output for the recorded reasoning) -- this
 * component does not consume `useActiveSeason()`, so the lost provider
 * changes nothing this file relies on. T134 also made this file's `<h1>`
 * (section 9's `Heading` bullet) unconditional across all three DES-12
 * states, since the chrome's own landmarks/heading structure are gone and
 * this page previously had no heading at all in its loading/error states.
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * `admin | coach | student | parent` vocabulary exactly (fixed by T073a;
 * previously a stale `'admin' | 'staff' | 'volunteer' | 'coach'`
 * placeholder -- the same recurring gap `RosterShell.tsx`/`MeetingsList.tsx`
 * already flagged, now likewise resolved). `allowedRoles={['coach',
 * 'admin']}` below continues to read correctly.
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
 * identical treatment `Kiosk.tsx` established: a real `QRCodeSVG`-rendered QR
 * + real short-code display, wired against an injectable `loadDisplayToken`
 * seam.
 *
 * **T403 step 1 CLOSED THIS GAP.** The paragraph above describes the state
 * when T033 shipped, and step 7's "there is still no endpoint anywhere in this
 * repo that MINTS one" has been false since T103, which added the
 * `checkin-token` Edge Function. `loadDisplayToken` now defaults to
 * `loadKioskDisplayToken` (`../../lib/supabase/loaders/kiosk.ts`) -- the same
 * real loader `Kiosk.tsx` uses -- so this panel shows the genuine token and
 * short code that T032's `/checkin` verifies. The fixture constants, their
 * loader, and the "aren't live yet" `Banner` are all deleted rather than kept
 * as a fallback: a fallback is how a fixture reaches a live route, which is
 * the defect family this console was itself an instance of.
 *
 * The same "missing wiring, not fabricated" treatment `Kiosk.tsx`'s GAP #2
 * established for ITS live tally applies here to BOTH this console's live
 * roster/attendance data and its Realtime subscription (section 3 below).
 * T071 shipped a real shared Supabase client (`src/lib/supabase/client.ts`,
 * `getSupabaseClient`/`createClient`) -- the client itself is no longer
 * missing -- but nothing in this file calls it: no Realtime channel
 * subscription exists here yet, so roster/attendance changes made on this
 * screen do not sync live to other tabs or devices. Disclosed via a second
 * permanent Banner.
 *
 * T403 step 2 narrows that gap: `loadData`'s default is now the REAL
 * `loadLiveConsoleData` (`../../lib/supabase/loaders/kiosk.ts`) and the roster
 * fixtures are deleted, so this console reads the actual roster and the actual
 * `attendance` rows.
 *
 * T403 step 3 closes the write side: `onSetAttendanceStatus`'s default is now
 * `defaultSetAttendanceStatus` (below), a real write through
 * `../../lib/supabase/loaders/attendance.ts`'s `setAttendanceStatus`
 * (`makeSetAttendanceStatus`) -- the parallel-upsert fix that file's own
 * module doc #5 records, which deliberately never sends `hours_override` so a
 * coach's roll-call click cannot null out a manual hours correction (Trap 1,
 * this task's premise gate, confirmed on a real database). The old
 * `notWiredSetAttendanceStatus` no-op is deleted, not kept as a fallback --
 * with the roster/attendance now real (step 2), a no-op write silently
 * discards every change a coach makes during an actual meeting, which is
 * worse than the console not existing. What remains honestly unwired is only
 * the Realtime subscription, whose Banner stays accurate.
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
 * 4. LAST WRITE WINS (supersedes MTG-11 precedence) + MTG-12 excused gating.
 * -----------------------------------------------------------------------
 *
 * **This section previously described MTG-11's coach-override precedence and
 * a local-vs-wire `method` split. Both are GONE.** Owner ruling 2026-08-02,
 * recorded verbatim in `docs/swarm/auto-mode-decisions.md` under *"George's
 * ruling on MTG-11: LAST WRITE WINS, overturning coach precedence"*; the
 * struck PRD clause is annotated at `VOLT_Portal_PRD.md:307`. Cite that
 * ruling, never this paragraph.
 *
 * **The rule now:** whichever write happened last is what the row shows and
 * what the database records. No precedence, no merge, no arbitration. A
 * coach's tap overwrites an earlier QR value; an incoming QR scan overwrites
 * an earlier coach value.
 *
 * **The case that broke the old rule** (the owner's own): a coach marks a
 * student `absent` before they arrive; the student turns up late and scans
 * the kiosk. Coach-precedence discarded that scan and left the student
 * `absent` while standing in the room.
 *
 * **`method` means "who set the value that is there now"** -- NOT "how did
 * this student physically check in". There is deliberately no second field, so
 * a row can never claim `method: 'qr'` while naming a coach in `recorded_by`
 * ("so we do not have a mixmatching on the record"). A coach tap therefore
 * writes `'coach'` on the wire AND locally -- one value, no split.
 *
 * This also restores agreement with `VOLT_Portal_PRD.md:307`'s FIRST clause,
 * which always said a coach tap upserts `method='coach'`. T403 step 3's
 * packet asserted the opposite (acceptance criterion 3, "preserve qr/import
 * provenance"); that criterion was taken from `resolveAttendanceWriteMethod`'s
 * docstring and never checked against the requirement. **It was wrong**, and
 * `resolveAttendanceWriteMethod` is consequently NOT called from this file.
 * That function still implements the other meaning for W2's
 * `AttendancePanel`/`MarkDayCompleteDialog` and is untouched here.
 *
 * **⚠️ THIS RULING IS SCOPED TO THIS FILE, DELIBERATELY. DO NOT UNIFY IT.**
 * The owner ruled 2026-08-02 (`auto-mode-decisions.md`, *"LAST WRITE WINS
 * applies to `LiveConsole` ONLY, not table-wide"*) that it does NOT extend to
 * `resolveAttendanceWriteMethod` or to W2's screens. So `attendance.method`
 * genuinely means two different things depending on which screen wrote the
 * row: a coach edit to a student who scanned in records `'coach'` here and
 * leaves `'qr'` there.
 *
 * **That divergence is intentional, not an inconsistency bug.** A future
 * session will find it and be tempted to "fix" it; doing so requires a NEW
 * owner decision, cited — this ruling is the opposite. The reasoning: "who set
 * this value" is the useful fact during roll call, while outreach events carry
 * volunteer hours where "how did this student originally arrive" may matter
 * differently. W1 does not know W2's feature well enough to decide for it, and
 * the owner declined to force the question.
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
 * silently pretending to be live. The component applies this seam's `onChange`
 * event directly to local state (last write wins -- section 4; the old
 * `mergeAttendanceUpdate` precedence rule is DELETED) inside a `useEffect`
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
 * 8. "End meeting" (T196: the real `EndMeetingDialog.tsx`, T036, mounted).
 * -----------------------------------------------------------------------
 *
 * The header's "End meeting" `Button` used to disclose a dismissable stub
 * `Banner` ("End-meeting summary not built yet"); that stub, its
 * `StubNotice`/`StubBanner` local types, and the `endMeetingStub` state slot
 * are all deleted now that T196 mounts the real `EndMeetingDialog` (T036) in
 * their place, wired to the real `loadEndMeetingSummary`/`onEndMeeting`
 * backends (`../../lib/supabase/loaders/endMeeting`, T178) via the
 * `loadEndMeetingSummary`/`onEndMeeting`/`onEditAttendance` seams on
 * `LiveConsoleBodyProps` below. Owner ruling 2026-08-04 (T196 packet section
 * 3): post-completion, ONLY this console's own roster/check-in panel render
 * -- the dialog's own post-completion attendance-correction list is
 * suppressed via `hasAttendanceCorrections={false}` (an `EndMeetingDialog`
 * prop, default `true`, so the dialog's standalone/T036 behavior is
 * unchanged), because two unsynchronised write paths editing the same
 * student produced a duplicate, contradictory-status row when both rendered
 * at once. The dialog's own "This meeting has ended" banner still renders.
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
 *    title, then two sibling h2s: "Check-in" and "Roster"). T134 (UXC-12):
 *    the `<h1>` is now unconditional across all three DES-12 states
 *    (previously only rendered in the `session !== null` branch, leaving
 *    loading/error with no heading at all -- newly a real gap once the
 *    chrome's own landmarks/heading structure disappeared on this now-
 *    chromeless route). Its text falls back to
 *    `FALLBACK_SESSION_TITLE = 'Meeting Check-In'` when `session` is `null`,
 *    mirroring `Kiosk.tsx`'s own `sessionTitle?.title ?? FALLBACK_SESSION_TITLE`
 *    in-repo precedent rather than inventing new fallback copy.
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
 *  - `Skeleton` (T081): `astryx-api.md` lines 621-655. `width`, `height`,
 *    `index` used to preview this screen's predictable roster-list-row
 *    shape (`RosterRow`/`ListItem`), replacing `Spinner`'s prior use here
 *    per Astryx's own guidance (known-dimension content). `VisuallyHidden`
 *    + the wrapping `VStack`'s `aria-busy` carry the "Loading roster…"
 *    announcement `Spinner`'s `label` used to provide.
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
  useCallback,
  useEffect,
  useId,
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
  Skeleton,
  StatusDot,
  Text,
  TextInput,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import { RequireRole, useAuth } from '../../app/guards';
import { routePaths } from '../../app/router';
import {
  makeLoadEndMeetingSummary,
  makeOnEditAttendance,
  makeOnEndMeeting,
} from '../../lib/supabase/loaders/endMeeting';
import { loadKioskDisplayToken, loadLiveConsoleData } from '../../lib/supabase/loaders/kiosk';
import {
  setAttendanceStatus,
  type SetAttendanceStatusFn as LoaderSetAttendanceStatusFn,
} from '../../lib/supabase/loaders/attendance';
import {
  EndMeetingDialog,
  type LoadEndMeetingSummaryFn,
  type OnEditAttendanceFn,
  type OnEndMeetingFn,
} from './EndMeetingDialog';

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
export type AttendanceMethod = 'qr' | 'coach' | 'import' | 'self';

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

/* T403 step 1: this file's own `buildCheckinUrl` is DELETED. It was a
 * deliberate duplicate of `Kiosk.tsx`'s — the module doc above records that it
 * was "re-implemented independently below rather than imported" only because
 * `Kiosk.tsx` was a forbidden file for T033. Its sole caller was the fixture
 * loader, and `loaders/kiosk.ts:134` already imports the real one from
 * `Kiosk.tsx`, so the QR payload's URL shape now has exactly one definition
 * again instead of two that could drift. */

const QR_REFRESH_INTERVAL_MS = 45_000; // PRD MTG-06's ~45s client display refresh.

export interface LiveConsoleDisplayToken {
  qrUrl: string;
  shortCode: string;
}
export type LoadLiveConsoleDisplayTokenFn = (
  sessionId: string,
) => Promise<LiveConsoleDisplayToken | null>;

/**
 * T403 step 1: `FIXTURE_QR_TOKEN` / `FIXTURE_SHORT_CODE` and their loader are
 * DELETED, not kept alongside the real one.
 *
 * `loadKioskDisplayToken` (`../../lib/supabase/loaders/kiosk.ts`) already
 * calls the deployed `checkin-token` Edge Function and returns the same real
 * HMAC token and 6-character short code `Kiosk.tsx` displays and T032's
 * `/checkin` function verifies. It has been real since T103; this console
 * simply never used it.
 *
 * `KioskDisplayToken` is a structural superset of `LiveConsoleDisplayToken`
 * (it adds `refreshesInSeconds`), so it satisfies this seam directly — no
 * adapter, no re-derivation of the token math, which lives in exactly one
 * place (`supabase/functions/checkin/hmac.ts`) and must stay there.
 *
 * Deleting the fixtures rather than leaving them as a fallback is deliberate:
 * a fallback is how a fixture reaches a live route, which is the family that
 * produced T155/T176/T181/T324 and this console itself.
 */

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

/**
 * Shipped default -- T403 step 3 (module doc section 2). Rejects BEFORE any
 * network call when no signed-in coach identity is available (Trap 5),
 * mirroring `makeOnEditAttendance`'s precondition-check-then-reject shape
 * (`../../lib/supabase/loaders/endMeeting.ts:447-473`, read-only reference --
 * that file itself is Forbidden Files for this task). Otherwise delegates to
 * the real `setAttendanceStatus` loader
 * (`../../lib/supabase/loaders/attendance.ts`), whose payload deliberately
 * omits `hours_override` (that file's module doc #5 -- Trap 1's fix) so a
 * roll-call status change can never null out a coach's earlier manual hours
 * correction.
 *
 * T403 step 3 REWORK (checker MAJOR-2). This adapter maps positional seam
 * arguments onto the loader's named params, and it previously closed over the
 * module-level `setAttendanceStatus` with **no injection point** — so nothing
 * could stub the loader and the mapping itself was untested. A mutation that
 * swapped `sessionId`/`studentId` and hardcoded `status`/`method` passed the
 * FULL suite at exit 0: the fifth such mutation in this project's history, and
 * the reason this factory exists.
 *
 * The lesson, stated once here because it keeps recurring: **a boundary that
 * cannot be stubbed cannot be tested, and an untestable boundary is exactly
 * where a false green lives.** Both proven halves either side of it —
 * `makeSetAttendanceStatus`'s payload and `LiveConsoleBody`'s coach action —
 * were individually verified while the join between them was not.
 */
export function makeDefaultSetAttendanceStatus(
  write: LoaderSetAttendanceStatusFn = setAttendanceStatus,
): SetAttendanceStatusFn {
  return async (
    sessionId: string,
    studentId: string,
    status: AttendanceStatus,
    method: AttendanceMethod,
    recordedBy: string | null,
  ): Promise<void> => {
    // Trap 5 -- reject BEFORE any client call when no acting-coach identity is
    // resolved, the same precondition shape `makeOnEditAttendance` uses.
    if (recordedBy === null) {
      throw new Error('No signed-in coach identity is available to record this attendance change.');
    }
    await write({ sessionId, studentId, status, method, recordedBy });
  };
}

/** `LiveConsoleBody`'s own default `onSetAttendanceStatus` -- real write. */
export const defaultSetAttendanceStatus: SetAttendanceStatusFn = makeDefaultSetAttendanceStatus();

/** T196: the REAL end-meeting backends, same module-level-factory posture
 * `defaultSetAttendanceStatus` above already established. */
export const defaultLoadEndMeetingSummary: LoadEndMeetingSummaryFn = makeLoadEndMeetingSummary();
export const defaultOnEndMeeting: OnEndMeetingFn = makeOnEndMeeting();

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

/**
 * T403 step 2: `FIXTURE_ROSTER`, `FIXTURE_ATTENDANCE`,
 * `FIXTURE_SESSION_ID_FALLBACK` and `defaultLoadLiveConsoleData` are DELETED,
 * not kept as a fallback.
 *
 * They fabricated seven students ("Ada Q.", "Bea R.", …) and five attendance
 * rows on a LIVE coach-facing route, so a real meeting showed a roster nobody
 * on this team has ever been on. `loadLiveConsoleData`
 * (`../../lib/supabase/loaders/kiosk.ts`) now resolves the real
 * `event_sessions` → `events` → team-scoped active `students` roster and the
 * real `attendance` rows for the session.
 *
 * Keeping them as a fallback is exactly how a fixture reaches a live route —
 * the family that produced T155/T176/T181/T324 and this console. A test that
 * wants a deterministic roster injects one through the `loadData` seam and
 * says so (`LiveConsole.test.tsx`'s own `TEST_ROSTER`/`stubLoadData`), the
 * discipline T151 established and T403 step 1 applied to the QR panel.
 */

// ---------------------------------------------------------------------------
// Pure helpers -- exported for direct testing (module doc sections 3/4).
// ---------------------------------------------------------------------------

/**
 * MTG-11's coach-precedence rule is SUPERSEDED — **last write wins.** Owner
 * ruling 2026-08-02, recorded verbatim in `docs/swarm/auto-mode-decisions.md`
 * under *"George's ruling on MTG-11: LAST WRITE WINS, overturning coach
 * precedence"*; `VOLT_Portal_PRD.md:307` carries the struck clause and points
 * at that ruling.
 *
 * `mergeAttendanceUpdate` is **DELETED**, not reduced to `return incoming`.
 * Under this rule there is no merge to perform, and a function that ignores its
 * `existing` argument would be a seam implying a decision that no longer
 * exists — the same dishonesty as a fixture kept "just as a fallback". Both
 * former call sites now apply the incoming record directly.
 *
 * The case that broke the old rule: a coach marks a student absent before they
 * arrive; the student turns up late and scans the kiosk. Coach-precedence
 * discarded that scan and left the student `absent` while standing in the room.
 *
 * **Known limit, disclosed rather than solved:** "last" means *last applied* —
 * arrival order, not a timestamp comparison. `attendance.updated_at` is not
 * trustworthy for ordering (T405: the database never bumps it on
 * conflict-update), so there is nothing reliable to sort by. This is moot today
 * because the Realtime seam is still an honest no-op
 * (`notWiredSubscribeToAttendanceChanges`); it becomes real when Realtime does,
 * and should be revisited then rather than pre-solved now.
 */

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
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the caller-supplied `deps` semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list; `retryToken` is an additional internal trigger.
  }, [...deps, retryToken]);

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
      {/* T403 step 1: the "aren't live yet" Banner that used to sit here is
          deleted, not reworded. `loadDisplayToken` now defaults to the real
          `loadKioskDisplayToken`, so the code on screen is the same HMAC
          token/short code the kiosk shows and `/checkin` accepts. Leaving the
          warning would be the same defect in the opposite direction: honest
          copy about dishonest data is the point, and dishonest copy about
          honest data is just as wrong. */}
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

/** T134 (UXC-12, module doc section 9's `Heading` bullet): fallback `<h1>`
 * text for the loading/error states, where `session` is `null`. Mirrors
 * `Kiosk.tsx`'s own `FALLBACK_SESSION_TITLE` in-repo precedent rather than
 * inventing new copy. */
const FALLBACK_SESSION_TITLE = 'Meeting Check-In';

export interface LiveConsoleBodyProps {
  loadData?: LoadLiveConsoleDataFn;
  loadDisplayToken?: LoadLiveConsoleDisplayTokenFn;
  onSetAttendanceStatus?: SetAttendanceStatusFn;
  subscribeToAttendanceChanges?: SubscribeToAttendanceChangesFn;
  /** T196 seams for the mounted `EndMeetingDialog`. */
  loadEndMeetingSummary?: LoadEndMeetingSummaryFn;
  onEndMeeting?: OnEndMeetingFn;
  onEditAttendance?: OnEditAttendanceFn;
}

export function LiveConsoleBody({
  loadData = loadLiveConsoleData,
  loadDisplayToken = loadKioskDisplayToken,
  onSetAttendanceStatus = defaultSetAttendanceStatus,
  subscribeToAttendanceChanges = notWiredSubscribeToAttendanceChanges,
  loadEndMeetingSummary = defaultLoadEndMeetingSummary,
  onEndMeeting = defaultOnEndMeeting,
  onEditAttendance: injectedOnEditAttendance,
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
  // T403 step 3, Trap 3 -- a rejected `onSetAttendanceStatus` write must be
  // visible to the coach, not silently swallowed (see `handleSetStatus`
  // below). Holds the display name of the student whose write just failed;
  // `null` means no error banner is showing. Only the most recent failure is
  // shown, same "one slot" convention `endMeetingStub` above already uses.
  const [attendanceWriteError, setAttendanceWriteError] = useState<string | null>(null);
  // NFR-06 fix (T072): QR visible by default -- pure addition of a collapse
  // affordance so a coach on a phone can reclaim screen space for the
  // roster. `{showQr && <QrPanel .../>}` below genuinely un/mounts the
  // panel (not CSS-only hiding), matching this app's `AlertDialog`-style
  // "hidden means removed from the accessible DOM" convention.
  const [showQr, setShowQr] = useState(true);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  // T129/UXC-01: stable id for the "Roster" `Heading`, so the alternating
  // List/EmptyState below gets the heading as its accessible name via
  // `aria-labelledby` on a wrapping `<div role="group">`, instead of the
  // `List`'s own `header` prop (which duplicates the visible title and
  // vanishes in the empty branch). CHECKER FIX (rework of T129, MAJOR): see
  // `CoachHome.tsx`'s own module doc for why the wrapper is a plain
  // `<div role="group">`, not `Section` (full-bleed margin + no nameable
  // role).
  const rosterHeadingId = useId();

  // T196 section 4 -- the identity trap. `makeOnEditAttendance` calls
  // `getRecordedBy` FRESH on every invocation, so this accessor must track
  // `user` rather than bake the first render's value.
  const getRecordedBy = useCallback(() => user?.id ?? null, [user]);
  const builtOnEditAttendance = useMemo(() => makeOnEditAttendance(getRecordedBy), [getRecordedBy]);
  const onEditAttendance = injectedOnEditAttendance ?? builtOnEditAttendance;

  useEffect(() => {
    if (loadState.status === 'success') {
      setSession(loadState.data.session);
      setRoster(loadState.data.roster);
      setAttendanceByStudentId(loadState.data.attendance);
    }
  }, [loadState]);

  const displayToken = useLiveConsoleDisplayToken(sessionId, loadDisplayToken);

  // NFR-05 -- module doc section 5. Applies the injectable Realtime seam's
  // `onChange` event under the same rule the coach's own writes use: LAST
  // WRITE WINS (owner ruling 2026-08-02). There is no precedence check here
  // and there must not be one -- that is what lets a late scanner correct a
  // coach's earlier `absent`.
  useEffect(() => {
    const unsubscribe = subscribeToAttendanceChanges(sessionId, (event) => {
      // Last write wins (owner ruling 2026-08-02 — see the note where
      // `mergeAttendanceUpdate` was deleted). An incoming Realtime change is
      // applied unconditionally, including over a value a coach just set:
      // that is the whole point of the ruling, and it is what lets a student
      // who scans in late correct a coach's earlier `absent`.
      setAttendanceByStudentId((prev) => ({
        ...prev,
        [event.studentId]: {
          status: event.status,
          method: event.method,
          recordedBy: event.recordedBy,
          updatedAt: event.updatedAt,
        },
      }));
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
    const recordedBy = user?.id ?? null;
    // T403 step 3 REWORK -- `resolveAttendanceWriteMethod` is deliberately NOT
    // called here, and the wire/local method split the worker packet's section
    // 4c prescribed is GONE. Both are consequences of the same owner ruling
    // (2026-08-02, `auto-mode-decisions.md`, "George's ruling on MTG-11: LAST
    // WRITE WINS"): `method` records WHO SET THE VALUE THAT IS THERE NOW, not
    // how the student physically checked in. A coach tap is therefore always
    // `'coach'` on the wire and in local state -- one value, no split, so a row
    // can never claim `method: 'qr'` while naming a coach in `recorded_by`.
    //
    // This also matches `VOLT_Portal_PRD.md:307`'s FIRST clause, which always
    // said a coach tap upserts `method='coach'`. The packet's acceptance
    // criterion 3 ("preserve qr/import provenance") contradicted the PRD; it
    // was taken from `resolveAttendanceWriteMethod`'s docstring and never
    // checked against the requirement. `resolveAttendanceWriteMethod` still
    // implements the other meaning for W2's screens and is untouched here.
    const incoming: AttendanceRecordState = {
      status,
      method: 'coach',
      recordedBy,
      updatedAt: new Date().toISOString(),
    };
    // T403 step 3 -- `previousRecord`/`hadPreviousRecord` are captured
    // INSIDE this functional updater, not read from the `attendanceByStudentId`
    // render-scope variable above, so a rollback (below, in `.catch()`) is
    // correct even across rapid clicks on the same row: the updater always
    // receives the true, currently-queued `prev`, not a value that may
    // already be stale by the time a later click's rollback needs it.
    let previousRecord: AttendanceRecordState | null = null;
    let hadPreviousRecord = false;
    setAttendanceByStudentId((prev) => {
      hadPreviousRecord = studentId in prev;
      previousRecord = prev[studentId] ?? null;
      // Last write wins -- this action IS the last write, so it is applied
      // unconditionally (owner ruling; see the note where
      // `mergeAttendanceUpdate` was deleted).
      return { ...prev, [studentId]: incoming };
    });
    onSetAttendanceStatus(sessionId, studentId, status, 'coach', recordedBy).catch(() => {
      // T403 step 3, Trap 3 -- a rejected write must not leave the console
      // silently asserting a status that was never persisted (constitution
      // item 26's "lie to a user about their own data" HEAVY trigger). Roll
      // back the optimistic update to whatever was on screen immediately
      // before THIS action (deleting the key if there was no prior record at
      // all), and surface a dismissable, student-named error.
      setAttendanceByStudentId((prev) => {
        if (!hadPreviousRecord) {
          if (!(studentId in prev)) return prev;
          const next = { ...prev };
          delete next[studentId];
          return next;
        }
        return { ...prev, [studentId]: previousRecord as AttendanceRecordState };
      });
      const studentName =
        roster.find((entry) => entry.studentId === studentId)?.name ?? 'this student';
      setAttendanceWriteError(studentName);
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

  return (
    <VStack gap={6} padding={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <HStack gap={2} vAlign="center">
          <Icon icon="chevronLeft" size="sm" />
          <Link as={RouterLink} href={routePaths.meetings}>
            Back to meetings
          </Link>
        </HStack>
        <VStack gap={0} hAlign="center">
          {/* T134 (UXC-12, module doc section 9): unconditional across all
              three DES-12 states -- previously only rendered when
              `session !== null`, leaving loading/error with no `<h1>` at
              all anywhere on the page. */}
          <Heading level={1}>{session?.title ?? FALLBACK_SESSION_TITLE}</Heading>
          {session !== null && (
            <Text type="supporting">
              {formatSessionTimeRange(session.startsAt, session.endsAt)}
            </Text>
          )}
        </VStack>
        <EndMeetingDialog
          sessionId={sessionId}
          loadSummary={loadEndMeetingSummary}
          onEndMeeting={onEndMeeting}
          onEditAttendance={onEditAttendance}
          hasAttendanceCorrections={false}
        />
      </HStack>

      {/* T403 step 3, Trap 3 -- a rejected `onSetAttendanceStatus` write is
          visible here, by rendered text, naming the affected student. See
          `handleSetStatus`'s rollback + this Banner's DES-16-style "what
          happened" copy. */}
      {attendanceWriteError !== null && (
        <Banner
          status="error"
          title="Attendance not saved"
          description={`${attendanceWriteError}'s attendance change couldn't be saved. Check your connection and try again.`}
          isDismissable
          onDismiss={() => setAttendanceWriteError(null)}
        />
      )}

      <Banner
        status="warning"
        title="Attendance updates aren't shared live yet"
        description="Changes made here only show up in this browser tab. Other coaches, and the check-in kiosk, won't see them update in real time yet."
      />

      {loadState.status === 'loading' && (
        <VStack gap={2} aria-busy="true">
          <VisuallyHidden as="div" role="status">
            Loading roster...
          </VisuallyHidden>
          {[0, 1, 2, 3, 4].map((row) => (
            <HStack key={row} hAlign="between" vAlign="center" gap={4}>
              <HStack gap={2} vAlign="center">
                <Skeleton width={16} height={16} radius="rounded" index={row * 3} />
                <Skeleton width={140} height={16} index={row * 3 + 1} />
              </HStack>
              <Skeleton width={160} height={28} index={row * 3 + 2} />
            </HStack>
          ))}
        </VStack>
      )}

      {loadState.status === 'error' && (
        <Banner
          status="error"
          title="Couldn't load this session"
          description="Something went wrong loading the roster for this session. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      )}

      {loadState.status === 'success' && roster.length === 0 && (
        <EmptyState
          headingLevel={2}
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
                <Heading level={2} id={rosterHeadingId}>
                  Roster
                </Heading>
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

              <div role="group" aria-labelledby={rosterHeadingId}>
                {filteredRoster.length === 0 ? (
                  <EmptyState
                    title="No students match your search"
                    description="Try a different name or clear the search box."
                  />
                ) : (
                  <List hasDividers>
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
              </div>
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
