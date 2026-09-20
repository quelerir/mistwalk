import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KindIcon from './KindIcon';
import SvgIcon from './icons/SvgIcon';
import { KIND_LABEL } from '../lib/poi/greeting';
import { KIND_COLOR } from '../lib/poi/kindColors';
import type { PoiKind } from '../lib/poi/types';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface MapKindFilterProps {
  // Every kind that has places loaded, with how many (whether shown or not).
  counts: Array<{ kind: PoiKind; count: number }>;
  hidden: ReadonlySet<PoiKind>;
  onChange: (next: Set<PoiKind>) => void;
}

const BUTTON_SIZE = 44;
// Under the status bar and the loading pill, above the map's own controls.
const TOP_OFFSET = 60;

// A round button on the map that opens a small menu: which kinds of places to show. The button is filled while some
// kind is switched off, so a map that looks emptier than expected explains itself.
export default function MapKindFilter({ counts, hidden, onChange }: MapKindFilterProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);

  if (counts.length === 0 && hidden.size === 0) return null;
  const top = insets.top + TOP_OFFSET;
  const filtering = hidden.size > 0;

  function toggle(kind: PoiKind) {
    const next = new Set(hidden);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    onChange(next);
  }

  return (
    <>
      {open && <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Закрыть" />}
      <Pressable
        style={[styles.button, filtering && styles.buttonActive, { top }]}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={filtering ? 'Фильтр мест, включён' : 'Фильтр мест'}
        accessibilityState={{ expanded: open }}
      >
        <SvgIcon name="filter" size={22} color={filtering ? c.bg : c.text} />
      </Pressable>
      {open && (
        <View style={[styles.menu, { top: top + BUTTON_SIZE + 8, maxHeight: windowHeight * 0.55 }]} accessibilityRole="menu">
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Показывать на карте</Text>
            {filtering && (
              <Pressable onPress={() => onChange(new Set())} hitSlop={8} accessibilityRole="button">
                <Text style={styles.reset}>Все</Text>
              </Pressable>
            )}
          </View>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {counts.map(({ kind, count }) => {
              const shown = !hidden.has(kind);
              return (
                <Pressable
                  key={kind}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => toggle(kind)}
                  accessibilityRole="menuitem"
                  accessibilityState={{ checked: shown }}
                  accessibilityLabel={`${KIND_LABEL[kind]}, ${count}`}
                >
                  <KindIcon kind={kind} size={22} color={shown ? KIND_COLOR[kind] : c.textFaint} />
                  <Text style={[styles.label, !shown && styles.labelOff]} numberOfLines={1}>{KIND_LABEL[kind]}</Text>
                  <Text style={styles.count}>{count}</Text>
                  <View style={[styles.box, shown && styles.boxOn]}>
                    {shown && <SvgIcon name="check" size={16} color={c.bg} />}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 8,
  },
  buttonActive: { backgroundColor: c.accent },
  menu: {
    position: 'absolute',
    right: 16,
    width: 320,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
    zIndex: 9,
  },
  menuHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  menuTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: c.textMuted },
  reset: { fontSize: 14, fontWeight: '700', color: c.accent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11 },
  rowPressed: { backgroundColor: c.surfaceAlt },
  label: { flex: 1, fontSize: 15, color: c.text },
  labelOff: { color: c.textMuted },
  count: { fontSize: 14, color: c.textMuted },
  box: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: c.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: c.accent, borderColor: c.accent },
});
