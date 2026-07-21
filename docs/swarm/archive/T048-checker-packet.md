# Checker Packet: T048 (Resend integration + branded layout + `email_log`) — Check Attempt 1

## Task ID
T048 — Resend integration + branded layout + `email_log` (EML-01), Epic E8.

## Checker Agent
checker-reviewer (per task-ledger.md T048 row).

## Objective
Verify a shared branded email layout, sender identity, and every-send-logged-to-`email_log`
wiring into the existing (Passed) `send-invite` function, gated so **no live send can ever occur
outside Resend test mode** without T052's human sign-off.

## Allowed Files (worker's only permitted edit)
- `src/emails/layout/**` (new)
- `supabase/functions/send-invite/**` (extend only — must not create a new function; the pre-
  existing, already-Passed `index.ts` above the marked EXTENSION POINT, and its final
  `return jsonResponse(201, ...)`, must remain byte-identical to T017's Passed version)

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commits (`c7103f5` for the
`src/emails/layout/**` portion, `b4d4700` for the `supabase/functions/send-invite/**` portion) —
do NOT infer authorship from commit messages. Confirm no file outside these two globs was touched.

## Worker's Claimed Changes (do not trust — verify independently)
1. `src/emails/layout/constants.ts` — `SENDER_ADDRESS` = `'VOLT Robotics <notifications@mail.voltfrc.org>'`
   (must match ledger's literal spec exactly), `SITE_URL`, `MANAGE_PREFERENCES_PATH`/`_URL`
   (`/settings#notifications`), accent hex values **hand-copied** from `src/theme/volt.ts`
   (read-only reference, not imported — confirm the values actually match `volt.ts`'s real tokens,
   including the D005-authorized dark on-accent line).
2. `src/emails/layout/renderEmailLayout.ts` — plain TS (no React/JSX/CSS-import), table-based HTML
   email with inline styles + `@media (prefers-color-scheme: dark)` block. Wordmark header, violet
   accent bar, footer with manage-preferences link.
3. `src/emails/layout/inviteFixtureBody.ts` — explicitly-labeled placeholder invite body, claims
   this is NOT a T049 deliverable (T049's `src/emails/templates/**` is out of scope here).
4. `src/emails/layout/renderEmailLayout.test.ts` — 7 vitest tests, claims all pass.
5. `supabase/functions/send-invite/resend.ts` — Resend HTTP client via Deno's built-in `fetch`
   (no `resend` npm package — correctly not on the constitution item 9 allowlist).
   `resolveSendMode()` reads **only** `Deno.env.get('RESEND_SEND_MODE')`, zero parameters, nothing
   request-derived can reach it. Fail-closed: only the exact literal `'production'` enables real
   sends; anything else (unset, `''`, `'prod'`, `'Production'`, `'true'`, etc.) resolves to test
   mode. `sendBrandedEmail(input, mode)` takes mode as an explicit argument. In every non-
   `'production'` mode, returns `{ sent: false, reason: 'skipped_test_mode' }` **before**
   constructing any `fetch()` call — claims `api.resend.com` is never reached and
   `RESEND_API_KEY` is never read for a network request in test mode.
6. `supabase/functions/send-invite/email_log.ts` — `writeEmailLog()` against the service-role
   `adminClient`. Status vocabulary: `'sent'` / `'failed'` / `'skipped_test_mode'`.
7. `supabase/functions/send-invite/index.ts` — claims diff is clean: only new imports + the
   extension block inserted between the EXTENSION POINT comment and the final return; everything
   else byte-identical to T017's Passed version.
8. `resend.test.ts`/`email_log.test.ts` — Deno.test-style, claims run via a Node/tsx port (Deno
   unavailable in worker's sandbox) with all tests passing, including a stubbed-`fetch`-throws
   assertion proving `fetch` is never called in test mode, and a production-mode test confirming
   the real call shape (`Bearer` header, exact URL, exact body) only when explicitly gated open.
9. Claims `resend.com` is proxy-blocked in its sandbox (cites `connect_rejected`/403 via
   `curl $HTTPS_PROXY/__agentproxy/status`), so the "reserved `resend.dev` test addresses"
   research claim is stated with an explicit caveat and NOT relied upon as the safety mechanism —
   the application-level gate above is claimed as the actual, self-contained safety boundary.
10. Claims cross-runtime import (`supabase/functions/send-invite/index.ts` importing
    `../../../src/emails/layout/*.ts`, i.e. a Deno function importing frontend TS) resolves and
    executes correctly under Node/tsx, but flags that whether Supabase's real eszip deploy bundler
    walks this import correctly is **unverified** (no Docker/Supabase CLI access in sandbox) —
    explicitly flagged as a residual risk, not silently assumed to work.
11. Claims secret hygiene: grep for `RESEND_API_KEY` across `supabase/`+`src/` shows only
    `Deno.env.get()` calls, comments, and a clearly-fake test literal; no logging/echoing of the
    key; no PII (`to_email`) in any `console.error` line.
12. Claims `npm run typecheck`/`build`/`lint`/`test` all pass for its own files, notes one
    transient `CheckinResult.tsx` typecheck error belongs to a different concurrent worker (T035),
    not touched by this task.

## Required Verification Steps
1. **Read all six new/modified files in full** — do not rely on the worker's summary.
2. **The test-mode gate is the BLOCKER-class core of this task (constitution item 7).** Read
   `resolveSendMode()` and `sendBrandedEmail()` yourself line-by-line. Confirm independently: (a)
   `resolveSendMode` truly takes no parameters that could be influenced by request data: (b) the
   fail-closed default is real (trace every non-`'production'` input path); (c) the `fetch()` call
   to `api.resend.com` is genuinely unreachable in code before the mode check — not just skipped
   by a flag that's checked after the network call is already issued. This is the single most
   important thing to get right in this check; do not accept the worker's test suite as sufficient
   proof without also reading the source path yourself.
3. **`index.ts` diff purity.** Run `git show <commit>:supabase/functions/send-invite/index.ts`
   against T017's Passed version (find it via `git log` on this file, or the T017 archive packet)
   and confirm byte-identical above the EXTENSION POINT and at the final return statement. This is
   the same "verbatim above the extension point" pattern used for T048's own allowed-files rule —
   verify it directly, don't trust the worker's account of "confirmed via git diff."
4. **Sender address exact-match.** Confirm `SENDER_ADDRESS` literal string matches the ledger's
   `VOLT Robotics <notifications@mail.voltfrc.org>` exactly (no typos, no different display name).
5. **`email_log` write path.** Re-open the real `email_log` schema (from
   `20260717000001_support_audit.sql` per T048's packet) and confirm `writeEmailLog()`'s columns/
   types match, and that every code path that sends (or skips) an email calls it — including the
   `skipped_test_mode` path (a skipped send must still be logged, not silently dropped).
6. **Re-run the test suites yourself** (`renderEmailLayout.test.ts` via vitest directly since it's
   plain TS; `resend.test.ts`/`email_log.test.ts` via whatever harness is available in your
   environment — Deno if present, else reproduce the worker's Node/tsx port approach or an
   equivalent). Do not accept "all pass" without your own run.
7. **Accent color hand-copy accuracy.** Open `src/theme/volt.ts` yourself and confirm the literal
   hex values in `constants.ts` genuinely match the real tokens (light + dark, including the
   D005-authorized on-accent line) — a stale or wrong hand-copy would silently ship wrong branding.
8. **Secret hygiene — re-run the grep yourself.** Confirm zero real-looking API keys, zero logging
   of `RESEND_API_KEY`, zero PII in error/log output across the touched files.
9. **`inviteFixtureBody.ts` scope check.** Confirm it's genuinely a minimal placeholder (not an
   attempt to smuggle in T049's real template work) and is clearly labeled as such in-file.
10. **Dependency check.** Confirm no `resend` npm package (or anything else off constitution item
    9's allowlist) was added — `fetch`-only, as claimed.

## Relevant Constitution Excerpts
- Item 7 (BLOCKER-class, no exceptions): no real email sends outside Resend test mode until T052's
  human gate. This is the single highest-stakes thing this check verifies.
- Item 5: no secrets in frontend bundles / logged output.
- Item 9: dependency allowlist (`resend` npm package is NOT allowlisted; `fetch` is the correct
  choice).

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual code/diff/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on whether the test-mode gate is genuinely airtight
- explicit verdict on the cross-runtime import / deploy-bundler risk (dispute-worthy, or
  correctly-flagged residual risk?)
- required rework if failed
- follow-up tasks if passed with minor issues
