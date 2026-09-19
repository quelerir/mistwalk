import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { flagUrl } from '../lib/geo/countries';
import { formatPercent, type CountryPlaces, type CountryStat } from '../lib/geo/countryStats';

export interface CountriesScreenProps {
  countries: CountryStat[];
  pending: boolean;
  failed: boolean;
  placesByCountry: ReadonlyMap<string, CountryPlaces>;
  onBack: () => void;
  onOpenCountry: (country: CountryStat) => void;
}

export default function CountriesScreen({
  countries,
  pending,
  failed,
  placesByCountry,
  onBack,
  onOpenCountry,
}: CountriesScreenProps) {
  const visited = countries.filter((c) => c.percent > 0).length;
  const status = pending
    ? 'Определяем страны…'
    : failed
      ? 'Не удалось определить страну. Проверьте интернет.'
      : `Открыто стран: ${visited} из ${countries.length}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>Страны</Text>
          <Text style={styles.subtitle}>{status}</Text>
        </View>
      </View>
      <FlatList
        data={countries}
        keyExtractor={(item) => item.code}
        initialNumToRender={20}
        renderItem={({ item }) => {
          const places = placesByCountry.get(item.code);
          const found = places?.discovered.length ?? 0;
          const total = found + (places?.hidden.length ?? 0);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => onOpenCountry(item)}
              accessibilityRole="button"
            >
              <Image source={{ uri: flagUrl(item.code) }} style={styles.flag} resizeMode="contain" />
              <View style={styles.nameWrap}>
                <Text style={[styles.name, item.percent === 0 && styles.muted]} numberOfLines={1}>
                  {item.name}
                </Text>
                {total > 0 && <Text style={styles.places}>Найдено мест: {found} из {total}</Text>}
              </View>
              <Text style={[styles.percent, item.percent === 0 && styles.muted]}>
                {formatPercent(item.percent)}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { fontSize: 36, lineHeight: 36, color: '#262626', marginRight: 12, marginTop: -4 },
  headerText: { flex: 1 },
  title: { fontSize: 24, fontWeight: '800', color: '#262626' },
  subtitle: { marginTop: 2, color: '#8e8e8e' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#dbdbdb',
  },
  flag: { width: 36, height: 26, borderRadius: 4, backgroundColor: '#efefef', marginRight: 14 },
  nameWrap: { flex: 1 },
  places: { marginTop: 2, color: '#8e8e8e', fontSize: 12 },
  pressed: { opacity: 0.5 },
  chevron: { fontSize: 24, color: '#c7c7c7', marginLeft: 8 },
  name: { fontSize: 16, fontWeight: '600', color: '#262626' },
  percent: { fontSize: 15, fontWeight: '700', color: '#262626', marginLeft: 12 },
  muted: { color: '#a8a8a8', fontWeight: '500' },
});
