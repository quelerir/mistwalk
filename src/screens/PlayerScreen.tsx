import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import KindIcon from '../components/KindIcon';
import { flagUrl } from '../lib/geo/countries';
import { formatPercent } from '../lib/geo/countryStats';
import { formatKm2 } from '../lib/geo/cityStats';
import SvgIcon from '../components/icons/SvgIcon';
import { KIND_COLOR, kindTint } from '../lib/poi/kindColors';
import { avatarUrl, fetchPlayerProfile, reportPlayer, type PlayerProfile, type ReportReason } from '../lib/social/profiles';
import FollowButton from '../components/FollowButton';
import { fetchFollowState, followPlayer, unfollowPlayer, type FollowState } from '../lib/social/follows';
import PlayerCountryScreen from './PlayerCountryScreen';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { CARD_SHADOW, FONT } from '../theme/fonts';

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
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'hidden' | 'error'>('loading');
  const [follow, setFollow] = useState<FollowState | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setFollow(null);
    fetchFollowState(client, playerId)
      .then((state) => {
        if (!cancelled) setFollow(state);
      })
      .catch((err) => console.warn('[player] follow state failed', err));
    return () => {
      cancelled = true;
    };
  }, [client, playerId]);

  async function toggleFollow() {
    if (!follow || followBusy) return;
    setFollowBusy(true);
    try {
      if (follow.following) await unfollowPlayer(client, playerId);
      else await followPlayer(client, playerId);
      setFollow({
        ...follow,
        following: !follow.following,
        followers: Math.max(0, follow.followers + (follow.following ? -1 : 1)),
      });
    } catch (err) {
      console.warn('[player] follow failed', err);
      Alert.alert('Не удалось', 'Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setFollowBusy(false);
    }
  }

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

  if (player && countryCode) {
    return <PlayerCountryScreen player={player} countryCode={countryCode} onBack={() => setCountryCode(null)} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.roundButton} accessibilityRole="button" accessibilityLabel="Назад">
          <SvgIcon name="back" size={22} color={c.text} />
        </Pressable>
        {!isMe && status === 'ready' && (
          <Pressable onPress={report} hitSlop={8} style={styles.roundButton} accessibilityRole="button" accessibilityLabel="Пожаловаться">
            <SvgIcon name="flag" size={20} color={c.textMuted} />
          </Pressable>
        )}
      </View>
      <View style={styles.identity}>
        <View style={styles.avatarRing}>
          <Avatar uri={avatarUrl(client, player?.avatarPath ?? null)} name={player?.displayName ?? fallbackName} size={92} />
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {player?.displayName ?? fallbackName}
        </Text>
        {follow && (
          <Text style={styles.counts}>
            Подписчики {follow.followers} · Подписки {follow.followingCount}
          </Text>
        )}
        {!isMe && status === 'ready' && follow && (
          <View style={styles.followWrap}>
            <FollowButton iFollow={follow.following} followsMe={follow.followsMe} busy={followBusy} onPress={() => void toggleFollow()} />
          </View>
        )}
      </View>

      {status === 'loading' && <ActivityIndicator style={styles.loader} />}
      {status === 'hidden' && <Text style={styles.empty}>Игрок скрыл свой профиль.</Text>}
      {status === 'error' && <Text style={styles.empty}>Не удалось загрузить профиль. Проверьте интернет.</Text>}

      {status === 'ready' && player && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{player.distanceKm.toFixed(1)}</Text>
              <Text style={styles.tileLabel}>км</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{player.foundCount}</Text>
              <Text style={styles.tileLabel}>мест</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileValue}>{player.countries.length}</Text>
              <Text style={styles.tileLabel}>стран</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>СТРАНЫ</Text>
          {player.countries.length === 0 && <Text style={styles.muted}>Пока нет данных.</Text>}
          {player.countries.map((country) => (
            <Pressable
              key={country.code}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => setCountryCode(country.code)}
              accessibilityRole="button"
            >
              <Image source={{ uri: flagUrl(country.code), cache: 'force-cache' }} style={styles.flag} resizeMode="contain" />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {country.name}
                  </Text>
                  <Text style={styles.value}>{formatPercent(country.percent)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.min(100, Math.max(4, country.percent))}%` }]} />
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}

          {player.cities.length > 0 && <Text style={styles.sectionTitle}>ГОРОДА</Text>}
          {player.cities.map((city) => (
            <View key={city.name} style={styles.row}>
              <View style={styles.cityBadge}>
                <Text style={styles.cityLetter}>{city.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {city.name}
                  </Text>
                  <Text style={styles.value}>
                    {city.percent !== null ? formatPercent(city.percent) : formatKm2(city.exploredKm2)}
                  </Text>
                </View>
                {city.percent !== null && (
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.min(100, Math.max(4, city.percent))}%` }]} />
                  </View>
                )}
              </View>
            </View>
          ))}

          <Text style={styles.sectionTitle}>НАЙДЕННЫЕ МЕСТА</Text>
          {player.places.map((place, index) => (
            <View key={`${place.name}-${index}`} style={styles.row}>
              <View style={[styles.badge, { backgroundColor: kindTint(place.kind) }]}>
                <KindIcon kind={place.kind} size={18} color={KIND_COLOR[place.kind]} />
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
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
    roundButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
    identity: { alignItems: 'center', paddingTop: 4, paddingBottom: 16 },
    avatarRing: { padding: 3, borderRadius: 50, borderWidth: 2, borderColor: c.accent },
    pressed: { opacity: 0.5 },
    chevron: { fontSize: 24, color: c.chevron, marginLeft: 8 },
    title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.6, color: c.text, marginTop: 12, paddingHorizontal: 24 },
    counts: { marginTop: 6, color: c.textMuted, fontSize: 14 },
    followWrap: { marginTop: 14 },
    loader: { marginTop: 32 },
    empty: { marginTop: 24, paddingHorizontal: 16, textAlign: 'center', color: c.textMuted },
    content: { paddingBottom: 32 },
    tiles: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 4 },
    tile: { flex: 1, backgroundColor: c.surface, borderRadius: 24, padding: 14, shadowColor: c.shadow, ...CARD_SHADOW },
    tileValue: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.5, color: c.text },
    tileLabel: { marginTop: 2, color: c.textMuted },
    sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: c.textMuted, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 6 },
    muted: { paddingHorizontal: 16, color: c.textMuted },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
    rowBody: { flex: 1 },
    rowTop: { flexDirection: 'row', alignItems: 'center' },
    barTrack: { height: 5, borderRadius: 3, backgroundColor: c.surfaceAlt, marginTop: 8, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },
    flag: { width: 40, height: 28, borderRadius: 6, backgroundColor: c.surfaceAlt, marginRight: 12 },
    badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.badgeBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cityBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.cityBadgeBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cityLetter: { fontSize: 16, fontFamily: FONT.display, color: c.accent },
    name: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    value: { fontSize: 15, fontWeight: '700', color: c.text, marginLeft: 12 },
    date: { color: c.textMuted, marginLeft: 12 },
  });
