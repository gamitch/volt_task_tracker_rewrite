-- T503: isolates the ONE number this script needs to assert BEFORE the
-- widening migration is applied (Student One's direct `rsvps` row count
-- under shipped RLS, expected 1) from psql's SET/RESET command tags and
-- the `set_config` call's own return value, so the shell script can parse
-- stdout as a single bare integer. Invoke with `psql -At` (tuples-only,
-- unaligned already set on the command line -- no `\pset` needed here).
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-200000000011', false);
\o
select count(*) from rsvps;
\o /dev/null
reset role;
\o
