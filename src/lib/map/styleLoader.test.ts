import { loadDarkStyle, STYLE_TTL_MS } from './styleLoader';
import type { MapStyleJson } from './darkStyle';

const raw: MapStyleJson = { version: 8, layers: [{ id: 'background', type: 'background', paint: { 'background-color': 'rgb(12,12,12)' } }] };

function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => {
      store[k] = v;
    },
    store,
  };
}
const okFetch = () => jest.fn().mockResolvedValue({ ok: true, json: async () => raw }) as unknown as typeof fetch;
const bg = (s: MapStyleJson | null) => s?.layers[0].paint?.['background-color'];

describe('loadDarkStyle', () => {
  it('downloads the style, lightens it and keeps it', async () => {
    const storage = fakeStorage();
    const fetcher = okFetch();
    const style = await loadDarkStyle({ storage, fetcher, now: () => 1000 });
    expect(bg(style)).toBe('#1b2129');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.store['map.darkStyle.v1']).ts).toBe(1000);
  });

  it('uses the kept copy while it is fresh, without going to the network', async () => {
    const storage = fakeStorage();
    await loadDarkStyle({ storage, fetcher: okFetch(), now: () => 1000 });
    const fetcher = okFetch();
    const again = await loadDarkStyle({ storage, fetcher, now: () => 1000 + STYLE_TTL_MS - 1 });
    expect(bg(again)).toBe('#1b2129');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('downloads again once the kept copy is old', async () => {
    const storage = fakeStorage();
    await loadDarkStyle({ storage, fetcher: okFetch(), now: () => 1000 });
    const fetcher = okFetch();
    await loadDarkStyle({ storage, fetcher, now: () => 1000 + STYLE_TTL_MS + 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back to the old copy when the download fails, and to null when there is none', async () => {
    const storage = fakeStorage();
    const down = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await loadDarkStyle({ storage, fetcher: down, now: () => 5 })).toBeNull();

    await loadDarkStyle({ storage, fetcher: okFetch(), now: () => 1000 });
    const stale = await loadDarkStyle({ storage, fetcher: down, now: () => 1000 + STYLE_TTL_MS + 1 });
    expect(bg(stale)).toBe('#1b2129');
  });

  it('does not trust an answer that is not a style, or an error page', async () => {
    const storage = fakeStorage();
    const junk = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ hello: 1 }) }) as unknown as typeof fetch;
    const err = jest.fn().mockResolvedValue({ ok: false, json: async () => raw }) as unknown as typeof fetch;
    expect(await loadDarkStyle({ storage, fetcher: junk })).toBeNull();
    expect(await loadDarkStyle({ storage, fetcher: err })).toBeNull();
    expect(Object.keys(storage.store)).toHaveLength(0);
  });

  it('ignores a damaged kept copy', async () => {
    const storage = fakeStorage({ 'map.darkStyle.v1': 'not json' });
    expect(bg(await loadDarkStyle({ storage, fetcher: okFetch() }))).toBe('#1b2129');
  });
});
