import { getFogStyle, nextFogStyle, resolveFogStyle, setFogStyle } from './fogStyle';

function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
  };
}

describe('fogStyle', () => {
  it('defaults to ink, persists a choice and ignores garbage', async () => {
    const s = fakeStorage();
    expect(await getFogStyle(s)).toBe('ink');
    await setFogStyle(s, 'night');
    expect(await getFogStyle(s)).toBe('night');
    expect(await getFogStyle(fakeStorage({ 'settings.fogStyle.v1': 'nonsense' }))).toBe('ink');
  });

  it('cycles through all styles and wraps around', () => {
    expect(nextFogStyle('ink')).toBe('mist');
    expect(nextFogStyle('mist')).toBe('night');
    expect(nextFogStyle('night')).toBe('auto');
    expect(nextFogStyle('auto')).toBe('ink');
  });

  it('auto picks the fog by the hour and a fixed style ignores the hour', () => {
    expect(resolveFogStyle('auto', 6)).toBe('mist');
    expect(resolveFogStyle('auto', 12)).toBe('mist');
    expect(resolveFogStyle('auto', 17)).toBe('mist');
    expect(resolveFogStyle('auto', 18)).toBe('ink');
    expect(resolveFogStyle('auto', 21)).toBe('ink');
    expect(resolveFogStyle('auto', 22)).toBe('night');
    expect(resolveFogStyle('auto', 3)).toBe('night');
    expect(resolveFogStyle('auto', 5)).toBe('night');
    expect(resolveFogStyle('night', 12)).toBe('night');
    expect(resolveFogStyle('ink', 3)).toBe('ink');
  });

  it('persists and restores the auto choice', async () => {
    const s = fakeStorage();
    await setFogStyle(s, 'auto');
    expect(await getFogStyle(s)).toBe('auto');
  });
});
