import type { SupabaseClient } from '@supabase/supabase-js';

export interface VisitedPoint {
  lat: number;
  lng: number;
  radius: number;
  ts: number;
}

interface VisitedPointRow {
  lat: number;
  lng: number;
  radius: number;
  created_at: string;
}

const FETCH_PAGE_SIZE = 1000;

export async function fetchVisitedPoints(
  client: SupabaseClient,
  userId: string
): Promise<VisitedPoint[]> {
  const rows: VisitedPointRow[] = [];
  let offset = 0;

  // PostgREST caps unbounded selects (commonly at 1000 rows), which would
  // silently truncate a long-term user's history in arbitrary order. Order
  // deterministically and page through in fixed-size batches until a batch
  // comes back short.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await client
      .from('visited_points')
      .select('lat, lng, radius, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .range(offset, offset + FETCH_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data ?? []) as VisitedPointRow[];
    rows.push(...page);

    if (page.length < FETCH_PAGE_SIZE) break;
    offset += FETCH_PAGE_SIZE;
  }

  return rows.map((row) => ({
    lat: row.lat,
    lng: row.lng,
    radius: row.radius,
    ts: Date.parse(row.created_at),
  }));
}

export async function insertVisitedPoints(
  client: SupabaseClient,
  userId: string,
  points: VisitedPoint[]
): Promise<void> {
  if (points.length === 0) return;

  const rows = points.map((p) => ({
    user_id: userId,
    lat: p.lat,
    lng: p.lng,
    radius: p.radius,
  }));

  const { error } = await client.from('visited_points').insert(rows);
  if (error) throw error;
}
