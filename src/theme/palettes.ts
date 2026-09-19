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
  accent: '#178A5C',
  link: '#178A5C',
  danger: '#D6453D',
  buttonBg: '#178A5C',
  buttonText: '#FFFFFF',
  badgeBg: 'rgba(23,138,92,0.13)',
  badgeFg: '#178A5C',
  badgeHiddenBg: '#F1EDE4',
  cityBadgeBg: 'rgba(23,138,92,0.13)',
  sheetBg: '#FFFFFF',
  sheetHandle: '#DDD6C8',
  foundFill: '#FFFFFF',
  foundBorder: '#178A5C',
  foundIcon: '#178A5C',
  accentSoft: 'rgba(23,138,92,0.13)',
  marigold: '#F2A93B',
  shadow: '#1C1B18',
};

export const DARK: Colors = {
  bg: '#0D1411',
  card: '#16201B',
  surface: '#16201B',
  surfaceAlt: '#1F2B24',
  text: '#EAF3EE',
  textMuted: '#8FA69A',
  textFaint: '#5D7468',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.16)',
  chevron: '#5D7468',
  accent: '#4ADE9C',
  link: '#4ADE9C',
  danger: '#FF7A7A',
  buttonBg: '#4ADE9C',
  buttonText: '#052015',
  badgeBg: 'rgba(74,222,156,0.15)',
  badgeFg: '#4ADE9C',
  badgeHiddenBg: '#1F2B24',
  cityBadgeBg: 'rgba(74,222,156,0.15)',
  sheetBg: '#16201B',
  sheetHandle: '#2E3D35',
  foundFill: '#16201B',
  foundBorder: '#4ADE9C',
  foundIcon: '#4ADE9C',
  accentSoft: 'rgba(74,222,156,0.15)',
  marigold: '#F6BE5B',
  shadow: '#000000',
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
