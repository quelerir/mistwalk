import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters, type Coordinate } from '../lib/geo/distance';
import { bearingLabel } from '../lib/poi/discovery';
import { KIND_LABEL } from '../lib/poi/greeting';
import KindIcon from './KindIcon';
import type { Poi } from '../lib/poi/types';

export interface PlaceCardProps {
  poi: Poi;
  origin: Coordinate | null;
  onBuildRoute: () => void;
  onClose: () => void;
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

// Undiscovered places stay anonymous: the card only says where the place is.
export default function PlaceCard({ poi, origin, onBuildRoute, onClose }: PlaceCardProps) {
  const where = origin
    ? `${formatDistance(haversineDistanceMeters(origin, poi))}, ${bearingLabel(origin, poi)}`
    : 'Ждём вашу позицию…';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <KindIcon kind={poi.kind} size={22} color="#3b4560" />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{KIND_LABEL[poi.kind]}</Text>
          <Text style={styles.subtitle}>{where}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Закрыть">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={onBuildRoute}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Построить маршрут</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 80,
    bottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef1f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  icon: { fontSize: 18, color: '#3b4560' },
  text: { flex: 1 },
  title: { fontWeight: '700', color: '#262626', fontSize: 16 },
  subtitle: { marginTop: 2, color: '#8e8e8e' },
  close: { fontSize: 16, color: '#8e8e8e', paddingHorizontal: 4 },
  button: {
    marginTop: 12,
    backgroundColor: '#262626',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#ffffff', fontWeight: '700' },
});
