import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SvgIcon from './icons/SvgIcon';
import type { IconName } from './icons/svgIcons';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { useT } from '../i18n/I18nProvider';

export interface MenuItem {
  key: string;
  icon: IconName;
  label: string;
  value?: string;
  // A short grey line under the label for settings that are not obvious.
  hint?: string;
  // A switch instead of a value: on/off settings.
  on?: boolean;
  destructive?: boolean;
  // Items of the same group sit together under a small title; a new group starts where the name changes.
  group?: string;
  onPress: () => void;
}

export interface MenuSheetProps {
  visible: boolean;
  items: MenuItem[];
  header?: React.ReactNode;
  // Shown below the list, outside the scroll area (e.g. the app version).
  footer?: React.ReactNode;
  onClose: () => void;
}

// The handle, the sheet's paddings and a gap of backdrop on top: what the list cannot use of the screen height.
const SHEET_CHROME = 90;

export default function MenuSheet({ visible, items, header, footer, onClose }: MenuSheetProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('map.closeMenu')} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.handle} />
        {header}
        {/* Long lists (settings with their groups) scroll instead of running off a small screen. */}
        <ScrollView style={{ maxHeight: windowHeight - insets.top - insets.bottom - SHEET_CHROME }} bounces={false} showsVerticalScrollIndicator={false}>
          {items.map((item, index) => {
            const color = item.destructive ? c.danger : c.text;
            const next = items[index + 1];
            const startsGroup = item.group !== undefined && item.group !== items[index - 1]?.group;
            return (
              <React.Fragment key={item.key}>
                {startsGroup && <Text style={styles.group}>{item.group}</Text>}
                <Pressable
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={item.onPress}
                  accessibilityRole={item.on !== undefined ? 'switch' : 'button'}
                  accessibilityState={item.on !== undefined ? { checked: item.on } : undefined}
                  accessibilityLabel={item.label}
                >
                  <View style={styles.icon}>
                    <SvgIcon name={item.icon} size={20} color={item.destructive ? c.danger : c.text} background={c.surfaceAlt} />
                  </View>
                  {/* No line under the last row of a group: the next group's title separates it. */}
                  <View style={[styles.labelWrap, next && next.group === item.group && styles.separator]}>
                    <View style={styles.labelText}>
                      <Text style={[styles.label, { color }]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
                    </View>
                    {item.on !== undefined ? (
                      <View style={[styles.track, item.on && styles.trackOn]}>
                        <View style={[styles.knob, item.on && styles.knobOn]} />
                      </View>
                    ) : item.value ? (
                      <Text style={styles.value}>{item.value}</Text>
                    ) : null}
                  </View>
                </Pressable>
              </React.Fragment>
            );
          })}
        </ScrollView>
        {footer}
      </View>
    </Modal>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: c.sheetBg,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.sheetHandle,
    marginBottom: 6,
  },
  group: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 2, fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: c.textMuted },
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
  labelText: { flex: 1, paddingVertical: 10, paddingRight: 12 },
  label: { fontSize: 17, fontWeight: '600' },
  hint: { marginTop: 2, fontSize: 13, lineHeight: 17, color: c.textMuted },
  value: { fontSize: 15, color: c.textMuted, marginLeft: 12 },
  track: { width: 48, height: 28, borderRadius: 14, backgroundColor: c.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong, justifyContent: 'center', paddingHorizontal: 2 },
  trackOn: { backgroundColor: c.text, borderColor: c.text },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignSelf: 'flex-start', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  // On a dark track, a white knob loses contrast in dark mode (the track's "on" color is near-white there).
  knobOn: { alignSelf: 'flex-end', backgroundColor: c.bg },
});
