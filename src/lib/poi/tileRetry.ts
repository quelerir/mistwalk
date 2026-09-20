// How long to wait before asking for a tile again after it failed to load: quick at first (a hiccup), then slower
// (a server that is down). After the last delay we give up until the map is looked at again.
export const RETRY_DELAYS_MS = [4000, 12000, 30000, 90000];

// `failures` is how many times in a row the tile has failed, counting the one that just happened (1, 2, ...).
// Returns the wait in milliseconds, or null when it is time to stop trying for now.
export function retryDelayMs(failures: number): number | null {
  if (!Number.isInteger(failures) || failures < 1) return null;
  return RETRY_DELAYS_MS[failures - 1] ?? null;
}
