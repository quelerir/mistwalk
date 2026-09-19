import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchFollowers, fetchFollowing, fetchFollowState, followPlayer, unfollowPlayer } from './follows';

function client(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const row = {
  user_id: 'u2',
  display_name: 'Анна',
  avatar_path: null,
  i_follow: false,
  follows_me: true,
  followed_at: '2026-09-01T10:00:00.000Z',
};

describe('follows', () => {
  it('follows and unfollows through the functions', async () => {
    const a = client({ data: null, error: null });
    await followPlayer(a.client, 'u2');
    expect(a.rpc).toHaveBeenCalledWith('follow_player', { target: 'u2' });
    const b = client({ data: null, error: null });
    await unfollowPlayer(b.client, 'u2');
    expect(b.rpc).toHaveBeenCalledWith('unfollow_player', { target: 'u2' });
  });

  it('throws when the function fails', async () => {
    await expect(followPlayer(client({ data: null, error: new Error('nope') }).client, 'u2')).rejects.toThrow('nope');
  });

  it('maps the follow state', async () => {
    const { client: c, rpc } = client({
      data: { following: true, follows_me: false, followers: '3', following_count: 5 },
      error: null,
    });
    expect(await fetchFollowState(c, 'u2')).toEqual({ following: true, followsMe: false, followers: 3, followingCount: 5 });
    expect(rpc).toHaveBeenCalledWith('follow_state', { target: 'u2' });
  });

  it('maps the lists', async () => {
    const followers = client({ data: [row], error: null });
    expect(await fetchFollowers(followers.client)).toEqual([
      { userId: 'u2', displayName: 'Анна', avatarPath: null, iFollow: false, followsMe: true, followedAt: Date.parse(row.followed_at) },
    ]);
    expect(followers.rpc).toHaveBeenCalledWith('my_followers', { max_rows: 200 });
    const following = client({ data: [{ ...row, i_follow: true }], error: null });
    expect((await fetchFollowing(following.client))[0].iFollow).toBe(true);
    expect(following.rpc).toHaveBeenCalledWith('my_following', { max_rows: 200 });
  });
});
