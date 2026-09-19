-- Leaderboard integrity: numbers come from the server, client-sent data is sanitised, and players can be reported.

alter table public.player_profiles add column if not exists blocked boolean not null default false;

create index if not exists visited_points_user_lat_lng_idx on public.visited_points (user_id, lat, lng);

-- Distance walked, computed from the player's own saved points. Jumps over 300 m and speeds over
-- 15 m/s (54 km/h) are ignored, so teleporting or driving does not count.
create or replace function public.server_distance_km(uid uuid)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(t.step), 0) / 1000
  from (
    select 6371000 * 2 * asin(sqrt(least(1,
             power(sin(radians(s.lat - s.plat) / 2), 2)
             + cos(radians(s.plat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - s.plng) / 2), 2)
           ))) as step,
           extract(epoch from (s.created_at - s.pts)) as dt
    from (
      select lat, lng, created_at,
             lag(lat) over w as plat, lag(lng) over w as plng, lag(created_at) over w as pts
      from public.visited_points
      where user_id = uid
      window w as (order by created_at)
    ) s
    where s.plat is not null
  ) t
  where t.step <= 300
    and ((t.dt > 0 and t.step / t.dt <= 15) or (t.dt <= 0 and t.step <= 50));
$$;

-- A found place only counts if the player has a saved point within roughly 170 m of it.
create or replace function public.verified_places(uid uuid)
returns setof public.discovered_places
language sql
stable
security definer
set search_path = public
as $$
  select d.*
  from public.discovered_places d
  where d.user_id = uid
    and exists (
      select 1 from public.visited_points v
      where v.user_id = uid
        and v.lat between d.lat - 0.0015 and d.lat + 0.0015
        and v.lng between d.lng - 0.0015 / greatest(cos(radians(d.lat)), 0.01)
                      and d.lng + 0.0015 / greatest(cos(radians(d.lat)), 0.01)
    );
$$;

-- Every write to a profile is cleaned: server distance, no links in names, bounded public lists,
-- and the moderation flag can only be changed by the reporting function.
create or replace function public.sanitize_profile()
returns trigger
language plpgsql
as $$
declare
  clean_countries jsonb;
  clean_cities jsonb;
begin
  if coalesce(current_setting('app.moderating', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.blocked := false;
    else
      new.blocked := old.blocked;
    end if;
  end if;

  new.display_name := btrim(new.display_name);
  if new.display_name ~* '(https?://|www\.|@|\.(com|ru|net|org|io)\y)' then
    raise exception 'display name not allowed' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'code', e ->> 'code',
           'name', left(coalesce(e ->> 'name', ''), 60),
           'percent', least(100, greatest(0, (e ->> 'percent')::numeric))
         )), '[]'::jsonb)
    into clean_countries
  from (
    select e from jsonb_array_elements(
      case when jsonb_typeof(new.countries) = 'array' then new.countries else '[]'::jsonb end
    ) e
    where (e ->> 'code') ~ '^[A-Z]{2}$' and (e ->> 'percent') ~ '^[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$'
    limit 250
  ) c;

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', left(coalesce(e ->> 'name', ''), 60),
           'percent', case when (e ->> 'percent') ~ '^[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$'
                           then least(100, (e ->> 'percent')::numeric) end,
           'exploredKm2', case when (e ->> 'exploredKm2') ~ '^[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$'
                               then least(100000, (e ->> 'exploredKm2')::numeric) else 0 end
         )), '[]'::jsonb)
    into clean_cities
  from (
    select e from jsonb_array_elements(
      case when jsonb_typeof(new.cities) = 'array' then new.cities else '[]'::jsonb end
    ) e
    where char_length(coalesce(e ->> 'name', '')) between 1 and 60
    limit 30
  ) c;

  new.countries := clean_countries;
  new.cities := clean_cities;
  new.distance_km := public.server_distance_km(new.user_id);
  return new;
end;
$$;

drop trigger if exists sanitize_profile_trigger on public.player_profiles;
create trigger sanitize_profile_trigger
  before insert or update on public.player_profiles
  for each row execute function public.sanitize_profile();

-- Reports: three different players reporting the same profile hide it until it is reviewed.
create table if not exists public.player_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('name', 'photo', 'other')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_id)
);

alter table public.player_reports enable row level security;

create or replace function public.report_player(target uuid, why text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  insert into public.player_reports (reporter_id, target_id, reason)
  values (auth.uid(), target, why)
  on conflict (reporter_id, target_id) do nothing;

  if (select count(distinct reporter_id) from public.player_reports where target_id = target) >= 3 then
    perform set_config('app.moderating', 'on', true);
    update public.player_profiles set blocked = true where user_id = target;
  end if;
end;
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
  where p.is_public and not p.blocked
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
               'name', t.name, 'kind', t.kind, 'discovered_at', t.discovered_at
             ) order by t.discovered_at desc), '[]'::jsonb)
      from (
        select name, kind, discovered_at
        from public.verified_places(target)
        order by discovered_at desc
        limit 200
      ) t
    )
  );
end;
$$;

revoke all on function public.server_distance_km(uuid) from public;
revoke all on function public.verified_places(uuid) from public;
revoke all on function public.leaderboard(integer) from public;
revoke all on function public.player_profile(uuid) from public;
revoke all on function public.report_player(uuid, text) from public;
grant execute on function public.leaderboard(integer) to authenticated;
grant execute on function public.player_profile(uuid) to authenticated;
grant execute on function public.report_player(uuid, text) to authenticated;
