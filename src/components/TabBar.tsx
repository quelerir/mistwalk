import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from './icons/SvgIcon';
import type { IconName } from './icons/svgIcons';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

export interface TabBarProps<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
}

export default function TabBar<K extends string>({ tabs, active, onChange }: TabBarProps<K>) {
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
          <SvgIcon
            name={tab.icon}
            active={tab.key === active}
            color={tab.key === active ? '#262626' : '#8e8e8e'}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dbdbdb',
  },
  tab: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.5 },
});
