import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildSnapshot,
  fetchLeaderboard,
  fetchMyProfile,
  fetchPlayerProfile,
  NameTakenError,
  saveMyProfile,
} from './profiles';

const snapshot = { distanceKm: 3.4, countries: [], cities: [] };

describe('buildSnapshot', () => {
  it('keeps only visited countries and rounds the distance', () => {
    const s = buildSnapshot(
      3.456,
      [
        { code: 'AT', name: 'Австрия', exploredKm2: 1, totalKm2: 100, percent: 1 },
        { code: 'FR', name: 'Франция', exploredKm2: 0, totalKm2: 100, percent: 0 },
      ],
      [{ name: 'Вена', exploredKm2: 0.3, totalKm2: 412, percent: 0.07, found: 5 }]
    );
    expect(s.distanceKm).toBe(3.5);
    expect(s.countries).toEqual([{ code: 'AT', name: 'Австрия', percent: 1 }]);
    expect(s.cities).toEqual([{ name: 'Вена', percent: 0.07, exploredKm2: 0.3 }]);
  });
});

describe('fetchLeaderboard', () => {
  it('maps rows and converts bigint strings', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ user_id: 'u1', display_name: 'Аня', found_count: '12', rank: '1' }],
      error: null,
    });
    const list = await fetchLeaderboard({ rpc } as unknown as SupabaseClient);
    expect(rpc).toHaveBeenCalledWith('leaderboard', { max_rows: 50 });
    expect(list).toEqual([{ userId: 'u1', displayName: 'Аня', foundCount: 12, rank: 1 }]);
  });
});

describe('fetchPlayerProfile', () => {
  it('returns null for a hidden or missing player', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: null });
    expect(await fetchPlayerProfile({ rpc } as unknown as SupabaseClient, 'x')).toBeNull();
  });

  it('maps the json payload', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        user_id: 'u1',
        display_name: 'Аня',
        distance_km: 5,
        found_count: 2,
        countries: [{ code: 'AT', name: 'Австрия', percent: 0.1 }],
        cities: [{ name: 'Вена', percent: null, explored_km2: 0.2 }],
        places: [{ name: 'Опера', kind: 'attraction', discovered_at: '2026-09-19T10:00:00Z' }],
      },
      error: null,
    });
    const p = await fetchPlayerProfile({ rpc } as unknown as SupabaseClient, 'u1');
    expect(p?.foundCount).toBe(2);
    expect(p?.cities[0]).toEqual({ name: 'Вена', percent: null, exploredKm2: 0.2 });
    expect(p?.places[0].discoveredAt).toBe(Date.parse('2026-09-19T10:00:00Z'));
  });
});

describe('profile saving', () => {
  const clientWith = (result: unknown) => {
    const upsert = jest.fn().mockResolvedValue(result);
    return { client: { from: () => ({ upsert }) } as unknown as SupabaseClient, upsert };
  };

  it('upserts the profile with the snapshot', async () => {
    const { client, upsert } = clientWith({ error: null });
    await saveMyProfile(client, 'u1', { displayName: 'Аня', isPublic: true }, snapshot);
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', display_name: 'Аня', is_public: true, distance_km: 3.4 });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id' });
  });

  it('reports a taken name', async () => {
    const { client } = clientWith({ error: { code: '23505' } });
    await expect(saveMyProfile(client, 'u1', { displayName: 'Аня', isPublic: true }, snapshot)).rejects.toBeInstanceOf(NameTakenError);
  });
});

describe('fetchMyProfile', () => {
  it('returns null when the user has no profile', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) } as unknown as SupabaseClient;
    expect(await fetchMyProfile(client, 'u1')).toBeNull();
  });
});
