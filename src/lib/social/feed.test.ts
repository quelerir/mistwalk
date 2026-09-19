import type { SupabaseClient } from '@supabase/supabase-js';
import { countNewer, fetchFeed, timeAgo } from './feed';

describe('fetchFeed', () => {
  it('maps the rows', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [{ user_id: 'u2', display_name: 'Аня', avatar_path: null, place_name: 'Эйфелева башня', kind: 'monument', discovered_at: '2026-09-19T10:00:00.000Z' }],
      error: null,
    });
    const items = await fetchFeed({ rpc } as unknown as SupabaseClient);
    expect(rpc).toHaveBeenCalledWith('friend_feed', { max_rows: 50 });
    expect(items).toEqual([
      { userId: 'u2', displayName: 'Аня', avatarPath: null, placeName: 'Эйфелева башня', kind: 'monument', discoveredAt: Date.parse('2026-09-19T10:00:00.000Z') },
    ]);
  });

  it('throws on an error', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: new Error('down') });
    await expect(fetchFeed({ rpc } as unknown as SupabaseClient)).rejects.toThrow('down');
  });
});

describe('countNewer', () => {
  it('counts finds after the last time the feed was seen', () => {
    const items = [{ discoveredAt: 300 }, { discoveredAt: 200 }, { discoveredAt: 100 }];
    expect(countNewer(items, 150)).toBe(2);
    expect(countNewer(items, 0)).toBe(3);
    expect(countNewer(items, 300)).toBe(0);
  });
});

describe('timeAgo', () => {
  const now = new Date(2026, 8, 19, 12, 0, 0).getTime();
  it('speaks in minutes, hours and days', () => {
    expect(timeAgo(now - 20 * 1000, now)).toBe('только что');
    expect(timeAgo(now - 5 * 60 * 1000, now)).toBe('5 мин назад');
    expect(timeAgo(now - 3 * 3600 * 1000, now)).toBe('3 ч назад');
    expect(timeAgo(now - 26 * 3600 * 1000, now)).toBe('вчера');
    expect(timeAgo(now - 3 * 24 * 3600 * 1000, now)).toBe('3 дн. назад');
  });

  it('falls back to a date after a week', () => {
    expect(timeAgo(now - 20 * 24 * 3600 * 1000, now)).toMatch(/авг|сент/);
  });
});
