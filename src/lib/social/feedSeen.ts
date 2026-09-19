import type { KeyValueStorage } from '../settings/accuracyProfile';

const KEY = 'feed.lastSeen.v1';

// When the feed was last opened; finds newer than this count as new.
export async function getFeedSeen(storage: Pick<KeyValueStorage, 'getItem'>): Promise<number> {
  const raw = await storage.getItem(KEY);
  const value = raw ? Number(raw) : 0;
  return Number.isFinite(value) ? value : 0;
}

export async function setFeedSeen(storage: Pick<KeyValueStorage, 'setItem'>, ts: number): Promise<void> {
  await storage.setItem(KEY, String(ts));
}
