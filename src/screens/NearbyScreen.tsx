import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { KIND_LABEL } from '../lib/poi/greeting';
import { buildNearbyList, kindCounts, type NearbySort } from '../lib/poi/nearbyList';
import KindIcon from '../components/KindIcon';
import SvgIcon from '../components/icons/SvgIcon';
import type { Poi, PoiKind } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import type { IconName } from '../components/icons/svgIcons';
import { FONT } from '../theme/fonts';
import { KIND_COLOR, kindTint } from '../lib/poi/kindColors';

export interface NearbyScreenProps {
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  origin: { lat: number; lng: number } | null;
  onSelect: (poi: Poi) => void;
}

const MAX_LISTED = 30;
const NEARBY_RADIUS_METERS = 1000;

const SORT_OPTIONS: Array<{ sort: NearbySort; label: string; icon: IconName }> = [
  { sort: 'distance', label: 'Сначала ближние', icon: 'sort-distance' },
  { sort: 'distance-desc', label: 'Сначала дальние', icon: 'sort-distance-desc' },
  { sort: 'name', label: 'По названию А — Я', icon: 'sort-name' },
  { sort: 'name-desc', label: 'По названию Я — А', icon: 'sort-name-desc' },
];
const SORT_BY_KEY = Object.fromEntries(SORT_OPTIONS.map((o) => [o.sort, o])) as Record<NearbySort, (typeof SORT_OPTIONS)[number]>;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

type ScreenStyles = ReturnType<typeof makeStyles>;

interface FilterButtonProps {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  styles: ScreenStyles;
  children: (color: string) => React.ReactNode;
}

// A round icon with the number of places in the corner; the chosen one is filled.
function FilterButton({ label, count, active, onPress, styles, children }: FilterButtonProps) {
  const { colors: c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.filter, active && styles.filterActive]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityState={{ selected: active }}
    >
      {children(active ? c.bg : c.text)}
      <View style={styles.count}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    </Pressable>
  );
}

export default function NearbyScreen({ pois, discoveredIds, origin, onSelect }: NearbyScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const [kind, setKind] = useState<PoiKind | 'all'>('all');
  const [sort, setSort] = useState<NearbySort>('distance');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  // Where the sort menu hangs: just under the row that holds its button.
  const [menuTop, setMenuTop] = useState(0);
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
      <View
        style={styles.subtitleRow}
        onLayout={(e: LayoutChangeEvent) => setMenuTop(e.nativeEvent.layout.y + e.nativeEvent.layout.height + 4)}
      >
        <Text style={styles.subtitle}>Неоткрытые места до 1 км</Text>
        {total > 0 && (
          <Pressable
            onPress={() => setSortMenuOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={`Сортировка: ${SORT_BY_KEY[sort].label}`}
            accessibilityState={{ expanded: sortMenuOpen }}
            hitSlop={10}
          >
            <SvgIcon name={SORT_BY_KEY[sort].icon} size={24} color={c.text} />
          </Pressable>
        )}
      </View>
      {counts.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersScroll}
          contentContainerStyle={styles.filters}
        >
          <FilterButton label="Все" count={total} active={activeKind === 'all'} onPress={() => setKind('all')} styles={styles}>
            {(color) => <SvgIcon name="grid" size={22} color={color} />}
          </FilterButton>
          {counts.map((k) => (
            <FilterButton
              key={k.kind}
              label={KIND_LABEL[k.kind]}
              count={k.count}
              active={activeKind === k.kind}
              onPress={() => setKind(k.kind)}
              styles={styles}
            >
              {(color) => <KindIcon kind={k.kind} size={22} color={color} />}
            </FilterButton>
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
              <View style={[styles.iconBadge, { backgroundColor: kindTint(item.poi.kind) }]}>
                <KindIcon kind={item.poi.kind} size={22} color={KIND_COLOR[item.poi.kind]} />
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
      {sortMenuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSortMenuOpen(false)} accessibilityLabel="Закрыть" />
          <View style={[styles.sortMenu, { top: menuTop }]} accessibilityRole="menu">
            {SORT_OPTIONS.map((option) => {
              const selected = option.sort === sort;
              return (
                <Pressable
                  key={option.sort}
                  style={({ pressed }) => [styles.sortRow, pressed && styles.rowPressed]}
                  onPress={() => {
                    setSort(option.sort);
                    setSortMenuOpen(false);
                  }}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                >
                  <SvgIcon name={option.icon} size={22} color={selected ? c.accent : c.textMuted} />
                  <Text style={[styles.sortLabel, selected && styles.sortLabelSelected]}>{option.label}</Text>
                  {selected && <SvgIcon name="check" size={20} color={c.accent} />}
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 34, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 10 },
  subtitle: { color: c.textMuted, flexShrink: 1 },
  filtersScroll: { flexGrow: 0, marginBottom: 8, overflow: 'visible' },
  filters: { gap: 12, paddingTop: 8, paddingRight: 12, paddingBottom: 4 },
  filter: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: c.text },
  count: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: c.bg,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '700', color: c.text },
  sortMenu: {
    position: 'absolute',
    right: 16,
    minWidth: 250,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  sortLabel: { flex: 1, fontSize: 16, color: c.text },
  sortLabelSelected: { fontWeight: '600', color: c.accent },
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
