import type { SupabaseClient } from '@supabase/supabase-js';

export interface FollowState {
  following: boolean;
  followsMe: boolean;
  followers: number;
  followingCount: number;
}

export interface FollowEntry {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  iFollow: boolean;
  followsMe: boolean;
  followedAt: number;
}

interface FollowRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  i_follow: boolean;
  follows_me: boolean;
  followed_at: string;
}

const LIST_LIMIT = 200;

export async function followPlayer(client: SupabaseClient, target: string): Promise<void> {
  const { error } = await client.rpc('follow_player', { target });
  if (error) throw error;
}

export async function unfollowPlayer(client: SupabaseClient, target: string): Promise<void> {
  const { error } = await client.rpc('unfollow_player', { target });
  if (error) throw error;
}

export async function fetchFollowState(client: SupabaseClient, target: string): Promise<FollowState> {
  const { data, error } = await client.rpc('follow_state', { target });
  if (error) throw error;
  return {
    following: Boolean(data?.following),
    followsMe: Boolean(data?.follows_me),
    followers: Number(data?.followers ?? 0),
    followingCount: Number(data?.following_count ?? 0),
  };
}

function mapRows(data: unknown): FollowEntry[] {
  return ((data ?? []) as FollowRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    iFollow: row.i_follow,
    followsMe: row.follows_me,
    followedAt: Date.parse(row.followed_at),
  }));
}

export async function fetchFollowers(client: SupabaseClient): Promise<FollowEntry[]> {
  const { data, error } = await client.rpc('my_followers', { max_rows: LIST_LIMIT });
  if (error) throw error;
  return mapRows(data);
}

export async function fetchFollowing(client: SupabaseClient): Promise<FollowEntry[]> {
  const { data, error } = await client.rpc('my_following', { max_rows: LIST_LIMIT });
  if (error) throw error;
  return mapRows(data);
}
