# Checker Packet: T051 (`send-reminders` Edge Function) — Check Attempt 1

## Task ID
T051 — `send-reminders` Edge Function + `pg_cron` + dedupe (EML-03), Epic E8.

## Checker Agent
checker-tests (per task-ledger.md T051 row). If Deno is available in your environment, use it —
the sibling task T047's checker had real Deno access and produced stronger verification (54/54 via
real `deno test`) than that worker's own Node/tsx substitute. If Deno is unavailable, reproduce the
worker's disclosed substitute approach independently rather than trusting it.

## Objective
Verify a `pg_cron`-invoked Edge Function that selects due sessions, expands recipients, filters by
`notification_prefs`, dedupes against `email_log` (a correctness requirement, not an optimization —
constitution item 7), and sends via the same fail-closed `RESEND_SEND_MODE` gate T048 established.

## Allowed Files (worker's literal permitted edit)
- `supabase/functions/send-reminders/**` (new directory, 13 files)
- `supabase/migrations/20260719000000_cron.sql` (new, additive-only)

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`dcbb0b9`) — do NOT
infer authorship from commit messages. Confirm `supabase/functions/send-invite/**`, `checkin/**`
untouched (read-only reference only — the worker was Forbidden from importing `send-invite/resend.ts`
directly and claims to have independently reimplemented an equivalent). Confirm no pre-existing
migration file was edited — `20260719000000_cron.sql` must be genuinely new and additive (no
`alter`/`drop` on any existing table/column).

## Worker's Claimed Changes (do not trust — verify independently)
1. **Dedupe key/logic — the central safety property (constitution item 7: correctness requirement,
   not optimization).** Claims recipient key is `to_email` (not `profile_id`, since `to_email` is
   `not null` on `email_log` while `profile_id` is nullable — `profile_id` still written for audit
   purposes, just not the lookup key). Per-session templates: `(template, session_id, to_email)`.
   Weekly-digest (session_id always null): `(template, to_email)` PLUS a `sent_at` window bounded to
   the current Sunday 5–5:15pm CT send window (disclosed workaround since `email_log` has no "week"
   column). Claims `send_reminder.test.ts` proves this with a real re-run: the same tuple invoked
   twice/thrice against a shared `InMemoryEmailLogStore` results in exactly one send/one row, for
   BOTH the per-session and weekly-digest key shapes, and that non-duplicate tuples are NOT
   conflated.
2. **Due-window logic** — claims `starts_at ∈ [now+offset, now+offset+15min)` (inclusive-lower,
   exclusive-upper) for the three per-session templates, boundary-tested. Weekly-digest claims a
   separate "within 15 min after Sunday 5pm CT" check via `Intl.DateTimeFormat`, claims DST-proven
   correct with both a summer (CDT) and winter (CST) test case.
3. **Recipient expansion + `notification_prefs` filtering** — claims two distinct steps (expand,
   then filter), per the packet's own instruction.
4. **`pg_cron`/`pg_net` investigation — disclosed as unverifiable live in this sandbox.** Claims the
   migration resolves the function URL/service-role key from Supabase Vault (`vault.decrypted_secrets`)
   at cron-invocation time rather than hardcoding secrets in the migration file, requiring a
   disclosed manual post-deploy step to populate two vault secrets. Claims validated the migration's
   SQL syntax/logic (idempotent job-creation guard, vault-based URL/auth-header construction,
   rerun-idempotency) against hand-built stub `cron`/`net`/`vault` schemas, NOT against a live
   `pg_cron`/`pg_net` install.
5. **Resend client — independently reimplemented, not imported from `send-invite/resend.ts`.**
   Claims the same fail-closed `RESEND_SEND_MODE` gate design (defaults to `'test'` for anything
   other than the exact string `'production'`).
6. **Flagged, disclosed ambiguity**: `notification_prefs.digest_enabled` vs. `weekly_digest` — claims
   weekly-digest is gated on `weekly_digest` only (not `digest_enabled`, whose purpose isn't
   specified anywhere available to this task), flagged for checker/T052 resolution.
7. **Other disclosed judgment calls**: dedupe is check-then-act, not atomic (no unique constraint on
   `email_log`, adding one is out of scope); `findExisting` fails closed (skips the send) on a query
   error, trading a rare missed reminder for never risking a duplicate.
8. Claims 54/54 `deno test` passing (real Deno 2.9.3, found pre-installed), `deno check` 0 errors,
   `deno lint` 1 finding matching an already-accepted convention in `send-invite`/`checkin`. Repo-wide
   npm toolchain (`build`/`typecheck`/`lint`/`test`) confirmed unaffected (excludes
   `supabase/functions/**`).

## Required Verification Steps
1. **Read every file under `supabase/functions/send-reminders/` and the new `_cron.sql` migration
   in full** — do not rely on the worker's module docs or this packet's paraphrasing.
2. **Dedupe — the single most important check in this packet.** Independently reproduce the
   re-run-same-tuple proof yourself (invoke twice/thrice, assert exactly one send/row) for BOTH key
   shapes. Try one adversarial case beyond the worker's own tests if you have capacity (e.g. two
   DIFFERENT recipients for the identical session+template — must NOT be deduped against each
   other).
3. **Due-window boundaries — reproduce or independently verify** the inclusive-lower/exclusive-upper
   boundary tests, and the weekly-digest Sunday-5pm-CT DST cases (summer and winter).
4. **Recipient expansion + prefs filtering — confirm by source read** these are genuinely two
   distinct, correctly-ordered steps, and that a recipient with no `notification_prefs` row defaults
   to receiving (not skipped).
5. **`pg_cron`/`pg_net`/Vault migration — read the SQL yourself.** Confirm it's genuinely additive
   (no `alter`/`drop`), confirm no real secret value appears anywhere in the file (only Vault
   references/`Deno.env.get`-equivalent SQL functions), and render your own explicit verdict on
   whether the disclosed "unverified against a live install" caveat is honestly and clearly stated
   (not overclaimed as tested).
6. **Resend client reimplementation — confirm it matches T048's fail-closed gate design** (read
   `send-invite/resend.ts` yourself for comparison, read-only) without being a literal copy-paste
   that could drift silently — same env var names, same default-to-test behavior.
7. **`notification_prefs.digest_enabled` ambiguity — render your own explicit verdict** on whether
   gating weekly-digest on `weekly_digest` alone (not `digest_enabled`) is the more defensible
   reading given the schema, or whether this should be escalated as a dispute.
8. **Secret hygiene (constitution item 5, BLOCKER-class)** — grep for `RESEND_API_KEY`/
   `SUPABASE_SERVICE_ROLE_KEY` and confirm both are read only via `Deno.env.get`, never
   hardcoded/logged.
9. **Re-run tests/typecheck yourself** (Deno if available, else the worker's disclosed substitute
   reproduced independently) — don't accept "54/54" without your own run.
10. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 7 (BLOCKER-class): dedupe is a correctness requirement, not an optimization; test-mode-only
  sending until T052's human sign-off. *(Cited because both halves of this exact task's own PRD text
  are BLOCKER-class.)*
- Item 5 (BLOCKER-class): no secrets/service-role keys hardcoded anywhere.
- Item 10: database changes are additive migrations only. *(Cited for the new `_cron.sql` file.)*

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the dedupe safety property (both key shapes)
- explicit verdict on the `pg_cron`/`pg_net`/Vault migration's honesty about being unverified live
- explicit verdict on the `digest_enabled`-vs-`weekly_digest` ambiguity resolution
- required rework if failed
- follow-up tasks if passed with minor issues
