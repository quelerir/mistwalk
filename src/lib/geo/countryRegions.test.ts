import { buildCountryCities, formatPopulation, loadWorldCities, normalizeCityName, type WorldCities, type WorldCity } from './countryRegions';
import type { CityStat } from './cityStats';

const city = (over: Partial<WorldCity> & { en: string }): WorldCity => ({
  ru: over.en,
  w: null,
  c: 'XX',
  r: 'XX-1',
  p: 1000,
  la: 0,
  lo: 0,
  ...over,
});

const visitedCity = (over: Partial<CityStat> & { name: string }): CityStat => ({
  country: 'XX',
  wikidata: null,
  exploredKm2: 1,
  totalKm2: 10,
  percent: 10,
  found: 0,
  ...over,
});

// n cities spread over the given region keys, populations descending by index.
const make = (n: number, regions: Array<string | null>): WorldCities => ({
  regions: {
    'XX-1': { ru: 'Бета', en: 'Beta' },
    'XX-2': { ru: 'Альфа', en: 'Gamma' },
  },
  cities: Array.from({ length: n }, (_, i) =>
    city({ en: `City${i}`, ru: `Город${i}`, r: regions[i % regions.length], p: 100000 - i })
  ),
});

describe('normalizeCityName', () => {
  it('lowercases, folds ё to е, drops punctuation and extra spaces', () => {
    expect(normalizeCityName('  Санкт-Петербург ')).toBe('санкт петербург');
    expect(normalizeCityName('Орёл')).toBe('орел');
    expect(normalizeCityName("St.  John's")).toBe('st john s');
  });
});

describe('buildCountryCities mode', () => {
  it('is flat at 10 cities even with several regions', () => {
    expect(buildCountryCities('XX', [], make(10, ['XX-1', 'XX-2']), 'ru').mode).toBe('flat');
  });

  it('is flat at 11 cities in a single region', () => {
    expect(buildCountryCities('XX', [], make(11, ['XX-1']), 'ru').mode).toBe('flat');
  });

  it('uses regions at 11 cities in two regions', () => {
    expect(buildCountryCities('XX', [], make(11, ['XX-1', 'XX-2']), 'ru').mode).toBe('regions');
  });

  it('ignores cities of other countries', () => {
    const data = make(11, ['XX-1', 'XX-2']);
    data.cities.push(city({ en: 'Other', c: 'YY' }));
    const out = buildCountryCities('XX', [], data, 'ru');
    expect(out.mode === 'regions' && out.regions.flatMap((r) => r.cities).some((c) => c.name === 'Other')).toBe(false);
  });
});

describe('buildCountryCities visited', () => {
  it('marks a city visited by Wikidata id', () => {
    const data = make(11, ['XX-1', 'XX-2']);
    data.cities[0].w = 'Q1';
    const out = buildCountryCities('XX', [visitedCity({ name: 'whatever', wikidata: 'Q1' })], data, 'ru');
    if (out.mode !== 'regions') throw new Error('expected regions');
    const all = out.regions.flatMap((r) => r.cities);
    expect(all.filter((c) => c.visited).map((c) => c.key)).toEqual(['XX:City0']);
  });

  it('hands the Wikidata id of each city on, for the emblem badge', () => {
    const data = make(12, ['XX-1', 'XX-2']);
    data.cities[0].w = 'Q7';
    const out = buildCountryCities('XX', [], data, 'ru');
    if (out.mode !== 'regions') throw new Error('expected regions');
    const entries = out.regions.flatMap((r) => r.cities);
    expect(entries.find((c) => c.key === 'XX:City0')?.w).toBe('Q7');
    expect(entries.find((c) => c.key === 'XX:City1')?.w).toBeNull();
  });

  it('falls back to the name (case, ё/е, punctuation) when there is no Wikidata', () => {
    const data = make(11, ['XX-1', 'XX-2']);
    data.cities[0].ru = 'Орёл';
    data.cities[1].en = 'Saint-Petersburg';
    const out = buildCountryCities(
      'XX',
      [visitedCity({ name: 'орел' }), visitedCity({ name: 'saint petersburg' })],
      data,
      'ru'
    );
    if (out.mode !== 'regions') throw new Error('expected regions');
    expect(out.regions.flatMap((r) => r.cities).filter((c) => c.visited)).toHaveLength(2);
  });

  it('does not tick a same-named city when the Wikidata ids tell them apart', () => {
    const data = make(12, ['XX-1', 'XX-2']);
    data.cities[0].ru = 'Киров';
    data.cities[0].w = 'Q1';
    data.cities[1].ru = 'Киров';
    data.cities[1].w = 'Q2';
    const out = buildCountryCities('XX', [visitedCity({ name: 'Киров', wikidata: 'Q1' })], data, 'ru');
    if (out.mode !== 'regions') throw new Error('expected regions');
    const ticked = out.regions.flatMap((r) => r.cities).filter((c) => c.visited);
    expect(ticked.map((c) => c.key)).toEqual(['XX:City0']);
  });

  it('marks nothing when a visited city has only a name that two cities share', () => {
    const data = make(12, ['XX-1', 'XX-2']);
    data.cities[0].ru = 'Киров';
    data.cities[1].ru = 'Киров';
    const out = buildCountryCities('XX', [visitedCity({ name: 'Киров' })], data, 'ru');
    if (out.mode !== 'regions') throw new Error('expected regions');
    expect(out.regions.flatMap((r) => r.cities).some((c) => c.visited)).toBe(false);
  });

  it('does not count a visited city of another country', () => {
    const data = make(11, ['XX-1', 'XX-2']);
    const out = buildCountryCities('XX', [visitedCity({ name: 'City0', country: 'YY' })], data, 'ru');
    if (out.mode !== 'regions') throw new Error('expected regions');
    expect(out.regions.flatMap((r) => r.cities).some((c) => c.visited)).toBe(false);
  });

  it('flat mode lists only the unvisited cities, by population', () => {
    const data = make(5, ['XX-1']);
    data.cities[1].w = 'Q2';
    const out = buildCountryCities('XX', [visitedCity({ name: 'x', wikidata: 'Q2' })], data, 'ru');
    expect(out.mode).toBe('flat');
    if (out.mode !== 'flat') return;
    expect(out.unvisited.map((c) => c.name)).toEqual(['Город0', 'Город2', 'Город3', 'Город4']);
  });
});

