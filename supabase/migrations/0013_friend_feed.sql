-- Friend feed: the latest verified finds of the players you follow.
-- Nothing new is stored: it is read from discovered_places through verified_places, so only finds
-- with a saved point nearby count, and only players with a public, unblocked profile are shown.
-- At most 10 recent finds per followed player, newest first.

create or replace function public.friend_feed(max_rows integer default 50)
returns table (user_id uuid, display_name text, avatar_path text, place_name text, kind text, discovered_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_path, v.name, v.kind, v.discovered_at
  from public.follows f
  join public.player_profiles p on p.user_id = f.followee_id and p.is_public and not p.blocked
  cross join lateral (
    select w.name, w.kind, w.discovered_at
    from public.verified_places(f.followee_id) w
    order by w.discovered_at desc
    limit 10
  ) v
  where f.follower_id = auth.uid()
  order by v.discovered_at desc
  limit greatest(1, least(max_rows, 100));
$$;
