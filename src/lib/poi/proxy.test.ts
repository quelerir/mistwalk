import type { SupabaseClient } from '@supabase/supabase-js';
import { createTileFetcher, fetchTileViaProxy } from './proxy';
import type { Poi } from './types';

const tile = { x: 1310, y: 3166, z: 13 };
const poi: Poi = { id: 'node/1', name: 'A', kind: 'viewpoint', lat: 1, lng: 2 };

function clientReturning(result: { data: unknown; error: unknown }) {
  const invoke = jest.fn().mockResolvedValue(result);
  return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

describe('fetchTileViaProxy', () => {
  it('calls the pois function with the tile coordinates, says it knows the newer kinds, and returns the places', async () => {
    const { client, invoke } = clientReturning({ data: [poi], error: null });
    expect(await fetchTileViaProxy(client, tile)).toEqual([poi]);
    expect(invoke).toHaveBeenCalledWith('pois', {
      body: { z: 13, x: 1310, y: 3166, kinds: 2 },
      timeout: 30000,
    });
  });

  it('throws on a function error or a malformed payload', async () => {
    await expect(fetchTileViaProxy(clientReturning({ data: null, error: new Error('boom') }).client, tile)).rejects.toThrow('boom');
    await expect(fetchTileViaProxy(clientReturning({ data: { nope: true }, error: null }).client, tile)).rejects.toThrow('unexpected payload');
  });
});

describe('createTileFetcher', () => {
  it('uses the proxy and does not touch Overpass when it works', async () => {
    const direct = jest.fn();
    const fetcher = createTileFetcher(clientReturning({ data: [poi], error: null }).client, direct);
    expect(await fetcher(tile)).toEqual([poi]);
    expect(direct).not.toHaveBeenCalled();
  });

  it('falls back to Overpass when the proxy fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const direct = jest.fn().mockResolvedValue([poi]);
    const fetcher = createTileFetcher(clientReturning({ data: null, error: new Error('down') }).client, direct);
    expect(await fetcher(tile)).toEqual([poi]);
    expect(direct).toHaveBeenCalledWith(tile);
    warn.mockRestore();
  });
});
