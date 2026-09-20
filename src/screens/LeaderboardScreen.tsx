import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import { avatarUrl, fetchLeaderboard, type LeaderboardEntry } from '../lib/social/profiles';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useT } from '../i18n/I18nProvider';

export interface LeaderboardScreenProps {
  client: SupabaseClient;
  userId: string;
  onBack: () => void;
  onOpenPlayer: (entry: LeaderboardEntry) => void;
}

export default function LeaderboardScreen({ client, userId, onBack, onOpenPlayer }: LeaderboardScreenProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetchLeaderboard(client)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('[leaderboard] load failed', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('rating.title')}</Text>
          <Text style={styles.subtitle}>{t('rating.subtitle')}</Text>
        </View>
      </View>
      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>{t('rating.unavailable')}</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          ListEmptyComponent={<Text style={styles.empty}>{t('rating.empty')}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenPlayer(item)}
              accessibilityRole="button"
            >
              <Text style={styles.rank}>{item.rank}</Text>
              <View style={styles.avatar}>
                <Avatar uri={avatarUrl(client, item.avatarPath)} name={item.displayName} size={36} />
              </View>
              <Text style={[styles.name, item.userId === userId && styles.mine]} numberOfLines={1}>
                {item.displayName}
                {item.userId === userId ? t('rating.you') : ''}
              </Text>
              <Text style={styles.count}>{item.foundCount}</Text>
              <Text style={styles.chevron}>›</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
    headerText: { flex: 1 },
    title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text },
    subtitle: { marginTop: 2, color: c.textMuted },
    loader: { marginTop: 32 },
    empty: { marginTop: 24, paddingHorizontal: 16, textAlign: 'center', color: c.textMuted },
    card: { margin: 16, marginBottom: 8, padding: 14, borderRadius: 14, backgroundColor: c.surface },
    cardTitle: { fontSize: 16, fontWeight: '700', color: c.text },
    cardText: { marginTop: 6, color: c.textMuted, lineHeight: 20 },
    input: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      fontSize: 16,
    },
    button: { marginTop: 12, backgroundColor: c.buttonBg, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    buttonText: { color: c.buttonText, fontWeight: '700' },
    disabled: { opacity: 0.5 },
    link: { marginTop: 10, color: c.link, fontWeight: '700' },
    error: { marginHorizontal: 16, color: c.danger },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    pressed: { opacity: 0.5 },
    avatar: { marginRight: 12 },
    rank: { width: 32, fontSize: 16, fontWeight: '800', color: c.textMuted },
    name: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text },
    mine: { color: c.link },
    count: { fontSize: 16, fontWeight: '700', color: c.text, marginLeft: 12 },
    chevron: { fontSize: 24, color: c.chevron, marginLeft: 8 },
  });
