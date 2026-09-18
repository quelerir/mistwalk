import { fetchVisitedPoints, insertVisitedPoints, VisitedPoint } from './visitedPoints';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeFakeClient(selectResult: { data: unknown; error: unknown }, insertResult: { error: unknown }) {
  const eq = jest.fn().mockResolvedValue(selectResult);
  const select = jest.fn().mockReturnValue({ eq });
  const insert = jest.fn().mockResolvedValue(insertResult);
  const from = jest.fn().mockReturnValue({ select, insert });
  return { client: { from } as unknown as SupabaseClient, select, eq, insert, from };
}

describe('fetchVisitedPoints', () => {
  it('maps rows to VisitedPoint objects', async () => {
    const { client, from, select, eq } = makeFakeClient(
      {
        data: [{ lat: 1, lng: 2, radius: 30, created_at: '2026-01-01T00:00:00.000Z' }],
        error: null,
      },
      { error: null }
    );

    const points = await fetchVisitedPoints(client, 'user-1');

    expect(from).toHaveBeenCalledWith('visited_points');
    expect(select).toHaveBeenCalledWith('lat, lng, radius, created_at');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(points).toEqual([{ lat: 1, lng: 2, radius: 30, ts: Date.parse('2026-01-01T00:00:00.000Z') }]);
  });

  it('throws on error', async () => {
    const { client } = makeFakeClient({ data: null, error: new Error('boom') }, { error: null });
    await expect(fetchVisitedPoints(client, 'user-1')).rejects.toThrow('boom');
  });
});

describe('insertVisitedPoints', () => {
  it('does nothing for an empty array', async () => {
    const { client, from } = makeFakeClient({ data: [], error: null }, { error: null });
    await insertVisitedPoints(client, 'user-1', []);
    expect(from).not.toHaveBeenCalled();
  });

  it('inserts rows with user_id attached', async () => {
    const { client, insert } = makeFakeClient({ data: [], error: null }, { error: null });
    const points: VisitedPoint[] = [{ lat: 1, lng: 2, radius: 30, ts: 1735689600000 }];

    await insertVisitedPoints(client, 'user-1', points);

    expect(insert).toHaveBeenCalledWith([{ user_id: 'user-1', lat: 1, lng: 2, radius: 30 }]);
  });

  it('throws on error', async () => {
    const { client } = makeFakeClient({ data: [], error: null }, { error: new Error('insert failed') });
    await expect(
      insertVisitedPoints(client, 'user-1', [{ lat: 1, lng: 2, radius: 30, ts: 1 }])
    ).rejects.toThrow('insert failed');
  });
});
