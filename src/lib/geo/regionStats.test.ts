import {
  buildIndex,
  buildRegionStats,
  citiesOfRegion,
  loadRegions,
  placesOfRegion,
  regionAt,
  regionAtIndex,
  type RegionsData,
} from './regionStats';
import type { CityStat } from './cityStats';
import type { WorldCities } from './countryRegions';

const cities: { regions: Record<string, { ru: string; en: string }> } = require('../../assets/world-cities.json');
const codeOf = (ru: string, country: string) =>
  Object.keys(cities.regions).find((k) => cities.regions[k].ru === ru && loadRegions()!.regions[k]?.c === country)!;

describe('regionAt with the bundled borders', () => {
  it('finds the region of a city', () => {
    expect(regionAt(37.77, -122.42, 'US')).toBe(codeOf('Калифорния', 'US')); // San Francisco
    expect(regionAt(30.27, -97.74, 'US')).toBe(codeOf('Техас', 'US')); // Austin
  });

  it('ignores the regions of other countries', () => {
    expect(regionAt(37.77, -122.42, 'RU')).toBeNull();
    expect(regionAt(55.75, 37.62, 'US')).toBeNull();
    expect(regionAt(55.75, 37.62, 'RU')).not.toBeNull();
  });

  it('is null in the ocean and for a country with no regions list', () => {
    expect(regionAt(0, 0, 'US')).toBeNull();
    expect(regionAt(41.72, 44.79, 'GE')).toBeNull();
  });
});

describe('regionAtIndex with hand-made regions', () => {
  const ring = (x0: number, y0: number, x1: number, y1: number) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ];
  const data: RegionsData = {
    regions: {
      // a 3 x 3 degree square (lng 0..3, lat 0..3) with a square hole in the middle (lng 1..2, lat 1..2)
      A: { c: 'XX', w: null, areaKm2: 1, polygons: [[ring(0, 0, 3, 3), ring(1, 1, 2, 2)]] },
      // a region of another country, far away
      B: { c: 'YY', w: null, areaKm2: 1, polygons: [[ring(10, 10, 12, 12)]] },
    },
  };
  const index = buildIndex(data);

  it('finds a point in the outline and not in the hole', () => {
    expect(regionAtIndex(index, 0.5, 0.5, 'XX')).toBe('A');
    expect(regionAtIndex(index, 1.5, 1.5, 'XX')).toBeNull();
  });

  it('finds the polygon from every grid cell it covers, also on a whole-degree line', () => {
    expect(regionAtIndex(index, 2.9, 2.9, 'XX')).toBe('A');
    expect(regionAtIndex(index, 0.1, 2.9, 'XX')).toBe('A');
    expect(regionAtIndex(index, 1.0, 0.5, 'XX')).toBe('A');
    expect(regionAtIndex(index, 0.5, 2.0, 'XX')).toBe('A');
  });

  it('takes a point just outside every polygon (coarse coast) for the nearest region, within 30 km', () => {
    expect(regionAtIndex(index, 1.5, -0.1, 'XX')).toBe('A'); // about 11 km west of the square
    expect(regionAtIndex(index, 1.5, 3.15, 'XX')).toBe('A'); // about 17 km east of the square
  });

  it('does not take a far point for a region', () => {
    expect(regionAtIndex(index, 1.5, -0.5, 'XX')).toBeNull(); // about 55 km west
    expect(regionAtIndex(index, 1.5, 3.35, 'XX')).toBeNull(); // about 39 km east
    expect(regionAtIndex(index, 5, 5, 'XX')).toBeNull();
  });

  it('picks the closer of two regions when the point is in a gap', () => {
    const two: RegionsData = {
      regions: {
        L: { c: 'XX', w: null, areaKm2: 1, polygons: [[ring(0, 0, 1, 1)]] },
        R: { c: 'XX', w: null, areaKm2: 1, polygons: [[ring(1.2, 0, 2.2, 1)]] },
      },
    };
    const gap = buildIndex(two);
    expect(regionAtIndex(gap, 0.5, 1.05, 'XX')).toBe('L');
    expect(regionAtIndex(gap, 0.5, 1.15, 'XX')).toBe('R');
  });

  it('only looks at regions of the given country', () => {
    expect(regionAtIndex(index, 0.5, 0.5, 'YY')).toBeNull();
    expect(regionAtIndex(index, 11, 11, 'XX')).toBeNull();
    expect(regionAtIndex(index, 11, 11, 'YY')).toBe('B');
  });

  it('is null outside every polygon', () => {
    expect(regionAtIndex(index, 5, 5, 'XX')).toBeNull();
    expect(regionAtIndex(index, -1, -1, 'XX')).toBeNull();
  });
});

