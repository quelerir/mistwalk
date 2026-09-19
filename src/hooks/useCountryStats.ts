import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildCountryStats,
  cellKey,
  fetchCountryAreaKm2,
  fetchCountryAt,
  type CountryRef,
  type CountryStat,
} from '../lib/geo/countryStats';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

const CELLS_KEY = 'geo.countryCells.v1';
const AREAS_KEY = 'geo.countryAreas.v1';
const GEOCODE_GAP_MS = 1100;

type CellCountries = Record<string, CountryRef | null>;
type CountryAreas = Record<string, number>;

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
  const [areas, setAreas] = useState<CountryAreas>({});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (!enabled || ready) return;
    void Promise.all([readJson<CellCountries>(CELLS_KEY, {}), readJson<CountryAreas>(AREAS_KEY, {})]).then(
      ([storedCells, storedAreas]) => {
        setCells(storedCells);
        setAreas(storedAreas);
        setReady(true);
      }
    );
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

  const missingAreas = useMemo(() => {
    const codes = new Set<string>();
    for (const country of Object.values(cells)) {
      if (country && !(country.code in areas)) codes.add(country.code);
    }
    return [...codes];
  }, [cells, areas]);

  const work = unresolved.map(([key]) => key).join(',') + '|' + missingAreas.join(',');

  useEffect(() => {
    if (!enabled || !ready || running.current) return;
    if (unresolved.length === 0 && missingAreas.length === 0) return;
    running.current = true;
    let cancelled = false;

    (async () => {
      const nextCells = { ...cells };
      const nextAreas = { ...areas };
      try {
        for (const [key, at] of unresolved) {
          if (cancelled) return;
          nextCells[key] = await fetchCountryAt(at.lat, at.lng);
          setCells({ ...nextCells });
          await AsyncStorage.setItem(CELLS_KEY, JSON.stringify(nextCells));
          await sleep(GEOCODE_GAP_MS);
        }
        for (const country of Object.values(nextCells)) {
          if (cancelled) return;
          if (!country || country.code in nextAreas) continue;
          const area = await fetchCountryAreaKm2(country.code);
          // Cache "unknown" as 0 so we don't ask again; buildCountryStats skips it.
          nextAreas[country.code] = area ?? 0;
          setAreas({ ...nextAreas });
          await AsyncStorage.setItem(AREAS_KEY, JSON.stringify(nextAreas));
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
    () => (ready ? buildCountryStats(points, cells, areas) : []),
    [points, cells, areas, ready]
  );

  const pending = enabled && (!ready || unresolved.length > 0 || missingAreas.length > 0) && !failed;
  return { countries, pending, failed };
}
