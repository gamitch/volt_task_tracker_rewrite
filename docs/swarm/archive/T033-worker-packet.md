# Worker Packet: T033

## Task ID
T033

## Objective
Build `src/pages/meetings/LiveConsole.tsx` — the coach's live attendance console
(`/meetings/live/:sessionId`, MTG-05). Two-pane layout per the PRD 4.2 wireframe: QR panel (left)
+ live roster (right, one `Item` row per student with a roll-call `SegmentedControl`
[Present|Late|Excused|Absent], MTG-11). Coach-only excused (MTG-12). A Realtime subscription on
`attendance` for this session (NFR-05, ≤2s update). This is the single most operationally critical
screen in the app — a coach uses this during an actual meeting to take attendance in real time.

## Dependencies (status)
- T031 (Schedule meetings dialog) — Passed. Not directly consumed, but confirms the session-scheduling
  data model this console reads from.
- T032 (`checkin` Edge Function) — Passed. **Read `supabase/functions/checkin/hmac.ts` in full
  (read-only)** — this console's QR panel must reuse the exact same rotating-token/short-code scheme
  T034's `Kiosk.tsx` already built against (bucket=floor(unixSeconds/60), HMAC-SHA256 first 16 bytes
  hex, short code = bytes[16..22) mod-34-mapped). **Read `src/pages/meetings/Kiosk.tsx` in full
  (read-only, already-Passed)** — it already solved the identical "no token-minting endpoint exists,
  no shared Supabase client exists" problem for a QR panel; match its established pattern (injectable
  loader seam with obviously-fake fixture default, disclosure banner) for this console's QR panel
  rather than re-solving it differently. Do not duplicate `Kiosk.tsx`'s file, just its *pattern*.

