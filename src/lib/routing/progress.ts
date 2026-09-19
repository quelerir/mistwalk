import { haversineDistanceMeters, type Coordinate } from '../geo/distance';
import type { WalkingRoute } from './walkingRoute';

export interface RouteProgress {
  // The part of the line still ahead, starting at the point of the route nearest to the walker.
  coordinates: Array<[number, number]>;
  remainingMeters: number;
  remainingSeconds: number;
}

// Nearest point of segment a-b to p, in a local flat projection (fine at walking scale).
function projectOnSegment(
  p: Coordinate,
  a: [number, number],
  b: [number, number]
): { point: [number, number]; t: number } {
  const cos = Math.cos((p.lat * Math.PI) / 180);
  const ax = a[0] * cos;
  const bx = b[0] * cos;
  const px = p.lng * cos;
  const dx = bx - ax;
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (p.lat - a[1]) * dy) / len2));
  return { point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t };
}

export function routeProgress(route: WalkingRoute, position: Coordinate): RouteProgress {
  const line = route.coordinates;
  let best = { index: 0, point: line[0], distance: Infinity };
  for (let i = 0; i < line.length - 1; i++) {
    const { point } = projectOnSegment(position, line[i], line[i + 1]);
    const distance = haversineDistanceMeters(position, { lat: point[1], lng: point[0] });
    if (distance < best.distance) best = { index: i, point, distance };
  }

  const ahead: Array<[number, number]> = [best.point, ...line.slice(best.index + 1)];
  let remainingMeters = 0;
  for (let i = 0; i < ahead.length - 1; i++) {
    remainingMeters += haversineDistanceMeters(
      { lat: ahead[i][1], lng: ahead[i][0] },
      { lat: ahead[i + 1][1], lng: ahead[i + 1][0] }
    );
  }
  const share = route.distanceMeters > 0 ? Math.min(1, remainingMeters / route.distanceMeters) : 0;
  return {
    coordinates: ahead.length >= 2 ? ahead : line.slice(-2),
    remainingMeters,
    remainingSeconds: route.durationSeconds * share,
  };
}
