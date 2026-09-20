import { haversineDistanceMeters, type Coordinate } from '../geo/distance';
import type { TFunc } from '../../i18n';

// Public OSM-hosted OSRM instance with a foot profile (no API key).
const ROUTING_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

export interface WalkingRoute {
  coordinates: Array<[number, number]>;
  distanceMeters: number;
  durationSeconds: number;
}

interface OsrmResponse {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: Array<[number, number]> };
  }>;
}

export function parseWalkingRoute(json: OsrmResponse): WalkingRoute {
  const route = json.routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (json.code !== 'Ok' || !route || !coordinates || coordinates.length < 2) {
    throw new Error(`no walking route (${json.code ?? 'unknown'})`);
  }
  return {
    coordinates,
    distanceMeters: route.distance ?? 0,
    durationSeconds: route.duration ?? 0,
  };
}

export async function fetchWalkingRoute(
  from: Coordinate,
  to: Coordinate,
  fetchImpl: typeof fetch = fetch
): Promise<WalkingRoute> {
  const url = `${ROUTING_URL}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`routing responded with ${response.status}`);
  return parseWalkingRoute((await response.json()) as OsrmResponse);
}

// Shortest distance from a point to the route's vertices; enough to detect walking off the route.
export function distanceFromRoute(route: WalkingRoute, point: Coordinate): number {
  let best = Infinity;
  for (const [lng, lat] of route.coordinates) {
    best = Math.min(best, haversineDistanceMeters(point, { lat, lng }));
  }
  return best;
}

// A walk of 5 min, or 1 h 20 min.
export function formatWalkingTime(t: TFunc, seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? t('unit.min', { n: minutes }) : t('unit.hourMin', { h: Math.floor(minutes / 60), m: minutes % 60 });
}
