import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from './icons/SvgIcon';
import type { IconName } from './icons/svgIcons';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';

export interface MenuItem {
  key: string;
  icon: IconName;
  label: string;
  value?: string;
  // A switch instead of a value: on/off settings.
  on?: boolean;
  destructive?: boolean;
  onPress: () => void;
}

export interface MenuSheetProps {
  visible: boolean;
  items: MenuItem[];
  header?: React.ReactNode;
  onClose: () => void;
}

export default function MenuSheet({ visible, items, header, onClose }: MenuSheetProps) {
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть меню" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        {header}
        {items.map((item, index) => {
          const color = item.destructive ? c.danger : c.text;
          return (
            <Pressable
              key={item.key}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={item.onPress}
              accessibilityRole={item.on !== undefined ? 'switch' : 'button'}
              accessibilityState={item.on !== undefined ? { checked: item.on } : undefined}
              accessibilityLabel={item.label}
            >
              <View style={styles.icon}>
                <SvgIcon name={item.icon} size={20} color={item.destructive ? c.danger : c.accent} background={c.surfaceAlt} />
              </View>
              <View style={[styles.labelWrap, index < items.length - 1 && styles.separator]}>
                <Text style={[styles.label, { color }]} numberOfLines={1}>
                  {item.label}
                </Text>
                {item.on !== undefined ? (
                  <View style={[styles.track, item.on && styles.trackOn]}>
                    <View style={[styles.knob, item.on && styles.knobOn]} />
                  </View>
                ) : item.value ? (
                  <Text style={styles.value}>{item.value}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: c.sheetBg,
    paddingTop: 10,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.sheetHandle,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 18, minHeight: 60 },
  rowPressed: { backgroundColor: c.surfaceAlt },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  labelWrap: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 18,
  },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
  label: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  value: { fontSize: 15, color: c.textMuted, marginLeft: 12 },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong, justifyContent: 'center', paddingHorizontal: 2 },
  trackOn: { backgroundColor: c.accent, borderColor: c.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignSelf: 'flex-start', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  knobOn: { alignSelf: 'flex-end' },
});
