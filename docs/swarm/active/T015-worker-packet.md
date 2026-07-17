# Worker Packet: T015

## Task ID
T015

## Objective
Author (from scratch — no `supabase/config.toml` exists yet in this repo) a correct, secret-free Supabase local/project config enabling email/password auth and the Google OAuth provider, with public signup disabled (AUTH-01). Also ensure `.env.example` lists the two Vite Supabase env vars as blank placeholders.

## Dependencies (status)
T012 — Passed.

## Allowed Files
- `supabase/config.toml` (new file — verified via `ls supabase/` that it does not currently exist; create it following the standard Supabase CLI `config.toml` structure)
- `.env.example` (verify first whether this file already exists from T001 — run `ls -la` / `cat .env.example` yourself before assuming; if it exists, edit it additively, do not remove unrelated existing entries; if it doesn't exist, create it)

## Forbidden Files
- `docs/swarm/**`, `.claude/**`
- Any file containing real credentials, API keys, or OAuth client secrets — none may ever be committed (see constitution item 5 below)
- `.env` (the real, gitignored file) — you are never to create or populate this; only `.env.example` with blank placeholders

## External Blocker — read this before starting
George's Google Cloud OAuth client (with redirect URI = the Supabase auth callback) does not exist yet. **This task cannot be verified end-to-end / live-tested.** Scope your work to producing structurally correct, secret-free config that would work once George supplies real OAuth credentials via environment variables — not a live-tested integration. Do not fabricate a client ID/secret, even a placeholder-looking fake one, in `config.toml` itself; reference credentials via Supabase's `env(VAR_NAME)` config syntax so real secrets are supplied at deploy/runtime via environment, never committed.

## Acceptance Criteria
- `supabase/config.toml` created following the standard, well-documented Supabase CLI config.toml format:
  - `[auth]` section present, with `enable_signup = false` (AUTH-01 — public self-serve signup disabled)
  - Email/password provider enabled (`[auth.email]` section, `enable_signup` scoped correctly — note self-serve *public* signup being off does not mean email/password sign-*in* is disabled for already-invited users; email/password should remain a usable credential type for users created via invite, per T017/T019's invite flow — get this distinction right and explain your reasoning in worker output if the config format makes them the same toggle)
  - `[auth.external.google]` section present with `enabled = true`, `client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"` and `secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"` (or the exact equivalent current Supabase CLI env-reference syntax — verify the real syntax rather than guessing if you have any way to check, and flag if you're going on documented-format knowledge only) — no literal secret values anywhere in the file
  - `project_id` and other required top-level fields present per standard scaffold (a real `supabase init` output shape) even though `supabase init` itself may not be runnable in this sandbox — flag explicitly whether the Supabase CLI was actually available and whether you validated the file against it (a bonus, not a requirement) or authored it from documented format knowledge only
- `.env.example`: confirm whether it already exists (from T001) before editing. Must list `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` as blank placeholders (no real values), consistent with the project's existing `.env.example` pattern if one exists already — match its existing formatting/comment style rather than inventing a new one.
- No secrets in the repo anywhere (constitution item 5 — BLOCKER). Run `git grep` or equivalent for anything that looks like a real API key/secret pattern in your new/changed files and report the result.
- `.env*` gitignore status: confirm `.env` (not `.env.example`) is actually gitignored — check `.gitignore` yourself, do not assume; if `.env` is missing from `.gitignore`, flag this explicitly (you may not have `.gitignore` in your Allowed Files to fix it yourself — report it as a finding instead of editing a forbidden file).

## Relevant Constitution Excerpts
- Item 5: "No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER."
- Item 16: "Migration cutover ... production email enablement, and Vercel domain go-live require explicit approval from the human owner recorded in the ledger." (T015 is not itself a human gate, but note the general pattern: external-credential-blocked tasks are staged, not faked.)
- Non-Negotiable: "No worker may mark its own work complete."

## Most Recent Failure
None. This is the first attempt (attempt count: 0).

## Required Worker Output
- files changed (new vs. edited, and which)
- full contents of `supabase/config.toml`
- diff of `.env.example` (or full contents if newly created)
- explicit confirmation `.env.example` was checked for pre-existence before editing, and what was found
- git-grep-for-secrets output
- `.gitignore` check result for `.env`
- explicit statement on whether Supabase CLI tooling was available/used to validate the file, or whether it was authored from documented format knowledge only
- known risks (including the standing external-blocker note — end-to-end verification is not possible until George's Google OAuth client exists)
- whether a dispute is needed
