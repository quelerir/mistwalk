import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { crestUrlFromFile, fetchCrestFiles } from '../lib/geo/crest';

const KEY_PREFIX = 'crest.v1:';
const FOUND_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 50;
const CITY_PROPS = ['P94'];

interface Cached {
  at: number;
  file: string | null;
}

// A city keeps the old cache key; other lookups (a region: coat of arms, then flag) get their own so they do not clash.
function cacheKey(id: string, props: string[]): string {
  return props.join('+') === CITY_PROPS.join('+') ? KEY_PREFIX + id : `${KEY_PREFIX}${props.join('+')}:${id}`;
}

// Emblem image URLs for the given Wikidata ids (id -> url, or null when an item has none): the coat of arms, and for the
// other `props` the first one that exists. Ids are fetched in batches and cached.
export function useCrests(
  wikidataIds: Array<string | null | undefined>,
  props: string[] = CITY_PROPS
): Record<string, string | null> {
  const [crests, setCrests] = useState<Record<string, string | null>>({});
  const requested = useRef(new Set<string>());
  const mounted = useRef(true);
  const key = [...new Set(wikidataIds.filter(Boolean) as string[])].sort().join(',');
  const propsKey = props.join('+');

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const todo = (key ? key.split(',') : []).filter((id) => !requested.current.has(id));
    if (todo.length === 0) return;
    todo.forEach((id) => requested.current.add(id));
    const show = (files: Record<string, string | null>) => {
      if (!mounted.current) return;
      setCrests((prev) => ({
        ...prev,
        ...Object.fromEntries(Object.entries(files).map(([id, file]) => [id, file ? crestUrlFromFile(file) : null])),
      }));
    };

    (async () => {
      const cachedFiles: Record<string, string | null> = {};
      const missing: string[] = [];
      for (const id of todo) {
        const raw = await AsyncStorage.getItem(cacheKey(id, props)).catch(() => null);
        let fresh = false;
        if (raw) {
          try {
            const cached = JSON.parse(raw) as Cached;
            if (Date.now() - cached.at < (cached.file ? FOUND_TTL_MS : MISSING_TTL_MS)) {
              cachedFiles[id] = cached.file;
              fresh = true;
            }
          } catch {
            // an unreadable entry is fetched again
          }
        }
        if (!fresh) missing.push(id);
      }
      if (Object.keys(cachedFiles).length > 0) show(cachedFiles);

      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        const batch = missing.slice(i, i + BATCH_SIZE);
        try {
          const files = await fetchCrestFiles(batch, props);
          await Promise.all(
            batch.map((id) =>
              AsyncStorage.setItem(cacheKey(id, props), JSON.stringify({ at: Date.now(), file: files[id] ?? null })).catch(
                () => undefined
              )
            )
          );
          show(files);
        } catch (err) {
          // Offline or rate limited: these ids are asked for again the next time the list changes.
          batch.forEach((id) => requested.current.delete(id));
          console.warn('[crest] lookup failed', batch.length, err);
        }
      }
    })();
    // propsKey stands for props (an array literal would change on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, propsKey]);

  return crests;
}
