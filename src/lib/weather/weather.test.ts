import { fetchWeather, parseWeather, rainIntensity, windToDrift } from './weather';

describe('rainIntensity', () => {
  it('is zero when it does not rain', () => {
    expect(rainIntensity({ cloudCover: 100, precipitation: 0 })).toBe(0);
  });

  it('grows with the amount of rain and stays within 0..1', () => {
    const drizzle = rainIntensity({ cloudCover: 90, precipitation: 0.1 });
    const rain = rainIntensity({ cloudCover: 90, precipitation: 2 });
    const storm = rainIntensity({ cloudCover: 100, precipitation: 50 });
    expect(drizzle).toBeGreaterThan(0);
    expect(drizzle).toBeLessThan(rain);
    expect(rain).toBeLessThan(storm);
    expect(storm).toBe(1);
  });
});

describe('parseWeather', () => {
  it('reads cloud cover and precipitation', () => {
    expect(parseWeather({ current: { cloud_cover: 40, precipitation: 0.2 } })).toEqual({ cloudCover: 40, precipitation: 0.2 });
  });

  it('reads the wind when it is there', () => {
    const json = { current: { cloud_cover: 40, precipitation: 0, wind_speed_10m: 18, wind_direction_10m: 200 } };
    expect(parseWeather(json)?.wind).toEqual({ fromDeg: 200, speedKmh: 18 });
  });

  it('rejects an unexpected payload', () => {
    expect(parseWeather({})).toBeNull();
    expect(parseWeather({ current: { cloud_cover: 'x' } })).toBeNull();
    expect(parseWeather(null)).toBeNull();
  });
});

describe('fetchWeather', () => {
  it('asks for the position rounded to about a kilometre', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ current: { cloud_cover: 10, precipitation: 0 } }) });
    const weather = await fetchWeather({ lat: 55.751244, lng: 37.618423 }, fetcher as unknown as typeof fetch);
    expect(weather).toEqual({ cloudCover: 10, precipitation: 0 });
    const url = String(fetcher.mock.calls[0][0]);
    expect(url).toContain('latitude=55.75');
    expect(url).toContain('longitude=37.62');
    expect(url).toContain('current=cloud_cover,precipitation');
  });

  it('returns null when the request fails', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await fetchWeather({ lat: 1, lng: 2 }, fetcher as unknown as typeof fetch)).toBeNull();
    const broken = jest.fn().mockRejectedValue(new Error('offline'));
    expect(await fetchWeather({ lat: 1, lng: 2 }, broken as unknown as typeof fetch)).toBeNull();
  });
});

describe('windToDrift', () => {
  it('sends clouds the way the wind blows: a west wind moves them east', () => {
    const d = windToDrift({ fromDeg: 270, speedKmh: 20 });
    expect(d.x).toBeGreaterThan(0);
    expect(Math.abs(d.y)).toBeLessThan(1e-9);
  });

  it('sends clouds south in a north wind, and north in a south wind', () => {
    expect(windToDrift({ fromDeg: 0, speedKmh: 20 }).y).toBeGreaterThan(0);
    expect(windToDrift({ fromDeg: 180, speedKmh: 20 }).y).toBeLessThan(0);
  });

  it('moves faster in a stronger wind, within a bound', () => {
    const speed = (kmh: number) => Math.hypot(windToDrift({ fromDeg: 90, speedKmh: kmh }).x, windToDrift({ fromDeg: 90, speedKmh: kmh }).y);
    expect(speed(0)).toBeGreaterThan(0);
    expect(speed(30)).toBeGreaterThan(speed(5));
    expect(speed(200)).toBe(speed(40));
  });

  it('falls back to a slow eastward drift without wind data', () => {
    const d = windToDrift(null);
    expect(d.x).toBeGreaterThan(0);
  });
});
