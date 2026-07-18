# Checker Packet: T017

## Task ID
T017 — `send-invite` Supabase Edge Function (AUTH-03 steps 1–2, AUTH-06, EML-01 wiring point)

## Checker Agent
checker-reviewer

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
Five new files under `supabase/functions/send-invite/`: `index.ts`, `validation.ts`, `validation.test.ts`, `deno.json`, `deno.lock`. The function must: verify the caller is authenticated and `admin`/`coach` (never trusting a client-supplied role), insert an `invites` row with correct role/student linkage and a 14-day `expires_at`, and call `auth.admin.inviteUserByEmail()` via a service-role client. **Constitution item 5 is BLOCKER-class here: no service-role key may ever appear in frontend/client-bundled code.** (Not directly applicable to this backend-only task since it touches no `src/` file, but the checker must still confirm the service-role key is read only via `Deno.env.get(...)`, never hardcoded, never echoed, never logged.)

The worker reports 21/21 `deno test` cases passing (confirmed structurally: `validation.test.ts` contains exactly 21 `Deno.test(...)` calls) and clean `deno check`/`deno lint`. The worker also reports it could NOT get live end-to-end verification because Docker isn't available in this sandbox (`supabase start` failed) — described as a genuine, disclosed environment limitation, not a shortcut. **Do not rubber-stamp this claim.** Independently attempt to start Docker/`supabase start` yourself and confirm the same failure occurs for you, following the established pattern from T015/T016/T016a (each of those checkers independently reproduced claimed tooling limitations rather than accepting the worker's word).

The worker also flagged three judgment calls for your explicit severity verdict:
1. It designed its own error-response shape (`{ "error": { "code": "SOME_CODE", "message": "..." } }`) — not literally specified in the packet — that downstream tasks T024/T027 will need to match.
2. It added CORS headers (`Access-Control-Allow-Origin: '*'` etc.) as a judgment call, not explicitly packet-specified.
3. No dedup/idempotency exists on `inviteUserByEmail` retries (a caller retrying after a timeout could, in principle, attempt to invite the same email twice — though note the function does compensate by deleting the `invites` row if `inviteUserByEmail` itself fails).

## Files to Inspect
- `supabase/functions/send-invite/index.ts` (new)
- `supabase/functions/send-invite/validation.ts` (new)
- `supabase/functions/send-invite/validation.test.ts` (new)
- `supabase/functions/send-invite/deno.json` (new)
- `supabase/functions/send-invite/deno.lock` (new)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (read-only — `invites` table ground truth; confirm zero diff)
- `supabase/migrations/20260717000002_rls.sql` (read-only — `invites` RLS ground truth; confirm zero diff)
- `supabase/config.toml`, `.env.example` (read-only zero-diff baseline from T015)
- `src/**` (read-only — confirm this backend-only task touched nothing here)

## Forbidden Modification Check (run first, per D001 standing rule — compare file tree/content directly, never git history/commit-bundling)
Worker's Allowed Files were `supabase/functions/send-invite/**` only (a directory that did not exist before this task). Verify:
- No file under `supabase/migrations/**` was touched (the `invites` table already exists from T010; this task must not alter it).
- `src/**` has zero new/modified files (frontend callers T024/T027 are future tasks).
- Nothing under `docs/swarm/**` or `.claude/**` was touched by the worker (do not flag this checker packet itself or hook-appended `verification-log.md` lines as findings — normal swarm-operation byproducts, not worker artifacts).
- No file exists outside `supabase/functions/send-invite/**` that wasn't there before this task.

If any forbidden file was modified, return FAIL - BLOCKER - unauthorized modification.

## Required Verification Steps

1. **Independent re-run of `deno check`/`deno lint`/`deno test`.** Run each yourself against `supabase/functions/send-invite/` (not reusing any reported output) and report the real commands and real output. Confirm `deno test` genuinely runs and passes all 21 cases in `validation.test.ts` (cross-check: the file contains exactly 21 `Deno.test(...)` calls — confirm this count yourself via `grep -c`). If `deno` isn't installed/available in your environment, install it or state explicitly what alternative verification you performed and why — do not claim a pass you didn't observe.

2. **Rigorous secret-hygiene grep/audit — constitution item 5, BLOCKER-class if violated.** Read `index.ts` in full and confirm: (a) `SUPABASE_SERVICE_ROLE_KEY` is read only via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, never hardcoded as a literal string anywhere; (b) it is never included in any response body, never passed to `console.log`/`console.error`, never returned in any error message; (c) run `grep -rn "SERVICE_ROLE\|service_role\|secret" supabase/functions/send-invite/` yourself and inspect every hit's context. Also confirm no `.env`/secret file was accidentally created under `supabase/functions/send-invite/` and that `deno.lock` contains no embedded credentials (it shouldn't — it's a dependency lock file — but check).

