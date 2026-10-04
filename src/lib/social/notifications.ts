import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface AppNotification {
  id: string;
  type: 'follow';
  actorId: string;
  displayName: string;
  avatarPath: string | null;
  iFollow: boolean;
  createdAt: number;
  readAt: number | null;
}

interface NotificationRow {
  id: string;
  type: string;
  actor_id: string;
  display_name: string;
  avatar_path: string | null;
  i_follow: boolean;
  created_at: string;
  read_at: string | null;
}

const KNOWN_TYPES = new Set(['follow']);
const LIST_LIMIT = 50;

export async function fetchNotifications(client: SupabaseClient): Promise<AppNotification[]> {
  const { data, error } = await client.rpc('my_notifications', { max_rows: LIST_LIMIT });
  if (error) throw error;
  // A newer server may add types this version cannot show; they are skipped rather than shown wrongly.
  return ((data ?? []) as NotificationRow[])
    .filter((row) => KNOWN_TYPES.has(row.type))
    .map((row) => ({
      id: row.id,
      type: row.type as AppNotification['type'],
      actorId: row.actor_id,
      displayName: row.display_name,
      avatarPath: row.avatar_path ?? null,
      iFollow: row.i_follow,
      createdAt: Date.parse(row.created_at),
      readAt: row.read_at ? Date.parse(row.read_at) : null,
    }));
}

export async function fetchUnreadNotificationCount(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc('unread_notification_count');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function markNotificationsRead(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('mark_notifications_read');
  if (error) throw error;
}

// Tells the caller that a notification for me was created; the caller asks the server for the real count, since the
// server hides actors that are blocked or private.
export function subscribeToNotifications(client: SupabaseClient, myId: string, onInsert: () => void): RealtimeChannel {
  return client
    .channel(`notifications-${myId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${myId}` },
      () => onInsert()
    )
    .subscribe();
}
