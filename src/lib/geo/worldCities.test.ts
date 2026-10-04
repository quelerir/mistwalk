import { COUNTRY_BY_CODE } from './countries';
import { REPUBLIC_BY_CODE, republicAt } from './republics';

interface Data {
  regions: Record<string, { ru: string; en: string }>;
  cities: Array<{ ru: string; en: string; w: string | null; c: string; r: string | null; p: number; la: number; lo: number }>;
}
const data: Data = require('../../assets/world-cities.json');

describe('world cities data', () => {
  it('gives every city a known country, both names and a population', () => {
    for (const city of data.cities) {
      expect(city.c).toMatch(/^[A-Z]{2}$/);
      expect(COUNTRY_BY_CODE[city.c] ?? REPUBLIC_BY_CODE[city.c]).toBeDefined();
      expect(city.ru.length).toBeGreaterThan(0);
      expect(city.en.length).toBeGreaterThan(0);
      expect(city.p).toBeGreaterThanOrEqual(0);
    }
  });

  it('puts the cities inside a republic border under the republic, not under its host country', () => {
    const country = (en: string) => data.cities.find((c) => c.en === en)?.c;
    expect(country('Sukhumi')).toBe('XA');
    expect(country('Tskhinvali')).toBe('XS');
    expect(country('Tiraspol')).toBe('XT');
    expect(country('Hargeisa')).toBe('XL');
    expect(country('Famagusta')).toBe('XN');
    for (const code of Object.keys(REPUBLIC_BY_CODE)) {
      expect(data.cities.filter((c) => c.c === code).length).toBeGreaterThan(0);
    }
    const strays = data.cities.filter((c) => !REPUBLIC_BY_CODE[c.c] && republicAt(c.la, c.lo) !== null);
    expect(strays.map((c) => `${c.c} ${c.en}`)).toEqual([]);
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

  it('stays under 1 MB on disk (bytes, not characters: Cyrillic takes two)', () => {
    expect(new TextEncoder().encode(JSON.stringify(data)).length).toBeLessThan(1024 * 1024);
  });

  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  it('has no unlabelled twin of a city that has a Wikidata id (Natural Earth mislabels a few)', () => {
    const withWikidata = new Set(data.cities.filter((c) => c.w).map((c) => `${c.c}:${norm(c.ru)}`));
    const phantoms = data.cities.filter((c) => !c.w && withWikidata.has(`${c.c}:${norm(c.ru)}`));
    expect(phantoms.map((c) => `${c.c} ${c.ru}`)).toEqual([]);
  });

  it('never gives two regions of one country the same name', () => {
    for (const lang of ['ru', 'en'] as const) {
      const seen = new Map<string, string>();
      for (const code of new Set(data.cities.map((c) => c.r).filter((r): r is string => r !== null))) {
        const country = data.cities.find((c) => c.r === code)!.c;
        const key = `${country}:${data.regions[code][lang]}`;
        expect([key, seen.get(key)]).toEqual([key, undefined]);
        seen.set(key, code);
      }
    }
  });

  it('keeps every region inside one country', () => {
    const countryOf = new Map<string, string>();
    for (const city of data.cities) {
      if (!city.r) continue;
      const known = countryOf.get(city.r);
      expect([city.r, known ?? city.c]).toEqual([city.r, city.c]);
      countryOf.set(city.r, city.c);
    }
  });
});
