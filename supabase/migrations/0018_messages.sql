-- Direct messages between any two players (not limited to mutual follows). Unlike blocks/follows,
-- this table needs real RLS SELECT policies (not "enabled with no policies") because the chat
-- screen subscribes to it directly via Supabase Realtime, which enforces RLS using the caller's
-- own JWT rather than going through a security-definer function.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
-- Fetching one conversation's history orders by the pair regardless of who sent which message.
create index if not exists messages_pair_idx on public.messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at desc);

alter table public.messages enable row level security;

create policy messages_select on public.messages
  for select
  using (
    (auth.uid() = sender_id or auth.uid() = recipient_id)
    and not public.blocked_between(sender_id, recipient_id)
  );

-- No insert/update/delete policy: writes go only through the functions below, which run as the
-- function owner and so bypass RLS, the same way block_player writes into public.blocks.
revoke all on public.messages from public, anon;
grant select on public.messages to authenticated;

create or replace function public.send_message(recipient uuid, body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_body text := trim(body);
  row public.messages;
begin
  if auth.uid() is null or auth.uid() = recipient then
    raise exception 'invalid recipient' using errcode = '22023';
  end if;
  if clean_body = '' or char_length(clean_body) > 2000 then
    raise exception 'invalid message' using errcode = '22023';
  end if;
  if public.blocked_between(auth.uid(), recipient) then
    raise exception 'profile not available' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = recipient) then
    raise exception 'profile not available' using errcode = '22023';
  end if;

  insert into public.messages (sender_id, recipient_id, body)
  values (auth.uid(), recipient, clean_body)
  returning * into row;

  return row;
end;
$$;

revoke all on function public.send_message(uuid, text) from public, anon;
grant execute on function public.send_message(uuid, text) to authenticated;

-- One row per other player, most recently active conversation first.
create or replace function public.conversations_list(max_rows integer default 50)
returns table (
  other_user_id uuid,
  display_name text,
  avatar_path text,
  last_body text,
  last_at timestamptz,
  last_from_me boolean,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select
      case when sender_id = auth.uid() then recipient_id else sender_id end as other_user_id,
      body,
      created_at,
      sender_id,
      read_at
    from public.messages
    where auth.uid() in (sender_id, recipient_id)
  ),
  latest as (
    select distinct on (other_user_id)
      other_user_id, body, created_at, sender_id
    from mine
    order by other_user_id, created_at desc
  )
  select
    l.other_user_id,
    p.display_name,
    p.avatar_path,
    l.body,
    l.created_at,
    l.sender_id = auth.uid(),
    (select count(*) from mine m where m.other_user_id = l.other_user_id and m.sender_id <> auth.uid() and m.read_at is null)
  from latest l
  join public.player_profiles p on p.user_id = l.other_user_id
  order by l.created_at desc
  limit greatest(1, least(max_rows, 200));
$$;

revoke all on function public.conversations_list(integer) from public, anon;
grant execute on function public.conversations_list(integer) to authenticated;

create or replace function public.mark_conversation_read(other uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
  set read_at = now()
  where recipient_id = auth.uid() and sender_id = other and read_at is null;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.unread_message_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.messages where recipient_id = auth.uid() and read_at is null;
$$;

revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;

-- Required for the client to subscribe to INSERT events on this table.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
