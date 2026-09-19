import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KIND_LABEL } from '../lib/poi/greeting';
import { buildNearbyList, kindCounts, type NearbySort } from '../lib/poi/nearbyList';
import KindIcon from '../components/KindIcon';
import type { Poi, PoiKind } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface NearbyScreenProps {
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  origin: { lat: number; lng: number } | null;
  onSelect: (poi: Poi) => void;
}

const MAX_LISTED = 30;
const NEARBY_RADIUS_METERS = 1000;

const KIND_CHIP: Record<PoiKind, string> = {
  monument: 'Памятники',
  castle: 'Замки',
  ruins: 'Руины',
  viewpoint: 'Смотровые',
  attraction: 'Места',
  artwork: 'Арт-объекты',
};

const SORT_LABEL: Record<NearbySort, string> = { distance: 'Ближние', name: 'По названию' };

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

type ScreenStyles = ReturnType<typeof makeStyles>;

function Chip({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: ScreenStyles }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function NearbyScreen({ pois, discoveredIds, origin, onSelect }: NearbyScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const [kind, setKind] = useState<PoiKind | 'all'>('all');
  const [sort, setSort] = useState<NearbySort>('distance');
  const counts = useMemo(
    () => kindCounts(origin, pois, discoveredIds, NEARBY_RADIUS_METERS),
    [pois, discoveredIds, origin]
  );
  // A kind that has run out of places (they were found, or you walked away) falls back to "all".
  const activeKind = kind !== 'all' && counts.some((k) => k.kind === kind) ? kind : 'all';
  const total = counts.reduce((sum, k) => sum + k.count, 0);
  const nearby = useMemo(
    () =>
      buildNearbyList(origin, pois, discoveredIds, {
        kind: activeKind,
        sort,
        radiusMeters: NEARBY_RADIUS_METERS,
        limit: MAX_LISTED,
      }),
    [pois, discoveredIds, origin, activeKind, sort]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Рядом</Text>
      <View style={styles.subtitleRow}>
        <Text style={styles.subtitle}>Неоткрытые места до 1 км</Text>
        {total > 0 && (
          <Pressable
            onPress={() => setSort(sort === 'distance' ? 'name' : 'distance')}
            accessibilityRole="button"
            accessibilityLabel="Сменить сортировку"
            hitSlop={8}
          >
            <Text style={styles.sort}>{SORT_LABEL[sort]}</Text>
          </Pressable>
        )}
      </View>
      {counts.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          <Chip label={`Все ${total}`} active={activeKind === 'all'} onPress={() => setKind('all')} styles={styles} />
          {counts.map((k) => (
            <Chip
              key={k.kind}
              label={`${KIND_CHIP[k.kind]} ${k.count}`}
              active={activeKind === k.kind}
              onPress={() => setKind(k.kind)}
              styles={styles}
            />
          ))}
        </ScrollView>
      )}
      {nearby.length === 0 ? (
        <Text style={styles.empty}>
          {origin ? 'В радиусе километра всё открыто. Пройдитесь дальше!' : 'Ждём вашу позицию…'}
        </Text>
      ) : (
        <FlatList
          data={nearby}
          keyExtractor={(item) => item.poi.id}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onSelect(item.poi)}
              accessibilityRole="button"
              accessibilityLabel="Показать на карте"
            >
              <View style={styles.iconBadge}>
                <KindIcon kind={item.poi.kind} size={22} color={c.badgeFg} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.poi.name}
                </Text>
                <Text style={styles.distance}>
                  {formatDistance(item.meters)}, {KIND_LABEL[item.poi.kind].toLowerCase()}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '800', color: c.text },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 10 },
  subtitle: { color: c.textMuted, flexShrink: 1 },
  sort: { color: c.link, fontWeight: '600', marginLeft: 12 },
  chipsScroll: { flexGrow: 0, marginBottom: 6 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: c.surfaceAlt },
  chipActive: { backgroundColor: c.text },
  chipText: { color: c.text, fontWeight: '600' },
  chipTextActive: { color: c.bg },
  empty: { marginTop: 32, textAlign: 'center', color: c.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 20, color: c.badgeFg },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: c.text },
  distance: { marginTop: 2, color: c.textMuted },
  rowPressed: { opacity: 0.5 },
});
