import type { VisitedPoint } from '../supabase/visitedPoints';
import { haversineDistanceMeters } from '../geo/distance';

export interface TrailNode {
  lat: number;
  lng: number;
}

// The places where the player has been, oldest first.
export function buildTrail(points: VisitedPoint[]): TrailNode[] {
  return [...points].sort((a, b) => a.ts - b.ts).map((p) => ({ lat: p.lat, lng: p.lng }));
}

// The trail as [lng, lat] pairs with points added between two linked fixes so that none are more than `stepMeters`
// apart: the heatmap then clears a continuous corridor instead of a string of separate discs. Fixes further apart than
// `maxLinkMeters` are a jump (teleport, lost signal), not a walk, and are not joined.
export function densifyTrail(nodes: TrailNode[], stepMeters: number, maxLinkMeters: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < nodes.length; i++) {
    const cur = nodes[i];
    if (i > 0) {
      const prev = nodes[i - 1];
      const meters = haversineDistanceMeters(prev, cur);
      if (meters <= maxLinkMeters && meters > stepMeters) {
        const segments = Math.ceil(meters / stepMeters);
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          out.push([prev.lng + (cur.lng - prev.lng) * t, prev.lat + (cur.lat - prev.lat) * t]);
        }
      }
    }
    out.push([cur.lng, cur.lat]);
  }
  return out;
}

// Where the "head" of the trail is `elapsedMs` after a new fix arrived: it eases in a straight line from the old fix to
// the new one over `durationMs`; a fix further than `snapMeters` away is a jump and is taken at once.
export function glidePosition(from: TrailNode, to: TrailNode, elapsedMs: number, durationMs: number, snapMeters: number): TrailNode {
  if (haversineDistanceMeters(from, to) > snapMeters) return to;
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  if (t >= 1) return to;
  if (t <= 0) return from;
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}
