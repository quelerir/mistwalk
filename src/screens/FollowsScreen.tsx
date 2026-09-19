import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import FollowButton from '../components/FollowButton';
import {
  fetchFollowers,
  fetchFollowing,
  followPlayer,
  unfollowPlayer,
  type FollowEntry,
} from '../lib/social/follows';
import { avatarUrl } from '../lib/social/profiles';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';

type Tab = 'followers' | 'following';

export interface FollowsScreenProps {
  client: SupabaseClient;
  onBack: () => void;
  onOpenPlayer: (player: { userId: string; displayName: string }) => void;
}

export default function FollowsScreen({ client, onBack, onOpenPlayer }: FollowsScreenProps) {
  const styles = useStyles(makeStyles);
  const [tab, setTab] = useState<Tab>('followers');
  const [entries, setEntries] = useState<FollowEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (tab === 'followers' ? fetchFollowers(client) : fetchFollowing(client))
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('[follows] load failed', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client, tab]);

  const toggle = useCallback(
    async (entry: FollowEntry) => {
      setBusyId(entry.userId);
      try {
        if (entry.iFollow) await unfollowPlayer(client, entry.userId);
        else await followPlayer(client, entry.userId);
        // In "following" an unfollowed player leaves the list; in "followers" only the button changes.
        setEntries((prev) =>
          tab === 'following' && entry.iFollow
            ? prev.filter((e) => e.userId !== entry.userId)
            : prev.map((e) => (e.userId === entry.userId ? { ...e, iFollow: !entry.iFollow } : e))
        );
      } catch (err) {
        console.warn('[follows] toggle failed', err);
        Alert.alert('Не удалось', 'Проверьте интернет и попробуйте ещё раз.');
      } finally {
        setBusyId(null);
      }
    },
    [client, tab]
  );

  const emptyText =
    tab === 'followers' ? 'Пока никто не подписался. Ваш профиль виден в рейтинге.' : 'Вы ни на кого не подписаны. Загляните в рейтинг.';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Подписки</Text>
      </View>

      <View style={styles.tabs}>
        {(['followers', 'following'] as Tab[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === 'followers' ? 'Подписчики' : 'Подписки'}
            </Text>
          </Pressable>
        ))}
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>Не удалось загрузить. Проверьте интернет и попробуйте позже.</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenPlayer({ userId: item.userId, displayName: item.displayName })}
              accessibilityRole="button"
            >
              <Avatar uri={avatarUrl(client, item.avatarPath)} name={item.displayName} size={44} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                {item.iFollow && item.followsMe && <Text style={styles.sub}>Взаимная подписка</Text>}
              </View>
              <FollowButton
                compact
                iFollow={item.iFollow}
                followsMe={item.followsMe}
                busy={busyId === item.userId}
                onPress={() => void toggle(item)}
              />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
  title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  tab: { paddingHorizontal: 16, height: 36, borderRadius: 18, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  tabActive: { backgroundColor: c.text },
  tabText: { fontWeight: '600', color: c.text },
  tabTextActive: { color: c.bg },
  loader: { marginTop: 32 },
  empty: { marginTop: 32, paddingHorizontal: 24, textAlign: 'center', color: c.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: c.text },
  sub: { marginTop: 2, fontSize: 13, color: c.textMuted },
});
