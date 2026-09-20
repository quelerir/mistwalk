import { ALL_KINDS, countByKind, filterByKinds, getHiddenKinds, setHiddenKinds } from './kindFilter';
import type { Poi, PoiKind } from './types';

const poi = (id: string, kind: PoiKind): Poi => ({ id, name: id, kind, lat: 0, lng: 0 });
const pois = [poi('a', 'museum'), poi('b', 'museum'), poi('c', 'park'), poi('d', 'monument'), poi('e', 'museum')];

function fakeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
    store,
  };
}

describe('filterByKinds', () => {
  it('returns the very same list when nothing is hidden', () => {
    expect(filterByKinds(pois, new Set())).toBe(pois);
  });

  it('leaves out the hidden kinds', () => {
    expect(filterByKinds(pois, new Set<PoiKind>(['museum'])).map((p) => p.id)).toEqual(['c', 'd']);
    expect(filterByKinds(pois, new Set<PoiKind>(ALL_KINDS))).toEqual([]);
  });
});

describe('countByKind', () => {
  it('counts each kind, the most common first, and skips kinds that are absent', () => {
    expect(countByKind(pois)).toEqual([
      { kind: 'museum', count: 3 },
      { kind: 'monument', count: 1 },
      { kind: 'park', count: 1 },
    ]);
    expect(countByKind([])).toEqual([]);
  });
});

describe('hidden kinds storage', () => {
  it('saves and reads the hidden kinds', async () => {
    const storage = fakeStorage();
    await setHiddenKinds(storage, new Set<PoiKind>(['park', 'museum']));
    expect(await getHiddenKinds(storage)).toEqual(new Set(['park', 'museum']));
  });

  it('starts with nothing hidden, and shrugs off garbage and unknown kinds', async () => {
    expect(await getHiddenKinds(fakeStorage())).toEqual(new Set());
    const broken = fakeStorage();
    broken.store['settings.mapHiddenKinds.v1'] = 'not json';
    expect(await getHiddenKinds(broken)).toEqual(new Set());
    broken.store['settings.mapHiddenKinds.v1'] = '{"a":1}';
    expect(await getHiddenKinds(broken)).toEqual(new Set());
    broken.store['settings.mapHiddenKinds.v1'] = '["park","spaceship"]';
    expect(await getHiddenKinds(broken)).toEqual(new Set(['park']));
  });
});
