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
            <View style={[styles.pill, on && styles.pillActive]}>
              {tab.photoUri ? (
                <Image
                  source={{ uri: tab.photoUri }}
                  style={[styles.photo, { borderColor: on ? c.accent : 'transparent' }]}
                />
              ) : (
                <SvgIcon name={tab.icon} active={on} size={24} color={on ? c.accent : c.textMuted} />
              )}
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
  pillActive: { backgroundColor: c.accentSoft },
  label: { fontSize: 11, fontWeight: '500', color: c.textMuted },
  labelActive: { fontWeight: '700', color: c.text },
  pressed: { opacity: 0.6 },
  photo: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, backgroundColor: c.surfaceAlt },
});
