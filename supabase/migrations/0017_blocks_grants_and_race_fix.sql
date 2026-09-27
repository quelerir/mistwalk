-- Fixes two issues found in review of 0016_blocks.sql:
--
-- 1. 0016 dropped and recreated leaderboard() to add the block filter, but never restored the
--    revoke/grant that 0004/0005/0006 applied after every previous redefinition. That left
--    leaderboard() executable by the anon role (Postgres's default grant to PUBLIC), so an
--    unauthenticated caller could read the full public leaderboard. Also locks down the new
--    blocks functions the same way the rest of this schema locks down player-data functions,
--    since blocked_between(a, b) otherwise lets any caller probe whether two arbitrary users
--    have blocked each other.
--
-- 2. A follow created concurrently with a block (B follows A the same moment A blocks B) can
--    commit a follows row between an already-blocked pair, because follow_player's block check
--    and block_player's follow-row delete can't see each other's uncommitted work. Rather than
--    take a lock, friend_feed/my_followers/my_following/follow_state now filter on
--    blocked_between the same way leaderboard and player_profile already do, so a stray row like
--    that (or one from any other race) never becomes visible while a block exists between the
--    two users, regardless of how it got there.

revoke all on function public.leaderboard(integer) from public;
grant execute on function public.leaderboard(integer) to authenticated;

revoke all on function public.blocked_between(uuid, uuid) from public;

revoke all on function public.block_player(uuid) from public;
grant execute on function public.block_player(uuid) to authenticated;

revoke all on function public.unblock_player(uuid) from public;
grant execute on function public.unblock_player(uuid) to authenticated;

revoke all on function public.my_blocked(integer) from public;
grant execute on function public.my_blocked(integer) to authenticated;

create or replace function public.follow_state(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if public.blocked_between(auth.uid(), target) then
    return jsonb_build_object('following', false, 'follows_me', false, 'followers', 0, 'following_count', 0);
  end if;
  return jsonb_build_object(
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
end;
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
    and not public.blocked_between(auth.uid(), f.follower_id)
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
    and not public.blocked_between(auth.uid(), f.followee_id)
  order by f.created_at desc
  limit greatest(1, least(max_rows, 200));
$$;

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
  where f.follower_id = auth.uid() and not public.blocked_between(auth.uid(), f.followee_id)
  order by v.discovered_at desc
  limit greatest(1, least(max_rows, 100));
$$;
