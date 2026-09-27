import type { SupabaseClient } from '@supabase/supabase-js';
import { blockPlayer, unblockPlayer, fetchBlocked } from './blocks';

function client(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const row = { user_id: 'u2', display_name: 'Анна', avatar_path: null };

describe('blocks', () => {
  it('blocks and unblocks through the functions', async () => {
    const a = client({ data: null, error: null });
    await blockPlayer(a.client, 'u2');
    expect(a.rpc).toHaveBeenCalledWith('block_player', { target: 'u2' });
    const b = client({ data: null, error: null });
    await unblockPlayer(b.client, 'u2');
    expect(b.rpc).toHaveBeenCalledWith('unblock_player', { target: 'u2' });
  });

  it('throws when blocking fails', async () => {
    await expect(blockPlayer(client({ data: null, error: new Error('nope') }).client, 'u2')).rejects.toThrow('nope');
  });

  it('throws when unblocking fails', async () => {
    await expect(unblockPlayer(client({ data: null, error: new Error('nope') }).client, 'u2')).rejects.toThrow('nope');
  });

  it('maps the blocked list', async () => {
    const { client: c, rpc } = client({ data: [row], error: null });
    expect(await fetchBlocked(c)).toEqual([{ userId: 'u2', displayName: 'Анна', avatarPath: null }]);
    expect(rpc).toHaveBeenCalledWith('my_blocked', { max_rows: 200 });
  });
});
