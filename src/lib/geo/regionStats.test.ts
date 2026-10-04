import { buildIndex, loadRegions, regionAt, regionAtIndex, type RegionsData } from './regionStats';

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
