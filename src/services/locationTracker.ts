import * as Location from 'expo-location';
import type { LocationObject, LocationSubscription } from 'expo-location';

export interface TrackerHandlers {
  onPoint: (coord: { lat: number; lng: number }, accuracy: number) => void;
}

export function toCoordinate(location: LocationObject): { lat: number; lng: number; accuracy: number } {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 0,
  };
}

export async function startForegroundTracking(
  handlers: TrackerHandlers,
  distanceIntervalMeters: number
): Promise<LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: distanceIntervalMeters,
    },
    (location) => {
      const { lat, lng, accuracy } = toCoordinate(location);
      handlers.onPoint({ lat, lng }, accuracy);
    }
  );
}

export function stopForegroundTracking(subscription: LocationSubscription | null): void {
  subscription?.remove();
}
