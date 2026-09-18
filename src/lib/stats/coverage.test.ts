import { computeAreaKm2, computeDistanceKm, computeStreakDays } from './coverage';

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

describe('computeStreakDays', () => {
  const DAY = 86_400_000;
  const now = Date.UTC(2026, 8, 19, 12, 0, 0);
  const on = (daysAgo: number) => at(0, 0, now - daysAgo * DAY);

  it('counts consecutive days including today', () => {
    expect(computeStreakDays([on(0), on(1), on(2)], now, 0)).toBe(3);
  });

  it('keeps the streak alive if you have not walked yet today', () => {
    expect(computeStreakDays([on(1), on(2)], now, 0)).toBe(2);
  });

  it('breaks on a gap and is zero when the last walk was two days ago', () => {
    expect(computeStreakDays([on(0), on(2)], now, 0)).toBe(1);
    expect(computeStreakDays([on(2), on(3)], now, 0)).toBe(0);
  });

  it('respects the timezone offset when deciding the day', () => {
    const lateEvening = at(0, 0, Date.UTC(2026, 8, 19, 22, 30));
    const justAfterMidnightUtc = Date.UTC(2026, 8, 20, 0, 30);
    // At UTC+3 both moments are on the same local day (Sep 20 01:30 and Sep 20 03:30).
    expect(computeStreakDays([lateEvening], justAfterMidnightUtc, 180)).toBe(1);
  });
});
