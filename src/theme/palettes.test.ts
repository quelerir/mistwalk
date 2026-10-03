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

// A colour as [r, g, b] (0-255) from '#rrggbb' or 'rgba(r,g,b,a)'.
function rgb(value: string): [number, number, number] {
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
  const fn = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
  if (fn) return [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  throw new Error(`unreadable colour ${value}`);
}

function hueAndSaturation([r, g, b]: [number, number, number]): { hue: number; saturation: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  const lightness = (max + min) / 2;
  if (d === 0) return { hue: 0, saturation: 0 };
  const saturation = d / (1 - Math.abs(2 * lightness - 1));
  const hue = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { hue: (hue * 60 + 360) % 360, saturation };
}

function luminance(color: [number, number, number]): number {
  const [r, g, b] = color.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('%s palette', (_name, palette) => {
  it('has no green: every colour is either grey-ish or outside the green hues', () => {
    const greens = Object.entries(palette)
      .filter(([key]) => key !== 'marigold')
      .filter(([, value]) => {
        const { hue, saturation } = hueAndSaturation(rgb(value));
        return hue >= 80 && hue <= 170 && saturation > 0.12;
      })
      .map(([key]) => key);
    expect(greens).toEqual([]);
  });

  it.each([
    ['text', 'bg'],
    ['textMuted', 'bg'],
    ['link', 'bg'],
    ['buttonText', 'buttonBg'],
  ] as const)('keeps %s readable on %s (contrast of at least 4.5)', (fg, bg) => {
    expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
