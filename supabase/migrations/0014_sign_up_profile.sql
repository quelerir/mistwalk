-- Sign-up profile: a private first and last name, and the profile row created at sign-up from the auth metadata.
-- The login is the existing display_name (unique, shown to friends and in the leaderboard).

alter table public.player_profiles
  add column if not exists first_name text
    check (first_name is null or char_length(btrim(first_name)) between 1 and 40),
  add column if not exists last_name text
    check (last_name is null or char_length(btrim(last_name)) between 1 and 40);

-- Is this login free and well formed? Returns nothing but yes or no, so it exposes no profile data.
create or replace function public.login_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(candidate ~ '^[A-Za-z0-9_]{3,20}$', false)
     and not exists (
       select 1 from public.player_profiles p where lower(p.display_name) = lower(candidate)
     );
$$;

revoke all on function public.login_available(text) from public;
grant execute on function public.login_available(text) to anon, authenticated;

-- Creates the profile when a person signs up with a login and a name. An old app version signs up without them:
-- then nothing happens and the app makes its usual default profile. Only a duplicate login can make it fail.
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
begin
  if new_login = '' or new_first = '' or new_last = '' then
    return new;
  end if;
  if new_login !~ '^[A-Za-z0-9_]{3,20}$' or char_length(new_first) > 40 or char_length(new_last) > 40 then
    return new;
  end if;

  insert into public.player_profiles (user_id, display_name, is_public, first_name, last_name)
  values (new.id, new_login, true, new_first, new_last);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
