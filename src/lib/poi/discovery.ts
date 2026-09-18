import { haversineDistanceMeters, type Coordinate } from '../geo/distance';
import type { Poi } from './types';

export const DISCOVERY_RADIUS_METERS = 40;

export function findNewlyDiscovered(
  position: Coordinate,
  pois: Poi[],
  discoveredIds: ReadonlySet<string>,
  radiusMeters: number = DISCOVERY_RADIUS_METERS
): Poi[] {
  return pois.filter(
    (poi) =>
      !discoveredIds.has(poi.id) &&
      haversineDistanceMeters(position, { lat: poi.lat, lng: poi.lng }) <= radiusMeters
  );
}

const DIRECTIONS = ['севернее', 'северо-восточнее', 'восточнее', 'юго-восточнее', 'южнее', 'юго-западнее', 'западнее', 'северо-западнее'];

export function bearingLabel(from: Coordinate, to: Coordinate): string {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRECTIONS[Math.round(deg / 45) % 8];
}
