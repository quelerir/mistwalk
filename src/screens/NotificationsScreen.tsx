import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import { fetchNotifications, markNotificationsRead, type AppNotification } from '../lib/social/notifications';
import { timeAgo } from '../lib/social/feed';
import { avatarUrl } from '../lib/social/profiles';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useI18n } from '../i18n/I18nProvider';

export interface NotificationsScreenProps {
  client: SupabaseClient;
  onBack: () => void;
  onOpenPlayer: (player: { userId: string; displayName: string }) => void;
  // Called once the list is shown and the server has marked everything read: the badge can go.
  onRead: () => void;
}

export default function NotificationsScreen({ client, onBack, onOpenPlayer, onRead }: NotificationsScreenProps) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchNotifications(client)
      .then((list) => {
        if (cancelled) return;
        // The list keeps what was unread when it was loaded, so the rows stay marked while this screen is open.
        setItems(list);
        setStatus('ready');
        markNotificationsRead(client)
          .then(() => {
            if (!cancelled) onRead();
          })
          .catch((err) => console.warn('[notifications] mark read failed', err));
      })
      .catch((err) => {
        console.warn('[notifications] load failed', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('notifications.title')}</Text>
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>{t('notifications.loadFailed')}</Text>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Text style={styles.empty}>{t('notifications.empty')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenPlayer({ userId: item.actorId, displayName: item.displayName })}
              accessibilityRole="button"
            >
              <Avatar uri={avatarUrl(client, item.avatarPath)} name={item.displayName} size={44} />
              <View style={styles.rowText}>
                <Text style={[styles.text, item.readAt === null && styles.textUnread]} numberOfLines={2}>
                  {t('notifications.follow', { name: item.displayName })}
                </Text>
                <Text style={styles.time}>{timeAgo(t, lang, item.createdAt)}</Text>
              </View>
              {item.readAt === null && <View testID={`notification-unread-${item.id}`} style={styles.dot} />}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
    back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
    title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text },
    loader: { marginTop: 32 },
    empty: { marginTop: 32, paddingHorizontal: 24, textAlign: 'center', color: c.textMuted },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    pressed: { opacity: 0.5 },
    rowText: { flex: 1, marginLeft: 12 },
    text: { fontSize: 15, color: c.text },
    textUnread: { fontWeight: '700' },
    time: { marginTop: 2, fontSize: 12, color: c.textMuted },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent, marginLeft: 8 },
  });
