import React, { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haversineDistanceMeters, type Coordinate } from '../lib/geo/distance';
import { formatKm2, type CityStat } from '../lib/geo/cityStats';
import {
  buildCountryCities,
  formatPopulation,
  loadWorldCities,
  type CityEntry,
  type RegionEntry,
} from '../lib/geo/countryRegions';
import { formatPercent, type CountryPlaces, type CountryStat } from '../lib/geo/countryStats';
import { kindLabel } from '../lib/poi/greeting';
import CityBadge from '../components/CityBadge';
import { useCrests } from '../hooks/useCrests';
import KindIcon from '../components/KindIcon';
import type { PoiKind } from '../lib/poi/types';
import type { DiscoveredPlace, Poi } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { KIND_COLOR, kindTint } from '../lib/poi/kindColors';
import { useI18n } from '../i18n/I18nProvider';
import { formatDate, formatDistance } from '../i18n/format';

export interface CountryPlacesScreenProps {
  country: CountryStat;
  places: CountryPlaces | undefined;
  cities: CityStat[];
  citiesPending: boolean;
  citiesFailed: boolean;
  origin: Coordinate | null;
  onBack: () => void;
  onSelectHidden: (poi: Poi) => void;
  onOpenFound: (place: DiscoveredPlace) => void;
}

type Row =
  | { kind: 'city'; city: CityStat }
  | { kind: 'region'; region: RegionEntry; expanded: boolean }
  | { kind: 'regionCity'; city: CityEntry; region: string }
  | { kind: 'found'; place: DiscoveredPlace; icon: PoiKind; date: string }
  | { kind: 'hidden'; poi: Poi; icon: PoiKind; where: string | null };

