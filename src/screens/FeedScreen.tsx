import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import KindIcon from '../components/KindIcon';
import { fetchFeed, timeAgo, type FeedItem } from '../lib/social/feed';
import { setFeedSeen } from '../lib/social/feedSeen';
import { avatarUrl } from '../lib/social/profiles';
import { KIND_COLOR, kindTint } from '../lib/poi/kindColors';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';

export interface FeedScreenProps {
  client: SupabaseClient;
  onBack: () => void;
  onOpenPlayer: (player: { userId: string; displayName: string }) => void;
}

export default function FeedScreen({ client, onBack, onOpenPlayer }: FeedScreenProps) {
  const styles = useStyles(makeStyles);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchFeed(client);
      setItems(list);
      setStatus('ready');
      // Opening the feed counts as seeing everything in it.
      void setFeedSeen(AsyncStorage, Date.now());
    } catch (err) {
      console.warn('[feed] load failed', err);
      setStatus('error');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Лента друзей</Text>
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>Не удалось загрузить ленту. Проверьте интернет и попробуйте позже.</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.userId}-${item.discoveredAt}-${index}`}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
          ListEmptyComponent={
            <Text style={styles.empty}>Здесь появятся находки тех, на кого вы подписаны. Подпишитесь на игроков в рейтинге.</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenPlayer({ userId: item.userId, displayName: item.displayName })}
              accessibilityRole="button"
            >
              <Avatar uri={avatarUrl(client, item.avatarPath)} name={item.displayName} size={44} />
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.time}>{timeAgo(item.discoveredAt)}</Text>
                </View>
                <View style={styles.placeLine}>
                  <View style={[styles.kindBadge, { backgroundColor: kindTint(item.kind) }]}>
                    <KindIcon kind={item.kind} size={14} color={KIND_COLOR[item.kind]} />
                  </View>
                  <Text style={styles.place} numberOfLines={2}>
                    Новая находка: {item.placeName}
                  </Text>
                </View>
              </View>
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
  loader: { marginTop: 32 },
  empty: { marginTop: 32, paddingHorizontal: 24, textAlign: 'center', color: c.textMuted },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  pressed: { opacity: 0.6 },
  body: { flex: 1 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: c.text },
  time: { fontSize: 13, color: c.textMuted, marginLeft: 8 },
  placeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  kindBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  place: { flex: 1, fontSize: 15, color: c.text },
});
