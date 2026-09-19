import { buildCityList, cityCellKey, fetchCityAt, formatKm2 } from './cityStats';

const vienna = { lat: 48.2082, lng: 16.3738 };
const salzburg = { lat: 47.8, lng: 13.04 };
const point = (p: { lat: number; lng: number }, ts = 1) => ({ ...p, ts });

describe('fetchCityAt', () => {
  const respond = (json: unknown) =>
    jest.fn().mockResolvedValue({ ok: true, json: async () => json }) as unknown as typeof fetch;

  it('prefers city over town, village and the generic name', async () => {
    expect(await fetchCityAt(1, 1, respond({ address: { city: 'Вена', town: 'X' } }))).toBe('Вена');
    expect(await fetchCityAt(1, 1, respond({ address: { village: 'Kleinarl' } }))).toBe('Kleinarl');
    expect(await fetchCityAt(1, 1, respond({ name: 'Где-то' }))).toBe('Где-то');
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
  const cells = { [cityCellKey(vienna.lat, vienna.lng)]: 'Вена', [cityCellKey(salzburg.lat, salzburg.lng)]: 'Зальцбург' };
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

  it('ignores points in unresolved or nameless cells', () => {
    expect(buildCityList([point(vienna)], [], { [cityCellKey(vienna.lat, vienna.lng)]: null })).toEqual([]);
    expect(buildCityList([point(vienna)], [], {})).toEqual([]);
  });
});

describe('formatKm2', () => {
  it('adapts precision', () => {
    expect(formatKm2(0.001)).toBe('< 0,01 км²');
    expect(formatKm2(0.234)).toBe('0,23 км²');
    expect(formatKm2(3.14)).toBe('3,1 км²');
    expect(formatKm2(250.4)).toBe('250 км²');
  });
});
