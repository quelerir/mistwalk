import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../lib/geo/distance';
import { fetchWeather, fogDensity } from '../lib/weather/weather';

const REFRESH_MS = 30 * 60 * 1000;

// Fog density for the weather at your position, refreshed every half hour; null until known, or when off.
export function useWeatherFog(position: Coordinate | null, enabled: boolean): number | null {
  const [density, setDensity] = useState<number | null>(null);
  const latest = useRef<Coordinate | null>(position);
  latest.current = position;
  const hasPosition = position !== null;

  useEffect(() => {
    if (!enabled || !hasPosition) {
      if (!enabled) setDensity(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      const at = latest.current;
      if (!at) return;
      void fetchWeather(at).then((weather) => {
        if (!cancelled && weather) setDensity(fogDensity(weather));
      });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, hasPosition]);

  return enabled ? density : null;
}
