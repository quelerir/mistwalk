import { DARK, LIGHT, nextThemePreference, parseThemePreference, resolveScheme } from './palettes';

describe('theme helpers', () => {
  it('cycles system -> light -> dark -> system', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
  });

  it('resolves the system preference to the device scheme', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('falls back to system for unknown stored values', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('purple')).toBe('system');
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('defines the same tokens in both palettes', () => {
    expect(Object.keys(DARK).sort()).toEqual(Object.keys(LIGHT).sort());
  });
});
