import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Vibration } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MapView } from '../lib/geo/projection';
import { findNewlyDiscovered } from '../lib/poi/discovery';
import { createPoiLoader, fetchTileFromOverpass } from '../lib/poi/poiCache';
import { tileForLngLat, tileKey, tilesForViewport } from '../lib/poi/tiles';
import type { DiscoveredPlace, Poi } from '../lib/poi/types';
import { fetchDiscoveredPlaces, upsertDiscoveredPlaces } from '../lib/supabase/discoveredPlaces';

const TILE_DEBOUNCE_MS = 500;
const RETRY_AFTER_MS = 30_000;
const GREETING_MS = 6000;
const MIN_POI_ZOOM = 12;
const BETWEEN_REQUESTS_MS = 400;
const RATE_LIMIT_PAUSE_MS = 5000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
    () => createPoiLoader({ storage: AsyncStorage, fetchTile: fetchTileFromOverpass }),
    []
  );
  const requestedTiles = useRef(new Map<string, number>());
  const requestChain = useRef<Promise<void>>(Promise.resolve());
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

  const loadTiles = useCallback(
    (tiles: ReturnType<typeof tilesForViewport>) => {
      for (const tile of tiles) {
        const key = tileKey(tile);
        const last = requestedTiles.current.get(key);
        if (last !== undefined && Date.now() - last < RETRY_AFTER_MS) continue;
        requestedTiles.current.set(key, Date.now());
        requestChain.current = requestChain.current.then(async () => {
          try {
            const found = await loader(tile);
            requestedTiles.current.set(key, Number.POSITIVE_INFINITY);
            setPois((current) => mergePois(current, found));
            await sleep(BETWEEN_REQUESTS_MS);
          } catch (err) {
            console.warn('[usePlaces] tile load failed', key, err);
            if (String(err).includes('429')) await sleep(RATE_LIMIT_PAUSE_MS);
          }
        });
      }
    },
    [loader]
  );

  useEffect(() => {
    if (!view || view.zoom < MIN_POI_ZOOM) return;
    const timer = setTimeout(() => {
      const { width, height } = Dimensions.get('window');
      loadTiles(tilesForViewport(view, { width, height }));
    }, TILE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [view, loadTiles]);

  useEffect(() => {
    if (!livePosition) return;
    loadTiles([tileForLngLat(livePosition.lng, livePosition.lat)]);
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

  return { pois, discovered, discoveredIds, greeting, dismissGreeting };
}
