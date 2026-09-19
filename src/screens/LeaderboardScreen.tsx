import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchLeaderboard,
  fetchMyProfile,
  NameTakenError,
  saveMyProfile,
  setProfileVisibility,
  type LeaderboardEntry,
  type MyProfile,
  type ProfileSnapshot,
} from '../lib/social/profiles';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface LeaderboardScreenProps {
  client: SupabaseClient;
  userId: string;
  snapshot: ProfileSnapshot;
  onBack: () => void;
  onOpenPlayer: (entry: LeaderboardEntry) => void;
}

const SYNC_DELAY_MS = 4000;
const MIN_NAME = 2;
const MAX_NAME = 24;

export default function LeaderboardScreen({ client, userId, snapshot, onBack, onOpenPlayer }: LeaderboardScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const [me, setMe] = useState<MyProfile | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const lastSynced = useRef('');

  const load = useCallback(async () => {
    try {
      const [profile, list] = await Promise.all([fetchMyProfile(client, userId), fetchLeaderboard(client)]);
      setMe(profile);
      setEntries(list);
      if (profile) setName((current) => current || profile.displayName);
      setStatus('ready');
    } catch (err) {
      console.warn('[leaderboard] load failed', err);
      setStatus('error');
    }
  }, [client, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the public numbers fresh while the screen is open and the player takes part.
  const snapshotKey = JSON.stringify(snapshot);
  useEffect(() => {
    if (!me?.isPublic || snapshotKey === lastSynced.current) return;
    const timer = setTimeout(() => {
      lastSynced.current = snapshotKey;
      saveMyProfile(client, userId, me, snapshot).catch((err) => {
        lastSynced.current = '';
        console.warn('[leaderboard] sync failed', err);
      });
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, snapshotKey]);

  async function join() {
    const trimmed = name.trim();
    if (trimmed.length < MIN_NAME || trimmed.length > MAX_NAME) {
      setMessage(`Имя от ${MIN_NAME} до ${MAX_NAME} символов`);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await saveMyProfile(client, userId, { displayName: trimmed, isPublic: true }, snapshot);
      lastSynced.current = snapshotKey;
      await load();
    } catch (err) {
      setMessage(err instanceof NameTakenError ? 'Это имя уже занято' : 'Не удалось сохранить. Проверьте интернет.');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await setProfileVisibility(client, userId, false);
      await load();
    } catch {
      setMessage('Не удалось скрыть профиль');
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <View>
      {me?.isPublic ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Вы в рейтинге как {me.displayName}</Text>
          <Text style={styles.cardText}>Другие игроки видят найденные места, страны и города, но не ваши маршруты.</Text>
          <Pressable onPress={() => void leave()} disabled={busy} accessibilityRole="button">
            <Text style={styles.link}>Скрыть меня из рейтинга</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Участвовать в рейтинге</Text>
          <Text style={styles.cardText}>
            Игроки увидят ваше имя, число найденных мест, страны и города. Точные маршруты и координаты остаются
            приватными.
          </Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Как вас показывать"
            placeholderTextColor={c.textFaint}
            maxLength={MAX_NAME}
            autoCapitalize="words"
          />
          <Pressable
            style={[styles.button, busy && styles.disabled]}
            onPress={() => void join()}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Участвовать</Text>
          </Pressable>
        </View>
      )}
      {message && <Text style={styles.error}>{message}</Text>}
      <Text style={styles.sectionTitle}>Игроки</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Рейтинг</Text>
          <Text style={styles.subtitle}>По найденным местам</Text>
        </View>
      </View>
      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>Рейтинг пока недоступен. Проверьте интернет и попробуйте позже.</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={styles.empty}>Пока никого. Станьте первым!</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenPlayer(item)}
              accessibilityRole="button"
            >
              <Text style={styles.rank}>{item.rank}</Text>
              <Text style={[styles.name, item.userId === userId && styles.mine]} numberOfLines={1}>
                {item.displayName}
                {item.userId === userId ? ' (вы)' : ''}
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
    title: { fontSize: 24, fontWeight: '800', color: c.text },
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
    rank: { width: 32, fontSize: 16, fontWeight: '800', color: c.textMuted },
    name: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text },
    mine: { color: c.link },
    count: { fontSize: 16, fontWeight: '700', color: c.text, marginLeft: 12 },
    chevron: { fontSize: 24, color: c.chevron, marginLeft: 8 },
  });
