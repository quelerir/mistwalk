-- Points saved before 0009 carry the upload time of their batch, not the capture time, so the speed
-- check cannot be trusted for them. For those steps only jumps over 300 m are ignored; from
-- 2026-09-19 13:50 UTC on (capture time is sent) the speed limit applies to every step.
create or replace function public.server_distance_km(uid uuid)
returns double precision
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(t.step), 0) / 1000
  from (
    select 6371000 * 2 * asin(sqrt(least(1,
             power(sin(radians(s.lat - s.plat) / 2), 2)
             + cos(radians(s.plat)) * cos(radians(s.lat)) * power(sin(radians(s.lng - s.plng) / 2), 2)
           ))) as step,
           extract(epoch from (s.created_at - s.pts)) as dt,
           s.created_at
    from (
      select lat, lng, created_at,
             lag(lat) over w as plat, lag(lng) over w as plng, lag(created_at) over w as pts
      from public.visited_points
      where user_id = uid
      window w as (order by created_at, id)
    ) s
    where s.plat is not null
  ) t
  where t.step <= 300
    and (
      t.created_at < timestamptz '2026-09-19 13:50:00+00'
      or (t.dt > 0 and t.step / t.dt <= 15)
      or (t.dt <= 0 and t.step <= 50)
    );
$$;
