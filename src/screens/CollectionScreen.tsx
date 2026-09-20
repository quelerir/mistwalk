import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CountryStat } from '../lib/geo/countryStats';
import type { Stats } from '../hooks/useStats';
import type { WeekSummary } from '../lib/stats/weekly';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { CARD_SHADOW, FONT } from '../theme/fonts';

export interface CollectionScreenProps {
  stats: Stats;
  week: WeekSummary;
  // Kilometres for each of the last 7 days, oldest first.
  daily: number[];
  countries: CountryStat[];
  onOpenCountries: () => void;
  onOpenLeaderboard: () => void;
  onOpenFollows: (tab: 'followers' | 'following') => void;
  followCounts: { followers: number; following: number } | null;
}

function delta(now: number, before: number, digits = 0): string {
  const diff = Math.round((now - before) * 10 ** digits) / 10 ** digits;
  if (diff === 0) return 'как раньше';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(digits)} к прошлой`;
}

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const BAR_MAX_HEIGHT = 56;

export default function CollectionScreen({
  stats,
  week,
  daily,
  countries,
  onOpenCountries,
  onOpenLeaderboard,
  onOpenFollows,
  followCounts,
}: CollectionScreenProps) {
  const styles = useStyles(makeStyles);
  const dayLabels = useMemo(() => {
    const today = new Date();
    return daily.map((_, i) => WEEKDAYS[new Date(today.getFullYear(), today.getMonth(), today.getDate() - (daily.length - 1 - i)).getDay()]);
  }, [daily]);
  const maxKm = Math.max(...daily, 0.001);
  const visitedCountries = useMemo(() => countries.filter((c) => c.percent > 0).length, [countries]);

  const tiles = [
    { label: 'Пройдено', value: `${stats.distanceKm.toFixed(1)} км` },
    { label: 'Мест найдено', value: String(stats.discoveredCount) },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Коллекция</Text>

      <View style={styles.followRow}>
        <Pressable onPress={() => onOpenFollows('followers')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Подписчики">
          <Text style={styles.followValue}>{followCounts ? followCounts.followers : '–'}</Text>
          <Text style={styles.followLabel}>подписчиков</Text>
        </Pressable>
        <Pressable onPress={() => onOpenFollows('following')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Подписки">
          <Text style={styles.followValue}>{followCounts ? followCounts.following : '–'}</Text>
          <Text style={styles.followLabel}>подписок</Text>
        </Pressable>
      </View>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Text style={styles.tileValue}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.week}>
        <Text style={styles.weekTitle}>Неделя</Text>
        <View style={styles.weekRow}>
          {[
            { label: 'км', value: week.km.toFixed(1), note: delta(week.km, week.prev.km, 1) },
            { label: 'новых мест', value: String(week.places), note: delta(week.places, week.prev.places) },
            { label: 'дней из 7', value: String(week.days), note: delta(week.days, week.prev.days) },
          ].map((item) => (
            <View key={item.label} style={styles.weekCell}>
              <Text style={styles.weekValue}>{item.value}</Text>
              <Text style={styles.weekLabel}>{item.label}</Text>
              <Text style={styles.weekNote}>{item.note}</Text>
            </View>
          ))}
        </View>
        <View style={styles.bars}>
          {daily.map((km, i) => (
            <View key={i} style={styles.barCell}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: Math.max(6, (km / maxKm) * BAR_MAX_HEIGHT) },
                    km > 0 && styles.barOn,
                  ]}
                />
              </View>
              <Text style={styles.barLabel}>{dayLabels[i]}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.countriesButton, pressed && styles.pressed]}
        onPress={onOpenCountries}
        accessibilityRole="button"
      >
        <View style={styles.countriesText}>
          <Text style={styles.countriesTitle}>Страны</Text>
          <Text style={styles.countriesSub}>
            Открыто {visitedCountries} из {countries.length}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.countriesButton, pressed && styles.pressed]}
        onPress={onOpenLeaderboard}
        accessibilityRole="button"
      >
        <View style={styles.countriesText}>
          <Text style={styles.countriesTitle}>Рейтинг игроков</Text>
          <Text style={styles.countriesSub}>Сравните себя с другими</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 34, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text, marginBottom: 8 },
  followRow: { flexDirection: 'row', gap: 28, marginBottom: 14 },
  followValue: { fontSize: 22, fontFamily: FONT.display, letterSpacing: -0.4, color: c.text },
  followLabel: { fontSize: 13, color: c.textMuted, marginTop: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flex: 1, backgroundColor: c.surface, borderRadius: 24, padding: 16, shadowColor: c.shadow, ...CARD_SHADOW },
  tileValue: { fontSize: 32, fontFamily: FONT.display, letterSpacing: -0.6, color: c.text },
  tileLabel: { marginTop: 2, color: c.textMuted },
  week: { backgroundColor: c.surface, borderRadius: 24, padding: 16, marginTop: 12, shadowColor: c.shadow, ...CARD_SHADOW },
  weekTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  weekRow: { flexDirection: 'row', marginTop: 10 },
  weekCell: { flex: 1 },
  weekValue: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.5, color: c.text },
  weekLabel: { color: c.text },
  bars: { flexDirection: 'row', gap: 8, marginTop: 16 },
  barCell: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: BAR_MAX_HEIGHT, justifyContent: 'flex-end', alignSelf: 'stretch' },
  bar: { borderRadius: 6, backgroundColor: c.surfaceAlt },
  barOn: { backgroundColor: c.accent },
  barLabel: { fontSize: 11, color: c.textMuted },
  weekNote: { marginTop: 2, fontSize: 12, color: c.textMuted },
  countriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 16,
    marginTop: 12,
    shadowColor: c.shadow,
    ...CARD_SHADOW,
  },
  pressed: { opacity: 0.6 },
  countriesText: { flex: 1 },
  countriesTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  countriesSub: { marginTop: 2, color: c.textMuted },
  chevron: { fontSize: 28, color: c.textMuted, marginLeft: 8 },
});
