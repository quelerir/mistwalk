import type { KeyValueStorage } from './accuracyProfile';

export type FogStyle = 'ink' | 'mist' | 'night';

export const FOG_STYLES: FogStyle[] = ['ink', 'mist', 'night'];

export const FOG_COLORS: Record<FogStyle, string> = {
  ink: 'rgba(10, 12, 20, 0.85)',
  mist: 'rgba(225, 230, 238, 0.92)',
  night: 'rgba(8, 20, 60, 0.88)',
};

export const FOG_STYLE_LABELS: Record<FogStyle, string> = {
  ink: 'Чернила',
  mist: 'Дымка',
  night: 'Ночь',
};

const STORAGE_KEY = 'settings.fogStyle.v1';

export function nextFogStyle(current: FogStyle): FogStyle {
  return FOG_STYLES[(FOG_STYLES.indexOf(current) + 1) % FOG_STYLES.length];
}

export async function getFogStyle(storage: Pick<KeyValueStorage, 'getItem'>): Promise<FogStyle> {
  const raw = await storage.getItem(STORAGE_KEY);
  return FOG_STYLES.includes(raw as FogStyle) ? (raw as FogStyle) : 'ink';
}

export async function setFogStyle(
  storage: Pick<KeyValueStorage, 'setItem'>,
  style: FogStyle
): Promise<void> {
  await storage.setItem(STORAGE_KEY, style);
}
