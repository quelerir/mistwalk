import type { KeyValueStorage } from './accuracyProfile';

const KEY = 'settings.weatherFog.v1';

// On unless the player turned it off.
export async function getWeatherFog(storage: Pick<KeyValueStorage, 'getItem'>): Promise<boolean> {
  return (await storage.getItem(KEY)) !== 'off';
}

export async function setWeatherFog(storage: Pick<KeyValueStorage, 'setItem'>, enabled: boolean): Promise<void> {
  await storage.setItem(KEY, enabled ? 'on' : 'off');
}
