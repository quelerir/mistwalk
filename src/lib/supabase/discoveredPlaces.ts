import type { SupabaseClient } from '@supabase/supabase-js';
import type { DiscoveredPlace, PoiKind } from '../poi/types';

interface DiscoveredRow {
  osm_id: string;
  name: string;
  kind: PoiKind;
  lat: number;
  lng: number;
  discovered_at: string;
}

export async function fetchDiscoveredPlaces(
  client: SupabaseClient,
  userId: string
): Promise<DiscoveredPlace[]> {
  const { data, error } = await client
    .from('discovered_places')
    .select('osm_id, name, kind, lat, lng, discovered_at')
    .eq('user_id', userId);

  if (error) throw error;

  return ((data ?? []) as DiscoveredRow[]).map((row) => ({
    id: row.osm_id,
    name: row.name,
    kind: row.kind,
    lat: row.lat,
    lng: row.lng,
    discoveredAt: Date.parse(row.discovered_at),
  }));
}

export async function upsertDiscoveredPlaces(
  client: SupabaseClient,
  userId: string,
  places: DiscoveredPlace[]
): Promise<void> {
  if (places.length === 0) return;

  const rows = places.map((p) => ({
    user_id: userId,
    osm_id: p.id,
    name: p.name,
    kind: p.kind,
    lat: p.lat,
    lng: p.lng,
    discovered_at: new Date(p.discoveredAt).toISOString(),
  }));

  const { error } = await client
    .from('discovered_places')
    .upsert(rows, { onConflict: 'user_id,osm_id', ignoreDuplicates: true });
  if (error) throw error;
}