describe('region statistics', () => {
  const square = (x0: number, y0: number, x1: number, y1: number) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
  // R1: lng 0..10, lat 0..10, 100 km2; R2: lng 10..20, lat 0..10, 400 km2; R3 has cities but no borders in the file.
  const regions: RegionsData = {
    regions: {
      R1: { c: 'XX', w: 'Q1', areaKm2: 100, polygons: [square(0, 0, 10, 10)] },
      R2: { c: 'XX', w: null, areaKm2: 400, polygons: [square(10, 0, 20, 10)] },
    },
  };
  const city = (en: string, r: string, over: Partial<WorldCities['cities'][number]> = {}) => ({
    ru: `Город ${en}`,
    en,
    w: null,
    c: 'XX',
    r,
    p: 1000,
    la: 0,
    lo: 0,
    ...over,
  });
  const data: WorldCities = {
    regions: { R1: { ru: 'Бета', en: 'Beta' }, R2: { ru: 'Альфа', en: 'Gamma' }, R3: { ru: 'Гамма', en: 'Delta' } },
    cities: [city('A1', 'R1', { w: 'QA1' }), city('A2', 'R1'), city('B1', 'R2'), city('C1', 'R3'), city('Other', 'R1', { c: 'YY' })],
  };
  // a short walk in R1
  const walk = [5, 5.001, 5.002].map((lat, i) => ({ lat, lng: 5, ts: i }));
  const place = (id: string, lat: number, lng: number) => ({ id, name: id, kind: 'monument' as const, lat, lng });
  const found = (id: string, lat: number, lng: number) => ({ ...place(id, lat, lng), discoveredAt: 1 });

  it('gives each region its explored share of its own area', () => {
    const stats = buildRegionStats('XX', walk, undefined, data, regions, 'ru');
    const r1 = stats.find((r) => r.code === 'R1')!;
    expect(r1.exploredKm2).toBeGreaterThan(0);
    expect(r1.totalKm2).toBe(100);
    expect(r1.percent).toBeCloseTo((r1.exploredKm2 / 100) * 100, 10);
    expect(r1.wikidata).toBe('Q1');
    const r2 = stats.find((r) => r.code === 'R2')!;
    expect([r2.exploredKm2, r2.percent, r2.totalKm2]).toEqual([0, 0, 400]);
  });

  it('lists the regions that have cities, visited first, then by name in the language', () => {
    expect(buildRegionStats('XX', walk, undefined, data, regions, 'ru').map((r) => r.name)).toEqual(['Бета', 'Альфа', 'Гамма']);
    expect(buildRegionStats('XX', [], undefined, data, regions, 'ru').map((r) => r.name)).toEqual(['Альфа', 'Бета', 'Гамма']);
    expect(buildRegionStats('XX', [], undefined, data, regions, 'en').map((r) => r.name)).toEqual(['Beta', 'Delta', 'Gamma']);
  });

  it('lists a region that has no borders in the file with 0 % and no area, without failing', () => {
    const r3 = buildRegionStats('XX', walk, undefined, data, regions, 'ru').find((r) => r.code === 'R3')!;
    expect(r3).toMatchObject({ exploredKm2: 0, totalKm2: 0, percent: 0, wikidata: null });
  });

  it('counts found and unvisited places per region', () => {
    const places = {
      discovered: [found('f1', 5, 5), found('f2', 6, 6), found('f3', 5, 15)],
      hidden: [place('h1', 4, 4), place('h2', 5, 16), place('h3', 9, 19)],
    };
    const stats = buildRegionStats('XX', [], places, data, regions, 'ru');
    expect(stats.find((r) => r.code === 'R1')).toMatchObject({ found: 2, total: 3 });
    expect(stats.find((r) => r.code === 'R2')).toMatchObject({ found: 1, total: 3 });
    expect(stats.find((r) => r.code === 'R3')).toMatchObject({ found: 0, total: 0 });
  });

  it('gives only the places inside the region', () => {
    const places = { discovered: [found('f1', 5, 5), found('f3', 5, 15)], hidden: [place('h1', 4, 4), place('h2', 5, 16)] };
    const mine = placesOfRegion('R1', 'XX', places, regions)!;
    expect(mine.discovered.map((p) => p.id)).toEqual(['f1']);
    expect(mine.hidden.map((p) => p.id)).toEqual(['h1']);
    expect(placesOfRegion('R1', 'XX', undefined, regions)).toBeUndefined();
  });

  it('gives the visited cities of the region, by Wikidata or by an unambiguous name, and not those of others', () => {
    const stat = (name: string, w: string | null): CityStat => ({
      name,
      country: 'XX',
      wikidata: w,
      exploredKm2: 1,
      totalKm2: 10,
      percent: 10,
      found: 0,
    });
    const visited = [stat('x', 'QA1'), stat('Город A2', null), stat('Город B1', null), stat('nowhere', null)];
    expect(citiesOfRegion('R1', 'XX', visited, data).map((c) => c.name)).toEqual(['x', 'Город A2']);
    expect(citiesOfRegion('R2', 'XX', visited, data).map((c) => c.name)).toEqual(['Город B1']);
  });
});
