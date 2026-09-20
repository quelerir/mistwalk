import { useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCityList, cityCellKey, fetchCityAt, type CityRef, type CityStat } from '../lib/geo/cityStats';
import type { DiscoveredPlace } from '../lib/poi/types';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import { useI18n } from '../i18n/I18nProvider';

// The cities are named by the geocoder in one language, so each language has its own kept lookups (Russian keeps the
// key it always had).
const CELLS_KEY = 'geo.cityCells.v3';
const cellsKeyFor = (lang: string) => (lang === 'ru' ? CELLS_KEY : `${CELLS_KEY}.${lang}`);
const GEOCODE_GAP_MS = 1100;

type CityCells = Record<string, CityRef | null>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cities are looked up lazily (only while a country screen is open) and cached per ~5 km cell.
export function useCityStats(
  points: VisitedPoint[],
  found: DiscoveredPlace[],
  enabled: boolean,
  countryAt?: (lat: number, lng: number) => string | null
) {
  const { lang } = useI18n();
  const cellsKey = cellsKeyFor(lang);
  const [cells, setCells] = useState<CityCells>({});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  // Another language: forget the lookups of the last one and read the ones kept for this one.
  useEffect(() => {
    setReady(false);
    setCells({});
    setFailed(false);
  }, [cellsKey]);

  useEffect(() => {
    if (!enabled || ready) return;
    void AsyncStorage.getItem(cellsKey)
      .then((raw) => (raw ? (JSON.parse(raw) as CityCells) : {}))
      .catch(() => ({}))
      .then((stored) => {
        setCells(stored);
        setReady(true);
      });
  }, [enabled, ready, cellsKey]);

  const unresolved = useMemo(() => {
    if (!ready) return [];
    const seen = new Map<string, { lat: number; lng: number }>();
    for (const p of [...points, ...found]) {
      const key = cityCellKey(p.lat, p.lng);
      if (!(key in cells) && !seen.has(key)) seen.set(key, { lat: p.lat, lng: p.lng });
    }
    return [...seen.entries()];
  }, [points, found, cells, ready]);

  const work = unresolved.map(([key]) => key).join(',');

  useEffect(() => {
    if (!enabled || !ready || running.current || unresolved.length === 0) return;
    running.current = true;
    let cancelled = false;

    (async () => {
      const next = { ...cells };
      try {
        for (const [key, at] of unresolved) {
          if (cancelled) return;
          next[key] = await fetchCityAt(at.lat, at.lng, fetch, lang);
          setCells({ ...next });
          await AsyncStorage.setItem(cellsKey, JSON.stringify(next));
          await sleep(GEOCODE_GAP_MS);
        }
        setFailed(false);
      } catch (err) {
        console.warn('[cityStats] lookup failed', err);
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

  const cities: CityStat[] = useMemo(
    () => (ready ? buildCityList(points, found, cells, countryAt) : []),
    [points, found, cells, ready, countryAt]
  );
  const pending = enabled && (!ready || unresolved.length > 0) && !failed;
  return { cities, cells, pending, failed };
}
