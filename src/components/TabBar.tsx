import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
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
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          onPress={() => onChange(tab.key)}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.key === active }}
          hitSlop={8}
        >
          {tab.photoUri ? (
            <Image
              source={{ uri: tab.photoUri }}
              style={[
                styles.photo,
                { borderColor: tab.key === active ? c.text : 'transparent' },
              ]}
            />
          ) : (
            <SvgIcon
              name={tab.icon}
              active={tab.key === active}
              color={tab.key === active ? c.text : c.textMuted}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: c.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  tab: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
  photo: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, backgroundColor: c.surfaceAlt },
});
