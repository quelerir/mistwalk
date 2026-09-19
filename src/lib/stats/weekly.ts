import type { DiscoveredPlace } from '../poi/types';
import { computeDistanceKm, type TimedPoint } from './coverage';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeekTotals {
  km: number;
  days: number;
  places: number;
}

export interface WeekSummary extends WeekTotals {
  prev: WeekTotals;
}

function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function totals(points: TimedPoint[], places: DiscoveredPlace[], from: number, to: number): WeekTotals {
  const inWindow = points.filter((p) => p.ts > from && p.ts <= to);
  return {
    km: computeDistanceKm(inWindow),
    days: new Set(inWindow.map((p) => localDayKey(p.ts))).size,
    places: places.filter((d) => d.discoveredAt > from && d.discoveredAt <= to).length,
  };
}

// "This week" is the last 7 days up to now, and "before" is the 7 days ahead of that.
export function weekSummary(points: TimedPoint[], places: DiscoveredPlace[], now: number): WeekSummary {
  return {
    ...totals(points, places, now - 7 * DAY_MS, now),
    prev: totals(points, places, now - 14 * DAY_MS, now - 7 * DAY_MS),
  };
}

// Kilometres for each of the last 7 calendar days, oldest first and today last.
export function dailyKm(points: TimedPoint[], now: number): number[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const result: number[] = [];
  for (let back = 6; back >= 0; back--) {
    const start = new Date(today);
    start.setDate(today.getDate() - back);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    result.push(computeDistanceKm(points.filter((p) => p.ts >= start.getTime() && p.ts < end.getTime())));
  }
  return result;
}
