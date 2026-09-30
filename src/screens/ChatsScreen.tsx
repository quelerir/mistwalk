import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import { fetchConversations, type Conversation } from '../lib/social/messages';
import { avatarUrl } from '../lib/social/profiles';
import { timeAgo } from '../lib/social/feed';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useI18n } from '../i18n/I18nProvider';

export interface ChatsScreenProps {
  client: SupabaseClient;
  onOpenChat: (other: { userId: string; displayName: string }) => void;
}

export default function ChatsScreen({ client, onOpenChat }: ChatsScreenProps) {
  const { t, lang } = useI18n();
  const styles = useStyles(makeStyles);
  const [items, setItems] = useState<Conversation[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await fetchConversations(client);
      setItems(list);
      setStatus('ready');
    } catch (err) {
      console.warn('[chats] load failed', err);
      setStatus('error');
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('chats.title')}</Text>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>{t('chats.loadFailed')}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.otherUserId}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load().finally(() => setRefreshing(false));
          }}
          ListEmptyComponent={<Text style={styles.empty}>{t('chats.empty')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenChat({ userId: item.otherUserId, displayName: item.displayName })}
              accessibilityRole="button"
            >
              <View>
                <Avatar uri={avatarUrl(client, item.avatarPath)} name={item.displayName} size={48} />
                {item.unreadCount > 0 && <View style={styles.dot} />}
              </View>
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <Text style={[styles.name, item.unreadCount > 0 && styles.nameUnread]} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.time}>{timeAgo(t, lang, item.lastAt)}</Text>
                </View>
                <Text style={[styles.preview, item.unreadCount > 0 && styles.previewUnread]} numberOfLines={1}>
                  {item.lastFromMe ? t('chats.youPrefix', { text: item.lastBody }) : item.lastBody}
                </Text>
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
  title: { fontSize: 34, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  loader: { marginTop: 32 },
  empty: { marginTop: 32, paddingHorizontal: 24, textAlign: 'center', color: c.textMuted },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  pressed: { opacity: 0.6 },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.bg,
  },
  body: { flex: 1 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: c.text },
  nameUnread: { color: c.text },
  time: { fontSize: 13, color: c.textMuted, marginLeft: 8 },
  preview: { marginTop: 2, fontSize: 14, color: c.textMuted },
  previewUnread: { color: c.text, fontWeight: '600' },
});