describe('buildCountryCities regions', () => {
  it('counts visited cities per region and puts visited regions first, then by name', () => {
    const data = make(12, ['XX-1', 'XX-2']);
    data.cities[0].w = 'Q1'; // City0 is in XX-1 (Бета / Beta)
    const out = buildCountryCities('XX', [visitedCity({ name: 'x', wikidata: 'Q1' })], data, 'ru');
    if (out.mode !== 'regions') throw new Error('expected regions');
    expect(out.regions.map((r) => [r.name, r.visitedCount])).toEqual([
      ['Бета', 1],
      ['Альфа', 0],
    ]);
  });

  it('orders unvisited regions by the name in the current language', () => {
    const data = make(12, ['XX-1', 'XX-2']);
    const ru = buildCountryCities('XX', [], data, 'ru');
    const en = buildCountryCities('XX', [], data, 'en');
    if (ru.mode !== 'regions' || en.mode !== 'regions') throw new Error('expected regions');
    expect(ru.regions.map((r) => r.name)).toEqual(['Альфа', 'Бета']);
    expect(en.regions.map((r) => r.name)).toEqual(['Beta', 'Gamma']);
  });

  it('sorts the cities of a region by population, descending', () => {
    const data = make(12, ['XX-1', 'XX-2']);
    const out = buildCountryCities('XX', [], data, 'ru');
    if (out.mode !== 'regions') throw new Error('expected regions');
    for (const region of out.regions) {
      const pops = region.cities.map((c) => c.population);
      expect([...pops].sort((a, b) => b - a)).toEqual(pops);
    }
  });

  it('puts cities with no region in a last group', () => {
    const data = make(12, ['XX-1', 'XX-2', null]);
    const ru = buildCountryCities('XX', [], data, 'ru');
    const en = buildCountryCities('XX', [], data, 'en');
    if (ru.mode !== 'regions' || en.mode !== 'regions') throw new Error('expected regions');
    expect(ru.regions[ru.regions.length - 1]).toMatchObject({ code: null, name: 'Другое' });
    expect(en.regions[en.regions.length - 1]).toMatchObject({ code: null, name: 'Other' });
  });
});

describe('loadWorldCities', () => {
  it('loads the bundled data', () => {
    const data = loadWorldCities();
    expect(data).not.toBeNull();
    expect(data!.cities.length).toBeGreaterThan(7000);
    expect(loadWorldCities()).toBe(data); // cached
  });
});

describe('formatPopulation', () => {
  it('is short and follows the language', () => {
    expect(formatPopulation('ru', 1_240_000)).toBe('1,2 млн');
    expect(formatPopulation('ru', 142_865)).toBe('143 тыс.');
    expect(formatPopulation('ru', 950)).toBe('950');
    expect(formatPopulation('en', 1_240_000)).toBe('1.2M');
    expect(formatPopulation('en', 142_865)).toBe('143k');
    expect(formatPopulation('en', 0)).toBe('0');
  });
});
