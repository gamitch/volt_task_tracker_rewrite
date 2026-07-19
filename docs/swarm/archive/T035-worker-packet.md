# Worker Packet: T035

## Task ID
T035

## Objective
Build `src/pages/checkin/CheckinResult.tsx`: the three end-state screen a student lands on after scanning the check-in QR (or, later, after T054's manual code entry calls the same path) — **success** (renders the DES-01 "Check-in Bolt"), **already checked in**, and **error** (DES-16 copy). The success state must respect `prefers-reduced-motion` (instant state, no draw-in). This is the **only** orchestrated animation in the entire app (DES-01/DES-02) — do not add motion/gradients/glows anywhere else on this screen.

## Dependencies (status)
- T032 (`checkin` Edge Function) — Passed. Defines the exact request/response contract this screen consumes. Read `supabase/functions/checkin/index.ts` and `supabase/functions/checkin/attendance_upsert.ts` yourself (read-only reference) — the full contract is reproduced in Ground Truth below; do not re-derive it independently or guess at field names.
- Router: `/checkin` is already wired in `src/app/router.tsx` (`RequireAuth` only, no role restriction — any authenticated user, i.e. a student, can reach it). No router-wiring gap to flag here (confirm yourself, read-only).

## Allowed Files
- `src/pages/checkin/CheckinResult.tsx` (new file — confirm via `Glob` that `src/pages/checkin/` doesn't exist yet).

## Forbidden Files
- `src/app/router.tsx`, `src/app/guards.tsx`, `src/app/AppShell.tsx`, `src/components/nav/**`.
- `supabase/functions/checkin/**` — **read-only reference, must not modify.** See Known Context/Traps #2 below (the running-tally gap) — you cannot fix that by editing the function yourself; it's out of your Allowed Files.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — the exact `checkin` request/response contract (do not guess, cite this)

Request (this page constructs it from the URL query params `?s=<sessionId>&t=<token>`, per MTG-06's QR-encoded URL shape — or, if you also handle a manual-code sub-path, `code` instead of `token`):
```json
POST /functions/v1/checkin
Authorization: Bearer <caller's own Supabase session JWT>
{ "session_id": "<uuid>", "token": "<32-char hex>" }
```
or
```json
{ "session_id": "<uuid>", "code": "<6-char short code>" }
```

Success/already-in response (HTTP 200 either way — `attendance_upsert.ts`'s `resolveResponse`):
```ts
interface CheckinResponsePayload {
  already_checked_in: boolean;
  attendance: {
    status: 'present' | 'late' | 'excused' | 'absent';
    check_in_at: string | null;   // ISO timestamp
    method: 'qr' | 'coach' | 'import';
  };
}
```
- `already_checked_in: false` → this call itself just wrote the row → render the **success/Bolt** state, using `attendance.check_in_at` for the displayed `Timestamp` and `attendance.status` if you want to differentiate "present" vs. "late" copy (PRD doesn't require differentiated copy for late — your call, document it).
- `already_checked_in: true` → render the **already-in** state ("Already checked in at 6:04 PM" per MTG-09's worked example), using `attendance.check_in_at` for the displayed time. **Edge case, explicitly flagged by T032's own worker output:** `attendance.check_in_at` can legitimately be `null` (e.g. a coach recorded this student with `method='coach'` before they ever scanned, and a coach-entered row may have no `check_in_at`). Your copy must handle this gracefully — e.g. fall back to a generic "You're already checked in for this session" without a specific time, rather than rendering "Already checked in at null" or crashing. This exact wording choice is yours to make (T032's packet explicitly deferred it to you); document your choice.

Error response (any non-200):
```ts
{ error: { code: string; message: string } }  // message is already DES-16-compliant, written by T032
```
Render `error.message` directly in your error state (it was already authored to satisfy "what happened + what to do, no apologies" — do not rewrite it, do not paraphrase it, just display it). Known error codes/messages you'll see (non-exhaustive, from `index.ts`): `INVALID_OR_EXPIRED_CREDENTIAL` ("That check-in code expired. Codes refresh every minute — grab the new one from the screen."), `SESSION_NOT_OPEN`, `SESSION_CLOSED`, `NO_STUDENT_ACCOUNT`, `TEAM_SCOPE_MISMATCH`, `RATE_LIMITED`, plus generic 401/500 cases. Add a generic fallback error render for any code you don't specifically special-case (do not assume you'll always get a recognized `code`).

## Known Context / Traps

**1. No real Supabase auth session exists yet in `src/`** (confirmed via grep, zero hits for `createClient`/`supabase-js` under `src/` anywhere in the repo — same gap T016/T018 hit). Calling the real `checkin` Edge Function requires a real bearer JWT in the `Authorization` header, which doesn't exist yet (`guards.tsx`'s `login()`/`loginWithGoogle()` are still T005's in-memory placeholder with no real token). Build the complete UI for all three states, and build a real, typed `callCheckin(sessionId, token?, code?): Promise<CheckinResponsePayload>` function whose implementation is a real `fetch()` call shaped exactly like the contract above (correct method, headers, body) — this part **is** buildable and testable today (mock `fetch` in tests to exercise all three response branches: fresh success, already-in with a real timestamp, already-in with `check_in_at: null`, and each error shape). What you cannot do is prove a real end-to-end call against a live deployed function with a live JWT — state this plainly rather than claiming a false end-to-end pass. Flag the missing-real-JWT gap explicitly (same category as T016/T018's flagged gaps).

**2. The "running tally" in the DES-01 Bolt spec has no data source in the current contract.** DES-01 describes the success state as including "a running tally ('14th in tonight')" and the 7.1 wireframe shows "14th in tonight" under the success state. **The `checkin` function's response payload (reproduced in Ground Truth above) does not include any tally/count field.** Nor can this screen legitimately query for one itself: `attendance` RLS is `staff_all` (admin/coach) + `own_or_linked_read` (the caller's **own** rows only) — a student has no RLS-permitted way to count *all* attendance rows for the session to compute their own place in line. This is a genuine, unresolved gap between the design spec and the already-built (and Passed) backend contract — **not something fixable within this task's Allowed Files** (the `checkin` function is forbidden to you, and no other data source for this exists). Do not fabricate a plausible-looking number. Handle this explicitly: either (a) omit the running-tally line entirely from your implementation and flag the gap clearly, or (b) render a placeholder/TODO-marked element that makes the gap visually obvious in a dev context without shipping a fake number — your call, but whichever you choose, **state it explicitly and prominently** in your Required Worker Output as a dispute candidate (most likely resolution: T032's `checkin` function needs a small extension to compute and return a same-session count, which would require reopening that Passed task or a new small corrective task — recommend, don't decide).

**3. `prefers-reduced-motion`.** The success state's ~400ms bolt draw-in + accent flash must collapse to an instant, fully-settled render (no animation) when `prefers-reduced-motion: reduce` is set — test this via a real media-query check (e.g. `window.matchMedia('(prefers-reduced-motion: reduce)')`), not just a visual judgment call.

**4. DES-02 scope discipline.** This is explicitly called out as "the only orchestrated animation in the app" — do not add any decorative motion, gradient, or glow to the already-in or error states, or to anything else on this screen beyond the one sanctioned bolt draw-in.

## Acceptance Criteria
- All three end states (success/Bolt, already-in, error) implemented and visually distinct per the 7.1 wireframe's structural intent (no box-drawing characters rendered, constitution item 13).
- Success state respects `prefers-reduced-motion` — proven via a real toggle test, not just a claim.
- Error copy renders the server's own `error.message` verbatim (DES-16 already satisfied upstream by T032) — do not rewrite/paraphrase it.
- The `already_checked_in: true` + `check_in_at: null` edge case is handled gracefully (Known Context/Traps #1) — no literal "null" rendered, no crash.
- The running-tally gap (Known Context/Traps #2) is explicitly flagged, not silently fabricated with a fake number.
- The real-JWT gap (Known Context/Traps #1) is explicitly flagged.
- Astryx component props cross-checked against `astryx-api.md` directly (constitution item 2).
- `npm run build`/`typecheck`/`lint` all exit 0.

## Relevant Constitution Excerpts
> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures.

> 14. Copy follows PRD DES-14…16 (sentence case, named actions, prescribed empty/error text).

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that file is presumed hallucinated → MAJOR.

Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual artifact.

## PRD Ground Truth (verbatim)
> **DES-01 Signature element — the Check-in Bolt.** "Successful student check-in shows a full-screen confirmation: a lightning-bolt mark draws in (~400ms), surface flashes to the accent color and settles, with 'You're in' + `Timestamp` and a running tally ('14th in tonight'). This is the only orchestrated animation in the app. It must respect `prefers-reduced-motion` (instant state, no draw-in)."

> **DES-02** "Everything else uses Astryx defaults for motion and elevation. No decorative gradients, no card glows, no parallax."

> **MTG-08:** "...Response renders the **Check-in Bolt** (DES-01). Errors per DES-16 (expired code, session not live, not on this team's roster)."

> **MTG-09:** "Duplicate check-in is idempotent — show 'Already checked in at 6:04 PM', no error."

> 7.1 wireframe: three end states — SUCCESS (Bolt)/ALREADY IN/ERROR, each with a `[Done]` or `[Try again]` action.

## Most Recent Failure
None. This is attempt 1 for T035 (attempt count: 0).

## Required Worker Output
- Full contents of `CheckinResult.tsx` (and subcomponents).
- Explicit statement of your `already_checked_in` + null-`check_in_at` copy decision (Known Context/Traps #1).
- Explicit, prominent flag of the running-tally gap (Known Context/Traps #2) and which of the two handling options you chose.
- Explicit flag of the missing-real-JWT gap.
- Test output proving: fresh success render, reduced-motion instant render, already-in with a real timestamp, already-in with `check_in_at: null`, at least two distinct error-code renders, and a generic-fallback-error render for an unrecognized code.
- Astryx prop-by-prop citations.
- `npm run build`/`typecheck`/`lint` output.
- Known risks; whether a dispute is needed.
