-- T020 NFR-02 RLS-denial test scaffolding: post-migration table grants.
--
-- Applied by `tests/rls/run.sh` AFTER `supabase/migrations/*.sql` (so the
-- tables already exist) and BEFORE `tests/rls/seed.sql`. See
-- `tests/rls/auth_stub.sql`'s trailing comment for why this is a separate
-- file rather than folded into that one.
--
-- Mirrors the real Supabase platform's default schema grants: SELECT/
-- INSERT/UPDATE/DELETE on every `public` table to `authenticated` (this
-- suite only ever runs SELECTs against `authenticated`, but the fuller grant
-- set is included for fidelity to the real platform's actual default
-- posture, not narrowed down to "just what today's assertions happen to
-- need"). RLS policies (unmodified, already applied by the migrations) are
-- what actually narrow visibility from here -- this grant alone does not
-- expose anything, since every table in scope already has
-- `enable row level security` plus real policies (T012, already Passed).
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
