-- Blocks: mutual visibility control between players. Blocking removes any existing follow in
-- either direction and prevents a new one; it also hides the blocked player from the leaderboard
-- and from being looked up directly. friend_feed, my_followers, my_following and follow_state
-- need no changes here: they are all driven by the follows table, and a block always keeps that
-- table empty between the two players involved.

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- Row level security with no policies: direct access from clients is denied, same as follows.
alter table public.blocks enable row level security;

create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.block_player(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), target)
  on conflict do nothing;
  delete from public.follows
  where (follower_id = auth.uid() and followee_id = target)
     or (follower_id = target and followee_id = auth.uid());
end;
$$;

create or replace function public.unblock_player(target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = target;
$$;

create or replace function public.my_blocked(max_rows integer default 200)
returns table (user_id uuid, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_path
  from public.blocks b
  join public.player_profiles p on p.user_id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
  limit greatest(1, least(max_rows, 200));
$$;

drop function if exists public.leaderboard(integer);

create function public.leaderboard(max_rows integer default 50)
returns table (user_id uuid, display_name text, found_count bigint, rank bigint, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, c.n as found_count,
         rank() over (order by c.n desc) as rank, p.avatar_path
  from public.player_profiles p
  left join lateral (select count(*) as n from public.verified_places(p.user_id)) c on true
  where p.is_public and not p.blocked and not public.blocked_between(auth.uid(), p.user_id)
  order by c.n desc, p.display_name
  limit greatest(1, least(max_rows, 100));
$$;

create or replace function public.player_profile(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.player_profiles;
begin
  if public.blocked_between(auth.uid(), target) then
    return null;
  end if;
  select * into p from public.player_profiles where user_id = target and is_public and not blocked;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_path', p.avatar_path,
    'distance_km', public.server_distance_km(target),
    'countries', p.countries,
    'cities', p.cities,
    'updated_at', p.updated_at,
    'found_count', (select count(*) from public.verified_places(target)),
    'places', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', t.name, 'kind', t.kind, 'discovered_at', t.discovered_at,
               'country', p.place_regions -> t.osm_id ->> 'c',
               'city', nullif(p.place_regions -> t.osm_id ->> 't', '')
             ) order by t.discovered_at desc), '[]'::jsonb)
      from (
        select osm_id, name, kind, discovered_at
        from public.verified_places(target)
        order by discovered_at desc
        limit 1000
      ) t
    )
  );
end;
$$;

create or replace function public.follow_player(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  if public.blocked_between(auth.uid(), target) then
    raise exception 'profile not available' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.player_profiles p where p.user_id = target and p.is_public and not p.blocked
  ) then
    raise exception 'profile not available' using errcode = '22023';
  end if;
  if (select count(*) from public.follows where follower_id = auth.uid()) >= 500 then
    raise exception 'too many follows' using errcode = '22023';
  end if;
  insert into public.follows (follower_id, followee_id) values (auth.uid(), target)
  on conflict do nothing;
end;
$$;
