import { bearingLabel, findNewlyDiscovered } from './discovery';
import type { Poi } from './types';

const poi = (id: string, lat: number, lng: number): Poi => ({ id, name: id, kind: 'monument', lat, lng });

describe('findNewlyDiscovered', () => {
  const near = poi('near', 41.7151, 44.8271);
  const far = poi('far', 41.7251, 44.8271);
  const position = { lat: 41.71515, lng: 44.82715 };

  it('returns only places within the radius', () => {
    expect(findNewlyDiscovered(position, [near, far], new Set())).toEqual([near]);
  });

  it('skips places that are already discovered', () => {
    expect(findNewlyDiscovered(position, [near], new Set(['near']))).toEqual([]);
  });

  it('respects a custom radius', () => {
    expect(findNewlyDiscovered(position, [near], new Set(), 1)).toEqual([]);
  });
});

describe('bearingLabel', () => {
  it('names the compass direction from one point to another', () => {
    const o = { lat: 0, lng: 0 };
    expect(bearingLabel(o, { lat: 1, lng: 0 })).toBe('севернее');
    expect(bearingLabel(o, { lat: 0, lng: 1 })).toBe('восточнее');
    expect(bearingLabel(o, { lat: -1, lng: 0 })).toBe('южнее');
    expect(bearingLabel(o, { lat: 0, lng: -1 })).toBe('западнее');
  });
});
