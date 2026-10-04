import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationsRead,
  subscribeToNotifications,
} from './notifications';

const row = {
  id: 'n1',
  type: 'follow',
  actor_id: 'u2',
  display_name: 'Аня',
  avatar_path: null,
  i_follow: true,
  created_at: '2026-10-04T10:00:00Z',
  read_at: null,
};

const clientWith = (result: { data?: unknown; error?: unknown }) =>
  ({ rpc: jest.fn().mockResolvedValue({ data: null, error: null, ...result }) }) as unknown as SupabaseClient & {
    rpc: jest.Mock;
  };

describe('fetchNotifications', () => {
  it('maps rows and asks for 50', async () => {
    const client = clientWith({ data: [row, { ...row, id: 'n2', read_at: '2026-10-04T11:00:00Z' }] });
    const list = await fetchNotifications(client);
    expect(client.rpc).toHaveBeenCalledWith('my_notifications', { max_rows: 50 });
    expect(list[0]).toEqual({
      id: 'n1',
      type: 'follow',
      actorId: 'u2',
      displayName: 'Аня',
      avatarPath: null,
      iFollow: true,
      createdAt: Date.parse('2026-10-04T10:00:00Z'),
      readAt: null,
    });
    expect(list[1].readAt).toBe(Date.parse('2026-10-04T11:00:00Z'));
  });

  it('drops rows of a type this version does not know', async () => {
    const list = await fetchNotifications(clientWith({ data: [{ ...row, type: 'reaction' }, row] }));
    expect(list.map((n) => n.id)).toEqual(['n1']);
  });

  it('returns an empty list for null data and throws on error', async () => {
    expect(await fetchNotifications(clientWith({ data: null }))).toEqual([]);
    await expect(fetchNotifications(clientWith({ error: new Error('boom') }))).rejects.toThrow('boom');
  });
});

describe('fetchUnreadNotificationCount', () => {
  it('turns a string into a number and null into 0', async () => {
    expect(await fetchUnreadNotificationCount(clientWith({ data: '3' }))).toBe(3);
    expect(await fetchUnreadNotificationCount(clientWith({ data: null }))).toBe(0);
  });

  it('throws on error', async () => {
    await expect(fetchUnreadNotificationCount(clientWith({ error: new Error('boom') }))).rejects.toThrow('boom');
  });
});

describe('markNotificationsRead', () => {
  it('calls the RPC and throws on error', async () => {
    const ok = clientWith({});
    await markNotificationsRead(ok);
    expect(ok.rpc).toHaveBeenCalledWith('mark_notifications_read');
    await expect(markNotificationsRead(clientWith({ error: new Error('boom') }))).rejects.toThrow('boom');
  });
});

describe('subscribeToNotifications', () => {
  it('listens to inserts for my rows only and reports each one', () => {
    let handler: () => void = () => undefined;
    const channel: any = {
      on: jest.fn((_t: string, _f: unknown, cb: () => void) => {
        handler = cb;
        return channel;
      }),
      subscribe: jest.fn(() => channel),
    };
    const client = { channel: jest.fn(() => channel) } as unknown as SupabaseClient;
    const onInsert = jest.fn();
    const result = subscribeToNotifications(client, 'me', onInsert);
    expect(client.channel).toHaveBeenCalledWith('notifications-me');
    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.me' },
      expect.any(Function)
    );
    handler();
    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(result).toBe(channel);
  });
});
