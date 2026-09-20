import type { KeyValueStorage } from '../settings/accuracyProfile';
import { lightenDarkStyle, type MapStyleJson } from './darkStyle';
import { MAP_STYLES } from './styles';

const CACHE_KEY = 'map.darkStyle.v1';
// The style rarely changes; a week-old copy is fine, and a stale one still beats going without.
export const STYLE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const STYLE_FETCH_TIMEOUT_MS = 6000;

interface Cached {
  ts: number;
  style: MapStyleJson;
}

export interface StyleLoaderDeps {
  storage: KeyValueStorage;
  fetcher?: typeof fetch;
  now?: () => number;
}

function isStyle(value: unknown): value is MapStyleJson {
  return typeof value === 'object' && value !== null && Array.isArray((value as MapStyleJson).layers);
}

async function readCache(storage: KeyValueStorage): Promise<Cached | null> {
  try {
    const raw = await storage.getItem(CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Cached) : null;
    return parsed && typeof parsed.ts === 'number' && isStyle(parsed.style) ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchStyle(fetcher: typeof fetch): Promise<MapStyleJson | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STYLE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetcher(MAP_STYLES.dark, { signal: controller.signal });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    return isStyle(json) ? json : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// The lighter dark map style: from the copy kept on the device while it is fresh, otherwise downloaded, lightened and
// kept. Offline or when the download fails the old copy is used, and with none at all this returns null, so the caller
// falls back to the ordinary dark style from its address.
export async function loadDarkStyle({ storage, fetcher = fetch, now = Date.now }: StyleLoaderDeps): Promise<MapStyleJson | null> {
  const cached = await readCache(storage);
  if (cached && now() - cached.ts < STYLE_TTL_MS) return cached.style;

  const fresh = await fetchStyle(fetcher);
  if (!fresh) return cached?.style ?? null;

  const style = lightenDarkStyle(fresh);
  try {
    await storage.setItem(CACHE_KEY, JSON.stringify({ ts: now(), style } satisfies Cached));
  } catch {
    // Not kept: it is downloaded again next time.
  }
  return style;
}
