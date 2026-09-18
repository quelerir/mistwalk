create table if not exists public.discovered_places (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  osm_id text not null,
  name text not null,
  kind text not null,
  lat double precision not null,
  lng double precision not null,
  discovered_at timestamptz not null default now(),
  unique (user_id, osm_id)
);

alter table public.discovered_places enable row level security;

create policy "Users can read their own discovered places"
  on public.discovered_places for select
  using (auth.uid() = user_id);

create policy "Users can insert their own discovered places"
  on public.discovered_places for insert
  with check (auth.uid() = user_id);
