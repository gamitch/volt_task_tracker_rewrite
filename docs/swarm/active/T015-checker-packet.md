# Checker Packet: T015

## Task ID
T015

## Objective
Independently verify worker-implementer's claim that `supabase/config.toml` (new) and `.env.example` (new/edited) correctly implement AUTH-01 (public signup disabled) plus email/password + Google OAuth provider config, with zero secrets committed. Do not trust any worker claim below without re-deriving it from the files on disk yourself.

## Allowed Files (for this task — used for the forbidden-file check, not as files you may edit)
- `supabase/config.toml` (new file)
- `.env.example` (new or edited)

No other files may have been touched by the worker.

## Acceptance Criteria (from task-ledger.md E3/T015 + worker packet)
- `[auth]` section: `enable_signup = false` (AUTH-01, project-wide master switch)
- `[auth.email]` section present, `enable_signup = false` at the provider-scoped level too (does not disable password sign-*in* for already-invited users — that's a separate operation)
- `[auth.external.google]` section: `enabled = true`, `client_id` and `secret` both supplied via `env(...)` references, no literal secret value anywhere
- `project_id` and standard top-level scaffold fields present, matching real `supabase init` output shape
- `.env.example` lists only `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` as blank placeholders
- No secrets anywhere in either file (constitution item 5 — BLOCKER if violated)
- `.env` (not `.env.example`) confirmed present in `.gitignore`

## Files to Inspect
- `/home/user/volt_task_tracker_rewrite/supabase/config.toml`
- `/home/user/volt_task_tracker_rewrite/.env.example`
- `/home/user/volt_task_tracker_rewrite/.gitignore`

## Verification Steps — Required

1. **Line-by-line settings confirmation.** Read both files directly (not the worker's summary). Confirm, citing line numbers:
   - `[auth]` block: `enable_signup = false`
   - `[auth.email]` block: `enable_signup = false`
   - `[auth.external.google]` block: `enabled = true`; `client_id = "env(...)"`; `secret = "env(...)"` — record the exact env var names used.

2. **Env var naming discrepancy — verify independently, do not just accept either party's claim.** The worker packet's own acceptance-criteria text (written by foreman) suggested `SUPABASE_AUTH_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_GOOGLE_SECRET` as an example, but explicitly allowed "the exact equivalent current Supabase CLI env-reference syntax" if verified. The worker instead used `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (matching the `auth.external.google` config path, i.e. `SUPABASE_<SECTION_PATH>` convention). Determine which naming is actually correct per the real Supabase CLI convention (attempt CLI reproduction per step 4 below, or cite documented convention if CLI is unavailable) and state explicitly whether the worker's deviation from the packet's example text was justified or is a defect.

3. **Secret-detection re-scan, independent.** Re-run your own grep/search across both files (do not just re-run the worker's exact commands verbatim — vary at least one pattern) for: AWS-style key patterns, generic long alphanumeric "key/secret/password/token = <value>" assignments, JWT-shaped strings (`ey...\...\...`), and any bare (non-`env(...)`) credential-looking value. Report exact commands and exact output (or confirm zero matches).

4. **`.env.example` content check.** Confirm it contains only `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` as blank placeholders and nothing else (no stray vars, no filled-in values).

5. **`.gitignore` coverage check.** Confirm `.env` is covered by an existing `.gitignore` pattern (exact match or glob) and that `.env.example` is NOT matched by any pattern in the file (i.e. it will be committed). Quote the specific pattern(s) relied on.

6. **Supabase CLI validation reproduction.** Worker claims it downloaded/used a real Supabase CLI v2.109.1 to run `supabase init` and `supabase db diff --local` against this file, and that the file parses correctly (only fails at the expected Docker-unavailable step). Attempt to reproduce this yourself:
   - Check whether a `supabase` binary is available on PATH or in any cache/scratch location in this environment.
   - If available: re-run an equivalent validation (e.g. `supabase --version`, and a parse/lint-equivalent command) against the actual `supabase/config.toml` on disk and report exact commands/output.
   - If NOT available (e.g. it was a temp download since cleaned up): say so explicitly, do not fabricate a reproduction, and instead perform a rigorous manual structural review against known Supabase `config.toml` conventions (section names, key names, `env(...)` syntax, top-level `project_id` field, etc.) — state clearly in your output which method (CLI reproduction vs. manual review) was actually used.

7. **Severity verdict on `minimum_password_length = 8`.** The default CLI scaffold value is 6; the worker raised it to 8 unprompted, citing it as a minor judgment call/hardening. This is not mentioned in any literal acceptance criterion. Give an explicit severity classification (BLOCKER / MAJOR / MINOR / NIT / no-issue) per the constitution's Failure Severity rubric, with reasoning — does raising a password floor exceed the task's scope in a way that should block, or is it a reasonable in-scope hardening default that passes with at most a MINOR/NIT note?

8. **External blocker handling.** Confirm the worker did NOT fabricate or hardcode a fake/placeholder-looking Google client ID or secret anywhere in `config.toml`, and that `redirect_uri`/`skip_nonce_check` and other Google-provider fields are left in a state that would function correctly once George supplies real `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` env vars at runtime. This task cannot be live-tested against real Google OAuth — do not fail it for that; only fail it if the config itself is wrong or a secret was faked/committed.

## Forbidden Modification Check (run first, D001 standing rule)
Per the D001 ruling (dispute-log.md): forbidden-file checks must be done by comparing the current file tree directly against the Allowed Files list for this task — **never** by inspecting git commit/history or treating a bundled commit's contents as evidence of what this worker touched (git identity does not distinguish per-agent authorship in this environment, and foreman/hook-generated files may legitimately share a commit).

- Confirm the only files that exist/changed relative to this task's Allowed Files are `supabase/config.toml` and `.env.example`.
- Confirm no writes under `docs/swarm/**`, `.claude/**`, or any other forbidden path.
- Confirm `.env` itself (the real file) was not created.
- If any forbidden-file violation is found, classify as BLOCKER per constitution Non-Negotiables + Definition of Done.

## Relevant Constitution Excerpts
- Item 5 (Security & privacy): "No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER."
- Item 16 (Human gates): production email enablement / migration cutover / domain go-live require explicit human approval — not directly applicable to T015's config authoring, but confirms external-credential-blocked tasks are staged, not faked or live-tested without the human owner.
- Non-Negotiables: "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."
- Failure Severity rubric (BLOCKER/MAJOR/MINOR/NIT definitions) — use this to classify every finding, including the password-length deviation.

## Most Recent Failure
None. This is T015's first checker pass (attempt count: 0 going into this check).

## Required Checker Output
- PASS or FAIL
- Overall severity: BLOCKER, MAJOR, MINOR, or NIT (and per-finding severity if mixed)
- Files inspected (exact paths)
- Commands run (exact, including your independently-varied secret-detection greps)
- Exact findings for each of the 8 verification steps above, referencing line numbers
- Explicit statement of which method was used for step 6 (CLI reproduction vs. manual structural review) — no fabricated tool runs
- Explicit severity verdict for the `minimum_password_length = 8` deviation (step 7)
- Explicit confirmation (or violation report) for the D001-method forbidden-file check
- Required rework if failed
- Follow-up tasks if passed with MINOR/NIT issues noted
