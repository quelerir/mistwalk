import {
  buildCountryStats,
  cellKey,
  fetchCountryAreaKm2,
  fetchCountryAt,
  formatPercent,
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

describe('fetchCountryAreaKm2', () => {
  it('reads the latest surface area value', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{}, [{ value: 83879 }]],
    });
    expect(await fetchCountryAreaKm2('AT', fetchImpl as unknown as typeof fetch)).toBe(83879);
    expect(fetchImpl.mock.calls[0][0]).toContain('/AT/indicator/AG.SRF.TOTL.K2');
  });

  it('returns null when the indicator has no value', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => [{}, [{ value: null }]] });
    expect(await fetchCountryAreaKm2('XX', fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});

describe('groupPointsByCountry / buildCountryStats', () => {
  const vienna = point(48.2082, 16.3738);
  const ocean = point(0, 0);
  const cells = { [cellKey(vienna.lat, vienna.lng)]: AT, [cellKey(0, 0)]: null };

  it('groups points by country and drops unresolved cells', () => {
    const groups = groupPointsByCountry([vienna, ocean], cells);
    expect([...groups.keys()]).toEqual(['AT']);
    expect(groups.get('AT')?.points).toHaveLength(1);
  });

  it('computes the explored share of the country area', () => {
    const [stat] = buildCountryStats([vienna], cells, { AT: 83879 });
    expect(stat.code).toBe('AT');
    expect(stat.exploredKm2).toBeGreaterThan(0);
    expect(stat.percent).toBeCloseTo((stat.exploredKm2 / 83879) * 100, 10);
  });

  it('skips countries whose area is unknown', () => {
    expect(buildCountryStats([vienna], cells, {})).toEqual([]);
  });
});

describe('formatPercent', () => {
  it('adapts precision to the magnitude', () => {
    expect(formatPercent(0)).toBe('0 %');
    expect(formatPercent(12.4)).toBe('12 %');
    expect(formatPercent(3.26)).toBe('3,3 %');
    expect(formatPercent(0.0431)).toBe('0,043 %');
    expect(formatPercent(0.00123)).toBe('0,0012 %');
    expect(formatPercent(0.0000431)).toBe('0,000043 %');
    expect(formatPercent(0.0000001)).toBe('< 0,000001 %');
  });
});
