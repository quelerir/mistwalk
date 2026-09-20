import { makeT } from '../../i18n';
import { buildCityList, cityCellKey, fetchCityAt, formatKm2, geometryAreaKm2 } from './cityStats';

const vienna = { lat: 48.2082, lng: 16.3738 };
const salzburg = { lat: 47.8, lng: 13.04 };
const point = (p: { lat: number; lng: number }, ts = 1) => ({ ...p, ts });

describe('fetchCityAt', () => {
  const respond = (json: unknown) =>
    jest.fn().mockResolvedValue({ ok: true, json: async () => json }) as unknown as typeof fetch;

  it('prefers city over town, village and the generic name', async () => {
    expect((await fetchCityAt(1, 1, respond({ address: { city: 'Вена', town: 'X' } })))?.name).toBe('Вена');
    expect((await fetchCityAt(1, 1, respond({ address: { village: 'Kleinarl' } })))?.name).toBe('Kleinarl');
    expect((await fetchCityAt(1, 1, respond({ name: 'Где-то' })))?.name).toBe('Где-то');
  });

  it('asks the geocoder for names in the language given (Russian by default)', async () => {
    const fetcher = respond({ address: { city: 'Vienna' } });
    await fetchCityAt(1, 1, fetcher, 'en');
    expect((fetcher as unknown as jest.Mock).mock.calls[0][1].headers['Accept-Language']).toBe('en');
    const fallback = respond({ address: { city: 'Вена' } });
    await fetchCityAt(1, 1, fallback);
    expect((fallback as unknown as jest.Mock).mock.calls[0][1].headers['Accept-Language']).toBe('ru');
  });

  it('reads the boundary area, or null when only a point is known', async () => {
    const square = { type: 'Polygon', coordinates: [[[0, 0], [0, 0.1], [0.1, 0.1], [0.1, 0], [0, 0]]] };
    const withArea = await fetchCityAt(1, 1, respond({ name: 'Q', geojson: square }));
    expect(withArea?.areaKm2).toBeGreaterThan(100);
    const point = await fetchCityAt(1, 1, respond({ name: 'Q', geojson: { type: 'Point', coordinates: [0, 0] } }));
    expect(point?.areaKm2).toBeNull();
  });

  it('returns null when nothing names the place', async () => {
    expect(await fetchCityAt(1, 1, respond({ error: 'Unable to geocode' }))).toBeNull();
  });

  it('throws on a non-2xx status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    await expect(fetchCityAt(1, 1, fetchImpl)).rejects.toThrow('429');
  });
});

describe('buildCityList', () => {
  const cells = {
    [cityCellKey(vienna.lat, vienna.lng)]: { name: 'Вена', areaKm2: 415 },
    [cityCellKey(salzburg.lat, salzburg.lng)]: { name: 'Зальцбург', areaKm2: null },
  };
  const place = (p: { lat: number; lng: number }, id: string) => ({
    id,
    name: id,
    kind: 'monument' as const,
    ...p,
    discoveredAt: 1,
  });

  it('groups points and found places by city', () => {
    const list = buildCityList(
      [point(vienna), point({ lat: 48.2085, lng: 16.374 }, 2), point(salzburg)],
      [place(vienna, 'a'), place(salzburg, 'b'), place(vienna, 'c')],
      cells
    );
    expect(list.map((c) => c.name)).toEqual(['Вена', 'Зальцбург']);
    expect(list[0].found).toBe(2);
    expect(list[1].found).toBe(1);
    expect(list[0].exploredKm2).toBeGreaterThan(list[1].exploredKm2);
  });

  it('computes the explored share of the city area when it is known', () => {
    const [vienna_, salzburg_] = buildCityList([point(vienna), point(salzburg)], [], cells);
    expect(vienna_.percent).toBeCloseTo((vienna_.exploredKm2 / 415) * 100, 10);
    expect(salzburg_.percent).toBeNull();
  });

  it('ignores points in unresolved or nameless cells', () => {
    expect(buildCityList([point(vienna)], [], { [cityCellKey(vienna.lat, vienna.lng)]: null })).toEqual([]);
    expect(buildCityList([point(vienna)], [], {})).toEqual([]);
  });
});

const ru = makeT('ru');

describe('formatKm2', () => {
  it('adapts precision', () => {
    expect(formatKm2(ru, 'ru', 0.001)).toBe('< 0,01 км²');
    expect(formatKm2(ru, 'ru', 0.234)).toBe('0,23 км²');
    expect(formatKm2(ru, 'ru', 3.14)).toBe('3,1 км²');
    expect(formatKm2(ru, 'ru', 250.4)).toBe('250 км²');
  });

  it('writes English with a decimal point and English units', () => {
    const en = makeT('en');
    expect(formatKm2(en, 'en', 0.001)).toBe('< 0.01 km²');
    expect(formatKm2(en, 'en', 3.14)).toBe('3.1 km²');
    expect(formatKm2(en, 'en', 250.4)).toBe('250 km²');
  });
});

describe('geometryAreaKm2', () => {
  it('handles holes and multipolygons', () => {
    const outer = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]];
    const hole = [[0.25, 0.25], [0.25, 0.75], [0.75, 0.75], [0.75, 0.25], [0.25, 0.25]];
    const solid = geometryAreaKm2({ type: 'Polygon', coordinates: [outer] } as never) ?? 0;
    const holed = geometryAreaKm2({ type: 'Polygon', coordinates: [outer, hole] } as never) ?? 0;
    expect(holed).toBeCloseTo(solid * 0.75, 0);
    const twice = geometryAreaKm2({ type: 'MultiPolygon', coordinates: [[outer], [outer]] } as never) ?? 0;
    expect(twice).toBeCloseTo(solid * 2, 5);
    expect(geometryAreaKm2({ type: 'Point' } as never)).toBeNull();
  });
});
