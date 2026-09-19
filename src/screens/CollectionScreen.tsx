import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CountryStat } from '../lib/geo/countryStats';
import type { Stats } from '../hooks/useStats';
import type { WeekSummary } from '../lib/stats/weekly';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface CollectionScreenProps {
  stats: Stats;
  week: WeekSummary;
  countries: CountryStat[];
  onOpenCountries: () => void;
  onOpenLeaderboard: () => void;
}

function delta(now: number, before: number, digits = 0): string {
  const diff = Math.round((now - before) * 10 ** digits) / 10 ** digits;
  if (diff === 0) return 'как раньше';
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(digits)} к прошлой`;
}

export default function CollectionScreen({
  stats,
  week,
  countries,
  onOpenCountries,
  onOpenLeaderboard,
}: CollectionScreenProps) {
  const styles = useStyles(makeStyles);
  const visitedCountries = useMemo(() => countries.filter((c) => c.percent > 0).length, [countries]);

  const tiles = [
    { label: 'Пройдено', value: `${stats.distanceKm.toFixed(1)} км` },
    { label: 'Мест найдено', value: String(stats.discoveredCount) },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Достижения</Text>

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
  title: { fontSize: 24, fontWeight: '800', color: c.text, marginBottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flex: 1, backgroundColor: c.surface, borderRadius: 14, padding: 14 },
  tileValue: { fontSize: 22, fontWeight: '800', color: c.text },
  tileLabel: { marginTop: 2, color: c.textMuted },
  week: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginTop: 10 },
  weekTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  weekRow: { flexDirection: 'row', marginTop: 10 },
  weekCell: { flex: 1 },
  weekValue: { fontSize: 22, fontWeight: '800', color: c.text },
  weekLabel: { color: c.text },
  weekNote: { marginTop: 2, fontSize: 12, color: c.textMuted },
  countriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  pressed: { opacity: 0.6 },
  countriesText: { flex: 1 },
  countriesTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  countriesSub: { marginTop: 2, color: c.textMuted },
  chevron: { fontSize: 28, color: c.textMuted, marginLeft: 8 },
});
