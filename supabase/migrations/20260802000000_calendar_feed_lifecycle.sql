-- T195 + T194: provision one active calendar feed per profile and reset it
-- atomically. This migration is additive: historical feed rows are retained
-- and revoked rather than deleted.

-- Reconcile pre-existing duplicate active rows deterministically. The newest
-- (created_at, id) pair wins; every other active row remains as revoked audit
-- history.
with ranked_active_feeds as (
  select
    id,
    row_number() over (
      partition by profile_id
      order by created_at desc, id desc
    ) as active_rank
  from public.calendar_feeds
  where revoked_at is null
)
update public.calendar_feeds as feed
set revoked_at = now()
from ranked_active_feeds as ranked
where feed.id = ranked.id
  and ranked.active_rank > 1;

-- CAL-05: concurrency-safe enforcement of at most one active feed per
-- profile. Revoked rows are deliberately outside the index predicate.
create unique index if not exists calendar_feeds_one_active_per_profile_idx
  on public.calendar_feeds (profile_id)
  where revoked_at is null;

-- Profile creation may run on behalf of a different authenticated profile
-- (for example, a staff insert) and therefore cannot satisfy calendar_feeds'
-- self_all policy as the caller. This narrowly scoped trigger-only function
-- is the sole definer exception: it accepts no caller input, fully qualifies
-- application objects, and has a locked search path.
create or replace function public.fn_provision_calendar_feed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  insert into public.calendar_feeds (profile_id)
  values (new.id)
  on conflict (profile_id) where revoked_at is null do nothing;

  return new;
end;
$$;

revoke all on function public.fn_provision_calendar_feed() from public;

drop trigger if exists trg_provision_calendar_feed on public.profiles;
create trigger trg_provision_calendar_feed
  after insert on public.profiles
  for each row
  execute function public.fn_provision_calendar_feed();

-- Backfill every profile that predates the trigger. The partial-index conflict
-- target keeps this safe if a concurrent profile insert has already caused the
-- trigger to provision the same profile.
insert into public.calendar_feeds (profile_id)
select profile.id
from public.profiles as profile
where not exists (
  select 1
  from public.calendar_feeds as feed
  where feed.profile_id = profile.id
    and feed.revoked_at is null
)
on conflict (profile_id) where revoked_at is null do nothing;

-- Reset is one function call and therefore one PostgreSQL transaction. It is
-- explicitly SECURITY INVOKER so calendar_feeds.self_all remains an
-- authorization layer. The caller identity comes only from auth.uid(); no
-- profile id is accepted from the client.
create or replace function public.reset_calendar_feed(p_revoke_feed_id uuid)
returns setof public.calendar_feeds
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  v_profile_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to reset a calendar feed.'
      using errcode = '42501';
  end if;

  update public.calendar_feeds
  set revoked_at = now()
  where id = p_revoke_feed_id
    and profile_id = auth.uid()
    and revoked_at is null
  returning profile_id into v_profile_id;

  if not found then
    raise exception 'The active calendar feed was not found.'
      using errcode = 'P0002';
  end if;

  return query
    insert into public.calendar_feeds (profile_id)
    values (v_profile_id)
    returning *;
end;
$$;

revoke all on function public.reset_calendar_feed(uuid) from public;
revoke all on function public.reset_calendar_feed(uuid) from anon;
grant execute on function public.reset_calendar_feed(uuid) to authenticated;
