import type { Coordinate } from '../geo/distance';

export interface Wind {
  fromDeg: number; // the direction the wind blows FROM, clockwise from north
  speedKmh: number;
}

export interface Weather {
  cloudCover: number; // percent
  precipitation: number; // mm in the last hour
  wind?: Wind;
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';

// 0 = no rain; light drizzle is about 0.25, and it reaches 1 at heavy rain (6 mm/h and more).
export function rainIntensity({ precipitation }: Weather): number {
  if (precipitation <= 0) return 0;
  return Math.min(1, 0.25 + precipitation / 6);
}

// Where the clouds go when the wind is unknown (no weather, offline, or the setting is off): a slow drift eastwards.
const DEFAULT_WIND: Wind = { fromDeg: 270, speedKmh: 10 };
const CALM_DRIFT_PX_S = 4;
const GALE_DRIFT_PX_S = 14;
const GALE_KMH = 40;

export interface CloudDrift {
  x: number; // px per second in map space (x east, y south), before the map's own zoom
  y: number;
}

// Clouds travel the way the wind blows, so opposite to the direction it comes from; a stronger wind moves them faster.
export function windToDrift(wind: Wind | null | undefined): CloudDrift {
  const w = wind ?? DEFAULT_WIND;
  const speed = CALM_DRIFT_PX_S + (GALE_DRIFT_PX_S - CALM_DRIFT_PX_S) * Math.min(1, Math.max(0, w.speedKmh) / GALE_KMH);
  const toward = ((w.fromDeg + 180) * Math.PI) / 180;
  return { x: Math.sin(toward) * speed, y: -Math.cos(toward) * speed };
}

export function parseWeather(json: unknown): Weather | null {
  const current = (
    json as {
      current?: { cloud_cover?: unknown; precipitation?: unknown; wind_speed_10m?: unknown; wind_direction_10m?: unknown };
    } | null
  )?.current;
  if (!current || typeof current.cloud_cover !== 'number' || typeof current.precipitation !== 'number') return null;
  const weather: Weather = { cloudCover: current.cloud_cover, precipitation: current.precipitation };
  if (typeof current.wind_speed_10m === 'number' && typeof current.wind_direction_10m === 'number') {
    weather.wind = { fromDeg: current.wind_direction_10m, speedKmh: current.wind_speed_10m };
  }
  return weather;
}

// The position is rounded to two decimals (about a kilometre): enough for weather, and less to share.
export async function fetchWeather(position: Coordinate, fetcher: typeof fetch = fetch): Promise<Weather | null> {
  try {
    const url =
      `${ENDPOINT}?latitude=${position.lat.toFixed(2)}&longitude=${position.lng.toFixed(2)}` +
      '&current=cloud_cover,precipitation,wind_speed_10m,wind_direction_10m&timezone=auto';
    const response = await fetcher(url);
    if (!response.ok) return null;
    return parseWeather(await response.json());
  } catch {
    return null;
  }
}
