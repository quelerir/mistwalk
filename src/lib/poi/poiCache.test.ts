import { createPoiLoader, POI_CACHE_TTL_MS } from './poiCache';
import type { Poi } from './types';

const tile = { x: 1, y: 2, z: 13 };
const poi: Poi = { id: 'node/1', name: 'A', kind: 'viewpoint', lat: 1, lng: 2 };

function fakeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
  };
}

describe('createPoiLoader', () => {
  it('fetches once, then serves from cache', async () => {
    const fetchTile = jest.fn().mockResolvedValue([poi]);
    const load = createPoiLoader({ storage: fakeStorage(), fetchTile });
    expect(await load(tile)).toEqual([poi]);
    expect(await load(tile)).toEqual([poi]);
    expect(fetchTile).toHaveBeenCalledTimes(1);
  });

  it('refetches after the cache expires', async () => {
    let time = 1000;
    const fetchTile = jest.fn().mockResolvedValue([poi]);
    const load = createPoiLoader({ storage: fakeStorage(), fetchTile, now: () => time });
    await load(tile);
    time += POI_CACHE_TTL_MS + 1;
    await load(tile);
    expect(fetchTile).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers and does not cache failures', async () => {
    const fetchTile = jest
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([poi]);
    const load = createPoiLoader({ storage: fakeStorage(), fetchTile });

    const [a, b] = await Promise.allSettled([load(tile), load(tile)]);
    expect(a.status).toBe('rejected');
    expect(b.status).toBe('rejected');
    expect(fetchTile).toHaveBeenCalledTimes(1);

    expect(await load(tile)).toEqual([poi]);
    expect(fetchTile).toHaveBeenCalledTimes(2);
  });
});
