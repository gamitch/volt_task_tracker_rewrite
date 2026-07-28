# Checker Packet: T038 (`/outreach` list + season goal bar) — Check Attempt 1

## Task ID
T038 — `/outreach` list + season goal bar (OUT-01), Epic E6.

## Checker Agent
checker-accessibility (per task-ledger.md T038 row).

## Objective
Verify a two-role-variant outreach list page: coach (season goal bar with BEH-01 milestones,
Upcoming/Past sections, new-event action) and student/parent (own goal bar with BEH-02
confirmed/planned segments never summed, per-row RSVP control), all four DES-12 states, zero NAV-07
cross-contamination with meeting content, and correct handling of the SideNav-badge scope tension
the worker packet itself flagged in advance.

## Allowed Files (worker's literal permitted edit)
- `src/pages/outreach/OutreachList.tsx` (new)

**Scope flag**: worker also created `src/pages/outreach/OutreachList.test.tsx`, outside the literal
Allowed Files line — same disclosed pattern as T035's `CheckinResult.test.tsx` and T030's
`MeetingsList.test.tsx` (both already ruled in-scope by their respective checkers). Re-derive the
judgment yourself rather than just following precedent.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`7bcd31d`) — do NOT
infer authorship from commit messages. **Confirm `src/components/nav/SideNav.tsx` is byte-unchanged
— this is the single most important forbidden-file check in this packet**, since the worker's own
central design decision (see below) depended on correctly NOT touching this file. Also confirm
`router.tsx`, `guards.tsx`, `src/lib/supabase/**` are untouched.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Coach view**: season goal bar (two adjacent `ProgressBar`s sharing one `max` — accent for
   confirmed, neutral for planned, claims no summed-total prop exists on `ProgressBar` so this is
   the correct composition), BEH-01 milestone ticks (25/50/75/100%, computed from confirmed-only
   percentage) with a deduped `Toast` (localStorage key scoped to season AND goal-bar identity),
   Upcoming (`AvatarGroup` signup counts) / Past sections, "New outreach event" action (stub —
   disclosure Banner, T039 untouched).
2. **Student/parent view**: own goal bar (same confirmed/planned two-`ProgressBar` composition,
   claims zero `confirmedHours + plannedHours` expression exists anywhere in executable code — only
   in a doc comment stating it does NOT exist), per-row RSVP `SegmentedControl` (claims real local
   state update on click, immediately reflected in the goal bar and badge count; only the
   Supabase-persistence layer is stubbed, same posture as every prior content page).
3. **THE CENTRAL DESIGN DECISION — SideNav badge scope tension.** The worker packet itself
   pre-authorized this exact handling: worker did NOT edit `src/components/nav/SideNav.tsx`
   (forbidden), and instead exported a reusable `getUnansweredRsvpCount(sessions, rsvps,
   studentIds)` function ("unanswered" = upcoming `scheduled` session with zero `rsvps` row for
   that student; declined/maybe count as answered). Claims this is rendered live on the page itself
   (a neutral `Badge`, BEH-04) as proof it's correct, not an inert unused export — cites fixture
   values coach-roster=4, viewer-alone=1, both asserted in tests. Explicitly flagged as a dispute
   candidate for whoever is authorized to eventually wire `SideNav.tsx`.
4. **NAV-07 claim**: DOM-text proof shows meeting-shaped fixture content
   (`"Weekly Team Meeting"`/`"Clubhouse"`) never appears in either role variant's output.
5. **Real doc-gap found via installed-source cross-check**: claims `astryx-api.md`'s `Toast` Props
   table incorrectly lists `uniqueID`/`onHide` as props of the bare `<Toast>` element, when they
   actually belong to `ToastOptions` (the `useToast()` API) per the installed
   `@astryxdesign/core` source — claims `tsc` itself rejected the doc's names, which is how the
   mismatch was caught.
