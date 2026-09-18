import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTileFromOverpass } from './poiCache';
import type { Tile } from './tiles';
import type { Poi } from './types';

export const POIS_FUNCTION_NAME = 'pois';
// A cache miss makes the function query Overpass, which can hang; give up early and go direct.
export const PROXY_TIMEOUT_MS = 10000;

export async function fetchTileViaProxy(client: SupabaseClient, tile: Tile): Promise<Poi[]> {
  const { data, error } = await client.functions.invoke(POIS_FUNCTION_NAME, {
    body: { z: tile.z, x: tile.x, y: tile.y },
    timeout: PROXY_TIMEOUT_MS,
  });
  if (error) {
    // FunctionsHttpError carries the failed Response in `context`; surface its body for diagnosis.
    let detail = '';
    try {
      detail = (await (error as { context?: Response }).context?.text?.()) ?? '';
    } catch {
      detail = '';
    }
    throw new Error(detail ? `${error.message}: ${detail}` : error.message);
  }
  if (!Array.isArray(data)) {
    throw new Error('pois function returned an unexpected payload');
  }
  return data as Poi[];
}

export function createTileFetcher(
  client: SupabaseClient,
  direct: (tile: Tile) => Promise<Poi[]> = fetchTileFromOverpass
) {
  return async (tile: Tile): Promise<Poi[]> => {
    try {
      return await fetchTileViaProxy(client, tile);
    } catch (err) {
      console.warn('[pois] shared cache unavailable, falling back to Overpass directly', err);
      return direct(tile);
    }
  };
}
