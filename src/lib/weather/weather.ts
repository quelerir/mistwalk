import type { Coordinate } from '../geo/distance';

export interface Weather {
  cloudCover: number; // percent
  precipitation: number; // mm in the last hour
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

// 0 = thinnest fog (clear sky), 1 = thickest (heavy rain); 0.5 is the fog as it was drawn before weather.
export function fogDensity({ cloudCover, precipitation }: Weather): number {
  const clouds = Math.min(100, Math.max(0, cloudCover)) / 100;
  let density = 0.25 + clouds * 0.35;
  if (precipitation > 0) density += 0.25;
  if (precipitation > 2.5) density += 0.1;
  return Math.min(1, Math.max(0, density));
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
