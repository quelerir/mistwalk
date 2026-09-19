import type { KeyValueStorage } from './accuracyProfile';

const KEY = 'settings.weeklySummary.v1';

export async function getWeeklySummary(storage: Pick<KeyValueStorage, 'getItem'>): Promise<boolean> {
  return (await storage.getItem(KEY)) === 'on';
}

export async function setWeeklySummary(
  storage: Pick<KeyValueStorage, 'setItem'>,
  enabled: boolean
): Promise<void> {
  await storage.setItem(KEY, enabled ? 'on' : 'off');
}
