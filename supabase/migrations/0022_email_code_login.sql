-- Sign-in with a code from an email: an account can now arrive without a login.
-- login_chosen marks a profile whose owner has not picked a login yet; set_login is how they pick one.

alter table public.player_profiles
  add column if not exists login_chosen boolean not null default true;

-- Creates the profile when a person signs up. With a login and both names in the metadata (e-mail sign-up) it works as
-- before. Without them (a sign-in by code, or an old app version) it makes a private profile under a temporary login and
-- marks it as not chosen. A duplicate login still aborts an e-mail sign-up; every other failure is swallowed with a
-- warning, so a profile problem never blocks a sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  new_login text := btrim(coalesce(meta ->> 'login', ''));
  new_first text := btrim(coalesce(meta ->> 'first_name', ''));
  new_last text := btrim(coalesce(meta ->> 'last_name', ''));
  temp_login text;
begin
  if new_login <> '' and new_first <> '' and new_last <> ''
     and new_login ~ '^[A-Za-z0-9_]{3,20}$'
     and char_length(new_first) <= 40 and char_length(new_last) <= 40 then
    begin
      insert into public.player_profiles (user_id, display_name, is_public, first_name, last_name)
      values (new.id, new_login, true, new_first, new_last);
    exception
      when unique_violation then
        raise;                                 -- a taken login is the one thing that aborts the sign-up
      when others then
        raise warning 'handle_new_user: profile not created: %', sqlerrm;
    end;
    return new;
  end if;

  temp_login := 'p_' || substr(md5(random()::text || clock_timestamp()::text || new.id::text), 1, 10);
  begin
    insert into public.player_profiles (user_id, display_name, is_public, login_chosen)
    values (new.id, temp_login, false, false);
  exception
    when others then
      raise warning 'handle_new_user: temporary profile not created: %', sqlerrm;
  end;
  return new;
end;
$$;

-- Sets the caller's login (the name other players see) and publishes the profile.
-- Raises invalid_login, login_taken or no_profile.
create or replace function public.set_login(candidate text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if candidate is null or candidate !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_login';
  end if;
  if exists (
    select 1 from public.player_profiles p
    where lower(p.display_name) = lower(candidate) and p.user_id <> auth.uid()
  ) then
    raise exception 'login_taken';
  end if;

  update public.player_profiles
     set display_name = candidate, login_chosen = true, is_public = true, updated_at = now()
   where user_id = auth.uid();
  if not found then
    raise exception 'no_profile';
  end if;
exception
  when unique_violation then
    raise exception 'login_taken';             -- someone took it between the check and the update
end;
$$;

revoke all on function public.set_login(text) from public;
grant execute on function public.set_login(text) to authenticated;
