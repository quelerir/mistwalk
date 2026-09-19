import React, { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import SvgIcon from '../components/icons/SvgIcon';
import { haversineDistanceMeters } from '../lib/geo/distance';
import { bearingLabel } from '../lib/poi/discovery';
import { KIND_ICON } from '../lib/poi/greeting';
import type { Poi } from '../lib/poi/types';

export interface NearbyScreenProps {
  pois: Poi[];
  discoveredIds: ReadonlySet<string>;
  origin: { lat: number; lng: number } | null;
  routeTargetId: string | null;
  onRoute: (poi: Poi) => void;
  onCancelRoute: () => void;
}

const MAX_LISTED = 30;
const NEARBY_RADIUS_METERS = 1000;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

export default function NearbyScreen({
  pois,
  discoveredIds,
  origin,
  routeTargetId,
  onRoute,
  onCancelRoute,
}: NearbyScreenProps) {
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
            <View style={styles.row}>
              <View style={styles.iconBadge}>
                <Text style={styles.icon}>{KIND_ICON[item.poi.kind]}</Text>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.name}>Тайное место</Text>
                <Text style={styles.distance}>
                  {formatDistance(item.meters)}, {bearingLabel(origin!, item.poi)}
                </Text>
              </View>
              {item.poi.id === routeTargetId ? (
                <Pressable style={[styles.routeButton, styles.routeButtonActive]} onPress={onCancelRoute}>
                  <Text style={styles.routeTextActive}>Отменить</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.routeButton}
                  onPress={() => onRoute(item.poi)}
                  accessibilityRole="button"
                  accessibilityLabel="Построить маршрут"
                >
                  <SvgIcon name="navigate" size={16} color="#ffffff" background="#262626" />
                  <Text style={styles.routeText}>Маршрут</Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff', paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#262626' },
  subtitle: { marginTop: 2, marginBottom: 12, color: '#8e8e8e' },
  empty: { marginTop: 32, textAlign: 'center', color: '#8e8e8e' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff3cf',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: { fontSize: 20, color: '#8a5a00' },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#262626' },
  distance: { marginTop: 2, color: '#8e8e8e' },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#262626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  routeButtonActive: { backgroundColor: '#efefef' },
  routeText: { color: '#ffffff', fontWeight: '700' },
  routeTextActive: { color: '#262626', fontWeight: '700' },
});
