import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { crestUrlFromFile, fetchCrestFile } from '../lib/geo/crest';

const KEY_PREFIX = 'crest.v1:';
const FOUND_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MISSING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Cached {
  at: number;
  file: string | null;
}

// Coat-of-arms image URLs for the given Wikidata ids (id -> url, or null when a city has none).
export function useCrests(wikidataIds: Array<string | null | undefined>): Record<string, string | null> {
  const [crests, setCrests] = useState<Record<string, string | null>>({});
  const requested = useRef(new Set<string>());
  const key = wikidataIds.filter(Boolean).sort().join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    let cancelled = false;
    (async () => {
      for (const id of ids) {
        if (requested.current.has(id)) continue;
        requested.current.add(id);
        try {
          let file: string | null | undefined;
          const raw = await AsyncStorage.getItem(KEY_PREFIX + id).catch(() => null);
          if (raw) {
            const cached = JSON.parse(raw) as Cached;
            if (Date.now() - cached.at < (cached.file ? FOUND_TTL_MS : MISSING_TTL_MS)) file = cached.file;
          }
          if (file === undefined) {
            file = await fetchCrestFile(id);
            await AsyncStorage.setItem(KEY_PREFIX + id, JSON.stringify({ at: Date.now(), file }));
          }
          if (!cancelled) setCrests((prev) => ({ ...prev, [id]: file ? crestUrlFromFile(file) : null }));
        } catch (err) {
          requested.current.delete(id);
          console.warn('[crest] lookup failed', id, err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return crests;
}
