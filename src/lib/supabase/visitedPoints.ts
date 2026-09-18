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

export async function fetchVisitedPoints(
  client: SupabaseClient,
  userId: string
): Promise<VisitedPoint[]> {
  const { data, error } = await client
    .from('visited_points')
    .select('lat, lng, radius, created_at')
    .eq('user_id', userId);

  if (error) throw error;

  return (data as VisitedPointRow[]).map((row) => ({
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
