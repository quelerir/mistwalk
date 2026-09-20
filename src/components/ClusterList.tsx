import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { KIND_LABEL } from '../lib/poi/greeting';
import { KIND_COLOR, kindTint } from '../lib/poi/kindColors';
import type { Poi } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import KindIcon from './KindIcon';
import SvgIcon from './icons/SvgIcon';

export interface ClusterListProps {
  pois: Poi[];
  foundIds: ReadonlySet<string>;
  onPick: (poi: Poi) => void;
  onClose: () => void;
}

// Places that lie on the same spot cannot be told apart by zooming in, so tapping their count lists them.
export default function ClusterList({ pois, foundIds, onPick, onClose }: ClusterListProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>В этой точке: {pois.length}</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Закрыть">
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.list} bounces={false} showsVerticalScrollIndicator={false}>
        {pois.map((poi) => (
          <Pressable
            key={poi.id}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => onPick(poi)}
            accessibilityRole="button"
            accessibilityLabel={poi.name}
          >
            <View style={[styles.badge, { backgroundColor: kindTint(poi.kind) }]}>
              <KindIcon kind={poi.kind} size={20} color={KIND_COLOR[poi.kind]} />
            </View>
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {poi.name}
              </Text>
              <Text style={styles.kind}>{KIND_LABEL[poi.kind]}</Text>
            </View>
            {foundIds.has(poi.id) && <SvgIcon name="check" size={20} color={c.accent} />}
          </Pressable>
        ))}
      </ScrollView>
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
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: c.textMuted },
  close: { fontSize: 16, color: c.textMuted, paddingHorizontal: 4 },
  list: { maxHeight: 260 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  pressed: { opacity: 0.6 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: c.text },
  kind: { marginTop: 1, color: c.textMuted },
});
