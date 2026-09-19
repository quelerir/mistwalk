import { buildNearbyList, kindCounts, type NearbyOptions } from './nearbyList';
import type { Poi, PoiKind } from './types';

const origin = { lat: 55.75, lng: 37.6 };

// dLat 0.0009 is about 100 m.
function poi(id: string, name: string, kind: PoiKind, dLat: number): Poi {
  return { id, name, kind, lat: origin.lat + dLat, lng: origin.lng };
}

const pois = [
  poi('a', 'Яблоко', 'monument', 0.0027),
  poi('b', 'Арка', 'castle', 0.0009),
  poi('c', 'Башня', 'monument', 0.0018),
  poi('far', 'Далеко', 'monument', 0.02),
  poi('done', 'Открыто', 'monument', 0.0004),
];
const base: NearbyOptions = { kind: 'all', sort: 'distance', radiusMeters: 1000, limit: 30 };

describe('buildNearbyList', () => {
  it('lists undiscovered places within the radius, nearest first', () => {
    const list = buildNearbyList(origin, pois, new Set(['done']), base);
    expect(list.map((i) => i.poi.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters by kind', () => {
    const list = buildNearbyList(origin, pois, new Set(['done']), { ...base, kind: 'monument' });
    expect(list.map((i) => i.poi.id)).toEqual(['c', 'a']);
  });

  it('sorts by name', () => {
    const list = buildNearbyList(origin, pois, new Set(['done']), { ...base, sort: 'name' });
    expect(list.map((i) => i.poi.name)).toEqual(['Арка', 'Башня', 'Яблоко']);
  });

  it('applies the limit after the filter, so a rare kind is not cut off', () => {
    const many = [
      ...Array.from({ length: 5 }, (_, i) => poi(`m${i}`, `M${i}`, 'monument', 0.0001 * (i + 1))),
      poi('rare', 'Редкий', 'ruins', 0.006),
    ];
    const list = buildNearbyList(origin, many, new Set(), { ...base, kind: 'ruins', limit: 3 });
    expect(list.map((i) => i.poi.id)).toEqual(['rare']);
  });

  it('returns nothing without a position', () => {
    expect(buildNearbyList(null, pois, new Set(), base)).toEqual([]);
  });
});

describe('kindCounts', () => {
  it('counts undiscovered places in the radius per kind, biggest group first', () => {
    expect(kindCounts(origin, pois, new Set(['done']), 1000)).toEqual([
      { kind: 'monument', count: 2 },
      { kind: 'castle', count: 1 },
    ]);
  });
});
