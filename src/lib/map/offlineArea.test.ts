import {
  MAX_PACK_AGE_MS,
  MIN_ATTEMPT_INTERVAL_MS,
  REFRESH_DISTANCE_KM,
  areaBounds,
  shouldRefreshArea,
  type AreaPack,
} from './offlineArea';

const here = { lat: 55.75, lng: 37.6 };
const now = 100 * 24 * 3600 * 1000;
const style = 'https://tiles.example/style';

const pack = (over: Partial<AreaPack> = {}): AreaPack => ({
  styleUrl: style,
  center: here,
  createdAt: now - 1000,
  ...over,
});

const base = { position: here, now, styleUrl: style, onWifi: true, lastAttemptAt: 0 };

describe('areaBounds', () => {
  it('is a square about 5 km wide around the centre', () => {
    const [west, south, east, north] = areaBounds(here);
    expect(north - south).toBeCloseTo(5 / 111.32, 2);
    expect(east - west).toBeGreaterThan(north - south); // a degree of longitude is shorter at this latitude
    expect((west + east) / 2).toBeCloseTo(here.lng, 5);
    expect((south + north) / 2).toBeCloseTo(here.lat, 5);
  });
});

describe('shouldRefreshArea', () => {
  it('downloads when there is no pack for this map style yet', () => {
    expect(shouldRefreshArea({ ...base, packs: [] })).toBe(true);
    expect(shouldRefreshArea({ ...base, packs: [pack({ styleUrl: 'https://other/style' })] })).toBe(true);
  });

  it('stays quiet while the pack is fresh and you are near its centre', () => {
    expect(shouldRefreshArea({ ...base, packs: [pack()] })).toBe(false);
  });

  it('downloads again after moving far from the centre', () => {
    const far = { lat: here.lat + (REFRESH_DISTANCE_KM + 0.5) / 111.32, lng: here.lng };
    expect(shouldRefreshArea({ ...base, position: far, packs: [pack()] })).toBe(true);
  });

  it('downloads again when the pack is too old', () => {
    expect(shouldRefreshArea({ ...base, packs: [pack({ createdAt: now - MAX_PACK_AGE_MS - 1 })] })).toBe(true);
  });

  it('never downloads off Wi-Fi', () => {
    expect(shouldRefreshArea({ ...base, onWifi: false, packs: [] })).toBe(false);
  });

  it('does not try again within the minimum interval', () => {
    expect(shouldRefreshArea({ ...base, lastAttemptAt: now - MIN_ATTEMPT_INTERVAL_MS + 1000, packs: [] })).toBe(false);
    expect(shouldRefreshArea({ ...base, lastAttemptAt: now - MIN_ATTEMPT_INTERVAL_MS - 1000, packs: [] })).toBe(true);
  });

  it('uses the newest pack of the style', () => {
    const far = { lat: here.lat + 0.1, lng: here.lng };
    const packs = [pack({ center: far, createdAt: now - 5000 }), pack({ createdAt: now - 1000 })];
    expect(shouldRefreshArea({ ...base, packs })).toBe(false);
  });
});
