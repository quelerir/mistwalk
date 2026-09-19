import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haversineDistanceMeters, type Coordinate } from '../lib/geo/distance';
import { KIND_LABEL } from '../lib/poi/greeting';
import KindIcon from './KindIcon';
import type { Poi } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { KIND_COLOR, kindTint } from '../lib/poi/kindColors';

export interface PlaceCardProps {
  poi: Poi;
  origin: Coordinate | null;
  onBuildRoute: () => void;
  onClose: () => void;
}

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

export default function PlaceCard({ poi, origin, onBuildRoute, onClose }: PlaceCardProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const where = origin
    ? `${formatDistance(haversineDistanceMeters(origin, poi))}, ${KIND_LABEL[poi.kind].toLowerCase()}`
    : 'Ждём вашу позицию…';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: kindTint(poi.kind) }]}>
          <KindIcon kind={poi.kind} size={22} color={KIND_COLOR[poi.kind]} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>
            {poi.name}
          </Text>
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

const makeStyles = (c: Colors) => StyleSheet.create({
  card: {
    position: 'absolute',
    left: 16,
    right: 80,
    bottom: 16,
    backgroundColor: c.card,
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
    backgroundColor: c.badgeBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  icon: { fontSize: 18, color: c.badgeFg },
  text: { flex: 1 },
  title: { fontWeight: '700', color: c.text, fontSize: 16 },
  subtitle: { marginTop: 2, color: c.textMuted },
  close: { fontSize: 16, color: c.textMuted, paddingHorizontal: 4 },
  button: {
    marginTop: 12,
    backgroundColor: c.buttonBg,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: c.buttonText, fontWeight: '700' },
});