3. **Two-client architecture verification.** Confirm by direct code read that `callerClient` (built from the anon key + the caller's own `Authorization` header) is used ONLY for `auth.getUser()` and the caller's own `profiles` row lookup (both subject to RLS), and that `adminClient` (built from the service-role key) is used for every write (`invites` insert, `inviteUserByEmail`) and the `students` existence check. Confirm the function's own authorization gate (checking `callerProfile.role` is `admin` or `coach`) happens BEFORE any use of `adminClient`, and that a non-staff caller is rejected (403) without ever reaching a database write. Trace this by reading the actual control flow in `index.ts`, not by trusting the file's own comments.

4. **Invites row schema/RLS assumptions match the real migrations.** Read `supabase/migrations/20260717000000_scheduling_attendance.sql` directly yourself and confirm `index.ts`'s insert payload (`email, role, student_id, invited_by, status, expires_at`) matches the actual `invites` table columns exactly — no missing/extra/mismatched fields. Read `supabase/migrations/20260717000002_rls.sql` directly and confirm the function's own authorization-gate comment ("RLS alone cannot protect the write path once we switch to the service-role client... this function's own logic is the only gate") accurately describes the real `staff_all` policy on `invites` (i.e. confirm there really is no policy that would let a non-staff caller write `invites`, so the function's own check is in fact load-bearing, not redundant). Confirm `role_enum`'s vocabulary (`admin`,`coach`,`student`,`parent`) matches `validation.ts`'s `ROLE_VALUES` exactly.

5. **AUTH-06 14-day expiry re-derivation.** Read `computeExpiresAt` in `validation.ts` directly and independently verify (by hand or by running the function) that it computes exactly 14 days from the given instant. Cross-check against `validation.test.ts`'s own assertion (`'2026-07-18T00:00:00.000Z'` → `'2026-08-01T00:00:00.000Z'`) by computing it yourself.

6. **Docker/local-Supabase unavailability — reproduce, do not accept on faith.** Independently attempt `supabase start` (or an equivalent Docker-based local Supabase invocation) in your own environment. Report the exact command, the exact failure output, and whether it matches the category of failure the worker described (Docker unavailable). If you find Docker IS actually available and can stand up a local instance, do so and attempt a real local invocation of the function (in which case, actually exercise it and report real output — this would be additional positive evidence beyond what the worker achieved, not just a confirmation of the blocker). If genuinely unavailable for you too, state that plainly with your own evidence, matching the T015/T016/T016a precedent of independently reproducing claimed environment limitations rather than rubber-stamping them.

7. **Severity verdict on the worker's three flagged judgment calls.**
   a. **Error-response shape** (`{ "error": { "code", "message" } }`) — assess whether this is a reasonable, stable, DES-16-compliant shape for T024/T027 to build against, or whether it should have been specified by the packet/foreman instead. Give an explicit MINOR/NIT/non-issue verdict, not a vague "seems fine."
   b. **CORS headers** — assess whether adding `Access-Control-Allow-Origin: '*'` (rather than a more restrictive origin) is an acceptable judgment call for an Edge Function that will ultimately be called from the deployed frontend only, or whether it's a security-relevant over-permissiveness worth flagging (note: this endpoint requires a valid caller JWT regardless of origin, so a wildcard CORS origin does not by itself grant unauthenticated access — assess whether that mitigates the concern enough, or not). Give an explicit severity verdict.
   c. **No dedup/idempotency on `inviteUserByEmail` retries** — assess whether the existing compensating-delete-on-failure behavior (removing the `invites` row if `inviteUserByEmail` fails) is sufficient, or whether a genuine idempotency gap remains (e.g. a client retry after a slow-but-eventually-successful first call could invite the same person twice, or hit Supabase's own "already registered" case, which the function does handle via `ALREADY_INVITED`). Give an explicit severity verdict — MINOR follow-up task recommended if real, non-issue if not.

8. **D001-method forbidden-file check.** Confirm via direct file-tree/content comparison (never git history) that only the five files listed under Files to Inspect (new) exist under `supabase/functions/send-invite/**`, and nothing else in the repository changed as a result of this task — especially confirm zero changes anywhere under `src/`.

## Relevant Constitution Excerpts
> 4. RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 security definer helpers; a policy subquerying its own table → BLOCKER. (Context: not modifying RLS, but the function's own authorization check must not incorrectly bypass/duplicate it.)
>
> 5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER.
>
> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures.
>
> 9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, ... Anything else requires boss-architect approval. Confirm `@supabase/supabase-js` is imported via an allowlisted specifier (`npm:@supabase/supabase-js@2`) and no other external dependency was introduced.
>
> 14. Copy follows PRD DES-14…16... any error message text must follow DES-16 ("what happened + what to do," no apologies).
>
> Non-Negotiable: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

## Known Context / Non-Issues (verify, do not just accept)
- The worker deliberately did NOT attempt Resend/branded-email wiring, leaving an explicit "EXTENSION POINT" comment in `index.ts` for T048 to build on. Confirm this scope boundary was actually respected (no Resend/SMTP code anywhere in the function) and that the extension point is placed sensibly (after a successful `inviteUserByEmail` call, before the response).
- Do not flag this checker packet's own existence or hook-appended `verification-log.md` lines as forbidden-file violations.

## Most Recent Failure
None — this is T017's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased): `deno check`, `deno lint`, `deno test` (step 1)
- secret-hygiene grep output and full audit narrative (step 2)
- two-client architecture trace confirmation (step 3)
- schema/RLS cross-check against the real migration files (step 4)
- AUTH-06 expiry re-derivation (step 5)
- your own independent Docker/`supabase start` attempt and its real output (step 6)
- explicit severity verdict on each of the three flagged judgment calls (step 7)
- forbidden-file/scope check result (step 8)
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's self-report or the inline comments in `index.ts`. Generate your own evidence for every claim, especially the Docker-unavailability claim and the constitution item 5 secret-hygiene audit.
