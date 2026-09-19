import type { KeyValueStorage } from './accuracyProfile';

const KEY = 'settings.offlineMap.v1';

// On unless the player turned it off.
export async function getOfflineMap(storage: Pick<KeyValueStorage, 'getItem'>): Promise<boolean> {
  return (await storage.getItem(KEY)) !== 'off';
}

export async function setOfflineMap(storage: Pick<KeyValueStorage, 'setItem'>, enabled: boolean): Promise<void> {
  await storage.setItem(KEY, enabled ? 'on' : 'off');
}