6. Claims 36/36 new tests pass (119/119 repo-wide), typecheck/lint/build/test all exit 0. Claims
   `npm run format:check` fails repo-wide but ONLY due to two pre-existing files it never touched
   (`renderEmailLayout.ts`, `Kiosk.tsx`) — its own two files pass `npx prettier --check` directly.
7. Four disclosed known risks: hours computation uses RSVP+session-status as a proxy for "confirmed"
   rather than real attendance/check-in data; stale `guards.tsx` `Role` union (same recurring gap);
   `OutreachGoalConfig` (individual season-hour goals) has no real backing table in the migrations,
   disclosed as UI-only.

## Required Verification Steps
1. **Read `OutreachList.tsx` and `OutreachList.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **SideNav-badge scope tension — the central judgment call of this check.** Confirm
   `SideNav.tsx` is genuinely byte-unchanged (the forbidden-file check above). Read
   `getUnansweredRsvpCount`'s implementation yourself and independently verify its "unanswered"
   definition against the real `rsvps` status vocabulary (`going`/`maybe`/`declined` per
   `20260717000000_scheduling_attendance.sql`) — confirm declined/maybe are genuinely excluded from
   "unanswered" as claimed. Render an explicit verdict: is this the correct way to handle a task
   whose own ledger Acceptance line asks for something the Allowed Files make literally impossible?
   (Note: the worker packet itself pre-authorized exactly this handling — judge whether the worker
   followed it faithfully, not whether the handling itself was a good call, which was already
   decided when the packet was written.)
3. **BEH-02 "never summed" — re-verify by source read, not by trusting the grep claim.** Confirm no
   expression anywhere in executable code (not comments) adds a confirmed value to a planned value
   and displays the result as one number, for either role variant's goal bar.
4. **BEH-01 milestone dedupe — reproduce or independently verify.** Confirm the localStorage key is
   genuinely scoped to both season AND goal-bar identity (re-read the exact key construction), and
   that a remount with the same season+goal doesn't re-fire the toast while a different season/goal
   correctly would.
5. **NAV-07 — re-derive structurally**, same standard as T030's checker used: trace the actual code
   path proving meeting-type content is structurally unreachable in this page's rendering, not just
   confirm one test string is absent.
6. **The `Toast` doc-gap claim — re-verify against the installed source yourself.** Open
   `node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts` (or equivalent) and confirm
   `uniqueID`/`onHide` genuinely belong to `ToastOptions`, not `<Toast>` itself, and that the
   worker's actual usage in the file matches the real (not documented) prop shape.
7. **DES-12 four states** — confirm all four are genuinely distinct and independently reachable for
   both role variants.
8. **RSVP `SegmentedControl`** — confirm the claimed real local-state update (goal bar and badge
   count reacting live) by source read, and confirm no Supabase write exists anywhere in the file.
9. **Astryx prop citations** — spot-check `ProgressBar`, `AvatarGroup`, `Avatar`,
   `SegmentedControl`, `Badge` (neutral variant only, BEH-04), `List`/`ListItem` against
   `astryx-api.md`.
10. **format:check baseline claim** — reproduce yourself: confirm the two files causing the
    repo-wide failure are genuinely pre-existing and outside this task's Allowed Files, and that
    the worker's own two files pass `npx prettier --check` directly.
11. **Re-run typecheck/lint/build/test yourself** — don't accept "exit 0"/"119/119" without your
    own run.
12. **Test-file scope question** — render an explicit verdict, independently re-derived.
13. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface — but note the
  claimed doc-gap in #5 above; if genuine, using the real (undocumented-but-correct) prop shape is
  the right call, not a violation, per the same "CLI/source cross-check when the doc is wrong"
  precedent established by prior tasks.
- Item 12 (DES-12): all four async states required.
- Item 13: no box-drawing/bracket-character fake structure.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the SideNav-badge scope-tension handling
- explicit verdict on the BEH-02 never-summed claim
- explicit verdict on the claimed Astryx `Toast` doc gap
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
