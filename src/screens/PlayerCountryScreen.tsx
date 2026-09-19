import React, { useMemo } from 'react';
import { Image, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import CityBadge from '../components/CityBadge';
import { useCrests } from '../hooks/useCrests';
import KindIcon from '../components/KindIcon';
import { COUNTRY_BY_CODE, flagUrl } from '../lib/geo/countries';
import { formatKm2 } from '../lib/geo/cityStats';
import { formatPercent } from '../lib/geo/countryStats';
import type { PlayerProfile } from '../lib/social/profiles';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface PlayerCountryScreenProps {
  player: PlayerProfile;
  countryCode: string;
  onBack: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

type Row =
  | { kind: 'city'; city: PlayerProfile['cities'][number] }
  | { kind: 'place'; place: PlayerProfile['places'][number] };

export default function PlayerCountryScreen({ player, countryCode, onBack }: PlayerCountryScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const country = player.countries.find((x) => x.code === countryCode);
  const name = country?.name ?? COUNTRY_BY_CODE[countryCode]?.name ?? countryCode;

  const crests = useCrests(player.cities.filter((city) => city.country === countryCode).map((city) => city.wikidata));

  const sections = useMemo(() => {
    const cities: Row[] = player.cities
      .filter((city) => city.country === countryCode)
      .map((city) => ({ kind: 'city', city }));
    const places: Row[] = player.places
      .filter((place) => place.country === countryCode)
      .map((place) => ({ kind: 'place', place }));
    return [
      { title: `Города · ${cities.length}`, data: cities },
      { title: `Найдено · ${places.length}`, data: places },
    ].filter((section) => section.data.length > 0);
  }, [player, countryCode]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Image source={{ uri: flagUrl(countryCode), cache: 'force-cache' }} style={styles.flag} resizeMode="contain" />
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.subtitle}>
            {player.displayName}
            {country ? ` · открыто ${formatPercent(country.percent)}` : ''}
          </Text>
        </View>
      </View>
      {sections.length === 0 ? (
        <Text style={styles.empty}>Для этой страны пока нет городов и мест.</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row, index) => (row.kind === 'city' ? `city:${row.city.name}` : `place:${row.place.name}:${index}`)}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) =>
            item.kind === 'city' ? (
              <View style={styles.row}>
                <View style={styles.cityBadgeWrap}>
                  <CityBadge name={item.city.name} crestUrl={item.city.wikidata ? crests[item.city.wikidata] : null} />
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {item.city.name}
                </Text>
                <Text style={styles.value}>
                  {item.city.percent !== null ? formatPercent(item.city.percent) : formatKm2(item.city.exploredKm2)}
                </Text>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={styles.badge}>
                  <KindIcon kind={item.place.kind} size={18} color={c.badgeFg} />
                </View>
                <View style={styles.placeText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.place.name}
                  </Text>
                  {item.place.city && <Text style={styles.sub}>{item.place.city}</Text>}
                </View>
                <Text style={styles.date}>{formatDate(item.place.discoveredAt)}</Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
    flag: { width: 40, height: 28, borderRadius: 4, backgroundColor: c.surfaceAlt, marginRight: 12 },
    headerText: { flex: 1 },
    title: { fontSize: 24, fontWeight: '800', color: c.text },
    subtitle: { marginTop: 2, color: c.textMuted },
    empty: { marginTop: 32, paddingHorizontal: 16, textAlign: 'center', color: c.textMuted },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
    badge: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.badgeBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cityBadgeWrap: { marginRight: 12 },
    cityBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.cityBadgeBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    cityLetter: { fontSize: 17, fontWeight: '800', color: c.link },
    placeText: { flex: 1 },
    name: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    sub: { marginTop: 2, color: c.textFaint },
    value: { fontSize: 15, fontWeight: '700', color: c.text, marginLeft: 12 },
    date: { color: c.textMuted, marginLeft: 12 },
  });
