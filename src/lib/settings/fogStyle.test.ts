import { getFogStyle, nextFogStyle, setFogStyle } from './fogStyle';

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
    expect(nextFogStyle('night')).toBe('ink');
  });
});
