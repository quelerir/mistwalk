import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { OfflineManager, type OfflinePack } from '@maplibre/maplibre-react-native';
import { ANDROID_SAFE_MODE } from '../lib/androidSafeMode';
import type { Coordinate } from '../lib/geo/distance';
import { areaBounds, shouldRefreshArea, MAX_ZOOM, MIN_ZOOM, type AreaPack } from '../lib/map/offlineArea';
import { getOfflineMap } from '../lib/settings/offlineMap';

const LAST_ATTEMPT_KEY = 'offlineMap.lastAttempt.v1';
const CACHE_LIMIT_BYTES = 150 * 1024 * 1024;
const CHECK_THROTTLE_MS = 60 * 1000;

let lastCheck = 0;
let downloading = false;
let cacheLimitSet = false;

function areaOf(pack: OfflinePack): AreaPack | null {
  const m = pack.metadata as Partial<AreaPack> & { kind?: string };
  if (m.kind !== 'area' || !m.styleUrl || !m.center || typeof m.createdAt !== 'number') return null;
  return { styleUrl: m.styleUrl, center: m.center, createdAt: m.createdAt };
}

// Keeps the map of the area around you on the phone. Called with your position while the app is open; it
// decides by itself whether a download is due (see shouldRefreshArea) and replaces the old area when done.
export async function ensureOfflineArea(position: Coordinate, styleUrl: string, now: number = Date.now()): Promise<void> {
  if (ANDROID_SAFE_MODE || downloading || now - lastCheck < CHECK_THROTTLE_MS) return;
  lastCheck = now;
  try {
    if (!(await getOfflineMap(AsyncStorage))) return;
    const net = await NetInfo.fetch();
    const onWifi = net.isConnected === true && net.type === 'wifi';

    if (!cacheLimitSet) {
      await OfflineManager.setMaximumAmbientCacheSize(CACHE_LIMIT_BYTES);
      cacheLimitSet = true;
    }

    const packs = await OfflineManager.getPacks();
    const lastAttemptAt = Number((await AsyncStorage.getItem(LAST_ATTEMPT_KEY)) ?? 0);
    const known = packs.map(areaOf).filter((a): a is AreaPack => a !== null);
    if (!shouldRefreshArea({ position, now, styleUrl, packs: known, onWifi, lastAttemptAt })) return;

    downloading = true;
    await AsyncStorage.setItem(LAST_ATTEMPT_KEY, String(now));
    const oldPackIds = packs.filter((p) => areaOf(p)?.styleUrl === styleUrl).map((p) => p.id);
    let finished = false;
    await OfflineManager.createPack(
      {
        mapStyle: styleUrl,
        bounds: areaBounds(position),
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        metadata: { kind: 'area', styleUrl, center: position, createdAt: now },
      },
      (_pack, status) => {
        // The new area is complete: only now drop the previous one, so there is always a map to fall back on.
        if (status.state === 'complete' && !finished) {
          finished = true;
          downloading = false;
          void Promise.all(oldPackIds.map((id) => OfflineManager.deletePack(id))).catch(() => {});
        }
      },
      (_pack, error) => {
        console.warn('[offlineMap] download failed', error.message);
        downloading = false;
      }
    );
  } catch (err) {
    console.warn('[offlineMap] failed', err);
    downloading = false;
  }
}

// Bytes taken by downloaded areas (0 when there are none).
export async function offlineMapBytes(): Promise<number> {
  try {
    const packs = await OfflineManager.getPacks();
    const statuses = await Promise.all(packs.map((p) => p.status()));
    return statuses.reduce((sum, s) => sum + s.completedResourceSize, 0);
  } catch {
    return 0;
  }
}

export async function clearOfflineAreas(): Promise<void> {
  try {
    const packs = await OfflineManager.getPacks();
    await Promise.all(packs.map((p) => OfflineManager.deletePack(p.id)));
    await AsyncStorage.removeItem(LAST_ATTEMPT_KEY);
  } catch (err) {
    console.warn('[offlineMap] clear failed', err);
  }
}
