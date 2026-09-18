create table if not exists public.poi_tiles (
  tile_key text primary key,
  pois jsonb not null,
  fetched_at timestamptz not null default now()
);

-- Only the pois edge function (service role) reads and writes this cache.
alter table public.poi_tiles enable row level security;
