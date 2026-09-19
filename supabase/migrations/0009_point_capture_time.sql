-- Points now arrive with their capture time (created_at). Keep it honest: never in the future, and
-- not older than a week, so the speed check in server_distance_km cannot be gamed with odd dates.
create or replace function public.clamp_point_time()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null or new.created_at > now() or new.created_at < now() - interval '7 days' then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists clamp_point_time_trigger on public.visited_points;
create trigger clamp_point_time_trigger
  before insert on public.visited_points
  for each row execute function public.clamp_point_time();
