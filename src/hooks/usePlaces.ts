import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MapView } from '../lib/geo/projection';
import { findNewlyDiscovered } from '../lib/poi/discovery';
import { createPoiLoader } from '../lib/poi/poiCache';
import { createTileFetcher } from '../lib/poi/proxy';
import type { PlacesStatus } from '../lib/poi/placesStatus';
import { isPlaceholderView, pickNextTile } from '../lib/poi/tileQueue';
import { retryDelayMs } from '../lib/poi/tileRetry';
import { tileForLngLat, tileKey, tilesForViewport, type Tile } from '../lib/poi/tiles';
import type { DiscoveredPlace, Poi } from '../lib/poi/types';
import { fetchDiscoveredPlaces, upsertDiscoveredPlaces } from '../lib/supabase/discoveredPlaces';

const TILE_DEBOUNCE_MS = 500;
const RETRY_AFTER_MS = 30_000;
const GREETING_MS = 6000;
const MIN_POI_ZOOM = 12;
const PREFETCH_FACTOR = 1.8;
const BETWEEN_REQUESTS_MS = 400;
const RATE_LIMIT_PAUSE_MS = 5000;
// Two tiles at a time: the shared cache answers most at once, and a slow one no longer holds up all the others.
const CONCURRENT_TILES = 2;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type { PlacesStatus };

export interface UsePlacesOptions {
  client: SupabaseClient;
  userId: string;
  view: MapView | null;
  livePosition: { lat: number; lng: number } | null;
}

function localKey(userId: string): string {
  return `places.discovered.v1.${userId}`;
}

function mergePois(current: Poi[], incoming: Poi[]): Poi[] {
  if (incoming.length === 0) return current;
  const byId = new Map(current.map((p) => [p.id, p]));
  let changed = false;
  for (const poi of incoming) {
    if (!byId.has(poi.id)) {
      byId.set(poi.id, poi);
      changed = true;
    }
  }
  return changed ? Array.from(byId.values()) : current;
}

