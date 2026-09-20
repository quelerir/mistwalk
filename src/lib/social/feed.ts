import type { SupabaseClient } from '@supabase/supabase-js';
import type { PoiKind } from '../poi/types';
import type { TFunc } from '../../i18n';
import { formatDate } from '../../i18n/format';
import type { Lang } from '../../i18n/language';

export interface FeedItem {
  userId: string;
  displayName: string;
  avatarPath: string | null;
  placeName: string;
  kind: PoiKind;
  discoveredAt: number;
}

interface FeedRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  place_name: string;
  kind: string;
  discovered_at: string;
}

const FEED_LIMIT = 50;

export async function fetchFeed(client: SupabaseClient): Promise<FeedItem[]> {
  const { data, error } = await client.rpc('friend_feed', { max_rows: FEED_LIMIT });
  if (error) throw error;
  return ((data ?? []) as FeedRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
    placeName: row.place_name,
    kind: row.kind as PoiKind,
    discoveredAt: Date.parse(row.discovered_at),
  }));
}

export function countNewer(items: Array<{ discoveredAt: number }>, lastSeen: number): number {
  return items.filter((item) => item.discoveredAt > lastSeen).length;
}

// How long ago, in words; a date once it is more than a week.
export function timeAgo(t: TFunc, lang: Lang, ts: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - ts) / 1000));
  if (seconds < 60) return t('ago.now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('ago.min', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('ago.hour', { n: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('ago.yesterday');
  if (days < 7) return t('ago.days', { n: days });
  return formatDate(lang, ts);
}
