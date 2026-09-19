import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../lib/geo/distance';
import { fetchWeather, rainIntensity } from '../lib/weather/weather';

const REFRESH_MS = 30 * 60 * 1000;

// Rain intensity (0..1) at your position, refreshed every half hour; 0 until known, or when off.
export function useRain(position: Coordinate | null, enabled: boolean): number {
  const [rain, setRain] = useState(0);
  const latest = useRef<Coordinate | null>(position);
  latest.current = position;
  const hasPosition = position !== null;
  // Weather is regional, so a move of roughly ten kilometres (a tenth of a degree) asks again.
  const area = position ? `${position.lat.toFixed(1)},${position.lng.toFixed(1)}` : '';

  useEffect(() => {
    if (!enabled || !hasPosition) {
      if (!enabled) setRain(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      const at = latest.current;
      if (!at) return;
      void fetchWeather(at).then((weather) => {
        if (!cancelled && weather) setRain(rainIntensity(weather));
      });
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, hasPosition, area]);

  return enabled ? rain : 0;
}
