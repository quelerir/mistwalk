import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteStatus } from '../hooks/useRoute';
import { formatWalkingTime, type WalkingRoute } from '../lib/routing/walkingRoute';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface RouteCardProps {
  status: RouteStatus;
  route: WalkingRoute | null;
  title: string;
  remainingMeters?: number;
  remainingSeconds?: number;
  onCancel: () => void;
}

const ARRIVAL_METERS = 40;

function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters / 10) * 10} м` : `${(meters / 1000).toFixed(1)} км`;
}

export default function RouteCard({
  status,
  route,
  title,
  remainingMeters,
  remainingSeconds,
  onCancel,
}: RouteCardProps) {
  const styles = useStyles(makeStyles);
  if (status === 'idle') return null;

  const subtitle =
    status === 'ready' && route
      ? remainingMeters !== undefined && remainingMeters < ARRIVAL_METERS
        ? 'Вы почти на месте'
        : `Осталось ${formatDistance(remainingMeters ?? route.distanceMeters)} · ${formatWalkingTime(
            remainingSeconds ?? route.durationSeconds
          )} пешком`
      : status === 'error'
        ? 'Не удалось построить маршрут'
        : 'Строим маршрут…';

  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.subtitle, status === 'error' && styles.error]}>{subtitle}</Text>
      </View>
      <Pressable style={styles.cancel} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Отменить маршрут">
        <Text style={styles.cancelText}>Отмена</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 24,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: { flex: 1 },
  title: { fontWeight: '700', color: c.text },
  subtitle: { marginTop: 2, color: c.textMuted },
  error: { color: c.danger },
  cancel: { paddingVertical: 6, paddingHorizontal: 10 },
  cancelText: { color: c.accent, fontWeight: '700' },
});
