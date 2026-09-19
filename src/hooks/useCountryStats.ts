import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildCountryList,
  cellKey,
  fetchCountryAt,
  toCountryRef,
  type CountryRef,
  type CountryStat,
} from '../lib/geo/countryStats';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

const CELLS_KEY = 'geo.countryCells.v1';
const GEOCODE_GAP_MS = 1100;

type CellCountries = Record<string, CountryRef | null>;

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useCountryStats(points: VisitedPoint[], enabled: boolean) {
  const [cells, setCells] = useState<CellCountries>({});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!enabled || ready) return;
    void readJson<CellCountries>(CELLS_KEY, {}).then((stored) => {
      setCells(stored);
      setReady(true);
    });
  }, [enabled, ready]);

  // One representative point per not-yet-resolved 25 km cell.
  const unresolved = useMemo(() => {
    if (!ready) return [];
    const seen = new Map<string, { lat: number; lng: number }>();
    for (const p of points) {
      const key = cellKey(p.lat, p.lng);
      if (!(key in cells) && !seen.has(key)) seen.set(key, { lat: p.lat, lng: p.lng });
    }
    return [...seen.entries()];
  }, [points, cells, ready]);

  const work = unresolved.map(([key]) => key).join(',');

  useEffect(() => {
    if (!enabled || !ready || running.current) return;
    if (unresolved.length === 0) return;
    running.current = true;
    let cancelled = false;

    (async () => {
      const nextCells = { ...cells };
      try {
        for (const [key, at] of unresolved) {
          if (cancelled) return;
          const found = await fetchCountryAt(at.lat, at.lng);
          nextCells[key] = found ? toCountryRef(found.code, found.name) : null;
          setCells({ ...nextCells });
          await AsyncStorage.setItem(CELLS_KEY, JSON.stringify(nextCells));
          await sleep(GEOCODE_GAP_MS);
        }
        setFailed(false);
      } catch (err) {
        console.warn('[countryStats] lookup failed', err);
        setFailed(true);
      } finally {
        running.current = false;
      }
    })();

    return () => {
      cancelled = true;
      running.current = false;
    };
    // The work signature captures which lookups are outstanding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ready, work]);

  const countries: CountryStat[] = useMemo(
    () => (ready ? buildCountryList(points, cells) : []),
    [points, cells, ready]
  );

  const pending = enabled && (!ready || unresolved.length > 0) && !failed;
  return { countries, pending, failed };
}
