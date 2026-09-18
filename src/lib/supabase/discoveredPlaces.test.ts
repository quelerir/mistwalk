import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchDiscoveredPlaces, upsertDiscoveredPlaces } from './discoveredPlaces';

function fakeClient(selectResult: { data: unknown; error: unknown }, upsertResult = { error: null as unknown }) {
  const eq = jest.fn().mockResolvedValue(selectResult);
  const select = jest.fn().mockReturnValue({ eq });
  const upsert = jest.fn().mockResolvedValue(upsertResult);
  const from = jest.fn().mockReturnValue({ select, upsert });
  return { client: { from } as unknown as SupabaseClient, from, select, eq, upsert };
}

const place = { id: 'node/1', name: 'A', kind: 'viewpoint' as const, lat: 1, lng: 2, discoveredAt: 1735689600000 };

describe('fetchDiscoveredPlaces', () => {
  it('maps rows to DiscoveredPlace', async () => {
    const { client, from, eq } = fakeClient({
      data: [{ osm_id: 'node/1', name: 'A', kind: 'viewpoint', lat: 1, lng: 2, discovered_at: '2025-01-01T00:00:00.000Z' }],
      error: null,
    });
    expect(await fetchDiscoveredPlaces(client, 'u1')).toEqual([place]);
    expect(from).toHaveBeenCalledWith('discovered_places');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
  });

  it('throws on error and tolerates null data', async () => {
    await expect(fetchDiscoveredPlaces(fakeClient({ data: null, error: new Error('x') }).client, 'u1')).rejects.toThrow('x');
    expect(await fetchDiscoveredPlaces(fakeClient({ data: null, error: null }).client, 'u1')).toEqual([]);
  });
});

describe('upsertDiscoveredPlaces', () => {
  it('does nothing for an empty list', async () => {
    const { client, from } = fakeClient({ data: [], error: null });
    await upsertDiscoveredPlaces(client, 'u1', []);
    expect(from).not.toHaveBeenCalled();
  });

  it('upserts rows for the user, ignoring duplicates', async () => {
    const { client, upsert } = fakeClient({ data: [], error: null });
    await upsertDiscoveredPlaces(client, 'u1', [place]);
    expect(upsert).toHaveBeenCalledWith(
      [{ user_id: 'u1', osm_id: 'node/1', name: 'A', kind: 'viewpoint', lat: 1, lng: 2, discovered_at: '2025-01-01T00:00:00.000Z' }],
      { onConflict: 'user_id,osm_id', ignoreDuplicates: true }
    );
  });

  it('throws on error', async () => {
    const { client } = fakeClient({ data: [], error: null }, { error: new Error('nope') });
    await expect(upsertDiscoveredPlaces(client, 'u1', [place])).rejects.toThrow('nope');
  });
});
