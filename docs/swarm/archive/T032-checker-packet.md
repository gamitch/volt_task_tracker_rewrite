# Checker Packet: T032

## Task ID
T032 — `checkin` Supabase Edge Function (PRD MTG-06…MTG-12: rotating HMAC QR token + short code, grace-period auto status, idempotent/coach-override-safe upsert, rate limiting)

## Checker Agent
checker-tests

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
Seven implementation files plus their matching `*.test.ts` files under `supabase/functions/checkin/`: `index.ts`, `hmac.ts`, `grace.ts`, `liveness.ts`, `rate_limit.ts`, `validation.ts`, `attendance_upsert.ts`. The function validates a rotating token or 6-char short code via HMAC-SHA256, checks session liveness and team scope, and upserts an `attendance` row (`method='qr'`) with auto-computed `present`/`late` status per a 10-minute grace rule — idempotent on duplicate check-ins (MTG-09) and never overwriting a coach's `method='coach'` row (MTG-11). **Constitution item 5 is BLOCKER-class here: `CHECKIN_HMAC_SECRET` must never appear in frontend/client-bundled code** (not directly applicable since this task touches no `src/` file, but the checker must confirm the secret is read only via `Deno.env.get(...)`, never hardcoded/echoed/logged).

The worker reports 53/53 `deno test` cases passing (structurally confirmed: `grace.test.ts`=8, `hmac.test.ts`=15, `liveness.test.ts`=9, `rate_limit.test.ts`=6, `validation.test.ts`=10, `attendance_upsert.test.ts`=5 → 53 total `Deno.test(...)` calls across the six test files). Two flagged gaps:
1. No schema column exists for MTG-04's "coach can manually Start check-in early/late" clause — `liveness.ts` implements only the time-window half (`starts_at - 15min` through `ends_at`, `status='scheduled'`), documented as a known interpretation gap for a future task (likely T033).
2. The 5/min/user short-code rate limiter is in-memory/per-isolate only (`rate_limit.ts`), with no persisted table (schema is frozen for this task) — documented as a known limitation, not silently worked around.

One flagged design deviation: `attendance_upsert.ts`/`index.ts` use an **unconditional** `ON CONFLICT (session_id, student_id) DO NOTHING` (via supabase-js's `upsert(..., { ignoreDuplicates: true })`) instead of the packet's illustrative `ON CONFLICT ... DO UPDATE ... WHERE attendance.method <> 'coach'`. The worker's stated rationale (in `attendance_upsert.ts`'s own header comment): (a) DO NOTHING is a strict superset of MTG-11's guarantee (it never overwrites ANY existing row — coach, qr, or import — not just coach rows); (b) MTG-09's own worked example ("Already checked in at 6:04 PM") implies the ORIGINAL check-in time is preserved on a repeat scan, which a conditional DO UPDATE would violate on a second legitimate QR scan by silently overwriting `check_in_at`/`status`. **Do not accept this rationale at face value — independently assess whether it holds.**

## Files to Inspect
- `supabase/functions/checkin/index.ts`, `hmac.ts`, `grace.ts`, `liveness.ts`, `rate_limit.ts`, `validation.ts`, `attendance_upsert.ts` (new)
- `supabase/functions/checkin/hmac.test.ts`, `grace.test.ts`, `liveness.test.ts`, `rate_limit.test.ts`, `validation.test.ts`, `attendance_upsert.test.ts` (new)
- `supabase/functions/checkin/deno.json`, `deno.lock` (new)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (read-only — `events`/`event_sessions`/`attendance` ground truth; confirm zero diff)
- `supabase/migrations/20260717000002_rls.sql` (read-only — `attendance` RLS ground truth, including the load-bearing "no student/parent write policy" comment; confirm zero diff)
- `src/**` (read-only — confirm this backend-only task touched nothing here)

## Forbidden Modification Check (run first, per D001 standing rule — compare file tree/content directly, never git history/commit-bundling)
Worker's Allowed Files were `supabase/functions/checkin/**` only (a directory that did not exist before this task). Verify:
- No file under `supabase/migrations/**` was touched (schema is frozen for this task; the rate-limit and MTG-04 gaps above were correctly NOT worked around via a new migration).
- `src/**` has zero new/modified files (frontend callers T033/T034/T035/T054 are future tasks).
- Nothing under `docs/swarm/**` or `.claude/**` was touched (do not flag this checker packet itself or hook-appended `verification-log.md` lines as findings).
- No file exists outside `supabase/functions/checkin/**` that wasn't there before this task.

