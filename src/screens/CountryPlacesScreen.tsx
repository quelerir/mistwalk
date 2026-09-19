import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters, type Coordinate } from '../lib/geo/distance';
import { formatPercent, type CountryPlaces, type CountryStat } from '../lib/geo/countryStats';
import { bearingLabel } from '../lib/poi/discovery';
import { KIND_ICON } from '../lib/poi/greeting';
import type { Poi } from '../lib/poi/types';

export interface CountryPlacesScreenProps {
  country: CountryStat;
  places: CountryPlaces | undefined;
  origin: Coordinate | null;
  onBack: () => void;
  onSelectHidden: (poi: Poi) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

type Row =
  | { kind: 'found'; id: string; name: string; icon: string; date: string }
  | { kind: 'hidden'; poi: Poi; icon: string; where: string | null };

export default function CountryPlacesScreen({
  country,
  places,
  origin,
  onBack,
  onSelectHidden,
}: CountryPlacesScreenProps) {
  const sections = useMemo(() => {
    const found: Row[] = (places?.discovered ?? []).map((p) => ({
      kind: 'found',
      id: p.id,
      name: p.name,
      icon: KIND_ICON[p.kind],
      date: formatDate(p.discoveredAt),
    }));
    const hidden: Row[] = (places?.hidden ?? [])
      .map((poi) => ({ poi, meters: origin ? haversineDistanceMeters(origin, poi) : Infinity }))
      .sort((a, b) => a.meters - b.meters)
      .map(({ poi, meters }) => ({
        kind: 'hidden',
        poi,
        icon: KIND_ICON[poi.kind],
        where: origin ? `${formatDistance(meters)}, ${bearingLabel(origin, poi)}` : null,
      }));
    return [
      { title: `Найдено · ${found.length}`, data: found },
      { title: `Не посещено · ${hidden.length}`, data: hidden },
    ].filter((section) => section.data.length > 0);
  }, [places, origin]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {country.name}
          </Text>
          <Text style={styles.subtitle}>Открыто {formatPercent(country.percent)}</Text>
        </View>
      </View>
      {sections.length === 0 ? (
        <Text style={styles.empty}>Здесь пока нет известных мест. Пройдитесь по карте.</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) => (row.kind === 'found' ? row.id : row.poi.id)}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) =>
            item.kind === 'found' ? (
              <View style={styles.row}>
                <View style={styles.badge}>
                  <Text style={styles.icon}>{item.icon}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.date}>{item.date}</Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => onSelectHidden(item.poi)}
                accessibilityRole="button"
                accessibilityLabel="Показать на карте"
              >
                <View style={[styles.badge, styles.badgeHidden]}>
                  <Text style={[styles.icon, styles.iconHidden]}>{item.icon}</Text>
                </View>
                <View style={styles.hiddenText}>
                  <Text style={[styles.name, styles.muted]}>Тайное место</Text>
                  {item.where && <Text style={styles.where}>{item.where}</Text>}
                </View>
              </Pressable>
            )
          }
        />
      )}
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
  empty: { marginTop: 32, paddingHorizontal: 16, textAlign: 'center', color: '#8e8e8e' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#262626', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  pressed: { opacity: 0.5 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff3cf',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  badgeHidden: { backgroundColor: '#f3f3f3' },
  icon: { fontSize: 18, color: '#8a5a00' },
  iconHidden: { color: '#a8a8a8' },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: '#262626' },
  muted: { color: '#8e8e8e', fontWeight: '500' },
  hiddenText: { flex: 1 },
  where: { marginTop: 2, color: '#a8a8a8' },
  date: { color: '#8e8e8e', marginLeft: 8 },
});
