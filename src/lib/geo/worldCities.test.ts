import { COUNTRY_BY_CODE } from './countries';

interface Data {
  regions: Record<string, { ru: string; en: string }>;
  cities: Array<{ ru: string; en: string; w: string | null; c: string; r: string | null; p: number; la: number; lo: number }>;
}
const data: Data = require('../../assets/world-cities.json');

describe('world cities data', () => {
  it('gives every city a known country, both names and a population', () => {
    for (const city of data.cities) {
      expect(city.c).toMatch(/^[A-Z]{2}$/);
      expect(COUNTRY_BY_CODE[city.c]).toBeDefined();
      expect(city.ru.length).toBeGreaterThan(0);
      expect(city.en.length).toBeGreaterThan(0);
      expect(city.p).toBeGreaterThanOrEqual(0);
    }
  });

  it('only points at regions that exist', () => {
    for (const city of data.cities) {
      if (city.r !== null) expect(data.regions[city.r]).toBeDefined();
    }
    for (const region of Object.values(data.regions)) {
      expect(region.ru.length).toBeGreaterThan(0);
      expect(region.en.length).toBeGreaterThan(0);
    }
  });

  it('has the big countries and a Russian region name', () => {
    const count = (c: string) => data.cities.filter((city) => city.c === c).length;
    expect(count('RU')).toBeGreaterThan(400);
    expect(count('US')).toBeGreaterThan(500);
    expect(Object.values(data.regions).some((r) => r.ru === 'Московская область')).toBe(true);
  });

  it('has no city twice in a country by Wikidata id', () => {
    const seen = new Set<string>();
    for (const city of data.cities) {
      if (!city.w) continue;
      const key = `${city.c}:${city.w}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('stays under 1 MB', () => {
    expect(JSON.stringify(data).length).toBeLessThan(1024 * 1024);
  });
});
