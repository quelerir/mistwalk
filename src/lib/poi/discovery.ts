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