export default function CountryPlacesScreen({
  country,
  places,
  cities,
  citiesPending,
  citiesFailed,
  origin,
  onBack,
  onSelectHidden,
  onOpenFound,
}: CountryPlacesScreenProps) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const crests = useCrests(cities.map((city) => city.wikidata));
  // The bundled list of cities (not yet visited ones included); null when it cannot be loaded.
  const worldCities = useMemo(loadWorldCities, []);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const sections = useMemo(() => {
    const found: Row[] = (places?.discovered ?? []).map((p) => ({
      kind: 'found',
      place: p,
      icon: p.kind,
      date: formatDate(lang, p.discoveredAt),
    }));
    const hidden: Row[] = (places?.hidden ?? [])
      .map((poi) => ({ poi, meters: origin ? haversineDistanceMeters(origin, poi) : Infinity }))
      .sort((a, b) => a.meters - b.meters)
      .map(({ poi, meters }) => ({
        kind: 'hidden',
        poi,
        icon: poi.kind,
        where: origin ? `${formatDistance(t, meters)}, ${kindLabel(t, poi.kind).toLowerCase()}` : kindLabel(t, poi.kind),
      }));
    const cityRows: Row[] = cities.map((city) => ({ kind: 'city', city }));
    const listed = worldCities ? buildCountryCities(country.code, cities, worldCities, lang) : null;
    const regionRows: Row[] = [];
    const unvisitedRows: Row[] = [];
    if (listed?.mode === 'regions') {
      for (const region of listed.regions) {
        const key = region.code ?? 'other';
        const open = expanded.has(key);
        regionRows.push({ kind: 'region', region, expanded: open });
        if (open) for (const city of region.cities) regionRows.push({ kind: 'regionCity', city, region: key });
      }
    } else if (listed?.mode === 'flat') {
      for (const city of listed.unvisited) unvisitedRows.push({ kind: 'regionCity', city, region: 'flat' });
    }
    return [
      { title: citiesPending ? t('country.citiesDetecting') : t('country.cities', { n: cityRows.length }), data: cityRows },
      {
        title: t('country.regions', { n: listed?.mode === 'regions' ? listed.regions.length : 0 }),
        data: regionRows,
      },
      { title: t('country.unvisitedCities', { n: unvisitedRows.length }), data: unvisitedRows },
      { title: t('country.foundPlaces', { n: found.length }), data: found },
      { title: t('country.hiddenPlaces', { n: hidden.length }), data: hidden },
    ].filter((section) => section.data.length > 0);
  }, [places, cities, citiesPending, origin, t, lang, worldCities, country.code, expanded]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {country.name}
          </Text>
          <Text style={styles.subtitle}>{t('country.opened', { percent: formatPercent(lang, country.percent) })}</Text>
        </View>
      </View>
      {sections.length === 0 ? (
        <Text style={styles.empty}>
          {citiesFailed ? t('country.citiesFailed') : t('country.noPlaces')}
        </Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row) =>
            row.kind === 'city'
              ? `city:${row.city.name}`
              : row.kind === 'region'
                ? `region:${row.region.code ?? 'other'}`
                : row.kind === 'regionCity'
                  ? `regionCity:${row.region}:${row.city.key}`
                  : row.kind === 'found'
                    ? row.place.id
                    : row.poi.id
          }
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) =>
            item.kind === 'region' ? (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    const key = item.region.code ?? 'other';
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                accessibilityRole="button"
                accessibilityState={{ expanded: item.expanded }}
              >
                <Text style={styles.chevron}>{item.expanded ? '▾' : '▸'}</Text>
                <View style={styles.hiddenText}>
                  <Text style={[styles.name, item.region.visitedCount === 0 && styles.muted]} numberOfLines={1}>
                    {item.region.name}
                  </Text>
                  <Text style={styles.where}>
                    {t('country.regionProgress', { done: item.region.visitedCount, total: item.region.cities.length })}
                  </Text>
                </View>
              </Pressable>
            ) : item.kind === 'regionCity' ? (
              <View style={[styles.row, item.region !== 'flat' && styles.regionCityRow]}>
                <Text testID={item.city.visited ? `city-visited-${item.city.key}` : undefined} style={styles.check}>
                  {item.city.visited ? '✓' : ''}
                </Text>
                <Text style={[styles.name, !item.city.visited && styles.faint]} numberOfLines={1}>
                  {item.city.name}
                </Text>
                <Text style={styles.population}>{formatPopulation(lang, item.city.population)}</Text>
              </View>
            ) : item.kind === 'city' ? (
              <View style={styles.row}>
                <View style={styles.cityBadgeWrap}>
                  <CityBadge name={item.city.name} crestUrl={item.city.wikidata ? crests[item.city.wikidata] : null} />
                </View>
                <View style={styles.hiddenText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.city.name}
                  </Text>
                  <Text style={styles.where}>
                    {item.city.totalKm2
                      ? t('country.areaOf', { explored: formatKm2(t, lang, item.city.exploredKm2), total: formatKm2(t, lang, item.city.totalKm2) })
                      : formatKm2(t, lang, item.city.exploredKm2)}
                    {item.city.found > 0 ? t('country.cityFound', { n: item.city.found }) : ''}
                  </Text>
                </View>
                {item.city.percent !== null && <Text style={styles.cityPercent}>{formatPercent(lang, item.city.percent)}</Text>}
              </View>
            ) : item.kind === 'found' ? (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => onOpenFound(item.place)}
                accessibilityRole="button"
              >
                <View style={[styles.badge, { backgroundColor: kindTint(item.icon) }]}>
                  <KindIcon kind={item.icon} size={20} color={KIND_COLOR[item.icon]} />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.place.name}
                </Text>
                <Text style={styles.date}>{item.date}</Text>
              </Pressable>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                onPress={() => onSelectHidden(item.poi)}
                accessibilityRole="button"
                accessibilityLabel={t('common.showOnMap')}
              >
                <View style={[styles.badge, styles.badgeHidden]}>
                  <KindIcon kind={item.icon} size={20} color={c.textFaint} />
                </View>
                <View style={styles.hiddenText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.poi.name}
                  </Text>
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

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text },
  subtitle: { marginTop: 2, color: c.textMuted },
  empty: { marginTop: 32, paddingHorizontal: 16, textAlign: 'center', color: c.textMuted },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  pressed: { opacity: 0.5 },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cityBadgeWrap: { marginRight: 12 },
  cityBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.cityBadgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chevron: { width: 28, fontSize: 18, color: c.textMuted },
  regionCityRow: { paddingLeft: 44 },
  check: { width: 24, fontSize: 15, fontWeight: '800', color: c.accent },
  faint: { color: c.textFaint, fontWeight: '500' },
  population: { color: c.textMuted, marginLeft: 8 },
  cityPercent: { fontSize: 15, fontWeight: '700', color: c.text, marginLeft: 8 },
  cityLetter: { fontSize: 17, fontWeight: '800', color: c.link },
  badgeHidden: { backgroundColor: c.badgeHiddenBg },
  icon: { fontSize: 18, color: c.badgeFg },
  iconHidden: { color: c.textFaint },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
  muted: { color: c.textMuted, fontWeight: '500' },
  hiddenText: { flex: 1 },
  where: { marginTop: 2, color: c.textFaint },
  date: { color: c.textMuted, marginLeft: 8 },
});