export function usePlaces({ client, userId, view, livePosition }: UsePlacesOptions) {
  const [pois, setPois] = useState<Poi[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredPlace[]>([]);
  const [greeting, setGreeting] = useState<DiscoveredPlace | null>(null);
  const [ready, setReady] = useState(false);

  const loader = useMemo(
    () => createPoiLoader({ storage: AsyncStorage, fetchTile: createTileFetcher(client) }),
    [client]
  );
  const requestedTiles = useRef(new Map<string, number>());
  // Tiles waiting for a free worker; the nearest to the player goes first.
  const queue = useRef<Array<{ tile: Tile; key: string; run: () => Promise<void> }>>([]);
  const workers = useRef(0);
  const focus = useRef<Tile | null>(null);
  const latestPosition = useRef(livePosition);
  latestPosition.current = livePosition;
  // Tiles that failed: how many times in a row, and the timer of the next attempt. A tile that failed is asked for
  // again on its own, so standing still in a place whose first request failed does not leave the map empty.
  const failures = useRef(new Map<string, number>());
  const retryTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const alive = useRef(true);
  const [pendingTiles, setPendingTiles] = useState(0);
  const [failedTiles, setFailedTiles] = useState(0);
  const discoveredIds = useMemo(() => new Set(discovered.map((d) => d.id)), [discovered]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let local: DiscoveredPlace[] = [];
      try {
        const raw = await AsyncStorage.getItem(localKey(userId));
        local = raw ? (JSON.parse(raw) as DiscoveredPlace[]) : [];
      } catch {
        local = [];
      }
      if (!cancelled) setDiscovered(local);

      try {
        const remote = await fetchDiscoveredPlaces(client, userId);
        const remoteIds = new Set(remote.map((r) => r.id));
        const merged = [...remote, ...local.filter((l) => !remoteIds.has(l.id))];
        if (!cancelled) setDiscovered(merged);
        await AsyncStorage.setItem(localKey(userId), JSON.stringify(merged));
        await upsertDiscoveredPlaces(
          client,
          userId,
          local.filter((l) => !remoteIds.has(l.id))
        );
      } catch (err) {
        console.warn('[usePlaces] remote sync failed, continuing with local data', err);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, userId]);

  useEffect(() => {
    alive.current = true;
    const timers = retryTimers.current;
    return () => {
      alive.current = false;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // Assigned on every render so the retry timers always call the current loader.
  const runTile = useRef<(tile: Tile, key: string) => void>(() => {});
  runTile.current = (tile, key) => {
    const execute = async () => {
      try {
        const found = await loader(tile);
        requestedTiles.current.set(key, Number.POSITIVE_INFINITY);
        if (failures.current.delete(key) && alive.current) setFailedTiles((n) => n - 1);
        if (alive.current) setPois((current) => mergePois(current, found));
        await sleep(BETWEEN_REQUESTS_MS);
      } catch (err) {
        console.warn('[usePlaces] tile load failed', key, err);
        const count = (failures.current.get(key) ?? 0) + 1;
        const delay = retryDelayMs(count);
        if (!failures.current.has(key) && alive.current) setFailedTiles((n) => n + 1);
        if (delay === null) {
          // Enough for now: the tile is asked for again when the map is looked at after RETRY_AFTER_MS.
          failures.current.delete(key);
          if (alive.current) setFailedTiles((n) => n - 1);
        } else if (alive.current) {
          failures.current.set(key, count);
          retryTimers.current.set(
            key,
            setTimeout(() => {
              retryTimers.current.delete(key);
              if (alive.current) runTile.current(tile, key);
            }, delay)
          );
        }
        if (String(err).includes('429')) await sleep(RATE_LIMIT_PAUSE_MS);
      } finally {
        if (alive.current) setPendingTiles((n) => n - 1);
      }
    };

    // Hand the tile to a worker: at most CONCURRENT_TILES run at once, each taking the waiting tile nearest the player.
    const pump = () => {
      while (workers.current < CONCURRENT_TILES && queue.current.length > 0) {
        const index = pickNextTile(queue.current.map((job) => job.tile), focus.current);
        const [job] = queue.current.splice(index, 1);
        workers.current += 1;
        void job.run().finally(() => {
          workers.current -= 1;
          pump();
        });
      }
    };

    setPendingTiles((n) => n + 1);
    queue.current.push({ tile, key, run: execute });
    pump();
  };

  const loadTiles = useCallback((tiles: Tile[]) => {
    for (const tile of tiles) {
      const key = tileKey(tile);
      // Already waiting for its own retry.
      if (retryTimers.current.has(key)) continue;
      const last = requestedTiles.current.get(key);
      if (last !== undefined && Date.now() - last < RETRY_AFTER_MS) continue;
      requestedTiles.current.set(key, Date.now());
      runTile.current(tile, key);
    }
  }, []);

  useEffect(() => {
    if (!view || view.zoom < MIN_POI_ZOOM || isPlaceholderView(view.center)) return;
    if (!latestPosition.current) focus.current = tileForLngLat(view.center[0], view.center[1]);
    const timer = setTimeout(() => {
      const { width, height } = Dimensions.get('window');
      // A wider window than the screen, so the neighbouring tiles are already loaded when you drag the map there.
      loadTiles(tilesForViewport(view, { width: width * PREFETCH_FACTOR, height: height * PREFETCH_FACTOR }));
    }, TILE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [view, loadTiles]);

  useEffect(() => {
    if (!livePosition) return;
    const here = tileForLngLat(livePosition.lng, livePosition.lat);
    focus.current = here;
    loadTiles([here]);
  }, [livePosition, loadTiles]);

  useEffect(() => {
    if (!livePosition || !ready) return;
    const found = findNewlyDiscovered(livePosition, pois, discoveredIds);
    if (found.length === 0) return;

    const now = Date.now();
    const fresh: DiscoveredPlace[] = found.map((p) => ({ ...p, discoveredAt: now }));
    const next = [...discovered, ...fresh];
    setDiscovered(next);
    setGreeting(fresh[fresh.length - 1]);
    Vibration.vibrate();
    void AsyncStorage.setItem(localKey(userId), JSON.stringify(next));
    upsertDiscoveredPlaces(client, userId, fresh).catch((err) =>
      console.warn('[usePlaces] saving discovered places failed, will retry next launch', err)
    );
  }, [livePosition, pois, discoveredIds, discovered, ready, client, userId]);

  useEffect(() => {
    if (!greeting) return;
    const timer = setTimeout(() => setGreeting(null), GREETING_MS);
    return () => clearTimeout(timer);
  }, [greeting]);

  const dismissGreeting = useCallback(() => setGreeting(null), []);

  const status: PlacesStatus = failedTiles > 0 ? 'retrying' : pendingTiles > 0 ? 'loading' : 'idle';

  return { pois, discovered, discoveredIds, greeting, dismissGreeting, status };
}
