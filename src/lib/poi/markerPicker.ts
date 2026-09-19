import type { Size } from '../geo/projection';

export interface MarkerCandidate {
  id: string;
  x: number;
  y: number;
  found: boolean;
}

export interface PickOptions {
  // Two kept markers are never closer than this many pixels, so a crowd is thinned out.
  cell: number;
  max: number;
}

// Chooses which markers to draw. Taking "the first N of the list" fills the limit with whatever loaded first (the
// places next to you) and leaves the rest of the screen empty; a minimum distance keeps them spread over the whole
// view instead. Places you found win, then the ones nearer the middle of the screen.
export function pickMarkers(candidates: MarkerCandidate[], size: Size, { cell, max }: PickOptions): MarkerCandidate[] {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const ranked = [...candidates].sort((a, b) => {
    if (a.found !== b.found) return a.found ? -1 : 1;
    return Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy);
  });

  // A grid of the kept markers, so each candidate is only checked against its neighbours.
  const grid = new Map<string, MarkerCandidate[]>();
  const picked: MarkerCandidate[] = [];
  for (const m of ranked) {
    const gx = Math.floor(m.x / cell);
    const gy = Math.floor(m.y / cell);
    let clear = true;
    for (let dx = -1; dx <= 1 && clear; dx++) {
      for (let dy = -1; dy <= 1 && clear; dy++) {
        const near = grid.get(`${gx + dx}:${gy + dy}`);
        if (near?.some((o) => Math.hypot(o.x - m.x, o.y - m.y) < cell)) clear = false;
      }
    }
    if (!clear) continue;
    const key = `${gx}:${gy}`;
    grid.set(key, [...(grid.get(key) ?? []), m]);
    picked.push(m);
    if (picked.length >= max) break;
  }
  return picked;
}
