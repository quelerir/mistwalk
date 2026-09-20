import type { Size } from '../geo/projection';

// From this zoom on the places are metres apart: clusters only hold places on almost the same spot, and tapping one lists
// them instead of zooming further.
export const DETAIL_ZOOM = 17.5;

export interface MarkerCandidate {
  id: string;
  x: number;
  y: number;
  found: boolean;
}

export interface LocatedCandidate extends MarkerCandidate {
  lng: number;
  lat: number;
}

// One thing to draw on the map: a single place (ids has one entry) or a cluster of several places drawn as a count.
export interface MarkerItem {
  ids: string[];
  x: number;
  y: number;
  lng: number;
  lat: number;
  // A single place that was already found; it is drawn with its name.
  foundSingle: boolean;
}

export interface LayoutOptions {
  // Places closer than this many pixels to a cluster's middle join it.
  radius: number;
  max: number;
  // A place not found yet that lies this close to a found one is left out: the found place keeps the spot to itself.
  clearance: number;
}

interface Cluster {
  members: LocatedCandidate[];
  sx: number;
  sy: number;
  slng: number;
  slat: number;
}

// Groups the candidates: each joins the nearest cluster within `radius`, or starts one.
function clusterCandidates(candidates: LocatedCandidate[], radius: number): Cluster[] {
  const clusters: Cluster[] = [];
  // Clusters by grid cell of their first place, so a place only looks at the clusters around it.
  const grid = new Map<string, Cluster[]>();
  for (const m of candidates) {
    const gx = Math.floor(m.x / radius);
    const gy = Math.floor(m.y / radius);
    let home: Cluster | null = null;
    let homeDistance = radius;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const c of grid.get(`${gx + dx}:${gy + dy}`) ?? []) {
          const d = Math.hypot(c.sx / c.members.length - m.x, c.sy / c.members.length - m.y);
          if (d < homeDistance) {
            home = c;
            homeDistance = d;
          }
        }
      }
    }
    if (home) {
      home.members.push(m);
      home.sx += m.x;
      home.sy += m.y;
      home.slng += m.lng;
      home.slat += m.lat;
    } else {
      const c: Cluster = { members: [m], sx: m.x, sy: m.y, slng: m.lng, slat: m.lat };
      clusters.push(c);
      const key = `${gx}:${gy}`;
      grid.set(key, [...(grid.get(key) ?? []), c]);
    }
  }
  return clusters;
}

function toItem(c: Cluster): MarkerItem {
  const n = c.members.length;
  return {
    ids: c.members.map((m) => m.id),
    x: c.sx / n,
    y: c.sy / n,
    lng: c.slng / n,
    lat: c.slat / n,
    foundSingle: n === 1 && c.members[0].found,
  };
}

// Places that would overlap on the screen become one marker with a count, instead of a crowd being thinned out and the
// rest silently dropped. Zooming in pulls the places apart, so the clusters split up on their own. Places you found are
// grouped among themselves, so a found place never disappears into a cluster of new ones; those come nearer the middle of
// the screen first, and at most `max` items are returned (found ones first).
export function layoutMarkers(candidates: LocatedCandidate[], size: Size, { radius, max, clearance }: LayoutOptions): MarkerItem[] {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const byMiddle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy);

  const found = clusterCandidates(candidates.filter((m) => m.found).sort(byMiddle), radius).map(toItem);
  const fresh = candidates
    .filter((m) => !m.found && !found.some((f) => Math.hypot(f.x - m.x, f.y - m.y) < clearance))
    .sort(byMiddle);
  const others = clusterCandidates(fresh, radius).map(toItem).sort(byMiddle);
  return [...found.sort(byMiddle), ...others].slice(0, max);
}
