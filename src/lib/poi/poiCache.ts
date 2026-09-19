import type { KeyValueStorage } from '../settings/accuracyProfile';
import { buildOverpassQuery, OVERPASS_URL, parseOverpassResponse } from './overpass';
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
    const key = `poi.tile.v2.${tileKey(tile)}`;
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

export async function fetchTileFromOverpass(tile: Tile): Promise<Poi[]> {
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(buildOverpassQuery(tileBounds(tile)))}`,
  });
  if (!response.ok) throw new Error(`Overpass responded with ${response.status}`);
  return parseOverpassResponse(await response.json());
}
