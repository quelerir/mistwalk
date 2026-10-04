import type { ColorScheme } from '../../theme/palettes';
import type { CountryStat } from './countryStats';

// 0 = never been, 1 = under 1 %, 2 = 1-10 %, 3 = over 10 % of the country's area.
export type Level = 0 | 1 | 2 | 3;

export function levelFor(percent: number): Level {
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  if (percent < 1) return 1;
  if (percent <= 10) return 2;
  return 3;
}

const LIGHT: Record<Level, string> = { 0: '#E4E1D8', 1: '#BFE3C0', 2: '#6DBF7A', 3: '#2E8B4E' };
const DARK: Record<Level, string> = { 0: '#2A2E36', 1: '#2F5A3A', 2: '#3F8F52', 3: '#63C77C' };

export function levelColors(scheme: ColorScheme): Record<Level, string> {
  return scheme === 'dark' ? DARK : LIGHT;
}

export function waterColor(scheme: ColorScheme): string {
  return scheme === 'dark' ? '#14171C' : '#E9F0F5';
}

// A colour, or a MapLibre expression (the library does not export its expression type, so it is a plain array).
export type ColorExpression = string | unknown[];

// A MapLibre `match` on the country code; `match` needs a pair, so with no visited country it is the plain colour.
export function fillColorExpression(
  countries: CountryStat[],
  scheme: ColorScheme
): ColorExpression {
  const colors = levelColors(scheme);
  const byLevel: Record<Level, string[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const c of countries) byLevel[levelFor(c.percent)].push(c.code);
  const pairs: Array<string[] | string> = [];
  for (const level of [1, 2, 3] as const) {
    if (byLevel[level].length > 0) pairs.push(byLevel[level], colors[level]);
  }
  if (pairs.length === 0) return colors[0];
  return ['match', ['get', 'code'], ...pairs, colors[0]];
}
