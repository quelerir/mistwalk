import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from './icons/SvgIcon';
import type { IconName } from './icons/svgIcons';

export interface MenuItem {
  key: string;
  icon: IconName;
  label: string;
  value?: string;
  destructive?: boolean;
  onPress: () => void;
}

export interface MenuSheetProps {
  visible: boolean;
  items: MenuItem[];
  onClose: () => void;
}

const SHEET_BG = '#262626';
const TEXT_COLOR = '#f5f5f5';
const DANGER_COLOR = '#ff5c6a';

export default function MenuSheet({ visible, items, onClose }: MenuSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть меню" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        {items.map((item, index) => {
          const color = item.destructive ? DANGER_COLOR : TEXT_COLOR;
          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <View style={styles.icon}>
                <SvgIcon name={item.icon} size={26} color={color} background={SHEET_BG} />
              </View>
              <View style={[styles.labelWrap, index < items.length - 1 && styles.separator]}>
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.value ? <Text style={styles.value}>{item.value}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: SHEET_BG,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#5a5a5a',
    marginBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, minHeight: 60 },
  rowPressed: { backgroundColor: '#333333' },
  icon: { width: 30, alignItems: 'center', marginRight: 16 },
  labelWrap: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 18,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3d3d3d' },
  label: { fontSize: 17, flexShrink: 1 },
  value: { fontSize: 15, color: '#8e8e8e', marginLeft: 12 },
});
