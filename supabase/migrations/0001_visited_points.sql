create table if not exists public.visited_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  radius double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists visited_points_user_id_idx on public.visited_points (user_id);

alter table public.visited_points enable row level security;

create policy "Users can read their own points"
  on public.visited_points for select
  using (auth.uid() = user_id);

create policy "Users can insert their own points"
  on public.visited_points for insert
  with check (auth.uid() = user_id);
