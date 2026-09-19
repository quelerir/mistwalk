export type AccuracyProfile = 'battery-saver' | 'precise';

export const DISTANCE_INTERVAL_METERS: Record<AccuracyProfile, number> = {
  'battery-saver': 75,
  precise: 25,
};

const STORAGE_KEY = 'settings.accuracyProfile.v1';

export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export async function getAccuracyProfile(storage: KeyValueStorage): Promise<AccuracyProfile> {
  const raw = await storage.getItem(STORAGE_KEY);
  return raw === 'precise' ? 'precise' : 'battery-saver';
}

const listeners = new Set<(profile: AccuracyProfile) => void>();

// Lets the tracking code react to a change from the menu without an app restart.
export function onAccuracyProfileChange(listener: (profile: AccuracyProfile) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function setAccuracyProfile(
  storage: KeyValueStorage,
  profile: AccuracyProfile
): Promise<void> {
  await storage.setItem(STORAGE_KEY, profile);
  listeners.forEach((listener) => listener(profile));
}
