import { haversineDistanceMeters, type Coordinate } from '../geo/distance';
import type { Poi, PoiKind } from './types';

export type NearbySort = 'distance' | 'name';

export interface NearbyItem {
  poi: Poi;
  meters: number;
}

export interface NearbyOptions {
  kind: PoiKind | 'all';
  sort: NearbySort;
  radiusMeters: number;
  limit: number;
}

function inRadius(
  origin: Coordinate,
  pois: Poi[],
  discoveredIds: ReadonlySet<string>,
  radiusMeters: number
): NearbyItem[] {
  return pois
    .filter((p) => !discoveredIds.has(p.id))
    .map((p) => ({ poi: p, meters: haversineDistanceMeters(origin, p) }))
    .filter((item) => item.meters <= radiusMeters);
}

// The limit comes after the filter, so a rare kind is not cut off by many nearer places of another kind.
export function buildNearbyList(
  origin: Coordinate | null,
  pois: Poi[],
  discoveredIds: ReadonlySet<string>,
  { kind, sort, radiusMeters, limit }: NearbyOptions
): NearbyItem[] {
  if (!origin) return [];
  const items = inRadius(origin, pois, discoveredIds, radiusMeters).filter(
    (item) => kind === 'all' || item.poi.kind === kind
  );
  items.sort((a, b) =>
    sort === 'name' ? a.poi.name.localeCompare(b.poi.name, 'ru') : a.meters - b.meters
  );
  return items.slice(0, limit);
}

export function kindCounts(
  origin: Coordinate | null,
  pois: Poi[],
  discoveredIds: ReadonlySet<string>,
  radiusMeters: number
): Array<{ kind: PoiKind; count: number }> {
  if (!origin) return [];
  const counts = new Map<PoiKind, number>();
  for (const item of inRadius(origin, pois, discoveredIds, radiusMeters)) {
    counts.set(item.poi.kind, (counts.get(item.poi.kind) ?? 0) + 1);
  }
  return Array.from(counts, ([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count);
}
