import { haversineDistanceMeters, type Coordinate } from '../geo/distance';
import type { Poi, PoiKind } from './types';

export type NearbySort = 'distance' | 'distance-desc' | 'name' | 'name-desc';

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

const byName = (a: NearbyItem, b: NearbyItem) => a.poi.name.localeCompare(b.poi.name, 'ru');
const byDistance = (a: NearbyItem, b: NearbyItem) => a.meters - b.meters;
const COMPARE: Record<NearbySort, (a: NearbyItem, b: NearbyItem) => number> = {
  distance: byDistance,
  'distance-desc': (a, b) => byDistance(b, a),
  name: byName,
  'name-desc': (a, b) => byName(b, a),
};

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
  items.sort(COMPARE[sort]);
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
