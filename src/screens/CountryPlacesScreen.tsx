import React, { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haversineDistanceMeters, type Coordinate } from '../lib/geo/distance';
import { formatKm2, type CityStat } from '../lib/geo/cityStats';
import { buildCountryCities, formatPopulation, loadWorldCities, type CityEntry } from '../lib/geo/countryRegions';
import { buildRegionStats, loadRegions, type RegionStat } from '../lib/geo/regionStats';
import type { TimedPoint } from '../lib/stats/coverage';
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
  // The country, or, with `regionCode`, the region (its `code` is then the region's key, not an ISO code).
  country: CountryStat;
  places: CountryPlaces | undefined;
  // The person's points inside the country; they decide the share of each region explored.
  points: TimedPoint[];
  cities: CityStat[];
  citiesPending: boolean;
  citiesFailed: boolean;
  origin: Coordinate | null;
  onBack: () => void;
  onSelectHidden: (poi: Poi) => void;
  onOpenFound: (place: DiscoveredPlace) => void;
  // Opens a region of the country (the region rows of a country screen).
  onOpenRegion?: (region: RegionStat) => void;
  // Set on a region's own screen: the key of the region, the ISO code of its country, and its Wikidata id for the emblem.
  regionCode?: string | null;
  countryCode?: string;
  emblemWikidata?: string | null;
}

type Row =
  | { kind: 'city'; city: CityStat }
  | { kind: 'region'; region: RegionStat }
  | { kind: 'unvisitedCity'; city: CityEntry }
  | { kind: 'found'; place: DiscoveredPlace; icon: PoiKind; date: string }
  | { kind: 'hidden'; poi: Poi; icon: PoiKind; where: string | null };

export default function CountryPlacesScreen({
  country,
  places,
  points,
  cities,
  citiesPending,
  citiesFailed,
  origin,
  onBack,
  onSelectHidden,
  onOpenFound,
  onOpenRegion,
  regionCode = null,
  countryCode,
  emblemWikidata = null,
}: CountryPlacesScreenProps) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  // The ISO code of the country: on a region's own screen `country` is the region.
  const ownerCode = countryCode ?? country.code;
  // The bundled cities and region borders (not yet visited ones included); null when they cannot be loaded.
  const worldCities = useMemo(() => loadWorldCities() ?? null, []);
  const regionsData = useMemo(() => loadRegions() ?? null, []);
  // Built once per country and language, not on every render.
  const listed = useMemo(
    () => (worldCities ? buildCountryCities(ownerCode, cities, worldCities, lang) : null),
    [worldCities, ownerCode, cities, lang]
  );
  const regionStats = useMemo(
    () =>
      !regionCode && listed?.mode === 'regions' && worldCities && regionsData
        ? buildRegionStats(ownerCode, points, places, worldCities, regionsData, lang)
        : null,
    [regionCode, listed, worldCities, regionsData, ownerCode, points, places, lang]
  );
  // The cities not visited yet: a region's own, or all of a country with a flat list.
  const unvisitedCities = useMemo<CityEntry[]>(() => {
    if (regionCode && listed?.mode === 'regions') {
      return (listed.regions.find((r) => r.code === regionCode)?.cities ?? []).filter((c) => !c.visited);
    }
    return listed?.mode === 'flat' ? listed.unvisited : [];
  }, [regionCode, listed]);
  // Emblems: the coat of arms of a city; for a region the coat of arms, else its flag.
  const crests = useCrests([...cities.map((city) => city.wikidata), ...unvisitedCities.map((city) => city.w)]);
  const regionCrests = useCrests([...(regionStats ?? []).map((r) => r.wikidata), emblemWikidata], ['P94', 'P41']);

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
    const regionRows: Row[] = (regionStats ?? []).map((region) => ({ kind: 'region', region }));
    const unvisitedRows: Row[] = unvisitedCities.map((city) => ({ kind: 'unvisitedCity', city }));
    return [
      { title: citiesPending ? t('country.citiesDetecting') : t('country.cities', { n: cityRows.length }), data: cityRows },
      {
        title: t('country.regions', { n: regionStats?.length ?? 0 }),
        data: regionRows,
      },
      { title: t('country.unvisitedCities', { n: unvisitedRows.length }), data: unvisitedRows },
      { title: t('country.foundPlaces', { n: found.length }), data: found },
      { title: t('country.hiddenPlaces', { n: hidden.length }), data: hidden },
    ].filter((section) => section.data.length > 0);
  }, [places, cities, citiesPending, origin, t, lang, regionStats, unvisitedCities]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        {regionCode && (
          <View style={styles.headerBadge}>
            <CityBadge
              name={country.name}
              crestUrl={emblemWikidata ? regionCrests[emblemWikidata] : null}
              size={44}
            />
          </View>
        )}
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
                ? `region:${row.region.code}`
                : row.kind === 'unvisitedCity'
                  ? `unvisited:${row.city.key}`
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
                onPress={() => onOpenRegion?.(item.region)}
                accessibilityRole="button"
              >
                <View style={styles.cityBadgeWrap}>
                  <CityBadge
                    name={item.region.name}
                    crestUrl={item.region.wikidata ? regionCrests[item.region.wikidata] : null}
                  />
                </View>
                <View style={styles.hiddenText}>
                  <Text style={[styles.name, styles.regionName, item.region.percent === 0 && styles.muted]} numberOfLines={1}>
                    {item.region.name}
                  </Text>
                  {item.region.total > 0 && (
                    <Text style={styles.where}>
                      {t('countries.found', { found: item.region.found, total: item.region.total })}
                    </Text>
                  )}
                </View>
                <Text style={[styles.cityPercent, item.region.percent === 0 && styles.muted]}>
                  {formatPercent(lang, item.region.percent)}
                </Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : item.kind === 'unvisitedCity' ? (
              <View style={styles.row}>
                <View style={styles.cityBadgeWrap}>
                  <CityBadge name={item.city.name} crestUrl={item.city.w ? crests[item.city.w] : null} />
                </View>
                <Text style={[styles.name, styles.faint]} numberOfLines={1}>
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
  chevron: { fontSize: 24, color: c.chevron, marginLeft: 8 },
  headerBadge: { marginRight: 12 },
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
  // `name` fills the row; inside a column it must only take its own height, or it sticks to the top.
  regionName: { flex: 0 },
  where: { marginTop: 2, color: c.textFaint },
  date: { color: c.textMuted, marginLeft: 8 },
});
