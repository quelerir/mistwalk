import {
  buildCountryList,
  cellKey,
  fetchCountryAt,
  formatPercent,
  groupPlacesByCountry,
  groupPointsByCountry,
} from './countryStats';

const AT = { code: 'AT', name: 'Австрия' };
const point = (lat: number, lng: number, ts = 1) => ({ lat, lng, ts });

describe('cellKey', () => {
  it('is stable within a cell and differs across cells', () => {
    expect(cellKey(48.2082, 16.3738)).toBe(cellKey(48.21, 16.38));
    expect(cellKey(48.2082, 16.3738)).not.toBe(cellKey(48.6, 16.3738));
  });
});

describe('fetchCountryAt', () => {
  it('reads the country code and localized name', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ address: { country: 'Австрия', country_code: 'at' } }),
    });
    expect(await fetchCountryAt(48.2, 16.3, fetchImpl as unknown as typeof fetch)).toEqual(AT);
  });

  it('returns null when there is no country (open water)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'Unable to geocode' }) });
    expect(await fetchCountryAt(0, 0, fetchImpl as unknown as typeof fetch)).toBeNull();
  });

  it('throws on a non-2xx status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(fetchCountryAt(0, 0, fetchImpl as unknown as typeof fetch)).rejects.toThrow('429');
  });
});

describe('groupPointsByCountry / buildCountryList', () => {
  const vienna = point(48.2082, 16.3738);
  const ocean = point(0, 0);
  const cells = { [cellKey(vienna.lat, vienna.lng)]: AT, [cellKey(0, 0)]: null };

  it('groups points by country and drops unresolved cells', () => {
    const groups = groupPointsByCountry([vienna, ocean], cells);
    expect([...groups.keys()]).toEqual(['AT']);
    expect(groups.get('AT')?.points).toHaveLength(1);
  });

  it('lists every country, visited ones first with their explored share', () => {
    const list = buildCountryList([vienna], cells);
    expect(list.length).toBeGreaterThan(200);
    expect(list[0].code).toBe('AT');
    expect(list[0].percent).toBeCloseTo((list[0].exploredKm2 / 83879) * 100, 10);
    expect(list[0].percent).toBeGreaterThan(0);
    expect(list[1].percent).toBe(0);
    expect(list.filter((c) => c.percent > 0)).toHaveLength(1);
  });
});

describe('formatPercent', () => {
  it('adapts precision to the magnitude', () => {
    expect(formatPercent('ru', 0)).toBe('0 %');
    expect(formatPercent('ru', 12.4)).toBe('12 %');
    expect(formatPercent('ru', 3.26)).toBe('3,3 %');
    expect(formatPercent('ru', 0.0431)).toBe('0,043 %');
    expect(formatPercent('ru', 0.00123)).toBe('0,0012 %');
    expect(formatPercent('ru', 0.0000431)).toBe('0,000043 %');
    expect(formatPercent('ru', 0.0000001)).toBe('< 0,000001 %');
    expect(formatPercent('en', 3.26)).toBe('3.3 %');
    expect(formatPercent('en', 0.0431)).toBe('0.043 %');
    expect(formatPercent('en', 0.0000001)).toBe('< 0.000001 %');
  });
});

describe('groupPlacesByCountry', () => {
  const vienna = { lat: 48.2082, lng: 16.3738 };
  const cells = { [cellKey(vienna.lat, vienna.lng)]: AT };
  const found = (id: string, at: number) => ({ id, name: id, kind: 'monument' as const, ...vienna, discoveredAt: at });
  const poi = (id: string, lat = vienna.lat, lng = vienna.lng) => ({ id, name: id, kind: 'viewpoint' as const, lat, lng });

  it('splits found and unvisited places per country, newest found first', () => {
    const discovered = [found('a', 1), found('b', 5)];
    const pois = [poi('a'), poi('b'), poi('c'), poi('far', 0, 0)];
    const groups = groupPlacesByCountry(discovered, pois, new Set(['a', 'b']), cells);
    const at = groups.get('AT');
    expect(at?.discovered.map((p) => p.id)).toEqual(['b', 'a']);
    expect(at?.hidden.map((p) => p.id)).toEqual(['c']);
    expect(groups.size).toBe(1);
  });
});
