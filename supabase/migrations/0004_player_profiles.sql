-- Opt-in public profiles and the leaderboard.
-- Other players never read visited_points; they only see what is exposed by the two functions below.

create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  is_public boolean not null default false,
  distance_km double precision not null default 0,
  countries jsonb not null default '[]'::jsonb,
  cities jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index if not exists player_profiles_display_name_key
  on public.player_profiles (lower(display_name));

alter table public.player_profiles enable row level security;

create policy "Users can read their own profile"
  on public.player_profiles for select
  using (auth.uid() = user_id);

create policy "Users can create their own profile"
  on public.player_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profile"
  on public.player_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own profile"
  on public.player_profiles for delete
  using (auth.uid() = user_id);

-- Ranking by found places, counted from discovered_places (not trusted from the client).
create or replace function public.leaderboard(max_rows integer default 50)
returns table (user_id uuid, display_name text, found_count bigint, rank bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id,
         p.display_name,
         c.n as found_count,
         rank() over (order by c.n desc) as rank
  from public.player_profiles p
  left join lateral (
    select count(*) as n from public.discovered_places d where d.user_id = p.user_id
  ) c on true
  where p.is_public
  order by c.n desc, p.display_name
  limit greatest(1, least(max_rows, 100));
$$;

-- One public player: aggregates and found places, never coordinates or trails.
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
  select * into p from public.player_profiles where user_id = target and is_public;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'distance_km', p.distance_km,
    'countries', p.countries,
    'cities', p.cities,
    'updated_at', p.updated_at,
    'found_count', (select count(*) from public.discovered_places where user_id = target),
    'places', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', t.name, 'kind', t.kind, 'discovered_at', t.discovered_at
             ) order by t.discovered_at desc), '[]'::jsonb)
      from (
        select name, kind, discovered_at
        from public.discovered_places
        where user_id = target
        order by discovered_at desc
        limit 200
      ) t
    )
  );
end;
$$;

revoke all on function public.leaderboard(integer) from public;
revoke all on function public.player_profile(uuid) from public;
grant execute on function public.leaderboard(integer) to authenticated;
grant execute on function public.player_profile(uuid) to authenticated;
