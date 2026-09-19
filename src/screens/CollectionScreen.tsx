import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CountryStat } from '../lib/geo/countryStats';
import type { Stats } from '../hooks/useStats';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface CollectionScreenProps {
  stats: Stats;
  countries: CountryStat[];
  onOpenCountries: () => void;
}

export default function CollectionScreen({
  stats,
  countries,
  onOpenCountries,
}: CollectionScreenProps) {
  const styles = useStyles(makeStyles);
  const visitedCountries = useMemo(() => countries.filter((c) => c.percent > 0).length, [countries]);

  const tiles = [
    { label: 'Пройдено', value: `${stats.distanceKm.toFixed(1)} км` },
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
