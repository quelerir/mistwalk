import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../lib/geo/distance';
import { fetchWeather, rainIntensity, type Wind } from '../lib/weather/weather';

const REFRESH_MS = 30 * 60 * 1000;

export interface SkyWeather {
  rain: number; // 0..1
  wind: Wind | null;
}

const NONE: SkyWeather = { rain: 0, wind: null };

// Rain intensity (0..1) and wind at your position, refreshed every half hour; nothing until known, or when off.
export function useSkyWeather(position: Coordinate | null, enabled: boolean): SkyWeather {
  const [sky, setSky] = useState<SkyWeather>(NONE);
  const latest = useRef<Coordinate | null>(position);
  latest.current = position;
  const hasPosition = position !== null;
  // Weather is regional, so a move of roughly ten kilometres (a tenth of a degree) asks again.
  const area = position ? `${position.lat.toFixed(1)},${position.lng.toFixed(1)}` : '';

  useEffect(() => {
    if (!enabled || !hasPosition) {
      if (!enabled) setSky(NONE);
      return;
    }
    let cancelled = false;
    const load = () => {
      const at = latest.current;
      if (!at) return;
      void fetchWeather(at).then((weather) => {
        if (!cancelled && weather) setSky({ rain: rainIntensity(weather), wind: weather.wind ?? null });
      });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, hasPosition, area]);

  return enabled ? sky : NONE;
}
