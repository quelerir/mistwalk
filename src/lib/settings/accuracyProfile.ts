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

export async function setAccuracyProfile(
  storage: KeyValueStorage,
  profile: AccuracyProfile
): Promise<void> {
  await storage.setItem(STORAGE_KEY, profile);
}
