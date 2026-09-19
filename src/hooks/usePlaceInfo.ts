import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchPlaceInfo, type PlaceInfo } from '../lib/poi/placeInfo';
import type { Poi } from '../lib/poi/types';

const KEY_PREFIX = 'placeInfo.v2:';
const FOUND_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 24 * 60 * 60 * 1000;

interface Cached {
  at: number;
  info: PlaceInfo | null;
}

export type PlaceInfoStatus = 'idle' | 'loading' | 'ready' | 'failed';

async function readCache(id: string): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + id);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    const ttl = cached.info ? FOUND_TTL_MS : MISSING_TTL_MS;
    return Date.now() - cached.at < ttl ? cached : null;
  } catch {
    return null;
  }
}

export function usePlaceInfo(place: Poi | null) {
  const [info, setInfo] = useState<PlaceInfo | null>(null);
  const [status, setStatus] = useState<PlaceInfoStatus>('idle');
  const placeId = place?.id ?? null;

  useEffect(() => {
    setInfo(null);
    if (!place) {
      setStatus('idle');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    (async () => {
      const cached = await readCache(place.id);
      if (cached) {
        if (!cancelled) {
          setInfo(cached.info);
          setStatus('ready');
        }
        return;
      }
      try {
        const fresh = await fetchPlaceInfo(place);
        await AsyncStorage.setItem(KEY_PREFIX + place.id, JSON.stringify({ at: Date.now(), info: fresh }));
        if (!cancelled) {
          setInfo(fresh);
          setStatus('ready');
        }
      } catch (err) {
        console.warn('[placeInfo] lookup failed', err);
        if (!cancelled) setStatus('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Keyed by id: a new object for the same place must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  return { info, status };
}
