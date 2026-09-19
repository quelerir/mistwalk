import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ANDROID_SAFE_MODE } from '../lib/androidSafeMode';
import { routeBackgroundLocations } from '../lib/location/routeBackgroundLocations';
import { notifyIfNearby } from './placeNotifier';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

const PENDING_POINTS_STORAGE_KEY = 'backgroundLocationTask.pendingPoints.v1';

export type BackgroundLocationHandler = (
  coord: { lat: number; lng: number },
  accuracy: number
) => void | Promise<void>;

export interface PendingBackgroundPoint {
  lat: number;
  lng: number;
  ts: number;
}

let handler: BackgroundLocationHandler | null = null;

export function setBackgroundLocationHandler(fn: BackgroundLocationHandler): void {
  handler = fn;
}

async function appendPendingPoints(points: PendingBackgroundPoint[]): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_POINTS_STORAGE_KEY);
    const existing: PendingBackgroundPoint[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(
      PENDING_POINTS_STORAGE_KEY,
      JSON.stringify([...existing, ...points])
    );
  } catch (err) {
    console.warn('[backgroundLocationTask] failed to persist pending points', err);
  }
}

/**
 * Reads and clears the durable buffer of points captured by the background
 * task, for the foreground app to merge into the live ProgressStore on next
 * launch. Returns an empty array if nothing is pending or storage is
 * unreadable.
 */
export async function drainPendingBackgroundPoints(): Promise<PendingBackgroundPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_POINTS_STORAGE_KEY);
    await AsyncStorage.removeItem(PENDING_POINTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('[backgroundLocationTask] failed to drain pending points', err);
    return [];
  }
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[backgroundLocationTask]', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  if (!locations || locations.length === 0) return;

  // The live handler only exists while the app is mounted; in a headless
  // relaunch it is null, so unhandled points go to the durable buffer that the
  // foreground app drains on next launch. Points the live handler took are NOT
  // buffered, otherwise they would be recorded twice.
  await routeBackgroundLocations(
    locations.map((location) => ({
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 0,
      ts: Date.now(),
    })),
    handler,
    appendPendingPoints
  );

  const latest = locations[locations.length - 1].coords;
  await notifyIfNearby({ lat: latest.latitude, lng: latest.longitude });
});

export async function startBackgroundTracking(distanceIntervalMeters: number): Promise<void> {
  if (ANDROID_SAFE_MODE) return;
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
