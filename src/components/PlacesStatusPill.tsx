import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlacesStatus } from '../lib/poi/placesStatus';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

// Quick loads from the cache are over before anyone could read this, so it only shows when things take a while.
const SHOW_AFTER_MS = 1500;

const TEXT: Record<Exclude<PlacesStatus, 'idle'>, string> = {
  loading: 'Загружаю места рядом…',
  retrying: 'Сервер мест не отвечает, пробую снова…',
};

export default function PlacesStatusPill({ status }: { status: PlacesStatus }) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (status === 'idle' || !visible) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="none">
      <View style={styles.pill} accessibilityRole="alert">
        <ActivityIndicator size="small" color={status === 'retrying' ? c.marigold : c.accent} />
        <Text style={styles.text}>{TEXT[status]}</Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 9 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: c.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: { fontSize: 13, fontWeight: '600', color: c.text },
});
