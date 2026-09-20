import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import type { Coordinate } from '../lib/geo/distance';
import { pickPlaceToNotify, recordNotified, type NotifyState } from '../lib/notifications/nearbyPlace';
import { dedupePois, withAliases } from '../lib/poi/dedupe';
import { tileForLngLat, tileKey } from '../lib/poi/tiles';
import type { DiscoveredPlace, Poi } from '../lib/poi/types';
import { getPlaceNotifications } from '../lib/settings/placeNotifications';
import { loadTranslator } from '../i18n';

const STATE_KEY = 'notifications.placeState.v1';
const TILE_KEY_PREFIX = 'poi.tile.v3.';
const DISCOVERED_KEY_PREFIX = 'places.discovered.v1.';

let running = false;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Places come from the tile cache the map already fills (the 3x3 tiles around the position), so this
// needs no network. A place that was never cached simply cannot trigger a notification.
async function cachedPoisAround(position: Coordinate): Promise<Poi[]> {
  const center = tileForLngLat(position.lng, position.lat);
  const pois: Poi[] = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const key = TILE_KEY_PREFIX + tileKey({ x: center.x + dx, y: center.y + dy, z: center.z });
      const cached = await readJson<{ pois?: Poi[] } | null>(key, null);
      if (cached?.pois) pois.push(...cached.pois);
    }
  }
  return pois;
}

// Called from the background location task: tells the player, without naming it, that an
// undiscovered place is close. Silent while the app is on screen (the map already shows it).
export async function notifyIfNearby(position: Coordinate, now: number = Date.now()): Promise<void> {
  if (running || AppState.currentState === 'active') return;
  running = true;
  try {
    const setting = await getPlaceNotifications(AsyncStorage);
    if (!setting.enabled || !setting.userId) return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const discovered = await readJson<DiscoveredPlace[]>(DISCOVERED_KEY_PREFIX + setting.userId, []);
    const state = await readJson<NotifyState>(STATE_KEY, { lastAt: 0, places: {} });
    // The same twins folding as on the map, so one real place cannot be announced twice, or announced after it was found.
    const pois = dedupePois(await cachedPoisAround(position));
    const place = pickPlaceToNotify(
      position,
      pois,
      withAliases(new Set(discovered.map((d) => d.id)), pois),
      state,
      now
    );
    if (!place) return;

    const { t } = await loadTranslator();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notify.placeTitle'),
        body: t('notify.placeBody'),
      },
      trigger: null,
    });
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(recordNotified(state, place.id, now)));
  } catch (err) {
    console.warn('[placeNotifier] failed', err);
  } finally {
    running = false;
  }
}
