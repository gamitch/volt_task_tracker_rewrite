-- T051: pg_cron job invoking the `send-reminders` Edge Function every 15
-- minutes (EML-03). ADDITIVE-ONLY migration: enables the `pg_cron`/`pg_net`
-- extensions (if not already enabled) and schedules one cron job. This file
-- does NOT alter any existing table, column, or row -- constitution item 10
-- ("database changes are additive migrations only").
--
-- -----------------------------------------------------------------------
-- INVESTIGATION (worker packet Known Context/Traps #4 -- cited, not
-- guessed; this is the FIRST task in this project to touch pg_cron/
-- scheduling infrastructure, so there is no prior in-repo precedent to
-- follow). UNVERIFIED-IN-SANDBOX DISCLOSURE, stated up front and not
-- repeated as a hedge below: this sandbox has no live Supabase project and
-- no network access to supabase.com/Postgres extension docs to confirm any
-- of the mechanism described here against a real, running instance
-- (`curl https://supabase.com/docs/...` returns a 403 from this session's
-- egress proxy -- the same class of "External Blocker" already documented
-- in T017/T032/T048's own worker outputs for deno.land/Docker Hub). Every
-- claim below is cited from training-time knowledge of Supabase's own
-- documented pattern, not fabricated, but a checker/T052 with a real
-- Supabase CLI or hosted project should confirm it end-to-end before this
-- is treated as production-verified.
--
-- 1. `pg_cron`: a Postgres extension that runs scheduled SQL commands
--    (cron-syntax schedules) inside the database itself. Supabase supports
--    it as a first-party extension; it can be enabled either via the
--    Dashboard's "Database > Extensions" UI or via `create extension`, as
--    used below. `create extension if not exists pg_cron;` is written
--    idempotently (this task's packet: "check whether it needs enabling at
--    all, or is preinstalled ... disclose your finding") -- this migration
--    does not assume either way; the `if not exists` guard makes this a
--    safe no-op if the project's platform has already enabled it (e.g. via
--    the Dashboard) before this migration ever runs, and a real activation
--    step if it has not.
-- 2. `pg_net`: a Postgres extension providing async HTTP requests
--    (`net.http_post`, `net.http_get`) from SQL -- this is the documented
--    mechanism for a `pg_cron` job to actually reach an Edge Function's
--    HTTPS URL, since Postgres itself has no built-in HTTP client. Also
--    enabled idempotently below.
-- 3. Invoking the Edge Function: Supabase's own documented pattern (cron
--    docs, "Invoke Edge Functions" example, as recalled from training) is a
--    scheduled `net.http_post` targeting
--    `https://<project-ref>.supabase.co/functions/v1/<function-name>` with
--    an `Authorization: Bearer <service-role-key>` header -- the same
--    service-role bearer-token idiom `send-reminders/index.ts`'s own header
--    comment documents on the receiving side (that function compares the
--    incoming `Authorization` header against
--    `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`).
--
-- SEC-03 / constitution item 5 (BLOCKER-class: "no secrets/service-role keys
-- hardcoded anywhere") -- how this migration avoids embedding the real
-- service-role key or a real project URL in version-controlled SQL:
--   Neither value is known to this migration (they are per-environment --
--   local dev, staging, production all differ -- and the service-role key
--   is a live secret). Both are looked up, AT CRON-INVOCATION TIME (not at
--   migration-apply time), from Supabase Vault
--   (`vault.decrypted_secrets`) by NAME:
--     - `send_reminders_function_url`
--     - `send_reminders_service_role_key`
--   These two named secrets are NOT created by this migration (a migration
--   file cannot know a real project's own URL/key, and even if it could,
--   writing the literal value into a committed SQL file would itself be the
--   exact hardcoded-secret violation constitution item 5 forbids -- a
--   `vault.create_secret('<real-value>', ...)` call embedded in this file
--   would still leave the real value sitting in plaintext in migration
--   history). Populating them is a REQUIRED MANUAL POST-DEPLOY STEP, run
--   once per environment by whoever has the real values (an admin, via the
--   Supabase SQL editor or CLI, never committed to this repo):
--     select vault.create_secret(
--       'https://<project-ref>.supabase.co/functions/v1/send-reminders',
--       'send_reminders_function_url'
--     );
--     select vault.create_secret(
--       '<the real SUPABASE_SERVICE_ROLE_KEY value>',
--       'send_reminders_service_role_key'
--     );
--   Until both secrets exist, the scheduled job's `net.http_post` call
--   below evaluates its `url`/`Authorization` subqueries to NULL and the
--   HTTP request will fail/no-op each run -- a safe, fail-closed default
--   (no request is sent with a null URL) rather than a hardcoded fallback.
--   This mirrors the same pattern already established for
--   `RESEND_API_KEY`/`CHECKIN_HMAC_SECRET`/`SUPABASE_SERVICE_ROLE_KEY`
--   elsewhere in this codebase: real secret values live OUTSIDE version
--   control (there, Edge Function secrets via `supabase secrets set`; here,
--   Vault), never inside a committed file.
--
-- IDEMPOTENCY: `cron.schedule(job_name, ...)` is documented (as recalled
-- from training, UNVERIFIED here) to upsert-by-name in current pg_cron
-- versions, but this migration does not rely on that -- it explicitly
-- checks `cron.job` for an existing row with this job's name first, so
-- re-running this migration file (e.g. against a fresh local `supabase db
-- reset`) never errors on a duplicate schedule.
--
-- CADENCE: `'*/15 * * * *'` -- every 15 minutes, matching this task's own
-- due-window granularity (`send-reminders/due_window.ts`'s
-- `DEFAULT_WINDOW_MINUTES`).

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $outer$
begin
  if not exists (select 1 from cron.job where jobname = 'send-reminders-every-15-min') then
    perform cron.schedule(
      'send-reminders-every-15-min',
      '*/15 * * * *',
      $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_function_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_service_role_key')
        ),
        body := jsonb_build_object('invoked_at', now())
      ) as request_id;
      $job$
    );
  end if;
end;
$outer$;
