-- In-app notification centre. Today's only type is 'follow' ("X started following you"); new types are added by
-- extending the check below. Clients only read: rows are written by triggers, the way messages go through functions.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('follow')),
  actor_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  -- follow, unfollow, follow again leaves one notification, not a stream of them
  unique (user_id, type, actor_id)
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Own rows only; needed so Realtime delivers my own inserts. No insert/update/delete policy.
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.notifications from public, anon;
grant select on public.notifications to authenticated;

-- A new follow creates the notification for the person followed. follow_player already checked that the target is
-- public and not blocked; visibility of the actor is checked again at read time.
create or replace function public.notify_new_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, actor_id)
  values (new.followee_id, 'follow', new.follower_id)
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.notify_new_follow() from public, anon;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_new_follow();

-- My notifications, newest first. Actors whose profile is hidden, who are blocked, or who have a block with me are left out.
create or replace function public.my_notifications(max_rows integer default 50)
returns table (
  id uuid,
  type text,
  actor_id uuid,
  display_name text,
  avatar_path text,
  i_follow boolean,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id,
         n.type,
         n.actor_id,
         p.display_name,
         p.avatar_path,
         exists (
           select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = n.actor_id
         ) as i_follow,
         n.created_at,
         n.read_at
  from public.notifications n
  join public.player_profiles p on p.user_id = n.actor_id and p.is_public and not p.blocked
  where n.user_id = auth.uid()
    and not public.blocked_between(auth.uid(), n.actor_id)
  order by n.created_at desc
  limit greatest(1, least(coalesce(max_rows, 50), 100));
$$;

revoke all on function public.my_notifications(integer) from public, anon;
grant execute on function public.my_notifications(integer) to authenticated;

create or replace function public.unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.notifications n
  join public.player_profiles p on p.user_id = n.actor_id and p.is_public and not p.blocked
  where n.user_id = auth.uid()
    and n.read_at is null
    and not public.blocked_between(auth.uid(), n.actor_id);
$$;

revoke all on function public.unread_notification_count() from public, anon;
grant execute on function public.unread_notification_count() to authenticated;

create or replace function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Required for the client to subscribe to INSERT events on this table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

/* Checks to run by hand after applying (as the SQL editor's postgres role):
   -- anon must not execute any of the three RPCs (all three rows false)
   select has_function_privilege('anon', 'public.my_notifications(integer)', 'execute'),
          has_function_privilege('anon', 'public.unread_notification_count()', 'execute'),
          has_function_privilege('anon', 'public.mark_notifications_read()', 'execute');
   -- one row per (recipient, actor) however many times someone follows again
   select user_id, actor_id, count(*) from public.notifications group by 1, 2 having count(*) > 1;  -- expect 0 rows
*/
