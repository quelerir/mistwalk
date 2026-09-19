import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { flagUrl } from '../lib/geo/countries';
import { formatPercent, type CountryStat } from '../lib/geo/countryStats';

export interface CountriesScreenProps {
  countries: CountryStat[];
  pending: boolean;
  failed: boolean;
  onBack: () => void;
}

export default function CountriesScreen({ countries, pending, failed, onBack }: CountriesScreenProps) {
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
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image source={{ uri: flagUrl(item.code) }} style={styles.flag} resizeMode="contain" />
            <Text style={[styles.name, item.percent === 0 && styles.muted]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.percent, item.percent === 0 && styles.muted]}>
              {formatPercent(item.percent)}
            </Text>
          </View>
        )}
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
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: '#262626' },
  percent: { fontSize: 15, fontWeight: '700', color: '#262626', marginLeft: 12 },
  muted: { color: '#a8a8a8', fontWeight: '500' },
});
