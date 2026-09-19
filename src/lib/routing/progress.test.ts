import { routeProgress } from './progress';
import type { WalkingRoute } from './walkingRoute';

// A straight route heading east along the equator: 0.001 degree is about 111 m.
const route: WalkingRoute = {
  coordinates: [
    [0, 0],
    [0.001, 0],
    [0.002, 0],
    [0.003, 0],
  ],
  distanceMeters: 334,
  durationSeconds: 300,
};

describe('routeProgress', () => {
  it('keeps the whole line at the start', () => {
    const p = routeProgress(route, { lat: 0, lng: 0 });
    expect(p.coordinates).toHaveLength(4);
    expect(p.remainingMeters).toBeCloseTo(334, 0);
    expect(p.remainingSeconds).toBeCloseTo(300, 0);
  });

  it('drops the part already walked and starts at the projection', () => {
    const p = routeProgress(route, { lat: 0.0001, lng: 0.0015 });
    expect(p.coordinates[0][0]).toBeCloseTo(0.0015, 6);
    expect(p.coordinates[0][1]).toBeCloseTo(0, 6);
    expect(p.coordinates).toHaveLength(3);
    expect(p.remainingMeters).toBeCloseTo(167, 0);
    expect(p.remainingSeconds).toBeCloseTo(150, 0);
  });

  it('is nearly empty at the destination', () => {
    const p = routeProgress(route, { lat: 0, lng: 0.003 });
    expect(p.remainingMeters).toBeLessThan(1);
    expect(p.coordinates.length).toBeGreaterThanOrEqual(2);
  });

  it('snaps to the nearest part when the walker is off the route', () => {
    const p = routeProgress(route, { lat: 0.01, lng: 0.0005 });
    expect(p.coordinates[0][0]).toBeCloseTo(0.0005, 6);
  });
});
