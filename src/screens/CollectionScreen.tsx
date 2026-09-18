import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { evaluateAchievements, type Stats } from '../lib/stats/achievements';
import { KIND_ICON } from '../lib/poi/greeting';
import type { DiscoveredPlace } from '../lib/poi/types';

export interface CollectionScreenProps {
  stats: Stats;
  discovered: DiscoveredPlace[];
}

function formatArea(km2: number): string {
  return km2 < 1 ? `${Math.round(km2 * 100)} га` : `${km2.toFixed(2)} км²`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function CollectionScreen({ stats, discovered }: CollectionScreenProps) {
  const achievements = useMemo(() => evaluateAchievements(stats), [stats]);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const places = useMemo(
    () => [...discovered].sort((a, b) => b.discoveredAt - a.discoveredAt),
    [discovered]
  );

  const tiles = [
    { label: 'Открыто', value: formatArea(stats.areaKm2) },
    { label: 'Пройдено', value: `${stats.distanceKm.toFixed(1)} км` },
    { label: 'Дней подряд', value: String(stats.streakDays) },
    { label: 'Мест найдено', value: String(stats.discoveredCount) },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Коллекция</Text>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Text style={styles.tileValue}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>
        Значки {unlockedCount}/{achievements.length}
      </Text>
      <View style={styles.badges}>
        {achievements.map((a) => (
          <View key={a.id} style={styles.badgeCell}>
            <View style={[styles.badge, a.unlocked ? styles.badgeOn : styles.badgeOff]}>
              <Text style={[styles.badgeMark, !a.unlocked && styles.badgeMarkOff]}>
                {a.unlocked ? '★' : `${Math.round(a.progress * 100)}%`}
              </Text>
            </View>
            <Text style={[styles.badgeTitle, !a.unlocked && styles.muted]} numberOfLines={2}>
              {a.title}
            </Text>
            <Text style={styles.badgeDesc} numberOfLines={2}>
              {a.description}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Найденные места</Text>
      {places.length === 0 ? (
        <Text style={styles.empty}>Пока ничего. Подойдите к жёлтому «?» на карте.</Text>
      ) : (
        places.map((place) => (
          <View key={place.id} style={styles.placeRow}>
            <View style={styles.placeIcon}>
              <Text style={styles.placeIconText}>{KIND_ICON[place.kind]}</Text>
            </View>
            <Text style={styles.placeName} numberOfLines={1}>
              {place.name}
            </Text>
            <Text style={styles.placeDate}>{formatDate(place.discoveredAt)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#262626', marginBottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', backgroundColor: '#f6f6f6', borderRadius: 14, padding: 14 },
  tileValue: { fontSize: 22, fontWeight: '800', color: '#262626' },
  tileLabel: { marginTop: 2, color: '#8e8e8e' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#262626', marginTop: 24, marginBottom: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  badgeCell: { width: '33.33%', alignItems: 'center', paddingHorizontal: 4 },
  badge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: '#ffc83c' },
  badgeOff: { backgroundColor: '#efefef' },
  badgeMark: { fontSize: 26, color: '#3a2a00', fontWeight: '800' },
  badgeMarkOff: { fontSize: 14, color: '#8e8e8e' },
  badgeTitle: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#262626', textAlign: 'center' },
  muted: { color: '#8e8e8e' },
  badgeDesc: { marginTop: 2, fontSize: 10, color: '#8e8e8e', textAlign: 'center' },
  empty: { color: '#8e8e8e' },
  placeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff3cf',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  placeIconText: { fontSize: 18, color: '#8a5a00' },
  placeName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#262626' },
  placeDate: { color: '#8e8e8e', marginLeft: 8 },
});
