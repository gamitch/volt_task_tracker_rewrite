# Checker Packet: T054 (Student Home) — Check Attempt 1

## Task ID
T054 — Student Home (HOME-02), Epic E9.

## Checker Agent
checker-accessibility (per task-ledger.md T054 row).

## Objective
Verify a mobile-first Student Home with a genuinely-resolved "StudentHomeSlot has no children prop"
scope tension, BEH-03's exactly-one-primary-CTA rule (checker-enforced), BEH-02's never-summed
hours, and a check-in path that reuses T032's real validation contract.

## Allowed Files (worker's literal permitted edit)
- `src/pages/home/StudentHome.tsx` (new)

**Scope flag**: worker also created `StudentHome.test.tsx`, outside the literal Allowed Files line
— same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`158ea19`) — do NOT
infer authorship from commit messages. **Critical check**: confirm
`src/pages/home/StudentHomeSlot.tsx` (T008, already-Passed) is byte-unchanged AND is never imported
anywhere in `StudentHome.tsx` — the worker claims it deliberately built its own `LiveCheckInCard`
rather than trying to extend the un-extendable slot component. Confirm `CheckinResult.tsx`,
`CoachHome.tsx`, `router.tsx`, `guards.tsx` (import-only), `src/lib/supabase/**` all untouched. Note:
the working tree may currently also show `ParentHome.tsx`/`.test.tsx` as untracked from a different,
concurrently-running task (T055) — do not flag it against T054.

## Worker's Claimed Changes (do not trust — verify independently)
1. **THE CENTRAL TRAP resolution**: worker claims it read `StudentHomeSlot.tsx` in full first,
   confirmed it has no `children` prop and cannot hold real content, and concluded its only purpose
   was proving the on/off contract. Worker claims it built its own `LiveCheckInCard` component
   inside `StudentHome.tsx`, reusing the same `Card variant="default" padding={4}` shell but with
   real `TextInput`+`Button` children, and that `StudentHomeSlot` is never imported/rendered/edited
   anywhere (claimed grep-provable).
2. **BEH-03 (checker-enforced)**: `selectHeroState(hasLiveSession, unansweredOpportunityCount)` is a
   pure function implementing strict priority (live check-in → unanswered RSVP → quiet greeting).
   Claims a hard, mechanically-enforced rule: `variant="primary"` is used on at most one `Button`
   anywhere on the page. Claims tests assert a real DOM count of `[data-variant="primary"]`: exactly
   1 for each of the two CTA states, exactly 0 for quiet-greeting, and a combined-state test (both a
   live session AND unanswered RSVPs present) proving only the live-check-in card's button carries
   the primary variant.
3. **BEH-02**: `confirmedHours` sourced only from a `v_student_hours`-shaped fixture row (never
   recomputed); `computePlannedHours` is a separate function summing future `going`-session
   durations. Claims grep-provable: no `confirmedHours + plannedHours` expression exists anywhere in
   executable code; both numbers render distinctly, their sum never appears in the DOM.
4. **Check-in path**: claims `defaultSubmitCheckinCode` is an independently-authored `fetch()` call
   to the same `POST {VITE_SUPABASE_URL}/functions/v1/checkin` endpoint with the same
   `{session_id, code}` body shape as `CheckinResult.tsx`'s real `callCheckin()` (cited file+line),
   cross-checked against `supabase/functions/checkin/validation.ts`/`index.ts` (read-only) — not a
   second, divergent contract.
5. Citations for `v_student_hours`/`v_student_participation` (metric_views.sql line ranges) and
   every Astryx component used (with `astryx-api.md` line numbers).
6. Claims 31/31 new tests pass, 307/307 repo-wide; typecheck/build/lint(scoped)/format(scoped) all
   exit 0. Discloses "oldest unanswered RSVP" is interpreted as earliest-starting eligible session
   (a disclosed judgment call, since an absent RSVP row carries no timestamp of its own).

## Required Verification Steps
1. **Read `StudentHome.tsx` and `StudentHome.test.tsx` in full** — do not rely on the worker's
   module doc or this packet's paraphrasing.
2. **THE CENTRAL TRAP — re-verify independently.** Read `StudentHomeSlot.tsx` yourself and confirm
   it genuinely has no `children` prop. Grep `StudentHome.tsx` for any import of
   `StudentHomeSlot`/`StudentHomeSlotProps` — confirm zero usage, confirming the worker built its
   own component rather than attempting (and failing) to extend the un-extendable one. Render your
   own explicit verdict on whether this resolution was correct and well-reasoned, not just whether
   it was internally consistent.
3. **BEH-03 — the central checker-enforced acceptance bar.** Read `selectHeroState` directly and
   confirm the priority order is genuinely strict (live check-in unconditionally beats an unanswered
   RSVP, which unconditionally beats the quiet greeting). Independently verify (reproduce or
   re-derive) the "at most one `variant="primary"` Button" invariant across all three hero states,
   INCLUDING the combined-state case (both conditions true simultaneously) — this is the single most
   important thing to get right in this check, since a subtle bug here would show two primary CTAs
   at once, violating the ledger's own explicit "never two primary Buttons" acceptance line.
4. **BEH-02 — re-verify by source read**, not just the grep claim. Confirm `confirmedHours` and
   `computePlannedHours` are genuinely never added together anywhere in executable code (search for
   any `+` operator between the two).
5. **Check-in contract — re-derive against the real source.** Open `CheckinResult.tsx`'s
   `callCheckin()` and `supabase/functions/checkin/validation.ts`/`index.ts` yourself and confirm
   `defaultSubmitCheckinCode`'s request shape genuinely matches — same endpoint, same body fields.
6. **Astryx prop citations** — spot-check `Card`, `TextInput`, `Button`, `ProgressBar`, `Badge`,
   `EmptyState` against `astryx-api.md`.
7. **"Oldest unanswered RSVP" judgment call** — read the worker's interpretation and render your own
   verdict on whether "earliest-starting eligible session" is a reasonable reading given an absent
   RSVP row has no timestamp of its own.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** — don't accept "31/31"/"307/307"/"exit 0" without
   your own run.
10. **Mobile-first layout** — spot-check against the PRD's 375px wireframe structure (Hi {name},
    live-check-in-or-greeting hero, hours bar, participation %, Next up, Sign-up opportunities).
11. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 3: no re-deriving RLS/metric SQL formulas in TypeScript — hours/participation must be
  view-shaped passthroughs.
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 6: no PII... test fixtures use fabricated names.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on THE CENTRAL TRAP resolution
- explicit verdict on BEH-03's exactly-one-primary-CTA invariant (including the combined-state case)
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
