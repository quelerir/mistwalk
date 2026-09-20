import type { Tile } from './tiles';

// Which waiting tile to load next: the one nearest to where the player is looking, so the tile under the player is not
// held up by tiles far away. The earlier one wins a tie. Returns -1 for an empty queue.
export function pickNextTile(queue: ReadonlyArray<Tile>, focus: Tile | null): number {
  if (queue.length === 0) return -1;
  if (!focus) return 0;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  queue.forEach((tile, index) => {
    const distance = Math.hypot(tile.x - focus.x, tile.y - focus.y);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

// Before the first GPS fix the map sits at latitude 0, longitude 0 (open sea), and asking for places there only holds
// the queue up. True while the view is still on that placeholder.
export function isPlaceholderView(center: readonly [number, number]): boolean {
  return Math.abs(center[0]) < 0.5 && Math.abs(center[1]) < 0.5;
}
