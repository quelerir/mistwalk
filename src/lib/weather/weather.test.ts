import { fetchWeather, fogDensity, parseWeather } from './weather';

describe('fogDensity', () => {
  it('is thin in clear weather, thick under rain', () => {
    const clear = fogDensity({ cloudCover: 0, precipitation: 0 });
    const overcast = fogDensity({ cloudCover: 100, precipitation: 0 });
    const rain = fogDensity({ cloudCover: 100, precipitation: 1 });
    const storm = fogDensity({ cloudCover: 100, precipitation: 6 });
    expect(clear).toBeLessThan(overcast);
    expect(overcast).toBeLessThan(rain);
    expect(rain).toBeLessThan(storm);
  });

  it('stays within 0..1', () => {
    expect(fogDensity({ cloudCover: 0, precipitation: 0 })).toBeGreaterThanOrEqual(0);
    expect(fogDensity({ cloudCover: 100, precipitation: 50 })).toBeLessThanOrEqual(1);
  });
});

describe('parseWeather', () => {
  it('reads cloud cover and precipitation', () => {
    expect(parseWeather({ current: { cloud_cover: 40, precipitation: 0.2 } })).toEqual({ cloudCover: 40, precipitation: 0.2 });
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
