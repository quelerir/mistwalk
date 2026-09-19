import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import KindIcon from '../components/KindIcon';
import { flagUrl } from '../lib/geo/countries';
import { formatPercent } from '../lib/geo/countryStats';
import { formatKm2 } from '../lib/geo/cityStats';
import { avatarUrl, fetchPlayerProfile, reportPlayer, type PlayerProfile, type ReportReason } from '../lib/social/profiles';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface PlayerScreenProps {
  client: SupabaseClient;
  playerId: string;
  fallbackName: string;
  onBack: () => void;
  isMe: boolean;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function PlayerScreen({ client, playerId, fallbackName, onBack, isMe }: PlayerScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'hidden' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchPlayerProfile(client, playerId)
      .then((result) => {
        if (cancelled) return;
        setPlayer(result);
        setStatus(result ? 'ready' : 'hidden');
      })
      .catch((err) => {
        console.warn('[player] load failed', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client, playerId]);

  function report() {
    const send = (reason: ReportReason) =>
      reportPlayer(client, playerId, reason)
        .then(() => Alert.alert('Спасибо', 'Жалоба отправлена. Профиль скроется после нескольких жалоб.'))
        .catch(() => Alert.alert('Не удалось отправить', 'Проверьте интернет и попробуйте ещё раз.'));
    Alert.alert('Пожаловаться на игрока', 'На что именно?', [
      { text: 'Имя', onPress: () => void send('name') },
      { text: 'Фото', onPress: () => void send('photo') },
      { text: 'Другое', onPress: () => void send('other') },
      { text: 'Отмена', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.avatar}>
          <Avatar uri={avatarUrl(client, player?.avatarPath ?? null)} name={player?.displayName ?? fallbackName} size={44} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {player?.displayName ?? fallbackName}
          </Text>
        </View>
        {!isMe && status === 'ready' && (
          <Pressable onPress={report} hitSlop={10} accessibilityRole="button" accessibilityLabel="Пожаловаться">
            <Text style={styles.report}>Пожаловаться</Text>
          </Pressable>
        )}
      </View>

      {status === 'loading' && <ActivityIndicator style={styles.loader} />}
      {status === 'hidden' && <Text style={styles.empty}>Игрок скрыл свой профиль.</Text>}
      {status === 'error' && <Text style={styles.empty}>Не удалось загрузить профиль. Проверьте интернет.</Text>}

      {status === 'ready' && player && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{player.foundCount}</Text>
              <Text style={styles.tileLabel}>Мест найдено</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{player.distanceKm.toFixed(1)} км</Text>
              <Text style={styles.tileLabel}>Пройдено</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Страны · {player.countries.length}</Text>
          {player.countries.length === 0 && <Text style={styles.muted}>Пока нет данных.</Text>}
          {player.countries.map((country) => (
            <View key={country.code} style={styles.row}>
              <Image source={{ uri: flagUrl(country.code) }} style={styles.flag} resizeMode="contain" />
              <Text style={styles.name} numberOfLines={1}>
                {country.name}
              </Text>
              <Text style={styles.value}>{formatPercent(country.percent)}</Text>
            </View>
          ))}

          {player.cities.length > 0 && <Text style={styles.sectionTitle}>Города · {player.cities.length}</Text>}
          {player.cities.map((city) => (
            <View key={city.name} style={styles.row}>
              <View style={styles.cityBadge}>
                <Text style={styles.cityLetter}>{city.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {city.name}
              </Text>
              <Text style={styles.value}>
                {city.percent !== null ? formatPercent(city.percent) : formatKm2(city.exploredKm2)}
              </Text>
            </View>
          ))}

          <Text style={styles.sectionTitle}>Найденные места · {player.foundCount}</Text>
          {player.places.map((place, index) => (
            <View key={`${place.name}-${index}`} style={styles.row}>
              <View style={styles.badge}>
                <KindIcon kind={place.kind} size={18} color={c.badgeFg} />
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {place.name}
              </Text>
              <Text style={styles.date}>{formatDate(place.discoveredAt)}</Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
    avatar: { marginRight: 12 },
    report: { color: c.danger, fontWeight: '600', marginLeft: 8 },
    headerText: { flex: 1 },
    title: { fontSize: 24, fontWeight: '800', color: c.text },
    loader: { marginTop: 32 },
    empty: { marginTop: 24, paddingHorizontal: 16, textAlign: 'center', color: c.textMuted },
    content: { paddingBottom: 32 },
    tiles: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 4 },
    tile: { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 14 },
    tileValue: { fontSize: 22, fontWeight: '800', color: c.text },
    tileLabel: { marginTop: 2, color: c.textMuted },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 6 },
    muted: { paddingHorizontal: 16, color: c.textMuted },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
    flag: { width: 36, height: 26, borderRadius: 4, backgroundColor: c.surfaceAlt, marginRight: 12 },
    badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.badgeBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cityBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.cityBadgeBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cityLetter: { fontSize: 16, fontWeight: '800', color: c.link },
    name: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    value: { fontSize: 15, fontWeight: '700', color: c.text, marginLeft: 12 },
    date: { color: c.textMuted, marginLeft: 12 },
  });
