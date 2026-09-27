import type { SupabaseClient } from '@supabase/supabase-js';

export interface BlockedEntry {
  userId: string;
  displayName: string;
  avatarPath: string | null;
}

interface BlockedRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
}

const LIST_LIMIT = 200;

export async function blockPlayer(client: SupabaseClient, target: string): Promise<void> {
  const { error } = await client.rpc('block_player', { target });
  if (error) throw error;
}

export async function unblockPlayer(client: SupabaseClient, target: string): Promise<void> {
  const { error } = await client.rpc('unblock_player', { target });
  if (error) throw error;
}

export async function fetchBlocked(client: SupabaseClient): Promise<BlockedEntry[]> {
  const { data, error } = await client.rpc('my_blocked', { max_rows: LIST_LIMIT });
  if (error) throw error;
  return ((data ?? []) as BlockedRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
  }));
}
