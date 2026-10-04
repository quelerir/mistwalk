import {
  buildCountryList,
  buildRepublicList,
  cellKey,
  fetchCountryAt,
  formatPercent,
  groupPlacesByCountry,
  groupPointsByCountry,
} from './countryStats';
import { COUNTRY_BY_CODE } from './countries';
import { hostAreaAdjustment } from './republics';

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

describe('republics', () => {
  const GE = { code: 'GE', name: 'Грузия' };
  // A short walk in Sukhumi (inside Abkhazia) and one in Tbilisi (Georgia proper); the geocoder says Georgia for both.
  const sukhumi = [point(43.0, 41.02), point(43.001, 41.02), point(43.002, 41.02)];
  const tbilisi = [point(41.72, 44.79), point(41.721, 44.79), point(41.722, 44.79)];
  const cells = {
    [cellKey(43.0, 41.02)]: GE,
    [cellKey(41.72, 44.79)]: GE,
  };
  const byCode = <T extends { code: string }>(list: T[], code: string): T => list.find((c) => c.code === code)!;

  it('counts a point inside Abkhazia for the republic and not for Georgia', () => {
    const georgia = byCode(buildCountryList([...sukhumi, ...tbilisi], cells), 'GE');
    const georgiaAlone = byCode(buildCountryList(tbilisi, cells), 'GE');
    expect(georgia.exploredKm2).toBeGreaterThan(0);
    expect(georgia.exploredKm2).toBe(georgiaAlone.exploredKm2);
    const abkhazia = byCode(buildRepublicList([...sukhumi, ...tbilisi], cells), 'XA');
    expect(abkhazia.exploredKm2).toBeGreaterThan(0);
    expect(byCode(buildRepublicList(tbilisi, cells), 'XA').exploredKm2).toBe(0);
  });

  it('still counts a point outside every republic for the country of its cell', () => {
    expect(byCode(buildCountryList(tbilisi, cells), 'GE').percent).toBeGreaterThan(0);
  });

  it('takes the area of the republics off the total of the country they lie in', () => {
    const countries = buildCountryList([], cells);
    expect(byCode(countries, 'GE').totalKm2).toBe(69700 - hostAreaAdjustment('GE'));
    for (const host of ['GE', 'MD', 'CY', 'SO']) expect(byCode(countries, host).totalKm2).toBeGreaterThan(0);
    expect(byCode(countries, 'FR').totalKm2).toBe(COUNTRY_BY_CODE.FR.areaKm2);
    expect(countries.length).toBeGreaterThan(200);
    expect(countries.some((c) => c.code.startsWith('X') && c.code !== 'XK')).toBe(false);
  });

  it('lists the five republics, the visited one first, in the language asked', () => {
    const ru = buildRepublicList(sukhumi, cells, 'ru');
    expect(ru).toHaveLength(5);
    expect(ru[0]).toMatchObject({ code: 'XA', name: 'Абхазия' });
    expect(ru[0].percent).toBeGreaterThan(0);
    expect(ru.slice(1).every((r) => r.percent === 0)).toBe(true);
    expect(buildRepublicList(sukhumi, cells, 'en')[0].name).toBe('Abkhazia');
  });

  it('puts a place in Sukhumi under the republic, not under Georgia', () => {
    const place = { id: 'p', name: 'p', kind: 'monument' as const, lat: 43.0, lng: 41.02, discoveredAt: 1 };
    const groups = groupPlacesByCountry([place], [], new Set(['p']), cells);
    expect(groups.get('XA')?.discovered.map((x) => x.id)).toEqual(['p']);
    expect(groups.get('GE')).toBeUndefined();
  });
});
