import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { haversineDistanceMeters } from '../lib/geo/distance';
import { KIND_LABEL } from '../lib/poi/greeting';
import KindIcon from '../components/KindIcon';
import type { Poi } from '../lib/poi/types';
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

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

export default function NearbyScreen({ pois, discoveredIds, origin, onSelect }: NearbyScreenProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const nearby = useMemo(() => {
    if (!origin) return [];
    return pois
      .filter((p) => !discoveredIds.has(p.id))
      .map((p) => ({ poi: p, meters: haversineDistanceMeters(origin, p) }))
      .filter((p) => p.meters <= NEARBY_RADIUS_METERS)
      .sort((a, b) => a.meters - b.meters)
      .slice(0, MAX_LISTED);
  }, [pois, discoveredIds, origin]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Рядом</Text>
      <Text style={styles.subtitle}>Ещё не открытые места в радиусе километра</Text>
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
                <Text style={styles.name}>{KIND_LABEL[item.poi.kind]}</Text>
                <Text style={styles.distance}>
                  {formatDistance(item.meters)}
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
  subtitle: { marginTop: 2, marginBottom: 12, color: c.textMuted },
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
