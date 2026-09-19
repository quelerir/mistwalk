import type { KeyValueStorage } from './accuracyProfile';

export type FogStyle = 'ink' | 'mist' | 'night';

export const FOG_STYLES: FogStyle[] = ['ink', 'mist', 'night'];

export interface FogPalette {
  base: string;
  light: string;
  shadow: string;
}

// Cloud-like fog: `base` fills the map, `light` and `shadow` tint the billows drawn on top.
export const FOG_PALETTES: Record<FogStyle, FogPalette> = {
  mist: { base: '#dfe5ec', light: '#ffffff', shadow: '#9fb0c4' },
  ink: { base: '#3b404d', light: '#7b8394', shadow: '#0c0e15' },
  night: { base: '#1c3068', light: '#4f74c4', shadow: '#050b24' },
};

export const FOG_COLORS: Record<FogStyle, string> = {
  ink: FOG_PALETTES.ink.base,
  mist: FOG_PALETTES.mist.base,
  night: FOG_PALETTES.night.base,
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

const ANIMATED_KEY = 'settings.fogAnimated.v1';

export async function getFogAnimated(storage: Pick<KeyValueStorage, 'getItem'>): Promise<boolean> {
  return (await storage.getItem(ANIMATED_KEY)) !== 'off';
}

export async function setFogAnimated(
  storage: Pick<KeyValueStorage, 'setItem'>,
  animated: boolean
): Promise<void> {
  await storage.setItem(ANIMATED_KEY, animated ? 'on' : 'off');
}
