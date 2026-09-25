import { buildTrail, densifyTrail, glidePosition } from './fogTrail';
import { haversineDistanceMeters } from '../geo/distance';

const p = (lat: number, lng: number, ts = 0) => ({ lat, lng, radius: 60, ts });

describe('buildTrail', () => {
  it('orders the points by time and keeps only where they are', () => {
    const trail = buildTrail([p(2, 2, 20), p(1, 1, 10)]);
    expect(trail).toEqual([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }]);
  });
});

describe('densifyTrail', () => {
  it('returns a lone point as it is', () => {
    expect(densifyTrail([{ lat: 0, lng: 0 }], 20, 300)).toEqual([[0, 0]]);
  });

  it('adds points between two linked fixes, no further apart than the step', () => {
    const out = densifyTrail([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.0009 }], 20, 300); // about 100 m
    expect(out.length).toBe(7);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([0.0009, 0]);
    for (let i = 1; i < out.length; i++) {
      const gap = haversineDistanceMeters({ lng: out[i - 1][0], lat: out[i - 1][1] }, { lng: out[i][0], lat: out[i][1] });
      expect(gap).toBeLessThanOrEqual(20);
    }
  });

  it('does not join fixes further apart than the link limit', () => {
    const out = densifyTrail([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.005 }], 20, 300); // about 550 m
    expect(out).toEqual([[0, 0], [0.005, 0]]);
  });

  it('adds nothing between fixes closer than the step', () => {
    expect(densifyTrail([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.0001 }], 20, 300)).toEqual([[0, 0], [0.0001, 0]]);
  });
});

describe('glidePosition', () => {
  const a = { lat: 0, lng: 0 };
  const b = { lat: 0, lng: 0.0009 }; // about 100 m

  it('starts at the old fix and ends at the new one', () => {
    expect(glidePosition(a, b, 0, 2000, 300)).toEqual(a);
    expect(glidePosition(a, b, 2000, 2000, 300)).toEqual(b);
    expect(glidePosition(a, b, 5000, 2000, 300)).toEqual(b);
  });

  it('is halfway at half the time', () => {
    const mid = glidePosition(a, b, 1000, 2000, 300);
    expect(mid.lng).toBeCloseTo(0.00045, 8);
  });

  it('jumps at once when the fixes are further apart than the snap distance', () => {
    expect(glidePosition(a, { lat: 0, lng: 0.005 }, 0, 2000, 300)).toEqual({ lat: 0, lng: 0.005 });
  });
});
