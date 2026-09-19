-- Unsent points are uploaded when the app starts, possibly weeks after they were recorded. Keep their
-- real capture time: accept anything from the last year, still never a time in the future.
create or replace function public.clamp_point_time()
returns trigger
language plpgsql
as $$
begin
  if new.created_at is null or new.created_at > now() or new.created_at < now() - interval '365 days' then
    new.created_at := now();
  end if;
  return new;
end;
$$;
