-- Deterministic T195/T194 lifecycle and security assertions. Security-sensitive
-- operations explicitly SET ROLE authenticated/anon; superuser-only checks are
-- limited to setup and postcondition inspection.

grant select, insert, update, delete on all tables in schema public to authenticated, anon;
grant usage, select on all sequences in schema public to authenticated, anon;

do $$
declare
  v_active_count integer;
begin
  select count(*) into v_active_count
  from public.calendar_feeds
  where profile_id = '20000000-0000-4000-8000-000000000002'
    and revoked_at is null;

  if v_active_count <> 1 then
    raise exception 'FAIL existing-profile-backfill: expected 1 active feed, got %', v_active_count;
  end if;
  raise notice 'PASS existing-profile-backfill';
end;
$$;

do $$
declare
  v_total_count integer;
  v_active_count integer;
  v_revoked_count integer;
  v_active_id uuid;
begin
  select
    count(*),
    count(*) filter (where revoked_at is null),
    count(*) filter (where revoked_at is not null)
  into v_total_count, v_active_count, v_revoked_count
  from public.calendar_feeds
  where profile_id = '30000000-0000-4000-8000-000000000003';

  select id into v_active_id
  from public.calendar_feeds
  where profile_id = '30000000-0000-4000-8000-000000000003'
    and revoked_at is null;

  if v_total_count <> 3
    or v_active_count <> 1
    or v_revoked_count <> 2
    or v_active_id <> '70000000-0000-4000-8000-00000000a003'
  then
    raise exception
      'FAIL duplicate-active-reconciliation: total %, active %, revoked %, winner %',
      v_total_count, v_active_count, v_revoked_count, v_active_id;
  end if;
  raise notice 'PASS duplicate-active-reconciliation';
end;
$$;

-- Exercise the already-shipped invite-acceptance UPDATE trigger. The auth
-- platform performs this UPDATE in production, so the scratch platform owner
-- performs it here; the assertion covers its resulting profile + feed rows.
update auth.users
set email_confirmed_at = now()
where id = '60000000-0000-4000-8000-000000000006';

do $$
begin
  if not exists (
    select 1 from public.profiles
    where id = '60000000-0000-4000-8000-000000000006'
      and role = 'coach'
  ) or not exists (
    select 1 from public.calendar_feeds
    where profile_id = '60000000-0000-4000-8000-000000000006'
      and revoked_at is null
  ) or not exists (
    select 1 from public.invites
    where email = 'invitee.fixture@example.test'
      and status = 'accepted'
  ) then
    raise exception 'FAIL invite-acceptance-provisioning';
  end if;
  raise notice 'PASS invite-acceptance-provisioning';
end;
$$;

-- A real authenticated admin creates another profile. profiles.staff_all
-- authorizes the profile insert; the calendar insert must succeed only because
-- the trigger provisioner is the narrowly scoped SECURITY DEFINER function.
set role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', false);
insert into public.profiles (id, display_name, email, role)
values (
  '40000000-0000-4000-8000-000000000004',
  'Fixture Staff Created',
  'staff-created.fixture@example.test',
  'student'
);
reset role;

do $$
begin
  if (select count(*) from public.calendar_feeds
      where profile_id = '40000000-0000-4000-8000-000000000004'
        and revoked_at is null) <> 1 then
    raise exception 'FAIL authenticated-staff-cross-profile-provisioning';
  end if;
  raise notice 'PASS authenticated-staff-cross-profile-provisioning';
end;
$$;

-- A second post-migration profile insert proves the trigger is general rather
-- than coupled to the staff test above.
insert into public.profiles (id, display_name, email, role)
values (
  '50000000-0000-4000-8000-000000000005',
  'Fixture Future Profile',
  'future.fixture@example.test',
  'parent'
);

do $$
begin
  if (select count(*) from public.calendar_feeds
      where profile_id = '50000000-0000-4000-8000-000000000005'
        and revoked_at is null) <> 1 then
    raise exception 'FAIL future-profile-provisioning';
  end if;
  raise notice 'PASS future-profile-provisioning';
end;
$$;

do $$
begin
  begin
    insert into public.calendar_feeds (profile_id)
    values ('20000000-0000-4000-8000-000000000002');
    raise exception 'FAIL unique-active-row-invariant: second active row was accepted';
  exception
    when unique_violation then
      null;
  end;
  raise notice 'PASS unique-active-row-invariant';
end;
$$;

create temporary table owner_feed_before_reset as
select id
from public.calendar_feeds
where profile_id = '20000000-0000-4000-8000-000000000002'
  and revoked_at is null;
grant select on owner_feed_before_reset to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
do $$
declare
  v_returned_count integer;
begin
  select count(*) into v_returned_count
  from public.reset_calendar_feed((select id from owner_feed_before_reset));

  if v_returned_count <> 1 then
    raise exception 'FAIL authenticated-owner-reset: RPC returned % rows', v_returned_count;
  end if;
end;
$$;
reset role;

