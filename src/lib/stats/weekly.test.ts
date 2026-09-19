import { weekSummary, dailyKm } from './weekly';
import type { DiscoveredPlace } from '../poi/types';

const DAY = 24 * 3600 * 1000;
// A Wednesday, midday, local time.
const now = new Date(2026, 8, 16, 12, 0, 0).getTime();

// dLat 0.0009 is about 100 m.
const at = (daysAgo: number, dLat: number, hour = 10) => ({
  lat: 55.75 + dLat,
  lng: 37.6,
  ts: new Date(2026, 8, 16 - daysAgo, hour, 0, 0).getTime(),
});

const place = (id: string, daysAgo: number): DiscoveredPlace => ({
  id,
  name: id,
  kind: 'monument',
  lat: 0,
  lng: 0,
  discoveredAt: now - daysAgo * DAY + 1000,
});

describe('weekSummary', () => {
  it('sums distance, days walked and places found over the last 7 days', () => {
    const points = [
      at(0, 0),
      at(0, 0.0009, 11), // +100 m today
      at(2, 0.002),
      at(2, 0.0029, 11), // +100 m two days ago
    ];
    const s = weekSummary(points, [place('a', 1), place('b', 6)], now);
    expect(s.km).toBeCloseTo(0.2, 1);
    expect(s.days).toBe(2);
    expect(s.places).toBe(2);
  });

  it('compares with the 7 days before and ignores anything older', () => {
    const points = [
      at(9, 0),
      at(9, 0.0009, 11), // previous week, 100 m
      at(20, 0),
      at(20, 0.009, 11), // too old
    ];
    const s = weekSummary(points, [place('old', 9), place('older', 20)], now);
    expect(s.km).toBe(0);
    expect(s.prev.km).toBeCloseTo(0.1, 1);
    expect(s.prev.days).toBe(1);
    expect(s.prev.places).toBe(1);
  });

  it('is all zeros for no data', () => {
    expect(weekSummary([], [], now)).toEqual({
      km: 0, days: 0, places: 0, prev: { km: 0, days: 0, places: 0 },
    });
  });
});

describe('dailyKm', () => {
  it('gives km per day for the last 7 days, oldest first, today last', () => {
    const points = [
      at(0, 0),
      at(0, 0.0009, 11), // today: 100 m
      at(2, 0.002),
      at(2, 0.0029, 11), // two days ago: 100 m
      at(8, 0),
      at(8, 0.0009, 11), // too old
    ];
    const days = dailyKm(points, now);
    expect(days).toHaveLength(7);
    expect(days[6]).toBeCloseTo(0.1, 1);
    expect(days[4]).toBeCloseTo(0.1, 1);
    expect(days.filter((d) => d > 0)).toHaveLength(2);
  });
});
