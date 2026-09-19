-- Follows: one-way subscriptions between players, like Instagram.
-- Clients never touch the table; they go through the functions below, which check that the target
-- has a public, unblocked profile. Lists only show players with such a profile.

create table if not exists public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);

-- Row level security with no policies: direct access from clients is denied.
alter table public.follows enable row level security;

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

create or replace function public.unfollow_player(target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.follows where follower_id = auth.uid() and followee_id = target;
$$;

-- How you and a player are connected, plus his public counters.
create or replace function public.follow_state(target uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'following', exists (select 1 from public.follows where follower_id = auth.uid() and followee_id = target),
    'follows_me', exists (select 1 from public.follows where follower_id = target and followee_id = auth.uid()),
    'followers', (
      select count(*) from public.follows f join public.player_profiles p on p.user_id = f.follower_id
      where f.followee_id = target and p.is_public and not p.blocked
    ),
    'following_count', (
      select count(*) from public.follows f join public.player_profiles p on p.user_id = f.followee_id
      where f.follower_id = target and p.is_public and not p.blocked
    )
  );
$$;

create or replace function public.my_followers(max_rows integer default 200)
returns table (user_id uuid, display_name text, avatar_path text, i_follow boolean, follows_me boolean, followed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_path,
         exists (select 1 from public.follows g where g.follower_id = auth.uid() and g.followee_id = p.user_id),
         true,
         f.created_at
  from public.follows f
  join public.player_profiles p on p.user_id = f.follower_id
  where f.followee_id = auth.uid() and p.is_public and not p.blocked
  order by f.created_at desc
  limit greatest(1, least(max_rows, 200));
$$;

create or replace function public.my_following(max_rows integer default 200)
returns table (user_id uuid, display_name text, avatar_path text, i_follow boolean, follows_me boolean, followed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_path,
         true,
         exists (select 1 from public.follows g where g.follower_id = p.user_id and g.followee_id = auth.uid()),
         f.created_at
  from public.follows f
  join public.player_profiles p on p.user_id = f.followee_id
  where f.follower_id = auth.uid() and p.is_public and not p.blocked
  order by f.created_at desc
  limit greatest(1, least(max_rows, 200));
$$;
