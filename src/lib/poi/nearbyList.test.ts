import { buildNearbyList, countInRadius, emptyMessage, kindCounts, type NearbyOptions } from './nearbyList';
import { makeT } from '../../i18n';
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

  it('sorts by name backwards, Я to А', () => {
    const list = buildNearbyList(origin, pois, new Set(['done']), { ...base, sort: 'name-desc' });
    expect(list.map((i) => i.poi.name)).toEqual(['Яблоко', 'Башня', 'Арка']);
  });

  it('sorts by distance, farthest first', () => {
    const list = buildNearbyList(origin, pois, new Set(['done']), { ...base, sort: 'distance-desc' });
    expect(list.map((i) => i.poi.id)).toEqual(['a', 'c', 'b']);
  });

  it('applies the limit after the sort, so farthest first keeps the farthest ones', () => {
    const list = buildNearbyList(origin, pois, new Set(['done']), { ...base, sort: 'distance-desc', limit: 2 });
    expect(list.map((i) => i.poi.id)).toEqual(['a', 'c']);
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

describe('countInRadius', () => {
  it('counts places within the radius, found ones included', () => {
    expect(countInRadius(origin, pois, 1000)).toBe(4);
    expect(countInRadius(origin, pois, 60)).toBe(1);
  });

  it('is zero without a position or with nothing around', () => {
    expect(countInRadius(null, pois, 1000)).toBe(0);
    expect(countInRadius(origin, [], 1000)).toBe(0);
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

describe('emptyMessage', () => {
  const t = makeT('ru');
  const en = makeT('en');

  it('waits for the position first', () => {
    expect(emptyMessage(t, false, 'idle', 0)).toBe('Ждём вашу позицию…');
    expect(emptyMessage(t, false, 'loading', 5)).toBe('Ждём вашу позицию…');
  });

  it('says the places are loading, or that the server is not answering, while there are none yet', () => {
    expect(emptyMessage(t, true, 'loading', 0)).toBe('Загружаем места рядом…');
    expect(emptyMessage(t, true, 'retrying', 0)).toBe('Сервер мест не отвечает, пробуем снова…');
  });

  it('tells "nothing here" apart from "everything found"', () => {
    expect(emptyMessage(t, true, 'idle', 0)).toContain('мест не нашлось');
    expect(emptyMessage(t, true, 'idle', 7)).toContain('всё открыто');
  });

  it('does not claim the places are loading once some are known', () => {
    expect(emptyMessage(t, true, 'loading', 3)).toContain('всё открыто');
  });

  it('speaks English too', () => {
    expect(emptyMessage(en, false, 'idle', 0)).toBe('Waiting for your position…');
    expect(emptyMessage(en, true, 'idle', 0)).toContain('No places found');
    expect(emptyMessage(en, true, 'idle', 4)).toContain('is found');
  });
});
