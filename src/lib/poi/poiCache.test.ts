import { createPoiLoader, fetchTileFromOverpass, POI_CACHE_TTL_MS } from './poiCache';
import { OVERPASS_URLS } from './overpass';
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

describe('fetchTileFromOverpass', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const okResponse = { ok: true, json: async () => ({ elements: [{ type: 'node', id: 1, lat: 1, lon: 2, tags: { tourism: 'viewpoint', name: 'A' } }] }) };

  it('uses the first server when it answers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const pois = await fetchTileFromOverpass(tile);
    expect(pois).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(OVERPASS_URLS[0]);
  });

  it('tries the next server when the first is busy or unreachable', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 504, json: async () => ({}) })
      .mockResolvedValueOnce(okResponse);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await fetchTileFromOverpass(tile)).toHaveLength(1);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([OVERPASS_URLS[0], OVERPASS_URLS[1]]);

    const broken = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(okResponse);
    globalThis.fetch = broken as unknown as typeof fetch;
    expect(await fetchTileFromOverpass(tile)).toHaveLength(1);
  });

  it('gives up with an error when every server fails', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 504, json: async () => ({}) }) as unknown as typeof fetch;
    await expect(fetchTileFromOverpass(tile)).rejects.toThrow('Overpass unavailable');
  });

  it('gives each request a way to be cancelled, so a hanging server cannot block for ever', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okResponse);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await fetchTileFromOverpass(tile);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
