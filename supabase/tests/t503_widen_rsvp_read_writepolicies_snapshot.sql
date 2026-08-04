-- T503 C5 snapshot: the two `rsvps` WRITE policies (`own_or_linked_write`,
-- `own_or_linked_update`, `20260717000002_rls.sql:205-212`), extracted
-- from `pg_policies` (not read off the migration source). Run once BEFORE
-- the widening migration and once AFTER it; the caller
-- (run_t503_widen_rsvp_read.sh) sha256-hashes both files and asserts the
-- pair is identical -- proof by execution that the additive read-only
-- migration left the write policies byte-identical, not an inference from
-- a clean `git diff`.
\o /dev/null
\pset format unaligned
\pset tuples_only on
\pset fieldsep ' | '
\o

\echo === rsvps write policies (own_or_linked_write, own_or_linked_update) ===
select policyname, cmd, permissive, roles::text, qual, with_check
from pg_policies
where tablename = 'rsvps' and policyname in ('own_or_linked_write', 'own_or_linked_update')
order by policyname;
