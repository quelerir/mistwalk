import { getAccuracyProfile, setAccuracyProfile, DISTANCE_INTERVAL_METERS } from './accuracyProfile';

function makeFakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
  };
}

describe('accuracyProfile', () => {
  it('defaults to battery-saver when nothing is stored', async () => {
    const storage = makeFakeStorage();
    expect(await getAccuracyProfile(storage)).toBe('battery-saver');
  });

  it('returns the stored profile', async () => {
    const storage = makeFakeStorage({ 'settings.accuracyProfile.v1': 'precise' });
    expect(await getAccuracyProfile(storage)).toBe('precise');
  });

  it('persists a new profile', async () => {
    const storage = makeFakeStorage();
    await setAccuracyProfile(storage, 'precise');
    expect(await getAccuracyProfile(storage)).toBe('precise');
  });

  it('exposes the correct distance thresholds', () => {
    expect(DISTANCE_INTERVAL_METERS['precise']).toBe(25);
    expect(DISTANCE_INTERVAL_METERS['battery-saver']).toBe(75);
  });
});
