import { useMemo } from 'react';
import { computeDistanceKm } from '../lib/stats/coverage';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

export interface Stats {
  distanceKm: number;
  discoveredCount: number;
}

export function useStats(points: VisitedPoint[], discoveredCount: number, enabled: boolean): Stats {
  return useMemo(
    () => ({ distanceKm: enabled ? computeDistanceKm(points) : 0, discoveredCount }),
    [points, discoveredCount, enabled]
  );
}
