# Checker Packet: T033 (Live attendance console) — Check Attempt 1

## Task ID
T033 — Live console `/meetings/live/:sessionId` (MTG-05), Epic E5. **The single most operationally
critical screen in the app** — a coach uses this during an actual meeting to take real-time
attendance.

## Checker Agent
checker-accessibility (per task-ledger.md T033 row).

## Objective
Verify a two-pane live attendance console with a genuinely working, BLOCKER-class DES-17 keyboard
path (arrow-navigate roster rows, 1-4 keys set status on the focused row without requiring
`SegmentedControl` focus), provably correct MTG-11 coach-override-always-wins precedence, MTG-12's
coach/admin-only excused option, and an `aria-live="polite"` tally.

## Allowed Files (worker's literal permitted edit)
- `src/pages/meetings/LiveConsole.tsx` (new)

**Scope flag**: worker also created `LiveConsole.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`eca2d0a`) — do NOT
infer authorship from commit messages. Confirm `Kiosk.tsx`, `MeetingsList.tsx`,
`ScheduleMeetingsDialog.tsx`, `StudentMeetingView.tsx` (all already-Passed sibling tasks) are
byte-unchanged. Confirm `router.tsx`, `guards.tsx` only imported from (`routePaths`, `RequireRole`,
`useAuth`), never edited. Confirm `src/lib/supabase/**`, `supabase/functions/checkin/**` untouched.

## Worker's Claimed Changes (do not trust — verify independently, especially the keyboard path)
1. **DES-17 keyboard path (THE CENTRAL, BLOCKER-class CLAIM OF THIS CHECK)**: roving-tabindex roster
   rows (`ListItem` with `tabIndex`/`onKeyDown`/`onFocus`/`ref`, claimed to be real documented
   pass-through props via `BaseProps<HTMLLIElement>`). `ArrowUp`/`ArrowDown` claimed to move real DOM
   focus between rows. `1`/`2`/`3`/`4` claimed to set Present/Late/Excused/Absent on the currently
   *DOM-focused* row's student, bound on the row itself — explicitly claimed to NOT require focus to
   be inside the `SegmentedControl` first.
2. **MTG-11 precedence**: a single pure function `mergeAttendanceUpdate(existing, incoming)` — claims
   a `method: 'coach'` record is never overwritten by a non-coach incoming update, and this same
   function is used identically by both the coach-write path and the Realtime-consumption path (so
   there's only one place the precedence rule could be violated, not two divergent implementations).
3. **MTG-12**: `canSetExcused` computed inside an *ungated* `LiveConsoleBody` component (exported
   separately from the `RequireRole`-gated `LiveConsolePage` default export, specifically claimed to
   make this defense-in-depth logic directly testable). Claims the "Excused" `SegmentedControlItem`
   is not rendered at all, and the `3` keyboard shortcut no-ops, for non-coach/admin roles.
4. **NFR-05**: a typed `SubscribeToAttendanceChangesFn` interface with an honest no-op default;
   claims the component wires a real `onChange` consumer into `mergeAttendanceUpdate`, proven via a
   directly-invoked fabricated event in tests (not a real transport, but the consumption logic is
   claimed provable).
5. QR/short-code scheme claimed re-derived verbatim from `supabase/functions/checkin/hmac.ts`
   (cited file+line in the module doc), reusing `Kiosk.tsx`'s established fixture-plus-disclosure-
   banner pattern.
6. `aria-live="polite"` tally region claimed present (also `data-testid="attendance-tally"`).
7. Real client-side name-substring search via `TextInput` (not `PowerSearch`) — claims this choice
   is disclosed and reasoned in the module doc.
8. Claims 276/276 tests pass (31 new); typecheck/build/lint(scoped)/format(scoped) all exit 0.
   Claims `format:check`'s repo-wide failure is caused by two pre-existing, unrelated files
   (`renderEmailLayout.ts`, `Kiosk.tsx`) — claims this was verified via `git stash` showing the same
   failure exists on the base branch before this task's changes.

## Required Verification Steps
1. **Read `LiveConsole.tsx` and `LiveConsole.test.tsx` in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **THE DES-17 KEYBOARD PATH — this is a BLOCKER-class check per this task's own ledger Acceptance
   line. Do not accept the worker's test suite as sufficient proof without independently driving the
   interaction yourself, or at minimum reading the exact keydown-handling source line by line and
   confirming it is wired the way it's claimed to be.** Specifically confirm:
   - Focus can genuinely move between roster rows via `ArrowUp`/`ArrowDown` (read the `onKeyDown`
     handler and the `tabIndex`/roving-focus management logic directly — is this a real, working
     roving-tabindex implementation, or does it merely change some internal "selected" state without
     ever calling `.focus()` on the actual DOM element?).
   - Pressing `1`/`2`/`3`/`4` while a row has real DOM focus sets that row's status correctly, WITHOUT
     first requiring the user to Tab into the row's `SegmentedControl`. Trace exactly which DOM
     element the keydown listener is attached to and confirm it's the row itself (or a container that
     receives keydown events regardless of which row/element within it currently has focus), not
     something that would only fire if the `SegmentedControl` already had focus.
   - Confirm keyboard interaction doesn't silently break when a row is filtered out by the search box
     (i.e., arrow navigation among only the currently-visible/filtered rows, not stale indices into
     the full unfiltered list).
3. **MTG-11 precedence — re-derive independently.** Read `mergeAttendanceUpdate` yourself and confirm
   by source logic (not just the test) that a `method: 'coach'` record is structurally unable to be
   overwritten by any incoming non-coach update, for every code path that could apply an update
   (both the direct coach-click path and the Realtime-consumption path). Reproduce or independently
   write the "coach sets Present, then a simulated QR update arrives for the same student" test.
4. **MTG-12 — re-derive independently.** Read `canSetExcused` and confirm the "Excused" option is
   genuinely absent (not just disabled-but-present, which would be a lesser but still real
   accessibility/security concern) from the rendered `SegmentedControl` for non-coach/admin roles,
   and that the `3` keyboard shortcut correctly no-ops for those roles too (both surfaces must agree).
5. **Realtime-consumption logic — reproduce or independently verify** that directly invoking the
   `onChange` callback with a fabricated attendance-row event correctly and quickly updates the
   affected row via `mergeAttendanceUpdate`.
6. **HMAC/QR scheme — re-derive against `hmac.ts` yourself**, don't trust the citation.
7. **`aria-live="polite"` — confirm by direct source read** that it's on the correct tally element.
8. **`TextInput`-vs-`PowerSearch` choice** — read the worker's disclosed reasoning and render your
   own explicit verdict on whether it's defensible for this use case (a live-updating roster search
   during an active meeting has different UX needs than a static list's filter — judge accordingly).
9. **Astryx prop citations** — spot-check `List`/`ListItem` (confirm `tabIndex`/`onKeyDown`/`onFocus`/
   `ref` really are documented pass-through props via `BaseProps`, not fabricated), `SegmentedControl`,
   `StatusDot`, `TextInput`, `Banner` against `astryx-api.md`.
10. **Test-file scope question** — render an explicit verdict, independently re-derived.
11. **Re-run typecheck/lint/build/test yourself** — don't accept "276/276"/"exit 0" without your own
    run. Confirm the `format:check` baseline claim (reproduce the `git stash` comparison yourself or
    an equivalent check) is genuine.
12. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- DES-17 / NFR-07 (BLOCKER-class per this task's own ledger row): full keyboard path for the
  roll-call console. This is the single most important thing to get right in this entire check.
- Item 5: no secrets in the frontend bundle — `CHECKIN_HMAC_SECRET` must never appear in `src/`.
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase — for the keyboard path
  specifically, describe exactly what you traced/drove and what you observed)
- commands run
- exact findings
- **explicit, unambiguous verdict on whether the DES-17 keyboard path genuinely works** — this is
  the single most important line in your entire report
- explicit verdict on MTG-11 precedence correctness
- explicit verdict on MTG-12's coach/admin-only excused enforcement
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