If any forbidden file was modified, return FAIL - BLOCKER - unauthorized modification.

## Required Verification Steps

1. **Independent re-run of all `deno test` files.** Run `deno test supabase/functions/checkin/` (and `deno check`/`deno lint` too) yourself — do not reuse any reported output — and report the real commands and real output. Confirm all 53 cases genuinely pass, and independently confirm the 53 count via `grep -c "Deno\.test(" supabase/functions/checkin/*.test.ts`. If `deno` isn't available in your environment, install it or state explicitly what alternative you did and why.

2. **Re-derive and re-verify the MTG-11 (coach rows never overwritten) test yourself, don't just trust the worker's test design.** Read `attendance_upsert.test.ts`'s MTG-11 test case directly, then independently construct your own equivalent scenario (either by writing a fresh scratch test against `applyUpsertIgnoreDuplicates`/`resolveResponse`, or by tracing the logic by hand against a coach-recorded row you define yourself) and confirm: a pre-existing `method='coach'` row (including one with `check_in_at=null`, which coach entries can have) is genuinely returned/stored completely byte-for-byte unchanged after a QR check-in attempt for the same `(session_id, student_id)` — not just that `method` stays `'coach'`, but every field (including `updated_at`). Also independently trace `index.ts`'s real call site (`adminClient.from('attendance').upsert(..., { onConflict: 'session_id,student_id', ignoreDuplicates: true })`) and confirm this genuinely compiles to a `DO NOTHING` semantic that would behave identically to the pure-logic model in `attendance_upsert.ts` — i.e. confirm the pure-TS test is not testing a different code path than what `index.ts` actually executes against Postgres.

