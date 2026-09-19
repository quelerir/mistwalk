import { haversineDistanceMeters, type Coordinate } from '../geo/distance';

export const AREA_HALF_SIDE_KM = 2.5;
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 16;
export const REFRESH_DISTANCE_KM = 1.5;
export const MAX_PACK_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_ATTEMPT_INTERVAL_MS = 6 * 60 * 60 * 1000;

const KM_PER_DEGREE_LAT = 111.32;

// What we remember about a downloaded area (stored as the pack's metadata).
export interface AreaPack {
  styleUrl: string;
  center: Coordinate;
  createdAt: number;
}

// [west, south, east, north]
export function areaBounds(center: Coordinate, halfSideKm: number = AREA_HALF_SIDE_KM): [number, number, number, number] {
  const dLat = halfSideKm / KM_PER_DEGREE_LAT;
  const dLng = halfSideKm / (KM_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat];
}

export interface RefreshInput {
  position: Coordinate;
  now: number;
  styleUrl: string;
  packs: AreaPack[];
  onWifi: boolean;
  lastAttemptAt: number;
}

// Download a new area only on Wi-Fi, not more often than every few hours, and only when the map style has
// no fresh pack that still covers where you are.
export function shouldRefreshArea({ position, now, styleUrl, packs, onWifi, lastAttemptAt }: RefreshInput): boolean {
  if (!onWifi) return false;
  if (now - lastAttemptAt < MIN_ATTEMPT_INTERVAL_MS) return false;

  const newest = packs
    .filter((p) => p.styleUrl === styleUrl)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!newest) return true;
  if (now - newest.createdAt > MAX_PACK_AGE_MS) return true;
  return haversineDistanceMeters(position, newest.center) / 1000 > REFRESH_DISTANCE_KM;
}
