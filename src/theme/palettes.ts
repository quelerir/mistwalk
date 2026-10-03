export type ThemePreference = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface Colors {
  bg: string;
  card: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderStrong: string;
  chevron: string;
  accent: string;
  link: string;
  danger: string;
  buttonBg: string;
  buttonText: string;
  badgeBg: string;
  badgeFg: string;
  badgeHiddenBg: string;
  cityBadgeBg: string;
  sheetBg: string;
  sheetHandle: string;
  foundFill: string;
  foundBorder: string;
  foundIcon: string;
  accentSoft: string;
  marigold: string;
  shadow: string;
}

export const LIGHT: Colors = {
  bg: '#FBF9F5',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1EDE4',
  text: '#1C1B18',
  textMuted: '#766F62',
  textFaint: '#9A9384',
  border: 'rgba(30,25,15,0.09)',
  borderStrong: 'rgba(30,25,15,0.16)',
  chevron: '#B9B2A4',
  accent: '#4F6D96',
  link: '#4F6D96',
  danger: '#D6453D',
  buttonBg: '#1C1B18',
  buttonText: '#FFFFFF',
  badgeBg: 'rgba(79,109,150,0.13)',
  badgeFg: '#4F6D96',
  badgeHiddenBg: '#F1EDE4',
  cityBadgeBg: 'rgba(79,109,150,0.13)',
  sheetBg: '#FFFFFF',
  sheetHandle: '#DDD6C8',
  foundFill: '#FFFFFF',
  foundBorder: '#4F6D96',
  foundIcon: '#4F6D96',
  accentSoft: 'rgba(79,109,150,0.13)',
  marigold: '#F2A93B',
  shadow: '#1C1B18',
};

export const DARK: Colors = {
  bg: '#0F1115',
  card: '#181B21',
  surface: '#181B21',
  surfaceAlt: '#22262E',
  text: '#ECEEF2',
  textMuted: '#9097A3',
  textFaint: '#626977',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.16)',
  chevron: '#626977',
  accent: '#8FAAD1',
  link: '#8FAAD1',
  danger: '#FF7A7A',
  buttonBg: '#ECEEF2',
  buttonText: '#0F1115',
  badgeBg: 'rgba(143,170,209,0.16)',
  badgeFg: '#8FAAD1',
  badgeHiddenBg: '#22262E',
  cityBadgeBg: 'rgba(143,170,209,0.16)',
  sheetBg: '#181B21',
  sheetHandle: '#2F343D',
  foundFill: '#181B21',
  foundBorder: '#8FAAD1',
  foundIcon: '#8FAAD1',
  accentSoft: 'rgba(143,170,209,0.16)',
  marigold: '#F6BE5B',
  shadow: '#000000',
};

export const PALETTES: Record<ColorScheme, Colors> = { light: LIGHT, dark: DARK };

const ORDER: ThemePreference[] = ['system', 'light', 'dark'];

export function nextThemePreference(current: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
}

export function resolveScheme(preference: ThemePreference, system: ColorScheme): ColorScheme {
  return preference === 'system' ? system : preference;
}

export function parseThemePreference(raw: string | null): ThemePreference {
  return ORDER.includes(raw as ThemePreference) ? (raw as ThemePreference) : 'system';
}