3. **Re-derive and re-verify the MTG-09 (idempotent duplicate check-in) test yourself.** Independently confirm: a second QR check-in for the same `(session_id, student_id)` does not create a second row, does not error, and the response reflects the ORIGINAL `check_in_at`/`status` (not the second attempt's values). Trace this against both the pure-logic test and `index.ts`'s real flow (the upsert followed by a read-back query, then `resolveResponse` comparing the read-back row against what THIS call attempted to write). Independently assess the flagged edge case in `resolveResponse`'s own doc comment (two near-simultaneous requests with identical millisecond-resolution `check_in_at` could misreport `already_checked_in: false` for the race loser) — confirm this is genuinely just a response-shape cosmetic risk and that the underlying `attendance` row is still written exactly once regardless (enforced by the DB unique constraint + `ignoreDuplicates`), not a data-integrity gap.

4. **HMAC token/short-code derivation and validation window — independent re-derivation.** Read `hmac.ts` directly (not this packet's earlier transcription) and independently verify, by hand or by writing your own scratch test: (a) `bucketFor` is `floor(unixSeconds/60)`; (b) the token is the first 16 bytes of `HMAC-SHA256(secret, "${sessionId}:${bucket}")` hex-encoded (32 hex chars); (c) the short code is bytes [16..22) of the SAME digest, mapped via `byte % 34` into the `ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789` alphabet (6 chars); (d) `verifyToken`/`verifyShortCode` accept exactly the current and immediately-previous 60-second bucket, and reject anything 2+ buckets stale; (e) comparisons use the documented constant-time `timingSafeEqual`. Independently test at least one bucket-boundary case yourself (e.g. token generated one second before a rollover, verified one second after) rather than trusting the existing test's framing.

5. **Grace-period boundary re-verification (MTG-08/OQ-3).** Independently confirm `computeAutoStatus` in `grace.ts` treats exactly 10:00:00 after `starts_at` as `present` (inclusive) and one second/millisecond past as `late` — trace the actual comparison operator (`<=`) yourself, don't just accept the test file's own framing.

6. **Secret-hygiene grep for `CHECKIN_HMAC_SECRET` — constitution item 5, BLOCKER-class if violated.** Read `index.ts` in full and confirm `CHECKIN_HMAC_SECRET` is read only via `Deno.env.get('CHECKIN_HMAC_SECRET')`, never hardcoded, never included in any response body/error message, never passed to `console.log`/`console.error`. Run `grep -rn "CHECKIN_HMAC_SECRET\|hmacSecret" supabase/functions/checkin/` yourself and inspect every hit's context.

7. **Explicit severity verdict on the `ON CONFLICT ... DO NOTHING` design deviation.** This is the most consequential judgment call in this task — give a real, reasoned verdict, not a rubber stamp:
   - Does unconditional `DO NOTHING` genuinely satisfy MTG-11 ("coach method='coach' rows never overwritten by QR writes")? Confirm: yes, trivially, since it never overwrites anything regardless of method.
   - Does it correctly match MTG-09's own worked example ("show 'Already checked in at 6:04 PM'" implying original time preservation)? Assess whether the packet's illustrative `DO UPDATE ... WHERE method <> 'coach'` would actually have violated this on a second legitimate QR scan (a `DO UPDATE` would silently replace `check_in_at`/`status` with the second scan's values, contradicting "checked in at 6:04" if the second scan happens at, say, 6:20).
   - Consider the case the packet's illustrative SQL was clearly trying to handle and that `DO NOTHING` might miss: is there any scenario where a `method='qr'` row's status genuinely SHOULD be updated by a later legitimate write (e.g. a late arrival's status flipping from `present` to `late` if computed at a different time, or a `check_out_at` ever being recorded via this function)? Read `index.ts`'s upsert payload directly — does it ever attempt to set `check_out_at`? If not, and if QR check-in is genuinely a single-write-per-session-per-student event with no legitimate "update" case in the MTG-06..MTG-12 spec as actually written, then DO NOTHING covers everything the function needs and the worker's "strict superset" claim holds. If you find a legitimate update scenario DO NOTHING silently drops, that is a real gap — say so and classify its severity (MAJOR if it breaks a real requirement, MINOR if it's a plausible future need not currently required).
   - State your verdict explicitly: PASS-as-designed, PASS-with-MINOR-follow-up, or FAIL, with reasoning.

8. **MTG-04 schema-gap and rate-limiter-limitation verdicts.** Confirm both flagged gaps are genuinely undoable within this task's frozen-schema constraint (re-read `event_sessions`' actual columns in the migration file yourself — confirm no `checkin_opened_at`-equivalent column exists) rather than the worker taking a shortcut it could have avoided. Give an explicit MINOR-follow-up verdict for each (not BLOCKER, since both are correctly flagged rather than silently glossed over, and per constitution both are legitimately deferred — but confirm neither was actually required by this task's own acceptance criteria as written).

9. **D001-method forbidden-file check.** Confirm via direct file-tree/content comparison (never git history) that only the files listed under Files to Inspect (new) exist under `supabase/functions/checkin/**`, and nothing else in the repository changed as a result of this task — especially confirm zero changes anywhere under `src/` or `supabase/migrations/`.

## Relevant Constitution Excerpts
> 4. RLS is default-deny... a policy subquerying its own table → BLOCKER. (Context: the `attendance` table deliberately has no student/parent write policy per T012's own migration comment — confirm this function's service-role bypass is the sanctioned path, not an incorrect workaround.)
>
> 5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER. (Extends to `CHECKIN_HMAC_SECRET` per SEC-03.)
>
> 6. No PII... in logs, URLs, analytics... test fixtures use fabricated names.
>
> 9. Dependency allowlist... Confirm only `@supabase/supabase-js` (via `npm:` specifier) and Deno's built-in `crypto.subtle` are used — no external crypto package.
>
> 14. DES-14…16 copy rules apply to every error message this function returns — spot-check at least 2-3 error responses in `index.ts` against the DES-16 "what happened + what to do" pattern.
>
> Non-Negotiable: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

## Known Context / Non-Issues (verify, do not just accept)
- The two flagged gaps (MTG-04 manual start, rate-limiter persistence) are expected to be legitimate, correctly-documented deferrals, not defects — but verify each independently per step 8 rather than accepting the labels at face value.
- Do not flag this checker packet's own existence or hook-appended `verification-log.md` lines as forbidden-file violations.

## Most Recent Failure
None — this is T032's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased): `deno check`, `deno lint`, `deno test` for all six test files, with the 53-count independently confirmed (step 1)
- your own independent re-derivation and re-verification of the MTG-11 test (step 2)
- your own independent re-derivation and re-verification of the MTG-09 test (step 3)
- your own independent re-derivation of the HMAC token/short-code scheme and at least one bucket-boundary test (step 4)
- grace-period boundary re-verification (step 5)
- secret-hygiene grep output and audit narrative for `CHECKIN_HMAC_SECRET` (step 6)
- explicit, reasoned severity verdict on the `DO NOTHING` vs. `DO UPDATE` design deviation (step 7) — this is the single most important judgment call in this packet
- explicit verdicts on the MTG-04 schema gap and rate-limiter limitation (step 8)
- forbidden-file/scope check result (step 9)
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's self-report or the inline comments in the source files (including `attendance_upsert.ts`'s own design-rationale comment). Generate your own evidence and your own independent reasoning for every claim, especially the DO NOTHING design deviation verdict.
