import { makeT } from '../../i18n';
import {
  distanceFromRoute,
  fetchWalkingRoute,
  formatWalkingTime,
  parseWalkingRoute,
} from './walkingRoute';

const ok = {
  code: 'Ok',
  routes: [
    {
      distance: 539,
      duration: 431.3,
      geometry: {
        coordinates: [
          [16.3739, 48.2082],
          [16.3752, 48.2088],
          [16.379, 48.21],
        ] as Array<[number, number]>,
      },
    },
  ],
};

describe('parseWalkingRoute', () => {
  it('extracts geometry, distance and duration', () => {
    const route = parseWalkingRoute(ok);
    expect(route.coordinates).toHaveLength(3);
    expect(route.distanceMeters).toBe(539);
    expect(route.durationSeconds).toBeCloseTo(431.3);
  });

  it('throws when no route was found', () => {
    expect(() => parseWalkingRoute({ code: 'NoRoute' })).toThrow('no walking route');
    expect(() => parseWalkingRoute({ code: 'Ok', routes: [] })).toThrow();
  });
});

describe('fetchWalkingRoute', () => {
  it('requests lng,lat pairs and parses the response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ok });
    const route = await fetchWalkingRoute(
      { lat: 48.2082, lng: 16.3738 },
      { lat: 48.21, lng: 16.379 },
      fetchImpl as unknown as typeof fetch
    );
    expect(fetchImpl.mock.calls[0][0]).toContain('/foot/16.3738,48.2082;16.379,48.21?');
    expect(route.distanceMeters).toBe(539);
  });

  it('throws on a non-2xx status', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(
      fetchWalkingRoute({ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, fetchImpl as unknown as typeof fetch)
    ).rejects.toThrow('429');
  });
});

describe('distanceFromRoute', () => {
  it('is near zero on the route and grows away from it', () => {
    const route = parseWalkingRoute(ok);
    expect(distanceFromRoute(route, { lat: 48.2088, lng: 16.3752 })).toBeLessThan(1);
    expect(distanceFromRoute(route, { lat: 48.22, lng: 16.4 })).toBeGreaterThan(1000);
  });
});

describe('formatWalkingTime', () => {
  it('formats minutes and hours', () => {
    expect(formatWalkingTime(makeT('ru'), 20)).toBe('1 мин');
    expect(formatWalkingTime(makeT('ru'), 431)).toBe('7 мин');
    expect(formatWalkingTime(makeT('ru'), 4500)).toBe('1 ч 15 мин')
    expect(formatWalkingTime(makeT('en'), 4500)).toBe('1 h 15 min')
    expect(formatWalkingTime(makeT('en'), 431)).toBe('7 min');
  });
});
