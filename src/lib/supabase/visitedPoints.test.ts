import { fetchVisitedPoints, insertVisitedPoints, VisitedPoint } from './visitedPoints';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeFakeClient(selectResult: { data: unknown; error: unknown }, insertResult: { error: unknown }) {
  const range = jest.fn().mockResolvedValue(selectResult);
  const order = jest.fn().mockReturnValue({ range });
  const eq = jest.fn().mockReturnValue({ order });
  const select = jest.fn().mockReturnValue({ eq });
  const insert = jest.fn().mockResolvedValue(insertResult);
  const from = jest.fn().mockReturnValue({ select, insert });
  return { client: { from } as unknown as SupabaseClient, select, eq, order, range, insert, from };
}

describe('fetchVisitedPoints', () => {
  it('maps rows to VisitedPoint objects', async () => {
    const { client, from, select, eq, order, range } = makeFakeClient(
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
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(range).toHaveBeenCalledWith(0, 999);
    expect(points).toEqual([{ lat: 1, lng: 2, radius: 30, ts: Date.parse('2026-01-01T00:00:00.000Z') }]);
  });

  it('returns an empty array when data is null', async () => {
    const { client } = makeFakeClient({ data: null, error: null }, { error: null });
    const points = await fetchVisitedPoints(client, 'user-1');
    expect(points).toEqual([]);
  });

  it('paginates when a page is exactly full', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, i) => ({
      lat: i,
      lng: i,
      radius: 30,
      created_at: '2026-01-01T00:00:00.000Z',
    }));
    const range = jest
      .fn()
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({ data: [{ lat: 9999, lng: 9999, radius: 30, created_at: '2026-01-02T00:00:00.000Z' }], error: null });
    const order = jest.fn().mockReturnValue({ range });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const client = { from } as unknown as SupabaseClient;

    const points = await fetchVisitedPoints(client, 'user-1');

    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(points).toHaveLength(1001);
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

  it('inserts rows with user_id attached and the capture time, not the upload time', async () => {
    const { client, insert } = makeFakeClient({ data: [], error: null }, { error: null });
    const points: VisitedPoint[] = [{ lat: 1, lng: 2, radius: 30, ts: 1735689600000 }];

    await insertVisitedPoints(client, 'user-1', points);

    expect(insert).toHaveBeenCalledWith([
      { user_id: 'user-1', lat: 1, lng: 2, radius: 30, created_at: '2025-01-01T00:00:00.000Z' },
    ]);
  });

  it('throws on error', async () => {
    const { client } = makeFakeClient({ data: [], error: null }, { error: new Error('insert failed') });
    await expect(
      insertVisitedPoints(client, 'user-1', [{ lat: 1, lng: 2, radius: 30, ts: 1 }])
    ).rejects.toThrow('insert failed');
  });
});
