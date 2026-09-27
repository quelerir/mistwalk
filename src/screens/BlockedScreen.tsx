import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import { fetchBlocked, unblockPlayer, type BlockedEntry } from '../lib/social/blocks';
import { avatarUrl } from '../lib/social/profiles';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useT } from '../i18n/I18nProvider';

export interface BlockedScreenProps {
  client: SupabaseClient;
  onBack: () => void;
}

export default function BlockedScreen({ client, onBack }: BlockedScreenProps) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const [entries, setEntries] = useState<BlockedEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchBlocked(client)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('[blocked] load failed', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const unblock = useCallback(
    async (entry: BlockedEntry) => {
      setBusyId(entry.userId);
      try {
        await unblockPlayer(client, entry.userId);
        setEntries((prev) => prev.filter((e) => e.userId !== entry.userId));
      } catch (err) {
        console.warn('[blocked] unblock failed', err);
        Alert.alert(t('common.failed'), t('common.checkInternet'));
      } finally {
        setBusyId(null);
      }
    },
    [client, t]
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('blocked.title')}</Text>
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>{t('blocked.loadFailed')}</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          ListEmptyComponent={<Text style={styles.empty}>{t('blocked.empty')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar uri={avatarUrl(client, item.avatarPath)} name={item.displayName} size={44} />
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              <Pressable
                style={styles.unblockButton}
                onPress={() => void unblock(item)}
                disabled={busyId === item.userId}
                accessibilityRole="button"
              >
                {busyId === item.userId ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.unblockText}>{t('blocked.unblock')}</Text>
                )}
              </Pressable>
            </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text },
  unblockButton: { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  unblockText: { fontSize: 13, fontWeight: '600', color: c.text },
});
