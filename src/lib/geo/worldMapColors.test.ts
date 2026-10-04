import { fillColorExpression, levelColors, levelFor, waterColor } from './worldMapColors';
import type { CountryStat } from './countryStats';

const stat = (code: string, percent: number): CountryStat => ({
  code,
  name: code,
  exploredKm2: 0,
  totalKm2: 1,
  percent,
});

describe('levelFor', () => {
  it.each([
    [0, 0],
    [-1, 0],
    [NaN, 0],
    [Infinity, 0],
    [1e-9, 1],
    [0.999, 1],
    [1, 2],
    [10, 2],
    [10.01, 3],
  ])('percent %p is level %p', (percent, level) => {
    expect(levelFor(percent)).toBe(level);
  });
});

describe('levelColors', () => {
  it.each(['light', 'dark'] as const)('has four distinct colours in %s', (scheme) => {
    const colors = Object.values(levelColors(scheme));
    expect(colors).toHaveLength(4);
    expect(new Set(colors).size).toBe(4);
  });

  it('differs between light and dark', () => {
    expect(levelColors('light')).not.toEqual(levelColors('dark'));
    expect(waterColor('light')).not.toBe(waterColor('dark'));
  });
});

describe('fillColorExpression', () => {
  it('groups visited countries by level and falls back to the neutral colour', () => {
    const c = levelColors('light');
    const expr = fillColorExpression([stat('AT', 12), stat('FR', 0.5), stat('DE', 0), stat('IT', NaN)], 'light');
    expect(expr).toEqual(['match', ['get', 'code'], ['FR'], c[1], ['AT'], c[3], c[0]]);
  });

  it('is just the neutral colour when nothing is visited', () => {
    expect(fillColorExpression([stat('DE', 0)], 'dark')).toBe(levelColors('dark')[0]);
  });
});
