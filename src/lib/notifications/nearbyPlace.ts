import { haversineDistanceMeters, type Coordinate } from '../geo/distance';
import type { Poi } from '../poi/types';

export const NOTIFY_RADIUS_METERS = 150;
export const NOTIFY_COOLDOWN_MS = 3 * 60 * 60 * 1000;
export const PLACE_REPEAT_MS = 24 * 60 * 60 * 1000;

export interface NotifyState {
  lastAt: number;
  places: Record<string, number>;
}

export function pickPlaceToNotify(
  position: Coordinate,
  pois: Poi[],
  discoveredIds: ReadonlySet<string>,
  state: NotifyState,
  now: number
): Poi | null {
  if (now - state.lastAt < NOTIFY_COOLDOWN_MS) return null;

  let best: Poi | null = null;
  let bestDistance = Infinity;
  for (const poi of pois) {
    if (discoveredIds.has(poi.id)) continue;
    const told = state.places[poi.id];
    if (told !== undefined && now - told < PLACE_REPEAT_MS) continue;
    const distance = haversineDistanceMeters(position, { lat: poi.lat, lng: poi.lng });
    if (distance <= NOTIFY_RADIUS_METERS && distance < bestDistance) {
      best = poi;
      bestDistance = distance;
    }
  }
  return best;
}

export function recordNotified(state: NotifyState, poiId: string, now: number): NotifyState {
  const places: Record<string, number> = {};
  for (const [id, at] of Object.entries(state.places)) {
    if (now - at < PLACE_REPEAT_MS) places[id] = at;
  }
  places[poiId] = now;
  return { lastAt: now, places };
}