do $$
declare
  v_old_id uuid;
  v_active_count integer;
  v_total_count integer;
begin
  select id into v_old_id from owner_feed_before_reset;
  select
    count(*) filter (where revoked_at is null),
    count(*)
  into v_active_count, v_total_count
  from public.calendar_feeds
  where profile_id = '20000000-0000-4000-8000-000000000002';

  if v_active_count <> 1
    or v_total_count <> 2
    or not exists (
      select 1 from public.calendar_feeds where id = v_old_id and revoked_at is not null
    )
    or exists (
      select 1 from public.calendar_feeds where id = v_old_id and revoked_at is null
    )
  then
    raise exception
      'FAIL authenticated-owner-reset: active %, total %, old id %',
      v_active_count, v_total_count, v_old_id;
  end if;
  raise notice 'PASS authenticated-owner-reset';
end;
$$;

create temporary table cross_owner_snapshot as
select profile_id, id
from public.calendar_feeds
where profile_id in (
  '20000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003'
)
  and revoked_at is null;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
do $$
declare
  v_denied boolean := false;
begin
  begin
    perform public.reset_calendar_feed('70000000-0000-4000-8000-00000000a003');
  exception
    when sqlstate 'P0002' then
      v_denied := true;
  end;

  if not v_denied then
    raise exception 'FAIL cross-owner-reset-denied: another profile feed was reset';
  end if;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1
    from cross_owner_snapshot as before
    left join public.calendar_feeds as after
      on after.profile_id = before.profile_id
      and after.id = before.id
      and after.revoked_at is null
    where after.id is null
  ) or (select count(*) from cross_owner_snapshot) <> 2 then
    raise exception 'FAIL cross-owner-reset-denied: active feed state changed';
  end if;
  raise notice 'PASS cross-owner-reset-denied';
end;
$$;

create temporary table owner_active_after_reset as
select id
from public.calendar_feeds
where profile_id = '20000000-0000-4000-8000-000000000002'
  and revoked_at is null;

set role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', false);
do $$
declare
  v_revoked_denied boolean := false;
  v_missing_denied boolean := false;
begin
  begin
    perform public.reset_calendar_feed((select id from owner_feed_before_reset));
  exception
    when sqlstate 'P0002' then
      v_revoked_denied := true;
  end;

  begin
    perform public.reset_calendar_feed('ffffffff-ffff-4fff-8fff-ffffffffffff');
  exception
    when sqlstate 'P0002' then
      v_missing_denied := true;
  end;

  if not v_revoked_denied or not v_missing_denied then
    raise exception
      'FAIL revoked-and-nonexistent-reset-atomicity: revoked %, missing %',
      v_revoked_denied, v_missing_denied;
  end if;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.calendar_feeds
      where profile_id = '20000000-0000-4000-8000-000000000002'
        and revoked_at is null) <> 1
    or not exists (
      select 1
      from public.calendar_feeds as feed
      join owner_active_after_reset as snapshot on snapshot.id = feed.id
      where feed.revoked_at is null
    )
  then
    raise exception 'FAIL revoked-and-nonexistent-reset-atomicity: active state changed';
  end if;
  raise notice 'PASS revoked-and-nonexistent-reset-atomicity';
end;
$$;

do $$
declare
  v_public_execute boolean;
  v_is_security_definer boolean;
begin
  select
    exists (
      select 1
      from aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) as acl
      where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
    ),
    proc.prosecdef
  into v_public_execute, v_is_security_definer
  from pg_proc as proc
  where proc.oid = 'public.reset_calendar_feed(uuid)'::regprocedure;

  if not has_function_privilege(
      'authenticated', 'public.reset_calendar_feed(uuid)', 'EXECUTE'
    )
    or has_function_privilege('anon', 'public.reset_calendar_feed(uuid)', 'EXECUTE')
    or v_public_execute
    or v_is_security_definer
  then
    raise exception
      'FAIL rpc-privilege-boundary: authenticated %, anon %, public %, definer %',
      has_function_privilege('authenticated', 'public.reset_calendar_feed(uuid)', 'EXECUTE'),
      has_function_privilege('anon', 'public.reset_calendar_feed(uuid)', 'EXECUTE'),
      v_public_execute,
      v_is_security_definer;
  end if;
end;
$$;

set role anon;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare
  v_sqlstate text;
begin
  begin
    perform public.reset_calendar_feed('ffffffff-ffff-4fff-8fff-ffffffffffff');
    raise exception 'FAIL rpc-privilege-boundary: anon call unexpectedly succeeded';
  exception
    when others then
      get stacked diagnostics v_sqlstate = returned_sqlstate;
      if v_sqlstate <> '42501' then
        raise exception 'FAIL rpc-privilege-boundary: anon SQLSTATE %, wanted 42501', v_sqlstate;
      end if;
  end;
end;
$$;
reset role;

do $$
begin
  raise notice 'PASS rpc-privilege-boundary';
  raise notice 'Calendar feed lifecycle tests: ALL PASS';
end;
$$;
