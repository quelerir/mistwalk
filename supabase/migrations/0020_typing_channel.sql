-- Typing indicator: a private Realtime broadcast channel per pair of users, topic "typing:<idA>:<idB>".
-- Only the two users of the pair may listen or send, and not when there is a block between them.
-- Nothing is stored: broadcast messages are ephemeral.

-- blocked_between() is closed to direct calls (see 0017), so the policies go through this narrow wrapper:
-- it only ever answers about the caller's own pair.
create or replace function public.typing_topic_allowed(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
begin
  if auth.uid() is null
     or topic is null
     or topic !~ '^typing:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  a := split_part(topic, ':', 2)::uuid;
  b := split_part(topic, ':', 3)::uuid;
  return a <> b
     and auth.uid() in (a, b)
     and not public.blocked_between(a, b);
end;
$$;

revoke all on function public.typing_topic_allowed(text) from public, anon;
grant execute on function public.typing_topic_allowed(text) to authenticated;

drop policy if exists "typing: pair can listen" on realtime.messages;
create policy "typing: pair can listen"
  on realtime.messages for select to authenticated
  using (realtime.messages.extension = 'broadcast' and public.typing_topic_allowed(realtime.topic()));

drop policy if exists "typing: pair can send" on realtime.messages;
create policy "typing: pair can send"
  on realtime.messages for insert to authenticated
  with check (realtime.messages.extension = 'broadcast' and public.typing_topic_allowed(realtime.topic()));
