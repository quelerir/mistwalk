-- Player search by login (display_name). Only public, unblocked players; never yourself.
-- The private first/last name is deliberately not searchable.

create or replace function public.search_players(q text, max_rows integer default 20)
returns table (user_id uuid, display_name text, avatar_path text, i_follow boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  needle text := btrim(coalesce(q, ''));
  escaped text;
begin
  if auth.uid() is null or char_length(needle) < 2 then
    return;
  end if;
  -- login may contain "_", which is a LIKE wildcard: escape \, % and _
  escaped := replace(replace(replace(lower(needle), '\', '\\'), '%', '\%'), '_', '\_');

  return query
    select p.user_id,
           p.display_name,
           p.avatar_path,
           exists (
             select 1 from public.follows f
             where f.follower_id = auth.uid() and f.followee_id = p.user_id
           ) as i_follow
    from public.player_profiles p
    where p.is_public
      and not p.blocked
      and p.user_id <> auth.uid()
      and not public.blocked_between(auth.uid(), p.user_id)
      and lower(p.display_name) like '%' || escaped || '%'
    order by (lower(p.display_name) like escaped || '%') desc, lower(p.display_name)
    limit greatest(1, least(coalesce(max_rows, 20), 20));
end;
$$;

-- Supabase grants EXECUTE to anon separately from PUBLIC (see 0017): revoke both.
revoke all on function public.search_players(text, integer) from public, anon;
grant execute on function public.search_players(text, integer) to authenticated;
