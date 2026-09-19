-- City entries may carry a Wikidata id (Q + digits) so other players' pages can show the coat of arms.

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
           'wikidata', case when (e ->> 'wikidata') ~ '^Q[0-9]{1,12}$' then e ->> 'wikidata' end,
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
