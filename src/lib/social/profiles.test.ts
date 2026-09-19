import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildSnapshot,
  fetchLeaderboard,
  fetchMyProfile,
  fetchPlayerProfile,
  NameTakenError,
  avatarUrl,
  reportPlayer,
  saveMyProfile,
  uploadAvatar,
} from './profiles';

const snapshot = { distanceKm: 3.4, countries: [], cities: [], placeRegions: {} };

describe('buildSnapshot', () => {
  it('keeps only visited countries and rounds the distance', () => {
    const s = buildSnapshot(
      3.456,
      [
        { code: 'AT', name: 'Австрия', exploredKm2: 1, totalKm2: 100, percent: 1 },
        { code: 'FR', name: 'Франция', exploredKm2: 0, totalKm2: 100, percent: 0 },
      ],
      [{ name: 'Вена', country: 'AT', wikidata: 'Q1741', exploredKm2: 0.3, totalKm2: 412, percent: 0.07, found: 5 }],
      { 'node/1': { c: 'AT', t: 'Вена' } }
    );
    expect(s.distanceKm).toBe(3.5);
    expect(s.countries).toEqual([{ code: 'AT', name: 'Австрия', percent: 1 }]);
    expect(s.cities).toEqual([{ name: 'Вена', country: 'AT', wikidata: 'Q1741', percent: 0.07, exploredKm2: 0.3 }]);
    expect(s.placeRegions).toEqual({ 'node/1': { c: 'AT', t: 'Вена' } });
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
    expect(list).toEqual([{ userId: 'u1', displayName: 'Аня', avatarPath: null, foundCount: 12, rank: 1 }]);
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
        cities: [{ name: 'Вена', country: 'AT', wikidata: 'Q1741', percent: null, explored_km2: 0.2 }],
        places: [
          { name: 'Опера', kind: 'attraction', discovered_at: '2026-09-19T10:00:00Z', country: 'AT', city: 'Вена' },
          { name: 'Старое', kind: 'monument', discovered_at: '2026-09-18T10:00:00Z' },
        ],
      },
      error: null,
    });
    const p = await fetchPlayerProfile({ rpc } as unknown as SupabaseClient, 'u1');
    expect(p?.foundCount).toBe(2);
    expect(p?.cities[0]).toEqual({ name: 'Вена', country: 'AT', wikidata: 'Q1741', percent: null, exploredKm2: 0.2 });
    expect(p?.places[0]).toMatchObject({ country: 'AT', city: 'Вена' });
    expect(p?.places[1]).toMatchObject({ country: null, city: null });
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
    await saveMyProfile(client, 'u1', { displayName: 'Аня', isPublic: true, avatarPath: null }, snapshot);
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', display_name: 'Аня', is_public: true, distance_km: 3.4 });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id' });
  });

  it('reports a taken name', async () => {
    const { client } = clientWith({ error: { code: '23505' } });
    await expect(saveMyProfile(client, 'u1', { displayName: 'Аня', isPublic: true, avatarPath: null }, snapshot)).rejects.toBeInstanceOf(NameTakenError);
  });
});

describe('fetchMyProfile', () => {
  it('returns null when the user has no profile', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const client = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) } as unknown as SupabaseClient;
    expect(await fetchMyProfile(client, 'u1')).toBeNull();
  });
});

describe('avatars', () => {
  const storageClient = (upload: jest.Mock, remove: jest.Mock, update: jest.Mock) =>
    ({
      storage: {
        from: () => ({
          upload,
          remove,
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${path}` } }),
        }),
      },
      from: () => ({ update: () => ({ eq: update }) }),
    }) as unknown as SupabaseClient;

  it('builds a public url only when there is a path', () => {
    const client = storageClient(jest.fn(), jest.fn(), jest.fn());
    expect(avatarUrl(client, null)).toBeNull();
    expect(avatarUrl(client, 'u1/a.jpg')).toBe('https://cdn/u1/a.jpg');
  });

  it('uploads into the user folder, updates the profile and removes the old file', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const remove = jest.fn().mockResolvedValue({});
    const update = jest.fn().mockResolvedValue({ error: null });
    const path = await uploadAvatar(storageClient(upload, remove, update), 'u1', new ArrayBuffer(4), 'u1/old.jpg');
    expect(path).toMatch(/^u1\/avatar-\d+\.jpg$/);
    expect(upload.mock.calls[0][0]).toBe(path);
    expect(update).toHaveBeenCalledWith('user_id', 'u1');
    expect(remove).toHaveBeenCalledWith(['u1/old.jpg']);
  });

  it('does not touch the profile when the upload fails', async () => {
    const upload = jest.fn().mockResolvedValue({ error: new Error('boom') });
    const update = jest.fn();
    await expect(uploadAvatar(storageClient(upload, jest.fn(), update), 'u1', new ArrayBuffer(4), null)).rejects.toThrow('boom');
    expect(update).not.toHaveBeenCalled();
  });
});

describe('reportPlayer', () => {
  it('sends the reason to the report function', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: null });
    await reportPlayer({ rpc } as unknown as SupabaseClient, 'u2', 'photo');
    expect(rpc).toHaveBeenCalledWith('report_player', { target: 'u2', why: 'photo' });
  });

  it('throws when the call fails', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: new Error('nope') });
    await expect(reportPlayer({ rpc } as unknown as SupabaseClient, 'u2', 'name')).rejects.toThrow('nope');
  });
});
