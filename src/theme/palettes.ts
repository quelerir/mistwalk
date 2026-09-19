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
}

export const LIGHT: Colors = {
  bg: '#ffffff',
  card: '#ffffff',
  surface: '#f6f6f6',
  surfaceAlt: '#efefef',
  text: '#262626',
  textMuted: '#8e8e8e',
  textFaint: '#a8a8a8',
  border: '#dbdbdb',
  borderStrong: '#cccccc',
  chevron: '#c7c7c7',
  accent: '#2f80ff',
  link: '#2f6fdd',
  danger: '#ed4956',
  buttonBg: '#262626',
  buttonText: '#ffffff',
  badgeBg: '#eef1f6',
  badgeFg: '#3b4560',
  badgeHiddenBg: '#f3f3f3',
  cityBadgeBg: '#e8f0ff',
  sheetBg: '#ffffff',
  sheetHandle: '#d0d0d0',
  foundFill: '#262626',
  foundBorder: '#262626',
  foundIcon: '#ffffff',
};

export const DARK: Colors = {
  bg: '#0e1014',
  card: '#1a1d23',
  surface: '#1a1d23',
  surfaceAlt: '#262a31',
  text: '#f2f3f5',
  textMuted: '#98a0ab',
  textFaint: '#6b7280',
  border: '#2a2e36',
  borderStrong: '#3a3f49',
  chevron: '#5a606b',
  accent: '#4d94ff',
  link: '#6ea8ff',
  danger: '#ff6b78',
  buttonBg: '#f2f3f5',
  buttonText: '#111318',
  badgeBg: '#232a3a',
  badgeFg: '#b7c4e4',
  badgeHiddenBg: '#1f2229',
  cityBadgeBg: '#1d2a44',
  sheetBg: '#1a1d23',
  sheetHandle: '#3a3f49',
  foundFill: '#f2f3f5',
  foundBorder: '#f2f3f5',
  foundIcon: '#111318',
};

export const PALETTES: Record<ColorScheme, Colors> = { light: LIGHT, dark: DARK };

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная',
};

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
