-- Country and city for each found place, so a player's page can be browsed by country like your own.
-- The place itself (name, kind, date) still comes from the verified server data; only the
-- region label is supplied by the client and is purely descriptive.

alter table public.player_profiles add column if not exists place_regions jsonb not null default '{}'::jsonb;

create or replace function public.sanitize_profile()
returns trigger
language plpgsql
as $$
declare
  clean_countries jsonb;
  clean_cities jsonb;
  clean_regions jsonb;
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
           'country', case when (e ->> 'country') ~ '^[A-Z]{2}$' then e ->> 'country' end,
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
    limit 200
  ) c;

  select coalesce(jsonb_object_agg(k, jsonb_build_object(
           'c', v ->> 'c',
           't', left(coalesce(v ->> 't', ''), 60)
         )), '{}'::jsonb)
    into clean_regions
  from (
    select key as k, value as v
    from jsonb_each(case when jsonb_typeof(new.place_regions) = 'object' then new.place_regions else '{}'::jsonb end)
    where key ~ '^(node|way|relation)/[0-9]+$'
      and jsonb_typeof(value) = 'object'
      and (value ->> 'c') ~ '^[A-Z]{2}$'
    limit 3000
  ) r;

  new.countries := clean_countries;
  new.cities := clean_cities;
  new.place_regions := clean_regions;
  new.distance_km := public.server_distance_km(new.user_id);
  return new;
end;
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

revoke all on function public.player_profile(uuid) from public;
grant execute on function public.player_profile(uuid) to authenticated;
