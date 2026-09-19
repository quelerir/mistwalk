import { haversineDistanceMeters } from '../geo/distance';

export interface TimedPoint {
  lat: number;
  lng: number;
  ts: number;
}

export const REVEAL_RADIUS_METERS = 60;
export const MAX_LINK_METERS = 300;
const CELL_METERS = 40;
const METERS_PER_DEG_LAT = 110540;
const METERS_PER_DEG_LNG_EQUATOR = 111320;

function sortByTime<T extends TimedPoint>(points: T[]): T[] {
  return [...points].sort((a, b) => a.ts - b.ts);
}

export function computeDistanceKm(points: TimedPoint[]): number {
  const sorted = sortByTime(points);
  let meters = 0;
  for (let i = 1; i < sorted.length; i++) {
    const step = haversineDistanceMeters(sorted[i - 1], sorted[i]);
    if (step <= MAX_LINK_METERS) meters += step;
  }
  return meters / 1000;
}

function withInterpolatedTrail(points: TimedPoint[]): Array<{ lat: number; lng: number }> {
  const sorted = sortByTime(points);
  const result: Array<{ lat: number; lng: number }> = [];
  const stepMeters = CELL_METERS / 2;

  sorted.forEach((point, i) => {
    result.push({ lat: point.lat, lng: point.lng });
    if (i === 0) return;
    const prev = sorted[i - 1];
    const dist = haversineDistanceMeters(prev, point);
    if (dist > MAX_LINK_METERS || dist <= stepMeters) return;
    const steps = Math.floor(dist / stepMeters);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      result.push({
        lat: prev.lat + (point.lat - prev.lat) * t,
        lng: prev.lng + (point.lng - prev.lng) * t,
      });
    }
  });
  return result;
}

export function computeAreaKm2(points: TimedPoint[]): number {
  if (points.length === 0) return 0;

  const cells = new Set<string>();
  const reach = Math.ceil(REVEAL_RADIUS_METERS / CELL_METERS) + 1;
  const dLat = CELL_METERS / METERS_PER_DEG_LAT;

  for (const p of withInterpolatedTrail(points)) {
    const row0 = Math.floor(p.lat / dLat);

    for (let dr = -reach; dr <= reach; dr++) {
      const row = row0 + dr;
      const rowLat = (row + 0.5) * dLat;
      const metersPerDegLng = METERS_PER_DEG_LNG_EQUATOR * Math.cos((rowLat * Math.PI) / 180);
      const dLng = CELL_METERS / metersPerDegLng;
      const col0 = Math.floor(p.lng / dLng);

      for (let dc = -reach; dc <= reach; dc++) {
        const col = col0 + dc;
        const centerLng = (col + 0.5) * dLng;
        const dx = (centerLng - p.lng) * metersPerDegLng;
        const dy = (rowLat - p.lat) * METERS_PER_DEG_LAT;
        if (Math.hypot(dx, dy) <= REVEAL_RADIUS_METERS) cells.add(`${row}:${col}`);
      }
    }
  }

  return (cells.size * CELL_METERS * CELL_METERS) / 1_000_000;
}
