import type { KeyValueStorage } from '../settings/accuracyProfile';
import { buildOverpassQuery, OVERPASS_URLS, parseOverpassResponse } from './overpass';
import { tileBounds, tileKey, type Tile } from './tiles';
import type { Poi } from './types';

export const POI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedTile {
  ts: number;
  pois: Poi[];
}

export interface PoiCacheDeps {
  storage: KeyValueStorage;
  fetchTile: (tile: Tile) => Promise<Poi[]>;
  now?: () => number;
}

export function createPoiLoader({ storage, fetchTile, now = Date.now }: PoiCacheDeps) {
  const inFlight = new Map<string, Promise<Poi[]>>();

  async function load(tile: Tile): Promise<Poi[]> {
    const key = `poi.tile.v3.${tileKey(tile)}`;
    const raw = await storage.getItem(key);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as CachedTile;
        if (now() - cached.ts < POI_CACHE_TTL_MS) return cached.pois;
      } catch {
        // corrupted cache entry: refetch below
      }
    }
    const pois = await fetchTile(tile);
    await storage.setItem(key, JSON.stringify({ ts: now(), pois } satisfies CachedTile));
    return pois;
  }

  return (tile: Tile): Promise<Poi[]> => {
    const key = tileKey(tile);
    const running = inFlight.get(key);
    if (running) return running;
    const promise = load(tile).finally(() => inFlight.delete(key));
    inFlight.set(key, promise);
    return promise;
  };
}

// Overpass is a free public service: it answers 504 when busy or takes a minute, so ask each mirror for a limited time
// and try the next one instead of hanging on the first.
export const DIRECT_TIMEOUT_MS = 20000;

// overpass-api.de answers 406 to requests with no User-Agent (and throttles ones it does not like), so say who we are.
export const OVERPASS_USER_AGENT = 'Mistwalk/1.0 (+https://github.com/quelerir/mistwalk)';

async function fetchOverpassOnce(url: string, query: string): Promise<Poi[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': OVERPASS_USER_AGENT },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Overpass responded with ${response.status}`);
    return parseOverpassResponse(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTileFromOverpass(tile: Tile): Promise<Poi[]> {
  const query = buildOverpassQuery(tileBounds(tile));
  const errors: string[] = [];
  for (const url of OVERPASS_URLS) {
    try {
      return await fetchOverpassOnce(url, query);
    } catch (err) {
      errors.push(`${url}: ${String(err)}`);
    }
  }
  throw new Error(`Overpass unavailable (${errors.join('; ')})`);
}
