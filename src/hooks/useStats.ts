import { useMemo } from 'react';
import type { Stats } from '../lib/stats/achievements';
import { computeAreaKm2, computeDistanceKm, computeStreakDays } from '../lib/stats/coverage';
import type { DiscoveredPlace } from '../lib/poi/types';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

export function useStats(points: VisitedPoint[], discovered: DiscoveredPlace[], enabled: boolean): Stats {
  return useMemo(() => {
    if (!enabled) {
      return { areaKm2: 0, distanceKm: 0, streakDays: 0, discoveredCount: 0, discoveredKinds: 0, totalPoints: 0 };
    }
    return {
      areaKm2: computeAreaKm2(points),
      distanceKm: computeDistanceKm(points),
      streakDays: computeStreakDays(points),
      discoveredCount: discovered.length,
      discoveredKinds: new Set(discovered.map((d) => d.kind)).size,
      totalPoints: points.length,
    };
  }, [points, discovered, enabled]);
}