## Allowed Files
- `src/pages/meetings/LiveConsole.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `LiveConsole.test.tsx` is acceptable per established precedent (same reasoning as
  every prior single-file-Allowed-Files content-page task in this batch) — disclose it, don't ask
  permission.

## Forbidden Files
- `src/pages/meetings/Kiosk.tsx`, `MeetingsList.tsx`, `ScheduleMeetingsDialog.tsx`,
  `StudentMeetingView.tsx` — already-Passed sibling tasks' files, **read-only**.
- `src/pages/meetings/EndMeetingDialog.tsx` — a separate, currently-Ready-but-not-yet-dispatched
  task (T036). Render an obvious "End meeting" action that shows a disclosure Banner (same stub
  pattern used throughout this batch) rather than opening a real summary dialog.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only, do not edit) — `/meetings/live/:sessionId`
  is already wired (`RequireAuth` only, no role restriction at the route level — same gap pattern
  every prior content page has hit; gate coach/admin-only access at the component level using
  `useAuth()`, same as `RosterShell.tsx`/T021's established pattern).
- `src/lib/supabase/**` — read-only reference only, do not import directly. No page is wired to the
  real client yet (T071 deliberately left every consumer unwired). Build against injectable
  `loadData`/`onSetAttendanceStatus`-style seams with obviously-fake fixture defaults, same posture
  as every prior content page. **Exception**: you MAY reference `src/lib/supabase/**`'s real type
  shapes (`AttendanceRow`, etc.) read-only for typing your own fixtures, matching the convention
  `ParticipationTab.tsx`/T056 and others already established.
- `supabase/functions/checkin/**` — read-only reference for the HMAC scheme only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — PRD 4.2 wireframe (verbatim, reproduce this exact layout, do not invent a different one)
```
LIVE ATTENDANCE CONSOLE (/meetings/live/:sessionId, coach)
┌──────────────────────────────────────────────────────────────┐
│ ← Tuesday Build Meeting · 6:00–8:00 PM      [End meeting]    │
├────────────────────────────┬─────────────────────────────────┤
│  QR PANEL                  │  ROSTER  (search ⌕)  12/18 in   │
│  ┌──────────────┐          │  ● Ada Q.   [Present|Late|Exc|Ab]│
│  │   rotating   │ code:    │  ● Bea R.   [Present|Late|Exc|Ab]│
│  │      QR      │ 7 F 4 K 2 9  ○ Cy T.  [Present|Late|Exc|Ab]│
│  └──────────────┘          │  ...one Item row per student    │
│  [Open kiosk view ⤢]       │  (SegmentedControl per row)     │
└────────────────────────────┴─────────────────────────────────┘
```
Key elements: a back link + session title + time range + "End meeting" action in a header bar; a
two-pane body (QR panel left, roster right); the roster pane has a search box, a live "N/M in" tally,
and one row per student with a 4-option `SegmentedControl`; an "Open kiosk view" link/button in the
QR panel (may link to `/kiosk/:sessionId`, T034's already-Passed page — a plain link is fine, you are
not required to wire real navigation logic beyond what `react-router-dom`'s `Link` provides).

## Known Context / Traps

**1. DES-17 keyboard path is BLOCKER-class — this is the single highest-stakes requirement in this
task.** "Arrow through roster rows, 1–4 keys set Present/Late/Excused/Absent on the focused row."
This means: focus can move between roster rows via arrow keys (Up/Down), and while a row is focused,
pressing the literal keys `1`/`2`/`3`/`4` sets that row's status to Present/Late/Excused/Absent
respectively — WITHOUT requiring the user to tab into the `SegmentedControl` itself first. This is a
genuinely non-trivial keyboard-handling pattern (roving tabindex on rows + a global-to-the-row
keydown listener for the 1-4 shortcuts). Prove this works with a real, driven keyboard-event test —
not just documentation. A broken or missing keyboard path here is an automatic checker BLOCKER
finding per the packet's own acceptance line.

**2. MTG-11 coach-override precedence — must be provably correct, not just asserted.** A coach's
`SegmentedControl` tap upserts with `method='coach'`, `recorded_by=coach`, and this value must
**always win** over a QR-sourced write — meaning your injected `onSetAttendanceStatus`-style callback
contract (and your Realtime-event-application logic, see Trap #3) must never let an incoming
`method='qr'`-shaped update overwrite a row that's already `method='coach'`. Prove this with a real
test: set a row to coach-Present, then simulate an incoming Realtime event claiming a QR check-in for
the same student, and assert the row stays coach-Present, unchanged.

**3. MTG-12 — only coach/admin may set `excused`.** If a non-coach/admin role somehow reaches this
console (shouldn't happen given the route-level gate, but the console's own `SegmentedControl` should
not expose a functioning "Excused" option to any role other than coach/admin as defense in depth).
Since this console is coach/admin-only by design, this is mostly about making sure your role-check
logic (component-level `RequireRole`-equivalent gate, per Forbidden Files' router-gap note) is
genuinely present, not skipped because "the route already handles it."

**4. NFR-05 — Realtime subscription semantics, ≤2s update, but no real Supabase client exists yet.**
You cannot build a real `supabase.channel(...).on('postgres_changes', ...)` subscription (no shared
client wired in). Instead: design a real, typed subscription **interface** (e.g.
`subscribeToAttendanceChanges(sessionId, onChange): () => void`) with an injectable default
implementation that's obviously a no-op/fixture-driven stand-in — and prove your row-update logic
correctly and quickly reflects an incoming change when the callback fires (simulate calling the
`onChange` callback directly in a test with a fabricated attendance-row event, assert the affected
row updates). This proves the *consumption* logic is correct even though the real *transport* isn't
wired in yet — same "prove what's provable, disclose what isn't" discipline `Kiosk.tsx`/T034 already
established for its own real-time-adjacent gaps.

**5. `aria-live="polite"` on the tally — same DES-17 requirement `Kiosk.tsx` already implemented for
its own tally.** Cite that established pattern.

**6. QR panel reuses T032's exact HMAC/short-code scheme — do not invent a different one.** Same
citation discipline `Kiosk.tsx` already established: reproduce the bucket/token/short-code/URL
derivation in your own module doc, sourced from `hmac.ts` directly, not copied from this packet.
Same two architecture gaps `Kiosk.tsx` already flagged (no token-minting endpoint, no shared
Supabase client) apply here too — don't re-litigate them, just cite `Kiosk.tsx`'s established
disclosure pattern and apply the same honest-fixture-plus-disclosure-banner treatment.

**7. Search box in the roster pane** — a real, working client-side filter over the fixture roster
(name-substring match is sufficient; no need for a `PowerSearch` config unless you judge one fits
better — your call, disclose it).

**8. "End meeting" stub** — per Forbidden Files, `EndMeetingDialog.tsx` is out of scope. Show a
disclosure Banner, same pattern as every other out-of-scope action stubbed throughout this batch.

## Acceptance Criteria
- **BLOCKER-class (DES-17):** full keyboard path works and is proven with a real test — arrow-key
  row navigation, 1-4 keys set status on the focused row without requiring `SegmentedControl` focus.
- Two-pane layout matches the PRD 4.2 wireframe: header (back link, title, time range, End meeting),
  QR panel left, roster (search + tally + rows) right.
- MTG-11 coach-override precedence proven correct via a real test (coach value survives a subsequent
  simulated QR-sourced update).
- MTG-12 — excused option only meaningfully available under a coach/admin gate.
- `aria-live="polite"` on the live tally.
- Realtime-consumption logic (not the real transport) proven correct via a simulated incoming-change
  test.
- QR/short-code scheme matches T032's `hmac.ts` exactly, cited verbatim in the module doc.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> DES-17 / NFR-07: WCAG 2.1 AA, full keyboard path for every flow including the roll-call console —
> BLOCKER if broken (per this task's own ledger Acceptance line).

> 5. No secrets in the frontend bundle — `CHECKIN_HMAC_SECRET` must never appear in `src/`.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T033 (attempt count: 0).

## Required Worker Output
- Full contents of `LiveConsole.tsx`.
- Real, driven keyboard-event test proof of the full DES-17 path (arrow navigation + 1-4 shortcuts).
- Real test proof of MTG-11 coach-override precedence surviving a simulated incoming QR update.
- Real test proof of the Realtime-consumption logic reacting correctly to a simulated incoming
  change event.
- Re-derivation of the HMAC/QR scheme cited directly from `hmac.ts` (file + line), matching
  `Kiosk.tsx`'s established citation discipline.
- Astryx prop citations for every component used (`SegmentedControl`, `Item`/`List`, `PowerSearch`
  or your own search input, `Badge`, `Banner` — grep `astryx-api.md` yourself, don't guess).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
