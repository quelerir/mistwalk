import { computeAreaKm2, computeDistanceKm } from './coverage';

const at = (lat: number, lng: number, ts = 0) => ({ lat, lng, ts });

describe('computeDistanceKm', () => {
  it('sums consecutive steps in time order', () => {
    // 0.001 deg of latitude is about 111 m.
    const km = computeDistanceKm([at(0.002, 0, 2), at(0, 0, 0), at(0.001, 0, 1)]);
    expect(km).toBeGreaterThan(0.21);
    expect(km).toBeLessThan(0.23);
  });

  it('ignores jumps between separate walks', () => {
    expect(computeDistanceKm([at(0, 0, 0), at(1, 1, 1)])).toBe(0);
  });

  it('is zero for no points or one point', () => {
    expect(computeDistanceKm([])).toBe(0);
    expect(computeDistanceKm([at(1, 1)])).toBe(0);
  });
});

describe('computeAreaKm2', () => {
  it('is zero for no points', () => {
    expect(computeAreaKm2([])).toBe(0);
  });

  it('a single point reveals roughly a circle of the reveal radius (about 0.0113 km²)', () => {
    const area = computeAreaKm2([at(41.7151, 44.8271)]);
    expect(area).toBeGreaterThan(0.009);
    expect(area).toBeLessThan(0.014);
  });

  it('does not count the same spot twice', () => {
    const once = computeAreaKm2([at(41.7151, 44.8271)]);
    const twice = computeAreaKm2([at(41.7151, 44.8271, 1), at(41.7151, 44.8271, 2)]);
    expect(twice).toBeCloseTo(once, 6);
  });

  it('a walked line covers more than its endpoints alone (trail is filled in)', () => {
    const a = at(41.7151, 44.8271, 1);
    const b = at(41.7171, 44.8271, 2); // about 220 m north
    const line = computeAreaKm2([a, b]);
    expect(line).toBeGreaterThan(computeAreaKm2([a]) * 1.8);
  });
});
