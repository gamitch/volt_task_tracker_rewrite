# Checker Packet: T035 (`/checkin` result screen + Check-in Bolt) — Check Attempt 1

## Task ID
T035 — `/checkin` result screen + Check-in Bolt (DES-01), Epic E5.

## Checker Agent
checker-accessibility (per task-ledger.md T035 row).

## Objective
Verify the three DES-01 end states (success/Bolt, already-in, error) render correctly per the real
`checkin` Edge Function contract, that the Bolt animation is the app's only orchestrated animation
and correctly respects `prefers-reduced-motion`, and that error copy follows DES-16 style.

## Allowed Files (worker's literal permitted edit)
- `src/pages/checkin/CheckinResult.tsx` (new)

**Scope flag**: worker also created `src/pages/checkin/CheckinResult.test.tsx`, outside the literal
Allowed Files line, self-disclosed as required by the packet's own "Required Worker Output" demand
for test evidence covering six specific scenarios. Judge explicitly whether this is in-scope
(test file co-located with its one component, evidence-gathering, no production code impact) or a
forbidden-file violation requiring rework.

## Forbidden Modification Check (run first, D001 method)
Compare the above against the actual file tree / this task's commit (`58d5a06`) — do NOT infer
authorship from commit messages. Confirm nothing outside `src/pages/checkin/**` was touched
(especially `supabase/functions/checkin/**`, which the worker claims was read-only).

## Worker's Claimed Changes (do not trust — verify independently)
1. Three end states built against the real `checkin` contract (cited from
   `supabase/functions/checkin/index.ts`/`attendance_upsert.ts`, read-only):
   - **Success**: `already_checked_in: false` → "You're in" + `Timestamp` + a hand-rolled animated
     bolt glyph (SVG `clip-path` draw-in + a keyframe flash on `Card`'s documented `astryx-card`
     class), timed to `--duration-medium-max` (claimed to equal exactly 400ms).
   - **Already-in**: `already_checked_in: true` → "Already checked in at `<Timestamp>`", with a
     `check_in_at: null` fallback path that never renders literal "null" text.
   - **Error**: `error.message` rendered verbatim in a `Banner`, never rewritten/paraphrased; no
     branching on `error.code`.
2. `callCheckin()` — a real typed fetch function implementing the exact request/response contract
   (POST, headers, body shape: `session_id` + `token`/`code`). Claims 24 tests cover fresh success,
   already-in with real timestamp, already-in with `check_in_at: null`, two distinct error codes,
   an unrecognized-code fallback, network failure, and header/body shape assertions.
3. `prefers-reduced-motion` gated via a real `window.matchMedia` subscription (not CSS-only),
   claims two tests stub `matchMedia` true/false and assert animation classes present/absent
   accordingly.
4. **Gap #1 flagged**: no real Supabase JWT exists anywhere in `src/` yet; `getAccessToken`
   defaults to `null`, so a real call would omit the `Authorization` header — claims this is an
   honest, undisguised gap (results in an ordinary 401 flowing through the same error path), not a
   fabricated success.
5. **Gap #2 flagged, explicit dispute recommendation**: DES-01 (per the ledger's own objective
   line) calls for a "running tally," but the already-Passed `checkin` payload contract has no
   tally field, and RLS blocks a student from querying a count themselves. Worker chose to **omit
   the tally from the real UI entirely** rather than fabricate a number, with only a
   `import.meta.env.DEV`-gated (tree-shaken from prod) marker documenting the gap. Explicitly
   recommends (not decides) a small extension to T032's `checkin` function to return a same-session
   count, or a new corrective task.
6. Claims deliberate non-use of Astryx's `Icon` component for the bolt glyph (prop-spread order
   would clobber size/color classes, verified by reading installed component source) and deliberate
   non-use of `Card`'s undocumented-but-functional `className`/`xstyle` props (worked around via a
   wrapper `<div>` targeting `Card`'s documented `astryx-card` class instead), citing constitution
   item 2 (documented API surface only).
7. Claims `npm run typecheck` (0 errors), `npm run lint` (0 errors, 17 pre-existing-pattern
   warnings matching `guards.tsx`/`router.tsx`), `npm test` (32/32 passing, 24 new), `npm run build`
   (succeeds).

## Required Verification Steps
1. **Read `CheckinResult.tsx` in full** — do not rely on the worker's module doc or this packet's
   paraphrasing.
2. **Re-derive the request/response contract yourself.** Open
   `supabase/functions/checkin/index.ts` and `attendance_upsert.ts` (read-only) and confirm
   `callCheckin()`'s request shape and the three end-state branches genuinely match the real
   contract — do not accept the worker's citation without re-reading the source.
3. **DES-01's missing "running tally" — this is the central judgment call of this check.** Confirm
   independently (by reading the real `checkin` payload type/response) that no tally field
   actually exists in the contract, and that RLS genuinely blocks a client-side count query (read
   the relevant RLS policy). Then render an explicit verdict: is omitting the tally (rather than
   fabricating a number) the correct call given the "never fabricate data" standing rule, and does
   this gap block a PASS, warrant a MAJOR/MINOR finding with a required follow-up task, or need a
   dispute escalated to boss-arbiter? The task's own ledger Acceptance line doesn't explicitly
   require the tally (only the animation/reduced-motion/error-copy criteria are listed as
   Acceptance) — read the Acceptance line yourself and decide whether the tally is in-scope for a
   PASS/FAIL verdict here or correctly deferred.
4. **Animation is the app's ONLY orchestrated animation (DES-02).** Grep the rest of `src/` for any
   other CSS animation/transition/keyframe usage outside this file and outside Astryx's own
   built-in component internals — confirm no other page has snuck in a competing animation.
5. **`prefers-reduced-motion` — reproduce the worker's claimed test yourself**, or independently
   verify via source read that the `matchMedia` subscription genuinely gates the animation classes
   (not just a CSS `@media` query that could be bypassed, and not merely present in test code
   without being wired to the real render path).
6. **~400ms timing claim** — confirm `--duration-medium-max` really does resolve to 400ms (check
   the design tokens file), not an approximate/rounded claim.
7. **Error copy — DES-16 pattern check.** Read a couple of real `error.message` strings the
   `checkin` function can actually emit (from `attendance_upsert.ts`/`index.ts`) and judge whether
   they read as "what happened + what to do" (DES-16 style), or are raw/technical strings that
   shouldn't be shown verbatim to a student scanning a QR code.
8. **Test-file scope question** — form an explicit verdict on whether `CheckinResult.test.tsx`
   being outside the literal Allowed Files line is acceptable (per D001-era precedent: co-located
   test files for the one allowed component have generally been treated as in-scope in this
   project) or requires rework.
9. **Re-run tests/build/lint/typecheck yourself** — don't accept "32/32 passing" without your own
   run.
10. **Astryx citations** — spot-check `Timestamp`, `Banner`, `Card` against `astryx-api.md`.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface — no undocumented
  prop usage even if the installed package happens to accept it.
- Standing rule (not a numbered item, established this session): never fabricate plausible-looking
  data where a real data source doesn't exist — prefer an honest gap/placeholder, explicitly
  disclosed.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the missing running-tally gap (PASS-with-follow-up, MINOR/MAJOR finding, or
  dispute-worthy?)
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
