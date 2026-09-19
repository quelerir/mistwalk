-- Player avatars: a public bucket (files are readable by everyone, writable only by their owner)
-- and an avatar path on the profile.

alter table public.player_profiles add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users can upload their own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can replace their own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete their own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop function if exists public.leaderboard(integer);

create function public.leaderboard(max_rows integer default 50)
returns table (user_id uuid, display_name text, found_count bigint, rank bigint, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, c.n as found_count,
         rank() over (order by c.n desc) as rank, p.avatar_path
  from public.player_profiles p
  left join lateral (
    select count(*) as n from public.discovered_places d where d.user_id = p.user_id
  ) c on true
  where p.is_public
  order by c.n desc, p.display_name
  limit greatest(1, least(max_rows, 100));
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
  select * into p from public.player_profiles where user_id = target and is_public;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_path', p.avatar_path,
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
