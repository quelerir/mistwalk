import type { Coordinate } from '../geo/distance';

export interface Weather {
  cloudCover: number; // percent
  precipitation: number; // mm in the last hour
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

// 0 = no rain; light drizzle is about 0.25, and it reaches 1 at heavy rain (6 mm/h and more).
export function rainIntensity({ precipitation }: Weather): number {
  if (precipitation <= 0) return 0;
  return Math.min(1, 0.25 + precipitation / 6);
}

export function parseWeather(json: unknown): Weather | null {
  const current = (json as { current?: { cloud_cover?: unknown; precipitation?: unknown } } | null)?.current;
  if (!current || typeof current.cloud_cover !== 'number' || typeof current.precipitation !== 'number') return null;
  return { cloudCover: current.cloud_cover, precipitation: current.precipitation };
}

// The position is rounded to two decimals (about a kilometre): enough for weather, and less to share.
export async function fetchWeather(position: Coordinate, fetcher: typeof fetch = fetch): Promise<Weather | null> {
  try {
    const url =
      `${ENDPOINT}?latitude=${position.lat.toFixed(2)}&longitude=${position.lng.toFixed(2)}` +
      '&current=cloud_cover,precipitation&timezone=auto';
    const response = await fetcher(url);
    if (!response.ok) return null;
    return parseWeather(await response.json());
  } catch {
    return null;
  }
}
