import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from './icons/SvgIcon';
import type { IconName } from './icons/svgIcons';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon: IconName;
  // A profile photo replaces the icon as a small circle.
  photoUri?: string | null;
  // A small number in the corner, e.g. how many things are new; hidden when 0 or missing.
  badge?: number | null;
}

export interface TabBarProps<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
}

export default function TabBar<K extends string>({ tabs, active, onChange }: TabBarProps<K>) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: on }}
            hitSlop={4}
          >
            <View style={styles.pill}>
              {tab.photoUri ? (
                <Image
                  source={{ uri: tab.photoUri }}
                  style={[styles.photo, { borderColor: on ? c.text : 'transparent' }]}
                />
              ) : (
                <SvgIcon name={tab.icon} active={on} size={24} color={on ? c.text : c.textMuted} />
              )}
              {tab.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, on && styles.labelActive]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: c.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: 8,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  pill: { width: 58, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '500', color: c.textMuted },
  labelActive: { fontWeight: '700', color: c.text },
  pressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: c.bg },
  photo: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, backgroundColor: c.surfaceAlt },
});
