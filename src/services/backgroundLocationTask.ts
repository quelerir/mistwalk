import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

export type BackgroundLocationHandler = (
  coord: { lat: number; lng: number },
  accuracy: number
) => void | Promise<void>;

let handler: BackgroundLocationHandler | null = null;

export function setBackgroundLocationHandler(fn: BackgroundLocationHandler): void {
  handler = fn;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.warn('[backgroundLocationTask]', error.message);
    return;
  }
  if (!data || !handler) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  for (const location of locations) {
    void handler(
      { lat: location.coords.latitude, lng: location.coords.longitude },
      location.coords.accuracy ?? 0
    );
  }
});

export async function startBackgroundTracking(distanceIntervalMeters: number): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: distanceIntervalMeters,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Открытие карты активно',
      notificationBody: 'Приложение отслеживает перемещение, чтобы открывать карту',
    },
  });
}

export async function stopBackgroundTracking(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
