import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RouteStatus } from '../hooks/useRoute';
import { formatWalkingTime, type WalkingRoute } from '../lib/routing/walkingRoute';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';
import { formatDistance } from '../i18n/format';

export interface RouteCardProps {
  status: RouteStatus;
  route: WalkingRoute | null;
  title: string;
  remainingMeters?: number;
  remainingSeconds?: number;
  onCancel: () => void;
}

const ARRIVAL_METERS = 40;

export default function RouteCard({
  status,
  route,
  title,
  remainingMeters,
  remainingSeconds,
  onCancel,
}: RouteCardProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  if (status === 'idle') return null;

  const subtitle =
    status === 'ready' && route
      ? remainingMeters !== undefined && remainingMeters < ARRIVAL_METERS
        ? t('route.almost')
        : t('route.left', {
            distance: formatDistance(t, remainingMeters ?? route.distanceMeters),
            time: formatWalkingTime(t, remainingSeconds ?? route.durationSeconds),
          })
      : status === 'error'
        ? t('route.failed')
        : t('route.building');

  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.subtitle, status === 'error' && styles.error]}>{subtitle}</Text>
      </View>
      <Pressable style={styles.cancel} onPress={onCancel} accessibilityRole="button" accessibilityLabel={t('route.cancel')}>
        <Text style={styles.cancelText}>{t('common.cancel')}</Text>
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
