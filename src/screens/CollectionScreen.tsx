import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CountryStat } from '../lib/geo/countryStats';
import type { Stats } from '../hooks/useStats';

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#262626', marginBottom: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flex: 1, backgroundColor: '#f6f6f6', borderRadius: 14, padding: 14 },
  tileValue: { fontSize: 22, fontWeight: '800', color: '#262626' },
  tileLabel: { marginTop: 2, color: '#8e8e8e' },
  countriesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f6f6',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
  },
  pressed: { opacity: 0.6 },
  countriesText: { flex: 1 },
  countriesTitle: { fontSize: 16, fontWeight: '700', color: '#262626' },
  countriesSub: { marginTop: 2, color: '#8e8e8e' },
  chevron: { fontSize: 28, color: '#8e8e8e', marginLeft: 8 },
});
